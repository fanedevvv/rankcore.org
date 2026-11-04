const { model, Schema } = require('mongoose');

const youtubeNotificationSchema = new Schema({
  Guild: {
    type: String,
    required: true,
  },
  Channel: {
    type: String,
    required: true,
  },
  YouTubeChannel: {
    type: String,
    required: true,
  },
  // Resolved once at setup time — never re-resolved on every poll tick
  ResolvedChannelId: {
    type: String,
    default: null,
  },
  Message: {
    type: String,
    required: true,
  },
  // Optional role to ping when a new video/stream is posted
  PingRole: {
    type: String,
    default: null,
  },
  // Track video + stream IDs we've already notified about
  NotifiedVideoIds: {
    type: [String],
    default: [],
  },
  SetupNumber: {
    type: Number,
    required: true,
  },
  // Whether to notify for regular uploads (default true)
  NotifyUploads: {
    type: Boolean,
    default: true,
  },
  // Whether to notify when the channel goes live (default true)
  NotifyStreams: {
    type: Boolean,
    default: true,
  },
  // Tracks live streams so we don't re-notify every tick
  ActiveStreamId: {
    type: String,
    default: null,
  },
  LastChecked: {
    type: Date,
    default: Date.now,
  },
  // The publishedAt of the most-recent video we actually sent a notification for.
  // Used as a high-water mark: any video published ON or BEFORE this date is
  // silently skipped even if its ID has aged off the NotifiedVideoIds cap.
  // Null until the first notification is ever sent for this config.
  LastNotified: {
    type: Date,
    default: null,
  },
});

module.exports = model('YouTubeNotification', youtubeNotificationSchema);