const User = require('../models/User');
const Task = require('../models/Task');
const { allocate } = require('./allocator');
const { performanceOf } = require('./metrics');

const DAY = 86400000;

/** Load active employees together with their current load and performance. */
async function loadEmployees() {
  const [emps, open, done] = await Promise.all([
    User.find({ role: 'employee', active: true }),
    Task.find({ assignee: { $ne: null }, status: { $ne: 'done' } }),
    Task.find({ assignee: { $ne: null }, status: 'done', completedAt: { $gte: new Date(Date.now() - 60 * DAY) } }),
  ]);
  return emps.map((e) => {
    const id = String(e._id);
    return {
      id, name: e.name, skills: e.skills, capacityHours: e.capacityHours,
      openHours: open.filter((t) => String(t.assignee) === id).reduce((a, t) => a + t.estimatedHours, 0),
      performance: performanceOf(done.filter((t) => String(t.assignee) === id)),
    };
  });
}

/** Allocate every unassigned, not-done task and save the result. */
async function allocateUnassigned({ auto = false } = {}) {
  const [employees, pending] = await Promise.all([loadEmployees(), Task.find({ assignee: null, status: { $ne: 'done' } })]);
  if (!pending.length) return { assigned: [], unassigned: [] };

  const byId = new Map(pending.map((t) => [String(t._id), t]));
  const result = allocate(pending.map((t) => ({
    id: String(t._id), requiredSkills: t.requiredSkills, estimatedHours: t.estimatedHours, priority: t.priority, dueDate: t.dueDate,
  })), employees);

  const names = new Map(employees.map((e) => [e.id, e.name]));
  const assigned = [];
  for (const a of result.assignments) {
    // Only claim the task if it is still unassigned (protects against two runs at once)
    const t = await Task.findOneAndUpdate({ _id: a.taskId, assignee: null },
      { assignee: a.employeeId, assignmentReason: a.reason, assignmentScore: a.score, autoAssigned: true }, { new: true });
    if (t) assigned.push({ taskId: a.taskId, title: t.title, employeeId: a.employeeId, employeeName: names.get(a.employeeId), score: a.score, reason: a.reason });
  }
  const unassigned = result.unassigned.map((u) => ({ taskId: u.taskId, title: byId.get(u.taskId)?.title, reason: u.reason }));
  return { assigned, unassigned, auto };
}

module.exports = { loadEmployees, allocateUnassigned };
