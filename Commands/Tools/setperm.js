"use strict";

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const { parseEmoji } = require('../../Utils/emojis');
// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTOR_TTL_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS      = 8_000;
const BATCH_SIZE       = 10;
const BATCH_DELAY_MS   = 275;

/** One active panel per guild. Value = userId of the executor. */
const guildLocks    = new Map();
/** Per-user cooldown. Value = expiry timestamp. */
const userCooldowns = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Permission categories
// ─────────────────────────────────────────────────────────────────────────────

const PERM_CATEGORIES = {
    General: {
        label: "<:1430986225493479485:1555544207652032633> General & Access",
        perms: {
            ViewChannel:         PermissionFlagsBits.ViewChannel,
            CreateInstantInvite: PermissionFlagsBits.CreateInstantInvite,
            ManageGuild:         PermissionFlagsBits.ManageGuild,
            Administrator:       PermissionFlagsBits.Administrator,
        },
    },
    Text: {
        label: "<:suggestion:1555544601501237322> Text & Media",
        perms: {
            SendMessages:           PermissionFlagsBits.SendMessages,
            SendMessagesInThreads:  PermissionFlagsBits.SendMessagesInThreads,
            EmbedLinks:             PermissionFlagsBits.EmbedLinks,
            AttachFiles:            PermissionFlagsBits.AttachFiles,
            AddReactions:           PermissionFlagsBits.AddReactions,
            UseExternalEmojis:      PermissionFlagsBits.UseExternalEmojis,
            UseExternalStickers:    PermissionFlagsBits.UseExternalStickers,
            MentionEveryone:        PermissionFlagsBits.MentionEveryone,
            ReadMessageHistory:     PermissionFlagsBits.ReadMessageHistory,
            ManageMessages:         PermissionFlagsBits.ManageMessages,
            UseApplicationCommands: PermissionFlagsBits.UseApplicationCommands,
            ManageThreads:          PermissionFlagsBits.ManageThreads,
            CreatePublicThreads:    PermissionFlagsBits.CreatePublicThreads,
            CreatePrivateThreads:   PermissionFlagsBits.CreatePrivateThreads,
        },
    },
    Voice: {
        label: "<:n_music:1555544516746940416> Voice & Stage",
        perms: {
            Connect:         PermissionFlagsBits.Connect,
            Speak:           PermissionFlagsBits.Speak,
            Stream:          PermissionFlagsBits.Stream,
            Video:           PermissionFlagsBits.Video,
            UseVAD:          PermissionFlagsBits.UseVAD,
            PrioritySpeaker: PermissionFlagsBits.PrioritySpeaker,
            RequestToSpeak:  PermissionFlagsBits.RequestToSpeak,
            MoveMembers:     PermissionFlagsBits.MoveMembers,
            MuteMembers:     PermissionFlagsBits.MuteMembers,
            DeafenMembers:   PermissionFlagsBits.DeafenMembers,
        },
    },
    Moderation: {
        label: "<:ban:1555544356352430202> Moderation & Management",
        perms: {
            ManageRoles:    PermissionFlagsBits.ManageRoles,
            ManageChannels: PermissionFlagsBits.ManageChannels,
            ManageWebhooks: PermissionFlagsBits.ManageWebhooks,
            KickMembers:    PermissionFlagsBits.KickMembers,
            BanMembers:     PermissionFlagsBits.BanMembers,
            ManageGuild:    PermissionFlagsBits.ManageGuild,
        },
    },
    Other: {
        label: "<:n_utils:1555544669545431062> Other",
        perms: {
            ManageNicknames:         PermissionFlagsBits.ManageNicknames,
            ChangeNickname:          PermissionFlagsBits.ChangeNickname,
            ManageEmojisAndStickers: PermissionFlagsBits.ManageEmojisAndStickers,
            ManageEvents:            PermissionFlagsBits.ManageEvents,
            UseExternalApps:         PermissionFlagsBits.UseExternalApps,
        },
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

function createState(guildId, executorId, channelFilter) {
    return {
        guildId,
        executorId,
        channelFilter, // "all" | "text" | "voice" | "category"
        roleIds:     [], // role IDs; guildId in this array = @everyone
        category:    null,
        permissions: [],
        action:      null, // "allow" | "deny" | "none" | "remove"
    };
}

function isReady(s) {
    return (
        s.roleIds.length   > 0 &&
        s.category        !== null &&
        s.permissions.length > 0 &&
        s.action          !== null
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Embed
// ─────────────────────────────────────────────────────────────────────────────

const TIPS = [
    "Limit Administrator roles to 2-3 trusted people.",
    "Never grant Manage Roles to public-facing bots.",
    "Keep the bot's role below the roles it manages.",
    "'None' overwrites fall back to the category default.",
    "Enable 2FA on all moderator accounts.",
    "Set permissions on categories first, then inherit on child channels.",
];

function buildEmbed(state, guild) {
    const roleDisplay = state.roleIds.length === 0
        ? "*(none selected)*"
        : state.roleIds.map(id => {
            if (id === state.guildId) return "**@everyone**";
            return guild.roles.cache.get(id)?.name ?? `Unknown (${id})`;
        }).join(", ").substring(0, 1000);

    const scopeDisplay = {
        all:      "All Channels",
        text:     "Text Channels Only",
        voice:    "Voice / Stage Only",
        category: "Categories Only",
    }[state.channelFilter] ?? "All Channels";

    const actionDisplay = state.action
        ? ({ allow: "<a:tickyy:1555544712687915008> Allow", deny: "<:crossy:1555544390221562048> Deny", none: "<:1430986239036625017:1555544229143519304> Reset (None)", remove: "<:del:1555544395720302643> Remove Overwrite" })[state.action]
        : "*(not selected)*";

    const color = state.roleIds.length === 0 ? 0xED4245 : isReady(state) ? 0x57F287 : 0x5865F2;
    const tip   = TIPS[Math.floor(Math.random() * TIPS.length)];

    return new EmbedBuilder()
        .setTitle("<:n_utils:1555544669545431062>  Bulk Permission Overwrite")
        .setDescription(`**Scope:** ${scopeDisplay}`)
        .addFields(
            { name: "① Roles",       value: roleDisplay,                                                           inline: false },
            { name: "② Category",   value: state.category ? PERM_CATEGORIES[state.category].label : "*(not selected)*", inline: true },
            { name: "③ Permissions", value: state.permissions.length ? state.permissions.map(p => `\`${p}\``).join(", ").substring(0, 1024) : "*(not selected)*", inline: true },
            { name: "④ Action",      value: actionDisplay,                                                         inline: true },
        )
        .setFooter({ text: `<:n_info:1555544473008873565> Tip: ${tip}` })
        .setColor(color);
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
//
// Fixed 5-row layout — shape never changes regardless of state:
//
//   Row 0  [@everyone btn]  [<a:tickyy:1555544712687915008> Confirm btn]  [<:restrict:1555544549105999962> Cancel btn]
//   Row 1  Role select menu
//   Row 2  Category select menu        (disabled until roles selected)
//   Row 3  Permission select menu      (disabled until category selected)
//   Row 4  Action select menu          (disabled until permissions selected)
//
// Confirm is only enabled once all four selections have been made.
// ─────────────────────────────────────────────────────────────────────────────

function buildComponents(state, allDisabled = false) {
    const ready       = isReady(state);
    const hasRoles    = state.roleIds.length > 0;
    const hasCat      = state.category !== null;
    const hasPerms    = state.permissions.length > 0;
    const isEveryone  = state.roleIds.includes(state.guildId);

    // Row 0 ── control buttons ────────────────────────────────────────────────
    const row0 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("gp_everyone")
            .setLabel("@everyone")
            .setEmoji(isEveryone ? parseEmoji("<a:tickyy:1555544712687915008>") : parseEmoji("<:1430986220011524216:1555544196952367134>"))
            .setStyle(isEveryone ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(allDisabled),
        new ButtonBuilder()
            .setCustomId("gp_confirm")
            .setLabel("Confirm & Run")
            .setEmoji(parseEmoji("<:boost:1555544362455146576>"))
            .setStyle(ButtonStyle.Success)
            .setDisabled(allDisabled || !ready),
        new ButtonBuilder()
            .setCustomId("gp_cancel")
            .setLabel("Cancel")
            .setEmoji(parseEmoji("<:restrict:1555544549105999962>"))
            .setStyle(ButtonStyle.Danger)
            .setDisabled(allDisabled),
    );

    // Row 1 ── role select ────────────────────────────────────────────────────
    const row1 = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId("gp_roles")
            .setPlaceholder("<:minigames:1555544500179439707>  Select custom roles to target…")
            .setMinValues(0)
            .setMaxValues(25)
            .setDisabled(allDisabled),
    );

    // Row 2 ── category select ────────────────────────────────────────────────
    const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("gp_category")
            .setPlaceholder("<:files:1555544445565407352>  Select a permission category…")
            .addOptions(Object.entries(PERM_CATEGORIES).map(([key, cat]) => ({
                label: cat.label,
                value: key,
            })))
            .setDisabled(allDisabled || !hasRoles),
    );

    // Row 3 ── permission select ──────────────────────────────────────────────
    // When no category is chosen we render a disabled placeholder option so the
    // menu is always structurally valid (Discord requires at least one option).
    const permOptions = hasCat
        ? Object.keys(PERM_CATEGORIES[state.category].perms).map(p => ({ label: p, value: p }))
        : [{ label: "Select a category first", value: "_placeholder", default: true }];

    const maxPerms = Math.min(permOptions.length, 10);

    const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("gp_permissions")
            .setPlaceholder(`<:files:1555544445565407352>  Select 1–${maxPerms} permission(s)…`)
            .addOptions(permOptions)
            .setMinValues(1)
            .setMaxValues(maxPerms)
            .setDisabled(allDisabled || !hasCat),
    );

    // Row 4 ── action select ──────────────────────────────────────────────────
    const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("gp_action")
            .setPlaceholder("<:n_utils:1555544669545431062>  Choose the permission action…")
            .addOptions([
                { label: "Allow",            value: "allow",  emoji: parseEmoji("<a:tickyy:1555544712687915008>") },
                { label: "Deny",             value: "deny",   emoji: parseEmoji("<:crossy:1555544390221562048>") },
                { label: "None (reset)",     value: "none",   emoji: parseEmoji("<:1430986239036625017:1555544229143519304>") },
                { label: "Remove overwrite", value: "remove", emoji: parseEmoji("<:del:1555544395720302643>") },
            ])
            .setDisabled(allDisabled || !hasPerms),
    );

    return [row0, row1, row2, row3, row4];
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel filter
// ─────────────────────────────────────────────────────────────────────────────

function getChannelFilter(scope) {
    switch (scope) {
        case "text":
            return c =>
                c.isTextBased() &&
                c.type !== ChannelType.GuildVoice &&
                c.type !== ChannelType.GuildStageVoice &&
                c.type !== ChannelType.GuildCategory;
        case "voice":
            return c => c.isVoiceBased() || c.type === ChannelType.GuildStageVoice;
        case "category":
            return c => c.type === ChannelType.GuildCategory;
        default:
            return c =>
                c.isTextBased() ||
                c.isVoiceBased() ||
                c.type === ChannelType.GuildForum ||
                c.type === ChannelType.GuildCategory;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk update executor
// ─────────────────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runBulkUpdate(interaction, state) {
    const { guild } = interaction;
    const bot       = guild.members.me;
    const channels  = Array.from(guild.channels.cache.filter(getChannelFilter(state.channelFilter)).values());

    // Resolve roles entirely from cache — they're guaranteed present since Discord
    // just returned them from the select menu interaction.
    const roles = state.roleIds
        .map(id => (id === state.guildId ? guild.roles.everyone : guild.roles.cache.get(id)))
        .filter(Boolean);

    const totalTasks = channels.length * roles.length * state.permissions.length;

    if (totalTasks === 0) {
        await interaction.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle("<:error:1555544434601369620>  Nothing to update")
                .setDescription("No channels matched the scope filter. No changes were made.")
                .setColor(0xFEE75C)],
        }).catch(() => {});
        return;
    }

    await interaction.channel.send({
        embeds: [new EmbedBuilder()
            .setTitle("<:n_loading:1555544489194688623>  Bulk update in progress…")
            .setDescription(
                `Running **${totalTasks}** overwrite edit(s).\n` +
                `Action **${state.action.toUpperCase()}** · ` +
                `${roles.length} role(s) · ` +
                `${state.permissions.length} permission(s) · ` +
                `${channels.length} channel(s)`
            )
            .setColor(0x5865F2)],
    }).catch(() => {});

    // Build flat task list
    const tasks = [];
    for (const perm of state.permissions) {
        for (const role of roles) {
            for (const channel of channels) {
                tasks.push({ perm, role, channel });
            }
        }
    }

    let success = 0;
    let failed  = 0;
    const t0    = Date.now();

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        await Promise.allSettled(
            tasks.slice(i, i + BATCH_SIZE).map(async ({ perm, role, channel }) => {
                try {
                    if (!channel.permissionsFor(bot).has(PermissionFlagsBits.ManageChannels)) {
                        failed++;
                        return;
                    }

                    if (state.action === "remove") {
                        await channel.permissionOverwrites.delete(role);
                    } else {
                        const value = state.action === "allow" ? true : state.action === "deny" ? false : null;
                        await channel.permissionOverwrites.edit(role, { [perm]: value });
                    }

                    success++;
                } catch (err) {
                    failed++;
                    console.error(`[global-perm] ${role.name} / ${perm} / #${channel.name}: ${err.message}`);
                }
            })
        );

        if (i + BATCH_SIZE < tasks.length) await sleep(BATCH_DELAY_MS);
    }

    const duration  = ((Date.now() - t0) / 1000).toFixed(1);
    const allOk     = failed === 0;
    const allBad    = success === 0;
    const color     = allOk ? 0x57F287 : allBad ? 0xED4245 : 0xFEE75C;
    const title     = allOk ? "<a:tickyy:1555544712687915008>  Bulk Update Complete" : allBad ? "<:crossy:1555544390221562048>  Bulk Update Failed" : "<:error:1555544434601369620>  Partial Success";

    await interaction.channel.send({
        content: `${interaction.user} — bulk permission update finished:`,
        embeds: [new EmbedBuilder()
            .setTitle(title)
            .addFields(
                { name: "Roles",        value: roles.map(r => `<@&${r.id}>`).join(", ").substring(0, 1024) || "—", inline: false },
                { name: "Permissions",  value: state.permissions.map(p => `\`${p}\``).join(", ").substring(0, 1024),               inline: false },
                { name: "Action",       value: state.action.toUpperCase(),  inline: true },
                { name: "Channels",     value: String(channels.length),     inline: true },
                { name: "Duration",     value: `${duration}s`,              inline: true },
                { name: "<a:tickyy:1555544712687915008> Success",   value: String(success),             inline: true },
                { name: "<:crossy:1555544390221562048> Failed",    value: String(failed),              inline: true },
                { name: "\u200b",       value: "\u200b",                    inline: true },
            )
            .setColor(color)
            .setFooter({ text: `Executed by ${interaction.user.tag}` })],
    }).catch(e => console.error("[global-perm] Failed to send result:", e.message));
}

// ─────────────────────────────────────────────────────────────────────────────
// Command
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName("global-perm")
        .setDescription("Bulk-edit role permission overwrites across every channel in the server.")
        .addStringOption(o => o
            .setName("scope")
            .setDescription("Which channel types to target (default: all)")
            .setRequired(false)
            .addChoices(
                { name: "All Channels",       value: "all"      },
                { name: "Text Channels Only", value: "text"     },
                { name: "Voice / Stage Only", value: "voice"    },
                { name: "Categories Only",    value: "category" },
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId  = interaction.user.id;
        const scope   = interaction.options.getString("scope") ?? "all";

        // Bot needs ManageChannels
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("Missing Permission")
                    .setDescription("I need **Manage Channels** to modify channel overwrites.")
                    .setColor(0xED4245)],
                ephemeral: true,
            });
        }

        // One panel per guild
        if (guildLocks.has(guildId)) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("Panel Already Open <:lockk:1555544494441635860>")
                    .setDescription(`<@${guildLocks.get(guildId)}> already has a panel open. Wait for it to finish.`)
                    .setColor(0xED4245)],
                ephemeral: true,
            });
        }

        // Per-user cooldown
        const expiry = userCooldowns.get(userId) ?? 0;
        if (Date.now() < expiry) {
            const secs = Math.ceil((expiry - Date.now()) / 1000);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("Slow down <:n_loading:1555544489194688623>")
                    .setDescription(`Wait **${secs}s** before using this again.`)
                    .setColor(0xED4245)],
                ephemeral: true,
            });
        }
        userCooldowns.set(userId, Date.now() + COOLDOWN_MS);

        // Open the panel
        guildLocks.set(guildId, userId);
        const state = createState(guildId, userId, scope);

        await interaction.reply({
            embeds:     [buildEmbed(state, interaction.guild)],
            components: buildComponents(state),
        });

        // Grab the actual Message object so we can call message.edit() directly.
        // This is the only reliable update path in discord.js v14 from inside a
        // component collector. interaction.editReply() silently fails here.
        const panelMsg = await interaction.fetchReply();

        const collector = panelMsg.createMessageComponentCollector({
            filter: ci => ci.customId.startsWith("gp_"),
            time:   COLLECTOR_TTL_MS,
        });

        collector.on("collect", async ci => {
            // Reject other users
            if (ci.user.id !== userId) {
                return ci.reply({ content: "This panel isn't yours.", ephemeral: true });
            }

            // Acknowledge the interaction — required within 3 s
            try {
                await ci.deferUpdate();
            } catch (err) {
                if (err.code === 10062 || err.code === 40060) return; // expired / already ack'd
                throw err;
            }

            try {
                switch (ci.customId) {

                    case "gp_cancel":
                        return collector.stop("canceled");

                    case "gp_confirm":
                        if (isReady(state)) collector.stop("confirmed");
                        return;

                    case "gp_everyone": {
                        if (state.roleIds.includes(state.guildId)) {
                            state.roleIds = state.roleIds.filter(id => id !== state.guildId);
                        } else {
                            state.roleIds.push(state.guildId);
                        }
                        state.category    = null;
                        state.permissions = [];
                        state.action      = null;
                        break;
                    }

                    case "gp_roles": {
                        // Preserve @everyone toggle state across role-select changes
                        const keepEveryone = state.roleIds.includes(state.guildId);
                        state.roleIds      = keepEveryone ? [state.guildId, ...ci.values] : [...ci.values];
                        state.category     = null;
                        state.permissions  = [];
                        state.action       = null;
                        break;
                    }

                    case "gp_category": {
                        state.category    = ci.values[0];
                        state.permissions = [];
                        state.action      = null;
                        break;
                    }

                    case "gp_permissions": {
                        state.permissions = ci.values;
                        state.action      = null;
                        break;
                    }

                    case "gp_action": {
                        state.action = ci.values[0];
                        break;
                    }
                }

                // Update the panel message directly — bypasses the interaction
                // webhook token entirely so there's no silent failure path.
                await panelMsg.edit({
                    embeds:     [buildEmbed(state, interaction.guild)],
                    components: buildComponents(state),
                });

            } catch (err) {
                console.error(`[global-perm] Handler error (${ci.customId}):`, err);
            }
        });

        collector.on("end", async (_, reason) => {
            guildLocks.delete(guildId);

            if (reason === "confirmed") {
                await panelMsg.edit({ components: buildComponents(state, true) }).catch(() => {});
                await runBulkUpdate(interaction, state);
                await panelMsg.edit({
                    embeds:     [new EmbedBuilder()
                        .setTitle("<a:tickyy:1555544712687915008>  Panel Closed")
                        .setDescription("Bulk update complete. See the summary above.")
                        .setColor(0x57F287)],
                    components: [],
                }).catch(() => {});
                return;
            }

            const info = {
                canceled: { title: "<:restrict:1555544549105999962>  Canceled",   desc: "The operation was canceled.",                        color: 0xFEE75C },
                time:     { title: "<:1430986244921495654:1555544239792980044>  Timed Out",  desc: "Panel expired after 5 minutes of inactivity.",       color: 0xED4245 },
            }[reason] ?? {  title: "<:crossy:1555544390221562048>  Closed",     desc: "The panel was closed.",                              color: 0xED4245 };

            await panelMsg.edit({
                embeds:     [new EmbedBuilder().setTitle(info.title).setDescription(info.desc).setColor(info.color)],
                components: [],
            }).catch(() => {});
        });
    },
};