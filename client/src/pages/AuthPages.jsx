import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const homeFor = (u) => (u.role === 'manager' ? '/dashboard' : '/my-tasks');

function Shell({ children }) {
  return (
    <div className="auth">
      <section className="auth-brand">
        <div className="logo"><span className="logo-mark"><Zap size={18} /></span>WorkSync</div>
        <h1>Give every task to the right person.</h1>
        <p>Smart allocation and live monitoring for remote teams.</p>
        <ul>
          <li><Sparkles size={18} /> Tasks auto-assigned by skills, capacity and track record</li>
          <li><BarChart3 size={18} /> Productivity scores and early warnings for managers</li>
          <li><Zap size={18} /> Daily check-ins that take 30 seconds</li>
        </ul>
      </section>
      <main className="auth-form">{children}</main>
    </div>
  );
}

function Form({ title, sub, fields, onSubmit, footer, quick }) {
  const [vals, setVals] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <div className="auth-card">
        <h2>{title}</h2>
        <p className="muted">{sub}</p>
        {quick && (
          <div className="quick">
            <span className="small muted">Try a demo account:</span>
            {quick.map(([label, email]) => <button type="button" key={email} className="chip-btn" onClick={() => setVals({ email, password: 'password123' })}>{label}</button>)}
          </div>
        )}
        <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await onSubmit(vals); } catch (x) { setErr(x.message); } finally { setBusy(false); } }}>
          {fields.map(([name, label, type = 'text', req = true]) => (
            <label key={name}>{label}
              <input type={type} required={req} value={vals[name] || ''} onChange={(e) => setVals({ ...vals, [name]: e.target.value })} />
            </label>
          ))}
          {err && <p className="form-error">{err}</p>}
          <button className="btn wide" disabled={busy}>{busy ? 'Please wait…' : title}</button>
        </form>
        <p className="muted small center">{footer}</p>
      </div>
    </Shell>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  return <Form title="Log in" sub="Welcome back. Sign in to continue." fields={[['email', 'Email', 'email'], ['password', 'Password', 'password']]}
    quick={[['Manager', 'manager@work.com'], ['Employee', 'ravi@work.com']]}
    onSubmit={async (v) => nav(homeFor(await login(v.email, v.password)))}
    footer={<>New employee? <Link to="/register">Create an account</Link></>} />;
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  return <Form title="Sign up" sub="Join your team's workspace as an employee."
    fields={[['name', 'Full name'], ['email', 'Email', 'email'], ['skills', 'Skills (comma separated)', 'text', false], ['password', 'Password (6+ characters)', 'password']]}
    onSubmit={async (v) => { await register(v); nav('/my-tasks'); }}
    footer={<>Already registered? <Link to="/login">Log in</Link></>} />;
}
