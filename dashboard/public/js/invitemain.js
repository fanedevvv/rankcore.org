// ─── Main Entry Point ─────────────────────────────────────────────────────────
import { showToast } from './invitejs/toast.js';
import { switchTab, initTabs } from './invitejs/tabs.js';
import { populateChannelSelects, populateRoleSelects } from './invitejs/ChannelRoles.js';
import { updateWelcomePreview, insertVar, updateEmbedPreview, syncColorPicker, toggleEmbedFields } from './invitejs/preview.js';
import { addAutoRole, removeAutoRole, addRewardRoleRow } from './invitejs/Autoroles.js';
import { addMilestoneRow, addInviteMilestoneRow } from './invitejs/Milestones.js';
import { loadWebhooks } from './invitejs/webhook.js';
import { applyBonus, confirmReset } from './invitejs/advanced.js';
import { loadConfig, saveConfig, sendTest } from './invitejs/settings.js?v=2';

const guildId = location.pathname.split('/')[2];

// ─── Expose globals for inline onclick handlers ───────────────────────────────

window.switchTab              = (name, btn) => switchTab(name, btn);
window.updateSystemStatus     = updateSystemStatus;
window.insertVar              = insertVar;
window.updateWelcomePreview   = updateWelcomePreview;
window.updateEmbedPreview     = updateEmbedPreview;
window.syncColorPicker        = syncColorPicker;
window.toggleEmbedFields      = toggleEmbedFields;
window.toggleEmbedPreview     = () => {};
window.step                   = step;
window.addAutoRole            = addAutoRole;
window.removeAutoRole         = removeAutoRole;
window.addRewardRoleRow       = () => addRewardRoleRow();
window.addMilestoneRow        = () => addMilestoneRow();
window.addInviteMilestoneRow  = () => addInviteMilestoneRow();
window.loadWebhooks           = (channelId) => loadWebhooks(guildId, channelId);
window.applyBonus             = () => applyBonus(guildId);
window.confirmReset           = (type) => confirmReset(guildId, type, init);
window.saveConfig             = () => saveConfig(guildId);
window.sendInviteTest         = () => sendTest(guildId);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function updateSystemStatus() {
  const el = document.getElementById('systemStatus');
  const checked = document.getElementById('enabled').checked;
  el.textContent = checked ? 'ON' : 'OFF';
  el.style.color = checked ? 'var(--razor)' : 'var(--muted)';
}

export function step(id, delta) {
  const el = document.getElementById(id);
  const min = parseFloat(el.min ?? -Infinity);
  const max = parseFloat(el.max ?? Infinity);
  el.value = Math.max(min, Math.min(max, parseFloat(el.value || 0) + delta));
  el.dispatchEvent(new Event('input'));
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  initTabs();

  try {
    const [channelRes, roleRes, configRes] = await Promise.all([
      fetch(`/api/guild/${guildId}/channels`),
      fetch(`/api/guild/${guildId}/roles`),
      fetch(`/api/guild/${guildId}/invite-config`)
    ]);

    const channels = await channelRes.json();
    const roles    = roleRes.ok ? await roleRes.json() : [];
    const data     = await configRes.json();

    populateChannelSelects(channels);
    if (roles.length) populateRoleSelects(roles);

    loadConfig(data, guildId, roles);

    updateWelcomePreview();
    updateEmbedPreview();

  } catch (err) {
    console.error(err);
    showToast('Failed to load configuration', 'error');
  }
}

window.addEventListener('DOMContentLoaded', init);