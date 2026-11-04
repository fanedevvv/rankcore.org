'use strict';
/**
 * staffActionSchema.js
 *
 * Stores a log of all /infract and /promote actions per guild.
 * Each document is one action — queried by guildId, targetId, or both.
 * Used by /stafflog and the dashboard Action Log tab.
 */
const { Schema, model } = require('mongoose');

const staffActionSchema = new Schema({
  guildId:     { type: String, required: true, index: true },
  targetId:    { type: String, required: true, index: true },   // staff member who was infracted/promoted
  targetTag:   { type: String, default: '' },
  issuerId:    { type: String, required: true },                 // who issued the action
  issuerTag:   { type: String, default: '' },
  action:      {
    type: String,
    enum: ['verbal_warning','written_warning','demotion','suspension','removal','promote'],
    required: true,
  },
  reason:      { type: String, default: 'No reason provided.' },
  details:     { type: String, default: null },
  duration:    { type: String, default: null },
  caseNumber:  { type: String, default: null },
  roleAdded:   { type: String, default: null },   // role ID
  roleRemoved: { type: String, default: null },   // role ID
  newRank:     { type: String, default: null },   // for promote actions
}, {
  timestamps: true,   // createdAt / updatedAt
});

staffActionSchema.index({ guildId: 1, targetId: 1 });
staffActionSchema.index({ guildId: 1, createdAt: -1 });

module.exports = model('StaffAction', staffActionSchema);
