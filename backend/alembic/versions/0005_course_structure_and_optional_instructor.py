"""course structure updates and optional instructor assignment

Revision ID: 0005_course_structure
Revises: 0004_auth_token_lifecycle
Create Date: 2026-04-10

"""

from alembic import op
import sqlalchemy as sa


revision = "0005_course_structure"
down_revision = "0004_auth_token_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("courses", sa.Column("course_code", sa.String(length=32), nullable=True))
	op.add_column("courses", sa.Column("semester", sa.Integer(), nullable=False, server_default="1"))
	op.add_column("courses", sa.Column("section", sa.Integer(), nullable=False, server_default="1"))

	op.execute("UPDATE courses SET course_code = CONCAT('CRS-', id) WHERE course_code IS NULL")

	op.alter_column("courses", "course_code", nullable=False)
	op.alter_column("courses", "semester", server_default=None)
	op.alter_column("courses", "section", server_default=None)
	op.alter_column("courses", "instructor_id", existing_type=sa.Integer(), nullable=True)

	op.create_unique_constraint(
		"uq_courses_code_semester_section",
		"courses",
		["course_code", "semester", "section"],
	)


def downgrade() -> None:
	op.drop_constraint("uq_courses_code_semester_section", "courses", type_="unique")

	op.alter_column("courses", "instructor_id", existing_type=sa.Integer(), nullable=False)
	op.drop_column("courses", "section")
	op.drop_column("courses", "semester")
	op.drop_column("courses", "course_code")
