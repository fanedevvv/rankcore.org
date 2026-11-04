// devjs/owners.js — Owner / Dev Management
// Add/remove is restricted to the permanent superadmin (ID: 1075077561454973020).
// All other devs can VIEW the list only — controls are rendered but disabled.

import { secureFetch, showToast } from './core.js';

let _owners      = [];
let _isOwnerAdmin = false; // set by the server — true only for the superadmin

export async function loadOwners() {
  try {
    const r = await secureFetch('/api-dev/owners');
    if (!r.ok) return;
    const data    = await r.json();
    _owners       = data.owners      || [];
    _isOwnerAdmin = data.isOwnerAdmin ?? false;
    renderOwners();
  } catch (_) {}
}

export async function addOwner() {
  if (!_isOwnerAdmin) return showToast('Only the bot owner can add developers.', true);

  const id = document.getElementById('ownerAddId')?.value?.trim();
  if (!id) return showToast('Enter a user ID', true);
  if (!/^\d{17,19}$/.test(id)) return showToast('Invalid Discord ID format', true);

  const confirmed = confirm(
    `⚠️ Grant full developer access to user ${id}?\n\nThis gives them COMPLETE control over the bot — eval, restart, all data.`
  );
  if (!confirmed) return;

  const r = await secureFetch('/api-dev/owners', {
    method: 'POST',
    body: JSON.stringify({ userId: id, action: 'add' }),
  }).then(r => r.json());

  if (r.error) return showToast(r.error, true);
  showToast('✅ Dev access granted');
  document.getElementById('ownerAddId').value = '';
  await loadOwners();
}

export async function removeOwner(id) {
  if (!_isOwnerAdmin) return showToast('Only the bot owner can remove developers.', true);

  const entry    = _owners.find(o => o.id === id);
  const nameHint = entry?.username ? `${entry.username} (${id})` : id;

  const confirmed = confirm(
    `Remove dev access from ${nameHint}?\n\nThey will immediately lose all developer permissions.`
  );
  if (!confirmed) return;

  const r = await secureFetch('/api-dev/owners', {
    method: 'POST',
    body: JSON.stringify({ userId: id, action: 'remove' }),
  }).then(r => r.json());

  if (r.error) return showToast(r.error, true);
  showToast('Dev access revoked');
  await loadOwners();
}

function renderOwners() {
  const el = document.getElementById('ownerList');
  if (!el) return;

  const countEl = document.getElementById('ownerCount');
  if (countEl) countEl.textContent = _owners.length;

  // Show/hide the add form based on superadmin status
  const addSection = document.getElementById('ownerAddSection');
  if (addSection) addSection.style.display = _isOwnerAdmin ? '' : 'none';

  // Show the view-only notice for non-superadmins
  const viewNotice = document.getElementById('ownerViewOnlyNotice');
  if (viewNotice) viewNotice.style.display = _isOwnerAdmin ? 'none' : 'flex';

  if (!_owners.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:0.75rem">No owners found</div>';
    return;
  }

  el.innerHTML = _owners.map(o => {
    const avatar    = o.avatar || `https://cdn.discordapp.com/embed/avatars/${parseInt(o.id) % 5}.png`;
    const username  = o.username ? escHtml(o.username) : null;
    const nameTag   = username
      ? `<div class="owner-username">${username}</div>`
      : `<div class="owner-username unknown">Unknown User</div>`;
    const isPerm    = o.isPermanent;
    const revokeBtn = isPerm
      ? `<button class="btn btn-ghost sm" disabled title="Permanent owner — cannot be removed" style="opacity:0.35;cursor:not-allowed">🔒 Owner</button>`
      : _isOwnerAdmin
        ? `<button class="btn btn-red sm" onclick="removeOwner('${o.id}')">Revoke</button>`
        : `<button class="btn btn-ghost sm" disabled title="Only the bot owner can revoke access" style="opacity:0.35;cursor:not-allowed">Revoke</button>`;

    return `
    <div class="owner-row${isPerm ? ' owner-row--perm' : ''}">
      <div class="owner-avatar-wrap">
        <img class="owner-avatar" src="${avatar}" alt=""
             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        ${isPerm ? '<div class="owner-crown" title="Permanent owner">👑</div>' : ''}
      </div>
      <div class="owner-info">
        ${nameTag}
        <div class="owner-id mono">${o.id}</div>
        <div class="owner-label">${isPerm ? 'Bot Owner' : 'Developer'}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost sm"
          onclick="navigator.clipboard.writeText('${o.id}');window.showToast?.('Copied!')">📋</button>
        ${revokeBtn}
      </div>
    </div>`;
  }).join('');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
