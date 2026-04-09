from __future__ import annotations

from sqlalchemy.orm import Session

from .models import Course, User, UserRole
from .security import hash_password


def ensure_seed_data(db: Session) -> None:
    admin = db.query(User).filter(User.email == "admin@fyp.local").first()
    if admin is None:
        admin = User(
            name="Admin User",
            email="admin@fyp.local",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.flush()

    teacher = db.query(User).filter(User.email == "teacher@fyp.local").first()
    if teacher is None:
        teacher = User(
            name="Teacher User",
            email="teacher@fyp.local",
            hashed_password=hash_password("teacher123"),
            role=UserRole.TEACHER,
        )
        db.add(teacher)
        db.flush()

    if db.query(Course).count() == 0:
        db.add_all(
            [
                Course(course_name="Classroom A", instructor_id=teacher.id),
                Course(course_name="Classroom B", instructor_id=teacher.id),
            ]
        )

    db.commit()
