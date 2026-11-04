// Schemas/moderationSchema.js
const mongoose = require("mongoose");

const moderationSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  logChannelId: { type: String, required: true },
  action: { type: String, enum: ["report", "delete", "warn", "mute", "ban"], default: "report" },
  threshold: { type: Number, default: 0.7 },
  immuneRoleIds: { type: [String], default: [] },
  pingRoleId: { type: String, default: null }, // <-- added pingRoleId
});

module.exports = mongoose.model("Moderation", moderationSchema);
