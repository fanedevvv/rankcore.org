const { DiscordAPIError } = require('discord.js');

const ERROR_MAP = {
    10003: 'Unknown channel (deleted or inaccessible)',
    10008: 'Unknown message (already deleted)',
    10013: 'Missing permissions',
    10062: 'Unknown interaction (expired or already replied)',
    40001: 'Invalid bot token',
    40060: 'Interaction already acknowledged',
    50001: 'Missing access to the resource',
    50007: 'Cannot message this user (DMs closed or blocked)',
    50013: 'Bot lacks required permissions',
    50035: 'Invalid request data sent to Discord',
    50045: 'File too large to upload',
};

const SILENT_CODES = new Set([10008, 10062, 40060, 50007]);
const SWALLOW_CODES = new Set([...SILENT_CODES, 10003, 50001, 50013]);

function translateDiscordError(error) {
    if (error instanceof DiscordAPIError)
        return ERROR_MAP[error.code] || `Discord API Error (${error.code})`;
    if (error?.code === 'ECONNRESET') return 'Connection reset by Discord';
    if (error?.code === 'ETIMEDOUT')  return 'Request to Discord timed out';
    return 'Unknown Discord-related error';
}

function getErrorSource(stack = '') {
    if (stack.includes('/Commands/'))  return 'Slash Command';
    if (stack.includes('/Events/'))    return 'Event Handler';
    if (stack.includes('/Systems/'))   return 'System Module';
    if (stack.includes('kazagumo'))    return 'Music System';
    if (stack.includes('discord.js'))  return 'Discord.js Core';
    return 'Application Code';
}

function extractContext(error) {
    return {
        userId:    error?.interaction?.user?.id   || error?.user?.id    || error?.author?.id || null,
        guildId:   error?.interaction?.guildId    || error?.guild?.id   || null,
        channelId: error?.interaction?.channelId  || error?.channel?.id || null,
    };
}

const CIRCUIT_THRESHOLD = 10;
const CIRCUIT_WINDOW_MS = 60_000;
const rateLimitBuckets  = new Map();

function trackRateLimit(route) {
    const now    = Date.now();
    const cutoff = now - CIRCUIT_WINDOW_MS;
    let hits     = (rateLimitBuckets.get(route) || []).filter(ts => ts > cutoff);
    hits.push(now);
    rateLimitBuckets.set(route, hits);
    if (hits.length === CIRCUIT_THRESHOLD) {
        console.warn(
            `\x1b[31m[RATE LIMIT CIRCUIT]\x1b[0m Route \x1b[33m${route}\x1b[0m ` +
            `hit \x1b[1m${hits.length}×\x1b[0m in 60 s — review what's hammering this endpoint.`
        );
    }
    return hits.length;
}

function logDiscordError(error, context = 'RUNTIME') {
    if (SILENT_CODES.has(error?.code)) {
        console.log(`\x1b[90m[${context}] Swallowed ${error.code}: ${ERROR_MAP[error.code]}\x1b[0m`);
        return;
    }

    const simple     = translateDiscordError(error);
    const source     = getErrorSource(error.stack);
    const ctx        = extractContext(error);
    const stackLines = error.stack?.split('\n') || [];
    const location   = stackLines.find(l =>
        l.includes('/Commands/') || l.includes('/Events/') ||
        l.includes('/Systems/')
    ) || stackLines[1] || 'Unknown location';

    const api  = { code: error.code, status: error.status, method: error.method, url: error.url };
    const body = error.requestBody?.json || error.requestData || null;

    console.log(
        `\n\x1b[31m========== DISCORD ERROR ==========\x1b[0m\n` +
        `\x1b[90mContext:\x1b[0m       ${context}\n` +
        `\x1b[90mMessage:\x1b[0m       ${simple}\n` +
        `\x1b[90mRaw:\x1b[0m           ${error.message}\n\n` +
        `\x1b[36mFile:\x1b[0m          ${location.trim()}\n` +
        `\x1b[36mSource:\x1b[0m        ${source}\n\n` +
        `\x1b[35mUser:\x1b[0m          ${ctx.userId    ?? 'N/A'}\n` +
        `\x1b[35mGuild:\x1b[0m         ${ctx.guildId   ?? 'N/A'}\n` +
        `\x1b[35mChannel:\x1b[0m       ${ctx.channelId ?? 'N/A'}\n\n` +
        `\x1b[33mAPI Code:\x1b[0m      ${api.code   ?? 'N/A'}\n` +
        `\x1b[33mHTTP Status:\x1b[0m   ${api.status ?? 'N/A'}\n` +
        `\x1b[33mMethod:\x1b[0m        ${api.method ?? 'N/A'}\n` +
        `\x1b[33mEndpoint:\x1b[0m      ${api.url    ?? 'N/A'}\n\n` +
        `\x1b[32mRequest Body:\x1b[0m\n${JSON.stringify(body, null, 2) || 'None'}\n\n` +
        `\x1b[31mStack:\x1b[0m\n${error.stack}\n` +
        `\x1b[31m===================================\x1b[0m\n`
    );
}

function handleRateLimit(info) {
    const hitCount = trackRateLimit(info.route);
    const stack    = new Error().stack?.split('\n')?.slice(2, 8)?.join('\n') || 'Unknown';

    console.log(
        `\n\x1b[33m========== DISCORD RATE LIMIT ==========\x1b[0m\n` +
        `\x1b[36mRoute:\x1b[0m        ${info.route}\n` +
        `\x1b[36mMethod:\x1b[0m       ${info.method}\n` +
        `\x1b[36mEndpoint:\x1b[0m     ${info.url}\n` +
        `\x1b[36mBucket:\x1b[0m       ${info.hash}\n` +
        `\x1b[36mMajor Param:\x1b[0m  ${info.majorParameter}\n` +
        `\x1b[36mTimeout:\x1b[0m      ${info.timeout}ms\n` +
        `\x1b[36mLimit:\x1b[0m        ${info.limit}\n` +
        `\x1b[36mGlobal:\x1b[0m       ${info.global}\n` +
        `\x1b[36mHits (60s):\x1b[0m   ${hitCount}\n` +
        `\n\x1b[35mTriggered From:\x1b[0m\n${stack}\n` +
        `\x1b[33m========================================\x1b[0m\n`
    );
}

function startGatewayWatchdog(client) {
    const CHECK_INTERVAL  = 30_000;
    const STALE_THRESHOLD = 90_000;
    const RETRY_BASE_MS   = 15_000;
    const RETRY_CAP_MS    = 5 * 60_000;
    let reconnecting    = false;
    let reconnectCount  = 0;

    // ── Rotating-status loop owned by the watchdog ────────────────────────────
    // ready.js registers the interval once (once:true), but client.destroy()
    // clears all timers managed by discord.js internally and the ClientReady
    // event is not re-emitted on re-login in the same process. The watchdog
    // therefore owns its own rotating loop that survives reconnects.
    const { ActivityType } = require('discord.js');
    let _rotateInterval = null;

    function startRotatingStatus() {
        if (_rotateInterval) clearInterval(_rotateInterval);
        _rotateInterval = setInterval(() => {
            if (client.config?.overrideStatus) return;
            if (!client.isReady()) return;

            const uptimeMs = client.uptime || 0;
            const vars = {
                guilds:   client.guilds.cache.size,
                users:    client.users.cache.size,
                commands: client.commands?.size || 0,
                uptime:   `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
            };
            // Activity texts come from src/config/bot.js → activities
            const texts = Array.isArray(client.config?.activities) && client.config.activities.length
                ? client.config.activities : ['rankcore.org'];
            const activities = texts.map(t => ({
                type: ActivityType.Custom,
                name: String(t).replace(/\{(guilds|users|commands|uptime)\}/g, (_, k) => vars[k]),
            }));
            const activity = activities[Math.floor(Math.random() * activities.length)];
            try {
                client.user.setPresence({
                    status:     client.config?.status || 'online',
                    activities: [activity],
                });
            } catch (_) {}
        }, client.config?.activityIntervalMs || 15_000);
    }

    // Kick the watchdog-owned loop immediately (ready.js will also start its own
    // copy on first boot — both running is harmless, they just race to pick a
    // random activity, and the watchdog copy survives reconnects).
    // We defer slightly so client.config is guaranteed to be populated.
    setTimeout(() => startRotatingStatus(), 5000);

    // resumeRotatingStatus: emitted by both the watchdog (after reconnect) and
    // ready.js; restart the loop and immediately set an initial presence so
    // the bot is visible right away rather than waiting up to 7.5 s.
    client.on('resumeRotatingStatus', () => {
        startRotatingStatus();
        if (client.config?.overrideStatus || !client.isReady()) return;
        try {
            client.user.setPresence({
                status:     client.config?.status || 'online',
                activities: [{ type: ActivityType.Custom, name: String(client.config?.activities?.[0] || 'rankcore.org') }],
            });
        } catch (_) {}
    });

    async function attemptReconnect() {
        if (reconnecting) return;
        reconnecting = true;

        const delay = Math.min(RETRY_BASE_MS * (2 ** reconnectCount), RETRY_CAP_MS);
        reconnectCount++;
        console.warn(
            `\x1b[33m[WATCHDOG]\x1b[0m Reconnect attempt ${reconnectCount} scheduled in ${(delay / 1000).toFixed(0)}s…`
        );

        setTimeout(async () => {
            try {
                try { await client.destroy(); } catch {}
                await new Promise(r => setTimeout(r, 3000));
                await client.login(process.env.token);
                console.log('\x1b[32m[WATCHDOG]\x1b[0m Reconnect successful.');
                reconnectCount = 0; // reset backoff on success

                // Wait for the gateway to be truly ready before touching presence.
                // client.isReady() may still be false right after login() resolves.
                await new Promise((resolve) => {
                    if (client.isReady()) return resolve();
                    client.once('clientReady', resolve);
                    // Safety timeout: don't wait forever
                    setTimeout(resolve, 10_000);
                });

                try {
                    if (client.config?.overrideStatus) {
                        client.user.setPresence({
                            status:     client.config.overrideStatusValue || 'online',
                            activities: [client.config.overrideActivity],
                        });
                    } else {
                        // Set an immediate presence and restart the rotating loop
                        client.user.setPresence({
                            status:     client.config?.status || 'online',
                            activities: [{ type: ActivityType.Custom, name: String(client.config?.activities?.[0] || 'rankcore.org') }],
                        });
                        startRotatingStatus();
                    }
                    console.log('\x1b[32m[WATCHDOG]\x1b[0m Presence restored.');
                } catch (presenceErr) {
                    console.error('\x1b[33m[WATCHDOG]\x1b[0m Failed to restore presence:', presenceErr.message);
                }
            } catch (err) {
                console.error(`\x1b[31m[WATCHDOG]\x1b[0m Reconnect attempt ${reconnectCount} failed — will retry:\n`, err.message);
                reconnecting = false;
                attemptReconnect();
                return;
            }
            reconnecting = false;
        }, delay);
    }

    // Ping is -1 until the first heartbeat ACK (~40s after login), so a single -1
    // reading is normal. Only treat the gateway as stale when the client is ready
    // and ping has stayed at -1 for longer than STALE_THRESHOLD.
    let staleSince = null;

    setInterval(async () => {
        if (reconnecting || !client.isReady()) { staleSince = null; return; }

        const ping = client.ws?.ping ?? -1;
        if (ping !== -1) { staleSince = null; return; }

        staleSince ??= Date.now();
        const staleness = Date.now() - staleSince;

        if (staleness > STALE_THRESHOLD) {
            console.warn(
                `\x1b[33m[WATCHDOG]\x1b[0m Gateway appears stale ` +
                `(no heartbeat ACK for ${Math.round(staleness / 1000)}s). Attempting reconnect…`
            );
            staleSince = null;
            attemptReconnect();
        }
    }, CHECK_INTERVAL);
}

module.exports = (client) => {
    client.on('error',      (error)           => logDiscordError(error, 'CLIENT'));
    client.on('shardError', (error, shardId)  => logDiscordError(error, `SHARD ${shardId}`));
    client.on('warn',       (warning)         => console.log(`\x1b[33m[DISCORD WARNING]\x1b[0m ${warning}`));

    client.rest.on('rateLimited', handleRateLimit);

    startGatewayWatchdog(client);

    // ── Anti-crash: death-spiral guard ──────────────────────────────────────────
    // If we get more than 10 fatal uncaught exceptions in 60 s something is
    // genuinely broken and PM2 should take over — otherwise stay alive.
    const _fatalWindow   = 60_000;
    const _fatalMaxCount = 10;
    const _fatalTimes    = [];

    process.on('unhandledRejection', (error) => {
        if (error?.status === 429 || error?.code === 429) {
            const route = error?.url || error?.route || 'unknown route';
            const hits  = trackRateLimit(route);
            console.warn(
                `\x1b[33m[429 REJECTION]\x1b[0m ${route} — ` +
                `retry after ${error?.retryAfter ?? '?'}ms (${hits} hit(s) in 60 s). ` +
                `discord.js will retry automatically.`
            );
            return;
        }

        if (error instanceof DiscordAPIError && SWALLOW_CODES.has(error.code)) {
            logDiscordError(error, 'UNHANDLED REJECTION');
            return;
        }

        if (error instanceof DiscordAPIError) {
            logDiscordError(error, 'UNHANDLED REJECTION');
            return;
        }

        // Non-Discord rejection — log but never crash
        console.error('\x1b[31m[UNHANDLED REJECTION]\x1b[0m Caught and swallowed to prevent crash:', error?.message || error);
        if (error?.stack) console.error(error.stack);
    });

    process.on('uncaughtException', async (error) => {
        if (error?.status === 429 || error?.code === 429) {
            console.warn(`\x1b[33m[UNCAUGHT 429]\x1b[0m Rate limit surfaced as exception — staying alive.`);
            return;
        }

        if (error instanceof DiscordAPIError && SWALLOW_CODES.has(error.code)) {
            logDiscordError(error, 'UNCAUGHT EXCEPTION (swallowed)');
            return;
        }

        if (error instanceof DiscordAPIError) {
            logDiscordError(error, 'UNCAUGHT EXCEPTION (swallowed)');
            return;
        }

        // General uncaught exception — log, track frequency, stay alive
        logDiscordError(error, 'UNCAUGHT EXCEPTION — RECOVERED');
        console.error('\x1b[33m[ANTI-CRASH]\x1b[0m Exception caught and suppressed — bot stays running.\n', error?.message || error);
        if (error?.stack) console.error(error.stack);

        // Death-spiral guard: if errors are coming too fast, something is truly broken
        const now    = Date.now();
        const cutoff = now - _fatalWindow;
        while (_fatalTimes.length && _fatalTimes[0] < cutoff) _fatalTimes.shift();
        _fatalTimes.push(now);

        if (_fatalTimes.length >= _fatalMaxCount) {
            console.error(
                `\x1b[31m[ANTI-CRASH]\x1b[0m ${_fatalMaxCount} uncaught exceptions in ${_fatalWindow / 1000}s — ` +
                `death spiral detected. Letting PM2 restart for a clean recovery.`
            );
            try { await client.destroy(); } catch {}
            process.exit(1);
        }
    });
};