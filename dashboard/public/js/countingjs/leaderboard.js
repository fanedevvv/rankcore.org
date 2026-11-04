// countingjs/leaderboard.js

let _guildId = '';

export function initLeaderboard(guildId) {
  _guildId = guildId;
}

export async function loadLeaderboard() {
  const container = document.getElementById('lbContent');
  if (!container) return;
  container.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>';

  try {
    const res  = await fetch(`/api/guild/${_guildId}/count/leaderboard`);
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = '<p class="text-gray-400 text-sm">No data yet.</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = data
      .map(
        (entry, i) => `
        <div class="lb-row">
          <div class="flex items-center gap-3">
            <span class="text-lg">${medals[i] || `#${i + 1}`}</span>
            <span class="text-sm text-gray-200 font-mono">&lt;@${esc(entry.userId)}&gt;</span>
          </div>
          <span class="badge">${entry.count} counts</span>
        </div>`
      )
      .join('');
  } catch (err) {
    console.error('Leaderboard load failed:', err);
    container.innerHTML = '<p class="text-red-400 text-sm">Failed to load leaderboard.</p>';
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