// countingmain.js — Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

import { showToast }                          from './countingjs/toast.js';
import { switchTab }                          from './countingjs/tabs.js';
import { populateChannelSelects,
         populateRoleSelects }                from './countingjs/channelRoles.js';
import { addMilestone, removeMilestone }      from './countingjs/milestones.js';
import { addRewardRole, removeRewardRole }    from './countingjs/rewardRoles.js';
import { initLeaderboard }                    from './countingjs/leaderboard.js';
import { initHistory }                        from './countingjs/history.js';
import { loadConfig, saveConfig, resetCount } from './countingjs/settings.js';
import { initFailAction }                     from './countingjs/failAction.js';

const guildId = location.pathname.split('/')[2];

// ── Expose globals for inline onclick handlers ────────────────────────────────

window.switchTab       = (name, btn) => switchTab(name, btn);
window.saveConfig      = ()          => saveConfig(guildId);
window.resetCount      = ()          => resetCount(guildId, refreshStats);
window.addMilestone    = ()          => {
  const result = addMilestone();
  if (result.error) showToast(result.error, 'warn');
};
window.removeMilestone = (m)         => removeMilestone(m);
window.addRewardRole   = ()          => {
  const result = addRewardRole();
  if (result.error) showToast(result.error, 'error');
};
window.removeRewardRole = (ms)       => removeRewardRole(ms);
window.toggleCountdown  = ()         => {
  const on = document.getElementById('countdownMode')?.checked;
  document.getElementById('countdownOptions')?.classList.toggle('hidden', !on);
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Refresh just the stats strip without a full page reload. */
async function refreshStats() {
  try {
    const res  = await fetch(`/api/guild/${guildId}/count`);
    const data = await res.json();
    setEl('statCount', data.Count       ?? 0);
    setEl('statHigh',  data.HighScore   ?? 0);
    setEl('statTotal', data.TotalCounts ?? 0);
    setEl('statFails', data.TotalFails  ?? 0);
  } catch (err) {
    console.error('Stats refresh failed:', err);
  }
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  // Wire up sub-modules that need the guildId
  initLeaderboard(guildId);
  initHistory(guildId);

  // Wire fail action card visuals (must run before loadConfig sets the value)
  initFailAction();

  try {
    const [channelRes, roleRes, configRes] = await Promise.all([
      fetch(`/api/guild/${guildId}/channels`),
      fetch(`/api/guild/${guildId}/roles`),
      fetch(`/api/guild/${guildId}/count`),
    ]);

    const channels = channelRes.ok ? await channelRes.json() : [];
    const roles    = roleRes.ok    ? await roleRes.json()    : [];
    const data     = configRes.ok  ? await configRes.json()  : {};

    populateChannelSelects(channels, data.Channel);
    populateRoleSelects(roles, data.FailRole);

    loadConfig(data, guildId, roles);

  } catch (err) {
    console.error('Init failed:', err);
    showToast('Failed to load configuration', 'error');
  }
}

window.addEventListener('DOMContentLoaded', init);