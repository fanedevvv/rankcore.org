const { parseEmoji } = require('discord.js');
const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require("discord.js");
const marriageSchema = require("../../../Schemas/marriageSchema");
const { grantAchievement } = require("./helpers");
const { ACHIEVEMENTS } = require("./constants");

module.exports = {
  async execute(interaction, client) {
    const intUser = interaction.user;
    const user = interaction.options.getUser("person");

    if (intUser.id === user.id)
      return interaction.reply({ content: "💍 You can't propose to yourself!", flags: MessageFlags.Ephemeral });

    const intUserData = await marriageSchema.findOne({ marriedUser: intUser.id });
    const userData    = await marriageSchema.findOne({ marriedUser: user.id });

    if (intUserData) {
      const c = new ContainerBuilder().setAccentColor(0xED4245)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `## <:Red_Heart:1555544329605615758> Already Married\nYou are already married! Use \`/family divorce\` first.`
        ));
      return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
    }
    if (userData) {
      const c = new ContainerBuilder().setAccentColor(0xED4245)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `## <:Red_Heart:1555544329605615758> Already Taken\n**${user.username}** is already married to someone else!`
        ));
      return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
    }

    // ─── Proposal message ───────────────────────────────────────────────────
    const container = new ContainerBuilder()
      .setAccentColor(0xFF73FA)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 💍 Marriage Proposal`),
            new TextDisplayBuilder().setContent(
              `**${intUser.username}** is down on one knee proposing to **${user.username}**!\n\n` +
              `> *Will you accept this heartfelt proposal and start a new chapter together?*`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(intUser.displayAvatarURL({ size: 256 })))
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# ${user} — Only you can respond to this proposal!`
      ))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("accept").setLabel("I Do! 💍").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("no").setLabel("I Don't").setEmoji(parseEmoji('<:Red_Heart:1555544329605615758>')).setStyle(ButtonStyle.Danger)
        )
      );

container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`${user}`)
);

const msg = await interaction.reply({
  flags: MessageFlags.IsComponentsV2,
  components: [container],
  allowedMentions: { parse: ["users"] },
  fetchReply: true,
});

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id)
        return i.reply({ content: `Only ${user} can respond to this proposal!`, flags: MessageFlags.Ephemeral });
      collector.stop();

      let result;
      if (i.customId === "accept") {
        const now = new Date();
        await marriageSchema.create({ marriedUser: user.id,    marriedTo: intUser.id, marriedSince: now });
        await marriageSchema.create({ marriedUser: intUser.id, marriedTo: user.id,    marriedSince: now });
        await grantAchievement(intUser.id, ACHIEVEMENTS.FIRST_MARRIAGE, interaction.channel);
        await grantAchievement(user.id,    ACHIEVEMENTS.FIRST_MARRIAGE, interaction.channel);

        result = new ContainerBuilder().setAccentColor(0x57F287)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## <:boost:1555544362455146576> Just Married!`),
                new TextDisplayBuilder().setContent(
                  `**${intUser.username}** & **${user.username}** are officially married! <:boost:1555544362455146576>\n\n` +
                  `> *May your bond be forever strong. Congratulations!*\n\n` +
                  `-# Married since <t:${Math.floor(now.getTime() / 1000)}:D>`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })))
          );
      } else {
        result = new ContainerBuilder().setAccentColor(0xED4245)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## <:Red_Heart:1555544329605615758> Proposal Rejected`),
                new TextDisplayBuilder().setContent(
                  `**${user.username}** didn't want to marry **${intUser.username}**.\n\n` +
                  `> *Plenty of fish in the sea...*`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })))
          );
      }

      await i.update({ components: [result] });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        const expired = new ContainerBuilder().setAccentColor(0x95A5A6)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## <:1430986244921495654:1555544239792980044> Proposal Expired\nThe marriage proposal timed out. Maybe next time!`
            )
          );
        await interaction.editReply({ components: [expired] });
      }
    });
  },
};
