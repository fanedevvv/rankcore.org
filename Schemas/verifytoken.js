'use strict';
const mongoose = require('mongoose');

/**
 * VerifyToken — one-time URL issued when user clicks the Discord button.
 * The token is a 48-byte random hex string stored ONLY as a SHA-256 hash.
 * The raw token is never persisted — only given to the user once via Discord DM / ephemeral.
 *
 * TTL: tokens expire after 10 minutes (enforced by both MongoDB TTL index and route logic).
 */
const VerifyTokenSchema = new mongoose.Schema({
  // SHA-256 hash of the raw token — safe to store, used for lookup
  tokenHash:  { type: String, required: true, unique: true, index: true },

  // Discord identifiers
  userId:     { type: String, required: true, index: true },
  guildId:    { type: String, required: true, index: true },

  // State
  used:       { type: Boolean, default: false },
  usedAt:     { type: Date,    default: null },
  usedIp:     { type: String,  default: null },  // raw IP stored temporarily for action decision, wiped after use

  // Result set after the gate page completes
  action:     { type: String,  default: null },   // PASSED | BLOCKED_VPN | BLOCKED_ALT | FLAGGED | KICKED | BANNED
  flagReasons:{ type: [String], default: [] },
  consentGiven:{ type: Boolean, default: false },

  // Expiry — MongoDB TTL index removes doc 10 min after createdAt
  createdAt:  { type: Date, default: Date.now, expires: 600 },
}, { collection: 'verify_tokens' });

module.exports = mongoose.model('VerifyToken', VerifyTokenSchema);