const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  aiModerationEnabled: {
    type: Boolean,
    default: false,
  },
  toxicityThreshold: {
    type: Number,
    default: 0.7,  // default threshold for AI moderation
  },
  modLogChannelId: {
    type: String,
    default: null,
  },
  aiModerationAction: {
    type: String,
    enum: ['delete', 'warn', 'mute', 'log'],
    default: 'delete',
  },

  // ── Staff List ────────────────────────────────────────────────────────────
  staffList: {
    channelId:    { type: String, default: null },
    title:        { type: String, default: 'Staff List' },
    color:        { type: String, default: '#6C53FF' },
    footer:       { type: String, default: '' },
    intro:        { type: String, default: '' },
    autoUpdate:   { type: Boolean, default: false },
    showJoinDate: { type: Boolean, default: true },
    showStatus:   { type: Boolean, default: true },
    inlineLayout: { type: Boolean, default: false },
    updateMode:   { type: String, default: 'edit' },
    tiers: [{
      name:   { type: String },
      roleId: { type: String },
      emoji:  { type: String, default: '' },
      _id:    false,
    }],
  },
  // Last staff list message the bot posted (kept outside staffList, which the dashboard overwrites on save)
  staffListMessage: {
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
  },

}, {
  timestamps: true,
});

module.exports = mongoose.model('GuildSettings', guildSettingsSchema);