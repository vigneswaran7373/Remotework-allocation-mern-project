const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allocate, rank, evaluate } = require('../services/allocator');
const { computeMetrics, performanceOf } = require('../services/metrics');

const E = (id, skills, cap = 40, open = 0, perf = 0.8) => ({ id, name: id, skills, capacityHours: cap, openHours: open, performance: perf });
const T = (id, req, hrs = 8, priority = 3, days = 5) => ({ id, requiredSkills: req, estimatedHours: hrs, priority, dueDate: new Date(Date.now() + days * 86400000) });
const team = [E('asha', ['java', 'sql']), E('ravi', ['react', 'css']), E('meera', ['mongodb', 'sql'], 20)];

test('matches tasks to the right skills', () => {
  const r = allocate([T('t1', ['java']), T('t2', ['react', 'css']), T('t3', ['mongodb'])], team);
  const got = Object.fromEntries(r.assignments.map((a) => [a.taskId, a.employeeId]));
  assert.deepEqual(got, { t1: 'asha', t2: 'ravi', t3: 'meera' });
  assert.equal(r.unassigned.length, 0);
});

test('never exceeds capacity and explains why a task is unassigned', () => {
  const r = allocate([T('big', ['java'], 45)], team);
  assert.equal(r.assignments.length, 0);
  assert.match(r.unassigned[0].reason, /capacity/);
});

test('no matching skill -> unassigned', () => {
  const r = allocate([T('x', ['cobol'])], team);
  assert.match(r.unassigned[0].reason, /no matching skills/);
});

test('spreads load: second sql task goes to the less loaded person', () => {
  const r = allocate([T('a', ['sql'], 30), T('b', ['sql'], 15)], [E('asha', ['sql'], 40), E('meera', ['sql'], 40)]);
  assert.equal(new Set(r.assignments.map((a) => a.employeeId)).size, 2);
});

test('urgent tasks are placed first when capacity is tight', () => {
  const r = allocate([T('low', ['java'], 30, 1), T('urgent', ['java'], 30, 5)], [E('asha', ['java'], 40)]);
  assert.equal(r.assignments.length, 1); assert.equal(r.assignments[0].taskId, 'urgent');
  assert.equal(r.unassigned[0].taskId, 'low');
});

test('better performer wins a tie; partial skill coverage scores lower', () => {
  const r = allocate([T('t', ['java'])], [E('slow', ['java'], 40, 0, 0.3), E('fast', ['java'], 40, 0, 0.95)]);
  assert.equal(r.assignments[0].employeeId, 'fast');
  const full = evaluate(T('t', ['java', 'sql']), E('a', ['java', 'sql']), 0);
  const half = evaluate(T('t', ['java', 'sql']), E('b', ['java']), 0);
  assert.ok(full.score > half.score); assert.match(half.reason, /missing sql/);
});

test('task with no required skills goes to someone; empty teams handled', () => {
  assert.equal(allocate([T('g', [])], team).assignments.length, 1);
  assert.equal(allocate([T('g', [])], []).unassigned[0].reason, 'No employees available');
  assert.deepEqual(allocate([], team), { assignments: [], unassigned: [] });
});

test('rank puts ineligible candidates last', () => {
  const r = rank(T('t', ['java']), team);
  assert.equal(r[0].employee.id, 'asha'); assert.equal(r[1].ok, false);
});

// ---- metrics ----
const DAY = 86400000;
const ymd = (d) => new Date(d).toLocaleDateString('en-CA');
const emp = { _id: 'u1', name: 'U', skills: [], capacityHours: 40 };
const task = (o) => ({ assignee: 'u1', estimatedHours: 8, status: 'todo', dueDate: new Date(Date.now() + 3 * DAY), ...o });

test('metrics: healthy employee is on track', () => {
  const now = new Date();
  const ci = [0, 1, 2, 3, 4].map((i) => ({ employee: 'u1', date: ymd(now - i * DAY), hoursWorked: 8 }));
  const m = computeMetrics(emp, [task({}), task({ status: 'done', completedAt: new Date(now - DAY), dueDate: new Date(now + DAY) })], ci, now);
  assert.equal(m.status, 'on_track'); assert.equal(m.score, 100); assert.deepEqual(m.flags, []);
});

test('metrics: overdue, overload, silence and long days are flagged', () => {
  const now = new Date();
  const tasks = [task({ estimatedHours: 30, dueDate: new Date(now - 3 * DAY) }), task({ estimatedHours: 20 })];
  const ci = [{ employee: 'u1', date: ymd(now - 4 * DAY), hoursWorked: 12 }];
  const m = computeMetrics(emp, tasks, ci, now);
  assert.ok(m.flags.some((f) => /overdue/.test(f)));
  assert.ok(m.flags.some((f) => /Overloaded/.test(f)));
  assert.ok(m.flags.some((f) => /No check-in for 4 days/.test(f)));
  assert.ok(m.flags.some((f) => /burnout/.test(f)));
  assert.notEqual(m.status, 'on_track');
});

test('metrics: no data and performance helper', () => {
  const m = computeMetrics(emp, [], [], new Date());
  assert.ok(m.flags.includes('No check-ins yet'));
  assert.equal(performanceOf([]), 0.7);
  const late = { completedAt: new Date(), dueDate: new Date(Date.now() - 5 * DAY) };
  const ok = { completedAt: new Date(), dueDate: new Date(Date.now() + DAY) };
  assert.equal(performanceOf([late, ok]), 0.5);
});
