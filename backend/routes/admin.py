from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin_user
from ..models import ClassSession, Course, User, UserRole
from ..schemas import CourseOut, CreateTeacherRequest, CreateTeacherResponse, TeacherAnalyticsResponse, TeacherCourseAnalytics, TeacherListItem, UpdateTeacherRequest, UserOut
from ..security import hash_password


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/teachers", response_model=list[TeacherListItem])
def list_teachers(admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    teachers = db.query(User).filter(User.role == UserRole.TEACHER).order_by(User.name.asc()).all()
    rows: list[TeacherListItem] = []
    for teacher in teachers:
        course_ids = [course.id for course in db.query(Course).filter(Course.instructor_id == teacher.id).all()]
        session_count = 0
        if course_ids:
            session_count = db.query(ClassSession).filter(ClassSession.course_id.in_(course_ids)).count()

        rows.append(
            TeacherListItem(
                id=teacher.id,
                name=teacher.name,
                email=teacher.email,
                role=teacher.role.value,
                is_active=teacher.is_active,
                course_count=len(course_ids),
                session_count=session_count,
            )
        )
    return rows


@router.post("/teachers", response_model=CreateTeacherResponse)
def create_teacher(payload: CreateTeacherRequest, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    teacher = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.TEACHER,
    )
    db.add(teacher)
    db.flush()

    created_courses = []
    for raw_name in payload.course_names:
        cname = raw_name.strip()
        if not cname:
            continue
        course = Course(course_name=cname, instructor_id=teacher.id)
        db.add(course)
        db.flush()
        created_courses.append(course)

    db.commit()
    db.refresh(teacher)

    return CreateTeacherResponse(
        teacher=UserOut.model_validate(teacher),
        courses=[
            CourseOut(
                id=course.id,
                course_name=course.course_name,
                instructor_id=course.instructor_id,
                available_videos=[],
            )
            for course in created_courses
        ],
    )


@router.get("/teachers/{teacher_id}/analytics", response_model=TeacherAnalyticsResponse)
def get_teacher_analytics(teacher_id: int, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    teacher = db.query(User).filter(User.id == teacher_id, User.role == UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    courses = db.query(Course).filter(Course.instructor_id == teacher.id).all()
    course_analytics: list[TeacherCourseAnalytics] = []
    total_sessions = 0
    overall_scores: list[float] = []

    for course in courses:
        sessions = db.query(ClassSession).filter(ClassSession.course_id == course.id).all()
        scores = [float(s.final_avg_score) for s in sessions if s.final_avg_score is not None]
        total_sessions += len(sessions)
        overall_scores.extend(scores)
        avg_score = float(sum(scores) / len(scores)) if scores else None
        course_analytics.append(
            TeacherCourseAnalytics(
                course_id=course.id,
                course_name=course.course_name,
                sessions_count=len(sessions),
                avg_final_score=avg_score,
            )
        )

    overall_avg = float(sum(overall_scores) / len(overall_scores)) if overall_scores else None

    return TeacherAnalyticsResponse(
        teacher_id=teacher.id,
        teacher_name=teacher.name,
        total_courses=len(courses),
        total_sessions=total_sessions,
        overall_avg_final_score=overall_avg,
        courses=course_analytics,
    )


@router.patch("/teachers/{teacher_id}", response_model=UserOut)
def update_teacher(teacher_id: int, payload: UpdateTeacherRequest, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    teacher = db.query(User).filter(User.id == teacher_id, User.role == UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    if payload.email and payload.email != teacher.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
        teacher.email = payload.email
    if payload.name:
        teacher.name = payload.name
    if payload.is_active is not None:
        teacher.is_active = payload.is_active

    db.commit()
    db.refresh(teacher)
    return UserOut.model_validate(teacher)
