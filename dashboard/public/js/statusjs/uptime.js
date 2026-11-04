// statusjs/uptime.js — Uptime bar construction (skeleton, live, hourly, fallback)
// ─────────────────────────────────────────────────────────────────────────────

import { showTooltip, hideTooltip } from './tooltip.js';
import { state }                    from './state.js';

// ── Tab switcher ──────────────────────────────────────────────────────────────

export function switchUptimeTab(tab, btn) {
  document.querySelectorAll('.utab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.uptime-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');
}

// ── Skeleton (loading placeholders) ──────────────────────────────────────────

export function buildSkeletonBar(id, count) {
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const t = document.createElement('div');
    t.className = 'uptime-tick loading';
    bar.appendChild(t);
  }
}

export function initSkeletonBars() {
  buildSkeletonBar('uptime-bar-hourly',    24);
  buildSkeletonBar('uptime-bar-weekly',     7);
  buildSkeletonBar('uptime-bar-monthly',   30);
  buildSkeletonBar('uptime-bar-quarterly', 90);
}

// ── Live bar from structured day/hour data ────────────────────────────────────

export function buildBar(id, data, labelFn, pctElId) {
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.innerHTML = '';

  let upCount = 0, known = 0;

  data.forEach(d => {
    const t = document.createElement('div');
    t.className = 'uptime-tick ' + (d.state || 'nodata');
    t.addEventListener('mouseenter', e => showTooltip(e, labelFn(d), d.state, d.avgPing));
    t.addEventListener('mouseleave', hideTooltip);
    bar.appendChild(t);

    if (d.state !== 'nodata') {
      known++;
      if (d.state === 'ok')      upCount += 1;
      else if (d.state === 'partial') upCount += 0.5;
    }
  });

  const pctEl = document.getElementById(pctElId);
  if (pctEl && known > 0) {
    const pct = (upCount / known * 100).toFixed(2);
    pctEl.textContent = pct + '% uptime';
    pctEl.style.color =
      pct >= 99 ? 'var(--red-status)' :
      pct >= 95 ? 'var(--orange)' :
                  'var(--red)';
  }
}

// ── Hourly bar from raw snapshot entries ──────────────────────────────────────

function formatHourLabel(ts) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function collapseToHours(entries) {
  const now   = Date.now();
  const hours = [];
  for (let h = 23; h >= 0; h--) {
    const hStart = now - (h + 1) * 3600000;
    const hEnd   = now - h * 3600000;
    const snaps  = entries.filter(e => e.ts >= hStart && e.ts < hEnd);

    if (!snaps.length) {
      hours.push({ state: 'nodata', label: formatHourLabel(hStart), avgPing: null });
      continue;
    }

    const up   = snaps.filter(s => s.status === 'up').length;
    const down = snaps.filter(s => s.status === 'down').length;
    const pings    = snaps.filter(s => s.ping >= 0).map(s => s.ping);
    const avgPing  = pings.length
      ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
      : null;

    let st;
    if (down / snaps.length > 0.5)  st = 'down';
    else if (up / snaps.length < 0.9) st = 'partial';
    else                               st = 'ok';

    hours.push({ state: st, label: formatHourLabel(hStart), avgPing });
  }
  return hours;
}

export function buildHourlyFromEntries(entries) {
  const hours = collapseToHours(entries);
  buildBar('uptime-bar-hourly', hours, d => d.label, 'ub-pct-hourly');
}

// Fallback when raw entries aren't available — derive from last daily snapshot
export function buildHourlyFallback(days, currentStatus) {
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const today = days[days.length - 1];
    const state =
      i < 23
        ? (today?.state ?? 'nodata')
        : (currentStatus === 'operational' ? 'ok' :
           currentStatus === 'degraded'    ? 'partial' : 'nodata');
    const d = new Date();
    d.setHours(d.getHours() - (23 - i), 0, 0, 0);
    hourly.push({ state, label: d.toLocaleString([], { hour: '2-digit', minute: '2-digit' }), avgPing: null });
  }
  buildBar('uptime-bar-hourly', hourly, d => d.label, 'ub-pct-hourly');
}

// ── Fallback bars (all ranges) when API is unreachable ────────────────────────

export function buildFallbackBars() {
  const makeDays = n => Array.from({ length: n }, (_, i) => ({
    state:   i % 20 === 7 ? 'down' : i % 15 === 4 ? 'partial' : i < 5 ? 'nodata' : 'ok',
    date:    new Date(Date.now() - (n - i) * 86400000).toISOString().slice(0, 10),
    avgPing: 60 + Math.floor(Math.random() * 40),
  }));

  buildBar('uptime-bar-quarterly', makeDays(90), d => d.date, 'ub-pct-quarterly');
  buildBar('uptime-bar-monthly',   makeDays(30), d => d.date, 'ub-pct-monthly');
  buildBar('uptime-bar-weekly',    makeDays(7),  d => d.date, 'ub-pct-weekly');

  const hours = Array.from({ length: 24 }, (_, i) => ({
    state:   i === 14 ? 'partial' : 'ok',
    label:   new Date(Date.now() - (23 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    avgPing: 65 + Math.floor(Math.random() * 30),
  }));
  buildBar('uptime-bar-hourly', hours, d => d.label, 'ub-pct-hourly');

  // Expose pings for chart
  state.pingHistory = Array.from({ length: 48 }, (_, i) =>
    70 + Math.floor(Math.sin(i / 4) * 20 + Math.random() * 10)
  );
}