/**
 * music/js/api.js
 * All HTTP calls to the music backend.
 */

import { guildId } from './utils.js';

const BASE = `/api/guild/${guildId}/music`;

async function post(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export const fetchStatus   = ()         => fetch(BASE).then(r => r.json());
export const fetchHistory  = ()         => fetch(`${BASE}/history`).then(r => r.json()).catch(() => []);
export const sendControl   = action     => post(`${BASE}/control`, { action });
export const sendVolume    = volume     => post(`${BASE}/volume`, { volume });
export const sendSeek      = position   => post(`${BASE}/seek`, { position });
export const sendFilter    = filter     => post(`${BASE}/filter`, { filter });
export const sendPlay      = query      => post(`${BASE}/play`, { query });
export const sendReorder   = queue      => post(`${BASE}/queue/reorder`, { queue });
export const sendRemove    = index      => post(`${BASE}/queue/remove`, { index });
export const sendAutoplay  = enabled    => post(`${BASE}/autoplay`, { enabled });