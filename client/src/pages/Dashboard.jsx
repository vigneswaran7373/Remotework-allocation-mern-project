import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Flame, Gauge, Inbox, Pause, Play, Zap } from 'lucide-react';
import { api, fmtDate } from '../api';
import { useAuth } from '../auth.jsx';
import { Avatar, Bar, Flash, ScoreRing, StatusPill, Tags } from '../components/Bits.jsx';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [auto, setAuto] = useState(null);
  const [msg, setMsg] = useState({});
  const load = () => Promise.all([api('/monitor'), api('/monitor/automation')])
    .then(([m, a]) => { setData(m); setAuto(a); }).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);

  const toggle = async () => { try { setAuto(await api('/monitor/automation', { method: 'PATCH', body: { enabled: !auto.enabled } })); } catch (e) { setMsg({ type: 'error', text: e.message }); } };
  const runNow = async () => {
    try { const r = await api('/monitor/automation/run', { method: 'POST' }); setMsg({ type: 'ok', text: `Automation ran: ${r.assigned} assigned, ${r.stillUnassigned} still unassigned.` }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  if (!data) return <main className="wrap"><Flash msg={msg} />{!msg.text && <p className="muted">Loading…</p>}</main>;
  const s = data.summary;
  const cards = [
    ['Team score', s.averageScore ?? '—', Gauge, ''], ['Need attention', s.needAttention, AlertTriangle, s.needAttention ? 'warn' : ''],
    ['Overloaded', s.overloaded, Flame, s.overloaded ? 'bad' : ''], ['Overdue tasks', s.overdueTasks, Clock, s.overdueTasks ? 'bad' : ''],
    ['Unassigned', s.unassignedTasks, Inbox, s.unassignedTasks ? 'warn' : ''],
  ];

  return (
    <main className="wrap">
      <header className="page-head"><div><h1>{greet()}, {user.name.split(' ')[0]}</h1><p className="muted">Here's how your team is doing right now.</p></div></header>
      <Flash msg={msg} />
      <div className="cards">{cards.map(([l, v, Icon, c]) => <div key={l} className={`stat ${c}`}><span className="stat-icon"><Icon size={18} /></span><b>{v}</b><span>{l}</span></div>)}</div>

      <section className="auto-card">
        <span className="auto-icon"><Zap size={20} /></span>
        <div className="auto-text">
          <b>Auto-allocation {auto.enabled ? 'is on' : 'is paused'}</b>
          <p>{auto.intervalMinutes ? `New tasks are assigned every ${auto.intervalMinutes} min.` : 'Background schedule is off.'} {auto.lastRun ? `Last run ${new Date(auto.lastRun).toLocaleTimeString()}.` : 'Has not run yet.'} {auto.totalAutoAssigned} auto-assigned so far.</p>
        </div>
        <button className="btn ghost light" onClick={toggle}>{auto.enabled ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Resume</>}</button>
        <button className="btn light-solid" onClick={runNow}>Run now</button>
      </section>

      <h2 className="section-title">Team</h2>
      {data.employees.length === 0 && <p className="empty">No employees yet. Add some on the Team page.</p>}
      <div className="emp-grid">
        {data.employees.map((e) => (
          <article className="emp" key={e.employeeId}>
            <div className="emp-top">
              <Avatar name={e.name} size={40} />
              <div><b>{e.name}</b><small>{e.openTasks} open · {e.completedLast30} done in 30d</small></div>
              <StatusPill status={e.status} />
            </div>
            <div className="emp-mid">
              <ScoreRing value={e.score} />
              <div className="emp-load">
                <div className="row"><span className="small muted">Workload</span><b className="small">{Math.round(e.utilization * 100)}%</b></div>
                <Bar value={e.utilization * 100} hot={e.utilization > 0.9} />
                <span className="small muted">{e.openHours}h of {e.capacityHours}h</span>
              </div>
            </div>
            <div><Tags items={e.skills} /></div>
            <div className="chips">
              {e.flags.length ? e.flags.map((f) => <span key={f} className="chip warn"><AlertTriangle size={12} /> {f}</span>) : <span className="chip ok">All good</span>}
            </div>
            <div className="emp-foot">
              <span>Check-in: {e.lastCheckIn ? fmtDate(e.lastCheckIn) : 'never'}</span>
              <span>{e.onTimeRate !== null ? `${Math.round(e.onTimeRate * 100)}% on time` : 'No history'}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
