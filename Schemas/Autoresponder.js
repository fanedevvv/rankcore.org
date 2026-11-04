const mongoose = require("mongoose");

// ── Button Action sub-schema ───────────────────────────────────────────────────
const buttonActionSchema = new mongoose.Schema({
  type:      { type: String, enum: ['none','reply','dm','role_add','role_remove','role_toggle'], default: 'none' },
  content:   { type: String, default: '' },
  ephemeral: { type: Boolean, default: true },
  roleId:    { type: String, default: '' },
}, { _id: false });

// ── Button component sub-schema ───────────────────────────────────────────────
const buttonComponentSchema = new mongoose.Schema({
  type:      { type: Number, default: 2 },   // always 2 for button
  label:     { type: String, default: '' },
  style:     { type: Number, default: 1 },   // 1-5
  custom_id: { type: String, default: '' },
  url:       { type: String, default: '' },
  disabled:  { type: Boolean, default: false },
  emoji:     {
    name: { type: String, default: '' },
    id:   { type: String, default: '' },
  },
  _action:   { type: buttonActionSchema, default: () => ({}) },
}, { _id: false });

// ── Action row sub-schema ─────────────────────────────────────────────────────
const actionRowSchema = new mongoose.Schema({
  type:       { type: Number, default: 1 },   // always 1 for action row
  components: { type: [buttonComponentSchema], default: [] },
}, { _id: false });

// ── V2 component (generic flexible storage) ───────────────────────────────────
// V2 uses Discord's components v2 spec. We store as Mixed for flexibility.
// Types: 1=ActionRow, 9=Section, 10=TextDisplay, 11=Thumbnail, 12=Gallery, 14=Separator, 17=Container

// ── Main Autoresponder schema ─────────────────────────────────────────────────
const autoresponderSchema = new mongoose.Schema({
  guildId:  { type: String, required: true, index: true },
  trigger:  { type: String, required: true },
  response: { type: String, default: '' },

  // V1 embed (legacy, still supported)
  embed: {
    enabled:     { type: Boolean, default: false },
    color:       { type: String,  default: '#6C53FF' },
    title:       { type: String,  default: '' },
    description: { type: String,  default: '' },
    authorName:  { type: String,  default: '' },
    authorIcon:  { type: String,  default: '' },
    thumbnail:   { type: String,  default: '' },
    image:       { type: String,  default: '' },
    footerText:  { type: String,  default: '' },
    footerIcon:  { type: String,  default: '' },
    timestamp:   { type: Boolean, default: false },
    fields: [{
      name:   { type: String, default: '' },
      value:  { type: String, default: '' },
      inline: { type: Boolean, default: false },
      _id: false,
    }],
  },

  // V2 Components array (Discord Components v2)
  // Stored as Mixed[] to support the full component spec without over-constraining
  v2Components: { type: [mongoose.Schema.Types.Mixed], default: undefined },

  // Action row of buttons (attached to text or embed responses)
  buttons: { type: actionRowSchema, default: undefined },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// ── Index for fast guild lookups ──────────────────────────────────────────────
autoresponderSchema.index({ guildId: 1, trigger: 1 });

module.exports = mongoose.model("Autoresponder", autoresponderSchema);