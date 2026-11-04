// devjs/broadcast.js

import { secureFetch, showToast } from './core.js';

export async function sendBroadcast(totalGuilds) {
  const channel = document.getElementById('broadcastChannel').value.trim();
  const title   = document.getElementById('broadcastTitle').value.trim();
  const content = document.getElementById('broadcastMsg').value.trim();
  const color   = document.getElementById('broadcastColor').value;
  if (!content) return showToast('Message content required', true);
  if (!confirm(`Send broadcast to all ${totalGuilds} guilds?`)) return;
  const res = await secureFetch('/api-dev/broadcast', {
    method: 'POST',
    body: JSON.stringify({ channel, title, content, color }),
  }).then(r => r.json());
  if (res.error) return showToast(res.error, true);
  showToast(`Broadcast queued — sending to ${res.queued ?? res.sent ?? '?'} guilds (1/s to avoid rate limits)`);
}