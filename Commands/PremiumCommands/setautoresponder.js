const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Autoresponder = require("../../Schemas/Autoresponder");

module.exports = {
  premium: true,
  premiumTier: "basic",
  data: new SlashCommandBuilder()
    .setName("autoresponder")
    .setDescription("Manage autoresponders")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set an autoresponder trigger and response")
        .addStringOption((option) =>
          option
            .setName("trigger")
            .setDescription("The word or phrase to trigger the autoresponse")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("response")
            .setDescription("The message the bot will send")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove an autoresponder")
        .addStringOption((option) =>
          option
            .setName("trigger")
            .setDescription("The trigger word or phrase to remove")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all autoresponders for this server")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add-link")
        .setDescription("Add a link button component to an autoresponder trigger.")
        .addStringOption((option) =>
          option
            .setName("trigger")
            .setDescription("The trigger to add the link button to.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("url")
            .setDescription("The URL the button opens (must start with https://).")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("label")
            .setDescription("Button label text.")
            .setRequired(true)
            .setMaxLength(80)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("Optional emoji on the button (e.g. <:1430986227909263442:1555544212756242532>).")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove-link")
        .setDescription("Remove all link buttons from an autoresponder trigger.")
        .addStringOption((option) =>
          option
            .setName("trigger")
            .setDescription("The trigger to remove link buttons from.")
            .setRequired(true)
        )
    ),



  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const trigger = interaction.options.getString("trigger").toLowerCase();
      const response = interaction.options.getString("response");

      // ── Tier limit enforcement ────────────────────────────────────────────
      const { getGuildTier, getLimit } = require("../../Utils/premiumTiers");
      const tier  = await getGuildTier(interaction.guild.id);
      const limit = getLimit(tier, "autoresponders");

      let auto = await Autoresponder.findOne({ guildId: interaction.guild.id, trigger });

      // Only count against the limit when creating (not updating existing)
      if (!auto) {
        const count = await Autoresponder.countDocuments({ guildId: interaction.guild.id });
        if (count >= limit) {
          const tierLabels = { free: "Free (5 max)", basic: "Basic (15 max)", pro: "Pro (50 max)", elite: "Elite (unlimited)" };
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("Red")
                .setTitle("<:thunderr:1555544623735242883> Autoresponder Limit Reached")
                .setDescription(
                  `You've reached the **${limit}** autoresponder limit for your current plan (**${tierLabels[tier] ?? tier}**).

` +
                  `Upgrade with \`/premium plans\` to unlock more.`
                )
            ],
            ephemeral: true,
          });
        }
      }

      if (auto) {
        auto.response = response;
        await auto.save();

        const updatedEmbed = new EmbedBuilder()
          .setColor("Green")
          .setDescription(`<a:tickyy:1555544712687915008> Updated the autoresponder for trigger: \`${trigger}\``);
        return interaction.reply({ embeds: [updatedEmbed], ephemeral: true });
      }

      auto = new Autoresponder({
        guildId: interaction.guild.id,
        trigger,
        response,
      });

      await auto.save();

      const createdEmbed = new EmbedBuilder()
        .setColor("Green")
        .setDescription(`<a:tickyy:1555544712687915008> Created a new autoresponder for trigger: \`${trigger}\``);

      return interaction.reply({ embeds: [createdEmbed], ephemeral: true });
    }

    if (subcommand === "remove") {
      const trigger = interaction.options.getString("trigger").toLowerCase();

      const deleted = await Autoresponder.findOneAndDelete({
        guildId: interaction.guild.id,
        trigger,
      });

      if (!deleted) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setDescription(`<:crossy:1555544390221562048> No autoresponder found for: \`${trigger}\``),
          ],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setDescription(`<a:tickyy:1555544712687915008> Removed the autoresponder for: \`${trigger}\``),
        ],
        ephemeral: true,
      });
    }

    if (subcommand === "list") {
      const autoresponders = await Autoresponder.find({ guildId: interaction.guild.id });

      if (!autoresponders.length) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Yellow")
              .setDescription("<:n_info:1555544473008873565> There are no autoresponders set for this server."),
          ],
          ephemeral: true,
        });
      }

      const listEmbed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("<:files:1555544445565407352> Autoresponders List")
        .setDescription(
          autoresponders
            .map(
              (auto, index) =>
                `**${index + 1}. Trigger:** \`${auto.trigger}\`\n**Response:** ${auto.response}`
            )
            .join("\n\n")
        );

      return interaction.reply({ embeds: [listEmbed], ephemeral: true });
    }
    if (subcommand === "add-link") {
      const { ButtonStyle } = require("discord.js");
      const trigger = interaction.options.getString("trigger").toLowerCase();
      const url     = interaction.options.getString("url").trim();
      const label   = interaction.options.getString("label").trim();
      const emoji   = interaction.options.getString("emoji")?.trim() || null;

      if (!url.startsWith("https://") && !url.startsWith("http://")) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription("<:crossy:1555544390221562048> The URL must start with `https://` or `http://`.")],
          ephemeral: true,
        });
      }

      const auto = await Autoresponder.findOne({ guildId: interaction.guild.id, trigger });
      if (!auto) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription(`<:crossy:1555544390221562048> No autoresponder found for trigger: \`${trigger}\``)],
          ephemeral: true,
        });
      }

      // Build the link button and store in the buttons action row
      if (!auto.buttons) auto.buttons = { type: 1, components: [] };
      if (!auto.buttons.components) auto.buttons.components = [];

      if (auto.buttons.components.length >= 5) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription("<:crossy:1555544390221562048> This autoresponder already has 5 buttons (Discord maximum). Remove one first.")],
          ephemeral: true,
        });
      }

      const btnId = `ar_link_${Date.now()}`;
      auto.buttons.components.push({
        type: 2,
        label,
        style: 5,          // ButtonStyle.Link = 5
        url,
        custom_id: '',
        disabled: false,
        emoji: emoji ? { name: emoji, id: '' } : undefined,
      });
      auto.markModified('buttons');
      await auto.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor("Green")
          .setTitle("<:1430986227909263442:1555544212756242532> Link Button Added")
          .setDescription(`Added a **${label}** link button to the \`${trigger}\` autoresponder.`)
          .addFields({ name: "URL", value: url })],
        ephemeral: true,
      });
    }

    if (subcommand === "remove-link") {
      const trigger = interaction.options.getString("trigger").toLowerCase();
      const auto = await Autoresponder.findOne({ guildId: interaction.guild.id, trigger });
      if (!auto) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription(`<:crossy:1555544390221562048> No autoresponder found for trigger: \`${trigger}\``)],
          ephemeral: true,
        });
      }

      if (!auto.buttons?.components?.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor("Yellow").setDescription("<:error:1555544434601369620> This autoresponder has no buttons to remove.")],
          ephemeral: true,
        });
      }

      // Remove link-type buttons (style 5) only
      const before = auto.buttons.components.length;
      auto.buttons.components = auto.buttons.components.filter(b => b.style !== 5);
      auto.markModified('buttons');
      await auto.save();

      const removed = before - auto.buttons.components.length;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor("Green")
          .setDescription(`<a:tickyy:1555544712687915008> Removed **${removed}** link button(s) from the \`${trigger}\` autoresponder.`)],
        ephemeral: true,
      });
    }
  },
};
