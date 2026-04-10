from __future__ import annotations

from sqlalchemy.orm import Session

from .models import AlertConfig, AlertEvent, ClassSession, Course, PerformanceMetric, SessionLog, User, UserRole
from .security import hash_password


TEACHER_NAMES = [
    "Abdur Rehman",
    "Ahsan Raza",
    "Aima Arif",
    "Amna Nadeem",
    "Anila Amjad",
    "Awais Salman Qazi",
    "Ayza Batool",
    "Mumtaz Ahmad",
    "Fatima Aslam",
    "Hafsa Tahir",
    "Hammad Shoukat",
    "Hassan Sultan",
    "Khola Farooq",
    "Dr. Maria Tariq",
    "Muhammad Arslan Raza",
    "Prof. Dr. Muhammad Atif",
    "Mugees Asif",
    "Muhammad Hams",
    "Muhammad Omer Saeed",
    "Rabia Khan",
    "Sahar Moin",
    "Dr. Abdul Sattar",
    "Shahid Raza",
    "Suhaib Ahmad",
    "Umair Bin Ahmad",
    "Waheed-ul-Hassan",
    "Muhammad Zubair",
    "Aqsa Sarfaraz Khan",
    "Farhan Sarwar",
]


ACADEMIC_COURSES = [
    # Semester 1 (Fa-2022)
    {"course_name": "Applied Physics", "course_code": "PHYS105", "semester": 1, "section": 5},
    {"course_name": "Calculus and Analytical Geometry", "course_code": "MATH114", "semester": 1, "section": 5},
    {"course_name": "English Composition and Comprehension", "course_code": "ENG115", "semester": 1, "section": 5},
    {"course_name": "Introduction to Information and Communication Technology", "course_code": "CSC312", "semester": 1, "section": 5},
    {"course_name": "Programming Fundamentals", "course_code": "CSC313", "semester": 1, "section": 5},
    # Semester 2 (Sp-2023)
    {"course_name": "Arabic", "course_code": "ARA101", "semester": 2, "section": 5},
    {"course_name": "Communication and Presentation Skills", "course_code": "ENG111", "semester": 2, "section": 5},
    {"course_name": "Digital Logic Design", "course_code": "CSC332", "semester": 2, "section": 5},
    {"course_name": "Object Oriented Programming", "course_code": "CSC321", "semester": 2, "section": 5},
    {"course_name": "Probability and Statistics", "course_code": "STAT114", "semester": 2, "section": 5},
    # Semester 3 (Fa-2023)
    {"course_name": "Computer Organization and Assembly Language", "course_code": "CSC346", "semester": 3, "section": 5},
    {"course_name": "Data Structure and Algorithms", "course_code": "CSC331", "semester": 3, "section": 5},
    {"course_name": "Differential Equations", "course_code": "MATH107", "semester": 3, "section": 5},
    {"course_name": "Human Resource Management", "course_code": "BMT104", "semester": 3, "section": 5},
    {"course_name": "Professional Practices", "course_code": "CSC372", "semester": 3, "section": 5},
    # Semester 4 (Sp-2024)
    {"course_name": "Database Systems", "course_code": "CSC352", "semester": 4, "section": 5},
    {"course_name": "Design and Analysis of Algorithms", "course_code": "CSC354", "semester": 4, "section": 5},
    {"course_name": "Discrete Structures", "course_code": "MATH112", "semester": 4, "section": 5},
    {"course_name": "Linear Algebra", "course_code": "MATH109", "semester": 4, "section": 5},
    {"course_name": "Theory of Automata", "course_code": "CSC353", "semester": 4, "section": 5},
    # Semester 5 (Fa-2024)
    {"course_name": "Compiler Construction", "course_code": "CSC373", "semester": 5, "section": 5},
    {"course_name": "Multivariate Calculus", "course_code": "MATH115", "semester": 5, "section": 5},
    {"course_name": "Operating Systems", "course_code": "CSC351", "semester": 5, "section": 5},
    {"course_name": "Software Engineering", "course_code": "CSC361", "semester": 5, "section": 5},
    {"course_name": "Technical and Business Writing", "course_code": "ENG116", "semester": 5, "section": 5},
    # Semester 6 (Sp-2025)
    {"course_name": "Artificial Intelligence", "course_code": "CSC363", "semester": 6, "section": 5},
    {"course_name": "Computer Networks", "course_code": "CSC343", "semester": 6, "section": 5},
    {"course_name": "Digital Image Processing", "course_code": "CSC392", "semester": 6, "section": 2},
    {"course_name": "Game Development", "course_code": "CSC3919", "semester": 6, "section": 2},
    {"course_name": "Numerical Computing", "course_code": "CSC381", "semester": 6, "section": 5},
    # Semester 7 (Fa-2025)
    {"course_name": "Cloud Computing", "course_code": "CSC382", "semester": 7, "section": 3},
    {"course_name": "Internet of Things", "course_code": "CSC383", "semester": 7, "section": 3},
    {"course_name": "Pakistan Studies", "course_code": "PAK101", "semester": 7, "section": 5},
    {"course_name": "Parallel and Distributed Computing", "course_code": "CSC320", "semester": 7, "section": 5},
    {"course_name": "Principles of Accounting", "course_code": "CMC101", "semester": 7, "section": 5},
    {"course_name": "Social Work Practice", "course_code": "CSC344", "semester": 7, "section": 5},
    # Semester 8 (additional)
    {"course_name": "Final Year Project I", "course_code": "CSC401", "semester": 8, "section": 1},
    {"course_name": "Final Year Project II", "course_code": "CSC402", "semester": 8, "section": 1},
    {"course_name": "Information Security", "course_code": "CSC451", "semester": 8, "section": 2},
    {"course_name": "Machine Learning", "course_code": "CSC452", "semester": 8, "section": 3},
    {"course_name": "Mobile Application Development", "course_code": "CSC453", "semester": 8, "section": 4},
    {"course_name": "Data Mining", "course_code": "CSC454", "semester": 8, "section": 5},
]


def _email_for_name(name: str, idx: int) -> str:
    cleaned = name.lower().replace("dr.", "").replace("prof.", "").replace("-", " ").replace(".", " ")
    cleaned = " ".join(cleaned.split())
    slug = cleaned.replace(" ", ".")
    return f"{slug}.{idx}@fyp.com"


def reset_academic_data(db: Session) -> None:
    db.query(AlertEvent).delete(synchronize_session=False)
    db.query(PerformanceMetric).delete(synchronize_session=False)
    db.query(SessionLog).delete(synchronize_session=False)
    db.query(ClassSession).delete(synchronize_session=False)
    db.query(AlertConfig).delete(synchronize_session=False)
    db.query(Course).delete(synchronize_session=False)
    db.query(User).filter(User.role == UserRole.TEACHER).delete(synchronize_session=False)
    db.commit()


def _seed_teachers(db: Session) -> list[User]:
    teachers: list[User] = []

    compatibility_teacher = User(
        name="Teacher One",
        email="teacher@fyp.com",
        hashed_password=hash_password("teacher123"),
        role=UserRole.TEACHER,
    )
    db.add(compatibility_teacher)
    teachers.append(compatibility_teacher)

    for idx, name in enumerate(TEACHER_NAMES, start=1):
        teacher = User(
            name=name,
            email=_email_for_name(name, idx),
            hashed_password=hash_password("teacher123"),
            role=UserRole.TEACHER,
        )
        db.add(teacher)
        teachers.append(teacher)

    db.flush()
    return teachers


def _seed_courses(db: Session, teachers: list[User]) -> None:
    for idx, row in enumerate(ACADEMIC_COURSES):
        assigned_teacher_id = teachers[idx % len(teachers)].id if idx % 4 != 3 else None
        db.add(
            Course(
                course_name=row["course_name"],
                course_code=row["course_code"],
                semester=row["semester"],
                section=row["section"],
                instructor_id=assigned_teacher_id,
            )
        )


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
    reset_academic_data(db)
    teachers = _seed_teachers(db)
    _seed_courses(db, teachers)
    db.commit()
