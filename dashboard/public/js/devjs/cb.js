// devjs/cb.js — CB blacklist, global disable, and bot list management

import { secureFetch, escapeHtml, showToast } from './core.js';

export let rawBlacklist = [];
export let rawBots = [];
let globalDisabled = false;

// ── Blacklist renderers ───────────────────────────────────────────────────────

export function renderBlacklist(list) {
  const html = list.map(s => `
    <div class="list-item">
      <div><div class="li-id">${escapeHtml(s.serverId)}</div><div class="li-reason">${escapeHtml(s.reason || 'No reason')}</div></div>
      <button class="li-del" onclick="removeCbBlacklist('${s.serverId}')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`).join('') || '<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:0.75rem;font-weight:700">No blacklisted servers</div>';
  document.getElementById('cbBlacklistedServers').innerHTML = html;
  document.getElementById('cbBlacklistedServersFull').innerHTML = html;
}

export function filterCbBlacklist() {
  const q = document.getElementById('searchCbServers').value.toLowerCase();
  renderBlacklist(rawBlacklist.filter(s =>
    s.serverId.toLowerCase().includes(q) || (s.reason || '').toLowerCase().includes(q)
  ));
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function updateBadge() {
  const badge = document.getElementById('cbGlobalBadge');
  if (badge) {
    badge.textContent = globalDisabled ? 'Disabled' : 'Active';
    badge.style.background = globalDisabled ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.12)';
    badge.style.color = globalDisabled ? '#ef4444' : '#34d399';
    badge.style.borderColor = globalDisabled ? 'rgba(239,68,68,0.25)' : 'rgba(52,211,153,0.25)';
    badge.style.boxShadow = globalDisabled ? 'none' : '0 0 8px rgba(52,211,153,0.2)';
  }
}

// ── Bot list ──────────────────────────────────────────────────────────────────

function fmtUptime(ms) {
  if (!ms && ms !== 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function stateClass(state) {
  if (state === 'running' || state === 'active')    return 'state-ok';
  if (state === 'starting' || state === 'pending' || state === 'reconnecting') return 'state-warn';
  if (state === 'disabled' || state === 'inactive' || state === 'stopped') return '';
  return 'state-err';
}

export function renderBots(list) {
  const el = document.getElementById('cbBotList');
  if (!el) return;
  if (!Array.isArray(list)) list = [];
  el.innerHTML = list.map(b => {
    const actions = `
      <div class="btn-group" style="display:flex;gap:4px;flex-wrap:wrap">
        ${b.state === 'disabled' || b.state === 'inactive' || b.state === 'stopped'
          ? `<button class="btn btn-sm" onclick="cbBotAction('${b.guildId}','start')" title="Start">▶</button>`
          : `<button class="btn btn-sm" onclick="cbBotAction('${b.guildId}','stop')" title="Stop">⏹</button>
             <button class="btn btn-sm" onclick="cbBotAction('${b.guildId}','restart')" title="Restart">🔄</button>`}
        <button class="btn btn-sm btn-red" onclick="cbQuickBlacklist('${b.guildId}')" title="Blacklist">🚫</button>
      </div>`;
    return `<div class="list-item">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="li-id">${escapeHtml(b.guildId)}</span>
          <span class="${stateClass(b.state)}" style="font-size:0.65rem;font-weight:700;padding:1px 7px;border-radius:99px">${b.state}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:3px;font-size:0.72rem;color:var(--text2)">
          ${b.botClientId ? `<span>Bot: <strong>${escapeHtml(b.botClientId)}</strong></span>` : ''}
          ${b.botTag      ? `<span>Tag: <strong>${escapeHtml(b.botTag)}</strong></span>` : ''}
          ${b.botName     ? `<span>Name: <strong>${escapeHtml(b.botName)}</strong></span>` : ''}
          <span>Owner: <strong>${escapeHtml(b.ownerId)}</strong></span>
          <span>Setup: <strong>${b.setupState}${b.setupError ? ' — ' + escapeHtml(b.setupError) : ''}</strong></span>
          ${b.ping != null ? `<span>Ping: <strong>${b.ping}ms</strong></span>` : ''}
          ${b.uptime != null ? `<span>Uptime: <strong>${fmtUptime(b.uptime)}</strong></span>` : ''}
        </div>
      </div>
      ${actions}
    </div>`;
  }).join('') || '<div style="text-align:center;padding:32px 0;color:var(--muted);font-size:0.8rem">No CB bots found</div>';
  document.getElementById('cbBotCount').textContent = list.length;
}

export function filterCbBots() {
  const q = document.getElementById('searchCbBots').value.toLowerCase();
  renderBots(rawBots.filter(b =>
    b.guildId.toLowerCase().includes(q) ||
    (b.botClientId || '').toLowerCase().includes(q) ||
    (b.botName || '').toLowerCase().includes(q) ||
    (b.ownerId || '').toLowerCase().includes(q) ||
    (b.botTag || '').toLowerCase().includes(q)
  ));
}

// ── Loaders ───────────────────────────────────────────────────────────────────

export async function loadCbConfig() {
  // Fetch each endpoint independently so one failure doesn't block the others
  try {
    const configRes = await secureFetch('/api-dev/cb/config');
    if (configRes.ok) {
      const cfg = await configRes.json();
      globalDisabled = cfg.globalDisabled;
      updateBadge();
    }
  } catch (e) { console.error('[CB] config fetch failed', e); }

  try {
    const blRes = await secureFetch('/api-dev/cb/blacklist');
    if (blRes.ok) {
      rawBlacklist = await blRes.json();
      renderBlacklist(rawBlacklist);
    }
  } catch (e) { console.error('[CB] blacklist fetch failed', e); }

  try {
    const botRes = await secureFetch('/api-dev/cb/bots');
    if (botRes.ok) {
      rawBots = await botRes.json();
      if (Array.isArray(rawBots)) {
        renderBots(rawBots);
      } else {
        console.error('[CB] bots response not an array', rawBots);
      }
    } else {
      console.error('[CB] bots fetch not ok', botRes.status, await botRes.text().catch(() => ''));
    }
  } catch (e) { console.error('[CB] bots fetch failed', e); }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function toggleCbGlobal() {
  try {
    const res = await secureFetch('/api-dev/cb/global/toggle', { method: 'POST' }).then(r => r.json());
    globalDisabled = res.globalDisabled;
    updateBadge();
    showToast(globalDisabled ? 'CB globally disabled' : 'CB globally enabled');
  } catch (err) {
    showToast(err.message || 'Failed to toggle', true);
  }
}

export async function toggleCbBlacklist() {
  const serverId = document.getElementById('cbServerId').value.trim();
  const reason   = document.getElementById('cbReason').value.trim() || 'No reason provided';
  if (!serverId) return showToast('Guild ID required', true);
  try {
    const res = await secureFetch('/api-dev/cb/blacklist', {
      method: 'POST',
      body: JSON.stringify({ serverId, reason }),
    }).then(r => r.json());
    showToast(`Server ${res.action || 'blacklisted'}`);
    loadCbConfig();
    document.getElementById('cbServerId').value = '';
    document.getElementById('cbReason').value = '';
  } catch (err) {
    showToast(err.message || 'Failed', true);
  }
}

export async function removeCbBlacklist(serverId) {
  try {
    await secureFetch(`/api-dev/cb/blacklist/${serverId}`, { method: 'DELETE' });
    showToast('Server removed from CB blacklist');
    loadCbConfig();
  } catch (err) {
    showToast(err.message || 'Failed', true);
  }
}

export async function cbBotAction(guildId, action) {
  try {
    const res = await secureFetch(`/api-dev/cb/bot/${guildId}/${action}`, { method: 'POST' }).then(r => r.json());
    if (res.error) return showToast(res.error, true);
    showToast(`${action} ${res.state ? '→ ' + res.state : 'ok'}`);
    loadCbConfig();
  } catch (err) {
    showToast(err.message || `Failed to ${action}`, true);
  }
}

export async function cbQuickBlacklist(guildId) {
  try {
    const res = await secureFetch('/api-dev/cb/blacklist', {
      method: 'POST',
      body: JSON.stringify({ serverId: guildId, reason: 'Blacklisted from dev panel' }),
    }).then(r => r.json());
    showToast(`Server ${res.action || 'blacklisted'}`);
    // If added, stop the bot
    if (res.action === 'added') {
      await cbBotAction(guildId, 'stop');
    }
    loadCbConfig();
  } catch (err) {
    showToast(err.message || 'Failed to blacklist', true);
  }
}
