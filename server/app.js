require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/monitor', require('./routes/monitor'));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, _req, res, _next) => {
  if (!process.env.QUIET_ERRORS) console.error(err);
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors)[0].message });
  if (err.name === 'CastError') return res.status(404).json({ message: 'Not found' });
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

module.exports = app;
