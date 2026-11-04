'use strict';
const { Schema, model } = require('mongoose');

// Replaces: dashboard/data/savedMessages.json
const savedMessageSchema = new Schema({
  id:        { type: String, required: true },          // nanoid-style
  guildId:   { type: String, required: true, index: true },
  name:      { type: String, required: true, maxlength: 100 },
  type:      { type: String, required: true, enum: ['embed', 'v1', 'v2'] },
  payload:   { type: Schema.Types.Mixed, required: true },
  createdBy: { type: String, required: true },          // Discord user ID
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Compound unique index: one id per guild
savedMessageSchema.index({ guildId: 1, id: 1 }, { unique: true });

module.exports = model('SavedMessage', savedMessageSchema);