"use strict";

/**
 * customBrandingHelper.js
 *
 * Utility functions used throughout the bot to apply per-guild custom branding
 * to embeds and other bot outputs.
 *
 * Usage:
 *   const { applyBranding, getGuildBranding } = require("../Utils/customBrandingHelper");
 *
 *   // Fetch config once, apply to many embeds:
 *   const branding = await getGuildBranding(guildId);
 *   const embed = applyBranding(new EmbedBuilder().setTitle("Hello"), branding);
 *
 *   // Or one-liner:
 *   const embed = await applyBrandingById(new EmbedBuilder().setTitle("Hello"), guildId);
 */

const { EmbedBuilder } = require("discord.js");
const CustomBranding = require("../Schemas/customBrandingSchema");

// Simple in-process cache to avoid hitting MongoDB on every embed.
const cache = new Map(); // guildId → { config, fetchedAt }
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetch the custom branding config for a guild.
 * Returns null if no config exists or branding is disabled.
 * @param {string} guildId
 * @returns {Promise<object|null>}
 */
async function getGuildBranding(guildId) {
  if (!guildId) return null;

  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  try {
    const doc = await CustomBranding.findOne({ guildId, enabled: true }).lean();
    const config = doc || null;
    cache.set(guildId, { config, fetchedAt: Date.now() });
    return config;
  } catch {
    return null;
  }
}

/**
 * Invalidate the cache for a guild (call after /custombrand set or toggle).
 * @param {string} guildId
 */
function invalidateBrandingCache(guildId) {
  cache.delete(guildId);
}

/**
 * Apply branding to an EmbedBuilder instance.
 * Only non-null values override the embed's existing settings.
 *
 * @param {EmbedBuilder} embed     The embed to brand
 * @param {object|null}  branding  Config from getGuildBranding(), or null
 * @returns {EmbedBuilder}         The same embed, mutated in-place
 */
function applyBranding(embed, branding) {
  if (!branding) return embed;

  if (branding.embedColor) {
    const colorInt = parseInt(branding.embedColor.replace("#", ""), 16);
    if (!isNaN(colorInt)) embed.setColor(colorInt);
  }

  if (branding.footerText) {
    const existing = embed.data?.footer;
    embed.setFooter({
      text: branding.footerText,
      iconURL: existing?.icon_url,
    });
  }

  return embed;
}

/**
 * Convenience wrapper — fetch branding then apply it to the embed in one call.
 *
 * @param {EmbedBuilder} embed
 * @param {string}       guildId
 * @returns {Promise<EmbedBuilder>}
 */
async function applyBrandingById(embed, guildId) {
  const branding = await getGuildBranding(guildId);
  return applyBranding(embed, branding);
}

/**
 * Get the "bot name" override for display purposes (e.g. embed author text).
 * Returns the custom name if branding is active, otherwise null.
 *
 * @param {string} guildId
 * @returns {Promise<string|null>}
 */
async function getBrandedName(guildId) {
  const branding = await getGuildBranding(guildId);
  return branding?.botName || null;
}

module.exports = {
  getGuildBranding,
  invalidateBrandingCache,
  applyBranding,
  applyBrandingById,
  getBrandedName,
};
