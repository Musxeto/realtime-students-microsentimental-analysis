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
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'backend' / 'app.db'}"))
    ai_dir: Path = field(default_factory=lambda: Path(os.getenv("AI_DIR", str(BASE_DIR / "ai"))))
    video_root: Path = field(default_factory=lambda: Path(os.getenv("VIDEO_ROOT", str(BASE_DIR / "ai"))))


settings = Settings()
