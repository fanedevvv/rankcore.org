const {
    ApplicationCommandType,
    ApplicationCommandOptionType,
    EmbedBuilder,
    ChannelType,
    SlashCommandBuilder,
    MessageFlags,
    PermissionsBitField,
    ButtonStyle,
  } = require("discord.js");
const { parseEmoji } = require('../../Utils/emojis');
  const Discord = require("discord.js");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("embed")
      .setDescription("Create an embed")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel where to post embed")
          .setRequired(true)
      ),
    async execute(interaction, client) {
      // Check if the user has permission to manage messages
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: 'You do not have permission to make an embed.', flags: MessageFlags.Ephemeral });
      }
  
      try {
        const channel = interaction.options.getChannel("channel");
  
        // Create a dropdown menu for selecting embed options
        let row = new Discord.ActionRowBuilder().addComponents(
          new Discord.StringSelectMenuBuilder()
            .setCustomId("embedSelect")
            .setPlaceholder("Nothing selected")
            .addOptions([
              {
                emoji: parseEmoji("<:files:1555544445565407352>"),
                label: "Title",
                description: "Create an embed title",
                value: "title_embed",
              },
              {
                emoji: parseEmoji("<:files:1555544445565407352>"),
                label: "Title Url",
                description: "Create an embed title URL",
                value: "title_url",
              },
              {
                emoji: parseEmoji("<:suggestion:1555544601501237322>"),
                label: "Description",
                description: "Create an embed description",
                value: "description_embed",
              },
              {
                emoji: parseEmoji("<:n_search:1555544554365788191>"),
                label: "Author",
                description: "Create an embed author",
                value: "author_embed",
              },
              {
                emoji: parseEmoji("<:n_search:1555544554365788191>"),
                label: "Author Image",
                description: "Create an embed author image",
                value: "author_image",
              },
              {
                emoji: parseEmoji("<:down:1555544418407157790>"),
                label: "Footer",
                description: "Create an embed footer",
                value: "footer_embed",
              },
              {
                emoji: parseEmoji("<:down:1555544418407157790>"),
                label: "Footer Image",
                description: "Create an embed footer image",
                value: "footer_image",
              },
              {
                emoji: parseEmoji("<:dot:1555544412300378243>"),
                label: "Thumbnail",
                description: "Create an embed thumbnail",
                value: "thumbnail_embed",
              },
              {
                emoji: parseEmoji("<:1430986244921495654:1555544239792980044>"),
                label: "Timestamp",
                description: "Create an embed timestamp",
                value: "timestamp_embed",
              },
              {
                emoji: parseEmoji("<:files:1555544445565407352>"),
                label: "Image",
                description: "Create an embed image",
                value: "image_embed",
              },
              {
                emoji: parseEmoji("<:n_info:1555544473008873565>"),
                label: "Color",
                description: "Create an embed color",
                value: "color_embed",
              },
              {
                emoji: parseEmoji("<:dot:1555544412300378243>"),
                label: "Button URL",
                description: "Create URL buttons in embed",
                value: "button",
              },
            ])
        );
  
        // Create a button to send the embed
        let row2 = new Discord.ActionRowBuilder().addComponents(
          new Discord.ButtonBuilder()
            .setCustomId("send_embed")
            .setEmoji(parseEmoji("<a:tickyy:1555544712687915008>"))
            .setLabel("Send embed")
            .setStyle(Discord.ButtonStyle.Success)
        );
  
        // Initialize the embed with a default description
        let embed = new Discord.EmbedBuilder()
          .setDescription("Use the dropdown below to customize your embed.");
  
        let rowb = new Discord.ActionRowBuilder(); // For buttons
  
        // Reply with the initial embed and components
        interaction.reply({
          embeds: [embed],
          components: [row, row2],
        });
  
        // Create a collector to handle user interactions
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({
          filter,
        });
  
        collector.on("collect", async (i) => {
          if (i.customId === "embedSelect") {
            i.deferUpdate();
  
            // Handle each option in the dropdown
            if (i.values == "title_embed") {
              await interaction.followUp({
                content: "Please enter a title",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const titleCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000, // 30 seconds to respond
              });
  
              titleCollector.on("collect", async (m) => {
                const title = m.content;
                embed.setTitle(title); // Update the embed title
                await interaction.editReply({
                  embeds: [embed], // Show the updated embed
                });
                m.delete().catch(() => {}); // Delete the user's message
              });
  
              titleCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a title in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "title_url") {
              await interaction.followUp({
                content: "Please enter a title URL",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const urlCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              urlCollector.on("collect", async (m) => {
                const url = m.content;
                embed.setURL(url); // Update the embed title URL
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              urlCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a title URL in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "description_embed") {
              await interaction.followUp({
                content: "Please enter a description",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const descriptionCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              descriptionCollector.on("collect", async (m) => {
                const description = m.content;
                embed.setDescription(description); // Update the embed description
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              descriptionCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a description in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "author_embed") {
              await interaction.followUp({
                content: "Please enter an author name",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const authorCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              authorCollector.on("collect", async (m) => {
                const author = m.content;
                embed.setAuthor({ name: author }); // Update the embed author
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              authorCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide an author name in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "author_image") {
              await interaction.followUp({
                content: "Please enter an author image URL",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const authorImageCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              authorImageCollector.on("collect", async (m) => {
                const authorImage = m.content;
                embed.setAuthor({ iconURL: authorImage }); // Update the embed author image
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              authorImageCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide an author image URL in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "footer_embed") {
              await interaction.followUp({
                content: "Please enter a footer text",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const footerCollector = interaction.channel .createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              footerCollector.on("collect", async (m) => {
                const footer = m.content;
                embed.setFooter({ text: footer }); // Update the embed footer
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              footerCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a footer text in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "footer_image") {
              await interaction.followUp({
                content: "Please enter a footer image URL",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const footerImageCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              footerImageCollector.on("collect", async (m) => {
                const footerImage = m.content;
                embed.setFooter({ iconURL: footerImage }); // Update the embed footer image
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              footerImageCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a footer image URL in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "thumbnail_embed") {
              await interaction.followUp({
                content: "Please enter a thumbnail URL",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const thumbnailCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              thumbnailCollector.on("collect", async (m) => {
                const thumbnail = m.content;
                embed.setThumbnail(thumbnail); // Update the embed thumbnail
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              thumbnailCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a thumbnail URL in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "timestamp_embed") {
              embed.setTimestamp(); // Set the current timestamp
              await interaction.editReply({
                embeds: [embed],
              });
            }
  
            if (i.values == "image_embed") {
              await interaction.followUp({
                content: "Please enter an image URL",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const imageCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              imageCollector.on("collect", async (m) => {
                const image = m.content;
                embed.setImage(image); // Update the embed image
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              imageCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide an image URL in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "color_embed") {
              await interaction.followUp({
                content: "Please enter a color in hex format (e.g., #FF0000)",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const colorCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              colorCollector.on("collect", async (m) => {
                const color = m.content;
                embed.setColor(color); // Update the embed color
                await interaction.editReply({
                  embeds: [embed],
                });
                m.delete().catch(() => {});
              });
  
              colorCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide a color in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
  
            if (i.values == "button") {
              await interaction.followUp({
                content: "Please enter a button label and URL in the format: `label|url` (e.g., `Click Me|https://example.com`)",
                flags: MessageFlags.Ephemeral,
              });
              const filterMessage = (m) => m.author.id === interaction.user.id && !m.author.bot;
  
              const buttonCollector = interaction.channel.createMessageCollector({
                filter: filterMessage,
                max: 1,
                time: 30000,
              });
  
              buttonCollector.on("collect", async (m) => {
                const [label, url] = m.content.split("|");
                if (label && url) {
                  const button = new Discord.ButtonBuilder()
                    .setLabel(label)
                    .setURL(url)
                    .setStyle(Discord.ButtonStyle.Link);
                  rowb.addComponents(button); // Add the button to the row
                  await interaction.editReply({
                    embeds: [embed],
                    components: [row, row2, rowb], // Update the reply with the new button
                  });
                } else {
                  interaction.followUp({
                    content: "Invalid format. Please use `label|url`.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
                m.delete().catch(() => {});
              });
  
              buttonCollector.on("end", (collected) => {
                if (collected.size === 0) {
                  interaction.followUp({
                    content: "You didn't provide button details in time.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
              });
            }
          }
  
          if (i.customId == "send_embed") {
            if (!channel) {
              return interaction.reply({
                embeds: [new EmbedBuilder().setTitle("Channel Not Found")],
              });
            }
  
            // Check if the embed has at least one field
            if (
              !embed.data.title &&
              !embed.data.description &&
              !embed.data.author &&
              !embed.data.footer &&
              !embed.data.image &&
              !embed.data.thumbnail &&
              !embed.data.timestamp &&
              !embed.data.color
            ) {
              return interaction.reply({
                content: "The embed cannot be empty. Please set at least one field.",
                flags: MessageFlags.Ephemeral,
              });
            }
  
            interaction.editReply({
              content: `Embed has been sent to ${channel}.`,
              embeds: [],
              components: [],
              flags: MessageFlags.Ephemeral,
            });
  
            // Prepare the components to send
            const componentsToSend = rowb.components.length > 0 ? [rowb] : [];
            await channel.send({
              embeds: [embed],
              components: componentsToSend,
            });
            collector.stop();
          }
        });
      } catch (error) {
        console.error(client, interaction, error);
      }
    },
  };