"use strict";

// Setup / config has moved to the Roco Dashboard.
// This file only registers the user-facing and staff subcommands that still
// run through Discord slash commands.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("Suggestion system.")
    .setDMPermission(false)

    // ── /suggestion send ──────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("send")
      .setDescription("Submit a suggestion to the community.")
      .addStringOption(o => o
        .setName("suggestion")
        .setDescription("Your suggestion (be specific!).")
        .setRequired(true)
        .setMaxLength(1024)
      )
    )

    // ── /suggestion edit ──────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("edit")
      .setDescription("Edit your own suggestion (only before it receives votes).")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of your suggestion.").setRequired(true))
      .addStringOption(o => o.setName("new_text").setDescription("Updated suggestion text.").setRequired(true).setMaxLength(1024))
    )

    // ── /suggestion delete ────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("delete")
      .setDescription("Delete your own suggestion.")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of your suggestion.").setRequired(true))
    )

    // ── /suggestion info ──────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("info")
      .setDescription("View details and vote breakdown for a suggestion.")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of the suggestion.").setRequired(true))
    )

    // ── /suggestion approve ───────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("approve")
      .setDescription("[Staff] Approve a suggestion.")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of the suggestion.").setRequired(true))
      .addStringOption(o => o.setName("note").setDescription("Optional note to include.").setRequired(false))
    )

    // ── /suggestion reject ────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("reject")
      .setDescription("[Staff] Reject a suggestion.")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of the suggestion.").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason for rejection.").setRequired(false))
    )

    // ── /suggestion implement ─────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("implement")
      .setDescription("[Staff] Mark a suggestion as implemented.")
      .addStringOption(o => o.setName("message_id").setDescription("Message ID of the suggestion.").setRequired(true))
      .addStringOption(o => o.setName("note").setDescription("Implementation note.").setRequired(false))
    )

    // ── /suggestion stats ─────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName("stats")
      .setDescription("View suggestion system statistics for this server.")
    ),

  // Execute is handled by Events/Others/suggestions.js (interactionCreate listener).
  // This stub satisfies the command loader's typeof execute === 'function' check.
  async execute() {},
};