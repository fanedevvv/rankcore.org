/**
 * jtc/utils.js
 * Shared low-level helpers used across all JTC modules.
 */

/** Parsed guild ID from the current URL: /guild/:id/jtc */
export const guildId = location.pathname.split('/')[2];

/** Shorthand for document.getElementById */
export const el = id => document.getElementById(id);

/** Escape a value for safe insertion into HTML attribute / text content */
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Show a toast notification.
 * @param {string} msg
 * @param {'success'|'error'|'warn'} type
 */
export function showToast(msg, type = 'success') {
  const toast   = el('toast');
  const msgEl   = el('toastMsg');
  const iconEl  = el('toastIcon');
  if (!toast || !msgEl || !iconEl) return;

  const icons = { success: '✓', error: '✗', warn: '⚠' };
  iconEl.innerHTML = icons[type] || '•';
  msgEl.textContent  = msg;

  toast.className = `show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/**
 * Populate a <select> element from an array of { id, name } objects.
 * @param {string}   selectId    - element id
 * @param {object[]} items       - array of { id, name }
 * @param {string}   [placeholder] - optional empty first option
 */
export function populateSelect(selectId, items, placeholder = '') {
  const s = el(selectId);
  if (!s) return;
  s.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    s.appendChild(opt);
  }
  (items || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value       = escapeHtml(item.id);
    opt.textContent = escapeHtml(item.name);
    s.appendChild(opt);
  });
}

/**
 * Update the active / inactive status badge in the header.
 * @param {boolean} configured
 */
export function setStatus(configured) {
  const badge = el('statusBadge');
  const text  = el('statusText');
  if (!badge || !text) return;
  if (configured) {
    badge.className  = 'status-badge active';
    text.textContent = 'Active';
  } else {
    badge.className  = 'status-badge inactive';
    text.textContent = 'Not Configured';
  }
}