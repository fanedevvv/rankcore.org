// uwujs/settings.js
// API calls: load the locked users list, remove a lock.

import { showToast }       from './toast.js';
import { initUserList,
         removeUserLocally } from './userList.js';
import { syncLockedIds }   from './modal.js';
import { initMembers }     from './members.js';

/**
 * Fetch and hydrate everything on page load.
 * @param {string} guildId
 */
export async function loadData(guildId) {
  const [lockedRes, membersRes, guildRes] = await Promise.all([
    fetch(`/api/guild/${guildId}/uwulock`),
    fetch(`/api/guild/${guildId}/members`),
    fetch(`/api/guild/${guildId}/info`),
  ]);

  const locked  = lockedRes.ok  ? await lockedRes.json()  : [];
  const members = membersRes.ok ? await membersRes.json() : [];
  const guild   = guildRes.ok   ? await guildRes.json()   : {};

  // Populate members dropdown
  initMembers(members);

  // Render list
  initUserList(locked);

  // Sync locked IDs set into the modal so it can check for duplicates
  syncLockedIds(locked.map(u => u.userId));

  // Server member count stat
  const statServer = document.getElementById('statServer');
  if (statServer) statServer.textContent = guild.memberCount ?? members.length ?? '—';
}

/**
 * Remove a UwU lock via the API, then update the UI.
 * @param {string} guildId
 * @param {string} userId
 */
export async function removeUwuLock(guildId, userId) {
  if (!confirm('Are you sure you want to unlock this user? OwO')) return;

  try {
    const res = await fetch(`/api/guild/${guildId}/uwulock/${userId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to remove UwU lock');
    }

    removeUserLocally(userId);
    showToast('UwU lock removed~ They are free! OwO');

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Something went wrong OwO', 'error');
  }
}