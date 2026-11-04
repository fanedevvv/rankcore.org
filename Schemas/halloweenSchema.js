const mongoose = require("mongoose");

const halloweenSchema = new mongoose.Schema({
  Guild: String,
  Enabled: Boolean,
  Channel: String,
  PingRole: String,
  LastSentDay: Number,
});

module.exports = mongoose.model("halloweenCountdown", halloweenSchema);
