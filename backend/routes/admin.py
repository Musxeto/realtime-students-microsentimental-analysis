from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin_user
from ..models import AISettings, ClassSession, Course, User, UserRole
from ..schemas import AISettingsOut, AISettingsRequest, AdminSummaryResponse, CourseOut, CreateTeacherRequest, CreateTeacherResponse, ResetPasswordRequest, TeacherAnalyticsResponse, TeacherCourseAnalytics, TeacherCourseDetailAnalytics, TeacherListItem, TeacherListResponse, TeacherProjectPageResponse, TeacherSessionAnalytics, UpdateTeacherRequest, UserOut
from ..security import hash_password
from ..services.ai_settings import DEFAULT_AI_UPDATE_INTERVAL_SECONDS, get_ai_settings as get_ai_settings_record, upsert_ai_settings


router = APIRouter(prefix="/admin", tags=["admin"])


def _default_code_from_name(name: str) -> str:
    return name.strip().upper().replace(" ", "-")[:32]


def _build_admin_summary(db: Session) -> AdminSummaryResponse:
    total_teachers = int(db.query(func.count(User.id)).filter(User.role == UserRole.TEACHER).scalar() or 0)
    active_teachers = int(
        db.query(func.count(User.id)).filter(User.role == UserRole.TEACHER, User.is_active.is_(True)).scalar() or 0
    )

    total_courses = int(db.query(func.count(Course.id)).scalar() or 0)
    assigned_courses = int(db.query(func.count(Course.id)).filter(Course.instructor_id.isnot(None)).scalar() or 0)

    total_sessions = int(db.query(func.count(ClassSession.id)).scalar() or 0)
    completed_sessions = int(
        db.query(func.count(ClassSession.id)).filter(ClassSession.final_avg_score.isnot(None)).scalar() or 0
    )

    return AdminSummaryResponse(
        total_teachers=total_teachers,
        active_teachers=active_teachers,
        inactive_teachers=total_teachers - active_teachers,
        total_courses=total_courses,
        assigned_courses=assigned_courses,
        unassigned_courses=total_courses - assigned_courses,
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
    )


@router.get("/summary", response_model=AdminSummaryResponse)
def get_admin_summary(admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    return _build_admin_summary(db)


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

    teacher_ids = [teacher.id for teacher in teachers]
    course_counts: dict[int, int] = {}
    session_counts: dict[int, int] = {}

    if teacher_ids:
        course_count_rows = (
            db.query(Course.instructor_id, func.count(Course.id))
            .filter(Course.instructor_id.in_(teacher_ids))
            .group_by(Course.instructor_id)
            .all()
        )
        course_counts = {int(instructor_id): int(count) for instructor_id, count in course_count_rows if instructor_id is not None}

        session_count_rows = (
            db.query(Course.instructor_id, func.count(ClassSession.id))
            .join(ClassSession, ClassSession.course_id == Course.id)
            .filter(Course.instructor_id.in_(teacher_ids))
            .group_by(Course.instructor_id)
            .all()
        )
        session_counts = {int(instructor_id): int(count) for instructor_id, count in session_count_rows if instructor_id is not None}

    rows: list[TeacherListItem] = []
    for teacher in teachers:
        rows.append(
            TeacherListItem(
                id=teacher.id,
                name=teacher.name,
                email=teacher.email,
                role=teacher.role.value,
                is_active=teacher.is_active,
                course_count=course_counts.get(teacher.id, 0),
                session_count=session_counts.get(teacher.id, 0),
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

    course_stats_rows = (
        db.query(
            Course.id.label("course_id"),
            Course.course_name.label("course_name"),
            func.count(ClassSession.id).label("sessions_count"),
            func.avg(ClassSession.final_avg_score).label("avg_final_score"),
        )
        .outerjoin(ClassSession, ClassSession.course_id == Course.id)
        .filter(Course.instructor_id == teacher.id)
        .group_by(Course.id, Course.course_name)
        .order_by(Course.course_name.asc())
        .all()
    )

    total_sessions = int(sum(int(row.sessions_count or 0) for row in course_stats_rows))
    course_analytics = [
        TeacherCourseAnalytics(
            course_id=int(row.course_id),
            course_name=str(row.course_name),
            sessions_count=int(row.sessions_count or 0),
            avg_final_score=float(row.avg_final_score) if row.avg_final_score is not None else None,
        )
        for row in course_stats_rows
    ]

    overall_avg_query = (
        db.query(func.avg(ClassSession.final_avg_score))
        .join(Course, Course.id == ClassSession.course_id)
        .filter(Course.instructor_id == teacher.id, ClassSession.final_avg_score.isnot(None))
        .scalar()
    )
    overall_avg = float(overall_avg_query) if overall_avg_query is not None else None

    return TeacherAnalyticsResponse(
        teacher_id=teacher.id,
        teacher_name=teacher.name,
        total_courses=len(course_stats_rows),
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

    course_detail_rows = (
        db.query(
            Course.id.label("course_id"),
            Course.course_name.label("course_name"),
            Course.course_code.label("course_code"),
            Course.semester.label("semester"),
            Course.section.label("section"),
            func.count(ClassSession.id).label("sessions_count"),
            func.count(ClassSession.final_avg_score).label("completed_sessions_count"),
            func.avg(ClassSession.final_avg_score).label("avg_final_score"),
            func.max(ClassSession.final_avg_score).label("peak_final_score"),
            func.min(ClassSession.final_avg_score).label("lowest_final_score"),
        )
        .outerjoin(ClassSession, ClassSession.course_id == Course.id)
        .filter(Course.instructor_id == teacher.id)
        .group_by(Course.id, Course.course_name, Course.course_code, Course.semester, Course.section)
        .order_by(Course.semester.asc(), Course.course_name.asc())
        .all()
    )

    course_details: list[TeacherCourseDetailAnalytics] = [
        TeacherCourseDetailAnalytics(
            course_id=int(row.course_id),
            course_name=str(row.course_name),
            course_code=str(row.course_code),
            semester=int(row.semester),
            section=int(row.section),
            sessions_count=int(row.sessions_count or 0),
            completed_sessions_count=int(row.completed_sessions_count or 0),
            avg_final_score=float(row.avg_final_score) if row.avg_final_score is not None else None,
            peak_final_score=float(row.peak_final_score) if row.peak_final_score is not None else None,
            lowest_final_score=float(row.lowest_final_score) if row.lowest_final_score is not None else None,
        )
        for row in course_detail_rows
    ]

    session_query_rows = (
        db.query(ClassSession, Course)
        .join(Course, Course.id == ClassSession.course_id)
        .filter(Course.instructor_id == teacher.id)
        .order_by(ClassSession.start_time.desc())
        .all()
    )
    session_rows: list[TeacherSessionAnalytics] = [
        TeacherSessionAnalytics(
            session_id=session.id,
            course_id=course.id,
            course_name=course.course_name,
            start_time=session.start_time,
            end_time=session.end_time,
            status=session.status.value,
            final_avg_score=float(session.final_avg_score) if session.final_avg_score is not None else None,
        )
        for session, course in session_query_rows
    ]

    completed_sessions_count_query = (
        db.query(func.count(ClassSession.id))
        .join(Course, Course.id == ClassSession.course_id)
        .filter(Course.instructor_id == teacher.id, ClassSession.final_avg_score.isnot(None))
        .scalar()
    )
    completed_sessions_count = int(completed_sessions_count_query or 0)

    overall_avg_query = (
        db.query(func.avg(ClassSession.final_avg_score))
        .join(Course, Course.id == ClassSession.course_id)
        .filter(Course.instructor_id == teacher.id, ClassSession.final_avg_score.isnot(None))
        .scalar()
    )
    overall_avg = float(overall_avg_query) if overall_avg_query is not None else None

    return TeacherProjectPageResponse(
        teacher_id=teacher.id,
        teacher_name=teacher.name,
        teacher_email=teacher.email,
        is_active=teacher.is_active,
        total_courses=len(course_detail_rows),
        total_sessions=len(session_rows),
        completed_sessions_count=completed_sessions_count,
        overall_avg_final_score=overall_avg,
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


@router.get("/settings/ai", response_model=AISettingsOut)
def get_ai_settings(admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    settings = get_ai_settings_record(db)
    if settings is None:
        return AISettingsOut(update_interval_seconds=DEFAULT_AI_UPDATE_INTERVAL_SECONDS)
    return AISettingsOut(update_interval_seconds=max(DEFAULT_AI_UPDATE_INTERVAL_SECONDS, int(settings.update_interval_seconds)))


@router.put("/settings/ai", response_model=AISettingsOut)
def update_ai_settings(payload: AISettingsRequest, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    settings = upsert_ai_settings(db, update_interval_seconds=payload.update_interval_seconds)
    return AISettingsOut(update_interval_seconds=max(DEFAULT_AI_UPDATE_INTERVAL_SECONDS, int(settings.update_interval_seconds)))


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
