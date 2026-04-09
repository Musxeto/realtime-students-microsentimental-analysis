from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ai.inference_utils import discover_video_files

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Course, User, UserRole
from ..schemas import CourseOut


router = APIRouter(prefix="/courses", tags=["courses"])


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
