const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/**
 * Handles a "do action to user" command with a reciprocal button.
 *
 * @param {object} opts
 * @param {import("discord.js").Interaction} opts.interaction
 * @param {object} opts.client
 * @param {string} opts.userOptionName   - Name of the user option (e.g. "user" or "target")
 * @param {string} opts.apiEndpoint      - PurrBot API path (e.g. "slap")
 * @param {string} opts.actionPast       - Past tense verb shown in embed (e.g. "slapped")
 * @param {string} opts.buttonLabel      - Label for the back button (e.g. "Slap back")
 * @param {string} opts.buttonId         - Custom ID for the back button (e.g. "slap-back")
 */
async function actionCommand(opts) {
  const { interaction, client, userOptionName, apiEndpoint, actionPast, buttonLabel, buttonId } = opts;

  const targetUser = interaction.options.getUser(userOptionName);

  const gifUrl = await fetchGif(apiEndpoint);

  const embed = new EmbedBuilder()
    .setColor(client.config.embedColor)
    .setDescription(`${interaction.user} ${actionPast} ${targetUser}!`)
    .setImage(gifUrl);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonId)
      .setLabel(buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.reply({ embeds: [embed], components: [button] });

  const filter = (i) => i.customId === buttonId && i.user.id === targetUser.id;

  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    max: 1,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    const backGifUrl = await fetchGif(apiEndpoint);

    const replyEmbed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setDescription(`${targetUser} ${actionPast} back ${interaction.user}!`)
      .setImage(backGifUrl);

    await i.reply({ embeds: [replyEmbed] });
  });
}

async function fetchGif(endpoint) {
  const res = await fetch(`https://api.purrbot.site/v2/img/sfw/${endpoint}/gif`);
  const json = await res.json();
  return json.link;
}

module.exports = { actionCommand };