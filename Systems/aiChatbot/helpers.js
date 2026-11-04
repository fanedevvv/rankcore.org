// ─────────────────────────────────────────────────────────────────────────────
//  Shared helpers — buttons, stats, logging
// ─────────────────────────────────────────────────────────────────────────────

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const { parseEmoji }  = require("../../Utils/emojis");
const AIConfig        = require("../../Schemas/aiSchema.js");

// ── Button row ────────────────────────────────────────────────────────────────

/**
 * Build the action row attached to every AI reply.
 * @param {object}  cfg        - Guild AI config.
 * @param {number}  regenCount - How many regenerations have been used.
 * @param {object}  [flags]    - { loading, expired, cleared }
 * @returns {ActionRowBuilder|null}
 */
function buildButtonRow(cfg, regenCount, { loading = false, expired = false, cleared = false } = {}) {
    const maxRegens  = cfg.maxRegens ?? 3;
    const components = [];

    if (cfg.showRegen !== false) {
        components.push(
            new ButtonBuilder()
                .setCustomId("ai_regenerate")
                .setLabel(loading ? "Loading…" : expired ? "Expired" : cleared ? "Context Cleared" : "Regenerate")
                .setEmoji(
                    loading  ? parseEmoji("<:n_loading:1555544489194688623>") :
                    expired  ? parseEmoji("<:1430986244921495654:1555544239792980044>")    :
                               parseEmoji("<:n_add:1555544335036973106>")
                )
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(loading || expired || cleared || regenCount >= maxRegens)
        );
    }

    if (cfg.showClear !== false) {
        components.push(
            new ButtonBuilder()
                .setCustomId("ai_clear_context")
                .setLabel(expired ? "Expired" : cleared ? "Context Cleared" : "Clear Context")
                .setEmoji(expired ? parseEmoji("<:1430986244921495654:1555544239792980044>") : parseEmoji("<:del:1555544395720302643>"))
                .setStyle(cleared || expired ? ButtonStyle.Success : ButtonStyle.Danger)
                .setDisabled(loading || expired || cleared)
        );
    }

    // Read-only regen counter badge
    if (cfg.showRegen !== false) {
        components.push(
            new ButtonBuilder()
                .setCustomId("ai_regen_status")
                .setLabel(cleared ? "Cleared" : `Regens: ${maxRegens - regenCount}/${maxRegens}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        );
    }

    return components.length ? new ActionRowBuilder().addComponents(components) : null;
}

// ── MongoDB stat counter ──────────────────────────────────────────────────────

/** Increment a stat counter in MongoDB (non-blocking, fire-and-forget). */
function incStat(guildId, field) {
    AIConfig.findOneAndUpdate(
        { guildId },
        { $inc: { [`stats.${field}`]: 1 } }
    ).catch(() => {});
}

// ── Log channel helper ────────────────────────────────────────────────────────

/** Send an embed to the configured log channel (non-blocking). */
async function sendLog(client, cfg, embed) {
    if (!cfg.logChannelId) return;
    try {
        const ch = await client.channels.fetch(cfg.logChannelId);
        if (ch?.isTextBased()) await ch.send({ embeds: [embed] });
    } catch {}
}

module.exports = { buildButtonRow, incStat, sendLog };