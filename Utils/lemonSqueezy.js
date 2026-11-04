"use strict";

/**
 * Lemon Squeezy payments (merchant of record — they handle VAT and invoices).
 *
 * .env:
 *   LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET
 *   LEMONSQUEEZY_VARIANT_<PLAN>  for each plan below (the variant ID of that product/price)
 *
 * Webhook: https://dash.rocobot.xyz/webhooks/lemonsqueezy (dashboard/webhooks/LemonSqueezy.js).
 * Every subscription_* event re-syncs premium from the subscription's current status,
 * so events can arrive late, twice or out of order without breaking anything.
 */

const crypto       = require("crypto");
const PremiumUser  = require("../Schemas/premiumUserSchema");
const PremiumGuild = require("../Schemas/premiumGuildSchema");
const { getTier }  = require("./premiumTiers");
const { activateBrandingSubscription, deactivateBrandingSubscription } = require("./brandingAccess");

const API = "https://api.lemonsqueezy.com/v1";

const PLANS = {
  basic_monthly:    { tier: "basic", billing: "monthly" },
  basic_yearly:     { tier: "basic", billing: "yearly" },
  pro_monthly:      { tier: "pro",   billing: "monthly" },
  pro_yearly:       { tier: "pro",   billing: "yearly" },
  elite_monthly:    { tier: "elite", billing: "monthly" },
  elite_yearly:     { tier: "elite", billing: "yearly" },
  branding_monthly: { branding: true, billing: "monthly" },
  branding_yearly:  { branding: true, billing: "yearly" },
};

// Keep premium for a couple of days past the renewal date so a slightly late payment doesn't cut access
const GRACE_MS = 3 * 86_400_000;
const ACTIVE_STATUSES = new Set(["active", "on_trial", "past_due", "cancelled"]); // cancelled = active until ends_at

const variantFor = (plan) => process.env[`LEMONSQUEEZY_VARIANT_${plan.toUpperCase()}`] || null;

function planFromVariant(variantId) {
  for (const plan of Object.keys(PLANS)) {
    if (String(variantFor(plan)) === String(variantId)) return plan;
  }
  return null;
}

const isConfigured = () => !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID);

async function createCheckout({ plan, userId, guildId = null, email = null }) {
  if (!PLANS[plan]) throw new Error("Invalid plan.");
  const variantId = variantFor(plan);
  if (!variantId) throw new Error("This plan is not available yet.");

  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      Accept:         "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            ...(email ? { email } : {}),
            custom: { discord_user_id: userId, discord_guild_id: guildId || "", plan },
          },
          product_options: {
            redirect_url: `${process.env.DASHBOARD_URL || "https://dash.rocobot.xyz"}/subscriptions?success=1`,
          },
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        relationships: {
          store:   { data: { type: "stores",   id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.errors?.[0]?.detail || `Lemon Squeezy error ${res.status}`);
  return body.data.attributes.url;
}

/** Customer portal link (manage card, cancel, invoices) for a subscription ID. */
async function getPortalUrl(subscriptionId) {
  const res = await fetch(`${API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`, Accept: "application/vnd.api+json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.data?.attributes?.urls?.customer_portal || null;
}

function verifySignature(rawBody, signature) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(signature), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Applies a subscription's current state. Returns a short summary for logging/DMs, or null if ignored.
 */
async function syncSubscription(subscription, custom = {}) {
  const attrs   = subscription.attributes || {};
  const subId   = String(subscription.id);
  const plan    = planFromVariant(attrs.variant_id) || custom.plan;
  const cfg     = PLANS[plan];
  const userId  = custom.discord_user_id;
  const guildId = custom.discord_guild_id || null;

  if (!cfg)    return { ignored: `unknown variant ${attrs.variant_id}` };
  if (!userId) return { ignored: "no discord_user_id in custom data" };

  const active  = ACTIVE_STATUSES.has(attrs.status);
  const endDate = attrs.status === "cancelled" ? attrs.ends_at : attrs.renews_at;
  const expiresAt = new Date((endDate ? new Date(endDate).getTime() : Date.now() + 30 * 86_400_000) + GRACE_MS);

  // ── Custom Branding (per server) ──────────────────────────────────────────
  if (cfg.branding) {
    if (!guildId) return { ignored: "branding subscription without a server ID" };
    if (active) {
      await activateBrandingSubscription({
        guildId, userId, subscriptionId: subId, customerId: String(attrs.customer_id ?? ""),
        priceId: String(attrs.variant_id), billing: cfg.billing,
        durationDays: Math.max(1, Math.ceil((expiresAt - Date.now()) / 86_400_000)),
        source: "lemonsqueezy",
      });
    } else {
      await deactivateBrandingSubscription(guildId);
    }
    return { kind: "branding", active, userId, guildId, status: attrs.status, expiresAt };
  }

  // ── Main premium (user, or the server chosen at checkout) ─────────────────
  const Model = guildId ? PremiumGuild : PremiumUser;
  const flag  = guildId ? "isPremiumGuild" : "isPremium";
  const id    = guildId || userId;

  if (active) {
    await Model.findOneAndUpdate(
      { id },
      {
        $set: {
          [flag]:                   true,
          "premium.tier":           cfg.tier,
          "premium.plan":           getTier(cfg.tier).name,
          "premium.expiresAt":      expiresAt,
          "premium.subscriptionId": `ls_${subId}`,
          "premium.redeemedAt":     new Date(attrs.created_at || Date.now()),
        },
        $addToSet: { "premium.redeemedBy": userId },
      },
      { upsert: true, new: true },
    );
  } else {
    // Only revoke premium that came from this subscription (not codes or owner grants)
    await Model.findOneAndUpdate(
      { id, "premium.subscriptionId": `ls_${subId}` },
      { $set: { [flag]: false, "premium.tier": null, "premium.plan": null, "premium.expiresAt": new Date() } },
    );
  }
  return { kind: guildId ? "guild" : "user", active, userId, guildId, tier: cfg.tier, status: attrs.status, expiresAt };
}

module.exports = { PLANS, isConfigured, createCheckout, getPortalUrl, verifySignature, syncSubscription, planFromVariant };
