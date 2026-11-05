// ─────────────────────────────────────────────────────────────────────────────
// Events/Others/giveaway.js
// ─────────────────────────────────────────────────────────────────────────────
const { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Giveaway = require('../../Schemas/giveawaySchema');
const CustomBranding = require('../../Schemas/customBrandingSchema');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!['giveaway_enter', 'giveaway_entries'].includes(interaction.customId)) return;
    if (interaction.customId === 'giveaway_entries') return; // disabled, but guard anyway

    // Defer immediately — prevents 3-second Discord timeout on slow DB reads
    await interaction.deferReply({ ephemeral: true });

    try {
      const giveawayId = interaction.message.id;
      const giveaway = await Giveaway.findOne({ giveawayId });

      if (!giveaway) {
        return interaction.editReply({ content: 'This giveaway no longer exists.' });
      }
      if (giveaway.hasEnded) {
        return interaction.editReply({ content: 'This giveaway has already ended!' });
      }
      if (Date.now() > new Date(giveaway.endTime).getTime()) {
        return interaction.editReply({ content: 'This giveaway has expired. The draw will happen shortly...' });
      }

      const userId = interaction.user.id;
      // Use Set to determine unique entrants (pool may contain duplicates for bonus weight)
      const uniqueEntrants = [...new Set(giveaway.entrants)];
      const hasEntered = uniqueEntrants.includes(userId);

      if (hasEntered) {
        // LEAVE: $pull removes ALL matching elements (including bonus duplicates)
        const updated = await Giveaway.findOneAndUpdate(
          { giveawayId },
          { $pull: { entrants: userId } },
          { new: true }
        );
        const newUnique = [...new Set(updated.entrants)].length;
        await refreshEntryButton(interaction, giveaway, newUnique);
        return interaction.editReply({ content: 'You have been removed from the giveaway.' });
      }

      // Required role check
      if (giveaway.requiredRole && !interaction.member.roles.cache.has(giveaway.requiredRole)) {
        return interaction.editReply({
          content: 'You need the <@&' + giveaway.requiredRole + '> role to enter this giveaway.',
        });
      }

      // Build entries array: 1 base + bonus duplicates if applicable
      const entries = [userId];
      if (giveaway.bonusRole && giveaway.bonusEntries > 0 && interaction.member.roles.cache.has(giveaway.bonusRole)) {
        for (let i = 0; i < giveaway.bonusEntries; i++) entries.push(userId);
      }

      const updated = await Giveaway.findOneAndUpdate(
        { giveawayId },
        { $push: { entrants: { $each: entries } } },
        { new: true }
      );

      const newUnique = [...new Set(updated.entrants)].length;
      await refreshEntryButton(interaction, giveaway, newUnique);

      const bonusMsg = entries.length > 1
        ? ' (**' + entries.length + ' entries** — bonus role applied!)'
        : '';
      return interaction.editReply({
        content: 'You have entered the giveaway' + bonusMsg + '! Good luck! <:boost:1567796953599836280>',
      });

    } catch (err) {
      console.error('[Giveaway Button Error]', err);
      return interaction.editReply({ content: 'Something went wrong. Please try again.' });
    }
  },
};

// Update the entry count button on the giveaway message.
// Routes the edit through the CB bot if the message was sent by it —
// the main RankCore bot cannot edit messages it doesn't own.
async function refreshEntryButton(interaction, giveaway, uniqueCount) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_enter')
      .setLabel('Enter Giveaway')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('giveaway_entries')
      .setLabel('Entries: ' + uniqueCount)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  // If the giveaway was posted by a CB bot, edit via the internal CB API
  // rather than calling message.edit() directly (which would fail).
  if (giveaway.viaCB && giveaway.guildId) {
    try {
      const { apiPost } = require('../../dashboard/lib/botClient');
      await apiPost('/internal/cb/edit', {
        guildId:   giveaway.guildId,
        channelId: giveaway.channelId,
        messageId: giveaway.giveawayId,
        payload:   { components: [row.toJSON()] },
      });
      return;
    } catch (err) {
      console.warn('[Giveaway] CB edit failed, falling back to RankCore:', err.message);
    }
  }

  // Default: edit via RankCore bot
  try {
    await interaction.message.edit({ components: [row] });
  } catch (_) {
    // Silently ignore if message is no longer editable
  }
}
