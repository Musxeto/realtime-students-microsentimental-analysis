from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]


@dataclass(slots=True)
class Settings:
    app_name: str = "Real-time Students Micro-Sentimental Analysis"
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "dev"))
    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY", "change-me"))
    algorithm: str = field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    access_token_expire_minutes: int = field(default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "300")))
    refresh_token_expire_days: int = field(default_factory=lambda: int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")))
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:1234@localhost:5432/fyp"))
    ai_dir: Path = field(default_factory=lambda: Path(os.getenv("AI_DIR", str(BASE_DIR / "ai"))))
    video_root: Path = field(default_factory=lambda: Path(os.getenv("VIDEO_ROOT", str(BASE_DIR / "ai"))))
    session_log_batch_size: int = field(default_factory=lambda: int(os.getenv("SESSION_LOG_BATCH_SIZE", "60")))
    session_disconnect_timeout_seconds: int = field(default_factory=lambda: int(os.getenv("SESSION_DISCONNECT_TIMEOUT_SECONDS", "30")))


settings = Settings()
