from __future__ import annotations

from sqlalchemy.orm import Session

from .models import Course, User, UserRole
from .security import hash_password


DEFAULT_TEACHERS = [
    {
        "name": "Teacher One",
        "email": "teacher@fyp.com",
        "password": "teacher123",
        "courses": ["Classroom A", "Classroom B"],
    },
    {
        "name": "Teacher Two",
        "email": "teacher2@fyp.com",
        "password": "teacher123",
        "courses": ["Classroom C"],
    },
    {
        "name": "Teacher Three",
        "email": "teacher3@fyp.com",
        "password": "teacher123",
        "courses": ["Classroom D"],
    },
]


def ensure_seed_data(db: Session) -> None:
    admin = db.query(User).filter(User.email == "admin@fyp.com").first()
    if admin is None:
        admin = User(
            name="Admin User",
            email="admin@fyp.com",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.flush()

    for teacher_data in DEFAULT_TEACHERS:
        teacher = db.query(User).filter(User.email == teacher_data["email"]).first()
        if teacher is None:
            teacher = User(
                name=teacher_data["name"],
                email=teacher_data["email"],
                hashed_password=hash_password(teacher_data["password"]),
                role=UserRole.TEACHER,
            )
            db.add(teacher)
            db.flush()

        existing_names = {
            row[0]
            for row in db.query(Course.course_name)
            .filter(Course.instructor_id == teacher.id)
            .all()
        }
        for course_name in teacher_data["courses"]:
            if course_name in existing_names:
                continue
            db.add(Course(course_name=course_name, instructor_id=teacher.id))

    db.commit()
