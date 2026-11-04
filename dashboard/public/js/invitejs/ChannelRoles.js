// ─── Channels & Roles Population ─────────────────────────────────────────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function populateChannelSelects(data) {
  const ids = [
    'welcomeChannelId', 'logChannelId', 'leaveChannelId',
    'webhookChannelId', 'leaderboardChannelId', 'milestoneChannelId'
  ];
  ids.forEach(id => {
    window.rzrPopulateChannels(document.getElementById(id), data, null, 'Disabled');
  });
}

export function populateRoleSelects(roles) {
  const opts =
    `<option value="">Choose a role...</option>` +
    roles.map(r =>
      `<option value="${escapeHtml(r.id)}" data-color="${escapeHtml(r.color || '#99aab5')}">${escapeHtml(r.name)}</option>`
    ).join('');

  const el = document.getElementById('autoRoleSelect');
  if (el) el.innerHTML = opts;
}