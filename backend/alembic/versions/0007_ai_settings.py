"""add ai settings table

Revision ID: 0007_ai_settings
Revises: 0006_add_audit_logs
Create Date: 2026-05-17

"""

from alembic import op
import sqlalchemy as sa


revision = "0007_ai_settings"
down_revision = "0006_add_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("update_interval_seconds", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_ai_settings_id"), "ai_settings", ["id"], unique=False)
    op.execute(
        "INSERT INTO ai_settings (id, update_interval_seconds, created_at, updated_at) "
        "VALUES (1, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_settings_id"), table_name="ai_settings")
    op.drop_table("ai_settings")
