// Schemas/customCommandSchema.js
const mongoose = require('mongoose');

// ── Sub-schemas ──────────────────────────────────────────────────────────────
const choiceSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  value: { type: String, required: true },
}, { _id: false });

const argumentSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  description:  { type: String, default: 'An argument' },
  type: {
    type:    String,
    enum:    ['STRING','INTEGER','NUMBER','BOOLEAN','USER','CHANNEL','ROLE','ATTACHMENT','MENTIONABLE'],
    default: 'STRING',
  },
  required:      { type: Boolean, default: false },
  minLength:     { type: Number,  default: null },
  maxLength:     { type: Number,  default: null },
  minValue:      { type: Number,  default: null },
  maxValue:      { type: Number,  default: null },
  channelTypes:  [{ type: Number }],
  choices:       [choiceSchema],
  autocomplete:  { type: Boolean, default: false },
}, { _id: false });

const responseVariantSchema = new mongoose.Schema({
  text:   { type: String, required: true },
  weight: { type: Number, default: 1, min: 1, max: 100 },
}, { _id: false });

const conditionalSchema = new mongoose.Schema({
  argName:    { type: String, required: true },
  operator:   {
    type: String,
    enum: ['eq','neq','gt','lt','gte','lte','contains','startsWith','endsWith'],
    default: 'eq',
  },
  value:      { type: String, required: true },
  response:   { type: String, required: true },
  embedTitle: { type: String, default: '' },
  isEmbed:    { type: Boolean, default: false },
}, { _id: false });

const restrictionSchema = new mongoose.Schema({
  id:   { type: String, required: true },
  name: { type: String, default: '' },
}, { _id: false });

const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      // Single-target (invoker)
      'add_role', 'remove_role',
      'add_role_arg', 'remove_role_arg',
      'dm_invoker', 'set_nickname', 'react',
      // Single arg-target
      'dm_user_arg', 'send_channel', 'send_channel_arg',
      'timeout_user', 'kick_user', 'ban_user',
      // Dual-variable
      'add_role_to_user_arg', 'remove_role_from_user_arg',
      'add_role_arg_to_user_arg', 'remove_role_arg_from_user_arg',
      'set_nickname_user_arg', 'timeout_user_arg_duration',
    ],
    required: true,
  },
  value:        { type: String,  default: '' },  // message / nickname / emoji / duration / reason
  targetId:     { type: String,  default: '' },  // fixed role or channel ID
  argName:      { type: String,  default: '' },  // primary arg (role / channel / user)
  targetArg:    { type: String,  default: '' },  // secondary USER arg to act on
  silentFail:   { type: Boolean, default: true  },
  requiresPerms:{ type: Boolean, default: false },
}, { _id: false });

const buttonSchema = new mongoose.Schema({
  label:    { type: String, default: '' },
  style:    { type: String, enum: ['PRIMARY','SECONDARY','SUCCESS','DANGER','LINK'], required: true },
  emoji:    { type: String, default: '' },
  url:      { type: String, default: '' },  // required for LINK style
  response: { type: String, default: '' },  // required if not LINK
}, { _id: false });

const embedFieldSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  value:  { type: String, required: true },
  inline: { type: Boolean, default: false },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────
const customCommandSchema = new mongoose.Schema({
  Guild:        { type: String, required: true },
  Name:         { type: String, required: true },
  Description:  { type: String, default: 'A custom command' },
  Response:     { type: String, required: true },
  Creator:      { type: String, required: true },
  LastEditedBy: { type: String, default: null },

  // Behaviour
  Enabled:          { type: Boolean, default: true },
  Ephemeral:        { type: Boolean, default: false },
  DmAllowed:        { type: Boolean, default: false },
  Cooldown:         { type: Number, default: 0 },
  GlobalCooldown:   { type: Number, default: 0 },
  RequiredPermission: { type: String, default: null },
  DeleteInvoking:   { type: Boolean, default: false },

  // Embed
  IsEmbed:         { type: Boolean, default: false },
  EmbedColor:      { type: String,  default: '#6C53FF' },
  EmbedTitle:      { type: String,  default: '' },
  EmbedFooter:     { type: String,  default: '' },
  EmbedImage:      { type: String,  default: '' },
  EmbedThumbnail:  { type: String,  default: '' },
  EmbedAuthorName: { type: String,  default: '' },
  EmbedAuthorIcon: { type: String,  default: '' },
  EmbedUrl:        { type: String,  default: '' },
  EmbedFooterIcon: { type: String,  default: '' },

  // Multi-response (weighted random)
  MultiResponseEnabled: { type: Boolean, default: false },
  ResponseVariants:     [responseVariantSchema], // max 10

  // Conditional responses (first match wins)
  Conditionals: [conditionalSchema], // max 10

  // Channel/role restrictions
  AllowedChannels: [restrictionSchema],
  DeniedChannels:  [restrictionSchema],
  AllowedRoles:    [restrictionSchema],
  DeniedRoles:     [restrictionSchema],

  // Aliases (each becomes a real registered slash command)
  Aliases: [{ type: String }], // max 3

  // Tags & categorisation
  Tags:     [{ type: String }], // max 5
  Category: { type: String, default: '' }, // max 32 chars

  // Arguments
  Arguments: [argumentSchema], // max 25

  // Actions
  Actions: [actionSchema], // max 10

  // Buttons
  Buttons: [buttonSchema], // max 5

  // Embed fields
  EmbedFields: [embedFieldSchema], // max 25

  // Output channel routing (#17) — if set, response is sent here instead of current channel
  OutputChannelId: { type: String, default: null },

  // Plain text alongside embed (#18) — text shown above the embed
  PlainTextContent: { type: String, default: '' },

  // Usage stats
  UsageCount: { type: Number, default: 0 },
  LastUsedAt: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('CustomCommand', customCommandSchema);