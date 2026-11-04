const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    PermissionsBitField,
    TextInputStyle,
} = require('discord.js');
const { parseEmoji } = require('../../Utils/emojis');
const TicketSetup = require('../../Schemas/TicketSetup');
const TicketSchema = require('../../Schemas/Ticket');
const config = require('../../src/config/ticket');
const { createTranscript } = require('discord-html-transcripts');
const { hasManagePermission } = require('../../Events/Ticket/ticketActions/helpers');

async function restrictChannelAccess(channel, userId) {
    if (channel.permissionOverwrites) {
        await channel.permissionOverwrites.edit(userId, {
            [PermissionFlagsBits.SendMessages]: false,
            [PermissionFlagsBits.ReadMessageHistory]: false,
        }).catch(e => console.error('Failed to update channel permissions:', e.message));
    } else if (channel.isThread?.()) {
        await channel.members.remove(userId).catch(e => console.error('Failed to remove member from thread:', e.message));
    }
}

async function restoreChannelAccess(channel, userId) {
    if (channel.permissionOverwrites) {
        await channel.permissionOverwrites.edit(userId, {
            [PermissionFlagsBits.SendMessages]: true,
            [PermissionFlagsBits.ReadMessageHistory]: true,
        }).catch(e => console.error('Failed to update channel permissions:', e.message));
    } else if (channel.isThread?.()) {
        await channel.members.add(userId).catch(e => console.error('Failed to add member to thread:', e.message));
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage ticket operations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('remind')
                .setDescription('Remind the ticket owner about inactivity (closes after 24 hours)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close the current ticket')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for closing the ticket')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reopen')
                .setDescription('Reopen the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the current ticket')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to add to the ticket')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription('Claim the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('lock')
                .setDescription('Lock the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlock')
                .setDescription('Unlock the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close-request')
                .setDescription('Send a close request to the ticket owner — they must confirm before it closes')
        ),

    async execute(interaction, client) {
        const { guild, member, channel, options } = interaction;
        const subcommand = interaction.options.getSubcommand();

        const ticketData = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
        if (!ticketData) {
            return interaction.reply({ content: 'This command must be used in a ticket channel.', flags: MessageFlags.Ephemeral });
        }

        const ticketSetup = await TicketSetup.findOne({ GuildID: guild.id });
        if (!ticketSetup) {
            return interaction.reply({ content: 'Ticket system is not set up.', flags: MessageFlags.Ephemeral });
        }

        const hasManagePerm = hasManagePermission(member, ticketSetup);
        const isTicketOwner = member.id === ticketData.OwnerID;
        const isTicketClosed = ticketData.Closed;

        if (subcommand === 'remind') {
            await handleRemind(interaction, client, guild, channel, ticketData, hasManagePerm, isTicketClosed);
        } else if (subcommand === 'close') {
            await handleClose(interaction, client, guild, channel, ticketData, member, options, hasManagePerm, isTicketOwner, isTicketClosed, ticketSetup);
        } else if (subcommand === 'reopen') {
            await handleReopen(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketOwner, isTicketClosed);
        } else if (subcommand === 'add') {
            await handleAdd(interaction, guild, channel, ticketData, member, options, hasManagePerm, isTicketClosed);
        } else if (subcommand === 'claim') {
            await handleClaim(interaction, guild, channel, ticketData, member, config, hasManagePerm, isTicketClosed);
        } else if (subcommand === 'lock') {
            await handleLock(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketClosed);
        } else if (subcommand === 'unlock') {
            await handleUnlock(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketClosed);
        } else if (subcommand === 'close-request') {
            await handleCloseRequest(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketClosed);
        }
    },
};

async function handleRemind(interaction, client, guild, channel, ticketData, hasManagePerm, isTicketClosed) {
    if (!hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
    }
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
    }
    if (ticketData.RemindTimeout) {
        return interaction.reply({ content: 'A reminder is already active for this ticket.', flags: MessageFlags.Ephemeral });
    }

    const remindEmbed = new EmbedBuilder()
        .setTitle('Ticket Inactivity Warning')
        .setDescription('This ticket will be closed in 24 hours due to inactivity. Please send a message to keep it open.')
        .setColor('Yellow')
        .setTimestamp();

    await interaction.reply({ content: `<@${ticketData.OwnerID}>`, embeds: [remindEmbed] });

    const timeoutId = setTimeout(async () => {
        const updatedTicket = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
        if (!updatedTicket || updatedTicket.Closed) return;

        const reason = 'Inactivity';

        await restrictChannelAccess(channel, ticketData.OwnerID);

        let transcript;
        try {
            transcript = await createTranscript(channel, {
                limit: -1,
                returnType: 'attachment',
                saveImages: true,
                poweredBy: false,
                filename: `${config.ticketName}-${ticketData.TicketID}.html`,
            });
        } catch (error) {
            console.error('Failed to create transcript:', error);
            await channel.send({ content: 'Failed to create transcript.' }).catch(err => console.error('Failed to send message:', err));
            return;
        }

        const closingTicketEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`This ticket was closed automatically due to: ${reason}`)
            .setColor('Red');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket-reopen')
                .setLabel('Reopen Ticket')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ticket-delete')
                .setLabel('Delete Ticket')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('ticket-transcript')
                .setLabel('Send Transcript')
                .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: `<@${ticketData.OwnerID}>`, embeds: [closingTicketEmbed], components: [buttons] })
            .catch(error => console.error('Failed to send closing message:', error));

        const ticketOwner = await guild.members.fetch(ticketData.OwnerID).catch(error => {
            console.error('Failed to fetch ticket owner:', error);
            return null;
        });

        if (ticketOwner) {
            const claimedBy = ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed';
            const closedAt = new Date();
            const openedAt = ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown';

            const ownerEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setColor('Red')
                .addFields(
                    { name: 'Ticket Opened At', value: openedAt, inline: true },
                    { name: 'Ticket Closed At', value: closedAt.toLocaleString(), inline: true },
                    { name: 'Claimed By', value: claimedBy, inline: true },
                    { name: 'Closed By', value: 'Automatic', inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'Transcript', value: 'Attached with Embed' }
                );

            await ticketOwner.send({ content: `<@${ticketData.OwnerID}>`, embeds: [ownerEmbed], files: [transcript] })
                .catch(error => {
                    console.error('Failed to send DM to ticket owner:', error);
                    channel.send(`Could not send transcript to <@${ticketData.OwnerID}>. They may have DMs disabled.`)
                        .catch(err => console.error('Failed to send fallback message:', err));
                });
        } else {
            await channel.send(`Could not fetch ticket owner <@${ticketData.OwnerID}>. They may have left the server.`)
                .catch(error => console.error('Failed to send fallback message:', error));
        }

        await sendTranscriptToChannel(guild, ticketData, ticketData.OwnerID, 'Automatic', reason, transcript, config);
        await TicketSchema.updateOne({ ChannelID: channel.id }, { Closed: true, RemindTimeout: null });

    }, 24 * 60 * 60 * 1000);

    await TicketSchema.updateOne(
        { ChannelID: channel.id },
        { RemindTimeout: timeoutId[Symbol.toPrimitive]() }
    );
}

async function handleClose(interaction, client, guild, channel, ticketData, member, options, hasManagePerm, isTicketOwner, isTicketClosed, ticketSetup) {
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
    }
    if (!isTicketOwner && !hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });
    }

    let reason = options.getString('reason');
    let modalInteraction = null;

    if (!reason) {
        const modal = new ModalBuilder()
            .setCustomId('close_reason_modal')
            .setTitle('Close Ticket Reason');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Reason for closing this ticket')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Please provide the reason for closing this ticket.')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

        await interaction.showModal(modal);

        modalInteraction = await interaction.awaitModalSubmit({
            filter: (i) => i.user.id === member.id && i.customId === 'close_reason_modal',
            time: 30000,
        }).catch(async (err) => {
            console.error('Modal submission failed:', err);
            await interaction.followUp({ content: 'You did not provide a reason in time. The ticket will not be closed.', flags: MessageFlags.Ephemeral }).catch(() => {});
            return null;
        });

        if (!modalInteraction) return;

        await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });
        reason = modalInteraction.fields.getTextInputValue('close_reason');
    } else {
        // Reason provided via slash option — defer the original interaction now
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    await restrictChannelAccess(channel, ticketData.OwnerID);

    let transcript;
    try {
        transcript = await createTranscript(channel, {
            limit: -1,
            returnType: 'attachment',
            saveImages: true,
            poweredBy: false,
            filename: `${config.ticketName}-${ticketData.TicketID}.html`,
        });
    } catch (error) {
        console.error('Failed to create transcript:', error);
        if (modalInteraction) {
            await modalInteraction.followUp({ content: 'Failed to create transcript.', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.editReply({ content: 'Failed to create transcript.' });
        }
        return;
    }

    const closingTicketEmbed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription(`This ticket was closed by <@${member.id}> for the following reason: ${reason}`)
        .setColor('Red');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket-reopen')
            .setLabel('Reopen Ticket')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('ticket-delete')
            .setLabel('Delete Ticket')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('ticket-transcript')
            .setLabel('Send Transcript')
            .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [closingTicketEmbed], components: [buttons] }).catch(error => console.error('Failed to send closing message:', error));

    const ticketOwner = await guild.members.fetch(ticketData.OwnerID).catch(error => {
        console.error('Failed to fetch ticket owner:', error);
        return null;
    });

    if (ticketOwner) {
        const claimedBy = ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed';
        const closedAt = new Date();
        const openedAt = ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown';

        const ownerEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setColor('Red')
            .addFields(
                { name: 'Ticket Opened At', value: openedAt, inline: true },
                { name: 'Ticket Closed At', value: closedAt.toLocaleString(), inline: true },
                { name: 'Claimed By', value: claimedBy, inline: true },
                { name: 'Closed By', value: `<@${member.id}>`, inline: true },
                { name: 'Reason', value: reason },
                { name: 'Transcript', value: 'Attached with Embed' }
            );

        await ticketOwner.send({ embeds: [ownerEmbed], files: [transcript] }).catch(error => {
            console.error('Failed to send DM to ticket owner:', error);
            channel.send(`Could not send transcript to <@${ticketData.OwnerID}>. They may have DMs disabled.`).catch(err => console.error('Failed to send fallback message:', err));
        });
    } else {
        await channel.send(`Could not fetch ticket owner <@${ticketData.OwnerID}>. They may have left the server.`).catch(error => console.error('Failed to send fallback message:', error));
    }

    await sendTranscriptToChannel(guild, ticketData, ticketData.OwnerID, member.id, reason, transcript, config);
    await TicketSchema.updateOne({ ChannelID: channel.id }, { Closed: true, RemindTimeout: null });

    if (modalInteraction) {
        await modalInteraction.editReply({ content: 'Ticket closed successfully.' });
    } else {
        await interaction.editReply({ content: 'Ticket closed successfully.' });
    }
}

async function handleReopen(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketOwner, isTicketClosed) {
    if (!isTicketClosed) {
        return interaction.reply({ content: 'This ticket is not closed.', flags: MessageFlags.Ephemeral });
    }
    if (!isTicketOwner && !hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to reopen this ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await TicketSchema.updateOne({ ChannelID: channel.id }, { Closed: false, Claimed: false, Locked: false, RemindTimeout: null });

    await restoreChannelAccess(channel, ticketData.OwnerID);

    const reopenedEmbed = new EmbedBuilder()
        .setTitle('Ticket Reopened')
        .setDescription(`This ticket has been reopened by <@${member.id}>.`)
        .setColor('Green');

    await channel.send({ embeds: [reopenedEmbed] }).catch(error => console.error('Failed to send reopen message:', error));
    await interaction.followUp({ content: 'Ticket reopened successfully.', flags: MessageFlags.Ephemeral });
}

async function handleAdd(interaction, guild, channel, ticketData, member, options, hasManagePerm, isTicketClosed) {
    if (!hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
    }
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
    }

    const user = options.getUser('user');
    const selectedUser = await guild.members.fetch(user.id).catch(() => null);

    if (!selectedUser) {
        return interaction.reply({ content: 'Could not find the specified user in this server.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const findMembers = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id, MembersID: user.id });
    if (findMembers) {
        return interaction.followUp({ content: `${selectedUser} is already in the ticket.`, flags: MessageFlags.Ephemeral });
    }

    ticketData.MembersID.push(user.id);
    if (channel.permissionOverwrites) {
        await channel.permissionOverwrites.edit(user.id, {
            [PermissionFlagsBits.ViewChannel]: true,
            [PermissionFlagsBits.SendMessages]: true,
            [PermissionFlagsBits.ReadMessageHistory]: true,
        }).catch(error => console.error('Failed to edit channel permissions:', error));
    }

    await channel.send({
        embeds: [new EmbedBuilder()
            .setColor('Green')
            .setDescription(`${selectedUser} has been added to the ticket.`)]
    }).catch(error => console.error('Failed to send add message:', error));

    await ticketData.save();
    await interaction.followUp({ content: `${selectedUser} has been added to the ticket!`, flags: MessageFlags.Ephemeral });
}

async function handleClaim(interaction, guild, channel, ticketData, member, config, hasManagePerm, isTicketClosed) {
    if (!hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to claim this ticket.', flags: MessageFlags.Ephemeral });
    }
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is closed and cannot be claimed.', flags: MessageFlags.Ephemeral });
    }
    if (ticketData.Claimed) {
        const claimedBy = ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Unknown';
        return interaction.reply({ content: `This ticket is already claimed by ${claimedBy}.`, flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await TicketSchema.updateOne({ ChannelID: channel.id }, { Claimed: true, ClaimedBy: member.id });
    await channel.setName(`${config.ticketClaimEmoji}-${config.ticketName}-${ticketData.TicketID}`).catch(error => console.error('Failed to set channel name:', error));

    const claimEmbed = new EmbedBuilder()
        .setTitle('Ticket Claimed')
        .setDescription(`This ticket has been claimed by <@${member.id}>.`)
        .setColor('Yellow');

    await channel.send({ embeds: [claimEmbed] }).catch(error => console.error('Failed to send claim embed:', error));
    await interaction.followUp({ content: 'You have claimed this ticket.', flags: MessageFlags.Ephemeral });
}

async function handleLock(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketClosed) {
    if (!hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to lock this ticket.', flags: MessageFlags.Ephemeral });
    }
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
    }
    if (ticketData.Locked) {
        return interaction.reply({ content: 'This ticket is already locked.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await restrictChannelAccess(channel, ticketData.OwnerID);

    await TicketSchema.updateOne({ ChannelID: channel.id }, { Locked: true });
    await interaction.followUp({ content: 'The ticket has been locked. The ticket owner can no longer send messages or read past messages.', flags: MessageFlags.Ephemeral });
}

async function handleUnlock(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketClosed) {
    if (!hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to unlock this ticket.', flags: MessageFlags.Ephemeral });
    }
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
    }
    if (!ticketData.Locked) {
        return interaction.reply({ content: 'This ticket is already unlocked.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await restoreChannelAccess(channel, ticketData.OwnerID);


    await TicketSchema.updateOne({ ChannelID: channel.id }, { Locked: false });
    await interaction.followUp({ content: 'The ticket has been unlocked. The ticket owner can now send messages and read past messages.', flags: MessageFlags.Ephemeral });
}

async function sendTranscriptToChannel(guild, ticketData, ticketOwnerId, closedBy, reason, transcript, config) {
    const ticketSetup = await TicketSetup.findOne({ GuildID: guild.id });
    if (!ticketSetup?.Transcripts) {
        console.error('Transcripts channel ID not set in TicketSetup for guild:', guild.id);
        return;
    }

    try {
        const transcriptsChannel = await guild.channels.fetch(ticketSetup.Transcripts);
        if (!transcriptsChannel) {
            console.error('Transcripts channel not found:', ticketSetup.Transcripts);
            return;
        }

        const transcriptEmbed = new EmbedBuilder()
            .setTitle(`Ticket Transcript - ${config.ticketName}-${ticketData.TicketID}`)
            .setColor('Purple')
            .addFields(
                { name: 'Ticket Owner', value: `<@${ticketOwnerId}>`, inline: true },
                { name: 'Ticket ID', value: ticketData.TicketID.toString(), inline: true },
                { name: 'Closed By', value: closedBy === 'Automatic' ? 'Automatic' : `<@${closedBy}>`, inline: true },
                { name: 'Claimed By', value: ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed', inline: true },
                { name: 'Reason for Closure', value: reason, inline: false },
                { name: 'Opened At', value: ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown', inline: true },
                { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
            )
            .setTimestamp();

        await transcriptsChannel.send({ embeds: [transcriptEmbed], files: [transcript] });
    } catch (error) {
        console.error('Failed to send transcript to transcripts channel:', error);
    }
}

module.exports.setupMessageListener = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const ticketData = await TicketSchema.findOne({
            GuildID: message.guild.id,
            ChannelID: message.channel.id,
            OwnerID: message.author.id,
            RemindTimeout: { $ne: null },
        });

        if (!ticketData) return;

        clearTimeout(ticketData.RemindTimeout);
        await TicketSchema.updateOne(
            { ChannelID: message.channel.id },
            { RemindTimeout: null }
        );

        const activityEmbed = new EmbedBuilder()
            .setTitle('Ticket Activity Detected')
            .setDescription(`<@${ticketData.OwnerID}> has sent a message. The inactivity auto-close has been cancelled.`)
            .setColor('Green')
            .setTimestamp();

        await message.channel.send({ embeds: [activityEmbed] }).catch(error => console.error('Failed to send activity message:', error));
    });
};
// ── /ticket close-request ─────────────────────────────────────────────────────
// Staff run this to ask the ticket owner to confirm closure.
// Posts a message with a Confirm / Decline button — only the owner can click it.
// If the owner confirms, the ticket is closed via the normal ticket-close flow.

async function handleCloseRequest(interaction, guild, channel, ticketData, member, hasManagePerm, isTicketClosed) {
    if (!hasManagePerm) {
        return interaction.reply({ content: 'You do not have permission to send a close request.', flags: MessageFlags.Ephemeral });
    }
    if (isTicketClosed) {
        return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
    }

    const owner = await guild.members.fetch(ticketData.OwnerID).catch(() => null);

    const embed = new EmbedBuilder()
        .setColor(0xFFB347)
        .setTitle('<:announcement:1555544345740967956> Close Request')
        .setDescription(
            `${owner ? owner.toString() : `<@${ticketData.OwnerID}>`} — staff believe your issue has been resolved.\n\n` +
            `Please confirm below. If you still need help, click **Decline** and describe what's outstanding.`
        )
        .setFooter({ text: `Requested by ${member.user.tag}` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket-close-req-confirm:${ticketData.OwnerID}`)
            .setLabel('Yes, close my ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(parseEmoji('<:lockk:1555544494441635860>')),
        new ButtonBuilder()
            .setCustomId(`ticket-close-req-decline:${ticketData.OwnerID}`)
            .setLabel('No, I still need help')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(parseEmoji('<:restrict:1555544549105999962>')),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
}