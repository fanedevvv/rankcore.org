const { PermissionFlagsBits } = require("discord.js");
const { meetsMinTier, getGuildTier: getGuildTierCached } = require("../../../Utils/premiumTiers");

const getPermissionName = (bit) => {
    for (const [name, value] of Object.entries(PermissionFlagsBits)) {
        if (value === bit) return name.replace(/_/g, " ").toLowerCase();
    }
    return "Unknown Permission";
};

/** Returns true if guild has any active premium (any tier) */
const isGuildPremium = async (guildId) => {
    const tier = await getGuildTierCached(guildId);
    return tier !== 'free';
};

/** Returns the tier key ('free' | 'basic' | 'pro' | 'elite') for a guild */
const getGuildTier = async (guildId) => {
    return getGuildTierCached(guildId);
};

/**
 * Returns true if the guild meets the minimum tier.
 * Premium is guild-scoped — all members of a premium guild get access.
 */
const meetsMinTierForInteraction = async (_userId, guildId, requiredTier) => {
    const gTier = guildId ? await getGuildTier(guildId) : 'free';
    return meetsMinTier(gTier, requiredTier);
};

// Kept for backwards compat — always returns false since user premium is removed
const isUserPremium = async (_userId) => false;
const getUserTier   = async (_userId) => 'free';

module.exports = {
    getPermissionName,
    isUserPremium,
    isGuildPremium,
    getUserTier,
    getGuildTier,
    meetsMinTierForInteraction,
};
