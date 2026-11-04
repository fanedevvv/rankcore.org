/**
 * Premium Checkout API routes
 * POST /api/premium/checkout   — creates a Stripe checkout session
 * GET  /api/premium/status     — returns current user + guild premium status
 */
const express = require("express");
const LemonSqueezy = require("../../../Utils/lemonSqueezy");
const stripe  = require("stripe")(process.env.STRIPE_SECRET_KEY || 'sk_not_configured');
const router  = express.Router();
const { isAuth } = require("../../middleware");
const PremiumUser       = require("../../../Schemas/premiumUserSchema");
const PremiumGuild      = require("../../../Schemas/premiumGuildSchema");
const CbBlacklist       = require("../../../Schemas/cbBlacklistSchema");
const { tierFromDoc, getTier } = require("../../../Utils/premiumTiers");

// Map plan string → env var name
const PLAN_TO_ENV = {
    basic_monthly:    "STRIPE_PRICE_BASIC_MONTHLY",
    basic_yearly:     "STRIPE_PRICE_BASIC_YEARLY",
    pro_monthly:      "STRIPE_PRICE_PRO_MONTHLY",
    pro_yearly:       "STRIPE_PRICE_PRO_YEARLY",
    elite_monthly:    "STRIPE_PRICE_ELITE_MONTHLY",
    elite_yearly:     "STRIPE_PRICE_ELITE_YEARLY",
    // Standalone Custom Branding (per-guild)
    branding_monthly: "STRIPE_PRICE_BRANDING_MONTHLY",
    branding_yearly:  "STRIPE_PRICE_BRANDING_YEARLY",
};

// Branding plans require a guildId to be provided
const BRANDING_PLANS = new Set(["branding_monthly", "branding_yearly"]);

// ── POST /api/premium/checkout ────────────────────────────────────────────────
router.post("/api/premium/checkout", isAuth, async (req, res) => {
    const { plan, guildId } = req.body;

    // Lemon Squeezy is the primary payment provider when configured
    if (LemonSqueezy.isConfigured()) {
        if (!LemonSqueezy.PLANS[plan]) return res.status(400).json({ error: "Invalid plan." });
        if (BRANDING_PLANS.has(plan) && !guildId) {
            return res.status(400).json({ error: "A Server ID is required for Custom Branding subscriptions." });
        }
        if (BRANDING_PLANS.has(plan) && await CbBlacklist.findOne({ serverId: guildId }).lean()) {
            return res.status(403).json({ error: "This server has been blacklisted from using Custom Branding." });
        }
        if (guildId && !/^\d{17,20}$/.test(String(guildId))) return res.status(400).json({ error: "Invalid server." });
        try {
            const url = await LemonSqueezy.createCheckout({ plan, userId: req.user.id, guildId: guildId || null, email: req.user.email || null });
            return res.json({ url });
        } catch (err) {
            console.error("[Premium] Lemon Squeezy checkout error:", err.message);
            return res.status(503).json({ error: err.message === "This plan is not available yet." ? err.message : "Failed to create checkout. Please try again." });
        }
    }

    // No payment provider yet → premium is sold manually through the support server
    if (!process.env.STRIPE_SECRET_KEY) {
        return res.json({ manual: true, url: process.env.SUPPORT_URL || "https://discord.gg/a9Kea3ymC7" });
    }

    if (!plan || !PLAN_TO_ENV[plan]) {
        return res.status(400).json({ error: "Invalid plan." });
    }

    const priceId = process.env[PLAN_TO_ENV[plan]];
    if (!priceId) {
        return res.status(503).json({ error: "This plan is not yet available. Please try again soon." });
    }

    // Branding plans MUST have a guild ID
    if (BRANDING_PLANS.has(plan) && !guildId) {
        return res.status(400).json({ error: "A Server ID is required for Custom Branding subscriptions." });
    }

    // Block blacklisted guilds from purchasing CB
    if (BRANDING_PLANS.has(plan) && guildId) {
        const bl = await CbBlacklist.findOne({ serverId: guildId }).lean();
        if (bl) {
            return res.status(403).json({ error: "This server has been blacklisted from using Custom Branding." });
        }
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.DASHBOARD_URL}/stripe/success`,
            cancel_url:  `${process.env.DASHBOARD_URL}/premium`,
            allow_promotion_codes: true,
            metadata: {
                discord_user_id:  req.user.id,
                discord_guild_id: guildId ?? "",
                price_id:         priceId,
            },
            subscription_data: {
                metadata: {
                    discord_user_id:  req.user.id,
                    discord_guild_id: guildId ?? "",
                },
            },
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("[Premium] Checkout session error:", err.message);
        res.status(500).json({ error: "Failed to create checkout session." });
    }
});

// ── POST /api/premium/portal ─────────────────────────────────────────────────
// Creates a Stripe Billing Portal session so users can manage / cancel subs
router.post("/api/premium/portal", isAuth, async (req, res) => {
    const userId = req.user.id;

    // Lemon Squeezy: open the customer portal of the user's subscription
    if (LemonSqueezy.isConfigured()) {
        const PremiumUser  = require("../../../Schemas/premiumUserSchema");
        const PremiumGuild = require("../../../Schemas/premiumGuildSchema");
        const BrandingSub  = require("../../../Schemas/brandingSubscriptionSchema");
        const [u, g, b] = await Promise.all([
            PremiumUser.findOne({ id: userId, "premium.subscriptionId": /^ls_/ }).lean(),
            PremiumGuild.findOne({ "premium.redeemedBy": userId, "premium.subscriptionId": /^ls_/ }).lean(),
            BrandingSub.findOne({ purchasedBy: userId, source: "lemonsqueezy" }).lean(),
        ]);
        const subId = u?.premium?.subscriptionId?.slice(3) || g?.premium?.subscriptionId?.slice(3) || b?.subscriptionId;
        const url = subId ? await LemonSqueezy.getPortalUrl(subId).catch(() => null) : null;
        if (url) return res.json({ url });
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(404).json({ error: "No subscription found. Premium from a code or a staff grant has nothing to manage." });
        }
    }

    // Find the user's Stripe customer ID from any of their subscriptions
    const PremiumUser = require("../../../Schemas/premiumUserSchema");
    const BrandingSub = require("../../../Schemas/brandingSubscriptionSchema");

    const [userDoc, brandingSub] = await Promise.all([
        PremiumUser.findOne({ id: userId }).lean(),
        BrandingSub.findOne({ purchasedBy: userId }).lean(),
    ]);

    const customerId = userDoc?.premium?.subscriptionId
        ? null  // subscription ID isn't customer ID — look up via Stripe
        : brandingSub?.customerId || null;

    // Try to find the Stripe customer by metadata
    let stripeCustomerId = customerId;
    if (!stripeCustomerId) {
        try {
            const customers = await stripe.customers.search({
                query: `metadata['discord_user_id']:'${userId}'`,
                limit: 1,
            });
            stripeCustomerId = customers.data[0]?.id ?? null;
        } catch { /* search not available on all Stripe plans */ }
    }

    if (!stripeCustomerId) {
        return res.status(404).json({
            error: "No Stripe customer found. If you subscribed recently, please wait a moment and try again.",
        });
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer:   stripeCustomerId,
            return_url: `${process.env.DASHBOARD_URL}/premium`,
        });
        res.json({ url: session.url });
    } catch (err) {
        console.error("[Premium] Billing portal error:", err.message);
        res.status(500).json({ error: "Could not open billing portal." });
    }
});

// ── GET /api/premium/status ───────────────────────────────────────────────────
router.get("/api/premium/status", isAuth, async (req, res) => {
    const userId  = req.user.id;
    const guildId = req.query.guildId ?? null;

    const [userDoc, guildDoc] = await Promise.all([
        PremiumUser.findOne({ id: userId }),
        guildId ? PremiumGuild.findOne({ id: guildId }) : Promise.resolve(null),
    ]);

    const uTier = tierFromDoc(userDoc);
    const gTier = tierFromDoc(guildDoc);

    res.json({
        user: {
            tier: uTier,
            tierName:  getTier(uTier).name,
            tierEmoji: getTier(uTier).emoji,
            isPremium: uTier !== "free",
            plan:      userDoc?.premium?.plan ?? null,
            expiresAt: userDoc?.premium?.expiresAt ?? null,
        },
        guild: guildId ? {
            tier: gTier,
            tierName:  getTier(gTier).name,
            tierEmoji: getTier(gTier).emoji,
            isPremium: gTier !== "free",
            plan:      guildDoc?.premium?.plan ?? null,
            expiresAt: guildDoc?.premium?.expiresAt ?? null,
        } : null,
    });
});


// ── GET /api/premium/branding/:guildId ───────────────────────────────────────
// Returns full branding subscription status for a guild
router.get("/api/premium/branding/:guildId", isAuth, async (req, res) => {
    const { guildId } = req.params;
    const userId = req.user.id;

    const { hasBrandingAccess, getBrandingSubscription } = require("../../../Utils/brandingAccess");

    const [{ allowed, reason, source }, sub] = await Promise.all([
        hasBrandingAccess({ userId, guildId }),
        getBrandingSubscription(guildId),
    ]);

    res.json({
        allowed,
        reason,
        source,
        subscription: sub ? {
            isActive:    sub.isActive,
            billing:     sub.billing,
            expiresAt:   sub.expiresAt,
            activatedAt: sub.activatedAt,
            purchasedBy: sub.purchasedBy,
        } : null,
        prices: {
            monthly: "€4.99",
            yearly:  "€39.99",
        },
    });
});

// ── GET /api/subscriptions ────────────────────────────────────────────────────
// Returns ALL subscription data for the logged-in user:
//   - Main premium (user-level)
//   - Guild-level premiums the user purchased
//   - Branding subscriptions the user purchased
//   - The user's servers (for context)
router.get("/api/subscriptions", isAuth, async (req, res) => {
    const userId = req.user.id;
    const BrandingSub = require("../../../Schemas/brandingSubscriptionSchema");
    const { TIERS, TIER_ORDER, tierFromDoc, getTier } = require("../../../Utils/premiumTiers");

    const [userDoc, guildDocs, brandingSubs] = await Promise.all([
        PremiumUser.findOne({ id: userId }).lean(),
        // All guild-level premiums that were redeemed by this user
        PremiumGuild.find({ "premium.redeemedBy": userId }).lean(),
        // All branding subs purchased by this user
        BrandingSub.find({ purchasedBy: userId }).lean(),
    ]);

    const now = new Date();

    // Helper: is subscription currently active?
    const isActive = (doc) => {
        if (!doc) return false;
        const expires = doc.premium?.expiresAt || doc.expiresAt;
        return expires ? new Date(expires) > now : false;
    };

    // Build user subscription object
    const uTier = tierFromDoc(userDoc);
    const userSub = {
        type:       "main",
        scope:      "user",
        tier:       uTier,
        tierName:   getTier(uTier).name,
        tierEmoji:  getTier(uTier).emoji,
        tierColor:  getTier(uTier).color,
        plan:       userDoc?.premium?.plan ?? null,
        billing:    null, // stored on Stripe, not in DB
        isActive:   uTier !== "free",
        activatedAt:userDoc?.premium?.redeemedAt ?? null,
        expiresAt:  userDoc?.premium?.expiresAt ?? null,
        subscriptionId: userDoc?.premium?.subscriptionId ?? null,
    };

    // Build guild subscription objects
    const guildSubs = guildDocs.map(g => {
        const gTier = tierFromDoc(g);
        return {
            type:       "main",
            scope:      "guild",
            guildId:    g.id,
            tier:       gTier,
            tierName:   getTier(gTier).name,
            tierEmoji:  getTier(gTier).emoji,
            tierColor:  getTier(gTier).color,
            plan:       g.premium?.plan ?? null,
            isActive:   gTier !== "free",
            activatedAt:g.premium?.redeemedAt ?? null,
            expiresAt:  g.premium?.expiresAt ?? null,
            subscriptionId: g.premium?.subscriptionId ?? null,
        };
    });

    // Build branding subscription objects
    const brandingSubsMapped = brandingSubs.map(b => ({
        type:       "branding",
        scope:      "guild",
        guildId:    b.guildId,
        tier:       "branding",
        tierName:   "Custom Branding",
        tierEmoji:  "🎨",
        tierColor:  0x8b5cf6,
        billing:    b.billing,
        isActive:   b.isActive && (!b.expiresAt || new Date(b.expiresAt) > now),
        activatedAt:b.activatedAt,
        expiresAt:  b.expiresAt,
        subscriptionId: b.subscriptionId,
        cancelledAt:b.cancelledAt,
    }));

    // Fetch guild names from Discord client if possible (best-effort)
    res.json({
        userId,
        userSub,
        guildSubs,
        brandingSubs: brandingSubsMapped,
        // Prices for the upgrade cards
        prices: {
            basic:    { monthly: "€2.99", yearly: "€24.99" },
            pro:      { monthly: "€5.99", yearly: "€49.99" },
            elite:    { monthly: "€12.99", yearly: "€99.99" },
            branding: { monthly: "€4.99", yearly: "€39.99" },
        },
    });
});

module.exports = router;