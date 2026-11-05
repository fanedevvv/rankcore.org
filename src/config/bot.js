module.exports = {
  // ─── Bot ──────────────────────────────────────────────────────────────────
  // Bot status: "online" | "idle" | "dnd" | "invisible"
  status:           "dnd",
  // Rotating custom status (changes every few seconds). Placeholders:
  // {guilds} {users} {commands} {uptime}
  activities: [
    "rankcore.org",
    "dash.rankcore.org",
    "mention me",
  ],
  activityIntervalMs: 15000,
  embedColor:       "#6200ff",
  dev:              "© RankCore Development, 2026. All rights reserved.",
  devBy:            "| Developed by © RankCore Development.",
  noPermsMessage:   "You **do not** have the permission to do that!",

  // ─── Links ────────────────────────────────────────────────────────────────
  topggURL:         "https://top.gg/bot/960624234688811188",
  supportURL:       "https://discord.gg/a9Kea3ymC7",
  inviteURL:        `https://discord.com/api/oauth2/authorize?client_id=${process.env.clientId}&permissions=8&scope=bot%20applications.commands`,
  docsUrl:          `${process.env.DASHBOARD_URL || "https://dash.rankcore.org"}/docs`,

  // ─── Dashboard ────────────────────────────────────────────────────────────
  dashboard: {
    enabled: true,
    domain:  process.env.DASHBOARD_URL || "https://dash.rankcore.org",
  },

  // ─── Logging Channels ─────────────────────────────────────────────────────
  // Set these to Discord channel IDs, or leave blank to disable
  slashCommandLoggingChannel:  "",
  // prefixCommandLoggingChannel: removed
  botsuggestions:              "",
  bugreport:                   "",
  feedback:                    "",

  // ─── Lavalink ─────────────────────────────────────────────────────────────
  lavalink: {
    name:   "RankCore Lavalink",
    url:    process.env.LAVALINK_URL  || "localhost:2333",
    auth:   process.env.LAVALINK_AUTH || "yourpasswordhere",
    secure: false,
  },
};
