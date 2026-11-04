'use strict';
/**
 * validationschema.js  (Schemas/validationschema.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Full schema for IP Verification config.
 *
 * IMPORTANT: This schema now includes ALL fields used by:
 *   • dashboard/routes/Security/ipverification.js  (save / load / stats)
 *   • dashboard/views/ipverify.html
 *
 * Missing fields were being silently dropped by Mongoose's strict mode,
 * meaning settings saved in the dashboard had no effect at runtime.
 * All previously-missing fields are now included with correct defaults.
 */

const mongoose = require('mongoose');

const verifySchema = new mongoose.Schema({

  // ── Identity ──────────────────────────────────────────────────────────────
  Guild:          { type: String, required: true, unique: true },

  // ── Panel appearance ──────────────────────────────────────────────────────
  Channel:        { type: String, default: '' },
  Role:           { type: String, default: '' },
  unverifiedRole: { type: String, default: '' },
  additionalRoles:{ type: String, default: '' }, // comma-separated role IDs
  MessageContent: { type: String, default: 'Click the button below to verify!' },
  Message:        { type: String, default: '' },
  Color:          { type: String, default: '#6C53FF' },
  Thumbnail:      { type: String, default: '' },
  Image:          { type: String, default: '' },
  Footer:         { type: String, default: '' },
  LastPanelSent:  { type: Date,   default: null },
  buttonLabel:    { type: String, default: 'Verify' },
  buttonStyle:    { type: Number, default: 3, enum: [1, 2, 3, 4] },

  // Legacy captcha list (used by Systems/verification.js)
  Verified:       [String],

  // ── Logging ───────────────────────────────────────────────────────────────
  logChannel:     { type: String, default: '' },
  alertOnFlag:    { type: Boolean, default: true },

  // ── Fail action (hard block: VPN / alt / country / IP ban) ───────────────
  failAction:     { type: String, default: 'none', enum: ['none','kick','ban','alert','log'] },
  failMessage:    { type: String, default: '' },

  // ── Flagged action (soft/risk-scored) ────────────────────────────────────
  flaggedAction:  { type: String, default: 'alert', enum: ['none','kick','ban','alert','log'] },
  flaggedMessage: { type: String, default: '' },

  // ── VPN / proxy detection ─────────────────────────────────────────────────
  blockVpn:           { type: Boolean, default: false },
  blockProxy:         { type: Boolean, default: false },
  blockTor:           { type: Boolean, default: false },
  blockHosting:       { type: Boolean, default: false },
  vpnRiskThreshold:   { type: Number,  default: 70, min: 0, max: 100 },

  // ── Alt detection ─────────────────────────────────────────────────────────
  blockAlts:          { type: Boolean, default: false },

  // ── Account age gate ──────────────────────────────────────────────────────
  requireAccountAge:  { type: Boolean, default: false },
  minAccountAgeDays:  { type: Number,  default: 7, min: 1 },

  // ── Country filter ────────────────────────────────────────────────────────
  countryMode:        { type: String, default: 'off', enum: ['off','allowlist','blocklist'] },
  countryList:        { type: String, default: '' }, // comma-separated ISO-3166 codes

  // ── Token TTL ─────────────────────────────────────────────────────────────
  tokenTtlMinutes:    { type: Number, default: 10, enum: [5, 10, 15, 30] },

  // ── Per-IP caps ───────────────────────────────────────────────────────────
  maxAttemptsPerIp:   { type: Number, default: 0, min: 0 },
  ipBanThreshold:     { type: Number, default: 0, min: 0 },

  // ── Re-verification ───────────────────────────────────────────────────────
  requireReverify:    { type: Boolean, default: false },
  reverifyDays:       { type: Number,  default: 30, min: 1 },

  // ── Webhook ───────────────────────────────────────────────────────────────
  webhookUrl:         { type: String, default: '', select: false },
  webhookOnPass:      { type: Boolean, default: true },
  webhookOnFail:      { type: Boolean, default: true },

  // ── Gate page messages ────────────────────────────────────────────────────
  gateSuccessMessage: { type: String, default: '' },
  gateFailMessage:    { type: String, default: '' },

  // ── Consent ───────────────────────────────────────────────────────────────
  requireConsent:     { type: Boolean, default: true },
  consentText:        { type: String,  default: '' },

  // ── Custom log embeds ─────────────────────────────────────────────────────
  logPassTitle: { type: String, default: '' },
  logPassDesc:  { type: String, default: '' },
  logPassColor: { type: String, default: '' },
  logFailTitle: { type: String, default: '' },
  logFailDesc:  { type: String, default: '' },
  logFailColor: { type: String, default: '' },

}, {
  collection: 'verifications',
  timestamps: true,
});

module.exports = mongoose.model('Verify', verifySchema);