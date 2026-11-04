// routes/uwulock.js
const UwULock = require('../../../Schemas/uwuschema');
const CatLock = require('../../../Schemas/catschema');
const router  = require('express').Router();
const path    = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Validate a Discord snowflake ID (17–20 digits). */
function isValidSnowflake(id) {
  return typeof id === 'string' && /^\d{17,20}$/.test(id);
}

/**
 * Fetch a guild member safely, guaranteeing member.user is populated.
 * Returns the member object or null if not found / bot is not in the guild.
 */
async function fetchMember(client, guildId, userId) {
  try {
    const guild  = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch({ user: userId, force: true });
    // Defensive: member.user can still be a partial in rare cases — reject those
    if (!member?.user?.username) return null;
    return member;
  } catch (_) {
    return null;
  }
}

/**
 * Extract safe display info from a member, falling back to the raw ID.
 * Guards against partial user objects.
 */
function memberInfo(member, fallbackId) {
  if (!member?.user?.username) return { username: fallbackId, avatarUrl: null };
  return {
    username:  member.user.username,
    avatarUrl: member.user.displayAvatarURL({ size: 64, extension: 'webp' }),
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────
router.get('/guild/:id/uwulock', isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/uwulock.html'))
);

// ── GET all locked users for this guild ────────────────────────────────────────
router.get('/api/guild/:id/uwulock', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const records = await UwULock.find({ Guild: req.params.id });

    const client = (req.client || req.app.get('client'));
    const guild  = client
      ? await client.guilds.fetch(req.params.id).catch(() => null)
      : null;

    const enriched = await Promise.all(
      records.map(async (r) => {
        let username  = r.User;
        let avatarUrl = null;

        if (guild) {
          try {
            // force: true ensures the full user object is always populated
            const member = await guild.members.fetch({ user: r.User, force: true });
            if (member?.user?.username) {
              username  = member.user.username;
              avatarUrl = member.user.displayAvatarURL({ size: 64, extension: 'webp' });
            }
          } catch (_) {
            // Member may have left — fall back to stored ID
          }
        }

        return { userId: r.User, username, avatarUrl, lockedAt: r.LockedAt || null };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error('GET /uwulock error:', err);
    res.status(500).json({ error: 'Failed to fetch locked users' });
  }
});

// ── POST — add a UwU lock ──────────────────────────────────────────────────────
router.post('/api/guild/:id/uwulock', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const { userId } = req.body;

  // 1. Validate the incoming ID looks like a real snowflake
  if (!userId || !isValidSnowflake(userId)) {
    return res.status(400).json({ error: 'A valid Discord User ID is required' });
  }

  // 2. Confirm the target user is actually a member of THIS guild
  const client = (req.client || req.app.get('client'));
  let resolvedMember = null;
  if (client) {
    resolvedMember = await fetchMember(client, req.params.id, userId);
    if (!resolvedMember) {
      return res.status(404).json({ error: 'That user is not a member of this server' });
    }

    // 3. Prevent locking bots
    if (resolvedMember.user?.bot) {
      return res.status(400).json({ error: 'You cannot UwU-lock a bot OwO' });
    }
  }

  try {
    // 4. Prevent duplicates
    const existing = await UwULock.findOne({ Guild: req.params.id, User: userId });
    if (existing) {
      return res.status(409).json({ error: 'User is already UwU-locked' });
    }

    // 5. Block if user is already CatLocked
    const catLocked = await CatLock.findOne({ Guild: req.params.id, User: userId });
    if (catLocked) {
      return res.status(409).json({ error: 'User is already CatLocked! Remove their CatLock first.' });
    }

    await UwULock.create({ Guild: req.params.id, User: userId, LockedAt: new Date() });

    // 6. Return enriched data — reuse the member we already fetched in step 2
    const { username, avatarUrl } = memberInfo(resolvedMember, userId);
    res.json({ success: true, username, avatarUrl });
  } catch (err) {
    console.error('POST /uwulock error:', err);
    res.status(500).json({ error: 'Failed to add UwU lock' });
  }
});

// ── DELETE — remove a UwU lock ─────────────────────────────────────────────────
router.delete('/api/guild/:id/uwulock/:userId', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  // Validate the userId param before touching the database
  if (!isValidSnowflake(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid User ID' });
  }

  try {
    const result = await UwULock.deleteMany({
      Guild: req.params.id,
      User:  req.params.userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User is not UwU-locked' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /uwulock error:', err);
    res.status(500).json({ error: 'Failed to remove UwU lock' });
  }
});

// ── GET guild members (for dropdowns / autocomplete) ─────────────────────────
// Uses the guild's member cache to avoid triggering a bulk REQUEST_GUILD_MEMBERS
// (opcode 8) which gets rate limited on large servers. Cache is populated by
// normal bot activity; individual lookups fill gaps without bulk fetching.
router.get('/api/guild/:id/members', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const client = (req.client || req.app.get('client'));
    if (!client) return res.json([]);

    const guild = await client.guilds.fetch(req.params.id).catch(() => null);
    if (!guild) return res.json([]);

    // Use cached members only — do NOT call guild.members.fetch() with no args
    // as that fires opcode 8 and gets rate limited on servers with many members.
    const result = guild.members.cache
      .filter(m => m.user && !m.user.bot)
      .map(m => ({
        id:        m.user.id,
        username:  m.user.username,
        avatarUrl: m.user.displayAvatarURL({ size: 64, extension: 'webp' }),
      }))
      .sort((a, b) => a.username.localeCompare(b.username));

    res.json(result);
  } catch (err) {
    console.error('GET /members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── GET guild info (member count for stats) ───────────────────────────────────
router.get('/api/guild/:id/info', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const client = (req.client || req.app.get('client'));
    if (!client) return res.json({});

    const guild = await client.guilds.fetch(req.params.id).catch(() => null);
    if (!guild) return res.json({});

    res.json({ memberCount: guild.memberCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guild info' });
  }
});

module.exports = router;