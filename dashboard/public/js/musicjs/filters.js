/**
 * music/js/filters.js
 * Filter list definition, grid rendering, toggle, and clear.
 */

import { el, showToast }  from './utils.js';
import { sendFilter, sendControl } from './api.js';

export const FILTERS = [
  { id: 'eightD',     label: '8D',          icon: '🎧' },
  { id: 'nightcore',  label: 'Nightcore',   icon: '🌙' },
  { id: 'soft',       label: 'Soft',        icon: '🌸' },
  { id: 'vaporwave',  label: 'Vaporwave',   icon: '🌊' },
  { id: 'bass',       label: 'Bass Boost',  icon: '🔉' },
  { id: 'tremolo',    label: 'Tremolo',     icon: '〰️' },
  { id: 'vibrato',    label: 'Vibrato',     icon: '🎵' },
  { id: 'doubletime', label: 'Doubletime',  icon: '⚡' },
  { id: 'slow',       label: 'Slow',        icon: '🐢' },
  { id: 'nightcore',  label: 'Nightcore',   icon: '🌙' },
  { id: 'pop',        label: 'Pop',         icon: '🎤' },
  { id: 'party',      label: 'Party',       icon: '🥳' },
  { id: 'daycore',    label: 'Daycore',     icon: '☀️' },
  { id: 'karaoke',    label: 'Karaoke',     icon: '🎙️' },
  { id: 'electronic', label: 'Electronic',  icon: '🤖' },
  { id: 'radio',      label: 'Radio',       icon: '📻' },
  { id: 'china',      label: 'China',       icon: '🀄' },
  { id: 'darthvader', label: 'Darth Vader', icon: '🌑' },
].filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i); // dedupe

export function renderFilters() {
  const grid = el('filterGrid');
  if (!grid) return;
  grid.innerHTML = FILTERS.map(f => `
    <button
      id="filter-${f.id}"
      onclick="window.toggleFilter('${f.id}')"
      class="filter-btn px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02]
             text-xs font-bold text-gray-400 hover:bg-white/10 hover:text-white
             tracking-wide flex items-center gap-1.5 transition-all"
    >
      <span>${f.icon}</span>
      <span>${f.label}</span>
    </button>
  `).join('');
}

/** Apply active class from the API response's filter list */
export function syncActiveFilters(activeFilters = []) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  activeFilters.forEach(f => el(`filter-${f}`)?.classList.add('active'));
}

export async function toggleFilter(filterId) {
  const btn = el(`filter-${filterId}`);
  if (!btn) return;
  const wasActive = btn.classList.contains('active');
  try {
    if (wasActive) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      await sendControl('clearFilters');
      showToast('Filters cleared', 'info');
    } else {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await sendFilter(filterId);
      showToast(`${filterId} filter applied`, 'success');
    }
  } catch {
    showToast('Filter failed', 'error');
  }
}

export async function clearFilters() {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  try {
    await sendControl('clearFilters');
    showToast('All filters cleared', 'info');
  } catch {
    showToast('Failed to clear filters', 'error');
  }
}