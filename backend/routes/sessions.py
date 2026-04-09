from __future__ import annotations

from datetime import datetime
from pathlib import Path
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from ai.inference_utils import resolve_video_path

from ..config import settings
from ..database import SessionLocal, get_db
from ..deps import get_current_user
from ..models import ClassSession, Course, SessionLog, SessionStatus, User, UserRole
from ..schemas import EndSessionResponse, SessionListResponse, SessionLogsResponse, SessionLogOut, SessionOut, StartSessionRequest, StartSessionResponse
from ..services.database import session_repository
from ..services.inference_service import inference_service
from ..services.session_manager import session_manager


router = APIRouter(prefix="/sessions", tags=["sessions"])


def _apply_role_scope(base_query, current_user: User):
    if current_user.role == UserRole.ADMIN:
        return base_query
    return base_query.join(Course, Course.id == ClassSession.course_id).filter(Course.instructor_id == current_user.id)


def _to_session_out(session: ClassSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        course_id=session.course_id,
        status=session.status.value,
        start_time=session.start_time,
        end_time=session.end_time,
        final_avg_score=session.final_avg_score,
        video_path=session.video_path,
        session_metadata=session.session_metadata,
    )


async def _auto_complete_if_disconnected(session_id: int):
    await asyncio.sleep(settings.session_disconnect_timeout_seconds)

    state = session_manager.get(session_id)
    if state is None or state.active:
        return

    pending_logs = session_manager.drain_log_buffer(session_id)
    if pending_logs:
        session_repository.add_session_logs(session_id, pending_logs)
    summary = session_manager.final_summary(session_id)
    final_avg_score = float(summary.get("avg_engagement_score", 0.0))

    with SessionLocal() as db:
        db_session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
        if db_session is None:
            return
        db_session.status = SessionStatus.COMPLETED
        db_session.end_time = datetime.utcnow()
        db_session.final_avg_score = final_avg_score
        metadata = db_session.session_metadata or {}
        metadata["final_summary"] = summary
        metadata["auto_ended_on_disconnect"] = True
        db_session.session_metadata = metadata
        db.commit()

    session_manager.mark_finished(session_id)


@router.get("", response_model=SessionListResponse)
def list_sessions(
    course_id: Optional[int] = None,
    status_filter: Optional[SessionStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_role_scope(db.query(ClassSession), current_user)
    if course_id is not None:
        query = query.filter(ClassSession.course_id == course_id)
    if status_filter is not None:
        query = query.filter(ClassSession.status == status_filter)

    total = query.count()
    rows = query.order_by(ClassSession.start_time.desc()).offset(offset).limit(limit).all()
    return SessionListResponse(items=[_to_session_out(row) for row in rows], total=total, limit=limit, offset=offset)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = _apply_role_scope(db.query(ClassSession), current_user)
    session = query.filter(ClassSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _to_session_out(session)


@router.get("/{session_id}/logs", response_model=SessionLogsResponse)
def get_session_logs(
    session_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_query = _apply_role_scope(db.query(ClassSession), current_user)
    db_session = session_query.filter(ClassSession.id == session_id).first()
    if db_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    logs_query = db.query(SessionLog).filter(SessionLog.session_id == session_id)
    total = logs_query.count()
    rows = logs_query.order_by(SessionLog.timestamp.asc()).offset(offset).limit(limit).all()
    return SessionLogsResponse(items=[SessionLogOut.model_validate(row) for row in rows], total=total, limit=limit, offset=offset)


@router.post("/start", response_model=StartSessionResponse)
def start_session(payload: StartSessionRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot start sessions for this course")

    active_statuses = [SessionStatus.PENDING, SessionStatus.RUNNING, SessionStatus.PAUSED]
    duplicate_course = (
        db.query(ClassSession)
        .filter(ClassSession.course_id == payload.course_id, ClassSession.status.in_(active_statuses))
        .first()
    )
    if duplicate_course:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An active session already exists for this course")

    duplicate_teacher = (
        db.query(ClassSession)
        .join(Course, Course.id == ClassSession.course_id)
        .filter(Course.instructor_id == course.instructor_id, ClassSession.status.in_(active_statuses))
        .first()
    )
    if duplicate_teacher:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Teacher already has an active session")

    video_path = resolve_video_path(settings.ai_dir, payload.video_path, Path(settings.ai_dir))
    session = ClassSession(
        course_id=payload.course_id,
        start_time=datetime.utcnow(),
        status=SessionStatus.PENDING,
        video_path=str(video_path),
        session_metadata={"frame_step": payload.frame_step},
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    session_manager.create(session.id, payload.course_id, video_path, payload.frame_step)
    return StartSessionResponse(session_id=session.id, course_id=payload.course_id, status=session.status.value, start_time=session.start_time)


@router.post("/{session_id}/end", response_model=EndSessionResponse)
def end_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    course = db.query(Course).filter(Course.id == session.course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot end this session")

    pending_logs = session_manager.drain_log_buffer(session_id)
    if pending_logs:
        session_repository.add_session_logs(session_id, pending_logs)

    summary = session_manager.final_summary(session_id)
    final_avg_score = float(summary.get("avg_engagement_score", 0.0))

    session.status = SessionStatus.COMPLETED
    session.end_time = datetime.utcnow()
    session.final_avg_score = final_avg_score

    metadata = session.session_metadata or {}
    metadata["final_summary"] = summary
    session.session_metadata = metadata
    db.commit()

    session_repository.finalize_session(session_id, final_avg_score, summary)
    session_manager.mark_finished(session_id)
    return EndSessionResponse(session_id=session.id, status=session.status.value, final_avg_score=final_avg_score)


@router.websocket("/ws/stream/{session_id}")
async def stream_session(websocket: WebSocket, session_id: int):
    await websocket.accept()
    state = session_manager.get(session_id)
    if state is None:
        await websocket.send_json({"error_code": "SESSION_NOT_FOUND", "message": "Session not started or expired"})
        await websocket.close(code=1008)
        return

    with SessionLocal() as db:
        db_session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
        if db_session is None:
            await websocket.send_json({"error_code": "SESSION_NOT_FOUND", "message": "Session not found in database"})
            await websocket.close(code=1008)
            return
        db_session.status = SessionStatus.RUNNING
        db.commit()

    session_manager.mark_running(session_id)

    try:
        async for payload in inference_service.stream_video(state.video_path, frame_step=state.frame_step):
            session_manager.consume_frame_payload(session_id, payload)

            state = session_manager.get(session_id)
            if state and len(state.log_buffer) >= settings.session_log_batch_size:
                batch = session_manager.drain_log_buffer(session_id)
                session_repository.add_session_logs(session_id, batch)

            await websocket.send_json({"session_id": session_id, **payload})
    except WebSocketDisconnect:
        session_manager.mark_paused(session_id)
        with SessionLocal() as db:
            db_session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
            if db_session is not None:
                db_session.status = SessionStatus.PAUSED
                db.commit()

        timeout_task = asyncio.create_task(_auto_complete_if_disconnected(session_id))
        session_manager.attach_timeout_task(session_id, timeout_task)
    finally:
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close()
