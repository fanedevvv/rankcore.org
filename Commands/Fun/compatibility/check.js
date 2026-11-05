const { parseEmoji } = require('discord.js');
const {
  EmbedBuilder, AttachmentBuilder, MessageFlags,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
} = require('discord.js');
const { generateCompatibilityImage } = require('./generateimage');
const { getCheesyLine } = require('./lines');

const TIER_EMOJIS = {
  doomed: '💀', rocky: '🌪️', potential: '<:eco:1567796967197900842>',
  lovely: '<:Red_Heart:1567796949271191642>', soulmates: '<:Red_Heart:1567796949271191642>', perfect: '💍',
};
const TIER_COLORS = {
  doomed: 0x8b1a1a, rocky: 0x7a3500, potential: 0x5a4a00,
  lovely: 0x3d007a, soulmates: 0xe8003d, perfect: 0xff00cc,
};

// ── Shared result builder ─────────────────────────────────────────────────────

async function buildResult(nameA, nameB) {
  const percent = Math.floor(Math.random() * 100) + 1;
  const seed    = Math.floor(Math.random() * 1000);
  const { line, tier } = getCheesyLine(nameA, nameB, percent, seed);

  const imageBuffer = generateCompatibilityImage(nameA, nameB, percent, tier, line);
  const attachment  = new AttachmentBuilder(imageBuffer, { name: 'compatibility.png' });

  const embed = new EmbedBuilder()
    .setColor(TIER_COLORS[tier] ?? 0xe8003d)
    .setTitle(`${TIER_EMOJIS[tier] ?? '<:Red_Heart:1567796949271191642>'} ${nameA} & ${nameB}`)
    .setDescription(`*"${line}"*`)
    .setImage('attachment://compatibility.png')
    .setFooter({ text: 'Results are ~scientifically~ determined 🔬' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`compat_reroll__${nameA}__${nameB}`)
      .setLabel('Try Again').setEmoji(parseEmoji('<:n_add:1567796983408754731>'))
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, attachment, row };
}

// ── Slash command handler ─────────────────────────────────────────────────────

module.exports = {
  async execute(interaction, client) {
    const userA = interaction.options.getUser('user1');
    const userB = interaction.options.getUser('user2');
    const strA  = interaction.options.getString('name1');
    const strB  = interaction.options.getString('name2');

    const nameA = userA ? (userA.displayName ?? userA.username) : strA;
    const nameB = userB ? (userB.displayName ?? userB.username) : strB;

    // BUG FIX: The early reply for missing names was followed by deferReply()
    // running unconditionally due to broken brace placement, causing
    // InteractionAlreadyReplied on every invocation without both names.
    // The return here exits before deferReply() is reached — correct behaviour.
    if (!nameA || !nameB) {
      return interaction.reply({
        content: 'Please provide either two users **or** two names.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Only defer if we haven't already replied (safe guard).
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    let result;
    try {
      result = await buildResult(nameA, nameB);
    } catch (err) {
      console.error('[Compatibility] Image generation failed:', err);
      return interaction.editReply({ content: '<:Red_Heart:1567796949271191642> Something went wrong generating the image.' });
    }

    const msg = await interaction.editReply({
      embeds:     [result.embed],
      files:      [result.attachment],
      components: [result.row],
    });

    // ── Button collector ──────────────────────────────────────────────────────
    // Only the invoker + the two mentioned users can reroll.
    const allowed = new Set([
      interaction.user.id,
      userA?.id,
      userB?.id,
    ].filter(Boolean));

    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith('compat_reroll__') && allowed.has(i.user.id),
      time:   5 * 60_000, // 5 minutes
    });

    collector.on('collect', async (btnInteraction) => {
      // Names are encoded in the button ID — no closure needed
      const [, , a, b] = btnInteraction.customId.split('__');

      await btnInteraction.deferUpdate();

      let rerolled;
      try {
        rerolled = await buildResult(a, b);
      } catch (err) {
        console.error('[Compatibility] Reroll failed:', err);
        return btnInteraction.followUp({
          content: '<:Red_Heart:1567796949271191642> Something went wrong. Try again!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await btnInteraction.editReply({
        embeds:     [rerolled.embed],
        files:      [rerolled.attachment],
        components: [rerolled.row],
      });
    });

    collector.on('end', async () => {
      // Disable the button once the 5-minute window closes
      const disabled = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('compat_reroll_expired')
          .setLabel('Try Again').setEmoji(parseEmoji('<:n_add:1567796983408754731>'))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );
      await msg.edit({ components: [disabled] }).catch(() => {});
    });
  },
};
