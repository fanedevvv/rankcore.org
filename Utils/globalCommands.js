// Every slash command is registered GLOBALLY, so it works in every server as soon as the bot joins.
// Server managers can still switch commands off per server (dashboard → Command Manager → disabledCommands).
// Discord allows at most 100 global slash commands per app.
const GLOBAL_COMMAND_LIMIT = 100;

// Not loaded at all: these setup commands only linked to the dashboard, and /setup feature:<name>
// does the same. Their files stay because the setup panels still import helpers from them.
const RETIRED_COMMANDS = new Set([
  "anti-ghost-ping", "auto-role", "booster", "christmas-config", "counting", "guess",
  "halloween-config", "join-ping", "join-to-create", "leveling", "level-roles", "logs",
  "reaction-role", "sticky-message", "uptime", "verification", "voiceleveling", "welcome-message",
  "guildredeem",   // replaced by /redeem
  "premium-test",  // internal test command
]);

module.exports = { GLOBAL_COMMAND_LIMIT, RETIRED_COMMANDS };
