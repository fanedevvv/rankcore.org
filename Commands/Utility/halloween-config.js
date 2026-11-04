const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const halloweenSchema = require("../../Schemas/halloweenSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("halloween-config")
    .setDescription("Configure the automatic Halloween countdown system.")
    .setDMPermission(false),

  async execute(interaction, client) {
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      interaction.user.id !== process.env.developerId
    ) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    let data = await halloweenSchema.findOne({ Guild: interaction.guild.id });
    let collected = {};

    if (data) {
      collected.enabled = data.Enabled;
      collected.channel = data.Channel;
      collected.pingRole = data.PingRole;
    }

    const embed = new EmbedBuilder()
      .setTitle("<:fire:1555544450871332944> Halloween Countdown Configuration")
      .setColor("Orange")
      .addFields(
        {
          name: "Status",
          value: data?.Enabled
            ? "```ansi\n\u001b[32m<:LEgreen:1555544256356159600> ENABLED```"
            : "```ansi\n\u001b[31m<:LEred:1555544262123323422> DISABLED```",
        },
        {
          name: "Configuration",
          value:
            "```yml\n" +
            `channel: "${collected.channel ? `<#${collected.channel}>` : "Not Set"}"\n` +
            `pingRole: "${collected.pingRole ? `<@&${collected.pingRole}>` : "Not Set"}"\n` +
            `enabled: "${collected.enabled ? "Yes" : "No"}"` +
            "\n```",
        }
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("set_channel")
        .setStyle(ButtonStyle.Primary)
        .setLabel("Set Channel"),
      new ButtonBuilder()
        .setCustomId("set_pingrole")
        .setStyle(ButtonStyle.Primary)
        .setLabel("Set Ping Role"),
      new ButtonBuilder()
        .setCustomId("enable")
        .setStyle(ButtonStyle.Success)
        .setLabel("Enable"),
      new ButtonBuilder()
        .setCustomId("disable")
        .setStyle(ButtonStyle.Danger)
        .setLabel("Disable")
    );

    const reply = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "disable") {
        await halloweenSchema.deleteMany({ Guild: interaction.guild.id });

        embed.data.fields[0].value = "```ansi\n\u001b[31m<:LEred:1555544262123323422> DISABLED```";
        embed.data.fields[1].value =
          "```yml\nchannel: \"Not Set\"\npingRole: \"Not Set\"\nenabled: \"No\"```";

        return await i.editReply({ embeds: [embed], components: [buttons] });
      }

      if (i.customId === "enable") {
        if (!collected.channel) {
          return i.followUp({
            content: "You must set a channel before enabling.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await halloweenSchema.findOneAndUpdate(
          { Guild: interaction.guild.id },
          {
            Guild: interaction.guild.id,
            Enabled: true,
            Channel: collected.channel,
            PingRole: collected.pingRole || null,
            LastSentDay: 0,
          },
          { upsert: true }
        );

        embed.data.fields[0].value = "```ansi\n\u001b[32m<:LEgreen:1555544256356159600> ENABLED```";
        embed.data.fields[1].value =
          `\`\`\`yml\nchannel: "<#${collected.channel}>"\npingRole: "${collected.pingRole ? `<@&${collected.pingRole}>` : "Not Set"}"\nenabled: "Yes"\n\`\`\``;

        return await i.editReply({ embeds: [embed], components: [buttons] });
      }

      if (i.customId === "set_channel") {
        i.followUp({
          content: "Please mention the channel to send countdown messages.",
          flags: MessageFlags.Ephemeral,
        });

        const msgCollector = i.channel.createMessageCollector({
          filter: m => m.author.id === interaction.user.id,
          max: 1,
          time: 30000,
        });

        msgCollector.on("collect", async m => {
          const ch = m.mentions.channels.first();
          await m.delete();

          if (!ch) {
            return i.followUp({
              content: "Invalid channel. Try again.",
              flags: MessageFlags.Ephemeral,
            });
          }

          collected.channel = ch.id;

          embed.data.fields[1].value =
            `\`\`\`yml\nchannel: "<#${ch.id}>"\npingRole: "${collected.pingRole ? `<@&${collected.pingRole}>` : "Not Set"}"\nenabled: "${collected.enabled ? "Yes" : "No"}"\n\`\`\``;

          await i.editReply({ embeds: [embed], components: [buttons] });
          i.followUp({
            content: "Halloween countdown channel set!",
            flags: MessageFlags.Ephemeral,
          });
        });
      }

      if (i.customId === "set_pingrole") {
        i.followUp({
          content: "Please mention the role you want to ping every day.",
          flags: MessageFlags.Ephemeral,
        });

        const msgCollector = i.channel.createMessageCollector({
          filter: m => m.author.id === interaction.user.id,
          max: 1,
          time: 30000,
        });

        msgCollector.on("collect", async m => {
          const role = m.mentions.roles.first();
          await m.delete();

          if (!role) {
            return i.followUp({
              content: "Invalid role. Try again.",
              flags: MessageFlags.Ephemeral,
            });
          }

          collected.pingRole = role.id;

          embed.data.fields[1].value =
            `\`\`\`yml\nchannel: "<#${collected.channel || "Not Set"}>"\npingRole: "<@&${role.id}>"\nenabled: "${collected.enabled ? "Yes" : "No"}"\n\`\`\``;

          await i.editReply({ embeds: [embed], components: [buttons] });
          i.followUp({
            content: "Ping role set!",
            flags: MessageFlags.Ephemeral,
          });
        });
      }
    });

    collector.on("end", async () => {
      buttons.components.forEach(b => b.setDisabled(true));
      await reply.edit({
        content: "Halloween config panel timed out.",
        embeds: [embed],
        components: [buttons],
      });
    });
  },
};
