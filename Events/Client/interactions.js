const checkBlacklist     = require("./interaction/blacklist");
const { isDead, safeDeferUpdate } = require('./interaction/safeInteraction');
const handleModal        = require("./interaction/modal");
const handleButton       = require("./interaction/button");
const handleSlashCommand = require("./interaction/slash");
const handleError        = require("./interaction/error");
const { handleCustomCommand } = require('../../Utils/customcommandshandler');
const confessionInteractions = require('../Others/confessionInteractions');

// Confession customId prefixes/exact IDs that belong to confessionInteractions
const CONFESSION_BUTTON_IDS = new Set([
  'reply_confession', 'new_confession',
  'approve_confession', 'deny_confession', 'edit_confession',
]);
function isConfessionInteraction(interaction) {
  if (!interaction.customId) return false;
  const id = interaction.customId;
  if (CONFESSION_BUTTON_IDS.has(id)) return true;
  if (id.startsWith('report_confession_') || id.startsWith('admin_delete_')) return true;
  if (id === 'confession_category_select') return true;
  if (id.startsWith('replyConfessionModal_') || id.startsWith('newConfessionModal_') ||
      id === 'deny_reason_modal' || id === 'edit_approve_modal' ||
      id.startsWith('report_modal_')) return true;
  return false;
}


module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // ── Custom Branding gate ───────────────────────────────────────────────
      // When a CB bot is actively running for this guild, the main RankCore bot
      // must not respond to any interactions — the CB worker handles them.
      const guildId = interaction.guild?.id;
      if (guildId) {
        try {
          const cbMgr = require('../../src/core/CustomBrandingManager');
          if (cbMgr._ready && !cbMgr._pollSucceeded) {
            await Promise.race([
              cbMgr._ready,
              new Promise(resolve => setTimeout(resolve, 500))
            ]);
          }
          if (cbMgr.isActive(guildId)) return;
        } catch { /* non-critical */ }
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── Confession interactions ───────────────────────────────────────────
      if (isConfessionInteraction(interaction)) {
        return await confessionInteractions.execute(interaction);
      }

      // ── Blacklist gate — applies to ALL interaction types ─────────────────
      // Confession interactions are exempted so staff can still manage content
      // even if a user somehow gets blacklisted mid-flow. Tickets and staffapps
      // are handled by their own event files and never reach this point.
      if (!isConfessionInteraction(interaction) && await checkBlacklist(interaction, client)) return;

      // Custom command check (prefix-style slash overrides)
      if (await handleCustomCommand(interaction, client)) return;

      if (interaction.isModalSubmit())
        return await handleModal(interaction, client);

      if (interaction.isButton())
        return await handleButton(interaction, client, client.webhook);

      // Select menus (String, Role, User, Channel, Mentionable)
      if (interaction.isAnySelectMenu())
        return await handleSelectMenu(interaction, client);

      if (interaction.isChatInputCommand())
        return await handleSlashCommand(interaction, client);

      if (interaction.isAutocomplete())
        return await handleAutocomplete(interaction, client);

    } catch (error) {
      // Swallow expired / already-acknowledged interactions — not a real error
      if (isDead(error)) return;
      console.error("[InteractionCreate]", error);
      try { await handleError(interaction, client, error); } catch { /* non-critical */ }
    }
  },
};

// ── Select Menu router ────────────────────────────────────────────────────────
async function handleSelectMenu(interaction, client) {
  const { customId } = interaction;
  if (customId === "category-select" || customId.startsWith("page_")) return;
  if (customId.startsWith("staffapp_")) return; // handled exclusively by staffapps/index.js

  // Economy shop / item selectors
  if (customId.startsWith("economy_") || customId.startsWith("shop_")) {
    const econ = client.commands.get("economy");
    if (econ?.handleSelect) return econ.handleSelect(interaction, client);
  }

  // Playlist select
  if (customId.startsWith("playlist_")) {
    const playlist = client.commands.get("playlist");
    if (playlist?.handleSelect) return playlist.handleSelect(interaction, client);
  }

  // Passgen binary/cipher select menus
  if (customId.startsWith("generate_binary_mode") || customId.startsWith("generate_cipher_action")) {
    const passgen = client.commands.get("passgen");
    if (passgen?.handleSelect) return passgen.handleSelect(interaction, client);
    await safeDeferUpdate(interaction);
    return;
  }

  // Generic: defer silently for unhandled select menus
  // ── Template select menu actions ──────────────────────────────────────────
  // custom_ids for template dropdowns start with "sel_"
  if (customId.startsWith('sel_')) {
    try {
      const MessageTemplate = require('../../Schemas/messageTemplateSchema');
      const guildId = interaction.guildId;
      // Find any template in this guild whose selectMenus contain this custom_id
      const template = await MessageTemplate.findOne({
        guildId,
        'data.selectMenus': { $elemMatch: { custom_id: customId } },
      }).lean();
      if (template) {
        const menuData = template.data?.selectMenus?.find(m => m.custom_id === customId);
        const selectedValues = interaction.values || [];
        // Process each selected value's _action
        const actionsToRun = [];
        for (const val of selectedValues) {
          const opt = menuData?.options?.find(o => o.value === val);
          if (opt?._action?.type && opt._action.type !== 'none') actionsToRun.push(opt._action);
        }
        if (actionsToRun.length === 0) {
          return interaction.reply({ content: 'Selection noted! (No action configured for this option)', flags: 64 });
        }
        // Run the first action (Discord doesn't support multiple replies)
        const action = actionsToRun[0];
        const ephemeral = action.ephemeral !== false;
        switch (action.type) {
          case 'reply': {
            const content = action.content?.trim();
            return interaction.reply({ content: content || 'Action triggered.', flags: ephemeral ? 64 : 0 });
          }
          case 'dm': {
            const content = action.content?.trim();
            await interaction.user.send({ content: content || 'You selected an option.' }).catch(() => {});
            return interaction.reply({ content: '<:announcement:1555544345740967956> Check your DMs!', flags: 64 });
          }
          case 'role_add': case 'role_remove': case 'role_toggle': {
            const roleId = action.roleId;
            if (!roleId) return interaction.reply({ content: 'No role configured for this option.', flags: 64 });
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) return interaction.reply({ content: 'The configured role no longer exists.', flags: 64 });
            const hasRole = member.roles.cache.has(roleId);
            if (action.type === 'role_add') {
              if (hasRole) return interaction.reply({ content: `You already have the **${role.name}** role.`, flags: 64 });
              await member.roles.add(roleId);
              return interaction.reply({ content: `<a:tickyy:1555544712687915008> You've been given the **${role.name}** role!`, flags: ephemeral ? 64 : 0 });
            } else if (action.type === 'role_remove') {
              if (!hasRole) return interaction.reply({ content: `You don't have the **${role.name}** role.`, flags: 64 });
              await member.roles.remove(roleId);
              return interaction.reply({ content: `<a:tickyy:1555544712687915008> The **${role.name}** role has been removed.`, flags: ephemeral ? 64 : 0 });
            } else { // toggle
              if (hasRole) { await member.roles.remove(roleId); return interaction.reply({ content: `<:n_music:1555544516746940416> The **${role.name}** role has been removed.`, flags: ephemeral ? 64 : 0 }); }
              else { await member.roles.add(roleId); return interaction.reply({ content: `<:n_music:1555544516746940416> You've been given the **${role.name}** role!`, flags: ephemeral ? 64 : 0 }); }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Template SelectMenu]', err);
    }
  }

  // Ticket select menus are handled exclusively by ticketActions.js (separate
  // interactionCreate listener). Do NOT deferUpdate here — doing so would
  // acknowledge the interaction and prevent ticketActions.js from calling
  // showModal() or reply(), causing DiscordAPIError[40060].
  if (
    customId === 'ticket-dropdown' ||
    customId === 'ticket-tag-select' ||
    customId.startsWith('ticket-') ||
    customId.startsWith('ticket_')
  ) return;

  await safeDeferUpdate(interaction);
}

// ── Autocomplete router ───────────────────────────────────────────────────────
async function handleAutocomplete(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (!command?.autocomplete) return;
  try {
    await command.autocomplete(interaction, client);
  } catch (err) {
    console.error(`[Autocomplete] ${interaction.commandName}:`, err);
  }
}