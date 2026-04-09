from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class LiveSessionState:
    session_id: int
    course_id: int
    video_path: Path
    frame_step: int = 5
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_payload: dict | None = None
    active: bool = True


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

    def remove(self, session_id: int):
        self._sessions.pop(session_id, None)


session_manager = SessionManager()
