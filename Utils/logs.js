const Log = require('../Schemas/botlogs.js');
const mongoose = require('mongoose');
const { inspect } = require('node:util');
const path = require('path');
const fs = require('fs');

// ── Process identity ──────────────────────────────────────────────────────────
// All identity functions read from process.env.LOG_PROCESS_NAME dynamically.
// This lets CB workers rename themselves to CB_<guildId> after receiving their
// guildId via IPC — giving each worker a unique DB namespace so they never
// race each other when flushing queued log documents to Discord.
//
// CB_<guildId>  →  uses CB_LOG_WEBHOOK  (strips suffix for webhook lookup)
// Supported base values: BOT | DASHBOARD | CB
function getProcessName() {
    return process.env.LOG_PROCESS_NAME || 'BOT';
}

// Strips the _<guildId> suffix so webhook env var lookup still works.
// CB_1234567890 → CB,  BOT → BOT,  DASHBOARD → DASHBOARD
function getBaseProcessName() {
    const name = getProcessName();
    if (name.startsWith('CB_')) return 'CB';
    return name;
}

function getWebhookUrl() {
    const base = getBaseProcessName();
    return (
        process.env[`${base}_LOG_WEBHOOK`] ||
        process.env.DISCORD_LOG_WEBHOOK
    );
}

// ── Per-level webhook URLs ────────────────────────────────────────────────────
function getWebhookForLevel(level) {
    const base = getBaseProcessName();
    const normalizedLevel = level.replace('CONSOLE:', '').split(':')[0];
    return (
        process.env[`${base}_${normalizedLevel}_WEBHOOK`] ||
        process.env[`${normalizedLevel}_WEBHOOK`] ||
        getWebhookUrl()
    );
}

// Per-process accent colours and icons — resolved dynamically each call
// so CB workers pick up the correct identity after their IPC rename.
const PROCESS_COLORS = {
    BOT:       0x5b8dee,
    DASHBOARD: 0x9b59b6,
    CB:        0x23d160,
};
const PROCESS_ICONS = {
    BOT:       '<:n_bot:1567796985816154144>',
    DASHBOARD: '<:n_bot:1567796985816154144>',
    CB:        '<:boost:1567796953599836280>',
};
function getProcessColor() { return PROCESS_COLORS[getBaseProcessName()] ?? 0x5865f2; }
function getProcessIcon()  { return PROCESS_ICONS[getBaseProcessName()]  ?? '<:files:1567796970964394044>'; }

// ================= CONFIG =================
const ERROR_PING_COOLDOWN = 10 * 60 * 1000; // 10 minutes (kept for shouldPingError gate, no actual ping sent)
let errorPingLocked = false;
let errorPingTimer  = null;
const FLUSH_INTERVAL = 3000; // Flush every 3 seconds to batch logs
const MAX_BATCH = 50; // Accumulate many logs before sending
const MAX_LENGTH = 3950; // Maximum description length (Discord limit ~4000)
const MAX_EMBEDS = 10; // Maximum embeds per webhook message
const WEBHOOK_COOLDOWN = 1000; // Minimum 1s between webhook calls
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

let lastWebhookCall = 0;
let lastLogTimestamp = 0;

const dataFolder = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);
const QUEUE_FILE = path.join(dataFolder, 'log-queue.jsonl');

const queue = [];
let flushing = false;

// ================= EMBED COLORS =================
const EMBED_COLORS = {
    INFO: 0x45c0ff,
    WARN: 0xffa500,
    ERROR: 0xff3b3b,
    SUCCESS: 0x3bff6f,
    DEBUG: 0x5865f2,
    LOG: 0xff7ac8,
    SHUTDOWN: 0x2f3136
};

// ================= CONSOLE COLORS =================
const color = {
    red: '\x1b[31m',
    orange: '\x1b[38;5;202m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    pink: '\x1b[38;5;213m',
    turquoise: '\x1b[38;5;45m',
    reset: '\x1b[0m'
};

function shouldPingError() {
    if (errorPingLocked) return false;

    errorPingLocked = true;

    errorPingTimer = setTimeout(() => {
        errorPingLocked = false;
    }, ERROR_PING_COOLDOWN);

    return true;
}

// ================= INTERNAL LOGGER =================
// NEVER uses console.* or webhook (prevents recursion)
function internalError(err) {
    try {
        const msg = err?.stack || err?.message || err;
        process.stderr.write(
            `${color.red}[LOGGER ERROR]${color.reset} ${msg}\n`
        );
    } catch {}
}

function getTimestamp() {
    return new Date().toISOString();
}

function stripAnsi(str = '') {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function chunkString(str, size) {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size));
    }
    return chunks;
}

// ================= DISK QUEUE =================
function persistToDisk(payload) {
    try {
        fs.appendFileSync(QUEUE_FILE, JSON.stringify(payload) + '\n');
    } catch (err) {
        internalError(err);
    }
}

function loadDiskQueue() {
    if (!fs.existsSync(QUEUE_FILE)) return;

    try {
        const lines = fs.readFileSync(QUEUE_FILE, 'utf8')
            .split('\n')
            .filter(Boolean);

        for (const line of lines) {
            queue.push(JSON.parse(line));
        }

        fs.unlinkSync(QUEUE_FILE);
    } catch (err) {
        internalError(err);
    }
}

loadDiskQueue();

// ================= QUEUE =================
async function enqueue(payload, level = 'LOG') {
    if (!getWebhookUrl()) return;
    // Don't attempt DB writes after Mongoose has been disconnected (e.g. during shutdown)
    if (mongoose.connection.readyState !== 1) return;

    try {
        await Log.create({ ...payload, level, process: getProcessName() });
    } catch (err) {
        internalError(err);
    }
}

// ================= WEBHOOK SENDER WITH RATE LIMIT HANDLING =================
const _deadWebhooks = new Set();

async function sendToWebhook(content, embeds, retries = 0, webhookUrl = null) {
    if (!webhookUrl) webhookUrl = getWebhookUrl();
    if (!webhookUrl) return false;
    if (_deadWebhooks.has(webhookUrl)) return false; // permanently failed URL
    try {
        // Wait for cooldown
        const timeSinceLastCall = Date.now() - lastWebhookCall;
        if (timeSinceLastCall < WEBHOOK_COOLDOWN) {
            await new Promise(r => setTimeout(r, WEBHOOK_COOLDOWN - timeSinceLastCall));
        }

        lastWebhookCall = Date.now();

        // Omit content if falsy — Discord rejects payloads with null/undefined content
        const webhookPayload = {
            embeds: (embeds || []).filter(e => e && (e.description?.trim() || e.title?.trim()))
        };
        if (content) webhookPayload.content = content;

        if (!webhookPayload.embeds.length) return false;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        });

        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY * (retries + 1);

            if (retries < MAX_RETRIES) {
                internalError(`Rate limited. Retrying after ${waitTime}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, waitTime));
                return sendToWebhook(content, embeds, retries + 1, webhookUrl);
            } else {
                internalError('Max retries reached for webhook. Persisting to disk.');
                persistToDisk({ content, embeds });
                return false;
            }
        }

        if (response.status === 400 || response.status === 404 || response.status === 401) {
            // 400 = bad payload or deleted webhook, 404 = webhook not found, 401 = invalid token
            // These are permanent failures — retrying will never help, stop silently.
            _deadWebhooks.add(webhookUrl);
            return false;
        }

        // 502/503/504 = Discord infra blip — transient, retry with backoff, no error log spam
        if (response.status === 502 || response.status === 503 || response.status === 504) {
            if (retries < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAY * (retries + 2)));
                return sendToWebhook(content, embeds, retries + 1, webhookUrl);
            }
            return false;
        }

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`);
        }

        return true;
    } catch (err) {
        internalError(err);
        if (retries < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY * (retries + 1)));
            return sendToWebhook(content, embeds, retries + 1, webhookUrl);
        }
        return false;
    }
}

async function flushQueue() {
    if (!getWebhookUrl() || flushing) return;
    flushing = true;

    try {
        // Get logs from MongoDB — only this process's own logs
        const batch = await Log.find({ process: getProcessName() }).sort({ createdAt: 1 }).limit(MAX_BATCH);
        if (!batch.length) {
            flushing = false;
            return;
        }

        const successfulIds = [];
        const invalidIds = [];

        // Group valid logs by level
        const byLevel = new Map();

        for (const payload of batch) {
            const validEmbeds = (payload?.embeds || []).filter(e =>
                e && (e.description?.trim() || e.title?.trim())
            );

            if (!validEmbeds.length) {
                invalidIds.push(payload._id);
                continue;
            }

            payload.embeds = validEmbeds;

            const level = payload.level || 'LOG';
            if (!byLevel.has(level)) byLevel.set(level, []);
            byLevel.get(level).push(payload);
        }

        // Purge invalid documents
        if (invalidIds.length > 0) {
            await Log.deleteMany({ _id: { $in: invalidIds } });
            internalError(`Purged ${invalidIds.length} malformed log document(s) from MongoDB.`);
        }

        // Send each level group to its own webhook channel
        for (const [level, logs] of byLevel) {
            const webhookUrl = getWebhookForLevel(level);
            if (!webhookUrl) continue;

            // ERROR and SHUTDOWN are sent individually (not batched)
            if (level === 'ERROR' || level === 'SHUTDOWN') {
                for (const log of logs) {
                    const success = await sendToWebhook(log.content, log.embeds, 0, webhookUrl);
                    if (success) successfulIds.push(log._id);
                }
                continue;
            }

            // All other levels: batch into one message per channel
            const logLines = [];
            let pingContent = null;

            for (const payload of logs) {
                for (const embed of payload.embeds) {
                    const logText = (embed.description || '')
                        .replace(/```\n/g, '')
                        .replace(/```/g, '')
                        .trim();
                    const title = embed.title || level;
                    if (logText) logLines.push(`[${title}] ${logText}`);
                }
                if (!pingContent && payload.content) pingContent = payload.content;
            }

            if (!logLines.length) {
                logs.forEach(l => successfulIds.push(l._id));
                continue;
            }

            const fullContent = logLines.join('\n');
            const chunks = chunkString(fullContent, MAX_LENGTH);
            const embeds = [];

            for (let i = 0; i < chunks.length && i < MAX_EMBEDS; i++) {
                const embed = {
                    color: EMBED_COLORS[level] ?? getProcessColor() ?? 0x5865f2,
                    description: `\`\`\`\n${chunks[i]}\n\`\`\``
                };
                if (i === 0) embed.title = `${getProcessIcon()} [${getBaseProcessName()}] ${level} BATCH`;
                if (i === chunks.length - 1) {
                    embed.footer = { text: `${logs.length} logs • ${new Date().toUTCString()}` };
                }
                embeds.push(embed);
            }

            const success = await sendToWebhook(pingContent, embeds, 0, webhookUrl);
            if (success) logs.forEach(l => successfulIds.push(l._id));
        }

        // Remove all successfully sent logs
        if (successfulIds.length > 0) {
            await Log.deleteMany({ _id: { $in: successfulIds } });
        }

    } catch (err) {
        internalError(err);
    } finally {
        flushing = false;
    }
}

setInterval(flushQueue, FLUSH_INTERVAL);

// ================= CALLER =================
function getCallerInfo() {
    const stack = new Error().stack?.split('\n')[4];
    const match = stack?.match(/\((.*):(\d+):(\d+)\)/);
    if (!match) return 'unknown';
    return `${path.basename(match[1])}:${match[2]}`;
}

// ================= EMBED SENDER =================
function sendEmbed(level, message, ping = false) {
    try {
        const text =
            typeof message === 'string'
                ? message
                : inspect(message, { depth: 4 });

        const clean = stripAnsi(text);
        const chunks = chunkString(clean, MAX_LENGTH);

        chunks.forEach((chunk, i) => {
            const payload = {
                content: undefined,
                embeds: [{
                    title: `${getProcessIcon()} [${getBaseProcessName()}] ${level} LOG`,
                    color: level === 'ERROR' || level === 'SHUTDOWN' ? EMBED_COLORS[level] : (getProcessColor() ?? EMBED_COLORS[level] ?? 0x2f3136),
                    description: `\`\`\`\n${chunk}\n\`\`\``,
                    footer: {
                        text: `${getCallerInfo()} • ${new Date().toUTCString()}`
                    }
                }]
            };

            enqueue(payload, level); // pass the level here
        });
    } catch (err) {
        internalError(err);
    }
}

// ================= CORE =================
function write(message = '', prefix = '', colors = true) {
    const inspected = inspect(message, {
        depth: 4,
        colors: Boolean(colors && typeof message !== 'string')
    });

    inspected.split('\n').forEach((line, i) => {
        console.log(i === 0 ? prefix + line : line);
    });
}

// ================= LOG LEVELS =================
function info(msg) {
    write(msg, `${color.yellow}[${getTimestamp()}]${color.reset} ${color.turquoise}[INFO]${color.reset}: `);
    sendEmbed('INFO', msg);
}

function warn(msg) {
    write(msg, `${color.orange}[${getTimestamp()}]${color.reset} ${color.turquoise}[WARN]${color.reset}: `);
    sendEmbed('WARN', msg);
}

function error(msg) {
    const err = msg?.stack || msg?.message || msg;
    write(err, `${color.red}[${getTimestamp()}]${color.reset} ${color.turquoise}[ERROR]${color.reset}: `, false);
    sendEmbed('ERROR', err);
}

function success(msg) {
    write(msg, `${color.green}[${getTimestamp()}]${color.reset} ${color.turquoise}[SUCCESS]${color.reset}: `);
    sendEmbed('SUCCESS', msg);
}

function debug(msg) {
    write(msg, `${color.blue}[${getTimestamp()}]${color.reset} ${color.turquoise}[DEBUG]${color.reset}: `);
    sendEmbed('DEBUG', msg);
}

function logging(msg) {
    write(msg, `${color.pink}[${getTimestamp()}]${color.reset} ${color.turquoise}[LOG]${color.reset}: `);
    sendEmbed('LOG', msg);
}

// ================= CONSOLE HOOK (SAFE) =================
['log', 'warn', 'error', 'debug'].forEach(type => {
    const original = console[type];

    console[type] = (...args) => {
        original(...args);

        // Prevent recursion from logger failures
        if (args.some(a => String(a).includes('[LOGGER ERROR]'))) return;

        const msg = stripAnsi(
            args.map(a =>
                typeof a === 'string' ? a : inspect(a, { depth: 4 })
            ).join(' ')
        );

        sendEmbed(`CONSOLE:${type.toUpperCase()}`, msg);
    };
});

// ================= SHUTDOWN / CRASH =================
async function logBeforeExit(reason, code = 0, crash = false) {
    sendEmbed(
        crash ? 'ERROR' : 'SHUTDOWN',
        {
            reason,
            exitCode: code,
            pid: process.pid,
            uptime: `${Math.floor(process.uptime())}s`,
            memory: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
        },
    );

    await new Promise(r => setTimeout(r, 1500));
}

process.on('exit', (code) => {
    sendEmbed('SHUTDOWN', { event: 'Process exit', exitCode: code });
});

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(signal => {
    process.on(signal, async () => {
        await logBeforeExit(`Received ${signal}`, 0, false);
        process.exit(0);
    });
});

// NOTE: process.exit() removed — errorHandlers.js (loaded later via modules/index.js)
// manages the full anti-crash lifecycle with a death-spiral guard.
// These handlers only LOG; they never kill the process.
process.on('uncaughtException', (err) => {
    // Skip dead interaction errors — extremely common and fully benign
    const dead = new Set([10062, 40060, 10008]);
    if (dead.has(err?.code)) return;
    if (/unknown interaction/i.test(err?.message ?? '')) return;
    internalError(err);
});

process.on('unhandledRejection', (reason) => {
    const dead = new Set([10062, 40060, 10008]);
    if (dead.has(reason?.code)) return;
    if (/unknown interaction/i.test(reason?.message ?? '')) return;
    if (reason?.status === 429 || reason?.code === 429) return; // discord.js retries 429s
    internalError(reason);
});

// ================= EXPORTS =================
module.exports = {
    info,
    warn,
    error,
    success,
    debug,
    logging,
    write,
    color,
    getTimestamp
};