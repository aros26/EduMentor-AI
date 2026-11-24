from dotenv import load_dotenv
load_dotenv()

import os, shutil
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import select
from .database import Base, engine, get_db
from .models import User, Thesis, Entry, Resource, Notice, CourseMaterial, Assignment, Submission
from .schemas import RegisterIn, LoginIn, ThesisIn, EntryIn, NoticeIn, AssignmentIn
from .security import hash_password, verify_password, make_token, token_user
from .services.gemini_service import generate_answer

app = FastAPI(title="EduMentor-AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

UPLOAD = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD)), name="uploads")

bearer = HTTPBearer(auto_error=False)

ALLOWED_EXTENSIONS = {".pdf", ".ppt", ".pptx", ".doc", ".docx", ".txt", ".zip", ".png", ".jpg", ".jpeg"}


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
) -> User:
    uid = token_user(creds.credentials) if creds else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Please log in")
    return user


def require_teacher(u: User):
    if u.role != "teacher":
        raise HTTPException(403, "Only teachers can perform this action")


def require_student(u: User):
    if u.role != "student":
        raise HTTPException(403, "Only students can perform this action")


def save_upload(file: UploadFile, prefix: str) -> str:
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    safe = f"{prefix}_{os.urandom(5).hex()}{ext}"
    dest = UPLOAD / safe
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return safe


# ─── Serializers ──────────────────────────────────────────────────────────────

def user_dict(u: User):
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


def entry_dict(e: Entry):
    return {
        "id": e.id, "kind": e.kind, "title": e.title,
        "content": e.content, "due_date": e.due_date,
        "completed": e.completed, "created_at": e.created_at.isoformat()
    }


def notice_dict(n: Notice):
    return {
        "id": n.id, "title": n.title, "content": n.content,
        "priority": n.priority, "teacher_name": n.teacher_name,
        "created_at": n.created_at.isoformat()
    }


def material_dict(m: CourseMaterial):
    return {
        "id": m.id, "title": m.title, "description": m.description,
        "filename": m.filename, "content_type": m.content_type,
        "teacher_name": m.teacher_name, "url": f"/uploads/{m.filename}",
        "created_at": m.created_at.isoformat()
    }


def assignment_dict(a: Assignment, submitted_ids: set = None):
    return {
        "id": a.id, "title": a.title, "description": a.description,
        "due_date": a.due_date, "teacher_name": a.teacher_name,
        "created_at": a.created_at.isoformat(),
        "submission_count": len(a.submissions),
        "submitted": (a.id in submitted_ids) if submitted_ids is not None else None
    }


def submission_dict(s: Submission):
    return {
        "id": s.id, "student_name": s.student_name,
        "filename": s.filename, "url": f"/uploads/{s.filename}",
        "submitted_at": s.submitted_at.isoformat()
    }


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "EduMentor-AI", "version": "2.0.0"}


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")
    u = User(
        name=data.name,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=data.role
    )
    db.add(u); db.commit(); db.refresh(u)
    return {"access_token": make_token(u.id), "token_type": "bearer", "user": user_dict(u)}


@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == data.email.lower()))
    if not u or not verify_password(data.password, u.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": make_token(u.id), "token_type": "bearer", "user": user_dict(u)}


@app.get("/api/auth/me")
def me(u: User = Depends(current_user)):
    return user_dict(u)


# ─── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def dashboard(u: User = Depends(current_user), db: Session = Depends(get_db)):
    notices = db.scalars(select(Notice)).all()
    materials = db.scalars(select(CourseMaterial)).all()
    assignments = db.scalars(select(Assignment)).all()

    if u.role == "teacher":
        my_notices = [n for n in notices if n.teacher_id == u.id]
        my_materials = [m for m in materials if m.teacher_id == u.id]
        my_assignments = [a for a in assignments if a.teacher_id == u.id]
        total_submissions = sum(len(a.submissions) for a in my_assignments)
        return {
            "role": "teacher",
            "notices_posted": len(my_notices),
            "materials_uploaded": len(my_materials),
            "assignments_created": len(my_assignments),
            "total_submissions": total_submissions,
        }
    else:
        theses = db.scalars(select(Thesis).where(Thesis.owner_id == u.id)).all()
        entries = db.scalars(select(Entry).where(Entry.owner_id == u.id)).all()
        my_submissions = db.scalars(select(Submission).where(Submission.student_id == u.id)).all()
        submitted_ids = {s.assignment_id for s in my_submissions}
        pending_assignments = sum(1 for a in assignments if a.id not in submitted_ids)
        return {
            "role": "student",
            "total_notices": len(notices),
            "total_materials": len(materials),
            "pending_assignments": pending_assignments,
            "thesis_count": len(theses),
            "pending_tasks": sum(e.kind == "task" and not e.completed for e in entries),
            "recent_theses": [
                {"id": t.id, "title": t.title, "status": t.status, "progress": t.progress}
                for t in theses[-4:]
            ]
        }


# ─── Notices ──────────────────────────────────────────────────────────────────

@app.get("/api/notices")
def list_notices(db: Session = Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(Notice).order_by(Notice.created_at.desc())).all()
    return [notice_dict(n) for n in rows]


@app.post("/api/notices")
def create_notice(data: NoticeIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_teacher(u)
    n = Notice(**data.model_dump(), teacher_id=u.id, teacher_name=u.name)
    db.add(n); db.commit(); db.refresh(n)
    return notice_dict(n)


@app.delete("/api/notices/{nid}")
def delete_notice(nid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_teacher(u)
    n = db.scalar(select(Notice).where(Notice.id == nid, Notice.teacher_id == u.id))
    if not n:
        raise HTTPException(404, "Notice not found")
    db.delete(n); db.commit()
    return {"message": "Notice deleted"}


# ─── Course Materials ─────────────────────────────────────────────────────────

@app.get("/api/materials")
def list_materials(db: Session = Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(CourseMaterial).order_by(CourseMaterial.created_at.desc())).all()
    return [material_dict(m) for m in rows]


@app.post("/api/materials")
def upload_material(
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    u: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    require_teacher(u)
    safe = save_upload(file, f"mat{u.id}")
    m = CourseMaterial(
        title=title, description=description, filename=safe,
        content_type=file.content_type or "application/octet-stream",
        teacher_id=u.id, teacher_name=u.name
    )
    db.add(m); db.commit(); db.refresh(m)
    return material_dict(m)


@app.delete("/api/materials/{mid}")
def delete_material(mid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_teacher(u)
    m = db.scalar(select(CourseMaterial).where(CourseMaterial.id == mid, CourseMaterial.teacher_id == u.id))
    if not m:
        raise HTTPException(404, "Material not found")
    dest = UPLOAD / m.filename
    if dest.exists():
        dest.unlink()
    db.delete(m); db.commit()
    return {"message": "Material deleted"}


# ─── Assignments ──────────────────────────────────────────────────────────────

@app.get("/api/assignments")
def list_assignments(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Assignment).order_by(Assignment.created_at.desc())).all()
    if u.role == "student":
        my_subs = db.scalars(select(Submission).where(Submission.student_id == u.id)).all()
        submitted_ids = {s.assignment_id for s in my_subs}
        return [assignment_dict(a, submitted_ids) for a in rows]
    return [assignment_dict(a) for a in rows]


@app.post("/api/assignments")
def create_assignment(data: AssignmentIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_teacher(u)
    a = Assignment(**data.model_dump(), teacher_id=u.id, teacher_name=u.name)
    db.add(a); db.commit(); db.refresh(a)
    return assignment_dict(a)


@app.delete("/api/assignments/{aid}")
def delete_assignment(aid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_teacher(u)
    a = db.scalar(select(Assignment).where(Assignment.id == aid, Assignment.teacher_id == u.id))
    if not a:
        raise HTTPException(404, "Assignment not found")
    db.delete(a); db.commit()
    return {"message": "Assignment deleted"}


@app.get("/api/assignments/{aid}/submissions")
def get_submissions(aid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_teacher(u)
    a = db.scalar(select(Assignment).where(Assignment.id == aid, Assignment.teacher_id == u.id))
    if not a:
        raise HTTPException(404, "Assignment not found")
    return [submission_dict(s) for s in a.submissions]


@app.post("/api/assignments/{aid}/submit")
def submit_assignment(
    aid: int,
    file: UploadFile = File(...),
    u: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    require_student(u)
    a = db.get(Assignment, aid)
    if not a:
        raise HTTPException(404, "Assignment not found")
    existing = db.scalar(
        select(Submission).where(Submission.assignment_id == aid, Submission.student_id == u.id)
    )
    if existing:
        raise HTTPException(409, "You already submitted this assignment. Delete the previous one to resubmit.")
    safe = save_upload(file, f"sub{u.id}")
    s = Submission(
        assignment_id=aid, student_id=u.id, student_name=u.name,
        filename=safe, content_type=file.content_type or "application/octet-stream"
    )
    db.add(s); db.commit(); db.refresh(s)
    return submission_dict(s)


@app.delete("/api/submissions/{sid}")
def delete_submission(sid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    require_student(u)
    s = db.scalar(select(Submission).where(Submission.id == sid, Submission.student_id == u.id))
    if not s:
        raise HTTPException(404, "Submission not found")
    dest = UPLOAD / s.filename
    if dest.exists():
        dest.unlink()
    db.delete(s); db.commit()
    return {"message": "Submission deleted"}


# ─── Student: Thesis, Entries, Resources ──────────────────────────────────────

@app.get("/api/theses")
def list_theses(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        {"id": t.id, "title": t.title, "topic": t.topic, "status": t.status, "progress": t.progress}
        for t in db.scalars(select(Thesis).where(Thesis.owner_id == u.id)).all()
    ]


@app.post("/api/theses")
def create_thesis(data: ThesisIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    t = Thesis(**data.model_dump(), owner_id=u.id)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "title": t.title, "topic": t.topic, "status": t.status, "progress": t.progress}


@app.put("/api/theses/{tid}")
def update_thesis(tid: int, data: ThesisIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    t = db.scalar(select(Thesis).where(Thesis.id == tid, Thesis.owner_id == u.id))
    if not t:
        raise HTTPException(404, "Thesis not found")
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return {"message": "Thesis updated"}


@app.delete("/api/theses/{tid}")
def delete_thesis(tid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    t = db.scalar(select(Thesis).where(Thesis.id == tid, Thesis.owner_id == u.id))
    if not t:
        raise HTTPException(404, "Thesis not found")
    db.delete(t); db.commit()
    return {"message": "Deleted"}


@app.get("/api/entries")
def list_entries(kind: str | None = None, u: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Entry).where(Entry.owner_id == u.id)
    if kind:
        q = q.where(Entry.kind == kind)
    return [entry_dict(e) for e in db.scalars(q.order_by(Entry.created_at.desc())).all()]


@app.post("/api/entries")
def create_entry(data: EntryIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    e = Entry(**data.model_dump(), owner_id=u.id)
    db.add(e); db.commit(); db.refresh(e)
    return entry_dict(e)


@app.patch("/api/entries/{eid}/complete")
def complete_entry(eid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.scalar(select(Entry).where(Entry.id == eid, Entry.owner_id == u.id))
    if not e:
        raise HTTPException(404, "Item not found")
    e.completed = not e.completed
    db.commit()
    return entry_dict(e)


@app.delete("/api/entries/{eid}")
def delete_entry(eid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.scalar(select(Entry).where(Entry.id == eid, Entry.owner_id == u.id))
    if not e:
        raise HTTPException(404, "Item not found")
    db.delete(e); db.commit()
    return {"message": "Deleted"}


@app.get("/api/resources")
def list_resources(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        {"id": r.id, "title": r.title, "filename": r.filename,
         "content_type": r.content_type, "url": f"/uploads/{r.filename}"}
        for r in db.scalars(select(Resource).where(Resource.owner_id == u.id)).all()
    ]


@app.post("/api/resources")
def upload_resource(
    title: str = Form(...),
    file: UploadFile = File(...),
    u: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    safe = save_upload(file, f"res{u.id}")
    r = Resource(
        title=title, filename=safe,
        content_type=file.content_type or "application/octet-stream",
        owner_id=u.id
    )
    db.add(r); db.commit(); db.refresh(r)
    return {"id": r.id, "title": r.title, "filename": r.filename, "url": f"/uploads/{safe}"}


@app.delete("/api/resources/{rid}")
def delete_resource(rid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.scalar(select(Resource).where(Resource.id == rid, Resource.owner_id == u.id))
    if not r:
        raise HTTPException(404, "Resource not found")
    dest = UPLOAD / r.filename
    if dest.exists():
        dest.unlink()
    db.delete(r); db.commit()
    return {"message": "Deleted"}


# ─── AI Assistant ─────────────────────────────────────────────────────────────

@app.post("/api/ai/ask")
def ai_ask(
    question: str = Form(...),
    u: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    if not question.strip():
        raise HTTPException(400, "Please enter a question.")
    if len(question) > 10000:
        raise HTTPException(400, "Question is too long.")

    context_parts = []

    if u.role == "teacher":
        notices = db.scalars(select(Notice).where(Notice.teacher_id == u.id).limit(10)).all()
        assignments = db.scalars(select(Assignment).where(Assignment.teacher_id == u.id).limit(10)).all()
        for n in notices:
            context_parts.append(f"Notice: {n.title}\n{n.content}")
        for a in assignments:
            context_parts.append(f"Assignment: {a.title}\nDue: {a.due_date}\n{a.description}")
    else:
        entries = db.scalars(
            select(Entry).where(Entry.owner_id == u.id)
            .order_by(Entry.created_at.desc()).limit(20)
        ).all()
        theses = db.scalars(
            select(Thesis).where(Thesis.owner_id == u.id).limit(10)
        ).all()
        for t in theses:
            context_parts.append(f"Thesis: {t.title}\nTopic: {t.topic}\nStatus: {t.status}\nProgress: {t.progress}%")
        for e in entries:
            context_parts.append(f"{e.kind}: {e.title}\nDetails: {e.content}\nDue: {e.due_date}\nDone: {e.completed}")

    context = "\n\n".join(context_parts)

    try:
        answer = generate_answer(question, context)
        return {
            "answer": answer,
            "mode": "gemini-generative",
            "user_role": u.role
        }
    except Exception as ex:
        print("Gemini API Error:", str(ex))
        raise HTTPException(502, "AI service failed. Check your GEMINI_API_KEY configuration.")
