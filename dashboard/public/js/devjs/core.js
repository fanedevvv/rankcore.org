// devjs/core.js — shared utilities used by every module

export const _csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

export function secureFetch(url, opts = {}) {
  return fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-dashboard-request': 'true',
      'X-CSRF-Token': _csrf,
      ...(opts.headers || {}),
    },
    ...opts,
  });
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(msg, err = false) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${err ? '#ed4245' : '#57f287'}"></span>${escapeHtml(msg)}`;
  t.style.cssText = `position:fixed;bottom:24px;right:20px;padding:12px 18px;border-radius:10px;font-size:0.78rem;font-weight:700;display:flex;align-items:center;gap:8px;z-index:9999;transition:all 0.4s;text-transform:uppercase;letter-spacing:0.04em;background:${err ? '#0F132B' : '#0e2c12'};color:${err ? '#ed4245' : '#57f287'};border:1px solid ${err ? 'rgba(237,66,69,0.3)' : 'rgba(139,92,246,0.3)'};transform:translateY(0);opacity:1`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.transform = 'translateY(80px)'; t.style.opacity = '0'; }, 3000);
}