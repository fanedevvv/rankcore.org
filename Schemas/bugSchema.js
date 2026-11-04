const mongoose = require("mongoose");

const bugSchema = new mongoose.Schema({
  title: String,
  description: String,
  severity: String,
  reportedBy: String,
  createdAt: Date,
});

module.exports = mongoose.model("Bug", bugSchema);
