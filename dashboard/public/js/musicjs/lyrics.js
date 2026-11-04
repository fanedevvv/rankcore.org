/**
 * music/js/lyrics.js
 * Fetches lyrics from LRCLIB and renders them.
 * Supports synced (LRC) highlighting when position is known.
 */

import { el, showToast } from './utils.js';

let _syncedLines = [];   // [{ time: ms, text: string }]
let _plainLyrics = '';
let _lastTrack   = '';

/** Main entry — call when track changes or lyrics tab opens */
export async function fetchLyrics(title, artist) {
  if (!title) return;
  const container = el('lyricsContainer');
  if (!container) return;

  // Cache hit
  if (_lastTrack === `${title}||${artist}` && _plainLyrics) {
    renderPlain(_plainLyrics);
    return;
  }

  _lastTrack   = `${title}||${artist}`;
  _syncedLines = [];
  _plainLyrics = '';
  container.innerHTML = '<p class="text-gray-500 mt-20 animate-pulse text-sm">Searching LRCLIB…</p>';

  try {
    const clean = title.replace(/\([^)]*\)|\[[^\]]*\]|ft\.|feat\.|official video|lyrics|audio/gi, '').trim();
    const res   = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(clean)}`
    );

    if (!res.ok) throw new Error('not found');
    const data = await res.json();

    if (data.syncedLyrics) {
      _syncedLines = parseLRC(data.syncedLyrics);
      renderSynced();
    } else if (data.plainLyrics) {
      _plainLyrics = data.plainLyrics;
      renderPlain(data.plainLyrics);
    } else {
      throw new Error('empty');
    }
  } catch {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-gray-600 gap-3 pt-20">
        <svg class="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
        <p class="text-sm font-semibold">Lyrics unavailable</p>
        <p class="text-xs text-gray-700">Not found on LRCLIB</p>
      </div>`;
  }
}

/** Highlight the current synced lyric line based on playback position (ms) */
export function updateLyricsPosition(posMs) {
  if (!_syncedLines.length) return;
  const container = el('lyricsContainer');
  if (!container) return;

  let activeIdx = 0;
  for (let i = 0; i < _syncedLines.length; i++) {
    if (_syncedLines[i].time <= posMs) activeIdx = i;
    else break;
  }

  container.querySelectorAll('.lyric-line').forEach((line, i) => {
    if (i === activeIdx) {
      line.classList.add('active-lyric');
      line.classList.remove('inactive-lyric');
      line.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      line.classList.remove('active-lyric');
      line.classList.add('inactive-lyric');
    }
  });
}

export function resetLyrics() {
  _lastTrack   = '';
  _syncedLines = [];
  _plainLyrics = '';
  const container = el('lyricsContainer');
  if (container) container.innerHTML = '<p class="text-gray-500 mt-20 text-sm">Waiting for music…</p>';
}

// ── Private ────────────────────────────────────────────────────

function parseLRC(lrc) {
  return lrc.split('\n')
    .map(line => {
      const m = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
      if (!m) return null;
      const ms = (parseInt(m[1]) * 60 + parseFloat(m[2])) * 1000;
      return { time: ms, text: m[3].trim() };
    })
    .filter(Boolean);
}

// ── Helper ────────────────────────────────────────────────────
function escapeHtml(s) {
  return s
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ── Private ────────────────────────────────────────────────────

function renderSynced() {
  const container = el('lyricsContainer');
  if (!container) return;

  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'text-center space-y-2 pb-32 pt-4 px-4';

  _syncedLines.forEach((line, i) => {
    const p = document.createElement('p');
    p.className = 'lyric-line inactive-lyric text-base md:text-lg font-semibold transition-all duration-300 py-1 rounded-xl cursor-default';
    p.dataset.index = i;
    p.textContent = escapeHtml(line.text || '♪'); // <-- safe!
    wrapper.appendChild(p);
  });

  container.appendChild(wrapper);
}

function renderPlain(text) {
  const container = el('lyricsContainer');
  if (!container) return;

  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'text-center text-sm md:text-base leading-relaxed text-gray-300 font-medium whitespace-pre-wrap px-4 py-4 pb-20';
  wrapper.textContent = escapeHtml(text); // <-- safe!
  container.appendChild(wrapper);
}