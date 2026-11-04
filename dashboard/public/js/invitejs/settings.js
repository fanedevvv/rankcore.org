// ─── Settings — Load & Save ───────────────────────────────────────────────────

import { showToast }                        from './toast.js';
import { toggleEmbedFields, updateEmbedPreview } from './preview.js';
import { initAutoRoles, addRewardRoleRow, collectRewardRoles, setServerRoles } from './Autoroles.js';
import { addMilestoneRow, addInviteMilestoneRow, collectMilestones, collectInviteMilestones } from './Milestones.js';
import { loadWebhooks }                      from './webhook.js';
import { updateSystemStatus }                from '../invitemain.js?v=2';

// ── Load ──────────────────────────────────────────────────────────────────────

export function loadConfig(data, guildId, roles) {
  setServerRoles(roles);

  // Core
  const enabled = document.getElementById('enabled');
  if (enabled) { enabled.checked = data.enabled ?? true; updateSystemStatus(); }

  setVal('welcomeChannelId',  data.welcomeChannelId  || '');
  setVal('welcomeMessage',    data.welcomeMessage     || '');
  setVal('logChannelId',      data.logChannelId       || '');
  setVal('leaderboardChannelId', data.leaderboardChannelId || '');
  setVal('leaderboardInterval',  data.leaderboardInterval  || 'daily');

  setChecked('ignoreBots',           data.ignoreBots           ?? true);
  setChecked('countLeavesAsNegative',data.countLeavesAsNegative ?? true);
  setChecked('trackInviteCodes',     data.trackInviteCodes     ?? true);
  setChecked('allowVanity',          data.allowVanity           ?? false);
  setChecked('verboseLogs',          data.verboseLogs           ?? false);
  setChecked('alertFake',            data.alertFake             ?? false);
  setChecked('showFakeInLeaderboard',data.showFakeInLeaderboard ?? false);

  setVal('fakeAccountAgeDays', data.fakeAccountAgeDays ?? 7);

  // Leave
  setChecked('leaveEnabled', data.leave?.enabled ?? false);
  setVal('leaveChannelId',   data.leave?.channelId || '');
  setVal('leaveMessage',     data.leave?.message   || '');

  // Embed
  setChecked('embedEnabled', data.embed?.enabled ?? false);
  setVal('embedTitle',       data.embed?.title       || '');
  setVal('embedDescription', data.embed?.description || '');
  setVal('embedColor',       data.embed?.color       || '#6C53FF');
  setVal('embedColorPicker', data.embed?.color       || '#6C53FF');
  setVal('embedFooter',      data.embed?.footer      || '');
  setVal('embedThumbnail',   data.embed?.thumbnail   || 'none');
  setVal('embedImage',       data.embed?.image       || '');
  setChecked('embedShowStats', data.embed?.showStats ?? false);
  toggleEmbedFields();
  updateEmbedPreview();

  // Webhook
  setChecked('webhookEnabled', data.webhookWelcome?.enabled ?? false);
  setVal('webhookChannelId',   data.webhookWelcome?.channelId || '');
  setVal('webhookUsername',    data.webhookWelcome?.username  || '');
  setVal('webhookAvatarUrl',   data.webhookWelcome?.avatarUrl || '');
  if (data.webhookWelcome?.channelId) {
    loadWebhooks(guildId, data.webhookWelcome.channelId, data.webhookWelcome.webhookId);
  }

  // Auto roles
  setChecked('autoRolesEnabled', data.autoRolesEnabled ?? false);
  initAutoRoles(data.autoRoles || [], roles);

  // Reward roles
  document.getElementById('rewardRoleList').innerHTML = '';
  (data.rewardRoles || []).forEach(r => addRewardRoleRow(r));

  // Milestones
  setChecked('milestonesEnabled', data.milestonesEnabled ?? false);
  setVal('milestoneChannelId', data.milestoneChannelId || '');
  document.getElementById('milestoneList').innerHTML = '';
  (data.milestones || []).forEach(m => addMilestoneRow(m));
  document.getElementById('inviteMilestoneList').innerHTML = '';
  (data.inviteMilestones || []).forEach(m => addInviteMilestoneRow(m));

  // Advanced
  setChecked('dmWelcomeEnabled', data.dmWelcome?.enabled ?? false);
  setVal('dmWelcomeMessage',     data.dmWelcome?.message || '');
  setVal('inviteFilterMode',     data.inviteFilter?.mode || 'all');
  setVal('inviteFilterCodes',    (data.inviteFilter?.codes || []).join(', '));
  setVal('welcomeCooldown',      data.welcomeCooldown ?? 0);
  setVal('maxJoinsPerDay',       data.maxJoinsPerDay  ?? 0);
}

// ── Save ──────────────────────────────────────────────────────────────────────

// Current form values (used by Save and by Send Test, so a test needs no save first)
export function collectConfig() {
  const filterCodes = (getVal('inviteFilterCodes') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const body = {
    enabled:              getChecked('enabled'),
    welcomeChannelId:     getVal('welcomeChannelId')     || null,
    welcomeMessage:       getVal('welcomeMessage'),
    logChannelId:         getVal('logChannelId')         || null,
    verboseLogs:          getChecked('verboseLogs'),
    fakeAccountAgeDays:   parseInt(getVal('fakeAccountAgeDays')) || 7,
    alertFake:            getChecked('alertFake'),
    ignoreBots:           getChecked('ignoreBots'),
    countLeavesAsNegative:getChecked('countLeavesAsNegative'),
    trackInviteCodes:     getChecked('trackInviteCodes'),
    allowVanity:          getChecked('allowVanity'),
    showFakeInLeaderboard:getChecked('showFakeInLeaderboard'),
    leaderboardInterval:  getVal('leaderboardInterval'),
    leaderboardChannelId: getVal('leaderboardChannelId') || null,

    leave: {
      enabled:   getChecked('leaveEnabled'),
      channelId: getVal('leaveChannelId') || null,
      message:   getVal('leaveMessage')
    },

    embed: {
      enabled:   getChecked('embedEnabled'),
      title:     getVal('embedTitle'),
      description: getVal('embedDescription'),
      color:     getVal('embedColor') || '#6C53FF',
      footer:    getVal('embedFooter'),
      thumbnail: getVal('embedThumbnail'),
      image:     getVal('embedImage'),
      showStats: getChecked('embedShowStats')
    },

    webhookWelcome: {
      enabled:   getChecked('webhookEnabled'),
      channelId: getVal('webhookChannelId')  || null,
      webhookId: getVal('webhookSelect')     || null,
      username:  getVal('webhookUsername')   || null,
      avatarUrl: getVal('webhookAvatarUrl')  || null
    },

    autoRolesEnabled: getChecked('autoRolesEnabled'),
    autoRoles: [...document.querySelectorAll('#autoRoleList .role-tag')].map(t => t.dataset.id),
    rewardRoles: collectRewardRoles(),

    milestonesEnabled: getChecked('milestonesEnabled'),
    milestoneChannelId: getVal('milestoneChannelId') || null,
    milestones: collectMilestones(),
    inviteMilestones: collectInviteMilestones(),

    dmWelcome: {
      enabled: getChecked('dmWelcomeEnabled'),
      message: getVal('dmWelcomeMessage')
    },

    inviteFilter: {
      mode:  getVal('inviteFilterMode'),
      codes: filterCodes
    },

    welcomeCooldown: parseInt(getVal('welcomeCooldown')) || 0,
    maxJoinsPerDay:  parseInt(getVal('maxJoinsPerDay'))  || 0
  };
  return body;
}

export async function saveConfig(guildId) {
  const body = collectConfig();
  try {
    const res = await fetch(`/api/guild/${guildId}/invite-config`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) showToast('Configuration saved!');
    else showToast('Failed to save configuration', 'error');
  } catch {
    showToast('Network error', 'error');
  }
}

// Sends the join message (and log line) as if you had just joined, using the form as it is now
export async function sendTest(guildId) {
  const btn = document.getElementById('inviteTestBtn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/guild/${guildId}/invite-config/test`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectConfig())
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) showToast(d.sent ? `Test sent: ${d.sent}` : 'Test message sent!');
    else showToast(d.error || 'Failed to send test', 'error');
  } catch {
    showToast('Network error', 'error');
  } finally {
    setTimeout(() => { if (btn) btn.disabled = false; }, 10000);
  }
}

// ── Tiny DOM helpers ──────────────────────────────────────────────────────────

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

function getVal(id) {
  return document.getElementById(id)?.value ?? '';
}

function getChecked(id) {
  return document.getElementById(id)?.checked ?? false;
}