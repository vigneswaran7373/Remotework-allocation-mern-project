import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api('/auth/me').then((d) => setUser(d.user)).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);

  const finish = (d) => { localStorage.setItem('token', d.token); setUser(d.user); return d.user; };
  const login = async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (form) => finish(await api('/auth/register', { method: 'POST', body: form }));
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return <Ctx.Provider value={{ user, setUser, ready, login, register, logout }}>{children}</Ctx.Provider>;
}
