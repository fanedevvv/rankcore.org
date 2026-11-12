// handlers/customCommandHandler.js
// Drop-in handler: call handleCustomCommand(interaction, client) from your
// interactionCreate event BEFORE your normal command router returns "unknown command".

const CustomCommand = require('../Schemas/customCommandSchema');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

// ── Cooldown stores ───────────────────────────────────────────────────────────
const userCooldowns  = new Map();
const guildCooldowns = new Map();

setInterval(() => {
  const now = Date.now();
  for (const m of [userCooldowns, guildCooldowns])
    for (const [k, exp] of m.entries()) if (now >= exp) m.delete(k);
}, 600_000);

// ── Button interaction collector registry ─────────────────────────────────────
// Tracks which custom-command messages have active button collectors so we
// don't re-attach them on re-use.  Map<messageId, true>
const activeCollectors = new Set();

// ══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC API ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Attempt to handle an interaction as a custom command.
 * Also handles button interactions from custom command messages.
 * @returns {boolean} true if handled, false if not a custom command
 */
async function handleCustomCommand(interaction, client) {
  // ── Route button interactions ─────────────────────────────────────────────
  if (interaction.isButton()) {
    return handleButtonInteraction(interaction, client);
  }

  if (!interaction.isChatInputCommand()) return false;

  // ── Look up by name OR alias ──────────────────────────────────────────────
  const cmd = await CustomCommand.findOne({
    Guild: interaction.guildId,
    $or: [{ Name: interaction.commandName }, { Aliases: interaction.commandName }],
  }).lean();

  if (!cmd) return false;

  // ── Soft-disabled ─────────────────────────────────────────────────────────
  if (cmd.Enabled === false) {
    await interaction.reply({ content: '<:error:1567796968758050868> This command is currently disabled.', ephemeral: true });
    return true;
  }

  // ── DM guard ──────────────────────────────────────────────────────────────
  if (!interaction.guildId && !cmd.DmAllowed) {
    await interaction.reply({ content: '<:crossy:1567796959648030831> This command cannot be used in DMs.', ephemeral: true });
    return true;
  }

  // ── Channel restrictions ──────────────────────────────────────────────────
  const channelId = interaction.channelId;
  if (cmd.DeniedChannels?.some(c => c.id === channelId)) {
    await interaction.reply({ content: '<:crossy:1567796959648030831> This command is not allowed in this channel.', ephemeral: true });
    return true;
  }
  if (cmd.AllowedChannels?.length && !cmd.AllowedChannels.some(c => c.id === channelId)) {
    await interaction.reply({ content: '<:crossy:1567796959648030831> This command can only be used in specific channels.', ephemeral: true });
    return true;
  }

  // ── Role restrictions ─────────────────────────────────────────────────────
  const memberRoles = interaction.member?.roles?.cache;
  if (memberRoles) {
    if (cmd.DeniedRoles?.some(r => memberRoles.has(r.id))) {
      await interaction.reply({ content: '<:crossy:1567796959648030831> Your role is not allowed to use this command.', ephemeral: true });
      return true;
    }
    if (cmd.AllowedRoles?.length && !cmd.AllowedRoles.some(r => memberRoles.has(r.id))) {
      await interaction.reply({ content: '<:crossy:1567796959648030831> You do not have the required role to use this command.', ephemeral: true });
      return true;
    }
  }

  // ── Global cooldown ───────────────────────────────────────────────────────
  if (cmd.GlobalCooldown > 0) {
    const gKey    = `${interaction.guildId}:${cmd.Name}`;
    const gExpiry = guildCooldowns.get(gKey);
    if (gExpiry && Date.now() < gExpiry) {
      const secs = Math.ceil((gExpiry - Date.now()) / 1000);
      await interaction.reply({ content: `<:1430986244921495654:1567796929587576852> This command is on a server-wide cooldown. Try again in **${secs}s**.`, ephemeral: true });
      return true;
    }
    guildCooldowns.set(gKey, Date.now() + cmd.GlobalCooldown * 1000);
  }

  // ── Per-user cooldown ─────────────────────────────────────────────────────
  if (cmd.Cooldown > 0) {
    const uKey    = `${interaction.guildId}:${cmd.Name}:${interaction.user.id}`;
    const uExpiry = userCooldowns.get(uKey);
    if (uExpiry && Date.now() < uExpiry) {
      const secs = Math.ceil((uExpiry - Date.now()) / 1000);
      await interaction.reply({ content: `<:1430986244921495654:1567796929587576852> You're on cooldown! Try again in **${secs}s**.`, ephemeral: true });
      return true;
    }
    userCooldowns.set(uKey, Date.now() + cmd.Cooldown * 1000);
  }

  // ── Build variable context ────────────────────────────────────────────────
  const ctx = buildContext(interaction, cmd);

  // ── Resolve which response text to use ───────────────────────────────────
  const resolved = resolveResponse(cmd, ctx);

  // ── Build reply payload ───────────────────────────────────────────────────
  const payload = { ephemeral: !!cmd.Ephemeral };

  // #18: plain text + embed can coexist
  // If embed is enabled: embed goes in payload.embeds, optional PlainTextContent goes in payload.content
  // If embed is disabled: response text goes in payload.content as normal
  if (resolved.useEmbed) {
    payload.embeds = [buildEmbed(cmd, resolved, ctx)];
    // Plain text shown above the embed (if set)
    const plainAbove = cmd.PlainTextContent ? interpolate(cmd.PlainTextContent, ctx).trim() : '';
    if (plainAbove) payload.content = plainAbove;
  } else {
    payload.content = resolved.responseText || '\u200b';
  }

  // ── Attach buttons ────────────────────────────────────────────────────────
  const buttonDefs = (cmd.Buttons || []).filter(b => b.label || b.emoji);
  if (buttonDefs.length) {
    const row = buildButtonRow(buttonDefs, cmd.Name, 'v1');
    if (row) payload.components = [row];
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  // #17: if OutputChannelId is set, run anywhere but post to the configured channel
  let reply;
  if (cmd.OutputChannelId) {
    const outputChannel = interaction.guild?.channels?.cache?.get(cmd.OutputChannelId);
    if (outputChannel?.isTextBased()) {
      // Ack the interaction ephemerally (so it doesn't time out), then post to target channel
      await interaction.reply({ content: `↗️ Response sent to <#${cmd.OutputChannelId}>`, ephemeral: true });
      // Don't pass ephemeral into the channel send
      const { ephemeral: _eph, ...channelPayload } = payload;
      reply = await outputChannel.send({ ...channelPayload }).catch(() => null);
    } else {
      // Fallback: output channel gone/invalid — reply normally
      await interaction.reply({ ...payload });
      reply = await interaction.fetchReply();
    }
  } else {
    await interaction.reply({ ...payload });
    reply = await interaction.fetchReply();
  }

  // ── Attach button collector for non-link buttons ──────────────────────────
  if (buttonDefs.some(b => b.style !== 'LINK') && reply && !activeCollectors.has(reply.id)) {
    attachButtonCollector(reply, cmd, ctx, client);
    activeCollectors.add(reply.id);
  }

  // ── DeleteInvoking ────────────────────────────────────────────────────────
  if (cmd.DeleteInvoking) {
    await interaction.deleteReply().catch(() => null);
  }

  // ── Run actions (fire-and-forget) ─────────────────────────────────────────
  if ((cmd.Actions || []).length) {
    runActions(cmd.Actions, interaction, ctx, client).catch(err =>
      console.error('[CustomCmd] Action error:', err)
    );
  }

  // ── Usage analytics ───────────────────────────────────────────────────────
  CustomCommand.updateOne(
    { Guild: interaction.guildId, Name: cmd.Name },
    { $inc: { UsageCount: 1 }, $set: { LastUsedAt: new Date() } }
  ).catch(err => console.error('[CustomCmd] Usage update failed:', err));

  return true;
}

module.exports = { handleCustomCommand };

// ══════════════════════════════════════════════════════════════════════════════
// ── RESPONSE RESOLUTION ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function resolveResponse(cmd, ctx) {
  // 1. Conditionals — first match wins
  for (const cond of (cmd.Conditionals || [])) {
    const argVal = ctx[`arg:${cond.argName}`] ?? '';
    if (matchesCondition(argVal, cond.operator, cond.value)) {
      return {
        responseText: interpolate(cond.response, ctx),
        useEmbed:     !!cond.isEmbed,
        embedTitle:   cond.embedTitle || '',
      };
    }
  }

  // 2. Weighted random variant
  if (cmd.MultiResponseEnabled && cmd.ResponseVariants?.length) {
    const picked = weightedPick(cmd.ResponseVariants);
    return {
      responseText: interpolate(picked.text, ctx),
      useEmbed:     !!cmd.IsEmbed,
      embedTitle:   cmd.EmbedTitle || '',
    };
  }

  // 3. Fallback
  return {
    responseText: interpolate(cmd.Response, ctx),
    useEmbed:     !!cmd.IsEmbed,
    embedTitle:   cmd.EmbedTitle || '',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EMBED BUILDER (V2 — fields, footer icon, author URL) ─────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildEmbed(cmd, resolved, ctx) {
  const embed = new EmbedBuilder()
    .setColor(cmd.EmbedColor || '#6C53FF')
    .setDescription(resolved.responseText || null);

  // Title
  const title = interpolate(resolved.embedTitle || cmd.EmbedTitle || '', ctx);
  if (title) embed.setTitle(title.slice(0, 256));

  // Author
  if (cmd.EmbedAuthorName) {
    const authorName = interpolate(cmd.EmbedAuthorName, ctx).slice(0, 256);
    let   authorIcon = cmd.EmbedAuthorIcon ? interpolate(cmd.EmbedAuthorIcon, ctx) : null;
    if (authorIcon === '{user.avatar}') authorIcon = ctx['user.avatar'] || null;
    const authorUrl  = cmd.EmbedUrl ? interpolate(cmd.EmbedUrl, ctx) : null;
    const authorData = { name: authorName };
    if (authorIcon && /^https?:\/\//i.test(authorIcon)) authorData.iconURL = authorIcon;
    if (authorUrl  && /^https?:\/\//i.test(authorUrl))  authorData.url     = authorUrl;
    embed.setAuthor(authorData);
  }

  // Footer (text + icon)
  if (cmd.EmbedFooter) {
    const footerText = interpolate(cmd.EmbedFooter, ctx).slice(0, 2048);
    const footerIcon = cmd.EmbedFooterIcon ? interpolate(cmd.EmbedFooterIcon, ctx) : null;
    const footerData = { text: footerText };
    if (footerIcon && /^https?:\/\//i.test(footerIcon)) footerData.iconURL = footerIcon;
    embed.setFooter(footerData);
  }

  // Images
  if (cmd.EmbedImage) {
    const url = interpolate(cmd.EmbedImage, ctx);
    if (/^https?:\/\//i.test(url)) embed.setImage(url);
  }
  if (cmd.EmbedThumbnail) {
    const url = interpolate(cmd.EmbedThumbnail, ctx);
    if (/^https?:\/\//i.test(url)) embed.setThumbnail(url);
  }

  // Fields (V2)
  for (const field of (cmd.EmbedFields || [])) {
    if (!field.name?.trim() || !field.value?.trim()) continue;
    try {
      embed.addFields({
        name:   interpolate(field.name,  ctx).slice(0, 256) || '\u200b',
        value:  interpolate(field.value, ctx).slice(0, 1024) || '\u200b',
        inline: !!field.inline,
      });
    } catch { /* skip malformed field */ }
  }

  return embed;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── BUTTONS ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const BUTTON_STYLE_MAP = {
  PRIMARY:   ButtonStyle.Primary,
  SECONDARY: ButtonStyle.Secondary,
  SUCCESS:   ButtonStyle.Success,
  DANGER:    ButtonStyle.Danger,
  LINK:      ButtonStyle.Link,
};

/**
 * Build a Discord ActionRow from button definitions.
 * customId format: `cc:<cmdName>:<version>:<index>` — allows collector to find
 * the right command and button definition.
 */
function buildButtonRow(buttonDefs, cmdName, version) {
  if (!buttonDefs.length) return null;
  const row = new ActionRowBuilder();
  buttonDefs.slice(0, 5).forEach((def, idx) => {
    const btn = new ButtonBuilder()
      .setStyle(BUTTON_STYLE_MAP[def.style] ?? ButtonStyle.Primary);

    if (def.label) btn.setLabel(def.label.slice(0, 80));
    if (def.emoji) {
      try { btn.setEmoji(def.emoji.trim()); } catch { /* invalid emoji, skip */ }
    }

    if (def.style === 'LINK') {
      const url = def.url?.startsWith('http') ? def.url : `https://${def.url}`;
      btn.setURL(url);
    } else {
      // Encode enough info so we can look up cmd + button index from collector
      btn.setCustomId(`cc:${cmdName}:${version}:${idx}`);
      if (def.disableAfterClick) btn.setDisabled(false); // enabled initially; disabled after use
    }

    row.addComponents(btn);
  });
  return row;
}

/**
 * Attach a MessageComponentCollector to the reply message.
 * Collector stays alive for 15 minutes (or until message deleted).
 */
function attachButtonCollector(message, cmd, ctx, client) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: i => i.customId?.startsWith(`cc:${cmd.Name}:`),
    time: 15 * 60_000,
  });

  collector.on('collect', async (btnInteraction) => {
    try {
      const parts = btnInteraction.customId.split(':');
      // format: cc:<cmdName>:<version>:<idx>
      const btnIdx = Number(parts[3]);
      const btnDef = (cmd.Buttons || [])[btnIdx];
      if (!btnDef) {
        return btnInteraction.reply({ content: '<:crossy:1567796959648030831> Button not found.', ephemeral: true });
      }

      // Build a fresh context for the button clicker
      const btnCtx = buildContext(btnInteraction, cmd);

      // Merge original arg context so {arg:*} still works from the original invocation
      for (const [k, v] of Object.entries(ctx)) {
        if (!(k in btnCtx)) btnCtx[k] = v;
      }

      const responseText = interpolate(btnDef.response || '', btnCtx) || '\u200b';
      await btnInteraction.reply({
        content:   responseText,
        ephemeral: !!btnDef.ephemeralResponse,
      });

      // Disable button after click if requested
      if (btnDef.disableAfterClick) {
        try {
          const newComponents = message.components.map(row => {
            const updatedRow = ActionRowBuilder.from(row);
            updatedRow.components.forEach((comp, idx) => {
              if (idx === btnIdx) comp.setDisabled(true);
            });
            return updatedRow;
          });
          await message.edit({ components: newComponents });
        } catch { /* ignore edit errors */ }
      }
    } catch (err) {
      console.error('[CustomCmd] Button handler error:', err);
      try {
        await btnInteraction.reply({ content: '<:crossy:1567796959648030831> Something went wrong.', ephemeral: true });
      } catch { /* already replied */ }
    }
  });

  collector.on('end', () => {
    activeCollectors.delete(message.id);
    // Disable all non-link buttons when collector expires
    try {
      if (!message.editable) return;
      const disabledComponents = message.components.map(row => {
        const updatedRow = ActionRowBuilder.from(row);
        updatedRow.components.forEach(comp => {
          if (comp.data?.style !== ButtonStyle.Link) comp.setDisabled(true);
        });
        return updatedRow;
      });
      message.edit({ components: disabledComponents }).catch(() => null);
    } catch { /* ignore */ }
  });
}

/**
 * Handle a button interaction that was already dispatched (direct routing path).
 * Only needed if you route ALL button interactions through handleCustomCommand.
 */
async function handleButtonInteraction(interaction, client) {
  if (!interaction.customId?.startsWith('cc:')) return false;

  const parts   = interaction.customId.split(':');
  const cmdName = parts[1];
  if (!cmdName) return false;

  const cmd = await CustomCommand.findOne({
    Guild: interaction.guildId,
    Name:  cmdName,
  }).lean();

  if (!cmd) return false;

  const btnIdx = Number(parts[3]);
  const btnDef = (cmd.Buttons || [])[btnIdx];
  if (!btnDef) {
    await interaction.reply({ content: '<:crossy:1567796959648030831> Button configuration not found.', ephemeral: true });
    return true;
  }

  const ctx  = buildContext(interaction, cmd);
  const text = interpolate(btnDef.response || '', ctx) || '\u200b';
  await interaction.reply({ content: text, ephemeral: !!btnDef.ephemeralResponse });

  if (btnDef.disableAfterClick) {
    try {
      const msg = await interaction.fetchReply().catch(() => null);
      if (!msg) return true;
      const newComponents = msg.components.map(row => {
        const r = ActionRowBuilder.from(row);
        r.components.forEach((comp, i) => { if (i === btnIdx) comp.setDisabled(true); });
        return r;
      });
      await msg.edit({ components: newComponents }).catch(() => null);
    } catch { /* ignore */ }
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ACTIONS ───────────────────────────────────────════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Run all actions sequentially. Each action is tried independently so one
 * failure doesn't block subsequent ones.
 */
async function runActions(actions, interaction, ctx, client) {
  const guild  = interaction.guild;
  const member = interaction.member;

  for (const action of actions) {
    try {
      await runSingleAction(action, interaction, ctx, guild, member, client);
    } catch (err) {
      if (!action.silentFail) {
        console.error(`[CustomCmd] Action "${action.type}" failed:`, err.message);
      }
    }
  }
}

async function runSingleAction(action, interaction, ctx, guild, member, client) {
  switch (action.type) {

    // ── Role management ───────────────────────────────────────────────────────

    case 'add_role': {
      if (!action.targetId || !member) break;
      await member.roles.add(action.targetId);
      break;
    }

    case 'remove_role': {
      if (!action.targetId || !member) break;
      await member.roles.remove(action.targetId);
      break;
    }

    case 'add_role_arg': {
      if (!action.argName || !member) break;
      const roleId = ctx[`arg:${action.argName}.id`] || ctx[`arg:${action.argName}`]?.replace(/\D/g, '');
      if (roleId) await member.roles.add(roleId);
      break;
    }

    case 'remove_role_arg': {
      if (!action.argName || !member) break;
      const roleId = ctx[`arg:${action.argName}.id`] || ctx[`arg:${action.argName}`]?.replace(/\D/g, '');
      if (roleId) await member.roles.remove(roleId);
      break;
    }

    // ── DM ────────────────────────────────────────────────────────────────────

    case 'dm_invoker': {
      const text = interpolate(action.value || '', ctx);
      if (text) await interaction.user.send(text).catch(() => null);
      break;
    }

    case 'dm_user_arg': {
      if (!action.argName) break;
      const userId = ctx[`arg:${action.argName}.id`];
      if (!userId) break;
      const target = await client.users.fetch(userId).catch(() => null);
      const text   = interpolate(action.value || '', ctx);
      if (target && text) await target.send(text).catch(() => null);
      break;
    }

    // ── Send to channel ───────────────────────────────────────────────────────

    case 'send_channel': {
      if (!action.targetId) break;
      const channel = await guild?.channels.fetch(action.targetId).catch(() => null);
      const text    = interpolate(action.value || '', ctx);
      if (channel?.isTextBased() && text) await channel.send(text);
      break;
    }

    case 'send_channel_arg': {
      if (!action.argName) break;
      const channelId = ctx[`arg:${action.argName}.id`];
      if (!channelId) break;
      const channel = await guild?.channels.fetch(channelId).catch(() => null);
      const text    = interpolate(action.value || '', ctx);
      if (channel?.isTextBased() && text) await channel.send(text);
      break;
    }

    // ── Nickname ─────────────────────────────────────────────────────────────

    case 'set_nickname': {
      if (!member) break;
      const nick = interpolate(action.value || '', ctx).slice(0, 32) || null;
      await member.setNickname(nick);
      break;
    }

    // ── Moderation ────────────────────────────────────────────────────────────

    case 'timeout_user': {
      if (!action.argName) break;
      const userId = ctx[`arg:${action.argName}.id`];
      if (!userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (!targetMember) break;
      const durationMs = Math.min(
        Math.max(1, Number(action.value) || 60),
        28 * 24 * 3600 // Discord max: 28 days
      ) * 1000;
      await targetMember.timeout(durationMs);
      break;
    }

    case 'kick_user': {
      if (!action.argName) break;
      const userId = ctx[`arg:${action.argName}.id`];
      if (!userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (targetMember) {
        const reason = interpolate(action.value || 'Custom command kick', ctx).slice(0, 512);
        await targetMember.kick(reason);
      }
      break;
    }

    case 'ban_user': {
      if (!action.argName) break;
      const userId = ctx[`arg:${action.argName}.id`];
      if (!userId) break;
      const reason = interpolate(action.value || 'Custom command ban', ctx).slice(0, 512);
      await guild?.members.ban(userId, { reason });
      break;
    }

    // ── React ─────────────────────────────────────────────────────────────────

    case 'react': {
      const emoji = action.value?.trim();
      if (!emoji) break;
      // fetchReply to get the message object
      const replyMsg = await interaction.fetchReply().catch(() => null);
      if (replyMsg) await replyMsg.react(emoji).catch(() => null);
      break;
    }

    // ── Dual-variable: role (fixed) → user from arg ───────────────────────────

    case 'add_role_to_user_arg': {
      if (!action.targetId || !action.targetArg) break;
      const userId = ctx[`arg:${action.targetArg}.id`];
      if (!userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (targetMember) await targetMember.roles.add(action.targetId);
      break;
    }

    case 'remove_role_from_user_arg': {
      if (!action.targetId || !action.targetArg) break;
      const userId = ctx[`arg:${action.targetArg}.id`];
      if (!userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (targetMember) await targetMember.roles.remove(action.targetId);
      break;
    }

    // ── Dual-variable: role from arg → user from arg ──────────────────────────

    case 'add_role_arg_to_user_arg': {
      if (!action.argName || !action.targetArg) break;
      const roleId = ctx[`arg:${action.argName}.id`];
      const userId = ctx[`arg:${action.targetArg}.id`];
      if (!roleId || !userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (targetMember) await targetMember.roles.add(roleId);
      break;
    }

    case 'remove_role_arg_from_user_arg': {
      if (!action.argName || !action.targetArg) break;
      const roleId = ctx[`arg:${action.argName}.id`];
      const userId = ctx[`arg:${action.targetArg}.id`];
      if (!roleId || !userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (targetMember) await targetMember.roles.remove(roleId);
      break;
    }

    // ── Dual-variable: nickname → user from arg ───────────────────────────────

    case 'set_nickname_user_arg': {
      if (!action.targetArg) break;
      const userId = ctx[`arg:${action.targetArg}.id`];
      if (!userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (!targetMember) break;
      const nick = interpolate(action.value || '', ctx).slice(0, 32) || null;
      await targetMember.setNickname(nick);
      break;
    }

    // ── Dual-variable: timeout user from arg, duration from arg ──────────────

    case 'timeout_user_arg_duration': {
      if (!action.argName || !action.targetArg) break;
      const userId = ctx[`arg:${action.argName}.id`];
      if (!userId) break;
      const targetMember = await guild?.members.fetch(userId).catch(() => null);
      if (!targetMember) break;
      const durationRaw = ctx[`arg:${action.targetArg}`];
      const durationMs  = Math.min(
        Math.max(1, Number(durationRaw) || 60),
        28 * 24 * 3600
      ) * 1000;
      await targetMember.timeout(durationMs);
      break;
    }

    default:
      break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CONTEXT BUILDER ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildContext(interaction, cmd) {
  const ctx = {};
  const { guild, channel, user } = interaction;

  ctx['user.mention']  = `<@${user.id}>`;
  ctx['user.tag']      = user.tag ?? user.username;
  ctx['user.id']       = user.id;
  ctx['user.name']     = user.username;
  ctx['user.avatar']   = user.displayAvatarURL({ dynamic: true });
  ctx['user']          = ctx['user.mention'];
  ctx['server']        = guild?.name ?? '';
  ctx['server.id']     = guild?.id   ?? '';
  ctx['channel']       = channel ? `<#${channel.id}>` : '';
  ctx['channel.name']  = channel?.name ?? '';
  ctx['channel.id']    = channel?.id   ?? '';
  ctx['memberCount']   = String(guild?.memberCount ?? '?');
  ctx['date']          = new Date().toLocaleDateString();
  ctx['time']          = new Date().toLocaleTimeString();
  ctx['timestamp']     = String(Math.floor(Date.now() / 1000));

  // Argument values
  for (const argDef of (cmd.Arguments || [])) {
    const { name, type } = argDef;
    try {
      switch (type) {
        case 'STRING':
          ctx[`arg:${name}`] = interaction.options?.getString(name) ?? '';
          break;
        case 'INTEGER':
          ctx[`arg:${name}`] = String(interaction.options?.getInteger(name) ?? '');
          break;
        case 'NUMBER':
          ctx[`arg:${name}`] = String(interaction.options?.getNumber(name) ?? '');
          break;
        case 'BOOLEAN':
          ctx[`arg:${name}`] = String(interaction.options?.getBoolean(name) ?? '');
          break;
        case 'USER': {
          const u = interaction.options?.getUser(name);
          if (u) {
            ctx[`arg:${name}`]         = `<@${u.id}>`;
            ctx[`arg:${name}.mention`] = `<@${u.id}>`;
            ctx[`arg:${name}.id`]      = u.id;
            ctx[`arg:${name}.tag`]     = u.tag ?? u.username;
            ctx[`arg:${name}.name`]    = u.username;
            ctx[`arg:${name}.avatar`]  = u.displayAvatarURL({ dynamic: true });
          }
          break;
        }
        case 'CHANNEL': {
          const c = interaction.options?.getChannel(name);
          if (c) {
            ctx[`arg:${name}`]         = `<#${c.id}>`;
            ctx[`arg:${name}.mention`] = `<#${c.id}>`;
            ctx[`arg:${name}.id`]      = c.id;
            ctx[`arg:${name}.name`]    = c.name;
          }
          break;
        }
        case 'ROLE': {
          const r = interaction.options?.getRole(name);
          if (r) {
            ctx[`arg:${name}`]         = `<@&${r.id}>`;
            ctx[`arg:${name}.mention`] = `<@&${r.id}>`;
            ctx[`arg:${name}.id`]      = r.id;
            ctx[`arg:${name}.name`]    = r.name;
          }
          break;
        }
        case 'MENTIONABLE': {
          const m = interaction.options?.getMentionable(name);
          if (m) {
            const isRole = 'color' in m;
            ctx[`arg:${name}`]         = isRole ? `<@&${m.id}>` : `<@${m.id}>`;
            ctx[`arg:${name}.mention`] = ctx[`arg:${name}`];
            ctx[`arg:${name}.id`]      = m.id;
            ctx[`arg:${name}.name`]    = m.name ?? m.username;
          }
          break;
        }
        case 'ATTACHMENT': {
          const att = interaction.options?.getAttachment(name);
          if (att) {
            ctx[`arg:${name}`]         = att.url;
            ctx[`arg:${name}.url`]     = att.url;
            ctx[`arg:${name}.name`]    = att.name;
            ctx[`arg:${name}.type`]    = att.contentType ?? '';
            ctx[`arg:${name}.size`]    = String(att.size ?? '');
          }
          break;
        }
      }
    } catch {
      ctx[`arg:${name}`] = '';
    }
  }

  return ctx;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── INTERPOLATION ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Replace {key} tokens. Supports:
 *   - Any key in ctx
 *   - {random:N-M} → random integer between N and M inclusive
 *   - {random:a|b|c} → random pick from pipe-separated values
 * Unknown keys are left as-is so broken variables appear visibly to the author.
 */
function interpolate(template, ctx) {
  if (!template) return '';
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    // Check ctx first (exact match)
    if (key in ctx) return ctx[key];

    // {random:N-M}
    const rangeMatch = key.match(/^random:(-?\d+)-(-?\d+)$/);
    if (rangeMatch) {
      const lo = Number(rangeMatch[1]);
      const hi = Number(rangeMatch[2]);
      return String(Math.floor(Math.random() * (hi - lo + 1)) + lo);
    }

    // {random:a|b|c}
    if (key.startsWith('random:') && key.includes('|')) {
      const options = key.slice(7).split('|');
      return options[Math.floor(Math.random() * options.length)];
    }

    // Unknown key — leave as-is
    return match;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MISC HELPERS ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function matchesCondition(val, op, target) {
  const num = Number(val);
  const tar = Number(target);
  switch (op) {
    case 'eq':         return val === target;
    case 'neq':        return val !== target;
    case 'gt':         return !isNaN(num) && !isNaN(tar) && num > tar;
    case 'lt':         return !isNaN(num) && !isNaN(tar) && num < tar;
    case 'gte':        return !isNaN(num) && !isNaN(tar) && num >= tar;
    case 'lte':        return !isNaN(num) && !isNaN(tar) && num <= tar;
    case 'contains':   return val.toLowerCase().includes(target.toLowerCase());
    case 'startsWith': return val.toLowerCase().startsWith(target.toLowerCase());
    case 'endsWith':   return val.toLowerCase().endsWith(target.toLowerCase());
    default:           return false;
  }
}

function weightedPick(variants) {
  const total  = variants.reduce((s, v) => s + (v.weight || 1), 0);
  let   random = Math.random() * total;
  for (const v of variants) {
    random -= (v.weight || 1);
    if (random <= 0) return v;
  }
  return variants[variants.length - 1];
}