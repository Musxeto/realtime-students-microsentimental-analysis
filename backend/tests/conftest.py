from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg2://postgres:1234@localhost:5432/fyp_test")


def _seed_test_data() -> None:
    from backend.database import SessionLocal
    from backend.models import Course, User, UserRole
    from backend.security import hash_password

    with SessionLocal() as db:
        admin = User(
            name="Admin User",
            email="admin@fyp.com",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
        )
        teacher = User(
            name="Teacher One",
            email="teacher@fyp.com",
            hashed_password=hash_password("teacher123"),
            role=UserRole.TEACHER,
        )
        db.add(admin)
        db.add(teacher)
        db.flush()

        db.add(
            Course(
                course_name="Software Engineering",
                course_code="CSC361",
                semester=5,
                section=1,
                instructor_id=teacher.id,
            )
        )
        db.add(
            Course(
                course_name="Artificial Intelligence",
                course_code="CSC363",
                semester=6,
                section=1,
                instructor_id=teacher.id,
            )
        )
        db.add(
            Course(
                course_name="Database Systems",
                course_code="CSC352",
                semester=4,
                section=1,
                instructor_id=None,
            )
        )
        db.commit()


def _ensure_database_exists(database_url: str) -> None:
    url = make_url(database_url)
    db_name = url.database
    if not db_name:
        raise RuntimeError("TEST_DATABASE_URL must include a database name")

    admin_url = url.set(database="postgres")
    admin_engine = create_engine(admin_url, future=True, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": db_name}).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session")
def client() -> TestClient:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

    _ensure_database_exists(TEST_DATABASE_URL)

    reset_engine = create_engine(TEST_DATABASE_URL, future=True)
    with reset_engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    alembic_cfg = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(alembic_cfg, "head")

    _seed_test_data()

    from backend.main import app

    with TestClient(app) as test_client:
        yield test_client

    # command.downgrade(alembic_cfg, "base") # Schema is dropped anyway
