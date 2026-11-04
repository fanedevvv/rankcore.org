// devjs/blacklist.js

import { secureFetch, escapeHtml, showToast } from './core.js';

// ── Raw data stores (shared with renderers) ───────────────────────────────────
export let rawUsers   = [];
export let rawServers = [];

// ── Renderers ─────────────────────────────────────────────────────────────────

export function renderUserList(users) {
  document.getElementById('blacklistedUsers').innerHTML = users.map(u => `
    <div class="list-item">
      <div><div class="li-id">${escapeHtml(u.userId)}</div><div class="li-reason">${escapeHtml(u.reason || 'No reason')}</div></div>
      <button class="li-del" onclick="removeUserBlacklist('${u.userId}')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`).join('') || '<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:0.75rem;font-weight:700">No banned users</div>';
}

export function renderServerList(servers) {
  document.getElementById('blacklistedServers').innerHTML = servers.map(s => `
    <div class="list-item">
      <div><div class="li-id">${escapeHtml(s.serverId)}</div><div class="li-reason">${escapeHtml(s.reason || 'No reason')}</div></div>
      <button class="li-del" onclick="removeServerBlacklist('${s.serverId}')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`).join('') || '<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:0.75rem;font-weight:700">No banned guilds</div>';
}

// ── Filters ───────────────────────────────────────────────────────────────────

export function filterUsers() {
  const q = document.getElementById('searchUsers').value.toLowerCase();
  renderUserList(rawUsers.filter(u =>
    u.userId.toLowerCase().includes(q) || (u.reason || '').toLowerCase().includes(q)
  ));
}

export function filterServers() {
  const q = document.getElementById('searchServers').value.toLowerCase();
  renderServerList(rawServers.filter(s =>
    s.serverId.toLowerCase().includes(q) || (s.reason || '').toLowerCase().includes(q)
  ));
}

// ── Loaders ───────────────────────────────────────────────────────────────────

export async function loadBlacklists() {
  try {
    [rawUsers, rawServers] = await Promise.all([
      secureFetch('/api-dev/blacklist/users').then(r => r.json()),
      secureFetch('/api-dev/blacklist/servers').then(r => r.json()),
    ]);
    filterUsers();
    filterServers();
  } catch {}
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function toggleUserBlacklist() {
  const userId = document.getElementById('userId').value.trim();
  const reason = document.getElementById('userReason').value.trim() || 'No reason provided';
  if (!userId) return showToast('User ID required', true);
  const exists = rawUsers.some(u => u.userId === userId);
  const res = await secureFetch('/api-dev/blacklist/users', {
    method: 'POST',
    body: JSON.stringify(exists ? { userId } : { userId, reason }),
  }).then(r => r.json());
  if (res.error) return showToast(res.error, true);
  showToast(`User ${res.action || 'updated'}`);
  loadBlacklists();
  document.getElementById('userId').value = '';
  document.getElementById('userReason').value = '';
}

export async function removeUserBlacklist(userId) {
  await secureFetch('/api-dev/blacklist/users', { method: 'POST', body: JSON.stringify({ userId }) });
  showToast('User removed');
  loadBlacklists();
}

export async function toggleServerBlacklist() {
  const serverId = document.getElementById('serverId').value.trim();
  const reason   = document.getElementById('serverReason').value.trim() || 'No reason provided';
  if (!serverId) return showToast('Guild ID required', true);
  await secureFetch('/api-dev/blacklist/servers', { method: 'POST', body: JSON.stringify({ serverId, reason }) });
  showToast('Guild blacklisted');
  loadBlacklists();
  document.getElementById('serverId').value = '';
  document.getElementById('serverReason').value = '';
}

export async function removeServerBlacklist(serverId) {
  await secureFetch('/api-dev/blacklist/servers', { method: 'POST', body: JSON.stringify({ serverId }) });
  showToast('Guild removed');
  loadBlacklists();
}