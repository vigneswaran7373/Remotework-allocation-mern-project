process.env.JWT_SECRET = 'test-secret';
process.env.QUIET_ERRORS = '1';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const Task = require('../models/Task');
const automation = require('../services/automation');

const URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/worksync_test';
const server = app.listen(0);
const api = request(server);
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
let mgr, asha, ravi, ashaId, raviId;

before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), require('../models/CheckIn').init()]);
  await User.create({ name: 'Boss', email: 'boss@t.com', password: await bcrypt.hash('secret123', 4), role: 'manager' });
  mgr = (await api.post('/api/auth/login').send({ email: 'boss@t.com', password: 'secret123' })).body.token;
});
after(async () => { automation.stop(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); });

test('auth: register, duplicate, validation, login, profile', async () => {
  assert.equal((await api.post('/api/auth/register').send({ email: 'a@t.com' })).status, 400);
  assert.equal((await api.post('/api/auth/register').send({ name: 'A', email: 'a@t.com', password: '12' })).status, 400);
  const r = await api.post('/api/auth/register').send({ name: 'Asha', email: 'asha@t.com', password: 'secret123', skills: 'Java, SQL ,java' });
  assert.equal(r.status, 201); assert.equal(r.body.user.role, 'employee'); assert.deepEqual(r.body.user.skills, ['java', 'sql']);
  asha = r.body.token; ashaId = r.body.user.id;
  assert.equal((await api.post('/api/auth/register').send({ name: 'X', email: 'ASHA@t.com', password: 'secret123' })).status, 409);
  assert.equal((await api.post('/api/auth/login').send({ email: 'asha@t.com', password: 'nope' })).status, 401);
  assert.equal((await api.get('/api/auth/me')).status, 401);
  const p = await api.patch('/api/auth/me').set(auth(asha)).send({ skills: ['Java', 'Spring'], capacityHours: 30 });
  assert.deepEqual(p.body.user.skills, ['java', 'spring']); assert.equal(p.body.user.capacityHours, 30);
  assert.equal((await api.patch('/api/auth/me').set(auth(asha)).send({ capacityHours: 500 })).status, 400);
});

test('manager creates employees; employees cannot use manager routes', async () => {
  assert.equal((await api.get('/api/employees').set(auth(asha))).status, 403);
  assert.equal((await api.post('/api/employees').set(auth(mgr)).send({ name: 'R', email: 'r@t.com' })).status, 400);
  const r = await api.post('/api/employees').set(auth(mgr)).send({ name: 'Ravi', email: 'ravi@t.com', password: 'secret123', skills: 'react,css', capacityHours: 40 });
  assert.equal(r.status, 201); raviId = r.body.id;
  ravi = (await api.post('/api/auth/login').send({ email: 'ravi@t.com', password: 'secret123' })).body.token;
  assert.equal((await api.post('/api/employees').set(auth(mgr)).send({ name: 'R', email: 'ravi@t.com', password: 'secret123' })).status, 409);
  const list = await api.get('/api/employees').set(auth(mgr));
  assert.equal(list.body.length, 2); assert.ok('score' in list.body[0] && 'utilization' in list.body[0]);
  assert.equal((await api.patch(`/api/employees/${raviId}`).set(auth(mgr)).send({ skills: 'react,css,node.js' })).body.skills.length, 3);
  assert.equal((await api.patch('/api/employees/bad-id').set(auth(mgr)).send({})).status, 404);
});

let t1, t2, t3;
test('task creation validates input', async () => {
  const ok = { title: 'REST API', requiredSkills: 'java,spring', estimatedHours: 10, priority: 5, dueDate: day(3) };
  assert.equal((await api.post('/api/tasks').set(auth(asha)).send(ok)).status, 403);
  assert.equal((await api.post('/api/tasks').set(auth(mgr)).send({ ...ok, title: ' ' })).status, 400);
  assert.equal((await api.post('/api/tasks').set(auth(mgr)).send({ ...ok, estimatedHours: 0 })).status, 400);
  assert.equal((await api.post('/api/tasks').set(auth(mgr)).send({ ...ok, priority: 9 })).status, 400);
  assert.equal((await api.post('/api/tasks').set(auth(mgr)).send({ ...ok, dueDate: 'soon' })).status, 400);
  t1 = (await api.post('/api/tasks').set(auth(mgr)).send(ok)).body._id;
  t2 = (await api.post('/api/tasks').set(auth(mgr)).send({ title: 'UI', requiredSkills: ['react', 'css'], estimatedHours: 8, dueDate: day(5) })).body._id;
  t3 = (await api.post('/api/tasks').set(auth(mgr)).send({ title: 'Cobol', requiredSkills: ['cobol'], estimatedHours: 2, dueDate: day(5) })).body._id;
  assert.ok(t1 && t2 && t3);
  assert.equal((await api.get('/api/tasks?unassigned=1').set(auth(mgr))).body.length, 3);
});

test('suggestions rank eligible people first', async () => {
  const s = (await api.get(`/api/tasks/${t1}/suggestions`).set(auth(mgr))).body;
  assert.equal(s[0].name, 'Asha'); assert.equal(s[0].eligible, true);
  assert.equal(s.find((x) => x.name === 'Ravi').eligible, false);
  assert.equal((await api.get('/api/tasks/nope/suggestions').set(auth(mgr))).status, 404);
});

test('smart allocation assigns by skill and reports unassigned', async () => {
  const r = (await api.post('/api/tasks/allocate').set(auth(mgr))).body;
  assert.equal(r.assigned.length, 2); assert.equal(r.unassigned.length, 1);
  assert.match(r.unassigned[0].reason, /no matching skills/);
  const byTitle = Object.fromEntries(r.assigned.map((a) => [a.title, a.employeeName]));
  assert.deepEqual(byTitle, { 'REST API': 'Asha', UI: 'Ravi' });
  assert.equal((await Task.findById(t1)).autoAssigned, true);
  assert.equal((await api.post('/api/tasks/allocate').set(auth(mgr))).body.assigned.length, 0); // idempotent
});

test('employees see only their tasks and update status; others cannot', async () => {
  const mine = (await api.get('/api/tasks').set(auth(asha))).body;
  assert.equal(mine.length, 1); assert.equal(mine[0].title, 'REST API');
  assert.equal((await api.patch(`/api/tasks/${t1}/status`).set(auth(ravi)).send({ status: 'done' })).status, 403);
  assert.equal((await api.patch(`/api/tasks/${t1}/status`).set(auth(asha)).send({ status: 'weird' })).status, 400);
  assert.equal((await api.patch(`/api/tasks/${t3}/status`).set(auth(mgr)).send({ status: 'in_progress' })).status, 400); // unassigned
  const go = await api.patch(`/api/tasks/${t1}/status`).set(auth(asha)).send({ status: 'in_progress' });
  assert.equal(go.body.status, 'in_progress');
});

test('manual assignment / unassignment by manager', async () => {
  const a = await api.patch(`/api/tasks/${t3}`).set(auth(mgr)).send({ assigneeId: raviId });
  assert.equal(a.body.assignee._id, raviId); assert.equal(a.body.assignmentReason, 'Assigned manually');
  assert.equal((await api.patch(`/api/tasks/${t3}`).set(auth(mgr)).send({ assigneeId: new mongoose.Types.ObjectId() })).status, 400);
  const u = await api.patch(`/api/tasks/${t3}`).set(auth(mgr)).send({ assigneeId: null });
  assert.equal(u.body.assignee, null);
  assert.equal((await api.patch(`/api/tasks/${t3}`).set(auth(mgr)).send({ priority: 0 })).status, 400);
  assert.equal((await api.patch(`/api/tasks/${t3}`).set(auth(mgr)).send({ title: 'Cobol migration' })).body.title, 'Cobol migration');
});

test('check-ins: validation, upsert per day, history', async () => {
  assert.equal((await api.post('/api/checkins').set(auth(mgr)).send({ hoursWorked: 5 })).status, 403);
  assert.equal((await api.post('/api/checkins').set(auth(asha)).send({})).status, 400);
  assert.equal((await api.post('/api/checkins').set(auth(asha)).send({ hoursWorked: 30 })).status, 400);
  assert.equal((await api.post('/api/checkins').set(auth(asha)).send({ hoursWorked: 5, date: day(2) })).status, 400);
  assert.equal((await api.post('/api/checkins').set(auth(asha)).send({ hoursWorked: 6, tasksCompleted: 1, notes: 'api work' })).status, 201);
  await api.post('/api/checkins').set(auth(asha)).send({ hoursWorked: 8, tasksCompleted: 2 }); // same day -> update
  const hist = (await api.get('/api/checkins/mine').set(auth(asha))).body;
  assert.equal(hist.length, 1); assert.equal(hist[0].hoursWorked, 8);
  assert.equal((await api.get('/api/checkins').set(auth(mgr))).body.length, 1);
  assert.equal((await api.get('/api/checkins').set(auth(asha))).status, 403);
});

test('completing a task and the monitor dashboard', async () => {
  assert.equal((await api.patch(`/api/tasks/${t1}/status`).set(auth(asha)).send({ status: 'done' })).body.status, 'done');
  assert.ok((await Task.findById(t1)).completedAt);
  const m = (await api.get('/api/monitor').set(auth(mgr))).body;
  assert.equal(m.summary.employees, 2); assert.equal(m.summary.doneTasks, 1); assert.equal(m.summary.unassignedTasks, 1);
  const a = m.employees.find((e) => e.name === 'Asha'); const r = m.employees.find((e) => e.name === 'Ravi');
  assert.equal(a.completedLast30, 1); assert.equal(a.onTimeRate, 1);
  assert.ok(r.flags.includes('No check-ins yet'));
  assert.equal((await api.get('/api/monitor').set(auth(asha))).status, 403);
});

test('overdue work is flagged on the dashboard', async () => {
  await Task.updateOne({ _id: t2 }, { dueDate: new Date(Date.now() - 4 * 86400000) });
  const r = (await api.get('/api/monitor').set(auth(mgr))).body.employees.find((e) => e.name === 'Ravi');
  assert.equal(r.overdueTasks, 1); assert.ok(r.flags.some((f) => /overdue/.test(f)));
  assert.ok(r.score < 100);
});

test('automation: manual run, toggle, scheduled run assigns new tasks', async () => {
  assert.equal((await api.get('/api/monitor/automation').set(auth(mgr))).body.enabled, true);
  assert.equal((await api.patch('/api/monitor/automation').set(auth(mgr)).send({ enabled: 'yes' })).status, 400);
  const nt = (await api.post('/api/tasks').set(auth(mgr)).send({ title: 'More UI', requiredSkills: 'css', estimatedHours: 3, dueDate: day(4) })).body._id;
  const run = (await api.post('/api/monitor/automation/run').set(auth(mgr))).body;
  assert.equal(run.assigned, 1); assert.equal((await Task.findById(nt)).autoAssigned, true);
  // scheduled job
  automation.state.totalAutoAssigned = 0;
  await api.post('/api/tasks').set(auth(mgr)).send({ title: 'CSS fix', requiredSkills: 'css', estimatedHours: 1, dueDate: day(4) });
  automation.start(0.0005); // ~30ms
  await new Promise((r) => setTimeout(r, 400));
  automation.stop();
  assert.ok(automation.state.totalAutoAssigned >= 1, 'scheduler should have assigned the new task');
  // disabled => no scheduled work
  await api.patch('/api/monitor/automation').set(auth(mgr)).send({ enabled: false });
  await api.post('/api/tasks').set(auth(mgr)).send({ title: 'Idle css', requiredSkills: 'css', estimatedHours: 1, dueDate: day(4) });
  automation.start(0.0005); await new Promise((r) => setTimeout(r, 300)); automation.stop();
  assert.equal((await api.get('/api/tasks?unassigned=1').set(auth(mgr))).body.filter((t) => t.title === 'Idle css').length, 1);
  await api.patch('/api/monitor/automation').set(auth(mgr)).send({ enabled: true });
});

test('deactivating an employee returns their open tasks to the pool and blocks login', async () => {
  const before = (await api.get('/api/tasks?unassigned=1').set(auth(mgr))).body.length;
  const r = await api.delete(`/api/employees/${raviId}`).set(auth(mgr));
  assert.equal(r.status, 200); assert.ok(r.body.tasksReturnedToPool >= 1);
  assert.ok((await api.get('/api/tasks?unassigned=1').set(auth(mgr))).body.length > before);
  assert.equal((await api.post('/api/auth/login').send({ email: 'ravi@t.com', password: 'secret123' })).status, 401);
  assert.equal((await api.get('/api/auth/me').set(auth(ravi))).status, 401);
});

test('delete task and 404s', async () => {
  assert.equal((await api.delete(`/api/tasks/${t3}`).set(auth(mgr))).status, 200);
  assert.equal((await api.delete(`/api/tasks/${t3}`).set(auth(mgr))).status, 404);
  assert.equal((await api.get('/api/nothing')).status, 404);
});
