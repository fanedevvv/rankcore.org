'use strict';

/**
 * Posts every changelog (published from the owner panel → Changelog tab) to the
 * updates channel, and edits the message when the changelog is edited.
 * The same entries are shown on dash.rankcore.org/changelogs and rankcore.org/news.
 * Channel: CHANGELOG_CHANNEL_ID in .env (defaults to #updates in RankCore Hub).
 */

const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Changelogs = require('../../Schemas/changelogs');

const CHANNEL_ID  = process.env.CHANGELOG_CHANNEL_ID || '1564937854956601394';
const INTERVAL_MS = 60 * 1000;
const NEWS_URL    = 'https://rankcore.org/news';

const TYPES = {
  new:      { label: 'New',      emoji: '<:sparkles:1567797006288560209>', color: 0x22c55e },
  improved: { label: 'Improved', emoji: '<:s_curveup:1567797004875341994>', color: 0x3b82f6 },
  fixed:    { label: 'Fixed',    emoji: '<:check:1567796957098025071>',     color: 0x14b8a6 },
  removed:  { label: 'Removed',  emoji: '<:trash:1567797030150213713>',     color: 0x94a3b8 },
  update:   { label: 'Update',   emoji: '<:announcement:1567796950265241662>', color: 0xef4444 },
  security: { label: 'Security', emoji: '<:warn:1567797033224642605>',      color: 0xf59e0b },
  premium:  { label: 'Premium',  emoji: '<:premium:1567797001473622066>',   color: 0xc084fc },
};

let running = false;

function hashOf(entry) {
  const c = entry.config || {};
  return crypto.createHash('sha1')
    .update(JSON.stringify([c.title, c.description, c.footer, c.color, c.type]))
    .digest('hex');
}

function buildMessage(entry) {
  const c    = entry.config || {};
  const type = TYPES[c.type] || TYPES.update;
  const title = c.title || 'RankCore Update';

  const embed = new EmbedBuilder()
    .setColor(/^#[0-9a-f]{6}$/i.test(c.color || '') ? parseInt(c.color.slice(1), 16) : type.color)
    // Custom emoji don't render in embed titles, so the heading lives in the description
    .setDescription(`## ${type.emoji} ${title}\n${c.description || ''}`.slice(0, 4096))
    .setFooter({ text: c.footer || `${type.label} • RankCore Development` })
    .setTimestamp(entry.date ? new Date(entry.date) : new Date());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('All updates').setURL(NEWS_URL),
  );

  return { embeds: [embed], components: [row] };
}

async function sync(client) {
  if (running || !client.isReady()) return;
  running = true;
  try {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;

    // Oldest first, so the channel reads in chronological order
    const entries = await Changelogs.find().sort({ date: 1 }).lean();
    for (const entry of entries) {
      const hash = hashOf(entry);
      const ann  = entry.announcement || {};
      if (ann.messageId && ann.channelId === CHANNEL_ID && ann.hash === hash) continue;

      const payload = buildMessage(entry);
      let message = null;

      if (ann.messageId && ann.channelId === CHANNEL_ID) {
        message = await channel.messages.edit(ann.messageId, payload).catch(() => null);
      }
      if (!message) {
        // New entry, the old message was deleted, or the channel changed
        message = await channel.send(payload);
        if (channel.type === 5 /* announcement channel */) await message.crosspost().catch(() => {});
      }

      await Changelogs.updateOne(
        { _id: entry._id },
        { $set: { announcement: { channelId: CHANNEL_ID, messageId: message.id, hash } } },
      );
      console.log(`[changelog] ${ann.messageId ? 'Updated' : 'Posted'} "${entry.config?.title || 'Untitled'}" in #${channel.name}`);
    }
  } catch (err) {
    console.warn('[changelog] Sync error:', err.message);
  } finally {
    running = false;
  }
}

module.exports = function startChangelogAnnouncer(client) {
  setTimeout(() => sync(client), 15_000);
  setInterval(() => sync(client), INTERVAL_MS);
};
