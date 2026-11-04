/**
 * music/js/history.js
 * Renders the song history tab. History is fetched from the backend
 * and also maintained locally in-session.
 */

import { el, escapeHtml, formatTime } from './utils.js';

const SESSION_HISTORY = []; // [{title, author, thumbnail, duration, playedAt}]
const MAX_HISTORY = 50;

/** Push a track into in-session history */
export function addToHistory(track) {
  if (!track) return;
  // Don't duplicate consecutive plays of the same track
  if (SESSION_HISTORY[0]?.title === track.title) return;
  SESSION_HISTORY.unshift({ ...track, playedAt: Date.now() });
  if (SESSION_HISTORY.length > MAX_HISTORY) SESSION_HISTORY.pop();
}

/** Render the history tab from the in-session list */
export function renderHistory() {
  const list = el('historyList');
  if (!list) return;

  if (!SESSION_HISTORY.length) {
    list.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
        <svg class="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-xs font-semibold tracking-wide">No history yet this session</p>
      </div>`;
    return;
  }

  list.innerHTML = SESSION_HISTORY.map((t, i) => {
    const ago = timeAgo(t.playedAt);
    return `
      <div class="group flex items-center gap-3 p-2.5 rounded-xl border border-transparent
                  hover:border-white/5 hover:bg-white/[0.04] transition-all">
        <span class="text-gray-700 font-mono text-xs w-5 text-center flex-shrink-0">${i + 1}</span>
        <img
          src="${escapeHtml(t.thumbnail || '')}"
          class="w-9 h-9 rounded-lg object-cover shadow bg-black/20 flex-shrink-0"
          onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
        >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-200 truncate group-hover:text-white">${escapeHtml(t.title)}</p>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(t.author)}</p>
        </div>
        <div class="text-right flex-shrink-0 space-y-0.5">
          <p class="text-xs text-gray-500 font-mono">${formatTime(t.duration)}</p>
          <p class="text-[10px] text-gray-700">${ago}</p>
        </div>
      </div>`;
  }).join('');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}