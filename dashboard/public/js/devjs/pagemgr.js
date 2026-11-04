// devjs/pagemgr.js — Page Manager panel (disable/enable individual dashboard pages)

import { showToast } from './ui.js';

const DEV_HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-dashboard-request': 'true',
  'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
});

let _pmPages = [];

export async function pmLoad() {
  const list = document.getElementById('pm-list');
  if (list) list.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:0.78rem;font-weight:700">Loading…</div>';
  try {
    const res  = await fetch('/api-dev/pages', { headers: DEV_HEADERS() });
    const data = await res.json();
    _pmPages = data.pages || [];
    pmRender(_pmPages);
  } catch (err) {
    if (list) list.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px">${err.message}</div>`;
  }
}

export function pmFilter(q) {
  if (!q) return pmRender(_pmPages);
  const lq = q.toLowerCase();
  pmRender(_pmPages.filter(p => p.label.toLowerCase().includes(lq) || p.group.toLowerCase().includes(lq) || p.key.includes(lq)));
}

export function pmRender(pages) {
  const list    = document.getElementById('pm-list');
  const counter = document.getElementById('pm-disabled-count');
  if (!list) return;

  const totalDisabled = _pmPages.filter(p => p.disabled).length;
  if (counter) {
    counter.style.display = totalDisabled > 0 ? '' : 'none';
    if (totalDisabled > 0) counter.textContent = totalDisabled + ' page' + (totalDisabled > 1 ? 's' : '') + ' disabled';
  }

  if (!pages.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:0.75rem;font-weight:700">No pages found</div>';
    return;
  }

  const groups = {};
  pages.forEach(p => (groups[p.group] = groups[p.group] || []).push(p));

  list.innerHTML = Object.entries(groups).map(([gname, gpages]) => `
    <div style="margin-bottom:4px">
      <div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);padding:0 2px;margin-bottom:6px">${gname}</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${gpages.map(p => `
          <div id="pmrow-${p.key}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.025);border:1px solid ${p.disabled ? 'rgba(248,113,113,0.25)' : 'var(--border)'};border-radius:9px;transition:border-color 0.15s">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:0.78rem;font-weight:700;color:${p.disabled ? 'var(--red)' : '#fff'}">${p.label}</span>
                ${p.disabled ? `<span style="font-size:0.58rem;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2)">DISABLED</span>` : ''}
              </div>
              <div style="font-size:0.62rem;color:var(--muted);margin-top:2px;font-family:var(--mono)">${p.path}</div>
              ${p.disabled && p.disabledReason ? `<div style="font-size:0.65rem;color:var(--muted);margin-top:3px;font-style:italic">"${p.disabledReason}"</div>` : ''}
            </div>
            ${p.disabled
              ? `<button class="btn btn-green sm" onclick="pmEnable('${p.key}')"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Enable</button>`
              : `<button class="btn btn-ghost sm" onclick="pmDisable('${p.key}', '${p.label}')"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>Disable</button>`
            }
          </div>`).join('')}
    </div>`).join('');
}

export async function pmDisable(key, label) {
  const reason = window.prompt(`Reason for disabling "${label}"?\n(Shown to users, or leave blank)`) ?? null;
  if (reason === null) return;
  try {
    const res = await fetch(`/api-dev/pages/${key}/disable`, { method: 'POST', headers: DEV_HEADERS(), body: JSON.stringify({ reason: reason.trim() || null }) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    showToast(`"${label}" disabled`);
    pmLoad();
  } catch (err) { showToast(err.message, true); }
}

export async function pmEnable(key) {
  try {
    const res = await fetch(`/api-dev/pages/${key}/disable`, { method: 'DELETE', headers: DEV_HEADERS() });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    const page = _pmPages.find(p => p.key === key);
    showToast(`"${page?.label || key}" re-enabled`);
    pmLoad();
  } catch (err) { showToast(err.message, true); }
}