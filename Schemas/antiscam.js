const mongoose = require('mongoose');

const detectionConfigSchema = new mongoose.Schema({
  enabled:  { type: Boolean, default: true },
  action:   { type: String, default: 'delete', enum: ['delete', 'warn', 'mute', 'kick', 'ban'] },
  muteMinutes: { type: Number, default: 10 },
  threshold:{ type: Number, default: 0 },
}, { _id: false });

const warnStepSchema = new mongoose.Schema({
  count:  { type: Number, required: true },
  action: { type: String, required: true, enum: ['warn', 'mute', 'kick', 'ban'] },
  note:   { type: String, default: '' },
}, { _id: false });

const punishmentLogSchema = new mongoose.Schema({
  userId:    String,
  userTag:   String,
  type:      String,
  detail:    String,
  actionTaken: String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const antiScamSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },

  logChannelId: { type: String, default: null },
  globalAction: { type: String, default: 'delete', enum: ['delete', 'warn', 'mute', 'kick', 'ban'] },
  globalMuteMinutes: { type: Number, default: 10 },

  // Detection toggles with per-type action override
  detectPhishing:  { type: detectionConfigSchema, default: () => ({}) },
  detectFakeNitro: { type: detectionConfigSchema, default: () => ({}) },
  detectSuspiciousContent: { type: detectionConfigSchema, default: () => ({}) },
  detectNewAccounts: { type: detectionConfigSchema, default: () => ({}) },
  detectSuspiciousUsernames: { type: detectionConfigSchema, default: () => ({}) },

  // New account threshold (days)
  newAccountDays: { type: Number, default: 7 },

  // Heat-based probation system
  heatThreshold: { type: Number, default: 10 },
  heatDecayMinutes: { type: Number, default: 60 },
  heatValues: {
    noAvatar:      { type: Number, default: 3 },
    weirdName:     { type: Number, default: 5 },
    phishingLink:  { type: Number, default: 10 },
    suspiciousContent: { type: Number, default: 7 },
    repeatedOffence: { type: Number, default: 4 },
  },

  // Watchlist for custom scam domains/patterns
  customDomains:  { type: [String], default: [] },
  customPatterns: { type: [String], default: [] },

  // Warn escalation ladder
  warnSteps: { type: [warnStepSchema], default: [
    { count: 1, action: 'warn',  note: 'First offence' },
    { count: 3, action: 'mute',  note: '30m mute' },
    { count: 5, action: 'kick',  note: 'Repeated offences' },
    { count: 7, action: 'ban',   note: 'Persistent violations' },
  ]},

  // Exemptions
  whitelist:      { type: [String], default: [] },
  ignoredRoles:   { type: [String], default: [] },
  ignoredChannels:{ type: [String], default: [] },

  // Warn counter (per user)
  warns: { type: Map, of: Number, default: new Map() },

  punishmentLog: { type: [punishmentLogSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AntiScam', antiScamSchema);
