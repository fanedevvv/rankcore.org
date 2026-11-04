const mongoose = require("mongoose");

// Premium codes — generated from the owner panel (Codes tab), consumed by /redeem
const redeemSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  tier: {
    type: String,
    enum: ["basic", "pro", "elite"],
    default: "basic"
  },
  // How long the premium lasts once redeemed: daily | weekly | monthly | yearly | lifetime
  duration: {
    type: String,
    default: "monthly"
  },
  // Who the code is for: a user's account or the server it's redeemed in
  target: {
    type: String,
    enum: ["user", "guild"],
    default: "user"
  },
  note:      { type: String, default: null },
  createdBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  // Legacy fields from the original code format
  plan:      { type: String, default: null },
  expiresAt: { type: Date, default: null },
  redeemedBy: {
    type: [String],
    default: []
  }
});

const Redeem = mongoose.model("CreateRedeem", redeemSchema);

module.exports = Redeem;
