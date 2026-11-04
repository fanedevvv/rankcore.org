// dashboard/routes/Giveaway/giveaway.js
const router = require('express').Router();
const path = require('path');
const ms = require('ms');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const Giveaway = require('../../../Schemas/giveawaySchema');
const { endGiveaway, buildActiveEmbed, buildEntryRow, pickWinners } = require('../../../Commands/Giveaway/giveaway');
const { EmbedBuilder } = require('discord.js');
const limit = require('../Utils/giveawayRateLimit');
const { getLimits, limitError } = require('../Utils/limits');
const { cbSend } = require('../../lib/cbSend');

// Fetch a channel via REST (works for both real client and BotClientShim).
// In standalone mode, client.channels is a stub — prefer going through the guild
// object (hydrated by middleware) which routes through the internal API correctly.
async function fetchChannel(client, channelId, guildId) {
  try {
    // Prefer guild-scoped fetch: the guild's channels are pre-hydrated by the
    // hydrateGuild middleware, so this is a cache hit in the common case.
    if (guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) return await guild.channels.fetch(channelId);
    }
    return await client.channels.fetch(channelId);
  } catch (_) {
    return null;
  }
}

function canSend(ch, guildId) {
  if (!ch) return false;
  // Support both Discord.js objects (.guildId) and shim plain objects (.guild_id)
  const correctGuild = ch.guildId === guildId || ch.guild_id === guildId;
  if (!correctGuild) return false;
  const SENDABLE_TYPES = new Set([0, 5, 10, 11, 12]);
  if (typeof ch.type === 'number') return SENDABLE_TYPES.has(ch.type);
  // If the shim omits type but the guild matches, allow it
  return true;
}

// Page
router.get('/guild/:id/giveaway', isAuth, checkDashboardAccess('giveaway'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/giveaway.html'))
);

// GET all giveaways
router.get('/api/guild/:id/giveaways', isAuth, checkDashboardAccess('giveaway'), async (req, res) => {
  try {
    const q = { guildId: req.params.id };
    if (req.query.status === 'active') q.hasEnded = false;
    if (req.query.status === 'ended')  q.hasEnded = true;
    const docs = await Giveaway.find(q).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      success: true,
      giveaways: docs.map(g => ({
        ...g,
        uniqueEntrants: [...new Set(g.entrants)].length,
        entrants: undefined,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch giveaways.' });
  }
});

// GET single giveaway
router.get('/api/guild/:id/giveaways/:giveawayId', isAuth, checkDashboardAccess('giveaway'), async (req, res) => {
  try {
    const g = await Giveaway.findOne({ giveawayId: req.params.giveawayId, guildId: req.params.id }).lean();
    if (!g) return res.status(404).json({ error: 'Giveaway not found.' });
    res.json({ ...g, uniqueEntrants: [...new Set(g.entrants)].length, entrants: undefined });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch giveaway.' });
  }
});

// POST create giveaway
router.post('/api/guild/:id/giveaways', isAuth, checkDashboardAccess('giveaway'), limit('create'), async (req, res) => {
  try {
    const { prize, winners, duration, channelId, requiredRole, bonusRole, bonusEntries, description } = req.body;
    const guildId = req.params.id;
    const client  = req.client;

    if (!prize || !String(prize).trim()) return res.status(400).json({ error: 'Prize is required.' });
    if (!channelId)                       return res.status(400).json({ error: 'Channel is required.' });
    if (!duration)                        return res.status(400).json({ error: 'Duration is required.' });

    const lim = await getLimits(req.user?.id, guildId);
    const activeCount = await Giveaway.countDocuments({ guildId, hasEnded: false });
    if (activeCount >= lim.activeGiveaways)
      return res.status(400).json({ error: limitError(lim, 'active giveaways') });

    const winCount   = Math.max(1, Math.min(20, parseInt(winners) || 1));
    const timeMs     = ms(String(duration));
    const bonusCount = parseInt(bonusEntries) || 0;

    if (!timeMs || timeMs < 5000)    return res.status(400).json({ error: 'Invalid duration. Min 5s. Examples: 30s 5m 2h 1d.' });
    if (timeMs > ms('30d'))          return res.status(400).json({ error: 'Max duration is 30 days.' });
    if (bonusRole && bonusCount < 1) return res.status(400).json({ error: 'Bonus entries must be >= 1 when using a bonus role.' });

    const channel = await fetchChannel(client, channelId, guildId);
    if (!canSend(channel, guildId)) {
      return res.status(400).json({ error: 'Channel not found or bot cannot send messages there.' });
    }

    const endTime = new Date(Date.now() + timeMs);
    const hostId  = req.user?.id ?? client.user.id;
    const hostObj = { id: hostId, toString: () => `<@${hostId}>` };

    const embed = buildActiveEmbed({
      prize:        String(prize).trim(),
      winnerCount:  winCount,
      host:         hostObj,
      endTime,
      requiredRole: requiredRole ? { id: requiredRole } : null,
      bonusRole:    bonusRole    ? { id: bonusRole    } : null,
      bonusEntries: bonusCount,
      description:  description || null,
    });

    // Send first to get msg.id
    const { messageId: gaMsgId, viaCB: gaViaCB } = await cbSend(req, guildId, channel, { embeds: [embed], components: [buildEntryRow(0)] });
    const msg = { id: gaMsgId };

    // Guard: shim may return a plain object — don't let a failed .edit()
    // prevent the DB write below. The giveaway must be saved regardless.
    if (msg && msg.id) {
      try {
        embed.setFooter({ text: `Giveaway ID: ${msg.id} \u2022 Click the button to enter` });
        await msg.edit({ embeds: [embed], components: [buildEntryRow(0)] });
      } catch (editErr) {
        console.warn('[Dashboard Giveaway] Could not edit footer into message:', editErr.message);
      }
    }

    const doc = await Giveaway.create({
      giveawayId:   msg.id,
      messageId:    msg.id,
      channelId:    channel.id || channelId,
      guildId,
      prize:        String(prize).trim(),
      winners:      winCount,
      endTime,
      host:         hostId,
      entrants:     [],
      requiredRole: requiredRole || null,
      bonusRole:    bonusRole    || null,
      bonusEntries: bonusCount,
      hasEnded:     false,
      description:  description || null,
      createdVia:   'dashboard',
      viaCB:        gaViaCB || false,
    });

    res.json({ success: true, giveawayId: doc.giveawayId });
  } catch (e) {
    console.error('[Dashboard Giveaway CREATE]', e);
    res.status(500).json({ error: 'Failed to create giveaway: ' + e.message });
  }
});

// PATCH edit giveaway
router.patch('/api/guild/:id/giveaways/:giveawayId', isAuth, checkDashboardAccess('giveaway'), limit('update'), async (req, res) => {
  try {
    const giveaway = await Giveaway.findOne({ giveawayId: req.params.giveawayId, guildId: req.params.id, hasEnded: false });
    if (!giveaway) return res.status(404).json({ error: 'Active giveaway not found.' });

    const { prize, winners, extendDuration } = req.body;
    const upd = {};
    if (prize)           upd.prize   = String(prize).trim();
    if (winners)         upd.winners = Math.min(20, Math.max(1, parseInt(winners) || 1));
    if (extendDuration) {
      const extMs = ms(String(extendDuration));
      if (!extMs) return res.status(400).json({ error: 'Invalid extension duration.' });
      upd.endTime = new Date(giveaway.endTime.getTime() + extMs);
    }
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'Nothing to update.' });

    const updated = await Giveaway.findOneAndUpdate({ giveawayId: req.params.giveawayId }, upd, { new: true });

    const ch = await fetchChannel(req.client, giveaway.channelId, req.params.id);
    if (canSend(ch, req.params.id)) {
      try {
        const msg = ch.messages.cache.get(giveaway.messageId) ?? await ch.messages.fetch(giveaway.messageId);
        const e = buildActiveEmbed({
          prize:        updated.prize,
          winnerCount:  updated.winners,
          host:         { id: updated.host, toString: () => `<@${updated.host}>` },
          endTime:      updated.endTime,
          requiredRole: updated.requiredRole ? { id: updated.requiredRole } : null,
          bonusRole:    updated.bonusRole    ? { id: updated.bonusRole    } : null,
          bonusEntries: updated.bonusEntries,
          description:  updated.description,
        });
        e.setFooter({ text: `Giveaway ID: ${msg.id} \u2022 Click the button to enter` });
        await msg.edit({ embeds: [e], components: [buildEntryRow([...new Set(updated.entrants)].length)] });
      } catch (_) {}
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[Dashboard Giveaway EDIT]', e);
    res.status(500).json({ error: 'Failed to edit giveaway.' });
  }
});

// POST end giveaway early
router.post('/api/guild/:id/giveaways/:giveawayId/end', isAuth, checkDashboardAccess('giveaway'), limit('end'), async (req, res) => {
  try {
    const r = await endGiveaway(req.params.giveawayId, req.client, req.params.id);
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json({ success: true, winners: r.winners });
  } catch (e) {
    console.error('[Dashboard Giveaway END]', e);
    res.status(500).json({ error: 'Failed to end giveaway.' });
  }
});

// POST reroll
router.post('/api/guild/:id/giveaways/:giveawayId/reroll', isAuth, checkDashboardAccess('giveaway'), limit('reroll'), async (req, res) => {
  try {
    const g = await Giveaway.findOne({ giveawayId: req.params.giveawayId, guildId: req.params.id });
    if (!g)                 return res.status(404).json({ error: 'Giveaway not found.' });
    if (!g.hasEnded)        return res.status(400).json({ error: 'Giveaway has not ended yet.' });
    if (!g.entrants.length) return res.status(400).json({ error: 'No entrants to reroll.' });

    const count   = parseInt(req.body.winners) || g.winners;
    const winners = pickWinners(g.entrants, count);

    const ch = await fetchChannel(req.client, g.channelId, req.params.id);
    if (canSend(ch, req.params.id)) {
      await cbSend(req, req.params.id, ch, {
        content:
          `Giveaway Reroll \u2014 **${g.prize}**\n` +
          `New winner${winners.length > 1 ? 's' : ''}: ${winners.map(id => `<@${id}>`).join(', ')}`,
      }).catch(() => {});
    }

    await Giveaway.updateOne({ giveawayId: req.params.giveawayId }, { winnersChosen: winners });
    res.json({ success: true, winners });
  } catch (e) {
    console.error('[Dashboard Giveaway REROLL]', e);
    res.status(500).json({ error: 'Failed to reroll giveaway.' });
  }
});

// DELETE giveaway
router.delete('/api/guild/:id/giveaways/:giveawayId', isAuth, checkDashboardAccess('giveaway'), limit('delete'), async (req, res) => {
  try {
    const g = await Giveaway.findOne({ giveawayId: req.params.giveawayId, guildId: req.params.id });
    if (!g) return res.status(404).json({ error: 'Giveaway not found.' });

    if (!g.hasEnded) {
      const ch = await fetchChannel(req.client, g.channelId, req.params.id);
      if (canSend(ch, req.params.id)) {
        try {
          const msg = ch.messages.cache.get(g.messageId) ?? await ch.messages.fetch(g.messageId);
          await msg.edit({
            embeds: [
              new EmbedBuilder()
                .setTitle('Giveaway Cancelled')
                .setColor('#FF4444')
                .setDescription('This giveaway was cancelled by an administrator.')
                .setTimestamp(),
            ],
            components: [],
          });
        } catch (_) {}
      }
    }

    await Giveaway.deleteOne({ giveawayId: req.params.giveawayId });
    res.json({ success: true });
  } catch (e) {
    console.error('[Dashboard Giveaway DELETE]', e);
    res.status(500).json({ error: 'Failed to delete giveaway.' });
  }
});

// GET channels + roles for form dropdowns
router.get('/api/guild/:id/giveaway/channels', isAuth, checkDashboardAccess('giveaway'), async (req, res) => {
  try {
    const guild = req.client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found.' });

    const channels = guild.channels.cache
      .filter(c => c.type === 0 || c.type === 5)
      .map(c => ({ id: c.id, name: c.name, parent: c.parent?.name ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const roles = guild.roles.cache
      .filter(r => !r.managed && r.name !== '@everyone')
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => b.position - a.position);

    res.json({ channels, roles });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch guild data.' });
  }
});

module.exports = router;