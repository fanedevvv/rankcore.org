// devjs/guilds.js

import { secureFetch, escapeHtml, showToast } from './core.js';
import { paginate, renderPag, PAGE_SIZE }      from './pagination.js';

export let allBotServers = [];
let serverPage = 1;

export function displayBotServers() {
  const items = paginate(allBotServers, serverPage);

  // Patch the thead to include an ID column if it hasn't been already
  const thead = document.querySelector('#botServers')?.closest('table')?.querySelector('thead tr');
  if (thead && thead.children.length === 2) {
    const idTh = document.createElement('th');
    idTh.textContent = 'Guild ID';
    idTh.style.cssText = 'font-family:var(--mono,monospace);color:var(--muted)';
    thead.insertBefore(idTh, thead.children[1]);
  }

  document.getElementById('botServers').innerHTML = items.map(s => `
    <tr>
      <td style="font-weight:700;color:#fff;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.name)}</td>
      <td style="font-family:var(--mono,monospace);font-size:0.72rem;color:var(--muted);white-space:nowrap">${escapeHtml(s.id)}</td>
      <td style="text-align:right"><button onclick="leaveServer('${s.id}')" class="btn btn-red sm">Leave</button></td>
    </tr>`).join('');
  renderPag('guildPagination', serverPage, allBotServers.length, 'changeServerPage');
  document.getElementById('botCount').textContent   = allBotServers.length;
  document.getElementById('totalGuilds').textContent = allBotServers.length;
}

export function changeServerPage(p) {
  serverPage = p;
  displayBotServers();
}

export async function loadBotServers() {
  try {
    allBotServers = await secureFetch('/api-dev/botservers').then(r => r.json());
    displayBotServers();
  } catch {}
}

export async function leaveServer(serverId) {
  if (!confirm('Leave this guild?')) return;
  await secureFetch('/api-dev/botservers/leave', { method: 'POST', body: JSON.stringify({ serverId }) });
  showToast('Left guild');
  loadBotServers();
}