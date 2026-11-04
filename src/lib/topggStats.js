'use strict';

/**
 * Posts the real server count to top.gg so the listing stays accurate.
 * Needs TOP_GG_TOKEN in .env (top.gg → Edit bot → Integrations & API → Token).
 * Runs on startup and every 30 minutes; does nothing without a token.
 */

const INTERVAL_MS = 30 * 60 * 1000;

async function postStats(client) {
  const token = process.env.TOP_GG_TOKEN;
  if (!token || !client.isReady()) return;
  try {
    const res = await fetch(`https://top.gg/api/bots/${client.user.id}/stats`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server_count: client.guilds.cache.size,
        shard_count:  client.ws.shards.size || 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) console.log(`[top.gg] Posted server count: ${client.guilds.cache.size}`);
    else console.warn(`[top.gg] Stats post failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.warn('[top.gg] Stats post error:', err.message);
  }
}

module.exports = function startTopggStats(client) {
  if (!process.env.TOP_GG_TOKEN) {
    console.log('[top.gg] TOP_GG_TOKEN not set — server count is not posted to top.gg.');
    return;
  }
  // Short delay so the guild cache is fully populated after login
  setTimeout(() => postStats(client), 30_000);
  setInterval(() => postStats(client), INTERVAL_MS);
};

module.exports.postStats = postStats;
