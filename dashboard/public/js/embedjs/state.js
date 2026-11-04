// ─── Shared State & Helpers ───────────────────────────────────────────────────

export let currentMode   = 'embed';
export let savedMessages = [];
export let editingId     = null;

export function setCurrentMode(m)      { currentMode   = m; }
export function setSavedMessages(arr)  { savedMessages = arr; }
export function setEditingId(id)       { editingId     = id; }

export function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

export function parseMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,      '<em>$1</em>')
    .replace(/`(.+?)`/g,        '<code class="bg-black/30 px-1 rounded text-xs">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-400 underline" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

export function showToast(msg, type = 'success') {
  // Delegate to the global helper in embed.html (has correct typed background classes)
  if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
  // Minimal fallback
  const t = document.getElementById('toast');
  const m = document.getElementById('toastMsg');
  if (!t || !m) return;
  m.textContent = msg;
  t.className = '';
  t.classList.add(type === 'error' ? 't-error' : type === 'info' ? 't-info' : 't-success', 'show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

export async function loadChannels(guildId) {
  try {
    const res  = await fetch(`/api/guild/${guildId}/channels`);
    const data = await res.json();
    const sel  = document.getElementById('channel');
    if (!sel) return;
    window.rzrPopulateChannels(sel, data, null);
  } catch {
    const sel = document.getElementById('channel');
    if (sel) sel.innerHTML = '<option value="">Failed to load</option>';
  }
}