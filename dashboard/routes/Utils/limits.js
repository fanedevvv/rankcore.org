'use strict';
/**
 * Centralised per-feature limits — TIER-AWARE.
 *
 * Uses the premiumTiers utility as the single source of truth.
 * All route code that previously called getLimits() continues to work.
 *
 * Import:
 *   const { getLimits, limitError } = require('../Utils/limits');
 *   const lim = await getLimits(req.user?.id, guildId);
 *   if (count >= lim.autoresponders) return res.status(400).json({ error: limitError(lim, 'autoresponders') });
 */

const PremiumGuild = require('../../../Schemas/premiumGuildSchema');
const { tierFromDoc, getLimit, TIER_ORDER, getTier } = require('../../../Utils/premiumTiers');

// Legacy PREMIUM_CAP kept for backwards compatibility
const PREMIUM_CAP = 1500;

/**
 * Resolve the effective tier for a guild.
 * Premium is guild-scoped — user-level premium has been removed.
 */
async function getEffectiveTier(_userId, guildId) {
  try {
    const guildDoc = guildId ? await PremiumGuild.findOne({ id: guildId }).lean() : null;
    return tierFromDoc(guildDoc);
  } catch {
    return 'free';
  }
}

/**
 * Returns a limits object shaped like the old FREE/PREMIUM objects,
 * but now with accurate per-tier values from premiumTiers.js.
 * Includes `tier`, `tierName`, `isPremium` for backwards compat.
 */
async function getLimits(userId, guildId) {
  const tier    = await getEffectiveTier(userId, guildId);
  const tierCfg = getTier(tier);

  const lim = val => val === Infinity ? PREMIUM_CAP : val;

  return {
    // Core limits
    autoresponders:   lim(getLimit(tier, 'autoresponders')),
    autoroles:        lim(getLimit(tier, 'reactionRoles')),   // reuse reactionRoles cap
    stickyMessages:   lim(getLimit(tier, 'stickyMessages')),
    reactionRoles:    lim(getLimit(tier, 'reactionRoles')),
    levelRewards:     tier === 'free' ? 15 : PREMIUM_CAP,
    ticketCategories: lim(getLimit(tier, 'ticketCategories')),
    ticketBlacklist:  tier === 'free' ? 20 : PREMIUM_CAP,
    ticketTags:       tier === 'free' ? 10 : PREMIUM_CAP,
    dashboardRoles:   tier === 'free' ? 15 : PREMIUM_CAP,
    activeGiveaways:  tier === 'free' ? 10 : PREMIUM_CAP,
    savedEmbeds:      lim(getLimit(tier, 'embedTemplates')),
    youtubeFeeds:     lim(getLimit(tier, 'youtubeNotifs')),
    twitchFeeds:      lim(getLimit(tier, 'twitchNotifs')),
    customCommands:   lim(getLimit(tier, 'customCommands')),
    playlists:        lim(getLimit(tier, 'playlists')),
    playlistSize:     lim(getLimit(tier, 'playlistSize')),
    backups:          lim(getLimit(tier, 'backups')),

    // Meta
    tier,
    tierName:   tierCfg.name,
    tierEmoji:  tierCfg.emoji,
    isPremium:  tier !== 'free',
  };
}

/**
 * Returns a human-readable limit-hit error message.
 */
function limitError(lim, featureName) {
  const feat = featureName ? ` for ${featureName}` : '';
  if (lim.tier === 'free') {
    return `Limit reached${feat}. Use \`/premium plans\` or visit /premium to upgrade.`;
  }
  const next = TIER_ORDER[TIER_ORDER.indexOf(lim.tier) + 1];
  if (next) {
    const nextCfg = getTier(next);
    return `Limit reached${feat} on ${lim.tierName}. Upgrade to ${nextCfg.emoji} ${nextCfg.name} for higher limits.`;
  }
  return `Limit reached${feat} (${PREMIUM_CAP} max).`;
}

module.exports = { getLimits, limitError, PREMIUM_CAP, getEffectiveTier };