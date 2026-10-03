const { Schema, model } = require('mongoose');
module.exports = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['manager', 'employee'], default: 'employee' },
  skills: { type: [String], default: [] },          // stored lowercase
  capacityHours: { type: Number, default: 40, min: 1, max: 80 }, // weekly capacity
  active: { type: Boolean, default: true },
}, { timestamps: true }));
