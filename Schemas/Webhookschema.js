const { Schema, model } = require("mongoose");

const webhookSchema = new Schema({
  channelId: { type: String, required: true, unique: true },
  guildId:   { type: String, required: true },
  webhookId:    { type: String, required: true },
  webhookToken: { type: String, required: true, select: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = model("Webhook", webhookSchema);