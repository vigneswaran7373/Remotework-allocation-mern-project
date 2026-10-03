import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { Flash } from '../components/Bits.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, skills: user.skills.join(', '), capacityHours: user.capacityHours });
  const [msg, setMsg] = useState({});
  async function save(e) {
    e.preventDefault(); setMsg({});
    try { const d = await api('/auth/me', { method: 'PATCH', body: { ...f, capacityHours: +f.capacityHours } }); setUser(d.user); setMsg({ type: 'ok', text: 'Profile saved' }); }
    catch (x) { setMsg({ type: 'error', text: x.message }); }
  }
  return (
    <main className="wrap narrow">
      <h1>My profile</h1>
      <p className="muted small">Your skills and weekly capacity decide which tasks the allocator can give you.</p>
      <form className="panel" onSubmit={save}>
        <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Skills (comma separated)<input value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></label>
        <label>Weekly capacity (hours)<input type="number" min="1" max="80" value={f.capacityHours} onChange={(e) => setF({ ...f, capacityHours: e.target.value })} /></label>
        <Flash msg={msg} />
        <button className="btn wide">Save</button>
      </form>
    </main>
  );
}
