"""auth token lifecycle support

Revision ID: 0004_auth_token_lifecycle
Revises: 0003_alert_metrics
Create Date: 2026-04-10

"""

from alembic import op
import sqlalchemy as sa


revision = "0004_auth_token_lifecycle"
down_revision = "0003_alert_metrics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("users", "token_version", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "token_version")
