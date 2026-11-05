const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    MessageFlags,
  } = require("discord.js");
  const aiConfig = require("../../Schemas/aiSchema");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("ai-config")
      .setDescription("Configure Artificial Intelligence in your server!"),

  premium: true,
    premiumTier: "pro",
  
    execute: async function (interaction, client) {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
          content: `${client.emoji.error} | You don't have perms to manage the AI configuration system.`,
          flags: MessageFlags.Ephemeral,
        });
      }
  
      const data = await aiConfig.findOne({ guildId: interaction.guild.id });
      let blacklistedCount = data && data.blacklists ? data.blacklists.length : 0;
  
      const embed = new EmbedBuilder()
        .setTitle(`AI Configuration Panel`)
        .setDescription(`\`\`\`md\n# Welcome to the ChatBot System\n> Based on Google Gemini v1.5 ;)\`\`\``)
        .addFields(
          {
            name: `System Status`,
            value: data
              ? `\`\`\`ansi
  \u001b[32m□ <:LEgreen:1567796933307666515> SYSTEM ONLINE\n\u001b[32m├───> All Systems Operational\n\u001b[32m├───> Features: Fully Available\n\u001b[32m└───> Updates: Real-time Enabled\`\`\``
              : `\`\`\`ansi
  \u001b[32m□ <:LEred:1567796934545121280> SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\`\`\``,
          },
          {
            name: `Active Configuration`,
            value: data
              ? `\`\`\`yml\n"channel": "${data.channelId}"\n"blacklisted-users": "${blacklistedCount}"\`\`\``
              : `\`\`\`yml\n"channel": "Not Configured"\n"blacklisted-users": "0"\`\`\``,
          }
        )
        .setColor(client.config.embedColor)
        .setTimestamp();
  
      const mainButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("channel_setup")
          .setLabel("Channel")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!!data),
        new ButtonBuilder()
          .setCustomId("blacklist_setup")
          .setLabel("Blacklist")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!data),
        new ButtonBuilder()
          .setCustomId("disable_ai")
          .setLabel("Disable AI")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!data)
      );
  
      const blacklistButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("blacklist_add")
          .setLabel("Add")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("blacklist_remove")
          .setLabel("Remove")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("back_to_main")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );
  
      const message = await interaction.reply({
        embeds: [embed],
        components: [mainButtons],
        withResponse: true
      });
  
      const collector = message.resource.message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });
  
      collector.on("collect", async (i) => {
        switch (i.customId) {
          case "channel_setup":
            await i.reply({
              content: "Please mention the channel where you want to bind the AI.",
              flags: MessageFlags.Ephemeral,
            });
  
            const channelFilter = (m) => m.author.id === i.user.id;
            const channelCollector = interaction.channel.createMessageCollector({
              filter: channelFilter,
              time: 30000,
              max: 1,
            });
  
            channelCollector.on("collect", async (m) => {
              const channel = m.mentions.channels.first();
              if (!channel) {
                await m.reply({
                  content: "Invalid channel mentioned. Please try again.",
                  flags: MessageFlags.Ephemeral,
                });
                return;
              }
  
              await aiConfig.create({
                guildId: interaction.guild.id,
                channelId: channel.id,
                blacklists: [],
              });
  
              embed.spliceFields(0, 2, {
                name: `System Status`,
                value: `\`\`\`ansi
  \u001b[32m□ <:LEgreen:1567796933307666515> SYSTEM ONLINE\n\u001b[32m├───> All Systems Operational\n\u001b[32m├───> Features: Fully Available\n\u001b[32m└───> Updates: Real-time Enabled\`\`\``,
              }, {
                name: `Active Configuration`,
                value: `\`\`\`yml\n"channel": "${channel.id}"\n"blacklisted-users": "0"\`\`\``,
              });
  
              mainButtons.components[0].setDisabled(true);
              mainButtons.components[1].setDisabled(false);
              mainButtons.components[2].setDisabled(false);
  
              await i.message.edit({
                embeds: [embed],
                components: [mainButtons],
              });
  
              await m.reply({
                content: `AI has been bound to ${channel}.`,
                flags: MessageFlags.Ephemeral,
              });
            });
  
            channelCollector.on("end", (collected) => {
              if (collected.size === 0) {
                i.followUp({
                  content: "You did not respond in time. Please try again.",
                  flags: MessageFlags.Ephemeral,
                });
              }
            });
            break;
  
          case "blacklist_setup":
            await i.update({
              embeds: [embed],
              components: [blacklistButtons],
            });
            break;
  
          case "blacklist_add":
            await i.reply({
              content: "Please mention the user you want to blacklist.",
              flags: MessageFlags.Ephemeral,
            });
  
            const addFilter = (m) => m.author.id === i.user.id;
            const addCollector = interaction.channel.createMessageCollector({
              filter: addFilter,
              time: 30000,
              max: 1,
            });
  
            addCollector.on("collect", async (m) => {
              const user = m.mentions.users.first();
              if (!user) {
                return m.reply({
                  content: "Invalid user mentioned. Please try again.",
                  flags: MessageFlags.Ephemeral,
                });
              }
  
              const currentData = await aiConfig.findOne({ guildId: i.guild.id });
              if (!currentData) {
                return m.reply({
                  content: "You need to configure AI before managing the blacklist.",
                  flags: MessageFlags.Ephemeral,
                });
              }
  
              if (currentData.blacklists.includes(user.id)) {
                return m.reply({
                  content: "This user is already blacklisted.",
                  flags: MessageFlags.Ephemeral,
                });
              }
  
              currentData.blacklists.push(user.id);
              await currentData.save();
              blacklistedCount = currentData.blacklists.length;
  
              embed.spliceFields(1, 1, {
                name: `Active Configuration`,
                value: `\`\`\`yml\n"channel": "${currentData.channelId}"\n"blacklisted-users": "${blacklistedCount}"\`\`\``,
              });
  
              await i.message.edit({
                embeds: [embed],
                components: [blacklistButtons],
              });
  
              await m.reply({
                content: `${user} has been blacklisted from using AI.`,
                flags: MessageFlags.Ephemeral,
              });
            });
            break;
  
          case "blacklist_remove":
            await i.reply({
              content: "Please mention the user you want to remove from the blacklist.",
              flags: MessageFlags.Ephemeral,
            });
  
            const removeFilter = (m) => m.author.id === i.user.id;
            const removeCollector = interaction.channel.createMessageCollector({
              filter: removeFilter,
              time: 30000,
              max: 1,
            });
  
            removeCollector.on("collect", async (m) => {
              const user = m.mentions.users.first();
              if (!user) {
                return m.reply({
                  content: "Invalid user mentioned. Please try again.",
                  flags: MessageFlags.Ephemeral,
                });
              }
  
              const currentData = await aiConfig.findOne({ guildId: i.guild.id });
              if (!currentData) {
                return m.reply({
                  content: "You need to configure AI before managing the blacklist.",
                  flags: MessageFlags.Ephemeral,
                });
              }
  
              if (!currentData.blacklists.includes(user.id)) {
                return m.reply({
                  content: "This user is not blacklisted.",
                  flags: MessageFlags.Ephemeral,
                });
              }
  
              currentData.blacklists = currentData.blacklists.filter((id) => id !== user.id);
              await currentData.save();
              blacklistedCount = currentData.blacklists.length;
  
              embed.spliceFields(1, 1, {
                name: `Active Configuration`,
                value: `\`\`\`yml\n"channel": "${currentData.channelId}"\n"blacklisted-users": "${blacklistedCount}"\`\`\``,
              });
  
              await i.message.edit({
                embeds: [embed],
                components: [blacklistButtons],
              });
  
              await m.reply({
                content: `${user} has been removed from the blacklist.`,
                flags: MessageFlags.Ephemeral,
              });
            });
            break;
  
          case "back_to_main":
            await i.update({
              embeds: [embed],
              components: [mainButtons],
            });
            break;
  
          case "disable_ai":
            const currentData = await aiConfig.findOne({ guildId: i.guild.id });
            if (!currentData) {
              return i.reply({
                content: "AI is not configured in this server.",
                flags: MessageFlags.Ephemeral,
              });
            }
  
            await aiConfig.deleteOne({ guildId: i.guild.id });
            blacklistedCount = 0;
  
            embed.spliceFields(0, 2, {
              name: `System Status`,
              value: `\`\`\`ansi
  \u001b[32m□ <:LEred:1567796934545121280> SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\`\`\``,
            }, {
              name: `Active Configuration`,
              value: `\`\`\`yml\n"channel": "Not Configured"\n"blacklisted-users": "0"\`\`\``,
            });
  
            mainButtons.components[0].setDisabled(false);
            mainButtons.components[1].setDisabled(true);
            mainButtons.components[2].setDisabled(true);
  
            await i.update({
              embeds: [embed],
              components: [mainButtons],
            });
  
            await i.followUp({
              content: "AI has been disabled in this server.",
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
      });
  
      collector.on("end", async () => {
        mainButtons.components.forEach((component) => component.setDisabled(true));
        await message.resource.message.edit({
          content: "The AI configuration panel has timed out.",
          embeds: [embed],
          components: [mainButtons],
        });
      });
    },
  };
  
  /**
   * Credits: Arpan | @arpandevv
   * Buy: https://razorbot.buzz/buy
   */