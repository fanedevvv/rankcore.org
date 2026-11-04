const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const TwitchNotification = require('../../Schemas/twitchSchema');
// Native fetch (Node 18+); node-fetch v3 is ESM-only and can't be require()d on Node 21
const fetch = globalThis.fetch;

module.exports = {
  data: new SlashCommandBuilder()
      .setName("twitch")
      .setDescription("Configure Twitch notifications for a streamer.")
      .addSubcommand(subcommand =>
          subcommand
              .setName('config')
              .setDescription('Configure Twitch notification settings.')),
premium: true,
  async execute(interaction, client) {
      if (
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
          return await interaction.reply({
              content: "You **do not** have the permission to do that!",
              flags: MessageFlags.Ephemeral,
          });
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'config') {
          // Check if a notification already exists for this guild
          const notification = await TwitchNotification.findOne({ Guild: interaction.guild.id });

          // Create the configuration panel
          const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Twitch Notifications Configuration Panel')
              .setDescription(`\`\`\`md\n# Welcome to Twitch Notifications System\n> Never miss your fav streamer's live!\`\`\``)
              .addFields(
                  { name: 'SYSTEM STATUS', value: notification ? `\`\`\`ansi
\u001b[32m□ <:LEgreen:1555544256356159600> ALL SYSTEMS ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\`\`\`` : '<:LEred:1555544262123323422> SYSTEM OFFLINE\n- Features: NOT CONFIGURED\n- Updates: Disabled' },
                  { name: 'Active Configuration', value: notification ? `\`\`\`yml\n"channel": "${notification.Channel}"\n"twitch-user": "${notification.Streamer}"\`\`\`` : `\`\`\`yml\n"channel": "Not Configured"\n"twitch-user": "Not Configured"\`\`\`` }
              )
              .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

          // Create buttons
          const setupButton = new ButtonBuilder()
              .setCustomId('setup_twitch')
              .setLabel('Setup Channel')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(!!notification);

          const disableButton = new ButtonBuilder()
              .setCustomId('disable_twitch')
              .setLabel('Disable')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(!notification);

          const row = new ActionRowBuilder().addComponents(setupButton, disableButton);

          // Send the configuration panel
          const message = await interaction.reply({
              embeds: [embed],
              components: [row],
              withResponse: true
          });

          // Create a collector for button interactions
          const filter = i => i.user.id === interaction.user.id && (i.customId === 'setup_twitch' || i.customId === 'disable_twitch');
          const collector = message.resource.message.createMessageComponentCollector({ filter, time: 60000 });

          let setupStage = null;
          let collectedData = {};

          collector.on('collect', async i => {
              if (i.customId === 'setup_twitch') {
                  if (!setupStage) {
                      setupStage = 'channel';
                      await i.reply({
                          content: 'Send the Channel ID or mention the channel in the chat you want to setup the notifications in!',
                          flags: MessageFlags.Ephemeral,
                      });

                      // Collect channel input
                      const channelFilter = m => m.author.id === i.user.id;
                      const channelCollector = i.channel.createMessageCollector({ filter: channelFilter, max: 1, time: 30000 });

                      channelCollector.on('collect', async m => {
                          const channel = m.mentions.channels.first() || i.guild.channels.cache.get(m.content);
                          if (!channel) {
                              await i.followUp({
                                  content: 'Invalid channel! Please try again.',
                                  flags: MessageFlags.Ephemeral,
                              });
                              setupStage = null;
                              return;
                          }

                          collectedData.channel = channel.id;
                          setupStage = 'streamer';

                          await i.followUp({
                              content: 'Send the Twitch streamer URL!',
                              flags: MessageFlags.Ephemeral,
                          });

                          // Collect streamer input
                          const streamerCollector = i.channel.createMessageCollector({ filter: channelFilter, max: 1, time: 30000 });

                          streamerCollector.on('collect', async m => {
                              const streamerUrl = m.content;
                              if (!streamerUrl.startsWith('https://www.twitch.tv/')) {
                                  await i.followUp({
                                      content: 'Invalid Twitch URL! Please provide a valid Twitch URL (e.g., https://www.twitch.tv/username).',
                                      flags: MessageFlags.Ephemeral,
                                  });
                                  setupStage = null;
                                  return;
                              }

                              collectedData.streamer = streamerUrl;
                              setupStage = 'message';

                              await i.followUp({
                                  content: 'Send the custom message to send when the streamer is live!',
                                  flags: MessageFlags.Ephemeral,
                              });

                              // Collect message input
                              const messageCollector = i.channel.createMessageCollector({ filter: channelFilter, max: 1, time: 30000 });

                              messageCollector.on('collect', async m => {
                                  collectedData.message = m.content;

                                  // Save the new notification
                                  const newNotification = new TwitchNotification({
                                      Guild: i.guild.id,
                                      Channel: collectedData.channel,
                                      Streamer: collectedData.streamer,
                                      Message: collectedData.message,
                                  });
                                  await newNotification.save();

                                  // Update the embed
                                  embed.spliceFields(0, 2, 
                                      { name: 'SYSTEM STATUS', value: `\`\`\`ansi
                      \u001b[32m□ <:LEgreen:1555544256356159600> ALL SYSTEMS ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\`\`\`` },
                                      { name: 'Active Configuration', value: `\`\`\`yml\n"channel": "${collectedData.channel}"\n"twitch-user": "${collectedData.streamer}"\`\`\`` }
                                  );
                                  setupButton.setDisabled(true);
                                  disableButton.setDisabled(false);

                                  await i.message.edit({
                                      embeds: [embed],
                                      components: [row],
                                  });

                                  await i.followUp({
                                      content: `Twitch notifications set up successfully! Channel: <#${collectedData.channel}>, Streamer: ${collectedData.streamer}`,
                                      flags: MessageFlags.Ephemeral,
                                  });

                                  setupStage = null;
                                  collectedData = {};
                              });
                          });
                      });
                  }
              } else if (i.customId === 'disable_twitch') {
                  await TwitchNotification.deleteOne({ Guild: i.guild.id });

                  // Update the embed
                  embed.spliceFields(0, 2, 
                      { name: 'SYSTEM STATUS', value: `\`\`\`ansi
                      \u001b[32m□ <:LEred:1555544262123323422> SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\`\`\`` },
                      { name: 'Active Configuration', value: `\`\`\`yml\n"channel": "Not Configured"\n"twitch-user": "Not Configured"\`\`\`` }
                  );
                  setupButton.setDisabled(false);
                  disableButton.setDisabled(true);

                  await i.update({
                      embeds: [embed],
                      components: [row],
                  });

                  await i.followUp({
                      content: 'Twitch notifications have been disabled.',
                      flags: MessageFlags.Ephemeral,
                  });
              }
          });

          collector.on('end', async () => {
              setupButton.setDisabled(true);
              disableButton.setDisabled(true);
              await message.resource.message.edit({ components: [row] });
          });
      }
  },
};