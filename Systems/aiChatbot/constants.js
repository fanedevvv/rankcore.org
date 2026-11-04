// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMITS = {
    // Per-user rolling window limits
    USER_MAX_PER_MINUTE:  3,
    USER_MAX_PER_HOUR:    15,
    USER_MAX_PER_DAY:     60,

    // Per-guild rolling window limits
    GUILD_MAX_PER_MINUTE: 10,
    GUILD_MAX_PER_HOUR:   100,

    // Hard queue limits
    GLOBAL_QUEUE_MAX:     50,
    PER_GUILD_QUEUE_MAX:  15,
    PER_USER_QUEUE_MAX:   2,

    // Queue expiry: drop jobs sitting longer than this
    QUEUE_EXPIRE_MS:      90_000,  // 90 seconds

    // Concurrency: simultaneous Groq requests
    MAX_CONCURRENT:       3,

    // Message content limits
    MAX_MESSAGE_LENGTH:   1000,

    // Minimum cooldown (floor for cfg.cooldownSec)
    MIN_COOLDOWN_SEC:     5,
};

const GROQ_MODEL = "llama-3.3-70b-versatile"; // override with GROQ_MODEL in .env

const TOGGLE_COMMANDS = [
    { cmd: "!swears",   modeKey: "swearing", name: "Swearing mode", emoji: "<:error:1555544434601369620>",       schemaKey: "swearing" },
    { cmd: "!uwu",      modeKey: "uwu",      name: "UwU mode",      emoji: "<:Red_Heart:1555544329605615758>",   schemaKey: "uwu"      },
    { cmd: "!roast",    modeKey: "roasting", name: "Roasting mode", emoji: "<:fire:1555544450871332944>",        schemaKey: "roasting" },
    { cmd: "!ragebait", modeKey: "ragebait", name: "Ragebait mode", emoji: "<:error:1555544434601369620>",       schemaKey: "ragebait" },
    { cmd: "!help",     modeKey: "helpMode", name: "Helper mode",   emoji: "<:n_bot:1555544367886770176>",         schemaKey: "helpMode" },
];

module.exports = { RATE_LIMITS, GROQ_MODEL, TOGGLE_COMMANDS };