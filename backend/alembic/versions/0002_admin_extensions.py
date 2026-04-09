"""admin extensions and analytics indexes

Revision ID: 0002_admin_extensions
Revises: 0001_initial_schema
Create Date: 2026-04-10

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_admin_extensions"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column("users", "is_active", server_default=None)

    op.create_index(
        "ix_session_logs_session_timestamp",
        "session_logs",
        ["session_id", "timestamp"],
        unique=False,
    )
    op.create_index(
        "ix_sessions_course_start_time",
        "sessions",
        ["course_id", "start_time"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_course_start_time", table_name="sessions")
    op.drop_index("ix_session_logs_session_timestamp", table_name="session_logs")
    op.drop_column("users", "is_active")
