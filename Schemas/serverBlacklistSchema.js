const mongoose = require("mongoose");

const serverBlacklistSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  reason: { type: String, default: "No reason provided" },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ServerBlacklist", serverBlacklistSchema);
