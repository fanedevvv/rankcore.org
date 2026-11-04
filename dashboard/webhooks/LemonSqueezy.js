"use strict";

/**
 * POST /webhooks/lemonsqueezy — Lemon Squeezy subscription events.
 * Mounted with express.raw() so the HMAC signature can be checked against the exact body.
 * Subscribe in Lemon Squeezy to: subscription_created, subscription_updated, subscription_cancelled,
 * subscription_resumed, subscription_expired, subscription_paused, subscription_unpaused.
 */

const express = require("express");
const { verifySignature, syncSubscription } = require("../../Utils/lemonSqueezy");
const { getTier } = require("../../Utils/premiumTiers");

async function dmUser(userId, content) {
  const token = process.env.token;
  if (!token) return;
  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
  try {
    const dm = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST", headers, body: JSON.stringify({ recipient_id: userId }),
    }).then(r => r.json());
    if (!dm?.id) return;
    await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: "POST", headers, body: JSON.stringify({ content }),
    });
  } catch { /* DMs closed — ignore */ }
}

module.exports = function lemonSqueezyWebhook() {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (!verifySignature(raw, req.get("x-signature"))) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let event;
    try { event = JSON.parse(raw.toString("utf8")); }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }

    const name = event?.meta?.event_name;
    // Only subscription objects carry the full state we sync from; invoices/orders are covered by subscription_updated
    if (event?.data?.type !== "subscriptions") return res.json({ received: true, ignored: name });

    try {
      const result = await syncSubscription(event.data, event.meta?.custom_data || {});
      if (result?.ignored) {
        console.warn(`[LemonSqueezy] ${name} ignored: ${result.ignored}`);
        return res.json({ received: true, ignored: result.ignored });
      }
      console.log(`[LemonSqueezy] ${name}: ${result.kind} ${result.guildId || result.userId} → ${result.active ? "active" : "inactive"} (${result.status})`);

      const what = result.kind === "branding" ? "Custom Branding" : getTier(result.tier).name;
      const where = result.guildId ? " for your server" : "";
      if (name === "subscription_created") {
        await dmUser(result.userId, `<:premium:1467910095911256198> **${what}** is now active${where}. Thank you for supporting Roco! Manage it anytime at https://dash.rocobot.xyz/subscriptions`);
      } else if (name === "subscription_expired") {
        await dmUser(result.userId, `<:warn:1467879228249735188> Your **${what}** subscription${where} has ended. You can resubscribe anytime at https://dash.rocobot.xyz/premium`);
      }
      res.json({ received: true });
    } catch (err) {
      console.error(`[LemonSqueezy] ${name} failed:`, err.message);
      // 500 makes Lemon Squeezy retry the delivery later
      res.status(500).json({ error: "Processing failed" });
    }
  });

  return router;
};
