const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder, MessageFlags,
} = require("discord.js");
const achievementSchema = require("../../../Schemas/achievementSchema");
const { ACHIEVEMENTS }  = require("./constants");

// Map achievement IDs to display info
const ACHIEVEMENT_META = {
  [ACHIEVEMENTS.FIRST_MARRIAGE]: { emoji: "💍", desc: "Tied the knot for the first time." },
  [ACHIEVEMENTS.FIRST_ADOPTION]: { emoji: "👶", desc: "Welcomed your first child." },
  [ACHIEVEMENTS.BIG_FAMILY]:     { emoji: "👨‍👩‍👧‍👦", desc: "Built a family with 3+ children." },
  [ACHIEVEMENTS.LOVING_COUPLE]:  { emoji: "<:Red_Heart:1555544329605615758>", desc: "Stayed married for 7+ days." },
  [ACHIEVEMENTS.KIDNAPPER]:      { emoji: "😈", desc: "Successfully kidnapped 5+ times." },
  [ACHIEVEMENTS.GUIDING_LIGHT]:  { emoji: "<:boost:1555544362455146576>", desc: "Used Parental Guidance 10+ times." },
};

module.exports = {
  async execute(interaction, client) {
    const user = interaction.options.getUser("user") || interaction.user;
    const data = await achievementSchema.findOne({ userId: user.id });

    const earned   = data?.achievements || [];
    const allKeys  = Object.values(ACHIEVEMENTS);
    const unearned = allKeys.filter((a) => !earned.includes(a));

    // ─── Build earned lines ───────────────────────────────────────────────
    const earnedLines = earned.length
      ? earned.map((a) => {
          const meta = ACHIEVEMENT_META[a] || { emoji: "<:1430986209995526274:1555544172302307449>", desc: "A special achievement." };
          return `${meta.emoji} **${a}**\n-# ${meta.desc}`;
        }).join("\n\n")
      : "*No achievements yet! Start building your family.*";

    // ─── Build locked lines ───────────────────────────────────────────────
    const lockedLines = unearned.length
      ? unearned.map((a) => {
          const meta = ACHIEVEMENT_META[a] || { emoji: "<:lockk:1555544494441635860>", desc: "???" };
          return `<:lockk:1555544494441635860> ~~${a}~~\n-# ${meta.desc}`;
        }).join("\n\n")
      : "*You've earned everything! Incredible!*";

    const progress = `${earned.length} / ${allKeys.length} unlocked`;

    const container = new ContainerBuilder()
      .setAccentColor(0xE91E63)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:1430986209995526274:1555544172302307449> Achievements — ${user.username}`),
            new TextDisplayBuilder().setContent(`**Progress:** ${progress}`)
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })))
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <a:tickyy:1555544712687915008> Earned`),
        new TextDisplayBuilder().setContent(earnedLines)
      );

    if (unearned.length) {
      container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### <:lockk:1555544494441635860> Locked`),
          new TextDisplayBuilder().setContent(lockedLines)
        );
    }

    return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};
