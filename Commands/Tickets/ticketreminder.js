const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const TicketSetup  = require('../../Schemas/TicketSetup');
const TicketSchema = require('../../Schemas/Ticket');

function hasManagePermission(member, docs) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (docs.Handlers && member.roles.cache.has(docs.Handlers))   return true;
  if (docs.AdditionalManageRoles?.some(r => member.roles.cache.has(r))) return true;
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketreminder')
    .setDescription('Send a reminder ping to the ticket creator and assigned handler.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Optional custom reminder message.')
        .setRequired(false)
        .setMaxLength(500)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, member, channel } = interaction;

    const docs = await TicketSetup.findOne({ GuildID: guild.id });
    if (!docs) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('<:crossy:1567796959648030831> Ticket system is not configured.')],
      });
    }

    if (!hasManagePermission(member, docs)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('<:crossy:1567796959648030831> You do not have permission to use this command.')],
      });
    }

    const data = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
    if (!data) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('<:crossy:1567796959648030831> This channel is not a ticket.')],
      });
    }

    if (data.Closed) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('<:crossy:1567796959648030831> This ticket is already closed.')],
      });
    }

    const customMessage = interaction.options.getString('message');

    // Build the ping list: always ping owner, ping handler/claimer if set
    const pingIds = new Set([data.OwnerID]);
    if (data.AssignedTo) pingIds.add(data.AssignedTo);
    if (data.ClaimedBy)  pingIds.add(data.ClaimedBy);

    const pingContent = [...pingIds].map(id => `<@${id}>`).join(' ');

    const embed = new EmbedBuilder()
      .setColor(0xeab308)
      .setTitle('<:1430986244921495654:1567796929587576852> Ticket Reminder')
      .setDescription(
        customMessage ||
        'This is a friendly reminder that your ticket is still open and awaiting a response.'
      )
      .addFields(
        { name: '<:gw:1567796972872536159> Ticket', value: `#${data.TicketID}`, inline: true },
        { name: '<:user:1567797032423264261> Owner', value: `<@${data.OwnerID}>`, inline: true },
        ...(data.AssignedTo || data.ClaimedBy
          ? [{ name: '<:minigames:1567796978929238076> Handler', value: `<@${data.AssignedTo || data.ClaimedBy}>`, inline: true }]
          : []
        ),
        { name: '<:announcement:1567796950265241662> Sent by', value: `<@${member.id}>`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'RankCore Ticket System' });

    await channel.send({
      content: pingContent,
      embeds: [embed],
      allowedMentions: { users: [...pingIds] },
    });

    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`<a:tickyy:1567797045253644368> Reminder sent to ${[...pingIds].map(id => `<@${id}>`).join(', ')}.`)],
    });
  },
};