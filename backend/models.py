from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    courses = relationship("Course", back_populates="instructor", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    course_name = Column(String(255), nullable=False)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
