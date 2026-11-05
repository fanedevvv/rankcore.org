'use strict';

const router = require('express').Router();
const path   = require('path');
const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits,
} = require('discord.js');

const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const TicketSetup  = require('../../../Schemas/TicketSetup');
const TicketSchema = require('../../../Schemas/Ticket');
const Transcript   = require('../../../Schemas/transcript');
const { decryptMessages } = require('../../../Utils/transcriptCrypto');
const { getLimits, limitError } = require('../Utils/limits');
const getOwners     = require('../../../Utils/getOwners');
const { cbSend }   = require('../../lib/cbSend');
const cache        = require('../../../src/lib/cache');

// ── Views ─────────────────────────────────────────────────────────────────────

router.get('/guild/:id/ticket', isAuth, checkDashboardAccess('ticket'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/ticket.html')));

// ── Channels / categories for selects ────────────────────────────────────────

router.get('/api/guild/:id/ticket/target-channels', isAuth, checkDashboardAccess('ticket'), (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.json([]);
  try {
    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildCategory)
      .map(c => ({ id: c.id, name: c.name || 'Unknown', type: c.type }))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    res.json(channels);
  } catch { res.json([]); }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/api/guild/:id/ticket/stats', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      openCount, closedToday, totalAll,
      avgRating, weeklyData,
    ] = await Promise.all([
      TicketSchema.countDocuments({ GuildID: guildId, Closed: false }),
      TicketSchema.countDocuments({ GuildID: guildId, Closed: true, ClosedAt: { $gte: startOfDay } }),
      TicketSchema.countDocuments({ GuildID: guildId }),
      TicketSchema.aggregate([
        { $match: { GuildID: guildId, Rating: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$Rating' }, count: { $sum: 1 } } },
      ]),
      TicketSchema.aggregate([
        { $match: { GuildID: guildId, CreatedAt: { $gte: startOfWeek } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$CreatedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Build last 7 days array
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = weeklyData.find(w => w._id === key);
      daily.push({ date: key, count: found?.count ?? 0 });
    }

    res.json({
      openCount,
      closedToday,
      totalAll,
      avgRating:   avgRating[0]?.avg ? Math.round(avgRating[0].avg * 10) / 10 : null,
      ratingCount: avgRating[0]?.count ?? 0,
      daily,
    });
  } catch (e) {
    console.error('Ticket stats error:', e);
    res.json({ openCount: 0, closedToday: 0, totalAll: 0, avgRating: null, ratingCount: 0, daily: [] });
  }
});

// ── Get full ticket setup ─────────────────────────────────────────────────────

router.get('/api/guild/:id/ticket', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const data = await TicketSetup.findOne({ GuildID: req.params.id }).lean();
  if (!data) return res.json({});

  // Compute HandlerRoles: merge legacy Handlers + AdditionalManageRoles into one ordered array
  const handlerRoles = [];
  if (data.Handlers) handlerRoles.push(data.Handlers);
  if (Array.isArray(data.AdditionalManageRoles)) {
    for (const r of data.AdditionalManageRoles) {
      if (r && !handlerRoles.includes(r)) handlerRoles.push(r);
    }
  }
  data.HandlerRoles = handlerRoles;

  res.json(data);
});

// ── Save settings ─────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ticket', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    const allowed = [
      'Channel', 'Transcripts', 'Everyone',
      'Title', 'Description', 'Color', 'FooterText', 'ThumbnailURL', 'BannerURL',
      'TicketPrefix', 'MaxTicketsPerUser', 'AutoCloseMinutes', 'AutoCloseWarningMessage',
      'RequireReason', 'MentionOnCreate', 'DMOnClose', 'CloseMessage',
      'WelcomeTitle', 'WelcomeMessage',
      'RequireCloseReason', 'SaveWebTranscript',
      'PingRoles', 'UrgentRoleId',
      'EnablePriority', 'EnableRating', 'RatingMessage',
      'AutoDeleteOnClose',
      // Ticket type settings
      'TicketType', 'TicketCategory', 'ThreadChannel',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    // HandlerRoles: array of role IDs for support team.
    // Store first as legacy Handlers string; remainder go into AdditionalManageRoles
    // so the bot can still read them via either field.
    if (Array.isArray(req.body.HandlerRoles)) {
      const roles = req.body.HandlerRoles.filter(r => typeof r === 'string' && r.trim());
      update.Handlers = roles[0] || null;
      update.AdditionalManageRoles = roles.slice(1);
    } else if (req.body.Handlers !== undefined) {
      // Legacy single-role fallback (backwards compat)
      update.Handlers = req.body.Handlers || null;
    }

    await TicketSetup.findOneAndUpdate(
      { GuildID: req.params.id },
      { ...update, GuildID: req.params.id, Everyone: req.params.id },
      { upsert: true, new: true, runValidators: true },
    );
    cache.invalidateNamespace(`ticket:setup:${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    console.error('Ticket save error:', e);
    res.status(500).json({ error: 'Save failed' });
  }
});

// ── Categories ────────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ticket/category', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    let doc = await TicketSetup.findOne({ GuildID: req.params.id });
    if (!doc) {
      doc = await TicketSetup.create({ GuildID: req.params.id, Everyone: req.params.id });
    }

    const lim = await getLimits(req.user?.id, req.params.id);
    if ((doc.Categories?.length || 0) >= lim.ticketCategories) {
      return res.status(400).json({ error: limitError(lim, 'ticket categories') });
    }

    const { name, emoji, ticketCategory, description, welcomeMessage, closeMessage, maxOpen, staffOnly, defaultPriority, channelPrefix, pingRoles, intakeQuestions } = req.body;
    console.log('[ticket/category] intakeQuestions received:', JSON.stringify(intakeQuestions));
    if (!name) return res.status(400).json({ error: 'Category name is required.' });

    // Sanitise intakeQuestions: max 5, enforce first-is-required rule
    const sanitisedQuestions = Array.isArray(intakeQuestions)
      ? intakeQuestions.slice(0, 5).map((q, i) => ({
          label:       String(q.label || '').slice(0, 45),
          placeholder: String(q.placeholder || '').slice(0, 100),
          required:    i === 0 ? true : !!q.required,   // first question always required
          short:       !!q.short,
          maxLength:   Math.min(Math.max(parseInt(q.maxLength) || 1000, 1), 4000),
        }))
      : [];

    doc.Categories.push({
      name:            name || 'Unnamed',
      value:           name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50) || `cat_${Date.now()}`,
      emoji:           emoji || '🎫',
      description:     description || 'Click to open a ticket',
      ticketCategory:  ticketCategory || null,
      pingRoles:       Array.isArray(pingRoles) ? pingRoles : [],
      welcomeMessage:  welcomeMessage || '',
      closeMessage:    closeMessage || '',
      maxOpen:         parseInt(maxOpen) || 0,
      staffOnly:       !!staffOnly,
      defaultPriority: defaultPriority || '',
      channelPrefix:   (channelPrefix || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20),
      intakeQuestions: sanitisedQuestions,
    });

    await doc.save();
    cache.invalidateNamespace('ticket');
    res.json({ success: true, categories: doc.Categories });
  } catch (e) {
    console.error('Category add error:', e);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

router.patch('/api/guild/:id/ticket/category/:value', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    const doc = await TicketSetup.findOne({ GuildID: req.params.id });
    if (!doc) return res.status(404).json({ error: 'No ticket setup found' });
    const cat = doc.Categories.find(c => c.value === req.params.value);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const fields = ['name','emoji','description','ticketCategory','welcomeMessage','closeMessage','maxOpen','staffOnly','defaultPriority','ticketType','threadChannel'];
    for (const f of fields) {
      if (req.body[f] !== undefined) cat[f] = req.body[f];
    }

    // Handle channelPrefix
    if (req.body.channelPrefix !== undefined) {
      cat.channelPrefix = (req.body.channelPrefix || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
    }

    // Handle pingRoles
    if (Array.isArray(req.body.pingRoles)) {
      cat.pingRoles = req.body.pingRoles;
    }

    // Handle intakeQuestions update
    if (Array.isArray(req.body.intakeQuestions)) {
      cat.intakeQuestions = req.body.intakeQuestions.slice(0, 5).map((q, i) => ({
        label:       String(q.label || '').slice(0, 45),
        placeholder: String(q.placeholder || '').slice(0, 100),
        required:    i === 0 ? true : !!q.required,
        short:       !!q.short,
        maxLength:   Math.min(Math.max(parseInt(q.maxLength) || 1000, 1), 4000),
      }));
    }

    await doc.save();
    cache.invalidateNamespace('ticket');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.delete('/api/guild/:id/ticket/category/:value', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    const doc = await TicketSetup.findOne({ GuildID: req.params.id });
    if (doc) {
      doc.Categories = doc.Categories.filter(c => c.value !== req.params.value);
      await doc.save();
    }
    cache.invalidateNamespace('ticket');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── Tags ──────────────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ticket/tags', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    let doc = await TicketSetup.findOne({ GuildID: req.params.id });
    if (!doc) doc = await TicketSetup.create({ GuildID: req.params.id, Everyone: req.params.id });

    const lim = await getLimits(req.user?.id, req.params.id);
    if ((doc.Tags?.length || 0) >= lim.ticketTags) {
      return res.status(400).json({ error: limitError(lim, 'ticket tags') });
    }

    const { name, color, emoji } = req.body;
    if (!name) return res.status(400).json({ error: 'Tag name required.' });
    if (doc.Tags.find(t => t.name === name)) return res.status(400).json({ error: 'A tag with that name already exists.' });

    doc.Tags.push({ name, color: color || '#6b7280', emoji: emoji || '🏷️' });
    await doc.save();
    cache.invalidateNamespace('ticket');
    res.json({ success: true, tags: doc.Tags });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

router.delete('/api/guild/:id/ticket/tags/:name', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    const doc = await TicketSetup.findOne({ GuildID: req.params.id });
    if (doc) {
      doc.Tags = doc.Tags.filter(t => t.name !== req.params.name);
      await doc.save();
    }
    cache.invalidateNamespace('ticket');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// ── Deploy panel ──────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ticket/deploy', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  try {
    const data = await TicketSetup.findOne({ GuildID: req.params.id });
    if (!data) return res.json({ success: false, error: 'No ticket setup found. Save your settings first before deploying.' });

    // ── Validate channel ──────────────────────────────────────────────────
    if (!data.Channel)
      return res.json({ success: false, error: 'No panel channel set. Go to General Settings and select a channel to send the panel to.' });

    const channel = guild?.channels.cache.get(data.Channel);
    if (!channel)
      return res.json({ success: false, error: 'The configured panel channel no longer exists. Go to General Settings and re-select the channel.' });
    if (!channel.isTextBased())
      return res.json({ success: false, error: 'The configured panel channel is not a text channel. Select a text channel in General Settings.' });

    // ── Validate categories ───────────────────────────────────────────────
    if (!data.Categories?.length)
      return res.json({ success: false, error: 'No categories configured. Add at least one category before deploying.' });

    // ── Validate each category emoji/label won't break the select menu ───
    const categories = data.Categories || [];
    const categoryErrors = [];
    for (const cat of categories) {
      if (!cat.name || cat.name.length > 25)
        categoryErrors.push(`Category "${cat.name || '(unnamed)'}" — name must be 1–25 characters.`);
      if (cat.description && cat.description.length > 50)
        categoryErrors.push(`Category "${cat.name}" — description must be 50 characters or less (currently ${cat.description.length}).`);
      if (cat.emoji && !isValidEmoji(cat.emoji))
        categoryErrors.push(`Category "${cat.name}" — emoji "${cat.emoji}" is invalid. Use a standard emoji or a Discord custom emoji (e.g. <:name:id>).`);
      if (!cat.value || !/^[a-z0-9_]{1,100}$/.test(cat.value))
        categoryErrors.push(`Category "${cat.name}" — internal value "${cat.value}" contains invalid characters. Delete and re-create this category.`);
    }
    if (categoryErrors.length)
      return res.json({ success: false, error: 'Category validation failed:\n• ' + categoryErrors.join('\n• ') });

    // ── Build embed ───────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setTitle((data.Title || 'Support Tickets').slice(0, 256))
      .setDescription((data.Description || 'Select a category to open a ticket.').slice(0, 4096))
      .setColor(data.Color || '#6C53FF');

    if (data.ThumbnailURL) {
      if (isValidUrl(data.ThumbnailURL)) embed.setThumbnail(data.ThumbnailURL);
    } else if (guild?.iconURL()) {
      embed.setThumbnail(guild.iconURL());
    }
    if (data.BannerURL   && isValidUrl(data.BannerURL))   embed.setImage(data.BannerURL);
    if (data.FooterText)  embed.setFooter({ text: data.FooterText.slice(0, 2048) });

    // ── Build select menu ─────────────────────────────────────────────────
    const options = categories.map(c => ({
      label:       (c.name || 'Unnamed').slice(0, 25),
      description: (c.description || 'Open a ticket').slice(0, 50),
      value:       c.value,
      emoji:       isValidEmoji(c.emoji) ? c.emoji : '🎫',
    }));

    // Discord select menus support max 25 options
    if (options.length > 25)
      return res.json({ success: false, error: `Too many categories (${options.length}). Discord only supports up to 25 options in a select menu. Remove some categories.` });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket-dropdown')
      .setPlaceholder('Select a topic…')
      .addOptions(options);

    // ── Send to channel ───────────────────────────────────────────────────
    try {
      await cbSend(req, req.params.id, channel, {
        embeds:     [embed.toJSON()],
        components: [new ActionRowBuilder().addComponents(menu).toJSON()],
      });
    } catch (apiErr) {
      console.error('[Ticket Deploy] Discord API error:', apiErr);
      const friendly = interpretDiscordApiError(apiErr, data, channel, guild);
      return res.json({ success: false, error: friendly });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Ticket Deploy] Unexpected error:', err);
    res.json({ success: false, error: 'Deployment failed: ' + (err.message || 'Unknown error') });
  }
});

/**
 * Converts a Discord API error into a user-friendly message with fix instructions.
 */
function interpretDiscordApiError(err, data, channel, guild) {
  const code    = err.code ?? err.rawError?.code;
  const status  = err.status ?? err.rawError?.status;
  const message = err.message || '';

  // Missing Permissions (50013)
  if (code === 50013 || message.includes('Missing Permissions')) {
    return (
      'RankCore is missing permissions to send messages in <#' + channel.id + '>. ' +
      'Fix: Go to **Server Settings → Channels → ' + (channel.name || 'panel channel') + ' → Permissions** and make sure RankCore has **Send Messages**, **Embed Links**, and **Use External Emojis** enabled.'
    );
  }

  // Missing Access (50001) — bot cannot see the channel
  if (code === 50001 || message.includes('Missing Access')) {
    return (
      'RankCore cannot access <#' + channel.id + '>. ' +
      'Fix: Open **Server Settings → Channels → ' + (channel.name || 'panel channel') + ' → Permissions** and add the RankCore bot role with **View Channel** permission.'
    );
  }

  // Unknown Channel (10003) — channel was deleted
  if (code === 10003) {
    return 'The panel channel no longer exists. Go to **Ticket Settings → General Settings** and select a new channel.';
  }

  // Invalid Form Body (50035) — usually a malformed embed or component
  if (code === 50035 || message.includes('Invalid Form Body')) {
    const detail = err.rawError?.errors ? JSON.stringify(err.rawError.errors).slice(0, 300) : message;
    return (
      'Discord rejected the panel message — one of the fields is invalid.\n\n' +
      'Common causes:\n' +
      '• **Embed title** is over 256 characters\n' +
      '• **Embed description** is over 4096 characters\n' +
      '• **Footer text** is over 2048 characters\n' +
      '• **Category name** is over 25 characters or **description** is over 50 characters\n' +
      '• **Banner/thumbnail URL** is not a valid image URL\n' +
      '• **Category emoji** is a custom emoji the bot cannot access (from another server)\n\n' +
      'Technical detail: ' + detail
    );
  }

  // Invalid Emoji (50035 with emoji context, or 10014)
  if (code === 10014 || message.toLowerCase().includes('emoji')) {
    return (
      'One of your category emojis is invalid or from a server the bot is not in.\n\n' +
      'Fix: Edit each category and either:\n' +
      '• Use a standard Unicode emoji (e.g. 🎫 🔧 💬)\n' +
      '• Use a custom emoji from **this server** only\n' +
      '• Remove the emoji entirely'
    );
  }

  // Cannot send messages to this user / channel not text (50007)
  if (code === 50007) {
    return 'Cannot send messages to this channel. Make sure it is a standard text channel, not a voice channel or announcement channel.';
  }

  // Slow mode / rate limited
  if (status === 429 || code === 20016) {
    return 'The channel has slowmode enabled or RankCore is being rate-limited. Wait a moment and try again.';
  }

  // Fallback with raw error info
  return (
    'Discord API error (code ' + (code || status || 'unknown') + '): ' + message + '\n\n' +
    'If this keeps happening, check that:\n' +
    '• RankCore has Send Messages and Embed Links permissions in the panel channel\n' +
    '• All category emojis are valid\n' +
    '• No embed fields exceed Discord\'s character limits'
  );
}

// ── Blacklist roles ───────────────────────────────────────────────────────────

router.get('/api/guild/:id/ticket/blacklist', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const doc = await TicketSetup.findOne({ GuildID: req.params.id }).lean();
  res.json({ blacklistedRoles: doc?.BlacklistedRoles || [] });
});

router.post('/api/guild/:id/ticket/blacklist/add', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'No roleId provided' });
  try {
    let setup = await TicketSetup.findOne({ GuildID: req.params.id });
    if (!setup) setup = new TicketSetup({ GuildID: req.params.id, BlacklistedRoles: [] });
    if (!Array.isArray(setup.BlacklistedRoles)) setup.BlacklistedRoles = [];
    if (!setup.BlacklistedRoles.includes(roleId)) {
      const lim = await getLimits(req.user?.id, req.params.id);
      if (setup.BlacklistedRoles.length >= lim.ticketBlacklist)
        return res.status(400).json({ error: limitError(lim, 'ticket blacklist') });
      setup.BlacklistedRoles.push(roleId);
      await setup.save();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/api/guild/:id/ticket/blacklist/remove', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'Role ID required' });
  try {
    await TicketSetup.updateOne({ GuildID: req.params.id }, { $pull: { BlacklistedRoles: roleId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Additional manage roles ───────────────────────────────────────────────────

router.post('/api/guild/:id/ticket/manage-roles/add', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'No roleId' });
  try {
    await TicketSetup.findOneAndUpdate({ GuildID: req.params.id }, { $addToSet: { AdditionalManageRoles: roleId } }, { upsert: true });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/api/guild/:id/ticket/manage-roles/remove', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'No roleId' });
  try {
    await TicketSetup.updateOne({ GuildID: req.params.id }, { $pull: { AdditionalManageRoles: roleId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Handler (support team) roles ─────────────────────────────────────────────
// The UI sends all support roles as HandlerRoles[]. The first is stored in the
// legacy Handlers field; the rest live in AdditionalManageRoles. These bulk-set
// routes let the frontend update the full list atomically.

router.post('/api/guild/:id/ticket/handler-roles', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roles } = req.body; // array of role IDs
  if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles must be an array' });
  try {
    const sanitised = roles.filter(r => typeof r === 'string' && r.trim());
    await TicketSetup.findOneAndUpdate(
      { GuildID: req.params.id },
      {
        Handlers:              sanitised[0] || null,
        AdditionalManageRoles: sanitised.slice(1),
      },
      { upsert: true },
    );
    cache.invalidateNamespace(`ticket:setup:${req.params.id}`);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Ping roles ────────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ticket/ping-roles/add', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'No roleId' });
  try {
    await TicketSetup.findOneAndUpdate({ GuildID: req.params.id }, { $addToSet: { PingRoles: roleId } }, { upsert: true });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/api/guild/:id/ticket/ping-roles/remove', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ error: 'No roleId' });
  try {
    await TicketSetup.updateOne({ GuildID: req.params.id }, { $pull: { PingRoles: roleId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Disable ───────────────────────────────────────────────────────────────────

router.delete('/api/guild/:id/ticket', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  await TicketSetup.deleteOne({ GuildID: req.params.id });
  res.json({ success: true });
});

// ── Transcripts ───────────────────────────────────────────────────────────────

router.get('/guild/:id/transcripts/:ticketId', isAuth, (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/transcript.html')));

router.get('/api/guild/:id/transcripts', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    const transcripts = await Transcript.find({ GuildID: req.params.id })
      .select('TicketID ChannelName OpenedBy ClosedBy ClosedAt Rating')
      .sort({ ClosedAt: -1 })
      .limit(200);
    res.json(transcripts || []);
  } catch { res.json([]); }
});

function canView(req, res, next) { return canViewTranscript(req, res, next); }

async function canViewTranscript(req, res, next) {
  try {
    const data = await Transcript.findOne({ TicketID: req.params.ticketId, GuildID: req.params.id });
    if (!data) return next();
    // Attach transcript to request for downstream use
    req._transcript = data;

    // Bot owners always pass
    const owners = await getOwners();
    if (owners.includes(req.user.id)) return next();

    const guild = req.client.guilds.cache.get(req.params.id);
    if (!guild) return denyTranscriptAccess(req, res);

    const member = await guild.members.fetch(req.user.id).catch(() => null);
    if (!member) return denyTranscriptAccess(req, res);

    // Admin / Manage Guild
    if (member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)) return next();

    // Ticket owner
    if (data.OpenedBy?.id === req.user.id) return next();

    // Handler / manage roles
    const setup = await TicketSetup.findOne({ GuildID: req.params.id });
    if (setup) {
      if (setup.Handlers && member.roles.cache.has(setup.Handlers)) return next();
      if (setup.AdditionalManageRoles?.some(r => member.roles.cache.has(r))) return next();
    }

    return denyTranscriptAccess(req, res);
  } catch { return denyTranscriptAccess(req, res); }
}

function denyTranscriptAccess(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(403).json({ error: 'You do not have permission to view this transcript.' });
  }
  return res.redirect('/servers');
}

router.get('/api/guild/:id/transcripts/:ticketId', isAuth, canView, async (req, res) => {
  try {
    const data = req._transcript;
    if (!data) return res.json({ TicketID: req.params.ticketId, Messages: [] });

    const safe = data.toObject();
    delete safe.EncryptedData;

    if (data.Encrypted && data.EncryptedData) {
      safe.Messages = decryptMessages(data.EncryptedData);
    }

    res.json(safe);
  } catch { res.json({ TicketID: req.params.ticketId, Messages: [] }); }
});

router.delete('/api/guild/:id/transcripts/:ticketId', isAuth, checkDashboardAccess('ticket'), async (req, res) => {
  try {
    await Transcript.deleteOne({ TicketID: req.params.ticketId, GuildID: req.params.id });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Delete failed' }); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidEmoji(emoji) {
  if (!emoji) return false;
  if (/\p{Emoji}/u.test(emoji)) return true;
  if (/^<a?:\w+:\d+>$/.test(emoji)) return true;
  return false;
}

function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch { return false; }
}

module.exports = router;