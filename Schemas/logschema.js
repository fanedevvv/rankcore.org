const { model, Schema } = require("mongoose");

// Per-event override: custom channel + optional message template
// template field supports three formats:
// - null/undefined: use default embed (no custom message)
// - string: legacy plain text message (backward compatible)
// - object: { type: 'text', content: string } OR { type: 'embed', embeds: [{ title, description, color, author, thumbnail, image, footer, timestamp }] }
const EventConfigSchema = new Schema({
  channelId: { type: String, default: null },
  enabled:   { type: Boolean, default: true },
  template:  { type: Schema.Types.Mixed, default: null }, // null = default, string = legacy, object = new format
}, { _id: false });

const logSchema = new Schema({
  Guild: String,

  // ── Category fallback channels ─────────────────────────────────────────────
  LogChannels: {
    all:     String,
    message: String,
    channel: String,
    guild:   String,
    role:    String,
    voice:   String,
    member:  String,
    emoji:   String,
    invite:  String,
    webhook: String,
    automod: String,
  },

  // ── Per-event granular config ──────────────────────────────────────────────
  // Message events
  "event.messageDelete":       { type: EventConfigSchema, default: () => ({}) },
  "event.messageUpdate":       { type: EventConfigSchema, default: () => ({}) },
  "event.messageBulkDelete":   { type: EventConfigSchema, default: () => ({}) },
  // Channel events
  "event.channelCreate":       { type: EventConfigSchema, default: () => ({}) },
  "event.channelDelete":       { type: EventConfigSchema, default: () => ({}) },
  "event.channelUpdate":       { type: EventConfigSchema, default: () => ({}) },
  "event.channelPinsUpdate":   { type: EventConfigSchema, default: () => ({}) },
  // Role events
  "event.roleCreate":          { type: EventConfigSchema, default: () => ({}) },
  "event.roleDelete":          { type: EventConfigSchema, default: () => ({}) },
  "event.roleUpdate":          { type: EventConfigSchema, default: () => ({}) },
  // Member events
  "event.guildMemberAdd":      { type: EventConfigSchema, default: () => ({}) },
  "event.guildMemberRemove":   { type: EventConfigSchema, default: () => ({}) },
  "event.guildMemberUpdate":   { type: EventConfigSchema, default: () => ({}) },
  "event.guildBanAdd":         { type: EventConfigSchema, default: () => ({}) },
  "event.guildBanRemove":      { type: EventConfigSchema, default: () => ({}) },
  "event.guildMemberNickname": { type: EventConfigSchema, default: () => ({}) },
  // Voice events
  "event.voiceStateUpdate":    { type: EventConfigSchema, default: () => ({}) },
  "event.voiceChannelJoin":    { type: EventConfigSchema, default: () => ({}) },
  "event.voiceChannelLeave":   { type: EventConfigSchema, default: () => ({}) },
  "event.voiceChannelSwitch":  { type: EventConfigSchema, default: () => ({}) },
  // Guild events
  "event.guildUpdate":         { type: EventConfigSchema, default: () => ({}) },
  "event.inviteCreate":        { type: EventConfigSchema, default: () => ({}) },
  "event.inviteDelete":        { type: EventConfigSchema, default: () => ({}) },
  "event.webhookUpdate":       { type: EventConfigSchema, default: () => ({}) },
  "event.emojiCreate":         { type: EventConfigSchema, default: () => ({}) },
  "event.emojiDelete":         { type: EventConfigSchema, default: () => ({}) },
  "event.emojiUpdate":         { type: EventConfigSchema, default: () => ({}) },
  "event.stickerCreate":       { type: EventConfigSchema, default: () => ({}) },
  "event.stickerDelete":       { type: EventConfigSchema, default: () => ({}) },
  "event.stickerUpdate":       { type: EventConfigSchema, default: () => ({}) },
  // Automod events
  "event.automodAction":       { type: EventConfigSchema, default: () => ({}) },
  "event.automodRuleCreate":   { type: EventConfigSchema, default: () => ({}) },
  "event.automodRuleDelete":   { type: EventConfigSchema, default: () => ({}) },
  "event.automodRuleUpdate":   { type: EventConfigSchema, default: () => ({}) },
  // Thread events
  "event.threadCreate":        { type: EventConfigSchema, default: () => ({}) },
  "event.threadDelete":        { type: EventConfigSchema, default: () => ({}) },
  "event.threadUpdate":        { type: EventConfigSchema, default: () => ({}) },
  "event.threadMemberUpdate":  { type: EventConfigSchema, default: () => ({}) },
  // Stage events
  "event.stageInstanceCreate": { type: EventConfigSchema, default: () => ({}) },
  "event.stageInstanceDelete": { type: EventConfigSchema, default: () => ({}) },
  "event.stageInstanceUpdate": { type: EventConfigSchema, default: () => ({}) },
});

module.exports = model("logs", logSchema);