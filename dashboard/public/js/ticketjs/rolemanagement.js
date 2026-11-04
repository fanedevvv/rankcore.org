'use strict';
import { showToast } from './toast.js';

async function post(url, body) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function addBlacklistRole(guildId, onSuccess) {
  const roleId = document.getElementById('blacklistRole')?.value;
  if (!roleId) return showToast('Select a role first', 'error');
  const res = await post(`/api/guild/${guildId}/ticket/blacklist/add`, { roleId });
  if (res.ok) { showToast('Role blacklisted'); onSuccess?.(); }
  else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Failed', 'error'); }
}

export async function removeBlacklistRole(guildId, roleId, onSuccess) {
  if (!confirm('Remove this role from blacklist?')) return;
  const res = await post(`/api/guild/${guildId}/ticket/blacklist/remove`, { roleId });
  if (res.ok) { showToast('Removed'); onSuccess?.(); }
  else showToast('Failed', 'error');
}

export async function addManageRole(guildId, onSuccess) {
  const roleId = document.getElementById('manageRoleSelect')?.value;
  if (!roleId) return showToast('Select a role first', 'error');
  const res = await post(`/api/guild/${guildId}/ticket/manage-roles/add`, { roleId });
  if (res.ok) { showToast('Manager role added'); onSuccess?.(); }
  else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Failed', 'error'); }
}

export async function removeManageRole(guildId, roleId, onSuccess) {
  if (!confirm('Remove this manager role?')) return;
  const res = await post(`/api/guild/${guildId}/ticket/manage-roles/remove`, { roleId });
  if (res.ok) { showToast('Removed'); onSuccess?.(); }
  else showToast('Failed', 'error');
}

export async function addPingRole(guildId, onSuccess) {
  const roleId = document.getElementById('pingRoleSelect')?.value;
  if (!roleId) return showToast('Select a role first', 'error');
  const res = await post(`/api/guild/${guildId}/ticket/ping-roles/add`, { roleId });
  if (res.ok) { showToast('Ping role added'); onSuccess?.(); }
  else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Failed', 'error'); }
}

export async function removePingRole(guildId, roleId, onSuccess) {
  if (!confirm('Remove this ping role?')) return;
  const res = await post(`/api/guild/${guildId}/ticket/ping-roles/remove`, { roleId });
  if (res.ok) { showToast('Removed'); onSuccess?.(); }
  else showToast('Failed', 'error');
}
