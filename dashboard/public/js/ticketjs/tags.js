'use strict';
import { showToast } from './toast.js';

export function renderTagList(tags, guildId) {
  const el = document.getElementById('tagList');
  if (!el) return;

  const countEl = document.getElementById('tagCount');
  if (countEl) countEl.textContent = `${tags.length} ${tags.length === 1 ? 'Tag' : 'Tags'}`;

  if (!tags.length) {
    el.innerHTML = `<p class="empty-small">No tags yet.</p>`;
    return;
  }

  el.innerHTML = tags.map(t => `
    <div class="tag-item">
      <div class="tag-item-left">
        <span class="tag-dot" style="background:${t.color || '#6b7280'}"></span>
        <span class="tag-emoji">${t.emoji || '🏷️'}</span>
        <span class="tag-name">${t.name}</span>
      </div>
      <button onclick="removeTag('${encodeURIComponent(t.name)}')" class="icon-btn icon-btn-danger" title="Delete tag">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
}

export async function addTag(guildId, onSuccess) {
  const name  = document.getElementById('tagName')?.value.trim();
  const color = document.getElementById('tagColor')?.value || '#6b7280';
  const emoji = document.getElementById('tagEmoji')?.value.trim() || '🏷️';

  if (!name) return showToast('Tag name is required', 'error');

  const res = await fetch(`/api/guild/${guildId}/ticket/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, emoji }),
  });
  const data = await res.json();
  if (res.ok) {
    showToast('Tag added');
    ['tagName','tagEmoji'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    onSuccess?.();
  } else {
    showToast(data.error || 'Failed to add tag', 'error');
  }
}

export async function removeTag(guildId, encodedName, onSuccess) {
  const name = decodeURIComponent(encodedName);
  if (!confirm(`Delete tag "${name}"?`)) return;
  const res = await fetch(`/api/guild/${guildId}/ticket/tags/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (res.ok) { showToast('Tag removed'); onSuccess?.(); }
  else showToast('Failed to remove tag', 'error');
}
