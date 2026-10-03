require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const automation = require('./services/automation');

mongoose.connect(process.env.MONGO_URI).then(() => {
  const port = process.env.PORT || 5003;
  app.listen(port, () => console.log(`WorkSync API on http://localhost:${port}`));
  automation.start(process.env.AUTO_ALLOCATE_MINUTES ?? 5);
  if (automation.state.intervalMinutes) console.log(`Auto-allocation every ${automation.state.intervalMinutes} min`);
}).catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
