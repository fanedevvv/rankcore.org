const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, SlashCommandBuilder } = require("discord.js");
const { parseEmoji } = require('../../Utils/emojis');
const db = require("../../Schemas/Playlist.js");
const ms = require("ms");
const lodash = require("lodash");
const Playlist = require("../../Schemas/Playlist.js");
const { KazagumoTrack } = require("kazagumo");

module.exports = {
    data: new SlashCommandBuilder()
      .setName(`playlist`)
      .setDescription(`Subcommands for playlist commands!`)
      .addSubcommand((command) =>
        command
          .setName(`create`)
          .setDescription(`Creates a new playlist.`)
          .addStringOption(option =>
            option.setName("name")
                .setDescription("The name of the playlist")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`delete`)
          .setDescription(`Deletes a playlist.`)
          .addStringOption(option =>
            option.setName("name")
                .setDescription("The name of the playlist to delete")
                .setRequired(true)
        ),
    )
    .addSubcommand((command) =>
        command
          .setName(`addcurrent`)
          .setDescription(`Saves the current song to the specified playlist.`)
          .addStringOption(option =>
            option.setName("playlist_name")
                .setDescription("The name of the playlist to add the current song to.")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`addqueue`)
          .setDescription(`Saves the current queue to the specified playlist.`)
          .addStringOption(option =>
            option.setName("playlist_name")
                .setDescription("The name of the playlist to save the current queue to.")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`addtrack`)
          .setDescription("Searches for a track and adds it to your playlist.")
        .addStringOption(option =>
            option.setName("playlist_name")
                .setDescription("The name of the playlist.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("track_name")
                .setDescription("The name of the track to search for.")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`info`)
          .setDescription("Gives you the information of a playlist.")
        .addStringOption(option =>
            option.setName("playlist_name")
                .setDescription("The name of the playlist to get information about.")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`list`)
          .setDescription("Gives you the list of your playlists."),
      )
      .addSubcommand((command) =>
        command
          .setName(`load`)
          .setDescription("Loads all songs of a playlist to the queue.")
        .addStringOption(option =>
            option.setName("playlist_name")
                .setDescription("The name of the playlist to load.")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`rename`)
          .setDescription("Renames an existing playlist.")
        .addStringOption(option =>
            option.setName("old_name")
                .setDescription("The current name of the playlist.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("new_name")
                .setDescription("The new name for the playlist.")
                .setRequired(true)
        ),
      )
      .addSubcommand((command) =>
        command
          .setName(`removetrack`)
          .setDescription("Removes a track from a playlist.")
        .addStringOption(option =>
            option.setName("playlist_name")
                .setDescription("The name of the playlist.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("track_number")
                .setDescription("The track number to remove.")
                .setRequired(true)
        ),
      ),
      async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        // Playlist Create
        switch (sub) {
            case "create":
                const Name = interaction.options.getString("name");

        if (Name.length > 10) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription("Playlist Name Can't Be Greater Than `10` Characters"),
                ],
                ephemeral: true
            });
        }

        let data = await db.find({
            UserId: interaction.user.id,
            PlaylistName: Name,
        });

        if (data.length > 0) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`This playlist already exists! Delete it using: \`/playlist-delete ${Name}\``),
                ],
                ephemeral: true
            });
        }

        let userData = await db.find({
            UserId: interaction.user.id,
        });

        if (userData.length >= 10) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription("You Can Only Create `10` Playlists"),
                ],
                ephemeral: true
            });
        }

        const newData = new db({
            Username: interaction.user.tag,
            UserId: interaction.user.id,
            PlaylistName: Name,
            Playlist: [],
            CreatedOn: Math.round(Date.now() / 1000),
        });
        await newData.save();

        
        const embed = new EmbedBuilder()
            .setDescription(`Successfully created a playlist for you **${Name}**`)
            .setColor(client.config.embed);

        return interaction.reply({ embeds: [embed] });
          }

          // Playlist delete
          switch (sub) {
            case "delete":
                const Name = interaction.options.getString("name");

        const data = await db.findOne({
            UserId: interaction.user.id,
            PlaylistName: Name,
        });

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`You don't have a playlist with the name **${Name}**`),
                ],
                ephemeral: true
            });
        }

        await data.delete();

        const embed = new EmbedBuilder()
            .setColor(client.config.embed)
            .setDescription(`Successfully deleted the playlist **${Name}**`);

        return interaction.reply({ embeds: [embed] });
          }

          switch (sub) {
            case "addcurrent":
                const Name = interaction.options.getString("playlist_name");
        const data = await Playlist.findOne({ UserId: interaction.user.id, PlaylistName: Name });
        const player = client.manager.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            let embed = new EmbedBuilder()
                .setColor(client.config.embed)
                .setDescription("There is no music playing.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`<:n_cross:1567796987481296986> | You don't have any Playlist named **${Name}**.`)
                ],
                ephemeral: true
            });
        }

        const song = player.queue.current;
        let oldSong = data.Playlist;
        if (!Array.isArray(oldSong)) oldSong = [];

        const songExists = oldSong.some(existingSong => existingSong.uri === song.uri);
        if (songExists) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`The song **${song.title}** is already in the playlist **${Name}**.`)
                ],
                ephemeral: true
            });
        }

        oldSong.push({
            "title": song.title,
            "uri": song.uri,
            "author": song.author,
            "duration": song.duration
        });

        await Playlist.updateOne(
            { UserId: interaction.user.id, PlaylistName: Name },
            { $set: { Playlist: oldSong } }
        );

        const embed = new EmbedBuilder()
            .setColor("#2F3136")
            .setAuthor({
                name: `Added Song To Playlist ${Name}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                url: "https://discord.gg/a9Kea3ymC7"
            })
            .setDescription(`<:n_spotify:1567796995836477501> [${song.title.substring(0, 63)}](${song.uri})`);
        
        return interaction.reply({ embeds: [embed] });
          }

          switch (sub) {
            case "addqueue":
                const Name = interaction.options.getString("playlist_name");
        const player = client.manager.players.get(interaction.guildId);

        if (!player || !player.queue.current) {
            let embed = new EmbedBuilder()
                .setColor(client.config.embed)
                .setDescription("There is no music playing.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const data = await Playlist.findOne({ UserId: interaction.user.id, PlaylistName: Name });
        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`<:n_cross:1567796987481296986> | You don't have any Playlist named **${Name}**.`)
                ],
                ephemeral: true
            });
        }

        const currentSong = player.queue.current;
        const tracks = player.queue;

        let oldSongs = data.Playlist;
        if (!Array.isArray(oldSongs)) oldSongs = [];

        const newSongs = [];
        const existingUris = oldSongs.map(song => song.uri);
        const ignoredSongs = [];

        if (!existingUris.includes(currentSong.uri)) {
            newSongs.push({
                title: currentSong.title,
                uri: currentSong.uri,
                author: currentSong.author,
                duration: currentSong.duration,
            });
        } else {
            ignoredSongs.push(currentSong.title);
        }

        for (const track of tracks) {
            if (!existingUris.includes(track.uri)) {
                newSongs.push({
                    title: track.title,
                    uri: track.uri,
                    author: track.author,
                    duration: track.duration,
                });
            } else {
                ignoredSongs.push(track.title);
            }
        }

        const updatedPlaylist = oldSongs.concat(newSongs);

        await Playlist.updateOne(
            { UserId: interaction.user.id, PlaylistName: Name },
            { $set: { Playlist: updatedPlaylist } }
        );

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `Added Queue To Playlist ${Name}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                url: "https://discord.gg/a9Kea3ymC7"
            })
            .setColor(client.config.embed);

        embed.setDescription(`<:n_spotify:1567796995836477501> **Total Tracks Added: ${newSongs.length}**`);

        if (newSongs.length > 0) {
            const addedSongsList = newSongs.map((song, index) => `${index + 1}. ${song.title}`).join("\n");
            embed.addFields({
                name: "Added Songs",
                value: addedSongsList,
                inline: false
            });
        }

        if (ignoredSongs.length > 0) {
            const ignoredSongsList = ignoredSongs.map((song, index) => `${index + 1}. ${song}`).join("\n");
            embed.addFields({
                name: "Ignored Songs",
                value: ignoredSongsList,
                inline: false
            });
            embed.setFooter({ text: "Reason: Already exists in the playlist." });
        }

        return interaction.reply({ embeds: [embed] });
          }

          switch (sub) {
            case "addtrack":
                const playlistName = interaction.options.getString("playlist_name");
        const trackName = interaction.options.getString("track_name");

        const searchResult = await client.manager.search(trackName, { requester: interaction.user });

        if (searchResult.loadType === "NO_MATCHES") {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription("No tracks found for your search.")
                ]
            });
        }

        /*
true
624022
f34r
58427
186070
1752838856
e5732f870d366f8ef24a9603c455d66d
*/

        const tracks = searchResult.tracks.slice(0, 5);
        const embed = new EmbedBuilder()
            .setColor(client.config.embed)
            .setTitle(`Select a track to add to **${playlistName}**:`)
            .setDescription(tracks.map((track, index) => `**${index + 1}**: [${track.title}](${track.uri})`).join("\n"));

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        for (const emoji of emojis.slice(0, tracks.length)) {
            await message.react(emoji);
        }

        const filter = (reaction, user) => {
            return emojis.includes(reaction.emoji.name) && user.id === interaction.user.id;
        };

        const collector = message.createReactionCollector({ filter, max: 1, time: 30000 });

        collector.on('collect', async (reaction) => {
            const index = emojis.indexOf(reaction.emoji.name);
            const selectedTrack = tracks[index];

            const data = await db.findOne({ UserId: interaction.user.id, PlaylistName: playlistName });

            if (!data) {
                return interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(client.config.embed)
                            .setDescription(`You don't have a playlist named **${playlistName}**.`)
                    ]
                });
            }

            await db.updateOne(
                { UserId: interaction.user.id, PlaylistName: playlistName },
                { $addToSet: { Playlist: selectedTrack } }
            );

            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`Added [${selectedTrack.title}](${selectedTrack.uri}) to **${playlistName}**!`)
                ]
            });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(client.config.embed)
                            .setDescription("You did not select a track in time.")
                    ]
                });
            }
        });
          }

          switch (sub) {
            case "info":
                const Name = interaction.options.getString("playlist_name");
        const data = await db.findOne({
            UserId: interaction.user.id,
            PlaylistName: Name,
        });

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`You don't have a playlist with **${Name}** name`),
                ],
                ephemeral: true
            });
        }

        let tracks = data.Playlist.map((x, i) =>
            `\`${i + 1}\` - ${x.title && x.uri ? `[${x.title}](${x.uri})` : `${x.title}`}${x.duration ? ` - \`${ms(Number(x.duration))}\`` : ""}`
        );

        let pname = data.PlaylistName;
        let plist = data.Playlist.length;

        const pages = lodash.chunk(tracks, 10).map((x) => x.join("\n"));
        let page = 0;

        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Playlists`)
            .setColor(client.config.embed)
            .setDescription(`**Playlist Name**: ${pname} **Total Tracks**: \`${plist}\`\n\n${pages[page]}`);

        if (pages.length <= 1) {
            return await interaction.reply({ embeds: [embed] });
        } else {
            let previousButton = new ButtonBuilder()
                .setCustomId("Previous")
                .setEmoji(parseEmoji("<:n_music:1567796993403658261>"))
                .setStyle(ButtonStyle.Secondary);

            let nextButton = new ButtonBuilder()
                .setCustomId("Next")
                .setEmoji(parseEmoji("<:n_music:1567796993403658261>"))
                .setStyle(ButtonStyle.Secondary);

            let stopButton = new ButtonBuilder()
                .setCustomId("Stop")
                .setEmoji(parseEmoji("<:n_music:1567796993403658261>"))
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(previousButton, stopButton, nextButton);

            const m = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = m.createMessageComponentCollector({
                filter: (b) => b.user.id === interaction.user.id,
                time: 60000 * 5,
                idle: (60000 * 5) / 2,
            });

            collector.on("end", async () => {
                if (!m) return;
                await m.edit({
                    components: [
                        new ActionRowBuilder().addComponents(
                            previousButton.setDisabled(true),
                            stopButton.setDisabled(true),
                            nextButton.setDisabled(true),
                        ),
                    ],
                });
            });

            collector.on("collect", async (b) => {
                if (!b.deferred) await b.deferUpdate().catch(() => {});
                if (b.customId === "Previous") {
                    page = page - 1 < 0 ? pages.length - 1 : --page;
                } else if (b.customId === "Stop") {
                    return collector.stop();
                } else if (b.customId === "Next") {
                    page = page + 1 >= pages.length ? 0 : ++page;
                }

                if (!m) return;

                embed.setDescription(`**Playlist Name**: ${pname} **Total Tracks**: \`${plist}\`\n\n${pages[page]}`);
                return await m.edit({ embeds: [embed] });
            });
        }
          }
          switch (sub) {
            case "list":
                let data = await db.find({ UserId: interaction.user.id });

        if (!data.length) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription("You do not have any playlists."),
                ],
                ephemeral: true
            });
        }

        let list = data.map(
            (x, i) =>
                `\`${++i}\` - ${x.PlaylistName} \`${x.Playlist.length}\` - <t:${x.CreatedOn}>`
        );

        const pages = lodash.chunk(list, 10).map((x) => x.join("\n"));
        let page = 0;
        let List = list.length;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${interaction.user.username}'s Playlists`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setDescription(pages[page])
            .setFooter({ text: `Playlists (${List} total)` })
            .setColor(client.config.embed);

        return await interaction.reply({ embeds: [embed] });
          }

          switch (sub) {
            case "load":
                const Name = interaction.options.getString("playlist_name");
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription("You need to be in a voice channel to load a playlist.")
                ],
                ephemeral: true
            });
        }

        const player = await client.manager.createPlayer({
            guildId: interaction.guild.id,
            textId: interaction.channel.id,
            voiceId: channel.id,
            volume: 100,
            deaf: true
        });

        const data = await db.findOne({
            UserId: interaction.user.id,
            PlaylistName: Name,
        });

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`You don't have a playlist named **${Name}**.`)
                ],
                ephemeral: true
            });
        }

        let count = 0;
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(client.config.embed)
                    .setDescription(`Started loading **${data.Playlist.length}** tracks from Playlist **${Name}**`)
            ],
        });

        try {
            for (const track of data.Playlist) {
                const searchResult = await player.search(track.uri ? track.uri : track.title, { requester: interaction.user });

                if (searchResult.tracks.length > 0) {
                    const kazagumoTrack = new KazagumoTrack(searchResult.tracks[0].getRaw(), interaction.user);
                    player.queue.add(kazagumoTrack);
                    count++;
                } else {
                    console.warn(`Track not loaded: ${track.uri ? track.uri : track.title}, Load Type: ${searchResult.loadType}`);
                }
            }
        } catch (err) {
            console.error("Error loading tracks:", err);
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`An error occurred while loading tracks from Playlist **${Name}**.`)
                ],
            });
        }

        if (count <= 0) {
            player.destroy();
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`Can't load tracks from Playlist **${Name}**`)
                ],
            });
        }

/*
%%__BUILTBYBIT__%%
%%__USER__%%
%%__USERNAME__%%
%%__RESOURCE__%%
%%__VERSION__%%
%%__TIMESTAMP__%%
%%__NONCE__%%
*/

        if (!player.playing && player.queue.size) player.play();

        return await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(client.config.embed)
                    .setDescription(`Successfully loaded **${count}** tracks from Playlist **${Name}**`)
            ],
        });
          }

          switch (sub) {
            case "rename":
                const oldName = interaction.options.getString("old_name");
        const newName = interaction.options.getString("new_name");

        const data = await db.findOne({ UserId: interaction.user.id, PlaylistName: oldName });

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`You don't have a playlist named **${oldName}**.`)
                ]
            });
        }

        await db.updateOne(
            { UserId: interaction.user.id, PlaylistName: oldName },
            { $set: { PlaylistName: newName } }
        );

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(client.config.embed)
                    .setDescription(`Successfully renamed the playlist from **${oldName}** to **${newName}**!`)
            ]
        });
          }

          switch (sub) {
            case "removetrack":
                const Name = interaction.options.getString("playlist_name");
        const trackNumber = interaction.options.getInteger("track_number") - 1; // Convert to zero-based index

        const data = await db.findOne({ UserId: interaction.user.id, PlaylistName: Name });

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.config.embed)
                        .setDescription(`<:n_cross:1567796987481296986> | You don't have any playlist named **${Name}**.`)
                ]
            });
        }

        let tracks = data.Playlist;
        if (trackNumber >= tracks.length || trackNumber < 0) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#2F3136")
                        .setDescription(`<:n_cross:1567796987481296986> | Invalid track number provided for playlist ${Name}.`)
                ]
            });
        }

        await db.updateOne(
            { UserId: interaction.user.id, PlaylistName: Name },
            { $pull: { Playlist: tracks[trackNumber] } }
        );

        const embed = new EmbedBuilder()
            .setColor(client.config.embed)
            .setAuthor({
                name: `Removed Song From Playlist ${Name}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                url: "https://discord.gg/a9Kea3ymC7"
            })
            .setDescription(`<:n_spotify:1567796995836477501> [${tracks[trackNumber].title.substring(0, 63)}](${tracks[trackNumber].uri})`);

        return interaction.channel.send({ embeds: [embed] });
          }
      }
}