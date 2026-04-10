from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin_user
from ..models import ClassSession, Course, User, UserRole
from ..schemas import CourseOut, CreateTeacherRequest, CreateTeacherResponse, ResetPasswordRequest, TeacherAnalyticsResponse, TeacherCourseAnalytics, TeacherCourseDetailAnalytics, TeacherListItem, TeacherListResponse, TeacherProjectPageResponse, TeacherSessionAnalytics, UpdateTeacherRequest, UserOut
from ..security import hash_password


router = APIRouter(prefix="/admin", tags=["admin"])


def _default_code_from_name(name: str) -> str:
    return name.strip().upper().replace(" ", "-")[:32]


@router.get("/teachers", response_model=TeacherListResponse)
def list_teachers(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    _ = admin_user
    query = db.query(User).filter(User.role == UserRole.TEACHER)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(or_(User.name.ilike(search_term), User.email.ilike(search_term)))

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    teachers = query.order_by(User.name.asc()).offset(offset).limit(limit).all()

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
    return TeacherListResponse(items=rows, total=total, limit=limit, offset=offset)


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
        course = Course(
            course_name=cname,
            course_code=_default_code_from_name(cname),
            semester=1,
            section=1,
            instructor_id=teacher.id,
        )
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
                course_code=course.course_code,
                semester=course.semester,
                section=course.section,
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


@router.get("/teachers/{teacher_id}/project", response_model=TeacherProjectPageResponse)
def get_teacher_project_page(teacher_id: int, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    teacher = db.query(User).filter(User.id == teacher_id, User.role == UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    courses = db.query(Course).filter(Course.instructor_id == teacher.id).order_by(Course.semester.asc(), Course.course_name.asc()).all()

    course_details: list[TeacherCourseDetailAnalytics] = []
    session_rows: list[TeacherSessionAnalytics] = []
    overall_scores: list[float] = []

    for course in courses:
        sessions = (
            db.query(ClassSession)
            .filter(ClassSession.course_id == course.id)
            .order_by(ClassSession.start_time.desc())
            .all()
        )
        scores = [float(s.final_avg_score) for s in sessions if s.final_avg_score is not None]
        overall_scores.extend(scores)

        course_details.append(
            TeacherCourseDetailAnalytics(
                course_id=course.id,
                course_name=course.course_name,
                course_code=course.course_code,
                semester=course.semester,
                section=course.section,
                sessions_count=len(sessions),
                completed_sessions_count=len(scores),
                avg_final_score=float(sum(scores) / len(scores)) if scores else None,
                peak_final_score=max(scores) if scores else None,
                lowest_final_score=min(scores) if scores else None,
            )
        )

        for session in sessions:
            session_rows.append(
                TeacherSessionAnalytics(
                    session_id=session.id,
                    course_id=course.id,
                    course_name=course.course_name,
                    start_time=session.start_time,
                    end_time=session.end_time,
                    status=session.status.value,
                    final_avg_score=float(session.final_avg_score) if session.final_avg_score is not None else None,
                )
            )

    session_rows.sort(key=lambda row: row.start_time, reverse=True)
    completed_sessions_count = len([score for score in overall_scores])

    return TeacherProjectPageResponse(
        teacher_id=teacher.id,
        teacher_name=teacher.name,
        teacher_email=teacher.email,
        is_active=teacher.is_active,
        total_courses=len(courses),
        total_sessions=len(session_rows),
        completed_sessions_count=completed_sessions_count,
        overall_avg_final_score=float(sum(overall_scores) / len(overall_scores)) if overall_scores else None,
        courses=course_details,
        sessions=session_rows,
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


@router.delete("/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher(teacher_id: int, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    teacher = db.query(User).filter(User.id == teacher_id, User.role == UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    db.query(Course).filter(Course.instructor_id == teacher.id).update({Course.instructor_id: None})
    db.delete(teacher)
    db.commit()


@router.delete("/teachers", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_teachers(admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    teachers = db.query(User).filter(User.role == UserRole.TEACHER).all()
    teacher_ids = [teacher.id for teacher in teachers]

    if teacher_ids:
        db.query(Course).filter(Course.instructor_id.in_(teacher_ids)).update({Course.instructor_id: None}, synchronize_session=False)
        for teacher in teachers:
            db.delete(teacher)
        db.commit()


@router.delete("/courses", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_courses(admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    db.query(Course).delete(synchronize_session=False)
    db.commit()


@router.post("/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    _ = admin_user
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1
    db.commit()
    return {"message": "Password reset successful"}
