const {
  Client,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { parseEmoji } = require('../../Utils/emojis');
const {
  TwoZeroFourEight,
  FastType,
  FindEmoji,
  Flood,
  GuessThePokemon,
  Hangman,
  MatchPairs,
  Minesweeper,
  Slots,
  Snake,
  Trivia,
  Wordle,
  WouldYouRather,
} = require("discord-gamecord");
const ms = require("ms");

// discord-gamecord only accepts embed colours as "#RRGGBB" strings, while client.config.embedColor is a number
const gameColor = (client) => '#' + (Number(client.config.embedColor) || 0x6C53FF).toString(16).padStart(6, '0');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("games-singleplayer")
    .setDescription("Play a single-player minigame within Discord. <:minigames:1567796978929238076>")
    .addStringOption((option) =>
      option
        .setName("game")
        .setDescription("*Choose a game to play.")
        .setRequired(true)
        .addChoices(
          { name: "2048", value: "2048" },
          { name: "Emoji-Quiz", value: "emojiquiz" },
          { name: "Fast-Type", value: "fasttype" },
          { name: "Find-Emoji", value: "findemoji" },
          { name: "Flood", value: "flood" },
          { name: "Guess-The-Flag", value: "guessthedlag" },
          { name: "Guess-The-Pokemon", value: "guessthepokemon" },
          { name: "Hangman", value: "hangman" },
          { name: "Match-Pairs", value: "matchpairs" },
          { name: "Minesweeper", value: "minesweeper" },
          { name: "Rock-Paper-Scissors", value: "rps" },
          { name: "Slots", value: "slots" },
          { name: "Snake", value: "snake" },
          { name: "Trivia", value: "trivia" },
          { name: "Wordle", value: "wordle" },
          { name: "Would-You-Rather", value: "wouldyourather" }
        )
    )
    .setDMPermission(false),
  /**
   * @param {Client} client
   * @param {ChatInputCommandInteraction} interaction
   */
  async execute(interaction, client) {
    const game = interaction.options.getString("game");

    switch (game) {
      case "2048":
        {
          const Game = new TwoZeroFourEight({
            message: interaction,
            slash_command: true,
            embed: {
              title: "2048",
              color: gameColor(client),
            },
            emojis: {
              up: "<:arrow:1567796951527850055>",
              down: "<:down:1567796964672929802>",
              left: "<:arrow:1567796951527850055>",
              right: "<:arrow:1567796951527850055>",
            },
            timeoutTime: 60000,
            buttonStyle: "PRIMARY",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "fasttype":
        {
          const sentences = [
            "The quick brown fox jumps over the lazy dog.",
            "Pack my box with five dozen liquor jugs.",
            "How razorback-jumping frogs can level six piqued gymnasts!",
            "Sphinx of black quartz, judge my vow.",
            "The five boxing wizards jump quickly.",
            "Jinxed wizards pluck ivy from the big quilt.",
            "Bright vixens jump; dozy fowl quack.",
            "A mad boxer shot a quick, gloved jab to the jaw of his dizzy opponent.",
            "The lazy dog barks at the quick brown fox.",
            "A big box of mixed biscuits is best.",
          ];

          const randomSentence =
            sentences[Math.floor(Math.random() * sentences.length)];

          const Game = new FastType({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Fast Type",
              color: gameColor(client),
              description: `You have {time} seconds to type the sentence below:\n\n**${randomSentence}**`,
            },
            timeoutTime: 60000,
            sentence: randomSentence,
            winMessage:
              "You won! You finished the type race in {time} seconds with wpm of {wpm}.",
            loseMessage:
              "You lost! You didn't type the correct sentence in time.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }

        break;
      case "findemoji":
        {
          const Game = new FindEmoji({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Find Emoji",
              color: gameColor(client),
              description: "Remember the emojis from the board below.",
              findDescription:
                "Find the {emoji} emoji before the time runs out.",
            },
            timeoutTime: 60000,
            hideEmojiTime: 5000,
            buttonStyle: "PRIMARY",
            emojis: ["🍉", "🍇", "🍊", "🍋", "🥭", "🍎", "🍏", "🥝"],
            winMessage: "You won! You selected the correct emoji. {emoji}",
            loseMessage: "You lost! You selected the wrong emoji. {emoji}",
            timeoutMessage:
              "You lost! You ran out of time. The emoji is {emoji}",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "flood":
        {
          const Game = new Flood({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Flood",
              color: gameColor(client),
            },
            difficulty: 13,
            timeoutTime: 60000,
            buttonStyle: "PRIMARY",
            emojis: ["🟥", "🟦", "🟧", "🟪", "🟩"],
            winMessage: "You won! You took **{turns}** turns.",
            loseMessage: "You lost! You took **{turns}** turns.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "guessthepokemon":
        {
          const Game = new GuessThePokemon({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Who's The Pokemon",
              color: gameColor(client),
            },
            timeoutTime: 60000,
            winMessage: "You guessed it right! It was a {pokemon}.",
            loseMessage: "Better luck next time! It was a {pokemon}.",
            errMessage: "Unable to fetch pokemon data! Please try again.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "hangman":
        {
          const theme = [
            "nature",
            "sport",
            "color",
            "camp",
            "fruit",
            "discord",
            "winter",
            "pokemon",
          ];

          const chosenTheme = Math.round(Math.random() * theme.length);

          const Game = new Hangman({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Hangman",
              color: gameColor(client),
            },
            hangman: {
              hat: "🎩",
              head: "😟",
              shirt: "👕",
              pants: "🩳",
              boots: "👞👞",
            },
            timeoutTime: 60000,
            theme: `${theme[chosenTheme]}`,
            winMessage: "You won! The word was **{word}**.",
            loseMessage: "You lost! The word was **{word}**.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "matchpairs":
        {
          const Game = new MatchPairs({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Match Pairs",
              color: gameColor(client),
              description:
                "**Click on the buttons to match emojis with their pairs.**",
            },
            timeoutTime: 60000,
            emojis: [
              "🍉",
              "🍇",
              "🍊",
              "🥭",
              "🍎",
              "🍏",
              "🥝",
              "🥥",
              "🍓",
              "🫐",
              "🍍",
              "🥕",
              "🥔",
            ],
            winMessage:
              "**You won the Game! You turned a total of `{tilesTurned}` tiles.**",
            loseMessage:
              "**You lost the Game! You turned a total of `{tilesTurned}` tiles.**",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "minesweeper":
        {
          const Game = new Minesweeper({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Minesweeper",
              color: gameColor(client),
              description:
                "Click on the buttons to reveal the blocks except mines.",
            },
            emojis: { flag: "<:restrict:1567797003638022166>", mine: "💣" },
            mines: 5,
            timeoutTime: 60000,
            winMessage:
              "You won the Game! You successfully avoided all the mines.",
            loseMessage: "You lost the Game! Beaware of the mines next time.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "rps":
        {
          let choices = ["rock", "paper", "scissor"];
          const botchoice = `${
            choices[Math.floor(Math.random() * choices.length)]
          }`;
          console.log(`The bot chose ${botchoice}`);

          const Embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setAuthor({
              name: "Rock Paper Scissors",
              iconURL: interaction.member.displayAvatarURL(),
            })
            .setDescription(`<@${interaction.member.id}> choose your move.`);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setCustomId("rock")
              .setLabel("Rock")
              .setEmoji(`✊`),

            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setCustomId("paper")
              .setLabel("Paper")
              .setEmoji(parseEmoji(`<:restrict:1567797003638022166>`)),

            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setCustomId("scissor")
              .setLabel("Scissors")
              .setEmoji(`✌`)
          );

          const Page = await interaction.reply({
            embeds: [Embed],
            components: [row],
          });
          const col = Page.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: ms("10s"),
          });
          col.on("collect", (i) => {
            switch (i.customId) {
              case "rock":
                {
                  if (botchoice == "rock") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`Game tied\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Rock",
                              inline: true,
                            },
                            { name: "My choice", value: "Rock", inline: true }
                          ),
                      ],
                      components: [],
                    });
                  }

                  if (botchoice == "paper") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`You lost the game\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Rock",
                              inline: true,
                            },
                            { name: "My choice", value: "Paper", inline: true }
                          ),
                      ],
                      components: [],
                    });
                  }
                  if (botchoice == "scissor") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`You won the game\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Rock",
                              inline: true,
                            },
                            {
                              name: "My choice",
                              value: "Scissors",
                              inline: true,
                            }
                          ),
                      ],
                      components: [],
                    });
                  }
                }
                break;
              case "paper":
                {
                  if (botchoice == "rock") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`You won the game\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Paper",
                              inline: true,
                            },
                            { name: "My choice", value: "Rock", inline: true }
                          ),
                      ],
                      components: [],
                    });
                  }

                  if (botchoice == "paper") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`Game tied\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Paper",
                              inline: true,
                            },
                            { name: "My choice", value: "Paper", inline: true }
                          ),
                      ],
                      components: [],
                    });
                  }
                  if (botchoice == "scissor") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`You lost the game\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Paper",
                              inline: true,
                            },
                            {
                              name: "My choice",
                              value: "Scissors",
                              inline: true,
                            }
                          ),
                      ],
                      components: [],
                    });
                  }
                }
                break;

              case "scissor":
                {
                  if (botchoice == "rock") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`You lost the game\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Scissors",
                              inline: true,
                            },
                            { name: "My choice", value: "Rock", inline: true }
                          ),
                      ],
                      components: [],
                    });
                  }

                  if (botchoice == "paper") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`You won the game\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Scissors",
                              inline: true,
                            },
                            { name: "My choice", value: "Paper", inline: true }
                          ),
                      ],
                      components: [],
                    });
                  }
                  if (botchoice == "scissor") {
                    return interaction.editReply({
                      embeds: [
                        new EmbedBuilder()
                          .setColor(client.config.embedColor)
                          .setAuthor({
                            name: "Rock Paper Scissors",
                            iconURL: interaction.member.displayAvatarURL(),
                          })
                          .setDescription(`\`\`\`Game tied\`\`\``)
                          .addFields(
                            {
                              name: "Your choice",
                              value: "Scissors",
                              inline: true,
                            },
                            {
                              name: "My choice",
                              value: "Scissors",
                              inline: true,
                            }
                          ),
                      ],
                      components: [],
                    });
                  }
                }
                break;
            }
          });
          col.on("end", (collected) => {
            if (collected.size > 0) return;

            interaction.editReply({
              embeds: [
                Embed.setDescription(
                  `:warning: | You did not choose your move.`
                ).setColor(client.config.embedColor),
              ],
              components: [],
            });
          });
        }
        break;
      case "slots":
        {
          const Game = new Slots({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Slot Machine",
              color: gameColor(client),
            },
            slots: ["🍇", "🍊", "🍋", "🍌"],
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "snake":
        {
          const Game = new Snake({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Snake Game",
              overTitle: "Game Over",
              color: gameColor(client),
            },
            emojis: {
              board: "⬛",
              food: "🍎",
              up: "<:arrow:1567796951527850055>",
              down: "<:down:1567796964672929802>",
              left: "<:arrow:1567796951527850055>",
              right: "<:arrow:1567796951527850055>",
            },
            stopButton: "Stop",
            timeoutTime: 60000,
            snake: { head: "<:LEgreen:1567796933307666515>", body: "🟩", tail: "<:LEgreen:1567796933307666515>", over: "💀" },
            foods: ["🍎", "🍇", "🍊", "🫐", "🥕", "🥝", "🌽"],
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "trivia":
        {
          const Game = new Trivia({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Trivia",
              color: gameColor(client),
              description: "You have 60 seconds to guess the answer.",
            },
            timeoutTime: 60000,
            buttonStyle: "PRIMARY",
            trueButtonStyle: "SUCCESS",
            falseButtonStyle: "DANGER",
            mode: "multiple", // multiple || single
            difficulty: "medium", // easy || medium || hard
            winMessage: "You won! The correct answer is {answer}.",
            loseMessage: "You lost! The correct answer is {answer}.",
            errMessage: "Unable to fetch question data! Please try again.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "wordle":
        {
          const Game = new Wordle({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Wordle",
              color: gameColor(client),
            },
            customWord: null,
            timeoutTime: 60000,
            winMessage: "You won! The word was **{word}**.",
            loseMessage: "You lost! The word was **{word}**.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "wouldyourather":
        {
          const Game = new WouldYouRather({
            message: interaction,
            slash_command: true,
            embed: {
              title: "Would You Rather",
              color: gameColor(client),
            },
            buttons: {
              option1: "Option 1",
              option2: "Option 2",
            },
            timeoutTime: 60000,
            errMessage: "Unable to fetch question data! Please try again.",
            playerOnlyMessage: "Only {player} can use these buttons.",
          });

          Game.startGame();
        }
        break;

      // ── Emoji Quiz ────────────────────────────────────────────────────────
      case "emojiquiz": {
        const EMOJI_QUIZ_BANK = [
          { emoji: "🍕", answer: "pizza" },
          { emoji: "<:boost:1567796953599836280>", answer: "rocket" },
          { emoji: "🦊", answer: "fox" },
          { emoji: "<:eco:1567796967197900842>", answer: "rainbow" },
          { emoji: "<:n_music:1567796993403658261>", answer: "guitar" },
          { emoji: "<:1430986209995526274:1567796911350747206>", answer: "trophy" },
          { emoji: "🦋", answer: "butterfly" },
          { emoji: "🎃", answer: "pumpkin" },
          { emoji: "<:eco:1567796967197900842>", answer: "flower" },
          { emoji: "🐬", answer: "dolphin" },
          { emoji: "<:minigames:1567796978929238076>", answer: "target" },
          { emoji: "🦄", answer: "unicorn" },
          { emoji: "🍩", answer: "donut" },
          { emoji: "🏰", answer: "castle" },
          { emoji: "🦁", answer: "lion" },
          { emoji: "🌙", answer: "moon" },
          { emoji: "<:minigames:1567796978929238076>", answer: "masks" },
          { emoji: "🐉", answer: "dragon" },
          { emoji: "🎪", answer: "circus" },
          { emoji: "🌊", answer: "wave" },
        ];

        const pick  = EMOJI_QUIZ_BANK[Math.floor(Math.random() * EMOJI_QUIZ_BANK.length)];
        const TIME  = 20_000;

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle("🤔 Emoji Quiz")
          .setDescription(`What does this emoji represent?\n\n# ${pick.emoji}\n\n*Type your answer in chat! You have 20 seconds.*`)
          .setFooter({ text: `Player: ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });

        const filter = m => m.author.id === interaction.user.id && m.channelId === interaction.channelId;
        const collector = interaction.channel.createMessageCollector({ filter, time: TIME });

        let answered = false;
        collector.on("collect", async (msg) => {
          if (msg.content.toLowerCase().trim() === pick.answer.toLowerCase()) {
            answered = true;
            collector.stop();
            return msg.reply({
              embeds: [new EmbedBuilder()
                .setColor(0x22c55e)
                .setTitle("<a:tickyy:1567797045253644368> Correct!")
                .setDescription(`The answer was **${pick.answer}** ${pick.emoji}\n\nWell done, ${interaction.user.toString()}!`)],
            });
          }
          msg.reply({ content: `<:crossy:1567796959648030831> Not quite! Keep trying…`, flags: MessageFlags.Ephemeral }).catch(() => {});
        });

        collector.on("end", () => {
          if (!answered) {
            interaction.channel.send({
              embeds: [new EmbedBuilder()
                .setColor(0xef4444)
                .setTitle("<:1430986244921495654:1567796929587576852> Time's Up!")
                .setDescription(`The answer was **${pick.answer}** ${pick.emoji}`)],
            }).catch(() => {});
          }
        });
        break;
      }

      // ── Guess the Flag ────────────────────────────────────────────────────
      case "guessthedlag": {
        const FLAGS = [
          { flag: "🇬🇧", country: "United Kingdom" },
          { flag: "🇺🇸", country: "United States" },
          { flag: "🇫🇷", country: "France" },
          { flag: "🇩🇪", country: "Germany" },
          { flag: "🇯🇵", country: "Japan" },
          { flag: "🇧🇷", country: "Brazil" },
          { flag: "🇨🇦", country: "Canada" },
          { flag: "🇦🇺", country: "Australia" },
          { flag: "🇮🇳", country: "India" },
          { flag: "🇮🇹", country: "Italy" },
          { flag: "🇪🇸", country: "Spain" },
          { flag: "🇲🇽", country: "Mexico" },
          { flag: "🇰🇷", country: "South Korea" },
          { flag: "🇨🇳", country: "China" },
          { flag: "🇷🇺", country: "Russia" },
          { flag: "🇿🇦", country: "South Africa" },
          { flag: "🇦🇷", country: "Argentina" },
          { flag: "🇸🇪", country: "Sweden" },
          { flag: "🇳🇴", country: "Norway" },
          { flag: "🇳🇿", country: "New Zealand" },
          { flag: "🇵🇹", country: "Portugal" },
          { flag: "🇳🇱", country: "Netherlands" },
          { flag: "🇨🇭", country: "Switzerland" },
          { flag: "🇵🇱", country: "Poland" },
          { flag: "🇹🇷", country: "Turkey" },
          { flag: "🇸🇦", country: "Saudi Arabia" },
          { flag: "🇪🇬", country: "Egypt" },
          { flag: "🇳🇬", country: "Nigeria" },
          { flag: "🇹🇭", country: "Thailand" },
          { flag: "🇵🇭", country: "Philippines" },
        ];

        const pick = FLAGS[Math.floor(Math.random() * FLAGS.length)];
        const TIME = 25_000;
        const ALIASES = { "uk": "United Kingdom", "usa": "United States", "us": "United States", "america": "United States" };

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle("<:1430986225493479485:1567796921681055824> Guess the Flag!")
          .setDescription(`Which country does this flag belong to?\n\n# ${pick.flag}\n\n*Type your answer in chat! You have 25 seconds.*`)
          .setFooter({ text: `Player: ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });

        const filter = m => m.author.id === interaction.user.id && m.channelId === interaction.channelId;
        const collector = interaction.channel.createMessageCollector({ filter, time: TIME });

        let answered = false;
        collector.on("collect", async (msg) => {
          const raw     = msg.content.toLowerCase().trim();
          const guess   = ALIASES[raw] ?? raw;
          const correct = pick.country.toLowerCase();
          if (guess === correct || correct.startsWith(guess) || guess.startsWith(correct)) {
            answered = true;
            collector.stop();
            return msg.reply({
              embeds: [new EmbedBuilder()
                .setColor(0x22c55e)
                .setTitle("<a:tickyy:1567797045253644368> Correct!")
                .setDescription(`The flag was **${pick.country}** ${pick.flag}\n\nNice geography knowledge, ${interaction.user.toString()}!`)],
            });
          }
          msg.reply({ content: `<:crossy:1567796959648030831> Not that one! Keep trying…`, flags: MessageFlags.Ephemeral }).catch(() => {});
        });

        collector.on("end", () => {
          if (!answered) {
            interaction.channel.send({
              embeds: [new EmbedBuilder()
                .setColor(0xef4444)
                .setTitle("<:1430986244921495654:1567796929587576852> Time's Up!")
                .setDescription(`The answer was **${pick.country}** ${pick.flag}`)],
            }).catch(() => {});
          }
        });
        break;
      }
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */
