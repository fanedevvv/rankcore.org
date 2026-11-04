const { model, Schema } = require('mongoose');

let jointocreate = new Schema({
  Guild:              { type: String, required: true },
  Channel:            { type: String, default: null },   // trigger voice channel
  Category:           { type: String, default: null },   // target category

  // Core settings
  VoiceLimit:         { type: Number, default: 0 },
  InheritPermissions: { type: Boolean, default: true },
  OwnerManage:        { type: Boolean, default: true },  // owner gets Manage Channel
  AllowLock:          { type: Boolean, default: true },  // owner can lock
  OnePerUser:         { type: Boolean, default: true },  // one channel per user
  BlockBots:          { type: Boolean, default: true },

  // Naming
  NameTemplate:       { type: String, default: "{username}'s Channel" },
  DupStrategy:        { type: String, default: 'number', enum: ['number', 'hash', 'timestamp', 'allow'] },

  // Lifecycle
  DeleteWhenEmpty:    { type: Boolean, default: true },
  GracePeriod:        { type: Number, default: 0 },      // seconds before deletion
  MaxLifetime:        { type: Number, default: 0 },      // minutes, 0 = no limit

  // Access control
  RequiredRole:       { type: String, default: null },
  BlacklistRole:      { type: String, default: null },
  // Roles assigned when a user joins/creates a channel (Elite: unlimited, Pro: 50, Basic: 10, Free: 3)
  ConnectionRoles:    { type: [String], default: [] },   // role IDs granted on channel join

  // Control panel
  PanelEnabled:       { type: Boolean, default: false },
  PanelDest:          { type: String, default: 'dm', enum: ['dm', 'channel', 'textchannel', 'persistent'] },
  PanelChannel:       { type: String, default: null },
  // Permanent panel message (PanelDest 'persistent'), kept so a re-save edits it instead of posting again
  PanelMessageId:      { type: String, default: null },
  PanelMessageChannel: { type: String, default: null },
  PanelButtons: {
    lock:             { type: Boolean, default: true },
    hide:             { type: Boolean, default: true },
    rename:           { type: Boolean, default: true },
    limit:            { type: Boolean, default: true },
    kick:             { type: Boolean, default: false },
    transfer:         { type: Boolean, default: false },
    delete:           { type: Boolean, default: false },
  },

  // Welcome message
  WelcomeEnabled:     { type: Boolean, default: false },
  WelcomeMessage:     { type: String, default: null },

  // Logging
  LogEnabled:         { type: Boolean, default: false },
  LogChannel:         { type: String, default: null },
  LogEvents: {
    create:           { type: Boolean, default: true },
    delete:           { type: Boolean, default: true },
    rename:           { type: Boolean, default: false },
    lock:             { type: Boolean, default: false },
  },

  // Audio / quality
  Bitrate:            { type: Number, default: 64 },
  VideoQuality:       { type: String, default: 'auto', enum: ['auto', '720p'] },
  RegionOverride:     { type: String, default: null },
});

module.exports = model('jointocreate', jointocreate);