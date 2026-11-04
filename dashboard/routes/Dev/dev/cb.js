"use strict";

const router          = require("express").Router();
const CbBlacklist     = require("../../../../Schemas/cbBlacklistSchema");
const CbConfig        = require("../../../../Schemas/cbConfigSchema");
const CustomBranding  = require("../../../../Schemas/customBrandingSchema");
const BrandingSubscription = require("../../../../Schemas/brandingSubscriptionSchema");
const cbm             = require("../../../../src/core/CustomBrandingManager");
const { devLog, secureDevApi } = require("./shared");

// ── Blacklist side-effects (best-effort) ─────────────────────────────────────
// Runs after a guild is blacklisted: cancels Stripe sub, DMs owner, notifies guild.
async function handleBlacklistSideEffects(serverId, reason, req) {
  try {
    const config = await CustomBranding.findOne({ guildId: serverId }).lean();
    if (!config?.ownerId) return;

    // 1. Cancel Stripe subscription — the webhook will fire customer.subscription.deleted
    //    which emits brandingGrant (revoke), deactivating in DB + DMing the user.
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_not_configured');
      const sub = await BrandingSubscription.findOne({ guildId: serverId }).lean();
      if (sub?.subscriptionId) {
        await stripe.subscriptions.cancel(sub.subscriptionId);
        console.log(`[CB-Dev] Cancelled Stripe sub ${sub.subscriptionId} for guild ${serverId}`);
      }
    } catch (e) {
      console.error('[CB-Dev] Stripe cancel error:', e.message);
    }

    const embed = {
      title: 'Custom Branding — Server Blacklisted',
      color: 0xef4444,
      description:
        `Your server (\`${serverId}\`) has been **blacklisted** from using Custom Branding.` +
        `\n\nYour Custom Branding bot has been **stopped** and your subscription **cancelled**.` +
        `\n\n**Reason:** ${reason}\n\nIf you believe this is in error, please contact support.` +
        `\n\n_You will not be charged again._`,
      timestamp: new Date().toISOString(),
    };

    // 2. DM the server owner via internal REST API
    try {
      const { apiPost } = require('../../../lib/botClient');
      await apiPost('/internal/rest/post', {
        route: `/users/${config.ownerId}/messages`,
        body: { embeds: [embed] },
      });
      console.log(`[CB-Dev] DM sent to owner ${config.ownerId} for guild ${serverId}`);
    } catch (e) {
      console.error('[CB-Dev] Owner DM failed:', e.message);
    }

    // 3. Send a notification message in the guild
    try {
      const guild = await req.client?.guilds?.fetch(serverId);
      if (guild) {
        // Hydrate channels so we can iterate the cache
        const channels = await guild.channels.fetchAll();
        const channel = channels.find(c => c.type === 0) || channels.first;
        if (channel) {
          await channel.send({
            embeds: [{
              title: 'Custom Branding Disabled',
              color: 0xef4444,
              description:
                `This server has been **blacklisted** from using Custom Branding.` +
                `\n\nThe Custom Branding bot has been stopped and the subscription cancelled.` +
                `\n\n**Reason:** ${reason}\n\nIf you have questions, please contact support.`,
              timestamp: new Date().toISOString(),
            }],
          });
          console.log(`[CB-Dev] Guild notification sent in ${serverId}`);
        }
      }
    } catch (e) {
      console.error('[CB-Dev] Guild notification failed:', e.message);
    }
  } catch (e) {
    console.error('[CB-Dev] Blacklist side-effects error:', e);
  }
}

router.get("/api-dev/cb/config", ...secureDevApi, async (req, res) => {
  try {
    const cfg = await CbConfig.findById("global").lean();
    res.json({ globalDisabled: cfg?.globalDisabled === true });
  } catch {
    res.json({ globalDisabled: false });
  }
});

router.post("/api-dev/cb/global/toggle", ...secureDevApi, async (req, res) => {
  try {
    const cfg = await CbConfig.findById("global");
    const newVal = !cfg?.globalDisabled;
    await CbConfig.findByIdAndUpdate("global", { $set: { globalDisabled: newVal } }, { upsert: true });
    cbm.reloadRestrictions?.();
    devLog("CB_GLOBAL_TOGGLE", { globalDisabled: newVal }, req.user);
    res.json({ globalDisabled: newVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api-dev/cb/blacklist", ...secureDevApi, async (req, res) => {
  try {
    res.json(await CbBlacklist.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/cb/blacklist", ...secureDevApi, async (req, res) => {
  try {
    const { serverId, reason } = req.body;
    if (!serverId) return res.status(400).json({ error: "Server ID required" });

    const exists = await CbBlacklist.findOne({ serverId });
    if (exists) {
      await CbBlacklist.deleteOne({ serverId });
      cbm.reloadRestrictions?.();
      devLog("CB_BLACKLIST_REMOVE", { serverId }, req.user);
      return res.json({ success: true, action: "removed" });
    }

    const finalReason = reason || "No reason provided";
    await CbBlacklist.create({ serverId, reason: finalReason, blacklistedBy: req.user?.id });
    cbm.reloadRestrictions?.();

    // Stop any running CB bot for this guild
    cbm.stopGuild?.(serverId).catch(() => {});

    // Best-effort: cancel Stripe sub, DM owner, notify guild
    handleBlacklistSideEffects(serverId, finalReason, req);

    devLog("CB_BLACKLIST_ADD", { serverId, reason: finalReason }, req.user);
    res.json({ success: true, action: "added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api-dev/cb/blacklist/:serverId", ...secureDevApi, async (req, res) => {
  try {
    const { serverId } = req.params;
    await CbBlacklist.deleteOne({ serverId });
    cbm.reloadRestrictions?.();
    devLog("CB_BLACKLIST_REMOVE", { serverId }, req.user);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST bot action (start / stop / restart) ──────────────────────────────────
// The dashboard's cbm instance does NOT own CB workers — the real manager runs
// inside noxx-cb (standalone) or noxx-bot (combined). So actions update the DB
// and best-effort notify cbm. Errors from cbm are logged but don't block the
// DB update — the CB manager will pick up the change on its next poll/restart.
router.post("/api-dev/cb/bot/:guildId/:action", ...secureDevApi, async (req, res) => {
  const { guildId, action } = req.params;
  if (!["start", "stop", "restart"].includes(action)) {
    return res.status(400).json({ error: "Invalid action. Use start, stop, or restart." });
  }

  try {
    const config = await CustomBranding.findOne({ guildId }).select("+encryptedToken").lean();
    if (!config) return res.status(404).json({ error: "No CB config for this guild" });

    if (action === "stop") {
      await CustomBranding.updateOne({ guildId }, { $set: { enabled: false, setupState: "disabled" } });
      cbm.stopGuild?.(guildId)?.catch(() => {});
      devLog("CB_BOT_STOP", { guildId }, req.user);
      return res.json({ success: true, state: "stopped" });
    }

    if (action === "start") {
      if (!config.encryptedToken) return res.status(400).json({ error: "No bot token — run setup first" });
      await CustomBranding.updateOne({ guildId }, { $set: { enabled: true, setupState: "pending" } });
      cbm.launchGuild?.(guildId)?.catch(e => console.error(`[CB-Dev] launchGuild error for ${guildId}:`, e.message));
      devLog("CB_BOT_START", { guildId }, req.user);
      return res.json({ success: true, state: "starting" });
    }

    if (action === "restart") {
      if (!config.encryptedToken) return res.status(400).json({ error: "No bot token — run setup first" });
      cbm.stopGuild?.(guildId)?.catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
      await CustomBranding.updateOne({ guildId }, { $set: { enabled: true, setupState: "pending" } });
      cbm.launchGuild?.(guildId)?.catch(e => console.error(`[CB-Dev] restart launchGuild error for ${guildId}:`, e.message));
      devLog("CB_BOT_RESTART", { guildId }, req.user);
      return res.json({ success: true, state: "starting" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET all CB bots with config + live status ─────────────────────────────────
// Live status comes from the real CB manager (noxx-cb process). The dashboard's
// cbm instance doesn't own workers, so getAllStatus() returns empty. We derive a
// display state from DB fields when live status is unavailable.
router.get("/api-dev/cb/bots", ...secureDevApi, async (req, res) => {
  try {
    let configs;
    try { configs = await CustomBranding.find().lean(); }
    catch (e) { return res.status(500).json({ error: "DB query failed: " + e.message }); }

    let statuses = [];
    try { statuses = cbm.getAllStatus?.() || []; }
    catch { /* status is optional */ }

    const statusMap = {};
    if (Array.isArray(statuses)) {
      for (const s of statuses) statusMap[s.guildId] = s;
    }

    const deriveState = (c) => {
      const live = statusMap[c.guildId];
      if (live) return live.state || "unknown";
      const e = !!c.enabled, s = c.setupState || "inactive";
      if (!e) return "disabled";
      if (s === "active") return "active";
      if (s === "pending" || s === "starting") return "pending";
      if (s === "error" || s === "failed") return "error";
      return "inactive";
    };

    const list = configs.map(c => ({
      guildId:      c.guildId,
      ownerId:      c.ownerId,
      botClientId:  c.botClientId || null,
      botName:      c.botName || null,
      enabled:      c.enabled,
      setupState:   c.setupState,
      setupError:   c.setupError || null,
      grantedAt:    c.grantedAt,
      state:        deriveState(c),
      botTag:       statusMap[c.guildId]?.botTag || null,
      ping:         statusMap[c.guildId]?.ping ?? null,
      uptime:       statusMap[c.guildId]?.uptime ?? null,
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
