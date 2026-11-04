const { Schema, model } = require("mongoose");

const TTL_SECONDS = process.env.NODE_ENV === "production"
  ? 86400
  : 60;

const requestLogSchema = new Schema({
  method: { type: String, required: true, maxlength: 10 },
  status: { type: Number, required: true },
  duration: { type: Number, required: true },
  route: { type: String, required: true, maxlength: 200 },
  userId: { type: String, default: null },
  username: { type: String, default: null },
  ip: { type: String, default: null, select: false },
  webhookMessageId: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

requestLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: TTL_SECONDS }
);

const excludedUsersSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = {
  RequestLog: model("RequestLog", requestLogSchema),
  ExcludedUser: model("ExcludedUser", excludedUsersSchema),
};
