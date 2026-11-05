// ─────────────────────────────────────────────────────────────────────────────
//  Rate limiter — rolling-window checks and recording
// ─────────────────────────────────────────────────────────────────────────────

const { RATE_LIMITS }                     = require("./constants");
const { userRateWindows, guildRateWindows } = require("./state");

// ── Window helpers ────────────────────────────────────────────────────────────

function getUserWindows(userId) {
    if (!userRateWindows.has(userId)) {
        userRateWindows.set(userId, { minute: [], hour: [], day: [] });
    }
    return userRateWindows.get(userId);
}

function getGuildWindows(guildId) {
    if (!guildRateWindows.has(guildId)) {
        guildRateWindows.set(guildId, { minute: [], hour: [] });
    }
    return guildRateWindows.get(guildId);
}

function pruneWindow(arr, windowMs) {
    const cutoff = Date.now() - windowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();
}

// ── User rate limits ──────────────────────────────────────────────────────────

/**
 * Returns null if within limits, or a user-facing error string if exceeded.
 */
function checkUserRateLimit(userId) {
    const w = getUserWindows(userId);
    pruneWindow(w.minute, 60_000);
    pruneWindow(w.hour,   3_600_000);
    pruneWindow(w.day,    86_400_000);

    if (w.minute.length >= RATE_LIMITS.USER_MAX_PER_MINUTE)
        return `<:1430986244921495654:1567796929587576852> You're sending messages too fast! Max **${RATE_LIMITS.USER_MAX_PER_MINUTE} messages per minute**.`;
    if (w.hour.length >= RATE_LIMITS.USER_MAX_PER_HOUR)
        return `<:1430986244921495654:1567796929587576852> Hourly limit reached! Max **${RATE_LIMITS.USER_MAX_PER_HOUR} messages per hour**.`;
    if (w.day.length >= RATE_LIMITS.USER_MAX_PER_DAY)
        return `<:1430986244921495654:1567796929587576852> Daily limit reached! Max **${RATE_LIMITS.USER_MAX_PER_DAY} messages per day**. Try again tomorrow.`;

    return null;
}

/** Record a user request across all windows. Call only after checks pass. */
function recordUserRequest(userId) {
    const w   = getUserWindows(userId);
    const now = Date.now();
    w.minute.push(now);
    w.hour.push(now);
    w.day.push(now);
}

// ── Guild rate limits ─────────────────────────────────────────────────────────

/**
 * Returns null if within limits, or a user-facing error string if exceeded.
 */
function checkGuildRateLimit(guildId) {
    const w = getGuildWindows(guildId);
    pruneWindow(w.minute, 60_000);
    pruneWindow(w.hour,   3_600_000);

    if (w.minute.length >= RATE_LIMITS.GUILD_MAX_PER_MINUTE)
        return `<:1430986225493479485:1567796921681055824> This server is very busy! Max **${RATE_LIMITS.GUILD_MAX_PER_MINUTE} AI requests per minute** server-wide. Try again shortly.`;
    if (w.hour.length >= RATE_LIMITS.GUILD_MAX_PER_HOUR)
        return `<:1430986225493479485:1567796921681055824> Server hourly limit reached! Max **${RATE_LIMITS.GUILD_MAX_PER_HOUR} AI requests per hour** server-wide.`;

    return null;
}

/** Record a guild request across all windows. */
function recordGuildRequest(guildId) {
    const w   = getGuildWindows(guildId);
    const now = Date.now();
    w.minute.push(now);
    w.hour.push(now);
}

module.exports = {
    checkUserRateLimit,
    recordUserRequest,
    checkGuildRateLimit,
    recordGuildRequest,
};