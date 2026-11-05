'use strict';
const { model, Schema } = require('mongoose');

const levelSetupSchema = new Schema({
  Guild:               String,
  Disabled:            String,   // 'disabled' | 'enabled'

  // Notification
  NotificationChannel: String,
  notifyMode:          { type: String, default: 'channel' }, // 'channel' | 'dm' | 'both' | 'none'

  // XP settings
  xpMin:    { type: Number, default: 8  },
  xpMax:    { type: Number, default: 18 },
  cooldown: { type: Number, default: 60 }, // seconds between XP gains

  // XP multiplier role (legacy single-role — kept for backwards compat)
  Role:  String,
  Multi: String,

  // Multiple multiplier roles: [{ roleId, multiplier }]
  xpMultipliers: { type: Array, default: [] },

  // Blacklisted channels (no XP earned)
  blacklistedChannels: { type: [String], default: [] },

  // Blacklisted roles (members with these roles earn no XP)
  blacklistedRoles: { type: [String], default: [] },

  // Stack roles (keep all previous level roles) vs replace
  stackRoles: { type: Boolean, default: true },

  // Level-up message customisation
  levelUpMessage:      { type: String, default: '<:boost:1567796953599836280> {user} just reached **Level {level}**!' },
  embedColor:          { type: String, default: '#6C53FF' },
  embedTitle:          { type: String, default: 'Level Up!' },
  embedFooter:         { type: String, default: '' },
  useEmbed:            { type: Boolean, default: true },
  showProgress:        { type: Boolean, default: true },  // show XP bar in embed
  pingOnLevelUp:       { type: Boolean, default: true },  // mention user in message

  // Leaderboard channel (auto-updated embed)
  leaderboardChannelId: { type: String, default: null },
  leaderboardMessageId: { type: String, default: null },
}, { timestamps: true });

module.exports = model('levelsetup', levelSetupSchema);
