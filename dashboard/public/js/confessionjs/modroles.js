// ─── Moderator Roles ──────────────────────────────────────────────────────────

import { showToast } from './toast.js';
import { renderChips, roleLabel } from './state.js';

export let localModRoles = [];

export function setModRoles(roles) { localModRoles = roles; }

export function addModRole() {
  const id = document.getElementById('modRoleSelect').value;
  if (!id || localModRoles.includes(id)) return showToast('Select a role first', 'error');
  localModRoles.push(id);
  renderChips('modRoleList', localModRoles, roleLabel, 'removeModRole');
}

export function removeModRole(id) {
  localModRoles = localModRoles.filter(r => r !== id);
  renderChips('modRoleList', localModRoles, roleLabel, 'removeModRole');
}