import { useEffect, useState } from 'react';
import { Calendar, Clock, Lightbulb, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { api, dateInput, fmtDate, isOverdue } from '../api';
import { Avatar, Flash, Tags } from '../components/Bits.jsx';

const blank = () => ({ title: '', description: '', requiredSkills: '', estimatedHours: 4, priority: 3, dueDate: dateInput(Date.now() + 7 * 86400000), assigneeId: '', autoAssign: true });
const COLS = [
  ['unassigned', 'Unassigned', (t) => !t.assignee && t.status !== 'done'],
  ['todo', 'To do', (t) => t.assignee && t.status === 'todo'],
  ['in_progress', 'In progress', (t) => t.status === 'in_progress'],
  ['done', 'Done', (t) => t.status === 'done'],
];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank());
  const [msg, setMsg] = useState({});
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(null);
  const [sugg, setSugg] = useState([]);
  const err = (e) => setMsg({ type: 'error', text: e.message });

  const load = () => {
    api('/tasks').then(setTasks).catch(err);
    api('/employees').then((e) => setTeam(e.filter((x) => x.active))).catch(err);
  };
  useEffect(load, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function create(e) {
    e.preventDefault(); setMsg({});
    try {
      await api('/tasks', { method: 'POST', body: { ...form, estimatedHours: +form.estimatedHours, priority: +form.priority, assigneeId: form.assigneeId || undefined } });
      setForm(blank()); setShow(false); setMsg({ type: 'ok', text: 'Task created' }); load();
    } catch (x) { err(x); }
  }
  async function allocate() { setMsg({}); try { setResult(await api('/tasks/allocate', { method: 'POST' })); load(); } catch (x) { err(x); } }
  const assign = async (id, assigneeId) => { try { await api(`/tasks/${id}`, { method: 'PATCH', body: { assigneeId: assigneeId || null } }); load(); } catch (x) { err(x); } };
  const remove = async (id) => { if (confirm('Delete this task?')) try { await api(`/tasks/${id}`, { method: 'DELETE' }); load(); } catch (x) { err(x); } };
  async function suggest(id) {
    if (open === id) return setOpen(null);
    try { setSugg(await api(`/tasks/${id}/suggestions`)); setOpen(id); } catch (x) { err(x); }
  }

  const needle = q.trim().toLowerCase();
  const visible = tasks.filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.requiredSkills.some((s) => s.includes(needle)));

  return (
    <main className="wrap wide">
      <header className="page-head">
        <div><h1>Tasks</h1><p className="muted">{tasks.length} tasks · {tasks.filter((t) => !t.assignee && t.status !== 'done').length} waiting for an owner</p></div>
        <div className="head-actions">
          <label className="search"><Search size={16} /><input placeholder="Search tasks or skills" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="btn ghost" onClick={allocate}><Sparkles size={16} /> Auto-allocate</button>
          <button className="btn" onClick={() => setShow(true)}><Plus size={16} /> New task</button>
        </div>
      </header>
      <Flash msg={msg} />

      {result && (
        <div className="result">
          <div className="row"><b>{result.assigned.length} assigned · {result.unassigned.length} could not be assigned</b><button className="icon-btn" onClick={() => setResult(null)}><X size={16} /></button></div>
          {result.assigned.map((a) => <div key={a.taskId} className="small">✓ <b>{a.title}</b> → {a.employeeName} <span className="muted">· {a.reason}</span></div>)}
          {result.unassigned.map((a) => <div key={a.taskId} className="small bad-text">✗ <b>{a.title}</b>: {a.reason}</div>)}
        </div>
      )}

      <div className="board">
        {COLS.map(([key, title, test]) => {
          const items = visible.filter(test);
          return (
            <section className={`col ${key}`} key={key}>
              <h3>{title} <span className="count">{items.length}</span></h3>
              {items.map((t) => (
                <article key={t._id} className={`kcard p${t.priority}`}>
                  <div className="row top"><b>{t.title}</b><span className="prio">P{t.priority}</span></div>
                  <div><Tags items={t.requiredSkills} /></div>
                  <div className="meta">
                    <span className={isOverdue(t) ? 'bad-text' : ''}><Calendar size={13} /> {fmtDate(t.dueDate)}{isOverdue(t) && ' · overdue'}</span>
                    <span><Clock size={13} /> {t.estimatedHours}h</span>
                  </div>
                  {t.assignmentReason && <p className="reason">{t.autoAssigned ? 'Auto · ' : ''}{t.assignmentReason}</p>}
                  <div className="kfoot">
                    {t.assignee && <Avatar name={t.assignee.name} size={26} />}
                    <select value={t.assignee?._id || ''} disabled={t.status === 'done'} onChange={(e) => assign(t._id, e.target.value)}>
                      <option value="">Unassigned</option>
                      {team.map((m) => <option key={m.employeeId} value={m.employeeId}>{m.name}</option>)}
                    </select>
                    {t.status !== 'done' && <button className="icon-btn" title="Suggest best fit" onClick={() => suggest(t._id)}><Lightbulb size={16} /></button>}
                    <button className="icon-btn danger" title="Delete" onClick={() => remove(t._id)}><Trash2 size={16} /></button>
                  </div>
                  {open === t._id && (
                    <div className="suggest">
                      <b className="small">Best fit</b>
                      {sugg.map((c) => (
                        <div key={c.employeeId} className={`cand ${c.eligible ? '' : 'off'}`}>
                          <div><b>{c.name}</b> {c.eligible && <span className="pill on_track">{c.score}</span>}<div className="small muted">{c.reason}</div></div>
                          {c.eligible && <button className="btn sm" onClick={() => { assign(t._id, c.employeeId); setOpen(null); }}>Assign</button>}
                        </div>
                      ))}
                      {sugg.length === 0 && <p className="muted small">No employees yet.</p>}
                    </div>
                  )}
                </article>
              ))}
              {items.length === 0 && <p className="col-empty">Nothing here</p>}
            </section>
          );
        })}
      </div>

      {show && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setShow(false)}>
          <form className="modal" onSubmit={create}>
            <div className="row"><h2>New task</h2><button type="button" className="icon-btn" onClick={() => setShow(false)}><X size={18} /></button></div>
            <label>Title<input required autoFocus value={form.title} onChange={set('title')} placeholder="e.g. Build checkout API" /></label>
            <label>Required skills<input value={form.requiredSkills} onChange={set('requiredSkills')} placeholder="java, spring, sql" /></label>
            <label>Description<input value={form.description} onChange={set('description')} placeholder="Optional" /></label>
            <div className="two">
              <label>Hours<input type="number" step="0.25" min="0.25" max="200" value={form.estimatedHours} onChange={set('estimatedHours')} /></label>
              <label>Priority
                <select value={form.priority} onChange={set('priority')}>
                  <option value="5">5 – urgent</option><option value="4">4 – high</option><option value="3">3 – normal</option><option value="2">2 – low</option><option value="1">1 – minimal</option>
                </select>
              </label>
              <label>Due date<input type="date" required value={form.dueDate} onChange={set('dueDate')} /></label>
              <label>Assign to
                <select value={form.assigneeId} onChange={set('assigneeId')}>
                  <option value="">Let the system decide</option>
                  {team.map((m) => <option key={m.employeeId} value={m.employeeId}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <label className="check"><input type="checkbox" checked={form.autoAssign} onChange={set('autoAssign')} /> Auto-allocate right after creating</label>
            <div className="row gap end"><button type="button" className="btn ghost" onClick={() => setShow(false)}>Cancel</button><button className="btn">Create task</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
