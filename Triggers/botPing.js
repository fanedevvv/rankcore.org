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
        .setTitle(`<:user:1567797032423264261> Hello, I'm ${client.user.username}!`)
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
        .setTitle("<:boost:1567796953599836280> Key Features")
        .addFields(
          {
            name: "<:minigames:1567796978929238076> Moderation",
            value: "Advanced moderation tools to keep your server safe",
            inline: true,
          },
          {
            name: "<:boost:1567796953599836280> Fun",
            value: "Entertainment commands for your community",
            inline: true,
          },
          {
            name: "<:n_utils:1567796996830658573> Utilities",
            value: "Helpful tools for server management",
            inline: true,
          },
          {
            name: "<:thunderr:1567797012991189134> Slash Commands",
            value: "Easy-to-use commands with auto-complete",
            inline: true,
          },
          {
            name: "<:n_utils:1567796996830658573> Customizable",
            value: "Configure settings to fit your needs",
            inline: true,
          },
          {
            name: "<:n_utils:1567796996830658573> Logging",
            value: "Track events and changes in your server",
            inline: true,
          }
        );

      // Quick start embed
      const quickStartEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle("<:boost:1567796953599836280> Quick Start")
        .addFields(
          {
            name: "<:files:1567796970964394044> View All Commands",
            value: "Use `/help` to see the complete list of commands",
            inline: false,
          },
          {
            name: "<:n_utils:1567796996830658573> Configure Settings",
            value: "Use `/config` to customize my behavior for your server",
            inline: false,
          },
          {
            name: "<:question:1567797002555621406> Get Help",
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
          .setEmoji(parseEmoji("<:files:1567796970964394044>"))
          .setStyle(ButtonStyle.Link)
          .setURL(docsUrl),
        new ButtonBuilder()
          .setLabel("Support Server")
          .setEmoji(parseEmoji("<:user:1567797032423264261>"))
          .setStyle(ButtonStyle.Link)
          .setURL(supportUrl),
        new ButtonBuilder()
          .setLabel("Vote for Me")
          .setEmoji(parseEmoji("<a:votes:1567797046562259015>"))
          .setStyle(ButtonStyle.Link)
          .setURL(voteUrl)
      );

      // Action buttons
      const actionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Invite Me")
          .setEmoji(parseEmoji("<:files:1567796970964394044>"))
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl),
        new ButtonBuilder()
          .setCustomId("delete_response")
          .setLabel("Delete")
          .setEmoji(parseEmoji("<:del:1567796961334267974>"))
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
                .setTitle("<:crossy:1567796959648030831> Action Not Permitted")
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