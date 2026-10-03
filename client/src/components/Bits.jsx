export const Tags = ({ items = [] }) => <>{items.map((s) => <span className="tag" key={s}>{s}</span>)}</>;
export const Bar = ({ value, hot }) => (
  <div className={`bar ${hot ? 'hot' : ''}`}><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
);
export const StatusPill = ({ status }) => <span className={`pill ${status}`}>{String(status).replace(/_/g, ' ')}</span>;
export const Flash = ({ msg }) => (msg?.text ? <p className={`toast ${msg.type === 'error' ? 'error' : 'ok'}`}>{msg.text}</p> : null);

const hues = [160, 200, 260, 20, 330, 45, 180, 290];
export function Avatar({ name = '?', size = 36 }) {
  const h = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 55% 92%)`, color: `hsl(${h} 60% 28%)` }}>{initials}</span>;
}

export function ScoreRing({ value = 0, size = 64 }) {
  const r = 26, c = 2 * Math.PI * r;
  const color = value >= 75 ? 'var(--brand)' : value >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="ring" role="img" aria-label={`Score ${value}`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">{value}</text>
    </svg>
  );
}
