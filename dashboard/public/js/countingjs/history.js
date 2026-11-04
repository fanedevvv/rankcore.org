// countingjs/history.js

let _guildId = '';

export function initHistory(guildId) {
  _guildId = guildId;
}

export async function loadHistory() {
  const container = document.getElementById('historyContent');
  if (!container) return;
  container.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>';

  try {
    const res  = await fetch(`/api/guild/${_guildId}/count/history`);
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = '<p class="text-gray-400 text-sm">No resets recorded yet.</p>';
      return;
    }

    container.innerHTML = data
      .map(
        (h, i) => `
        <div class="history-row">
          <span class="text-red-400 font-bold text-sm mt-0.5">#${i + 1}</span>
          <div class="flex-1">
            <div class="text-sm text-gray-200">
              <span class="font-semibold">${esc(h.username || h.user)}</span>
              reset at count <span class="text-razor font-bold">${h.count}</span>
            </div>
            <div class="text-xs text-gray-500 mt-0.5">${esc(h.reason)}</div>
            <div class="text-xs text-gray-600 mt-0.5">${new Date(h.date).toLocaleString()}</div>
          </div>
        </div>`
      )
      .join('');
  } catch (err) {
    console.error('History load failed:', err);
    container.innerHTML = '<p class="text-red-400 text-sm">Failed to load history.</p>';
  }
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}