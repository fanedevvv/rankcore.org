/**
 * RANKCORE Dashboard — Guild Hydration Middleware (standalone mode only)
 *
 * In standalone mode, req.client is a BotClientShim. The shim's guild objects
 * start with empty caches. This middleware intercepts any request that has a
 * :id param that looks like a guild ID and pre-fetches channels + roles from
 * the internal bot API so that routes can call:
 *
 *   guild.channels.cache.get(channelId)
 *   guild.channels.cache.filter(c => c.type === ...)
 *   guild.roles.cache.sort(...)
 *   guild.members.cache (limited)
 *
 * without any changes to existing route code.
 */

'use strict';

module.exports = async function hydrateGuild(req, res, next) {
  // Only active in standalone mode
  if (!req.client?.isStandaloneMode) return next();

  // Extract guild ID from common route patterns.
  // req.params is NOT populated at app.use() level (before route matching),
  // so we parse the path directly to cover both /guild/:id and /api/guild/:id.
  const guildId =
    req.params.id ||
    req.params.guildId ||
    (req.path.match(/\/guild\/(\d{17,20})/) || [])[1];
  if (!guildId || !/^\d{17,20}$/.test(guildId)) return next();

  try {
    await req.client.hydrateGuild(guildId);
  } catch {
    // If the bot is offline or the guild isn't found, let the route handle it
  }
  next();
};