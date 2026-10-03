import { useEffect, useState } from 'react';
import { api, dateInput, fmtDate } from '../api';
import { Flash } from '../components/Bits.jsx';

export default function CheckIn() {
  const [form, setForm] = useState({ date: dateInput(Date.now()), hoursWorked: '', tasksCompleted: 0, notes: '' });
  const [hist, setHist] = useState([]);
  const [msg, setMsg] = useState({});
  const load = () => api('/checkins/mine').then(setHist).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setMsg({});
    try {
      await api('/checkins', { method: 'POST', body: { ...form, hoursWorked: +form.hoursWorked, tasksCompleted: +form.tasksCompleted } });
      setMsg({ type: 'ok', text: 'Check-in saved' }); setForm({ ...form, hoursWorked: '', notes: '' }); load();
    } catch (x) { setMsg({ type: 'error', text: x.message }); }
  }

  return (
    <main className="wrap narrow">
      <h1>Daily check-in</h1>
      <p className="muted small">Log your day so your manager can spot blockers early. Submitting again for the same date updates it.</p>
      <form className="panel" onSubmit={submit}>
        <label>Date<input type="date" max={dateInput(Date.now())} value={form.date} onChange={set('date')} required /></label>
        <label>Hours worked<input type="number" step="0.5" min="0" max="24" required value={form.hoursWorked} onChange={set('hoursWorked')} /></label>
        <label>Tasks completed<input type="number" min="0" value={form.tasksCompleted} onChange={set('tasksCompleted')} /></label>
        <label>Notes / blockers<textarea rows="3" maxLength="500" value={form.notes} onChange={set('notes')} /></label>
        <Flash msg={msg} />
        <button className="btn wide">Save check-in</button>
      </form>
      <h3>Recent</h3>
      <div className="table-wrap">
        <table><tbody>
          {hist.map((c) => <tr key={c._id}><td><b>{fmtDate(c.date)}</b></td><td>{c.hoursWorked}h</td><td>{c.tasksCompleted} done</td><td className="small muted">{c.notes}</td></tr>)}
          {hist.length === 0 && <tr><td className="muted">No check-ins yet.</td></tr>}
        </tbody></table>
      </div>
    </main>
  );
}
