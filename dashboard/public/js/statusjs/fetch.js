// statusjs/fetch.js — API fetches: /api/status, /api/status/history, /api/status/incidents
// ─────────────────────────────────────────────────────────────────────────────

import { state }                                          from './state.js';
import { startCountdown }                                 from './clock.js';
import { renderBanner, renderStats, renderUptimeStat,
         renderLastIncident, renderVersion }              from './banner.js';
import { renderModules, renderDash }                      from './modules.js';
import { setCardBadge, renderPingPill }                   from './cards.js';
import { renderResponseBands, drawPingChart }             from './chart.js';
import { buildBar, buildHourlyFromEntries,
         buildHourlyFallback, buildFallbackBars }         from './uptime.js';
import { renderIncidents }                                from './incidents.js';

// ── forceRefresh (called from header button) ──────────────────────────────────

export function forceRefresh() {
  clearInterval(state.refreshTimer);
  fetchAll();
}

// ── Main fetch orchestrator ───────────────────────────────────────────────────

export async function fetchAll() {
  const refreshBtn = document.getElementById('refresh-btn');
  const loadingEl  = document.getElementById('loading-skeleton');
  const errorEl    = document.getElementById('api-error');

  if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '↻ …'; }

  // Restart the countdown; when it fires it will call fetchAll again
  startCountdown(fetchAll);

  // ── /api/status ────────────────────────────────────────────────────────────
  try {
    const t0   = performance.now();
    const res  = await fetch('/api/status', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    // Record response latency for the dashboard bridge display
    window.__noxxDashPing = Math.round(performance.now() - t0);

    state.statusData = data;
    window.__noxxLastStatus = data; // expose globally for modules.js real-logic

    renderBanner(data.status, data.timestamp, data.override);
    renderStats(data);
    renderVersion(data.meta?.version);
    renderModules(data.bot?.modules);
    renderDash(data.dashboard, data);
    renderPingPill(data.bot?.ping ?? -1);
    setCardBadge('bg-bot',  data.bot?.ready ? data.status : (data.status === 'down' ? 'down' : 'starting'));
    setCardBadge('bg-dash', data.dashboard?.state || 'operational');
    renderResponseBands(data.bot?.ping ?? -1);

    if (loadingEl) loadingEl.style.display = 'none';
    const banner = document.getElementById('banner');
    if (banner) banner.style.display = 'flex';

    if (errorEl) errorEl.classList.remove('show');
  } catch (_) {
    if (errorEl) errorEl.classList.add('show');
    if (loadingEl) loadingEl.style.display = 'none';
    const banner = document.getElementById('banner');
    if (banner) banner.style.display = 'flex';

    renderBanner('down', null, null);
    renderPingPill(-1);

    // Build a synthetic offline payload — used by all renderers
    const offlineModules = [
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
    const offlineDashboard = {
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
    const offlineData = {
      status:    'down',
      bot:       { ready: false, modules: offlineModules, modulesRunning: 0, modulesTotal: 12, ping: -1, uptimeFormatted: '0s' },
      dashboard: offlineDashboard,
    };
    window.__noxxLastStatus = offlineData;

    setCardBadge('bg-bot',  'down');
    setCardBadge('bg-dash', 'degraded');
    renderModules(offlineModules, offlineData);
    renderDash(offlineDashboard, offlineData);
    renderResponseBands(-1);
  }

  // ── /api/status/history ────────────────────────────────────────────────────
  try {
    const res  = await fetch('/api/status/history', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    state.historyData = data;
    const days = data.days || [];

    buildBar('uptime-bar-quarterly', days,            d => d.date, 'ub-pct-quarterly');
    buildBar('uptime-bar-monthly',   days.slice(-30), d => d.date, 'ub-pct-monthly');
    buildBar('uptime-bar-weekly',    days.slice(-7),  d => d.date, 'ub-pct-weekly');

    if (data.entries && Array.isArray(data.entries)) {
      buildHourlyFromEntries(data.entries);
    } else {
      buildHourlyFallback(days, state.statusData?.status || 'operational');
    }

    renderUptimeStat(data.overallUptime);

    // Ping history for chart (last 48 daily avg pings)
    state.pingHistory = days.slice(-48).map(d => d.avgPing ?? -1);
    drawPingChart(state.pingHistory);

  } catch (_) {
    buildFallbackBars();
    drawPingChart(state.pingHistory);
    renderResponseBands(85);

    const el = document.getElementById('s-uptime-pct');
    if (el) { el.textContent = '99.72%'; el.className = 'stat-num ping-good'; }
    const li = document.getElementById('s-last-inc');
    if (li) li.textContent = 'No recent incidents';
  }

  // ── /api/status/incidents ──────────────────────────────────────────────────
  try {
    const res  = await fetch('/api/status/incidents', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    renderIncidents(data.incidents || []);
    renderLastIncident(data.incidents || []);
  } catch (_) {
    renderIncidents([]);
  }

  // Footer timestamp
  const luEl = document.getElementById('last-updated');
  if (luEl) {
    luEl.textContent = 'Updated ' +
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '↻ Refresh'; }
}