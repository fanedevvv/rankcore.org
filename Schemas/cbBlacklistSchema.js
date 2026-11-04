const mongoose = require("mongoose");

const cbBlacklistSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  reason: { type: String, default: "No reason provided" },
  blacklistedBy: { type: String, default: null },
  blacklistedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CbBlacklist", cbBlacklistSchema);
