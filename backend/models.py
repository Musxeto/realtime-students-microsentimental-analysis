from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"


class SessionStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PAUSED = "PAUSED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.TEACHER)
    is_active = Column(Boolean, nullable=False, default=True)
    token_version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    courses = relationship("Course", back_populates="instructor")


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("course_code", "semester", "section", name="uq_courses_code_semester_section"),
    )

    id = Column(Integer, primary_key=True, index=True)
    course_name = Column(String(255), nullable=False)
    course_code = Column(String(32), nullable=False)
    semester = Column(Integer, nullable=False)
    section = Column(Integer, nullable=False)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    instructor = relationship("User", back_populates="courses")
    sessions = relationship("ClassSession", back_populates="course", cascade="all, delete-orphan")


class ClassSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    final_avg_score = Column(Float, nullable=True)
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.PENDING)
    video_path = Column(Text, nullable=True)
    session_metadata = Column(JSON, nullable=True)

    course = relationship("Course", back_populates="sessions")
    logs = relationship("SessionLog", back_populates="session", cascade="all, delete-orphan")
    alert_events = relationship("AlertEvent", back_populates="session", cascade="all, delete-orphan")
    performance_metrics = relationship("PerformanceMetric", back_populates="session", cascade="all, delete-orphan")


class SessionLog(Base):
    __tablename__ = "session_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    engagement_score = Column(Float, nullable=False)
    engaged_count = Column(Integer, nullable=False, default=0)
    distracted_count = Column(Integer, nullable=False, default=0)
    payload = Column(JSON, nullable=True)

    session = relationship("ClassSession", back_populates="logs")


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, unique=True)
    engagement_threshold = Column(Float, nullable=False, default=50.0)
    duration_seconds = Column(Integer, nullable=False, default=180)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AISettings(Base):
    __tablename__ = "ai_settings"

    id = Column(Integer, primary_key=True, index=True)
    update_interval_seconds = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    engagement_at_trigger = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    session = relationship("ClassSession", back_populates="alert_events")


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    metric_type = Column(String(50), nullable=False)
    value = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ClassSession", back_populates="performance_metrics")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)

    user = relationship("User")
    course = relationship("Course")
