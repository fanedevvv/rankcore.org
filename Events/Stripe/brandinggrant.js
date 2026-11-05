"use strict";

/**
 * brandinggrant.js
 * Handles the 'brandingGrant' bot event emitted by the Stripe webhook handler
 * when a Custom Branding subscription is created, renewed, or cancelled.
 */

const { EmbedBuilder } = require("discord.js");
const {
  activateBrandingSubscription,
  deactivateBrandingSubscription,
} = require("../../Utils/brandingAccess");
const { PRICE_PLANS } = require("../../dashboard/webhooks/Stripe");

function resolveBillingFromPriceId(priceId) {
  const plan = PRICE_PLANS[priceId];
  if (!plan) return { billing: "monthly", durationDays: 30 };
  return { billing: plan.label?.toLowerCase() ?? "monthly", durationDays: plan.durationDays ?? 30 };
}

async function dmUser(client, userId, embed) {
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
  } catch { /* DMs off — ignore */ }
}

module.exports = {
  name: "brandingGrant",
  once: false,

  async execute(payload, client) {
    if (!payload || typeof payload !== "object") return;

    const { type, discordUserId, discordGuildId, priceId, subscriptionId, customerId } = payload;

    if (!discordUserId || !subscriptionId) {
      return console.error("[BrandingGrant] Missing required fields — ignoring.");
    }

    if (!discordGuildId) {
      // Can't activate without a guild ID — DM the user to let them know
      const embed = new EmbedBuilder()
        .setTitle("<:error:1555544434601369620> Custom Branding — Server ID Missing")
        .setColor(0xf59e0b)
        .setDescription(
          "Your Custom Branding subscription was received but **no Server ID was provided** during checkout.\n\n" +
          "Please contact support with your subscription ID so we can link it to your server."
        )
        .addFields({ name: "Subscription ID", value: subscriptionId })
        .setTimestamp();
      await dmUser(client, discordUserId, embed);
      console.warn(`[BrandingGrant] ${type} for user ${discordUserId} — no guildId provided.`);
      return;
    }

    // ── GRANT / RENEW ─────────────────────────────────────────────────────────
    if (type === "grant" || type === "renew") {
      try {
        const { billing, durationDays } = resolveBillingFromPriceId(priceId);

        await activateBrandingSubscription({
          guildId:        discordGuildId,
          userId:         discordUserId,
          subscriptionId,
          customerId,
          priceId,
          billing,
          durationDays,
        });

        const now       = new Date();
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        const embed = new EmbedBuilder()
          .setTitle(type === "renew" ? "<:n_add:1555544335036973106> Custom Branding Renewed" : "<:n_utils:1555544669545431062> Custom Branding Activated!")
          .setColor(0x8b5cf6)
          .setDescription(
            type === "renew"
              ? "Your **Custom Branding** subscription has been renewed for your server."
              : "**Custom Branding** is now active for your server! <:boost:1555544362455146576>\n\nHead to your server's dashboard to set up your bot's name, avatar, embed colour, and more."
          )
          .addFields(
            { name: "🏰 Server",   value: `Server ID: \`${discordGuildId}\``, inline: true },
            { name: "<:calendar:1555544372953616426> Expires",  value: `<t:${Math.floor(expiresAt / 1000)}:D>`, inline: true },
            { name: "<:n_utils:1555544669545431062> Setup",    value: `Visit your [dashboard](${process.env.DASHBOARD_URL}/guild/${discordGuildId}/custombranding) to configure branding`, inline: false }
          )
          .setFooter({ text: `Subscription: ${subscriptionId}` })
          .setTimestamp();

        await dmUser(client, discordUserId, embed);
        console.log(`[BrandingGrant] ${type} branding for guild ${discordGuildId} by user ${discordUserId}`);
      } catch (err) {
        console.error(`[BrandingGrant] Failed to ${type}:`, err);
      }

    // ── REVOKE ────────────────────────────────────────────────────────────────
    } else if (type === "revoke") {
      try {
        await deactivateBrandingSubscription(discordGuildId);

        const embed = new EmbedBuilder()
          .setTitle("<:crossy:1555544390221562048> Custom Branding Cancelled")
          .setColor(0xef4444)
          .setDescription(
            "Your **Custom Branding** subscription has ended.\n\n" +
            "The bot will revert to the default RankCore branding. Your configuration has been saved — " +
            "resubscribe anytime to restore it instantly."
          )
          .addFields(
            { name: "🏰 Server",    value: `Server ID: \`${discordGuildId}\``, inline: true },
            { name: "<:n_add:1555544335036973106> Resubscribe", value: `[Get Custom Branding again](${process.env.DASHBOARD_URL}/premium/branding)`, inline: true }
          )
          .setFooter({ text: `Subscription: ${subscriptionId}` })
          .setTimestamp();

        await dmUser(client, discordUserId, embed);
        console.log(`[BrandingGrant] Revoked branding for guild ${discordGuildId}`);
      } catch (err) {
        console.error("[BrandingGrant] Failed to revoke:", err);
      }
    }
  },
};
