/**
 * music/js/main.js
 * Entry point — imports all modules, exposes globals for HTML inline handlers,
 * boots the player on DOMContentLoaded.
 */

import { guildId, showToast }                           from './musicjs/utils.js';
import { sendControl, sendVolume, sendPlay, sendAutoplay } from './musicjs/api.js';
import { switchTab, activeTab }                         from './musicjs/tabs.js';
import { renderFilters, toggleFilter, clearFilters }    from './musicjs/filters.js';
import { removeFromQueue }                              from './musicjs/queue.js';
import { fetchLyrics }                                  from './musicjs/lyrics.js';
import { renderHistory }                                from './musicjs/history.js';
import {
  startPolling, initProgressBar,
  initVolumeSlider, initKeyboardShortcuts, toggleMute,
} from './musicjs/player.js';

// ── Expose to window (needed by HTML inline onclick/onchange) ──

Object.assign(window, {
  switchTab,
  toggleFilter,
  clearFilters,
  removeFromQueue,
  toggleMute,
  control,
  setVolume,
  toggle247,
  toggleAutoplay,
  playFromUrl,
});

// ── Actions ────────────────────────────────────────────────────

async function control(action) {
  try {
    await sendControl(action);
  } catch {
    showToast('Command failed', 'error');
  }
}

async function setVolume(val) {
  try { await sendVolume(val); } catch { /* slider debounces anyway */ }
}

async function toggle247() {
  const active = document.getElementById('toggle-247')?.checked;
  await control(active ? 'enable247' : 'disable247');
}

async function toggleAutoplay() {
  const enabled = document.getElementById('toggle-autoplay')?.checked;
  try {
    await sendAutoplay(enabled);
    showToast(`Autoplay ${enabled ? 'enabled' : 'disabled'}`, 'info');
  } catch {
    showToast('Autoplay toggle failed', 'error');
  }
}

async function playFromUrl() {
  const input = document.getElementById('playUrlInput');
  const query = input?.value.trim();
  if (!query) { showToast('Enter a song name or URL', 'warn'); return; }
  try {
    await sendPlay(query);
    if (input) input.value = '';
    showToast('Added to queue 🎶', 'success');
  } catch {
    showToast('Failed to play — are you in a voice channel?', 'error');
  }
}

// ── Tab change hook (lazy-load history / lyrics) ──────────────

const _origSwitch = switchTab;
window.switchTab = function(name) {
  _origSwitch(name);
  if (name === 'history') renderHistory();
  if (name === 'lyrics') {
    const title  = document.getElementById('trackTitle')?.textContent;
    const author = document.getElementById('trackAuthor')?.textContent?.replace(/^●\s*/, '').trim();
    if (title && title !== 'Loading...') fetchLyrics(title, author);
  }
};

// ── Boot ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderFilters();
  initProgressBar();
  initVolumeSlider();
  initKeyboardShortcuts();
  startPolling();

  // Keyboard shortcut hint
  const hint = document.getElementById('shortcutHint');
  if (hint) {
    hint.innerHTML = `
      <kbd>Space</kbd> Play/Pause &nbsp;
      <kbd>←</kbd><kbd>→</kbd> Seek &nbsp;
      <kbd>↑</kbd><kbd>↓</kbd> Volume &nbsp;
      <kbd>M</kbd> Mute &nbsp;
      <kbd>N</kbd> Skip &nbsp;
      <kbd>L</kbd> Loop
    `;
  }
});