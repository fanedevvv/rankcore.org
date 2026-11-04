const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { successContainer, errorContainer, modActionContainer, ACCENT } = require("../../Utils/v2helpers");
const warningSchema = require("../../Schemas/warnSchema");
const { generateCase } = require("./_modUtils");

const SEVERITY_EMOJI = { low: "<:error:1555544434601369620>", medium: "<:error:1555544434601369620>", high: "<:LEred:1555544262123323422>", critical: "<:error:1555544434601369620>" };
const SEVERITY_POINTS = { low: 1, medium: 2, high: 3, critical: 5 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn").setDescription("Warning management for server members.")
    .setDMPermission(false)
    .addSubcommand(cmd => cmd.setName("add").setDescription("Warn a user for breaking a rule.")
      .addUserOption(o => o.setName("user").setDescription("The user to warn.").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason for the warning.").setRequired(true).setMaxLength(512))
      .addStringOption(o => o.setName("severity").setDescription("Severity level of the warning (default: low).").setRequired(false)
        .addChoices(
          { name: "<:error:1555544434601369620> Low",      value: "low"      },
          { name: "<:error:1555544434601369620> Medium",   value: "medium"   },
          { name: "<:LEred:1555544262123323422> High",     value: "high"     },
          { name: "<:error:1555544434601369620> Critical", value: "critical" },
        ))
      .addBooleanOption(o => o.setName("dm_user").setDescription("DM the user a notification (default: yes).").setRequired(false))
      .addBooleanOption(o => o.setName("silent").setDescription("Send silently (only visible to you).").setRequired(false)))
    .addSubcommand(cmd => cmd.setName("remove").setDescription("Remove a specific warning by case number.")
      .addUserOption(o => o.setName("user").setDescription("The user whose warning to remove.").setRequired(true))
      .addStringOption(o => o.setName("case").setDescription("The case number of the warning (e.g. #12345). Leave blank to remove the latest.").setRequired(false)))
    .addSubcommand(cmd => cmd.setName("clear").setDescription("Clear all warnings for a member.")
      .addUserOption(o => o.setName("user").setDescription("The user to clear warnings for.").setRequired(true))
      .addBooleanOption(o => o.setName("confirm").setDescription("Confirm clearing ALL warnings for this user.").setRequired(true)))
    .addSubcommand(cmd => cmd.setName("show").setDescription("View a member's warning history.")
      .addUserOption(o => o.setName("user").setDescription("The user to check.").setRequired(true))
      .addStringOption(o => o.setName("filter").setDescription("Filter by severity.").setRequired(false)
        .addChoices(
          { name: "<:error:1555544434601369620> Low",      value: "low"      },
          { name: "<:error:1555544434601369620> Medium",   value: "medium"   },
          { name: "<:LEred:1555544262123323422> High",     value: "high"     },
          { name: "<:error:1555544434601369620> Critical", value: "critical" },
        )))
    .addSubcommand(cmd => cmd.setName("search").setDescription("Search warnings by keyword in reasons.")
      .addStringOption(o => o.setName("query").setDescription("Keyword to search for.").setRequired(true))),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser("user");
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.warning;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return ephErr("Permission Denied", "You need the **Kick Members** permission to manage warnings.");

    // ── GUARD: prevent self-warn and bot-warn ────────────────────────────────
    if (sub === "add" || sub === "remove" || sub === "clear") {
      if (target && target.id === interaction.user.id)
        return ephErr("Invalid Target", "You cannot warn yourself.");
      if (target && target.bot)
        return ephErr("Invalid Target", "You cannot warn a bot.");
    }

    // ── ADD WARNING ──────────────────────────────────────────────────────────
    if (sub === "add") {
      const reason   = interaction.options.getString("reason");
      const severity = interaction.options.getString("severity") || "low";
      const sendDm   = interaction.options.getBoolean("dm_user") ?? true;
      const isSilent = interaction.options.getBoolean("silent")  ?? false;
      const caseNum  = generateCase();

      let data = await warningSchema.findOne({ GuildID: interaction.guildId, UserID: target.id });
      if (!data) {
        data = new warningSchema({
          GuildID: interaction.guildId, UserID: target.id, UserTag: target.username,
          Content: [],
        });
      }
      data.Content.push({
        CaseNumber: caseNum,
        ExecuterId: interaction.user.id,
        ExecuterTag: interaction.user.tag,
        Reason: reason,
        Severity: severity,
        Timestamp: new Date(),
        Active: true,
      });
      await data.save();

      const totalPoints = data.Content.reduce((a, w) => a + (SEVERITY_POINTS[w.Severity] || 1), 0);
      const activeWarns = data.Content.filter(w => w.Active !== false).length;

      let dmSent = false;
      if (sendDm) {
        try {
          const dmBox = new ContainerBuilder().setAccentColor(ACCENT.warning)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:error:1555544434601369620>  You received a warning"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Server** — ${interaction.guild.name}\n**Warned by** — ${interaction.user.tag}\n**Reason** — ${reason}\n**Severity** — ${SEVERITY_EMOJI[severity]} ${severity}\n**Case** — ${caseNum}\n**Total Warnings** — ${activeWarns}`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Please review the server rules to avoid further action."));
          await target.send({ components: [dmBox], flags: MessageFlags.IsComponentsV2 });
          dmSent = true;
        } catch {}
      }

      return interaction.reply({
        components: [modActionContainer("<:error:1555544434601369620>", "Warning Issued",
          `${target.tag} (\`${target.id}\`)`, reason, {
            accent, clientId: client.user.id,
            extra: `**Moderator** — ${interaction.user.tag}\n**Case** — ${caseNum}\n**Severity** — ${SEVERITY_EMOJI[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}\n**Total Warnings** — ${activeWarns} (${totalPoints} pts)\n**DM Sent** — ${dmSent ? "<a:tickyy:1555544712687915008> Yes" : "<:crossy:1555544390221562048> No"}`,
          })],
        flags: (isSilent ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
      });
    }

    // ── REMOVE WARNING ───────────────────────────────────────────────────────
    if (sub === "remove") {
      const caseInput = interaction.options.getString("case");
      const data = await warningSchema.findOne({ GuildID: interaction.guildId, UserID: target.id });
      if (!data || !data.Content.length)
        return ephErr("No Warnings", `${target.tag} has no warnings to remove.`);

      let removed;
      if (caseInput) {
        const idx = data.Content.findIndex(w => w.CaseNumber === caseInput || w.CaseNumber === caseInput.toUpperCase());
        if (idx === -1) return ephErr("Not Found", `No warning with case number **${caseInput}** found for this user.`);
        removed = data.Content.splice(idx, 1)[0];
      } else {
        removed = data.Content.pop();
      }
      await data.save();

      return interaction.reply({
        components: [successContainer("<:error:1555544434601369620>  Warning Removed",
          `Removed warning **${removed.CaseNumber}** from **${target.tag}**.`, {
            accent, clientId: client.user.id,
            extra: `**Reason Removed** — ${removed.Reason}\n**Severity** — ${SEVERITY_EMOJI[removed.Severity] || "<:error:1555544434601369620>"} ${removed.Severity}\n**Moderator** — ${interaction.user.tag}\n**Remaining Warnings** — ${data.Content.length}`,
          })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── CLEAR WARNINGS ───────────────────────────────────────────────────────
    if (sub === "clear") {
      const confirm = interaction.options.getBoolean("confirm");
      if (!confirm) return ephErr("Confirmation Required", "You must set `confirm: True` to clear all warnings.");

      const data = await warningSchema.findOne({ GuildID: interaction.guildId, UserID: target.id });
      if (!data || !data.Content.length)
        return ephErr("No Warnings", `${target.tag} has no warnings to clear.`);

      const count = data.Content.length;
      await warningSchema.findOneAndDelete({ GuildID: interaction.guildId, UserID: target.id });

      return interaction.reply({
        components: [successContainer("<:del:1555544395720302643>  Warnings Cleared",
          `All **${count}** warning(s) for **${target.tag}** have been cleared.`, {
            accent, clientId: client.user.id,
            extra: `**Moderator** — ${interaction.user.tag}`,
          })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── SHOW WARNINGS ────────────────────────────────────────────────────────
    if (sub === "show") {
      const filter = interaction.options.getString("filter");
      const data   = await warningSchema.findOne({ GuildID: interaction.guildId, UserID: target.id });
      const allWarns = data?.Content || [];
      const warns  = filter ? allWarns.filter(w => w.Severity === filter) : allWarns;

      if (!warns.length) {
        return interaction.reply({
          components: [successContainer("<:error:1555544434601369620>  Warning History",
            `**${target.tag}** has ${filter ? `no **${filter}**-severity` : "**0**"} warnings${filter ? "." : " — clean record! <a:tickyy:1555544712687915008>"}`, {
              accent, clientId: client.user.id,
            })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      const totalPoints = allWarns.reduce((a, w) => a + (SEVERITY_POINTS[w.Severity] || 1), 0);
      const riskLabel =
        totalPoints >= 15 ? "<:error:1555544434601369620> CRITICAL RISK" :
        totalPoints >= 10 ? "<:LEred:1555544262123323422> HIGH RISK" :
        totalPoints >= 5  ? "<:error:1555544434601369620> MODERATE RISK" :
        totalPoints >= 1  ? "<:error:1555544434601369620> LOW RISK" : "<:LEgreen:1555544256356159600> CLEAN";

      const lines = warns.slice(-15).reverse().map((w, i) => {
        const ts = w.Timestamp ? `<t:${Math.floor(new Date(w.Timestamp).getTime() / 1000)}:d>` : "?";
        return `**${SEVERITY_EMOJI[w.Severity] || "<:error:1555544434601369620>"} ${w.CaseNumber || `Warn ${i+1}`}** — ${ts}\n> **Reason:** ${w.Reason?.slice(0, 100)}\n> **By:** ${w.ExecuterTag}`;
      }).join("\n\n");

      return interaction.reply({
        components: [successContainer(`<:error:1555544434601369620>  Warning History — ${target.tag}`,
          lines, {
            accent, clientId: client.user.id,
            extra: `**Total Warnings** — ${allWarns.length}${filter ? ` (showing ${filter} only)` : ""}\n**Risk Points** — ${totalPoints} (${riskLabel})`,
            footer: `User ID: ${target.id}`,
          })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    // ── SEARCH ───────────────────────────────────────────────────────────────
    if (sub === "search") {
      const query = interaction.options.getString("query").toLowerCase();
      const allDocs = await warningSchema.find({ GuildID: interaction.guildId });
      const results = [];

      for (const doc of allDocs) {
        for (const w of doc.Content) {
          if (w.Reason?.toLowerCase().includes(query) || w.ExecuterTag?.toLowerCase().includes(query)) {
            results.push({ userId: doc.UserID, userTag: doc.UserTag, ...w });
          }
        }
      }

      if (!results.length)
        return ephErr("No Results", `No warnings found matching **${query}**.`);

      const lines = results.slice(0, 10).map(r => {
        const ts = r.Timestamp ? `<t:${Math.floor(new Date(r.Timestamp).getTime() / 1000)}:d>` : "?";
        return `**${SEVERITY_EMOJI[r.Severity] || "<:error:1555544434601369620>"} ${r.CaseNumber || "?"}** — <@${r.userId}> — ${ts}\n> ${r.Reason?.slice(0, 80)}`;
      }).join("\n\n");

      return interaction.reply({
        components: [successContainer(`<:n_search:1555544554365788191>  Warning Search — "${query}"`,
          lines, {
            accent, clientId: client.user.id,
            footer: `${results.length} result(s) found${results.length > 10 ? " — showing first 10" : ""}`,
          })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  },
};
