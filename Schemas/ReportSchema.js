"use strict";

const mongoose = require("mongoose");

/**
 * ReportSchema
 *
 * Stores user-submitted reports against guilds or other users.
 * Devs resolve reports from the dev panel; the reporter gets a DM on resolution.
 */
const reportSchema = new mongoose.Schema({
  // Report metadata
  reportId: {
    type:    String,
    unique:  true,
    index:   true,
    default: () => `RPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  },

  // What is being reported: 'user' | 'guild'
  targetType: {
    type:     String,
    enum:     ["user", "guild"],
    required: true,
  },

  // Discord ID of the reported user or guild
  targetId: {
    type:     String,
    required: true,
    index:    true,
  },

  // Discord ID of the person who filed the report
  reporterId: {
    type:     String,
    required: true,
  },

  // Category: abuse | spam | scam | impersonation | nsfw | cheating | other
  category: {
    type:    String,
    enum:    ["abuse", "spam", "scam", "impersonation", "nsfw", "cheating", "other"],
    default: "other",
  },

  // Free-text description from the reporter
  reason: {
    type:      String,
    required:  true,
    maxlength: 1000,
  },

  // Optional evidence (message URL, screenshot URL, etc.)
  evidence: {
    type:      String,
    default:   null,
    maxlength: 500,
  },

  // Status: open | reviewing | resolved | dismissed
  status: {
    type:    String,
    enum:    ["open", "reviewing", "resolved", "dismissed"],
    default: "open",
    index:   true,
  },

  // Resolution details (filled in by dev)
  resolution: {
    resolvedBy:   { type: String, default: null },  // dev Discord user ID
    resolvedAt:   { type: Date,   default: null },
    action:       { type: String, default: null },  // free text: what action was taken
    devNote:      { type: String, default: null },  // internal note (not sent to reporter)
    dmSent:       { type: Boolean, default: false }, // whether reporter was DM'd
  },

  // Guild context — which server the report was filed from (if applicable)
  guildId: { type: String, default: null },

}, { timestamps: true });

// Index for efficient dev panel queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetId: 1, targetType: 1 });
reportSchema.index({ reporterId: 1 });

module.exports = mongoose.model("Report", reportSchema);