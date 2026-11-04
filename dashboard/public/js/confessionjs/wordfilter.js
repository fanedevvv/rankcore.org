// ─── Word Filter ──────────────────────────────────────────────────────────────

import { showToast } from './toast.js';

export let localWords = [];

export function setWords(words) { localWords = words; }

export function renderWordList() {
  const el = document.getElementById('wordList');
  document.getElementById('wordCount').textContent = `${localWords.length} words`;
  if (!localWords.length) { el.innerHTML = `<p class="text-xs text-gray-600 italic">No blocked words yet.</p>`; return; }
  el.innerHTML = localWords.map(w => `
    <span class="chip">${w}
      <span class="chip-remove" onclick="removeWord('${w.replace(/'/g,"\\'")}')">✕</span>
    </span>`).join('');
}

export async function addWords(guildId) {
  const raw   = document.getElementById('newWords').value;
  const words = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return showToast('Enter at least one word', 'error');
  const res = await fetch(`/api/guild/${guildId}/confession/filter/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }),
  });
  if (res.ok) {
    const data = await res.json();
    localWords = data.blockedWords || [...localWords, ...words.filter(w => !localWords.includes(w))];
    renderWordList();
    document.getElementById('newWords').value = '';
    showToast(`Added ${words.length} word(s)`);
  } else showToast('Failed to add words', 'error');
}

export async function removeWord(guildId, word) {
  const res = await fetch(`/api/guild/${guildId}/confession/filter/${encodeURIComponent(word)}`, { method: 'DELETE' });
  if (res.ok) { localWords = localWords.filter(w => w !== word); renderWordList(); showToast('Word removed'); }
  else showToast('Failed', 'error');
}