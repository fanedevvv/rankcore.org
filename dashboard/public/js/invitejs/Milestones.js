// ─── Milestones ───────────────────────────────────────────────────────────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Member Count Milestones ───────────────────────────────────────────────────

export function addMilestoneRow(data = null) {
  const list = document.getElementById('milestoneList');
  if (!list) return;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';
  row.innerHTML = `
    <input type="number" placeholder="Member #" min="1" value="${data?.count || ''}"
           style="width:110px; flex-shrink:0;">
    <input type="text" placeholder="🎉 We hit {count} members!"
           value="${escapeHtml(data?.message || '')}" style="flex:1; min-width:0;">
    <button onclick="this.parentElement.remove()"
            style="background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.3);
                   color:var(--danger); padding:0.3rem 0.6rem; border-radius:0.5rem;
                   cursor:pointer; font-size:0.8rem; flex-shrink:0;">✕</button>
  `;
  list.appendChild(row);
}

export function collectMilestones() {
  return [...document.getElementById('milestoneList').children].map(row => {
    const inputs = row.querySelectorAll('input');
    return { count: parseInt(inputs[0].value) || 0, message: inputs[1].value };
  }).filter(m => m.count && m.message);
}

// ── Invite Milestones ─────────────────────────────────────────────────────────

export function addInviteMilestoneRow(data = null) {
  const list = document.getElementById('inviteMilestoneList');
  if (!list) return;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';
  row.innerHTML = `
    <input type="number" placeholder="Invites" min="1" value="${data?.invites || ''}"
           style="width:90px; flex-shrink:0;">
    <input type="text" placeholder="{inviter} hit {invites} invites! 🎊"
           value="${escapeHtml(data?.message || '')}" style="flex:1; min-width:0;">
    <button onclick="this.parentElement.remove()"
            style="background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.3);
                   color:var(--danger); padding:0.3rem 0.6rem; border-radius:0.5rem;
                   cursor:pointer; font-size:0.8rem; flex-shrink:0;">✕</button>
  `;
  list.appendChild(row);
}

export function collectInviteMilestones() {
  return [...document.getElementById('inviteMilestoneList').children].map(row => {
    const inputs = row.querySelectorAll('input');
    return { invites: parseInt(inputs[0].value) || 0, message: inputs[1].value };
  }).filter(m => m.invites && m.message);
}