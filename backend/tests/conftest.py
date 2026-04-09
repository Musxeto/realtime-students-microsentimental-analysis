from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg2://postgres:1234@localhost:5432/fyp_test")


@pytest.fixture(scope="session")
def client() -> TestClient:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

    alembic_cfg = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(alembic_cfg, "head")

    from backend.main import app

    with TestClient(app) as test_client:
        yield test_client

    command.downgrade(alembic_cfg, "base")
