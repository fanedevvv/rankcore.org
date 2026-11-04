// ─── Word Groups ──────────────────────────────────────────────────────────────
import { wordGroups, ACTIONS } from './state.js';
import { esc } from './helpers.js';

export function renderWordGroups() {
  const list = document.getElementById('wordGroupsList');
  list.innerHTML = '';
  if (!wordGroups.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:.82rem;padding:1rem 0;">No word groups yet. Click "Add Group" to create one.</div>';
    return;
  }
  wordGroups.forEach((g, gi) => {
    const div = document.createElement('div');
    div.className = 'word-group';
    div.innerHTML = `
      <div class="word-group-header">
        <input type="text" value="${esc(g.name)}" placeholder="Group name (e.g. Racism)"
          style="max-width:200px;" onchange="window.wordGroups[${gi}].name=this.value">
        <select style="max-width:110px;" onchange="window.wordGroups[${gi}].matchMode=this.value">
          <option value="wildcard" ${g.matchMode === 'wildcard' ? 'selected' : ''}>Wildcard</option>
          <option value="exact"    ${g.matchMode === 'exact'    ? 'selected' : ''}>Exact</option>
        </select>
        <select style="max-width:110px;" onchange="window.wordGroups[${gi}].action=this.value">
          ${ACTIONS.map(a => `<option value="${a.value}" ${g.action === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}
        </select>
        <div style="flex:1;"></div>
        <button class="btn-icon" onclick="window.removeWordGroup(${gi})" title="Remove group">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="12" height="12" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3l105.3 105.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256l105.3-105.4z"/></svg>
        </button>
      </div>
      <div class="tag-wrap" id="wg-tags-${gi}">
        ${g.words.map((w, wi) => `
          <span class="tag">${esc(w)}<button onclick="window.removeWordFromGroup(${gi},${wi})" title="Remove">×</button></span>
        `).join('')}
      </div>
      <div class="tag-input-row">
        <input type="text" placeholder="Type a word and press Enter…" id="wg-inp-${gi}"
          onkeydown="if(event.key==='Enter'){window.addWordToGroup(${gi});event.preventDefault();}">
        <button class="add-cond-btn" onclick="window.addWordToGroup(${gi})">Add</button>
      </div>
    `;
    list.appendChild(div);
  });
}

export function addWordGroup() {
  wordGroups.push({ name: 'New Group', words: [], matchMode: 'wildcard', action: 'delete', muteDuration: 10 });
  renderWordGroups();
}

export function removeWordGroup(gi) {
  wordGroups.splice(gi, 1);
  renderWordGroups();
}

export function addWordToGroup(gi) {
  const inp = document.getElementById(`wg-inp-${gi}`);
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  raw.split(/[,\n]+/).map(w => w.trim()).filter(Boolean).forEach(w => {
    if (!wordGroups[gi].words.includes(w)) wordGroups[gi].words.push(w);
  });
  inp.value = '';
  renderWordGroups();
}

export function removeWordFromGroup(gi, wi) {
  wordGroups[gi].words.splice(wi, 1);
  renderWordGroups();
}