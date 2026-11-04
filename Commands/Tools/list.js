const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder
} = require("discord.js");

function getChannelLabel(channel) {
  switch (channel.type) {
    case ChannelType.GuildAnnouncement: return "<:announcement:1555544345740967956> [ANNOUNCEMENT]";
    case ChannelType.GuildForum: return "<:files:1555544445565407352> [FORUM]";
    case ChannelType.GuildVoice: return "<:n_music:1555544516746940416> [VOICE]";
    case ChannelType.GuildStageVoice: return "<:n_music:1555544516746940416> [STAGE]";
    case ChannelType.GuildMedia: return "<:files:1555544445565407352> [MEDIA]";
    case ChannelType.GuildText: return "<:suggestion:1555544601501237322> [TEXT]";
    default: return `[${channel.type}]`;
  }
}

function formatChannelPerms(channel) {
  const overwrites = channel.permissionOverwrites.cache;
  if (!overwrites.size) return "  (no overwrites)";

  let out = "";

  overwrites.forEach(over => {
    const allow = over.allow.toArray();
    const deny = over.deny.toArray();

    out += `  └─ ${over.type === 0 ? "Role" : "Member"}: ${over.id}\n`;

    if (allow.length)
      out += `      ✔ Allow: ${allow.join(", ")}\n`;

    if (deny.length)
      out += `      ✖ Deny: ${deny.join(", ")}\n`;
  });

  return out;
}

// Human-readable labels for Discord permission flags
const PERMISSION_LABELS = {
  AddReactions: "Add Reactions",
  Administrator: "Administrator",
  AttachFiles: "Attach Files",
  BanMembers: "Ban Members",
  ChangeNickname: "Change Nickname",
  Connect: "Connect",
  CreateInstantInvite: "Create Invite",
  CreatePrivateThreads: "Create Private Threads",
  CreatePublicThreads: "Create Public Threads",
  DeafenMembers: "Deafen Members",
  EmbedLinks: "Embed Links",
  KickMembers: "Kick Members",
  ManageChannels: "Manage Channels",
  ManageEmojisAndStickers: "Manage Emojis & Stickers",
  ManageEvents: "Manage Events",
  ManageGuild: "Manage Server",
  ManageMessages: "Manage Messages",
  ManageNicknames: "Manage Nicknames",
  ManageRoles: "Manage Roles",
  ManageThreads: "Manage Threads",
  ManageWebhooks: "Manage Webhooks",
  MentionEveryone: "Mention Everyone",
  ModerateMembers: "Timeout Members",
  MoveMembers: "Move Members",
  MuteMembers: "Mute Members",
  PrioritySpeaker: "Priority Speaker",
  ReadMessageHistory: "Read Message History",
  RequestToSpeak: "Request to Speak",
  SendMessages: "Send Messages",
  SendMessagesInThreads: "Send Messages in Threads",
  SendTTSMessages: "Send TTS Messages",
  SendVoiceMessages: "Send Voice Messages",
  Speak: "Speak",
  Stream: "Stream / Go Live",
  UseApplicationCommands: "Use Application Commands",
  UseEmbeddedActivities: "Use Activities",
  UseExternalEmojis: "Use External Emojis",
  UseExternalSounds: "Use External Sounds",
  UseExternalStickers: "Use External Stickers",
  UseSoundboard: "Use Soundboard",
  UseVAD: "Use Voice Activity",
  ViewAuditLog: "View Audit Log",
  ViewChannel: "View Channel",
  ViewCreatorMonetizationAnalytics: "View Monetization Analytics",
  ViewGuildInsights: "View Server Insights",
};

/**
 * Returns a sorted, human-readable list of granted permissions for a role.
 * If the role has Administrator, that is returned alone (it implies all perms).
 */
function getRolePermissionList(role) {
  const perms = role.permissions;
  if (perms.has(PermissionFlagsBits.Administrator)) return ["Administrator"];

  return Object.entries(PERMISSION_LABELS)
    .filter(([flag]) => perms.has(PermissionFlagsBits[flag]))
    .map(([, label]) => label)
    .sort();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("Admin server info toolkit.")
    .setDMPermission(false)

    // ----------------- CHANNELS -----------------
    .addSubcommand(sub =>
      sub
        .setName("channels")
        .setDescription("List all server channels.")
        .addBooleanOption(opt =>
          opt
            .setName("show_ids")
            .setDescription("Include channel IDs in the output (default: true)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("file_output")
            .setDescription("Send results as a .txt file attachment (default: true)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
  opt
    .setName("show_threads")
    .setDescription("Show threads under channels (default: true)")
    .setRequired(false)
)
.addBooleanOption(opt =>
  opt
    .setName("show_permissions")
    .setDescription("Show channel permission overwrites (default: false)")
    .setRequired(false)
)
    )

    // ----------------- ROLES -----------------
    .addSubcommand(sub =>
      sub
        .setName("roles")
        .setDescription("List all server roles.")
        .addBooleanOption(opt =>
          opt
            .setName("show_permissions")
            .setDescription("Include each role's granted permissions in the output (default: false)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("show_ids")
            .setDescription("Include role IDs in the output (default: true)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("file_output")
            .setDescription("Send results as a .txt file attachment (default: true)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
  opt
    .setName("show_managed_roles")
    .setDescription("Show if a role is managed by a bot/integration (default: false)")
    .setRequired(false)
)
    )

    // ----------------- MEMBERS -----------------
    .addSubcommand(sub =>
      sub
        .setName("members")
        .setDescription("Show member counts.")
        .addBooleanOption(opt =>
          opt
            .setName("show_ids")
            .setDescription("Include user IDs alongside member names (default: false)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("list_members")
            .setDescription("Output a full member list instead of just counts (default: false)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("file_output")
            .setDescription("Send results as a .txt file attachment when listing members (default: true)")
            .setRequired(false)
        )
    )



    // ----------------- EMOJIS -----------------
    .addSubcommand(sub =>
      sub
        .setName("emojis")
        .setDescription("Show emojis & stickers.")
        .addBooleanOption(opt =>
          opt
            .setName("show_ids")
            .setDescription("Include emoji/sticker IDs in the output (default: true)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("show_markdown")
            .setDescription("Include the Discord markdown string for each emoji (default: true)")
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("file_output")
            .setDescription("Send results as a .txt file attachment (default: true)")
            .setRequired(false)
        )
    ),

  /**
   * @param {ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const { guild, member } = interaction;
      if (!guild)
        return interaction.editReply({
          content: "This command can only be used in servers.",
          flags: MessageFlags.Ephemeral,
        });

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: "<:crossy:1555544390221562048> You must be **Administrator** to use this command.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const sub = interaction.options.getSubcommand();

if (sub === "channels") {
  const showIds       = interaction.options.getBoolean("show_ids") ?? true;
  const fileOutput    = interaction.options.getBoolean("file_output") ?? true;
  const showThreads   = interaction.options.getBoolean("show_threads") ?? true;
  const showPerms     = interaction.options.getBoolean("show_permissions") ?? false;

  const channels = guild.channels.cache.sort(
    (a, b) => a.rawPosition - b.rawPosition
  );

  const idSuffix = (id) => showIds ? ` — \`${id}\`` : "";

  let output = "";

  channels
    .filter(c => c.type === ChannelType.GuildCategory)
    .forEach(cat => {
      output += `\n# ${cat.name}${idSuffix(cat.id)}\n`;

      channels
        .filter(c => c.parentId === cat.id && !c.isThread())
        .forEach(ch => {
          output += `  └─ ${getChannelLabel(ch)} ${ch.name}${idSuffix(ch.id)}\n`;

          // permissions (optional)
          if (showPerms) {
            const perms = formatChannelPerms(ch);
            if (perms) output += perms;
          }

          // threads (optional)
          if (showThreads) {
            channels
              .filter(t => t.isThread() && t.parentId === ch.id)
              .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
              .forEach(thread =>
                (output += `      └─ <:thread:1555544613035708426> ${thread.name}${idSuffix(thread.id)}\n`)
              );
          }
        });
    });

  const noCat = channels.filter(
    c => !c.parentId && c.type !== ChannelType.GuildCategory && !c.isThread()
  );

  if (noCat.size > 0) {
    output += `\n# No Category\n`;

    noCat.forEach(ch => {
      output += `  └─ ${getChannelLabel(ch)} ${ch.name}${idSuffix(ch.id)}\n`;

      if (showPerms) {
        const perms = formatChannelPerms(ch);
        if (perms) output += perms;
      }

      if (showThreads) {
        channels
          .filter(t => t.isThread() && t.parentId === ch.id)
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .forEach(thread =>
            (output += `      └─ <:thread:1555544613035708426> ${thread.name}${idSuffix(thread.id)}\n`)
          );
      }
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`<:files:1555544445565407352> Channels in ${guild.name}`)
    .setDescription(`Total channels: **${channels.size}**`)
    .setColor("#5865F2");

  if (fileOutput) {
    const file = new AttachmentBuilder(
      Buffer.from(output.trim(), "utf-8"),
      { name: "channels.txt" }
    );
    return interaction.editReply({ embeds: [embed], files: [file] });
  }

  const truncated = output.length > 3800
    ? output.slice(0, 3800) + "\n…(truncated, enable file_output for full list)"
    : output;

  embed.setDescription(
    embed.data.description + "\n```\n" + truncated.trim() + "\n```"
  );

  return interaction.editReply({ embeds: [embed] });
}

      // ─────────────────── ROLES ───────────────────
      if (sub === "roles") {
        const showManaged = interaction.options.getBoolean("show_managed_roles") ?? false;
        const showPerms  = interaction.options.getBoolean("show_permissions") ?? false;
        const showIds    = interaction.options.getBoolean("show_ids")         ?? true;
        const fileOutput = interaction.options.getBoolean("file_output")      ?? true;

        const roles = guild.roles.cache.sort((a, b) => b.position - a.position);

        if (!roles.size)
          return interaction.editReply("No roles found in this server.");

        const idSuffix = (id) => showIds ? ` — \`${id}\`` : "";

        let output = "";

        roles.forEach(role => {
          let roleLine = `${role.name}${idSuffix(role.id)}`;

          if (showManaged && role.managed) {
              roleLine += " [BOT MANAGED - Cannot be deleted manually, remove the bot/integration first]";
          }

          output += roleLine;

          if (showPerms) {
            const permList = getRolePermissionList(role);
            output += permList.length === 0
              ? `\n  Permissions: (none)\n`
              : `\n  Permissions: ${permList.join(", ")}\n`;
          } else {
            output += "\n";
          }
        });

        const fileName = showPerms ? "roles_with_permissions.txt" : "roles.txt";

        const embed = new EmbedBuilder()
          .setTitle(`<:minigames:1555544500179439707> Roles in ${guild.name}`)
          .setDescription(
            `Total roles: **${roles.size}**` +
            (showPerms ? "\n_Permissions included in attached file._" : "") +
            (showIds   ? "\n_IDs included in attached file._"         : "")
          )
          .setColor("#F1C40F");

        if (fileOutput) {
          const file = new AttachmentBuilder(
            Buffer.from(output.trim(), "utf-8"),
            { name: fileName }
          );
          return interaction.editReply({ embeds: [embed], files: [file] });
        }

        const truncated = output.length > 3800
          ? output.slice(0, 3800) + "\n…(truncated, enable file_output for full list)"
          : output;
        embed.setDescription(embed.data.description + "\n```\n" + truncated.trim() + "\n```");
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────── MEMBERS ───────────────────
      if (sub === "members") {
        const showIds     = interaction.options.getBoolean("show_ids")      ?? false;
        const listMembers = interaction.options.getBoolean("list_members")  ?? false;
        const fileOutput  = interaction.options.getBoolean("file_output")   ?? true;

        const members = guild.members.cache;
        const bots    = members.filter(m => m.user.bot).size;
        const humans  = members.filter(m => !m.user.bot).size;

        const embed = new EmbedBuilder()
          .setTitle(`<:1430986220011524216:1555544196952367134> Members in ${guild.name}`)
          .setColor("#FF5733")
          .setDescription(
            `Total members: **${members.size}**\nHumans: **${humans}**\nBots: **${bots}**`
          );

        if (!listMembers) {
          return interaction.editReply({ embeds: [embed] });
        }

        // Build full member list
        const idSuffix = (id) => showIds ? ` — \`${id}\`` : "";

        let output = `=== Members in ${guild.name} (${members.size} total) ===\n\n`;

        output += `── Humans (${humans}) ──\n`;
        members
          .filter(m => !m.user.bot)
          .sort((a, b) => a.user.username.localeCompare(b.user.username))
          .forEach(m => {
            const nick = m.nickname ? ` (${m.nickname})` : "";
            output += `${m.user.username}${nick}${idSuffix(m.user.id)}\n`;
          });

        output += `\n── Bots (${bots}) ──\n`;
        members
          .filter(m => m.user.bot)
          .sort((a, b) => a.user.username.localeCompare(b.user.username))
          .forEach(m => {
            output += `${m.user.username}${idSuffix(m.user.id)}\n`;
          });

        embed.setDescription(embed.data.description + "\n_Full member list attached._");

        if (fileOutput) {
          const file = new AttachmentBuilder(
            Buffer.from(output.trim(), "utf-8"),
            { name: "members.txt" }
          );
          return interaction.editReply({ embeds: [embed], files: [file] });
        }

        const truncated = output.length > 3800
          ? output.slice(0, 3800) + "\n…(truncated, enable file_output for full list)"
          : output;
        embed.setDescription(embed.data.description + "\n```\n" + truncated.trim() + "\n```");
        return interaction.editReply({ embeds: [embed] });
      }

      // ─────────────────── EMOJIS ───────────────────
      if (sub === "emojis") {
        const showIds      = interaction.options.getBoolean("show_ids")       ?? true;
        const showMarkdown = interaction.options.getBoolean("show_markdown")  ?? true;
        const fileOutput   = interaction.options.getBoolean("file_output")    ?? true;

        const emojis   = guild.emojis.cache;
        const stickers = guild.stickers.cache;

        const animated = emojis.filter(e => e.animated);
        const staticE  = emojis.filter(e => !e.animated);

        // Discord emoji markdown: <:name:id> for static, <a:name:id> for animated
        const emojiMarkdown = (e) =>
          e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;

        let output = `=== Emojis in ${guild.name} ===\n`;
        output += `Total: ${emojis.size} | Static: ${staticE.size} | Animated: ${animated.size}\n\n`;

        if (staticE.size > 0) {
          output += `── Static Emojis (${staticE.size}) ──\n`;
          staticE
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(e => {
              const parts = [e.name];
              if (showMarkdown) parts.push(emojiMarkdown(e));
              if (showIds)      parts.push(`\`${e.id}\``);
              output += parts.join("  ") + "\n";
            });
        }

        if (animated.size > 0) {
          output += `\n── Animated Emojis (${animated.size}) ──\n`;
          animated
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(e => {
              const parts = [e.name];
              if (showMarkdown) parts.push(emojiMarkdown(e));
              if (showIds)      parts.push(`\`${e.id}\``);
              output += parts.join("  ") + "\n";
            });
        }

        if (stickers.size > 0) {
          output += `\n── Stickers (${stickers.size}) ──\n`;
          stickers
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(s => {
              const parts = [s.name];
              if (showIds) parts.push(`\`${s.id}\``);
              output += parts.join("  ") + "\n";
            });
        }

        const embed = new EmbedBuilder()
          .setTitle(`<:n_utils:1555544669545431062> Emojis & Stickers in ${guild.name}`)
          .setColor("#9B59B6")
          .addFields(
            {
              name: "Emojis",
              value: `Total: ${emojis.size}\nAnimated: ${animated.size}\nStatic: ${staticE.size}`,
              inline: true,
            },
            {
              name: "Stickers",
              value: `Total: ${stickers.size}`,
              inline: true,
            }
          );

        if (!emojis.size && !stickers.size) {
          embed.setDescription("_No emojis or stickers found in this server._");
          return interaction.editReply({ embeds: [embed] });
        }

        if (fileOutput) {
          const file = new AttachmentBuilder(
            Buffer.from(output.trim(), "utf-8"),
            { name: "emojis.txt" }
          );
          return interaction.editReply({ embeds: [embed], files: [file] });
        }

        const truncated = output.length > 3800
          ? output.slice(0, 3800) + "\n…(truncated, enable file_output for full list)"
          : output;
        embed.addFields({ name: "Full List", value: "```\n" + truncated.trim() + "\n```" });
        return interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error("Error in /list command:", err);
      const errorReply = {
        content: "An error occurred while executing the command.",
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied)
        await interaction.editReply(errorReply).catch(console.error);
      else await interaction.reply(errorReply).catch(console.error);
    }
  },
};