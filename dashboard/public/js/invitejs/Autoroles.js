// ─── Auto Roles & Reward Roles ────────────────────────────────────────────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Shared mutable state — kept here so add/remove stay in sync
export const autoRoles = [];
export let serverRoles = [];

export function setServerRoles(roles) {
  serverRoles.length = 0;
  serverRoles.push(...roles);
}

// ── Join Auto Roles ───────────────────────────────────────────────────────────

export function addAutoRole() {
  const sel  = document.getElementById('autoRoleSelect');
  const id   = sel?.value;
  const name = sel?.options[sel.selectedIndex]?.text;
  if (!id || autoRoles.includes(id)) return;

  autoRoles.push(id);

  const list = document.getElementById('autoRoleList');
  const tag  = document.createElement('div');
  tag.className  = 'role-tag';
  tag.dataset.id = id;
  tag.innerHTML  = `
    <span class="dot" style="background:#99aab5;"></span>
    ${escapeHtml(name)}
    <span onclick="window.removeAutoRole('${escapeHtml(id)}', this.parentElement)"
          style="color:var(--danger); cursor:pointer; margin-left:0.2rem;">×</span>
  `;
  list.appendChild(tag);
}

export function removeAutoRole(id, el) {
  const idx = autoRoles.indexOf(id);
  if (idx !== -1) autoRoles.splice(idx, 1);
  el?.remove();
}

export function initAutoRoles(ids, roles) {
  autoRoles.length = 0;
  autoRoles.push(...ids);

  const list = document.getElementById('autoRoleList');
  if (!list) return;
  list.innerHTML = '';

  ids.forEach(id => {
    const role = roles.find(r => r.id === id);
    if (!role) return;
    const tag = document.createElement('div');
    tag.className  = 'role-tag';
    tag.dataset.id = id;
    tag.innerHTML  = `
      <span class="dot" style="background:#99aab5;"></span>
      ${escapeHtml(role.name)}
      <span onclick="window.removeAutoRole('${escapeHtml(id)}', this.parentElement)"
            style="color:var(--danger); cursor:pointer; margin-left:0.2rem;">×</span>
    `;
    list.appendChild(tag);
  });
}

// ── Reward Roles ──────────────────────────────────────────────────────────────

export function addRewardRoleRow(data = null) {
  const list = document.getElementById('rewardRoleList');
  if (!list) return;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';
  row.innerHTML = `
    <input type="number" placeholder="Invites" min="1" value="${data?.invites || ''}"
           style="width:90px; flex-shrink:0;">
    <select style="flex:1; min-width:0;">
      <option value="">Select role...</option>
      ${serverRoles.map(r =>
        `<option value="${escapeHtml(r.id)}" ${data?.roleId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`
      ).join('')}
    </select>
    <button onclick="this.parentElement.remove()"
            style="background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.3);
                   color:var(--danger); padding:0.3rem 0.6rem; border-radius:0.5rem;
                   cursor:pointer; font-size:0.8rem; flex-shrink:0;">✕</button>
  `;
  list.appendChild(row);
}

export function collectRewardRoles() {
  return [...document.getElementById('rewardRoleList').children].map(row => ({
    invites: parseInt(row.querySelector('input').value) || 0,
    roleId:  row.querySelector('select').value
  })).filter(r => r.invites && r.roleId);
}