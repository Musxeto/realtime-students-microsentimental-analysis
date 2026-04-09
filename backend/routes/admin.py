from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin_user
from ..models import Course, User, UserRole
from ..schemas import CourseOut, CreateTeacherRequest, CreateTeacherResponse, UserOut
from ..security import hash_password


router = APIRouter(prefix="/admin", tags=["admin"])


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
