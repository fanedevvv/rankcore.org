const { SlashCommandBuilder } = require('discord.js');
const check = require('./compatibility/check');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compatibility')
    .setDescription('Check the love compatibility between two people <:Red_Heart:1555544329605615758>')

    // ── Option A: two Discord users ───────────────────────────────────────
    .addUserOption(o =>
      o.setName('user1')
        .setDescription('First person (Discord user)')
        .setRequired(false)
    )
    .addUserOption(o =>
      o.setName('user2')
        .setDescription('Second person (Discord user)')
        .setRequired(false)
    )

    // ── Option B: two free-text names ─────────────────────────────────────
    .addStringOption(o =>
      o.setName('name1')
        .setDescription('First name (if not using a Discord user)')
        .setRequired(false)
        .setMaxLength(32)
    )
    .addStringOption(o =>
      o.setName('name2')
        .setDescription('Second name (if not using a Discord user)')
        .setRequired(false)
        .setMaxLength(32)
    ),

  async execute(interaction, client) {
    return check.execute(interaction, client);
  },
};