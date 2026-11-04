'use strict';
const { Schema, model } = require('mongoose');

const qotdSchema = new Schema({
  guildId:        { type: String, required: true, unique: true },
  channelId:      { type: String, default: null },
  roleId:         { type: String, default: null },   // role to ping on post
  enabled:        { type: Boolean, default: false },
  schedule:       { type: String, default: '09:00' }, // HH:MM UTC
  timezone:       { type: String, default: 'UTC' },
  lastPostedDate: { type: String, default: null },   // YYYY-MM-DD of last post
  color:          { type: String, default: '#6C53FF' },
  // Question bank — manual questions added by admins
  questions: [{
    text:      { type: String, required: true },
    addedBy:   { type: String, default: null },   // user ID
    usedOn:    { type: String, default: null },   // YYYY-MM-DD when used
    _id: false,
  }],
  // Whether to pull from built-in question bank when manual list is empty
  useFallbackBank: { type: Boolean, default: true },
  // Thread / discussion settings
  createThread:    { type: Boolean, default: false },
  threadDuration:  { type: Number, default: 1440 },  // minutes (24h default)
  embedTitle:      { type: String, default: 'Question of the Day' },
  footerText:      { type: String, default: '' },
}, { timestamps: true });

module.exports = model('QOTD', qotdSchema);
