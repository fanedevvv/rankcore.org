const { isDead } = require('../../Events/Client/interaction/safeInteraction');
const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const { parseEmoji } = require('../../Utils/emojis');
const confessionConfig = require('../../Schemas/confession');
const {
    cooldowns,
    postConfession,
    sendToReview,
    dmSubmitter,
    checkCooldown,
    validateConfession,
    containsBlockedWord,
} = require('../../Utils/confessionUtils');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isModerator(member, config) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return config.ModeratorRoles?.some(id => member.roles.cache.has(id));
}

/** Extract submitter user ID from a review embed footer (encoded as "submitter:USERID") */
function extractSubmitterId(embed) {
    const footer = embed?.footer?.text || '';
    const match  = footer.match(/submitter:(\d{17,20})/);
    return match ? match[1] : null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handleInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;
    if (!interaction.guild) return;

    const config = await confessionConfig.findOne({ Guild: interaction.guild.id });
    if (!config) return;

    // ═══════════════════════ BUTTONS ════════════════════════════════════════

    if (interaction.isButton()) {
        const { customId } = interaction;

        // ── Approve confession ─────────────────────────────────────────────
        if (customId === 'approve_confession') {
            if (!isModerator(interaction.member, config)) {
                return interaction.reply({ content: '<:crossy:1567796959648030831> You are not a confession moderator.', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ ephemeral: true });

            const embed = interaction.message.embeds[0];
            const confessionText = embed?.description;
            if (!confessionText) return interaction.editReply({ content: 'Could not read confession text.' });

            const submitterId = extractSubmitterId(embed);
            const categoryField = embed.fields?.find(f => f.name === 'Category');
            const categoryLabel = categoryField?.value;

            let categoryChannel = null;
            if (categoryLabel && config.CategoriesEnabled) {
                const cat = config.Categories.find(c => `${c.emoji} ${c.label}` === categoryLabel || c.label === categoryLabel);
                if (cat?.channel) categoryChannel = cat.channel;
            }

            await postConfession(interaction, confessionText, { skipCooldown: true, userId: submitterId, categoryChannel });
            await interaction.message.delete().catch(() => {});

            if (config.DMOnApprove && submitterId) {
                await dmSubmitter(interaction.client, submitterId, interaction.guild.name, true);
            }

            interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION APPROVED',
                `Approved by ${interaction.user.tag} (${interaction.user.id})`
            );

            return interaction.editReply({ content: '<a:tickyy:1567797045253644368> Confession approved and posted.' });
        }

        // ── Deny confession ────────────────────────────────────────────────
        else if (customId === 'deny_confession') {
            if (!isModerator(interaction.member, config)) {
                return interaction.reply({ content: '<:crossy:1567796959648030831> You are not a confession moderator.', flags: MessageFlags.Ephemeral });
            }

            const modal = new ModalBuilder().setCustomId('deny_reason_modal').setTitle('Deny Confession');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('deny_reason')
                    .setLabel('Reason for denial (optional, sent to submitter)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(500)
            ));
            await interaction.showModal(modal);

            const mi = await interaction.awaitModalSubmit({
                filter: i => i.user.id === interaction.user.id && i.customId === 'deny_reason_modal',
                time: 60_000,
            }).catch(() => null);

            if (!mi) return;

            const reason       = mi.fields.getTextInputValue('deny_reason')?.trim() || null;
            const embed        = interaction.message.embeds[0];
            const submitterId  = extractSubmitterId(embed);

            config.TotalDenied = (config.TotalDenied || 0) + 1;
            await config.save();

            await interaction.message.delete().catch(() => {});

            if (config.DMOnDeny && submitterId) {
                await dmSubmitter(interaction.client, submitterId, interaction.guild.name, false, reason);
            }

            interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION DENIED',
                `Denied by ${interaction.user.tag}${reason ? `\nReason: ${reason}` : ''}`
            );

            await mi.reply({ content: '<:crossy:1567796959648030831> Confession denied.', flags: MessageFlags.Ephemeral });
        }

        // ── Edit & Approve ────────────────────────────────────────────────
        else if (customId === 'edit_confession') {
            if (!isModerator(interaction.member, config)) {
                return interaction.reply({ content: '<:crossy:1567796959648030831> You are not a confession moderator.', flags: MessageFlags.Ephemeral });
            }

            const originalText = interaction.message.embeds[0]?.description || '';

            const modal = new ModalBuilder().setCustomId('edit_approve_modal').setTitle('Edit & Approve Confession');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('edited_text')
                    .setLabel('Edit the confession before approving')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(2000)
                    .setValue(originalText)
            ));
            await interaction.showModal(modal);

            const mi = await interaction.awaitModalSubmit({
                filter: i => i.user.id === interaction.user.id && i.customId === 'edit_approve_modal',
                time: 120_000,
            }).catch(() => null);

            if (!mi) return;

            const editedText  = mi.fields.getTextInputValue('edited_text').trim();
            const embed       = interaction.message.embeds[0];
            const submitterId = extractSubmitterId(embed);

            await postConfession(mi, editedText, { skipCooldown: true, userId: submitterId });
            await interaction.message.delete().catch(() => {});

            if (config.DMOnApprove && submitterId) {
                await dmSubmitter(interaction.client, submitterId, interaction.guild.name, true);
            }

            interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION APPROVED',
                `Edited and approved by ${interaction.user.tag}`
            );
        }

        // ── Admin delete (posted confession) ─────────────────────────────
        else if (customId.startsWith('admin_delete_')) {
            if (!isModerator(interaction.member, config)) {
                return interaction.reply({ content: '<:crossy:1567796959648030831> You are not a confession moderator.', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ ephemeral: true });

            const targetMessageId = customId.replace('admin_delete_', '');

            if (targetMessageId && targetMessageId !== interaction.message.id) {
                const confessionChannelId = config.ConfessionChannel;
                const confessionChannel = confessionChannelId
                    ? interaction.guild.channels.cache.get(confessionChannelId)
                    : null;

                let deleted = false;

                if (confessionChannel) {
                    const target = confessionChannel.messages.cache.get(targetMessageId) ?? await confessionChannel.messages.fetch(targetMessageId).catch(() => null);
                    if (target) {
                        await target.delete().catch(() => {});
                        deleted = true;
                    }
                }

                if (!deleted) {
                    const target = interaction.channel.messages.cache.get(targetMessageId) ?? await interaction.channel.messages.fetch(targetMessageId).catch(() => null);
                    if (target) {
                        await target.delete().catch(() => {});
                        deleted = true;
                    }
                }

                await interaction.message.delete().catch(() => {});

                interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION DELETED',
                    `Deleted by ${interaction.user.tag} (${interaction.user.id})`
                );

                return interaction.editReply({
                    content: deleted
                        ? '<:del:1567796961334267974> Confession deleted.'
                        : '<:error:1567796968758050868> Could not find the original message, but the report has been cleared.',
                });

            } else {
                await interaction.message.delete().catch(() => {});

                interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION DELETED',
                    `Deleted by ${interaction.user.tag} (${interaction.user.id})`
                );

                return interaction.editReply({ content: '<:del:1567796961334267974> Confession deleted.' });
            }
        }

        // ── Report confession ──────────────────────────────────────────────
        else if (customId.startsWith('report_confession_')) {
            const modal = new ModalBuilder().setCustomId(`report_modal_${customId}`).setTitle('Report Confession');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('report_reason')
                    .setLabel('Why are you reporting this confession?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(500)
            ));
            await interaction.showModal(modal);

            const mi = await interaction.awaitModalSubmit({
                filter: i => i.user.id === interaction.user.id && i.customId === `report_modal_${customId}`,
                time: 60_000,
            }).catch(() => null);

            if (!mi) return;

            const reason = mi.fields.getTextInputValue('report_reason').trim();

            interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION REPORTED',
                `Reported by ${interaction.user.tag} (${interaction.user.id})\nMessage: ${interaction.message.url}\nReason: ${reason}`
            );

            // ── Resolve report destination ─────────────────────────────────
            // Priority: dedicated ReportChannel → LogChannel → ReviewChannel
            const reportTargetId = config.ReportChannel || config.LogChannel || config.ReviewChannel;

            if (reportTargetId) {
                const reportChan = interaction.guild.channels.cache.get(reportTargetId);
                if (reportChan) {
                    const reportEmbed = new EmbedBuilder()
                        .setTitle('<:restrict:1567797003638022166> Confession Reported')
                        .setDescription(interaction.message.embeds[0]?.description || 'N/A')
                        .addFields(
                            { name: 'Reported By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                            { name: 'Reason',      value: reason,                                               inline: false },
                            { name: 'Jump to',     value: `[Message](${interaction.message.url})`,              inline: true },
                        )
                        .setColor('Red')
                        .setTimestamp();

                    const adminRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`admin_delete_${interaction.message.id}`)
                            .setLabel('Delete Confession')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(parseEmoji('<:del:1567796961334267974>')),
                    );

                    // ── Ping the ReportPingRole if configured ──────────────
                    const pingContent = config.ReportPingRole
                        ? `<@&${config.ReportPingRole}>`
                        : undefined;

                    await reportChan.send({
                        content:    pingContent,
                        embeds:     [reportEmbed],
                        components: [adminRow],
                    });
                }
            }

            await mi.reply({ content: '<:restrict:1567797003638022166> Your report has been submitted to the moderation team.', flags: MessageFlags.Ephemeral });
        }

        // ── Reply anonymously ──────────────────────────────────────────────
        else if (customId === 'reply_confession') {
            const cdLeft = checkCooldown(`reply_${interaction.user.id}`, config);
            if (cdLeft) return interaction.reply({ content: `<:n_loading:1567796992556666982> Please wait **${cdLeft}s** before replying again.`, flags: MessageFlags.Ephemeral });

            const modal = new ModalBuilder()
                .setCustomId(`replyConfessionModal_${interaction.message.id}`)
                .setTitle('Reply Anonymously');

            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('replyText')
                    .setLabel('Your anonymous reply')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(config.MaxConfessionLength || 2000)
            ));
            return interaction.showModal(modal);
        }

        // ── New confession ────────────────────────────────────────────────
        else if (customId === 'new_confession') {
            if (config.Blacklist?.includes(interaction.user.id)) {
                return interaction.reply({ content: '<:restrict:1567797003638022166> You are blacklisted from submitting confessions.', flags: MessageFlags.Ephemeral });
            }

            const cdLeft = checkCooldown(interaction.user.id, config);
            const isTrusted = config.TrustedUsers?.includes(interaction.user.id);
            if (cdLeft && !isTrusted) {
                return interaction.reply({ content: `<:n_loading:1567796992556666982> Please wait **${cdLeft}s** before sending another confession.`, flags: MessageFlags.Ephemeral });
            }

            if (config.CategoriesEnabled && config.Categories?.length > 0) {
                const select = new StringSelectMenuBuilder()
                    .setCustomId('confession_category_select')
                    .setPlaceholder('Select a category…')
                    .addOptions(config.Categories.map(c => {
                        const emojiRaw = c.emoji || '<:files:1567796970964394044>';
                        const opt = {
                            label:       c.label,
                            value:       c.label,
                            description: c.channel ? 'Posts to dedicated channel' : 'Posts to main channel',
                        };
                        // parseEmoji converts '<:name:id>' to the object Discord.js needs;
                        // unicode emoji strings pass through as-is
                        const parsed = parseEmoji(emojiRaw);
                        if (parsed) opt.emoji = parsed;
                        return opt;
                    }));

                return interaction.reply({
                    content:    'Please select a category for your confession:',
                    components: [new ActionRowBuilder().addComponents(select)],
                    flags:      MessageFlags.Ephemeral,
                });
            }

            await showNewConfessionModal(interaction, config);
        }
    }

    // ═══════════════════════ SELECT MENUS ═══════════════════════════════════

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'confession_category_select') {
            const selectedLabel = interaction.values[0];
            await showNewConfessionModal(interaction, config, selectedLabel);
        }
    }

    // ═══════════════════════ MODALS ═════════════════════════════════════════

    if (interaction.isModalSubmit()) {
        const { customId } = interaction;

        // ── Reply submission ───────────────────────────────────────────────
        if (customId.startsWith('replyConfessionModal_')) {
            await interaction.deferReply({ ephemeral: true });

            const originalMsgId = customId.replace('replyConfessionModal_', '');
            const replyText     = interaction.fields.getTextInputValue('replyText').trim();

            if (config.WordFilterEnabled && containsBlockedWord(replyText, config.BlockedWords)) {
                config.TotalFiltered = (config.TotalFiltered || 0) + 1;
                await config.save();
                interaction.client.emit('confessionLog', interaction.guild, config, 'WORD FILTER TRIGGERED',
                    `Reply blocked from ${interaction.user.id}`
                );
                return interaction.editReply({ content: '<:restrict:1567797003638022166> Your reply contains prohibited content and was not sent.' });
            }

            const cdKey = `reply_${interaction.user.id}`;
            cooldowns.set(cdKey, Date.now());
            setTimeout(() => cooldowns.delete(cdKey), (config.CooldownSeconds || 60) * 1000);

            const embed = new EmbedBuilder()
                .setTitle('↩️ Anonymous Reply')
                .setDescription(replyText)
                .setColor(config.ConfessionColor || '#5865F2')
                .setFooter({ text: `Reply to confession` })
                .setTimestamp();

            try {
                const original = interaction.channel.messages.cache.get(originalMsgId) ?? await interaction.channel.messages.fetch(originalMsgId);
                await original.reply({ embeds: [embed] });
            } catch {
                await interaction.channel.send({ embeds: [embed] });
            }

            return interaction.editReply({ content: '↩️ Your anonymous reply has been sent!' });
        }

        // ── New confession submission ──────────────────────────────────────
        if (customId.startsWith('newConfessionModal_')) {
            await interaction.deferReply({ ephemeral: true });

            const categoryLabel = customId.replace('newConfessionModal_', '') || null;
            const text = interaction.fields.getTextInputValue('confessionText').trim();
            const userId = interaction.user.id;

            try {
                const validationError = validateConfession(text, config, userId);
                if (validationError) {
                    return interaction.editReply({ content: `<:crossy:1567796959648030831> ${validationError}` });
                }

                if (config.RequiredRoles?.length > 0) {
                    const hasRequired = config.RequiredRoles.some(id =>
                        interaction.member.roles.cache.has(id)
                    );
                    if (!hasRequired) {
                        return interaction.editReply({
                            content: '<:crossy:1567796959648030831> You do not have the required role to submit confessions.'
                        });
                    }
                }

                if (config.WordFilterEnabled && containsBlockedWord(text, config.BlockedWords)) {
                    config.TotalFiltered = (config.TotalFiltered || 0) + 1;
                    await config.save();

                    interaction.client.emit(
                        'confessionLog',
                        interaction.guild,
                        config,
                        'WORD FILTER TRIGGERED',
                        `Confession blocked from user ID \`${userId}\`.`
                    );

                    if (config.FilterAction === 'review') {
                        await sendToReview(interaction, text, config, { userId, categoryLabel });
                        return interaction.editReply({ content: '<:announcement:1567796950265241662> Your confession was sent for moderator review.' });
                    }

                    return interaction.editReply({ content: '<:restrict:1567797003638022166> Your confession contains prohibited content and was not submitted.' });
                }

                const isTrusted = config.TrustedUsers?.includes(userId);

                if (config.ReviewEnabled && config.ReviewChannel && !isTrusted) {
                    await sendToReview(interaction, text, config, { userId, categoryLabel });
                    return interaction.editReply({ content: '<:announcement:1567796950265241662> Your confession was sent for moderator review.' });
                } else {
                    let categoryChannel = null;
                    if (categoryLabel && config.CategoriesEnabled) {
                        const cat = config.Categories.find(c => c.label === categoryLabel);
                        if (cat?.channel) categoryChannel = cat.channel;
                    }

                    await postConfession(interaction, text, { userId, categoryChannel });
                    return interaction.editReply({ content: '<a:tickyy:1567797045253644368> Your confession has been submitted successfully!' });
                }

            } catch (err) {
                console.error('Confession submit error:', err);
                return interaction.editReply({ content: '<:crossy:1567796959648030831> Something went wrong while submitting your confession. Please try again.' });
            }
        }
    }
}

// ── Show new confession modal ─────────────────────────────────────────────────
async function showNewConfessionModal(interaction, config, categoryLabel = null) {
    const modalId = `newConfessionModal_${categoryLabel || ''}`;
    const modal   = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle(categoryLabel ? `Confession: ${categoryLabel}` : 'Send a Confession');

    modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId('confessionText')
            .setLabel('Your confession (completely anonymous)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(config.MinConfessionLength || 10)
            .setMaxLength(config.MaxConfessionLength || 2000)
            .setPlaceholder('Write anything — no one will know it was you.')
    ));

    return interaction.showModal(modal);
}

module.exports = {
    name: Events.InteractionCreate,
    execute: handleInteraction,
    handleButton: handleInteraction,
};