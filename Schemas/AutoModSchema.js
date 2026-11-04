"use strict";
/**
 * Schemas/AutoModSchema.js
 *
 * Sapphire-style AutoMod schema.
 *
 * Filters covered:
 *   Rate limits  — messages, mentions, links, caps, duplicates, attachments, emojis, newlines
 *   Invite links — discord.gg / discord.com/invite with per-domain whitelist
 *   Link groups  — domain blacklist/whitelist groups
 *   Word groups  — multiple named groups, each with words + wildcard/exact + action
 *   Zalgo text   — diacritic-overload detection
 *   Mass mention — @everyone / @here
 *   Repeat chars — e.g. "aaaaaaaaaa"
 *   Sticker spam
 *   Spoiler spam
 *   Image-only channels
 *
 * Infrastructure:
 *   Ignored roles / channels (global bypass)
 *   Dedicated log channel
 *   Per-rule mute duration
 *   Warn-escalation ladder
 */

const mongoose = require("mongoose");

const ACTIONS = ["warn", "delete", "mute", "kick", "ban"];

const RateRuleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["messages", "mentions", "links", "caps", "duplicates", "attachments", "emojis", "newlines"],
    required: true,
  },
  limit:            { type: Number, default: 5 },
  window:           { type: Number, default: 5 },
  action:           { type: String, enum: ACTIONS, default: "warn" },
  muteDuration:     { type: Number, default: 10 },
  // Per-rule role exemptions
  exemptRoleIds:    { type: [String], default: [] },
  exemptRoleMode:   { type: String, enum: ["excluded", "included"], default: "excluded" },
  // Per-rule channel exemptions
  exemptChannelIds: { type: [String], default: [] },
  exemptChannelMode:{ type: String, enum: ["excluded", "included"], default: "excluded" },
}, { _id: false });

const WarnStepSchema = new mongoose.Schema({
  count:        { type: Number, required: true },
  action:       { type: String, enum: ACTIONS, default: "mute" },
  note:         { type: String, default: "" },
  muteDuration: { type: Number, default: 10 },
}, { _id: false });

const RegexRuleSchema = new mongoose.Schema({
  pattern:      { type: String, required: true },
  flags:        { type: String, default: "i" },
  description:  { type: String, default: "" },
  action:       { type: String, enum: ACTIONS, default: "warn" },
  muteDuration: { type: Number, default: 10 },
}, { _id: false });

/** Sapphire-style Word Group — separate named lists each with own action */
const WordGroupSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  words:        { type: [String], default: [] },
  matchMode:    { type: String, enum: ["wildcard", "exact"], default: "wildcard" },
  action:       { type: String, enum: ACTIONS, default: "delete" },
  muteDuration: { type: Number, default: 10 },
}, { _id: false });

/** Sapphire-style Link Group — blacklist or whitelist specific domains */
const LinkGroupSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  mode:         { type: String, enum: ["blacklist", "whitelist"], default: "blacklist" },
  domains:      { type: [String], default: [] },
  action:       { type: String, enum: ACTIONS, default: "delete" },
  muteDuration: { type: Number, default: 10 },
}, { _id: false });

const ImageOnlyChannelSchema = new mongoose.Schema({
  channelId:       { type: String, required: true },
  allowImageLinks: { type: Boolean, default: false },
}, { _id: false });

// ─────────────────────────────────────────────────────────────────────────────

const AutoModSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },

  status:        { type: Boolean, default: false },
  detectBotSpam: { type: Boolean, default: false },

  // ── Log & exempt infrastructure ───────────────────────────────────────────
  logChannelId:      { type: String, default: null },
  ignoredRoleIds:    { type: [String], default: [] },
  ignoredChannelIds: { type: [String], default: [] },

  // ── Rate-limit rules ──────────────────────────────────────────────────────
  rateRules: {
    type: [RateRuleSchema],
    default: () => [
      { type: "messages",   limit: 5,  window: 5,  action: "warn",   muteDuration: 10 },
      { type: "mentions",   limit: 5,  window: 10, action: "warn",   muteDuration: 10 },
      { type: "links",      limit: 3,  window: 10, action: "warn",   muteDuration: 10 },
      { type: "caps",       limit: 70, window: 0,  action: "warn",   muteDuration: 10 },
      { type: "emojis",     limit: 8,  window: 0,  action: "delete", muteDuration: 10 },
      { type: "duplicates", limit: 3,  window: 30, action: "warn",   muteDuration: 10 },
    ],
  },

  // ── Warn escalation ladder ────────────────────────────────────────────────
  warnSteps: {
    type: [WarnStepSchema],
    default: () => [
      { count: 1, action: "warn", note: "First offence",  muteDuration: 10 },
      { count: 3, action: "mute", note: "10m mute",       muteDuration: 10 },
      { count: 5, action: "kick", note: "",               muteDuration: 10 },
      { count: 7, action: "ban",  note: "",               muteDuration: 10 },
    ],
  },

  // ── Legacy single-list banned words (still supported) ────────────────────
  bannedWords:      { type: [String], default: [] },
  wordFilterAction: { type: String, enum: ACTIONS, default: "delete" },
  wordMuteDuration: { type: Number, default: 10 },
  wordWildcard:     { type: Boolean, default: true },

  // ── Sapphire-style Word Groups ────────────────────────────────────────────
  wordGroups: { type: [WordGroupSchema], default: [] },

  // ── Sapphire-style Link Groups ────────────────────────────────────────────
  linkGroups: { type: [LinkGroupSchema], default: [] },

  // ── Custom regex rules ────────────────────────────────────────────────────
  regexRules: { type: [RegexRuleSchema], default: [] },

  // ── Invite filter ─────────────────────────────────────────────────────────
  filterInvites:       { type: Boolean, default: false },
  inviteAction:        { type: String, enum: ACTIONS, default: "delete" },
  inviteMuteDuration:  { type: Number, default: 10 },
  allowOwnInvites:     { type: Boolean, default: true },
  extraInviteDomains:  { type: [String], default: [] },

  // ── Zalgo text filter ─────────────────────────────────────────────────────
  filterZalgo:         { type: Boolean, default: false },
  zalgoAction:         { type: String, enum: ACTIONS, default: "delete" },
  zalgoMuteDuration:   { type: Number, default: 10 },
  zalgoThreshold:      { type: Number, default: 0.20 },

  // ── Mass mention (@everyone / @here) ──────────────────────────────────────
  filterMassMention:        { type: Boolean, default: false },
  massMentionAction:        { type: String, enum: ACTIONS, default: "delete" },
  massMentionMuteDuration:  { type: Number, default: 10 },

  // ── Repeated character spam ───────────────────────────────────────────────
  filterRepeatChar:          { type: Boolean, default: false },
  repeatCharLimit:           { type: Number, default: 10 },
  repeatCharAction:          { type: String, enum: ACTIONS, default: "delete" },
  repeatCharMuteDuration:    { type: Number, default: 10 },

  // ── Sticker spam ──────────────────────────────────────────────────────────
  filterStickers:        { type: Boolean, default: false },
  stickerLimit:          { type: Number, default: 1 },
  stickerAction:         { type: String, enum: ACTIONS, default: "delete" },
  stickerMuteDuration:   { type: Number, default: 10 },

  // ── Spoiler abuse ─────────────────────────────────────────────────────────
  filterSpoilers:        { type: Boolean, default: false },
  spoilerLimit:          { type: Number, default: 5 },
  spoilerAction:         { type: String, enum: ACTIONS, default: "delete" },
  spoilerMuteDuration:   { type: Number, default: 10 },

  // ── Image-only channels ───────────────────────────────────────────────────
  imageOnlyChannels: { type: [ImageOnlyChannelSchema], default: [] },

}, { timestamps: true });

module.exports = mongoose.model("AutoMod", AutoModSchema);