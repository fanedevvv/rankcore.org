const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`react`)
    .setDescription(`Send an expressive reaction`)
    .addSubcommand((command) =>
      command.setName(`cry`).setDescription(`Show that you're crying 😢`)
    )
    .addSubcommand((command) =>
      command.setName(`blush`).setDescription(`Show your blushing :3`)
    )
    .addSubcommand((command) =>
      command.setName(`smile`).setDescription(`Show a cute smile 🙂`)
    )
    .addSubcommand((command) =>
      command.setName(`laugh`).setDescription(`Show laughter 😆`)
    )
    .addSubcommand((command) =>
      command.setName(`angry`).setDescription(`Show anger 😡`)
    )
    .addSubcommand((command) =>
      command.setName(`sleepy`).setDescription(`Show you're sleepy 😴`)
    )
    .addSubcommand((command) =>
      command.setName(`awkward`).setDescription(`Show awkwardness 😅`)
    )
    .addSubcommand((command) =>
      command.setName(`happy`).setDescription(`Show happiness 😄`)
    )
    .addSubcommand((command) =>
      command.setName(`sad`).setDescription(`Show sadness <:error:1567796968758050868>`)
    )
    .addSubcommand((command) =>
      command.setName(`confused`).setDescription(`Show confusion 😕`)
    )
    .addSubcommand((command) =>
      command.setName(`shy`).setDescription(`Show shyness 😳`)
    )
    .addSubcommand((command) =>
      command.setName(`tired`).setDescription(`Show tiredness 😪`)
    )
    .addSubcommand((command) =>
      command.setName(`excited`).setDescription(`Show excitement 😁`)
    )
    .addSubcommand((command) =>
      command.setName(`comfy`).setDescription(`Show comfy 😁`)
    )
    .addSubcommand((command) =>
      command.setName(`surprised`).setDescription(`Show surprise 😲`)
    )
    .addSubcommand((command) =>
      command.setName(`tail`).setDescription(`Show a cute tail wag 🐾`)
    ),

  async execute(interaction, client) {
    const command = interaction.options.getSubcommand();

    let apiEndpoint;
    let description;

    switch (command) {
      case "cry":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/cry/gif";
        description = `${interaction.user} is crying... 😢`;
        break;
      case "blush":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/blush/gif";
        description = `${interaction.user} is blushing!`;
        break;
      case "smile":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/smile/gif";
        description = `${interaction.user} is smiling! 🙂`;
        break;
      case "comfy":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/comfy/gif";
        description = `${interaction.user} is comfy! 😁`;
        break;
      case "laugh":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/laugh/gif";
        description = `${interaction.user} is laughing! 😆`;
        break;
      case "angry":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/angry/gif";
        description = `${interaction.user} is angry! 😡`;
        break;
      case "sleepy":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/sleepy/gif";
        description = `${interaction.user} is sleepy... 😴`;
        break;
      case "awkward":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/awkward/gif";
        description = `${interaction.user} feels awkward 😅`;
        break;
      case "happy":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/happy/gif";
        description = `${interaction.user} is happy! 😄`;
        break;
      case "sad":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/sad/gif";
        description = `${interaction.user} is feeling sad <:error:1567796968758050868>`;
        break;
      case "confused":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/confused/gif";
        description = `${interaction.user} is confused 😕`;
        break;
      case "shy":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/shy/gif";
        description = `${interaction.user} is feeling shy 😳`;
        break;
      case "tired":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/tired/gif";
        description = `${interaction.user} is tired 😪`;
        break;
      case "excited":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/excited/gif";
        description = `${interaction.user} is excited! 😁`;
        break;
      case "surprised":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/surprised/gif";
        description = `${interaction.user} is surprised! 😲`;
        break;
      case "tail":
        apiEndpoint = "https://api.purrbot.site/v2/img/sfw/tail/gif";
        description = `${interaction.user} is wagging their tail! 🐾`;
        break;
      default:
        const errorEmbed = new EmbedBuilder()
          .setColor("Red")
          .setDescription(`<:crossy:1567796959648030831> Unknown reaction!`);
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
      const res = await fetch(apiEndpoint);
      const json = await res.json();
      const gifLink = json.link;

      const embed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setDescription(description)
        .setImage(gifLink);

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription(`<:crossy:1567796959648030831> Failed to fetch reaction. Try again later.`);
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
