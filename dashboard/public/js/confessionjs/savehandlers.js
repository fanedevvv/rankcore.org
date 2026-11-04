// ─── Save Handlers ────────────────────────────────────────────────────────────

import { showToast } from './toast.js';
import { localModRoles } from './modroles.js';
import { localWords } from './wordfilter.js';

export async function saveCore(guildId) {
  const body = {
    ConfessionChannel:  document.getElementById('confessionChannel').value,
    ReviewChannel:      document.getElementById('reviewChannel').value      || null,
    LogChannel:         document.getElementById('logChannel').value         || null,
    ReportChannel:      document.getElementById('reportChannel').value      || null,
    ReviewPingRole:     document.getElementById('reviewPingRole').value     || null,
    ConfessionPingRole: document.getElementById('confessionPingRole').value || null,
    ReportPingRole:     document.getElementById('reportPingRole').value     || null,
    ModeratorRoles:     localModRoles,
  };
  if (!body.ConfessionChannel) return showToast('Confession channel required', 'error');
  const res = await fetch(`/api/guild/${guildId}/confession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  res.ok ? showToast('Core settings saved') : showToast('Save failed', 'error');
}

export async function saveReview(guildId) {
  const autoMin = parseFloat(document.getElementById('autoApproveMin').value) || 0;
  const body = {
    ReviewEnabled:      document.getElementById('reviewEnabled').checked,
    AnonymousReview:    document.getElementById('anonymousReview').checked,
    AutoApproveAfterMs: autoMin * 60_000,
    DMOnApprove:        document.getElementById('dmOnApprove').checked,
    DMOnDeny:           document.getElementById('dmOnDeny').checked,
  };
  const res = await fetch(`/api/guild/${guildId}/confession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  res.ok ? showToast('Review settings saved') : showToast('Save failed', 'error');
}

export async function saveEmbed(guildId) {
  const color = document.getElementById('confColor').value;
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return showToast('Invalid hex colour', 'error');
  const body = {
    ConfessionTitle:      document.getElementById('confTitle').value  || '💬 Anonymous Confession',
    ConfessionColor:      color || '#5865F2',
    ConfessionFooter:     document.getElementById('confFooter').value || '',
    ShowConfessionNumber: document.getElementById('showNumber').checked,
  };
  const res = await fetch(`/api/guild/${guildId}/confession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  res.ok ? showToast('Embed settings saved') : showToast('Save failed', 'error');
}

export async function saveBehaviour(guildId) {
  const emojis = document.getElementById('reactionEmojis').value.split(',').map(e => e.trim()).filter(Boolean).slice(0, 5);
  const body = {
    CooldownSeconds:     parseInt(document.getElementById('cooldownSec').value) || 60,
    MinConfessionLength: parseInt(document.getElementById('minLength').value)   || 10,
    MaxConfessionLength: parseInt(document.getElementById('maxLength').value)   || 2000,
    ReactionsEnabled:    document.getElementById('reactionsEnabled').checked,
    ReactionEmojis:      emojis,
    ThreadReplies:       document.getElementById('threadReplies').checked,
  };
  const res = await fetch(`/api/guild/${guildId}/confession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  res.ok ? showToast('Behaviour settings saved') : showToast('Save failed', 'error');
}

export async function saveFilter(guildId) {
  const body = {
    WordFilterEnabled: document.getElementById('filterEnabled').checked,
    FilterAction:      document.getElementById('filterAction').value,
    BlockedWords:      localWords,
  };
  const res = await fetch(`/api/guild/${guildId}/confession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  res.ok ? showToast('Filter settings saved') : showToast('Save failed', 'error');
}

export async function resetStats(guildId) {
  if (!confirm('Reset all confession statistics to zero?')) return;
  const res = await fetch(`/api/guild/${guildId}/confession/stats/reset`, { method: 'POST' });
  if (res.ok) {
    ['statPosted','statDenied','statFiltered'].forEach(id => document.getElementById(id).textContent = '0');
    document.getElementById('statCount').textContent = '#0';
    showToast('Stats reset');
  } else showToast('Failed', 'error');
}

export async function resetSystem(guildId, onSuccess) {
  if (!confirm('This will delete ALL confession system settings. Are you sure?')) return;
  const res = await fetch(`/api/guild/${guildId}/confession`, { method: 'DELETE' });
  if (res.ok) { showToast('System reset'); onSuccess(); }
  else showToast('Failed', 'error');
}