const { model, Schema } = require("mongoose");

const warnEntrySchema = new Schema({
  CaseNumber:  { type: String, default: null },
  ExecuterId:  { type: String, required: true },
  ExecuterTag: { type: String, required: true },
  Reason:      { type: String, default: "No reason provided" },
  Severity:    { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
  Timestamp:   { type: Date, default: Date.now },
  Active:      { type: Boolean, default: true },
});

const warningSchema = new Schema({
  GuildID:   { type: String, required: true, index: true },
  UserID:    { type: String, required: true, index: true },
  UserTag:   { type: String },
  Content:   { type: [warnEntrySchema], default: [] },
});

warningSchema.index({ GuildID: 1, UserID: 1 });

module.exports = model("warnTutorial", warningSchema);
