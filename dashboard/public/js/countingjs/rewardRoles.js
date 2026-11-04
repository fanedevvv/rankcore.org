// countingjs/rewardRoles.js

/** @type {Record<string, string>} milestone -> roleId */
let rewardRoles = {};

/** Cached role list for label lookup */
let _allRoles = [];

export function initRewardRoles(saved, allRoles) {
  rewardRoles = saved ? { ...saved } : {};
  _allRoles   = allRoles || [];
  render();
}

export function getRewardRoles() {
  return { ...rewardRoles };
}

export function addRewardRole() {
  const ms     = document.getElementById('rwMilestone')?.value.trim();
  const roleId = document.getElementById('rwRole')?.value;
  if (!ms || !roleId) return { error: 'Select both a milestone and a role' };
  rewardRoles[ms] = roleId;
  render();
  document.getElementById('rwMilestone').value = '';
  document.getElementById('rwRole').value      = '';
  return {};
}

export function removeRewardRole(ms) {
  delete rewardRoles[ms];
  render();
}

function render() {
  const container = document.getElementById('rewardList');
  const noMsg     = document.getElementById('noRewards');
  if (!container) return;

  const entries = Object.entries(rewardRoles);

  if (entries.length === 0) {
    if (noMsg) noMsg.style.display = '';
    container.innerHTML = '';
    if (noMsg) container.appendChild(noMsg);
    return;
  }

  if (noMsg) noMsg.style.display = 'none';
  container.innerHTML = '';

  entries
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([ms, roleId]) => {
      const roleName = (_allRoles.find(r => r.id === roleId) || {}).name || roleId;
      const row      = document.createElement('div');
      row.className  = 'reward-row';
      row.innerHTML  = `
        <span class="text-razor font-mono font-bold text-sm">@ ${esc(ms)}</span>
        <span class="flex-1 text-sm text-gray-200">→ <span class="font-semibold">${esc(roleName)}</span></span>
        <button class="remove-rr text-red-400 hover:text-red-300 text-xs font-bold transition-all" data-ms="${esc(ms)}">Remove</button>
      `;
      row
        .querySelector('.remove-rr')
        .addEventListener('click', () => removeRewardRole(ms));
      container.appendChild(row);
    });
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