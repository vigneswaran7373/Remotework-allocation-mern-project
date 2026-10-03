const router = require('express').Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const CheckIn = require('../models/CheckIn');
const { protect, allow } = require('../middleware/auth');
const { norm } = require('../services/allocator');
const { computeMetrics } = require('../services/metrics');

router.use(protect, allow('manager'));
const skillsOf = (v) => norm(Array.isArray(v) ? v : String(v || '').split(','));

router.get('/', async (_req, res, next) => {
  try {
    const [emps, tasks, checkins] = await Promise.all([
      User.find({ role: 'employee' }).sort({ name: 1 }), Task.find(), CheckIn.find()]);
    res.json(emps.map((e) => ({ ...computeMetrics(e, tasks, checkins), email: e.email, active: e.active })));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, skills, capacityHours } = req.body;
    if (!name?.trim() || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const cap = capacityHours === undefined || capacityHours === '' ? 40 : Number(capacityHours);
    if (!(cap >= 1 && cap <= 80)) return res.status(400).json({ message: 'Capacity must be 1-80 hours/week' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
    const u = await User.create({ name, email, skills: skillsOf(skills), capacityHours: cap, password: await bcrypt.hash(password, 10), role: 'employee' });
    res.status(201).json({ id: u._id, name: u.name, email: u.email, skills: u.skills, capacityHours: u.capacityHours });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Employee not found' });
    const u = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!u) return res.status(404).json({ message: 'Employee not found' });
    if (req.body.skills !== undefined) u.skills = skillsOf(req.body.skills);
    if (req.body.capacityHours !== undefined) {
      const c = Number(req.body.capacityHours);
      if (!(c >= 1 && c <= 80)) return res.status(400).json({ message: 'Capacity must be 1-80 hours/week' });
      u.capacityHours = c;
    }
    await u.save();
    res.json({ id: u._id, name: u.name, skills: u.skills, capacityHours: u.capacityHours });
  } catch (e) { next(e); }
});

// Deactivate: they can no longer log in and their open tasks go back to the pool
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Employee not found' });
    const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'employee' }, { active: false });
    if (!u) return res.status(404).json({ message: 'Employee not found' });
    const r = await Task.updateMany({ assignee: u._id, status: { $ne: 'done' } },
      { assignee: null, status: 'todo', assignmentReason: null, assignmentScore: null, autoAssigned: false });
    res.json({ message: 'Employee deactivated', tasksReturnedToPool: r.modifiedCount });
  } catch (e) { next(e); }
});

module.exports = router;
