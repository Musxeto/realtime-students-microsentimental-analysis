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
    frame_step: int = 5
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_payload: dict | None = None
    active: bool = True
    log_buffer: list[dict] = field(default_factory=list)
    engagement_sum: float = 0.0
    engagement_count: int = 0
    peak_distracted_count: int = 0
    peak_distracted_timestamp: float | None = None
    disconnected_at: datetime | None = None
    timeout_task: asyncio.Task | None = None


class SessionManager:
    def __init__(self):
        self._sessions: dict[int, LiveSessionState] = {}

    def create(self, session_id: int, course_id: int, video_path: Path, frame_step: int = 5) -> LiveSessionState:
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
            return
        state.last_payload = payload
        state.log_buffer.append(payload)
        score = float(payload.get("engagement_score", 0.0))
        state.engagement_sum += score
        state.engagement_count += 1
        distracted_count = int(payload.get("distracted_count", 0))
        if distracted_count >= state.peak_distracted_count:
            state.peak_distracted_count = distracted_count
            state.peak_distracted_timestamp = payload.get("timestamp_sec")

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
