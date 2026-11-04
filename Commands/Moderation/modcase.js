const { parseEmoji } = require('discord.js');
const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} = require("discord.js");
const { successContainer, errorContainer, modActionContainer, ACCENT } = require("../../Utils/v2helpers");
const warningSchema = require("../../Schemas/warnSchema");

const SEVERITY_EMOJI   = { low: "<:error:1555544434601369620>", medium: "<:error:1555544434601369620>", high: "<:LEred:1555544262123323422>", critical: "<:error:1555544434601369620>" };
const SEVERITY_POINTS  = { low: 1, medium: 2, high: 3, critical: 5 };
const SEVERITY_COLORS  = { low: ACCENT.warning, medium: 0xFF8C00, high: ACCENT.error, critical: 0x8B0000 };
const PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modcase")
    .setDMPermission(false)
    .setDescription("<:files:1555544445565407352> Browse, search and manage all moderation cases for this server.")
    .addSubcommand(c => c.setName("browse")
      .setDescription("<:files:1555544445565407352> Browse all moderation records with filters and pagination.")
      .addStringOption(o => o.setName("filter").setDescription("Filter by severity.").setRequired(false)
        .addChoices(
          { name: "<:error:1555544434601369620> Low",      value: "low"      },
          { name: "<:error:1555544434601369620> Medium",   value: "medium"   },
          { name: "<:LEred:1555544262123323422> High",     value: "high"     },
          { name: "<:error:1555544434601369620> Critical", value: "critical" },
        ))
      .addUserOption(o => o.setName("moderator").setDescription("Filter by moderator who issued the case.").setRequired(false))
      .addStringOption(o => o.setName("sort").setDescription("Sort order.").setRequired(false)
        .addChoices(
          { name: "Newest First", value: "newest" },
          { name: "Oldest First", value: "oldest" },
          { name: "Highest Severity", value: "severity" },
        )))
    .addSubcommand(c => c.setName("user")
      .setDescription("<:user:1555544664155889668> View the complete moderation profile for a specific user.")
      .addUserOption(o => o.setName("user").setDescription("The user to look up.").setRequired(true)))
    .addSubcommand(c => c.setName("stats")
      .setDescription("<:n_utils:1555544669545431062> View moderation statistics for this server."))
    .addSubcommand(c => c.setName("lookup")
      .setDescription("<:n_search:1555544554365788191> Look up a case by its case number.")
      .addStringOption(o => o.setName("case").setDescription("The case number (e.g. #12345).").setRequired(true)))
    .addSubcommand(c => c.setName("note")
      .setDescription("<:files:1555544445565407352> Add a note to an existing warning.")
      .addUserOption(o => o.setName("user").setDescription("The user the warning belongs to.").setRequired(true))
      .addStringOption(o => o.setName("case").setDescription("The case number to annotate.").setRequired(true))
      .addStringOption(o => o.setName("note").setDescription("The note to add.").setRequired(true).setMaxLength(300))),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({
        components: [errorContainer("Permission Denied", "You need at least **Kick Members** permission to view mod cases.", { clientId: client.user.id })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const sub    = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    // ── BROWSE ─────────────────────────────────────────────────────────────
    if (sub === "browse") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const severityFilter = interaction.options.getString("filter");
      const modFilter      = interaction.options.getUser("moderator");
      const sort           = interaction.options.getString("sort") || "newest";

      const allDocs = await warningSchema.find({ GuildID: interaction.guildId });
      const cases = [];
      for (const doc of allDocs) {
        for (const warn of doc.Content) {
          if (severityFilter && warn.Severity !== severityFilter) continue;
          if (modFilter && warn.ExecuterId !== modFilter.id) continue;
          cases.push({ userId: doc.UserID, userTag: doc.UserTag, ...warn.toObject?.() ?? warn });
        }
      }

      if (!cases.length) {
        return interaction.editReply({
          components: [successContainer("<:files:1555544445565407352> Mod Cases", "No moderation cases found matching your filters.", { accent, clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (sort === "newest")   cases.sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));
      if (sort === "oldest")   cases.sort((a, b) => new Date(a.Timestamp || 0) - new Date(b.Timestamp || 0));
      if (sort === "severity") cases.sort((a, b) => (SEVERITY_POINTS[b.Severity] || 1) - (SEVERITY_POINTS[a.Severity] || 1));

      let page = 0;
      const totalPages = Math.ceil(cases.length / PER_PAGE);

      function buildPage(p) {
        const slice = cases.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
        const lines = slice.map((c, i) => {
          const ts  = c.Timestamp ? `<t:${Math.floor(new Date(c.Timestamp).getTime() / 1000)}:d>` : "?";
          const sev = c.Severity || "low";
          return `**${SEVERITY_EMOJI[sev]} ${c.CaseNumber || `Case ${p * PER_PAGE + i + 1}`}** — <@${c.userId}> • ${ts}\n> ${c.Reason?.slice(0, 80) || "No reason"} — by ${c.ExecuterTag}`;
        }).join("\n\n");

        return successContainer(
          `<:files:1555544445565407352> Mod Cases${severityFilter ? ` — ${severityFilter.toUpperCase()}` : ""}${modFilter ? ` by ${modFilter.username}` : ""}`,
          lines,
          { accent, clientId: client.user.id, footer: `Page ${p + 1}/${totalPages} • ${cases.length} total case(s)` }
        );
      }

      function buildRow(p) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("browse_first").setLabel('​').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId("browse_prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId("browse_page").setLabel(`${p + 1}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId("browse_next").setLabel('​').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary).setDisabled((p + 1) >= totalPages),
          new ButtonBuilder().setCustomId("browse_export").setLabel("Export").setEmoji(parseEmoji('<:files:1555544445565407352>')).setStyle(ButtonStyle.Secondary),
        );
      }

      await interaction.editReply({ components: [buildPage(page), buildRow(page)], flags: MessageFlags.IsComponentsV2 });

      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: b => b.user.id === interaction.user.id,
        time: 180_000,
      });

      collector.on("collect", async b => {
        if (b.customId === "browse_first") { page = 0; }
        else if (b.customId === "browse_prev")  { page = Math.max(0, page - 1); }
        else if (b.customId === "browse_next")  { page = Math.min(totalPages - 1, page + 1); }
        else if (b.customId === "browse_export") {
          const summary = cases.slice(0, 30).map((c, i) =>
            `[${i + 1}] ${c.CaseNumber || "N/A"} | ${c.userTag} | ${(c.Severity || "low").toUpperCase()} | ${c.Reason?.slice(0, 60) || "?"} | by ${c.ExecuterTag}`
          ).join("\n");
          return b.reply({
            content: `<:files:1555544445565407352> **Case Export (${cases.length} cases)**\n\`\`\`\n${summary.slice(0, 1900)}\n\`\`\``,
            flags: MessageFlags.Ephemeral,
          });
        }
        await b.update({ components: [buildPage(page), buildRow(page)], flags: MessageFlags.IsComponentsV2 });
      });

      collector.on("end", () => {
        interaction.editReply({ components: [buildPage(page)] }).catch(() => {});
      });
    }

    // ── USER PROFILE ────────────────────────────────────────────────────────
    if (sub === "user") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const targetUser = interaction.options.getUser("user");
      const doc = await warningSchema.findOne({ GuildID: interaction.guildId, UserID: targetUser.id });
      const warns = doc?.Content || [];

      const totalPoints = warns.reduce((a, w) => a + (SEVERITY_POINTS[w.Severity] || 1), 0);
      const sevCounts   = { low: 0, medium: 0, high: 0, critical: 0 };
      warns.forEach(w => { if (sevCounts[w.Severity] !== undefined) sevCounts[w.Severity]++; });

      const riskLevel =
        totalPoints >= 15 ? "<:error:1555544434601369620> CRITICAL RISK" :
        totalPoints >= 10 ? "<:LEred:1555544262123323422> HIGH RISK"     :
        totalPoints >= 5  ? "<:error:1555544434601369620> MODERATE RISK" :
        totalPoints >= 1  ? "<:error:1555544434601369620> LOW RISK"      : "<:LEgreen:1555544256356159600> CLEAN";

      const recentLines = warns.slice(-5).reverse().map(w => {
        const ts = w.Timestamp ? `<t:${Math.floor(new Date(w.Timestamp).getTime() / 1000)}:d>` : "?";
        return `${SEVERITY_EMOJI[w.Severity] || "<:error:1555544434601369620>"} **${w.CaseNumber || "?"}** — ${w.Reason?.slice(0, 70) || "?"} — ${ts}`;
      }).join("\n");

      const profileContent =
        `**User** — <@${targetUser.id}> (${targetUser.tag})\n` +
        `**Total Warnings** — ${warns.length}\n**Risk Points** — ${totalPoints} (${riskLevel})\n\n` +
        `<:error:1555544434601369620> Low: **${sevCounts.low}** • <:error:1555544434601369620> Medium: **${sevCounts.medium}** • <:LEred:1555544262123323422> High: **${sevCounts.high}** • <:error:1555544434601369620> Critical: **${sevCounts.critical}**` +
        (recentLines ? `\n\n**Recent Cases:**\n${recentLines}` : "");

      const profileColor = totalPoints >= 10 ? ACCENT.error : totalPoints >= 5 ? 0xFF8C00 : ACCENT.success;

      const container = new ContainerBuilder().setAccentColor(profileColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:files:1555544445565407352> Mod Profile — ${targetUser.tag}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(profileContent))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mcprofile_clear_${targetUser.id}`).setLabel("Clear All").setEmoji(parseEmoji('<:del:1555544395720302643>')).setStyle(ButtonStyle.Danger).setDisabled(!warns.length),
            new ButtonBuilder().setCustomId(`mcprofile_warn_${targetUser.id}`).setLabel("Add Warning").setEmoji(parseEmoji('<:error:1555544434601369620>')).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`mcprofile_timeout_${targetUser.id}`).setLabel("Timeout").setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`mcprofile_export_${targetUser.id}`).setLabel("Export").setEmoji(parseEmoji('<:files:1555544445565407352>')).setStyle(ButtonStyle.Secondary),
          )
        );

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

      const c = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: b => b.user.id === interaction.user.id,
        max: 1, time: 30_000,
      });

      c.on("collect", async b => {
        if (b.customId.startsWith("mcprofile_clear_")) {
          await warningSchema.findOneAndDelete({ GuildID: interaction.guildId, UserID: targetUser.id });
          await b.update({
            components: [successContainer("<:del:1555544395720302643> Cases Cleared", `All ${warns.length} case(s) for ${targetUser.tag} have been cleared.`, { accent, clientId: client.user.id })],
            flags: MessageFlags.IsComponentsV2,
          });
        } else if (b.customId.startsWith("mcprofile_warn_")) {
          await b.reply({ content: `Run \`/warn add user:${targetUser.username}\` to add a warning.`, flags: MessageFlags.Ephemeral });
        } else if (b.customId.startsWith("mcprofile_timeout_")) {
          await b.reply({ content: `Run \`/timeout add user:${targetUser.username}\` to issue a timeout.`, flags: MessageFlags.Ephemeral });
        } else if (b.customId.startsWith("mcprofile_export_")) {
          const exportLines = warns.map((w, i) =>
            `[${i + 1}] ${w.CaseNumber || "?"} | ${(w.Severity || "low").toUpperCase()} | ${w.Reason?.slice(0, 80) || "?"} | by ${w.ExecuterTag}`
          ).join("\n");
          await b.reply({
            content: `<:files:1555544445565407352> **Cases for ${targetUser.tag}**\n\`\`\`\n${exportLines.slice(0, 1900) || "No cases."}\n\`\`\``,
            flags: MessageFlags.Ephemeral,
          });
        }
      });
    }

    // ── STATS ───────────────────────────────────────────────────────────────
    if (sub === "stats") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const allDocs = await warningSchema.find({ GuildID: interaction.guildId });

      let totalCases = 0, totalPoints = 0;
      const modCounts  = {};
      const sevCounts  = { low: 0, medium: 0, high: 0, critical: 0 };
      const userCounts = {};
      const recentCases = [];

      for (const doc of allDocs) {
        for (const w of doc.Content) {
          totalCases++;
          totalPoints += SEVERITY_POINTS[w.Severity] || 1;
          if (sevCounts[w.Severity] !== undefined) sevCounts[w.Severity]++;
          modCounts[w.ExecuterTag]  = (modCounts[w.ExecuterTag]  || 0) + 1;
          userCounts[doc.UserID]    = (userCounts[doc.UserID]    || 0) + 1;
          recentCases.push({ ...w.toObject?.() ?? w, userId: doc.UserID });
        }
      }

      recentCases.sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));
      const topMod  = Object.entries(modCounts).sort((a, b) => b[1] - a[1])[0];
      const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
      const recent3 = recentCases.slice(0, 3).map(c => {
        const ts = c.Timestamp ? `<t:${Math.floor(new Date(c.Timestamp).getTime() / 1000)}:d>` : "?";
        return `${SEVERITY_EMOJI[c.Severity] || "<:error:1555544434601369620>"} <@${c.userId}> — ${c.Reason?.slice(0, 60) || "?"} — ${ts}`;
      }).join("\n");

      const statsContent =
        `**Total Cases** — ${totalCases} | **Total Points** — ${totalPoints}\n` +
        `**Users Warned** — ${allDocs.length}\n\n` +
        `<:error:1555544434601369620> Low: **${sevCounts.low}** • <:error:1555544434601369620> Medium: **${sevCounts.medium}** • <:LEred:1555544262123323422> High: **${sevCounts.high}** • <:error:1555544434601369620> Critical: **${sevCounts.critical}**\n\n` +
        `**Most Active Mod** — ${topMod ? `${topMod[0]} (${topMod[1]} cases)` : "—"}\n` +
        `**Most Warned User** — ${topUser ? `<@${topUser[0]}> (${topUser[1]} warns)` : "—"}` +
        (recent3 ? `\n\n**Recent Cases:**\n${recent3}` : "");

      return interaction.editReply({
        components: [successContainer("<:n_utils:1555544669545431062> Server Mod Statistics", statsContent, {
          accent, clientId: client.user.id,
          footer: `${interaction.guild.name} • ${new Date().toLocaleDateString()}`,
        })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── LOOKUP ──────────────────────────────────────────────────────────────
    if (sub === "lookup") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const caseInput = interaction.options.getString("case");
      const allDocs   = await warningSchema.find({ GuildID: interaction.guildId });

      let found = null;
      let foundUserId;
      for (const doc of allDocs) {
        const w = doc.Content.find(w => w.CaseNumber === caseInput || w.CaseNumber === caseInput.toUpperCase());
        if (w) { found = w; foundUserId = doc.UserID; break; }
      }

      if (!found)
        return interaction.editReply({
          components: [errorContainer("Not Found", `No case found with number **${caseInput}**.`, { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });

      const ts = found.Timestamp ? `<t:${Math.floor(new Date(found.Timestamp).getTime() / 1000)}:F>` : "Unknown";
      return interaction.editReply({
        components: [successContainer(`<:n_search:1555544554365788191> Case ${found.CaseNumber}`,
          `**User** — <@${foundUserId}>\n**Severity** — ${SEVERITY_EMOJI[found.Severity] || "<:error:1555544434601369620>"} ${found.Severity}\n**Reason** — ${found.Reason}\n**Issued by** — ${found.ExecuterTag}\n**Date** — ${ts}${found._note ? `\n**Note** — ${found._note}` : ""}`,
          { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── NOTE ────────────────────────────────────────────────────────────────
    if (sub === "note") {
      const targetUser = interaction.options.getUser("user");
      const caseInput  = interaction.options.getString("case");
      const note       = interaction.options.getString("note");

      const ephErr = (title, body) => interaction.reply({
        components: [errorContainer(title, body, { clientId: client.user.id })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      const doc = await warningSchema.findOne({ GuildID: interaction.guildId, UserID: targetUser.id });
      if (!doc) return ephErr("No Warnings", `${targetUser.tag} has no warnings.`);

      const warn = doc.Content.find(w => w.CaseNumber === caseInput || w.CaseNumber === caseInput.toUpperCase());
      if (!warn) return ephErr("Not Found", `No case **${caseInput}** found for this user.`);

      warn._note = note;
      warn.markModified?.("_note");
      doc.markModified("Content");
      await doc.save();

      return interaction.reply({
        components: [successContainer("<:files:1555544445565407352> Note Added", `Note added to case **${caseInput}** for **${targetUser.tag}**.`, {
          accent, clientId: client.user.id,
          extra: `**Note** — ${note}\n**Added by** — ${interaction.user.tag}`,
        })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  },
};
