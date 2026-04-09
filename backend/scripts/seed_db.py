from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy.orm import Session

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.bootstrap import ensure_seed_data
from backend.database import engine


def main() -> None:
    with Session(bind=engine) as db:
        ensure_seed_data(db)
    print("Seed data ensured.")


if __name__ == "__main__":
    main()
