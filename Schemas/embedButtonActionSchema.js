const { Schema, model } = require('mongoose');

const embedButtonActionSchema = new Schema({
  Guild:    { type: String, required: true, index: true },
  CustomId: { type: String, required: true },
  ActionType: { type: String, default: 'none' },
  ReplyContent: { type: String, default: '' },
  ReplyEphemeral: { type: Boolean, default: true },
  RoleId: { type: String, default: '' },
  UpdatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

embedButtonActionSchema.index({ Guild: 1, CustomId: 1 }, { unique: true });

module.exports = model('EmbedButtonAction', embedButtonActionSchema);