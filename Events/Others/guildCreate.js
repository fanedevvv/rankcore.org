  const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
  } = require("discord.js");

  // Import schemas
  const BlacklistGuild = require("../../Schemas/serverBlacklistSchema.js");
  const BlacklistUser = require("../../Schemas/blacklistSchema.js");
  const { createDefaultAutomodRules } = require("../../Utils/defaultAutomod.js");

  const WEBHOOK_URL = process.env.GuildAddWebhook;

  module.exports = {
    name: "guildCreate",
    async execute(guild, client) {
      // 1. Check guild blacklist
      const guildBlacklisted = await BlacklistGuild.findOne({ serverId: guild.id });
      if (guildBlacklisted) {
        console.log(`[BLACKLIST] Left blacklisted guild: ${guild.name} (${guild.id})`);
        return guild.leave().catch(() => null);
      }

      // 2. Find who invited the bot
      let inviter = null;
      if (guild.members.me.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        try {
          const auditLogs = await guild.fetchAuditLogs({
            type: 28, // BOT_ADD
            limit: 1,
          });
          const log = auditLogs.entries.first();
          if (log && log.targetId === client.user.id) {
            inviter = log.executor; // The user who invited the bot
          }
        } catch (err) {
          console.error("Failed to fetch audit logs:", err);
        }
      }

      // 3. If inviter is blacklisted → leave
      if (inviter) {
        const userBlacklisted = await BlacklistUser.findOne({ userId: inviter.id });
        if (userBlacklisted) {
          console.log(`[BLACKLIST] Left guild because inviter is blacklisted: ${inviter.tag} (${inviter.id})`);
          return guild.leave().catch(() => null);
        }
      }

      // Snapshot invites so joins can be attributed from the start
      require("../../Utils/inviteCache.js").warm(guild).catch(() => null);

      // 4. Basic native AutoMod protection (spam, mention spam, slurs)
      const automodCreated = await createDefaultAutomodRules(guild).catch(() => 0);

      // 5. Continue as normal (DM + webhook logging)
      const owner = await guild.fetchOwner().catch(() => null);
      if (!owner) return;

      const thankEmbed = new EmbedBuilder()
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL(),
          url: `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`,
        })
        .setTitle("Thank you for adding me!")
        .setDescription(
          `Hey ${owner.user}, thanks for adding **${client.user.username}** to **${guild.name}**!\n\n` +
          `• Use \`/help\` to explore all my features.\n` +
          `• Join our support server if you need help.\n` +
          `• Read how we handle data in our [Privacy Policy](https://rankcore.org/privacy).\n` +
          (automodCreated ? `• I turned on basic AutoMod protection (spam, mention spam, slurs). Change it anytime in Server Settings → AutoMod.\n` : "") +
          `\n` +
          `> ${client.emoji?.sparkles || "<:boost:1567796953599836280>"} **Total Commands:** ${client.commands.size}\n` +
          `> ${client.emoji?.guilds || "<:1430986225493479485:1567796921681055824>"} **Total Servers:** ${client.guilds.cache.size}\n`
        )
        .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
        .setColor(client.config?.embedColor || "#5865F2")
        .setFooter({
          text: "RankCore • rankcore.org",
          iconURL: client.user.displayAvatarURL(),
        });

      const supportButton = new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/a9Kea3ymC7");

      const inviteButton = new ButtonBuilder()
        .setLabel("Invite Me")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);


      const privacyButton = new ButtonBuilder()
        .setLabel("Privacy Policy")
        .setStyle(ButtonStyle.Link)
        .setURL("https://rankcore.org/privacy");

      const buttonRow = new ActionRowBuilder().addComponents(
        supportButton,
        inviteButton,
        privacyButton
      );

      owner.send({ embeds: [thankEmbed], components: [buttonRow] }).catch(() => {});

      // Webhook logging
      let inviteURL = "No invite available";
      try {
        const invites = await guild.invites.fetch().catch(() => new Map());
        if (invites.size > 0) {
          inviteURL = invites.first().url;
        }
      } catch (err) {
        console.error("Failed to fetch or create invite:", err);
      }

  const webhookEmbed = new EmbedBuilder()
    .setTitle(`Joined new server: ${guild.name}`)
    .setDescription(
      `**Owner:** ${owner.user.tag}\n` +
      (inviter ? `**Inviter:** ${inviter.tag} (${inviter.id})\n` : "") +
      `**Members:** ${guild.memberCount}\n` +
      `**Online Members:** ${guild.members.cache.filter(m => m.presence?.status !== "offline").size || "N/A"}\n` +
      `**Boosts:** ${guild.premiumSubscriptionCount || 0} (Level ${guild.premiumTier || 0})\n` +
      `**Verification Level:** ${guild.verificationLevel}\n` +
      `**Server ID:** ${guild.id}\n` +
      `**Created At:** ${guild.createdAt.toDateString()} (${Math.floor((Date.now() - guild.createdAt) / 86400000)} days ago)\n` +
      `**Partnered:** ${guild.partnered ? "Yes" : "No"} | **Verified:** ${guild.verified ? "Yes" : "No"}\n` +
      `**Invite:** ${inviteURL}\n\n` +
      `> **Total Commands:** ${client.commands.size}\n` +
      `> **Total Servers:** ${client.guilds.cache.size}`
    )
    .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
    .setColor(5814783)
    .setFooter({ text: `Bot joined at ${new Date().toLocaleString()}` });


      // Optional join/leave log webhook (GuildAddWebhook in .env)
      if (WEBHOOK_URL) {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [webhookEmbed.toJSON()] }),
        }).catch(console.error);
      }
    },
  };
