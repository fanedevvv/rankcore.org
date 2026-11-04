"use strict";

/**
 * BrandingSubscription
 *
 * Tracks a per-guild Custom Branding subscription, purchased independently
 * of the main Roco Premium plans. Each guild gets its own Stripe subscription.
 *
 * Access rules:
 *   1. Guild has an active BrandingSubscription  → allowed
 *   2. User/Guild is on the Elite main plan       → allowed (bundled)
 *   3. User is a bot developer/owner             → always allowed
 */

const mongoose = require("mongoose");

const brandingSubscriptionSchema = new mongoose.Schema({
  // The Discord guild this subscription covers
  guildId: { type: String, required: true, unique: true, index: true },

  // The Discord user who purchased
  purchasedBy: { type: String, required: true },

  // Stripe IDs
  subscriptionId: { type: String, default: null },
  customerId:     { type: String, default: null },
  priceId:        { type: String, default: null },

  // Billing cycle: 'monthly' | 'yearly'
  billing: { type: String, enum: ["monthly", "yearly", null], default: null },

  // Status
  isActive: { type: Boolean, default: false },

  // Dates
  activatedAt: { type: Date, default: null },
  expiresAt:   { type: Date, default: null },
  cancelledAt: { type: Date, default: null },

  // Source: 'stripe' | 'elite_bundle' | 'manual'
  source: { type: String, default: "stripe" },
}, { timestamps: true });

module.exports = mongoose.model("BrandingSubscription", brandingSubscriptionSchema);
