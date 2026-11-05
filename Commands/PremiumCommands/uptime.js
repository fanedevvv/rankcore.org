const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const uptimeSchema = require('../../Schemas/uptimeSchema');
const { URL } = require('url');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Advanced uptime monitor')
    .addSubcommand(s => s.setName('add').setDescription('Add a URL to monitor')
      .addStringOption(o => o.setName('url').setDescription('URL to monitor').setRequired(true))
      .addIntegerOption(o => o.setName('interval').setDescription('Interval in minutes (1-60)'))
      .addStringOption(o => o.setName('name').setDescription('Friendly name')))
    .addSubcommand(s => s.setName('delete').setDescription('Remove a monitored URL')
      .addStringOption(o => o.setName('url').setDescription('URL to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List monitored URLs'))
    .addSubcommand(s => s.setName('info').setDescription('Get detailed info for a URL')
      .addStringOption(o => o.setName('url').setDescription('URL to inspect').setRequired(true)))
    .addSubcommand(s => s.setName('resetstats').setDescription('Reset stats for a URL')
      .addStringOption(o => o.setName('url').setDescription('URL to reset').setRequired(true)))
      .addSubcommand(s =>
  s.setName('setchannel')
   .setDescription('Set or clear alert channel (admin only)')
   .addStringOption(o =>
     o.setName('url').setDescription('URL').setRequired(true)
   )
   .addChannelOption(o =>
     o.setName('channel').setDescription('Channel for alerts (omit to disable)')
   )
)
    .addSubcommand(s => s.setName('setalert').setDescription('Toggle DM alerts for a URL')
      .addStringOption(o => o.setName('url').setDescription('URL to toggle alerts').setRequired(true))),
  

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const validateUrl = (u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    const formatUrl = (u) => `<${u}>`; // full URL visible & clickable

    if (sub === 'add') {
      const url = interaction.options.getString('url').trim();
      const interval = interaction.options.getInteger('interval') || 5;
      const name = interaction.options.getString('name') || '';

      if (!validateUrl(url)) return interaction.reply({ content: '<:error:1567796968758050868> Provide a valid URL starting with http:// or https://', ephemeral: true });
      if (interval < 1 || interval > 60) return interaction.reply({ content: '<:error:1567796968758050868> Interval must be between 1 and 60 minutes.', ephemeral: true });

      const exists = await uptimeSchema.findOne({ Guild: guildId, URL: url });
      if (exists) return interaction.reply({ content: '<:error:1567796968758050868> This URL is already being monitored in this guild.', ephemeral: true });

      await uptimeSchema.create({
        Guild: guildId,
        User: userId,
        URL: url,
        Name: name,
        Interval: interval,
        AlertDM: true
      });

      const embed = new EmbedBuilder()
        .setColor('#00ff99')
        .setTitle('<a:tickyy:1567797045253644368> Monitor Added')
        .setDescription(`${name ? `**${name}** — ` : ''}${formatUrl(url)}`)
        .addFields(
          { name: 'Interval', value: `${interval} minutes`, inline: true },
          { name: 'DM Alerts', value: '<a:tickyy:1567797045253644368> Enabled', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'delete') {
      const url = interaction.options.getString('url').trim();
      const data = await uptimeSchema.findOneAndDelete({ Guild: guildId, URL: url });
      if (!data) return interaction.reply({ content: '<:error:1567796968758050868> No such monitored URL found.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor('#ff5555')
        .setTitle('<:del:1567796961334267974> Monitor Removed')
        .setDescription(`${formatUrl(url)} has been removed from monitoring.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'list') {
      const list = await uptimeSchema.find({ Guild: guildId });
      if (!list.length) return interaction.reply({ content: '<:error:1567796968758050868> No monitored links in this guild.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor('#00aaff')
        .setTitle('<:1430986225493479485:1567796921681055824> Uptime Dashboard')
        .setDescription(`Total monitored: **${list.length}**`)
        .setTimestamp();

      for (const doc of list.slice(0, 25)) {
        const name = doc.Name || doc.URL;
        const status = doc.LastStatus === 'online' ? '<:LEgreen:1567796933307666515> Online' : '<:LEred:1567796934545121280> Offline';
        const avg = doc.RecentPings.length ? `${Math.round(doc.RecentPings.reduce((a, b) => a + b.response, 0) / doc.RecentPings.length)}ms` : '—';
        const uptime = doc.TotalPings ? `${Math.round(doc.UptimePercent)}%` : '—';
        const alert = doc.AlertDM ? '<a:tickyy:1567797045253644368>' : '<:crossy:1567796959648030831>';

        embed.addFields({
          name: `${name}`,
          value: `${status} • Avg: ${avg} • Uptime: ${uptime} • Alerts: ${alert}\n${formatUrl(doc.URL)}`,
          inline: false
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: false });
    }
    if (sub === 'setchannel') {
  if (!interaction.memberPermissions.has('Administrator')) {
    return interaction.reply({ content: '<:crossy:1567796959648030831> Admin only.', ephemeral: true });
  }

  const url = interaction.options.getString('url').trim();
  const channel = interaction.options.getChannel('channel');

  const doc = await uptimeSchema.findOne({ Guild: guildId, URL: url });
  if (!doc) return interaction.reply({ content: '<:error:1567796968758050868> URL not found.', ephemeral: true });

  if (!channel) {
    doc.AlertChannel = null;
    await doc.save();
    return interaction.reply({
      content: `<:announcement:1567796950265241662> Channel alerts disabled for ${formatUrl(url)}`,
      ephemeral: true
    });
  }

  doc.AlertChannel = channel.id;
  doc.AlertDM = false; // channel takes priority
  await doc.save();

  return interaction.reply({
    content: `<:announcement:1567796950265241662> Alerts for ${formatUrl(url)} will be sent in ${channel}`,
    ephemeral: true
  });
}

    if (sub === 'info') {
      const url = interaction.options.getString('url').trim();
      const doc = await uptimeSchema.findOne({ Guild: guildId, URL: url });
      if (!doc) return interaction.reply({ content: '<:error:1567796968758050868> URL not found.', ephemeral: true });

      const recent = doc.RecentPings.slice(-10).reverse()
        .map(r => `${r.status === 'online' ? '<:LEgreen:1567796933307666515>' : '<:LEred:1567796934545121280>'} ${r.response}ms — ${new Date(r.time).toLocaleString()}`)
        .join('\n') || 'No pings yet';

      const embed = new EmbedBuilder()
        .setColor('#00aaff')
        .setTitle(`<:n_info:1567796991419744417> Info — ${doc.Name || doc.URL}`)
        .addFields(
          { name: 'URL', value: formatUrl(doc.URL), inline: true },
          { name: 'Status', value: `${doc.LastStatus === 'online' ? '<:LEgreen:1567796933307666515> Online' : '<:LEred:1567796934545121280> Offline'}`, inline: true },
          { name: 'Interval', value: `${doc.Interval} min`, inline: true },
          { name: 'Uptime %', value: `${doc.TotalPings ? Math.round(doc.UptimePercent) : '—'}%`, inline: true },
          { name: 'Total Pings', value: `${doc.TotalPings}`, inline: true },
          { name: 'Failed Pings', value: `${doc.FailedPings}`, inline: true },
          { name: 'DM Alerts', value: `${doc.AlertDM ? '<a:tickyy:1567797045253644368> Enabled' : '<:crossy:1567796959648030831> Disabled'}`, inline: true },
          { name: 'Recent Pings', value: recent, inline: false },
          { 
  name: 'Alert Channel',
  value: doc.AlertChannel ? `<#${doc.AlertChannel}>` : '—',
  inline: true
}
        )
        .setFooter({ text: `Monitored by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'resetstats') {
      const url = interaction.options.getString('url').trim();
      const doc = await uptimeSchema.findOne({ Guild: guildId, URL: url });
      if (!doc) return interaction.reply({ content: '<:error:1567796968758050868> URL not found.', ephemeral: true });

      doc.TotalPings = 0;
      doc.FailedPings = 0;
      doc.UptimePercent = 100;
      doc.RecentPings = [];
      await doc.save();

      return interaction.reply({ content: `<a:tickyy:1567797045253644368> Stats for ${formatUrl(url)} have been reset.`, ephemeral: true });
    }

    if (sub === 'setalert') {
      const url = interaction.options.getString('url').trim();
      const doc = await uptimeSchema.findOne({ Guild: guildId, URL: url });
      if (!doc) return interaction.reply({ content: '<:error:1567796968758050868> URL not found.', ephemeral: true });

      doc.AlertDM = !doc.AlertDM;
      await doc.save();

      return interaction.reply({ content: `<:announcement:1567796950265241662> DM alerts ${doc.AlertDM ? 'enabled' : 'disabled'} for ${formatUrl(url)}`, ephemeral: true });
    }
  }
};
