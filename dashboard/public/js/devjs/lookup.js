// devjs/lookup.js — Universal ID Lookup (user or guild)
import { secureFetch, showToast } from './core.js';

// Route all Discord CDN avatar URLs through our server-side proxy so the
// browser never hits cdn.discordapp.com directly (which blocks cross-origin loads).
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const PROXIED_DEFAULT = '/api-dev/avatar-proxy?url=' + encodeURIComponent(DEFAULT_AVATAR);

function proxyAvatar(url) {
  if (!url) return PROXIED_DEFAULT;
  // Must be an absolute URL to be usable — if it's just a hash/path, fall back to default
  if (!url.startsWith('http://') && !url.startsWith('https://')) return PROXIED_DEFAULT;
  // Proxy Discord CDN URLs so the browser never hits them directly
  if (url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net')) {
    return '/api-dev/avatar-proxy?url=' + encodeURIComponent(url);
  }
  return url;
}

let _lastResult = null;

export async function runLookup() {
  const q = document.getElementById('lookupId')?.value?.trim();
  if (!q) return showToast('Enter a Discord ID', true);

  const resultEl = document.getElementById('lookupResult');
  resultEl.innerHTML = `<div class="lookup-loading"><div class="spinner"></div><span>Looking up ID…</span></div>`;

  try {
    const r = await secureFetch(`/api-dev/search?q=${encodeURIComponent(q)}`);
    if (!r.ok) {
      const err = await r.json();
      resultEl.innerHTML = `<div class="lookup-error">❌ ${err.error || 'Not found'}</div>`;
      return;
    }
    const data = await r.json();
    _lastResult = data;
    renderLookup(data, resultEl);
  } catch (err) {
    resultEl.innerHTML = `<div class="lookup-error">❌ Request failed</div>`;
  }
}

function renderLookup(data, el) {
  let html = '';

  if (data.user) {
    const u = data.user;
    const premBadge = u.isPremium
      ? `<span class="lu-badge lu-yellow">⭐ ${u.premiumPlan || 'Premium'}</span>` : '';
    const blBadge   = u.isBlacklisted
      ? `<span class="lu-badge lu-red">🚫 Blacklisted</span>` : '';
    const botBadge  = u.bot ? `<span class="lu-badge lu-blue">🤖 Bot</span>` : '';
    const created   = u.createdAt ? new Date(u.createdAt).toDateString() : '—';
    const expiry    = u.premiumExpiry ? new Date(u.premiumExpiry).toDateString() : null;
    const avatar    = proxyAvatar(u.avatar);
    const tag       = u.discriminator && u.discriminator !== '0' ? '#' + u.discriminator : '';

    html += `
    <div class="lu-card lu-user">
      <div class="lu-head">
        <img class="lu-avatar" src="${avatar}" alt="" onerror="this.onerror=null;this.src='${PROXIED_DEFAULT}'">
        <div class="lu-info">
          <div class="lu-name">${escHtml(u.username || 'Unknown')}<span style="color:var(--muted);font-weight:500">${tag}</span></div>
          <div class="lu-id">${u.id}</div>
          <div class="lu-badges">${botBadge}${premBadge}${blBadge}</div>
        </div>
      </div>
      <div class="lu-rows">
        <div class="lu-row"><span class="lu-key">Account Created</span><span class="lu-val">${created}</span></div>
        ${u.isPremium ? `<div class="lu-row"><span class="lu-key">Plan</span><span class="lu-val" style="color:var(--yellow)">${u.premiumPlan || '—'}</span></div>` : ''}
        ${expiry ? `<div class="lu-row"><span class="lu-key">Expires</span><span class="lu-val">${expiry}</span></div>` : ''}
        ${u.isBlacklisted ? `<div class="lu-row"><span class="lu-key">BL Reason</span><span class="lu-val" style="color:var(--red)">${escHtml(u.blacklistReason || 'No reason')}</span></div>` : ''}
      </div>
      <div class="lu-actions">
        <button class="btn btn-ghost sm" onclick="navigator.clipboard.writeText('${u.id}').then(()=>showToast('Copied!'))">📋 Copy ID</button>
        ${!u.isBlacklisted
          ? `<button class="btn btn-red sm" onclick="quickBlacklist('user','${u.id}')">🚫 Blacklist</button>`
          : `<button class="btn btn-green sm" onclick="quickBlacklist('user','${u.id}')">✅ Unblacklist</button>`}
        ${!u.isPremium
          ? `<button class="btn btn-yellow sm" onclick="quickPremium('user','${u.id}')">⭐ Grant Premium</button>`
          : `<button class="btn btn-ghost sm" onclick="quickRevokePremium('user','${u.id}')">↩ Revoke Premium</button>`}
      </div>
    </div>`;
  }

  if (data.guild) {
    const g = data.guild;
    const premBadge = g.isPremium
      ? `<span class="lu-badge lu-yellow">⭐ ${g.premiumPlan || 'Premium'}</span>` : '';
    const blBadge   = g.isBlacklisted
      ? `<span class="lu-badge lu-red">🚫 Blacklisted</span>` : '';
    const created   = g.createdAt ? new Date(g.createdAt).toDateString() : '—';
    const expiry    = g.premiumExpiry ? new Date(g.premiumExpiry).toDateString() : null;
    const icon      = proxyAvatar(g.icon);

    html += `
    <div class="lu-card lu-guild" style="margin-top:${data.user ? '14px' : '0'}">
      <div class="lu-head">
        <img class="lu-avatar" src="${icon}" alt="" onerror="this.onerror=null;this.src='${PROXIED_DEFAULT}'" style="border-radius:10px">
        <div class="lu-info">
          <div class="lu-name">${escHtml(g.name)}</div>
          <div class="lu-id">${g.id}</div>
          <div class="lu-badges">${premBadge}${blBadge}</div>
        </div>
      </div>
      <div class="lu-rows">
        <div class="lu-row"><span class="lu-key">Members</span><span class="lu-val">${g.memberCount?.toLocaleString()}</span></div>
        <div class="lu-row"><span class="lu-key">Owner ID</span><span class="lu-val mono">${g.ownerId}</span></div>
        <div class="lu-row"><span class="lu-key">Created</span><span class="lu-val">${created}</span></div>
        ${g.isPremium ? `<div class="lu-row"><span class="lu-key">Plan</span><span class="lu-val" style="color:var(--yellow)">${g.premiumPlan || '—'}</span></div>` : ''}
        ${expiry ? `<div class="lu-row"><span class="lu-key">Expires</span><span class="lu-val">${expiry}</span></div>` : ''}
        ${g.isBlacklisted ? `<div class="lu-row"><span class="lu-key">BL Reason</span><span class="lu-val" style="color:var(--red)">${escHtml(g.blacklistReason || 'No reason')}</span></div>` : ''}
      </div>
      <div class="lu-actions">
        <button class="btn btn-ghost sm" onclick="navigator.clipboard.writeText('${g.id}').then(()=>showToast('Copied!'))">📋 Copy ID</button>
        <button class="btn btn-blue sm" id="inviteBtn-${g.id}" onclick="generateInvite('${g.id}')">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:12px;height:12px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          Generate Invite
        </button>
        ${!g.isBlacklisted
          ? `<button class="btn btn-red sm" onclick="quickBlacklist('guild','${g.id}')">🚫 Blacklist</button>`
          : `<button class="btn btn-green sm" onclick="quickBlacklist('guild','${g.id}')">✅ Unblacklist</button>`}
        ${!g.isPremium
          ? `<button class="btn btn-yellow sm" onclick="quickPremium('guild','${g.id}')">⭐ Grant Premium</button>`
          : `<button class="btn btn-ghost sm" onclick="quickRevokePremium('guild','${g.id}')">↩ Revoke Premium</button>`}
      </div>
      <div id="inviteResult-${g.id}" style="display:none;padding:10px 18px;border-top:1px solid var(--border);background:rgba(99,102,241,0.05)"></div>
    </div>`;
  }

  el.innerHTML = html;
}

// ── Generate invite for guild ─────────────────────────────────────────────────
export async function generateInvite(guildId) {
  const btn     = document.getElementById(`inviteBtn-${guildId}`);
  const resultEl = document.getElementById(`inviteResult-${guildId}`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  try {
    const r = await secureFetch(`/api-dev/guild/${guildId}/invite`, { method: 'POST' }).then(r => r.json());
    if (r.error) {
      if (resultEl) { resultEl.style.display = 'block'; resultEl.innerHTML = `<span style="color:var(--red);font-size:0.75rem">❌ ${escHtml(r.error)}</span>`; }
      showToast(r.error, true);
    } else {
      const expiryStr = r.expiresAt ? ` · expires ${new Date(r.expiresAt).toLocaleString()}` : ' · 24h';
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <a href="${escHtml(r.url)}" target="_blank" rel="noopener"
               style="font-family:var(--mono);font-size:0.78rem;color:var(--accent);font-weight:700;text-decoration:none;word-break:break-all">
              ${escHtml(r.url)}
            </a>
            <button class="btn btn-ghost sm" style="flex-shrink:0" onclick="navigator.clipboard.writeText('${escHtml(r.url)}').then(()=>showToast('Invite copied!'))">📋 Copy</button>
            <span style="font-size:0.65rem;color:var(--muted)">${expiryStr}</span>
          </div>`;
      }
      showToast('Invite generated!');
    }
  } catch {
    showToast('Failed to generate invite', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:12px;height:12px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> Generate Invite`;
    }
  }
}

// ── Quick-action helpers ──────────────────────────────────────────────────────
export async function quickBlacklist(type, id) {
  if (!confirm(`Toggle blacklist for ${type} ${id}?`)) return;
  const reason   = prompt('Reason (or leave blank):') || 'Manually toggled from dev panel';
  const endpoint = type === 'user' ? '/api-dev/blacklist/users' : '/api-dev/blacklist/servers';
  const body     = type === 'user' ? { userId: id, reason } : { serverId: id, reason };
  const r = await secureFetch(endpoint, { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
  showToast(r.message || 'Done', !!r.error);
  if (!r.error) runLookup();
}

export async function quickPremium(type, id) {
  const plan = prompt('Plan? (monthly/yearly/lifetime/weekly/daily)', 'monthly');
  if (!plan) return;
  const r = await secureFetch('/api-dev/premium/grant', {
    method: 'POST',
    body: JSON.stringify({ id, type, plan }),
  }).then(r => r.json());
  showToast(r.message || 'Granted', !!r.error);
  if (!r.error) runLookup();
}

export async function quickRevokePremium(type, id) {
  if (!confirm(`Revoke premium from ${type} ${id}?`)) return;
  const r = await secureFetch('/api-dev/premium/revoke', {
    method: 'POST',
    body: JSON.stringify({ id, type }),
  }).then(r => r.json());
  showToast(r.message || 'Revoked', !!r.error);
  if (!r.error) runLookup();
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}