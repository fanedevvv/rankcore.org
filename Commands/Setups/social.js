const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require('discord.js');

const YouTubeNotification = require('../../Schemas/youtubeSchema');
const TwitchNotification = require('../../Schemas/twitchSchema');
const TwitterNotification = require('../../Schemas/twitterSchema');

const { resolveChannelId: resolveYouTubeChannelId } = require('../../Events/Others/youtubeNotification');
const { resolveUserId: resolveTwitterUserId } = require('../../Events/Others/twitternotification');

// ─── Constants ─────────────────────────────────────────────────────────────────
const MAX_YOUTUBE_SETUPS = 5;
const MAX_TWITCH_SETUPS = 3;
const MAX_TWITTER_SETUPS = 3;
const COLLECTOR_TIMEOUT = 120_000; // 2 minutes

// ─── Helper: safely reply or follow up ───────────────────────────────────────
async function safeEphemeral(interaction, content) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    }
    return await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch { /* ignore */ }
}

// ─── Helper: collect a single message from the user ──────────────────────────
function collectMessage(channel, userId, timeout = 30_000) {
  return new Promise((resolve) => {
    const collector = channel.createMessageCollector({
      filter: m => m.author.id === userId,
      max: 1,
      time: timeout,
    });
    collector.on('collect', m => { m.delete().catch(() => {}); resolve(m.content.trim()); });
    collector.on('end', collected => { if (!collected.size) resolve(null); });
  });
}

// ─── Build overview embed ─────────────────────────────────────────────────────
async function buildOverviewEmbed(guildId) {
  const [ytConfigs, twitchConfigs, twitterConfigs] = await Promise.all([
    YouTubeNotification.find({ Guild: guildId }),
    TwitchNotification.find({ Guild: guildId }),
    TwitterNotification.find({ Guild: guildId }),
  ]);

  const ytStatus = ytConfigs.length
    ? `✅ ${ytConfigs.length}/${MAX_YOUTUBE_SETUPS} slot(s) active`
    : '❌ Not configured';
  const twitchStatus = twitchConfigs.length
    ? `✅ ${twitchConfigs.length}/${MAX_TWITCH_SETUPS} slot(s) active`
    : '❌ Not configured';
  const twitterStatus = twitterConfigs.length
    ? `✅ ${twitterConfigs.length}/${MAX_TWITTER_SETUPS} slot(s) active`
    : '❌ Not configured';

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🔔 Social Notifications Hub')
    .setDescription('```md\n# Manage all your social platform notifications\n> YouTube • Twitch • Twitter/X```')
    .addFields(
      { name: '<:youtube:1567797034616885319> YouTube', value: ytStatus, inline: true },
      { name: '<:twitch:1567797030951325738> Twitch', value: twitchStatus, inline: true },
      { name: '🐦 Twitter / X', value: twitterStatus, inline: true },
    )
    .setFooter({ text: 'Select a platform below to configure it • RankCore' })
    .setTimestamp();
}

// ─── YouTube config flow ──────────────────────────────────────────────────────
async function handleYouTubeConfig(interaction) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const configs = await YouTubeNotification.find({ Guild: interaction.guild.id });

  // Build slot overview embed
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('YouTube Notifications — Configuration')
    .setDescription('```yml\n' +
      configs.map(c => `Setup ${c.SetupNumber}:\n  channel: "${c.Channel}"\n  youtube: "${c.YouTubeChannel}"\n  ping: "${c.PingRole ?? 'none'}"`).join('\n') +
      (configs.length ? '' : 'No setups configured yet.') + '```')
    .addFields(
      { name: 'Slots Used', value: `${configs.length}/${MAX_YOUTUBE_SETUPS}`, inline: true },
      { name: 'Poll Rate', value: '⚡ Every 30 seconds', inline: true },
    )
    .setFooter({ text: 'RankCore • YouTube Notifications' });

  // Select menus for adding/removing
  const usedSlots = new Set(configs.map(c => c.SetupNumber));
  const addOptions = [];
  for (let i = 1; i <= MAX_YOUTUBE_SETUPS; i++) {
    if (!usedSlots.has(i)) {
      addOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Add Setup ${i}`)
          .setValue(`yt_add_${i}`)
          .setEmoji('➕')
      );
    }
  }

  const removeOptions = configs.map(c =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Remove Setup ${c.SetupNumber} — ${c.YouTubeChannel.slice(0, 30)}`)
      .setValue(`yt_remove_${c.SetupNumber}`)
      .setEmoji('🗑️')
  );

  const rows = [];
  if (addOptions.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('yt_add_select')
        .setPlaceholder('➕ Add a new YouTube setup...')
        .addOptions(addOptions)
    ));
  }
  if (removeOptions.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('yt_remove_select')
        .setPlaceholder('🗑️ Remove a setup...')
        .addOptions(removeOptions)
    ));
  }

  // Test button for each active config
  const testButtons = configs.map(c =>
    new ButtonBuilder()
      .setCustomId(`yt_test_${c.SetupNumber}`)
      .setLabel(`Test Setup ${c.SetupNumber}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔔')
  );
  if (testButtons.length) {
    rows.push(new ActionRowBuilder().addComponents(testButtons.slice(0, 5)));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('social_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
  ));

  const msg = await interaction.update({ embeds: [embed], components: rows, fetchReply: true });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async i => {
    // ── Add setup ─────────────────────────────────────────────────────────
    if (i.customId === 'yt_add_select') {
      const slotNum = parseInt(i.values[0].replace('yt_add_', ''));
      await i.reply({ content: `**YouTube Setup ${slotNum}** — Send the YouTube channel URL or handle (e.g. \`/@ChannelName\` or \`/channel/UCxxxx\`):`, flags: MessageFlags.Ephemeral });

      const ytUrl = await collectMessage(i.channel, i.user.id);
      if (!ytUrl) return safeEphemeral(i, '⏱️ Timed out.');

      await i.followUp({ content: '🔍 Resolving channel ID...', flags: MessageFlags.Ephemeral });
      const resolvedId = await resolveYouTubeChannelId(ytUrl, apiKey).catch(() => null);
      if (!resolvedId) return safeEphemeral(i, '❌ Could not resolve that YouTube channel. Check the URL and try again.');

      await i.followUp({ content: 'Now send the **Discord channel** to post notifications in (mention or ID):', flags: MessageFlags.Ephemeral });
      const chInput = await collectMessage(i.channel, i.user.id);
      if (!chInput) return safeEphemeral(i, '⏱️ Timed out.');
      const discordChannel = i.guild.channels.cache.get(chInput.replace(/[<#>]/g, ''));
      if (!discordChannel) return safeEphemeral(i, '❌ Invalid channel.');

      await i.followUp({ content: 'Send the **custom notification message** (e.g. `@everyone new video!`):', flags: MessageFlags.Ephemeral });
      const customMsg = await collectMessage(i.channel, i.user.id);
      if (!customMsg) return safeEphemeral(i, '⏱️ Timed out.');

      await i.followUp({ content: '(Optional) Send a **role to ping** (mention or ID), or type `skip`:', flags: MessageFlags.Ephemeral });
      const roleInput = await collectMessage(i.channel, i.user.id);
      const roleId = roleInput && roleInput.toLowerCase() !== 'skip'
        ? roleInput.replace(/[<@&>]/g, '')
        : null;

      await YouTubeNotification.create({
        Guild: i.guild.id,
        Channel: discordChannel.id,
        YouTubeChannel: ytUrl,
        ResolvedChannelId: resolvedId,
        Message: customMsg,
        PingRole: roleId,
        SetupNumber: slotNum,
      });

      await i.followUp({ content: `✅ YouTube Setup ${slotNum} configured! Notifications will appear in <#${discordChannel.id}>.`, flags: MessageFlags.Ephemeral });
      collector.stop('refresh');
    }

    // ── Remove setup ──────────────────────────────────────────────────────
    if (i.customId === 'yt_remove_select') {
      const slotNum = parseInt(i.values[0].replace('yt_remove_', ''));
      await YouTubeNotification.deleteOne({ Guild: i.guild.id, SetupNumber: slotNum });
      await i.reply({ content: `🗑️ YouTube Setup ${slotNum} removed.`, flags: MessageFlags.Ephemeral });
      collector.stop('refresh');
    }

    // ── Test notification ─────────────────────────────────────────────────
    if (i.customId.startsWith('yt_test_')) {
      const slotNum = parseInt(i.customId.replace('yt_test_', ''));
      const config = await YouTubeNotification.findOne({ Guild: i.guild.id, SetupNumber: slotNum });
      if (!config) return i.reply({ content: '❌ Config not found.', flags: MessageFlags.Ephemeral });

      const testEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setAuthor({ name: 'RankCore Test Channel', iconURL: 'https://i.imgur.com/iKFGRiS.png' })
        .setTitle('🧪 Test Notification — YouTube')
        .setURL('https://www.youtube.com')
        .setDescription(`${config.Message}\n\n<:files:1567796970964394044> **New Upload!**\n> This is a test notification from RankCore.`)
        .setThumbnail('https://i.imgur.com/iKFGRiS.png')
        .setTimestamp()
        .setFooter({ text: 'YouTube Notifications • RankCore' });

      try {
        const ch = await i.client.channels.fetch(config.Channel);
        await ch.send({ content: config.PingRole ? `<@&${config.PingRole}>` : null, embeds: [testEmbed] });
        await i.reply({ content: `✅ Test notification sent to <#${config.Channel}>!`, flags: MessageFlags.Ephemeral });
      } catch (err) {
        await i.reply({ content: `❌ Failed to send: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    // ── Back ──────────────────────────────────────────────────────────────
    if (i.customId === 'social_back') {
      collector.stop('back');
      return handleMainMenu(i);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'refresh') return handleYouTubeConfig(interaction);
    if (reason === 'time') {
      await msg.edit({ components: [] }).catch(() => {});
    }
  });
}

// ─── Twitch config flow ───────────────────────────────────────────────────────
async function handleTwitchConfig(interaction) {
  const configs = await TwitchNotification.find({ Guild: interaction.guild.id });

  const embed = new EmbedBuilder()
    .setColor('#9147FF')
    .setTitle('Twitch Notifications — Configuration')
    .setDescription('```yml\n' +
      configs.map(c => `Setup ${c.SetupNumber}:\n  channel: "${c.Channel}"\n  streamer: "${c.Streamer}"\n  ping: "${c.PingRole ?? 'none'}"\n  stream_end: ${c.NotifyStreamEnd}`).join('\n') +
      (configs.length ? '' : 'No setups configured yet.') + '```')
    .addFields(
      { name: 'Slots Used', value: `${configs.length}/${MAX_TWITCH_SETUPS}`, inline: true },
      { name: 'Poll Rate', value: '⚡ Every 30 seconds', inline: true },
    )
    .setFooter({ text: 'RankCore • Twitch Notifications' });

  const usedSlots = new Set(configs.map(c => c.SetupNumber));
  const addOptions = [];
  for (let i = 1; i <= MAX_TWITCH_SETUPS; i++) {
    if (!usedSlots.has(i)) {
      addOptions.push(
        new StringSelectMenuOptionBuilder().setLabel(`Add Setup ${i}`).setValue(`tw_add_${i}`).setEmoji('➕')
      );
    }
  }

  const removeOptions = configs.map(c =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Remove Setup ${c.SetupNumber} — ${c.Streamer.replace('https://www.twitch.tv/', '')}`)
      .setValue(`tw_remove_${c.SetupNumber}`)
      .setEmoji('🗑️')
  );

  const rows = [];
  if (addOptions.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('tw_add_select').setPlaceholder('➕ Add a Twitch setup...').addOptions(addOptions)
    ));
  }
  if (removeOptions.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('tw_remove_select').setPlaceholder('🗑️ Remove a setup...').addOptions(removeOptions)
    ));
  }

  const testButtons = configs.map(c =>
    new ButtonBuilder().setCustomId(`tw_test_${c.SetupNumber}`).setLabel(`Test Setup ${c.SetupNumber}`).setStyle(ButtonStyle.Secondary).setEmoji('🔔')
  );
  if (testButtons.length) rows.push(new ActionRowBuilder().addComponents(testButtons.slice(0, 5)));

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('social_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
  ));

  const msg = await interaction.update({ embeds: [embed], components: rows, fetchReply: true });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async i => {
    if (i.customId === 'tw_add_select') {
      const slotNum = parseInt(i.values[0].replace('tw_add_', ''));
      await i.reply({ content: `**Twitch Setup ${slotNum}** — Send the Twitch URL (e.g. \`https://www.twitch.tv/username\`):`, flags: MessageFlags.Ephemeral });

      const twitchUrl = await collectMessage(i.channel, i.user.id);
      if (!twitchUrl || !twitchUrl.includes('twitch.tv/')) return safeEphemeral(i, '❌ Invalid Twitch URL.');

      await i.followUp({ content: 'Send the **Discord channel** to post notifications in:', flags: MessageFlags.Ephemeral });
      const chInput = await collectMessage(i.channel, i.user.id);
      if (!chInput) return safeEphemeral(i, '⏱️ Timed out.');
      const discordChannel = i.guild.channels.cache.get(chInput.replace(/[<#>]/g, ''));
      if (!discordChannel) return safeEphemeral(i, '❌ Invalid channel.');

      await i.followUp({ content: 'Send the **custom notification message**:', flags: MessageFlags.Ephemeral });
      const customMsg = await collectMessage(i.channel, i.user.id);
      if (!customMsg) return safeEphemeral(i, '⏱️ Timed out.');

      await i.followUp({ content: '(Optional) Send a **role to ping** or type `skip`:', flags: MessageFlags.Ephemeral });
      const roleInput = await collectMessage(i.channel, i.user.id);
      const roleId = roleInput && roleInput.toLowerCase() !== 'skip' ? roleInput.replace(/[<@&>]/g, '') : null;

      await i.followUp({ content: 'Send **stream end notifications?** Type `yes` or `no`:', flags: MessageFlags.Ephemeral });
      const endInput = await collectMessage(i.channel, i.user.id);
      const notifyEnd = endInput?.toLowerCase() === 'yes';

      await TwitchNotification.create({
        Guild: i.guild.id,
        Channel: discordChannel.id,
        Streamer: twitchUrl,
        Message: customMsg,
        PingRole: roleId,
        NotifyStreamEnd: notifyEnd,
        SetupNumber: slotNum,
      });

      await i.followUp({ content: `✅ Twitch Setup ${slotNum} configured!`, flags: MessageFlags.Ephemeral });
      collector.stop('refresh');
    }

    if (i.customId === 'tw_remove_select') {
      const slotNum = parseInt(i.values[0].replace('tw_remove_', ''));
      await TwitchNotification.deleteOne({ Guild: i.guild.id, SetupNumber: slotNum });
      await i.reply({ content: `🗑️ Twitch Setup ${slotNum} removed.`, flags: MessageFlags.Ephemeral });
      collector.stop('refresh');
    }

    if (i.customId.startsWith('tw_test_')) {
      const slotNum = parseInt(i.customId.replace('tw_test_', ''));
      const config = await TwitchNotification.findOne({ Guild: i.guild.id, SetupNumber: slotNum });
      if (!config) return i.reply({ content: '❌ Config not found.', flags: MessageFlags.Ephemeral });

      const testEmbed = new EmbedBuilder()
        .setColor('#9147FF')
        .setTitle('🧪 Test Notification — Twitch')
        .setURL('https://www.twitch.tv')
        .setDescription(`${config.Message}\n\n🔴 **TEST STREAM IS LIVE!**\n🎮 Playing **Test Game**\n👥 **1,337** viewers`)
        .setTimestamp()
        .setFooter({ text: 'Twitch Notifications • RankCore' });

      try {
        const ch = await i.client.channels.fetch(config.Channel);
        await ch.send({ content: config.PingRole ? `<@&${config.PingRole}>` : null, embeds: [testEmbed] });
        await i.reply({ content: `✅ Test notification sent to <#${config.Channel}>!`, flags: MessageFlags.Ephemeral });
      } catch (err) {
        await i.reply({ content: `❌ Failed: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (i.customId === 'social_back') {
      collector.stop('back');
      return handleMainMenu(i);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'refresh') return handleTwitchConfig(interaction);
    if (reason === 'time') await msg.edit({ components: [] }).catch(() => {});
  });
}

// ─── Twitter/X config flow ────────────────────────────────────────────────────
async function handleTwitterConfig(interaction) {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const configs = await TwitterNotification.find({ Guild: interaction.guild.id });

  const embed = new EmbedBuilder()
    .setColor('#1DA1F2')
    .setTitle('Twitter / X Notifications — Configuration')
    .setDescription('```yml\n' +
      configs.map(c => `Setup ${c.SetupNumber}:\n  channel: "${c.Channel}"\n  handle: "@${c.Handle}"\n  ping: "${c.PingRole ?? 'none'}"`).join('\n') +
      (configs.length ? '' : 'No setups configured yet.') + '```')
    .addFields(
      { name: 'Slots Used', value: `${configs.length}/${MAX_TWITTER_SETUPS}`, inline: true },
      { name: 'Poll Rate', value: '⚡ Every 60 seconds', inline: true },
    )
    .setFooter({ text: 'RankCore • Twitter/X Notifications' });

  const usedSlots = new Set(configs.map(c => c.SetupNumber));
  const addOptions = [];
  for (let i = 1; i <= MAX_TWITTER_SETUPS; i++) {
    if (!usedSlots.has(i)) {
      addOptions.push(
        new StringSelectMenuOptionBuilder().setLabel(`Add Setup ${i}`).setValue(`tx_add_${i}`).setEmoji('➕')
      );
    }
  }

  const removeOptions = configs.map(c =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Remove Setup ${c.SetupNumber} — @${c.Handle}`)
      .setValue(`tx_remove_${c.SetupNumber}`)
      .setEmoji('🗑️')
  );

  const rows = [];
  if (addOptions.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('tx_add_select').setPlaceholder('➕ Add a Twitter/X setup...').addOptions(addOptions)
    ));
  }
  if (removeOptions.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('tx_remove_select').setPlaceholder('🗑️ Remove a setup...').addOptions(removeOptions)
    ));
  }

  const testButtons = configs.map(c =>
    new ButtonBuilder().setCustomId(`tx_test_${c.SetupNumber}`).setLabel(`Test Setup ${c.SetupNumber}`).setStyle(ButtonStyle.Secondary).setEmoji('🔔')
  );
  if (testButtons.length) rows.push(new ActionRowBuilder().addComponents(testButtons.slice(0, 5)));

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('social_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
  ));

  const msg = await interaction.update({ embeds: [embed], components: rows, fetchReply: true });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async i => {
    if (i.customId === 'tx_add_select') {
      const slotNum = parseInt(i.values[0].replace('tx_add_', ''));
      await i.reply({ content: `**Twitter/X Setup ${slotNum}** — Send the Twitter handle (without @, e.g. \`elonmusk\`):`, flags: MessageFlags.Ephemeral });

      const handle = await collectMessage(i.channel, i.user.id);
      if (!handle) return safeEphemeral(i, '⏱️ Timed out.');

      await i.followUp({ content: '🔍 Verifying handle...', flags: MessageFlags.Ephemeral });
      const userId = await resolveTwitterUserId(handle, bearerToken).catch(() => null);
      if (!userId) return safeEphemeral(i, `❌ Could not find Twitter/X user @${handle}. Check the handle and try again.`);

      await i.followUp({ content: 'Send the **Discord channel** for notifications:', flags: MessageFlags.Ephemeral });
      const chInput = await collectMessage(i.channel, i.user.id);
      if (!chInput) return safeEphemeral(i, '⏱️ Timed out.');
      const discordChannel = i.guild.channels.cache.get(chInput.replace(/[<#>]/g, ''));
      if (!discordChannel) return safeEphemeral(i, '❌ Invalid channel.');

      await i.followUp({ content: 'Send the **custom notification message**:', flags: MessageFlags.Ephemeral });
      const customMsg = await collectMessage(i.channel, i.user.id);
      if (!customMsg) return safeEphemeral(i, '⏱️ Timed out.');

      await i.followUp({ content: '(Optional) Send a **role to ping** or type `skip`:', flags: MessageFlags.Ephemeral });
      const roleInput = await collectMessage(i.channel, i.user.id);
      const roleId = roleInput && roleInput.toLowerCase() !== 'skip' ? roleInput.replace(/[<@&>]/g, '') : null;

      await TwitterNotification.create({
        Guild: i.guild.id,
        Channel: discordChannel.id,
        Handle: handle.replace('@', ''),
        ResolvedUserId: userId,
        Message: customMsg,
        PingRole: roleId,
        SetupNumber: slotNum,
      });

      await i.followUp({ content: `✅ Twitter/X Setup ${slotNum} configured for @${handle}!`, flags: MessageFlags.Ephemeral });
      collector.stop('refresh');
    }

    if (i.customId === 'tx_remove_select') {
      const slotNum = parseInt(i.values[0].replace('tx_remove_', ''));
      await TwitterNotification.deleteOne({ Guild: i.guild.id, SetupNumber: slotNum });
      await i.reply({ content: `🗑️ Twitter/X Setup ${slotNum} removed.`, flags: MessageFlags.Ephemeral });
      collector.stop('refresh');
    }

    if (i.customId.startsWith('tx_test_')) {
      const slotNum = parseInt(i.customId.replace('tx_test_', ''));
      const config = await TwitterNotification.findOne({ Guild: i.guild.id, SetupNumber: slotNum });
      if (!config) return i.reply({ content: '❌ Config not found.', flags: MessageFlags.Ephemeral });

      const testEmbed = new EmbedBuilder()
        .setColor('#1DA1F2')
        .setAuthor({ name: `@${config.Handle} on X (Twitter)`, iconURL: 'https://i.imgur.com/C7u8gqg.png' })
        .setTitle('🧪 Test Notification — Twitter/X')
        .setDescription(`${config.Message}\n\nThis is a test tweet from RankCore! Everything is working correctly. 🎉`)
        .addFields({ name: '🔗 View Post', value: `https://twitter.com/${config.Handle}`, inline: false })
        .setTimestamp()
        .setFooter({ text: 'Twitter/X Notifications • RankCore' });

      try {
        const ch = await i.client.channels.fetch(config.Channel);
        await ch.send({ content: config.PingRole ? `<@&${config.PingRole}>` : null, embeds: [testEmbed] });
        await i.reply({ content: `✅ Test notification sent to <#${config.Channel}>!`, flags: MessageFlags.Ephemeral });
      } catch (err) {
        await i.reply({ content: `❌ Failed: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (i.customId === 'social_back') {
      collector.stop('back');
      return handleMainMenu(i);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'refresh') return handleTwitterConfig(interaction);
    if (reason === 'time') await msg.edit({ components: [] }).catch(() => {});
  });
}

// ─── Main menu ────────────────────────────────────────────────────────────────
async function handleMainMenu(interaction) {
  const embed = await buildOverviewEmbed(interaction.guild.id);

  const platformSelect = new StringSelectMenuBuilder()
    .setCustomId('social_platform_select')
    .setPlaceholder('🌐 Select a platform to configure...')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('YouTube').setDescription('Configure upload & live stream notifications').setValue('youtube').setEmoji('▶️'),
      new StringSelectMenuOptionBuilder().setLabel('Twitch').setDescription('Configure stream live/offline notifications').setValue('twitch').setEmoji('🟣'),
      new StringSelectMenuOptionBuilder().setLabel('Twitter / X').setDescription('Configure tweet notifications').setValue('twitter').setEmoji('🐦'),
    );

  const row = new ActionRowBuilder().addComponents(platformSelect);

  const updateMethod = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
  const msg = await interaction[updateMethod]({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  }).catch(async () => {
    // If neither reply nor editReply works, try update (for component interactions)
    return interaction.update({ embeds: [embed], components: [row], fetchReply: true });
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId === 'social_platform_select',
    max: 1,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async i => {
    const platform = i.values[0];
    if (platform === 'youtube') return handleYouTubeConfig(i);
    if (platform === 'twitch') return handleTwitchConfig(i);
    if (platform === 'twitter') return handleTwitterConfig(i);
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') await msg.edit({ components: [] }).catch(() => {});
  });
}

// ─── Module export ────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('social')
    .setDescription('Configure social media notifications for YouTube, Twitch, and Twitter/X.')
    .addSubcommand(sub =>
      sub.setName('config').setDescription('Open the social notifications configuration panel.')
    ),

  premium: true,
  premiumTier: 'basic',

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ You need **Administrator** permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'config') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return handleMainMenu(interaction);
    }
  },
};