const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require("discord.js");
const { modActionContainer, errorContainer, successContainer, ACCENT } = require("../../Utils/v2helpers");
const { generateCase, parseDuration, formatDuration } = require("./_modUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout").setDMPermission(false)
    .setDescription("Temporarily mute a server member.")
    .addSubcommand(s => s.setName("add").setDescription("Apply a timeout to a member.")
      .addUserOption(o => o.setName("user").setDescription("The user to time out.").setRequired(true))
      .addStringOption(o => o.setName("duration").setRequired(true).setDescription("Duration (e.g. 10m, 2h, 1d) or choose a preset.")
        .addChoices(
          { name: "60 Seconds",  value: "60"     },
          { name: "5 Minutes",   value: "300"    },
          { name: "15 Minutes",  value: "900"    },
          { name: "30 Minutes",  value: "1800"   },
          { name: "1 Hour",      value: "3600"   },
          { name: "3 Hours",     value: "10800"  },
          { name: "6 Hours",     value: "21600"  },
          { name: "12 Hours",    value: "43200"  },
          { name: "1 Day",       value: "86400"  },
          { name: "3 Days",      value: "259200" },
          { name: "1 Week",      value: "604800" },
        ))
      .addStringOption(o => o.setName("reason").setDescription("Reason for the timeout.").setRequired(false).setMaxLength(512))
      .addStringOption(o => o.setName("severity").setDescription("Severity level for the mod log.").setRequired(false)
        .addChoices(
          { name: "<:error:1567796968758050868> Low",      value: "low"    },
          { name: "<:error:1567796968758050868> Medium",   value: "medium" },
          { name: "<:LEred:1567796934545121280> High",     value: "high"   },
        ))
      .addBooleanOption(o => o.setName("silent").setDescription("Send silently (only visible to you).").setRequired(false))
      .addBooleanOption(o => o.setName("dm_user").setDescription("DM the user a notification (default: yes).").setRequired(false)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a timeout from a member.")
      .addUserOption(o => o.setName("user").setDescription("The user to untimeout.").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason for removing the timeout.").setRequired(false).setMaxLength(512))),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return ephErr("Permission Denied", "You need the **Moderate Members** permission to manage timeouts.");

    // ── ADD TIMEOUT ──────────────────────────────────────────────────────────
    if (sub === "add") {
      await interaction.deferReply();
      const timeUser   = interaction.options.getUser("user");
      const timeMember = await interaction.guild.members.fetch(timeUser.id).catch(() => null);
      const durationStr = interaction.options.getString("duration");
      const reason      = interaction.options.getString("reason")   || "No reason provided";
      const severity    = interaction.options.getString("severity") || "medium";
      const isSilent    = interaction.options.getBoolean("silent")  ?? false;
      const sendDm      = interaction.options.getBoolean("dm_user") ?? true;
      const caseNum     = generateCase();

      if (!timeMember)
        return interaction.editReply({ components: [errorContainer("User Not Found", "That user is no longer in this server.", { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });
      if (!timeMember.moderatable)
        return interaction.editReply({ components: [errorContainer("Hierarchy Error", "I cannot time out this user — check my role position.", { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });
      if (interaction.member.id === timeMember.id)
        return interaction.editReply({ components: [errorContainer("Invalid Target", "You cannot time out yourself.", { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });
      if (timeMember.permissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.editReply({ components: [errorContainer("Invalid Target", "You cannot time out a server administrator.", { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });
      if (interaction.member.id !== interaction.guild.ownerId &&
          interaction.member.roles.highest.position <= timeMember.roles.highest.position)
        return interaction.editReply({ components: [errorContainer("Hierarchy Error", "You cannot time out this user — they have an equal or higher role than you.", { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });

      const seconds = parseInt(durationStr);
      const durationLabel = formatDuration(seconds);
      const expiresAt = Math.floor(Date.now() / 1000) + seconds;

      let dmSent = false;
      if (sendDm) {
        try {
          const dmBox = new ContainerBuilder().setAccentColor(ACCENT.warning)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_music:1567796993403658261>  You have been timed out"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Server** — ${interaction.guild.name}\n**Duration** — ${durationLabel}\n**Reason** — ${reason}\n**Case** — ${caseNum}\n**Expires** — <t:${expiresAt}:R>`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Your timeout will expire automatically. Please follow server rules."));
          await timeUser.send({ components: [dmBox], flags: MessageFlags.IsComponentsV2 });
          dmSent = true;
        } catch {}
      }

      await timeMember.timeout(seconds * 1000, `[${caseNum}] Timeout by ${interaction.user.tag} | ${reason}`);

      const severityEmoji = { low: "<:error:1567796968758050868>", medium: "<:error:1567796968758050868>", high: "<:LEred:1567796934545121280>" };

      return interaction.editReply({
        components: [modActionContainer("<:n_music:1567796993403658261>", "Timeout Applied",
          `${timeUser.tag} (\`${timeUser.id}\`)`, reason, {
            accent, clientId: client.user.id,
            extra: `**Moderator** — ${interaction.user.tag}\n**Case** — ${caseNum}\n**Severity** — ${severityEmoji[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}\n**Duration** — ${durationLabel}\n**Expires** — <t:${expiresAt}:R>\n**DM Sent** — ${dmSent ? "<a:tickyy:1567797045253644368> Yes" : "<:crossy:1567796959648030831> No"}`,
            footer: `${interaction.guild.name} • ${new Date().toLocaleString()}`,
          })],
        flags: (isSilent ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
      });
    }

    // ── REMOVE TIMEOUT ───────────────────────────────────────────────────────
    if (sub === "remove") {
      const targetUser   = interaction.options.getUser("user");
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const reason       = interaction.options.getString("reason") || "No reason provided";

      if (!targetMember)
        return ephErr("User Not Found", "That user is not in this server.");
      if (!targetMember.communicationDisabledUntil)
        return ephErr("Not Timed Out", `**${targetUser.tag}** is not currently timed out.`);

      await targetMember.timeout(null, `Untimeout by ${interaction.user.tag} | ${reason}`);

      return interaction.reply({
        components: [modActionContainer("<:n_music:1567796993403658261>", "Timeout Removed",
          `${targetUser.tag} (\`${targetUser.id}\`)`, reason, {
            accent, clientId: client.user.id,
            extra: `**Moderator** — ${interaction.user.tag}`,
            footer: `${interaction.guild.name} • ${new Date().toLocaleString()}`,
          })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
