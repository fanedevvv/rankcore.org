const mongoose = require('mongoose');

const reputationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  reps: { type: Number, default: 0 },
  highestRating: { type: String, default: "" },
  latestReason: { type: String, default: "No reason." }
});

module.exports = mongoose.model('Reputation', reputationSchema);