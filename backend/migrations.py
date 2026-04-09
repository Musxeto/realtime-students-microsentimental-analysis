from __future__ import annotations

from alembic import command
from alembic.config import Config


def upgrade_to_head(config_path: str = "alembic.ini") -> None:
    alembic_cfg = Config(config_path)
    command.upgrade(alembic_cfg, "head")
