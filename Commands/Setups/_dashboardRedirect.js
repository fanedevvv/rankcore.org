"use strict";
/**
 * dashboardRedirect.js
 * Shared execute() that replaces old setup command logic.
 * Directs users to configure the feature via the dashboard instead.
 */
const { MessageFlags, EmbedBuilder } = require("discord.js");

const DASHBOARD_BASE = `${process.env.DASHBOARD_URL || "https://dash.rankcore.org"}/guild`;

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} featureName  Human-readable name e.g. "Welcome Message"
 * @param {string} [path]       Optional dashboard path suffix e.g. "welcome"
 */
async function dashboardRedirect(interaction, featureName, path) {
  const guildId   = interaction.guildId;
  const dashUrl   = `${DASHBOARD_BASE}/${guildId}${path ? `/${path}` : ""}`;

  const embed = new EmbedBuilder()
    .setColor(0x6c63ff)
    .setTitle(`<:n_utils:1555544669545431062> Configure ${featureName}`)
    .setDescription(
      `Setup commands have moved to the **Dashboard** for a better experience.\n\n` +
      `Use the link below to configure **${featureName}** with a full visual editor, live previews, and more.\n\n` +
      `[**Open ${featureName} Settings →**](${dashUrl})`
    )
    .setFooter({ text: "RankCore Dashboard • dash.rankcore.org" });

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { dashboardRedirect };
