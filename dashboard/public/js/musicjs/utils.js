/**
 * music/js/utils.js
 * Shared helpers: guildId, DOM shorthand, formatTime, showToast, escapeHtml.
 */

export const guildId = location.pathname.split('/')[2];

export const el = id => document.getElementById(id);

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 60000);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

let _toastTimer = null;
export function showToast(message, type = 'success') {
  const toast = el('toast');
  const msg   = el('toastMessage');
  if (!toast || !msg) return;
  const colors = { success: '#ef4444', error: '#dc2626', warn: '#d97706', info: '#2563eb' };
  msg.textContent = message;
  toast.style.background = colors[type] || colors.success;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}