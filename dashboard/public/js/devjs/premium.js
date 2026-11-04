// devjs/premium.js — Premium + Custom Branding management

import { secureFetch, escapeHtml, showToast } from './core.js';

export let rawPremium  = [];
export let rawBranding = [];

const TIER_LABELS = {
  basic:  { label: '⭐ Basic',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  pro:    { label: '💎 Pro',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  elite:  { label: '👑 Elite',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function tierBadge(tier) {
  const t = TIER_LABELS[tier] ?? { label: tier || 'unknown', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
  return `<span style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:2px 7px;border-radius:8px;background:${t.bg};color:${t.color};border:1px solid ${t.color}33">${t.label}</span>`;
}

function fmtDate(iso) {
  if (!iso) return 'Lifetime';
  const d = new Date(iso);
  const now = new Date();
  const daysLeft = Math.ceil((d - now) / 86400000);
  if (daysLeft > 50 * 365) return 'Lifetime'; // lifetime grants are stored as +100 years
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (daysLeft <= 0) return `<span style="color:#f87171">Expired ${dateStr}</span>`;
  if (daysLeft <= 7) return `<span style="color:#fbbf24">⚠️ ${daysLeft}d · ${dateStr}</span>`;
  return `Expires ${dateStr}`;
}

// ── Render premium list ────────────────────────────────────────────────────────

function renderPremiumList(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div style="text-align:center;padding:28px 0;color:var(--muted);font-size:0.75rem;font-weight:700">No entries</div>`;
    return;
  }
  el.innerHTML = items.map(p => `
    <div class="premium-row">
      <div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <div class="pr-id">${escapeHtml(p.id || '')}</div>
          ${tierBadge(p.tier)}
        </div>
        <div class="pr-meta">${fmtDate(p.expiresAt)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost sm" onclick="quickUpgrade('${escapeHtml(p.id)}','${escapeHtml(p.type)}','${escapeHtml(p.tier)}')">Edit</button>
        <button class="btn btn-red sm" onclick="revokePremiumId('${escapeHtml(p.id)}','${escapeHtml(p.type)}')">Revoke</button>
      </div>
    </div>`).join('');
}

// ── Render branding list ──────────────────────────────────────────────────────

function renderBrandingList(items) {
  const el = document.getElementById('brandingList');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div style="text-align:center;padding:28px 0;color:var(--muted);font-size:0.75rem;font-weight:700">No custom branding subscriptions</div>`;
    return;
  }
  el.innerHTML = items.map(b => {
    const active = b.isActive && (!b.expiresAt || new Date(b.expiresAt) > new Date());
    const statusColor = active ? '#ef4444' : '#f87171';
    const statusLabel = active ? '● Active' : '● Inactive';
    return `<div class="premium-row">
      <div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <div class="pr-id">${escapeHtml(b.id || b.guildId || '')}</div>
          <span style="font-size:0.6rem;font-weight:700;color:${statusColor}">${statusLabel}</span>
          ${b.billing ? `<span style="font-size:0.58rem;color:var(--muted);background:rgba(255,255,255,0.04);border:1px solid var(--border);padding:1px 6px;border-radius:6px">${b.billing}</span>` : ''}
        </div>
        <div class="pr-meta">
          ${b.purchasedBy ? `For user ${escapeHtml(b.purchasedBy)} · ` : ''}${fmtDate(b.expiresAt)}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${active
          ? `<button class="btn btn-red sm" onclick="revokeBranding('${escapeHtml(b.id || b.guildId)}')">Revoke</button>`
          : `<button class="btn btn-green sm" onclick="prefillBranding('${escapeHtml(b.id || b.guildId)}','${escapeHtml(b.purchasedBy || '')}')">Re-grant</button>`
        }
      </div>
    </div>`;
  }).join('');
}

function updateCounts() {
  const u = document.getElementById('prem-count-users');
  const g = document.getElementById('prem-count-guilds');
  const b = document.getElementById('prem-count-branding');
  if (u) u.textContent = rawPremium.filter(p => p.type === 'user').length;
  if (g) g.textContent = rawPremium.filter(p => p.type === 'guild').length;
  if (b) b.textContent = rawBranding.filter(p => p.isActive).length;
}

// ── Filter ─────────────────────────────────────────────────────────────────────

export function filterPremium(tab) {
  const uq = (document.getElementById('searchPremiumUsers')?.value || '').toLowerCase();
  const gq = (document.getElementById('searchPremiumGuilds')?.value || '').toLowerCase();
  const bq = (document.getElementById('searchBranding')?.value || '').toLowerCase();

  const users  = rawPremium.filter(p => p.type === 'user'  && (!uq || (p.id||'').includes(uq)));
  const guilds = rawPremium.filter(p => p.type === 'guild' && (!gq || (p.id||'').includes(gq)));
  const brands = rawBranding.filter(b => !bq || (b.id||b.guildId||'').includes(bq) || (b.purchasedBy||'').includes(bq));

  renderPremiumList('premiumListUsers', users);
  renderPremiumList('premiumListGuilds', guilds);
  renderBrandingList(brands);
  updateCounts();
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadPremium() {
  try {
    const raw = await secureFetch('/api-dev/premium').then(r => r.json());
    if (Array.isArray(raw)) {
      rawPremium  = raw.filter(p => p.type !== 'branding').map(p => ({ ...p, type: p.type || 'user' }));
      rawBranding = raw.filter(p => p.type === 'branding');
    } else {
      rawPremium  = [
        ...(raw.users  || []).map(p => ({ ...p, type: 'user'  })),
        ...(raw.guilds || []).map(p => ({ ...p, type: 'guild' })),
      ];
      rawBranding = raw.branding || [];
    }
    filterPremium();
  } catch (e) {
    console.error('[DEV] loadPremium error:', e);
  }
}

// ── Grant premium ─────────────────────────────────────────────────────────────

export async function grantPremium() {
  const id       = document.getElementById('premiumId')?.value.trim();
  const type     = document.getElementById('premiumType')?.value;
  const tier     = document.getElementById('premiumTier')?.value || 'basic';
  const duration = document.getElementById('premiumDuration')?.value || 'monthly';
  if (!id) return showToast('ID required', true);

  const res = await secureFetch('/api-dev/premium/grant', {
    method: 'POST',
    body: JSON.stringify({ id, type, tier, duration }),
  }).then(r => r.json());

  if (res.error) return showToast(res.error, true);
  showToast(`✓ ${tier} premium granted (${duration})!`);
  document.getElementById('premiumId').value = '';
  loadPremium();
}

// ── Revoke premium ────────────────────────────────────────────────────────────

export async function revokePremium() {
  const id   = document.getElementById('premiumId')?.value.trim();
  const type = document.getElementById('premiumType')?.value;
  if (!id) return showToast('ID required', true);
  await revokePremiumId(id, type);
}

export async function revokePremiumId(id, type) {
  if (!type) {
    const found = rawPremium.find(p => p.id === id);
    type = found?.type || 'user';
  }
  const res = await secureFetch('/api-dev/premium/revoke', {
    method: 'POST',
    body: JSON.stringify({ id, type }),
  }).then(r => r.json());
  if (res.error) return showToast(res.error, true);
  showToast('Premium revoked');
  loadPremium();
}

// ── Quick edit (pre-fill form with existing entry) ────────────────────────────

export function quickUpgrade(id, type, currentTier) {
  const idEl   = document.getElementById('premiumId');
  const typeEl = document.getElementById('premiumType');
  const tierEl = document.getElementById('premiumTier');
  if (idEl)   idEl.value   = id;
  if (typeEl) typeEl.value = type;
  if (tierEl) tierEl.value = currentTier || 'basic';
  // Scroll to form
  idEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  idEl?.focus();
}

// ── Grant branding ────────────────────────────────────────────────────────────

export async function grantBranding() {
  const guildId  = document.getElementById('brandingGuildId')?.value.trim();
  const userId   = document.getElementById('brandingUserId')?.value.trim();
  const duration = document.getElementById('brandingDuration')?.value || 'monthly';
  if (!guildId) return showToast('Guild ID required', true);
  if (!userId)  return showToast('User ID required', true);

  const res = await secureFetch('/api-dev/branding/grant', {
    method: 'POST',
    body: JSON.stringify({ guildId, userId, duration }),
  }).then(r => r.json());

  if (res.error) return showToast(res.error, true);
  showToast(`✓ Custom Branding granted (${duration})!`);
  document.getElementById('brandingGuildId').value = '';
  document.getElementById('brandingUserId').value  = '';
  loadPremium();
}

// ── Revoke branding ───────────────────────────────────────────────────────────

export async function revokeBranding(guildId) {
  const res = await secureFetch('/api-dev/branding/revoke', {
    method: 'POST',
    body: JSON.stringify({ guildId }),
  }).then(r => r.json());
  if (res.error) return showToast(res.error, true);
  showToast('Custom Branding revoked');
  loadPremium();
}

// ── Pre-fill branding form for re-granting ────────────────────────────────────

export function prefillBranding(guildId, userId) {
  const g = document.getElementById('brandingGuildId');
  const u = document.getElementById('brandingUserId');
  // Switch to branding subtab
  const tab = document.querySelector('[onclick*="branding"]');
  if (tab) tab.click();
  if (g) { g.value = guildId; }
  if (u) { u.value = userId;  }
  g?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  g?.focus();
}
