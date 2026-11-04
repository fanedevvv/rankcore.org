'use strict';
const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  roleId: { type: String, default: null },
  color:  { type: String, default: '#EF4444' },
}, { _id: false });

const staffCommandsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },

  infract: {
    logChannelId:  { type: String, default: null },
    dmUser:        { type: Boolean, default: true },
    demoRoleId:    { type: String, default: null },
    suspendRoleId: { type: String, default: null },
    autoStrip:     { type: Boolean, default: true },
  },

  promote: {
    logChannelId:      { type: String, default: null },
    announceChannelId: { type: String, default: null },
    promotionMessage:  { type: String, default: '' },
    tiers:             { type: [tierSchema], default: [] },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('StaffCommands', staffCommandsSchema);