const { MessageFlags, ChannelType, EmbedBuilder } = require("discord.js");
const { safeReply, safeDeferReply, isDead } = require('./safeInteraction');
const avatarRatingSchema = require("../../../Schemas/avatarRating");
const GuildConfig = require("../../../Schemas/guildInviteConfig");
const { getModal, clearModal, getPanel, updatePanelData } = require("../../../Utils/setupPanelStore");

// Resolve channel from text input (ID or name)
function resolveChannel(guild, raw, type = ChannelType.GuildText) {
  const clean = raw.replace(/[<#>]/g, "").trim();
  return guild.channels.cache.get(clean) || guild.channels.cache.find(c => c.name === clean && c.type === type) || null;
}

module.exports = async function handleModal(interaction, client) {
  const { customId } = interaction;
  const confessionCommand = client.commands.get('confession');

  // These modals are awaited inline by ticketActions.js via awaitModalSubmit().
  // The collector handles them — if we let them fall through to setupPanelModal
  // it logs a spurious warning and may double-reply. Silently bail out here.
  if (customId === 'close_reason_modal' || customId === 'ticket_reason_modal') return;
  if (customId.startsWith('ticket_note_modal_') || customId.startsWith('ticket_intake_')) return;

  if (customId.includes('ConfessionModal') && confessionCommand?.handleModal) {
    return confessionCommand.handleModal(interaction);
  }

  if (customId.startsWith("rate_avatar_modal_")) {
    const userId = customId.split("_")[3];
    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (!targetUser) return interaction.reply({ content: "User not found.", flags: MessageFlags.Ephemeral });
    const rating = parseInt(interaction.fields.getTextInputValue("rating_input"));
    if (isNaN(rating) || rating < 1 || rating > 100)
      return interaction.reply({ content: "Enter a number between 1 and 100.", flags: MessageFlags.Ephemeral });
    await avatarRatingSchema.findOneAndUpdate({ Guild: interaction.guild.id, User: targetUser.id }, { $push: { Ratings: rating } }, { upsert: true });
    return interaction.reply({ content: `You rated **${targetUser.username}**'s avatar **${rating}%**!`, flags: MessageFlags.Ephemeral });
  }

  if (customId.startsWith("inviteConfigModal_")) {
    const [_, guildId, channelId] = customId.split("_");
    const welcomeMessage = interaction.fields.getTextInputValue("welcomeMessage");
    await GuildConfig.create({ guildId, channelId, welcomeMessage });
    return interaction.reply({ content: "Invite system configured!", flags: MessageFlags.Ephemeral });
  }

  // ── Premium: AI Config modals ─────────────────────────────────────────────
  if (customId === "ai_modal_channel") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const aiConfig = require("../../../Schemas/aiSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/ai-config");
    const raw = interaction.fields.getTextInputValue("ai_ch_input");
    const channel = resolveChannel(interaction.guild, raw);
    if (!channel) return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    const data = await aiConfig.create({ guildId: interaction.guild.id, channelId: channel.id, blacklists: [] });
    if (panel) { updatePanelData(modalCtx.messageId, data); await interaction.message?.edit({ components: [buildPanel(data, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> AI bound to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  if (customId === "ai_modal_bl_add") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const aiConfig = require("../../../Schemas/aiSchema");
    const { buildPanel, blacklistPanel } = require("../../../Commands/PremiumCommands/ai-config");
    const userId = interaction.fields.getTextInputValue("ai_bl_user_input").trim();
    const data = await aiConfig.findOne({ guildId: interaction.guild.id });
    if (!data) return interaction.reply({ content: "<:crossy:1555544390221562048> AI is not configured.", flags: MessageFlags.Ephemeral });
    if (data.blacklists.includes(userId)) return interaction.reply({ content: "<:crossy:1555544390221562048> This user is already blacklisted.", flags: MessageFlags.Ephemeral });
    data.blacklists.push(userId);
    await data.save();
    if (panel) { updatePanelData(modalCtx.messageId, data); await interaction.message?.edit({ components: [blacklistPanel(data, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> User \`${userId}\` has been blacklisted from AI.`, flags: MessageFlags.Ephemeral });
  }

  if (customId === "ai_modal_bl_remove") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const aiConfig = require("../../../Schemas/aiSchema");
    const { buildPanel, blacklistPanel } = require("../../../Commands/PremiumCommands/ai-config");
    const userId = interaction.fields.getTextInputValue("ai_bl_remove_input").trim();
    const data = await aiConfig.findOne({ guildId: interaction.guild.id });
    if (!data) return interaction.reply({ content: "<:crossy:1555544390221562048> AI is not configured.", flags: MessageFlags.Ephemeral });
    if (!data.blacklists.includes(userId)) return interaction.reply({ content: "<:crossy:1555544390221562048> That user is not blacklisted.", flags: MessageFlags.Ephemeral });
    data.blacklists = data.blacklists.filter(id => id !== userId);
    await data.save();
    if (panel) { updatePanelData(modalCtx.messageId, data); await interaction.message?.edit({ components: [blacklistPanel(data, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> User \`${userId}\` has been removed from the blacklist.`, flags: MessageFlags.Ephemeral });
  }

  // ── Premium: Twitch modal ─────────────────────────────────────────────────
  if (customId === "twitch_modal_setup") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const TwitchNotification = require("../../../Schemas/twitchSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/twitchNotification");
    const rawCh = interaction.fields.getTextInputValue("twitch_channel");
    const streamerUrl = interaction.fields.getTextInputValue("twitch_streamer").trim();
    const message = interaction.fields.getTextInputValue("twitch_message").trim() || "<:LEred:1555544262123323422> {streamer} is now live!";
    const channel = resolveChannel(interaction.guild, rawCh);
    if (!channel) return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    if (!streamerUrl.startsWith("https://www.twitch.tv/")) return interaction.reply({ content: "<:crossy:1555544390221562048> Invalid Twitch URL. Must start with `https://www.twitch.tv/`.", flags: MessageFlags.Ephemeral });
    const notification = await TwitchNotification.create({ Guild: interaction.guild.id, Channel: channel.id, Streamer: streamerUrl, Message: message });
    if (panel) { updatePanelData(modalCtx.messageId, notification); await interaction.message?.edit({ components: [buildPanel(notification, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Twitch notifications set up!\n**Channel:** ${channel}\n**Streamer:** \`${streamerUrl}\``, flags: MessageFlags.Ephemeral });
  }

  // ── Premium: Twitter modal ────────────────────────────────────────────────
  if (customId === "twitter_modal_setup") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const TwitterNotification = require("../../../Schemas/twitterSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/twitter");
    const rawCh = interaction.fields.getTextInputValue("twitter_channel");
    const handle = interaction.fields.getTextInputValue("twitter_handle").replace("@", "").trim();
    const message = interaction.fields.getTextInputValue("twitter_message").trim() || "<:n_bot:1555544367886770176> New tweet from @{handle}!";
    const channel = resolveChannel(interaction.guild, rawCh);
    if (!channel) return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    const notification = await TwitterNotification.create({ Guild: interaction.guild.id, Channel: channel.id, Handle: handle, Message: message });
    if (panel) { updatePanelData(modalCtx.messageId, notification); await interaction.message?.edit({ components: [buildPanel(notification, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Twitter/X notifications set up!\n**Channel:** ${channel}\n**Account:** \`@${handle}\``, flags: MessageFlags.Ephemeral });
  }

  // ── Premium: YouTube modals ───────────────────────────────────────────────
  if (customId === "yt_modal_add") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const YouTubeNotification = require("../../../Schemas/youtubeSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/youtube");
    const rawCh = interaction.fields.getTextInputValue("yt_channel");
    const ytUrl = interaction.fields.getTextInputValue("yt_url").trim();
    const message = interaction.fields.getTextInputValue("yt_message").trim() || "<:files:1555544445565407352> New video from {channel}!";
    const channel = resolveChannel(interaction.guild, rawCh);
    if (!channel) return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    if (!ytUrl.match(/^(https:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9._-]+|channel\/[a-zA-Z0-9_-]+))$/)) return interaction.reply({ content: "<:crossy:1555544390221562048> Invalid YouTube URL.", flags: MessageFlags.Ephemeral });
    const slotNum = modalCtx.ytSlot || 1;
    await YouTubeNotification.create({ Guild: interaction.guild.id, Channel: channel.id, YouTubeChannel: ytUrl, Message: message, SetupNumber: slotNum, LastNotified: new Date() });
    const notifications = await YouTubeNotification.find({ Guild: interaction.guild.id });
    if (panel) { updatePanelData(modalCtx.messageId, notifications); await interaction.message?.edit({ components: [buildPanel(notifications, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> YouTube notifications added to slot ${slotNum}!\n**Channel:** ${channel}\n**YouTube:** \`${ytUrl}\``, flags: MessageFlags.Ephemeral });
  }

  if (customId === "yt_modal_remove") {
    const modalCtx = getModal(interaction.user.id, interaction.guild.id);
    if (!modalCtx) return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired.", flags: MessageFlags.Ephemeral });
    const panel = getPanel(modalCtx.messageId);
    const YouTubeNotification = require("../../../Schemas/youtubeSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/youtube");
    const slotStr = interaction.fields.getTextInputValue("yt_remove_slot").trim();
    const slotNum = parseInt(slotStr);
    if (isNaN(slotNum) || slotNum < 1 || slotNum > 5) return interaction.reply({ content: "<:crossy:1555544390221562048> Enter a valid slot number (1–5).", flags: MessageFlags.Ephemeral });
    const result = await YouTubeNotification.deleteOne({ Guild: interaction.guild.id, SetupNumber: slotNum });
    if (result.deletedCount === 0) return interaction.reply({ content: `<:crossy:1555544390221562048> No setup found in slot ${slotNum}.`, flags: MessageFlags.Ephemeral });
    const notifications = await YouTubeNotification.find({ Guild: interaction.guild.id });
    if (panel) { updatePanelData(modalCtx.messageId, notifications); await interaction.message?.edit({ components: [buildPanel(notifications, panel.accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); }
    clearModal(interaction.user.id, interaction.guild.id);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> YouTube notification slot ${slotNum} removed.`, flags: MessageFlags.Ephemeral });
  }

  // ── /cmd create modal ─────────────────────────────────────────────────────
  if (customId === 'cmd_create_modal') {
    const { REST, Routes } = require('discord.js');
    const CustomCommand = require('../../../Schemas/customCommandSchema');
    const { getGuildTier, getLimit } = require('../../../Utils/premiumTiers');

    const name     = interaction.fields.getTextInputValue('cmd_name').toLowerCase().trim().replace(/\s+/g, '-');
    const desc     = interaction.fields.getTextInputValue('cmd_desc').trim();
    const response = interaction.fields.getTextInputValue('cmd_response').trim();
    const embedRaw = (interaction.fields.getTextInputValue('cmd_embed') || '').toLowerCase().trim();
    const plain    = interaction.fields.getTextInputValue('cmd_plain').trim();

    if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
      return interaction.reply({ content: '<:crossy:1555544390221562048> Invalid command name — use lowercase letters, numbers, hyphens or underscores only (max 32 chars).', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guild.id;
    const tier    = await getGuildTier(guildId);
    const limit   = getLimit(tier, 'customCommands');
    const count   = await CustomCommand.countDocuments({ Guild: guildId });
    if (count >= limit) {
      return interaction.reply({ content: `<:crossy:1555544390221562048> Custom command limit reached (${count}/${limit} on ${tier} plan).`, flags: MessageFlags.Ephemeral });
    }

    const exists = await CustomCommand.findOne({ Guild: guildId, Name: name });
    if (exists) return interaction.reply({ content: `<:crossy:1555544390221562048> A command named \`/${name}\` already exists. Use \`/cmd edit\` to update it.`, flags: MessageFlags.Ephemeral });

    const isEmbed = embedRaw === 'yes' || embedRaw === 'y' || embedRaw === 'true';
    await CustomCommand.create({
      Guild: guildId, Name: name, Description: desc,
      Response: response, IsEmbed: isEmbed,
      PlainTextContent: plain || '',
      Enabled: true,
    });

    // Register slash command in the guild
    try {
      const rest = new REST({ version: '10' }).setToken(process.env.token ?? process.env.BOT_TOKEN);
      await rest.post(Routes.applicationGuildCommands(client.user.id, guildId), {
        body: { name, description: desc || 'Custom command', type: 1 },
      });
    } catch (e) { console.warn('[cmd create] REST sync failed:', e.message); }

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('<a:tickyy:1555544712687915008> Custom Command Created')
        .addFields(
          { name: 'Command',     value: `\`/${name}\``,         inline: true },
          { name: 'Embed',       value: isEmbed ? 'Yes' : 'No', inline: true },
          { name: 'Description', value: desc },
          { name: 'Response',    value: response.slice(0, 512) },
          ...(plain ? [{ name: 'Plain Text Prefix', value: plain }] : []),
        )
        .setFooter({ text: `Use /cmd edit ${name} to make changes` })],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── /cmd edit modal ───────────────────────────────────────────────────────
  if (customId.startsWith('cmd_edit_modal:')) {
    const CustomCommand = require('../../../Schemas/customCommandSchema');
    const name     = customId.split(':')[1];
    const desc     = interaction.fields.getTextInputValue('cmd_desc').trim();
    const response = interaction.fields.getTextInputValue('cmd_response').trim();
    const embedRaw = (interaction.fields.getTextInputValue('cmd_embed') || '').toLowerCase().trim();
    const plain    = interaction.fields.getTextInputValue('cmd_plain').trim();
    const outCh    = interaction.fields.getTextInputValue('cmd_output_channel').trim();

    const isEmbed = embedRaw === 'yes' || embedRaw === 'y' || embedRaw === 'true';

    const cmd = await CustomCommand.findOne({ Guild: interaction.guild.id, Name: name });
    if (!cmd) return interaction.reply({ content: `<:crossy:1555544390221562048> Command \`/${name}\` not found.`, flags: MessageFlags.Ephemeral });

    cmd.Description       = desc;
    cmd.Response          = response;
    cmd.IsEmbed           = isEmbed;
    cmd.PlainTextContent  = plain || '';
    cmd.OutputChannelId   = outCh || null;
    await cmd.save();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle(`<:files:1555544445565407352> \`/${name}\` Updated`)
        .addFields(
          { name: 'Embed',       value: isEmbed ? 'Yes' : 'No',                         inline: true },
          ...(outCh ? [{ name: 'Output Channel', value: `<#${outCh}>`,                  inline: true }] : []),
          { name: 'Response',    value: response.slice(0, 512) },
          ...(plain ? [{ name: 'Plain Text Prefix', value: plain }] : []),
        )],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Delegate to setup panel modal handler
  const { handleSetupModal } = require("./setupPanelModal");
  if (handleSetupModal) return handleSetupModal(interaction, client);
};