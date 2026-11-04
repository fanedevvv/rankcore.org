'use strict';

/**
 * Schemas/connectionRoleSchema.js
 *
 * Stores per-guild Connection Roles — Discord roles automatically assigned
 * when members link specific platform accounts (Twitch, YouTube, Steam, etc.).
 *
 * One document per guild, with a connectionRoles array.
 */

const mongoose = require('mongoose');

const connectionRoleEntrySchema = new mongoose.Schema({
  platform:   { type: String, required: true, enum: ['twitch', 'youtube', 'spotify', 'steam', 'github', 'reddit', 'custom'] },
  roleId:     { type: String, required: true },
  condition:  { type: String, default: 'connected', enum: ['connected', 'subscribed', 'username'] },
  username:   { type: String, default: null },
  autoRemove: { type: Boolean, default: true },
}, { timestamps: true });

const connectionRoleSchema = new mongoose.Schema({
  guildId:         { type: String, required: true, unique: true, index: true },
  connectionRoles: { type: [connectionRoleEntrySchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('ConnectionRole', connectionRoleSchema);