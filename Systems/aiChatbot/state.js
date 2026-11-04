// ─────────────────────────────────────────────────────────────────────────────
//  Shared in-memory state
//  All maps live here so every module reads/writes the same instances.
// ─────────────────────────────────────────────────────────────────────────────

// messageHistory : Map<guildId, Map<channelId, Array<historyEntry>>>
const messageHistory = new Map();

// cooldowns      : Map<guildId, Map<userId, timestamp>>
const cooldowns = new Map();

// spamTracker    : Map<guildId, Map<userId, timestamp[]>>
const spamTracker = new Map();

// Per-user mode toggles : Map<guildId, Map<userId, boolean>>
const userModes = {
    swearing: new Map(),
    uwu:      new Map(),
    roasting: new Map(),
    ragebait: new Map(),
    helpMode: new Map(),
};

// Regen counter  : Map<replyMessageId, number>
if (!globalThis.regenTracker) globalThis.regenTracker = new Map();
const regenTracker = globalThis.regenTracker;

// Rate-limit windows
// userRateWindows  : Map<userId,  { minute: timestamp[], hour: timestamp[], day: timestamp[] }>
// guildRateWindows : Map<guildId, { minute: timestamp[], hour: timestamp[] }>
const userRateWindows  = new Map();
const guildRateWindows = new Map();

module.exports = {
    messageHistory,
    cooldowns,
    spamTracker,
    userModes,
    regenTracker,
    userRateWindows,
    guildRateWindows,
};