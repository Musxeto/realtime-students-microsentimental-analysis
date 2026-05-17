from __future__ import annotations

from datetime import datetime
from pathlib import Path
import asyncio
from time import monotonic
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ai.inference_utils import resolve_video_path

from ..config import settings
from ..database import SessionLocal, get_db
from ..deps import get_current_user
from ..models import AlertConfig, AlertEvent, ClassSession, Course, PerformanceMetric, SessionLog, SessionStatus, User, UserRole, AuditLog
from ..schemas import EndSessionResponse, SessionListResponse, SessionLogsResponse, SessionLogOut, SessionMetricsResponse, SessionOut, StartSessionRequest, StartSessionResponse
from ..services.ai_settings import get_ai_update_interval_seconds
from ..services.database import session_repository
from ..services.inference_service import inference_service
from ..services.openai_service import openai_service
from ..services.opencv_preview import OpenCVSessionPreview
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
        course_name=session.course.course_name if session.course else None,
        instructor_name=session.course.instructor.name if session.course and session.course.instructor else "Teacher",
        status=session.status.value,
        start_time=session.start_time,
        end_time=session.end_time,
        final_avg_score=session.final_avg_score,
        video_path=session.video_path,
        session_metadata=session.session_metadata,
    )


def _load_alert_config(db: Session, course_id: int) -> dict:
    config = db.query(AlertConfig).filter(AlertConfig.course_id == course_id).first()
    if config is None:
        return {"engagement_threshold": 50.0, "duration_seconds": 180, "enabled": True}
    return {
        "engagement_threshold": float(config.engagement_threshold),
        "duration_seconds": int(config.duration_seconds),
        "enabled": bool(config.enabled),
    }


def _complete_session_now(session_id: int, *, auto_flag: str | None = None) -> None:
    pending_logs = session_manager.drain_log_buffer(session_id)
    if pending_logs:
        session_repository.add_session_logs(session_id, pending_logs)
    pending_metrics = session_manager.drain_performance_buffer(session_id)
    if pending_metrics:
        session_repository.add_performance_metrics(session_id, pending_metrics)

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
        if auto_flag:
            metadata[auto_flag] = True
        db_session.session_metadata = metadata
        db.commit()

    session_repository.finalize_session(session_id, final_avg_score, summary)
    session_manager.mark_finished(session_id)


def _cleanup_stale_active_sessions(db: Session, *, course_id: int, instructor_id: int | None) -> None:
    active_statuses = [SessionStatus.PENDING, SessionStatus.RUNNING, SessionStatus.PAUSED]

    stale_course_sessions = (
        db.query(ClassSession)
        .filter(ClassSession.course_id == course_id, ClassSession.status.in_(active_statuses))
        .all()
    )
    for stale in stale_course_sessions:
        if session_manager.get(stale.id) is None:
            stale.status = SessionStatus.COMPLETED
            stale.end_time = stale.end_time or datetime.utcnow()
            metadata = stale.session_metadata or {}
            metadata["stale_active_auto_closed"] = True
            stale.session_metadata = metadata

    if instructor_id is not None:
        stale_teacher_sessions = (
            db.query(ClassSession)
            .join(Course, Course.id == ClassSession.course_id)
            .filter(Course.instructor_id == instructor_id, ClassSession.status.in_(active_statuses))
            .all()
        )
        for stale in stale_teacher_sessions:
            if session_manager.get(stale.id) is None:
                stale.status = SessionStatus.COMPLETED
                stale.end_time = stale.end_time or datetime.utcnow()
                metadata = stale.session_metadata or {}
                metadata["stale_active_auto_closed"] = True
                stale.session_metadata = metadata

    db.commit()


async def _auto_complete_if_disconnected(session_id: int):
    await asyncio.sleep(settings.session_disconnect_timeout_seconds)

    state = session_manager.get(session_id)
    if state is None or state.active:
        return

    pending_logs = session_manager.drain_log_buffer(session_id)
    if pending_logs:
        session_repository.add_session_logs(session_id, pending_logs)
    pending_metrics = session_manager.drain_performance_buffer(session_id)
    if pending_metrics:
        session_repository.add_performance_metrics(session_id, pending_metrics)
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

    # Recover from stale sessions left active in DB after process restart/crash.
    _cleanup_stale_active_sessions(db, course_id=payload.course_id, instructor_id=course.instructor_id)

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
    return StartSessionResponse(
        session_id=session.id,
        course_id=payload.course_id,
        course_name=course.course_name,
        status=session.status.value,
        start_time=session.start_time
    )


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
    pending_metrics = session_manager.drain_performance_buffer(session_id)
    if pending_metrics:
        session_repository.add_performance_metrics(session_id, pending_metrics)

    summary = session_manager.final_summary(session_id)
    final_avg_score = float(summary.get("avg_engagement_score", 0.0))

    session.status = SessionStatus.COMPLETED
    session.end_time = datetime.utcnow()
    session.final_avg_score = final_avg_score
    
    duration_sec = 0
    if session.start_time and session.end_time:
        duration_sec = int((session.end_time - session.start_time).total_seconds())

    metadata = session.session_metadata or {}
    metadata["final_summary"] = summary
    session.session_metadata = metadata
    
    audit = AuditLog(
        course_id=session.course_id,
        action="CLASS_COMPLETED",
        details={
            "session_id": session.id,
            "duration_seconds": duration_sec,
            "avg_engagement": final_avg_score
        }
    )
    db.add(audit)
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

    with SessionLocal() as db:
        course = db.query(Course).filter(Course.id == state.course_id).first()
        if course is not None:
            state.course_code_str = course.course_code
            state.course_name_str = course.course_name
            if course.instructor:
                state.teacher_name_str = course.instructor.name
            else:
                state.teacher_name_str = "Teacher"
                
            alert_config = _load_alert_config(db, course.id)
            session_manager.set_alert_config(
                session_id,
                threshold=alert_config["engagement_threshold"],
                duration_seconds=alert_config["duration_seconds"],
                enabled=alert_config["enabled"],
            )

    flush_interval = max(0.1, float(settings.session_log_flush_interval_seconds))
    last_log_flush_at = monotonic()
    last_metric_flush_at = monotonic()
    preview = OpenCVSessionPreview(
        session_id=session_id,
        enabled=settings.session_opencv_preview_enabled,
        window_name_prefix=settings.session_opencv_preview_window_name,
    )
    stream_exhausted = False

    try:
        async for payload in inference_service.stream_video(state.video_path, frame_step=state.frame_step):
            state = session_manager.get(session_id)
            if not state or not state.active:
                import logging
                logging.getLogger(__name__).info(f"Session {session_id} is no longer active (manually ended or completed). Terminating WebSocket stream.")
                break

            alert_state = session_manager.consume_frame_payload(session_id, payload)
            now = monotonic()
            flush_logs_due = (now - last_log_flush_at) >= flush_interval
            flush_metrics_due = (now - last_metric_flush_at) >= flush_interval

            state = session_manager.get(session_id)
            if state and (flush_logs_due or len(state.log_buffer) >= settings.session_log_batch_size):
                batch = session_manager.drain_log_buffer(session_id)
                if batch:
                    session_repository.add_session_logs(session_id, batch)
                last_log_flush_at = now

            state = session_manager.get(session_id)
            if state and (flush_metrics_due or len(state.performance_buffer) >= settings.session_log_batch_size):
                metrics_batch = session_manager.drain_performance_buffer(session_id)
                if metrics_batch:
                    session_repository.add_performance_metrics(session_id, metrics_batch)
                last_metric_flush_at = now

            if state and alert_state and alert_state.get("active") and state.alert_event_open:
                session_repository.add_alert_event(
                    session_id,
                    engagement_at_trigger=float(payload.get("engagement_score", 0.0)),
                    reason=alert_state.get("reason", "Low engagement detected"),
                )
                state.alert_event_open = False

            # --- OpenAI AI Periodic Insight ---
            ROLLING_WINDOW_SECONDS = 10
            if state:
                if not hasattr(state, 'engagement_window'):
                    state.engagement_window = []  # list of (monotonic_time, score)

                state.engagement_window.append((monotonic(), float(payload.get("engagement_score", 0.0))))

                current_time = monotonic()
                ai_update_interval_seconds = get_ai_update_interval_seconds(db)
                if current_time - getattr(state, 'last_ai_call_at', 0.0) >= ai_update_interval_seconds:
                    # Keep only entries from the last 10 seconds
                    cutoff = current_time - ROLLING_WINDOW_SECONDS
                    recent = [score for ts, score in state.engagement_window if ts >= cutoff]

                    if recent:
                        avg_window_engagement = sum(recent) / len(recent)
                    else:
                        avg_window_engagement = float(payload.get("engagement_score", 0.0))

                    last_val = getattr(state, 'last_ai_engagement', -1.0)
                    last_alert = getattr(state, 'last_ai_alert_active', None)
                    curr_alert = bool(alert_state and alert_state.get("active"))

                    significant = (
                        abs(avg_window_engagement - last_val) >= 5.0 or
                        curr_alert != last_alert or
                        (current_time - getattr(state, 'last_ai_call_at', 0.0)) > 180.0
                    )

                    # Trim old entries beyond the window (keep buffer lean)
                    state.engagement_window = [(ts, s) for ts, s in state.engagement_window if ts >= cutoff]

                    if not significant and last_val != -1.0:
                        state.last_ai_call_at = current_time
                        import logging
                        logging.getLogger(__name__).debug(f"Session {session_id}: Skipping AI call (No significant change).")
                    else:
                        state.last_ai_call_at = current_time
                        state.last_ai_engagement = avg_window_engagement
                        state.last_ai_alert_active = curr_alert

                        async def fetch_insight(curr_state, engagement, payload_snapshot, alert_status):
                            try:
                                import logging
                                srv_logger = logging.getLogger(__name__)
                                srv_logger.info(f"Session {session_id}: Requesting OpenAI pedagogical insight (Avg Engagement: {engagement:.1f})...")

                                insight = await openai_service.generate_pedagogical_insight(
                                    engagement_score=engagement,
                                    distracted_count=int(payload_snapshot.get("distracted_count", 0)),
                                    student_count=int(payload_snapshot.get("student_count", 0)),
                                    alert_active=alert_status,
                                    course_name=curr_state.course_name_str or curr_state.course_code_str or "Class",
                                    teacher_name=curr_state.teacher_name_str or "Teacher",
                                )
                                if insight:
                                    curr_state.ai_insight = insight
                                    srv_logger.info(f"Session {session_id}: AI Insight received: {insight}")
                                else:
                                    srv_logger.warning(f"Session {session_id}: OpenAI returned empty insight.")
                            except Exception as e:
                                import logging
                                logging.getLogger(__name__).error(f"Error fetching AI insight: {e}")

                        asyncio.create_task(fetch_insight(state, avg_window_engagement, dict(payload), curr_alert))

                if state.ai_insight:
                    if alert_state and alert_state.get("active"):
                        alert_state["reason"] = f"AI Alert: {state.ai_insight}"
                    else:
                        payload["message"] = f"AI Coach: {state.ai_insight}"
            # ----------------------------------

            outgoing = {
                "session_id": session_id,
                "course_name": state.course_name_str or "Class",
                "alert_state": alert_state,
                **payload
            }
            await websocket.send_json(outgoing)
            preview.show_payload(outgoing)

        state = session_manager.get(session_id)
        if state and state.active:
            stream_exhausted = True
            _complete_session_now(session_id, auto_flag="auto_ended_on_stream_complete")

            if websocket.client_state.name == "CONNECTED":
                final = state.last_payload or {}
                await websocket.send_json(
                    {
                        "session_id": session_id,
                        "stream_completed": True,
                        "message": "Video stream completed",
                        **final,
                    }
                )
    except (WebSocketDisconnect, RuntimeError):
        if stream_exhausted:
            return

        # If session already ended (manual end or auto-complete), do not downgrade to PAUSED.
        with SessionLocal() as db:
            db_session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
            if db_session is None:
                return
            if db_session.status == SessionStatus.COMPLETED:
                return
            db_session.status = SessionStatus.PAUSED
            db.commit()

        session_manager.mark_paused(session_id)
        timeout_task = asyncio.create_task(_auto_complete_if_disconnected(session_id))
        session_manager.attach_timeout_task(session_id, timeout_task)
    finally:
        preview.close()
        if websocket.client_state.name != "DISCONNECTED":
            try:
                await websocket.close()
            except RuntimeError:
                pass


@router.get("/{session_id}/metrics", response_model=SessionMetricsResponse)
def get_session_metrics(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session_query = _apply_role_scope(db.query(ClassSession), current_user)
    session = session_query.filter(ClassSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    latencies = [row[0] for row in db.query(PerformanceMetric.value).filter(PerformanceMetric.session_id == session_id, PerformanceMetric.metric_type == "processing_latency_ms").all()]
    alert_count = db.query(func.count(AlertEvent.id)).filter(AlertEvent.session_id == session_id).scalar() or 0
    logs = db.query(SessionLog).filter(SessionLog.session_id == session_id).order_by(SessionLog.timestamp.asc()).all()

    if latencies:
        avg_latency = round(sum(latencies) / len(latencies), 2)
        sorted_latencies = sorted(latencies)
        idx = int(round(0.95 * (len(sorted_latencies) - 1)))
        p95_latency = float(sorted_latencies[idx])
    else:
        avg_latency = None
        p95_latency = None

    if len(logs) >= 2:
        start = logs[0].timestamp
        end = logs[-1].timestamp
        elapsed_seconds = max((end - start).total_seconds(), 1e-6)
        actual_fps = round(len(logs) / elapsed_seconds, 2)
    else:
        actual_fps = None

    target_fps = None
    if session.session_metadata and session.session_metadata.get("frame_step"):
        target_fps = round(30 / float(session.session_metadata["frame_step"]), 2)

    avg_engagement = None
    if logs:
        avg_engagement = round(sum(log.engagement_score for log in logs) / len(logs), 2)

    return SessionMetricsResponse(
        session_id=session_id,
        avg_latency_ms=avg_latency,
        p95_latency_ms=p95_latency,
        actual_fps=actual_fps,
        target_fps=target_fps,
        avg_engagement_score=avg_engagement,
        alert_count=int(alert_count),
    )
