const { SlashCommandBuilder, InteractionContextType, EmbedBuilder, MessageFlags } = require("discord.js");
const { redeemCode, DURATIONS } = require("../../Utils/redeemCodes");
const { getTier } = require("../../Utils/premiumTiers");

const LIFETIME_MS = 50 * 365 * 86_400_000;

// Shared by /redeem and the legacy /guildredeem alias
async function run(interaction) {
    const result = await redeemCode({
        code:    interaction.options.getString("code"),
        userId:  interaction.user.id,
        guildId: interaction.guildId,
    });

    if (!result.ok) {
        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xef4444)
                .setDescription(`<:cross:1467859453121658982> ${result.error}`)],
            flags: MessageFlags.Ephemeral,
        });
    }

    const tier    = getTier(result.tier);
    const forWhom = result.target === "guild" ? `**${interaction.guild.name}**` : "your account";
    const expires = result.expiresAt - Date.now() > LIFETIME_MS
        ? "Never (lifetime)"
        : `<t:${Math.floor(result.expiresAt / 1000)}:D> (<t:${Math.floor(result.expiresAt / 1000)}:R>)`;

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor(tier.color)
            .setDescription(
                `## <:premium:1467910095911256198> Premium activated!\n` +
                `**${tier.name}** is now active on ${forWhom}.\n\n` +
                `<:star:1467885469928001557> **Plan:** ${tier.name}\n` +
                `<:time:1467826155217354834> **Duration:** ${DURATIONS[result.duration].label}\n` +
                `<:calendar:1555544372953616426> **Expires:** ${expires}`
            )
            .setFooter({ text: "Thanks for supporting Roco! • /premium status" })],
        flags: MessageFlags.Ephemeral,
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("redeem")
        .setContexts(InteractionContextType.Guild)
        .setDescription("Redeem a Roco premium code")
        .addStringOption(option =>
            option.setName("code")
                .setDescription("Your premium code, e.g. ROCO-XXXX-XXXX-XXXX")
                .setRequired(true)
        ),
    run,
    execute: run,
};
