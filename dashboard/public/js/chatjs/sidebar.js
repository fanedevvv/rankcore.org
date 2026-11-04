import { state } from './state.js';
import { esc }   from './ui.js';

export function renderSidebar() {
  const list = document.getElementById('slist');
  if (!list) return;

  const q        = state.searchFilter.toLowerCase();
  const filtered = q
    ? state.conversations.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.preview || '').toLowerCase().includes(q))
    : state.conversations;

  if (!filtered.length) {
    const msg = q
      ? 'No results found.'
      : 'No conversations yet. Start a new chat!';
    list.innerHTML = `<div class="sempty">${msg}</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const isActive = c.id === state.activeConvId;
    const preview  = esc(c.preview || (c.count ? `${c.count} messages` : 'Empty'));
    return `
      <div class="sitem${isActive ? ' active' : ''}" id="conv-${c.id}"
           onclick="selectConversation(${c.id})" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter')selectConversation(${c.id})">
        <div class="si">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <div class="sinfo">
          <div class="st">${esc(c.title)}</div>
          <div class="sp">${preview}</div>
        </div>
        <div class="sa">
          <button class="sab rn" onclick="renameConversation(${c.id}, event)" title="Rename" aria-label="Rename">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="sab dl" onclick="deleteConversation(${c.id}, event)" title="Delete" aria-label="Delete">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

export function filterConvs() {
  state.searchFilter = document.getElementById('ssearch')?.value || '';
  renderSidebar();
}
