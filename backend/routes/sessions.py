from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from ai.inference_utils import resolve_video_path

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import ClassSession, Course, SessionStatus, User, UserRole
from ..schemas import EndSessionResponse, StartSessionRequest, StartSessionResponse
from ..services.database import session_repository
from ..services.inference_service import inference_service
from ..services.session_manager import session_manager


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=StartSessionResponse)
def start_session(payload: StartSessionRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot start sessions for this course")

    video_path = resolve_video_path(settings.ai_dir, payload.video_path, Path(settings.ai_dir))
    session = ClassSession(
        course_id=payload.course_id,
        start_time=datetime.utcnow(),
        status=SessionStatus.RUNNING,
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

    try:
        async for payload in inference_service.stream_video(state.video_path, frame_step=state.frame_step):
            session_manager.consume_frame_payload(session_id, payload)

            state = session_manager.get(session_id)
            if state and len(state.log_buffer) >= settings.session_log_batch_size:
                batch = session_manager.drain_log_buffer(session_id)
                session_repository.add_session_logs(session_id, batch)

            await websocket.send_json({"session_id": session_id, **payload})
    except WebSocketDisconnect:
        session_manager.mark_finished(session_id)
    finally:
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close()
