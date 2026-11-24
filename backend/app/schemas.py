from pydantic import BaseModel, EmailStr, Field
from typing import Literal


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "teacher"] = "student"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ThesisIn(BaseModel):
    title: str
    topic: str = ""
    status: str = "Planning"
    progress: int = Field(default=0, ge=0, le=100)


class EntryIn(BaseModel):
    kind: Literal["meeting", "task", "note"]
    title: str
    content: str = ""
    due_date: str = ""
    completed: bool = False


# ─── BLC Schemas ─────────────────────────────────────────────────────────────

class NoticeIn(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    content: str = ""
    priority: Literal["normal", "urgent"] = "normal"


class AssignmentIn(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    description: str = ""
    due_date: str = ""
