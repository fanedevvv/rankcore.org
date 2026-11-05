/**
 * RANKCORE Dev Panel — Module Manager
 * Handles the Modules tab: list, start, stop, restart, and per-module log viewer.
 * Uses the panel's own CSS variables / utility classes — no Tailwind dependency.
 */

import { secureFetch, showToast } from './core.js';

/* ── State ───────────────────────────────────────────────────────────────── */
let _modules    = [];
let _activeLogs = null;   // module name whose logs are open
let _pollTimer  = null;
let _logPoll    = null;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s/60)}m ${s % 60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

const STATE_STYLE = {
  running:  { color: 'var(--accent)',  bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
  error:    { color: 'var(--red)',     bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
  stopped:  { color: 'var(--muted)',   bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)'},
  starting: { color: 'var(--yellow)',  bg: 'rgba(250,204,21,0.08)',  border: 'rgba(250,204,21,0.2)'  },
  stopping: { color: 'var(--orange)',  bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)'  },
  disabled: { color: 'var(--muted)',   bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.05)'},
};

function stateBadge(state) {
  const s = STATE_STYLE[state] || STATE_STYLE.stopped;
  return `<span style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;
    padding:3px 9px;border-radius:12px;color:${s.color};background:${s.bg};border:1px solid ${s.border}">${state}</span>`;
}

/* ── Fetch & Render ──────────────────────────────────────────────────────── */
export async function fetchModules() {
  try {
    const r = await secureFetch('/api-dev/modules');
    if (!r.ok) return;
    const data = await r.json();
    if (Array.isArray(data)) { _modules = data; renderModules(); }
  } catch (err) {
    console.error('[modules] fetch error:', err);
  }
}

function renderModules() {
  const container = document.getElementById('modules-list');
  if (!container) return;

  if (!_modules.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:0.78rem;font-weight:700">
      No modules registered</div>`;
    return;
  }

  // Group by mod.group
  const groups = {};
  for (const mod of _modules) {
    const g = mod.group || 'General';
    (groups[g] = groups[g] || []).push(mod);
  }

  let html = '';
  for (const [group, mods] of Object.entries(groups)) {
    html += `
    <div style="margin-bottom:20px">
      <div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.09em;
        color:var(--muted);padding:0 4px;margin-bottom:8px">${escHtml(group)}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${mods.map(renderModuleRow).join('')}
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

function renderModuleRow(mod) {
  const uptime     = formatUptime(mod.uptime);
  const canStart   = ['stopped','error','disabled'].includes(mod.state);
  const canStop    = ['running','starting'].includes(mod.state);
  const canRestart = ['running','error'].includes(mod.state);
  const isDisabled = mod.state === 'disabled';

  const actionBtns = isDisabled
    ? `<button class="btn btn-blue sm" data-action="enable"   data-mod="${escHtml(mod.name)}">Enable</button>`
    : `<button class="btn btn-green sm"  data-action="start"   data-mod="${escHtml(mod.name)}" ${!canStart   ? 'disabled' : ''}>Start</button>
       <button class="btn btn-red sm"    data-action="stop"    data-mod="${escHtml(mod.name)}" ${!canStop    ? 'disabled' : ''}>Stop</button>
       <button class="btn btn-yellow sm" data-action="restart" data-mod="${escHtml(mod.name)}" ${!canRestart ? 'disabled' : ''}>Restart</button>
       <button class="btn btn-ghost sm"  data-action="disable" data-mod="${escHtml(mod.name)}">Disable</button>`;

  return `
  <div class="module-row" id="module-row-${escHtml(mod.name)}"
    style="display:flex;align-items:center;justify-content:space-between;gap:12px;
      padding:13px 16px;background:rgba(255,255,255,0.025);border:1px solid var(--border);
      border-radius:10px;transition:border-color 0.15s;flex-wrap:wrap"
    onmouseenter="this.style.borderColor='var(--border-hi)'"
    onmouseleave="this.style.borderColor='var(--border)'">

    <!-- Info -->
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
        <span style="font-size:0.88rem;font-weight:700;color:#fff">${escHtml(mod.label || mod.name)}</span>
        ${stateBadge(mod.state)}
        ${mod.critical ? `<span style="font-size:0.58rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;
          padding:2px 8px;border-radius:10px;color:var(--violet);background:rgba(167,139,250,0.1);
          border:1px solid rgba(167,139,250,0.2)">critical</span>` : ''}
      </div>
      <div style="font-size:0.72rem;color:var(--muted);margin-bottom:5px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(mod.description || mod.name)}</div>
      <div style="display:flex;gap:14px;font-size:0.68rem;color:var(--muted);font-family:var(--mono)">
        <span>uptime <span style="color:var(--text2)">${uptime}</span></span>
        <span>restarts <span style="color:var(--text2)">${mod.restartCount ?? 0}</span></span>
        ${mod.error ? `<span style="color:var(--red);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px"
          title="${escHtml(mod.error)}">⚠ ${escHtml(mod.error)}</span>` : ''}
      </div>
    </div>

    <!-- Actions -->
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-shrink:0">
      <button class="btn btn-ghost sm" data-action="logs" data-mod="${escHtml(mod.name)}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Logs
      </button>
      ${actionBtns}
    </div>
  </div>`;
}

/* ── Action dispatch ─────────────────────────────────────────────────────── */
export function initModuleActions() {
  document.getElementById('modules-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action;
    const name   = btn.dataset.mod;

    if (action === 'logs') { openModuleLogs(name); return; }

    btn.disabled    = true;
    const orig      = btn.textContent;
    btn.textContent = '…';

    try {
      const r = await secureFetch(`/api-dev/modules/${encodeURIComponent(name)}/${action}`, { method: 'POST' });
      const d = await r.json();
      if (d.error) showToast(d.error, true);
      else {
        showToast(`${name} → ${action}`);
        if (d.status) {
          const idx = _modules.findIndex(m => m.name === name);
          if (idx >= 0) _modules[idx] = d.status;
          renderModules();
        }
      }
    } catch { showToast('Request failed', true); }
    finally { await fetchModules(); btn.disabled = false; btn.textContent = orig; }
  });
}

/* ── Log modal ───────────────────────────────────────────────────────────── */
export function openModuleLogs(name) {
  _activeLogs = name;

  const modal     = document.getElementById('module-log-modal');
  const titleEl   = document.getElementById('module-log-title');
  const bodyEl    = document.getElementById('module-log-body');

  if (!modal) return;

  if (titleEl) titleEl.textContent = `Logs — ${name}`;
  if (bodyEl)  bodyEl.innerHTML    = `<div style="color:var(--muted);font-size:0.75rem;font-family:var(--mono);padding:12px 0">Loading…</div>`;

  modal.style.display = 'flex';
  requestAnimationFrame(() => { modal.style.opacity = '1'; });

  // Lock body scroll
  document.body.style.overflow = 'hidden';

  refreshModuleLogs();
  // Poll every 3s while modal is open
  _logPoll = setInterval(refreshModuleLogs, 3000);
}

export function closeModuleLogs() {
  _activeLogs = null;
  clearInterval(_logPoll); _logPoll = null;

  const modal = document.getElementById('module-log-modal');
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => { modal.style.display = 'none'; }, 200);
  document.body.style.overflow = '';
}

async function refreshModuleLogs() {
  if (!_activeLogs) return;
  const bodyEl = document.getElementById('module-log-body');
  if (!bodyEl) return;

  try {
    const r = await secureFetch(`/api-dev/modules/${encodeURIComponent(_activeLogs)}/logs?limit=150`);
    if (!r.ok) return;
    const logs = await r.json();

    if (!Array.isArray(logs) || !logs.length) {
      bodyEl.innerHTML = `<div style="color:var(--muted);font-size:0.75rem;font-family:var(--mono);font-style:italic;padding:12px 0">No log entries yet.</div>`;
      return;
    }

    const LEVEL_COLOR = { error: '#ed4245', warn: '#faa61a', info: '#57f287', debug: '#7289da' };
    const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 40;

    bodyEl.innerHTML = logs.map(e => {
      const color = LEVEL_COLOR[e.level] || '#b9bbbe';
      const time  = new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false });
      return `<div style="display:flex;gap:10px;padding:2px 0;font-size:0.73rem;font-family:'JetBrains Mono',monospace;line-height:1.6;align-items:flex-start">
        <span style="color:#4f545c;flex-shrink:0;user-select:none">${escHtml(time)}</span>
        <span style="color:${color};font-weight:800;font-size:0.62rem;flex-shrink:0;margin-top:2px;width:36px;letter-spacing:0.04em">${escHtml((e.level||'log').toUpperCase().slice(0,4))}</span>
        <span style="color:#dcddde;word-break:break-all;white-space:pre-wrap">${escHtml(e.message)}</span>
      </div>`;
    }).join('');

    if (atBottom) bodyEl.scrollTop = bodyEl.scrollHeight;
  } catch (err) {
    console.warn('[modules] log refresh error:', err);
  }
}

/* ── Start / Stop polling on tab visibility ──────────────────────────────── */
export function startModulePolling() {
  stopModulePolling();
  fetchModules();
  _pollTimer = setInterval(fetchModules, 5000);
}

export function stopModulePolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

/* ── Init ────────────────────────────────────────────────────────────────── */
export function initModules() {
  initModuleActions();

  // Close modal on backdrop click or close btn
  const modal    = document.getElementById('module-log-modal');
  const closeBtn = document.getElementById('module-log-close');
  const refBtn   = document.getElementById('module-log-refresh');

  if (closeBtn) closeBtn.addEventListener('click', closeModuleLogs);
  if (refBtn)   refBtn.addEventListener('click',   refreshModuleLogs);

  modal?.addEventListener('click', e => {
    if (e.target === modal) closeModuleLogs();
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _activeLogs) closeModuleLogs();
  });
}