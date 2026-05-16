from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
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
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=16)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=4)
    new_password: str = Field(min_length=4)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=4)


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
    course_code: str
    semester: int
    section: int
    instructor_id: int | None
    available_videos: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CourseListResponse(BaseModel):
    items: list[CourseOut]
    total: int
    limit: int
    offset: int


class CreateCourseRequest(BaseModel):
    course_name: str = Field(min_length=2, max_length=255)
    course_code: str | None = Field(default=None, min_length=2, max_length=32)
    semester: int = Field(default=1, ge=1, le=8)
    section: int = Field(default=1, ge=1, le=5)
    instructor_id: int | None = None


class UpdateCourseRequest(BaseModel):
    course_name: str | None = Field(default=None, min_length=2, max_length=255)
    course_code: str | None = Field(default=None, min_length=2, max_length=32)
    semester: int | None = Field(default=None, ge=1, le=8)
    section: int | None = Field(default=None, ge=1, le=5)
    instructor_id: int | None = None


class TeacherListItem(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    course_count: int
    session_count: int


class TeacherListResponse(BaseModel):
    items: list[TeacherListItem]
    total: int
    limit: int
    offset: int


class AdminSummaryResponse(BaseModel):
    total_teachers: int
    active_teachers: int
    inactive_teachers: int
    total_courses: int
    assigned_courses: int
    unassigned_courses: int
    total_sessions: int
    completed_sessions: int


class UpdateTeacherRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    is_active: bool | None = None


class StartSessionRequest(BaseModel):
    course_id: int
    video_path: str
    frame_step: int = 1


class StartSessionResponse(BaseModel):
    session_id: int
    course_id: int
    course_name: str
    status: str
    start_time: datetime


class EndSessionResponse(BaseModel):
    session_id: int
    status: str
    final_avg_score: float | None


class SessionOut(BaseModel):
    id: int
    course_id: int
    course_name: Optional[str] = None
    instructor_name: Optional[str] = None
    status: str
    start_time: datetime
    end_time: datetime | None = None
    final_avg_score: float | None = None
    video_path: str | None = None
    session_metadata: dict[str, Any] | None = None


class SessionListResponse(BaseModel):
    items: list[SessionOut]
    total: int
    limit: int
    offset: int


class SessionLogOut(BaseModel):
    id: int
    session_id: int
    timestamp: datetime
    engagement_score: float
    engaged_count: int
    distracted_count: int
    payload: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


class SessionLogsResponse(BaseModel):
    items: list[SessionLogOut]
    total: int
    limit: int
    offset: int


class SessionScorePoint(BaseModel):
    session_id: int
    start_time: datetime
    final_avg_score: float


class CourseAnalyticsResponse(BaseModel):
    course_id: int
    course_name: str
    sessions_count: int
    completed_sessions_count: int
    avg_final_score: float | None
    peak_final_score: float | None
    lowest_final_score: float | None
    trend: list[SessionScorePoint] = Field(default_factory=list)


class TeacherCourseAnalytics(BaseModel):
    course_id: int
    course_name: str
    sessions_count: int
    avg_final_score: float | None


class TeacherAnalyticsResponse(BaseModel):
    teacher_id: int
    teacher_name: str
    total_courses: int
    total_sessions: int
    overall_avg_final_score: float | None
    courses: list[TeacherCourseAnalytics] = Field(default_factory=list)


class TeacherCourseDetailAnalytics(BaseModel):
    course_id: int
    course_name: str
    course_code: str
    semester: int
    section: int
    sessions_count: int
    completed_sessions_count: int
    avg_final_score: float | None
    peak_final_score: float | None
    lowest_final_score: float | None


class TeacherSessionAnalytics(BaseModel):
    session_id: int
    course_id: int
    course_name: str
    instructor_name: Optional[str] = None
    start_time: datetime
    end_time: datetime | None
    status: str
    final_avg_score: float | None


class TeacherProjectPageResponse(BaseModel):
    teacher_id: int
    teacher_name: str
    teacher_email: EmailStr
    is_active: bool
    total_courses: int
    total_sessions: int
    completed_sessions_count: int
    overall_avg_final_score: float | None
    courses: list[TeacherCourseDetailAnalytics] = Field(default_factory=list)
    sessions: list[TeacherSessionAnalytics] = Field(default_factory=list)


class AlertConfigRequest(BaseModel):
    engagement_threshold: float = Field(ge=0, le=100)
    duration_seconds: int = Field(ge=0, le=3600)
    enabled: bool = True


class AlertConfigOut(BaseModel):
    course_id: int
    engagement_threshold: float
    duration_seconds: int
    enabled: bool


class AISettingsRequest(BaseModel):
    update_interval_seconds: int = Field(ge=60, le=3600)


class AISettingsOut(BaseModel):
    update_interval_seconds: int


class SessionMetricsResponse(BaseModel):
    session_id: int
    avg_latency_ms: float | None
    p95_latency_ms: float | None
    actual_fps: float | None
    target_fps: float | None
    avg_engagement_score: float | None
    alert_count: int


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict[str, Any] | None = None


class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime
    user_id: int | None
    course_id: int | None
    action: str
    details: dict[str, Any] | None = None
    
    model_config = ConfigDict(from_attributes=True)
