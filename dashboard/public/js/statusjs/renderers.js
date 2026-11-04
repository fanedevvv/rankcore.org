// ─── Renderers ────────────────────────────────────────────────────────────────

import { bannerClass, bannerText, badgeClass, badgeLabel, pingClass } from './helpers.js';

// FIX SEC-6: Escape all API-sourced strings before innerHTML injection.
// mod.name, mod.state, comp.name, comp.state, and group names all come from
// the /api/status response and must be treated as untrusted.
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function renderBanner(status, cachedUntil) {
  const el = document.getElementById('banner');
  el.className = bannerClass(status);
  document.getElementById('banner-txt').textContent = bannerText(status);
  if (cachedUntil) {
    const secs = Math.max(0, Math.round((new Date(cachedUntil) - Date.now()) / 1000));
    document.getElementById('banner-sub').textContent = `cache refreshes in ${secs}s`;
  }
  el.style.display = '';
  document.getElementById('loading-skeleton').style.display = 'none';
}

export function renderStats(data) {
  const meta = data.meta || {};
  const bot  = data.bot  || {};

  document.getElementById('s-cmds').textContent = meta.commandCount  ?? '146';
  document.getElementById('s-cats').textContent = `${meta.categoryCount ?? 17} categories`;
  document.getElementById('s-mods').textContent = bot.modulesRunning != null
    ? `${bot.modulesRunning} / ${bot.modulesTotal}`
    : '—';

  const ping = bot.ping ?? -1;
  document.getElementById('s-ping').textContent = ping >= 0 ? `${ping}ms` : '—';
  document.getElementById('s-uptime').textContent = bot.uptimeFormatted
    ? `Uptime: ${bot.uptimeFormatted}`
    : 'Uptime: —';

  const pillWrap = document.getElementById('ping-pill-wrap');
  if (ping >= 0) {
    pillWrap.innerHTML = ` <span class="ping-pill ${pingClass(ping)}">${ping}ms latency</span>`;
  }
}

export function renderModules(modules) {
  const c = document.getElementById('mod-container');
  c.innerHTML = '';
  const groups = {};
  modules.forEach(m => {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  });
  Object.entries(groups).forEach(([g, mods]) => {
    const wrap = document.createElement('div');
    wrap.className = 'mgroup';
    wrap.innerHTML = `<div class="mgroup-name">${esc(g)}</div><div class="mlist"></div>`;
    const list = wrap.querySelector('.mlist');
    mods.forEach(mod => {
      const el = document.createElement('div');
      el.className = 'mitem';
      el.innerHTML = `
        <div class="mdot ${esc(mod.state)}"></div>
        <div class="mname">${esc(mod.name)}</div>
        <div class="mstate">${esc(mod.state)}</div>`;
      list.appendChild(el);
    });
    c.appendChild(wrap);
  });
}

export function renderDashboard(dashboard) {
  const overall = dashboard.state ?? 'operational';
  const bgDash  = document.getElementById('bg-dash');
  bgDash.className  = badgeClass(overall);
  bgDash.textContent = badgeLabel(overall);

  const mlist = document.getElementById('dash-mlist');
  mlist.innerHTML = '';
  (dashboard.components ?? []).forEach((comp, i) => {
    const el = document.createElement('div');
    el.className = 'mitem';
    el.innerHTML = `
      <div class="mdot ${esc(comp.state)}" id="dd${i + 1}"></div>
      <div class="mname">${esc(comp.name)}</div>
      <div class="mstate" id="ds${i + 1}">${esc(comp.state)}</div>`;
    mlist.appendChild(el);
  });
}

export function renderBotCard(data) {
  const status = data.status ?? 'operational';
  const bgBot  = document.getElementById('bg-bot');
  bgBot.className  = badgeClass(status);
  bgBot.textContent = badgeLabel(status);

  const bot  = data.bot ?? {};
  const desc = bot.ready
    ? `Modular architecture · ${bot.modulesRunning ?? '—'}/${bot.modulesTotal ?? '—'} modules running`
    : (data.status === 'down' || (!bot.ready && bot.ping === -1))
      ? 'Bot is offline — all modules unavailable'
      : 'Starting up…';
  document.getElementById('bot-cdesc').textContent = desc;

  renderModules(bot.modules ?? []);
}

export function renderFooter(data) {
  const v = data?.meta?.version ?? '2.0.5';
  document.getElementById('version-tag').textContent   = `v${v}`;
  document.getElementById('footer-version').textContent = `v${v}`;
  document.getElementById('last-updated').textContent  =
    'Updated ' + new Date().toUTCString().replace('GMT', 'UTC');
}

// Fallback module list used when the API is unreachable — shows degraded, not operational
export const FALLBACK_MODULES = [
  { name: 'Event Handlers',         group: 'Core',      state: 'degraded' },
  { name: 'Slash Commands',         group: 'Core',      state: 'degraded' },
  { name: 'Prefix Commands',        group: 'Core',      state: 'degraded' },
  { name: 'Function Handlers',      group: 'Core',      state: 'degraded' },
  { name: 'Trigger Handlers',       group: 'Core',      state: 'degraded' },
  { name: 'Bot Systems',            group: 'Systems',   state: 'degraded' },
  { name: 'Music',                  group: 'Systems',   state: 'degraded' },
  { name: 'Cron / Scheduled Tasks', group: 'Systems',   state: 'degraded' },
  { name: 'Error Handlers',         group: 'Systems',   state: 'degraded' },
  { name: 'REST API',               group: 'API',       state: 'degraded' },
  { name: 'Internal Bridge',        group: 'API',       state: 'degraded' },
  { name: 'Log Handlers',           group: 'Utilities', state: 'degraded' },
];

export const FALLBACK_DASHBOARD = {
  state: 'degraded',
  components: [
    { name: 'Express Server',   state: 'operational' },
    { name: 'Discord OAuth2',   state: 'operational' },
    { name: 'Session Store',    state: 'operational' },
    { name: 'Internal Bridge',  state: 'degraded'    },
    { name: 'Route Middleware', state: 'operational' },
    { name: 'Maintenance Mode', state: 'operational' },
  ],
};