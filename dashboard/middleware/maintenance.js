/**
 * Maintenance Mode Middleware
 * Intercepts every request when maintenance is enabled and returns a styled HTML page.
 * Dev panel routes, all /api/dev/* endpoints, and bypass IPs are exempt.
 */

const Maintenance = require("../../Schemas/maintenanceSchema");
const getOwners   = require("../../Utils/getOwners");

// ─── In-memory cache — avoid a MongoDB round-trip on every single request ───────
// The doc is re-fetched at most once every 10 seconds. When maintenance is OFF
// (the common case) this means zero DB cost for all page loads.
let _cache     = null;
let _cacheTime = 0;
const CACHE_TTL = 10_000; // ms

async function getMaintenanceDoc() {
  const now = Date.now();
  if (_cache !== undefined && now - _cacheTime < CACHE_TTL) return _cache;
  _cache     = await Maintenance.findById("maintenance").lean();
  _cacheTime = now;
  return _cache;
}

// Called by the dev panel after toggling maintenance so the cache doesn't
// serve stale data for up to 10 seconds.
module.exports.bustCache = () => { _cache = undefined; _cacheTime = 0; };

// ─── Prefixes / exact paths always allowed through ──────────────────────────────
const BYPASS_PREFIXES = [
  "/dev",        // Dev panel UI page
  "/api/dev/",   // All dev API endpoints (maintenance, stats, guilds, etc.)
  "/api-dev",
  "/api-dev/granular",    // Legacy dev API prefix
  "/login",
  "/logout",
  "/callback",
  "/webhooks/",
  "/status"  // Stripe & others
];

module.exports = async function maintenanceMiddleware(req, res, next) {
  try {
    const path = req.originalUrl.split("?")[0];

    // Fast path — always let bypass routes through
    if (BYPASS_PREFIXES.some(p => path === p || path.startsWith(p))) {
      return next();
    }

    const doc = await getMaintenanceDoc();
    if (!doc || !doc.enabled) return next();

    // Logged-in devs always get through
    if (req.user?.id) {
      try {
        const owners = await getOwners();
        if (owners.includes(req.user.id)) return next();
      } catch (_) { /* non-blocking */ }
    }

    // IP bypass list
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "";
    if (doc.bypassIPs?.includes(clientIp)) return next();

    // API requests get JSON
    if (path.startsWith("/api/")) {
      return res.status(503).json({
        error:   "maintenance",
        title:   doc.title,
        message: doc.message,
        eta:     doc.eta || null,
      });
    }

    // For browser requests, check if current user is a dev so we show the button
    let isDev = false;
    if (req.user?.id) {
      try {
        const owners = await getOwners();
        isDev = owners.includes(req.user.id);
      } catch (_) { /* non-blocking */ }
    }

    return res.status(503).send(buildMaintenancePage(doc, isDev));
  } catch (err) {
    console.error("[MAINTENANCE] Middleware error:", err);
    return next();
  }
};

/* ─────────────────────────────────────────────────────────────────
   HTML page builder
───────────────────────────────────────────────────────────────── */
function buildMaintenancePage(doc, isDev = false) {
  const title   = escHtml(doc.title   || "We're offline for maintenance!");
  const message = escHtml(doc.message || "We're making some improvements. We'll be back shortly.");
  const etaMs   = doc.eta ? new Date(doc.eta).getTime() : null;
  const etaStr  = doc.eta ? new Date(doc.eta).toUTCString() : null;

  const devButton = isDev ? `
    <hr class="divider">
    <div class="dev-section">
      <div class="dev-badge">🔐 Developer Access</div>
      <p class="dev-hint">Maintenance is active — but you can still access the dev panel.</p>
      <a href="/dev" class="dev-btn">
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
        </svg>
        Open Dev Panel
      </a>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Maintenance | RankCore</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'Plus Jakarta Sans',sans-serif;
      background:#050508;color:#e2e8f0;
      min-height:100vh;display:flex;
      align-items:center;justify-content:center;
      padding:1.5rem;overflow:hidden;
    }
    body::before,body::after{
      content:'';position:fixed;border-radius:50%;
      filter:blur(120px);pointer-events:none;z-index:0;
    }
    body::before{width:500px;height:500px;background:rgba(108,83,255,.12);top:-100px;left:-100px;}
    body::after{width:400px;height:400px;background:rgba(108,83,255,.07);bottom:-80px;right:-80px;}

    .card{
      position:relative;z-index:1;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.07);
      border-radius:1.75rem;
      padding:3rem 2.75rem;
      max-width:540px;width:100%;
      text-align:center;
      backdrop-filter:blur(24px);
      box-shadow:0 0 0 1px rgba(108,83,255,.15),0 32px 80px rgba(0,0,0,.6);
    }
    .card::before{
      content:'';position:absolute;
      top:0;left:10%;right:10%;height:3px;
      background:linear-gradient(90deg,transparent,#6C53FF,#a78bfa,#6C53FF,transparent);
      border-radius:99px;
    }

    .icon-wrap{
      display:inline-flex;align-items:center;justify-content:center;
      width:80px;height:80px;border-radius:50%;
      background:rgba(108,83,255,.1);border:1px solid rgba(108,83,255,.2);
      margin-bottom:1.75rem;
      animation:float 3s ease-in-out infinite;
    }
    .icon-wrap svg{width:36px;height:36px;color:#8b72ff;}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

    h1{font-size:1.65rem;font-weight:800;color:#fff;margin-bottom:.75rem;letter-spacing:-.02em;}
    p{color:#94a3b8;line-height:1.75;font-size:.95rem;}

    .divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:2rem 0;}

    .eta-label{font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6C53FF;margin-bottom:.5rem;}
    .eta-time{color:#cbd5e1;font-size:.88rem;margin-bottom:1.5rem;}

    #countdown{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;}
    .cd-block{background:rgba(108,83,255,.1);border:1px solid rgba(108,83,255,.2);border-radius:.875rem;padding:.65rem 1.1rem;min-width:68px;}
    .cd-num{font-size:1.75rem;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;}
    .cd-unit{font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7c6bdf;margin-top:.15rem;}
    .cd-expired{color:#94a3b8;font-size:.9rem;}

    /* ── Dev button ── */
    .dev-section{display:flex;flex-direction:column;align-items:center;gap:.65rem;}
    .dev-badge{
      display:inline-flex;align-items:center;gap:.4rem;
      font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
      color:#f59e0b;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);
      padding:.3rem .85rem;border-radius:99px;
    }
    .dev-hint{font-size:.82rem;color:#64748b;}
    .dev-btn{
      display:inline-flex;align-items:center;gap:.55rem;
      padding:.65rem 1.6rem;
      background:rgba(108,83,255,.15);border:1px solid rgba(108,83,255,.35);
      color:#a78bfa;font-size:.88rem;font-weight:700;
      border-radius:.875rem;text-decoration:none;
      transition:background .2s,border-color .2s,color .2s,transform .15s;
    }
    .dev-btn:hover{background:rgba(108,83,255,.28);border-color:rgba(108,83,255,.6);color:#fff;transform:translateY(-1px);}
  </style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  </div>

  <h1>${title}</h1>
  <p>${message}</p>

  ${etaMs ? `
  <hr class="divider" style="margin-bottom:1.5rem">
  <div class="eta-label">Estimated return</div>
  <div class="eta-time">${etaStr}</div>
  <div id="countdown"></div>
  <script>
    (function(){
      var eta=${etaMs},el=document.getElementById('countdown');
      function tick(){
        var diff=eta-Date.now();
        if(diff<=0){el.innerHTML='<span class="cd-expired">Any moment now\u2026</span>';return;}
        var d=Math.floor(diff/864e5),h=Math.floor((diff%864e5)/36e5),m=Math.floor((diff%36e5)/6e4),s=Math.floor((diff%6e4)/1e3);
        function blk(n,u){return '<div class="cd-block"><div class="cd-num">'+String(n).padStart(2,'0')+'</div><div class="cd-unit">'+u+'</div></div>';}
        el.innerHTML=(d?blk(d,'days'):'')+blk(h,'hrs')+blk(m,'min')+blk(s,'sec');
      }
      tick();setInterval(tick,1000);
    })();
  <\/script>` : ""}

  ${devButton}
</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
