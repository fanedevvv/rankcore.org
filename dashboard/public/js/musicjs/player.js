/**
 * music/js/player.js
 * Core player UI: status polling, track rendering, progress bar,
 * mini now-playing bar, loop label, and keyboard shortcuts.
 */

import { el, formatTime, showToast, guildId } from './utils.js';
import { fetchStatus, sendControl, sendVolume, sendSeek } from './api.js';
import { syncActiveFilters }  from './filters.js';
import { renderQueue }        from './queue.js';
import { fetchLyrics, updateLyricsPosition, resetLyrics} from './lyrics.js';
import { addToHistory as historyAdd, renderHistory } from './history.js';
import { activeTab }          from './tabs.js';

let _currentTrackTitle = '';
let _seeking = false;
let _pollInterval = null;
const POLL_MS = 2000;

// ── Public API ─────────────────────────────────────────────────

export function startPolling() {
  poll();
  _pollInterval = setInterval(poll, POLL_MS);
}

export function stopPolling() {
  clearInterval(_pollInterval);
}

// ── Polling ────────────────────────────────────────────────────

async function poll() {
  try {
    const data = await fetchStatus();
    renderState(data);
  } catch (err) {
    console.warn('[Music] poll failed:', err);
  }
}

// ── Full state render ──────────────────────────────────────────

function renderState(data) {
  const noPlayer = el('noPlayer');
  const playerUI = el('playerUI');
  const miniBar  = el('miniBar');

  if (!data.playing) {
    noPlayer?.classList.remove('hidden');
    noPlayer?.classList.add('flex');
    playerUI?.classList.add('hidden');
    miniBar?.classList.add('hidden');
    return;
  }

  noPlayer?.classList.add('hidden');
  noPlayer?.classList.remove('flex');
  playerUI?.classList.remove('hidden');
  miniBar?.classList.remove('hidden');

  const track = data.track;

  // ── Track change ──
  if (_currentTrackTitle !== track.title) {
    _currentTrackTitle = track.title;

    // Add previous track to history before switching
    if (_currentTrackTitle) historyAdd(track);

    // Reset lyrics if tab not open; re-fetch if it is
    if (activeTab() === 'lyrics') {
      fetchLyrics(track.title, track.author);
    } else {
      resetLyrics();
    }
  }

  // ── Meta ──
  el('trackTitle').textContent  = track.title;
  el('trackTitle').title        = track.title;
  el('trackAuthor').innerHTML   = `<span class="w-1.5 h-1.5 rounded-full bg-razor inline-block"></span> ${track.author}`;
  el('trackArt').src            = track.thumbnail || 'https://cdn.discordapp.com/embed/avatars/0.png';
  el('bgBlur').style.backgroundImage = `url(${track.thumbnail})`;

  // ── Mini bar ──
  if (el('miniTitle'))    el('miniTitle').textContent  = track.title;
  if (el('miniAuthor'))   el('miniAuthor').textContent = track.author;
  if (el('miniArt'))      el('miniArt').src            = track.thumbnail || '';

  // ── Play/Pause ──
  const playIcon  = el('playIcon');
  const pauseIcon = el('pauseIcon');
  if (data.paused) {
    playIcon?.classList.remove('hidden');
    pauseIcon?.classList.add('hidden');
    el('miniPlayIcon')?.classList.remove('hidden');
    el('miniPauseIcon')?.classList.add('hidden');
  } else {
    playIcon?.classList.add('hidden');
    pauseIcon?.classList.remove('hidden');
    el('miniPlayIcon')?.classList.add('hidden');
    el('miniPauseIcon')?.classList.remove('hidden');
  }

  // ── Loop label ──
  renderLoopState(data.loop);

  // ── Progress (only when not scrubbing) ──
  if (!_seeking) {
    const pct = track.duration ? (data.position / track.duration) * 100 : 0;
    const bar = el('progressBar');
    if (bar) {
      bar.value = pct;
      bar.style.background = `linear-gradient(to right, #6C53FF ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
      bar.dataset.ms = track.duration;
    }
    el('currentTime').textContent = formatTime(data.position);
    el('totalTime').textContent   = formatTime(track.duration);
    el('totalTime').dataset.ms    = track.duration;

    // Mini bar progress
    const miniPct = el('miniProgress');
    if (miniPct) {
      miniPct.style.width = `${pct}%`;
    }

    // Synced lyrics
    if (activeTab() === 'lyrics') {
      updateLyricsPosition(data.position);
    }
  }

  // ── Volume ──
  const volSlider = el('volumeSlider');
  if (volSlider && !volSlider.matches(':active')) {
    volSlider.value = data.volume;
    el('volumeValue').textContent = `${data.volume}%`;
    volSlider.style.background = `linear-gradient(to right, #fff ${data.volume}%, rgba(255,255,255,0.08) ${data.volume}%)`;
  }

  // ── 24/7 & Autoplay ──
  const tog247    = el('toggle-247');
  const togAuto   = el('toggle-autoplay');
  if (tog247  && !tog247.matches(':focus'))   tog247.checked  = data.is247     ?? false;
  if (togAuto && !togAuto.matches(':focus'))  togAuto.checked = data.autoplay  ?? false;

  // ── Queue ──
  renderQueue(data.queue || []);

  // ── Filters ──
  syncActiveFilters(data.filters || []);

  // ── History tab ──
  if (activeTab() === 'history') renderHistory();
}

function renderLoopState(loop) {
  const btn   = el('loopBtn');
  const label = el('loopLabel');
  const ind   = el('loopIndicator');
  if (!btn) return;

  const LOOP_LABELS = { none: '', track: 'Track', queue: 'Queue' };
  const text = LOOP_LABELS[loop] || '';

  if (loop !== 'none') {
    btn.classList.add('text-razor', 'bg-razor/10');
    btn.classList.remove('text-gray-500');
    ind?.classList.remove('hidden');
  } else {
    btn.classList.remove('text-razor', 'bg-razor/10');
    btn.classList.add('text-gray-500');
    ind?.classList.add('hidden');
  }
  if (label) label.textContent = text;
}

// ── Progress bar seeking ───────────────────────────────────────

export function initProgressBar() {
  const bar = el('progressBar');
  if (!bar) return;

  bar.addEventListener('mousedown', () => { _seeking = true; });
  bar.addEventListener('touchstart', () => { _seeking = true; }, { passive: true });

  bar.addEventListener('mouseup',  sendSeekFromBar);
  bar.addEventListener('touchend', sendSeekFromBar);

  bar.addEventListener('input', e => {
    const pct   = Number(e.target.value);
    const total = Number(e.target.dataset.ms);
    if (!total) return;
    el('currentTime').textContent = formatTime((pct / 100) * total);
    e.target.style.background = `linear-gradient(to right, #6C53FF ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
  });
}

async function sendSeekFromBar() {
  _seeking = false;
  const bar   = el('progressBar');
  const total = Number(bar?.dataset.ms);
  if (!bar || !total) return;
  const ms = Math.floor((Number(bar.value) / 100) * total);
  try { await sendSeek(ms); } catch { showToast('Seek failed', 'error'); }
}

// ── Volume slider ──────────────────────────────────────────────

export function initVolumeSlider() {
  const slider = el('volumeSlider');
  if (!slider) return;
  let debounce;
  slider.addEventListener('input', e => {
    const v = e.target.value;
    el('volumeValue').textContent = `${v}%`;
    slider.style.background = `linear-gradient(to right, #fff ${v}%, rgba(255,255,255,0.08) ${v}%)`;
    clearTimeout(debounce);
    debounce = setTimeout(() => sendVolume(v).catch(() => {}), 120);
  });
}

// ── Keyboard shortcuts ─────────────────────────────────────────

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Don't hijack when user types in an input
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        sendControl('pause').catch(() => {});
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekRelative(+10000);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekRelative(-10000);
        break;
      case 'ArrowUp':
        e.preventDefault();
        nudgeVolume(+5);
        break;
      case 'ArrowDown':
        e.preventDefault();
        nudgeVolume(-5);
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'KeyN':
        sendControl('skip').catch(() => {});
        break;
      case 'KeyL':
        sendControl('loop').catch(() => {});
        break;
    }
  });
}

async function seekRelative(deltaMs) {
  const bar   = el('progressBar');
  const total = Number(bar?.dataset.ms || 0);
  if (!total) return;
  const cur = (Number(bar.value) / 100) * total;
  const pos = Math.max(0, Math.min(cur + deltaMs, total));
  try { await sendSeek(pos); } catch { showToast('Seek failed', 'error'); }
}

async function nudgeVolume(delta) {
  const slider = el('volumeSlider');
  if (!slider) return;
  const newVol = Math.max(0, Math.min(100, Number(slider.value) + delta));
  slider.value = newVol;
  el('volumeValue').textContent = `${newVol}%`;
  slider.style.background = `linear-gradient(to right, #fff ${newVol}%, rgba(255,255,255,0.08) ${newVol}%)`;
  try { await sendVolume(newVol); } catch { showToast('Volume failed', 'error'); }
}

export function toggleMute() {
  const slider = el('volumeSlider');
  if (!slider) return;
  if (+slider.value > 0) {
    slider.dataset.lastVol = slider.value;
    slider.value = 0;
  } else {
    slider.value = slider.dataset.lastVol || 80;
  }
  sendVolume(slider.value).catch(() => {});
  el('volumeValue').textContent = `${slider.value}%`;
  const v = slider.value;
  slider.style.background = `linear-gradient(to right, #fff ${v}%, rgba(255,255,255,0.08) ${v}%)`;
}