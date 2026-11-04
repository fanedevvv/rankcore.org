'use strict';
const { Schema, model } = require('mongoose');
const crypto = require('crypto');

/**
 * Staff Recovery Key System
 * ─────────────────────────────────────────────────────────────────────────────
 * Each guild can generate a one-time recovery key that lets a trusted person
 * restore bot configuration or bypass a locked-out admin situation.
 *
 * Keys are stored as bcrypt-style SHA-256 hashes — the plain text is only
 * shown once at generation time and never stored.
 *
 * Workflow:
 *   1. A guild admin runs /recovery-key generate
 *   2. Bot DMs them the plain-text key (shown ONCE only)
 *   3. Key hash + metadata saved in this schema
 *   4. If locked out, run /recovery-key use <key> to grant emergency access
 *   5. Key is consumed (single-use) and a new one must be generated
 */

const staffRecoveryKeySchema = new Schema({
  guildId:     { type: String, required: true, unique: true },

  // Hashed key (SHA-256 hex) — never store plain text
  keyHash:     { type: String, default: null },

  // Who generated it and when
  generatedBy: { type: String, default: null },   // user ID
  generatedAt: { type: Date,   default: null },

  // Expiry — null means no expiry
  expiresAt:   { type: Date, default: null },

  // Whether the key has been used
  used:        { type: Boolean, default: false },
  usedBy:      { type: String, default: null },
  usedAt:      { type: Date,   default: null },

  // Key metadata set at generation time
  label:        { type: String, default: 'Recovery Key' },
  assignedUser: { type: String, default: null },  // user ID the key is locked to
  roles:        { type: [String], default: [] },  // roles to grant on use

  // Per-guild settings for the recovery system
  settings: {
    defaultExpiry:  { type: Number, default: 48 },     // hours
    alertChannelId: { type: String, default: null },
    logUsage:       { type: Boolean, default: true },
    revokeOnUse:    { type: Boolean, default: true },
    dmKey:          { type: Boolean, default: true },
  },

  // Audit log of all key events
  auditLog: [{
    action:    { type: String },   // 'generated' | 'used' | 'revoked' | 'rotated'
    userId:    { type: String },
    timestamp: { type: Date, default: Date.now },
    note:      { type: String, default: '' },
    _id: false,
  }],
}, { timestamps: true });

/**
 * Hash a plain-text key using SHA-256.
 * @param {string} plain
 * @returns {string} hex digest
 */
staffRecoveryKeySchema.statics.hashKey = function (plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
};

/**
 * Generate a cryptographically random recovery key string.
 * Format: ROCO-XXXX-XXXX-XXXX (Base36 blocks, easy to type)
 * @returns {string} plain-text key
 */
staffRecoveryKeySchema.statics.generatePlainKey = function () {
  const block = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `ROCO-${block()}-${block()}-${block()}`;
};

/**
 * Verify a plain-text key against the stored hash.
 * @param {string} plain
 * @returns {boolean}
 */
staffRecoveryKeySchema.methods.verifyKey = function (plain) {
  if (!this.keyHash) return false;
  const hash = require('crypto').createHash('sha256').update(plain).digest('hex');
  return hash === this.keyHash;
};

module.exports = model('StaffRecoveryKey', staffRecoveryKeySchema);