// statusjs/modules.js — Bot module list + dashboard component rendering
// ─────────────────────────────────────────────────────────────────────────────

// ── Simplify name maps ────────────────────────────────────────────────────────

const MODULE_SIMPLE = {
  // Bot module technical names → plain English
  'Event Handlers':         { name: 'Message & Action Listener',  desc: 'Watches for Discord events like messages, reactions, and member joins' },
  'Slash Commands':         { name: 'Slash Commands',              desc: 'Powers all /commands users type in Discord' },
  'Prefix Commands':        { name: 'Classic Commands',            desc: 'Powers old-style commands like !help or !ban' },
  'Function Handlers':      { name: 'Shared Tools',               desc: 'Internal helpers used by multiple features' },
  'Trigger Handlers':       { name: 'Auto-Responses',             desc: 'Automatic replies and keyword triggers' },
  'Bot Systems':            { name: 'Core Features',              desc: 'Moderation, tickets, levels, and other main features' },
  'Music':                  { name: 'Music Player',               desc: 'Play music in voice channels' },
  'Cron / Scheduled Tasks': { name: 'Scheduled Jobs',             desc: 'Reminders, auto-moderation, and timed actions' },
  'Error Handlers':         { name: 'Crash Recovery',             desc: 'Catches errors so the bot keeps running' },
  'REST API':               { name: 'External API',               desc: 'Lets other services talk to the bot' },
  'Internal Bridge':        { name: 'Dashboard Link',             desc: 'Connects this website to the bot' },
  'Log Handlers':           { name: 'Activity Logs',             desc: 'Records what happens for debugging and audits' },
};

const DASH_COMPONENT_SIMPLE = {
  'Express Server':   { name: 'Web Server',          desc: 'Serves this dashboard to your browser' },
  'Discord OAuth2':   { name: 'Discord Login',       desc: 'Lets you log in with your Discord account' },
  'Session Store':    { name: 'Login Sessions',      desc: 'Keeps you logged in while you browse' },
  'Internal Bridge':  { name: 'Bot Connection',      desc: 'Live link between the dashboard and the bot' },
  'Route Middleware': { name: 'Page Security',       desc: 'Checks permissions before showing each page' },
  'Maintenance Mode': { name: 'Maintenance Switch',  desc: 'Can put the dashboard into read-only mode' },
};

const GROUP_SIMPLE = {
  'Core':      'Core Systems',
  'Systems':   'Bot Features',
  'API':       'Connections',
  'Utilities': 'Utilities',
};

// ── Simplify state accessor (reads window flag set by status.html) ────────────
function isSimplified() {
  return window.__noxxSimplify === true;
}

function simpleName(map, key, fallback) {
  return isSimplified() ? (map[key]?.name || fallback) : fallback;
}

function simpleDesc(map, key) {
  return isSimplified() ? (map[key]?.desc || null) : null;
}

// ── Bot modules ───────────────────────────────────────────────────────────────

export function renderModules(modules) {
  const container = document.getElementById('mod-container');
  if (!container) return;

  const groups = {};
  (modules || []).forEach(m => {
    (groups[m.group] = groups[m.group] || []).push(m);
  });

  const simplified = isSimplified();
  let html = '';
  for (const [gname, mods] of Object.entries(groups)) {
    const displayGroup = simplified ? (GROUP_SIMPLE[gname] || gname) : gname;
    html += `<div class="mgroup"><div class="mgroup-name">${displayGroup}</div><div class="mlist">`;
    html += mods.map(m => {
      const displayName = simpleName(MODULE_SIMPLE, m.name, m.name);
      const desc        = simpleDesc(MODULE_SIMPLE, m.name);
      return `
        <div class="mitem${desc ? ' mitem-has-desc' : ''}" ${desc ? `title="${desc}"` : ''}>
          <div class="mdot ${m.state}"></div>
          <span class="mname">${displayName}</span>
          <span class="mstate">${m.state}</span>
        </div>`;
    }).join('');
    html += '</div></div>';
  }

  container.innerHTML = html ||
    '<div style="color:var(--muted);font-size:12px">No module data</div>';
}

// ── Dashboard components — real logic ─────────────────────────────────────────

function deriveDashState(componentName, apiData) {
  if (!apiData) return 'operational';

  const bot  = apiData.bot   || {};
  const dash = apiData.dashboard || {};

  // Use the value the server actually computed first
  const apiComp = (dash.components || []).find(c => c.name === componentName);
  if (apiComp) return apiComp.state || 'operational';

  // Fallback client-side signals (only used if server didn't send component data)
  switch (componentName) {
    case 'Express Server':    return 'operational';  // we got a response, so it's up
    case 'Discord OAuth2':    return 'operational';  // user is authed = OAuth works
    case 'Session Store':     return 'operational';  // user is authed = sessions work
    case 'Internal Bridge':   return bot.ready !== undefined ? 'operational' : 'degraded';
    case 'Route Middleware':  return 'operational';  // auth middleware passed
    case 'Maintenance Mode':  return isMaintenanceActive(apiData) ? 'starting' : 'operational';
    default:                  return 'operational';
  }
}

// Maintenance is ONLY active when the server explicitly sets the Maintenance Mode component to 'starting'.
// This is driven by the actual DB maintenance flag, NOT by status overrides.
function isMaintenanceActive(data) {
  const comp = (data?.dashboard?.components || []).find(c => c.name === 'Maintenance Mode');
  return comp?.state === 'starting';
}

export function renderDash(dash, apiData) {
  const el = document.getElementById('dash-mlist');
  if (!el) return;

  const data = apiData || window.__noxxLastStatus || null;

  const comps = (dash?.components?.length ? dash.components : null) || [
    { name: 'Express Server'   },
    { name: 'Discord OAuth2'   },
    { name: 'Session Store'    },
    { name: 'Internal Bridge'  },
    { name: 'Route Middleware' },
    { name: 'Maintenance Mode' },
  ];

  const simplified    = isSimplified();
  const dashPing      = window.__noxxDashPing;
  const maintenanceOn = isMaintenanceActive(data);

  el.innerHTML = comps.map(c => {
    // For Maintenance Mode: always derive state from override object, never trust component state alone
    const state = c.name === 'Maintenance Mode'
      ? (maintenanceOn ? 'starting' : 'operational')
      : deriveDashState(c.name, data);

    // For Discord OAuth2: if user is on this page they are authed — always operational
    const displayState = c.name === 'Discord OAuth2' ? 'operational' : state;

    const displayName = simplified ? (DASH_COMPONENT_SIMPLE[c.name]?.name || c.name) : c.name;
    const desc        = simplified ? (DASH_COMPONENT_SIMPLE[c.name]?.desc || null) : null;

    let extraLabel = '';
    if (c.name === 'Internal Bridge' && typeof dashPing === 'number' && dashPing > 0) {
      const cls = dashPing < 200 ? 'ping-good' : dashPing < 500 ? 'ping-ok' : 'ping-bad';
      extraLabel = `<span class="mstate ${cls}">${dashPing}ms</span>`;
    } else if (c.name === 'Maintenance Mode' && maintenanceOn) {
      extraLabel = `<span class="mstate" style="color:var(--orange)">active</span>`;
    }

    return `<div class="mitem${desc ? ' mitem-has-desc' : ''}"${desc ? ` title="${desc}"` : ''}>` +
      `<div class="mdot ${displayState}"></div>` +
      `<span class="mname">${displayName}</span>` +
      (extraLabel || `<span class="mstate">${displayState}</span>`) +
      `</div>`;
  }).join('');

  // Badge: only degraded if a real component (not Maintenance Mode) is degraded
  const hasError = comps
    .filter(c => c.name !== 'Maintenance Mode' && c.name !== 'Discord OAuth2')
    .some(c => deriveDashState(c.name, data) === 'degraded');
  const dashBadge = document.getElementById('bg-dash');
  if (dashBadge) {
    dashBadge.className   = hasError ? 'badge b-deg' : 'badge b-op';
    dashBadge.textContent = hasError ? 'Degraded' : 'Operational';
  }

  // Description
  if (!data) return;
  const dashDesc = document.querySelector('#db .desc-block');
  if (!dashDesc) return;

  const bridgeOk = deriveDashState('Internal Bridge', data) === 'operational';
  const pingPart = (typeof dashPing === 'number' && dashPing > 0)
    ? ` &mdash; responding in <strong>${dashPing}ms</strong>` : '';
  const bridgeTxt = bridgeOk
    ? `The bot bridge is <strong>connected</strong> and delivering live data${pingPart}.`
    : `The bot bridge is <strong style="color:var(--red)">disconnected</strong> &mdash; some data may be stale.`;
  // Only show maintenance note if override is a real active object
  const maintTxt = maintenanceOn
    ? ` <span style="color:var(--orange)">Maintenance mode is currently <strong>active</strong>.</span>` : '';

  dashDesc.innerHTML =
    `The dashboard runs as a <strong>completely separate process</strong> and communicates with the bot through a secure internal channel. ${bridgeTxt}${maintTxt}`;
}

// ── Expose renderModules + renderDash globally so the inline Simplify toggle ──
// can trigger a re-render without going through the ES module system.
// (statusmain.js assigns these after import)
export function exposeGlobals() {
  window.__noxxRenderModules = renderModules;
  window.__noxxRenderDash    = renderDash;
}