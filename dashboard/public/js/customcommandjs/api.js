// /js/customcommandjs/api.js
// All network calls to the custom commands API.

const guildId = location.pathname.split('/')[2];

async function apiFetch(url, opts = {}) {
  const res  = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status     = res.status;
    err.retryAfter = data.retryAfter || null;
    throw err;
  }
  return data;
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────

export async function fetchCommands() {
  return apiFetch(`/api/guild/${guildId}/customcommands`);
}

export async function createCommand(payload) {
  return apiFetch(`/api/guild/${guildId}/customcommands`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
}

export async function updateCommand(name, payload) {
  return apiFetch(`/api/guild/${guildId}/customcommands/${encodeURIComponent(name)}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
}

export async function deleteCommand(name) {
  return apiFetch(`/api/guild/${guildId}/customcommands/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

// ── Toggle enabled ────────────────────────────────────────────────────────────

export async function toggleCommand(name) {
  return apiFetch(`/api/guild/${guildId}/customcommands/${encodeURIComponent(name)}/toggle`, {
    method: 'PATCH',
  });
}

// ── Bulk operations ───────────────────────────────────────────────────────────

/**
 * @param {'enable'|'disable'|'delete'} action
 * @param {string[]} names
 */
export async function bulkOperation(action, names) {
  return apiFetch(`/api/guild/${guildId}/customcommands/bulk`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, names }),
  });
}

// ── Export / Import ───────────────────────────────────────────────────────────

export async function exportCommands() {
  const res = await fetch(`/api/guild/${guildId}/customcommands/export`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Export failed');
  }
  return res.json();
}

export async function importCommands(commands, overwrite = false) {
  return apiFetch(`/api/guild/${guildId}/customcommands/import`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ commands, overwrite }),
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchStats() {
  return apiFetch(`/api/guild/${guildId}/customcommands/stats`);
}