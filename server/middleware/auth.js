const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  const h = req.headers.authorization || '';
  try {
    const { id } = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', process.env.JWT_SECRET);
    req.user = await User.findById(id).select('-password');
    if (!req.user || !req.user.active) return res.status(401).json({ message: 'Account unavailable' });
    next();
  } catch { res.status(401).json({ message: 'Please log in' }); }
};

exports.allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Not allowed' });
