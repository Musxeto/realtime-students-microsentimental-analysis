from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import AISettings

DEFAULT_AI_UPDATE_INTERVAL_SECONDS = 60


def get_ai_settings(db: Session) -> AISettings | None:
    return db.query(AISettings).first()


def get_ai_update_interval_seconds(db: Session) -> int:
    settings = get_ai_settings(db)
    if settings is None:
        return DEFAULT_AI_UPDATE_INTERVAL_SECONDS
    return max(DEFAULT_AI_UPDATE_INTERVAL_SECONDS, int(settings.update_interval_seconds))


def upsert_ai_settings(db: Session, update_interval_seconds: int) -> AISettings:
    settings = get_ai_settings(db)
    if settings is None:
        settings = AISettings(update_interval_seconds=update_interval_seconds)
        db.add(settings)
    else:
        settings.update_interval_seconds = update_interval_seconds
    db.commit()
    db.refresh(settings)
    return settings
