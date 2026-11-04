/*
 * -------------------------------
 * ROCO BOT API SERVER
 * -------------------------------
 * This file contains all Express.js routes and middleware for the bot's dashboard API.
 * It is loaded by the main index.js and passed the 'client' object.
 */

// -------------------------------
// Module Imports
// -------------------------------
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const axios      = require('axios');
const { color, getTimestamp } = require('../../Utils/logEffects.js');
const { getClusterStatus, formatUptime } = require('../lib/utils.js');
const { collectStatus, lookupGuild: wsLookupGuild } = require('../ws/statusCollector.js');
const cache = require('../lib/cache.js');

// -------------------------------
// Schema Imports
// -------------------------------

const Antinuke        = require('../../Schemas/antinukeSchema');
const AntiRaid        = require('../../Schemas/AntiRaidSchema');
const AntiSpam        = require('../../Schemas/AntiSpamSchema');
const LinkConfig      = require('../../Schemas/LinkConfigSchema');
const Verification    = require('../../Schemas/verificationSchema');
const AiConfig        = require('../../Schemas/aiSchema');
const WelcomeMessage  = require('../../Schemas/welcomeMessageSchema');
const GoodbyeMessage  = require('../../Schemas/goodbyeMessageSchema');

// -------------------------------
// Rate Limit & Security Config
// -------------------------------
const GLOBAL_RPS_THRESHOLD = 60;
const WINDOW_MS            = 10_000;        // 10s sliding window
const MAX_REQ              = 30;            // max requests per window
const BURST_MS             = 1_000;         // 1s burst window
const BURST_MAX            = 10;            // max requests per burst
const TEMP_BLOCK_MS        = 5 * 60 * 1000; // 5-minute temp block
const MAX_STRIKES          = 5;             // strikes before perma-ban
const MAX_BODY_SIZE        = '10kb';

// Scanners / automated tools — blocked by user-agent
const BLOCKED_UA_PATTERNS = [
    /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
    /python-requests/i, /go-http-client/i, /libwww-perl/i,
    /scrapy/i, /wget/i, /dirbuster/i, /gobuster/i, /hydra/i
];

// Honeypot paths — anyone requesting these gets a strike
const HONEYPOT_PATHS = [
    '/wp-admin', '/wp-login.php', '/.env', '/admin', '/phpinfo.php',
    '/config.php', '/.git', '/etc/passwd', '/actuator', '/setup.php',
    '/shell', '/cgi-bin'
];

// -------------------------------
// Tracking State
// -------------------------------
let globalRequestCount = 0;
let lastGlobalCheck    = Date.now();
let globalAttackActive = false;

const rateMap    = new Map(); // ip -> { count, start }
const burstMap   = new Map(); // ip -> { count, start }
const tempBlocked = new Map(); // ip -> unblock timestamp
const strikes    = new Map(); // ip -> strike count
const permBanned = new Set(); // permanently banned IPs

// -------------------------------
// Helpers
// -------------------------------

/**
 * Reliably extract the real client IP, stripping IPv6 prefix.
 *
 * SEC-FIX: Use req.ip which Express normalises according to the 'trust proxy'
 * setting (set to 1 above). Reading x-forwarded-for or x-real-ip directly
 * allows any client to spoof their IP and bypass rate-limiting / ban logic.
 */
function getIp(req) {
    return (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

/**
 * Add a strike to an IP. Perma-ban after MAX_STRIKES.
 */
function addStrike(ip, reason = '') {
    const count = (strikes.get(ip) || 0) + 1;
    strikes.set(ip, count);
    console.warn(`[SECURITY] Strike ${count}/${MAX_STRIKES} — ${ip}${reason ? ` (${reason})` : ''}`);

    if (count >= MAX_STRIKES) {
        permBanned.add(ip);
        strikes.delete(ip);
        rateMap.delete(ip);
        burstMap.delete(ip);
        tempBlocked.delete(ip);
        console.warn(`[SECURITY] PERMANENT BAN: ${ip}`);
    }
}

/**
 * Returns true if the user-agent looks like a scanner/bot.
 */
function isSuspiciousUA(ua = '') {
    if (!ua || ua.trim() === '') return true;
    return BLOCKED_UA_PATTERNS.some(p => p.test(ua));
}

// -------------------------------
// Periodic Memory Cleanup
// -------------------------------
setInterval(() => {
    const now = Date.now();
    for (const [ip, d] of rateMap)    if (now - d.start > WINDOW_MS) rateMap.delete(ip);
    for (const [ip, d] of burstMap)   if (now - d.start > BURST_MS)  burstMap.delete(ip);
    for (const [ip, t] of tempBlocked) if (now >= t)                  tempBlocked.delete(ip);
}, 60_000);

// ============================================================
// EXPORTED APP
// ============================================================
module.exports = (client) => {
    const app  = express();
    const port = 5181;

    app.set('trust proxy', 1); // trust one reverse-proxy hop only — 'true' trusts ALL and allows IP spoofing
    app.disable('x-powered-by'); // Don't leak "Express" in headers

    // ──────────────────────────────────────────────
    // Security Headers
    // ──────────────────────────────────────────────
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
        next();
    });

    // ──────────────────────────────────────────────
    // CORS — restricted to known origins
    // ──────────────────────────────────────────────
    const ALLOWED_ORIGINS = [
        'https://rocobot.xyz',
        'https://www.rocobot.xyz',
        'https://dash.rocobot.xyz'
    ];

    app.use(cors({
        origin: (origin, cb) => {
            // Allow requests with no origin (server-to-server) or a known origin
            if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
            cb(new Error('CORS: origin not allowed'));
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    }));

    // ──────────────────────────────────────────────
    // Body Parser — strict size limit
    // ──────────────────────────────────────────────
    app.use(bodyParser.json({ limit: MAX_BODY_SIZE }));

    // ============================================================
    // SECURITY MIDDLEWARE STACK (applied in order)
    // ============================================================

    // 1. Permanent ban check
    app.use((req, res, next) => {
        if (permBanned.has(getIp(req)))
            return res.status(403).json({ error: 'Forbidden.' });
        next();
    });

    // 2. Honeypot — strike anyone probing sensitive paths
    app.use((req, res, next) => {
        const path = req.path.toLowerCase();
        if (HONEYPOT_PATHS.some(p => path.startsWith(p))) {
            addStrike(getIp(req), `honeypot: ${req.path}`);
            return res.status(404).json({ error: 'Not found.' });
        }
        next();
    });

    // 3. User-agent filtering — block scanners
    app.use((req, res, next) => {
        const ua = req.headers['user-agent'] || '';
        if (isSuspiciousUA(ua)) {
            addStrike(getIp(req), `bad UA: "${ua.slice(0, 80)}"`);
            return res.status(403).json({ error: 'Forbidden.' });
        }
        next();
    });

    // 4. Temp block check
    app.use((req, res, next) => {
        const ip = getIp(req);
        const blockedUntil = tempBlocked.get(ip);
        if (blockedUntil) {
            if (Date.now() < blockedUntil)
                return res.status(429).json({ error: 'Too many requests. Try again later.' });
            tempBlocked.delete(ip);
        }
        next();
    });

    // 5. Global RPS guard
    app.use((_req, res, next) => {
        const now = Date.now();
        globalRequestCount++;
        if (now - lastGlobalCheck > 1000) {
            globalAttackActive = globalRequestCount > GLOBAL_RPS_THRESHOLD;
            globalRequestCount = 0;
            lastGlobalCheck    = now;
        }
        if (globalAttackActive)
            return res.status(503).json({ error: 'Server under high load. Try again later.' });
        next();
    });

    // 6. Burst limit — 10 req/s per IP
    app.use((req, res, next) => {
        const ip  = getIp(req);
        const now = Date.now();

        let burst = burstMap.get(ip);
        if (!burst || now - burst.start > BURST_MS) burst = { count: 1, start: now };
        else burst.count++;
        burstMap.set(ip, burst);

        if (burst.count > BURST_MAX) {
            addStrike(ip, 'burst limit');
            tempBlocked.set(ip, now + TEMP_BLOCK_MS);
            return res.status(429).json({ error: 'Rate limit exceeded.' });
        }
        next();
    });

    // 7. Sliding window — 30 req/10s per IP
    app.use((req, res, next) => {
        const ip  = getIp(req);
        const now = Date.now();

        let entry = rateMap.get(ip);
        if (!entry || now - entry.start > WINDOW_MS) entry = { count: 1, start: now };
        else entry.count++;
        rateMap.set(ip, entry);

        if (entry.count > MAX_REQ) {
            addStrike(ip, 'window limit');
            tempBlocked.set(ip, now + TEMP_BLOCK_MS);
            return res.status(429).json({ error: 'Rate limit exceeded. Please slow down.' });
        }
        next();
    });

    // 8. Redis-based cross-process rate limit (30 req / 10s per IP)
    app.use(async (req, res, next) => {
        const ip = getIp(req);
        const { allowed, remaining, resetMs } = await cache.checkRateLimit(`api:ip:${ip}`, 30, 10_000);
        if (!allowed) {
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetMs / 1000)));
            res.setHeader('Retry-After', String(Math.ceil(resetMs / 1000)));
            return res.status(429).json({ error: 'Too many requests.' });
        }
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        next();
    });

    // ============================================================
    // ROUTES
    // ============================================================

    // Health check
    app.get('/api/test', (_req, res) => res.json({ ok: true }));

    // ────────── Bot Info ──────────
    app.get('/api/bot-info', (req, res) => {
        try {
            const ready = client?.isReady() ?? false;
            if (!ready) {
                // Return a consistent shape so the API page can show
                // "starting up / reconnecting" instead of a hard error.
                return res.json({
                    ready:        false,
                    totalUsers:   0,
                    totalServers: 0,
                    ping:         -1,
                    channels:     0,
                    nodeVersion:  process.version,
                    uptime:       0,
                });
            }
            res.json({
                ready:        true,
                totalUsers:   client.users.cache.size,
                totalServers: client.guilds.cache.size,
                ping:         client.ws.ping,
                channels:     client.channels.cache.size,
                nodeVersion:  process.version,
                uptime:       client.uptime,
            });
        } catch (err) {
            console.error('[/api/bot-info]', err);
            res.status(500).json({ error: 'Failed to retrieve bot info.' });
        }
    });

    // ────────── Public website (rocobot.xyz) ──────────
    // Same response shapes the site previously got from its Supabase functions.
    const siteCache = { stats: null, statsAt: 0, commands: null, gateway: null, gatewayAt: 0 };
    const SITE_TTL_MS = 60_000;

    app.get('/api/site/stats', async (_req, res) => {
        try {
            if (!client?.isReady()) return res.status(503).json({ error: 'Bot is starting up.' });
            if (siteCache.stats && Date.now() - siteCache.statsAt < SITE_TTL_MS)
                return res.json(siteCache.stats);

            // Session-start limits change rarely — refresh at most every 10 minutes
            if (!siteCache.gateway || Date.now() - siteCache.gatewayAt > 600_000) {
                siteCache.gateway   = await client.rest.get('/gateway/bot').catch(() => siteCache.gateway);
                siteCache.gatewayAt = Date.now();
            }
            const gw = siteCache.gateway || {};

            const guilds = client.guilds.cache.map(g => ({
                id:          g.id,
                name:        g.name,
                icon:        g.icon,
                memberCount: g.memberCount ?? 0,
                owner:       g.ownerId === client.user.id,
            }));
            siteCache.stats = {
                bot: {
                    username:      client.user.username,
                    discriminator: client.user.discriminator,
                    id:            client.user.id,
                    avatar:        client.user.avatar,
                },
                servers:      guilds.length,
                totalMembers: guilds.reduce((sum, g) => sum + g.memberCount, 0),
                guilds,
                shards:       client.ws.shards.size || 1,
                sessionStartLimit: {
                    total:          gw.session_start_limit?.total ?? 0,
                    remaining:      gw.session_start_limit?.remaining ?? 0,
                    resetAfter:     gw.session_start_limit?.reset_after ?? 0,
                    maxConcurrency: gw.session_start_limit?.max_concurrency ?? 1,
                },
            };
            siteCache.statsAt = Date.now();
            res.json(siteCache.stats);
        } catch (err) {
            console.error('[/api/site/stats]', err);
            res.status(500).json({ error: 'Failed to retrieve stats.' });
        }
    });

    app.get('/api/site/commands', (_req, res) => {
        try {
            if (!siteCache.commands) {
                const params = opts => (opts || [])
                    .map(o => (o.required ? ` <${o.name}>` : ` [${o.name}]`)).join('');
                const commands = [];
                for (const cmd of client.commands.values()) {
                    if (typeof cmd?.data?.toJSON !== 'function') continue;
                    const json   = cmd.data.toJSON();
                    const base   = `/${json.name}`;
                    const opts   = json.options || [];
                    const subs   = opts.filter(o => o.type === 1);
                    const groups = opts.filter(o => o.type === 2);
                    for (const g of groups)
                        for (const s of g.options || [])
                            commands.push({ name: `${base} ${g.name} ${s.name}`, desc: s.description, usage: `${base} ${g.name} ${s.name}${params(s.options)}`, parentName: json.name });
                    for (const s of subs)
                        commands.push({ name: `${base} ${s.name}`, desc: s.description, usage: `${base} ${s.name}${params(s.options)}`, parentName: json.name });
                    if (!subs.length && !groups.length)
                        commands.push({ name: base, desc: json.description, usage: `${base}${params(opts)}`, parentName: json.name });
                }
                siteCache.commands = { commands, totalRaw: client.commands.size, totalFlattened: commands.length };
            }
            res.json(siteCache.commands);
        } catch (err) {
            console.error('[/api/site/commands]', err);
            res.status(500).json({ error: 'Failed to retrieve commands.' });
        }
    });

    // Changelogs published from the owner panel (also posted to Discord by src/lib/changelogAnnouncer.js)
    app.get('/api/site/changelogs', async (_req, res) => {
        try {
            const Changelogs = require('../../Schemas/changelogs');
            const entries = await Changelogs.find().sort({ date: -1 }).limit(50).lean();
            res.json({
                changelogs: entries.map(e => ({
                    id:          e._id.toString(),
                    date:        e.date ? e.date.toISOString() : null,
                    title:       e.config?.title ?? null,
                    description: e.config?.description ?? '',
                    type:        e.config?.type ?? null,
                })),
            });
        } catch (err) {
            console.error('[/api/site/changelogs]', err);
            res.status(500).json({ error: 'Failed to retrieve changelogs.' });
        }
    });

    app.get('/api/site/uptime', async (_req, res) => {
        try {
            if (siteCache.uptime && Date.now() - siteCache.uptimeAt < SITE_TTL_MS)
                return res.json(siteCache.uptime);

            const StatusSnapshot = require('../../Schemas/StatusSnapshot');
            const history = await StatusSnapshot.buildDailyHistory(90)
                .catch(() => ({ days: [], overallUptime: null, trackedDays: 0 }));

            // Dashboard health — measured from here, so it reflects the real process
            const t0 = Date.now();
            const dashOk = await fetch(`http://127.0.0.1:${process.env.DASHBOARD_PORT || 3010}/health`,
                { signal: AbortSignal.timeout(3000) }).then(r => r.ok).catch(() => false);
            const dashPing = Date.now() - t0;

            const ready = client?.isReady() ?? false;
            siteCache.uptime = {
                services: [
                    { name: 'Website',   status: 'operational', ping: null },
                    { name: 'Dashboard', status: dashOk ? 'operational' : 'down', ping: dashOk ? dashPing : null },
                    { name: 'Bot',       status: ready ? 'operational' : 'down', ping: ready ? client.ws.ping : null },
                ],
                days:          history.days.map(d => ({ date: d.date, state: d.state, uptime: d.uptime })),
                overallUptime: history.overallUptime,
                trackedDays:   history.trackedDays,
                botUptimeMs:   ready ? client.uptime : 0,
            };
            siteCache.uptimeAt = Date.now();
            res.json(siteCache.uptime);
        } catch (err) {
            console.error('[/api/site/uptime]', err);
            res.status(500).json({ error: 'Failed to retrieve uptime.' });
        }
    });

    // ────────── Uptime ──────────
    app.get('/api/uptime', (_req, res) => {
        try {
            res.json({
                success:         true,
                message:         'API is online',
                serverUptime:    process.uptime(),
                formattedUptime: formatUptime(process.uptime() * 1000),
            });
        } catch (err) {
            console.error('[/api/uptime]', err);
            res.status(500).json({ error: 'Failed to retrieve uptime.' });
        }
    });

    // ────────── Discord Avatar / Banner ──────────
    app.get('/api/avatar', async (_req, res) => {
        try {
            const userId     = process.env.OWNER_ID;
            const discordRes = await fetch(`https://discord.com/api/users/${userId}`, {
                headers: { Authorization: `Bot ${process.env.token}` },
            });

            if (!discordRes.ok) {
                console.error('[/api/avatar] Discord API error:', discordRes.status);
                return res.status(502).json({ error: 'Failed to fetch user from Discord.' });
            }

            const data      = await discordRes.json();
            const bannerUrl = data.banner
                ? `https://cdn.discordapp.com/banners/${data.id}/${data.banner}.${data.banner.startsWith('a_') ? 'gif' : 'png'}?size=1024`
                : null;

            res.json({
                id:            data.id,
                username:      data.username,
                avatar:        data.avatar,
                discriminator: data.discriminator,
                banner:        bannerUrl,
                bio:           data.bio || data.description || null,
            });
        } catch (err) {
            console.error('[/api/avatar]', err);
            res.status(500).json({ error: 'Server error fetching user.' });
        }
    });

    // ────────── Devs Info ──────────
    app.get('/api/devs-info', async (_req, res) => {
        const devIds = [process.env.OWNER_ID].filter(Boolean);

        // Not ready yet — return empty map so the page can render with placeholders
        if (!client?.isReady())
            return res.json({ success: true, devs: {} });

        try {
            const devInfoMap = {};

            await Promise.all(devIds.map(async (id) => {
                try {
                    const user = await client.users.fetch(id, { force: true });
                    devInfoMap[id] = {
                        username:  user.username,
                        avatarUrl: user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: false }),
                    };
                } catch (fetchErr) {
                    console.warn(`[/api/devs-info] Could not fetch user ${id}:`, fetchErr.message);
                    devInfoMap[id] = { username: 'Unknown', avatarUrl: null };
                }
            }));

            res.json({ success: true, devs: devInfoMap });
        } catch (err) {
            console.error('[/api/devs-info]', err);
            res.status(500).json({ success: false, error: 'Failed to fetch developer data.' });
        }
    });

    // ────────── Cluster Info ──────────
    app.get('/api/clusters', async (_req, res) => {
        try {
            const status = collectStatus(client);
            res.json([{
                id:      status.cluster.id,
                name:    `Cluster #${status.cluster.id}`,
                status:  status.bot.status,
                uptime:  status.bot.uptimeFmt,
                memory:  status.cluster.memory,
                region:  'Global',
                shards:  status.shards.map(s => ({
                    id:     s.id,
                    status: s.status,
                    ping:   s.ping,
                    guilds: s.guildCount,
                })),
            }]);
        } catch (err) {
            console.error('[/api/clusters]', err);
            res.status(500).json({ error: 'Failed to fetch cluster data.' });
        }
    });

    // ────────── Guild Lookup ──────────
    app.get('/api/lookup/:guildId', async (req, res) => {
        const { guildId } = req.params;

        if (!/^\d{17,20}$/.test(guildId))
            return res.status(400).json({ error: 'Invalid guild ID.' });

        try {
            const result = wsLookupGuild(client, guildId);
            if (!result.found)
                return res.status(404).json({ error: 'Guild not found.' });
            res.json({
                clusterId:   result.clusterId,
                clusterName: `Cluster #${result.clusterId}`,
                shardId:     result.shardId,
                via:         result.via,
                guild:       result.guild || null,
            });
        } catch (err) {
            console.error('[/api/lookup]', err);
            res.status(500).json({ error: 'Internal error during lookup.' });
        }
    });

    // ────────── Full Status (from WSS collector) ──────────
    app.get('/api/status', (_req, res) => {
        try {
            const status = collectStatus(client);
            res.json(status);
        } catch (err) {
            console.error('[/api/status]', err);
            res.status(500).json({ error: 'Failed to collect status.' });
        }
    });

    // ────────── WSS Info ──────────
    app.get('/api/wss-info', (_req, res) => {
        try {
            res.json({
                enabled:     true,
                url:         'ws://127.0.0.1:5185/status',
                connected:   client._wssServer?.connectedCount ?? 0,
                secret:      !!(client._wssServer?.secret),
            });
        } catch (err) {
            console.error('[/api/wss-info]', err);
            res.status(500).json({ error: 'Failed to get WSS info.' });
        }
    });

    // ────────── Notify Bot Blocked ──────────
    app.post('/api/notify-bot-blocked', async (req, res) => {
        const { botId } = req.body || {};

        if (!botId || typeof botId !== 'string')
            return res.status(400).json({ error: 'Missing or invalid botId.' });

        if (!/^\d{17,20}$/.test(botId))
            return res.status(400).json({ error: 'botId must be a valid Discord snowflake.' });

        try {
            const user = await client.users.fetch(process.env.OWNER_ID);
            await user.send(`<:error:1555544434601369620> Bot \`${botId}\` was detected as malicious and blocked.`);
            res.json({ success: true, message: 'Notification sent.' });
        } catch (err) {
            console.error('[/api/notify-bot-blocked]', err);
            res.status(500).json({ error: 'Failed to send notification.' });
        }
    });

    // ============================================================
    // CATCH-ALL & ERROR HANDLERS
    // ============================================================

    // 404 — unknown routes
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found.' });
    });

    // Global error handler (CORS errors, unhandled throws, bad JSON, etc.)
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        if (err.message?.startsWith('CORS'))
            return res.status(403).json({ error: 'CORS: origin not allowed.' });

        if (err.type === 'entity.parse.failed')
            return res.status(400).json({ error: 'Invalid JSON body.' });

        console.error('[UNHANDLED ERROR]', err);
        res.status(500).json({ error: 'Internal server error.' });
    });

    // -------------------------------
    // Start Server
    // -------------------------------
    const httpServer = app.listen(port, '127.0.0.1', () => {
        console.log(`${color.green}[${getTimestamp()}] [API] Backend server running on port ${port}${color.reset}`);
    });

    // Attach the raw http.Server so modules/index.js stop() can call .close()
    app._server = httpServer;

    return app;
};