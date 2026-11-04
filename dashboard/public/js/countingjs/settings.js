// countingjs/settings.js

import { showToast }                       from './toast.js';
import { initMilestones, getMilestones }   from './milestones.js';
import { initRewardRoles, getRewardRoles } from './rewardRoles.js';
import { setFailAction, getFailAction }    from './failAction.js';

/**
 * Hydrate all form fields from the API response.
 * @param {object} data      - API response from GET /api/guild/:id/count
 * @param {string} guildId
 * @param {Array}  allRoles  - full role list for reward-role labels
 */
export function loadConfig(data, guildId, allRoles) {
  // ── Stats strip ────────────────────────────────────────────────────────────
  setEl('statCount',  data.Count        ?? 0);
  setEl('statHigh',   data.HighScore    ?? 0);
  setEl('statTotal',  data.TotalCounts  ?? 0);
  setEl('statFails',  data.TotalFails   ?? 0);
  setEl('lastUser',   data.LastUser ? `<@${data.LastUser}>` : 'None');

  // ── General ────────────────────────────────────────────────────────────────
  // Channel populated separately by channelRoles.js

  // Countdown mode
  const isCountdown = !!data.CountdownMode;
  setChecked('countdownMode', isCountdown);
  setValue('countdownStart', data.CountdownStart ?? 100);
  document.getElementById('countdownOptions')?.classList.toggle('hidden', !isCountdown);

  const modeDisplay = document.getElementById('modeDisplay');
  if (modeDisplay) {
    modeDisplay.textContent = isCountdown
      ? `⬇️ Countdown from ${data.CountdownStart ?? 100}`
      : '⬆️ Count Up';
  }

  // Milestones
  initMilestones(data.Milestones);

  // ── Behavior ───────────────────────────────────────────────────────────────
  setFailAction(data.FailAction || 'reset');

  setChecked('allowWords',  data.AllowWords !== false);
  setChecked('pingOnFail',  !!data.PingOnFail);

  // ── Rewards ────────────────────────────────────────────────────────────────
  initRewardRoles(data.RewardRoles, allRoles);
}

/**
 * Collect all form values and POST to the API.
 * @param {string} guildId
 */
export async function saveConfig(guildId) {
  const payload = {
    Channel:        document.getElementById('countChannel')?.value  || null,
    FailAction:     getFailAction(),
    FailRole:      document.getElementById('failRole')?.value      || null,
    AllowWords:    document.getElementById('allowWords')?.checked  ?? true,
    PingOnFail:    document.getElementById('pingOnFail')?.checked  ?? false,
    CountdownMode: document.getElementById('countdownMode')?.checked ?? false,
    CountdownStart: parseInt(document.getElementById('countdownStart')?.value, 10) || 100,
    Milestones:    getMilestones(),
    RewardRoles:   getRewardRoles(),
  };

  try {
    const res = await fetch(`/api/guild/${guildId}/count`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (res.ok) showToast('Settings saved successfully!');
    else        showToast('Failed to save settings', 'error');
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save settings', 'error');
  }
}

/**
 * Reset the count to 0 via the API.
 * @param {string}   guildId
 * @param {Function} onSuccess - callback to refresh stats
 */
export async function resetCount(guildId, onSuccess) {
  if (!confirm('Are you sure you want to reset the count to 0?')) return;

  try {
    const res = await fetch(`/api/guild/${guildId}/count/reset`, { method: 'POST' });
    if (res.ok) {
      showToast('Count reset to 0');
      setEl('statCount', '0');
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      showToast('Failed to reset count', 'error');
    }
  } catch (err) {
    console.error('Reset failed:', err);
    showToast('Failed to reset count', 'error');
  }
}

// ── Tiny DOM helpers ──────────────────────────────────────────────────────────

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setChecked(id, bool) {
  const el = document.getElementById(id);
  if (el) el.checked = bool;
}