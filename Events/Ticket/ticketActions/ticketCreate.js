'use strict';

const { ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const TicketSchema = require('../../../Schemas/Ticket');
const TicketSetup = require('../../../Schemas/TicketSetup');
const { buildWelcomeV2, buildActionRows } = require('./builders');
const { scheduleAutoClose } = require('./autoClose');
const { errEmbed } = require('./helpers');
const cache = require('../../../src/lib/cache');

/**
 * Handle ticket dropdown selection.
 * If the category has intake questions shows a modal first, otherwise creates immediately.
 *
 * IMPORTANT: Discord requires showModal() to be called within 3 seconds of the interaction.
 * To avoid DiscordAPIError[10062] (Unknown interaction / token expired), we must call
 * showModal() BEFORE any async DB operations. DB validation is deferred to handleIntakeModal.
 * For the no-modal path, we still do DB checks first since we reply (not showModal).
 */
async function handleDropdown(interaction, client) {
    const { guild, member, values } = interaction;
    const categoryValue = values?.[0];

    const docs = await cache.wrap('ticket', `setup:${guild.id}`,
        () => TicketSetup.findOne({ GuildID: guild.id }).lean(),
        30
    );
    if (!docs) return interaction.reply({ embeds: [errEmbed('Ticket system not configured.')], flags: MessageFlags.Ephemeral });

    const cat = docs.Categories?.find(c => c.value === categoryValue);
    if (!cat) return interaction.reply({ embeds: [errEmbed('Invalid category.')], flags: MessageFlags.Ephemeral });

    const intakeQuestions = cat.intakeQuestions?.length ? cat.intakeQuestions : (docs.intakeQuestions || []);

    // If we need to show a modal, do it immediately — before any more async DB calls.
    // The duplicate/limit/blacklist checks will run inside handleIntakeModal instead.
    if (intakeQuestions.length > 0) {
        const modal = new ModalBuilder()
            .setCustomId(`ticket_intake_${categoryValue}`)
            .setTitle((cat.name || 'Ticket Details').slice(0, 45));

        intakeQuestions.slice(0, 5).forEach((q, i) => {
            const input = new TextInputBuilder()
                .setCustomId(`intake_${i}`)
                .setLabel((q.label || `Question ${i + 1}`).slice(0, 45))
                .setStyle(q.short ? TextInputStyle.Short : TextInputStyle.Paragraph)
                .setRequired(q.required || q.mandatory || false);
            if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
            if (q.maxLength)   input.setMaxLength(Math.min(q.maxLength, 4000));
            modal.addComponents(new ActionRowBuilder().addComponents(input));
        });

        // showModal must be the FIRST response — no awaits before this point
        // beyond the single TicketSetup.findOne above (which is fast/cached).
        return interaction.showModal(modal);
    }

    // ── No modal: run all checks synchronously before replying ────────────────

    // Check blacklist
    if (docs.BlacklistedRoles?.some(r => member.roles.cache.has(r)))
        return interaction.reply({ embeds: [errEmbed('You are not allowed to open tickets.')], flags: MessageFlags.Ephemeral });

    // Staff-only category guard
    if (cat.staffOnly) {
        const isStaff = member.permissions.has(PermissionFlagsBits.Administrator)
            || (docs.Handlers && member.roles.cache.has(docs.Handlers))
            || docs.AdditionalManageRoles?.some(r => member.roles.cache.has(r));
        if (!isStaff)
            return interaction.reply({ embeds: [errEmbed('This ticket category is for staff only.')], flags: MessageFlags.Ephemeral });
    }

    // Per-category duplicate check
    if (cat.checkDuplicates) {
        const existing = await TicketSchema.findOne({ GuildID: guild.id, OwnerID: member.id, Category: cat.value, Closed: false });
        if (existing)
            return interaction.reply({ embeds: [errEmbed('You already have an open ticket in this category.')], flags: MessageFlags.Ephemeral });
    }

    // Per-category max open check
    if (cat.maxOpen > 0) {
        const openCount = await TicketSchema.countDocuments({ GuildID: guild.id, OwnerID: member.id, Category: cat.value, Closed: false });
        if (openCount >= cat.maxOpen)
            return interaction.reply({ embeds: [errEmbed(`You already have ${openCount} open ticket(s) in this category (max ${cat.maxOpen}).`)], flags: MessageFlags.Ephemeral });
    } else if (docs.MaxTicketsPerUser > 0) {
        // Fall back to global limit
        const openCount = await TicketSchema.countDocuments({ GuildID: guild.id, OwnerID: member.id, Closed: false });
        if (openCount >= docs.MaxTicketsPerUser)
            return interaction.reply({ embeds: [errEmbed(`You already have ${openCount} open ticket(s) (max ${docs.MaxTicketsPerUser}).`)], flags: MessageFlags.Ephemeral });
    }

    return createTicket(interaction, cat, docs, client, []);
}

/**
 * Handle intake modal submission.
 *
 * Runs the blacklist / staff-only / duplicate / limit checks that were deferred
 * from handleDropdown (they were skipped there so we could call showModal in time).
 */
async function handleIntakeModal(interaction, client) {
    const { guild, member, customId } = interaction;
    const categoryValue = customId.replace('ticket_intake_', '');

    const docs = await cache.wrap('ticket', `setup:${guild.id}`,
        () => TicketSetup.findOne({ GuildID: guild.id }).lean(),
        30
    );
    if (!docs) return interaction.reply({ embeds: [errEmbed('Ticket system not configured.')], flags: MessageFlags.Ephemeral });

    const cat = docs.Categories?.find(c => c.value === categoryValue);
    if (!cat) return interaction.reply({ embeds: [errEmbed('Invalid category.')], flags: MessageFlags.Ephemeral });

    // ── Deferred checks (skipped in handleDropdown to allow showModal in time) ──

    // Check blacklist
    if (docs.BlacklistedRoles?.some(r => member.roles.cache.has(r)))
        return interaction.reply({ embeds: [errEmbed('You are not allowed to open tickets.')], flags: MessageFlags.Ephemeral });

    // Staff-only category guard
    if (cat.staffOnly) {
        const isStaff = member.permissions.has(PermissionFlagsBits.Administrator)
            || (docs.Handlers && member.roles.cache.has(docs.Handlers))
            || docs.AdditionalManageRoles?.some(r => member.roles.cache.has(r));
        if (!isStaff)
            return interaction.reply({ embeds: [errEmbed('This ticket category is for staff only.')], flags: MessageFlags.Ephemeral });
    }

    // Per-category duplicate check
    if (cat.checkDuplicates) {
        const existing = await TicketSchema.findOne({ GuildID: guild.id, OwnerID: member.id, Category: cat.value, Closed: false });
        if (existing)
            return interaction.reply({ embeds: [errEmbed('You already have an open ticket in this category.')], flags: MessageFlags.Ephemeral });
    }

    // Per-category max open check
    if (cat.maxOpen > 0) {
        const openCount = await TicketSchema.countDocuments({ GuildID: guild.id, OwnerID: member.id, Category: cat.value, Closed: false });
        if (openCount >= cat.maxOpen)
            return interaction.reply({ embeds: [errEmbed(`You already have ${openCount} open ticket(s) in this category (max ${cat.maxOpen}).`)], flags: MessageFlags.Ephemeral });
    } else if (docs.MaxTicketsPerUser > 0) {
        const openCount = await TicketSchema.countDocuments({ GuildID: guild.id, OwnerID: member.id, Closed: false });
        if (openCount >= docs.MaxTicketsPerUser)
            return interaction.reply({ embeds: [errEmbed(`You already have ${openCount} open ticket(s) (max ${docs.MaxTicketsPerUser}).`)], flags: MessageFlags.Ephemeral });
    }

    // ── Collect answers and create ticket ─────────────────────────────────────

    const intakeQuestions = cat.intakeQuestions?.length ? cat.intakeQuestions : (docs.intakeQuestions || []);
    const intakeAnswers = [];
    for (let i = 0; i < intakeQuestions.length; i++) {
        const value = interaction.fields.getTextInputValue(`intake_${i}`).trim();
        intakeAnswers.push({
            question: intakeQuestions[i].label || `Question ${i + 1}`,
            answer: value,
        });
    }

    return createTicket(interaction, cat, docs, client, intakeAnswers);
}

/**
 * Core ticket creation — channel or thread mode.
 */
async function createTicket(interaction, cat, docs, client, intakeAnswers) {
    const { guild, member } = interaction;
    const ownerId  = member.id;
    const ownerTag = member.user.username;

    // Determine ticket number
    const count    = await TicketSchema.countDocuments({ GuildID: guild.id }) + 1;
    const ticketId = String(count);

    // Determine ticket type (per-category override wins)
    const ticketType = (cat.ticketType === 'channel' || cat.ticketType === 'thread')
        ? cat.ticketType
        : (docs.TicketType || 'channel');

    // Build sanitised channel name
    const rawPrefix = (cat.channelPrefix?.trim()) || (docs.TicketPrefix || 'ticket');
    const prefix    = rawPrefix.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'ticket';
    const channelName = `${prefix}-${ticketId}`.slice(0, 100);

    // ── Thread mode ────────────────────────────────────────────────────────
    if (ticketType === 'thread') {
        const threadChannelId = cat.threadChannel || docs.ThreadChannel;
        const threadParent    = threadChannelId ? guild.channels.cache.get(threadChannelId) : null;
        if (!threadParent?.isTextBased())
            return interaction.reply({ embeds: [errEmbed('Thread channel is not configured or not found. Please contact an admin.')], flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let thread;
        try {
            thread = await threadParent.threads.create({
                name:               `${prefix}-${ticketId}`.slice(0, 100),
                autoArchiveDuration: 10080,
                reason:             `Ticket created by ${ownerTag}`,
                type:               ChannelType.PrivateThread,
            });
        } catch (err) {
            console.error('[Ticket] Thread create error:', err);
            return interaction.editReply({ embeds: [errEmbed(`Failed to create thread: ${err.message}`)] });
        }

        // Add owner and handlers
        await thread.members.add(ownerId).catch(() => {});
        if (docs.Handlers) await thread.members.add(docs.Handlers).catch(() => {});

        const welcome = buildWelcomeV2(docs, cat, member, null, cat.defaultPriority || null, ticketId, intakeAnswers);
        const rows    = buildActionRows(docs);

        // Save DB document first so recovery is possible if message sends fail
        const ticketDoc = {
            GuildID: guild.id, ChannelID: thread.id,
            TicketID: ticketId, OwnerID: ownerId, OwnerTag: ownerTag,
            Category: cat.value, CreatedAt: new Date(),
            Closed: false, intakeAnswers,
        };
        await TicketSchema.create(ticketDoc);

        const effectivePingRoles = [...new Set([...(docs.Handlers ? [docs.Handlers] : []), ...(docs.PingRoles || []), ...(cat.pingRoles || [])])];

        // Single message: pings + welcome embed + action buttons
        const msgContent = [`<@${ownerId}>`];
        if (effectivePingRoles.length) {
            msgContent.push(effectivePingRoles.map(id => `<@&${id}>`).join(' '));
        }
        await thread.send({
            content: msgContent.join(' '),
            allowedMentions: {
                users: [ownerId],
                ...(effectivePingRoles.length ? { roles: effectivePingRoles } : {}),
            },
            ...welcome,
            components: rows,
        }).catch(e => console.error('[Ticket] Welcome send error:', e.message));

        scheduleAutoClose(thread, docs, { OwnerID: ownerId, TicketID: ticketId }, client).catch(() => {});

        return interaction.editReply({ embeds: [{ description: `<a:tickyy:1555544712687915008> Ticket created: ${thread}`, color: 0x22c55e }] });
    }

    // ── Channel mode ───────────────────────────────────────────────────────
    const targetCategoryId = cat.ticketCategory || docs.TicketCategory;
    if (!targetCategoryId)
        return interaction.reply({ embeds: [errEmbed('Ticket category channel is not configured. Please contact an admin.')], flags: MessageFlags.Ephemeral });

    const category = guild.channels.cache.get(targetCategoryId);
    if (!category || category.type !== ChannelType.GuildCategory)
        return interaction.reply({ embeds: [errEmbed('The configured ticket category is invalid or not found. Please contact an admin.')], flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let ticketChannel;
    try {
        ticketChannel = await guild.channels.create({
            name:   channelName,
            type:   ChannelType.GuildText,
            parent: category,
            topic:  `Ticket ${ticketId} — ${ownerTag}`,
            reason: `Ticket created by ${ownerTag}`,
            permissionOverwrites: [
                // Deny @everyone by default (private ticket)
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                // Grant owner full access
                { id: ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                // Grant support role if configured
                ...(docs.Handlers ? [{ id: docs.Handlers, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }] : []),
                // Grant additional manage roles
                ...((docs.AdditionalManageRoles || []).map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory] }))),
            ],
        });
    } catch (err) {
        console.error('[Ticket] Channel create error:', err);
        return interaction.editReply({ embeds: [errEmbed(`Failed to create ticket channel: ${err.message}`)] });
    }

    const welcome = buildWelcomeV2(docs, cat, member, null, cat.defaultPriority || null, ticketId, intakeAnswers);
    const rows    = buildActionRows(docs);

    // Save DB document first so recovery is possible if message sends fail
    const ticketDoc = {
        GuildID: guild.id, ChannelID: ticketChannel.id,
        TicketID: ticketId, OwnerID: ownerId, OwnerTag: ownerTag,
        Category: cat.value, CreatedAt: new Date(),
        Closed: false, intakeAnswers,
    };
    await TicketSchema.create(ticketDoc);

    const effectivePingRoles = [...new Set([...(docs.Handlers ? [docs.Handlers] : []), ...(docs.PingRoles || []), ...(cat.pingRoles || [])])];

    // Single message: pings + welcome embed + action buttons
    const msgContent = [];
    if (docs.MentionOnCreate !== false) msgContent.push(`<@${ownerId}>`);
    if (effectivePingRoles.length) {
        msgContent.push(effectivePingRoles.map(id => `<@&${id}>`).join(' '));
    }
    const msgOpts = {
        ...welcome,
        components: rows,
    };
    if (msgContent.length) {
        msgOpts.content = msgContent.join(' ');
        msgOpts.allowedMentions = {
            ...(docs.MentionOnCreate !== false ? { users: [ownerId] } : {}),
            ...(effectivePingRoles.length ? { roles: effectivePingRoles } : {}),
        };
    }
    await ticketChannel.send(msgOpts).catch(e => console.error('[Ticket] Welcome send error:', e.message));

    scheduleAutoClose(ticketChannel, docs, { OwnerID: ownerId, TicketID: ticketId }, client).catch(() => {});

    return interaction.editReply({ embeds: [{ description: `<a:tickyy:1555544712687915008> Ticket created: ${ticketChannel}`, color: 0x22c55e }] });
}

module.exports = { handleDropdown, handleIntakeModal, scheduleAutoClose };