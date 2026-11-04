/**
 * jtc/api.js
 * All HTTP calls to the backend API.
 * Returns parsed JSON or throws on non-OK responses.
 */

import { guildId } from './utils.js';

const BASE = `/api/guild/${guildId}`;

/**
 * Fetch all data required to initialise the page in one parallel batch.
 * @returns {{ categories, channels, roles, config }}
 */
export async function fetchInitialData() {
  const safe = promise => promise.catch(() => null);

  const [categories, channels, text, roles, config] = await Promise.all([
    safe(get(`${BASE}/categories`)),
    safe(get(`${BASE}/voice-channels`)),
    safe(get(`${BASE}/channels`)),
    safe(get(`${BASE}/roles`)),
    safe(get(`${BASE}/jtc`)),
  ]);
  const textList = Array.isArray(text) ? text : (text?.channels ?? []);

  return {
    categories: Array.isArray(categories) ? categories : [],
    channels:   Array.isArray(channels)   ? channels   : [],
    textChannels: Array.isArray(textList) ? textList : [],
    roles:      Array.isArray(roles)      ? roles      : [],
    config:     config || null,
  };
}

/**
 * Save a JTC config payload.
 * @param {object} payload
 * @returns {Promise<{ success: boolean }>}
 */
export async function saveConfig(payload) {
  return post(`${BASE}/jtc`, payload);
}

/**
 * Reset (clear) the JTC config for this guild.
 * @returns {Promise<{ success: boolean }>}
 */
export async function resetConfig() {
  return post(`${BASE}/jtc`, { Guild: guildId, Channel: null, Category: null });
}

// ── Internal helpers ───────────────────────────────────────────

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

async function post(url, body) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return res.json();
}