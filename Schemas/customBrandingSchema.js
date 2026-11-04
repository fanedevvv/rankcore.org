"use strict";

const mongoose = require("mongoose");

/**
 * CustomBrandingSchema
 *
 * Stores the full custom branding setup for a guild.
 * The bot token is stored encrypted at rest (AES-256-GCM via CB_TOKEN_SECRET env var).
 */
const customBrandingSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },

  // ── Access ────────────────────────────────────────────────────────────────
  ownerId:   { type: String, required: true },
  grantedBy: { type: String, default: null },
  enabled:   { type: Boolean, default: false },

  // ── Bot token (encrypted) ─────────────────────────────────────────────────
  // Stored as "iv:authTag:ciphertext" — all hex-encoded.
  // NEVER expose this field in API responses.
  encryptedToken: { type: String, default: null, select: false },

  // Discord Application / Bot ID — safe to store plaintext
  botClientId: { type: String, default: null },
  workerPid:   { type: Number, default: null }, // PID of the current worker process; cleared on stop

  // Setup state: pending | active | error | disabled
  setupState: {
    type: String,
    enum: ["pending", "active", "error", "disabled"],
    default: "pending",
  },
  setupError: { type: String, default: null },

  // ── Branding fields ──────────────────────────────────────────────────────
  botName:    { type: String, default: null, maxlength: 32 },
  avatarUrl:  { type: String, default: null },
  embedColor: { type: String, default: null },
  footerText: { type: String, default: null, maxlength: 128 },
  statusText: { type: String, default: null, maxlength: 128 },
  statusType: {
    type: String,
    enum: ['playing', 'listening', 'watching', 'competing', 'custom',
           'Playing', 'Listening', 'Watching', 'Competing', null],
    default: null,
  },
  onlineStatus: {
    type: String,
    enum: ['online', 'idle', 'dnd', 'invisible', null],
    default: null,
  },

  // ── Alert channel ────────────────────────────────────────────────────────
  alertChannelId: { type: String, default: null },

  // ── Command visibility ────────────────────────────────────────────────────
  // Array of command names (from registeredCommands.json) that are disabled
  // for this guild's custom bot. Empty = all commands enabled.
  disabledCommands: { type: [String], default: [] },

  // ── Persistent startup cache ──────────────────────────────────────────────
  // Stored between worker restarts so we avoid hammering Discord on every
  // process restart with redundant REST calls.
  //
  // cmdHashGlobal / cmdHashGuild: stable JSON hashes of the last successfully
  //   registered command payloads. Compared on startup — if unchanged, we skip
  //   the PUT entirely (Discord command registration is heavily rate-limited).
  //
  // botCurrentUsername: the username that was last successfully PATCH'd to
  //   Discord. Seeded into the worker on startup so applyIdentity() skips the
  //   PATCH when botName hasn't changed. Discord rate-limits username edits
  //   to 2 per hour globally — skipping unnecessary PATCHes is critical.
  cmdHashGlobal:      { type: String, default: null },
  cmdHashGuild:       { type: String, default: null },
  botCurrentUsername: { type: String, default: null },

  // ── Timestamps ───────────────────────────────────────────────────────────
  grantedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

customBrandingSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("CustomBranding", customBrandingSchema);