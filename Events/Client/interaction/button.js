const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags, Colors, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, ChannelType,
} = require("discord.js");
const { parseEmoji } = require('../../../Utils/emojis');
const { ACCENT } = require("../../../Utils/v2helpers");
const tosSchema      = require("../../../Schemas/tosSchema");
const errorCodes     = require("./errorCodes");
const { safeDeferReply, safeDeferUpdate, isDead } = require("./safeInteraction");
const EmbedButtonAction = require("../../../Schemas/embedButtonActionSchema");
const { getPanel, updatePanelData, registerModal } = require("../../../Utils/setupPanelStore");

// ── V2 helpers ────────────────────────────────────────────────────────────────
function sep()  { return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true); }
function errC(title, body) {
  return new ContainerBuilder().setAccentColor(ACCENT.error)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}
function okC(title, body, accent = ACCENT.success) {
  return new ContainerBuilder().setAccentColor(accent)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}

// ── Poll button IDs ───────────────────────────────────────────────────────────
function isPollButton(id) {
  return id === "poll_results" || id.startsWith("poll_vote_") || id.startsWith("poll_done_");
}

// ── Button IDs that are high-volume / noise — skip logging for these ──────────
const SILENT_BUTTON_PREFIXES = [
  "poll_", "owner_srv_", "owner_cmdl_", "owner_cmdi_",
  "solved_", "ignore_", "category-select", "page_",
];
function isSilentButton(id) {
  return SILENT_BUTTON_PREFIXES.some(p => id.startsWith(p));
}

// ── Owner pagination state ────────────────────────────────────────────────────
// Keyed by messageId → { ... state ... }
// ownerPagState removed — owner command state now lives in client.ownerPaginators (see owner.js)

module.exports = async function handleButton(interaction, client, webhook) {
  const { customId } = interaction;

  try {
  // ── Log button interaction (mirrors slash.js sendAlert, routes to same webhook) ──
  if (interaction.guild && !isSilentButton(customId)) {
    try {
      const { sendAlert } = require("./slash");
      sendAlert("button", { interaction }, client);
    } catch { /* non-critical */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Poll buttons
  // ══════════════════════════════════════════════════════════════════════════
  if (isPollButton(customId)) {
    const { activePolls } = require("../../../Commands/Community/poll");
    const pollData = activePolls.get(interaction.message.id);
    if (!pollData) {
      return interaction.reply({ content: "<:n_loading:1555544489194688623> This poll is no longer active, or the bot just restarted — please try again in a moment.", flags: MessageFlags.Ephemeral });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (pollData.endTs && pollData.endTs <= nowSec) {
      return interaction.reply({ content: "<:LEred:1555544262123323422> This poll has already ended.", flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Dashboard Embed Builder buttons (DB lookup)
  // ══════════════════════════════════════════════════════════════════════════
  if (interaction.guildId
    && !customId.startsWith("accept_tos_") && !customId.startsWith("decline_tos_")
    && !customId.startsWith("solved_") && !customId.startsWith("ignore_")
    && !customId.startsWith("ban_") && !customId.startsWith("kick_")
    && !customId.startsWith("userinfo_") && customId !== "show_error_codes") {

    let actionDoc = null;
    try {
      actionDoc = await EmbedButtonAction.findOne({ Guild: interaction.guildId, CustomId: customId }).lean();
    } catch (_) {}

    if (actionDoc && actionDoc.ActionType && actionDoc.ActionType !== "none") {
      return handleDashboardEmbedAction(interaction, actionDoc);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — TOS accept / decline
  // ══════════════════════════════════════════════════════════════════════════
  if (customId.startsWith("accept_tos_") || customId.startsWith("decline_tos_")) {
    const action = customId.startsWith("accept") ? "accept" : "decline";
    const targetUserId = customId.split("_")[2];
    if (interaction.user.id !== targetUserId) {
      return interaction.reply({ components: [errC("<:crossy:1555544390221562048>  Wrong User", "This TOS prompt is not for you.")], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
    if (action === "accept") {
      await tosSchema.findOneAndUpdate({ userId: interaction.user.id }, { $set: { acceptedAt: Date.now() } }, { upsert: true });
      await webhook?.send({ embeds: [new EmbedBuilder().setTitle("TOS Accepted").setDescription(`<@${interaction.user.id}> accepted.`).setColor("Green")] }).catch(() => {});
      return interaction.update({ components: [okC("<a:tickyy:1555544712687915008>  Terms of Service Accepted", "You can now use all bot commands. Welcome aboard!")], flags: MessageFlags.IsComponentsV2, embeds: [] });
    } else {
      await webhook?.send({ embeds: [new EmbedBuilder().setTitle("TOS Declined").setDescription(`<@${interaction.user.id}> declined.`).setColor("Red")] }).catch(() => {});
      return interaction.update({ components: [errC("<:crossy:1555544390221562048>  Terms of Service Declined", "You must accept the Terms of Service to use this bot.")], flags: MessageFlags.IsComponentsV2, embeds: [] });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Solved / Ignore
  // ══════════════════════════════════════════════════════════════════════════
  if (customId.startsWith("solved_") || customId.startsWith("ignore_")) {
    const isSolved = customId.startsWith("solved_");
    const accent   = isSolved ? ACCENT.success : 0x9ca3af;
    const label    = isSolved ? "<a:tickyy:1555544712687915008>  Marked as Solved" : "<:announcement:1555544345740967956>  Ignored";
    const origEmbeds = interaction.message.embeds;
    if (origEmbeds.length > 0) {
      const updatedEmbed = EmbedBuilder.from(origEmbeds[0]).setColor(isSolved ? Colors.Green : Colors.Grey).setFooter({ text: `${isSolved ? "Solved" : "Ignored"} by ${interaction.user.tag}` });
      const disabledRows = interaction.message.components.map(row => {
        const r = new ActionRowBuilder();
        row.components.forEach(c => r.addComponents(ButtonBuilder.from(c).setDisabled(true)));
        return r;
      });
      return interaction.update({ embeds: [updatedEmbed], components: disabledRows });
    }
    const c = new ContainerBuilder().setAccentColor(accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${label}`))
      .addSeparatorComponents(sep())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Actioned by ${interaction.user.tag}`));
    return interaction.update({ components: [c], flags: MessageFlags.IsComponentsV2 });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — AI Mod action buttons
  // ══════════════════════════════════════════════════════════════════════════
  if (customId.startsWith("ban_") || customId.startsWith("kick_") || customId.startsWith("userinfo_")) {
    await interaction.deferReply({ ephemeral: true });
    const [action, targetId] = customId.split("_");
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) return interaction.editReply({ components: [errC("<:crossy:1555544390221562048>  User Not Found", "That member is no longer in this server.")], flags: MessageFlags.IsComponentsV2 });
    if (action === "userinfo") {
      const joinedTs  = Math.floor(targetMember.joinedTimestamp / 1000);
      const createdTs = Math.floor(targetMember.user.createdTimestamp / 1000);
      const roles     = targetMember.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(" ") || "None";
      const c = new ContainerBuilder().setAccentColor(ACCENT.info)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:user:1555544664155889668>  ${targetMember.user.tag}`))
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**ID** — \`${targetMember.id}\`\n**Joined** — <t:${joinedTs}:R>\n**Created** — <t:${createdTs}:R>\n**Roles** — ${roles}`
        ));
      return interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
    const permMap = { ban: "BanMembers", kick: "KickMembers" };
    if (!interaction.member.permissions.has(permMap[action])) return interaction.editReply({ components: [errC("<:crossy:1555544390221562048>  No Permission", `You need **${permMap[action]}** to perform this action.`)], flags: MessageFlags.IsComponentsV2 });
    if (action === "ban" && targetMember.bannable) { await targetMember.ban({ reason: `AI Mod action by ${interaction.user.tag}` }); return interaction.editReply({ components: [okC("<:ban:1555544356352430202>  User Banned", `**${targetMember.user.tag}** has been banned via AI Mod.`)], flags: MessageFlags.IsComponentsV2 }); }
    if (action === "kick" && targetMember.kickable) { await targetMember.kick(`AI Mod action by ${interaction.user.tag}`); return interaction.editReply({ components: [okC("<:ban:1555544356352430202>  User Kicked", `**${targetMember.user.tag}** has been kicked via AI Mod.`)], flags: MessageFlags.IsComponentsV2 }); }
    return interaction.editReply({ components: [errC("<:crossy:1555544390221562048>  Action Failed", "I cannot perform this action — the user may outrank me.")], flags: MessageFlags.IsComponentsV2 });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Premium perks viewer
  // ══════════════════════════════════════════════════════════════════════════
  if (customId === 'premium_view_perks') {
    await safeDeferReply(interaction, true);
    const { TIERS } = require('../../../Utils/premiumTiers');
    const lines = Object.entries(TIERS).map(([key, t]) => {
      const price = t.priceDisplay ? `${t.priceDisplay.monthly}/mo` : 'Free';
      return `${t.emoji} **${t.name}** — ${price}`;
    }).join('\n');
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('RankCore Premium Plans')
        .setDescription(lines + `\n\n**Get Premium:** [rankcore.org/premium](${process.env.DASHBOARD_URL || 'https://dash.rankcore.org'}/premium)`)
        .setColor(0x8b5cf6)
      ],
    }).catch(() => {});
  }

  // ── Error codes viewer ───────────────────────────────────────────────────
  if (customId === "show_error_codes") {
    const desc = Object.entries(errorCodes).map(([code, desc]) => `**\`${code}\`** — ${desc}`).join("\n");
    const c = new ContainerBuilder().setAccentColor(ACCENT.error)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_utils:1555544669545431062>  Error Code Reference"))
      .addSeparatorComponents(sep())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc));
    return interaction.reply({ components: [c], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Suggestion vote buttons (suggest_up_* / suggest_down_*)
  // These are handled exclusively by Events/Others/suggestions.js which
  // registers its own interactionCreate listener.  We must NOT acknowledge
  // the interaction here — doing so would prevent that listener from calling
  // interaction.update().  The early-return in handleSetupButton above
  // (before any DB work or orphan-entry creation) ensures a clean hand-off.
  // ══════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 8 — Owner command buttons (persistent, client Map-based, no expiry)
  // All owner buttons are prefixed with "owner_" for easy matching.
  // ══════════════════════════════════════════════════════════════════════════
  if (customId.startsWith("owner_")) {
    return handleOwnerButton(interaction, client, customId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 9a — IP Verification button (persistent, stateless — works 24/7)
  // When a user clicks the Verify button on an IP-verify panel, we call the
  // dashboard's /api/ipverify/issue endpoint to get a one-time link, then
  // send it to the user ephemerally. No in-memory state required — always
  // works across bot restarts. Token TTL is read from the response so the
  // displayed expiry is always accurate regardless of per-guild config.
  // ══════════════════════════════════════════════════════════════════════════
  if (customId === 'ipverify') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const BOT_SECRET      = process.env.VERIFICATION_SECRET || '';
      const DASHBOARD_PORT  = process.env.DASHBOARD_PORT || 3000;
      const LOCAL_URL       = `http://127.0.0.1:${DASHBOARD_PORT}`;

      async function callIssueEndpoint(url, timeoutMs = 5000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(`${url}/api/ipverify/issue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-bot-secret': BOT_SECRET,
            },
            body: JSON.stringify({
              userId:  interaction.user.id,
              guildId: interaction.guild.id,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      }

      const resp = await callIssueEndpoint(LOCAL_URL);

      const text = await resp.text();
      let data = {};
      try { data = JSON.parse(text); } catch {
        console.error('[ipverify button] non-JSON response:', text.slice(0, 500));
      }

      // ── Error states ──────────────────────────────────────────────────────
      if (!resp.ok) {
        let title, body, accent;

        if (data?.error?.includes('Too many verification')) {
          title  = '<:n_loading:1555544489194688623>  Slow Down';
          body   = "You've requested too many verification links recently.\nPlease wait a few minutes before trying again.";
          accent = ACCENT.warn ?? 0xfb923c;
        } else if (data?.error?.includes('re-verification not due')) {
          title  = '<a:tickyy:1555544712687915008>  Already Verified';
          body   = "You're already verified and don't need to re-verify yet.\nIf you've lost your role, please contact a moderator.";
          accent = ACCENT.success;
        } else if (data?.error?.includes('No verify config')) {
          title  = '<:n_utils:1555544669545431062>  Not Configured';
          body   = "This server's verification system hasn't been set up yet.\nPlease contact a moderator.";
          accent = ACCENT.error;
        } else {
          console.error(`[ipverify button] unexpected ${resp.status} response:`, text.slice(0, 300));
          title  = '<:crossy:1555544390221562048>  Verification Failed';
          body   = data?.error || 'Something went wrong. Please try again shortly.';
          accent = ACCENT.error;
        }

        const container = new ContainerBuilder().setAccentColor(accent)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
          .addSeparatorComponents(sep())
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // ── Success — build the verify link container ─────────────────────────
      let expiryText = 'a few minutes';
      let expiryUnix = '';
      if (data.expiresAt) {
        const msLeft   = new Date(data.expiresAt).getTime() - Date.now();
        const minsLeft = Math.max(1, Math.round(msLeft / 60000));
        expiryText  = `${minsLeft} minute${minsLeft !== 1 ? 's' : ''}`;
        expiryUnix  = `\n-# Expires <t:${Math.floor(new Date(data.expiresAt).getTime() / 1000)}:R>`;
      }

      const container = new ContainerBuilder().setAccentColor(ACCENT.info ?? 0x6C53FF)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## <:1430986227909263442:1555544212756242532>  Complete Your Verification'))
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `Click the button below to open your personal verification link.\n\n` +
          `> <:lockk:1555544494441635860> This link is **single-use** and tied to your account — do not share it.\n` +
          `> <:1430986244921495654:1555544239792980044> It expires in **${expiryText}**.${expiryUnix}`
        ))
        .addSeparatorComponents(sep())
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Verify Now')
              .setStyle(ButtonStyle.Link)
              .setURL(data.url)
              .setEmoji(parseEmoji('<a:tickyy:1555544712687915008>'))
          )
        );

      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (err) {
      console.error('[ipverify button]', err);
      return interaction.editReply({
        components: [errC('<:crossy:1555544390221562048>  Server Error', 'Could not reach the verification server. Please try again shortly.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }


  // Handled here (rather than only in Events/Others/giveaway.js) so that CB
  // bots — which route all interactions through handleButton() — can process
  // giveaway interactions correctly.
  // ══════════════════════════════════════════════════════════════════════════
  if (customId === 'giveaway_enter' || customId === 'giveaway_entries') {
    const giveawayHandler = require('../../../Events/Others/giveaway');
    return giveawayHandler.execute(interaction);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 10 — Prefix music control buttons (nowplaying command)
  // music_skip / music_pause / music_stop — sent by N!nowplaying, no collector
  // ══════════════════════════════════════════════════════════════════════════
  if (customId === 'music_skip' || customId === 'music_pause' || customId === 'music_stop') {
    await safeDeferUpdate(interaction);
    const player = client.manager?.players?.get(interaction.guild?.id);
    if (!player || !player.queue.current) {
      return interaction.editReply({ content: '🎵 Nothing is currently playing.' }).catch(() => {});
    }
    if (customId === 'music_skip') {
      player.skip();
      return interaction.followUp({ content: '⏭️ Skipped.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (customId === 'music_pause') {
      player.paused ? player.pause(false) : player.pause(true);
      return interaction.followUp({ content: player.paused ? '⏸️ Paused.' : '▶️ Resumed.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (customId === 'music_stop') {
      player.destroy();
      return interaction.followUp({ content: '⏹️ Stopped and cleared the queue.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 11 — Setup command panels (persistent, store-based)
  // ══════════════════════════════════════════════════════════════════════════
  return handleSetupButton(interaction, client, customId);

  } catch (err) {
    if (isDead(err)) return;
    console.error(`[handleButton] customId=${customId} error:`, err);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
    } catch { /* ignore */ }
  }
};

async function handleOwnerButton(interaction, client, customId) {
  // Ensure client stores exist (in case bot was just started)
  if (!client.ownerPaginators) client.ownerPaginators = new Map();
  if (!client.ownerShutdown)   client.ownerShutdown   = new Map();

  // Extract userId suffix from customId  (owner_<action>_<userId>)
  // We split on _ and the last segment is always the userId
  const parts  = customId.split("_");
  const userId = parts[parts.length - 1];

  // ── Blacklist remove ───────────────────────────────────────────────────────
  // customId: owner_bl_remove_<userId>
  if (customId.startsWith("owner_bl_remove_")) {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> Only the command user can do this.", flags: MessageFlags.Ephemeral });
    }
    const state = client.ownerPaginators.get(`bl_${userId}`);
    if (!state) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> No blacklist state found (bot may have restarted).", flags: MessageFlags.Ephemeral });
    }
    const blacklistDB = require("../../../Schemas/blacklistSchema");
    await blacklistDB.deleteOne({ userId: state.userId });
    client.ownerPaginators.delete(`bl_${userId}`);

    return interaction.update({
      components: [okC("<a:tickyy:1555544712687915008>  Removed from Blacklist", `User \`${state.userId}\` has been removed from the blacklist.`)],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  // ── Shutdown multi-confirm ─────────────────────────────────────────────────
  // customId: owner_shutdown_<userId>
  if (customId.startsWith("owner_shutdown_")) {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> Only the command user can confirm shutdown.", flags: MessageFlags.Ephemeral });
    }
    const count = (client.ownerShutdown.get(userId) || 0) + 1;
    client.ownerShutdown.set(userId, count);

    if (count < 4) {
      const remaining = 4 - count;
      return interaction.update({
        components: [new ContainerBuilder().setAccentColor(ACCENT.error)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:error:1555544434601369620>  Shutdown Confirmation"))
          .addSeparatorComponents(sep())
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Press the button **${remaining}** more time(s) to confirm.`))
          .addSeparatorComponents(sep())
          .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`owner_shutdown_${userId}`).setLabel(`Confirm Shutdown (${count}/4)`).setStyle(ButtonStyle.Danger).setEmoji(parseEmoji("<:ban:1555544356352430202>"))
          ))],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 4 presses reached — shutdown
    client.ownerShutdown.delete(userId);
    await interaction.update({
      components: [okC("<a:tickyy:1555544712687915008>  Shutdown Confirmed", "Bot is shutting down…")],
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`[OWNER CMD] Bot shutdown initiated by ${interaction.user.tag}`);
    await client.user.setStatus("invisible").catch(() => {});
    process.exit(0);
    return;
  }

  // ── Server list pagination ─────────────────────────────────────────────────
  // customId: owner_srv_prev_<userId> / owner_srv_next_<userId>
  if (customId.startsWith("owner_srv_")) {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> Only the command user can navigate.", flags: MessageFlags.Ephemeral });
    }
    const state = client.ownerPaginators.get(`srv_${userId}`);
    if (!state) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> State not found. Run `/owner servers` again.", flags: MessageFlags.Ephemeral });
    }
    if (customId.includes("_next_")) state.page = Math.min(state.page + 1, state.totalPages - 1);
    else state.page = Math.max(state.page - 1, 0);
    try {
      await interaction.update({ components: [await state.buildPage(state.page)], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error("[owner servers pag]", err);
      interaction.reply({ content: "<:crossy:1555544390221562048> Error updating page.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return;
  }

  // ── List-commands pagination ───────────────────────────────────────────────
  // customId: owner_cmdl_prev_<userId> / owner_cmdl_next_<userId>
  if (customId.startsWith("owner_cmdl_")) {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> Only the command user can navigate.", flags: MessageFlags.Ephemeral });
    }
    const state = client.ownerPaginators.get(`cmdl_${userId}`);
    if (!state) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> State not found. Run `/owner list-commands` again.", flags: MessageFlags.Ephemeral });
    }
    if (customId.includes("_next_")) state.page = Math.min(state.page + 1, state.pages.length - 1);
    else state.page = Math.max(state.page - 1, 0);
    await interaction.update({ components: [state.buildPage(state.page)], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // ── Commands-info pagination ───────────────────────────────────────────────
  // customId: owner_cmdi_prev_<userId> / owner_cmdi_next_<userId>
  if (customId.startsWith("owner_cmdi_")) {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> Only the command user can navigate.", flags: MessageFlags.Ephemeral });
    }
    const state = client.ownerPaginators.get(`cmdi_${userId}`);
    if (!state) {
      return interaction.reply({ content: "<:crossy:1555544390221562048> State not found. Run `/owner commands-info` again.", flags: MessageFlags.Ephemeral });
    }
    if (customId.includes("_next_")) state.page = Math.min(state.page + 1, state.pages.length - 1);
    else state.page = Math.max(state.page - 1, 0);
    await interaction.update({ components: [state.buildPage(state.page)], flags: MessageFlags.IsComponentsV2 });
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup panel button handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a customId prefix → the command name stored in a panel entry.
 * This lets us recover the command even when the panel store has been cleared
 * after a bot restart — buttons stay functional 24/7.
 */
const BUTTON_PREFIX_TO_COMMAND = {
  agp_:      "agp",
  booster_:  "booster",
  xmas_:     "xmas",
  hw_:       "hw",
  gtn_:      "gtn",
  jtc_:      "jtc",
  lvlrole_:  "lvlrole",
  rr_:       "rr",
  uptime_:   "uptime",
  vcl_:      "vcl",
  lvl_:      "lvl",
  count_:    "count",
  jp_:       "jp",
  mm_:       "mm",
  verify_:   "verify",
  // NOTE: "sug_" prefix intentionally omitted here.
  // Suggestion vote/review buttons (suggest_up_*, suggest_down_*, suggest_approve_*,
  // suggest_reject_*, suggest_implement_*) are handled exclusively by
  // Events/Others/suggestions.js. Including "sug_" here would cause inferCommand()
  // to return "sug_setup" for those IDs, creating a phantom orphan panel entry and
  // racing with the suggestions listener — breaking vote buttons entirely.
  // Only the /setup suggestion panel buttons (sug_disable, sug_set_channel) arrive
  // with a live panel store entry and are routed via the "sug_setup" command block
  // below; those always have a real store entry so inferCommand is never reached.
  wm_:       "wm",
  logs_:     "logs",
  ai_:       "ai",
  twitch_:   "twitch",
  twitter_:  "twitter",
  yt_:       "yt",
};

/** Infer the command string from a customId when no panel entry exists. */
function inferCommand(customId) {
  for (const [prefix, cmd] of Object.entries(BUTTON_PREFIX_TO_COMMAND)) {
    if (customId.startsWith(prefix)) return cmd;
  }
  return null;
}

async function handleSetupButton(interaction, client, customId) {
  let entry = getPanel(interaction.message.id);

  if (!entry) {
    // Panel store was cleared (e.g. bot restart).
    // Try to reconstruct a minimal entry so buttons keep working.
    const command = inferCommand(customId);
    if (!command) {
      // These are owned by other handlers — do not acknowledge them here.
      const VERIFICATION_IDS = ["captchaenter", "vermodal"];
      if (VERIFICATION_IDS.includes(customId)) return;

      // Suggestion vote / review buttons are handled exclusively by
      // Events/Others/suggestions.js. Return without acking so that listener
      // can call interaction.update() / interaction.reply() cleanly.
      if (
        customId.startsWith("suggest_up_") ||
        customId.startsWith("suggest_down_") ||
        customId.startsWith("suggest_approve_") ||
        customId.startsWith("suggest_reject_") ||
        customId.startsWith("suggest_implement_")
      ) return;

      // Ticket buttons are handled by ticketActions.js (separate interactionCreate
      // listener). If we deferUpdate here first, ticketActions.js can't reply.
      if (customId.startsWith("ticket-") || customId.startsWith("ticket_") || customId === "stop-delete") return;

      // Confession buttons/selects are handled exclusively by confessionInteractions.js
      // via the central router in interactions.js. Never ack them here.
      if (
        customId === 'reply_confession' || customId === 'new_confession' ||
        customId === 'approve_confession' || customId === 'deny_confession' ||
        customId === 'edit_confession' ||
        customId.startsWith('report_confession_') || customId.startsWith('admin_delete_')
      ) return;

      // Truly unknown button — ack silently.
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
      return;
    }

    entry = {
      userId:  interaction.user.id,
      guildId: interaction.guild?.id,
      command,
      accent:  0x6C53FF,   // default RankCore purple
      data:    null,        // will be fetched fresh inside each handler block
      _orphan: true,        // flag so handlers know no cached data exists
    };
  }

  const { accent, guildId, command } = entry;
  const guild = interaction.guild;

  // For non-orphan panels, ensure only the original user can interact.
  // Orphan entries (post-restart) don't have a trusted stored userId,
  // so we skip this check — each handler's own guild-permission model applies.
  if (!entry._orphan && interaction.user.id !== entry.userId) {
    return interaction.reply({ content: "<:crossy:1555544390221562048> Only the user who opened this panel can interact with it.", flags: MessageFlags.Ephemeral });
  }

  // Helper to show a modal and register its context
  const showModalAndRegister = (modal, extra = {}) => {
    registerModal(interaction.user.id, guildId, interaction.message.id, command, extra);
    return interaction.showModal(modal);
  };

  // ── Anti Ghost-Ping ───────────────────────────────────────────────────────
  if (command === "agp") {
    const ghostPingSchema = require("../../../Schemas/ghostpingSchema");
    if (customId === "agp_toggle") {
      let data = entry.data;
      if (!data) data = new ghostPingSchema({ guildId, enabled: true });
      else data.enabled = !data.enabled;
      await data.save();
      updatePanelData(interaction.message.id, data);
      const { buildPanel } = require("../../../Commands/Setups/anti-ghost-ping");
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    return;
  }

  // ── Booster ───────────────────────────────────────────────────────────────
  if (command === "booster") {
    const BoosterChannel = require("../../../Schemas/boosterChannel");
    const { buildPanel, helpPanel } = require("../../../Commands/Setups/booster");
    if (customId === "booster_back") {
      const data = await BoosterChannel.findOne({ guildId });
      updatePanelData(interaction.message.id, data);
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "booster_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "booster_disable") {
      await BoosterChannel.deleteOne({ guildId });
      updatePanelData(interaction.message.id, null);
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "booster_set") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("booster_modal_set").setTitle("Set Booster Notification Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("booster_channel_input")
              .setLabel("Channel ID or name (without #)")
              .setStyle(TextInputStyle.Short).setPlaceholder("e.g. boosts  or  1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Christmas ─────────────────────────────────────────────────────────────
  if (command === "xmas") {
    const christmasSchema = require("../../../Schemas/christmasSchema");
    const { buildPanel, configPanel, helpPanel } = require("../../../Commands/Setups/christmas-config");
    let data = await christmasSchema.findOne({ Guild: guildId });
    if (customId === "xmas_back") {
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "xmas_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "xmas_configure") return interaction.update({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "xmas_toggle") {
      if (!data?.Channel) return interaction.reply({ content: "<:crossy:1555544390221562048> You must set a channel before enabling.", flags: MessageFlags.Ephemeral });
      if (data?.Enabled) { await christmasSchema.deleteMany({ Guild: guildId }); data = null; }
      else { await christmasSchema.findOneAndUpdate({ Guild: guildId }, { Guild: guildId, Enabled: true, Channel: data.Channel, PingRole: data.PingRole || null, LastSentDay: 0 }, { upsert: true }); data = await christmasSchema.findOne({ Guild: guildId }); }
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "xmas_clear_role") {
      if (data) { data.PingRole = null; await data.save(); }
      data = await christmasSchema.findOne({ Guild: guildId });
      await interaction.reply({ content: "<a:tickyy:1555544712687915008> Ping role cleared.", flags: MessageFlags.Ephemeral });
      return interaction.message.edit({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "xmas_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("xmas_modal_channel").setTitle("Set Christmas Countdown Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("xmas_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. christmas  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "xmas_set_role") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("xmas_modal_role").setTitle("Set Christmas Ping Role")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("xmas_role_input").setLabel("Role ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. Announcements  or  9876543210").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Halloween ─────────────────────────────────────────────────────────────
  if (command === "hw") {
    const halloweenSchema = require("../../../Schemas/halloweenSchema");
    const { buildPanel, configPanel, helpPanel } = require("../../../Commands/Setups/halloween-config");
    let data = await halloweenSchema.findOne({ Guild: guildId });
    if (customId === "hw_back") return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "hw_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "hw_configure") return interaction.update({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "hw_toggle") {
      if (!data?.Channel) return interaction.reply({ content: "<:crossy:1555544390221562048> You must set a channel before enabling.", flags: MessageFlags.Ephemeral });
      if (data?.Enabled) { await halloweenSchema.deleteMany({ Guild: guildId }); data = null; }
      else { await halloweenSchema.findOneAndUpdate({ Guild: guildId }, { Guild: guildId, Enabled: true, Channel: data.Channel, PingRole: data.PingRole || null, LastSentDay: 0 }, { upsert: true }); data = await halloweenSchema.findOne({ Guild: guildId }); }
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "hw_clear_role") {
      if (data) { data.PingRole = null; await data.save(); }
      data = await halloweenSchema.findOne({ Guild: guildId });
      await interaction.reply({ content: "<a:tickyy:1555544712687915008> Ping role cleared.", flags: MessageFlags.Ephemeral });
      return interaction.message.edit({ components: [configPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "hw_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("hw_modal_channel").setTitle("Set Halloween Countdown Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("hw_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. halloween  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "hw_set_role") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("hw_modal_role").setTitle("Set Halloween Ping Role")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("hw_role_input").setLabel("Role ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. Announcements  or  9876543210").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Guess The Number ──────────────────────────────────────────────────────
  if (command === "gtn") {
    const gtnSchema = require("../../../Schemas/guess");
    const { buildPanel, helpPanel } = require("../../../Commands/Setups/guessthenumber");
    let data = await gtnSchema.findOne({ guildId });
    if (customId === "gtn_back") return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "gtn_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "gtn_disable") {
      await gtnSchema.deleteOne({ guildId }); data = null;
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "gtn_enable") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("gtn_modal_enable").setTitle("Enable Guess The Number")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("gtn_channel_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. guess-the-number  or  1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Join To Create ────────────────────────────────────────────────────────
  if (command === "jtc") {
    const jtcSchema = require("../../../Schemas/jointocreate");
    const { buildPanel, helpPanel, setupModal } = require("../../../Commands/Setups/join-to-create");
    let data = await jtcSchema.findOne({ Guild: guildId });
    if (customId === "jtc_back") return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "jtc_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "jtc_disable") {
      await jtcSchema.deleteOne({ guildId }); data = null;
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "jtc_setup" || customId === "jtc_edit") {
      registerModal(interaction.user.id, guildId, interaction.message.id, "jtc");
      return interaction.showModal(setupModal(data));
    }
    return;
  }

  // ── Level Roles ───────────────────────────────────────────────────────────
  if (command === "lvlrole") {
    const levelRoleSchema = require("../../../Schemas/levelRoleSchema");
    const { buildPanel, helpPanel } = require("../../../Commands/Setups/levelroles");
    let data = await levelRoleSchema.findOne({ GuildID: guildId });
    if (customId === "lvlrole_back") return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "lvlrole_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "lvlrole_clear") {
      await levelRoleSchema.deleteOne({ GuildID: guildId }); data = null;
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "lvlrole_add") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("lvlrole_modal_add").setTitle("Add Level Role Milestone")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("lvlrole_role_id").setLabel("Role ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("lvlrole_level").setLabel("Required Level").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 10").setRequired(true)),
          )
      );
    }
    if (customId === "lvlrole_remove") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("lvlrole_modal_remove").setTitle("Remove Level Role Milestone")
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("lvlrole_remove_level").setLabel("Level number to remove").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 10").setRequired(true)))
      );
    }
    return;
  }

  // ── Reaction Role ─────────────────────────────────────────────────────────
  if (command === "rr") {
    const { buildPanel, helpPanel } = require("../../../Commands/Setups/reactionrole");
    if (customId === "rr_back") return interaction.update({ components: [buildPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "rr_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "rr_add") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("rr_modal_add").setTitle("Add Reaction Role")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rr_msg_id").setLabel("Message ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rr_emoji").setLabel("Emoji (e.g. <a:tickyy:1555544712687915008> or <:name:id>)").setStyle(TextInputStyle.Short).setPlaceholder("<a:tickyy:1555544712687915008> or <:custom:123>").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rr_role_id").setLabel("Role ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 9876543210").setRequired(true)),
          )
      );
    }
    if (customId === "rr_remove") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("rr_modal_remove").setTitle("Remove Reaction Role")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rr_remove_msg_id").setLabel("Message ID").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rr_remove_emoji").setLabel("Emoji").setStyle(TextInputStyle.Short).setRequired(true)),
          )
      );
    }
    return;
  }

  // ── Uptime Monitor ────────────────────────────────────────────────────────
  if (command === "uptime") {
    const uptimeSchema = require("../../../Schemas/uptimeSchema");
    const { buildPanel, helpPanel } = require("../../../Commands/Setups/uptime");
    let list = await uptimeSchema.find({ Guild: guildId });
    if (customId === "uptime_back") return interaction.update({ components: [buildPanel(list, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "uptime_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "uptime_view") {
      const lines = list.map(doc => {
        const name = doc.Name || doc.URL;
        const status = doc.LastStatus === "online" ? "<:LEgreen:1555544256356159600>" : "<:LEred:1555544262123323422>";
        const uptime = doc.TotalPings ? `${Math.round(doc.UptimePercent)}%` : "—";
        const interval = doc.Interval || 5;
        const alertCh = doc.AlertChannel ? `<#${doc.AlertChannel}>` : "DM";
        return `${status} **${name.slice(0, 30)}**\n  └ URL: \`${doc.URL.slice(0, 50)}\` | Uptime: \`${uptime}\` | Every \`${interval}m\` | Alerts: ${alertCh}`;
      }).join("\n\n") || "*No monitors configured.*";
      const detailPanel = new ContainerBuilder().setAccentColor(accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_utils:1555544669545431062>  Uptime Monitor Details"))
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(sep())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("uptime_back").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        ));
      return interaction.update({ components: [detailPanel], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "uptime_add") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("uptime_modal_add").setTitle("Add URL Monitor")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uptime_url").setLabel("URL (must start with https:// or http://)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uptime_name").setLabel("Friendly name (optional)").setStyle(TextInputStyle.Short).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uptime_interval").setLabel("Ping interval in minutes (1–60, default 5)").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("5")),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uptime_channel").setLabel("Alert channel ID (optional, blank = DM)").setStyle(TextInputStyle.Short).setRequired(false)),
          )
      );
    }
    if (customId === "uptime_remove") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("uptime_modal_remove").setTitle("Remove URL Monitor")
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uptime_remove_url").setLabel("Exact URL to remove").setStyle(TextInputStyle.Short).setRequired(true)))
      );
    }
    return;
  }

  // ── Voice Leveling ────────────────────────────────────────────────────────
  if (command === "vcl") {
    const voiceLevelSchema = require("../../../Schemas/voiceLevel");
    const voiceBlacklistSchema = require("../../../Schemas/voiceBlacklist");
    const { buildPanel, blacklistPanel, helpPanel } = require("../../../Commands/Setups/voiceLeveling");
    if (customId === "vcl_back") return interaction.update({ components: [await buildPanel(guildId, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "vcl_help") return interaction.update({ components: [helpPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "vcl_blacklist") return interaction.update({ components: [await blacklistPanel(guildId, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "vcl_disable") {
      await voiceLevelSchema.deleteOne({ Guild: guildId });
      return interaction.update({ components: [await buildPanel(guildId, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "vcl_enable") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("vcl_modal_enable").setTitle("Enable Voice Leveling")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("vcl_channel_input").setLabel("Notification Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. level-ups  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "vcl_bl_add") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("vcl_modal_bl_add").setTitle("Add Blacklisted Voice Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("vcl_bl_channel").setLabel("Voice Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. AFK  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "vcl_bl_remove") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("vcl_modal_bl_remove").setTitle("Remove Blacklisted Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("vcl_bl_remove_channel").setLabel("Voice Channel ID or name to remove").setStyle(TextInputStyle.Short).setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Leveling ──────────────────────────────────────────────────────────────
  if (command === "lvl") {
    const levelSetup = require("../../../Schemas/levelsetup");
    const { buildPanel } = require("../../../Commands/Setups/leveling");
    let data = await levelSetup.findOne({ guildId });
    if (customId === "lvl_toggle") {
      if (!data) { data = new levelSetup({ guildId, enabled: true }); }
      else data.enabled = !data.enabled;
      await data.save();
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "lvl_reset") {
      await levelSetup.deleteOne({ guildId }); data = null;
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "lvl_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("lvl_modal_channel").setTitle("Set Level Up Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("lvl_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. level-ups  or  1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Counting ──────────────────────────────────────────────────────────────
  if (command === "count") {
    const countingSchema = require("../../../Schemas/counting");
    const { buildPanel } = require("../../../Commands/Setups/counting");
    let data = await countingSchema.findOne({ guildId });
    if (customId === "count_disable") {
      await countingSchema.deleteOne({ guildId }); data = null;
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "count_reset") {
      if (data) { data.count = 0; data.lastUserId = null; await data.save(); }
      await interaction.reply({ content: "<a:tickyy:1555544712687915008> Count reset to 0.", flags: MessageFlags.Ephemeral });
      return interaction.message.edit({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "count_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("count_modal_channel").setTitle("Set Counting Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("count_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. counting  or  1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Join Ping ─────────────────────────────────────────────────────────────
  if (command === "jp") {
    const joinPingSchema = require("../../../Schemas/joinping");
    const { buildPanel } = require("../../../Commands/Setups/join-ping");
    let data = await joinPingSchema.findOne({ guildId });
    if (customId === "jp_disable") {
      await joinPingSchema.deleteOne({ guildId }); data = null;
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "jp_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("jp_modal_channel").setTitle("Set Join-Ping Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("jp_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. general  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "jp_set_user") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("jp_modal_user").setTitle("Set Ping User")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("jp_user_input").setLabel("User ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Modmail ───────────────────────────────────────────────────────────────
  if (command === "mm") {
    const modmailSchema = require("../../../Schemas/modmailschema");
    const { buildPanel } = require("../../../Commands/Setups/modmail");
    let data = await modmailSchema.findOne({ guildId });
    if (customId === "mm_toggle") {
      if (!data) data = new modmailSchema({ guildId, enabled: true });
      else data.enabled = !data.enabled;
      await data.save();
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "mm_set_category") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("mm_modal_category").setTitle("Set Modmail Category")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("mm_cat_input").setLabel("Category ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. Modmail  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "mm_set_log") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("mm_modal_log").setTitle("Set Modmail Log Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("mm_log_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. modmail-logs  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "mm_set_role") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("mm_modal_role").setTitle("Set Staff Role")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("mm_role_input").setLabel("Role ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. Staff  or  9876543210").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Verification ──────────────────────────────────────────────────────────
  if (command === "verify") {
    const verificationSchema = require("../../../Schemas/verificationSchema");
    const { buildPanel } = require("../../../Commands/Setups/verification");
    let data = await verificationSchema.findOne({ guildId });
    if (customId === "verify_toggle") {
      if (!data) data = new verificationSchema({ guildId, enabled: true });
      else data.enabled = !data.enabled;
      await data.save();
      return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "verify_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("verify_modal_channel").setTitle("Set Verification Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("verify_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. verify  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "verify_set_role") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("verify_modal_role").setTitle("Set Verified Role")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("verify_role_input").setLabel("Role ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. Verified  or  9876543210").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Suggestion setup ──────────────────────────────────────────────────────
  if (command === "sug_setup") {
    const suggestionSchema = require("../../../Schemas/suggestionSchema");
    const { buildSetupPanel } = require("../../../Commands/Setups/suggestion");
    let data = await suggestionSchema.findOne({ guildId });
    if (customId === "sug_disable") {
      await suggestionSchema.deleteOne({ guildId }); data = null;
      return interaction.update({ components: [buildSetupPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "sug_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("sug_modal_channel").setTitle("Set Suggestion Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("sug_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. suggestions  or  1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Welcome/Goodbye ───────────────────────────────────────────────────────
  if (command === "wm") {
    const WelcomeMessage = require("../../../Schemas/welcomeMessageSchema");
    const GoodbyeMessage = require("../../../Schemas/goodbyeMessageSchema");
    const { buildPanel, configSteps } = require("../../../Commands/Setups/welcome");
    let data = await WelcomeMessage.findOne({ guildId });
    let goodbyeData = await GoodbyeMessage.findOne({ guildId });
    if (customId === "wm_back") return interaction.update({ components: [buildPanel(data, goodbyeData, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "wm_config_welcome") return interaction.update({ components: [configSteps("welcome", accent)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "wm_config_goodbye") return interaction.update({ components: [configSteps("goodbye", accent)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "wm_disable") {
      await WelcomeMessage.deleteOne({ guildId });
      await GoodbyeMessage.deleteOne({ guildId });
      return interaction.update({ components: [buildPanel(null, null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "wm_toggle_embed_welcome") {
      if (!data) data = new WelcomeMessage({ guildId });
      data.isEmbed = !data.isEmbed; await data.save();
      await interaction.reply({ content: `<a:tickyy:1555544712687915008> Welcome embed ${data.isEmbed ? "enabled" : "disabled"}.`, flags: MessageFlags.Ephemeral });
      return interaction.message.edit({ components: [configSteps("welcome", accent)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "wm_toggle_embed_goodbye") {
      if (!goodbyeData) goodbyeData = new GoodbyeMessage({ guildId });
      goodbyeData.isEmbed = !goodbyeData.isEmbed; await goodbyeData.save();
      await interaction.reply({ content: `<a:tickyy:1555544712687915008> Goodbye embed ${goodbyeData.isEmbed ? "enabled" : "disabled"}.`, flags: MessageFlags.Ephemeral });
      return interaction.message.edit({ components: [configSteps("goodbye", accent)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "wm_set_channel_welcome" || customId === "wm_set_channel_goodbye") {
      const type = customId.includes("welcome") ? "welcome" : "goodbye";
      return showModalAndRegister(
        new ModalBuilder().setCustomId(`wm_modal_channel_${type}`).setTitle(`Set ${type === "welcome" ? "Welcome" : "Goodbye"} Channel`)
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("wm_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. welcome  or  1234567890").setRequired(true)
          )),
        { wmType: type }
      );
    }
    if (customId === "wm_set_message_welcome" || customId === "wm_set_message_goodbye") {
      const type = customId.includes("welcome") ? "welcome" : "goodbye";
      return showModalAndRegister(
        new ModalBuilder().setCustomId(`wm_modal_${type}`).setTitle(`Set ${type === "welcome" ? "Welcome" : "Goodbye"} Message`)
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("wm_msg_input").setLabel("Message Text (use {user}, {server}, {membercount})").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1024)
          )),
        { wmType: type }
      );
    }
    return;
  }

  // ── Logging ───────────────────────────────────────────────────────────────
  if (command === "logs") {
    const logSchema = require("../../../Schemas/logschema");
    const { buildContainer, typeSelectPanel, LOG_TYPES } = require("../../../Commands/Setups/logging");
    let data = await logSchema.findOne({ Guild: guildId });
    if (customId === "logs_refresh") {
      data = await logSchema.findOne({ Guild: guildId });
      return interaction.update({ components: [buildContainer(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "logs_disable") {
      await logSchema.deleteOne({ Guild: guildId }); data = null;
      return interaction.update({ components: [buildContainer(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "logs_setup") return interaction.update({ components: [typeSelectPanel(accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "logs_back") return interaction.update({ components: [buildContainer(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    // Select menu for log type → store selected type, show modal for channel
    if (customId === "logs_type_select") {
      const logType = interaction.values[0];
      const typeInfo = LOG_TYPES.find(t => t.value === logType);
      return showModalAndRegister(
        new ModalBuilder().setCustomId("logs_modal_channel").setTitle(`Set ${typeInfo.label}`)
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("logs_ch_input")
              .setLabel(`Channel ID or name for ${typeInfo.label}`)
              .setStyle(TextInputStyle.Short).setPlaceholder("e.g. server-logs  or  1234567890").setRequired(true)
          )),
        { logType }
      );
    }
    return;
  }

  // ── AI Config ─────────────────────────────────────────────────────────────
  if (command === "ai") {
    const aiConfig = require("../../../Schemas/aiSchema");
    const { buildPanel, blacklistPanel } = require("../../../Commands/PremiumCommands/ai-config");
    let data = await aiConfig.findOne({ guildId });
    if (customId === "ai_back") return interaction.update({ components: [buildPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "ai_blacklist") return interaction.update({ components: [blacklistPanel(data, accent, client)], flags: MessageFlags.IsComponentsV2 });
    if (customId === "ai_disable") {
      await aiConfig.deleteOne({ guildId });
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "ai_set_channel") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("ai_modal_channel").setTitle("Set AI Channel")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("ai_ch_input").setLabel("Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. chat  or  1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "ai_bl_add") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("ai_modal_bl_add").setTitle("Blacklist User")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("ai_bl_user_input").setLabel("User ID to blacklist").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890").setRequired(true)
          ))
      );
    }
    if (customId === "ai_bl_remove") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("ai_modal_bl_remove").setTitle("Remove from Blacklist")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("ai_bl_remove_input").setLabel("User ID to unblacklist").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890").setRequired(true)
          ))
      );
    }
    return;
  }

  // ── Twitch Notifications ──────────────────────────────────────────────────
  if (command === "twitch") {
    const TwitchNotification = require("../../../Schemas/twitchSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/twitchNotification");
    if (customId === "twitch_disable") {
      await TwitchNotification.deleteOne({ Guild: guildId });
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "twitch_setup") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("twitch_modal_setup").setTitle("Setup Twitch Notifications")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("twitch_channel").setLabel("Notification Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. twitch-alerts  or  1234567890").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("twitch_streamer").setLabel("Twitch Streamer URL").setStyle(TextInputStyle.Short).setPlaceholder("https://www.twitch.tv/username").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("twitch_message").setLabel("Custom live notification message").setStyle(TextInputStyle.Paragraph).setPlaceholder("<:LEred:1555544262123323422> {streamer} is now live!").setRequired(false)),
          )
      );
    }
    return;
  }

  // ── Twitter/X Notifications ───────────────────────────────────────────────
  if (command === "twitter") {
    const TwitterNotification = require("../../../Schemas/twitterSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/twitter");
    if (customId === "twitter_disable") {
      await TwitterNotification.deleteOne({ Guild: guildId });
      return interaction.update({ components: [buildPanel(null, accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "twitter_setup") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("twitter_modal_setup").setTitle("Setup Twitter/X Notifications")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("twitter_channel").setLabel("Notification Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. twitter-updates  or  1234567890").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("twitter_handle").setLabel("Twitter/X handle (without @)").setStyle(TextInputStyle.Short).setPlaceholder("e.g. elonmusk").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("twitter_message").setLabel("Custom tweet notification message").setStyle(TextInputStyle.Paragraph).setPlaceholder("<:n_bot:1555544367886770176> New tweet from @{handle}!").setRequired(false)),
          )
      );
    }
    return;
  }

  // ── YouTube Notifications ─────────────────────────────────────────────────
  if (command === "yt") {
    const YouTubeNotification = require("../../../Schemas/youtubeSchema");
    const { buildPanel } = require("../../../Commands/PremiumCommands/youtube");
    const notifications = await YouTubeNotification.find({ Guild: guildId });
    const setupCount = notifications.length;
    if (customId === "yt_disable_all") {
      await YouTubeNotification.deleteMany({ Guild: guildId });
      return interaction.update({ components: [buildPanel([], accent, client)], flags: MessageFlags.IsComponentsV2 });
    }
    if (customId === "yt_add") {
      if (setupCount >= 5) return interaction.reply({ content: "<:crossy:1555544390221562048> All 5 setup slots are already used!", flags: MessageFlags.Ephemeral });
      const nextSlot = [1,2,3,4,5].find(n => !notifications.some(notif => notif.SetupNumber === n));
      return showModalAndRegister(
        new ModalBuilder().setCustomId("yt_modal_add").setTitle(`Add YouTube Notification (Slot ${nextSlot})`)
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("yt_channel").setLabel("Notification Channel ID or name").setStyle(TextInputStyle.Short).setPlaceholder("e.g. yt-notifications  or  1234567890").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("yt_url").setLabel("YouTube Channel URL").setStyle(TextInputStyle.Short).setPlaceholder("https://www.youtube.com/@channelname").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("yt_message").setLabel("Custom notification message").setStyle(TextInputStyle.Paragraph).setPlaceholder("<:files:1555544445565407352> New video from {channel}!").setRequired(false)),
          ),
        { ytSlot: nextSlot }
      );
    }
    if (customId === "yt_remove") {
      return showModalAndRegister(
        new ModalBuilder().setCustomId("yt_modal_remove").setTitle("Remove YouTube Notification")
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("yt_remove_slot").setLabel("Slot number to remove (1–5)").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 2").setRequired(true)
          ))
      );
    }
    return;
  }
}

async function handleDashboardEmbedAction(interaction, action) {
  const ephemeral = action.ReplyEphemeral !== false;
  try {
    switch (action.ActionType) {
      case "reply": {
        const content = action.ReplyContent?.trim();
        if (!content) return interaction.reply({ content: "<:error:1555544434601369620> This button's reply content is empty.", flags: MessageFlags.Ephemeral });
        return interaction.reply({ content, flags: ephemeral ? MessageFlags.Ephemeral : 0 });
      }
      case "dm": {
        const content = action.ReplyContent?.trim();
        if (!content) return interaction.reply({ content: "<:error:1555544434601369620> This button's DM content is empty.", flags: MessageFlags.Ephemeral });
        try {
          await interaction.user.send({ content });
          return interaction.reply({ content: "<:announcement:1555544345740967956> Check your DMs!", flags: MessageFlags.Ephemeral });
        } catch {
          return interaction.reply({ content: "<:crossy:1555544390221562048> I couldn't DM you — make sure your DMs are open.", flags: MessageFlags.Ephemeral });
        }
      }
      case "role_add": {
        if (!action.RoleId) return interaction.reply({ content: "<:error:1555544434601369620> No role configured.", flags: MessageFlags.Ephemeral });
        const member = interaction.member;
        if (member.roles.cache.has(action.RoleId)) return interaction.reply({ content: "<a:tickyy:1555544712687915008> You already have this role.", flags: MessageFlags.Ephemeral });
        const role = interaction.guild.roles.cache.get(action.RoleId);
        if (!role) return interaction.reply({ content: "<:crossy:1555544390221562048> The configured role no longer exists.", flags: MessageFlags.Ephemeral });
        await member.roles.add(action.RoleId, `Dashboard button: ${action.CustomId}`);
        return interaction.reply({ content: `<a:tickyy:1555544712687915008> You've been given the **${role.name}** role!`, flags: ephemeral ? MessageFlags.Ephemeral : 0 });
      }
      case "role_remove": {
        if (!action.RoleId) return interaction.reply({ content: "<:error:1555544434601369620> No role configured.", flags: MessageFlags.Ephemeral });
        const member = interaction.member;
        if (!member.roles.cache.has(action.RoleId)) return interaction.reply({ content: "<:n_info:1555544473008873565> You don't have this role.", flags: MessageFlags.Ephemeral });
        const role = interaction.guild.roles.cache.get(action.RoleId);
        if (!role) return interaction.reply({ content: "<:crossy:1555544390221562048> The configured role no longer exists.", flags: MessageFlags.Ephemeral });
        await member.roles.remove(action.RoleId, `Dashboard button: ${action.CustomId}`);
        return interaction.reply({ content: `<a:tickyy:1555544712687915008> The **${role.name}** role has been removed.`, flags: ephemeral ? MessageFlags.Ephemeral : 0 });
      }
      case "role_toggle": {
        if (!action.RoleId) return interaction.reply({ content: "<:error:1555544434601369620> No role configured.", flags: MessageFlags.Ephemeral });
        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(action.RoleId);
        if (!role) return interaction.reply({ content: "<:crossy:1555544390221562048> The configured role no longer exists.", flags: MessageFlags.Ephemeral });
        const hasRole = member.roles.cache.has(action.RoleId);
        if (hasRole) { await member.roles.remove(action.RoleId); return interaction.reply({ content: `<:n_music:1555544516746940416> The **${role.name}** role has been removed.`, flags: ephemeral ? MessageFlags.Ephemeral : 0 }); }
        else { await member.roles.add(action.RoleId); return interaction.reply({ content: `<:n_music:1555544516746940416> You've been given the **${role.name}** role!`, flags: ephemeral ? MessageFlags.Ephemeral : 0 }); }
      }
    }
  } catch (err) {
    console.error(`[DashboardEmbedAction] customId=${action.CustomId} error:`, err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "<:crossy:1555544390221562048> Something went wrong executing this button's action.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

// State is now stored on client.ownerPaginators — no export needed