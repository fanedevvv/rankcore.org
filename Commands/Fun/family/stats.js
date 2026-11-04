const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder, MessageFlags,
} = require("discord.js");
const marriageSchema    = require("../../../Schemas/marriageSchema");
const adoptionSchema    = require("../../../Schemas/adoptionSchema");
const achievementSchema = require("../../../Schemas/achievementSchema");
const Items             = require("../../../Schemas/itemsSchema");

module.exports = {
  async execute(interaction, client) {
    const user = interaction.options.getUser("user") || interaction.user;

    const [marriageData, children, adoptedBy, achievements, items] = await Promise.all([
      marriageSchema.findOne({ marriedUser: user.id }),
      adoptionSchema.find({ parent: user.id }),
      adoptionSchema.findOne({ child: user.id }),
      achievementSchema.findOne({ userId: user.id }),
      Items.findOne({ userId: user.id }),
    ]);

    // ─── Marriage duration ───────────────────────────────────────────────
    let marriedLine = "<:Red_Heart:1555544329605615758> Not married";
    if (marriageData) {
      const days = Math.floor((Date.now() - marriageData.marriedSince.getTime()) / 86400000);
      marriedLine = `💍 <@${marriageData.marriedTo}> — married **${days}** day${days !== 1 ? "s" : ""} ago`;
    }

    // ─── Children summary ─────────────────────────────────────────────────
    const grounded   = children.filter((c) => c.grounded).length;
    const kidnapped  = children.filter((c) => c.isKidnapped).length;
    const childLine  = children.length
      ? `**${children.length}** child${children.length !== 1 ? "ren" : ""} ` +
        `${grounded ? `• <:lockk:1555544494441635860> ${grounded} grounded` : ""} ${kidnapped ? `• 😱 ${kidnapped} kidnapped` : ""}`.trim()
      : "No children yet";

    const parentLine = adoptedBy
      ? `Adopted by <@${adoptedBy.parent}> since <t:${Math.floor(adoptedBy.adoptionDate.getTime() / 1000)}:D>`
      : "No parent";

    // ─── Items & achievements ─────────────────────────────────────────────
    const confiscated    = items?.confiscated?.length || 0;
    const achieveCount   = achievements?.achievements?.length || 0;
    const guidanceCount  = achievements?.guidanceCount || 0;

    // ─── Tier label ───────────────────────────────────────────────────────
    const totalFamily = children.length + (marriageData ? 1 : 0);
    const tier =
      totalFamily >= 10 ? "<:1430986209995526274:1555544172302307449> Dynasty"
      : totalFamily >= 5  ? "<:boost:1555544362455146576> Big Family"
      : totalFamily >= 2  ? "<:n_home:1555544468193546270> Growing"
      : "<:eco:1555544429253890050> Starting Out";

    // ─── Container ────────────────────────────────────────────────────────
    const container = new ContainerBuilder()
      .setAccentColor(0x3498DB)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:n_utils:1555544669545431062> Family Stats — ${user.username}`),
            new TextDisplayBuilder().setContent(`**Family Tier:** ${tier}`)
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })))
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:Red_Heart:1555544329605615758> Relationships`),
        new TextDisplayBuilder().setContent(
          `${marriedLine}\n` +
          `👨‍👩‍👧 ${childLine}\n` +
          `🧑‍🤝‍🧑 ${parentLine}`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### <:1430986209995526274:1555544172302307449> Activity`),
        new TextDisplayBuilder().setContent(
          `<:1430986209995526274:1555544172302307449> Achievements: **${achieveCount}**\n` +
          `<:Currency:1555544251268595792> Guidance given: **${guidanceCount}** time${guidanceCount !== 1 ? "s" : ""}\n` +
          `<:ban:1555544356352430202> Items confiscated: **${confiscated}**`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Use \`/family achievements\` to see the full achievement list.`
        )
      );

    return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};
