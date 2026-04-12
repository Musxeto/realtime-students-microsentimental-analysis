from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import asyncio


@dataclass
class LiveSessionState:
    session_id: int
    course_id: int
    video_path: Path
    frame_step: int = 1
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_payload: dict | None = None
    active: bool = True
    log_buffer: list[dict] = field(default_factory=list)
    performance_buffer: list[dict] = field(default_factory=list)
    engagement_sum: float = 0.0
    engagement_count: int = 0
    peak_distracted_count: int = 0
    peak_distracted_timestamp: float | None = None
    alert_threshold: float = 50.0
    alert_duration_seconds: int = 180
    alert_enabled: bool = True
    low_engagement_start_sec: float | None = None
    alert_active: bool = False
    alert_reason: str | None = None
    alert_triggered_at: datetime | None = None
    alert_event_open: bool = False
    disconnected_at: datetime | None = None
    timeout_task: asyncio.Task | None = None
    ai_insight: str | None = None
    last_ai_call_at: float = 0.0
    course_code_str: str | None = None
    course_name_str: str | None = None
    teacher_name_str: str | None = None


class SessionManager:
    def __init__(self):
        self._sessions: dict[int, LiveSessionState] = {}

    def create(self, session_id: int, course_id: int, video_path: Path, frame_step: int = 1) -> LiveSessionState:
        state = LiveSessionState(session_id=session_id, course_id=course_id, video_path=video_path, frame_step=frame_step)
        self._sessions[session_id] = state
        return state

    def get(self, session_id: int) -> LiveSessionState | None:
        return self._sessions.get(session_id)

    def mark_finished(self, session_id: int):
        if session_id in self._sessions:
            self._sessions[session_id].active = False
            state = self._sessions[session_id]
            if state.timeout_task and not state.timeout_task.done():
                state.timeout_task.cancel()

    def mark_paused(self, session_id: int):
        state = self._sessions.get(session_id)
        if state is None:
            return
        state.active = False
        state.disconnected_at = datetime.utcnow()

    def mark_running(self, session_id: int):
        state = self._sessions.get(session_id)
        if state is None:
            return
        state.active = True
        state.disconnected_at = None
        if state.timeout_task and not state.timeout_task.done():
            state.timeout_task.cancel()
        state.timeout_task = None

    def attach_timeout_task(self, session_id: int, task: asyncio.Task):
        state = self._sessions.get(session_id)
        if state is None:
            return
        if state.timeout_task and not state.timeout_task.done():
            state.timeout_task.cancel()
        state.timeout_task = task

    def consume_frame_payload(self, session_id: int, payload: dict) -> None:
        state = self._sessions.get(session_id)
        if state is None:
            return None
        state.last_payload = payload
        state.log_buffer.append(payload)
        metric_latency = payload.get("processing_latency_ms")
        if metric_latency is not None:
            state.performance_buffer.append(
                {
                    "metric_type": "processing_latency_ms",
                    "value": float(metric_latency),
                    "timestamp": datetime.utcnow(),
                }
            )
        score = float(payload.get("engagement_score", 0.0))
        state.engagement_sum += score
        state.engagement_count += 1
        distracted_count = int(payload.get("distracted_count", 0))
        if distracted_count >= state.peak_distracted_count:
            state.peak_distracted_count = distracted_count
            state.peak_distracted_timestamp = payload.get("timestamp_sec")

        timestamp_sec = float(payload.get("timestamp_sec", 0.0))
        if not state.alert_enabled:
            state.low_engagement_start_sec = None
            state.alert_active = False
            state.alert_reason = None
            state.alert_triggered_at = None
            state.alert_event_open = False
            return self.alert_state(session_id)

        if score < state.alert_threshold:
            if state.low_engagement_start_sec is None:
                state.low_engagement_start_sec = timestamp_sec
            low_duration = timestamp_sec - state.low_engagement_start_sec
            if not state.alert_active and low_duration >= state.alert_duration_seconds:
                state.alert_active = True
                state.alert_reason = (
                    f"Engagement below {state.alert_threshold}% for {state.alert_duration_seconds}s"
                )
                state.alert_triggered_at = datetime.utcnow()
                state.alert_event_open = True
        else:
            state.low_engagement_start_sec = None
            if state.alert_active:
                state.alert_active = False
                state.alert_reason = None
                state.alert_triggered_at = None
                state.alert_event_open = False

        return self.alert_state(session_id)

    def set_alert_config(
        self,
        session_id: int,
        *,
        threshold: float,
        duration_seconds: int,
        enabled: bool,
    ) -> None:
        state = self._sessions.get(session_id)
        if state is None:
            return
        state.alert_threshold = threshold
        state.alert_duration_seconds = duration_seconds
        state.alert_enabled = enabled

    def alert_state(self, session_id: int) -> dict:
        state = self._sessions.get(session_id)
        if state is None:
            return {"active": False, "reason": "", "triggered_at": None, "ai_insight": None}
        return {
            "active": state.alert_active,
            "reason": state.alert_reason or "",
            "triggered_at": state.alert_triggered_at.isoformat() if state.alert_triggered_at else None,
            "ai_insight": state.ai_insight,
        }

    def drain_performance_buffer(self, session_id: int) -> list[dict]:
        state = self._sessions.get(session_id)
        if state is None or not state.performance_buffer:
            return []
        drained = list(state.performance_buffer)
        state.performance_buffer.clear()
        return drained

    def drain_log_buffer(self, session_id: int) -> list[dict]:
        state = self._sessions.get(session_id)
        if state is None or not state.log_buffer:
            return []
        drained = list(state.log_buffer)
        state.log_buffer.clear()
        return drained

    def final_summary(self, session_id: int) -> dict:
        state = self._sessions.get(session_id)
        if state is None:
            return {
                "avg_engagement_score": 0.0,
                "processed_frames": 0,
                "peak_distracted_count": 0,
                "peak_distracted_timestamp": None,
            }

        avg = (state.engagement_sum / state.engagement_count) if state.engagement_count else 0.0
        return {
            "avg_engagement_score": round(avg, 2),
            "processed_frames": state.engagement_count,
            "peak_distracted_count": state.peak_distracted_count,
            "peak_distracted_timestamp": state.peak_distracted_timestamp,
        }

    def remove(self, session_id: int):
        self._sessions.pop(session_id, None)


session_manager = SessionManager()
