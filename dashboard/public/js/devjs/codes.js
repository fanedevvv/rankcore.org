// devjs/codes.js — premium codes (generate, list, copy, delete)

import { secureFetch, escapeHtml, showToast } from './core.js';

const TIER_LABEL = { basic: '⭐ Basic', pro: '💎 Pro', elite: '👑 Elite' };
const DURATION_LABEL = { daily: '1 day', weekly: '1 week', monthly: '1 month', yearly: '1 year', lifetime: 'Lifetime' };

let allCodes = [];

function renderCodes() {
  const el = document.getElementById('codesList');
  if (!el) return;
  const q = (document.getElementById('codesSearch')?.value || '').trim().toUpperCase();
  const list = q ? allCodes.filter(c => c.code.includes(q) || (c.note || '').toUpperCase().includes(q)) : allCodes;

  const count = document.getElementById('codesCount');
  if (count) count.textContent = allCodes.length;

  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:28px 0;color:var(--muted);font-size:0.75rem;font-weight:700">${allCodes.length ? 'No matches' : 'No unused codes'}</div>`;
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="premium-row">
      <div style="min-width:0">
        <div class="pr-id" style="font-family:var(--mono);letter-spacing:0.03em">${escapeHtml(c.code)}</div>
        <div class="pr-meta">
          ${escapeHtml(TIER_LABEL[c.tier] || c.tier)} · ${escapeHtml(DURATION_LABEL[c.duration] || c.duration)} · ${c.target === 'guild' ? 'Server' : 'User'}${c.note ? ' · ' + escapeHtml(c.note) : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost sm" onclick="copyCode('${escapeHtml(c.code)}')">Copy</button>
        <button class="btn btn-red sm" onclick="deleteCode('${escapeHtml(c.code)}')">Delete</button>
      </div>
    </div>`).join('');
}

export async function loadCodes() {
  try {
    const data = await secureFetch('/api-dev/codes').then(r => r.json());
    if (data.error) throw new Error(data.error);
    allCodes = data.codes || [];
    renderCodes();
  } catch (err) {
    showToast('Failed to load codes: ' + err.message, true);
  }
}

export function filterCodes() { renderCodes(); }

export async function generateCodes() {
  const body = {
    tier:     document.getElementById('codeTier')?.value || 'basic',
    duration: document.getElementById('codeDuration')?.value || 'monthly',
    target:   document.getElementById('codeTarget')?.value || 'user',
    count:    parseInt(document.getElementById('codeCount')?.value, 10) || 1,
    note:     document.getElementById('codeNote')?.value || '',
  };
  const res = await secureFetch('/api-dev/codes', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
  if (res.error) return showToast(res.error, true);

  const out = document.getElementById('codesGenerated');
  if (out) {
    out.style.display = 'block';
    out.querySelector('textarea').value = res.codes.join('\n');
  }
  showToast(`✓ ${res.codes.length} code${res.codes.length === 1 ? '' : 's'} generated`);
  loadCodes();
}

export async function copyGeneratedCodes() {
  const ta = document.querySelector('#codesGenerated textarea');
  if (!ta) return;
  try { await navigator.clipboard.writeText(ta.value); showToast('Copied to clipboard'); }
  catch { ta.select(); showToast('Select and copy the codes manually', true); }
}

export async function copyCode(code) {
  try { await navigator.clipboard.writeText(code); showToast('Copied ' + code); }
  catch { showToast(code); }
}

export async function deleteCode(code) {
  if (!confirm(`Delete code ${code}? It can no longer be redeemed.`)) return;
  const res = await secureFetch('/api-dev/codes/' + encodeURIComponent(code), { method: 'DELETE' }).then(r => r.json());
  if (res.error) return showToast(res.error, true);
  showToast('Code deleted');
  loadCodes();
}
