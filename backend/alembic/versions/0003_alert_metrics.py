"""alert configs, alert events, and performance metrics

Revision ID: 0003_alert_metrics
Revises: 0002_admin_extensions
Create Date: 2026-04-10

"""

from alembic import op
import sqlalchemy as sa


revision = "0003_alert_metrics"
down_revision = "0002_admin_extensions"
branch_labels = None
depends_on = None


alert_enabled = sa.Enum(name="alertenabled_tmp")


def upgrade() -> None:
    op.create_table(
        "alert_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False, unique=True),
        sa.Column("engagement_threshold", sa.Float(), nullable=False, server_default="50"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="180"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_alert_configs_id"), "alert_configs", ["id"], unique=False)

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("triggered_at", sa.DateTime(), nullable=False),
        sa.Column("engagement_at_trigger", sa.Float(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_alert_events_id"), "alert_events", ["id"], unique=False)

    op.create_table(
        "performance_metrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("metric_type", sa.String(length=50), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_performance_metrics_id"), "performance_metrics", ["id"], unique=False)
    op.create_index(
        "ix_performance_metrics_session_type",
        "performance_metrics",
        ["session_id", "metric_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_performance_metrics_session_type", table_name="performance_metrics")
    op.drop_index(op.f("ix_performance_metrics_id"), table_name="performance_metrics")
    op.drop_table("performance_metrics")

    op.drop_index(op.f("ix_alert_events_id"), table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index(op.f("ix_alert_configs_id"), table_name="alert_configs")
    op.drop_table("alert_configs")
