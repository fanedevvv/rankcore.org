// uwujs/modal.js
// Controls the "Add UwU Lock" modal — open, close, preview, and submit.
// Users now type a Discord User ID directly instead of picking from a dropdown.

import { showToast }        from './toast.js';
import { addUserLocally }   from './userList.js';

let _guildId    = '';
let _lockedIds  = new Set(); // userId strings currently locked

export function initModal(guildId, lockedIds) {
  _guildId   = guildId;
  _lockedIds = new Set(lockedIds);

  const input = document.getElementById('modalUserIdInput');
  if (input) input.addEventListener('input', handleInputChange);
}

export function syncLockedIds(ids) {
  _lockedIds = new Set(ids);
}

export function openAddModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.style.display = 'flex';

  // Focus the input after the modal is visible
  setTimeout(() => {
    const input = document.getElementById('modalUserIdInput');
    if (input) input.focus();
  }, 50);
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.style.display = 'none';

  // Reset
  const input = document.getElementById('modalUserIdInput');
  if (input) input.value = '';
  const preview = document.getElementById('modalPreview');
  if (preview) preview.style.display = 'none';
}

export async function addUwuLock() {
  const input  = document.getElementById('modalUserIdInput');
  const userId = input?.value.trim();

  if (!userId)              return showToast('Please enter a User ID first~', 'warn');
  if (!/^\d{17,20}$/.test(userId)) return showToast('That doesn\'t look like a valid Discord ID OwO', 'warn');
  if (_lockedIds.has(userId)) return showToast('This user is already UwU-locked! OwO', 'warn');

  try {
    const res = await fetch(`/api/guild/${_guildId}/uwulock`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add UwU lock');
    }

    // The API response may return enriched user data (username, avatarUrl)
    const data = await res.json().catch(() => ({}));

    _lockedIds.add(userId);

    addUserLocally({
      userId,
      username:  data.username  || userId,
      avatarUrl: data.avatarUrl || null,
      lockedAt:  new Date().toISOString(),
    });

    showToast(`${data.username || userId} is now UwU-locked~ UwU`);
    closeModal();

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Something went wrong OwO', 'error');
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function handleInputChange() {
  const input   = document.getElementById('modalUserIdInput');
  const preview = document.getElementById('modalPreview');
  if (!input || !preview) return;

  const userId = input.value.trim();

  if (!userId) {
    preview.style.display = 'none';
    return;
  }

  const isValidId     = /^\d{17,20}$/.test(userId);
  const alreadyLocked = _lockedIds.has(userId);

  preview.style.display = 'block';

  if (!isValidId) {
    preview.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.8rem; color:#FF6B7A;">
        ⚠️ Discord IDs are 17–20 digit numbers
      </div>`;
    return;
  }

  if (alreadyLocked) {
    preview.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <div style="width:36px; height:36px; border-radius:50%; background:rgba(192,132,252,0.15); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">🐾</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:0.875rem; font-family:'JetBrains Mono',monospace;">${esc(userId)}</div>
          <div style="font-size:0.72rem; color:#FF6B7A;">⚠️ Already UwU-locked!</div>
        </div>
        <span style="font-size:0.7rem; font-weight:700; padding:0.2rem 0.55rem; border-radius:99px; background:rgba(255,110,180,0.15); color:var(--pink); border:1px solid rgba(255,110,180,0.3);">Locked</span>
      </div>`;
    return;
  }

  preview.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <div style="width:36px; height:36px; border-radius:50%; border:2px solid rgba(255,110,180,0.4); background:rgba(192,132,252,0.15); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">🐾</div>
      <div>
        <div style="font-weight:700; font-size:0.875rem; font-family:'JetBrains Mono',monospace;">${esc(userId)}</div>
        <div style="font-size:0.72rem; color:var(--muted);">Valid Discord ID ✓</div>
      </div>
    </div>
    <div style="margin-top:0.5rem; font-size:0.75rem; color:var(--muted);">All messages from this user will be uwuified in real-time~ OwO</div>`;
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}