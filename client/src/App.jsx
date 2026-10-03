import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { CalendarCheck, ClipboardList, KanbanSquare, LayoutDashboard, LogOut, UserCircle, Users, Zap } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { Avatar } from './components/Bits.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Team from './pages/Team.jsx';
import MyTasks from './pages/MyTasks.jsx';
import CheckIn from './pages/CheckIn.jsx';
import Profile from './pages/Profile.jsx';

const NAV = {
  manager: [['/dashboard', 'Monitor', LayoutDashboard], ['/tasks', 'Tasks', KanbanSquare], ['/team', 'Team', Users]],
  employee: [['/my-tasks', 'My tasks', ClipboardList], ['/check-in', 'Daily check-in', CalendarCheck], ['/profile', 'Profile', UserCircle]],
};
const homeFor = (u) => (u?.role === 'manager' ? '/dashboard' : '/my-tasks');

function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <aside className="side">
      <div className="logo"><span className="logo-mark"><Zap size={18} /></span>WorkSync</div>
      <nav>
        {NAV[user.role].map(([to, label, Icon]) => (
          <NavLink key={to} to={to}><Icon size={18} /><span>{label}</span></NavLink>
        ))}
      </nav>
      <div className="me">
        <Avatar name={user.name} size={36} />
        <div><b>{user.name}</b><small>{user.role}</small></div>
        <button className="icon-btn" title="Log out" onClick={() => { logout(); nav('/login'); }}><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

const only = (role, user, el) => (user.role === role ? el : <Navigate to={homeFor(user)} replace />);

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="pad muted">Loading…</p>;
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  return (
    <div className="shell">
      <Sidebar />
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to={homeFor(user)} replace />} />
          <Route path="/login" element={<Navigate to={homeFor(user)} replace />} />
          <Route path="/register" element={<Navigate to={homeFor(user)} replace />} />
          <Route path="/dashboard" element={only('manager', user, <Dashboard />)} />
          <Route path="/tasks" element={only('manager', user, <Tasks />)} />
          <Route path="/team" element={only('manager', user, <Team />)} />
          <Route path="/my-tasks" element={only('employee', user, <MyTasks />)} />
          <Route path="/check-in" element={only('employee', user, <CheckIn />)} />
          <Route path="/profile" element={only('employee', user, <Profile />)} />
          <Route path="*" element={<p className="pad">Page not found.</p>} />
        </Routes>
      </div>
    </div>
  );
}
