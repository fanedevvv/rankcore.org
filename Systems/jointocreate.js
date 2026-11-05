const {
  Events,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const { parseEmoji } = require('../Utils/emojis');
const joinschema = require("../Schemas/jointocreate");
const joinchannelschema = require("../Schemas/jointocreatechannels");
const jtcpanelschema = require("../Schemas/jtc-panel");

// ── Control panel (shared by the per-room panel and the permanent panel) ──────
const PANEL_FEATURES = `This **interface** can be used to manage temporary voice channels.

<:1430986227909263442:1555544212756242532> **NAME:** Rename your room  
<:1430986220011524216:1555544196952367134> **LIMIT:** Set user limit  
<:1430986222515261441:1555544202274807858> **PRIVACY:** Lock/Unlock  
<:1430986244921495654:1555544239792980044> **WAITING R.:** Toggle waiting mode  
<:1430993644189520113:1555544245589381200> **ANNOUNCE:** Toggle Announce mode  
<:1430986214764318873:1555544186227523665> **INVITE:** Create invite  
<:1430986225493479485:1555544207652032633> **REGION:** Set RTC region  
<:1430986233760452783:1555544218091389001> **TRANSFER:** Transfer owner  
<:1430986212398731355:1555544177578872834> **DELETE:** Delete room

**Member Management Menu:**
<:1430986217448542329:1555544191654699018> **KICK** members
<:1430986236746793000:1555544223506239591> **TRUST** a user
<:1430986241565790309:1555544234457833472> **UNTRUST** a user
<:1430986207856300180:1555544166866616410> **BLOCK** a user
<:1430986239036625017:1555544229143519304> **UNBLOCK** a user
<:1430986209995526274:1555544172302307449> **CLAIM** ownership (if owner leaves)
`;

function buildPanelEmbed(client, ownerId, triggerChannelId) {
    const head = ownerId
        ? `**Room Owner:** <@${ownerId}>\n`
        : `Join ${triggerChannelId ? `<#${triggerChannelId}>` : "the Join-to-Create channel"} to get your own room, then use the buttons below to manage it.\n`;
    return new EmbedBuilder()
        .setColor(client.config?.embedColor ?? 0x5865f2)
        .setAuthor({ name: `${client.user.username}'s TempVoice Interface` })
        .setDescription(head + PANEL_FEATURES)
        .setFooter({ text: "Press the buttons below to use the interface" });
}

/** suffix = the room's channel ID, or "panel" for the permanent panel (room resolved per click). */
function buildPanelRows(suffix) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`jtc_name_${suffix}`)
            .setEmoji(parseEmoji("<:1430986227909263442:1555544212756242532>"))
            .setLabel("NAME")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`jtc_limit_${suffix}`)
            .setEmoji(parseEmoji("<:1430986220011524216:1555544196952367134>"))
            .setLabel("LIMIT")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`jtc_privacy_${suffix}`)
            .setEmoji(parseEmoji("<:1430986222515261441:1555544202274807858>"))
            .setLabel("PRIVACY")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`jtc_wait_${suffix}`)
            .setEmoji(parseEmoji("<:1430986244921495654:1555544239792980044>"))
            .setLabel("WAITING")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`jtc_announce_${suffix}`)
            .setEmoji(parseEmoji("<:1430993644189520113:1555544245589381200>"))
            .setLabel("ANNOUNCE")
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`jtc_kick_menu_${suffix}`) // New Custom ID to trigger the menu
            .setEmoji(parseEmoji("<:1430986217448542329:1555544191654699018>"))
            .setLabel("KICK")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`jtc_trust_menu_${suffix}`) // New Custom ID to trigger the menu
            .setEmoji(parseEmoji("<:1430986236746793000:1555544223506239591>"))
            .setLabel("TRUST")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`jtc_block_menu_${suffix}`) // New Custom ID to trigger the menu
            .setEmoji(parseEmoji("<:1430986207856300180:1555544166866616410>"))
            .setLabel("BLOCK")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`jtc_transfer_menu_${suffix}`) // New Custom ID to trigger the menu
            .setEmoji(parseEmoji("<:1430986233760452783:1555544218091389001>"))
            .setLabel("TRANSFER")
            .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`jtc_invite_${suffix}`)
            .setEmoji(parseEmoji("<:1430986214764318873:1555544186227523665>"))
            .setLabel("INVITE")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`jtc_region_${suffix}`)
            .setEmoji(parseEmoji("<:1430986225493479485:1555544207652032633>"))
            .setLabel("REGION")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`jtc_claim_${suffix}`)
            .setEmoji(parseEmoji("<:1430986209995526274:1555544172302307449>"))
            .setLabel("CLAIM")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`jtc_delete_${suffix}`)
            .setEmoji(parseEmoji("<:1430986212398731355:1555544177578872834>"))
            .setLabel("DELETE")
            .setStyle(ButtonStyle.Danger)
    );
    return [row1, row2, row3];
}

/**
 * Posts the permanent panel in cfg.PanelChannel, or edits the one already there.
 * Returns { channelId, messageId }.
 */
async function postPersistentPanel(client, guild) {
    const cfg = await joinschema.findOne({ Guild: guild.id });
    if (!cfg?.PanelChannel) throw Object.assign(new Error("Pick a text channel for the panel first."), { status: 400 });
    const ch = guild.channels.cache.get(cfg.PanelChannel);
    if (!ch?.isTextBased()) throw Object.assign(new Error("The panel channel no longer exists."), { status: 400 });

    const payload = { embeds: [buildPanelEmbed(client, null, cfg.Channel)], components: buildPanelRows("panel") };
    const prev = cfg.PanelMessageId && cfg.PanelMessageChannel === ch.id
        ? await ch.messages.fetch(cfg.PanelMessageId).catch(() => null)
        : null;
    let message;
    try {
        message = prev ? await prev.edit(payload) : await ch.send(payload);
    } catch {
        throw Object.assign(new Error("RankCore can't send messages in that channel."), { status: 400 });
    }
    cfg.PanelMessageId = message.id;
    cfg.PanelMessageChannel = ch.id;
    await cfg.save();
    return { channelId: ch.id, messageId: message.id };
}

// A panel posted in a separate text channel outlives the room, so delete it with the room
async function deletePanelMessage(guild, roomId) {
  const panel = await jtcpanelschema.findOne({ Guild: guild.id, Channel: roomId }).lean().catch(() => null);
  if (!panel?.PanelChannel || !panel.MessageId) return;
  const ch = guild.channels.cache.get(panel.PanelChannel);
  await ch?.messages?.delete(panel.MessageId).catch(() => null);
}

// --- UTILITY FUNCTIONS ---

/**
 * Creates an ActionRow with a Select Menu of all members currently in the room, 
 * excluding the owner and the bot.
 * @param {VoiceChannel} room The voice channel object.
 * @param {string} customId The base custom ID for the select menu.
 * @param {string} ownerId The ID of the room owner to exclude.
 * @param {string} placeholder The text to show before selection.
 * @returns {ActionRowBuilder | null} The action row or null if no other members.
 */
const createMemberSelectRow = (room, customId, ownerId, placeholder) => {
    const memberOptions = room.members
        .filter(m => m.id !== ownerId && !m.user.bot)
        .map(member => ({
            label: member.user.username,
            value: member.id,
            description: `Click to select ${member.user.tag}`
        }));

    if (memberOptions.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(memberOptions);

    return new ActionRowBuilder().addComponents(selectMenu);
};

// --- CORE MODULE EXPORT ---

module.exports = (client) => {
    
    // --- VOICE STATE UPDATE (JTC Channel Creation/Deletion) ---
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (!newState?.guild) return;

        // 1. CHANNEL CREATION LOGIC
        if (!oldState.channelId && newState.channelId) {
            let cfg;
            try {
                cfg = await joinschema.findOne({ Guild: newState.guild.id });
            } catch (err) {
                console.error(`[JTC] Failed to fetch config for guild ${newState.guild.id}:`, err);
                return;
            }
            if (!cfg) return;
            if (newState.channelId !== cfg.Channel) return;

            const parent =
                cfg.Category &&
                newState.guild.channels.cache.get(cfg.Category) &&
                newState.guild.channels.cache.get(cfg.Category).type === ChannelType.GuildCategory
                ? cfg.Category
                : null;

            const owner = newState.member;
            let channel;

            try {
                if (cfg.InheritPermissions && parent) {
                    // Case 1: INHERIT permissions from category.
                    channel = await newState.guild.channels.create({
                        name: `${owner.user.username}'s room`,
                        type: ChannelType.GuildVoice,
                        parent,
                        userLimit: cfg.VoiceLimit || 0,
                    });
                    try {
                        // 2. ONLY apply the specific owner management permissions *after* creation.
                        await channel.permissionOverwrites.edit(owner.id, {
                            Connect: true,
                            ViewChannel: true,
                            MuteMembers: true,
                            DeafenMembers: true,
                            MoveMembers: true,
                            ManageChannels: true,
                            CreateInstantInvite: true,
                        });
                    } catch (err) {
                        console.error(`[JTC] Failed to set owner permissions for ${owner.user.tag} in channel ${channel.id}:`, err);
                    }
                } else {
                    // Case 2: Do NOT inherit or no parent. Use explicit permissions.
                    try {
                        channel = await newState.guild.channels.create({
                            name: `${owner.user.username}'s room`,
                            type: ChannelType.GuildVoice,
                            parent,
                            userLimit: cfg.VoiceLimit || 0,
                            permissionOverwrites: [
                                {
                                    id: owner.id,
                                    allow: [
                                        PermissionsBitField.Flags.Connect,
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.MuteMembers,
                                        PermissionsBitField.Flags.DeafenMembers,
                                        PermissionsBitField.Flags.MoveMembers,
                                        PermissionsBitField.Flags.ManageChannels,
                                        PermissionsBitField.Flags.CreateInstantInvite,
                                    ],
                                },
                                {
                                    id: newState.guild.roles.everyone.id,
                                    allow: [
                                        PermissionsBitField.Flags.Connect,
                                        PermissionsBitField.Flags.ViewChannel,
                                    ],
                                    deny: [
                                        PermissionsBitField.Flags.MuteMembers,
                                        PermissionsBitField.Flags.DeafenMembers,
                                        PermissionsBitField.Flags.MoveMembers,
                                        PermissionsBitField.Flags.ManageChannels,
                                        PermissionsBitField.Flags.CreateInstantInvite,
                                        PermissionsBitField.Flags.Speak,
                                    ],
                                },
                            ],
                        });
                    } catch (err) {
                        console.error(`[JTC] Error creating channel for ${owner.user.tag}:`, err);
                        return;
                    }
                }
            } catch (err) {
                console.error(`[JTC] Unexpected error during channel creation for ${owner.user.tag}:`, err);
                return;
            }

            // Move user to the new channel
            try {
                await owner.voice.setChannel(channel.id);
            } catch (err) {
                console.error(`[JTC] Failed to move ${owner.user.tag} to channel ${channel.id}:`, err);
            }

            // ── Connection Roles ──────────────────────────────────────────────
            // Assign any configured connection roles to the channel creator
            if (cfg.ConnectionRoles?.length) {
                for (const roleId of cfg.ConnectionRoles) {
                    const role = newState.guild.roles.cache.get(roleId);
                    if (!role) continue;
                    try { await owner.roles.add(role, 'JTC: Connection Role assigned on channel create'); }
                    catch (err) { console.warn(`[JTC] Could not assign connection role ${roleId} to ${owner.user.tag}:`, err.message); }
                }
            }

            // Save channel record
            await joinchannelschema.create({
                Guild: newState.guild.id,
                User: owner.id,
                Channel: channel.id,
            });

            // --- Panel Message Construction ---
            const panelEmbed = buildPanelEmbed(client, owner.id);
            const [row1, row2, row3] = buildPanelRows(channel.id);

            let panelMessage;
            let sentInOpenChat = false;
            let panelChannelId = null;
            const components = [row1, row2, row3];

            // Panel destination from the dashboard (only once the panel settings are turned on;
            // before that every server keeps the original behaviour: voice chat, then DM)
            const dest = cfg.PanelEnabled ? cfg.PanelDest : 'channel';

            // Permanent panel: no per-room message — just remember the owner and point them to it
            if (dest === 'persistent' && cfg.PanelChannel && newState.guild.channels.cache.has(cfg.PanelChannel)) {
                await jtcpanelschema.create({ Guild: newState.guild.id, Channel: channel.id, User: owner.id, MessageId: null });
                channel.send({
                    content: `<@${owner.id}> manage your room with the panel in <#${cfg.PanelChannel}>.`,
                    allowedMentions: { users: [owner.id] },
                }).catch(() => null);
                return;
            }

            const textChannel = dest === 'textchannel' && cfg.PanelChannel
                ? newState.guild.channels.cache.get(cfg.PanelChannel)
                : null;

            if (textChannel?.isTextBased()) {
                try {
                    panelMessage = await textChannel.send({
                        content: `<@${owner.id}> — controls for ${channel}`,
                        allowedMentions: { users: [owner.id] },
                        embeds: [panelEmbed],
                        components,
                    });
                    panelChannelId = textChannel.id;
                } catch { /* missing permissions — fall back below */ }
            }
            if (!panelMessage && dest !== 'dm') {
                try {
                    // Voice channel's built-in text chat (Text-in-Voice)
                    panelMessage = await channel.send({ embeds: [panelEmbed], components });
                    sentInOpenChat = true;
                } catch { /* Text-in-Voice unavailable — fall back to DM */ }
            }
            if (!panelMessage) {
                try {
                    if (dest !== 'dm') panelEmbed.setFooter({ text: "Couldn't post the panel in the server; sent in DMs." });
                    panelMessage = await owner.send({ embeds: [panelEmbed], components });
                } catch { } // Ignore if DM fails too
            }

            if (panelMessage) {
                // Save the panel message ID and owner
                await jtcpanelschema.create({
                    Guild: newState.guild.id,
                    Channel: channel.id,
                    User: owner.id,
                    MessageId: panelMessage.id,
                    PanelChannel: panelChannelId,
                });
                // Send a quick ping in the channel to notify the owner
                if (sentInOpenChat) {
                    try {
                        const pingMsg = await channel.send({
                            content: `<@${owner.id}>`,
                            allowedMentions: { users: [owner.id] },
                        });
                        setTimeout(() => pingMsg.delete().catch(() => { }), 500);
                    } catch { }
                }
            }
        }

        // 2. CHANNEL DELETION LOGIC
        if (oldState?.channelId && !newState.channelId) {
            const record = await joinchannelschema.findOne({
                Guild: oldState.guild.id,
                Channel: oldState.channelId,
                User: oldState.member.id,
            });
            // Only proceed if the user leaving is the recorded room owner
            if (!record) return;

            const voice = oldState.guild.channels.cache.get(record.Channel);
            if (!voice) {
                // Channel is gone, clean up database
                await joinchannelschema.deleteMany({
                    Guild: oldState.guild.id,
                    User: oldState.member.id,
                });
                return;
            }

            // If the channel is now empty (owner was the last one)
            if (voice.members.size === 0) {
                // ── Remove Connection Roles ───────────────────────────────────
                const cfg2 = await joinschema.findOne({ Guild: oldState.guild.id }).catch(() => null);
                if (cfg2?.ConnectionRoles?.length) {
                    for (const roleId of cfg2.ConnectionRoles) {
                        const role = oldState.guild.roles.cache.get(roleId);
                        if (!role) continue;
                        try { await oldState.member.roles.remove(role, 'JTC: Connection Role removed on channel delete'); }
                        catch { /* DM-closed / hierarchy — swallow */ }
                    }
                }
                try {
                    await voice.delete("Join-to-Create: owner left and room is empty");
                } catch { }
                // Clean up database records (joinchannelschema and jtcpanelschema - assuming cascade/cleanup elsewhere or explicit here)
                await deletePanelMessage(oldState.guild, voice.id);
                await joinchannelschema.deleteMany({
                    Guild: oldState.guild.id,
                    User: oldState.member.id,
                });
                await jtcpanelschema.deleteMany({
                    Guild: oldState.guild.id,
                    Channel: voice.id,
                });
            }
        }
    });

    // --- INTERACTION HANDLING (Buttons and Select Menus) ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith("jtc_")) return;

        const [prefix, action, ...parts] = interaction.customId.split("_");
        let channelId = parts.length > 0 ? parts[parts.length - 1] : null;

        if (!channelId) return;

        // Permanent panel: act on the room the user is in, otherwise the room they own
        if (channelId === "panel") {
            const inRoom = interaction.member?.voice?.channelId;
            const rec = (inRoom && await jtcpanelschema.findOne({ Guild: interaction.guild.id, Channel: inRoom }))
                || await jtcpanelschema.findOne({ Guild: interaction.guild.id, User: interaction.user.id });
            if (!rec) {
                const cfg = await joinschema.findOne({ Guild: interaction.guild.id }).lean().catch(() => null);
                return interaction.reply({
                    content: `You don't have a temporary voice room right now. Join ${cfg?.Channel ? `<#${cfg.Channel}>` : "the Join-to-Create channel"} to create one.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            channelId = rec.Channel;
        }

        const panel = await jtcpanelschema.findOne({ Channel: channelId });
        if (!panel) {
            return interaction.reply({
                content: "This control panel is no longer active. The room may have been deleted.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const room = interaction.guild.channels.cache.get(channelId);
        if (!room) {
            // Clean up panel record if room is gone
            await jtcpanelschema.deleteOne({ Channel: channelId });
            return interaction.reply({
                content: "That voice room no longer exists.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const isOwner = interaction.user.id === panel.User;
        const canManage = isOwner || interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        // OWNER/STAFF PERMISSION CHECK
        if (action !== "claim" && !canManage) {
            return interaction.reply({
                content: "Only the room owner or staff can use this panel for this action.",
                flags: MessageFlags.Ephemeral,
            });
        }
        
        // UTILITY FUNCTIONS for Permissions
        const lock = async () =>
            room.permissionOverwrites.edit(room.guild.roles.everyone.id, {
                Connect: false,
            });
        const unlock = async () =>
            room.permissionOverwrites.edit(room.guild.roles.everyone.id, {
                Connect: null, 
            });

        // --- BUTTON HANDLERS (Simpler actions / Menu Triggers) ---
        if (interaction.isButton()) {
            switch (action) {
                case "privacy": {
                    const everyone = room.permissionOverwrites.cache.get(room.guild.roles.everyone.id);
                    const locked = everyone && everyone.deny.has(PermissionsBitField.Flags.Connect);
                    await (locked ? unlock() : lock());
                    return interaction.reply({
                        content: locked ? "<:lockk:1555544494441635860> Unlocked the channel. Everyone can now join." : "<:lockk:1555544494441635860> Locked the channel. Only allowed users can join.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "limit": {
                    const modal = new ModalBuilder()
                        .setCustomId(`jtc_limit_modal_${channelId}`)
                        .setTitle("Set User Limit");

                    const limitInput = new TextInputBuilder()
                        .setCustomId("limit_input")
                        .setLabel("New User Limit (0-99)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(room.userLimit ? room.userLimit.toString() : "0")
                        .setMaxLength(2)
                        .setMinLength(1)
                        .setRequired(true);

                    const actionRow = new ActionRowBuilder().addComponents(limitInput);
                    modal.addComponents(actionRow);

                    return interaction.showModal(modal);
                }
                case "name": {
                    const modal = new ModalBuilder()
                        .setCustomId(`jtc_name_modal_${channelId}`)
                        .setTitle("Rename Room");

                    const nameInput = new TextInputBuilder()
                        .setCustomId("name_input")
                        .setLabel("New Channel Name (Max 90 chars)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(room.name)
                        .setMaxLength(90)
                        .setMinLength(1)
                        .setRequired(true);

                    const actionRow = new ActionRowBuilder().addComponents(nameInput);
                    modal.addComponents(actionRow);

                    return interaction.showModal(modal);
                }
                case "invite": {
                    const invite = await room.createInvite({ maxAge: 600, maxUses: 5 });
                    return interaction.reply({
                        content: `Here's a quick invite (10 min / 5 uses): ${invite.url}`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "region": {
                    const modal = new ModalBuilder()
                        .setCustomId(`jtc_region_modal_${channelId}`)
                        .setTitle("Set RTC Region");

                    const regionInput = new TextInputBuilder()
                        .setCustomId("region_input")
                        .setLabel("New RTC Region (e.g. us-east, auto)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(room.rtcRegion || "auto")
                        .setMaxLength(50)
                        .setMinLength(1)
                        .setRequired(true);

                    const actionRow = new ActionRowBuilder().addComponents(regionInput);
                    modal.addComponents(actionRow);

                    return interaction.showModal(modal);
                }
                case "announce": {
                    const everyoneRole = room.guild.roles.everyone;
                    const owEveryone = room.permissionOverwrites.cache.get(everyoneRole.id);
                    const isOn = owEveryone?.deny?.has(PermissionsBitField.Flags.Speak);

                    if (!isOn) {
                        await room.permissionOverwrites.edit(everyoneRole, { Speak: false });
                        await room.permissionOverwrites.edit(panel.User, { Speak: true });
                        return interaction.reply({
                            content: "<:n_music:1555544516746940416> Announce Mode **ON** — only you can speak.",
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        await room.permissionOverwrites.edit(everyoneRole, { Speak: null });
                        await room.permissionOverwrites.edit(panel.User, { Speak: null });
                        return interaction.reply({
                            content: "<:n_music:1555544516746940416> Announce Mode **OFF** — everyone can speak.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                }
                case "wait": {
                    await lock();
                    await room.setUserLimit(1);
                    return interaction.reply({
                        content:
                            "Waiting Room enabled (**locked** + **limit 1**). Use **PRIVACY** to unlock and **LIMIT** to raise the user limit when you're ready.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "claim": {
                    if (room.members.has(panel.User)) {
                        return interaction.reply({
                            content: "The original owner is still in the room and is prioritized.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    // Staff can claim even if not in the room, but the button text implies a user in the room will claim.
                    if (!room.members.has(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                         return interaction.reply({
                            content: "You must be in the room to claim ownership.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    panel.User = interaction.user.id;
                    await panel.save();
                    return interaction.reply({
                        content: "<:1430986209995526274:1555544172302307449> You have claimed ownership of this room.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "delete": {
                    await interaction.reply({ content: "Deleting the room...", flags: MessageFlags.Ephemeral });
                    try {
                        await room.delete("TempVoice delete via panel");
                        // Clean up database record explicitly
                        await deletePanelMessage(interaction.guild, channelId);
                        await joinchannelschema.deleteOne({ Channel: channelId });
                        await jtcpanelschema.deleteOne({ Channel: channelId });
                    } catch (err) {
                        console.error(`[JTC] Error deleting channel ${room.id}:`, err);
                        return interaction.editReply({
                            content: "Failed to delete the room. Check bot permissions.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    return interaction.editReply({ content: "Deleted the room.", flags: MessageFlags.Ephemeral });
                }
                
                // --- Menu Triggers (for actions that require picking a user) ---
                case "kick":
                case "trust":
                case "block":
                case "transfer": {
                    const mode = action;
                    const menuAction = mode === "kick" ? "jtc_select_kick" : 
                                       mode === "trust" ? "jtc_select_trust" : 
                                       mode === "block" ? "jtc_select_block" : 
                                       "jtc_select_transfer";

                    const placeholder = mode === "kick" ? "Select a member to kick" :
                                        mode === "trust" ? "Select a member to allow/trust" :
                                        mode === "block" ? "Select a member to block" :
                                        "Select a member to transfer ownership to";

                    const selectRow = createMemberSelectRow(room, `${menuAction}_${channelId}`, panel.User, placeholder);

                    if (!selectRow) {
                        return interaction.reply({
                            content: mode === "transfer" ? "You are the only person in the room." : "No other members to manage.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    return interaction.reply({
                        content: `**${mode.toUpperCase()}** - Choose a user from the menu below:`,
                        components: [selectRow],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                default:
                    return;
            }
        }
        
        // --- MODAL SUBMIT HANDLERS ---
        if (interaction.isModalSubmit()) {
            if (action === "limit" && parts[0] === "modal") {
                const limitStr = interaction.fields.getTextInputValue("limit_input");
                const n = parseInt(limitStr, 10);
                
                if (Number.isNaN(n) || n < 0 || n > 99) {
                    return interaction.reply({
                        content: "<:crossy:1555544390221562048> Invalid input. Please provide a number between 0 and 99.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                
                await room.setUserLimit(n);
                return interaction.reply({
                    content: `<a:tickyy:1555544712687915008> User limit set to **${n || "Unlimited"}**.`,
                    flags: MessageFlags.Ephemeral,
                });
            } else if (action === "name" && parts[0] === "modal") {
                const newName = interaction.fields.getTextInputValue("name_input").slice(0, 90);
                await room.setName(newName);
                return interaction.reply({
                    content: `<a:tickyy:1555544712687915008> Renamed to **${newName}**.`,
                    flags: MessageFlags.Ephemeral,
                });
            } else if (action === "region" && parts[0] === "modal") {
                const region = interaction.fields.getTextInputValue("region_input").toLowerCase();
                await room.setRTCRegion(region === "auto" ? null : region).catch(() => {});
                return interaction.reply({
                    content: `<a:tickyy:1555544712687915008> RTC region set to **${region}**.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        // --- SELECT MENU HANDLERS (for multi-user actions) ---
        if (interaction.isStringSelectMenu()) {
            const targetId = interaction.values[0];
            const target = interaction.guild.members.cache.get(targetId);
            
            if (!target) {
                 return interaction.reply({
                    content: "Couldn't resolve that user.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Remove the menu from the original message and send a final response
            await interaction.update({ components: [] }); 

            switch (action) {
                case "select_kick": {
                    if (!room.members.has(target.id)) {
                        return interaction.followUp({
                            content: `<:crossy:1555544390221562048> **${target.user.tag}** is no longer in your room.`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                    try { await target.voice.disconnect("Kicked by room owner"); } catch {}
                    return interaction.followUp({
                        content: `<a:tickyy:1555544712687915008> Kicked **${target.user.tag}** from the room.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "select_trust": {
                    await room.permissionOverwrites.edit(target.id, {
                        Connect: true,
                        ViewChannel: true,
                    });
                    return interaction.followUp({
                        content: `<a:tickyy:1555544712687915008> Trusted **${target.user.tag}** (can always join, even when locked).`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "select_block": {
                    await room.permissionOverwrites.edit(target.id, {
                        Connect: false,
                        ViewChannel: false, // Also deny view channel to hide the room
                    });
                    // Try to kick the user if they are currently connected
                    if (room.members.has(target.id)) {
                        try { await target.voice.disconnect("Blocked by room owner"); } catch {}
                    }
                    return interaction.followUp({
                        content: `<a:tickyy:1555544712687915008> Blocked **${target.user.tag}** from joining (and kicked if they were connected).`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                case "select_transfer": {
                    panel.User = target.id;
                    await panel.save();
                    
                    // Transferring the room management permissions to the new owner
                    // 1. Remove owner permissions from old owner
                    await room.permissionOverwrites.edit(interaction.user.id, {
                        MuteMembers: null,
                        DeafenMembers: null,
                        MoveMembers: null,
                        ManageChannels: null,
                        CreateInstantInvite: null,
                    });
                    // 2. Add owner permissions to new owner
                    await room.permissionOverwrites.edit(target.id, {
                        MuteMembers: true,
                        DeafenMembers: true,
                        MoveMembers: true,
                        ManageChannels: true,
                        CreateInstantInvite: true,
                    });

                    return interaction.followUp({
                        content: `<a:tickyy:1555544712687915008> Transferred ownership to **${target.user.tag}**.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                default:
                    return;
            }
        }
        
    });
};
module.exports.postPersistentPanel = postPersistentPanel;
