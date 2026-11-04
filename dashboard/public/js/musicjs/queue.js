/**
 * music/js/queue.js
 * Queue rendering with drag-to-reorder and per-track remove button.
 */

import { el, escapeHtml, formatTime, showToast } from './utils.js';
import { sendReorder, sendRemove }                from './api.js';

let _queue = [];

export function renderQueue(queue) {
  _queue = queue || [];
  const list  = el('queueList');
  const count = el('queueCount');
  if (!list) return;

  count && (count.textContent = `${_queue.length} song${_queue.length !== 1 ? 's' : ''}`);

  if (!_queue.length) {
    list.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
        <svg class="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
        <p class="text-xs font-semibold tracking-wide">Queue is empty</p>
      </div>`;
    return;
  }

  list.innerHTML = _queue.map((t, i) => `
    <div
      class="queue-item group flex items-center gap-3 p-2.5 rounded-xl
             border border-transparent hover:border-white/5 hover:bg-white/[0.04]
             transition-all cursor-grab active:cursor-grabbing select-none"
      draggable="true"
      data-index="${i}"
    >
      <div class="text-gray-600 hover:text-razor transition-colors flex-shrink-0 cursor-grab" title="Drag to reorder">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
        </svg>
      </div>
      <span class="text-gray-600 font-mono text-xs w-5 text-center group-hover:text-razor font-bold transition-colors flex-shrink-0">${i + 1}</span>
      <img
        src="${escapeHtml(t.thumbnail || '')}"
        class="w-9 h-9 rounded-lg object-cover shadow bg-black/20 flex-shrink-0"
        onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
      >
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-200 truncate group-hover:text-white">${escapeHtml(t.title)}</p>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(t.author)}</p>
      </div>
      <span class="text-xs text-gray-500 font-mono bg-black/20 px-2 py-1 rounded border border-white/5 flex-shrink-0">${formatTime(t.duration)}</span>
      <button
        onclick="window.removeFromQueue(${i})"
        class="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all flex-shrink-0 p-1 rounded-lg hover:bg-red-500/10"
        title="Remove from queue"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  initDragDrop(list);
}

export async function removeFromQueue(index) {
  try {
    await sendRemove(index);
    showToast('Track removed', 'info');
    // Optimistic update
    _queue.splice(index, 1);
    renderQueue(_queue);
  } catch {
    showToast('Failed to remove track', 'error');
  }
}

// ── Drag-to-reorder ────────────────────────────────────────────

function initDragDrop(list) {
  let dragSrc = null;

  list.querySelectorAll('.queue-item').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.4';
    });

    row.addEventListener('dragend', () => {
      row.style.opacity = '';
      list.querySelectorAll('.queue-item').forEach(r => r.classList.remove('drag-over'));
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (row !== dragSrc) {
        list.querySelectorAll('.queue-item').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      }
    });

    row.addEventListener('drop', async e => {
      e.preventDefault();
      if (dragSrc === row) return;

      const srcIdx  = parseInt(dragSrc.dataset.index);
      const destIdx = parseInt(row.dataset.index);

      // Reorder local copy
      const moved = _queue.splice(srcIdx, 1)[0];
      _queue.splice(destIdx, 0, moved);
      renderQueue(_queue);

      try {
        await sendReorder(_queue.map((_, i) => i));
        showToast('Queue reordered', 'success');
      } catch {
        showToast('Reorder failed — refreshing', 'error');
      }
    });
  });
}