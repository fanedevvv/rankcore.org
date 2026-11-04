// chatjs/api.js — CSRF-aware fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

let _csrfToken =
  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;

async function getCsrfToken() {
  if (_csrfToken) return _csrfToken;
  try {
    const r = await fetch('/api/csrf-token');
    const d = await r.json();
    _csrfToken = d.csrfToken || null;
  } catch { _csrfToken = null; }
  return _csrfToken;
}

export async function apiFetch(url, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET' && method !== 'HEAD') {
    const token = await getCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (res.redirected || res.status === 302) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  const text = await res.text().catch(() => '');
  let data = {};
  try { data = JSON.parse(text); } catch {
    if (!res.ok) throw new Error(`Server error ${res.status}: ${text.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
