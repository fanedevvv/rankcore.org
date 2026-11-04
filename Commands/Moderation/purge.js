const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

const countOption = o => o.setName("count").setDescription("Number of messages to delete (max 100).").setMinValue(1).setMaxValue(100).setRequired(true);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purge").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDescription("Bulk-delete messages in this channel.")
    .addSubcommand(s => s.setName("all").setDescription("Delete any messages.").addIntegerOption(countOption))
    .addSubcommand(s => s.setName("user").setDescription("Delete messages from a specific user.")
      .addIntegerOption(countOption).addUserOption(o => o.setName("user").setDescription("Target user.").setRequired(true)))
    .addSubcommand(s => s.setName("bot").setDescription("Delete bot messages.").addIntegerOption(countOption))
    .addSubcommand(s => s.setName("links").setDescription("Delete messages containing links.").addIntegerOption(countOption))
    .addSubcommand(s => s.setName("caps").setDescription("Delete messages with excessive caps.").addIntegerOption(countOption))
    .addSubcommand(s => s.setName("images").setDescription("Delete messages with images or attachments.").addIntegerOption(countOption))
    .addSubcommand(s => s.setName("mentions").setDescription("Delete messages with mentions.").addIntegerOption(countOption))
    .addSubcommand(s => s.setName("embeds").setDescription("Delete messages with embeds.").addIntegerOption(countOption)),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub   = interaction.options.getSubcommand();
    const count = interaction.options.getInteger("count");
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    const ephErr = (title, body) => interaction.editReply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.IsComponentsV2,
    });

    let messages;
    try {
      messages = await interaction.channel.messages.fetch({ limit: Math.min(count, 100) });
    } catch {
      return ephErr("Fetch Error", "Could not fetch messages in this channel.");
    }

    // 14-day filter (Discord won't bulk delete older)
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

    const filters = {
      all:      () => true,
      user:     m => m.author.id === interaction.options.getUser("user").id,
      bot:      m => m.author.bot,
      links:    m => /https?:\/\//i.test(m.content),
      caps:     m => { const letters = m.content.replace(/[^a-zA-Z]/g, ""); return letters.length > 5 && (letters.match(/[A-Z]/g) || []).length / letters.length > 0.7; },
      images:   m => m.attachments.size > 0 || /\.(png|jpg|jpeg|gif|webp)/i.test(m.content),
      mentions: m => m.mentions.users.size > 0 || m.mentions.roles.size > 0,
      embeds:   m => m.embeds.length > 0,
    };

    const filtered = messages.filter(filters[sub] || (() => true));
    if (!filtered.size)
      return ephErr("No Messages Found", `No messages matched the **${sub}** filter in the last ${count} messages.`);

    const deleted = await interaction.channel.bulkDelete(filtered, true).catch(() => null);
    const deletedCount = deleted?.size ?? 0;

    return interaction.editReply({
      components: [successContainer("<:del:1555544395720302643>  Messages Purged",
        `Successfully deleted **${deletedCount}** message(s) using the **${sub}** filter.`, {
          accent, clientId: client.user.id,
          extra: `**Filter** — \`${sub}\`\n**Requested** — ${count}\n**Deleted** — ${deletedCount}\n**Moderator** — ${interaction.user.tag}`,
          footer: `Messages older than 14 days cannot be bulk-deleted.`,
        })],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
