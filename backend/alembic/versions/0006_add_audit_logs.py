"""add audit logs table

Revision ID: 0006_add_audit_logs
Revises: 0005_course_structure
Create Date: 2026-04-18

"""

from alembic import op
import sqlalchemy as sa


revision = "0006_add_audit_logs"
down_revision = "0005_course_structure"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)
    op.create_index("ix_audit_logs_course_timestamp", "audit_logs", ["course_id", "timestamp"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_course_timestamp", table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")
