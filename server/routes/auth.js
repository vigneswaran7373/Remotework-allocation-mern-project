const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { norm } = require('../services/allocator');

const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, skills: u.skills, capacityHours: u.capacityHours });
const skillsOf = (v) => norm(Array.isArray(v) ? v : String(v || '').split(','));

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, skills } = req.body;
    if (!name?.trim() || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
    const u = await User.create({ name, email, skills: skillsOf(skills), password: await bcrypt.hash(password, 10), role: 'employee' });
    res.status(201).json({ token: sign(u), user: pub(u) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
    if (!u || !u.active || !(await bcrypt.compare(req.body.password || '', u.password)))
      return res.status(401).json({ message: 'Invalid email or password' });
    res.json({ token: sign(u), user: pub(u) });
  } catch (e) { next(e); }
});

router.get('/me', protect, (req, res) => res.json({ user: pub(req.user) }));

// Update own profile (skills / capacity feed the allocator)
router.patch('/me', protect, async (req, res, next) => {
  try {
    const { name, skills, capacityHours } = req.body;
    if (name !== undefined) { if (!name.trim()) return res.status(400).json({ message: 'Name cannot be empty' }); req.user.name = name; }
    if (skills !== undefined) req.user.skills = skillsOf(skills);
    if (capacityHours !== undefined) {
      const c = Number(capacityHours);
      if (!(c >= 1 && c <= 80)) return res.status(400).json({ message: 'Capacity must be 1-80 hours/week' });
      req.user.capacityHours = c;
    }
    await req.user.save();
    res.json({ user: pub(req.user) });
  } catch (e) { next(e); }
});

module.exports = router;
