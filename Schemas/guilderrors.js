const { Schema, model } = require('mongoose');

const guildErrorSchema = new Schema({
  guildId:   { type: String, required: true, index: true },
  level:     { type: String, enum: ['error', 'warn'], default: 'error' },
  source:    { type: String, default: 'unknown' },   // e.g. 'leveling', 'welcome', 'slash'
  message:   { type: String, required: true },
  stack:     { type: String, default: null },
  context:   { type: Schema.Types.Mixed, default: null },  // any extra data
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },  // TTL 7 days
});

module.exports = model('GuildError', guildErrorSchema);