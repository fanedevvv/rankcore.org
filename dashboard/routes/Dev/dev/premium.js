"use strict";

// premium.js — Dev panel: grant/revoke main premium & custom branding subs

const router      = require("express").Router();
const PremiumUser  = require("../../../../Schemas/premiumUserSchema");
const PremiumGuild = require("../../../../Schemas/premiumGuildSchema");
const BrandingSub  = require("../../../../Schemas/brandingSubscriptionSchema");
const Maintenance  = require("../../../../Schemas/maintenanceSchema");
const { devLog, secureDevApi, calcExpiry } = require("./shared");
const { TIERS, TIER_ORDER, getTier } = require("../../../../Utils/premiumTiers");

const VALID_TIERS    = ["basic", "pro", "elite"];
const VALID_DURATIONS = ["daily", "weekly", "monthly", "yearly", "lifetime"];

/* ─────────────────────────────────────────────
   PREMIUM — list (users + guilds + branding)
───────────────────────────────────────────── */

router.get("/api-dev/premium", ...secureDevApi, async (req, res) => {
  const [users, guilds, brandings] = await Promise.all([
    PremiumUser.find({ isPremium: true }).lean(),
    PremiumGuild.find({ isPremiumGuild: true }).lean(),
    BrandingSub.find({}).lean(),
  ]);

  res.json({
    users: users.map(u => ({
      id:         u.id,
      type:       "user",
      tier:       u.premium?.tier   ?? "basic",
      plan:       u.premium?.plan   ?? "Roco Basic",
      expiresAt:  u.premium?.expiresAt ?? null,
      redeemedAt: u.premium?.redeemedAt ?? null,
    })),
    guilds: guilds.map(g => ({
      id:         g.id,
      type:       "guild",
      tier:       g.premium?.tier   ?? "basic",
      plan:       g.premium?.plan   ?? "Roco Basic",
      expiresAt:  g.premium?.expiresAt ?? null,
      redeemedAt: g.premium?.redeemedAt ?? null,
    })),
    branding: brandings.map(b => ({
      id:          b.guildId,
      type:        "branding",
      guildId:     b.guildId,
      purchasedBy: b.purchasedBy,
      billing:     b.billing,
      isActive:    b.isActive,
      expiresAt:   b.expiresAt,
      activatedAt: b.activatedAt,
    })),
  });
});

/* ─────────────────────────────────────────────
   PREMIUM — grant (user or guild, with tier)
───────────────────────────────────────────── */

router.post("/api-dev/premium/grant", ...secureDevApi, async (req, res) => {
  const { id, type, tier = "basic", duration = "monthly" } = req.body;

  if (!id)                           return res.status(400).json({ error: "ID required" });
  if (!VALID_TIERS.includes(tier))   return res.status(400).json({ error: "Invalid tier. Use: " + VALID_TIERS.join(", ") });
  if (!VALID_DURATIONS.includes(duration)) return res.status(400).json({ error: "Invalid duration. Use: " + VALID_DURATIONS.join(", ") });

  const expiresAt  = calcExpiry(duration);
  const redeemedAt = new Date();
  const grantedBy  = req.user?.id ?? "dashboard";
  const tierCfg    = getTier(tier);
  const planName   = tierCfg.name;

  try {
    if (type === "guild") {
      await PremiumGuild.findOneAndUpdate(
        { id },
        {
          $set: {
            isPremiumGuild:          true,
            "premium.expiresAt":     expiresAt,
            "premium.plan":          planName,
            "premium.tier":          tier,
            "premium.redeemedAt":    redeemedAt,
          },
          $addToSet: { "premium.redeemedBy": grantedBy },
        },
        { upsert: true, new: true }
      );
    } else {
      await PremiumUser.findOneAndUpdate(
        { id },
        {
          $set: {
            isPremium:               true,
            "premium.expiresAt":     expiresAt,
            "premium.plan":          planName,
            "premium.tier":          tier,
            "premium.redeemedAt":    redeemedAt,
          },
          $addToSet: { "premium.redeemedBy": grantedBy },
        },
        { upsert: true, new: true }
      );
    }

    console.log(`[DEV] Granted ${tier} ${duration} ${type} premium to ${id} — by ${req.user?.username}`);
    devLog("PREMIUM_GRANT", { id, type, tier, duration, expiresAt: new Date(expiresAt).toISOString() }, req.user);
    res.json({ success: true, id, type, tier, duration, expiresAt });
  } catch (err) {
    console.error("[DEV] Premium grant error:", err);
    res.status(500).json({ error: "DB error: " + err.message });
  }
});

/* ─────────────────────────────────────────────
   PREMIUM — revoke (user or guild)
───────────────────────────────────────────── */

router.post("/api-dev/premium/revoke", ...secureDevApi, async (req, res) => {
  const { id, type } = req.body;
  if (!id) return res.status(400).json({ error: "ID required" });

  try {
    if (type === "guild") {
      await PremiumGuild.findOneAndUpdate(
        { id },
        { $set: { isPremiumGuild: false, "premium.tier": null, "premium.plan": null, "premium.expiresAt": new Date() } }
      );
    } else {
      await PremiumUser.findOneAndUpdate(
        { id },
        { $set: { isPremium: false, "premium.tier": null, "premium.plan": null, "premium.expiresAt": new Date() } }
      );
    }

    console.log(`[DEV] Revoked ${type} premium from ${id} — by ${req.user?.username}`);
    devLog("PREMIUM_REVOKE", { id, type }, req.user);
    res.json({ success: true });
  } catch (err) {
    console.error("[DEV] Premium revoke error:", err);
    res.status(500).json({ error: "DB error: " + err.message });
  }
});

/* ─────────────────────────────────────────────
   BRANDING — grant (per guild)
───────────────────────────────────────────── */

router.post("/api-dev/branding/grant", ...secureDevApi, async (req, res) => {
  const { guildId, userId, duration = "monthly" } = req.body;

  if (!guildId) return res.status(400).json({ error: "guildId required" });
  if (!userId)  return res.status(400).json({ error: "userId (who it's for) required" });
  if (!VALID_DURATIONS.includes(duration)) return res.status(400).json({ error: "Invalid duration" });

  const now       = new Date();
  const expiresAt = calcExpiry(duration);

  try {
    await BrandingSub.findOneAndUpdate(
      { guildId },
      {
        $set: {
          purchasedBy: userId,
          billing:     duration === "yearly" ? "yearly" : "monthly",
          isActive:    true,
          activatedAt: now,
          expiresAt,
          cancelledAt: null,
          source:      "manual",
        },
      },
      { upsert: true, new: true }
    );

    console.log(`[DEV] Granted Custom Branding to guild ${guildId} (for user ${userId}) — by ${req.user?.username}`);
    devLog("BRANDING_GRANT", { guildId, userId, duration, expiresAt: new Date(expiresAt).toISOString() }, req.user);
    res.json({ success: true, guildId, userId, duration, expiresAt });
  } catch (err) {
    console.error("[DEV] Branding grant error:", err);
    res.status(500).json({ error: "DB error: " + err.message });
  }
});

/* ─────────────────────────────────────────────
   BRANDING — revoke (per guild)
───────────────────────────────────────────── */

router.post("/api-dev/branding/revoke", ...secureDevApi, async (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: "guildId required" });

  try {
    const doc = await BrandingSub.findOne({ guildId });
    if (!doc) return res.status(404).json({ error: "No branding subscription found for that guild" });

    doc.isActive    = false;
    doc.expiresAt   = new Date();
    doc.cancelledAt = new Date();
    await doc.save();

    console.log(`[DEV] Revoked Custom Branding from guild ${guildId} — by ${req.user?.username}`);
    devLog("BRANDING_REVOKE", { guildId }, req.user);
    res.json({ success: true });
  } catch (err) {
    console.error("[DEV] Branding revoke error:", err);
    res.status(500).json({ error: "DB error: " + err.message });
  }
});

/* ─────────────────────────────────────────────
   MAINTENANCE MODE
───────────────────────────────────────────── */

router.get("/api-dev/maintenance", ...secureDevApi, async (req, res) => {
  try {
    const doc = await Maintenance.findById("maintenance").lean();
    res.json(doc || {
      _id: "maintenance", enabled: false,
      title:   "We're offline for maintenance!",
      message: "We're making some improvements. We'll be back shortly.",
      eta: null, triggeredBy: null, triggeredAt: null, bypassIPs: [],
    });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/api-dev/maintenance", ...secureDevApi, async (req, res) => {
  const { enabled, title, message, eta, bypassIPs } = req.body;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "'enabled' must be a boolean" });

  const ips = Array.isArray(bypassIPs)
    ? bypassIPs.map(s => s.trim()).filter(Boolean)
    : typeof bypassIPs === "string"
      ? bypassIPs.split(",").map(s => s.trim()).filter(Boolean)
      : [];

  try {
    await Maintenance.findByIdAndUpdate("maintenance", {
      $set: {
        enabled,
        title:       title?.trim()   || "We're offline for maintenance!",
        message:     message?.trim() || "We're making some improvements. We'll be back shortly.",
        eta:         eta ? new Date(eta) : null,
        bypassIPs:   ips,
        triggeredBy: req.user?.id ?? null,
        triggeredAt: new Date(),
      },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });

    console.log(`[MAINTENANCE] ${enabled ? "ENABLED" : "DISABLED"} by ${req.user?.username} (${req.user?.id})`);
    devLog(enabled ? "MAINTENANCE_ENABLE" : "MAINTENANCE_DISABLE", { title: title?.trim() || "default", eta: eta || null }, req.user);
    res.json({ success: true, enabled });
  } catch (err) {
    console.error("[MAINTENANCE] Update error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

module.exports = router;
