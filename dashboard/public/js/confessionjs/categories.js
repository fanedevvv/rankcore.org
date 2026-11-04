// ─── Categories ───────────────────────────────────────────────────────────────

import { showToast } from './toast.js';

export let localCategories = [];

export function setCategories(cats) { localCategories = cats; }

export function renderCategories() {
  const el = document.getElementById('catList');
  if (!localCategories.length) {
    el.innerHTML = '<p class="text-xs text-gray-600 italic text-center py-6">No categories yet.</p>';
    return;
  }
  el.innerHTML = localCategories.map(c => {
    const safeLabel = c.label.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const channelLine = c.channel
      ? '<p class="text-[10px] text-gray-500">\u2192 <#' + c.channel + '></p>'
      : '';
    return (
      '<div class="flex items-center justify-between px-3 py-2.5 bg-white/5 rounded-xl border border-white/5 group hover:border-razor/20 transition">' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-xl">' + (c.emoji || '\uD83D\uDCC2') + '</span>' +
          '<div>' +
            '<p class="text-sm font-semibold text-gray-200">' + c.label + '</p>' +
            channelLine +
          '</div>' +
        '</div>' +
        '<button onclick="removeCategory(\'' + safeLabel + '\')" class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-red-500/10">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>'
    );
  }).join('');
}

export async function addCategory(guildId) {
  const label   = document.getElementById('catLabel').value.trim();
  const emoji   = document.getElementById('catEmoji').value.trim() || '📂';
  const channel = document.getElementById('catChannel').value || null;
  if (!label) return showToast('Label required', 'error');
  const res = await fetch('/api/guild/' + guildId + '/confession/categories/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, emoji, channel }),
  });
  if (res.ok) {
    const data = await res.json();
    localCategories = data.categories || [...localCategories, { label, emoji, channel }];
    renderCategories();
    document.getElementById('catLabel').value   = '';
    document.getElementById('catEmoji').value   = '';
    document.getElementById('catChannel').value = '';
    showToast('Category "' + label + '" added');
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || 'Failed to add category', 'error');
  }
}

export async function removeCategory(guildId, label) {
  if (!confirm('Remove category "' + label + '"?')) return;
  const res = await fetch('/api/guild/' + guildId + '/confession/categories/' + encodeURIComponent(label), {
    method: 'DELETE',
  });
  if (res.ok) {
    localCategories = localCategories.filter(c => c.label !== label);
    renderCategories();
    showToast('Category removed');
  } else {
    showToast('Failed to remove category', 'error');
  }
}