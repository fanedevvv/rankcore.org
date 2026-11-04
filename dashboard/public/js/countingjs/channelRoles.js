// countingjs/channelRoles.js

/**
 * Populate every channel <select> in the counting dashboard.
 * @param {Array<{id:string, name:string}>} channels
 * @param {string} selectedChannelId - current saved channel
 */
export function populateChannelSelects(data, selectedChannelId) {
  const channelSelect = document.getElementById('countChannel');
  if (!channelSelect) return;
  window.rzrPopulateChannels(channelSelect, data, selectedChannelId, 'Select a Channel');
}

/**
 * Populate every role <select> in the counting dashboard.
 * @param {Array<{id:string, name:string}>} roles
 * @param {string|null} selectedFailRoleId - current saved fail role
 */
export function populateRoleSelects(roles, selectedFailRoleId) {
  const roleOptions = roles
    .map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`)
    .join('');

  const failRoleSelect = document.getElementById('failRole');
  if (failRoleSelect) {
    failRoleSelect.innerHTML = `<option value="">No role</option>` + roleOptions;
    if (selectedFailRoleId) failRoleSelect.value = selectedFailRoleId;
  }

  const rwRoleSelect = document.getElementById('rwRole');
  if (rwRoleSelect) {
    rwRoleSelect.innerHTML = `<option value="">Select role...</option>` + roleOptions;
  }
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}