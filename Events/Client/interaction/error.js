const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors
} = require("discord.js");

const {
    errorSpamMap,
    ERROR_LIMIT,
    ERROR_RESET_TIME
} = require("./state");

const { isDead } = require('./safeInteraction');

module.exports = async function handleError(interaction, client, error) {
  // Never try to respond to an expired interaction
  if (isDead(error)) return;
    console.error(error);

    // --------------------------------------------------
    // Determine Error Code (UNCHANGED)
    // --------------------------------------------------
    let errorCode = 300;
    const msg = error.message || "";

    if (msg.includes('Missing Permissions') || error.code === 50013)
        errorCode = 302;
    else if (msg.includes('Invalid args'))
        errorCode = 303;
    else if (msg.includes('Cooldown'))
        errorCode = 304;
    else if (msg.includes('fetch'))
        errorCode = 310;

    // --------------------------------------------------
    // Error Spam Protection (UNCHANGED)
    // --------------------------------------------------
    if (interaction.isChatInputCommand()) {
        const key = `${interaction.user.id}:${interaction.commandName}`;
        const data = errorSpamMap.get(key) || { count: 0, timeout: null };

        data.count++;

        if (!data.timeout) {
            data.timeout = setTimeout(
                () => errorSpamMap.delete(key),
                ERROR_RESET_TIME
            );
        }

        errorSpamMap.set(key, data);

        if (data.count >= ERROR_LIMIT) {
            if (!interaction.replied && !interaction.deferred) {
                return interaction
                    .reply({
                        content: "<:error:1555544434601369620> Command disabled temporarily due to repeated errors.",
                        ephemeral: true
                    })
                    .catch(() => {});
            }
            return;
        }
    }

    // --------------------------------------------------
    // Log Error (UNCHANGED)
    // --------------------------------------------------
    const channel = client.channels.cache.get(
        client.config.slashCommandLoggingChannel
    );

    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle("Command Error")
            .addFields(
                { name: "User", value: interaction.user.tag },
                {
                    name: "Command",
                    value: interaction.commandName || "Unknown"
                },
                { name: "Code", value: `${errorCode}` },
                {
                    name: "Stack",
                    value: `\`\`\`${String(error.stack).slice(0, 1000)}\`\`\``
                }
            )
            .setColor(Colors.Red)
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    }

    // --------------------------------------------------
    // User Response (UNCHANGED)
    // --------------------------------------------------
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("show_error_codes")
            .setLabel("Error Codes")
            .setStyle(ButtonStyle.Primary)
    );

    const content = `An error occurred. Code: \`${errorCode}\``;

    if (interaction.replied || interaction.deferred) {
        await interaction
            .editReply({
                content,
                components: [row]
            })
            .catch(() => {});
    } else {
        await interaction
            .reply({
                content,
                components: [row],
                ephemeral: true
            })
            .catch(() => {});
    }
};
