const { Schema, model } = require("mongoose");

const rateLimitSchema = new Schema({
ipHash: { type: String, required: true, unique: true },
ipEnc: { type: String, default: null, select: false },
count: { type: Number, default: 1 },
first: { type: Date, default: Date.now },
blockedUntil: { type: Date, default: null },
strikes: { type: Number, default: 0 },
banned: { type: Boolean, default: false },
});

module.exports = model("RateLimit", rateLimitSchema);
