const { Schema, model } = require('mongoose');
const schema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  hoursWorked: { type: Number, required: true, min: 0, max: 24 },
  tasksCompleted: { type: Number, default: 0, min: 0, max: 100 },
  notes: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });
schema.index({ employee: 1, date: 1 }, { unique: true }); // one check-in per person per day
module.exports = model('CheckIn', schema);
