from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
import random
import re
import sys

from sqlalchemy import and_
from sqlalchemy.orm import Session

try:
    from backend.database import SessionLocal
    from backend.models import AlertEvent, AuditLog, ClassSession, Course, PerformanceMetric, SessionLog, SessionStatus, User, UserRole
    from backend.security import hash_password
except ImportError:
    project_root = Path(__file__).resolve().parents[2]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from backend.database import SessionLocal
    from backend.models import AlertEvent, AuditLog, ClassSession, Course, PerformanceMetric, SessionLog, SessionStatus, User, UserRole
    from backend.security import hash_password


SEED_TAG = "LGU_SP26_TIMETABLE_V2"
DEFAULT_TEACHER_PASSWORD = "teacher123"
TARGET_TEACHERS = 30
TARGET_COURSES = 50
TARGET_SESSIONS = 120

SECTION_MAP = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}


@dataclass(frozen=True)
class CourseOffering:
    course_name: str
    course_code: str
    semester: int
    section_letter: str
    teacher_name: str


OFFERINGS: list[CourseOffering] = [
    CourseOffering("Deep Learning", "CSC801", 8, "E", "Dr. Maria Tariq"),
    CourseOffering("Computer Vision", "CSC802", 8, "E", "Ahsan Raza"),
    CourseOffering("Psychology", "HUM401", 8, "E", "Mahnoor Sharafat"),
    CourseOffering("Information Security", "CSC803", 8, "E", "Awais Salman Qazi"),
    CourseOffering("Islamic Studies", "HUM201", 8, "E", "Fatima Khalil"),
    CourseOffering("Differential Equations", "MTH202", 8, "E", "Dr. Faisal"),
    CourseOffering("Deep Learning", "CSC801", 8, "A", "Abdur Rehman"),
    CourseOffering("Computer Vision", "CSC802", 8, "A", "Mugees Asif"),
    CourseOffering("Psychology", "HUM401", 8, "A", "Aysha Zumer"),
    CourseOffering("Information Security", "CSC803", 8, "A", "Khadija Cheema"),
    CourseOffering("Islamic Studies", "HUM201", 8, "A", "Muhammad Waris Ali"),
    CourseOffering("Differential Equations", "MTH202", 8, "A", "Dr. Faisal"),
    CourseOffering("Deep Learning", "CSC801", 8, "B", "Abdur Rehman"),
    CourseOffering("Computer Vision", "CSC802", 8, "B", "Mugees Asif"),
    CourseOffering("Psychology", "HUM401", 8, "B", "Aysha Zumer"),
    CourseOffering("Information Security", "CSC803", 8, "B", "Khadija Cheema"),
    CourseOffering("Islamic Studies", "HUM201", 8, "B", "Muhammad Waris Ali"),
    CourseOffering("Differential Equations", "MTH202", 8, "B", "Dr. Faisal"),
    CourseOffering("Deep Learning", "CSC801", 8, "C", "Dr. Maria Tariq"),
    CourseOffering("Computer Vision", "CSC802", 8, "C", "Mugees Asif"),
    CourseOffering("Psychology", "HUM401", 8, "C", "Amna Mazhar"),
    CourseOffering("Information Security", "CSC803", 8, "C", "Ayza Batool"),
    CourseOffering("Islamic Studies", "HUM201", 8, "C", "Ihtisham Ahmed Farooqi"),
    CourseOffering("Differential Equations", "MTH202", 8, "C", "Dr. Faisal"),
    CourseOffering("Deep Learning", "CSC801", 8, "D", "Dr. Maria Tariq"),
    CourseOffering("Computer Vision", "CSC802", 8, "D", "Mugees Asif"),
    CourseOffering("Psychology", "HUM401", 8, "D", "Amna Mazhar"),
    CourseOffering("Information Security", "CSC803", 8, "D", "Awais Salman Qazi"),
    CourseOffering("Islamic Studies", "HUM201", 8, "D", "Ihtisham Ahmed Farooqi"),
    CourseOffering("Differential Equations", "MTH202", 8, "D", "Dr. Faisal"),
    CourseOffering("Machine Learning", "CSC701", 7, "A", "Dr. Muhammad Kashif"),
    CourseOffering("Game Design and Development", "CSC702", 7, "A", "Muhammad Zubair"),
    CourseOffering("Digital Image Processing", "CSC703", 7, "A", "Umair Bin Ahmad"),
    CourseOffering("Parallel and Distributed Computing", "CSC704", 7, "A", "Khola Farooq"),
    CourseOffering("Principles of Accounting", "MGT301", 7, "A", "Irtiqua Ameer"),
    CourseOffering("Pakistan Studies", "HUM301", 7, "A", "Tahira Parveen"),
    CourseOffering("Social Work Practice", "HUM302", 7, "A", "Hafiza Saadia Sharif"),
    CourseOffering("Machine Learning", "CSC701", 7, "B", "Ahsan Raza"),
    CourseOffering("Game Design and Development", "CSC702", 7, "B", "Muhammad Zubair"),
    CourseOffering("Digital Image Processing", "CSC703", 7, "B", "Umair Bin Ahmad"),
    CourseOffering("Parallel and Distributed Computing", "CSC704", 7, "B", "Khola Farooq"),
    CourseOffering("Principles of Accounting", "MGT301", 7, "B", "Huma"),
    CourseOffering("Pakistan Studies", "HUM301", 7, "B", "Tahira Parveen"),
    CourseOffering("Social Work Practice", "HUM302", 7, "B", "Muhammad Talha"),
    CourseOffering("Machine Learning", "CSC701", 7, "C", "Abdur Rehman"),
    CourseOffering("Game Design and Development", "CSC702", 7, "C", "Muhammad Zubair"),
    CourseOffering("Digital Image Processing", "CSC703", 7, "C", "Umair Bin Ahmad"),
    CourseOffering("Parallel and Distributed Computing", "CSC704", 7, "C", "Khola Farooq"),
    CourseOffering("Principles of Accounting", "MGT301", 7, "C", "Huma"),
    CourseOffering("Pakistan Studies", "HUM301", 7, "C", "Tahira Parveen"),
    CourseOffering("Social Work Practice", "HUM302", 7, "C", "Zobaria"),
    CourseOffering("Cloud Computing", "CSC601", 6, "A", "Masim Ali"),
    CourseOffering("Computer Networks", "CSC602", 6, "A", "Mumtaz Ahmad"),
    CourseOffering("Machine Learning", "CSC603", 6, "A", "Sahar Moin"),
    CourseOffering("Software Testing and Quality Assurance", "CSC604", 6, "A", "Ammara Kanwal"),
    CourseOffering("Parallel and Distributed Computing", "CSC605", 6, "A", "Naeem Ur Rehman"),
    CourseOffering("Compiler Construction", "CSC606", 6, "A", "Saba Mohsin"),
    CourseOffering("Computer Networks Lab", "CSC607L", 6, "A", "Mumtaz Ahmad"),
    CourseOffering("Cloud Computing Lab", "CSC608L", 6, "A", "Masim Ali"),
    CourseOffering("Machine Learning Lab", "CSC609L", 6, "A", "Sahar Moin"),
    CourseOffering("Compiler Construction Lab", "CSC610L", 6, "A", "Saba Mohsin"),
    CourseOffering("Parallel and Distributed Computing Lab", "CSC611L", 6, "A", "Faria Khan"),
]

EXTRA_TEACHERS = [
    "Abid Ali",
    "Adeeb ur Rehman",
    "Ahsan Ayaz",
    "Aima Arif",
    "Aisha Riaz",
    "Ameera Arif",
    "Amir Sohail",
    "Ammara Kanwal",
    "Anila Amjad",
    "Awais Nasir",
    "Ayesha Razzaq",
    "Batool Abbas",
]


def normalize_name(raw_name: str) -> str:
    name = raw_name.strip()
    name = re.sub(r"\{.*?\}", "", name)
    name = name.replace(".", " ")
    name = re.sub(r"\s+", " ", name).strip()
    lowered = name.lower()
    for title in ("dr", "mr", "mrs", "ms", "prof"):
        if lowered.startswith(title + " "):
            name = name[len(title) + 1 :].strip()
            lowered = name.lower()
    return name


def email_from_name(name: str) -> str:
    cleaned = normalize_name(name)
    parts = [p for p in re.split(r"[^a-zA-Z]+", cleaned) if p]
    if not parts:
        return "teacher@lgu.edu.pk"
    if len(parts) == 1:
        local = f"{parts[0].lower()}.faculty"
    else:
        local = f"{parts[0].lower()}.{parts[-1].lower()}"
    return f"{local}@lgu.edu.pk"


def upsert_teacher(db: Session, full_name: str) -> User:
    display_name = normalize_name(full_name)
    base_email = email_from_name(display_name)

    preferred_email = base_email
    suffix = 1
    while True:
        existing_email_owner = db.query(User).filter(User.email == preferred_email).first()
        if existing_email_owner is None or existing_email_owner.name.lower() == display_name.lower():
            break
        suffix += 1
        preferred_email = f"{base_email.split('@', 1)[0]}{suffix}@lgu.edu.pk"

    teacher = db.query(User).filter(User.email == preferred_email).first()
    if teacher is None:
        teacher = db.query(User).filter(User.name == display_name, User.role == UserRole.TEACHER).first()
        if teacher is None:
            teacher = User(
                name=display_name,
                email=preferred_email,
                hashed_password=hash_password(DEFAULT_TEACHER_PASSWORD),
                role=UserRole.TEACHER,
                is_active=True,
            )
            db.add(teacher)
            db.flush()
        else:
            teacher.email = preferred_email
            teacher.is_active = True
    else:
        teacher.name = display_name
        teacher.is_active = True

    return teacher


def upsert_course(db: Session, offering: CourseOffering, teacher_id: int) -> Course:
    section = SECTION_MAP[offering.section_letter]
    course = (
        db.query(Course)
        .filter(
            and_(
                Course.course_code == offering.course_code,
                Course.semester == offering.semester,
                Course.section == section,
            )
        )
        .first()
    )
    if course is None:
        course = Course(
            course_name=offering.course_name,
            course_code=offering.course_code,
            semester=offering.semester,
            section=section,
            instructor_id=teacher_id,
        )
        db.add(course)
        db.flush()
    else:
        course.course_name = offering.course_name
        course.instructor_id = teacher_id

    return course


def purge_previous_seed_data(db: Session) -> None:
    stale_sessions = db.query(ClassSession).filter(ClassSession.video_path.like("seed://lgu_sp26/%")).all()
    for stale in stale_sessions:
        db.delete(stale)

    stale_audits = db.query(AuditLog).filter(AuditLog.action.like("SEED_%")).all()
    for row in stale_audits:
        db.delete(row)

    db.flush()


def create_session_bundle(
    db: Session,
    *,
    course: Course,
    start_time: datetime,
    rng: random.Random,
    seq_no: int,
    teacher_id: int,
) -> None:
    duration_minutes = rng.choice([60, 75, 90])
    end_time = start_time + timedelta(minutes=duration_minutes)
    final_score = round(rng.uniform(58.0, 92.0), 2)

    session = ClassSession(
        course_id=course.id,
        start_time=start_time,
        end_time=end_time,
        final_avg_score=final_score,
        status=SessionStatus.COMPLETED,
        video_path=f"seed://lgu_sp26/{course.course_code}/{seq_no}",
        session_metadata={
            "seed_tag": SEED_TAG,
            "semester": course.semester,
            "section": course.section,
            "source": "lgu_timetable",
        },
    )
    db.add(session)
    db.flush()

    log_points = rng.randint(10, 16)
    for point in range(log_points):
        progress = point / max(log_points - 1, 1)
        score = max(0.0, min(100.0, final_score + rng.uniform(-10.0, 10.0) * (1.0 - progress * 0.3)))
        log_time = start_time + timedelta(minutes=point * max(duration_minutes // max(log_points - 1, 1), 1))
        engaged = int(round(score / 5.0))
        distracted = max(0, 25 - engaged)
        db.add(
            SessionLog(
                session_id=session.id,
                timestamp=log_time,
                engagement_score=round(score, 2),
                engaged_count=engaged,
                distracted_count=distracted,
                payload={
                    "seed_tag": SEED_TAG,
                    "frame_count": rng.randint(20, 45),
                    "source": "synthetic_from_timetable",
                },
            )
        )

    metrics = {
        "latency_ms": round(rng.uniform(45.0, 140.0), 2),
        "actual_fps": round(rng.uniform(16.0, 29.5), 2),
        "target_fps": 30.0,
        "engagement_avg": final_score,
    }
    metric_time = end_time - timedelta(minutes=5)
    for metric_type, value in metrics.items():
        db.add(
            PerformanceMetric(
                session_id=session.id,
                metric_type=metric_type,
                value=float(value),
                timestamp=metric_time,
            )
        )

    if final_score < 66.0:
        db.add(
            AlertEvent(
                session_id=session.id,
                triggered_at=start_time + timedelta(minutes=20),
                engagement_at_trigger=round(final_score - rng.uniform(6.0, 12.0), 2),
                reason="Low engagement sustained during seeded session",
                resolved_at=end_time,
            )
        )

    db.add(
        AuditLog(
            user_id=teacher_id,
            course_id=course.id,
            action="SEED_SESSION_CREATED",
            details={
                "seed_tag": SEED_TAG,
                "session_id": session.id,
                "final_avg_score": final_score,
                "duration_minutes": duration_minutes,
            },
        )
    )


def main() -> None:
    rng = random.Random(26042026)

    with SessionLocal() as db:
        purge_previous_seed_data(db)

        selected_offerings = OFFERINGS[:TARGET_COURSES]

        teacher_names_from_courses = [offering.teacher_name for offering in selected_offerings]
        unique_teacher_names: list[str] = []
        seen_names: set[str] = set()
        for raw_name in teacher_names_from_courses + EXTRA_TEACHERS:
            normalized = normalize_name(raw_name)
            key = normalized.lower()
            if key in seen_names:
                continue
            seen_names.add(key)
            unique_teacher_names.append(normalized)
            if len(unique_teacher_names) >= TARGET_TEACHERS:
                break

        teachers_by_name: dict[str, User] = {}
        created_teacher_count = 0
        for index, teacher_name in enumerate(unique_teacher_names, start=1):
            teacher = upsert_teacher(db, teacher_name)
            teachers_by_name[teacher.name.lower()] = teacher
            created_teacher_count += 1
            db.add(
                AuditLog(
                    user_id=teacher.id,
                    action="SEED_TEACHER_UPSERTED",
                    details={"seed_tag": SEED_TAG, "email": teacher.email},
                )
            )

        course_rows: list[Course] = []
        for offering in selected_offerings:
            teacher = teachers_by_name[normalize_name(offering.teacher_name).lower()]
            course = upsert_course(db, offering, teacher.id)
            course_rows.append(course)
            db.add(
                AuditLog(
                    user_id=teacher.id,
                    course_id=course.id,
                    action="SEED_COURSE_UPSERTED",
                    details={
                        "seed_tag": SEED_TAG,
                        "course_code": offering.course_code,
                        "semester": offering.semester,
                        "section": offering.section_letter,
                    },
                )
            )

        db.flush()

        sessions_per_course = defaultdict(int)
        base_start = datetime(2026, 2, 3, 8, 0, 0)
        for idx in range(TARGET_SESSIONS):
            course = course_rows[idx % len(course_rows)]
            sessions_per_course[course.id] += 1
            day_offset = idx // 6
            slot_offset = idx % 6
            start_time = base_start + timedelta(days=day_offset, hours=slot_offset * 1.5)
            teacher_id = course.instructor_id or 0
            create_session_bundle(
                db,
                course=course,
                start_time=start_time,
                rng=rng,
                seq_no=sessions_per_course[course.id],
                teacher_id=teacher_id,
            )

        db.add(
            AuditLog(
                action="SEED_RUN_COMPLETED",
                details={
                    "seed_tag": SEED_TAG,
                    "teacher_count": created_teacher_count,
                    "course_count": len(course_rows),
                    "session_count": TARGET_SESSIONS,
                },
            )
        )

        db.commit()

    print(f"Seed completed: teachers={TARGET_TEACHERS}, courses={TARGET_COURSES}, sessions={TARGET_SESSIONS}")


if __name__ == "__main__":
    main()
