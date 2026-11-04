const ghostSchema = require("../Schemas/ghostpingSchema");
const numSchema = require("../Schemas/ghostNum");
const { Events, MessageFlags, MessageType, PermissionsBitField } = require('discord.js');

module.exports = (client) => {
    client.on(Events.MessageDelete, async (message) => {
        if (message.guild === null) return;

        const Data = await ghostSchema.findOne({ Guild: message.guild.id });
        if (!Data) return;

        if (!message.author) return;
        if (message.author.bot) return;
        if (!message.author.id === client.user.id) return;
        if (message.author === message.mentions.users.first()) return;

        if (message.mentions.users.first() || message.type === MessageType.reply) {
            let number;
            let time = 15;

            const data = await numSchema.findOne({
                Guild: message.guild.id,
                User: message.author.id,
            });

            if (!data) {
                await numSchema.create({
                    Guild: message.guild.id,
                    User: message.author.id,
                    Number: 1,
                });

                number = 1;
            } else {
                data.Number += 1;
                await data.save();

                number = data.Number;
            }

            if (number == 2) time = 60;
            if (number >= 3) time = 500;

            const msg = await message.channel.send({
                content: `${message.author}, you cannot ghost ping members within this server!`,
            });

            setTimeout(() => msg.delete(), 5000);

            const member = message.member;

            if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return;
            } else {
                await member.timeout(time * 1000, "Ghost Pinging");
                await member.send({
                    content: `You have been timed out in ${message.guild.name} for ${time} seconds due to ghost pinging members`,
                }).catch((err) => {
                    return;
                });
            }
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */