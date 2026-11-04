const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const axios = require("axios").default;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("images")
    .setDescription("This is a subcommand images")
    .addSubcommand((command) =>
      command.setName("cat").setDescription("Get a random cat image")
    )
    .addSubcommand((command) =>
      command.setName("dog").setDescription("Generates a random dog image")
    )
    .addSubcommand((command) =>
      command
        .setName("fake-tweet")
        .setDescription("Post a real tweet <:n_bot:1555544367886770176>")
        .addStringOption((option) =>
          option.setName("tweet").setDescription("Enter your tweet").setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("fake-ytcomment")
        .setDescription("Post a real youtube comment <:LEred:1555544262123323422>")
        .addStringOption((option) =>
          option.setName("comment").setDescription("Enter your comment").setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command.setName("meme").setDescription("Generates a meme image <:minigames:1555544500179439707>")
    )
    .addSubcommand((command) =>
      command
        .setName("jail")
        .setDescription("Get a jail form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("comrade")
        .setDescription("Get a comrade form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("gay")
        .setDescription("Get a gay form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("pixelate")
        .setDescription("Get a pixelated form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("passed")
        .setDescription("Get a GTA passed form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("wasted")
        .setDescription("Get a GTA wasted form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("triggered")
        .setDescription("Get a triggered form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("circle-crop")
        .setDescription("Get a circle cropped form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    )
    .addSubcommand((command) =>
      command
        .setName("glass")
        .setDescription("Get a glass form of a user's avatar.")
        .addUserOption((option) => option.setName("user").setDescription("Select a user"))
    ),
  
  async execute(interaction, client) {
    const command = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user") || interaction.user;

    // Helper function to handle avatar transformations
    const handleAvatarTransformation = async (transformation) => {
      const avatarUrl = user.avatarURL({ size: 512, extension: "jpg" });
      const canvasUrl = `https://some-random-api.com/canvas/${transformation}?avatar=${avatarUrl}`;
      await interaction.reply({ content : canvasUrl });
    };

    // Cat
    if (command === "cat") {
      try {
        const response = await axios.get("https://api.thecatapi.com/v1/images/search");
        const imageUrl = response.data[0].url;

        const catEmbed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle("Random Cat Image")
          .setImage(imageUrl);

        await interaction.reply({ embeds: [catEmbed] });
      } catch (error) {
        console.error(error);
        await interaction.reply("Sorry, there was an error getting the cat image.");
      }
    }

    // Dog
    if (command === "dog") {
      try {
        const response = await axios.get("https://dog.ceo/api/breeds/image/random");
        const imageUrl = response.data.message;

        const dogEmbed = new EmbedBuilder()
          .setTitle("<:minigames:1555544500179439707> Random Dog")
          .setColor(client.config.embedColor)
          .setImage(imageUrl);

        await interaction.reply({ embeds: [dogEmbed] });
      } catch (error) {
        console.error(error);
        await interaction.reply("Sorry, there was an error generating a random dog image.");
      }
    }

    // Jail
    if (command === "jail") {
      await handleAvatarTransformation("jail");
    }

    // Gay
    if (command === "gay") {
      await handleAvatarTransformation("gay");
    }

    // Glass
    if (command === "glass") {
      await handleAvatarTransformation("glass");
    }

    // Fake Tweet
    if (command === "fake-tweet") {
      const tweet = interaction.options.getString("tweet");
      const avatarUrl = interaction.user.avatarURL({ extension: "jpg" });
      const canvasUrl = `https://some-random-api.com/canvas/tweet?avatar=${avatarUrl}&displayname=${interaction.user.username}&username=${interaction.user.username}&comment=${encodeURIComponent(tweet)}`;

      const tweetEmbed = new EmbedBuilder()
        .setTitle("<:n_bot:1555544367886770176>・Fake Tweet!")
        .setImage(canvasUrl)
        .setTimestamp()
        .setColor(client.config.embedColor);

      await interaction.reply({ embeds: [tweetEmbed] });
    }

    // Pixelated
    if (command === "pixelate") {
      await handleAvatarTransformation("pixelate");
    }

    // Circle Crop
    if (command === "circle-crop") {
      await handleAvatarTransformation("circle");
    }

    // YT-Comment
    if (command === "fake-ytcomment") {
      const comment = interaction.options.getString("comment");
      const avatarUrl = interaction.user.avatarURL({ extension: "jpg" });
      const canvasUrl = `https://some-random-api.com/canvas/youtube-comment?avatar=${avatarUrl}&displayname=${interaction.user.username}&username=${interaction.user.username}&comment=${encodeURIComponent(comment)}`;

      const ytCommentEmbed = new EmbedBuilder()
        .setTitle("<:LEred:1555544262123323422>・Fake comment!")
        .setImage(canvasUrl)
        .setTimestamp()
        .setColor(client.config.embedColor);

      await interaction.reply({ embeds: [ytCommentEmbed] });
    }

    // Triggered
    if (command === "triggered") {
      await handleAvatarTransformation("triggered");
    }

    // Comrade
    if (command === "comrade") {
      await handleAvatarTransformation("comrade");
    }

    // Passed
    if (command === "passed") {
      await handleAvatarTransformation("passed");
    }

    // Wasted
    if (command === "wasted") {
      await handleAvatarTransformation("wasted");
    }

    // Meme
    if (command === "meme") {
      try {
        const response = await axios.get("https://meme-api.com/gimme");
        const data = response.data;

        const memeEmbed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle(data.title)
          .setImage(data.url)
          .setFooter({ text: `From r/${data.subreddit}` });

        await interaction.reply({ embeds: [memeEmbed] });
      } catch (error) {
        console.error(error);
        await interaction.reply("Sorry, there was an error fetching the meme.");
      }
    }
    },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */