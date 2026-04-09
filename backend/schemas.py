from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional["UserOut"] = None


class LoginRequest(BaseModel):
    email: EmailStr = Field(validation_alias=AliasChoices("email", "username"))
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    model_config = ConfigDict(from_attributes=True)


class CreateTeacherRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=4)
    course_names: list[str] = Field(default_factory=list)


class CreateTeacherResponse(BaseModel):
    teacher: UserOut
    courses: list["CourseOut"] = Field(default_factory=list)


class CourseOut(BaseModel):
    id: int
    course_name: str
    instructor_id: int
    available_videos: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class StartSessionRequest(BaseModel):
    course_id: int
    video_path: str
    frame_step: int = 5


class StartSessionResponse(BaseModel):
    session_id: int
    course_id: int
    status: str
    start_time: datetime


class EndSessionResponse(BaseModel):
    session_id: int
    status: str
    final_avg_score: float | None


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict[str, Any] | None = None
