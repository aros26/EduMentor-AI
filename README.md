# EduMentor-AI — BLC-Style Academic Portal

A full-stack university learning platform (BLC) with **Teacher** and **Student** portals.
Inspired by Daffodil International University's Blended Learning Center.

## 🚀 Features

### 🧑‍🏫 Teacher Portal
- Post Notices (Normal / Urgent priority)
- Upload Course Materials (PDF, PPT, DOCX, etc.)
- Create Assignments with due dates
- View student submissions

### 🎓 Student Portal
- View Notice Board
- Download Course Materials
- View & Submit Assignments
- Thesis Roadmap tracker
- Meeting Notes & Deadlines
- Personal Resource Library
- AI Assistant (Gemini)

### 🤖 AI Assistant
- Powered by Google Gemini
- Context-aware answers based on workspace data
- Works for both Teacher and Student roles

---

## 🗂️ Project Structure

```
EduMentor-AI/
├── backend/               # FastAPI Python backend
│   ├── app/
│   │   ├── main.py        # All API routes
│   │   ├── models.py      # SQLAlchemy DB models
│   │   ├── schemas.py     # Pydantic validation
│   │   ├── security.py    # JWT auth & password hashing
│   │   ├── database.py    # SQLite DB setup
│   │   └── services/
│   │       └── gemini_service.py   # Gemini AI integration
│   ├── uploads/           # Uploaded files stored here
│   ├── requirements.txt
│   └── .env               # Your API keys (create from .env.example)
│
└── frontend/              # React + Vite frontend
    ├── src/
    │   ├── App.jsx        # Main app + all components
    │   ├── style.css      # All styles
    │   └── main.jsx       # Entry point
    └── package.json
```

---

## ⚙️ Setup & Run

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env
# Then edit .env and add your GEMINI_API_KEY

# Run server
uvicorn app.main:app --reload
```

Backend runs at: **http://127.0.0.1:8000**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## 🔑 Environment Variables

Create `backend/.env` from `.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///./edumentor.db
UPLOAD_DIR=uploads
```

Get your Gemini API key: https://aistudio.google.com/apikey

---

## 👤 Test Accounts (Register your own)

1. Register as **Teacher** → Post notices, upload materials, create assignments
2. Register as **Student** → View notices, download materials, submit assignments

---

## 🌐 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/notices | Get all notices |
| POST | /api/notices | Post notice (Teacher only) |
| GET | /api/materials | Get all course materials |
| POST | /api/materials | Upload material (Teacher only) |
| GET | /api/assignments | Get all assignments |
| POST | /api/assignments | Create assignment (Teacher only) |
| POST | /api/assignments/{id}/submit | Submit assignment (Student only) |
| GET | /api/assignments/{id}/submissions | View submissions (Teacher only) |
| POST | /api/ai/ask | AI Assistant |

Full API docs: **http://127.0.0.1:8000/docs**
