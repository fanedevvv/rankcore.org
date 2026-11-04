"use strict";
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { dashboardRedirect } = require("./_dashboardRedirect");

// /setup now redirects to the dashboard.
// All feature configuration has moved to the Roco Dashboard for a better experience.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDescription("Configure any Roco feature — opens the Dashboard.")
    .addStringOption(o =>
      o.setName("feature")
        .setDescription("Jump straight to a specific feature (optional)")
        .setRequired(false)
        .addChoices(
          { name: "Logging", value: "logging" },
          { name: "Verification", value: "verification" },
          { name: "Modmail", value: "modmail" },
          { name: "Auto Role", value: "autorole" },
          { name: "Reaction Roles", value: "reactionrole" },
          { name: "Tickets", value: "tickets" },
          { name: "Anti Ghost Ping", value: "antighostping" },
          { name: "Anti Link / Automod", value: "antilink" },
          { name: "Anti Raid", value: "antiraid" },
          { name: "Anti Scam", value: "antiscam" },
          { name: "Leveling", value: "leveling" },
          { name: "Voice Leveling", value: "voiceleveling" },
          { name: "Level Roles", value: "levelroles" },
          { name: "Counting", value: "counting" },
          { name: "Suggestions", value: "suggestion" },
          { name: "Join Ping", value: "joinping" },
          { name: "Join to Create", value: "jointocreate" },
          { name: "Guess the Number", value: "guessthenumber" },
          { name: "Welcome", value: "welcome" },
          { name: "Goodbye", value: "goodbye" },
          { name: "Booster", value: "booster" },
          { name: "Sticky Messages", value: "sticky" },
          { name: "Uptime", value: "uptime" }
        )
    ),

  async execute(interaction, client) {
    const feature = interaction.options.getString("feature");
    const paths = {
      logging: "logs", verification: "verify", modmail: "modmail",
      autorole: "autorole", reactionrole: "reactionrole", tickets: "ticket",
      antighostping: "ghostping", antilink: "automod", antiraid: "massjoin",
      antiscam: "antiscam", leveling: "leveling", voiceleveling: "leveling",
      levelroles: "leveling", counting: "counting", suggestion: "suggestion",
      joinping: "joinping", jointocreate: "jtc", guessthenumber: "guessthenumber",
      welcome: "welcome", goodbye: "goodbye", booster: "booster",
      sticky: "sticky", uptime: "uptime",
    };
    const path = feature && paths[feature.toLowerCase()] ? paths[feature.toLowerCase()] : null;
    const LABELS = {logging: "Logging", verification: "Verification", modmail: "Modmail", autorole: "Auto Role", reactionrole: "Reaction Roles", tickets: "Tickets", antighostping: "Anti Ghost Ping", antilink: "Anti Link / Automod", antiraid: "Anti Raid", antiscam: "Anti Scam", leveling: "Leveling", voiceleveling: "Voice Leveling", levelroles: "Level Roles", counting: "Counting", suggestion: "Suggestions", joinping: "Join Ping", jointocreate: "Join to Create", guessthenumber: "Guess the Number", welcome: "Welcome", goodbye: "Goodbye", booster: "Booster", sticky: "Sticky Messages", uptime: "Uptime"};
    const featureName = feature ? (LABELS[feature.toLowerCase()] || feature) : "Roco";
    return dashboardRedirect(interaction, featureName || "Roco Settings", path || "");
  },
};
