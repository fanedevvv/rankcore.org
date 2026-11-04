const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  achievements: { type: [String], default: [] }, // Array of achievement IDs or names
});

module.exports = mongoose.model("Achievement", achievementSchema);
