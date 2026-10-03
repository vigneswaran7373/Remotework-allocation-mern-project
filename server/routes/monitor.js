const router = require('express').Router();
const User = require('../models/User');
const Task = require('../models/Task');
const CheckIn = require('../models/CheckIn');
const automation = require('../services/automation');
const { allocateUnassigned } = require('../services/allocate');
const { protect, allow } = require('../middleware/auth');
const { computeMetrics } = require('../services/metrics');

router.use(protect, allow('manager'));

// Team monitoring dashboard
router.get('/', async (_req, res, next) => {
  try {
    const [emps, tasks, checkins] = await Promise.all([
      User.find({ role: 'employee', active: true }).sort({ name: 1 }), Task.find(), CheckIn.find()]);
    const employees = emps.map((e) => computeMetrics(e, tasks, checkins));
    const open = tasks.filter((t) => t.status !== 'done');
    res.json({
      summary: {
        employees: employees.length,
        averageScore: employees.length ? Math.round(employees.reduce((a, e) => a + e.score, 0) / employees.length) : null,
        needAttention: employees.filter((e) => e.status !== 'on_track').length,
        overloaded: employees.filter((e) => e.utilization > 1).length,
        overdueTasks: employees.reduce((a, e) => a + e.overdueTasks, 0),
        unassignedTasks: open.filter((t) => !t.assignee).length,
        openTasks: open.length, doneTasks: tasks.length - open.length,
      },
      employees,
    });
  } catch (e) { next(e); }
});

router.get('/automation', (_req, res) => res.json(automation.state));
router.patch('/automation', (req, res) => {
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ message: 'enabled (true/false) required' });
  automation.state.enabled = req.body.enabled;
  res.json(automation.state);
});
router.post('/automation/run', async (_req, res, next) => {
  try { res.json(await automation.run('manual')); } catch (e) { next(e); }
});

module.exports = router;
