from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ai.inference_utils import discover_video_files

from ..config import settings
from ..database import get_db
from ..deps import get_admin_user, get_current_user
from ..models import AlertConfig, ClassSession, Course, User, UserRole, AuditLog
from ..schemas import AlertConfigOut, AlertConfigRequest, CourseAnalyticsResponse, CourseListResponse, CourseOut, CreateCourseRequest, UpdateCourseRequest, SessionScorePoint


router = APIRouter(prefix="/courses", tags=["courses"])

_VIDEO_CACHE_TTL_SECONDS = 30.0
_video_cache_payload: list[str] = []
_video_cache_expires_at = 0.0


def _normalize_course_code(raw: str | None, fallback_name: str) -> str:
    if raw and raw.strip():
        return raw.strip().upper().replace(" ", "")
    return fallback_name.strip().upper().replace(" ", "-")[:32]


def _get_available_videos_cached() -> list[str]:
    global _video_cache_expires_at, _video_cache_payload

    now = time.monotonic()
    if now < _video_cache_expires_at:
        return _video_cache_payload

    videos = [
        str(path.relative_to(settings.video_root)) if path.is_relative_to(settings.video_root) else str(path)
        for path in discover_video_files([settings.video_root, settings.ai_dir])
    ]
    _video_cache_payload = videos
    _video_cache_expires_at = now + _VIDEO_CACHE_TTL_SECONDS
    return _video_cache_payload


@router.post("", response_model=CourseOut)
def create_course(payload: CreateCourseRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    instructor_id = payload.instructor_id
    if current_user.role == UserRole.TEACHER:
        if instructor_id is not None and instructor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only create their own courses")
        instructor_id = current_user.id

    if instructor_id is not None:
        teacher = db.query(User).filter(User.id == instructor_id, User.role == UserRole.TEACHER).first()
        if teacher is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")

    course = Course(
        course_name=payload.course_name.strip(),
        course_code=_normalize_course_code(payload.course_code, payload.course_name),
        semester=payload.semester,
        section=payload.section,
        instructor_id=instructor_id,
    )
    db.add(course)
    db.flush() # Get the ID before commit

    audit = AuditLog(
        user_id=current_user.id,
        course_id=course.id,
        action="COURSE_CREATED",
        details={
            "course_name": course.course_name,
            "instructor_id": instructor_id,
            "instructor_name": teacher.name if instructor_id and 'teacher' in locals() else None
        }
    )
    db.add(audit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Course with same code, semester, and section already exists",
        )
    db.refresh(course)
    return CourseOut(
        id=course.id,
        course_name=course.course_name,
        course_code=course.course_code,
        semester=course.semester,
        section=course.section,
        instructor_id=course.instructor_id,
        available_videos=[],
    )


@router.get("", response_model=CourseListResponse)
def list_courses(
    search: str | None = Query(default=None),
    semester: int | None = Query(default=None),
    section: int | None = Query(default=None),
    instructor_id: int | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Course)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Course.instructor_id == current_user.id)
    else:
        # Admin can filter by instructor
        if instructor_id is not None:
            query = query.filter(Course.instructor_id == instructor_id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(or_(Course.course_name.ilike(search_term), Course.course_code.ilike(search_term)))

    if semester is not None:
        query = query.filter(Course.semester == semester)
    if section is not None:
        query = query.filter(Course.section == section)

    total = query.count()
    
    # Apply ordering for consistent results
    query = query.order_by(Course.semester.asc(), Course.course_name.asc())
    
    # Pagination is now optional. If limit is None, return all matching items.
    if limit is not None:
        rows = query.offset(offset).limit(limit).all()
    else:
        rows = query.all()

    courses = []
    for course in rows:
        courses.append(
            CourseOut(
                id=course.id,
                course_name=course.course_name,
                course_code=course.course_code,
                semester=course.semester,
                section=course.section,
                instructor_id=course.instructor_id,
                available_videos=[], # Scanning disk is too slow, frontend should provide pathways or we add a separate picker.
            )
        )
    return CourseListResponse(items=courses, total=total, limit=limit or total, offset=offset)


@router.get("/{course_id}/analytics", response_model=CourseAnalyticsResponse)
def get_course_analytics(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot view analytics for this course")

    sessions_query = db.query(ClassSession).filter(ClassSession.course_id == course_id)
    sessions = sessions_query.order_by(ClassSession.start_time.asc()).all()
    sessions_count = len(sessions)
    completed_scores = [float(s.final_avg_score) for s in sessions if s.final_avg_score is not None]

    if completed_scores:
        avg_final = float(sum(completed_scores) / len(completed_scores))
        peak_final = max(completed_scores)
        lowest_final = min(completed_scores)
    else:
        avg_final = None
        peak_final = None
        lowest_final = None

    trend = [
        SessionScorePoint(session_id=s.id, start_time=s.start_time, final_avg_score=float(s.final_avg_score))
        for s in sessions
        if s.final_avg_score is not None
    ]

    completed_count = (
        db.query(func.count(ClassSession.id))
        .filter(ClassSession.course_id == course_id, ClassSession.final_avg_score.isnot(None))
        .scalar()
        or 0
    )

    return CourseAnalyticsResponse(
        course_id=course.id,
        course_name=course.course_name,
        sessions_count=sessions_count,
        completed_sessions_count=int(completed_count),
        avg_final_score=avg_final,
        peak_final_score=peak_final,
        lowest_final_score=lowest_final,
        trend=trend,
    )


@router.get("/{course_id}/history", response_model=list[AuditLogOut])
def get_course_history(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot view history for this course")

    logs = db.query(AuditLog).filter(AuditLog.course_id == course_id).order_by(AuditLog.timestamp.desc()).all()
    return logs


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(course_id: int, payload: UpdateCourseRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own courses")
    
    if payload.course_name is not None:
        course.course_name = payload.course_name.strip()
    if payload.course_code is not None:
        course.course_code = _normalize_course_code(payload.course_code, course.course_name)
    if payload.semester is not None:
        course.semester = payload.semester
    if payload.section is not None:
        course.section = payload.section
    
    if current_user.role == UserRole.ADMIN:
        if "instructor_id" in payload.model_fields_set:
            if payload.instructor_id is None:
                course.instructor_id = None
            else:
                teacher = db.query(User).filter(User.id == payload.instructor_id, User.role == UserRole.TEACHER).first()
                if teacher is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
                
                old_id = course.instructor_id
                course.instructor_id = payload.instructor_id
                
                audit = AuditLog(
                    user_id=current_user.id,
                    course_id=course.id,
                    action="TEACHER_ASSIGNED",
                    details={
                        "old_instructor_id": old_id,
                        "new_instructor_id": payload.instructor_id,
                        "new_instructor_name": teacher.name
                    }
                )
                db.add(audit)
    elif payload.instructor_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can transfer course ownership")
    
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Course with same code, semester, and section already exists",
        )
    db.refresh(course)
    return CourseOut(
        id=course.id,
        course_name=course.course_name,
        course_code=course.course_code,
        semester=course.semester,
        section=course.section,
        instructor_id=course.instructor_id,
        available_videos=[],
    )


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    db.delete(course)
    db.commit()


@router.get("/{course_id}/alert-config", response_model=AlertConfigOut)
def get_alert_config(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot view this alert config")

    config = db.query(AlertConfig).filter(AlertConfig.course_id == course_id).first()
    if config is None:
        return AlertConfigOut(course_id=course_id, engagement_threshold=50.0, duration_seconds=180, enabled=True)

    return AlertConfigOut(
        course_id=course_id,
        engagement_threshold=float(config.engagement_threshold),
        duration_seconds=int(config.duration_seconds),
        enabled=bool(config.enabled),
    )


@router.put("/{course_id}/alert-config", response_model=AlertConfigOut)
def upsert_alert_config(course_id: int, payload: AlertConfigRequest, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    config = db.query(AlertConfig).filter(AlertConfig.course_id == course_id).first()
    if config is None:
        config = AlertConfig(
            course_id=course_id,
            engagement_threshold=payload.engagement_threshold,
            duration_seconds=payload.duration_seconds,
            enabled=payload.enabled,
        )
        db.add(config)
    else:
        config.engagement_threshold = payload.engagement_threshold
        config.duration_seconds = payload.duration_seconds
        config.enabled = payload.enabled

    db.commit()
    return AlertConfigOut(
        course_id=course_id,
        engagement_threshold=float(payload.engagement_threshold),
        duration_seconds=payload.duration_seconds,
        enabled=payload.enabled,
    )
