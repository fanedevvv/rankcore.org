// devjs/traffic.js

import { secureFetch, escapeHtml } from './core.js';
import { paginate, renderPag }     from './pagination.js';

let allIpLogs = [];
let ipPage    = 1;

const METHOD_COLOR = {
  GET: '#57f287', POST: '#5865F2', DELETE: '#ed4245', PUT: '#faa61a', PATCH: '#00b0f4',
};

export function displayIpLogs() {
  const items = paginate(allIpLogs, ipPage);
  document.getElementById('ipRequests').innerHTML = items.map(l => `
    <tr>
      <td style="font-weight:700;color:#fff;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.username || l.ip || '?')}</td>
      <td><span style="font-size:0.68rem;font-weight:800;color:${METHOD_COLOR[l.method] || '#b9bbbe'}">${escapeHtml(l.method || 'GET')}</span></td>
      <td style="color:var(--text2);font-family:'JetBrains Mono',monospace;font-size:0.75rem">${escapeHtml(l.path || '')}</td>
      <td style="text-align:right;color:var(--muted);font-size:0.72rem">${new Date(l.timestamp).toLocaleTimeString()}</td>
    </tr>`).join('') ||
    '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted);font-size:0.78rem">No traffic data</td></tr>';
  renderPag('ipPagination', ipPage, allIpLogs.length, 'changeIpPage');
}

export function changeIpPage(p) {
  ipPage = p;
  displayIpLogs();
}

export async function loadIPRequests() {
  try {
    allIpLogs = await secureFetch('/api-dev/requests').then(r => r.json());
    displayIpLogs();
  } catch {}
}