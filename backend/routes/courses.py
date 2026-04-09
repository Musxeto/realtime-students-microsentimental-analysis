from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ai.inference_utils import discover_video_files

from ..config import settings
from ..database import get_db
from ..deps import get_admin_user, get_current_user
from ..models import ClassSession, Course, User, UserRole
from ..schemas import CourseAnalyticsResponse, CourseOut, CreateCourseRequest, SessionScorePoint


router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("", response_model=CourseOut)
def create_course(payload: CreateCourseRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    instructor_id = payload.instructor_id
    if current_user.role == UserRole.TEACHER:
        if instructor_id is not None and instructor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only create their own courses")
        instructor_id = current_user.id
    elif instructor_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="instructor_id is required for admin")

    teacher = db.query(User).filter(User.id == instructor_id, User.role == UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")

    course = Course(course_name=payload.course_name.strip(), instructor_id=instructor_id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseOut(id=course.id, course_name=course.course_name, instructor_id=course.instructor_id, available_videos=[])


@router.get("", response_model=list[CourseOut])
def list_courses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Course)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Course.instructor_id == current_user.id)

    videos = [str(path.relative_to(settings.video_root)) if path.is_relative_to(settings.video_root) else str(path) for path in discover_video_files([settings.video_root, settings.ai_dir])]
    courses = []
    for course in query.all():
        courses.append(
            CourseOut(
                id=course.id,
                course_name=course.course_name,
                instructor_id=course.instructor_id,
                available_videos=videos,
            )
        )
    return courses


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


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, admin_user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    _ = admin_user
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    db.delete(course)
    db.commit()
