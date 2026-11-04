// ─────────────────────────────────────────────────────────────────────────────
//  Job queue — concurrency-limited Groq request dispatching
// ─────────────────────────────────────────────────────────────────────────────

const { RATE_LIMITS } = require("./constants");

// Each entry shape:
//   { guildId, userId, channelId, message, cfg, activeModes, fullPrompt,
//     history, username, userPing, userMsg, embedColor, footerText,
//     queuedAt, resolve, reject }
const globalQueue = [];
let   activeJobs  = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function guildQueueCount(guildId) {
    return globalQueue.filter(j => j.guildId === guildId).length;
}

function userQueueCount(userId) {
    return globalQueue.filter(j => j.userId === userId).length;
}

/**
 * Returns a formatted queue-position string for the given userId,
 * or null if they are not in the queue.
 */
function queuePositionFor(userId) {
    const idx = globalQueue.findIndex(j => j.userId === userId);
    return idx === -1 ? null : `position **${idx + 1}** in queue`;
}

// ── Core queue logic ──────────────────────────────────────────────────────────

/**
 * Process the queue up to MAX_CONCURRENT jobs, expiring stale entries first.
 */
function drainQueue() {
    while (activeJobs < RATE_LIMITS.MAX_CONCURRENT && globalQueue.length > 0) {
        // Expire stale jobs
        const now = Date.now();
        while (globalQueue.length && (now - globalQueue[0].queuedAt) > RATE_LIMITS.QUEUE_EXPIRE_MS) {
            const expired = globalQueue.shift();
            expired.reject(new Error("QUEUE_EXPIRED"));
        }
        if (!globalQueue.length) break;

        const job = globalQueue.shift();
        activeJobs++;
        job.resolve(job); // signal the waiting promise in index.js
        // activeJobs is decremented by the consumer once Groq finishes
    }
}

/**
 * Attempt to add a job to the queue.
 * @returns {{ ok: true, queuePos: number } | { ok: false, reason: string }}
 */
function enqueue(job) {
    if (globalQueue.length >= RATE_LIMITS.GLOBAL_QUEUE_MAX)
        return { ok: false, reason: `<:error:1555544434601369620> The AI is overloaded right now (global limit). Please try again in a moment.` };

    if (guildQueueCount(job.guildId) >= RATE_LIMITS.PER_GUILD_QUEUE_MAX)
        return { ok: false, reason: `<:error:1555544434601369620> This server's AI queue is full (**${RATE_LIMITS.PER_GUILD_QUEUE_MAX}** max). Please wait for others to finish.` };

    if (userQueueCount(job.userId) >= RATE_LIMITS.PER_USER_QUEUE_MAX)
        return { ok: false, reason: `<:error:1555544434601369620> You already have **${RATE_LIMITS.PER_USER_QUEUE_MAX}** request(s) in queue. Please wait for them to complete.` };

    globalQueue.push(job);
    const pos = globalQueue.length;
    drainQueue();
    return { ok: true, queuePos: pos };
}

/** Decrement active job count and immediately try to serve the next queued job. */
function finishJob() {
    activeJobs = Math.max(0, activeJobs - 1);
    drainQueue();
}

module.exports = { enqueue, finishJob, drainQueue, queuePositionFor };