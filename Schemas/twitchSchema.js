const { model, Schema } = require('mongoose');

const twitchNotificationSchema = new Schema({
  Guild: {
    type: String,
    required: true,
  },
  Channel: {
    type: String,
    required: true,
  },
  Streamer: {
    type: String,
    required: true,
  },
  Message: {
    type: String,
    required: true,
  },
  // Optional role to ping when the streamer goes live
  PingRole: {
    type: String,
    default: null,
  },
  // Track whether we already sent a live notification for the current stream
  // so we don't spam every poll tick. Cleared when stream ends.
  IsLiveNotified: {
    type: Boolean,
    default: false,
  },
  // Store the stream ID of the currently-notified live session
  NotifiedStreamId: {
    type: String,
    default: null,
  },
  // Whether to send a "stream ended" notification
  NotifyStreamEnd: {
    type: Boolean,
    default: false,
  },
  SetupNumber: {
    type: Number,
    default: 1,
  },
  LastChecked: {
    type: Date,
    default: Date.now,
  },
});

module.exports = model('TwitchNotification', twitchNotificationSchema);