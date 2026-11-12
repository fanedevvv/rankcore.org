const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const formatDuration = require("../../Utils/formatDuration");
const { convertTime } = require("../../Utils/convertTime");
const db247 = require("../../Schemas/247");

const TRACKS_PER_PAGE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("All music related commands")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("<:n_music:1567796993403658261> Play a song")
        .addStringOption((opt) => opt.setName("search").setDescription("The song to play").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("pause").setDescription("<:n_music:1567796993403658261> Pause the current song"))
    .addSubcommand((sub) => sub.setName("resume").setDescription("<:n_music:1567796993403658261> Resume the paused song"))
    .addSubcommand((sub) => sub.setName("stop").setDescription("<:n_music:1567796993403658261> Stop the music and clear the queue"))
    .addSubcommand((sub) => sub.setName("skip").setDescription("<:n_music:1567796993403658261> Skip the current song"))
    .addSubcommand((sub) =>
      sub
        .setName("volume")
        .setDescription("<:n_music:1567796993403658261> Set the volume")
        .addIntegerOption((opt) => opt.setName("volume").setDescription("The volume level (0-100)").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("nowplaying").setDescription("<:files:1567796970964394044>️ View the currently playing song"))
    .addSubcommand((sub) => sub.setName("queue").setDescription("View the music queue"))
    .addSubcommand((sub) => sub.setName("clearqueue").setDescription("<:n_add:1567796983408754731> Clear the music queue"))
    .addSubcommand((sub) => sub.setName("shuffle").setDescription("<:n_music:1567796993403658261> Shuffle the music queue"))
    .addSubcommand((sub) =>
      sub
        .setName("loop")
        .setDescription("Toggle track/queue loop")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Choose the loop mode")
            .setRequired(true)
            .addChoices(
              { name: "Track", value: "track" },
              { name: "Queue", value: "queue" },
              { name: "Off", value: "off" }
            )
        )
    )
    .addSubcommand((sub) => sub.setName("replay").setDescription("<:n_music:1567796993403658261> Replay the current song"))
    .addSubcommand((sub) =>
      sub
        .setName("forward")
        .setDescription("<:n_music:1567796993403658261> Forward the current song")
        .addIntegerOption((opt) => opt.setName("seconds").setDescription("Seconds to forward").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("backward")
        .setDescription("<:n_music:1567796993403658261> Backward the current song")
        .addIntegerOption((opt) => opt.setName("seconds").setDescription("Seconds to backward").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("autoplay").setDescription("<:n_music:1567796993403658261> Toggle autoplay for music"))
    .addSubcommand((sub) => sub.setName("247").setDescription("Toggles 24/7 mode")),


  async execute(interaction, client) {
    try {
      const sub = interaction.options.getSubcommand();

      // Helpers
      const getPlayer = () => client.manager.players.get(interaction.guild.id);

      // --- PLAY ---
      if (sub === "play") {
        const search = interaction.options.getString("search");
        const { channel } = interaction.member.voice;

        if (!channel) return interaction.reply({ content: ":no_entry_sign: **You need to be in a voice channel to play music!**", flags: MessageFlags.Ephemeral });
        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.Connect)) return interaction.reply({ content: ":lock: **I don't have permission to join your voice channel!**", flags: MessageFlags.Ephemeral });
        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.Speak)) return interaction.reply({ content: ":mute: **I don't have permission to play music in your voice channel!**", flags: MessageFlags.Ephemeral });

        await interaction.reply({ content: `Searching... \`${search}\`` });

        let player;
        try {
          player = await client.manager.createPlayer({ guildId: interaction.guild.id, textId: interaction.channel.id, voiceId: channel.id, volume: 100, deaf: true });
        } catch (err) {
          console.error('[music:play] createPlayer failed:', err);
          return interaction.editReply({ content: ':x: **Failed to join the voice channel. Please try again.**' });
        }

        const res = await player.search(search, { requester: interaction.user });

        if (!res.tracks.length) return interaction.editReply(":x: **No results found!**");

        if (res.type === "PLAYLIST") {
          for (let track of res.tracks) player.queue.add(track);
          if (!player.playing && !player.paused) player.play();

          const embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setTitle(":notes: Playlist Added")
            .setDescription(`**[${res.playlistName}](${search})** \n\n**Tracks Queued:** \`${res.tracks.length}\`\n**Total Duration:** \`${convertTime(res.tracks[0].length + player.queue.durationLength, true)}\``)
            .setFooter({ text: "Enjoy your music! :headphones:" });

          return interaction.editReply({ content: "", embeds: [embed] });
        } else {
          player.queue.add(res.tracks[0]);
          if (!player.playing && !player.paused) player.play();

          const embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setTitle(":musical_note: Track Queued")
            .setDescription(`**[${res.tracks[0].title}](${res.tracks[0].uri})** \n\n**Duration:** \`${convertTime(res.tracks[0].length, true)}\``)
            .setFooter({ text: "Playing now! :notes:" })
            .setThumbnail(res.tracks[0].thumbnail);

          return interaction.editReply({ content: `>>> ***Track Added In Queue***:\n**[${res.tracks[0].title}](<${res.tracks[0].uri}>)**`, embeds: [] });
        }
      }

      // --- PAUSE ---
      if (sub === "pause") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (player.paused) return interaction.reply({ content: ":no_entry_sign: **The song is already paused!**", flags: MessageFlags.Ephemeral });
        player.pause(true);

        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":pause_button: Song Paused").setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})** has been paused.`).setFooter({ text: "Use /music resume to resume the song! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- RESUME ---
      if (sub === "resume") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (!player.paused) return interaction.reply({ content: ":no_entry_sign: **The song is not paused!**", flags: MessageFlags.Ephemeral });
        player.pause(false);

        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":play_button: Song Resumed").setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})** has been resumed.`).setFooter({ text: "Enjoy the music! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- STOP ---
      if (sub === "stop") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        player.destroy();
        player.queue.clear();

        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":stop_button: Music Stopped").setDescription("The music has been stopped and the queue has been cleared.").setFooter({ text: "Use /music play to start playing music again! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- SKIP ---
      if (sub === "skip") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (!player.queue.current) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (player.queue.current.requester && player.queue.current.requester.id && player.queue.current.requester.id !== interaction.user.id) return interaction.reply({ content: ":no_entry_sign: **You didn't request this song, you can't skip it!**", flags: MessageFlags.Ephemeral });
        player.skip();

        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":fast_forward: Song Skipped").setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})** \n\n**Skipped by:** \`${interaction.user.username}\``).setFooter({ text: "Next song playing now! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- VOLUME ---
      if (sub === "volume") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (!player.queue.current) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });

        const volume = interaction.options.getInteger("volume");
        if (volume < 0 || volume > 100) return interaction.reply({ content: ":no_entry_sign: **Volume must be between 0 and 100!**", flags: MessageFlags.Ephemeral });
        player.setVolume(volume);

        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":speaker: Volume Set").setDescription(`**Volume set to ${volume}%**`).setFooter({ text: "Enjoy the music! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- NOW PLAYING ---
      if (sub === "nowplaying") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (!player.queue.current) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle(":musical_note: Now Playing")
          .setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})**`)
          .addFields(
            { name: "Author:", value: player.queue.current.author, inline: true },
            { name: "Source:", value: `${player.queue.current.sourceName || "unknown"}`, inline: true },
            { name: "Requested By:", value: `${player.queue.current.requester.tag}`, inline: true }
          )
          .setFooter({ text: "Enjoy the music!" });

        return interaction.reply({ embeds: [embed] });
      }

      // --- QUEUE ---
      if (sub === "queue") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (player.queue.size === 0) return interaction.reply({ content: ":no_entry_sign: **The queue is empty!**", flags: MessageFlags.Ephemeral });

        const totalTracks = player.queue.size;
        const totalPages = Math.ceil(totalTracks / TRACKS_PER_PAGE);
        let currentPage = 0;

        const createEmbed = (page) => {
          const start = page * TRACKS_PER_PAGE;
          const end = Math.min(start + TRACKS_PER_PAGE, totalTracks);
          const queue = player.queue
            .slice(start, end)
            .map((track, index) => `**${start + index + 1}.** [${track.title}](${track.uri}) - **${track.author}**`)
            .join("\n");

          return new EmbedBuilder().setColor(client.config.embedColor).setTitle("<:files:1567796970964394044> Music Queue").setDescription(queue || "No tracks in this page.").setFooter({ text: `Page ${page + 1} of ${totalPages} | Total tracks: ${totalTracks}` });
        };

        const embed = createEmbed(currentPage);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("prev").setLabel("Previous").setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
          new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(currentPage === totalPages - 1)
        );

        await interaction.reply({ embeds: [embed], components: [row] });

        const message = await interaction.fetchReply();

        const filter = (buttonInteraction) => buttonInteraction.user.id === interaction.user.id;

        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on("collect", async (buttonInteraction) => {
          if (buttonInteraction.customId === "prev") currentPage--;
          else if (buttonInteraction.customId === "next") currentPage++;

          const newEmbed = createEmbed(currentPage);
          row.components[0].setDisabled(currentPage === 0);
          row.components[1].setDisabled(currentPage === totalPages - 1);
          await buttonInteraction.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on("end", () => {
          row.components.forEach((button) => button.setDisabled(true));
          message.edit({ components: [row] }).catch(() => {});
        });

        return;
      }

      // --- CLEAR QUEUE ---
      if (sub === "clearqueue") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (player.queue.size === 0) return interaction.reply({ content: ":no_entry_sign: **The queue is already empty!**", flags: MessageFlags.Ephemeral });

        player.queue.clear();
        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":recycle: Queue Cleared").setDescription("The music queue has been cleared.").setFooter({ text: "Use /music play to start playing music again! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- SHUFFLE ---
      if (sub === "shuffle") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (player.queue.size === 0) return interaction.reply({ content: ":no_entry_sign: **The queue is empty!**", flags: MessageFlags.Ephemeral });

        player.queue.shuffle();
        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":twisted_rightwards_arrows: Queue Shuffled").setDescription("The music queue has been shuffled.").setFooter({ text: "Enjoy the music! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- LOOP ---
      if (sub === "loop") {
        const mode = interaction.options.getString("mode");
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":x: **There is no music currently playing!**", flags: MessageFlags.Ephemeral });

        const enable = ["enabled", "activated"];
        const disable = ["disabled", "deactivated"];

        let response;
        if (mode === "track") {
          if (player.loop !== "track") {
            player.setLoop("track");
            response = `Looping the current song **${enable[Math.floor(Math.random() * enable.length)]}**.`;
          } else {
            player.setLoop("none");
            response = `Looping the current song **${disable[Math.floor(Math.random() * disable.length)]}**.`;
          }
        } else if (mode === "queue") {
          if (player.loop !== "queue") {
            player.setLoop("queue");
            response = `Looping the queue **${enable[Math.floor(Math.random() * enable.length)]}**.`;
          } else {
            player.setLoop("none");
            response = `Looping the queue **${disable[Math.floor(Math.random() * disable.length)]}**.`;
          }
        } else if (mode === "off") {
          player.setLoop("none");
          response = `Looping is now **${disable[Math.floor(Math.random() * disable.length)]}**.`;
        } else {
          return interaction.reply({ content: ":x: **Please provide a valid sub command.**", flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ embeds: [new EmbedBuilder().setColor(client.config.embedColor).setDescription(response)] });
      }

      // --- REPLAY ---
      if (sub === "replay") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        if (!player.queue.current) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
        player.seek(0);

        const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":repeat: Song Replayed").setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})** has been replayed.`).setFooter({ text: "Enjoy the music! :notes:" });
        return interaction.reply({ embeds: [embed] });
      }

      // --- FORWARD ---
      if (sub === "forward") {
        try {
          const player = getPlayer();
          if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
          if (!player.queue.current) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });

          const seconds = interaction.options.getInteger("seconds");
          if (seconds < 0) return interaction.reply({ content: ":no_entry_sign: **You can't forward the song by a negative amount of time!**", flags: MessageFlags.Ephemeral });

          const position = player.position + seconds * 1000;
          if (position > player.queue.current.length) return interaction.reply({ content: ":no_entry_sign: **You can't forward the song by that much!**", flags: MessageFlags.Ephemeral });

          player.seek(position);
          const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":fast_forward: Song Forwarded").setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})** \n\n**Forwarded by:** \`${interaction.user.username}\``).setFooter({ text: `Forwarded to ${formatDuration(position, true)} :notes:` });
          return interaction.reply({ embeds: [embed] });
        } catch (err) {
          console.error(err);
          return interaction.reply(":exclamation: **An error occurred while trying to forward the song.**");
        }
      }

      // --- BACKWARD ---
      if (sub === "backward") {
        try {
          const player = getPlayer();
          if (!player) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });
          if (!player.queue.current) return interaction.reply({ content: ":no_entry_sign: **There is no song playing right now!**", flags: MessageFlags.Ephemeral });

          const seconds = interaction.options.getInteger("seconds");
          if (seconds < 0) return interaction.reply({ content: ":no_entry_sign: **You can't backward the song by a negative amount of time!**", flags: MessageFlags.Ephemeral });

          const position = player.position - seconds * 1000;
          if (position < 0) return interaction.reply({ content: ":no_entry_sign: **You can't backward the song by that much!**", flags: MessageFlags.Ephemeral });

          player.seek(position);
          const embed = new EmbedBuilder().setColor(client.config.embedColor).setTitle(":rewind: Song Backwarded").setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})** \n\n**Backwarded by:** \`${interaction.user.username}\``).setFooter({ text: `Backwarded to ${formatDuration(position, true)} :notes:` });
          return interaction.reply({ embeds: [embed] });
        } catch (err) {
          console.error(err);
          return interaction.reply(":exclamation: **An error occurred while trying to backward the song.**");
        }
      }

      // --- AUTOPLAY ---
      if (sub === "autoplay") {
        const player = getPlayer();
        if (!player) return interaction.reply({ content: ":x: **No music is currently playing.**", ephemeral: true });

        const currentSetting = player.data.get("autoplay") || false;
        const newSetting = !currentSetting;
        player.data.set("autoplay", newSetting);
        player.data.set("identifier", player.queue.current.identifier);
        player.data.set("requester", interaction.user);

        return interaction.reply({ content: newSetting ? "<:n_music:1567796993403658261> **Autoplay has been enabled.**" : "<:n_music:1567796993403658261> **Autoplay has been disabled.**", ephemeral: true });
      }

      // --- 24/7 MODE ---
      if (sub === "247") {
        const { channel } = interaction.member.voice;
        if (!channel) return interaction.reply({ content: ":no_entry_sign: **You need to be in a voice channel to toggle 24/7 mode!**", flags: MessageFlags.Ephemeral });
        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.Connect)) return interaction.reply({ content: ":lock: **I don't have permission to join your voice channel!**", flags: MessageFlags.Ephemeral });
        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.Speak)) return interaction.reply({ content: ":mute: **I don't have permission to play music in your voice channel!**", flags: MessageFlags.Ephemeral });

        let data = await db247.findOne({ _id: interaction.guild.id });
        const enable = ["enabled", "activated"];
        const disable = ["disabled", "deactivated"];

        if (!data) {
          data = new db247({ _id: interaction.guild.id, mode: true, textChannel: interaction.channel.id, voiceChannel: channel.id, moderator: interaction.user.id, lastUpdated: Math.round(Date.now() / 1000) });
          await data.save();
          const player = await client.manager.createPlayer({ guildId: interaction.guild.id, textId: interaction.channel.id, voiceId: channel.id, volume: 100, deaf: true });
          return interaction.reply({ embeds: [new EmbedBuilder().setColor("#00FF00").setDescription(`24/7 mode is now **${enable[Math.floor(Math.random() * enable.length)]}**.`)] });
        } else if (data.mode) {
          data.mode = false;
          data.moderator = interaction.user.id;
          data.lastUpdated = Math.round(Date.now() / 1000);
          await data.save();
          return interaction.reply({ embeds: [new EmbedBuilder().setColor("#FF0000").setDescription(`24/7 mode is now **${disable[Math.floor(Math.random() * disable.length)]}**.`)] });
        } else {
          data.mode = true;
          data.textChannel = interaction.channel.id;
          data.voiceChannel = channel.id;
          data.moderator = interaction.user.id;
          data.lastUpdated = Math.round(Date.now() / 1000);
          await data.save();
          const player = await client.manager.createPlayer({ guildId: interaction.guild.id, textId: interaction.channel.id, voiceId: channel.id, volume: 100, deaf: true });
          return interaction.reply({ embeds: [new EmbedBuilder().setColor("#00FF00").setDescription(`24/7 mode is now **${enable[Math.floor(Math.random() * enable.length)]}**.`)] });
        }
      }

      return interaction.reply({ content: ":x: Unknown subcommand.", flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error(error);
      return interaction.reply(":exclamation: **An error occurred while executing the music command.**");
    }
  },
};