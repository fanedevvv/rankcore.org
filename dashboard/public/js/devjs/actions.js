// devjs/actions.js

import { secureFetch, _csrf, showToast } from './core.js';

// ── Quick Actions ─────────────────────────────────────────────────────────────

export async function reloadBot() {
  if (!confirm('Reload bot modules?')) return;
  const r = await secureFetch('/api-dev/reload', { method: 'POST' }).then(r => r.json());
  showToast(r.message || 'Reloading...', !!r.error);
}

export async function clearCache() {
  const r = await secureFetch('/api-dev/cache/clear', { method: 'POST' }).then(r => r.json());
  showToast(r.message || 'Cache cleared', !!r.error);
}

export async function syncCommands() {
  const r = await secureFetch('/api-dev/commands/sync', { method: 'POST' }).then(r => r.json());
  showToast(r.message || 'Commands synced', !!r.error);
}

/**
 * Fetches logs as a blob and triggers a browser Save dialog.
 * No new tab is opened.
 */
export async function exportLogs(e) {
  if (e) e.preventDefault();
  showToast('Preparing export...');
  try {
    const res = await fetch('/api-dev/logs/export', {
      credentials: 'same-origin',
      headers: { 'x-dashboard-request': 'true', 'X-CSRF-Token': _csrf },
    });
    if (!res.ok) return showToast('Export failed', true);
    const blob = await res.blob();
    const cd   = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `noxx-logs-${Date.now()}.log`;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Logs downloaded!');
  } catch {
    showToast('Export failed', true);
  }
}

export async function confirmRestart() {
  if (!confirm('⚠️ RESTART the bot process? This will cause brief downtime.')) return;
  const r = await secureFetch('/api-dev/restart', { method: 'POST' }).then(r => r.json());
  showToast(r.message || 'Restarting...', !!r.error);
}

// ── Bot Presence ──────────────────────────────────────────────────────────────

export async function setBotPresence() {
  const status = document.getElementById('botStatus').value;
  const type   = document.getElementById('activityType').value;
  const text   = document.getElementById('activityText').value.trim();
  if (!text) return showToast('Activity text required', true);
  const r = await secureFetch('/api-dev/presence', {
    method: 'POST',
    body: JSON.stringify({ status, type, text }),
  }).then(r => r.json());
  if (!r.error) {
    // Show override indicator
    const ind = document.getElementById('presenceOverrideIndicator');
    if (ind) {
      ind.style.display = 'flex';
      const txt = document.getElementById('presenceOverrideText'); if (txt) txt.textContent =
        `${status} · ${type.toLowerCase()} "${text}"`;
    }
  }
  showToast(r.message || 'Presence updated', !!r.error);
}

export async function clearBotPresence() {
  const r = await secureFetch('/api-dev/presence/clear', { method: 'POST' }).then(r => r.json());
  if (!r.error) {
    const ind = document.getElementById('presenceOverrideIndicator');
    if (ind) ind.style.display = 'none';
    document.getElementById('activityText').value = '';
  }
  showToast(r.message || 'Rotating status resumed', !!r.error);
}