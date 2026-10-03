require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Task = require('./models/Task');
const CheckIn = require('./models/CheckIn');

const DAY = 86400000;
const ymd = (d) => new Date(d).toLocaleDateString('en-CA');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany({}), Task.deleteMany({}), CheckIn.deleteMany({})]);
  const pw = await bcrypt.hash('password123', 10);

  await User.create({ name: 'Maya Manager', email: 'manager@work.com', password: pw, role: 'manager' });
  const [asha, ravi, meera, karan] = await User.create([
    { name: 'Asha Rao', email: 'asha@work.com', password: pw, skills: ['java', 'spring', 'sql', 'rest apis'], capacityHours: 40 },
    { name: 'Ravi Kumar', email: 'ravi@work.com', password: pw, skills: ['react', 'javascript', 'css', 'node.js'], capacityHours: 40 },
    { name: 'Meera Iyer', email: 'meera@work.com', password: pw, skills: ['mongodb', 'node.js', 'express', 'sql'], capacityHours: 32 },
    { name: 'Karan Patel', email: 'karan@work.com', password: pw, skills: ['docker', 'aws', 'linux', 'git'], capacityHours: 40 },
  ]);

  const now = Date.now();
  const due = (days) => new Date(now + days * DAY);
  // history: finished tasks (drives performance score)
  await Task.create([
    { title: 'Login module', requiredSkills: ['react'], estimatedHours: 6, dueDate: due(-8), status: 'done', assignee: ravi._id, completedAt: due(-9) },
    { title: 'Orders API', requiredSkills: ['java'], estimatedHours: 8, dueDate: due(-6), status: 'done', assignee: asha._id, completedAt: due(-7) },
    { title: 'Schema design', requiredSkills: ['mongodb'], estimatedHours: 5, dueDate: due(-8), status: 'done', assignee: meera._id, completedAt: due(-9) },
    { title: 'Server hardening', requiredSkills: ['linux'], estimatedHours: 6, dueDate: due(-12), status: 'done', assignee: karan._id, completedAt: due(-6) }, // late
  ]);
  // current work: one overdue task for Karan, rest unassigned so you can try the allocator
  await Task.create([
    { title: 'Set up CI pipeline', requiredSkills: ['docker', 'git'], estimatedHours: 8, priority: 4, dueDate: due(-1), status: 'in_progress', assignee: karan._id, assignmentReason: 'Assigned manually' },
    { title: 'Build customer REST API', description: 'Endpoints for orders', requiredSkills: ['java', 'spring', 'rest apis'], estimatedHours: 14, priority: 5, dueDate: due(3) },
    { title: 'Admin dashboard UI', requiredSkills: ['react', 'css'], estimatedHours: 12, priority: 3, dueDate: due(7) },
    { title: 'Reporting queries', requiredSkills: ['sql'], estimatedHours: 6, priority: 2, dueDate: due(6) },
    { title: 'Deploy to AWS', requiredSkills: ['aws', 'docker'], estimatedHours: 10, priority: 4, dueDate: due(5) },
    { title: 'Mongo indexing review', requiredSkills: ['mongodb'], estimatedHours: 5, priority: 3, dueDate: due(8) },
    { title: 'Write user guide', requiredSkills: [], estimatedHours: 4, priority: 1, dueDate: due(14) },
  ]);

  // 7 days of check-ins; Karan's activity fades out to demonstrate monitoring
  const rows = { [asha._id]: [8, 8, 7.5, 8, 8], [ravi._id]: [7, 8, 8, 7.5, 8], [meera._id]: [6, 6, 7, 6, 6], [karan._id]: [8, 6, 4, 0] };
  for (const [id, hours] of Object.entries(rows)) {
    for (let i = 0; i < hours.length; i++) {
      if (hours[i] === 0) continue;
      await CheckIn.create({ employee: id, date: ymd(now - (hours.length - i + (id === String(karan._id) ? 2 : 0)) * DAY), hoursWorked: hours[i], tasksCompleted: hours[i] > 6 ? 2 : 1 });
    }
  }
  console.log('Seeded. Password for all: password123');
  console.log('Manager: manager@work.com | Employees: asha@, ravi@, meera@, karan@work.com');
  process.exit(0);
})();
