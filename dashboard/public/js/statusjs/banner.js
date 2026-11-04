// statusjs/banner.js — Top status banner + stats strip
// ─────────────────────────────────────────────────────────────────────────────

// ── Banner ────────────────────────────────────────────────────────────────────

export function renderBanner(status, timestamp, override) {
  const el  = document.getElementById('banner');
  const txt = document.getElementById('banner-txt');
  const sub = document.getElementById('banner-sub');
  if (!el) return;

  el.style.display = 'flex';

  // Status → CSS class mapping:
  //   operational  → green  (op)   — all systems normal
  //   degraded     → orange (str)  — some systems offline
  //   recovering   → blue   (rec)  — services starting / will be available soon
  //   down         → red    (deg)  — all systems offline
  const classMap = {
    operational: 'op',
    degraded:    'str',
    recovering:  'rec',
    down:        'deg',
    starting:    'str',
    offline:     'deg',
  };
  el.className = 'banner fade-in ' + (classMap[status] ?? 'str');

  const textMap = {
    operational: 'All systems operational',
    degraded:    'Some systems are offline — investigation in progress',
    recovering:  'Some services are recovering / starting and will be available soon!',
    down:        '⚡ Bot is offline — we are working to restore service',
    starting:    'Services are starting up',
    offline:     '⚡ Bot is offline — unable to reach the bot',
  };

  if (override?.reason) {
    txt.textContent = textMap[status] ?? 'Status unknown';
    sub.textContent = override.reason;
  } else {
    txt.textContent = textMap[status] ?? 'Status unknown';
    sub.textContent = 'Last checked ' + (
      timestamp
        ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—'
    );
  }
}

// ── Stats strip ───────────────────────────────────────────────────────────────

export function renderStats(data) {
  const bot  = data.bot  || {};
  const meta = data.meta || {};

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('s-cmds', meta.commandCount ?? '—');
  set('s-cats', meta.categoryCount ? meta.categoryCount + ' categories' : '—');
  set('s-mods', (bot.modulesRunning ?? '—') + '/' + (bot.modulesTotal ?? '—'));
  set('s-uptime', bot.uptimeFormatted ? 'up ' + bot.uptimeFormatted : '—');

  const ping   = bot.ping;
  const pingEl = document.getElementById('s-ping');
  if (pingEl) {
    pingEl.textContent = ping > 0 ? ping + 'ms' : '—';
    pingEl.className   = 'stat-num ' + (
      ping > 0
        ? (ping < 100 ? 'ping-good' : ping < 200 ? 'ping-ok' : 'ping-bad')
        : ''
    );
  }
}

// ── Uptime % + last incident (populated after history loads) ──────────────────

export function renderUptimeStat(overallUptime) {
  if (overallUptime == null) return;
  const el = document.getElementById('s-uptime-pct');
  if (!el) return;
  el.textContent = overallUptime + '%';
  el.className   = 'stat-num ' + (
    overallUptime >= 99 ? 'ping-good' :
    overallUptime >= 95 ? 'ping-ok'   :
                          'ping-bad'
  );
}

export function renderLastIncident(incidentsData) {
  const el  = document.getElementById('s-last-inc');
  if (!el) return;
  const inc = incidentsData.find(i => i.status === 'resolved');
  if (!inc) { el.textContent = 'No incidents'; return; }
  const d = new Date(inc.resolvedAt);
  el.textContent = 'Last inc ' + d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Version tag ───────────────────────────────────────────────────────────────

export function renderVersion(version) {
  if (!version) return;
  const vt = document.getElementById('version-tag');
  const fv = document.getElementById('footer-version');
  if (vt) vt.textContent = 'v' + version;
  if (fv) fv.textContent = 'v' + version;
}