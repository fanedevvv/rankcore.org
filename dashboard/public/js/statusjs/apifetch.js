// ─── Status API Fetch ─────────────────────────────────────────────────────────

import { lastFetch, fetchPending, setLastFetch, setFetchPending, setApiAvailable, POLL_INTERVAL } from './state.js';
import {
  renderBanner, renderStats, renderBotCard,
  renderDashboard, renderFooter, renderModules,
  FALLBACK_MODULES, FALLBACK_DASHBOARD,
} from './renderers.js';

export async function fetchStatus(force = false) {
  if (fetchPending) return;
  if (!force && Date.now() - lastFetch < POLL_INTERVAL) return;

  setFetchPending(true);
  const btn = document.getElementById('refresh-btn');
  btn.disabled    = true;
  btn.textContent = '↻ Loading…';

  try {
    const res = await fetch('/api/status', {
      method:  'GET',
      headers: { 'Accept': 'application/json' },
      // No credentials — endpoint is deliberately public
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    setLastFetch(Date.now());
    setApiAvailable(true);
    document.getElementById('api-error').classList.remove('show');

    renderBanner(data.status, data.cachedUntil);
    renderStats(data);
    renderBotCard(data);
    renderDashboard(data.dashboard ?? { state: 'operational', components: [] });
    renderFooter(data);

  } catch (err) {
    console.warn('[status] API unavailable, using fallback:', err.message);
    setApiAvailable(false);
    document.getElementById('api-error').classList.add('show');

    renderBanner('operational', null);
    renderStats({
      meta: { commandCount: 146, categoryCount: 17, subsystemCount: 20 },
      bot:  { ping: -1, uptimeFormatted: null, modulesRunning: null, modulesTotal: null },
    });
    renderModules(FALLBACK_MODULES);
    renderDashboard(FALLBACK_DASHBOARD);
    document.getElementById('bg-bot').className   = 'badge b-op';
    document.getElementById('bg-bot').textContent = 'Operational';
    document.getElementById('bg-dash').className  = 'badge b-op';
    document.getElementById('bg-dash').textContent = 'Operational';
    renderFooter(null);
  }

  setFetchPending(false);
  btn.disabled    = false;
  btn.textContent = '↻ Refresh';
}