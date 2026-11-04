const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder, MessageFlags,
} = require("discord.js");
const marriageSchema  = require("../../../Schemas/marriageSchema");
const adoptionSchema  = require("../../../Schemas/adoptionSchema");

module.exports = {
  async execute(interaction, client) {
    const user = interaction.options.getUser("user") || interaction.user;

    const [marriageData, adoptedByData, childrenData] = await Promise.all([
      marriageSchema.findOne({ marriedUser: user.id }),
      adoptionSchema.findOne({ child: user.id }),
      adoptionSchema.find({ parent: user.id }),
    ]);

    // ─── Build family lines ──────────────────────────────────────────────
    const marriageStatus = marriageData
      ? `💍 Married to <@${marriageData.marriedTo}> since <t:${Math.floor(marriageData.marriedSince.getTime() / 1000)}:D>`
      : `<:Red_Heart:1555544329605615758> **Not married** — Use \`/family marry\` to find your love!`;

    const parentStatus = adoptedByData
      ? `👨‍👩‍👧 Adopted by <@${adoptedByData.parent}> since <t:${Math.floor(adoptedByData.adoptionDate.getTime() / 1000)}:D>`
      : `🚪 **No parent** — Still finding their way in the world!`;

    const childLines = childrenData.length
      ? childrenData.map((c) => {
          const tag = c.grounded
            ? `<:lockk:1555544494441635860> <@${c.child}> *(grounded until <t:${Math.floor(c.groundedUntil.getTime() / 1000)}:R>)*`
            : c.isKidnapped
            ? `😱 <@${c.child}> *(kidnapped!)*`
            : `👶 <@${c.child}>`;
          return tag;
        }).join("\n")
      : `*No children yet — Use \`/family adopt\` to grow your family!*`;

    // ─── Container ───────────────────────────────────────────────────────
    const container = new ContainerBuilder()
      .setAccentColor(0xF1C40F)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:n_home:1555544468193546270> ${user.username}'s Family`),
            new TextDisplayBuilder().setContent(marriageStatus),
            new TextDisplayBuilder().setContent(parentStatus)
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })))
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 👶 Children (${childrenData.length})`),
        new TextDisplayBuilder().setContent(childLines)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Use \`/family stats\` for detailed family stats or \`/family achievements\` to see earned badges.`
        )
      );

    return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};
