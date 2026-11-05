const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Colors,
} = require("discord.js");
const Report = require("../../Schemas/ReportSchema");

const CATEGORY_LABELS = {
    abuse:         "<:LEred:1567796934545121280> Abuse / Harassment",
    spam:          "<:announcement:1567796950265241662> Spam / Flooding",
    scam:          "<:Currency:1567796932041121873> Scam / Phishing",
    impersonation: "<:minigames:1567796978929238076> Impersonation",
    nsfw:          "<:restrict:1567797003638022166> NSFW / Inappropriate",
    cheating:      "<:minigames:1567796978929238076> Cheating / Exploiting",
    other:         "<:question:1567797002555621406> Other",
};

const CATEGORY_COLORS = {
    abuse:         0xef4444,
    spam:          0xf97316,
    scam:          0xeab308,
    impersonation: 0xa855f7,
    nsfw:          0xec4899,
    cheating:      0x3b82f6,
    other:         0x64748b,
};

// ── Anti-abuse: 3 reports per user per 24h ────────────────────────────────────
const RATE_LIMIT_MS  = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

async function checkRateLimit(reporterId) {
    const since = new Date(Date.now() - RATE_LIMIT_MS);
    const count = await Report.countDocuments({ reporterId, createdAt: { $gte: since } });
    return count < RATE_LIMIT_MAX;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("report")
        .setDescription("Report a user or server to the RankCore moderation team")
        .addSubcommand(sub =>
            sub.setName("user")
                .setDescription("Report a Discord user")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("The user you want to report")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("category")
                        .setDescription("Type of report")
                        .setRequired(true)
                        .addChoices(
                            { name: "<:LEred:1567796934545121280> Abuse / Harassment",  value: "abuse" },
                            { name: "<:announcement:1567796950265241662> Spam / Flooding",     value: "spam" },
                            { name: "<:Currency:1567796932041121873> Scam / Phishing",     value: "scam" },
                            { name: "<:minigames:1567796978929238076> Impersonation",       value: "impersonation" },
                            { name: "<:restrict:1567797003638022166> NSFW / Inappropriate",value: "nsfw" },
                            { name: "<:minigames:1567796978929238076> Cheating / Exploiting",value: "cheating" },
                            { name: "<:question:1567797002555621406> Other",               value: "other" },
                        )
                )
                .addStringOption(opt =>
                    opt.setName("reason")
                        .setDescription("Describe what happened (max 1000 characters)")
                        .setRequired(true)
                        .setMaxLength(1000)
                )
                .addStringOption(opt =>
                    opt.setName("evidence")
                        .setDescription("Link to evidence (message URL, screenshot, etc.) — optional")
                        .setRequired(false)
                        .setMaxLength(500)
                )
        )
        .addSubcommand(sub =>
            sub.setName("server")
                .setDescription("Report a Discord server")
                .addStringOption(opt =>
                    opt.setName("server_id")
                        .setDescription("The Discord server ID you want to report")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("category")
                        .setDescription("Type of report")
                        .setRequired(true)
                        .addChoices(
                            { name: "<:LEred:1567796934545121280> Abuse / Harassment",  value: "abuse" },
                            { name: "<:announcement:1567796950265241662> Spam / Flooding",     value: "spam" },
                            { name: "<:Currency:1567796932041121873> Scam / Phishing",     value: "scam" },
                            { name: "<:minigames:1567796978929238076> Impersonation",       value: "impersonation" },
                            { name: "<:restrict:1567797003638022166> NSFW / Inappropriate",value: "nsfw" },
                            { name: "<:question:1567797002555621406> Other",               value: "other" },
                        )
                )
                .addStringOption(opt =>
                    opt.setName("reason")
                        .setDescription("Describe the issue (max 1000 characters)")
                        .setRequired(true)
                        .setMaxLength(1000)
                )
                .addStringOption(opt =>
                    opt.setName("evidence")
                        .setDescription("Link to evidence — optional")
                        .setRequired(false)
                        .setMaxLength(500)
                )
        )
        .addSubcommand(sub =>
            sub.setName("status")
                .setDescription("Check the status of your recent reports")
        ),

    global: true,   // always available regardless of guild command config

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── /report status ────────────────────────────────────────────────────
        if (sub === "status") {
            const reports = await Report.find({ reporterId: interaction.user.id })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            if (!reports.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Grey)
                        .setDescription("You haven't submitted any reports yet.")],
                    ephemeral: true,
                });
            }

            const STATUS_EMOJI = { open: "<:error:1567796968758050868>", reviewing: "<:n_info:1567796991419744417>", resolved: "<:LEgreen:1567796933307666515>", dismissed: "<:dot:1567796963624226826>" };

            const embed = new EmbedBuilder()
                .setTitle("<:files:1567796970964394044> Your Recent Reports")
                .setColor(0x3b82f6)
                .setDescription(reports.map(r => {
                    const status = STATUS_EMOJI[r.status] ?? "<:error:1567796968758050868>";
                    const date   = new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                    const target = r.targetType === "user" ? `User \`${r.targetId}\`` : `Server \`${r.targetId}\``;
                    const action = r.resolution?.action ? `\n> *Action: ${r.resolution.action}*` : "";
                    return `${status} \`${r.reportId}\` — ${target} · ${date} · **${r.status}**${action}`;
                }).join("\n\n"))
                .setFooter({ text: "Reports are reviewed by the RankCore team" })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ── /report user or server ────────────────────────────────────────────
        const reporterId = interaction.user.id;

        // Rate limit
        const allowed = await checkRateLimit(reporterId);
        if (!allowed) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle("<:n_loading:1567796992556666982> Too Many Reports")
                    .setDescription("You can submit up to **3 reports per 24 hours**. Please try again later.")],
                ephemeral: true,
            });
        }

        const category  = interaction.options.getString("category");
        const reason    = interaction.options.getString("reason");
        const evidence  = interaction.options.getString("evidence") ?? null;
        const guildId   = interaction.guildId ?? null;

        let targetId, targetType, targetDisplay;

        if (sub === "user") {
            const targetUser = interaction.options.getUser("user");
            // Cannot report yourself
            if (targetUser.id === reporterId) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("<:crossy:1567796959648030831> You cannot report yourself.")],
                    ephemeral: true,
                });
            }
            // Cannot report bots
            if (targetUser.bot) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("<:crossy:1567796959648030831> You cannot report a bot account.")],
                    ephemeral: true,
                });
            }
            targetId      = targetUser.id;
            targetType    = "user";
            targetDisplay = `${targetUser.tag} (\`${targetUser.id}\`)`;
        } else {
            const rawId = interaction.options.getString("server_id").trim();
            if (!/^\d{17,20}$/.test(rawId)) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("<:crossy:1567796959648030831> That doesn't look like a valid server ID.")],
                    ephemeral: true,
                });
            }
            targetId      = rawId;
            targetType    = "guild";
            targetDisplay = `Server \`${rawId}\``;
        }

        // Check for duplicate open report
        const existing = await Report.findOne({
            reporterId, targetId, targetType,
            status: { $in: ["open", "reviewing"] },
        });
        if (existing) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(Colors.Orange)
                    .setTitle("<:error:1567796968758050868> Duplicate Report")
                    .setDescription(`You already have an open report for this ${targetType} (\`${existing.reportId}\`).\nPlease wait for it to be reviewed before submitting another.`)],
                ephemeral: true,
            });
        }

        // Create the report
        const report = await Report.create({
            targetType,
            targetId,
            reporterId,
            category,
            reason,
            evidence,
            guildId,
        });

        // Confirmation embed to reporter
        const confirmEmbed = new EmbedBuilder()
            .setTitle(`${CATEGORY_LABELS[category]} — Report Submitted`)
            .setColor(CATEGORY_COLORS[category] ?? 0x3b82f6)
            .setDescription(
                `Your report has been submitted and will be reviewed by the RankCore team.\n` +
                `We'll DM you when a decision has been made.`
            )
            .addFields(
                { name: "Report ID",   value: `\`${report.reportId}\``,       inline: true },
                { name: "Target",      value: targetDisplay,                    inline: true },
                { name: "Category",    value: CATEGORY_LABELS[category],        inline: true },
                { name: "Your Reason", value: reason.slice(0, 200) + (reason.length > 200 ? "…" : ""), inline: false },
                ...(evidence ? [{ name: "Evidence", value: evidence, inline: false }] : []),
            )
            .setFooter({ text: `Use /report status to track your reports` })
            .setTimestamp();

        return interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
    },
};