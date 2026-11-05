'use strict';

const {
  SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SeparatorSpacingSize,
} = require('discord.js');
const { errorContainer, ACCENT, helpRow } = require('../../Utils/v2helpers');
const {
  snipes, editSnipes, reactSnipes, bulkSnipes,
  fresh, clearChannel, clearGuild,
  EXPIRY_MS, HISTORY_LIMIT,
} = require('../../Events/Others/sniping.js');
const getOwners = require('../../Utils/getOwners.js'); // ← adjust path as needed

// ─── UI helpers ───────────────────────────────────────────────────────────────

const sep = () =>
  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

/**
 * Escape sniped content so it never triggers live pings.
 * @everyone / @here get a zero-width space inserted.
 * User/role mentions are visually preserved but allowedMentions blocks the ping.
 */
function sanitize(text) {
  if (!text) return text;
  return text
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g,     '@\u200bhere');
}

// Pass this on every reply so Discord suppresses all mention pings.
const NO_PINGS = { parse: [] };

function accent(client) {
  const c = client.config?.embedColor;
  return typeof c === 'string' && c.startsWith('#')
    ? parseInt(c.slice(1), 16)
    : ACCENT.info;
}

function container(client, title, body) {
  return new ContainerBuilder()
    .setAccentColor(accent(client))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .addSeparatorComponents(sep())
    .addActionRowComponents(helpRow(client.user.id, { invite: false }));
}

function ephErr(interaction, title, body, client) {
  return interaction.reply({
    components:      [errorContainer(title, body, { clientId: client.user.id })],
    flags:           MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    allowedMentions: NO_PINGS,
  });
}

/** Relative Discord timestamp */
const rel  = ts  => `<t:${Math.floor(ts / 1000)}:R>`;
/** Short absolute timestamp */
const abs  = ts  => `<t:${Math.floor(ts / 1000)}:f>`;

/** Footer showing how many more snipes remain */
function remaining(total) {
  return total > 1 ? `\n\n*${total - 1} older snipe${total - 1 === 1 ? '' : 's'} still stored — use \`index\` to view them.*` : '';
}

// ─── Slash command ────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Snipe recently deleted, edited or reacted messages.')

    // ── /snipe deleted ──────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('deleted')
      .setDescription('Snipe a recently deleted message.')
      .addIntegerOption(o => o
        .setName('index')
        .setDescription(`Which snipe to view (1 = most recent, up to ${HISTORY_LIMIT}). Default: 1`)
        .setMinValue(1).setMaxValue(HISTORY_LIMIT).setRequired(false))
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to snipe from (defaults to current channel).')
        .setRequired(false)))

    // ── /snipe edited ───────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('edited')
      .setDescription('Snipe a recently edited message.')
      .addIntegerOption(o => o
        .setName('index')
        .setDescription(`Which snipe to view (1 = most recent, up to ${HISTORY_LIMIT}). Default: 1`)
        .setMinValue(1).setMaxValue(HISTORY_LIMIT).setRequired(false))
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to snipe from (defaults to current channel).')
        .setRequired(false)))

    // ── /snipe reaction ─────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('reaction')
      .setDescription('Snipe a recently removed reaction.')
      .addIntegerOption(o => o
        .setName('index')
        .setDescription(`Which snipe to view (1 = most recent, up to ${HISTORY_LIMIT}). Default: 1`)
        .setMinValue(1).setMaxValue(HISTORY_LIMIT).setRequired(false))
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to snipe from (defaults to current channel).')
        .setRequired(false)))

    // ── /snipe bulk ─────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('bulk')
      .setDescription('Snipe the last bulk-deleted batch of messages.')
      .addIntegerOption(o => o
        .setName('index')
        .setDescription('Which bulk-delete event to view (1 = most recent). Default: 1')
        .setMinValue(1).setMaxValue(HISTORY_LIMIT).setRequired(false))
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to snipe from (defaults to current channel).')
        .setRequired(false)))

    // ── /snipe clear ────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('clear')
      .setDescription('Clear all cached snipes. (Requires Manage Messages)')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to clear (defaults to current channel). Use "all" to wipe the whole server.')
        .setRequired(false))
      .addBooleanOption(o => o
        .setName('server')
        .setDescription('Clear snipes for the entire server instead of just one channel.')
        .setRequired(false))),

  // ─── Execute ────────────────────────────────────────────────────────────────

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const idx     = (interaction.options.getInteger('index') ?? 1) - 1; // 0-based
    const target  = interaction.options.getChannel('channel') ?? interaction.channel;
    const cid     = target.id;
    const expSecs = Math.round(EXPIRY_MS / 1000 / 60);
    const owners  = await getOwners();

    // ── /snipe deleted ───────────────────────────────────────────────────────
    if (sub === 'deleted') {
      const allList = fresh(snipes, cid);
      if (allList.length && owners.includes(allList[0].author.id))
        return ephErr(interaction, '🔒  Nice Try',
          'That message was sent by a dev. It\'s not yours to see.', client);

      const list = allList.filter(s => !owners.includes(s.author.id));
      if (!list.length)
        return ephErr(interaction, 'Nothing to Snipe',
          `No deleted messages cached in ${target} (expires after ${expSecs} min).`, client);

      if (idx >= list.length)
        return ephErr(interaction, 'Index Out of Range',
          `There are only **${list.length}** deleted snipe(s) stored for ${target}.`, client);

      const s    = list[idx];
      const atts = s.attachments ? `\n\n<:1430986227909263442:1567796922863984670> **Attachments:**\n${s.attachments}` : '';
      const stks = s.stickers    ? `\n<:gw:1567796972872536159>️ **Stickers:** ${s.stickers}` : '';
      const embs = s.embed_count ? `\n<:files:1567796970964394044> **Embeds:** ${s.embed_count}` : '';
      const body =
        `**Author** — <@${s.author.id}> \`${s.author.tag}\`\n` +
        `**Sent** — ${abs(s.created_at)}  •  **Deleted** — ${rel(s.sniped_at)}\n` +
        `**#${idx + 1} of ${list.length}** stored snipes` +
        `${atts}${stks}${embs}\n\n` +
        `${s.content ? sanitize(s.content).slice(0, 1800) : '*[No text content]*'}` +
        remaining(list.length);

      return interaction.reply({
        components:      [container(client, '<:n_search:1567796994792230953>  Deleted Message Snipe', body)],
        flags:           MessageFlags.IsComponentsV2,
        allowedMentions: NO_PINGS,
      });
    }

    // ── /snipe edited ────────────────────────────────────────────────────────
    if (sub === 'edited') {
      const allList = fresh(editSnipes, cid);
      if (allList.length && owners.includes(allList[0].author.id))
        return ephErr(interaction, '🔒  Nice Try',
          'That message was sent by a dev. It\'s not yours to see.', client);

      const list = allList.filter(s => !owners.includes(s.author.id));
      if (!list.length)
        return ephErr(interaction, 'Nothing to Snipe',
          `No edited messages cached in ${target} (expires after ${expSecs} min).`, client);

      if (idx >= list.length)
        return ephErr(interaction, 'Index Out of Range',
          `There are only **${list.length}** edit snipe(s) stored for ${target}.`, client);

      const s    = list[idx];
      const jump = s.message_url ? `\n[Jump to message](${s.message_url})` : '';
      const body =
        `**Author** — <@${s.author.id}> \`${s.author.tag}\`\n` +
        `**Originally sent** — ${abs(s.created_at)}  •  **Edited** — ${rel(s.sniped_at)}\n` +
        `**#${idx + 1} of ${list.length}** stored snipes${jump}\n\n` +
        `**Before:**\n${sanitize(s.before ?? '*[empty]*').slice(0, 800)}\n\n` +
        `**After:**\n${sanitize(s.after ?? '*[empty]*').slice(0, 800)}` +
        remaining(list.length);

      return interaction.reply({
        components:      [container(client, '<:files:1567796970964394044>  Edited Message Snipe', body)],
        flags:           MessageFlags.IsComponentsV2,
        allowedMentions: NO_PINGS,
      });
    }

    // ── /snipe reaction ──────────────────────────────────────────────────────
    if (sub === 'reaction') {
      const allList = fresh(reactSnipes, cid);
      if (allList.length && owners.includes(allList[0].user.id))
        return ephErr(interaction, '🔒  Nice Try',
          'That reaction was removed by a dev. It\'s not yours to see.', client);

      const list = allList.filter(s => !owners.includes(s.user.id));
      if (!list.length)
        return ephErr(interaction, 'Nothing to Snipe',
          `No removed reactions cached in ${target} (expires after ${expSecs} min).`, client);

      if (idx >= list.length)
        return ephErr(interaction, 'Index Out of Range',
          `There are only **${list.length}** reaction snipe(s) stored for ${target}.`, client);

      const s    = list[idx];
      const jump = s.message_url ? `[Jump to message](${s.message_url})` : '*message unavailable*';
      const body =
        `**User** — <@${s.user.id}> \`${s.user.tag}\`\n` +
        `**Reaction** — ${s.emoji}\n` +
        `**Removed** — ${rel(s.sniped_at)}\n` +
        `**Message** — ${jump}\n` +
        `**#${idx + 1} of ${list.length}** stored snipes` +
        remaining(list.length);

      return interaction.reply({
        components:      [container(client, '😶  Reaction Snipe', body)],
        flags:           MessageFlags.IsComponentsV2,
        allowedMentions: NO_PINGS,
      });
    }

    // ── /snipe bulk ──────────────────────────────────────────────────────────
    if (sub === 'bulk') {
      const allList = fresh(bulkSnipes, cid);
      const list = allList.map(event => ({
        ...event,
        messages: (event.messages ?? []).filter(m => !owners.includes(m.author?.id)),
      })).filter(event => event.messages.length > 0 || !event.messages);
      if (!list.length)
        return ephErr(interaction, 'Nothing to Snipe',
          `No bulk-delete events cached in ${target} (expires after ${expSecs} min).`, client);

      if (idx >= list.length)
        return ephErr(interaction, 'Index Out of Range',
          `There are only **${list.length}** bulk-delete event(s) stored for ${target}.`, client);

      const s       = list[idx];
      const msgs    = s.messages ?? [];
      const preview = msgs.slice(0, 10).map((m, i) =>
        `**${i + 1}.** \`${m.author?.tag ?? 'Unknown'}\` — ${sanitize(m.content ?? '*[no text]*').slice(0, 100)}`
      ).join('\n');
      const more    = msgs.length > 10 ? `\n*…and ${msgs.length - 10} more*` : '';
      const body    =
        `**Total deleted** — ${s.total}  •  **Captured** — ${msgs.length}\n` +
        `**When** — ${rel(s.sniped_at)}\n` +
        `**#${idx + 1} of ${list.length}** stored events\n\n` +
        `${preview}${more}` +
        remaining(list.length);

      return interaction.reply({
        components:      [container(client, '<:del:1567796961334267974>  Bulk Delete Snipe', body)],
        flags:           MessageFlags.IsComponentsV2,
        allowedMentions: NO_PINGS,
      });
    }

    // ── /snipe clear ─────────────────────────────────────────────────────────
    if (sub === 'clear') {
      // Require Manage Messages to clear snipes
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return ephErr(interaction, 'Missing Permission',
          'You need the **Manage Messages** permission to clear snipes.', client);
      }

      const serverWide = interaction.options.getBoolean('server') ?? false;

      if (serverWide) {
        clearGuild(interaction.guild.id);
        return interaction.reply({
          components:      [container(client, '<:del:1567796961334267974>  Snipes Cleared',
            `All cached snipes across **${interaction.guild.name}** have been wiped.`)],
          flags:           MessageFlags.IsComponentsV2,
          allowedMentions: NO_PINGS,
        });
      } else {
        clearChannel(cid);
        return interaction.reply({
          components:      [container(client, '<:del:1567796961334267974>  Snipes Cleared',
            `All cached snipes in ${target} have been wiped.`)],
          flags:           MessageFlags.IsComponentsV2,
          allowedMentions: NO_PINGS,
        });
      }
    }
  },
};