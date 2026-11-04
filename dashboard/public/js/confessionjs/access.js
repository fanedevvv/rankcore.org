// ─── Access (Blacklist / Trusted / Required Roles) ────────────────────────────

import { showToast } from './toast.js';
import { renderChips, roleLabel } from './state.js';

export let localBlacklist     = [];
export let localTrusted       = [];
export let localRequiredRoles = [];

export function setAccessLists(blacklist, trusted, required) {
  localBlacklist     = blacklist;
  localTrusted       = trusted;
  localRequiredRoles = required;
}

// ── Blacklist ──────────────────────────────────────────────────────────────────

export async function addBlacklist(guildId) {
  const id = document.getElementById('blacklistInput').value.trim();
  if (!/^\d{17,20}$/.test(id)) return showToast('Enter a valid user ID (17–20 digits)', 'error');
  const res = await fetch(`/api/guild/${guildId}/confession/blacklist/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }),
  });
  if (res.ok) {
    localBlacklist.push(id);
    renderChips('blacklistList', localBlacklist, i => i, 'removeBlacklist');
    document.getElementById('blacklistInput').value = '';
    showToast('User blacklisted');
  } else showToast('Failed', 'error');
}

export async function removeBlacklist(guildId, id) {
  const res = await fetch(`/api/guild/${guildId}/confession/blacklist/remove`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }),
  });
  if (res.ok) { localBlacklist = localBlacklist.filter(i => i !== id); renderChips('blacklistList', localBlacklist, i => i, 'removeBlacklist'); showToast('Removed from blacklist'); }
  else showToast('Failed', 'error');
}

// ── Trusted Users ──────────────────────────────────────────────────────────────

export async function addTrusted(guildId) {
  const id = document.getElementById('trustedInput').value.trim();
  if (!/^\d{17,20}$/.test(id)) return showToast('Enter a valid user ID', 'error');
  const res = await fetch(`/api/guild/${guildId}/confession/trusted/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }),
  });
  if (res.ok) {
    localTrusted.push(id);
    renderChips('trustedList', localTrusted, i => i, 'removeTrusted');
    document.getElementById('trustedInput').value = '';
    showToast('Trusted user added');
  } else showToast('Failed', 'error');
}

export async function removeTrusted(guildId, id) {
  const res = await fetch(`/api/guild/${guildId}/confession/trusted/remove`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }),
  });
  if (res.ok) { localTrusted = localTrusted.filter(i => i !== id); renderChips('trustedList', localTrusted, i => i, 'removeTrusted'); showToast('Removed from trusted'); }
  else showToast('Failed', 'error');
}

// ── Required Roles ─────────────────────────────────────────────────────────────

export function addRequiredRole() {
  const id = document.getElementById('requiredRoleSelect').value;
  if (!id || localRequiredRoles.includes(id)) return showToast('Select a role first', 'error');
  localRequiredRoles.push(id);
  renderChips('requiredRoleList', localRequiredRoles, roleLabel, 'removeRequiredRole');
}

export function removeRequiredRole(id) {
  localRequiredRoles = localRequiredRoles.filter(r => r !== id);
  renderChips('requiredRoleList', localRequiredRoles, roleLabel, 'removeRequiredRole');
}

export async function saveRequiredRoles(guildId) {
  const res = await fetch(`/api/guild/${guildId}/confession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ RequiredRoles: localRequiredRoles }),
  });
  res.ok ? showToast('Required roles saved') : showToast('Failed', 'error');
}