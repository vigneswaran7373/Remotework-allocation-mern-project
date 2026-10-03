const BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message || 'Something went wrong'); e.status = res.status; throw e; }
  return data;
}

export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const isOverdue = (t) => t.status !== 'done' && new Date(t.dueDate).getTime() + 86400000 < Date.now();
export const dateInput = (d) => new Date(d).toLocaleDateString('en-CA');
