import { useEffect, useState } from 'react';
import { api, fmtDate, isOverdue } from '../api';
import { useAuth } from '../auth.jsx';
import { Flash, StatusPill, Tags } from '../components/Bits.jsx';

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [msg, setMsg] = useState({});
  const load = () => api('/tasks').then(setTasks).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);
  const setStatus = async (id, status) => { try { await api(`/tasks/${id}/status`, { method: 'PATCH', body: { status } }); load(); } catch (e) { setMsg({ type: 'error', text: e.message }); } };

  const group = (s) => (tasks || []).filter((t) => t.status === s);
  const Section = ({ title, status, children }) => group(status).length > 0 && (
    <section><h3>{title} ({group(status).length})</h3><div className="task-list">{group(status).map(children)}</div></section>
  );
  const Card = (t) => (
    <article key={t._id} className={`task ${isOverdue(t) ? 'late' : ''}`}>
      <div className="row"><b>{t.title}</b><StatusPill status={t.status} /></div>
      {t.description && <p className="small">{t.description}</p>}
      <div><Tags items={t.requiredSkills} /></div>
      <p className="small muted">Due {fmtDate(t.dueDate)}{isOverdue(t) && <b className="bad-text"> · overdue</b>} · {t.estimatedHours}h · priority {t.priority}</p>
      {t.assignmentReason && <p className="small muted">Why you: {t.assignmentReason}</p>}
      <div className="row gap">
        {t.status === 'todo' && <button className="btn sm" onClick={() => setStatus(t._id, 'in_progress')}>Start</button>}
        {t.status === 'in_progress' && <button className="btn sm" onClick={() => setStatus(t._id, 'done')}>Mark done</button>}
        {t.status === 'in_progress' && <button className="btn ghost sm" onClick={() => setStatus(t._id, 'todo')}>Pause</button>}
        {t.status === 'done' && <button className="btn ghost sm" onClick={() => setStatus(t._id, 'in_progress')}>Reopen</button>}
      </div>
    </article>
  );

  return (
    <main className="wrap">
      <header className="page-head"><div>
        <h1>Hi {user.name.split(' ')[0]} 👋</h1>
        <p className="muted">{tasks ? `${group('done').length} of ${tasks.length} tasks done · ${group('in_progress').length} in progress` : 'Loading your tasks…'}</p>
      </div></header>
      {tasks && tasks.length > 0 && <div className="bar big"><i style={{ width: `${(group('done').length / tasks.length) * 100}%` }} /></div>}
      <Flash msg={msg} />
      {tasks === null ? <p className="muted">Loading…</p> : tasks.length === 0 ? <p className="muted">Nothing assigned to you yet. Your manager's allocator will assign work that matches your skills.</p> : (
        <>
          <Section title="In progress" status="in_progress">{Card}</Section>
          <Section title="To do" status="todo">{Card}</Section>
          <Section title="Done" status="done">{Card}</Section>
        </>
      )}
    </main>
  );
}
