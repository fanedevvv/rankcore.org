const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },

  // Welcome
  welcomeChannelId: { type: String, default: null },
  welcomeMessage: { type: String, default: "Welcome {user} — invited by {inviter}. Total invites: {invites}" },
  welcomeEmbedMode: { type: Boolean, default: false },
  welcomeCooldown: { type: Number, default: 0 }, // seconds

  // Leave
  leave: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    message: { type: String, default: "Goodbye {username}! We hope to see you again." }
  },

  // Log
  logChannelId: { type: String, default: null },
  verboseLogs: { type: Boolean, default: false },

  // Tracking
  fakeAccountAgeDays: { type: Number, default: 7 },
  alertFake: { type: Boolean, default: false },
  ignoreBots: { type: Boolean, default: true },
  countLeavesAsNegative: { type: Boolean, default: true },
  trackInviteCodes: { type: Boolean, default: true },
  allowVanity: { type: Boolean, default: false },

  // Leaderboard
  leaderboardChannelId: { type: String, default: null },
  leaderboardInterval: { type: String, default: 'daily', enum: ['manual', 'hourly', 'daily', 'weekly'] },
  showFakeInLeaderboard: { type: Boolean, default: false },

  // Embed
  embed: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Welcome to {server}!' },
    description: { type: String, default: 'Hey {user}! You were invited by **{inviter}** who now has **{invites}** invites.' },
    color: { type: String, default: '#6C53FF' },
    footer: { type: String, default: 'Member #{memberCount}' },
    thumbnail: { type: String, default: 'none', enum: ['none', 'avatar', 'server'] },
    image: { type: String, default: null },
    showStats: { type: Boolean, default: false }
  },

  // Webhook
  webhookWelcome: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    webhookId: { type: String, default: null },
    webhookToken: { type: String, default: null, select: false },
    username: { type: String, default: null },
    avatarUrl: { type: String, default: null }
  },

  // Auto Roles
  autoRolesEnabled: { type: Boolean, default: false },
  autoRoles: [{ type: String }],

  // Reward Roles (invite count thresholds)
  rewardRoles: [{
    invites: { type: Number, required: true },
    roleId: { type: String, required: true }
  }],

  // Milestones
  milestonesEnabled: { type: Boolean, default: false },
  milestoneChannelId: { type: String, default: null },
  milestones: [{
    count: { type: Number, required: true },
    message: { type: String, required: true }
  }],
  inviteMilestones: [{
    invites: { type: Number, required: true },
    message: { type: String, required: true }
  }],

  // DM Welcome
  dmWelcome: {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: 'Welcome to {server}, {username}! <:boost:1555544362455146576>' }
  },

  // Invite Filter
  inviteFilter: {
    mode: { type: String, default: 'all', enum: ['all', 'whitelist', 'blacklist'] },
    codes: [{ type: String }]
  },

  // Rate limiting
  maxJoinsPerDay: { type: Number, default: 0 }
});

module.exports = mongoose.model('GuildInviteConfig', guildConfigSchema);