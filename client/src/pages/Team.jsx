import { useEffect, useState } from 'react';
import { api } from '../api';
import { Bar, Flash } from '../components/Bits.jsx';

export default function Team() {
  const [team, setTeam] = useState([]);
  const [edit, setEdit] = useState({});   // id -> {skills, capacityHours}
  const [form, setForm] = useState({ name: '', email: '', password: '', skills: '', capacityHours: 40 });
  const [msg, setMsg] = useState({});
  const err = (e) => setMsg({ type: 'error', text: e.message });
  const load = () => api('/employees').then((l) => setTeam(l.filter((x) => x.active))).catch(err);
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setMsg({});
    try { await api('/employees', { method: 'POST', body: { ...form, capacityHours: +form.capacityHours } }); setForm({ name: '', email: '', password: '', skills: '', capacityHours: 40 }); setMsg({ type: 'ok', text: 'Employee added' }); load(); }
    catch (x) { err(x); }
  }
  async function save(id) {
    try { await api(`/employees/${id}`, { method: 'PATCH', body: { skills: edit[id].skills, capacityHours: +edit[id].capacityHours } }); setEdit({ ...edit, [id]: undefined }); setMsg({ type: 'ok', text: 'Saved' }); load(); }
    catch (x) { err(x); }
  }
  async function remove(e) {
    if (!confirm(`Deactivate ${e.name}? Their open tasks return to the unassigned pool.`)) return;
    try { const r = await api(`/employees/${e.employeeId}`, { method: 'DELETE' }); setMsg({ type: 'ok', text: `${e.name} deactivated; ${r.tasksReturnedToPool} task(s) returned to the pool.` }); load(); }
    catch (x) { err(x); }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="wrap">
      <h1>Team</h1>
      <Flash msg={msg} />
      <form className="panel grid-form" onSubmit={add}>
        <input required placeholder="Full name" value={form.name} onChange={set('name')} />
        <input required type="email" placeholder="Email" value={form.email} onChange={set('email')} />
        <input required type="password" minLength="6" placeholder="Temporary password" value={form.password} onChange={set('password')} />
        <input type="number" min="1" max="80" placeholder="Hours/week" value={form.capacityHours} onChange={set('capacityHours')} />
        <input placeholder="Skills (comma separated)" value={form.skills} onChange={set('skills')} className="span3" />
        <button className="btn">Add employee</button>
      </form>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Skills</th><th>Capacity (h/wk)</th><th>Load</th><th /></tr></thead>
          <tbody>
            {team.map((m) => {
              const ed = edit[m.employeeId];
              return (
                <tr key={m.employeeId}>
                  <td><b>{m.name}</b><div className="small muted">{m.email}</div></td>
                  <td>{ed ? <input value={ed.skills} onChange={(e) => setEdit({ ...edit, [m.employeeId]: { ...ed, skills: e.target.value } })} /> : (m.skills.join(', ') || <span className="muted">none</span>)}</td>
                  <td>{ed ? <input type="number" min="1" max="80" value={ed.capacityHours} onChange={(e) => setEdit({ ...edit, [m.employeeId]: { ...ed, capacityHours: e.target.value } })} /> : m.capacityHours}</td>
                  <td><Bar value={m.utilization * 100} hot={m.utilization > 0.9} /><span className="small muted">{m.openHours}h open</span></td>
                  <td className="actions">
                    {ed ? <><button className="btn sm" onClick={() => save(m.employeeId)}>Save</button><button className="btn ghost sm" onClick={() => setEdit({ ...edit, [m.employeeId]: undefined })}>Cancel</button></>
                      : <><button className="btn ghost sm" onClick={() => setEdit({ ...edit, [m.employeeId]: { skills: m.skills.join(', '), capacityHours: m.capacityHours } })}>Edit</button>
                        <button className="btn ghost sm danger" onClick={() => remove(m)}>Deactivate</button></>}
                  </td>
                </tr>
              );
            })}
            {team.length === 0 && <tr><td colSpan="5" className="muted">No employees yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
