// ─── Advanced Actions ─────────────────────────────────────────────────────────

import { showToast } from './toast.js';

// ── Bonus Invites ─────────────────────────────────────────────────────────────

export async function applyBonus(guildId) {
  const userId = document.getElementById('bonusUserId')?.value.trim();
  const amount = parseInt(document.getElementById('bonusAmount')?.value);

  if (!userId) { showToast('Enter a user ID', 'error'); return; }

  try {
    const res = await fetch(`/api/guild/${guildId}/invite-bonus`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount })
    });
    if (res.ok) showToast(`Applied ${amount > 0 ? '+' : ''}${amount} bonus invites`);
    else showToast('Failed to apply bonus', 'error');
  } catch {
    showToast('Network error', 'error');
  }
}

// ── Danger Zone ───────────────────────────────────────────────────────────────

export async function confirmReset(guildId, type, onSuccess) {
  const msg = type === 'stats'
    ? 'Reset ALL invite stats for this guild? This cannot be undone.'
    : 'Reset config to defaults? This cannot be undone.';

  if (!confirm(msg)) return;

  try {
    const res = await fetch(`/api/guild/${guildId}/invite-reset`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });

    if (res.ok) {
      showToast('Reset successfully');
      if (type === 'config' && typeof onSuccess === 'function') onSuccess();
    } else {
      showToast('Reset failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}