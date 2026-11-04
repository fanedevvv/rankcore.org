const mongoose = require("mongoose");

const christmasSchema = new mongoose.Schema({
  Guild: String,
  Enabled: Boolean,
  Channel: String,
  PingRole: String,
  LastSentDay: Number,
});

module.exports = mongoose.model("christmasCountdown", christmasSchema);
