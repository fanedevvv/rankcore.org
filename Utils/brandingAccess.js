"use strict";

/**
 * brandingAccess.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central authority for whether a guild/user has Custom Branding access.
 *
 * Three ways to have access:
 *   1. Active BrandingSubscription for the guild  (standalone purchase)
 *   2. Guild or user is on the Elite main plan    (bundled)
 *   3. User is a bot developer/owner             (always allowed)
 *
 * Usage:
 *   const { hasBrandingAccess, getBrandingSubscription } = require('../Utils/brandingAccess');
 *   const { allowed, reason } = await hasBrandingAccess({ userId, guildId });
 */

const BrandingSubscription = require("../Schemas/brandingSubscriptionSchema");
const getOwners            = require("./getOwners");

/**
 * Returns { allowed: boolean, reason: string, source: string|null }
 *
 * source: 'dev' | 'branding_sub' | null
 *
 * Access is granted if:
 *   1. User is a bot developer/owner (always allowed)
 *   2. The guild has an active standalone Custom Branding subscription
 */
async function hasBrandingAccess({ userId, guildId }) {
  // 1. Bot developers always have access
  const devs = await getOwners();
  if (devs.includes(userId)) {
    return { allowed: true, reason: "Bot developer", source: "dev" };
  }

  // 2. Active standalone branding subscription for this guild
  const brandingSub = await BrandingSubscription.findOne({ guildId });
  if (brandingSub?.isActive) {
    const notExpired = !brandingSub.expiresAt || new Date(brandingSub.expiresAt) > new Date();
    if (notExpired) {
      return {
        allowed: true,
        reason:  "Active Custom Branding subscription",
        source:  "branding_sub",
        sub:     brandingSub,
      };
    }
  }

  return { allowed: false, reason: "No active Custom Branding subscription", source: null };
}

/**
 * Fetch the branding subscription document for a guild (or null).
 */
async function getBrandingSubscription(guildId) {
  return BrandingSubscription.findOne({ guildId });
}

/**
 * Activate or renew a branding subscription from a Stripe event.
 */
async function activateBrandingSubscription({
  guildId, userId, subscriptionId, customerId, priceId, billing, durationDays, source = "stripe",
}) {
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  return BrandingSubscription.findOneAndUpdate(
    { guildId },
    {
      $set: {
        purchasedBy:    userId,
        subscriptionId,
        customerId,
        priceId,
        billing,
        isActive:       true,
        activatedAt:    now,
        expiresAt,
        cancelledAt:    null,
        source,
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Deactivate a branding subscription (on cancellation/expiry).
 */
async function deactivateBrandingSubscription(guildId) {
  return BrandingSubscription.findOneAndUpdate(
    { guildId },
    {
      $set: {
        isActive:    false,
        expiresAt:   new Date(),
        cancelledAt: new Date(),
      },
    }
  );
}

module.exports = {
  hasBrandingAccess,
  getBrandingSubscription,
  activateBrandingSubscription,
  deactivateBrandingSubscription,
};
