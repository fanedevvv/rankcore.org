const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");
const adoptionSchema  = require("../../../Schemas/adoptionSchema");
const marriageSchema  = require("../../../Schemas/marriageSchema");

const MEDALS = ["<:1430986209995526274:1555544172302307449>", "<:1430986209995526274:1555544172302307449>", "<:1430986209995526274:1555544172302307449>", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

module.exports = {
  async execute(interaction, client) {
    await interaction.deferReply();

    // Count children per parent
    const allAdoptions = await adoptionSchema.find({});
    const counts = {};
    for (const doc of allAdoptions) {
      counts[doc.parent] = (counts[doc.parent] || 0) + 1;
    }

    // Sort by child count desc
    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    if (!sorted.length) {
      const c = new ContainerBuilder().setAccentColor(0x95A5A6)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## <:1430986209995526274:1555544172302307449> Family Leaderboard\n*No families found yet! Use \`/family adopt\` to start one.*`)
        );
      return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
    }

    // Fetch usernames
    const rows = await Promise.all(
      sorted.map(async ([userId, count], i) => {
        const marriageData = await marriageSchema.findOne({ marriedUser: userId });
        let name;
        try {
          const member = await interaction.guild.members.fetch(userId).catch(() => null);
          name = member?.displayName || `Unknown (${userId.slice(0, 6)}…)`;
        } catch {
          name = `Unknown (${userId.slice(0, 6)}…)`;
        }
        const partnerLine = marriageData ? ` *(💍 married)*` : "";
        return `${MEDALS[i] || `${i + 1}.`} **${name}**${partnerLine} — **${count}** child${count !== 1 ? "ren" : ""}`;
      })
    );

    const podium = rows.slice(0, 3).join("\n");
    const rest   = rows.slice(3).join("\n") || null;

    const container = new ContainerBuilder()
      .setAccentColor(0xF1C40F)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:1430986209995526274:1555544172302307449> Family Leaderboard\n*The biggest families in the server:*`)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(podium));

    if (rest) {
      container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(rest));
    }

    container.addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Updated just now • Use \`/family adopt\` to climb the ranks!`
        )
      );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};
