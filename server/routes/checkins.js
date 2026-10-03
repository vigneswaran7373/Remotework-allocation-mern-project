const router = require('express').Router();
const mongoose = require('mongoose');
const CheckIn = require('../models/CheckIn');
const { protect, allow } = require('../middleware/auth');

router.use(protect);
const today = () => new Date().toLocaleDateString('en-CA');

// Employee: log (or update) a day's work. One check-in per day.
router.post('/', allow('employee'), async (req, res, next) => {
  try {
    const date = req.body.date || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date))) return res.status(400).json({ message: 'Invalid date' });
    if (date > today()) return res.status(400).json({ message: 'You cannot check in for a future date' });
    const hours = Number(req.body.hoursWorked);
    if (req.body.hoursWorked === undefined || req.body.hoursWorked === '' || !(hours >= 0 && hours <= 24)) return res.status(400).json({ message: 'Hours worked must be between 0 and 24' });
    const done = Number(req.body.tasksCompleted || 0);
    if (!(done >= 0 && done <= 100)) return res.status(400).json({ message: 'Tasks completed must be 0-100' });
    const doc = await CheckIn.findOneAndUpdate(
      { employee: req.user._id, date },
      { hoursWorked: hours, tasksCompleted: done, notes: String(req.body.notes || '').slice(0, 500) },
      { upsert: true, new: true, setDefaultsOnInsert: true });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

router.get('/mine', allow('employee'), async (req, res, next) => {
  try { res.json(await CheckIn.find({ employee: req.user._id }).sort({ date: -1 }).limit(30)); } catch (e) { next(e); }
});

// Manager: team check-ins (?employeeId=)
router.get('/', allow('manager'), async (req, res, next) => {
  try {
    const f = {};
    if (req.query.employeeId && mongoose.isValidObjectId(req.query.employeeId)) f.employee = req.query.employeeId;
    res.json(await CheckIn.find(f).populate('employee', 'name').sort({ date: -1 }).limit(200));
  } catch (e) { next(e); }
});

module.exports = router;
