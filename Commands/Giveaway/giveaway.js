// PUT IN: Commands/Giveaway/giveaway.js
// This is a complete rewrite. Replace your existing file.

const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder,
  ButtonStyle, ActionRowBuilder, MessageFlags, PermissionsBitField,
} = require('discord.js');
const ms = require('ms');
const Giveaway = require('../../Schemas/giveawaySchema');

// ── Shared helpers (also exported for cron and dashboard) ─────────────────────

function buildEmbed({ prize, winnerCount, host, endTime, requiredRole, bonusRole, bonusEntries, description }) {
  const lines = [
    '**Prize:** ' + prize,
    '**Winners:** ' + winnerCount,
    '**Hosted by:** ' + host,
    '**Ends:** <t:' + Math.floor(new Date(endTime) / 1000) + ':R>',
  ];
  if (description)  lines.push('\n' + description);
  if (requiredRole) lines.push('\n**Required Role:** <@&' + requiredRole.id + '>');
  if (bonusRole)    lines.push('**Bonus:** ' + bonusEntries + 'x entries for <@&' + bonusRole.id + '>');
  return new EmbedBuilder()
    .setTitle('GIVEAWAY').setColor('#53FF6C')
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date(endTime));
}

function buildRow(count) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('giveaway_entries').setLabel('Entries: ' + count).setStyle(ButtonStyle.Secondary).setDisabled(true),
  );
}

function pick(pool, count) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out = []; const seen = new Set();
  for (const id of shuffled) {
    if (!seen.has(id)) { seen.add(id); out.push(id); }
    if (out.length >= count) break;
  }
  return out;
}

async function endGiveaway(giveawayId, client, guildId) {
  const query = { giveawayId, hasEnded: false };
  if (guildId) query.guildId = guildId;
  const g = await Giveaway.findOne(query);
  if (!g) return { ok: false, error: 'Giveaway not found or already ended.' };

  const winners = pick(g.entrants, g.winners);

  // ── Mark as ended FIRST ───────────────────────────────────────────────────
  // Doing this before the Discord REST calls means that if the message fetch or
  // channel send fails (deleted message, missing perms, rate limit), the poller
  // will NOT pick this giveaway up again on the next 15-second tick and hammer
  // GET /channels/:id/messages/:id in an infinite loop.
  await Giveaway.updateOne({ giveawayId }, { hasEnded: true, winnersChosen: winners, drawnAt: new Date() });

  const ch = client.channels.cache.get(g.channelId) ||
             await client.channels.fetch(g.channelId).catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle('GIVEAWAY ENDED').setColor(winners.length ? '#FFD700' : '#888888')
    .setDescription(winners.length
      ? '**Prize:** ' + g.prize + '\n**Winners:** ' + winners.map(id => '<@' + id + '>').join(', ') + '\n**Host:** <@' + g.host + '>'
      : '**Prize:** ' + g.prize + '\n\nNo entrants - no winners drawn.\n**Host:** <@' + g.host + '>')
    .setFooter({ text: 'ID: ' + giveawayId + ' - ' + [...new Set(g.entrants)].length + ' unique entrants' })
    .setTimestamp();

  if (ch) {
    try { const msg = ch.messages.cache.get(g.messageId) ?? await ch.messages.fetch(g.messageId); await msg.edit({ embeds: [embed], components: [] }); } catch (_) {}
    if (winners.length) {
      await ch.send('Congratulations ' + winners.map(id => '<@' + id + '>').join(', ') + '! You won **' + g.prize + '**!').catch(() => {});
    }
  }

  return { ok: true, winners };
}

// ── Slash command ─────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway').setDescription('Manage giveaways')
    .addSubcommand(sub => sub.setName('start').setDescription('Start a new giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(20))
      .addStringOption(o => o.setName('duration').setDescription('e.g. 30s, 5m, 2h, 1d').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Extra description').setRequired(false))
      .addRoleOption(o => o.setName('required_role').setDescription('Role required to enter').setRequired(false))
      .addRoleOption(o => o.setName('bonus_role').setDescription('Role with bonus entries').setRequired(false))
      .addIntegerOption(o => o.setName('bonus_entries').setDescription('Bonus entry count').setRequired(false).setMinValue(1).setMaxValue(10))
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(false))
    )
    .addSubcommand(sub => sub.setName('reroll').setDescription('Reroll ended giveaway winners')
      .addStringOption(o => o.setName('giveaway_id').setDescription('Message ID').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Count to reroll').setRequired(false).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('edit').setDescription('Edit an active giveaway')
      .addStringOption(o => o.setName('giveaway_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('prize').setDescription('New prize').setRequired(false))
      .addIntegerOption(o => o.setName('winners').setDescription('New count').setRequired(false).setMinValue(1).setMaxValue(20))
      .addStringOption(o => o.setName('extend').setDescription('Extend by e.g. 1h').setRequired(false))
    )
    .addSubcommand(sub => sub.setName('end').setDescription('End a giveaway early')
      .addStringOption(o => o.setName('giveaway_id').setDescription('Message ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List active giveaways')),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.MentionEveryone))
      return interaction.reply({ content: 'You need Mention Everyone permission.', flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();
    try {

      if (sub === 'start') {
        const prize      = interaction.options.getString('prize');
        const winCount   = interaction.options.getInteger('winners');
        const duration   = interaction.options.getString('duration');
        const desc       = interaction.options.getString('description') ?? null;
        const reqRole    = interaction.options.getRole('required_role');
        const bonRole    = interaction.options.getRole('bonus_role');
        const bonEntries = interaction.options.getInteger('bonus_entries') ?? 0;
        const channel    = interaction.options.getChannel('channel') ?? interaction.channel;

        if (bonRole && bonEntries <= 0)
          return interaction.reply({ content: 'Set bonus_entries > 0 when using a bonus role.', flags: MessageFlags.Ephemeral });

        const timeMs = ms(duration);
        if (!timeMs || timeMs < 5000)
          return interaction.reply({ content: 'Invalid duration. Min 5s. Examples: 30s, 5m, 2h, 1d.', flags: MessageFlags.Ephemeral });
        if (timeMs > ms('30d'))
          return interaction.reply({ content: 'Max duration is 30 days.', flags: MessageFlags.Ephemeral });

        const endTime = new Date(Date.now() + timeMs);
        const embed = buildEmbed({ prize, winnerCount: winCount, host: interaction.user, endTime, requiredRole: reqRole, bonusRole: bonRole, bonusEntries: bonEntries, description: desc });
        const msg = await channel.send({ embeds: [embed], components: [buildRow(0)] });
        embed.setFooter({ text: 'Giveaway ID: ' + msg.id });
        await msg.edit({ embeds: [embed] });

        await Giveaway.create({
          giveawayId: msg.id, messageId: msg.id, channelId: channel.id,
          guildId: interaction.guild.id, prize, winners: winCount,
          endTime, host: interaction.user.id, entrants: [],
          requiredRole: reqRole?.id ?? null, bonusRole: bonRole?.id ?? null,
          bonusEntries: bonEntries, hasEnded: false, description: desc, createdVia: 'slash',
        });

        return interaction.reply({ content: 'Giveaway started in ' + channel + '!', flags: MessageFlags.Ephemeral });
      }

      if (sub === 'reroll') {
        const id = interaction.options.getString('giveaway_id');
        const g  = await Giveaway.findOne({ giveawayId: id, guildId: interaction.guild.id });
        if (!g)          return interaction.reply({ content: 'Giveaway not found.', flags: MessageFlags.Ephemeral });
        if (!g.hasEnded) return interaction.reply({ content: 'Giveaway has not ended yet.', flags: MessageFlags.Ephemeral });
        if (!g.entrants.length) return interaction.reply({ content: 'No entrants.', flags: MessageFlags.Ephemeral });

        const count   = interaction.options.getInteger('winners') ?? g.winners;
        const winners = pick(g.entrants, count);
        const ch      = client.channels.cache.get(g.channelId);
        if (ch) await ch.send('Reroll - **' + g.prize + '**\nNew winners: ' + winners.map(id => '<@' + id + '>').join(', ')).catch(() => {});
        await Giveaway.updateOne({ giveawayId: id }, { winnersChosen: winners });
        return interaction.reply({ content: 'Rerolled! Winners: ' + winners.map(id => '<@' + id + '>').join(', '), flags: MessageFlags.Ephemeral });
      }

      if (sub === 'edit') {
        const id      = interaction.options.getString('giveaway_id');
        const prize   = interaction.options.getString('prize');
        const winners = interaction.options.getInteger('winners');
        const extend  = interaction.options.getString('extend');
        if (!prize && !winners && !extend)
          return interaction.reply({ content: 'Provide at least one field to edit.', flags: MessageFlags.Ephemeral });

        const g = await Giveaway.findOne({ giveawayId: id, guildId: interaction.guild.id, hasEnded: false });
        if (!g) return interaction.reply({ content: 'Active giveaway not found.', flags: MessageFlags.Ephemeral });

        const upd = {};
        if (prize)   upd.prize   = prize;
        if (winners) upd.winners = winners;
        if (extend) {
          const extMs = ms(extend);
          if (!extMs) return interaction.reply({ content: 'Invalid extension.', flags: MessageFlags.Ephemeral });
          upd.endTime = new Date(g.endTime.getTime() + extMs);
        }

        const updated = await Giveaway.findOneAndUpdate({ giveawayId: id }, upd, { new: true });
        const ch = client.channels.cache.get(g.channelId);
        if (ch) {
          try {
            const msg  = ch.messages.cache.get(g.messageId) ?? await ch.messages.fetch(g.messageId);
            const host = { id: updated.host, toString: () => '<@' + updated.host + '>' };
            const rr   = updated.requiredRole ? { id: updated.requiredRole } : null;
            const br   = updated.bonusRole    ? { id: updated.bonusRole    } : null;
            const e    = buildEmbed({ prize: updated.prize, winnerCount: updated.winners, host, endTime: updated.endTime, requiredRole: rr, bonusRole: br, bonusEntries: updated.bonusEntries, description: updated.description });
            e.setFooter({ text: 'Giveaway ID: ' + msg.id });
            await msg.edit({ embeds: [e], components: [buildRow([...new Set(updated.entrants)].length)] });
          } catch (_) {}
        }
        return interaction.reply({ content: 'Giveaway updated!', flags: MessageFlags.Ephemeral });
      }

      if (sub === 'end') {
        const result = await endGiveaway(interaction.options.getString('giveaway_id'), client, interaction.guild.id);
        if (!result.ok) return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: 'Giveaway ended!', flags: MessageFlags.Ephemeral });
      }

      if (sub === 'list') {
        const active = await Giveaway.find({ guildId: interaction.guild.id, hasEnded: false }).sort({ endTime: 1 }).limit(10);
        if (!active.length) return interaction.reply({ content: 'No active giveaways.', flags: MessageFlags.Ephemeral });
        const embed = new EmbedBuilder().setTitle('Active Giveaways').setColor('#53FF6C')
          .setDescription(active.map((g, i) => (i + 1) + '. `' + g.giveawayId + '` - **' + g.prize + '** - ends <t:' + Math.floor(new Date(g.endTime) / 1000) + ':R>').join('\n'));
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

    } catch (err) {
      console.error('[Giveaway Command]', err);
      const fn = (interaction.replied || interaction.deferred) ? interaction.followUp.bind(interaction) : interaction.reply.bind(interaction);
      fn({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
    }
  },
};

module.exports.endGiveaway      = endGiveaway;
module.exports.buildActiveEmbed = buildEmbed;
module.exports.buildEntryRow    = buildRow;
module.exports.pickWinners      = pick;