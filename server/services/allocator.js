/**
 * Smart task allocation (rule-based scoring, no external AI service).
 *
 *   score = 0.5 * skillFit + 0.3 * availability + 0.2 * performance
 *
 *   skillFit     share of the task's required skills the person has (0.5 if none required)
 *   availability share of weekly capacity still free after taking this task
 *   performance  on-time completion rate (0..1), 0.7 for people with no history
 *
 * Hard rules: the person must have at least one required skill and enough free hours.
 * Tasks are handled most-urgent first (priority, then due date) and every assignment
 * updates the person's load, so work spreads out instead of piling on one star.
 */
const WEIGHTS = { skill: 0.5, availability: 0.3, performance: 0.2 };
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const norm = (arr) => [...new Set((arr || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))];

function evaluate(task, emp, openHours) {
  const required = norm(task.requiredSkills);
  const have = new Set(norm(emp.skills));
  const matched = required.filter((s) => have.has(s));
  const free = emp.capacityHours - openHours;
  if (free < task.estimatedHours) return { ok: false, why: 'not enough free capacity' };
  if (required.length && matched.length === 0) return { ok: false, why: 'no matching skills' };

  const skill = required.length ? matched.length / required.length : 0.5;
  const availability = clamp((free - task.estimatedHours) / emp.capacityHours);
  const performance = clamp(emp.performance ?? 0.7);
  const score = WEIGHTS.skill * skill + WEIGHTS.availability * availability + WEIGHTS.performance * performance;
  const missing = required.filter((s) => !have.has(s));
  return {
    ok: true, score: round(score), skill: round(skill), availability: round(availability), performance: round(performance),
    reason: (matched.length ? `Has ${matched.join(', ')}` : 'General task')
      + (missing.length ? ` (missing ${missing.join(', ')})` : '')
      + `; ${Math.round(availability * 100)}% capacity free after this task`,
  };
}
const round = (n) => Math.round(n * 1000) / 1000;

/** Ranked candidates for one task (used for the "suggest" panel). */
function rank(task, employees) {
  return employees
    .map((e) => ({ employee: e, ...evaluate(task, e, e.openHours || 0) }))
    .sort((a, b) => (b.ok - a.ok) || ((b.score || 0) - (a.score || 0)));
}

/** Allocate many tasks. employees: [{id,name,skills,capacityHours,openHours,performance}] */
function allocate(tasks, employees) {
  const load = new Map(employees.map((e) => [e.id, e.openHours || 0]));
  const order = [...tasks].sort((a, b) => (b.priority - a.priority) || (new Date(a.dueDate) - new Date(b.dueDate)));
  const assignments = [], unassigned = [];

  for (const t of order) {
    let best = null; const whys = new Set();
    for (const e of employees) {
      const r = evaluate(t, e, load.get(e.id));
      if (!r.ok) { whys.add(r.why); continue; }
      if (!best || r.score > best.score) best = { ...r, employee: e };
    }
    if (!best) {
      unassigned.push({ taskId: t.id, reason: employees.length ? `Nobody qualifies (${[...whys].join(' / ')})` : 'No employees available' });
      continue;
    }
    load.set(best.employee.id, load.get(best.employee.id) + t.estimatedHours);
    assignments.push({ taskId: t.id, employeeId: best.employee.id, score: best.score, reason: best.reason,
      breakdown: { skillFit: best.skill, availability: best.availability, performance: best.performance } });
  }
  return { assignments, unassigned };
}

module.exports = { allocate, rank, evaluate, norm, WEIGHTS };
