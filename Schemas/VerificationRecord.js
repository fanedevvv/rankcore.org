'use strict';
/**
 * VerificationRecord.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores one document per unique IP (identified by HMAC blind-index).
 * Each document tracks every guild that IP has verified in.
 *
 * PRIVACY: Raw IPs and user IDs are NEVER stored in plaintext.
 *   • ipHmac / userIdHmac  — one-way HMAC-SHA256 blind-indexes for lookups
 *   • ipEnc / userIdEnc    — AES-256-GCM ciphertext (decrypt only when needed)
 *   • threatEnc            — AES-256-GCM ciphertext of the ip-api / vpnapi result
 *
 * This schema is required by ipverification.js. Without it, Record stays null
 * and the following features are silently disabled:
 *   • Dashboard stats (always return 0)
 *   • Alt account detection (blockAlts toggle has no effect)
 *   • Verification records table
 *   • IP ban threshold
 *   • Re-verification interval checks
 */

const mongoose = require('mongoose');

// ── Sub-schema: one entry per guild per verification attempt ─────────────────

const GuildEntrySchema = new mongoose.Schema({
  // Blind-index of guildId (for fast lookup without exposing the value)
  guildIdHmac:  { type: String, required: true, index: true },

  // Encrypted guildId (for display / action purposes after auth)
  guildIdEnc:   { type: String, default: null },

  // Plaintext guildId for GDPR unverify fallback (guild IDs are public, not PII)
  guildId:      { type: String, default: null },

  // When this guild entry was created
  verifiedAt:   { type: Date, default: Date.now },

  // Result of the verification attempt
  // PASSED | BLOCKED_VPN | BLOCKED_ALT | BLOCKED_COUNTRY | BLOCKED_IP_BAN
  // FLAGGED | MANUAL_APPROVE | MANUAL_BAN
  action:       { type: String, default: 'PASSED' },

  // List of reasons the action was triggered (e.g. ['vpn_detected', 'high_risk_85'])
  flagReasons:  { type: [String], default: [] },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const VerificationRecordSchema = new mongoose.Schema({
  // ── IP identity (blind-indexed, never plaintext) ──────────────────────────
  ipHmac:     { type: String, required: true, index: true },   // HMAC of the IP
  ipEnc:      { type: String, required: true },                // AES-GCM of { ip }

  // ── User identity (blind-indexed, never plaintext) ────────────────────────
  userIdHmac: { type: String, required: true, index: true },   // HMAC of userId
  userIdEnc:  { type: String, required: true },                // AES-GCM of userId

  // ── IP intelligence payload from ip-api / vpnapi (encrypted) ─────────────
  // Stores: country, countryCode, city, isp, isVpn, isProxy, isTor,
  //         isHosting, riskScore, provider, etc.
  threatEnc:  { type: String, default: null },

  // ── Guild verification history ────────────────────────────────────────────
  // One entry per verification attempt (across all guilds for this IP)
  guilds:     { type: [GuildEntrySchema], default: [] },

  // ── Timestamps ────────────────────────────────────────────────────────────
  firstSeen:  { type: Date, default: Date.now },
  lastSeen:   { type: Date, default: Date.now },

}, {
  collection: 'verification_records',
  timestamps: false, // manual firstSeen/lastSeen for control
});

// ── Compound index: fast lookup of "has this IP been seen in this guild?" ────
VerificationRecordSchema.index({ ipHmac: 1, 'guilds.guildIdHmac': 1 });
VerificationRecordSchema.index({ userIdHmac: 1, 'guilds.guildIdHmac': 1 });

module.exports = mongoose.model('VerificationRecord', VerificationRecordSchema);
