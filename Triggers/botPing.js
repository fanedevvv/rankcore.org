const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Colors,
} = require("discord.js");

// Helper to parse emoji strings like '<:name:id>' or '<a:name:id>'
function parseEmoji(emoji) {
  const match = emoji.match(/<(a?):\w+:(\d+)>/);
  if (!match) return null;
  const animated = match[1] === "a";
  const id = match[2];
  return { id, name: "", animated };
}

module.exports = (client) => {
  client.on("messageCreate", async (message) => {
    try {
      if (!message || message.author.bot) return;

      // Check if the bot is mentioned
      if (!message.mentions.has(client.user)) return;

      // Ignore messages that are replies to someone else
      if (message.type === "REPLY" && message.reference?.messageId) return;

      // Only respond if the message is JUST the bot mention
      const mentionRegex = new RegExp(`^<@!?${client.user.id}>$`);
      if (!mentionRegex.test(message.content.trim())) return;

      // Get the accent color
      const accentColor =
        typeof client.config?.embedColor === "string" &&
        client.config.embedColor.startsWith("#")
          ? parseInt(client.config.embedColor.slice(1), 16)
          : 0x7b20c8;

      // Build URLs
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
      const supportUrl = client.config?.supportURL || `https://discord.gg/a9Kea3ymC7`;
      const voteUrl = client.config?.topggURL || "https://top.gg/bot/960624234688811188";
      const docsUrl = client.config?.docsUrl || `https://dash.rankcore.org/docs`;

      // Main info embed
      const infoEmbed = new EmbedBuilder()
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL(),
        })
        .setTitle(`<:user:1555544664155889668> Hello, I'm ${client.user.username}!`)
        .setColor(accentColor)
        .setDescription(
          `Thanks for mentioning me! I'm here to help make your Discord server better.\n\n` +
            `Use \`/help\` to see all available commands, or check out the documentation for more info.`
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp();

      // Features embed
      const featuresEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle("<:boost:1555544362455146576> Key Features")
        .addFields(
          {
            name: "<:minigames:1555544500179439707> Moderation",
            value: "Advanced moderation tools to keep your server safe",
            inline: true,
          },
          {
            name: "<:boost:1555544362455146576> Fun",
            value: "Entertainment commands for your community",
            inline: true,
          },
          {
            name: "<:n_utils:1555544669545431062> Utilities",
            value: "Helpful tools for server management",
            inline: true,
          },
          {
            name: "<:thunderr:1555544623735242883> Slash Commands",
            value: "Easy-to-use commands with auto-complete",
            inline: true,
          },
          {
            name: "<:n_utils:1555544669545431062> Customizable",
            value: "Configure settings to fit your needs",
            inline: true,
          },
          {
            name: "<:n_utils:1555544669545431062> Logging",
            value: "Track events and changes in your server",
            inline: true,
          }
        );

      // Quick start embed
      const quickStartEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle("<:boost:1555544362455146576> Quick Start")
        .addFields(
          {
            name: "<:files:1555544445565407352> View All Commands",
            value: "Use `/help` to see the complete list of commands",
            inline: false,
          },
          {
            name: "<:n_utils:1555544669545431062> Configure Settings",
            value: "Use `/config` to customize my behavior for your server",
            inline: false,
          },
          {
            name: "<:question:1555544543741476917> Get Help",
            value: "Visit our support server for assistance",
            inline: false,
          }
        )
        .setFooter({
          text: `Prefix: / | Mentioned by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      // Link buttons
      const linkButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Documentation")
          .setEmoji(parseEmoji("<:files:1555544445565407352>"))
          .setStyle(ButtonStyle.Link)
          .setURL(docsUrl),
        new ButtonBuilder()
          .setLabel("Support Server")
          .setEmoji(parseEmoji("<:user:1555544664155889668>"))
          .setStyle(ButtonStyle.Link)
          .setURL(supportUrl),
        new ButtonBuilder()
          .setLabel("Vote for Me")
          .setEmoji(parseEmoji("<a:votes:1555544718065016844>"))
          .setStyle(ButtonStyle.Link)
          .setURL(voteUrl)
      );

      // Action buttons
      const actionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Invite Me")
          .setEmoji(parseEmoji("<:files:1555544445565407352>"))
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl),
        new ButtonBuilder()
          .setCustomId("delete_response")
          .setLabel("Delete")
          .setEmoji(parseEmoji("<:del:1555544395720302643>"))
          .setStyle(ButtonStyle.Danger)
      );

      // Send the message
      const botMessage = await message.reply({
        embeds: [infoEmbed, featuresEmbed, quickStartEmbed],
        components: [linkButtons, actionButtons],
      });

      // Create collector for delete button
      const collector = botMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
      });

      collector.on("collect", async (interaction) => {
        // Check if the user who clicked is the same as the one who triggered the mention
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle("<:crossy:1555544390221562048> Action Not Permitted")
                .setDescription(
                  `Only ${message.author.toString()} can delete this message.\n\n` +
                    `You can ask them to delete it, or simply ignore this message.`
                )
                .setFooter({ text: "Permission Denied" })
                .setTimestamp(),
            ],
            ephemeral: true,
          });
        }

        // Handle delete button
        if (interaction.customId === "delete_response") {
          await interaction.deferUpdate().catch(() => {});
          await interaction.message.delete().catch(() => {});
        }
      });

      // Handle collector timeout
      collector.on("end", () => {
        // Optionally disable buttons after timeout
        const disabledButtons = new ActionRowBuilder().addComponents(
          linkButtons.components.map((btn) =>
            ButtonBuilder.from(btn).setDisabled(true)
          )
        );
        const disabledActionButtons = new ActionRowBuilder().addComponents(
          actionButtons.components.map((btn) =>
            ButtonBuilder.from(btn).setDisabled(true)
          )
        );

        botMessage
          .edit({
            components: [disabledButtons, disabledActionButtons],
          })
          .catch(() => {});
      });
    } catch (err) {
      console.error("[MENTION_HANDLER_ERROR]", err);
    }
  });
};