/** Productivity metrics for one employee, computed from tasks + daily check-ins. */
const DAY = 86400000;
const ymd = (d) => new Date(d).toLocaleDateString('en-CA');

function performanceOf(doneTasks) {
  if (!doneTasks.length) return 0.7;
  const onTime = doneTasks.filter((t) => t.completedAt && t.completedAt <= new Date(new Date(t.dueDate).getTime() + DAY - 1)).length;
  return onTime / doneTasks.length;
}

function computeMetrics(emp, tasks, checkins, now = new Date()) {
  const mine = tasks.filter((t) => String(t.assignee) === String(emp._id));
  const open = mine.filter((t) => t.status !== 'done');
  const openHours = open.reduce((a, t) => a + t.estimatedHours, 0);
  const overdue = open.filter((t) => new Date(t.dueDate).getTime() + DAY - 1 < now.getTime());
  const done30 = mine.filter((t) => t.status === 'done' && t.completedAt && now - t.completedAt <= 30 * DAY);
  const onTimeRate = done30.length ? performanceOf(done30) : null;

  const cutoff = ymd(new Date(now.getTime() - 6 * DAY));
  const recent = checkins.filter((c) => String(c.employee) === String(emp._id) && c.date >= cutoff);
  const avgHours = recent.length ? recent.reduce((a, c) => a + c.hoursWorked, 0) / recent.length : null;
  const last = checkins.filter((c) => String(c.employee) === String(emp._id)).map((c) => c.date).sort().pop() || null;
  const daysSince = last ? Math.floor((new Date(ymd(now)) - new Date(last)) / DAY) : null;

  const utilization = openHours / emp.capacityHours;
  const score = Math.round(100 * (
    0.4 * (onTimeRate ?? 1) +
    0.3 * Math.min(recent.length / 5, 1) +
    0.3 * (open.length ? 1 - overdue.length / open.length : 1)));

  const flags = [];
  if (overdue.length) flags.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);
  if (utilization > 1) flags.push(`Overloaded (${Math.round(utilization * 100)}% of capacity)`);
  else if (utilization > 0.9) flags.push(`Near capacity (${Math.round(utilization * 100)}%)`);
  if (last === null) flags.push('No check-ins yet');
  else if (daysSince >= 2) flags.push(`No check-in for ${daysSince} days`);
  if (avgHours !== null && avgHours > 10) flags.push(`Long days (avg ${avgHours.toFixed(1)}h) – burnout risk`);
  if (utilization < 0.2 && open.length === 0) flags.push('Free capacity – can take more work');

  return {
    employeeId: emp._id, name: emp.name, skills: emp.skills, capacityHours: emp.capacityHours,
    openTasks: open.length, openHours: Math.round(openHours * 10) / 10, utilization: Math.round(utilization * 100) / 100,
    overdueTasks: overdue.length, completedLast30: done30.length,
    onTimeRate: onTimeRate === null ? null : Math.round(onTimeRate * 100) / 100,
    checkinDays7: recent.length, avgHours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
    lastCheckIn: last, score, status: score >= 75 ? 'on_track' : score >= 50 ? 'at_risk' : 'needs_attention', flags,
    performance: onTimeRate ?? 0.7,
  };
}

module.exports = { computeMetrics, performanceOf };
