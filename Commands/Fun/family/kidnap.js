const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder, MessageFlags,
} = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");
const Items          = require("../../../Schemas/itemsSchema");
const { grantAchievement } = require("./helpers");
const { ACHIEVEMENTS, KIDNAP_COOLDOWN, BASE_KIDNAP_CHANCE } = require("./constants");

// Dramatic story lines for success / fail
const SUCCESS_STORIES = [
  "After a daring chase through the city, {kidnapper} cornered {victim} and whisked them away!",
  "{kidnapper} slipped a forged adoption certificate under the door and walked off with {victim}.",
  "Using nothing but a trench coat and a fake moustache, {kidnapper} fooled everyone and snatched {victim}.",
  "{kidnapper} lured {victim} with free pizza, and the rest is history.",
  "With precision timing, {kidnapper} executed a flawless snatch-and-dash on {victim}.",
];

const FAIL_STORIES = [
  "{kidnapper} tripped over their own shoelaces and {victim} called the authorities!",
  "{victim} had a black belt. {kidnapper} did not. It did not go well.",
  "The getaway scooter wouldn't start and {victim} waved goodbye from a safe distance.",
  "{kidnapper}'s disguise fell off at the worst possible moment. {victim} snapped a photo and ran.",
  "{kidnapper} accidentally dialed 911 instead of the escape driver. Mission failed.",
];

function pickStory(arr, kidnapper, victim) {
  const s = arr[Math.floor(Math.random() * arr.length)];
  return s.replace("{kidnapper}", `**${kidnapper}**`).replace("{victim}", `**${victim}**`);
}

module.exports = {
  async execute(interaction, client) {
    const kidnapper = interaction.user;
    const victim    = interaction.options.getUser("victim");

    if (kidnapper.id === victim.id)
      return interaction.reply({ content: "🤦 You can't kidnap yourself!", flags: MessageFlags.Ephemeral });

    const existing = await adoptionSchema.findOne({ child: victim.id });
    if (existing)
      return interaction.reply({ content: `${victim} is already adopted — you can't kidnap them!`, flags: MessageFlags.Ephemeral });

    // ─── Cooldown check ───────────────────────────────────────────────────
    let kidnapperData = await Items.findOne({ userId: kidnapper.id });
    if (kidnapperData?.lastKidnap && Date.now() - kidnapperData.lastKidnap < KIDNAP_COOLDOWN) {
      const readyAt = Math.floor((kidnapperData.lastKidnap + KIDNAP_COOLDOWN) / 1000);
      const c = new ContainerBuilder().setAccentColor(0xE67E22)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## <:n_loading:1555544489194688623> On Cooldown\nYou need to lay low for a bit!\n\n> You can try again <t:${readyAt}:R>.`
          )
        );
      return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c], flags: MessageFlags.Ephemeral });
    }

    // ─── Show "planning" stage ────────────────────────────────────────────
    const planContainer = new ContainerBuilder().setAccentColor(0xE67E22)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 😈 Kidnap Initiated`),
            new TextDisplayBuilder().setContent(
              `**${kidnapper.username}** is hatching a scheme to kidnap **${victim.username}**...\n\n` +
              `> *The operation is underway. Will it succeed?*`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(victim.displayAvatarURL({ size: 256 })))
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Base success chance: ${Math.round(BASE_KIDNAP_CHANCE * 100)}%`));

    await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [planContainer] });

    // Dramatic delay
    await new Promise((r) => setTimeout(r, 2500));

    // ─── Update cooldown ──────────────────────────────────────────────────
    if (!kidnapperData) {
      kidnapperData = await Items.create({ userId: kidnapper.id, lastKidnap: new Date() });
    } else {
      kidnapperData.lastKidnap = new Date();
      await kidnapperData.save();
    }

    const success = Math.random() < BASE_KIDNAP_CHANCE;

    if (success) {
      await adoptionSchema.create({
        parent: kidnapper.id,
        child: victim.id,
        adoptionDate: new Date(),
        isKidnapped: true,
        kidnapperId: kidnapper.id,
      });

      await grantAchievement(kidnapper.id, ACHIEVEMENTS.FIRST_ADOPTION, interaction.channel);
      const children = await adoptionSchema.find({ parent: kidnapper.id });
      if (children.length >= 3)
        await grantAchievement(kidnapper.id, ACHIEVEMENTS.BIG_FAMILY, interaction.channel);

      const result = new ContainerBuilder().setAccentColor(0x57F287)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## <a:tickyy:1555544712687915008> Kidnap Successful!`),
              new TextDisplayBuilder().setContent(
                pickStory(SUCCESS_STORIES, kidnapper.username, victim.username) + "\n\n" +
                `> **${victim.username}** is now part of **${kidnapper.username}**'s family!`
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(kidnapper.displayAvatarURL({ size: 256 })))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Their original family can use \`/family counterkidnap\` to get them back!`
          )
        );

      await interaction.editReply({ components: [result] });
    } else {
      const result = new ContainerBuilder().setAccentColor(0xED4245)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## 🚔 Kidnap Failed!`),
              new TextDisplayBuilder().setContent(
                pickStory(FAIL_STORIES, kidnapper.username, victim.username) + "\n\n" +
                `> **${victim.username}** escaped! You've been made.`
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(victim.displayAvatarURL({ size: 256 })))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Your cooldown has still been used. Plan better next time!`
          )
        );

      await interaction.editReply({ components: [result] });
    }
  },
};
