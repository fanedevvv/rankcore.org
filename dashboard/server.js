const express    = require("express");
const session    = require("express-session");
const RedisStore = require("connect-redis").default;
const { getClient }  = require("../src/lib/redis");
const passport   = require("passport");
const path       = require("path");
const requestLogger = require("../Utils/requestLogger");
const maintenanceMiddleware = require("./middleware/maintenance");
const disabledpage = require("./middleware/disabledPages");

require("./auth");

module.exports = (client) => {
  // ✅ Validation
  if (!client) {
    throw new Error("[DASHBOARD] Client object is not provided");
  }
  
  if (!client.config) {
    throw new Error("[DASHBOARD] Client config is not defined");
  }
  
  if (!client.config.dashboard) {
    throw new Error("[DASHBOARD] Dashboard configuration is missing");
  }

  const conf = client.config.dashboard;

  if (!conf.enabled) {
    return console.log("[DASHBOARD] Dashboard is disabled in config.js");
  }

  const sessionSecret = process.env.SESSION_SECRET;
  const mongoUrl      = process.env.mongodbURL;

  if (!sessionSecret) throw new Error("[DASHBOARD] SESSION_SECRET environment variable is not set");
  if (!mongoUrl)      throw new Error("[DASHBOARD] MONGODB_URL environment variable is not set");

  const app = express();
  app.set("trust proxy", 1);

  // ─── 1. Stripe webhook route first ───────────────────────────────
  app.use(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    require('./webhooks/Stripe')(client)
  );
  app.use(
    '/webhooks/lemonsqueezy',
    express.raw({ type: '*/*', limit: '1mb' }),
    require('./webhooks/LemonSqueezy')()
  );

  // ─── 2. Security headers ────────────────────────────────────
  // SEC-FIX: HTTP security headers to mitigate clickjacking,
  // MIME-sniffing, information leakage and related web attacks.
  app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // ─── 3. Body parsers for normal routes ─────────────────
  // SEC-FIX: Reduced from 8mb to 256kb. The dashboard has no file uploads;
  // a large limit only enables memory-exhaustion DoS attacks.
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(express.json({ limit: "256kb" }));

  // ─── 4. Session & Passport ─────────────────────────
  const redisClient = getClient();
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
      store: new RedisStore({
        client: redisClient,
        prefix: 'noxx:sess:',
        ttl: 60 * 60 * 24 * 7,
      }),
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // ─── 5. Attach client to request ───────────────────────
  app.use((req, res, next) => {
    req.client = client;
    next();
  });

  // ─── 6. JS file access control ─────────────────────
  // All files under /js/* require authentication — they expose internal
  // API structures, feature logic and guild data to whoever loads them.
  // Dev JS additionally requires devOnly (verified dev ID in DB).
  // Root-level JS (loading.js, sidebar.js, noxx.js) stays public because
  // it is needed before the user has a session (login page, loader, etc).
  //
  // IMPORTANT: The public express.static below (step 7) must NOT serve
  // /js/* — otherwise unauthenticated requests bypass the guards here by
  // falling through to the unguarded static handler.
  // A 403 catch-all at the end of /js ensures nothing leaks.
  const { isAuth, devOnly } = require("./middleware");
  const publicDir = path.join(__dirname, "public");
  const jsDir     = path.join(publicDir, "js");

  // Tier 2: dev JS — must be authed AND a verified dev
  app.use(
    ["/js/devmain.js", "/js/devjs"],
    isAuth,
    devOnly,
    express.static(jsDir, { index: false })
  );

  // Tier 0: public JS — served before the auth guard so unauthenticated
  // users can load these files (e.g. on first visit before login).
  // consent-popup.js must be public because it runs on the very first
  // page load, before the user has a session.
  // FIX: express.static(jsDir) strips the full mount path and resolves against
  // jsDir root (the directory itself), not the intended file. The browser was
  // receiving the raw JS source displayed as a page instead of executing it.
  // Use res.sendFile with an absolute path to serve the specific file correctly.
  app.get("/js/consent-popup.js", (req, res) => {
    res.type("application/javascript")
       .set("Cache-Control", "public, max-age=3600")
       .set("ETag", `"noxx-consent-v2"`)
       .sendFile(path.join(jsDir, "consent-popup.js"));
  });

  // Tier 1: all other /js/* — must be authenticated
  // SEC-FIX: Serve from jsDir (not publicDir) so the static handler can
  // only ever reach files inside /public/js.
  app.use("/js", isAuth, express.static(jsDir, { index: false }));

  // SEC-FIX: Hard-deny anything that reaches /js without passing the guards
  // above. Without this, requests fall through to the public express.static
  // below which has no auth check — that was the original bypass.
  app.use("/js", (req, res) => res.status(403).end());

  // ─── 7. Static files (CSS, images, root-level JS, etc) ────
  // SEC-FIX: This handler must come AFTER the /js deny above.
  // Express matches routes in order, so /js requests are already handled
  // (auth-gated or 403'd) before reaching this line.
  app.use(express.static(publicDir));

  // ─── 8. Request logger ─────────────────────────────────────────
  app.use(requestLogger);

  // ─── 9. Maintenance mode ───────────────────────────────────────
  app.use(maintenanceMiddleware);
  app.use(disabledpage);

  // ─── 10. Main routes ───────────────────────────────────────────
  // ✅ CRITICAL FIX: Pass client to routes
  app.use("/", require("./routes/index")(client));

  const port = parseInt(process.env.DASHBOARD_PORT) || conf.port || 3000;

  const httpServer = app.listen(port, "127.0.0.1", () => {
    console.log(`[DASHBOARD] Running on ${conf.domain} (port ${port})`);
  });

  return httpServer;
};