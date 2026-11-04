"use strict";
const { model, Schema } = require("mongoose");

// ── Individual question inside a panel ────────────────────────────────────────
const QuestionSchema = new Schema({
  id:          { type: String, required: true },          // stable slug used as modal component ID
  label:       { type: String, required: true },          // shown in the Discord modal
  placeholder: { type: String, default: "" },             // grey hint text inside input
  style:       { type: String, default: "short", enum: ["short", "paragraph"] },
  required:    { type: Boolean, default: true },
  minLength:   { type: Number, default: 0 },
  maxLength:   { type: Number, default: 1000 },
}, { _id: false });

// ── Application panel ─────────────────────────────────────────────────────────
const StaffApplicationSchema = new Schema({
  guildId:      { type: String, required: true, index: true },
  panelId:      { type: String, required: true, unique: true }, // short random slug

  // Identity
  name:         { type: String, required: true },          // e.g. "Moderator"
  description:  { type: String, default: "" },             // shown in the panel embed
  emoji:        { type: String, default: "<:files:1555544445565407352>" },

  // Channels
  panelChannelId:  { type: String, default: null },        // where the button embed is posted
  logChannelId:    { type: String, default: null },        // where submissions appear for review
  resultsChannelId:{ type: String, default: null },        // optional: public accept/deny announce

  // Panel message reference (so we can re-post / update)
  panelMessageId:  { type: String, default: null },
  panelViaCB:      { type: Boolean, default: false },

  // Roles
  staffRoleId:     { type: String, default: null },        // role given on acceptance
  requiredRoleId:  { type: String, default: null },        // role required to apply (optional)
  pingRoleId:      { type: String, default: null },        // role pinged in log channel on new app

  // Panel embed customisation
  embedColor:   { type: String, default: "#6C53FF" },
  embedTitle:   { type: String, default: "" },             // defaults to `${name} Application`
  embedFooter:  { type: String, default: "" },

  // Behaviour
  enabled:      { type: Boolean, default: true },
  dmMode:       { type: Boolean, default: true },   // true = DM questions 1-by-1 (item 6)
  dmOnAccept:   { type: Boolean, default: true },
  dmOnDeny:     { type: Boolean, default: true },
  cooldownHours:{ type: Number, default: 0 },              // 0 = no cooldown

  // Custom questions (max 25 — displayed across paged modals, 5 per page)
  questions: { type: [QuestionSchema], default: [] },

  // Auto-close after accept
  autoCloseOnAccept: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model("StaffApplication", StaffApplicationSchema);
