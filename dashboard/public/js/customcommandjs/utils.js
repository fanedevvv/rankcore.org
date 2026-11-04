// /js/custom/utils.js
// Shared pure utilities — no DOM, no state dependencies.

/**
 * HTML-escape a value for safe injection into innerHTML.
 */
export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Set the text content of an element by ID.
 */
export function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Format an ISO date string as "Jan 1, 2025".
 */
export function formatDate(str) {
  return new Date(str).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Show or hide a toast notification.
 * @param {string} msg
 * @param {'success'|'warn'|'error'} type
 */
export function showToast(msg, type = 'success') {
  const toast   = document.getElementById('toast');
  const icon    = document.getElementById('toastIcon');
  const message = document.getElementById('toastMessage');
  if (!toast || !icon || !message) return;

  message.textContent = msg;
  icon.innerHTML    = type === 'error' ? '✕' : type === 'warn' ? '⚠' : '✓';
  toast.style.background =
    type === 'error' ? 'linear-gradient(135deg,#c0392b,#8e0000)' :
    type === 'warn'  ? 'linear-gradient(135deg,#b8860b,#7a5800)' :
                       'linear-gradient(135deg,#6C53FF,#9B78FF)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

/**
 * Bump a number input by delta, respecting its min attribute.
 */
export function stepInput(id, delta) {
  const el = document.getElementById(id);
  if (el) el.value = Math.max(Number(el.min || 0), Number(el.value || 0) + delta);
}