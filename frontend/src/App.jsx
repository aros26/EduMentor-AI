import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, LayoutDashboard, FileText, AlarmClock, FolderOpen,
  BrainCircuit, LogOut, Plus, CheckCircle2, Trash2, Upload,
  Menu, X, GraduationCap, Users, ArrowRight, Bell, Download,
  ClipboardList, ChevronDown, ChevronUp, Eye, AlertTriangle,
  BookMarked, Send, FileCheck, Megaphone, Library
} from 'lucide-react';

const API = localStorage.getItem('edumentor.apiBase') || 'http://127.0.0.1:8000';

async function request(path, opts = {}) {
  const token = localStorage.getItem('edumentor.token');
  const isForm = opts.body instanceof FormData;
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const r = await fetch(API + path, { ...opts, headers });
  const d = await r.json().catch(() => ({ detail: 'Server error' }));
  if (!r.ok) throw new Error(d.detail || 'Request failed');
  return d;
}

function useData(path, refresh) {
  const [data, setData] = useState([]);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    request(path).then(setData).catch(e => setErr(e.message));
  }, [path]);
  useEffect(() => { load(); }, [load, refresh]);
  return [data, setData, err, load];
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('edumentor.token'));
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [menu, setMenu] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    if (token) {
      request('/api/auth/me')
        .then(u => { setUser(u); setTab('dashboard'); })
        .catch(() => { localStorage.removeItem('edumentor.token'); setToken(null); });
    }
  }, [token]);

  function logout() {
    localStorage.removeItem('edumentor.token');
    setToken(null); setUser(null);
  }

  function onAuth(d) {
    localStorage.setItem('edumentor.token', d.access_token);
    setToken(d.access_token);
    setUser(d.user);
    setTab('dashboard');
  }

  if (!token || !user) {
    return <Auth onAuth={onAuth} mode={authMode} setMode={setAuthMode} />;
  }

  const isTeacher = user.role === 'teacher';

  const teacherNav = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['notices', 'Notice Board', Megaphone],
    ['materials', 'Course Materials', Library],
    ['assignments', 'Assignments', ClipboardList],
    ['ai', 'AI Assistant', BrainCircuit],
  ];

  const studentNav = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['notices', 'Notices', Bell],
    ['materials', 'Course Materials', Library],
    ['assignments', 'My Assignments', ClipboardList],
    ['thesis', 'Thesis Roadmap', BookOpen],
    ['meetings', 'Meeting Notes', FileText],
    ['tasks', 'Deadlines', AlarmClock],
    ['resources', 'My Resources', FolderOpen],
    ['ai', 'AI Assistant', BrainCircuit],
  ];

  const nav = isTeacher ? teacherNav : studentNav;

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${isTeacher ? 'teacher-theme' : 'student-theme'} ${menu ? 'show' : ''}`}>
        <div className="brand">
          <div className="brandicon"><GraduationCap /></div>
          <div>
            <b>EduMentor<span>-AI</span></b>
            <small>ACADEMIC PORTAL</small>
          </div>
          <button className="close mobile" onClick={() => setMenu(false)}><X /></button>
        </div>

        <div className="role-badge">
          <span className={`rbadge ${isTeacher ? 'rbadge-teacher' : 'rbadge-student'}`}>
            {isTeacher ? '🧑‍🏫 Teacher' : '🎓 Student'}
          </span>
        </div>

        <div className="workspace-label">MENU</div>

        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            className={`nav ${tab === id ? 'active' : ''}`}
            onClick={() => { setTab(id); setMenu(false); }}
          >
            <Icon size={18} />
            {label}
            {id === 'ai' && <span className="new">AI</span>}
          </button>
        ))}

        <div className="sidebottom">
          <div className="profile">
            <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div className="profiletext">
              <b>{user.name}</b>
              <small>{user.role}</small>
            </div>
            <button className="iconbtn" onClick={logout} title="Logout"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header>
          <button className="iconbtn mobile" onClick={() => setMenu(true)}><Menu /></button>
          <div className="crumb">
            {isTeacher ? 'Teacher Portal' : 'Student Portal'}
            <span>/</span>
            <b>{nav.find(([id]) => id === tab)?.[1] ?? tab}</b>
          </div>
          <div className="topright">
            <span className="statusdot" />
            <span>{user.name}</span>
            <div className="avatar smallavatar">{user.name?.[0]?.toUpperCase()}</div>
          </div>
        </header>

        <section className="content">
          {tab === 'dashboard' && <Dashboard user={user} setTab={setTab} />}
          {tab === 'notices' && <NoticeBoard user={user} />}
          {tab === 'materials' && <CourseMaterials user={user} />}
          {tab === 'assignments' && <Assignments user={user} />}
          {tab === 'thesis' && <Theses />}
          {tab === 'meetings' && <Entries kind="meeting" />}
          {tab === 'tasks' && <Entries kind="task" />}
          {tab === 'resources' && <MyResources />}
          {tab === 'ai' && <Assistant user={user} />}

          <footer>© 2026 EduMentor-AI <span>Powered by Gemini AI · Built for academia</span></footer>
        </section>
      </main>
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function Auth({ onAuth, mode, setMode }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const d = await request('/api/auth/' + (mode === 'login' ? 'login' : 'register'), {
        method: 'POST', body: JSON.stringify(form)
      });
      onAuth(d);
    } catch (x) {
      setErr(x.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="authvisual">
        <div className="authbrand">
          <div className="brandicon"><GraduationCap /></div>
          <b>EduMentor<span>-AI</span></b>
        </div>
        <div className="visualcopy">
          <div className="eyebrow">UNIVERSITY LEARNING PORTAL</div>
          <h1>Learn smarter.<br /><em>Teach better.</em></h1>
          <p>Your all-in-one academic platform — post notices, manage assignments, track thesis progress, and get AI-powered guidance.</p>
          <div className="visualstats">
            <div><b>📢</b><small>NOTICE BOARD</small></div>
            <div><b>📚</b><small>COURSE FILES</small></div>
            <div><b>🤖</b><small>AI ASSISTANT</small></div>
          </div>
        </div>
        <div className="authfoot">Inspired by Daffodil International University BLC</div>
      </div>

      <div className="authform">
        <div className="formwrap">
          <div className="eyebrow">WELCOME TO EDUMENTOR-AI</div>
          <h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
          <p className="muted">{mode === 'login' ? 'Enter your credentials to continue.' : 'Join the EduMentor academic community.'}</p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <label>Full name
                <input required minLength="2" placeholder="Your full name"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
            )}
            <label>Email address
              <input type="email" required placeholder="you@university.edu"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>Password
              <input type="password" required minLength="8" placeholder="At least 8 characters"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </label>
            {mode === 'register' && (
              <label>Account type
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="student">🎓 Student</option>
                  <option value="teacher">🧑‍🏫 Teacher</option>
                </select>
              </label>
            )}
            {err && <div className="error">{err}</div>}
            <button className="primary full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="switch">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setErr(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
          <div className="secure"><CheckCircle2 size={15} /> Your workspace is private and secure.</div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, setTab }) {
  const [d, setD] = useState(null);
  useEffect(() => { request('/api/dashboard').then(setD).catch(() => {}); }, []);
  const isTeacher = user.role === 'teacher';

  if (!d) return <div className="loading-msg">Loading dashboard...</div>;

  if (isTeacher) {
    return (
      <>
        <div className="page-header">
          <div className="eyebrow">TEACHER DASHBOARD</div>
          <h1>Welcome back, {user.name.split(' ')[0]}! 🧑‍🏫</h1>
          <p className="muted">Manage your notices, materials, and assignments from one place.</p>
        </div>
        <div className="statsgrid">
          {[
            ['Notices Posted', d.notices_posted ?? 0, Megaphone, 'blue'],
            ['Materials Uploaded', d.materials_uploaded ?? 0, Library, 'purple'],
            ['Assignments', d.assignments_created ?? 0, ClipboardList, 'orange'],
            ['Total Submissions', d.total_submissions ?? 0, FileCheck, 'green'],
          ].map(([label, val, Icon, color]) => (
            <div className="stat" key={label}>
              <div className={`staticon ${color}`}><Icon size={19} /></div>
              <div><small>{label}</small><strong>{val}</strong></div>
            </div>
          ))}
        </div>
        <div className="quickgrid">
          <button onClick={() => setTab('notices')} className="quick">
            <Megaphone /><b>Post a Notice</b><small>Announce to all students</small>
          </button>
          <button onClick={() => setTab('materials')} className="quick">
            <Library /><b>Upload Material</b><small>Share course files</small>
          </button>
          <button onClick={() => setTab('assignments')} className="quick">
            <ClipboardList /><b>Create Assignment</b><small>Set tasks with deadlines</small>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="eyebrow">STUDENT DASHBOARD</div>
        <h1>Welcome back, {user.name.split(' ')[0]}! 🎓</h1>
        <p className="muted">Stay on top of notices, assignments, and your thesis progress.</p>
      </div>
      <div className="statsgrid">
        {[
          ['New Notices', d.total_notices ?? 0, Bell, 'blue'],
          ['Course Materials', d.total_materials ?? 0, Library, 'purple'],
          ['Pending Assignments', d.pending_assignments ?? 0, ClipboardList, 'orange'],
          ['Thesis Projects', d.thesis_count ?? 0, BookOpen, 'green'],
        ].map(([label, val, Icon, color]) => (
          <div className="stat" key={label}>
            <div className={`staticon ${color}`}><Icon size={19} /></div>
            <div><small>{label}</small><strong>{val}</strong></div>
          </div>
        ))}
      </div>

      {d.recent_theses?.length > 0 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panelhead">
            <div><h3>Recent Thesis Projects</h3><p className="muted">Your research progress</p></div>
            <button className="textbutton" onClick={() => setTab('thesis')}>View all <ArrowRight size={15} /></button>
          </div>
          <div className="projectlist">
            {d.recent_theses.map(t => (
              <div className="project" key={t.id}>
                <div className="projecticon"><BookOpen /></div>
                <div className="projectinfo">
                  <b>{t.title}</b>
                  <small>{t.status}</small>
                  <div className="progress"><i style={{ width: t.progress + '%' }} /></div>
                </div>
                <b className="percent">{t.progress}%</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quickgrid" style={{ marginTop: 20 }}>
        <button onClick={() => setTab('notices')} className="quick">
          <Bell /><b>View Notices</b><small>See latest announcements</small>
        </button>
        <button onClick={() => setTab('assignments')} className="quick">
          <ClipboardList /><b>My Assignments</b><small>Submit pending work</small>
        </button>
        <button onClick={() => setTab('materials')} className="quick">
          <Library /><b>Course Materials</b><small>Download study files</small>
        </button>
      </div>
    </>
  );
}

// ─── Notice Board ─────────────────────────────────────────────────────────────

function NoticeBoard({ user }) {
  const [data, , , reload] = useData('/api/notices', 0);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', content: '', priority: 'normal' });
  const [err, setErr] = useState('');
  const isTeacher = user.role === 'teacher';

  async function save(e) {
    e.preventDefault(); setErr('');
    try {
      await request('/api/notices', { method: 'POST', body: JSON.stringify(f) });
      setF({ title: '', content: '', priority: 'normal' }); setShow(false); reload();
    } catch (x) { setErr(x.message); }
  }

  async function del(id) {
    if (!confirm('Delete this notice?')) return;
    await request('/api/notices/' + id, { method: 'DELETE' }); reload();
  }

  return (
    <div className="panel">
      <div className="panelhead">
        <div>
          <h3>📢 Notice Board</h3>
          <p className="muted">{isTeacher ? 'Post announcements for all students.' : 'Latest announcements from your teachers.'}</p>
        </div>
        {isTeacher && (
          <button className="primary" onClick={() => setShow(!show)}>
            <Plus size={16} /> Post Notice
          </button>
        )}
      </div>

      {isTeacher && show && (
        <form className="inlineform" onSubmit={save}>
          <label>Notice Title <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Exam Schedule Updated" /></label>
          <label>Content <textarea value={f.content} onChange={e => setF({ ...f, content: e.target.value })} placeholder="Write notice details here..." /></label>
          <label>Priority
            <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
          </label>
          {err && <div className="error">{err}</div>}
          <div className="formrow">
            <button className="primary" type="submit">Post Notice</button>
            <button type="button" className="secondary" onClick={() => setShow(false)}>Cancel</button>
          </div>
        </form>
      )}

      {data.length === 0 && !show && (
        <Empty title="No notices yet" text={isTeacher ? 'Post your first notice to inform students.' : 'No notices from teachers yet. Check back later.'} />
      )}

      <div className="notice-list">
        {data.map(n => (
          <div className={`notice-card ${n.priority === 'urgent' ? 'urgent' : ''}`} key={n.id}>
            <div className="notice-top">
              {n.priority === 'urgent' && <span className="priority-badge"><AlertTriangle size={12} /> URGENT</span>}
              <b>{n.title}</b>
              {isTeacher && (
                <button className="iconbtn danger" onClick={() => del(n.id)}><Trash2 size={15} /></button>
              )}
            </div>
            <p className="notice-body">{n.content}</p>
            <small className="notice-meta">Posted by {n.teacher_name} · {new Date(n.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Course Materials ─────────────────────────────────────────────────────────

function CourseMaterials({ user }) {
  const [data, , , reload] = useData('/api/materials', 0);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const isTeacher = user.role === 'teacher';

  async function upload(e) {
    e.preventDefault(); setMsg('');
    if (!file) return;
    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', desc);
    fd.append('file', file);
    try {
      await request('/api/materials', { method: 'POST', body: fd });
      setMsg('✅ Uploaded successfully!');
      setTitle(''); setDesc(''); setFile(null);
      setShow(false); reload();
      e.target.reset();
    } catch (x) { setMsg('❌ ' + x.message); }
  }

  async function del(id) {
    if (!confirm('Delete this material?')) return;
    await request('/api/materials/' + id, { method: 'DELETE' }); reload();
  }

  return (
    <div className="panel">
      <div className="panelhead">
        <div>
          <h3>📚 Course Materials</h3>
          <p className="muted">{isTeacher ? 'Upload files for your students.' : 'Download materials shared by your teachers.'}</p>
        </div>
        {isTeacher && (
          <button className="primary" onClick={() => setShow(!show)}>
            <Upload size={16} /> Upload Material
          </button>
        )}
      </div>

      {isTeacher && show && (
        <form className="uploadbox" onSubmit={upload}>
          <Upload size={28} />
          <b>Upload Course Material</b>
          <p>PDF, PPT, DOCX, TXT, ZIP, PNG, JPG supported</p>
          <input required placeholder="Material title" value={title} onChange={e => setTitle(e.target.value)} />
          <input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
          <input required type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files[0])} />
          <div className="formrow">
            <button className="primary" disabled={!file}>Upload File</button>
            <button type="button" className="secondary" onClick={() => setShow(false)}>Cancel</button>
          </div>
          {msg && <small>{msg}</small>}
        </form>
      )}

      {data.length === 0 && (
        <Empty title="No materials yet" text={isTeacher ? 'Upload your first course file.' : 'No materials uploaded by teachers yet.'} />
      )}

      <div className="projectlist">
        {data.map(m => (
          <div className="project" key={m.id}>
            <div className="projecticon"><FileText /></div>
            <div className="projectinfo">
              <b>{m.title}</b>
              <small>{m.description || m.filename} · by {m.teacher_name}</small>
            </div>
            <a className="btn-download" href={API + m.url} target="_blank" rel="noreferrer">
              <Download size={14} /> Download
            </a>
            {isTeacher && (
              <button className="iconbtn danger" onClick={() => del(m.id)}><Trash2 size={15} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Assignments ──────────────────────────────────────────────────────────────

function Assignments({ user }) {
  const [data, , , reload] = useData('/api/assignments', 0);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', description: '', due_date: '' });
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [subs, setSubs] = useState({});
  const [submitFiles, setSubmitFiles] = useState({});
  const [submitMsg, setSubmitMsg] = useState({});
  const isTeacher = user.role === 'teacher';

  async function create(e) {
    e.preventDefault(); setErr('');
    try {
      await request('/api/assignments', { method: 'POST', body: JSON.stringify(f) });
      setF({ title: '', description: '', due_date: '' }); setShow(false); reload();
    } catch (x) { setErr(x.message); }
  }

  async function del(id) {
    if (!confirm('Delete this assignment?')) return;
    await request('/api/assignments/' + id, { method: 'DELETE' }); reload();
  }

  async function viewSubs(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const s = await request('/api/assignments/' + id + '/submissions');
    setSubs(prev => ({ ...prev, [id]: s }));
  }

  async function submitAssignment(aid) {
    const file = submitFiles[aid];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      await request('/api/assignments/' + aid + '/submit', { method: 'POST', body: fd });
      setSubmitMsg(prev => ({ ...prev, [aid]: '✅ Submitted successfully!' }));
      reload();
    } catch (x) {
      setSubmitMsg(prev => ({ ...prev, [aid]: '❌ ' + x.message }));
    }
  }

  return (
    <div className="panel">
      <div className="panelhead">
        <div>
          <h3>📋 {isTeacher ? 'Assignments' : 'My Assignments'}</h3>
          <p className="muted">{isTeacher ? 'Create and manage student assignments.' : 'View and submit your assignments.'}</p>
        </div>
        {isTeacher && (
          <button className="primary" onClick={() => setShow(!show)}>
            <Plus size={16} /> New Assignment
          </button>
        )}
      </div>

      {isTeacher && show && (
        <form className="inlineform" onSubmit={create}>
          <label>Assignment Title <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Chapter 3 Report" /></label>
          <label>Instructions <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Describe what students need to submit..." /></label>
          <label>Due Date <input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></label>
          {err && <div className="error">{err}</div>}
          <div className="formrow">
            <button className="primary" type="submit">Create Assignment</button>
            <button type="button" className="secondary" onClick={() => setShow(false)}>Cancel</button>
          </div>
        </form>
      )}

      {data.length === 0 && !show && (
        <Empty title="No assignments yet" text={isTeacher ? 'Create your first assignment.' : 'No assignments from teachers yet.'} />
      )}

      <div className="assign-list">
        {data.map(a => {
          const isExpanded = expanded === a.id;
          const overdue = a.due_date && new Date(a.due_date) < new Date();
          return (
            <div className={`assign-card ${a.submitted ? 'submitted' : ''}`} key={a.id}>
              <div className="assign-top">
                <div className="assign-info">
                  <b>{a.title}</b>
                  <small>
                    By {a.teacher_name}
                    {a.due_date && <> · Due: <span className={overdue && !a.submitted ? 'overdue' : ''}>{a.due_date}</span></>}
                  </small>
                  {a.description && <p className="assign-desc">{a.description}</p>}
                </div>
                <div className="assign-actions">
                  {a.submitted && <span className="status-badge submitted-badge">✅ Submitted</span>}
                  {!a.submitted && overdue && !isTeacher && <span className="status-badge overdue-badge">⚠️ Overdue</span>}
                  {isTeacher && (
                    <button className="textbutton" onClick={() => viewSubs(a.id)}>
                      <Eye size={14} /> {a.submission_count} submissions
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  {isTeacher && (
                    <button className="iconbtn danger" onClick={() => del(a.id)}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>

              {/* Teacher: view submissions */}
              {isTeacher && isExpanded && (
                <div className="subs-list">
                  {subs[a.id]?.length === 0 && <p className="muted" style={{ padding: '10px 0' }}>No submissions yet.</p>}
                  {subs[a.id]?.map(s => (
                    <div className="sub-item" key={s.id}>
                      <FileCheck size={15} />
                      <span>{s.student_name}</span>
                      <small>{new Date(s.submitted_at).toLocaleDateString()}</small>
                      <a href={API + s.url} target="_blank" rel="noreferrer" className="textbutton">
                        <Download size={13} /> Download
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Student: submit */}
              {!isTeacher && !a.submitted && (
                <div className="submit-row">
                  <input type="file" accept=".pdf,.doc,.docx,.txt,.zip"
                    onChange={e => setSubmitFiles(prev => ({ ...prev, [a.id]: e.target.files[0] }))} />
                  <button className="primary sm" onClick={() => submitAssignment(a.id)} disabled={!submitFiles[a.id]}>
                    <Send size={14} /> Submit
                  </button>
                  {submitMsg[a.id] && <small>{submitMsg[a.id]}</small>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Thesis (Student) ─────────────────────────────────────────────────────────

function Theses() {
  const [data, , , reload] = useData('/api/theses', 0);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', topic: '', status: 'Planning', progress: 0 });
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    try {
      await request('/api/theses', { method: 'POST', body: JSON.stringify({ ...f, progress: Number(f.progress) }) });
      setShow(false); setF({ title: '', topic: '', status: 'Planning', progress: 0 }); reload();
    } catch (x) { setErr(x.message); }
  }

  async function del(id) {
    if (!confirm('Delete this thesis?')) return;
    await request('/api/theses/' + id, { method: 'DELETE' }); reload();
  }

  return (
    <>
      <div className="panel">
        <div className="panelhead">
          <div><h3>Thesis Roadmap</h3><p className="muted">Structure your research journey.</p></div>
          <button className="primary" onClick={() => setShow(!show)}><Plus size={16} /> Add Thesis</button>
        </div>
        {show && (
          <form className="inlineform" onSubmit={save}>
            <label>Title <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. AI-powered learning systems" /></label>
            <label>Research Topic <textarea value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} placeholder="Describe your research question..." /></label>
            <div className="formrow">
              <label>Status
                <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
                  {['Planning', 'Literature Review', 'Methodology', 'Development', 'Writing', 'Completed'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label>Progress (%)
                <input type="number" min="0" max="100" value={f.progress} onChange={e => setF({ ...f, progress: e.target.value })} />
              </label>
            </div>
            {err && <div className="error">{err}</div>}
            <button className="primary">Save Project</button>
          </form>
        )}
        {data.length ? data.map(t => (
          <div className="project" key={t.id}>
            <div className="projecticon"><BookOpen /></div>
            <div className="projectinfo">
              <b>{t.title}</b>
              <small>{t.status} · {t.topic}</small>
              <div className="progress"><i style={{ width: t.progress + '%' }} /></div>
            </div>
            <b className="percent">{t.progress}%</b>
            <button className="iconbtn danger" onClick={() => del(t.id)}><Trash2 size={16} /></button>
          </div>
        )) : !show && <Empty title="No thesis projects" text="Start your first research project." />}
      </div>
      <div className="hint">Tip: Break your thesis into milestones and update progress regularly.</div>
    </>
  );
}

// ─── Entries (Student) ────────────────────────────────────────────────────────

function Entries({ kind }) {
  const [data, , , reload] = useData('/api/entries?kind=' + kind, 0);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', content: '', due_date: '' });

  async function save(e) {
    e.preventDefault();
    await request('/api/entries', { method: 'POST', body: JSON.stringify({ ...f, kind }) });
    setF({ title: '', content: '', due_date: '' }); setShow(false); reload();
  }

  async function toggle(id) { await request('/api/entries/' + id + '/complete', { method: 'PATCH' }); reload(); }
  async function del(id) { await request('/api/entries/' + id, { method: 'DELETE' }); reload(); }

  return (
    <div className="panel">
      <div className="panelhead">
        <div>
          <h3>{kind === 'meeting' ? 'Meeting Notes' : 'Deadlines & Reminders'}</h3>
          <p className="muted">{kind === 'meeting' ? 'Log supervisor discussions.' : 'Track upcoming tasks.'}</p>
        </div>
        <button className="primary" onClick={() => setShow(!show)}>
          <Plus size={16} /> Add {kind === 'meeting' ? 'Meeting' : 'Task'}
        </button>
      </div>
      {show && (
        <form className="inlineform" onSubmit={save}>
          <label>Title <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
          <label>{kind === 'meeting' ? 'Notes & Action Points' : 'Description'}
            <textarea value={f.content} onChange={e => setF({ ...f, content: e.target.value })} />
          </label>
          {kind === 'task' && <label>Due Date <input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></label>}
          <button className="primary">Save {kind}</button>
        </form>
      )}
      {data.length ? data.map(e => (
        <div className="entry" key={e.id}>
          <button className={`check ${e.completed ? 'checked' : ''}`} onClick={() => toggle(e.id)}><CheckCircle2 size={19} /></button>
          <div className="entrybody">
            <b className={e.completed ? 'strike' : ''}>{e.title}</b>
            {e.content && <p>{e.content}</p>}
            {e.due_date && <small>Due {e.due_date}</small>}
          </div>
          <button className="iconbtn danger" onClick={() => del(e.id)}><Trash2 size={16} /></button>
        </div>
      )) : !show && <Empty title={kind === 'meeting' ? 'No meeting notes' : 'No tasks yet'} text="Click the button above to add one." />}
    </div>
  );
}

// ─── My Resources (Student) ───────────────────────────────────────────────────

function MyResources() {
  const [data, , , reload] = useData('/api/resources', 0);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');

  async function upload(e) {
    e.preventDefault(); if (!file) return;
    const fd = new FormData(); fd.append('title', title); fd.append('file', file);
    try {
      await request('/api/resources', { method: 'POST', body: fd });
      setMsg('✅ Uploaded!'); setTitle(''); setFile(null); reload(); e.target.reset();
    } catch (x) { setMsg('❌ ' + x.message); }
  }

  async function del(id) {
    if (!confirm('Delete this resource?')) return;
    await request('/api/resources/' + id, { method: 'DELETE' }); reload();
  }

  return (
    <div className="panel">
      <div className="panelhead">
        <div><h3>My Resource Library</h3><p className="muted">Your personal research files.</p></div>
        <FolderOpen />
      </div>
      <form className="uploadbox" onSubmit={upload}>
        <Upload size={25} /><b>Upload a Resource</b>
        <p>PDF, PPT, DOCX, TXT · Personal files for your research</p>
        <input required placeholder="Resource title" value={title} onChange={e => setTitle(e.target.value)} />
        <input required type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
          onChange={e => setFile(e.target.files[0])} />
        <button className="primary" disabled={!file}>Upload File</button>
        {msg && <small>{msg}</small>}
      </form>
      {data.map(r => (
        <div className="project" key={r.id}>
          <div className="projecticon"><FileText /></div>
          <div className="projectinfo"><b>{r.title}</b><small>{r.filename}</small></div>
          <a className="textbutton" href={API + r.url} target="_blank" rel="noreferrer">Open <ArrowRight size={14} /></a>
          <button className="iconbtn danger" onClick={() => del(r.id)}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────

function Assistant({ user }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(e) {
    e.preventDefault(); setLoading(true); setAnswer('');
    try {
      const fd = new FormData(); fd.append('question', q);
      const d = await request('/api/ai/ask', { method: 'POST', body: fd });
      setAnswer(d.answer);
    } catch (x) { setAnswer('❌ ' + x.message); }
    finally { setLoading(false); }
  }

  const isTeacher = user.role === 'teacher';
  const tips = isTeacher
    ? ['What topics should I cover for Chapter 1?', 'Help me write an assignment description.', 'Suggest evaluation criteria for research reports.']
    : ['Summarize my research progress.', 'Which tasks are still pending?', 'Explain qualitative vs quantitative research.'];

  return (
    <div className="aiwrap">
      <div className="aibanner">
        <div className="aiorb"><BrainCircuit size={30} /></div>
        <div>
          <div className="eyebrow">YOUR AI RESEARCH COMPANION</div>
          <h2>Ask EduMentor AI</h2>
          <p>Get instant help with academics, research, assignments, and more. Powered by Google Gemini.</p>
        </div>
      </div>
      <div className="panel chatpanel">
        <div className="chatintro">
          <div className="aiavatar"><BrainCircuit /></div>
          <div><b>EduMentor Assistant</b><small>Gemini AI · Ready to help · {isTeacher ? 'Teacher mode' : 'Student mode'}</small></div>
        </div>
        <p className="muted">Try asking:</p>
        <div className="ai-tips">
          {tips.map(t => (
            <button key={t} className="tip-chip" onClick={() => setQ(t)}>{t}</button>
          ))}
        </div>
        {answer && <div className="answer">{answer}</div>}
        <form className="askform" onSubmit={ask}>
          <input required value={q} onChange={e => setQ(e.target.value)} placeholder="Ask anything about your academics..." />
          <button className="primary" disabled={loading}>
            {loading ? 'Thinking...' : 'Ask AI'} <ArrowRight size={16} />
          </button>
        </form>
        <small className="muted">Powered by Google Gemini. Your workspace context provides personalized answers.</small>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Empty({ title, text }) {
  return (
    <div className="empty">
      <div className="emptyicon"><BookOpen /></div>
      <b>{title}</b><p>{text}</p>
    </div>
  );
}
