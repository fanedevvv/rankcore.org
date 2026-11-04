const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionsBitField,
    ButtonStyle,
} = require('discord.js');
const roleSchema = require("../Schemas/autorole");
const cache = require('../src/lib/cache');

module.exports = (client) => {
    client.on("guildMemberAdd", async (member) => {
        const { guild } = member;
      
        const data = await cache.wrap('autorole', `config:${guild.id}`,
          () => roleSchema.findOne({ GuildID: guild.id }).lean(), 60);
        if (!data) return;
        if (data.Roles.length < 0) return;
        for (const r of data.Roles) {
          await member.roles.add(r);
        }
      });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */