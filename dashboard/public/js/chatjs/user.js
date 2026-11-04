import { apiFetch }  from './api.js';
import { state }     from './state.js';
import { esc }       from './ui.js';

export async function loadCurrentUser() {
  try {
    const d = await apiFetch('/api/me');
    state.currentUser = {
      username:   d.username   || 'there',
      globalName: d.globalName || d.username || 'there',
      avatarUrl:  d.avatarUrl  || null,
    };
    renderUserChip();
  } catch {}
}

function renderUserChip() {
  const chip = document.getElementById('uc');
  if (!chip) return;
  const { globalName, avatarUrl } = state.currentUser;
  const av = avatarUrl
    ? `<img src="${esc(avatarUrl)}" alt="" onerror="this.style.display='none'">`
    : `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  chip.innerHTML = `<span class="ua">${av}</span><span class="un">${esc(globalName)}</span>`;
}

export function userFallbackSvg() {
  return `<svg width="13" height="13" fill="none" stroke="#6b7a9f" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
}
