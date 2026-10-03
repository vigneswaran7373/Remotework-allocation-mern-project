const router = require('express').Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const { protect, allow } = require('../middleware/auth');
const { norm, rank } = require('../services/allocator');
const { loadEmployees, allocateUnassigned } = require('../services/allocate');

router.use(protect);
const populate = (q) => q.populate('assignee', 'name email');
const bad = (res, message, code = 400) => res.status(code).json({ message });
const validId = (id) => mongoose.isValidObjectId(id);

function readFields(b, partial = false) {
  const out = {};
  if (b.title !== undefined || !partial) { if (!String(b.title || '').trim()) return { error: 'Title is required' }; out.title = String(b.title).trim(); }
  if (b.description !== undefined) out.description = String(b.description);
  if (b.requiredSkills !== undefined) out.requiredSkills = norm(Array.isArray(b.requiredSkills) ? b.requiredSkills : String(b.requiredSkills).split(','));
  if (b.estimatedHours !== undefined || !partial) {
    const h = Number(b.estimatedHours);
    if (!(h >= 0.25 && h <= 200)) return { error: 'Estimated hours must be between 0.25 and 200' };
    out.estimatedHours = h;
  }
  if (b.priority !== undefined) {
    const p = Number(b.priority);
    if (![1, 2, 3, 4, 5].includes(p)) return { error: 'Priority must be 1-5' };
    out.priority = p;
  }
  if (b.dueDate !== undefined || !partial) {
    const d = new Date(b.dueDate);
    if (!b.dueDate || isNaN(d)) return { error: 'A valid due date is required' };
    out.dueDate = d;
  }
  return { out };
}

// Employees see only their own tasks; managers see everything (?status= ?unassigned=1 ?assignee=)
router.get('/', async (req, res, next) => {
  try {
    const f = {};
    if (req.user.role === 'employee') f.assignee = req.user._id;
    else {
      if (req.query.unassigned === '1') f.assignee = null;
      else if (req.query.assignee && validId(req.query.assignee)) f.assignee = req.query.assignee;
    }
    if (['todo', 'in_progress', 'done'].includes(req.query.status)) f.status = req.query.status;
    res.json(await populate(Task.find(f).sort({ status: 1, priority: -1, dueDate: 1 })));
  } catch (e) { next(e); }
});

router.post('/', allow('manager'), async (req, res, next) => {
  try {
    const { out, error } = readFields(req.body);
    if (error) return bad(res, error);
    if (req.body.assigneeId) {
      if (!validId(req.body.assigneeId) || !(await User.findOne({ _id: req.body.assigneeId, role: 'employee', active: true }))) return bad(res, 'Unknown employee');
      out.assignee = req.body.assigneeId; out.assignmentReason = 'Assigned manually';
    }
    const t = await Task.create({ ...out, createdBy: req.user._id });
    if (req.body.autoAssign && !t.assignee) await allocateUnassigned();
    res.status(201).json(await populate(Task.findById(t._id)));
  } catch (e) { next(e); }
});

// Allocate every unassigned task with the smart allocator
router.post('/allocate', allow('manager'), async (_req, res, next) => {
  try { res.json(await allocateUnassigned()); } catch (e) { next(e); }
});

// Ranked candidates for one task (does not assign)
router.get('/:id/suggestions', allow('manager'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return bad(res, 'Task not found', 404);
    const t = await Task.findById(req.params.id);
    if (!t) return bad(res, 'Task not found', 404);
    const ranked = rank({ requiredSkills: t.requiredSkills, estimatedHours: t.estimatedHours }, await loadEmployees());
    res.json(ranked.map((r) => ({
      employeeId: r.employee.id, name: r.employee.name, eligible: r.ok, score: r.score ?? null,
      skillFit: r.skill ?? null, availability: r.availability ?? null, performance: r.performance ?? null,
      reason: r.ok ? r.reason : `Not eligible: ${r.why}`,
    })));
  } catch (e) { next(e); }
});

router.patch('/:id', allow('manager'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return bad(res, 'Task not found', 404);
    const t = await Task.findById(req.params.id);
    if (!t) return bad(res, 'Task not found', 404);
    const { out, error } = readFields(req.body, true);
    if (error) return bad(res, error);
    Object.assign(t, out);
    if ('assigneeId' in req.body) {
      if (req.body.assigneeId === null || req.body.assigneeId === '') {
        t.assignee = null; t.assignmentReason = null; t.assignmentScore = null; t.autoAssigned = false;
        if (t.status === 'in_progress') t.status = 'todo';
      } else {
        if (!validId(req.body.assigneeId) || !(await User.findOne({ _id: req.body.assigneeId, role: 'employee', active: true }))) return bad(res, 'Unknown employee');
        t.assignee = req.body.assigneeId; t.assignmentReason = 'Assigned manually'; t.assignmentScore = null; t.autoAssigned = false;
      }
    }
    await t.save();
    res.json(await populate(Task.findById(t._id)));
  } catch (e) { next(e); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return bad(res, 'Task not found', 404);
    const t = await Task.findById(req.params.id);
    if (!t) return bad(res, 'Task not found', 404);
    const isOwner = t.assignee && String(t.assignee) === String(req.user._id);
    if (req.user.role !== 'manager' && !isOwner) return bad(res, 'Not allowed', 403);
    const { status } = req.body;
    if (!['todo', 'in_progress', 'done'].includes(status)) return bad(res, 'Status must be todo, in_progress or done');
    if (!t.assignee && status !== 'todo') return bad(res, 'Assign the task before starting it');
    t.status = status;
    t.completedAt = status === 'done' ? new Date() : undefined;
    await t.save();
    res.json(await populate(Task.findById(t._id)));
  } catch (e) { next(e); }
});

router.delete('/:id', allow('manager'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return bad(res, 'Task not found', 404);
    const t = await Task.findByIdAndDelete(req.params.id);
    t ? res.json({ message: 'Task deleted' }) : bad(res, 'Task not found', 404);
  } catch (e) { next(e); }
});

module.exports = router;
