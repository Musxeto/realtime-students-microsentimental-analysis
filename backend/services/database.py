from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import AlertEvent, ClassSession, PerformanceMetric, SessionLog


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

    def add_alert_event(self, session_id: int, engagement_at_trigger: float, reason: str) -> None:
        with SessionLocal() as db:
            db.add(
                AlertEvent(
                    session_id=session_id,
                    engagement_at_trigger=engagement_at_trigger,
                    reason=reason,
                )
            )
            db.commit()

    def add_performance_metrics(self, session_id: int, metrics: Iterable[dict]) -> None:
        payloads = list(metrics)
        if not payloads:
            return

        with SessionLocal() as db:
            entries = []
            for payload in payloads:
                entries.append(
                    PerformanceMetric(
                        session_id=session_id,
                        metric_type=str(payload.get("metric_type", "processing_latency_ms")),
                        value=float(payload.get("value", 0.0)),
                        timestamp=payload.get("timestamp", datetime.utcnow()),
                    )
                )
            db.add_all(entries)
            db.commit()


session_repository = SessionRepository()
