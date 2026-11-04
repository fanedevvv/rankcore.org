'use strict';
/**
 * /music-panel — Simplified music control (item 16)
 * ─────────────────────────────────────────────────────────────────────────────
 * A single command that plays a song AND shows an interactive button control
 * panel, so users never have to memorise subcommand names for basic operations.
 *
 * Buttons: <:n_music:1555544516746940416> Skip-back  <:n_music:1555544516746940416>/<:n_music:1555544516746940416> Pause/Resume  <:n_music:1555544516746940416> Skip  <:n_music:1555544516746940416> Stop  <:n_music:1555544516746940416> Shuffle  <:n_music:1555544516746940416> Loop
 *
 * The full /music command still exists for advanced control (volume, forward,
 * backward, 24/7, etc.). This is the "quick access" layer on top.
 */

const {
  SlashCommandBuilder, MessageFlags, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { parseEmoji } = require('../../Utils/emojis');
const formatDuration = require('../../Utils/formatDuration');

// ── Build the control panel embed + rows ──────────────────────────────────────
function buildPanel(player, track, paused) {
  const bar = buildProgressBar(player);
  const embed = new EmbedBuilder()
    .setColor(0x6C53FF)
    .setTitle('<:n_music:1555544516746940416> Now Playing')
    .setDescription(`**[${track.title}](${track.uri})**\n${track.author ? `by ${track.author}` : ''}`)
    .addFields(
      { name: 'Progress', value: bar, inline: false },
      { name: 'Volume',   value: `${player.volume ?? 100}%`,          inline: true },
      { name: 'Loop',     value: loopLabel(player.trackRepeat, player.queueRepeat), inline: true },
      { name: 'Queue',    value: `${player.queue?.length ?? 0} track(s) remaining`, inline: true },
    )
    .setThumbnail(track.thumbnail ?? null)
    .setFooter({ text: `Requested by ${track.requester?.username ?? 'Unknown'}` });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mp_replay').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mp_pauseresume').setEmoji(paused ? parseEmoji('<:n_music:1555544516746940416>') : parseEmoji('<:n_music:1555544516746940416>')).setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('mp_skip').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mp_stop').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mp_shuffle').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary).setLabel('Shuffle'),
    new ButtonBuilder().setCustomId('mp_loop').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary).setLabel('Loop'),
    new ButtonBuilder().setCustomId('mp_queue').setEmoji(parseEmoji('<:files:1555544445565407352>')).setStyle(ButtonStyle.Secondary).setLabel('Queue'),
    new ButtonBuilder().setCustomId('mp_vol_down').setLabel('Vol -').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mp_vol_up').setLabel('Vol +').setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [row1, row2] };
}

function loopLabel(track, queue) {
  if (track)  return '<:n_music:1555544516746940416> Track';
  if (queue)  return '<:n_music:1555544516746940416> Queue';
  return '<:arrow:1555544351118196810> Off';
}

function buildProgressBar(player) {
  try {
    const pos   = player.position  ?? 0;
    const total = player.queue?.current?.duration ?? 1;
    const pct   = Math.min(pos / total, 1);
    const BAR   = 20;
    const filled = Math.round(pct * BAR);
    const bar = '█'.repeat(filled) + '░'.repeat(BAR - filled);
    const fmt = (ms) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      return h > 0 ? `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}` : `${m}:${String(s % 60).padStart(2,'0')}`;
    };
    return `\`${fmt(pos)}\` ${bar} \`${fmt(total)}\``;
  } catch { return '`──────────────────────`'; }
}

// ── Command definition ────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song and open the music control panel. <:n_music:1555544516746940416>')
    .setDMPermission(false)
    .addStringOption(o => o
      .setName('song')
      .setDescription('Song name or URL to play.')
      .setRequired(true)
    ),

  async execute(interaction, client) {
    const query   = interaction.options.getString('song');
    const member  = interaction.member;
    const vc      = member.voice?.channel;

    if (!vc) {
      return interaction.reply({ content: '<:crossy:1555544390221562048> Join a voice channel first!', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    // ── Search & play ─────────────────────────────────────────────────────────
    let player;
    try {
      player = client.manager.create({
        guild:     interaction.guild.id,
        voiceChannel: vc.id,
        textChannel:  interaction.channel.id,
        selfDeafen:   true,
      });

      if (player.state !== 'CONNECTED') player.connect();

      const res = await client.manager.search(query, interaction.user);

      if (!res || res.loadType === 'LOAD_FAILED') {
        return interaction.editReply({ content: '<:crossy:1555544390221562048> Failed to find that song. Try a different search or URL.' });
      }
      if (res.loadType === 'NO_MATCHES') {
        return interaction.editReply({ content: '<:crossy:1555544390221562048> No results found. Try a more specific search.' });
      }

      if (res.loadType === 'PLAYLIST_LOADED') {
        player.queue.add(res.tracks);
        await interaction.editReply({
          content: `<a:tickyy:1555544712687915008> Added playlist **${res.playlist?.name}** (${res.tracks.length} tracks) to the queue.`,
        });
        if (!player.playing && !player.paused) player.play();
        return;
      }

      const track = res.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused) player.play();

    } catch (err) {
      console.error('[/play]', err);
      return interaction.editReply({ content: '<:crossy:1555544390221562048> Something went wrong starting playback.' });
    }

    // ── Show control panel ────────────────────────────────────────────────────
    const track  = player.queue.current ?? player.queue[0];
    if (!track) {
      return interaction.editReply({ content: '<a:tickyy:1555544712687915008> Song queued!' });
    }

    const { embed, rows } = buildPanel(player, track, player.paused);
    const msg = await interaction.editReply({ embeds: [embed], components: rows });

    // ── Button collector ──────────────────────────────────────────────────────
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.member?.voice?.channelId === vc.id,
      time:   10 * 60_000, // 10 minutes
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate().catch(() => {});
      const p = client.manager.players.get(interaction.guild.id);
      if (!p) { collector.stop(); return; }

      switch (btn.customId) {
        case 'mp_pauseresume': p.paused ? p.pause(false) : p.pause(true); break;
        case 'mp_skip':        p.stop(); break;
        case 'mp_replay':      p.seek(0); break;
        case 'mp_stop':        p.destroy(); collector.stop('stopped'); break;
        case 'mp_shuffle':     p.queue.shuffle(); break;
        case 'mp_loop': {
          if (!p.trackRepeat && !p.queueRepeat) { p.setTrackRepeat(true); p.setQueueRepeat(false); }
          else if (p.trackRepeat) { p.setTrackRepeat(false); p.setQueueRepeat(true); }
          else { p.setQueueRepeat(false); }
          break;
        }
        case 'mp_vol_down': {
          const newVol = Math.max((p.volume ?? 100) - 10, 10);
          p.setVolume(newVol);
          break;
        }
        case 'mp_vol_up': {
          const newVol = Math.min((p.volume ?? 100) + 10, 150);
          p.setVolume(newVol);
          break;
        }
        case 'mp_queue': {
          const qList = p.queue.slice(0, 10).map((t, i) => `**${i+1}.** ${t.title}`).join('\n') || 'Queue is empty.';
          await btn.followUp({ embeds: [new EmbedBuilder().setColor(0x6C53FF).setTitle('<:files:1555544445565407352> Queue').setDescription(qList)], flags: MessageFlags.Ephemeral });
          return;
        }
      }

      if (btn.customId === 'mp_stop') return;

      // Update the panel
      const ct = p.queue?.current;
      if (!ct) return;
      const { embed: newEmbed, rows: newRows } = buildPanel(p, ct, p.paused);
      await interaction.editReply({ embeds: [newEmbed], components: newRows }).catch(() => {});
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'stopped') {
        // Disable all buttons when panel expires
        rows.forEach(r => r.components.forEach(b => b.setDisabled(true)));
        interaction.editReply({ components: rows }).catch(() => {});
      }
    });
  },
};
