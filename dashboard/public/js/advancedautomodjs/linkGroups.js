// ─── Link Groups ──────────────────────────────────────────────────────────────
import { linkGroups, ACTIONS } from './state.js';
import { esc } from './helpers.js';

export function renderLinkGroups() {
  const list = document.getElementById('linkGroupsList');
  list.innerHTML = '';
  if (!linkGroups.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:.82rem;padding:1rem 0;">No link groups yet. Click "Add Group" to create one.</div>';
    return;
  }
  linkGroups.forEach((g, gi) => {
    const div = document.createElement('div');
    div.className = 'link-group';
    div.innerHTML = `
      <div class="word-group-header">
        <input type="text" value="${esc(g.name)}" placeholder="Group name"
          style="max-width:200px;" onchange="window.linkGroups[${gi}].name=this.value">
        <select style="max-width:120px;" onchange="window.linkGroups[${gi}].mode=this.value">
          <option value="blacklist" ${g.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option>
          <option value="whitelist" ${g.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option>
        </select>
        <select style="max-width:110px;" onchange="window.linkGroups[${gi}].action=this.value">
          ${ACTIONS.map(a => `<option value="${a.value}" ${g.action === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}
        </select>
        <div style="flex:1;"></div>
        <button class="btn-icon" onclick="window.removeLinkGroup(${gi})">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="12" height="12" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3l105.3 105.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256l105.3-105.4z"/></svg>
        </button>
      </div>
      <div class="tag-wrap" id="lg-tags-${gi}">
        ${g.domains.map((d, di) => `
          <span class="tag">${esc(d)}<button onclick="window.removeDomainFromGroup(${gi},${di})">×</button></span>
        `).join('')}
      </div>
      <div class="tag-input-row">
        <input type="text" placeholder="domain.com, discord.gg…" id="lg-inp-${gi}"
          onkeydown="if(event.key==='Enter'){window.addDomainToGroup(${gi});event.preventDefault();}">
        <button class="add-cond-btn" onclick="window.addDomainToGroup(${gi})">Add</button>
      </div>
    `;
    list.appendChild(div);
  });
}

export function addLinkGroup() {
  linkGroups.push({ name: 'New Group', mode: 'blacklist', domains: [], action: 'delete', muteDuration: 10 });
  renderLinkGroups();
}

export function removeLinkGroup(gi) {
  linkGroups.splice(gi, 1);
  renderLinkGroups();
}

export function addDomainToGroup(gi) {
  const inp = document.getElementById(`lg-inp-${gi}`);
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  raw.split(/[,\n\s]+/).map(d => d.trim().toLowerCase()).filter(Boolean).forEach(d => {
    if (!linkGroups[gi].domains.includes(d)) linkGroups[gi].domains.push(d);
  });
  inp.value = '';
  renderLinkGroups();
}

export function removeDomainFromGroup(gi, di) {
  linkGroups[gi].domains.splice(di, 1);
  renderLinkGroups();
}