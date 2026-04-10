from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config


def upgrade_to_head(config_path: str | None = None) -> None:
    repo_root = Path(__file__).resolve().parents[1]
    resolved_config = Path(config_path) if config_path else repo_root / "alembic.ini"

    alembic_cfg = Config(str(resolved_config))
    alembic_cfg.set_main_option("script_location", str(repo_root / "backend" / "alembic"))
    command.upgrade(alembic_cfg, "head")
