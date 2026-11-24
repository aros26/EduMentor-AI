from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="student")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Thesis(Base):
    __tablename__ = "theses"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    topic: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="Planning")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Entry(Base):
    __tablename__ = "entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(220))
    content: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[str] = mapped_column(String(30), default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


# ─── BLC Features ────────────────────────────────────────────────────────────

class Notice(Base):
    """Teacher posts notices that all students can read."""
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    content: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20), default="normal")   # normal | urgent
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_name: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class CourseMaterial(Base):
    """Files uploaded by teacher, downloadable by students."""
    __tablename__ = "course_materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    description: Mapped[str] = mapped_column(Text, default="")
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_name: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Assignment(Base):
    """Assignments created by teachers."""
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(220))
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[str] = mapped_column(String(30), default="")
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_name: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")


class Submission(Base):
    """Student file submissions for an assignment."""
    __tablename__ = "submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    student_name: Mapped[str] = mapped_column(String(120), default="")
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="submissions")
