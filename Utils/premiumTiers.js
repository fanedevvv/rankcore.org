/**
 * premiumTiers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all RankCore premium tier definitions.
 *
 * TIER HIERARCHY:  free  <  basic  <  pro  <  elite
 *
 * Import this wherever you need to gate features:
 *   const { getTier, TIERS, meetsMinTier } = require('../../Utils/premiumTiers');
 */

// ─── Tier definitions ─────────────────────────────────────────────────────────

const TIERS = {
    free: {
        name: 'Free',
        emoji: '<:lockk:1567796977809367122>',
        color: 0x5c5c5c,
        price: { monthly: 0, yearly: 0 },
        limits: {
            // Everyone gets solid usable defaults — no artificial friction
            autoresponders:   10,
            customCommands:   10,
            ticketCategories:  2,
            reactionRoles:    20,
            logChannels:       3,
            welcomeImages:     true,
            music247:          false,
            musicFilters:      false,
            playlists:         2,
            playlistSize:     50,
            backups:           2,
            embedTemplates:   10,
            stickyMessages:    3,
            giveawayRoleMult:  false,
            antiNuke:          false,
            antiRaid:          false,
            advancedAutomod:   false,
            customBranding:    false,
            massRole:          false,
            massban:           false,
            imageGen:          false,
            aiChatbot:         false,
            virusTotal:        false,
            youtubeNotifs:     1,
            twitchNotifs:      1,
            connectionRoles:   3,
        },
    },

    basic: {
        name: 'RankCore Basic',
        emoji: '<:boost:1567796953599836280>',
        color: 0x3b82f6,
        price: { monthly: 299, yearly: 2499 },         // €2.99 / €24.99
        priceDisplay: { monthly: '€2.99', yearly: '€24.99' },
        billing: { monthly: 'monthly', yearly: 'yearly' },
        limits: {
            autoresponders:   25,
            customCommands:   25,
            ticketCategories:  5,
            reactionRoles:    40,
            logChannels:       6,
            welcomeImages:     true,
            music247:          true,
            musicFilters:      false,
            playlists:         5,
            playlistSize:     75,
            backups:           5,
            embedTemplates:   25,
            stickyMessages:    8,
            giveawayRoleMult:  true,
            antiNuke:          true,
            antiRaid:          true,
            advancedAutomod:   true,
            customBranding:    false,
            massRole:          true,
            massban:           false,
            imageGen:          false,
            aiChatbot:         false,
            virusTotal:        false,
            youtubeNotifs:     5,
            twitchNotifs:      5,
            connectionRoles:   10,
        },
    },

    pro: {
        name: 'RankCore Pro',
        emoji: '<:eco:1567796967197900842>',
        color: 0xa855f7,
        price: { monthly: 599, yearly: 4999 },         // €5.99 / €49.99
        priceDisplay: { monthly: '€5.99', yearly: '€49.99' },
        billing: { monthly: 'monthly', yearly: 'yearly' },
        limits: {
            autoresponders:   75,
            customCommands:   75,
            ticketCategories: 15,
            reactionRoles:   100,
            logChannels:      15,
            welcomeImages:     true,
            music247:          true,
            musicFilters:      true,
            playlists:        20,
            playlistSize:    200,
            backups:          15,
            embedTemplates:   75,
            stickyMessages:   20,
            giveawayRoleMult:  true,
            antiNuke:          true,
            antiRaid:          true,
            advancedAutomod:   true,
            customBranding:    false,
            massRole:          true,
            massban:           true,
            imageGen:          true,
            aiChatbot:         true,
            virusTotal:        true,
            youtubeNotifs:    15,
            twitchNotifs:     15,
            connectionRoles:  50,
        },
    },

    elite: {
        name: 'RankCore Elite',
        emoji: '<:1430986209995526274:1567796911350747206>',
        color: 0xf59e0b,
        price: { monthly: 1299, yearly: 9999 },        // €12.99 / €99.99
        priceDisplay: { monthly: '€12.99', yearly: '€99.99' },
        billing: { monthly: 'monthly', yearly: 'yearly' },
        limits: {
            autoresponders:    Infinity,
            customCommands:    Infinity,
            ticketCategories:  Infinity,
            reactionRoles:     Infinity,
            logChannels:       Infinity,
            welcomeImages:     true,
            music247:          true,
            musicFilters:      true,
            playlists:         Infinity,
            playlistSize:      Infinity,
            backups:           Infinity,
            embedTemplates:    Infinity,
            stickyMessages:    Infinity,
            giveawayRoleMult:  true,
            antiNuke:          true,
            antiRaid:          true,
            advancedAutomod:   true,
            customBranding:    false,  // standalone subscription only
            massRole:          true,
            massban:           true,
            imageGen:          true,
            aiChatbot:         true,
            virusTotal:        true,
            youtubeNotifs:     Infinity,
            twitchNotifs:      Infinity,
            connectionRoles:   Infinity,
        },
    },
};

// Ordered from lowest to highest for comparison
const TIER_ORDER = ['free', 'basic', 'pro', 'elite'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get tier config for a given tier key.
 * Falls back to 'free' if key is invalid.
 */
function getTier(tierKey) {
    return TIERS[tierKey] ?? TIERS.free;
}

/**
 * Returns true if `actualTier` is >= `requiredTier` in the hierarchy.
 * e.g. meetsMinTier('pro', 'basic') → true
 *      meetsMinTier('free', 'basic') → false
 */
function meetsMinTier(actualTier, requiredTier) {
    const actual   = TIER_ORDER.indexOf(actualTier   ?? 'free');
    const required = TIER_ORDER.indexOf(requiredTier ?? 'free');
    if (actual === -1 || required === -1) return false;
    return actual >= required;
}

/**
 * Given a PremiumUser or PremiumGuild document (or null), return the tier key.
 */
function tierFromDoc(doc) {
    if (!doc) return 'free';

    // Check if premium has been explicitly revoked (flag set to false)
    const isRevoked = doc.isPremium === false || doc.isPremiumGuild === false;
    if (isRevoked) return 'free';

    // At least one active flag must be explicitly true, OR a tier must be stored
    const hasActiveFlag = doc.isPremium === true || doc.isPremiumGuild === true;
    const hasStoredTier = doc.premium?.tier && TIER_ORDER.includes(doc.premium.tier);
    if (!hasActiveFlag && !hasStoredTier) return 'free';

    // Expiry check — no expiresAt means lifetime/dev grant → always active
    const isActive = !doc.premium?.expiresAt || new Date(doc.premium.expiresAt) > new Date();
    if (!isActive) return 'free';

    // Return stored tier, fall back to 'basic' if flag is set but tier wasn't written
    return doc.premium?.tier ?? 'basic';
}

/**
 * Get the numeric limit for a feature at the given tier.
 * Returns Infinity for unlimited, false for disabled boolean features.
 */
function getLimit(tierKey, feature) {
    return getTier(tierKey).limits[feature] ?? getTier('free').limits[feature];
}

/**
 * Map a Stripe price environment variable key to a tier + billing cycle.
 * Keys should be set in .env like:
 *   STRIPE_PRICE_BASIC_MONTHLY=price_xxxxx
 *   STRIPE_PRICE_BASIC_YEARLY=price_xxxxx
 *   STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
 *   ...
 */
function resolvePriceId(priceId) {
    const map = {
        [process.env.STRIPE_PRICE_BASIC_MONTHLY]:  { tier: 'basic', billing: 'monthly', durationDays: 30 },
        [process.env.STRIPE_PRICE_BASIC_YEARLY]:   { tier: 'basic', billing: 'yearly',  durationDays: 365 },
        [process.env.STRIPE_PRICE_PRO_MONTHLY]:    { tier: 'pro',   billing: 'monthly', durationDays: 30 },
        [process.env.STRIPE_PRICE_PRO_YEARLY]:     { tier: 'pro',   billing: 'yearly',  durationDays: 365 },
        [process.env.STRIPE_PRICE_ELITE_MONTHLY]:  { tier: 'elite', billing: 'monthly', durationDays: 30 },
        [process.env.STRIPE_PRICE_ELITE_YEARLY]:   { tier: 'elite', billing: 'yearly',  durationDays: 365 },
        // Legacy single-plan support (existing env vars)
        [process.env.StripePriceID]:               { tier: 'basic', billing: 'monthly', durationDays: 30 },
        [process.env.StripePriceIDYearly]:          { tier: 'basic', billing: 'yearly',  durationDays: 365 },
    };
    return map[priceId] ?? { tier: 'basic', billing: 'monthly', durationDays: 30 };
}

/**
 * getGuildTier — returns the effective tier string for a guild.
 * Guild-scoped only; user-level premium has been removed.
 */
async function getGuildTier(guildId) {
    if (!guildId) return 'free';
    try {
        const cache = require('../src/lib/cache');
        return await cache.wrap('premium', `guildTier:${guildId}`, async () => {
            const PremiumGuild = require('../Schemas/premiumGuildSchema');
            const doc = await PremiumGuild.findOne({ id: guildId }).lean();
            return tierFromDoc(doc);
        }, 120);
    } catch { return 'free'; }
}

function bustGuildTierCache(guildId) {
    try {
        const cache = require('../src/lib/cache');
        cache.del('premium', `guildTier:${guildId}`);
    } catch {}
}

module.exports = {
    TIERS,
    TIER_ORDER,
    getTier,
    meetsMinTier,
    tierFromDoc,
    getLimit,
    resolvePriceId,
    getGuildTier,
    bustGuildTierCache,
};