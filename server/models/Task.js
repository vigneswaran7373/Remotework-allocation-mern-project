const { Schema, model } = require('mongoose');
const schema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  requiredSkills: { type: [String], default: [] },
  estimatedHours: { type: Number, required: true, min: 0.25, max: 200 },
  priority: { type: Number, default: 3, min: 1, max: 5 },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  assignmentReason: String,
  assignmentScore: Number,
  autoAssigned: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
}, { timestamps: true });
schema.index({ assignee: 1, status: 1 });
module.exports = model('Task', schema);
