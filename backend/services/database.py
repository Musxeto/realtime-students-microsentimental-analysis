from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import ClassSession, SessionLog


class SessionRepository:
    def add_session_logs(self, session_id: int, logs: Iterable[dict]) -> None:
        payloads = list(logs)
        if not payloads:
            return

        with SessionLocal() as db:
            entries = []
            for payload in payloads:
                entries.append(
                    SessionLog(
                        session_id=session_id,
                        timestamp=datetime.utcnow(),
                        engagement_score=float(payload.get("engagement_score", 0.0)),
                        engaged_count=int(payload.get("engaged_count", 0)),
                        distracted_count=int(payload.get("distracted_count", 0)),
                        payload=payload,
                    )
                )
            db.add_all(entries)
            db.commit()

    def finalize_session(self, session_id: int, final_avg_score: float, summary: dict) -> None:
        with SessionLocal() as db:
            session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
            if session is None:
                return
            session.final_avg_score = final_avg_score
            meta = session.session_metadata or {}
            meta["final_summary"] = summary
            session.session_metadata = meta
            db.commit()


session_repository = SessionRepository()
