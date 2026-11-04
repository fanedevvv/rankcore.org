/**
 * setupPanelModal.js
 * Handles all modal submissions from setup-command panels.
 * Every modal ID here is registered by a showModal() call in button.js.
 * getModal() retrieves the stored context (messageId, command, extras).
 */
const { ChannelType, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { getModal, clearModal, getPanel, updatePanelData } = require("../../../Utils/setupPanelStore");

// ── Channel resolver ──────────────────────────────────────────────────────────
function resolveChannel(guild, raw, type = ChannelType.GuildText) {
  const clean = raw.replace(/[<#>]/g, "").trim();
  return (
    guild.channels.cache.get(clean) ||
    guild.channels.cache.find(c => c.name === clean && c.type === type) ||
    null
  );
}

// ── Role resolver ─────────────────────────────────────────────────────────────
function resolveRole(guild, raw) {
  const clean = raw.replace(/[<@&>]/g, "").trim();
  return (
    guild.roles.cache.get(clean) ||
    guild.roles.cache.find(r => r.name.toLowerCase() === clean.toLowerCase()) ||
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────

async function handleSetupModal(interaction, client) {
  const { customId } = interaction;
  const guild = interaction.guild;

  // Retrieve stored modal context (set by registerModal in button.js)
  const modalCtx = getModal(interaction.user.id, guild.id);
  const guildId  = guild.id;

  // Helper: get the registered panel entry and re-render on save
  const panel     = modalCtx ? getPanel(modalCtx.messageId) : null;
  const accent    = panel?.accent || 0x6366f1;

  // ── Booster ─────────────────────────────────────────────────────────────────
  if (customId === "booster_modal_set") {
    const BoosterChannel = require("../../../Schemas/boosterChannel");
    const { buildPanel }  = require("../../../Commands/Setups/booster");
    const raw     = interaction.fields.getTextInputValue("booster_channel_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await BoosterChannel.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Booster notification channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Christmas — channel ──────────────────────────────────────────────────────
  if (customId === "xmas_modal_channel") {
    const christmasSchema = require("../../../Schemas/christmasSchema");
    const { configPanel }  = require("../../../Commands/Setups/christmas-config");
    const raw     = interaction.fields.getTextInputValue("xmas_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await christmasSchema.findOneAndUpdate(
      { Guild: guildId },
      { Guild: guildId, Channel: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Christmas channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Christmas — role ─────────────────────────────────────────────────────────
  if (customId === "xmas_modal_role") {
    const christmasSchema = require("../../../Schemas/christmasSchema");
    const { configPanel }  = require("../../../Commands/Setups/christmas-config");
    const raw  = interaction.fields.getTextInputValue("xmas_role_input");
    const role = resolveRole(guild, raw);
    if (!role) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Role not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await christmasSchema.findOneAndUpdate(
      { Guild: guildId },
      { Guild: guildId, PingRole: role.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Christmas ping role set to ${role}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Halloween — channel ──────────────────────────────────────────────────────
  if (customId === "hw_modal_channel") {
    const halloweenSchema = require("../../../Schemas/halloweenSchema");
    const { configPanel }  = require("../../../Commands/Setups/halloween-config");
    const raw     = interaction.fields.getTextInputValue("hw_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await halloweenSchema.findOneAndUpdate(
      { Guild: guildId },
      { Guild: guildId, Channel: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Halloween channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Halloween — role ─────────────────────────────────────────────────────────
  if (customId === "hw_modal_role") {
    const halloweenSchema = require("../../../Schemas/halloweenSchema");
    const { configPanel }  = require("../../../Commands/Setups/halloween-config");
    const raw  = interaction.fields.getTextInputValue("hw_role_input");
    const role = resolveRole(guild, raw);
    if (!role) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Role not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await halloweenSchema.findOneAndUpdate(
      { Guild: guildId },
      { Guild: guildId, PingRole: role.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Halloween ping role set to ${role}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Guess The Number — enable ────────────────────────────────────────────────
  if (customId === "gtn_modal_enable") {
    const gtnSchema = require("../../../Schemas/guess");
    const { buildPanel } = require("../../../Commands/Setups/guessthenumber");
    const raw     = interaction.fields.getTextInputValue("gtn_channel_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const number = Math.floor(Math.random() * 1_000_000) + 1;
    const data   = await gtnSchema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id, number, enabled: true },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Guess The Number enabled in ${channel}. Number set: \`${number}\`.`, flags: MessageFlags.Ephemeral });
  }

  // ── Join To Create ───────────────────────────────────────────────────────────
  if (customId === "jtc_modal_setup") {
    const jtcSchema   = require("../../../Schemas/jointocreate");
    const { buildPanel } = require("../../../Commands/Setups/join-to-create");
    const rawChannel  = interaction.fields.getTextInputValue("jtc_channel").trim();
    const rawCategory = interaction.fields.getTextInputValue("jtc_category")?.trim() || "";
    const limitRaw    = interaction.fields.getTextInputValue("jtc_limit")?.trim() || "";
    const inheritRaw  = interaction.fields.getTextInputValue("jtc_inherit")?.trim().toLowerCase() || "no";

    const createChannel = guild.channels.cache.get(rawChannel) ||
      guild.channels.cache.find(c => c.name === rawChannel && c.type === ChannelType.GuildVoice);
    if (!createChannel || createChannel.type !== ChannelType.GuildVoice) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Create channel not found or is not a voice channel.", flags: MessageFlags.Ephemeral });
    }

    let categoryId = null;
    if (rawCategory) {
      const cat = guild.channels.cache.get(rawCategory) ||
        guild.channels.cache.find(c => c.name === rawCategory && c.type === ChannelType.GuildCategory);
      if (!cat) {
        clearModal(interaction.user.id, guildId);
        return interaction.reply({ content: "<:crossy:1555544390221562048> Category not found.", flags: MessageFlags.Ephemeral });
      }
      categoryId = cat.id;
    }

    const limit  = limitRaw ? Math.min(Math.max(parseInt(limitRaw) || 0, 2), 10) : null;
    const inherit = inheritRaw === "yes" || inheritRaw === "y";

    const data = await jtcSchema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: createChannel.id, categoryId, limit, inheritPermissions: inherit, enabled: true },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({
      content: `<a:tickyy:1555544712687915008> Join To Create configured!\n**Create Channel:** ${createChannel}${categoryId ? `\n**Category:** <#${categoryId}>` : ""}${limit ? `\n**Limit:** ${limit}` : ""}\n**Inherit Perms:** ${inherit ? "Yes" : "No"}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── Level Roles — add ────────────────────────────────────────────────────────
  if (customId === "lvlrole_modal_add") {
    const levelRoleSchema = require("../../../Schemas/levelRoleSchema");
    const { buildPanel }   = require("../../../Commands/Setups/levelroles");
    const roleId = interaction.fields.getTextInputValue("lvlrole_role_id").trim();
    const level  = parseInt(interaction.fields.getTextInputValue("lvlrole_level").trim());
    const role   = guild.roles.cache.get(roleId);

    if (!role) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Role not found with that ID.", flags: MessageFlags.Ephemeral });
    }
    if (isNaN(level) || level < 1) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Invalid level number.", flags: MessageFlags.Ephemeral });
    }

    let data = await levelRoleSchema.findOne({ GuildID: guildId });
    if (!data) data = new levelRoleSchema({ GuildID: guildId, roles: [] });

    const existing = data.roles.find(r => r.level === level);
    if (existing) existing.roleId = roleId;
    else data.roles.push({ level, roleId });
    data.roles.sort((a, b) => a.level - b.level);
    await data.save();

    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Added ${role} as milestone reward at level **${level}**.`, flags: MessageFlags.Ephemeral });
  }

  // ── Level Roles — remove ─────────────────────────────────────────────────────
  if (customId === "lvlrole_modal_remove") {
    const levelRoleSchema = require("../../../Schemas/levelRoleSchema");
    const { buildPanel }   = require("../../../Commands/Setups/levelroles");
    const level = parseInt(interaction.fields.getTextInputValue("lvlrole_remove_level").trim());
    if (isNaN(level)) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Invalid level number.", flags: MessageFlags.Ephemeral });
    }
    const data = await levelRoleSchema.findOne({ GuildID: guildId });
    if (!data || !data.roles.find(r => r.level === level)) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: `<:crossy:1555544390221562048> No milestone found for level **${level}**.`, flags: MessageFlags.Ephemeral });
    }
    data.roles = data.roles.filter(r => r.level !== level);
    await data.save();
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Removed milestone for level **${level}**.`, flags: MessageFlags.Ephemeral });
  }

  // ── Reaction Role — add ──────────────────────────────────────────────────────
  if (customId === "rr_modal_add") {
    const reactionRoleSchema = require("../../../Schemas/reactionrole");
    const { buildPanel }      = require("../../../Commands/Setups/reactionrole");
    const msgId  = interaction.fields.getTextInputValue("rr_msg_id").trim();
    const emoji  = interaction.fields.getTextInputValue("rr_emoji").trim();
    const roleId = interaction.fields.getTextInputValue("rr_role_id").trim();
    const role   = guild.roles.cache.get(roleId);

    if (!role) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Role not found.", flags: MessageFlags.Ephemeral });
    }

    await reactionRoleSchema.create({ Guild: guildId, MessageID: msgId, Emoji: emoji, Role: roleId });

    // Try to react to the target message
    for (const channel of guild.channels.cache.filter(c => c.isTextBased()).values()) {
      try {
        const targetMsg = channel.messages.cache.get(msgId) ?? await channel.messages.fetch(msgId).catch(() => null);
        if (targetMsg) {
          await targetMsg.react(emoji).catch(() => {});
          break;
        }
      } catch {}
    }

    if (panel) {
      await interaction.message?.edit({ components: [buildPanel(accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Reaction role added!\n**Message:** \`${msgId}\` | **Emoji:** ${emoji} | **Role:** ${role}`, flags: MessageFlags.Ephemeral });
  }

  // ── Reaction Role — remove ───────────────────────────────────────────────────
  if (customId === "rr_modal_remove") {
    const reactionRoleSchema = require("../../../Schemas/reactionrole");
    const { buildPanel }      = require("../../../Commands/Setups/reactionrole");
    const msgId = interaction.fields.getTextInputValue("rr_remove_msg_id").trim();
    const emoji = interaction.fields.getTextInputValue("rr_remove_emoji").trim();
    const result = await reactionRoleSchema.deleteOne({ Guild: guildId, MessageID: msgId, Emoji: emoji });

    if (!result.deletedCount) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> No reaction role found for that message + emoji.", flags: MessageFlags.Ephemeral });
    }
    if (panel) {
      await interaction.message?.edit({ components: [buildPanel(accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Reaction role removed for message \`${msgId}\` with ${emoji}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Uptime Monitor — add ─────────────────────────────────────────────────────
  if (customId === "uptime_modal_add") {
    const uptimeSchema = require("../../../Schemas/uptimeSchema");
    const { buildPanel } = require("../../../Commands/Setups/uptime");
    const url      = interaction.fields.getTextInputValue("uptime_url").trim();
    const name     = interaction.fields.getTextInputValue("uptime_name")?.trim() || "";
    const intRaw   = interaction.fields.getTextInputValue("uptime_interval")?.trim();
    const chRaw    = interaction.fields.getTextInputValue("uptime_channel")?.trim() || "";
    const interval = Math.min(Math.max(parseInt(intRaw) || 5, 1), 60);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> URL must start with `http://` or `https://`.", flags: MessageFlags.Ephemeral });
    }

    let alertChannel = null;
    if (chRaw) {
      const ch = resolveChannel(guild, chRaw);
      if (!ch) {
        clearModal(interaction.user.id, guildId);
        return interaction.reply({ content: "<:crossy:1555544390221562048> Alert channel not found.", flags: MessageFlags.Ephemeral });
      }
      alertChannel = ch.id;
    }

    await uptimeSchema.create({
      Guild: guildId, URL: url, Name: name || url, Interval: interval,
      AlertChannel: alertChannel, LastStatus: "unknown", TotalPings: 0, UptimePercent: 100,
    });

    const list = await uptimeSchema.find({ Guild: guildId });
    if (panel) {
      updatePanelData(modalCtx.messageId, list);
      await interaction.message?.edit({ components: [buildPanel(list, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({
      content: `<a:tickyy:1555544712687915008> Monitor added for \`${url}\`${name ? ` ("${name}")` : ""} — checking every **${interval}m**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── Uptime Monitor — remove ──────────────────────────────────────────────────
  if (customId === "uptime_modal_remove") {
    const uptimeSchema = require("../../../Schemas/uptimeSchema");
    const { buildPanel } = require("../../../Commands/Setups/uptime");
    const url    = interaction.fields.getTextInputValue("uptime_remove_url").trim();
    const result = await uptimeSchema.deleteOne({ Guild: guildId, URL: url });

    if (!result.deletedCount) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: `<:crossy:1555544390221562048> No monitor found for URL \`${url}\`.`, flags: MessageFlags.Ephemeral });
    }
    const list = await uptimeSchema.find({ Guild: guildId });
    if (panel) {
      updatePanelData(modalCtx.messageId, list);
      await interaction.message?.edit({ components: [buildPanel(list, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Monitor for \`${url}\` removed.`, flags: MessageFlags.Ephemeral });
  }

  // ── Voice Leveling — enable ──────────────────────────────────────────────────
  if (customId === "vcl_modal_enable") {
    const voiceLevelSchema = require("../../../Schemas/voiceLevel");
    const { buildPanel }    = require("../../../Commands/Setups/voiceLeveling");
    const raw     = interaction.fields.getTextInputValue("vcl_channel_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    await voiceLevelSchema.findOneAndUpdate(
      { Guild: guildId },
      { Guild: guildId, Channel: channel.id, Enabled: true },
      { upsert: true, new: true }
    );
    if (panel) {
      await interaction.message?.edit({ components: [await buildPanel(guildId, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Voice Leveling enabled. Level-up notifications → ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Voice Leveling — blacklist add ───────────────────────────────────────────
  if (customId === "vcl_modal_bl_add") {
    const voiceBlacklistSchema = require("../../../Schemas/voiceBlacklist");
    const { blacklistPanel }    = require("../../../Commands/Setups/voiceLeveling");
    const raw     = interaction.fields.getTextInputValue("vcl_bl_channel");
    const channel = guild.channels.cache.get(raw.trim()) ||
      guild.channels.cache.find(c => c.name === raw.trim() && c.type === ChannelType.GuildVoice);

    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Voice channel not found.", flags: MessageFlags.Ephemeral });
    }
    const exists = await voiceBlacklistSchema.findOne({ Guild: guildId, Channel: channel.id });
    if (exists) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> That channel is already blacklisted.", flags: MessageFlags.Ephemeral });
    }
    await voiceBlacklistSchema.create({ Guild: guildId, Channel: channel.id });
    if (panel) {
      await interaction.message?.edit({ components: [await blacklistPanel(guildId, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> ${channel} added to the voice XP blacklist.`, flags: MessageFlags.Ephemeral });
  }

  // ── Voice Leveling — blacklist remove ────────────────────────────────────────
  if (customId === "vcl_modal_bl_remove") {
    const voiceBlacklistSchema = require("../../../Schemas/voiceBlacklist");
    const { blacklistPanel }    = require("../../../Commands/Setups/voiceLeveling");
    const raw     = interaction.fields.getTextInputValue("vcl_bl_remove_channel");
    const channel = guild.channels.cache.get(raw.trim()) ||
      guild.channels.cache.find(c => c.name === raw.trim() && c.type === ChannelType.GuildVoice);

    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Voice channel not found.", flags: MessageFlags.Ephemeral });
    }
    const result = await voiceBlacklistSchema.deleteOne({ Guild: guildId, Channel: channel.id });
    if (!result.deletedCount) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> That channel is not in the blacklist.", flags: MessageFlags.Ephemeral });
    }
    if (panel) {
      await interaction.message?.edit({ components: [await blacklistPanel(guildId, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> ${channel} removed from the voice XP blacklist.`, flags: MessageFlags.Ephemeral });
  }

  // ── Leveling — set channel ───────────────────────────────────────────────────
  if (customId === "lvl_modal_channel") {
    const levelSetup = require("../../../Schemas/levelsetup");
    const { buildPanel } = require("../../../Commands/Setups/leveling");
    const raw     = interaction.fields.getTextInputValue("lvl_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await levelSetup.findOneAndUpdate(
      { guildId },
      { guildId, levelUpChannel: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Level-up notifications set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Counting — set channel ───────────────────────────────────────────────────
  if (customId === "count_modal_channel") {
    const countingSchema = require("../../../Schemas/counting");
    const { buildPanel }  = require("../../../Commands/Setups/counting");
    const raw     = interaction.fields.getTextInputValue("count_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await countingSchema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Counting channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Join Ping — set channel ──────────────────────────────────────────────────
  if (customId === "jp_modal_channel") {
    const joinPingSchema = require("../../../Schemas/joinping");
    const { buildPanel }  = require("../../../Commands/Setups/join-ping");
    const raw     = interaction.fields.getTextInputValue("jp_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await joinPingSchema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Join-ping channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Join Ping — set user ─────────────────────────────────────────────────────
  if (customId === "jp_modal_user") {
    const joinPingSchema = require("../../../Schemas/joinping");
    const { buildPanel }  = require("../../../Commands/Setups/join-ping");
    const userId = interaction.fields.getTextInputValue("jp_user_input").replace(/[<@!>]/g, "").trim();
    const data   = await joinPingSchema.findOneAndUpdate(
      { guildId },
      { guildId, userId },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Join-ping user set to <@${userId}>.`, flags: MessageFlags.Ephemeral });
  }

  // ── Modmail — set category ───────────────────────────────────────────────────
  if (customId === "mm_modal_category") {
    const modmailSchema = require("../../../Schemas/modmailschema");
    const { buildPanel } = require("../../../Commands/Setups/modmail");
    const raw      = interaction.fields.getTextInputValue("mm_cat_input");
    const category = guild.channels.cache.get(raw.trim()) ||
      guild.channels.cache.find(c => c.name === raw.trim() && c.type === ChannelType.GuildCategory);
    if (!category) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Category not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await modmailSchema.findOneAndUpdate(
      { guildId },
      { guildId, categoryId: category.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Modmail category set to **${category.name}**.`, flags: MessageFlags.Ephemeral });
  }

  // ── Modmail — set log channel ────────────────────────────────────────────────
  if (customId === "mm_modal_log") {
    const modmailSchema = require("../../../Schemas/modmailschema");
    const { buildPanel } = require("../../../Commands/Setups/modmail");
    const raw     = interaction.fields.getTextInputValue("mm_log_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await modmailSchema.findOneAndUpdate(
      { guildId },
      { guildId, logChannelId: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Modmail log channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Modmail — set staff role ─────────────────────────────────────────────────
  if (customId === "mm_modal_role") {
    const modmailSchema = require("../../../Schemas/modmailschema");
    const { buildPanel } = require("../../../Commands/Setups/modmail");
    const raw  = interaction.fields.getTextInputValue("mm_role_input");
    const role = resolveRole(guild, raw);
    if (!role) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Role not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await modmailSchema.findOneAndUpdate(
      { guildId },
      { guildId, staffRoleId: role.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Modmail staff role set to ${role}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Verification — set channel ───────────────────────────────────────────────
  if (customId === "verify_modal_channel") {
    const verificationSchema = require("../../../Schemas/verificationSchema");
    const { buildPanel }      = require("../../../Commands/Setups/verification");
    const raw     = interaction.fields.getTextInputValue("verify_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await verificationSchema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Verification channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Verification — set role ──────────────────────────────────────────────────
  if (customId === "verify_modal_role") {
    const verificationSchema = require("../../../Schemas/verificationSchema");
    const { buildPanel }      = require("../../../Commands/Setups/verification");
    const raw  = interaction.fields.getTextInputValue("verify_role_input");
    const role = resolveRole(guild, raw);
    if (!role) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Role not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await verificationSchema.findOneAndUpdate(
      { guildId },
      { guildId, roleId: role.id },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Verified role set to ${role}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Suggestions — set channel ────────────────────────────────────────────────
  if (customId === "sug_modal_channel") {
    const suggestionSchema = require("../../../Schemas/suggestionSchema");
    const { buildSetupPanel } = require("../../../Commands/Setups/suggestion");
    const raw     = interaction.fields.getTextInputValue("sug_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const data = await suggestionSchema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id, enabled: true },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildSetupPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Suggestions channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Welcome/Goodbye — set channel ────────────────────────────────────────────
  if (customId === "wm_modal_channel_welcome" || customId === "wm_modal_channel_goodbye") {
    const type    = customId.includes("welcome") ? "welcome" : "goodbye";
    const Schema  = type === "welcome"
      ? require("../../../Schemas/welcomeMessageSchema")
      : require("../../../Schemas/goodbyeMessageSchema");
    const { configSteps } = require("../../../Commands/Setups/welcome");
    const raw     = interaction.fields.getTextInputValue("wm_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    await Schema.findOneAndUpdate(
      { guildId },
      { guildId, channelId: channel.id },
      { upsert: true, new: true }
    );
    if (panel) {
      await interaction.message?.edit({ components: [configSteps(type, accent)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> ${type === "welcome" ? "Welcome" : "Goodbye"} channel set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // ── Welcome/Goodbye — set message ────────────────────────────────────────────
  if (customId === "wm_modal_welcome" || customId === "wm_modal_goodbye") {
    const type   = customId.includes("welcome") ? "welcome" : "goodbye";
    const Schema = type === "welcome"
      ? require("../../../Schemas/welcomeMessageSchema")
      : require("../../../Schemas/goodbyeMessageSchema");
    const { configSteps } = require("../../../Commands/Setups/welcome");
    const message = interaction.fields.getTextInputValue("wm_msg_input");
    await Schema.findOneAndUpdate(
      { guildId },
      { guildId, message },
      { upsert: true, new: true }
    );
    if (panel) {
      await interaction.message?.edit({ components: [configSteps(type, accent)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> ${type === "welcome" ? "Welcome" : "Goodbye"} message saved.`, flags: MessageFlags.Ephemeral });
  }

  // ── Logging — set channel for type ───────────────────────────────────────────
  if (customId === "logs_modal_channel") {
    if (!modalCtx?.logType) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> Session expired. Please try again.", flags: MessageFlags.Ephemeral });
    }
    const logSchema  = require("../../../Schemas/logschema");
    const { buildContainer } = require("../../../Commands/Setups/logging");
    const raw     = interaction.fields.getTextInputValue("logs_ch_input");
    const channel = resolveChannel(guild, raw);
    if (!channel) {
      clearModal(interaction.user.id, guildId);
      return interaction.reply({ content: "<:crossy:1555544390221562048> Channel not found.", flags: MessageFlags.Ephemeral });
    }
    const update = {};
    update[modalCtx.logType] = channel.id;
    const data = await logSchema.findOneAndUpdate(
      { Guild: guildId },
      { Guild: guildId, ...update },
      { upsert: true, new: true }
    );
    if (panel) {
      updatePanelData(modalCtx.messageId, data);
      await interaction.message?.edit({ components: [buildContainer(data, accent, client)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    clearModal(interaction.user.id, guildId);
    return interaction.reply({ content: `<a:tickyy:1555544712687915008> Log channel for \`${modalCtx.logType}\` set to ${channel}.`, flags: MessageFlags.Ephemeral });
  }

  // Unknown modal — log and silently ignore to avoid crash
  console.warn(`[setupPanelModal] Unhandled modal customId: ${customId}`);
}

module.exports = { handleSetupModal };