const { SlashCommandBuilder, InteractionContextType } = require("discord.js");
const { run } = require("./redeem");

// Legacy alias — /redeem handles both user and server codes now
module.exports = {
    data: new SlashCommandBuilder()
        .setName("guildredeem")
        .setContexts(InteractionContextType.Guild)
        .setDescription("Redeem a RankCore premium code for this server (same as /redeem)")
        .addStringOption(option =>
            option.setName("code")
                .setDescription("Your premium code, e.g. ROCO-XXXX-XXXX-XXXX")
                .setRequired(true)
        ),
    execute: run,
};
