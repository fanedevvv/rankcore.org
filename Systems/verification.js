const capschema   = require("../Schemas/verificationSchema");
const verifyusers = require("../Schemas/verifyusers");
const crypto      = require("crypto");
const cache       = require('../src/lib/cache');
const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require("discord.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a random 6-character alphanumeric captcha code. */
function generateCaptchaCode() {
    return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

module.exports = (client) => {

    // ── InteractionCreate — captcha button + modal submit ─────────────────────
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.guild) return;

        const OWNED_IDS = ["captchaenter", "vermodal"];
        if (!interaction.customId || !OWNED_IDS.includes(interaction.customId)) return;

        // ── CAPTCHA ENTER BUTTON ───────────────────────────────────────────────
        if (interaction.customId === "captchaenter") {
            const verificationdata = await cache.wrap('verification', `config:${interaction.guild.id}`,
                () => capschema.findOne({ Guild: interaction.guild.id }).lean(), 60);

            // If verification isn't configured, tell the user instead of silently failing.
            if (!verificationdata) {
                return interaction.reply({
                    content: "❌ The verification system has not been set up in this server. Please contact a moderator.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Already verified — no need to go through the flow again.
            if (verificationdata.Verified?.includes(interaction.user.id)) {
                return interaction.reply({
                    content: "✅ You have **already** verified in this server!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Generate a fresh code and persist it so the modal-submit handler can check it.
            const code = generateCaptchaCode();
            await verifyusers.findOneAndUpdate(
                { Guild: interaction.guild.id, User: interaction.user.id },
                { Guild: interaction.guild.id, User: interaction.user.id, Key: code },
                { upsert: true, new: true }
            );

            // Try to DM the code to the user.
            let dmSent = false;
            try {
                await interaction.user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x6C53FF)
                            .setTitle("🔐 Your Verification Code")
                            .setDescription(
                                `Your verification code for **${interaction.guild.name}** is:\n\n` +
                                `## \`${code}\`\n\n` +
                                `Enter this code in the modal that just opened. ` +
                                `Do **not** share it with anyone.`
                            )
                            .setFooter({ text: "This code is single-use and tied to your session." })
                            .setTimestamp(),
                    ],
                });
                dmSent = true;
            } catch {
                // DMs are closed — fall back to an ephemeral reply below.
            }

            // Show the modal so the user can type in their code.
            const vermodal = new ModalBuilder()
                .setTitle("Verification")
                .setCustomId("vermodal");

            const answerInput = new TextInputBuilder()
                .setCustomId("answer")
                .setRequired(true)
                .setLabel("Enter your captcha code")
                .setPlaceholder(dmSent ? "Check your DMs for the code" : `Your code: ${code}`)
                .setStyle(TextInputStyle.Short)
                .setMinLength(6)
                .setMaxLength(6);

            vermodal.addComponents(new ActionRowBuilder().addComponents(answerInput));

            // If DMs are closed we cannot show the modal AND send an ephemeral reply in
            // the same response — showModal consumes the response token.  Instead we embed
            // the code in the placeholder so the user can see it in the modal itself.
            await interaction.showModal(vermodal);
        }

        // ── MODAL SUBMIT ───────────────────────────────────────────────────────
        if (interaction.customId === "vermodal") {
            if (!interaction.isModalSubmit()) return;

            const [userverdata, verificationdata] = await Promise.all([
                verifyusers.findOne({ Guild: interaction.guild.id, User: interaction.user.id }),
                cache.wrap('verification', `config:${interaction.guild.id}`,
                    () => capschema.findOne({ Guild: interaction.guild.id }).lean(), 60),
            ]);

            // Guard: system not configured or no captcha was issued for this user.
            if (!verificationdata) {
                return interaction.reply({
                    content: "❌ The verification system is not configured in this server.",
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (!userverdata) {
                return interaction.reply({
                    content: "❌ No verification session found. Please click the **Verify** button again to get a new code.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (verificationdata.Verified?.includes(interaction.user.id)) {
                return interaction.reply({
                    content: "✅ You have **already** verified in this server!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modalAnswer = interaction.fields.getTextInputValue("answer").trim().toUpperCase();
            const storedKey   = (userverdata.Key || "").trim().toUpperCase();

            if (modalAnswer === storedKey) {
                // ── Correct code ─────────────────────────────────────────────
                const verrole       = interaction.guild.roles.cache.get(verificationdata.Role);
                const unverifiedRole = interaction.guild.roles.cache.get(verificationdata.unverifiedRole);

                try {
                    if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
                    if (verrole)        await interaction.member.roles.add(verrole);
                } catch {
                    return interaction.reply({
                        content: "❌ There was an issue updating your roles. Please contact a moderator.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                // Persist verified state and clean up the one-time code.
                await Promise.all([
                    capschema.updateOne(
                        { Guild: interaction.guild.id },
                        { $addToSet: { Verified: interaction.user.id } }
                    ),
                    verifyusers.deleteOne({ Guild: interaction.guild.id, User: interaction.user.id }),
                ]);

                // Log to the configured log channel (non-fatal if missing).
                const channelLog = interaction.guild.channels.cache.get(client.config?.logchannel);
                if (channelLog) {
                    channelLog.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setTitle("✅ Member Verified")
                                .setDescription(`<@${interaction.user.id}> has successfully verified.`)
                                .setTimestamp()
                                .setFooter({ text: "Verification Logs" }),
                        ],
                    }).catch(() => {});
                }

                return interaction.reply({
                    content: "✅ You have been **verified!** Welcome to the server.",
                    flags: MessageFlags.Ephemeral,
                });

            } else {
                // ── Wrong code ───────────────────────────────────────────────
                const channelLog = interaction.guild.channels.cache.get(client.config?.logchannel);
                if (channelLog) {
                    channelLog.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("⚠️ Failed Verification Attempt")
                                .setDescription(
                                    `<@${interaction.user.id}> entered the wrong captcha code. ` +
                                    `Keep an eye on this user.`
                                )
                                .setTimestamp()
                                .setFooter({ text: "Verification Logs" }),
                        ],
                    }).catch(() => {});
                }

                return interaction.reply({
                    content: "❌ **Incorrect code!** Please click the **Verify** button again to receive a new code.",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    });

    // ── GuildMemberAdd — assign unverified role ───────────────────────────────
    client.on(Events.GuildMemberAdd, async (member) => {
        const verificationdata = await cache.wrap('verification', `config:${member.guild.id}`,
            () => capschema.findOne({ Guild: member.guild.id }).lean(), 60);
        if (!verificationdata) return;

        const unverifiedRole = member.guild.roles.cache.get(verificationdata.unverifiedRole);
        if (unverifiedRole) await member.roles.add(unverifiedRole).catch(console.error);
    });

    // ── GuildMemberRemove — clean up verification data ────────────────────────
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            const userId = member.user.id;
            await Promise.all([
                capschema.updateOne(
                    { Guild: member.guild.id },
                    { $pull: { Verified: userId } }
                ),
                verifyusers.deleteOne({ Guild: member.guild.id, User: userId }),
            ]);
        } catch (err) {
            console.error("[Verification] GuildMemberRemove error:", err);
        }
    });
};