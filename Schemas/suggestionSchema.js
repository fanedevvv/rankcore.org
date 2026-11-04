"use strict";
const { Schema, model } = require("mongoose");

// ── Guild-level config (one doc per guild) ────────────────────────────────────
const suggestionConfigSchema = new Schema({
  guildId:            { type: String, required: true, unique: true, index: true },

  // ── Channels ────────────────────────────────────────────────────────────────
  channelId:          { type: String, default: null },   // main submission channel
  reviewChannelId:    { type: String, default: null },   // staged for mod review before going public
  approvedChannelId:  { type: String, default: null },   // forwarded when approved
  rejectedChannelId:  { type: String, default: null },   // logged when rejected
  logChannelId:       { type: String, default: null },   // mod audit log channel

  // ── Access control ──────────────────────────────────────────────────────────
  requiredRoleIds:    { type: [String], default: [] },   // roles needed to submit
  blockedRoleIds:     { type: [String], default: [] },   // roles that cannot submit
  staffRoleIds:       { type: [String], default: [] },   // roles that can approve/reject

  // ── Behaviour toggles ────────────────────────────────────────────────────────
  reviewMode:         { type: Boolean, default: false }, // send to review ch first, then post publicly on approve
  threadOnSuggest:    { type: Boolean, default: false }, // auto-create discussion thread
  dmOnResult:         { type: Boolean, default: true  }, // DM author on approve/reject
  allowEdit:          { type: Boolean, default: false }, // author can edit before votes
  requireReason:      { type: Boolean, default: false }, // mod must give reject reason
  anonymousMode:      { type: Boolean, default: false }, // hide author in embed
  selfVoteAllowed:    { type: Boolean, default: false }, // can author vote on own suggestion
  allowVoteChange:    { type: Boolean, default: true  }, // can users switch their vote

  // ── Limits ───────────────────────────────────────────────────────────────────
  cooldownSeconds:    { type: Number, default: 0     },
  minLength:          { type: Number, default: 0     },
  maxLength:          { type: Number, default: 1024  },
  maxActiveSuggestions: { type: Number, default: 0  }, // 0 = unlimited

  // ── Auto actions ─────────────────────────────────────────────────────────────
  autoApproveUpvotes: { type: Number, default: 0 },     // auto-approve when upvotes reach this (0 = off)
  autoRejectDownvotes:{ type: Number, default: 0 },     // auto-reject when downvotes reach this (0 = off)
  autoCloseHours:     { type: Number, default: 0 },     // auto-close voting after N hours (0 = off)

  // ── Notification pings ────────────────────────────────────────────────────────
  pingRoleId:         { type: String, default: null },  // role to ping on new suggestion

  // ── Stats ────────────────────────────────────────────────────────────────────
  totalSuggestions:   { type: Number, default: 0 },
  totalApproved:      { type: Number, default: 0 },
  totalRejected:      { type: Number, default: 0 },
}, { timestamps: true });

// ── Per-suggestion entry ──────────────────────────────────────────────────────
const suggestionEntrySchema = new Schema({
  guildId:      { type: String, required: true, index: true },
  channelId:    { type: String, required: true },
  messageId:    { type: String, required: true, index: true },
  authorId:     { type: String, required: true, index: true },
  content:      { type: String, default: "" },
  number:       { type: Number, default: 0 },     // suggestion #N in guild

  status: {
    type: String,
    enum: ["pending", "under_review", "approved", "rejected", "implemented", "duplicate"],
    default: "pending",
    index: true,
  },

  // ── Voting ───────────────────────────────────────────────────────────────────
  upvotes:      { type: Number, default: 0 },
  downvotes:    { type: Number, default: 0 },
  upvoterIds:   { type: [String], default: [] },
  downvoterIds: { type: [String], default: [] },

  // ── Review ───────────────────────────────────────────────────────────────────
  reviewMessageId:  { type: String, default: null },  // message in review channel
  resolvedBy:       { type: String, default: null },  // userId of mod who acted
  resolvedAt:       { type: Date,   default: null },
  rejectReason:     { type: String, default: null },
  implementedNote:  { type: String, default: null },

  // ── Thread ───────────────────────────────────────────────────────────────────
  threadId:     { type: String, default: null },
  closedAt:     { type: Date,   default: null },      // when voting closed
}, { timestamps: true });

// ── Per-user cooldown tracking ────────────────────────────────────────────────
const suggestionCooldownSchema = new Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  lastSentAt: { type: Date, default: Date.now },
}, { timestamps: false });
suggestionCooldownSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const SuggestionConfig   = model("SuggestionConfig",   suggestionConfigSchema);
const SuggestionEntry    = model("SuggestionEntry",    suggestionEntrySchema);
const SuggestionCooldown = model("SuggestionCooldown", suggestionCooldownSchema);

// Legacy model alias — keeps old Events/Others/suggestions.js working during migration
// (Old fields: GuildID, ChannelID, AuthorID, Msg, Upmembers, Downmembers, upvotes, downvotes)
const legacySchema = new Schema({
  GuildID:     String,
  ChannelID:   String,
  AuthorID:    String,
  Msg:         String,
  Upmembers:   Array,
  Downmembers: Array,
  upvotes:     Number,
  downvotes:   Number,
});
const SuggestionLegacy = model("suggestion", legacySchema);

module.exports = SuggestionConfig;
module.exports.SuggestionConfig   = SuggestionConfig;
module.exports.SuggestionEntry    = SuggestionEntry;
module.exports.SuggestionCooldown = SuggestionCooldown;
module.exports.SuggestionLegacy   = SuggestionLegacy;