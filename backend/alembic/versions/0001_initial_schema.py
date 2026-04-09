"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-09

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


user_role = sa.Enum("ADMIN", "TEACHER", name="userrole")
session_status = sa.Enum("PENDING", "RUNNING", "COMPLETED", "PAUSED", name="sessionstatus")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_name", sa.String(length=255), nullable=False),
        sa.Column("instructor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_courses_id"), "courses", ["id"], unique=False)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("start_time", sa.DateTime(), nullable=False),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("final_avg_score", sa.Float(), nullable=True),
        sa.Column("status", session_status, nullable=False),
        sa.Column("video_path", sa.Text(), nullable=True),
        sa.Column("session_metadata", sa.JSON(), nullable=True),
    )
    op.create_index(op.f("ix_sessions_id"), "sessions", ["id"], unique=False)

    op.create_table(
        "session_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("engagement_score", sa.Float(), nullable=False),
        sa.Column("engaged_count", sa.Integer(), nullable=False),
        sa.Column("distracted_count", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
    )
    op.create_index(op.f("ix_session_logs_id"), "session_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_session_logs_id"), table_name="session_logs")
    op.drop_table("session_logs")

    op.drop_index(op.f("ix_sessions_id"), table_name="sessions")
    op.drop_table("sessions")

    op.drop_index(op.f("ix_courses_id"), table_name="courses")
    op.drop_table("courses")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    session_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
