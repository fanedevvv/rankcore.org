// Commands/Information/serverinfo.js — Redesigned with Components V2

const {
  SlashCommandBuilder, MessageFlags, ChannelType, GuildVerificationLevel,
  GuildExplicitContentFilter, GuildNSFWLevel,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Displays detailed information about this server.")
    .setDMPermission(false),

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      const { guild } = interaction;
      if (!guild) return interaction.editReply({ content: "This command only works in servers.", flags: MessageFlags.Ephemeral });

      // Fetch all members so owner is guaranteed to be in cache
      await guild.members.fetch().catch(() => {});

      const { members, channels, emojis, roles, stickers } = guild;

      const botCount = members.cache.filter(m => m.user?.bot).size;
      const humanCount = (guild.memberCount || 0) - botCount;

      const splitPascal = (str, sep = " ") => {
        if (!str) return "None";
        return str.split(/(?=[A-Z])/).join(sep);
      };
      const toPascalCase = (str) => {
        if (!str) return "None";
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase());
      };

      const getChannelTypeSize = (types) => channels.cache.filter(c => types.includes(c.type)).size;

      const totalChannels = getChannelTypeSize([
        ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildVoice,
        ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildPublicThread,
        ChannelType.GuildPrivateThread, ChannelType.GuildNewsThread, ChannelType.GuildCategory,
      ]);
      const threadCount = getChannelTypeSize([
        ChannelType.GuildPublicThread,
        ChannelType.GuildPrivateThread,
        ChannelType.GuildNewsThread,
      ]);
      const forumCount = getChannelTypeSize([ChannelType.GuildForum]);

      const sortedRoles = Array.from(roles.cache.values()).slice(1).sort((a, b) => b.position - a.position);
      const userRoles = sortedRoles.filter(r => !r.managed);
      const managedRoles = sortedRoles.filter(r => r.managed);

      // Plain text names — no <@&id> syntax to avoid pinging roles
      const maxRoleDisplay = (roleArr, maxLen = 900) => {
        let total = 0; const out = [];
        for (const r of roleArr) {
          const s = `\`@${r.name}\``;
          if (total + s.length + 2 > maxLen) break;
          total += s.length + 2; out.push(r);
        }
        return out;
      };

      const displayedUserRoles = maxRoleDisplay(userRoles);
      const displayedManagedRoles = maxRoleDisplay(managedRoles);

      const accentColor = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
        ? parseInt(client.config.embedColor.slice(1), 16)
        : 0x6366f1;

      // Owner as plain text — no <@id> to avoid pinging
      const ownerMember = guild.members.cache.get(guild.ownerId);
      const ownerDisplay = ownerMember
        ? `${ownerMember.user.tag} (\`${guild.ownerId}\`)`
        : `\`${guild.ownerId}\``;

      // ── General block
      const generalLines = [
        `> **Created** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        `> **ID** \`${guild.id}\``,
        `> **Owner** ${ownerDisplay}`,
        `> **Language** \`${new Intl.DisplayNames(["en"], { type: "language" }).of(guild.preferredLocale)}\``,
        `> **Vanity URL** ${guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : "None"}`,
        guild.description ? `> **Description** ${guild.description}` : null,
      ].filter(Boolean).join("\n");

      // ── Security block
      const securityLines = [
        `> **Explicit Filter** \`${splitPascal(GuildExplicitContentFilter[guild.explicitContentFilter])}\``,
        `> **NSFW Level** \`${splitPascal(GuildNSFWLevel[guild.nsfwLevel])}\``,
        `> **Verification** \`${splitPascal(GuildVerificationLevel[guild.verificationLevel])}\``,
      ].join("\n");

      // ── Members block
      const memberLines = [
        `> **Total** \`${guild.memberCount?.toLocaleString() ?? 0}\``,
        `> **Humans** \`${humanCount.toLocaleString()}\``,
        `> **Bots** \`${botCount.toLocaleString()}\``,
      ].join("\n");

      // ── Channels block
      const channelLines = [
        `> **Text / News** \`${getChannelTypeSize([ChannelType.GuildText, ChannelType.GuildNews])}\``,
        `> **Forums** \`${forumCount}\``,
        `> **Threads** \`${threadCount}\``,
        `> **Voice / Stage** \`${getChannelTypeSize([ChannelType.GuildVoice, ChannelType.GuildStageVoice])}\``,
        `> **Categories** \`${getChannelTypeSize([ChannelType.GuildCategory])}\``,
        `> **Total** \`${totalChannels}\``,
      ].join("\n");

      // ── Nitro block
      const nitroLines = [
        `> **Tier** \`${guild.premiumTier ? `Tier ${guild.premiumTier}` : "None"}\``,
        `> **Boosts** \`${guild.premiumSubscriptionCount ?? 0}\``,
        `> **Active Boosters** \`${members.cache.filter(m => m.premiumSince).size}\``,
      ].join("\n");

      // ── Emoji/Sticker block
      const emojiLines = [
        `> **Animated** \`${emojis?.cache?.filter(e => e.animated)?.size ?? 0}\``,
        `> **Static** \`${emojis?.cache?.filter(e => !e.animated)?.size ?? 0}\``,
        `> **Stickers** \`${stickers?.cache?.size ?? 0}\``,
      ].join("\n");

      // ── Features
      const featuresText = guild.features?.length
        ? guild.features.map(f => `\`${toPascalCase(f)}\``).join("  ").slice(0, 900)
        : "None";

      // Roles as plain text names — no <@&id> pings
      const userRoleStr = displayedUserRoles.length
        ? displayedUserRoles.map(r => `\`@${r.name}\``).join(" ") +
          (displayedUserRoles.length < userRoles.length ? ` *(+${userRoles.length - displayedUserRoles.length} more)*` : "")
        : "None";
      const managedRoleStr = displayedManagedRoles.length
        ? displayedManagedRoles.map(r => `\`@${r.name}\``).join(" ") +
          (displayedManagedRoles.length < managedRoles.length ? ` *(+${managedRoles.length - displayedManagedRoles.length} more)*` : "")
        : "None";

      const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${guild.name}`)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# Server Information`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**General**\n${generalLines}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Members** \`(${guild.memberCount?.toLocaleString()})\`\n${memberLines}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Channels** \`(${totalChannels})\`\n${channelLines}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Security**\n${securityLines}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Nitro**\n${nitroLines}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Emojis & Stickers**\n${emojiLines}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Server Features**\n${featuresText}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Roles** \`(${userRoles.length} user / ${managedRoles.length} managed)\`\n${userRoleStr}`)
        );

      if (managedRoles.length) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Managed Roles**\n${managedRoleStr}`)
        );
      }

      if (guild.bannerURL()) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
              .setURL(guild.bannerURL({ size: 1024 }))
              .setDescription("Server banner"),
          )
        );
      }

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

    } catch (error) {
      console.error("serverinfo error:", error);
      const msg = { content: "An error occurred while fetching server information.", flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(console.error);
      else await interaction.reply(msg).catch(console.error);
    }
  },
};