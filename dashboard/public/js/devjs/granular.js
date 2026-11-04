/**
 * ROCO Dev Panel — Granular Control
 * Individual enable/disable for events, slash commands, and systems.
 * Drop this file at: dashboard/public/js/devjs/granular.js
 * Then import + wire it up in devmain.js (see bottom of this file for instructions).
 */

import { secureFetch, showToast } from './core.js';

/* ── State ───────────────────────────────────────────────────────────────── */
let _data        = { events: [], commands: [], systems: [] };
let _pollTimer   = null;
let _activeTab   = 'commands';  // 'commands' | 'events' | 'systems'
let _searchQuery = '';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleBadge(enabled) {
  return enabled
    ? `<span style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;
        padding:3px 9px;border-radius:12px;color:var(--accent);background:rgba(239,68,68,0.08);
        border:1px solid rgba(239,68,68,0.2)">enabled</span>`
    : `<span style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;
        padding:3px 9px;border-radius:12px;color:var(--red);background:rgba(248,113,113,0.08);
        border:1px solid rgba(248,113,113,0.2)">disabled</span>`;
}

/* ── Fetch ───────────────────────────────────────────────────────────────── */
async function fetchGranular() {
  try {
    const r = await secureFetch('/api-dev/granular');
    if (!r.ok) return;
    const d = await r.json();
    if (d.events && d.commands && d.systems) {
      _data = d;
      renderGranular();
    }
  } catch (err) {
    console.error('[granular] fetch error:', err);
  }
}

/* ── Render ──────────────────────────────────────────────────────────────── */
function renderGranular() {
  renderSubTabs();
  renderActiveTab();
  renderCounts();
}

function renderCounts() {
  const setCount = (id, arr) => {
    const el = document.getElementById(id);
    if (el) el.textContent = arr.length;
  };
  const setDisabled = (id, arr) => {
    const el = document.getElementById(id);
    if (el) {
      const count = arr.filter(x => !x.enabled).length;
      el.textContent = count > 0 ? ` (${count} off)` : '';
    }
  };

  setCount('granular-cmd-count', _data.commands);
  setCount('granular-evt-count', _data.events);
  setCount('granular-sys-count', _data.systems);
  setDisabled('granular-cmd-disabled', _data.commands);
  setDisabled('granular-evt-disabled', _data.events);
  setDisabled('granular-sys-disabled', _data.systems);
}

function renderSubTabs() {
  ['commands','events','systems'].forEach(tab => {
    const el = document.getElementById(`granular-subtab-${tab}`);
    if (el) el.classList.toggle('active', _activeTab === tab);
  });
}

function renderActiveTab() {
  const container = document.getElementById('granular-list');
  if (!container) return;

  const q = _searchQuery.toLowerCase();

  if (_activeTab === 'commands') {
    renderCommandList(container, q);
  } else if (_activeTab === 'events') {
    renderEventList(container, q);
  } else if (_activeTab === 'systems') {
    renderSystemList(container, q);
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────
function renderCommandList(container, q) {
  const items = _data.commands.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q)
  );

  if (!items.length) {
    container.innerHTML = emptyState('No commands match your search.');
    return;
  }

  // Group by category
  const groups = {};
  for (const cmd of items) {
    const g = cmd.category || 'Uncategorized';
    (groups[g] = groups[g] || []).push(cmd);
  }

  container.innerHTML = Object.entries(groups).map(([group, cmds]) => `
    <div style="margin-bottom:18px">
      <div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.09em;
        color:var(--muted);padding:0 4px;margin-bottom:8px">${esc(group)}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${cmds.map(cmd => itemRow({
          id:      `cmd:${cmd.name}`,
          label:   `/${esc(cmd.name)}`,
          sub:     esc(cmd.description || ''),
          badge:   '',
          enabled: cmd.enabled,
          type:    'commands',
          key:     cmd.name,
        })).join('')}
      </div>
    </div>
  `).join('');
}

// ── Events ────────────────────────────────────────────────────────────────────
function renderEventList(container, q) {
  const items = _data.events.filter(e =>
    !q || e.label?.toLowerCase().includes(q) || e.event?.toLowerCase().includes(q) || e.file?.toLowerCase().includes(q)
  );

  if (!items.length) {
    container.innerHTML = emptyState('No events match your search.');
    return;
  }

  const groups = {};
  for (const evt of items) {
    const g = evt.group || 'Other';
    (groups[g] = groups[g] || []).push(evt);
  }

  container.innerHTML = Object.entries(groups).map(([group, evts]) => `
    <div style="margin-bottom:18px">
      <div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.09em;
        color:var(--muted);padding:0 4px;margin-bottom:8px">${esc(group)}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${evts.map(evt => itemRow({
          id:      `evt:${evt.key}`,
          label:   esc(evt.label || evt.file),
          sub:     `<span style="color:var(--muted);font-family:var(--mono);font-size:0.68rem">${esc(evt.event)}</span>`,
          badge:   '',
          enabled: evt.enabled,
          type:    'events',
          key:     evt.key,
        })).join('')}
      </div>
    </div>
  `).join('');
}

// ── Systems ───────────────────────────────────────────────────────────────────
function renderSystemList(container, q) {
  const items = _data.systems.filter(s =>
    !q || s.key?.toLowerCase().includes(q) || s.label?.toLowerCase().includes(q)
  );

  if (!items.length) {
    container.innerHTML = emptyState('No systems match your search.');
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${items.map(sys => itemRow({
        id:      `sys:${sys.key}`,
        label:   esc(sys.label || sys.key),
        sub:     `<span style="color:var(--muted);font-size:0.7rem">${esc(sys.file || '')}</span>`,
        badge:   '',
        enabled: sys.enabled,
        type:    'systems',
        key:     sys.key,
      })).join('')}
    </div>`;
}

// ── Shared row template ───────────────────────────────────────────────────────
function itemRow({ id, label, sub, enabled, type, key }) {
  const encodedKey = encodeURIComponent(key);
  return `
  <div id="granular-row-${esc(id)}"
    style="display:flex;align-items:center;justify-content:space-between;gap:12px;
      padding:11px 14px;background:rgba(255,255,255,0.025);border:1px solid var(--border);
      border-radius:8px;transition:border-color 0.15s;flex-wrap:wrap"
    onmouseenter="this.style.borderColor='var(--border-hi)'"
    onmouseleave="this.style.borderColor='var(--border)'">
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
        <span style="font-size:0.85rem;font-weight:700;color:#fff">${label}</span>
        ${toggleBadge(enabled)}
      </div>
      <div style="font-size:0.7rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      ${enabled
        ? `<button class="btn btn-red sm" data-granular-type="${esc(type)}" data-granular-key="${esc(encodedKey)}" data-granular-action="disable">Disable</button>`
        : `<button class="btn btn-green sm" data-granular-type="${esc(type)}" data-granular-key="${esc(encodedKey)}" data-granular-action="enable">Enable</button>`
      }
    </div>
  </div>`;
}

function emptyState(msg) {
  return `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:0.78rem;font-weight:700">${esc(msg)}</div>`;
}

/* ── Action handler ──────────────────────────────────────────────────────── */
async function handleGranularAction(btn) {
  const type   = btn.dataset.granularType;    // 'events' | 'commands' | 'systems'
  const key    = decodeURIComponent(btn.dataset.granularKey);
  const action = btn.dataset.granularAction;  // 'enable' | 'disable'

  btn.disabled    = true;
  const orig      = btn.textContent;
  btn.textContent = '…';

  try {
    const url = `/api-dev/granular/${type}/${encodeURIComponent(key)}/${action}`;
    const r   = await secureFetch(url, { method: 'POST' });
    const d   = await r.json();

    if (d.error) {
      showToast(d.error, true);
    } else {
      showToast(`${key} → ${action}d`);
      // Optimistically update local state so re-render is instant
      if (type === 'commands') {
        const item = _data.commands.find(c => c.name === key);
        if (item) item.enabled = (action === 'enable');
      } else if (type === 'events') {
        const item = _data.events.find(e => e.key === key);
        if (item) item.enabled = (action === 'enable');
      } else if (type === 'systems') {
        const item = _data.systems.find(s => s.key === key);
        if (item) item.enabled = (action === 'enable');
      }
      renderGranular();
    }
  } catch {
    showToast('Request failed', true);
  } finally {
    btn.disabled    = false;
    btn.textContent = orig;
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */
export function initGranular() {
  // Sub-tab switching
  ['commands','events','systems'].forEach(tab => {
    document.getElementById(`granular-subtab-${tab}`)?.addEventListener('click', () => {
      _activeTab = tab;
      renderGranular();
    });
  });

  // Search box
  document.getElementById('granular-search')?.addEventListener('input', e => {
    _searchQuery = e.target.value.trim();
    renderActiveTab();
  });

  // Delegated enable/disable clicks
  document.getElementById('granular-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-granular-action]');
    if (!btn || btn.disabled) return;
    await handleGranularAction(btn);
  });

  // Initial load
  fetchGranular();
}

export function startGranularPolling() {
  stopGranularPolling();
  fetchGranular();
  _pollTimer = setInterval(fetchGranular, 8000);
}

export function stopGranularPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

/*
 * ── HOW TO WIRE THIS INTO THE DEV PANEL ────────────────────────────────────
 *
 * 1. In dashboard/views/features/dev.html, add a new nav tab:
 *
 *    <div class="nav-tab" onclick="switchMainTab('granular',this)">
 *      <span class="t-ico">🎛️</span><span class="t-label">Granular</span>
 *    </div>
 *
 * 2. Add the panel HTML somewhere in dev.html (after the modules panel):
 *
 *    <div id="panel-granular" class="main-panel">
 *      <div class="card">
 *        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
 *          <span style="font-weight:800">🎛️ Granular Control</span>
 *          <input id="granular-search" type="text" placeholder="Search…"
 *            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
 *              padding:6px 10px;font-size:0.8rem;color:var(--text);width:200px">
 *        </div>
 *        <div class="subtab-row">
 *          <div id="granular-subtab-commands" class="subtab active" style="cursor:pointer">
 *            Commands <span id="granular-cmd-count" style="opacity:.5"></span><span id="granular-cmd-disabled" style="color:var(--red);font-size:0.7rem"></span>
 *          </div>
 *          <div id="granular-subtab-events" class="subtab" style="cursor:pointer">
 *            Events <span id="granular-evt-count" style="opacity:.5"></span><span id="granular-evt-disabled" style="color:var(--red);font-size:0.7rem"></span>
 *          </div>
 *          <div id="granular-subtab-systems" class="subtab" style="cursor:pointer">
 *            Systems <span id="granular-sys-count" style="opacity:.5"></span><span id="granular-sys-disabled" style="color:var(--red);font-size:0.7rem"></span>
 *          </div>
 *        </div>
 *        <div class="subtab-divider"></div>
 *        <div id="granular-list" style="padding:16px 20px"></div>
 *      </div>
 *    </div>
 *
 * 3. In dashboard/public/js/devmain.js, add:
 *
 *    import { initGranular, startGranularPolling, stopGranularPolling } from './devjs/granular.js';
 *
 *    Then call initGranular() in your init block, and hook startGranularPolling /
 *    stopGranularPolling into your tab-switching logic the same way modules polling works.
 */