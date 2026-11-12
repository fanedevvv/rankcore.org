'use strict';

/**
 * /player — Simplified music control panel (item 16)
 *
 * Instead of separate subcommands for every action, this shows an
 * interactive button panel after playing so users don't need to
 * memorise every subcommand. /music play still works as before.
 *
 * Usage:
 *   /player play <song>   — play + open control panel
 *   /player               — open control panel for current session
 */

const {
  SlashCommandBuilder, MessageFlags, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField,
} = require('discord.js');
const { parseEmoji } = require('../../Utils/emojis');
const { convertTime } = require('../../Utils/convertTime');
const formatDuration  = require('../../Utils/formatDuration');

// ── Helpers ───────────────────────────────────────────────────────────────────

const PANEL_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function buildPlayerEmbed(player, client) {
  const track = player.queue.current;
  if (!track) {
    return new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle('<:n_music:1567796993403658261> Music Player')
      .setDescription('Nothing is playing right now. Use `/player play <song>` to start.')
      .setFooter({ text: 'RankCore Music' });
  }

  const loopIcon = player.loop === 'track' ? '<:n_music:1567796993403658261>' : player.loop === 'queue' ? '<:n_music:1567796993403658261>' : '';
  const autoplayOn = player.data?.get?.('autoplay') ?? false;

  return new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle('<:n_music:1567796993403658261> Now Playing')
    .setDescription(`**[${track.title}](${track.uri})**\nby **${track.author}**`)
    .addFields(
      { name: '<:1430986244921495654:1567796929587576852> Duration',   value: `\`${convertTime(track.length, true)}\``, inline: true },
      { name: '<:n_music:1567796993403658261> Volume',    value: `\`${player.volume}%\``, inline: true },
      { name: '<:files:1567796970964394044> Queue',     value: `\`${player.queue.size} track(s)\``, inline: true },
      { name: '<:n_music:1567796993403658261> Loop',      value: loopIcon || '`Off`', inline: true },
      { name: '<:n_music:1567796993403658261> Autoplay',  value: autoplayOn ? '`On`' : '`Off`', inline: true },
      { name: '<:user:1567797032423264261> Requested', value: `<@${track.requester?.id ?? '0'}>`, inline: true },
    )
    .setThumbnail(track.thumbnail ?? null)
    .setFooter({ text: `${player.paused ? '<:n_music:1567796993403658261> Paused' : '<:n_music:1567796993403658261> Playing'} • RankCore Music` })
    .setTimestamp();
}

function buildControlRow(player) {
  const paused = player?.paused ?? false;
  const loop   = player?.loop ?? 'none';

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mp_prev').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mp_playpause').setEmoji(paused ? parseEmoji('<:n_music:1567796993403658261>') : parseEmoji('<:n_music:1567796993403658261>')).setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mp_skip').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mp_stop').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mp_shuffle').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mp_voldown').setLabel('-10').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mp_volup').setLabel('+10').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mp_loop').setLabel(`Loop: ${loop === 'none' ? 'Off' : loop}`).setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(loop !== 'none' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mp_autoplay').setLabel('Autoplay').setEmoji(parseEmoji('<:n_music:1567796993403658261>')).setStyle(player?.data?.get?.('autoplay') ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mp_queue').setLabel('Queue').setEmoji(parseEmoji('<:files:1567796970964394044>')).setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// ── Active panel registry (prevent duplicate panels per guild) ─────────────────
const activePanels = new Map(); // guildId => { message, collector }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('Open the RankCore music player control panel.')
    .setDMPermission(false)
    .addStringOption(o => o
      .setName('play')
      .setDescription('Song name or URL to play (optional — opens panel for current session if omitted).')
      .setRequired(false)
    ),

  async execute(interaction, client) {
    const search  = interaction.options.getString('play');
    const guildId = interaction.guild.id;

    const getPlayer = () => client.manager?.players?.get(guildId);

    // ── PLAY ──────────────────────────────────────────────────────────────────
    if (search) {
      const { channel } = interaction.member.voice;
      if (!channel) return interaction.reply({ content: '<:n_music:1567796993403658261> **Join a voice channel first!**', flags: MessageFlags.Ephemeral });
      if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.Connect)) {
        return interaction.reply({ content: '<:lockk:1567796977809367122> **I can\'t join your voice channel — missing Connect permission.**', flags: MessageFlags.Ephemeral });
      }

      await interaction.reply({ content: `<:n_search:1567796994792230953> Searching for \`${search}\`…` });

      let player;
      try {
        player = await client.manager.createPlayer({
          guildId,
          textId:  interaction.channel.id,
          voiceId: channel.id,
          volume:  100,
          deaf:    true,
        });
      } catch (err) {
        console.error('[player] createPlayer error:', err);
        return interaction.editReply({ content: '<:crossy:1567796959648030831> Could not join the voice channel. Try again.' });
      }

      const res = await player.search(search, { requester: interaction.user });
      if (!res?.tracks?.length) return interaction.editReply({ content: '<:crossy:1567796959648030831> No results found.' });

      if (res.type === 'PLAYLIST') {
        for (const t of res.tracks) player.queue.add(t);
        if (!player.playing && !player.paused) player.play();
        await interaction.editReply({
          content: `<a:tickyy:1567797045253644368> **Playlist queued:** \`${res.playlistName}\` (${res.tracks.length} tracks)`,
        });
      } else {
        player.queue.add(res.tracks[0]);
        if (!player.playing && !player.paused) player.play();
        await interaction.editReply({ content: `<a:tickyy:1567797045253644368> **Queued:** \`${res.tracks[0].title}\`` });
      }

      // Small delay to let the player start
      await new Promise(r => setTimeout(r, 500));
    }

    // ── PANEL ─────────────────────────────────────────────────────────────────
    const player = getPlayer();
    if (!player) {
      return search
        ? null  // already replied above
        : interaction.reply({ content: '<:n_music:1567796993403658261> Nothing is playing right now. Use `/player play <song>` to start!', flags: MessageFlags.Ephemeral });
    }

    // Destroy old panel in this guild if exists
    const old = activePanels.get(guildId);
    if (old) {
      old.collector?.stop();
      old.message?.edit({ components: [] }).catch(() => {});
    }

    let panelMsg;
    if (search) {
      panelMsg = await interaction.followUp({ embeds: [buildPlayerEmbed(player, client)], components: buildControlRow(player) });
    } else {
      await interaction.reply({ embeds: [buildPlayerEmbed(player, client)], components: buildControlRow(player) });
      panelMsg = await interaction.fetchReply();
    }

    const collector = panelMsg.createMessageComponentCollector({
      filter: i => i.customId.startsWith('mp_'),
      time:   PANEL_TIMEOUT,
    });

    activePanels.set(guildId, { message: panelMsg, collector });

    const refreshPanel = async (btn) => {
      const p = getPlayer();
      await btn.update({
        embeds:     [buildPlayerEmbed(p, client)],
        components: p ? buildControlRow(p) : [],
      }).catch(() => {});
    };

    collector.on('collect', async (btn) => {
      const p = getPlayer();

      switch (btn.customId) {
        case 'mp_playpause':
          if (!p) break;
          p.paused ? p.pause(false) : p.pause(true);
          break;

        case 'mp_skip':
          if (!p) break;
          p.skip();
          await new Promise(r => setTimeout(r, 300));
          break;

        case 'mp_stop':
          if (!p) break;
          p.destroy();
          collector.stop();
          return btn.update({ embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('<:n_music:1567796993403658261> Music stopped.')], components: [] });

        case 'mp_shuffle':
          if (!p || p.queue.size === 0) break;
          p.queue.shuffle();
          break;

        case 'mp_prev':
          // Replay current track from start (no previous track API)
          if (!p) break;
          p.seek(0);
          break;

        case 'mp_voldown':
          if (!p) break;
          p.setVolume(Math.max(0, (p.volume ?? 100) - 10));
          break;

        case 'mp_volup':
          if (!p) break;
          p.setVolume(Math.min(100, (p.volume ?? 100) + 10));
          break;

        case 'mp_loop': {
          if (!p) break;
          const modes = ['none', 'track', 'queue'];
          const idx   = modes.indexOf(p.loop ?? 'none');
          p.setLoop(modes[(idx + 1) % modes.length]);
          break;
        }

        case 'mp_autoplay': {
          if (!p) break;
          const current = p.data?.get?.('autoplay') ?? false;
          p.data?.set?.('autoplay', !current);
          if (!current && p.queue.current) {
            p.data?.set?.('identifier', p.queue.current.identifier);
            p.data?.set?.('requester',  interaction.user);
          }
          break;
        }

        case 'mp_queue': {
          const qSize = p?.queue?.size ?? 0;
          if (!qSize) return btn.reply({ content: '<:files:1567796970964394044> The queue is empty.', flags: MessageFlags.Ephemeral });
          const lines = p.queue.slice(0, 10).map((t, i) => `**${i+1}.** ${t.title}`).join('\n');
          const more  = qSize > 10 ? `\n_…and ${qSize - 10} more_` : '';
          return btn.reply({ content: `**<:files:1567796970964394044> Queue (${qSize} tracks):**\n${lines}${more}`, flags: MessageFlags.Ephemeral });
        }
      }

      await refreshPanel(btn);
    });

    collector.on('end', () => {
      panelMsg.edit({ components: [] }).catch(() => {});
      activePanels.delete(guildId);
    });
  },
};
