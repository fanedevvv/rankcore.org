const express      = require("express");
const router       = express.Router();
const cookieParser = require("cookie-parser");
const helmet       = require("helmet");
const path         = require("path");
const fs           = require("fs");
const csrf         = require("csurf");
require("dotenv").config();

// Inline consent script — eliminates a separate HTTP request on every page load
const CONSENT_SCRIPT = fs.readFileSync(
  path.join(__dirname, "..", "public", "js", "consent-popup.js"),
  "utf8"
);
const app = express();
const globalRateLimiter = require("../../Utils/globalRateLimiter");
const { smartApiLimiter, authRouteLimiter } = require("./Utils/apiRateLimiter");
const { checkBlacklist, apiOnly } = require("../middleware");
const { addRequestLog }  = require("./Utils/dashboardLoggers");

// ---------------------------------------------
// Process-level safety net
// ---------------------------------------------
const { BotOfflineError: _BotOfflineError } = require('../lib/botClient');

// ── Non-fatal error patterns — these should never crash the dashboard ──────────
const NON_FATAL_PATTERNS = [
  'AbortError',            // fetch timeout (signal aborted)
  'ECONNREFUSED',          // bot internal API offline
  'ECONNRESET',            // connection reset mid-request
  'ETIMEDOUT',             // network timeout
  'FetchError',            // node-fetch network error
  'fetch failed',          // undici/native fetch failure
  'network timeout',
  'socket hang up',
  'UND_ERR',               // undici errors
];

function isNonFatal(err) {
  if (!err) return false;
  if (err instanceof _BotOfflineError || err?.isBotOffline) return true;
  const msg = String(err?.message ?? err?.code ?? err ?? '');
  const name = err?.name ?? err?.type ?? '';
  return NON_FATAL_PATTERNS.some(p => msg.includes(p) || name.includes(p));
}

process.on('unhandledRejection', (reason) => {
  if (isNonFatal(reason)) return;
  console.error('[dashboard] Unhandled rejection:', reason?.message ?? reason);
  // Log but do NOT exit — a single background task failure should not kill the server
});

process.on('uncaughtException', (err) => {
  if (isNonFatal(err)) return;
  console.error('[dashboard] Uncaught exception:', err.message, err.stack);
  // Only exit on truly unrecoverable errors (not network failures from background tasks)
  const isFatal = err?.code === 'MODULE_NOT_FOUND' ||
                  err?.message?.includes('Cannot find module') ||
                  err?.message?.includes('EADDRINUSE');
  if (isFatal) process.exit(1);
  // For everything else: log and keep running
});

// ---------------------------------------------
// Schemas
// ---------------------------------------------
const WelcomeMessage    = require("../../Schemas/welcomeMessageSchema");
const GoodbyeMessage    = require("../../Schemas/goodbyeMessageSchema");
const Antinuke          = require("../../Schemas/antinukeSchema");
const AntiScam          = require("../../Schemas/antiscam");
const AutoRole          = require("../../Schemas/autorole");
const Autoresponder     = require("../../Schemas/Autoresponder");
const AIConfig          = require("../../Schemas/aiSchema");
const Christmas         = require("../../Schemas/christmasSchema");
const Halloween         = require("../../Schemas/halloweenSchema");
const ConfessionConfig  = require("../../Schemas/confession");
const Count             = require("../../Schemas/counting");
const GuildInviteConfig = require("../../Schemas/guildInviteConfig");
const JTCConfig         = require("../../Schemas/jointocreate");
const LevelSetup        = require("../../Schemas/levelsetup");
const LevelRole         = require("../../Schemas/levelRoleSchema");
const LogSchema         = require("../../Schemas/logschema");
const MassJoin          = require("../../Schemas/AntiRaidSchema");
const ReactionRole      = require("../../Schemas/reactionrole");
const StickySchema      = require("../../Schemas/stickySchema");
const TicketSetup       = require("../../Schemas/TicketSetup");
const Transcript        = require("../../Schemas/transcript");
const Uptime            = require("../../Schemas/uptimeSchema");
const Verify            = require("../../Schemas/verificationSchema");
const YouTubeNotif      = require("../../Schemas/youtubeSchema");
const TwitchNotif       = require("../../Schemas/twitchSchema");
const db247             = require("../../Schemas/247");
const MemberStats       = require("../../Schemas/memberStats");
const SuggestionConfig  = require("../../Schemas/suggestionSchema");

const GuildCache = require("../../Schemas/guildCacheSchema");

// ---------------------------------------------
// Security Headers
// ---------------------------------------------
const crypto = require("crypto");

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdn.tailwindcss.com",
          (req, res) => `'nonce-${res.locals.nonce}'`,
          "'strict-dynamic'",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: [
          "'self'",
          "data:",
          "https://cdn.discordapp.com",
          "https://i.imgur.com",
          "https://i.pinimg.com",
        ],
        connectSrc: ["'self'"],
        fontSrc:    ["'self'", "https://fonts.gstatic.com"],
        objectSrc:  ["'none'"],
        frameSrc:   ["'none'"],
        mediaSrc:   ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy:   true,
    crossOriginResourcePolicy: { policy: "same-origin" },
    dnsPrefetchControl:        { allow: false },
    frameguard:                { action: "deny" },
    hidePoweredBy:             true,
    hsts:                      { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen:                  true,
    noSniff:                   true,
    referrerPolicy:            { policy: "no-referrer" },
    xssFilter:                 true,
  })
);

app.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function (body) {
    // Some views hard-code nonce="<%= nonce %>" (EJS-style); fill in the real nonce or CSP blocks those scripts
    if (typeof body === "string" && res.locals.nonce) body = body.replace(/<%=\s*nonce\s*%>/g, res.locals.nonce);
    // Pages must be re-checked on every visit, or phones keep showing an old version after updates
    if (typeof body === "string" && body.includes("<html") && !res.get("Cache-Control")) res.set("Cache-Control", "private, no-cache");
    if (typeof body === "string" && body.includes("<head>")) {
      const nonce = res.locals.nonce ? ` nonce="${res.locals.nonce}"` : "";
      body = body.replace(
        "<head>",
        `<head>\n<script${nonce} src="https://cdn.tailwindcss.com"></script>`
      );
    }
    return oldSend.call(this, body);
  };
  next();
});

router.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma",           "no-cache");
    res.setHeader("Expires",          "0");
    res.setHeader("Surrogate-Control","no-store");
  }
  next();
});

// ---------------------------------------------
// Rate limiter + blacklist
// ---------------------------------------------
const whitelist = process.env.WHITELIST_IPS
  ? process.env.WHITELIST_IPS.split(",").map(ip => ip.trim())
  : [];

// ── Global IP rate limiter (MongoDB-backed, persistent bans) ─────────────────
// Tightened: 20 req/min baseline, 15-min blocks, banned after 3 strike rounds.
// This is the last line of defence — the tiered in-memory limiters below
// should catch botnet bursts before they ever accumulate strikes here.
router.use(globalRateLimiter({
  windowMs:    60_000,
  max:         20,
  tempBlock:   15 * 60_000,
  strikeLimit: 3,
  whitelist,
}));

// ── Tiered in-memory limiters (fast, per route group) ────────────────────────
// Auth routes — 5 req / 5 min (login & OAuth callback)
router.use(['/login', '/auth/discord/callback'], authRouteLimiter);

// API routes — method-aware tiers (see routes/Utils/apiRateLimiter.js)
router.use('/api', smartApiLimiter);
router.use('/api-dev', smartApiLimiter);

router.use(checkBlacklist);

// ---------------------------------------------
// Body parsing
// ---------------------------------------------
router.use(express.json({ limit: "10kb" }));
router.use(express.urlencoded({ extended: true, limit: "10kb" }));
router.use(cookieParser(process.env.COOKIE_SECRET));

// ---------------------------------------------
// CSRF Protection
// ---------------------------------------------
const csrfProtection = csrf({
  cookie: {
    key:      "_csrf",
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    signed:   true,
  },
});

const CSRF_EXEMPT = ['/api/ipverify/issue'];
const CSRF_EXEMPT_PREFIX = ['/api/chat'];
router.use((req, res, next) => {
  if (CSRF_EXEMPT.includes(req.path) || CSRF_EXEMPT_PREFIX.some(p => req.path === p || req.path.startsWith(p + '/')) || /^\/ipverify\/[a-f0-9]{96}$/.test(req.path)) return next();
  return csrfProtection(req, res, next);
});

router.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

router.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function (body) {
    if (typeof body === "string" && body.includes("</head>")) {
      try {
        const token = req.csrfToken();
        body = body.replace(
          "</head>",
          `<meta name="csrf-token" content="${token}">\n</head>`
        );
      } catch (_) { /* exempt routes � safe to skip */ }
    }
    // Inject footer + consent popup before </body> on every HTML page
    // Skip on tos/privacy which have their own standalone footer
    // Only show consent popup to authenticated users
    const isLegalPage = (req.path === '/tos' || req.path === '/privacy');
    if (typeof body === 'string' && body.includes('</body>') && !isLegalPage && req.isAuthenticated?.()) {
      const nonce = res.locals.nonce ? ` nonce="${res.locals.nonce}"` : '';
      const footer = `
<!-- ── Roco Footer (injected globally) ─────────────────────────────────── -->
<style>
  .xyron-footer {
    width: 100%;
    padding: 20px 24px;
    border-top: 1px solid rgba(255,255,255,0.05);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    margin-top: auto;
  }
  .xyron-footer-left {
    font-size: 11px;
    color: rgba(75, 85, 99, 1);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .xyron-footer-left svg { flex-shrink: 0; opacity: 0.5; }
  .xyron-footer-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .xyron-footer-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    color: rgba(75, 85, 99, 1);
    text-decoration: none;
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .xyron-footer-link:hover {
    color: rgba(148, 163, 184, 1);
    background: rgba(255,255,255,0.04);
    border-color: rgba(255,255,255,0.07);
  }
  .xyron-footer-sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(55, 65, 81, 1);
    flex-shrink: 0;
  }
  /* Push footer to page bottom on short pages */
  body { min-height: 100vh; display: flex; flex-direction: column; }
  .page-wrap { flex: 1; }
  /* Override for chat page which manages its own flex layout */
  body.chat-page { display: block; }
</style>
<footer class="xyron-footer" aria-label="Site footer">
  <div class="xyron-footer-left">
    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
    &copy; <span id="xyron-year"></span> Roco Development &mdash; All Rights Reserved
  </div>
  <div class="xyron-footer-right">
    <a href="/tos" class="xyron-footer-link" target="_blank" rel="noopener">
      <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Terms of Service
    </a>
    <div class="xyron-footer-sep"></div>
    <a href="/privacy" class="xyron-footer-link" target="_blank" rel="noopener">
      <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Privacy Policy
    </a>
    <div class="xyron-footer-sep"></div>
    <a href="/gdpr" class="xyron-footer-link" style="color:var(--accent,#ef4444);border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.06)">
      <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
      Privacy Controls
    </a>
    <div class="xyron-footer-sep"></div>
    <a href="mailto:support@rocobot.xyz" class="xyron-footer-link">
      <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      support@rocobot.xyz
    </a>
  </div>
</footer>
<script${nonce}>document.getElementById('xyron-year').textContent = new Date().getFullYear();</script>
`;
      body = body.replace(
        '</body>',
        footer + `\n<script${nonce}>${CONSENT_SCRIPT}</script>\n</body>`
      );
    }
    return oldSend.call(this, body);
  };
  next();
});

// ---------------------------------------------
// NoSQL injection sanitizer
// ---------------------------------------------
function sanitize(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else {
      sanitize(obj[key]);
    }
  }
}
router.use((req, res, next) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
});

// ---------------------------------------------
// Request logger
// ---------------------------------------------
const IGNORED_LOG_PATHS = new Set(["/api/dev/requests", "/api/dev/server-stats"]);

router.use((req, res, next) => {
  if (IGNORED_LOG_PATHS.has(req.path)) return next();
  addRequestLog({
    method:    req.method,
    path:      req.path,
    timestamp: new Date(),
    userId:    req.user?.id       ?? "N/A",
    username:  req.user?.username ?? "Guest",
  });
  next();
});

// ---------------------------------------------
// Guild cache � MongoDB-backed
// ---------------------------------------------
const CACHE_TTL_MS = 30_000;

async function cacheGet(guildId, key) {
  try {
    const entry = await GuildCache.findOne(
      { guildId, key },
      { data: 1, expiresAt: 1 }
    ).lean();
    if (!entry) return null;
    if (new Date() > entry.expiresAt) {
      GuildCache.deleteOne({ guildId, key }).catch(() => {});
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

async function cacheSet(guildId, key, data) {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await GuildCache.findOneAndUpdate(
      { guildId, key },
      { $set: { data, expiresAt } },
      { upsert: true }
    );
  } catch {
    // Non-fatal
  }
}

const GUILD_FETCHERS = {
  welcome:       (id) => WelcomeMessage.findOne({ guildId: id }),
  goodbye:       (id) => GoodbyeMessage.findOne({ guildId: id }),
  antinuke:      (id) => Antinuke.findOne({ guildId: id }),
  antiscam:      (id) => AntiScam.findOne({ guildId: id }),
  autorole:      (id) => AutoRole.findOne({ GuildID: id }),
  autoresponder: (id) => Autoresponder.find({ guildId: id }),
  ai:            (id) => AIConfig.findOne({ guildId: id }),
  christmas:     (id) => Christmas.findOne({ Guild: id }),
  halloween:     (id) => Halloween.findOne({ Guild: id }),
  confession:    (id) => ConfessionConfig.findOne({ Guild: id }),
  counting:      (id) => Count.findOne({ Guild: id }),
  qotd:          () => null,  // no separate enabled check needed
  invite:        (id) => GuildInviteConfig.findOne({ guildId: id }),
  jtc:           (id) => JTCConfig.findOne({ Guild: id }),
  leveling:      (id) => Promise.all([
                           LevelSetup.findOne({ Guild: id }),
                           LevelRole.findOne({ GuildID: id }),
                         ]).then(([config, rewards]) => ({ config, rewards })),
  logs:          (id) => LogSchema.findOne({ Guild: id }),
  massjoin:      (id) => MassJoin.findOne({ guildId: id }),
  reactionroles: (id) => ReactionRole.find({ Guild: id }),
  sticky:        (id) => StickySchema.find({ Guild: id }),
  ticket:        (id) => Promise.all([
                           TicketSetup.findOne({ GuildID: id }),
                           Transcript.find({ GuildID: id })
                                      .select("TicketID ChannelName OpenedBy ClosedBy ClosedAt")
                                      .sort({ ClosedAt: -1 }),
                         ]).then(([setup, transcripts]) => ({ setup, transcripts })),
  uptime:        (id) => Uptime.find({ Guild: id }),
  verify:        (id) => Verify.findOne({ Guild: id }),
  youtube:       (id) => YouTubeNotif.find({ Guild: id }),
  twitch:        (id) => TwitchNotif.find({ Guild: id }),
  "247":         (id) => db247.findOne({ _id: id }),
  stats:         (id) => MemberStats.find({ GuildID: id }).sort({ Date: 1 }).limit(30),
  suggestions:   (id) => SuggestionConfig.findOne({ guildId: id }),
};

function warmGuildCache(guildId) {
  for (const [key, fetcher] of Object.entries(GUILD_FETCHERS)) {
    cacheGet(guildId, key).then(cached => {
      if (cached !== null) return;
      fetcher(guildId)
        .then(data => cacheSet(guildId, key, data ?? null))
        .catch(() => {});
    }).catch(() => {});
  }
}

router.use((req, res, next) => {
  const match = req.path.match(/^\/(?:api\/)?guild\/(\d+)/);
  if (match) {
    const guildId = match[1];
    const l1 = new Map();
    res.locals.preloaded = async (key) => {
      if (l1.has(key)) return l1.get(key);
      const val = await cacheGet(guildId, key);
      l1.set(key, val);
      return val;
    };
    res.locals.guildId = guildId;
    setImmediate(() => warmGuildCache(guildId));
  } else {
    res.locals.preloaded = async () => null;
  }
  next();
});

// ─────────────────────────────────────────────
// Sub-route imports
// ─────────────────────────────────────────────

// Security
const authRoutes            = require("./Security/auth");
const ipverification        = require("./Security/ipverification");
const dashboardroles        = require("./Security/dashboardroles");
const antinukeroutes        = require("./Security/antinuke");
const antiscamroutes        = require("./Security/antiscam");
const antimassjoin          = require("./Security/antimassjoin");
const globalPermRoutes      = require("./Security/global-perm");
const errorroutes           = require("./Security/errors");

// Moderation
const automodroutes         = require("./Moderation/automod");
const advancedautomodroutes = require("./Moderation/advancedautomod");
const autoresponderroutes   = require("./Moderation/autoresponders");
const autoroleroutes        = require("./Moderation/autorole");
const ghostpingroutes       = require("./Moderation/ghostping");
const inviteroutes          = require("./Moderation/invite");
const modlogsroutes         = require("./Moderation/modlogs");
const staffAppRoutes        = require("./Moderation/staffapps");
const ticketRoutes          = require("./Moderation/tickets");

// Fun
const airoutes              = require("./Fun/ai");
const catlockroutes         = require("./Fun/catlock");
const christmasroutes       = require("./Fun/christmas");
const confessionroutes      = require("./Fun/confession");
const countingroutes        = require("./Fun/counting");
const guessthenumberroutes  = require("./Fun/guessthenumber");
const halloweenroutes       = require("./Fun/halloween");
const jtcroutes             = require("./Fun/jtc");
const levelingroutes        = require("./Fun/leveling");
const mediaRoutes           = require("./Fun/media");
const uwulockroutes         = require("./Fun/uwulock");
const socialsroutes         = require("./Fun/social")

// Utility
const boosterroutes         = require("./Utility/booster");
const hubRoutes             = require("./Utility/hubs");
const loggingroutes         = require("./Utility/logs");
const reactionroleroutes    = require("./Utility/reactionroles");
const statsroutes           = require("./Utility/stats");
const suggestionRoutes      = require("./Utility/suggestions");
const uptimeroutes          = require("./Utility/uptime");
const verifyroutes          = require("./Utility/verification");

// Messaging
const embedroutes           = require("./Messaging/embed");
const goodbyeroutes         = require("./Messaging/goodbye");
const joinpingroutes        = require("./Messaging/joinping");
const messageTemplateRoutes = require("./Messaging/messagetemplates");
const stickymessagesroutes  = require("./Messaging/stickymessages");
const welcomeroutes         = require("./Messaging/welcome");

// Commands
const commandroutes         = require("./Commands/guildcommands");
const customcommands        = require("./Commands/customcommands");

// Community
const afkRoutes             = require("./Community/afk");
const pollsRoutes           = require("./Community/polls");
const qotdRoutes            = require("./Community/qotd");
const reputationRoutes      = require("./Community/reputation");

// Staff
const inbuiltCommandRoutes  = require("./Staff/inbuiltcommands");
const staffListRoutes       = require("./Staff/stafflist");
const staffRatingRoutes     = require("./Staff/staffrating");
const staffRecoveryRoutes   = require("./Staff/staffrecovery");


// Premium
const customBrandingRoutes  = require("./Premium/custombrand");
const premiumroutes         = require("./Premium/premiumgen");
const premiumCheckoutRoutes = require("./Premium/checkout");

// Other / General
const generalRoutes         = require("./Other/general");
const changelogsroutes      = require("./Other/changelogs");
const noxxaiRoutes          = require("./Fun/noxxai");
const gdprRoutes            = require("./Other/gdpr");
const otherpages            = require("./Other/pages");
const statusApi             = require("./Other/status-api");
const vpsstats              = require("./Other/vps-route");

// Dev
const devRoutes             = require("./Dev/dev");
const statusEventsRoutes    = require("./Dev/dev/status-events");

// Giveaway
const giveawayRoutes        = require("./Giveaway/giveaway");

// ─────────────────────────────────────────────
// Block direct browser navigation to API routes
// ─────────────────────────────────────────────
router.use("/api/", apiOnly);

// ─────────────────────────────────────────────
// Route registrations (grouped by category)
// ─────────────────────────────────────────────

// Security
router.use("/", authRoutes);
router.use("/", ipverification);
router.use("/", dashboardroles);
router.use("/", antinukeroutes);
router.use("/", antiscamroutes);
router.use("/", antimassjoin);
router.use("/", globalPermRoutes);
router.use("/", errorroutes);

// Moderation
router.use("/", automodroutes);
router.use("/", advancedautomodroutes);
router.use("/", autoresponderroutes);
router.use("/", autoroleroutes);
router.use("/", ghostpingroutes);
router.use("/", inviteroutes);
router.use("/", modlogsroutes);
router.use("/", staffAppRoutes);
router.use("/", ticketRoutes);

// Fun
router.use("/", airoutes);
router.use("/", catlockroutes);
router.use("/", christmasroutes);
router.use("/", confessionroutes);
router.use("/", countingroutes);
router.use("/", guessthenumberroutes);
router.use("/", halloweenroutes);
router.use("/", jtcroutes);
router.use("/", levelingroutes);
router.use("/", mediaRoutes);
router.use("/", uwulockroutes);
router.use("/", socialsroutes)

// Utility
router.use("/", boosterroutes);
router.use("/", hubRoutes);
router.use("/", loggingroutes);
router.use("/", reactionroleroutes);
router.use("/", statsroutes);
router.use("/", suggestionRoutes);
router.use("/", uptimeroutes);
router.use("/", verifyroutes);

// Messaging
router.use("/", embedroutes);
router.use("/", goodbyeroutes);
router.use("/", joinpingroutes);
router.use("/", messageTemplateRoutes);
router.use("/", stickymessagesroutes);
router.use("/", welcomeroutes);

// Commands
router.use("/", commandroutes);
router.use("/", customcommands);

// Community
router.use("/", afkRoutes);
router.use("/", pollsRoutes);
router.use("/", qotdRoutes);
router.use("/", reputationRoutes);

// Staff
router.use("/", inbuiltCommandRoutes);
router.use("/", staffListRoutes);
router.use("/", staffRatingRoutes);
router.use("/", staffRecoveryRoutes);


// Premium
router.use("/", customBrandingRoutes);
router.use("/", premiumroutes);
router.use("/", premiumCheckoutRoutes);

// Other / General
router.use("/", generalRoutes);
router.use("/", changelogsroutes);
router.use("/", noxxaiRoutes);
router.use("/", gdprRoutes);
router.use("/", otherpages);
router.use('/api/status/vps', vpsstats);
router.use(statusApi);

// Dev
router.use("/", devRoutes);
router.use("/", statusEventsRoutes);

// Giveaway
router.use("/", giveawayRoutes);

// ---------------------------------------------
// Global error handler
// ---------------------------------------------
const { BotOfflineError } = require('../lib/botClient');

router.use((err, req, res, _next) => {
  if (err?.isBotOffline || err instanceof BotOfflineError) {
    if (!res.headersSent) {
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({ error: 'Bot is temporarily offline. Please try again in a moment.' });
      }
      return res.status(503).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Offline</title>
        <meta http-equiv="refresh" content="10;url=${req.path}">
        <style>body{background:#07080f;color:#c8cfe0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
        .box{text-align:center;max-width:420px;padding:40px;background:#0d0f1c;border:1px solid rgba(255,255,255,0.06);border-radius:16px;}
        h2{color:#edf0f8;font-size:20px;margin:0 0 10px;}p{font-size:14px;color:#7a849a;line-height:1.6;margin:0 0 16px;}
        .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fbbf24;margin-right:8px;animation:pulse 1.5s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}</style></head>
        <body><div class="box"><span class="dot"></span><h2>Bot is restarting</h2>
        <p>Roco is coming back online. This page will refresh automatically in 10 seconds.</p>
        <p style="font-size:12px;color:#4a5068;">If this persists, check the <a href="/status" style="color:#FF3333;">status page</a>.</p>
        </div></body></html>`);
    }
    return;
  }

  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------
// /api/me – return authed user identity for the frontend
// ---------------------------------------------
router.get("/api/me", (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const { id, username, globalName, discriminator, avatar } = req.user;
  const avatarUrl = avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number(discriminator || 0) % 5}.png`;
  const isOwner = !!process.env.OWNER_ID && id === process.env.OWNER_ID;
  return res.json({ id, username, globalName: globalName || username, avatarUrl, isOwner });
});

// ---------------------------------------------
// 404
// ---------------------------------------------
router.all("*", (req, res) => {
  res.status(404).sendFile(path.join(__dirname, "../views/errors/404.html"));
});

module.exports = router;