const { EmbedBuilder, MessageFlags } = require("discord.js");
const changelogs = require("../../Schemas/changelogs");
const currentDate = new Date().toISOString();

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;

    const { customId, fields } = interaction;

    if (customId !== "changelogs") return;

    function isValidHexColor(str) {
      return /^#[0-9A-F]{6}$/i.test(str);
    }

    const title = fields.getTextInputValue("changelogs-title");
    const description = fields.getTextInputValue("changelogs-description");
    const footer = fields.getTextInputValue("changelogs-footer");
    const color = fields.getTextInputValue("changelogs-color");
    const type = fields.getTextInputValue("changelogs-type");

    try {
      const data = await changelogs.findOne({ date: currentDate });

      if (!data) {
        await changelogs.create({
          date: Date.now(),
          config: {
            title: !title ? null : title,
            description: description,
            footer: !footer ? null : footer,
            color: isValidHexColor(color) ? color : null,
            type: !type ? null : type,
          },
        });

        const embed = new EmbedBuilder()
          .setDescription(
            `\`<:dot:1555544412300378243>\` **Changelogs embed information**
                    
                    > |\`<:files:1555544445565407352>\` **Title -** ${
                      !title ? `${client.user.username} Changelogs` : title
                    }
                    > |\`<:files:1555544445565407352>\` **Description -** ${
                      !description ? "A new changelogs is here!" : description
                    }
                    > |\`<:dot:1555544412300378243>\` **Footer -** ${
                      !footer
                        ? `${client.user.username} Changelogs`
                        : `${footer}`
                    } ${!type ? `| Bot` : `| ${type}`}
                    > |\`<:n_utils:1555544669545431062>\` **Color -** \`${!color ? "#ffffff" : color}\``
          )
          .setColor(client.config.embedColor);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      return interaction.reply({
        content: `A changelog created in this second was found, wait at least one second before sending another one`,
        flags: MessageFlags.Ephemeral
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: `An error occurred while processing your request.`,
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
