'use strict';
const express        = require('express');
const router         = express.Router();
const path           = require('path');
const { isAuth, checkGuildAccess, sendHTMLWithNonce } = require('../../middleware');
const DashboardRoles = require('../../../Schemas/dashboardroles');
const { getLimits, limitError } = require('../Utils/limits');

// Only MANAGE_GUILD users can manage who has dashboard access
// ── Pages ─────────────────────────────────────────────────────────────────────
router.get('/guild/:id/dashboard-roles',
  isAuth, checkGuildAccess,
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/dashboard-roles.html'))
);

// ── GET current role config ───────────────────────────────────────────────────
router.get('/api/guild/:id/dashboard-roles', isAuth, checkGuildAccess, async (req, res) => {
  const doc = await DashboardRoles.findOne({ guildId: req.params.id }).lean();
  res.json({ roles: doc?.roles ?? [] });
});

// All available sections that can be granted
// `actions` (optional) lists fine-grained permission keys for this section.
// When present, dashboard-roles management UI shows action toggles.
const SECTIONS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'welcome',       label: 'Welcome System' },
  { id: 'goodbye',       label: 'Goodbye System' },
  { id: 'booster',       label: 'Booster System' },
  { id: 'moderation',    label: 'Auto Moderation' },
  { id: 'logs',          label: 'Audit Logs' },
  { id: 'verification',  label: 'Verification' },
  { id: 'role',          label: 'Auto Role' },
  { id: 'sticky',        label: 'Sticky Messages' },
  { id: 'security',      label: 'AntiNuke' },
  { id: 'massjoin',      label: 'Mass Join Protection' },
  { id: 'antispam',      label: 'Advanced Automod' },
  { id: 'antiscam',      label: 'Anti-Scam' },
  { id: 'giveaway',      label: 'Giveaways' },
  { id: 'leveling',      label: 'Leveling System' },
  { id: 'reaction',      label: 'Reaction Roles' },
  { id: 'jtc',           label: 'Join To Create' },
  { id: 'confession',    label: 'Confession System' },
  { id: 'suggestion',    label: 'Suggestion System' },
  { id: 'counting',      label: 'Counting System' },
  { id: 'ticket',        label: 'Ticket System' },
  { id: 'autoresponder', label: 'Autoresponder' },
  { id: 'embed',         label: 'Live Embed Creator' },
  { id: 'commands',      label: 'Command Manager' },
  { id: 'errors',        label: 'Error Log', actions: [
    { id: 'view',  label: 'View error logs' },
    { id: 'clear', label: 'Clear error logs' },
  ]},
];

router.get('/api/guild/:id/dashboard-roles/sections', isAuth, checkGuildAccess, (req, res) => {
  res.json(SECTIONS);
});

// ── POST add or update a role ─────────────────────────────────────────────────
router.post('/api/guild/:id/dashboard-roles/role', isAuth, checkGuildAccess, async (req, res) => {
  const guildId = req.params.id;
  const { roleId, roleName, sections, permissions } = req.body;
  if (!roleId || typeof roleId !== 'string') return res.status(400).json({ error: 'Invalid roleId' });
  if (!Array.isArray(sections)) return res.status(400).json({ error: 'sections must be an array' });

  const roleEntry = {
    roleId,
    roleName: roleName || '',
    sections,
    permissions: Array.isArray(permissions) ? permissions.filter(p => p && p.section) : [],
  };

  try {
    const doc = await DashboardRoles.findOne({ guildId });
    if (doc) {
      const idx = doc.roles.findIndex(r => r.roleId === roleId);
      if (idx >= 0) {
        doc.roles[idx] = roleEntry;
      } else {
        const lim = await getLimits(req.user?.id, guildId);
        if (doc.roles.length >= lim.dashboardRoles)
          return res.status(400).json({ error: limitError(lim, 'dashboard roles') });
        doc.roles.push(roleEntry);
      }
      await doc.save();
    } else {
      await DashboardRoles.create({ guildId, roles: [roleEntry] });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE remove a role ──────────────────────────────────────────────────────
router.delete('/api/guild/:id/dashboard-roles/role/:roleId', isAuth, checkGuildAccess, async (req, res) => {
  const { id: guildId, roleId } = req.params;
  try {
    await DashboardRoles.findOneAndUpdate({ guildId }, { $pull: { roles: { roleId } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET guild roles from Discord (for the picker) ─────────────────────────────
router.get('/api/guild/:id/dashboard-roles/guild-roles', isAuth, checkGuildAccess, async (req, res) => {
  const guildId = req.params.id;
  const guild   = req.client?.guilds?.cache?.get(guildId);

  // Standalone / shim mode — proxy to internal bot API
  if (!guild || guild._isShim || !guild.roles?.cache?.size) {
    try {
      const BOT_API = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';
      const resp = await fetch(`${BOT_API}/internal/guild/${guildId}/roles`, {
        headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || (() => { throw new Error('INTERNAL_API_SECRET not set'); })() },
      });
      if (!resp.ok) return res.status(503).json({ error: 'Bot not reachable' });
      const data = await resp.json();
      // Filter out @everyone (id === guildId) and bot-managed roles
      const roles = data
        .filter(r => r.id !== guildId && !r.managed)
        .map(r => ({ id: r.id, name: r.name, color: r.color || null }));
      return res.json(roles);
    } catch {
      return res.status(503).json({ error: 'Bot not reachable' });
    }
  }

  // Inline mode — read directly from discord.js cache
  const roles = guild.roles.cache
    .filter(r => !r.managed && r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => ({ id: r.id, name: r.name, color: r.hexColor || r.color || null }));
  res.json(roles);
});

// ── GET current user's dashboard access for this guild ───────────────────────
// Used by sidebar.js to decide which pages to show/hide.
// Returns { isManager: bool, sections: [sectionId, ...] }
// isManager = true means full access (MANAGE_GUILD); sections = granted section ids.
router.get('/api/guild/:id/my-dashboard-access', isAuth, async (req, res) => {
  const guildId = req.params.id;
  const MANAGE_GUILD = 1n << 5n;

  // Check MANAGE_GUILD first
  let userGuild = req.user?.guilds?.find(g => g.id === guildId);
  if (!userGuild && req.user?.accessToken) {
    // Attempt refresh — re-read from session after
    try {
      const resp = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${req.user.accessToken}` },
      });
      if (resp.ok) {
        req.user.guilds = await resp.json();
        userGuild = req.user.guilds?.find(g => g.id === guildId);
      }
    } catch {}
  }
  if (userGuild) {
    const perms = BigInt(userGuild.permissions ?? 0);
    if ((perms & MANAGE_GUILD) === MANAGE_GUILD) {
      return res.json({ isManager: true, sections: ['*'], grants: [] });
    }
  }

  // Role-based: collect all sections granted to this user.
  // member.roles.cache is not available on the BotClientShim, so we call the
  // dedicated /internal/guild/:id/member/:userId/roles endpoint instead.
  try {
    const config = await DashboardRoles.findOne({ guildId }).lean();
    if (config?.roles?.length) {
      let memberRoleIds = null;

      // Try shim-safe internal API first
      try {
        const BOT_API = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';
        const resp = await fetch(
          `${BOT_API}/internal/guild/${guildId}/member/${req.user.id}/roles`,
          { headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || (() => { throw new Error('INTERNAL_API_SECRET not set'); })() } }
        );
        if (resp.ok) {
          const data = await resp.json();
          memberRoleIds = new Set(data.roleIds || []);
        }
      } catch {}

      // Fallback: try discord.js member directly (inline mode)
      if (!memberRoleIds) {
        const client = req.client;
        const guild  = client?.guilds?.cache?.get(guildId);
        const member = guild ? await guild.members.fetch(req.user.id).catch(() => null) : null;
        if (member?.roles?.cache) memberRoleIds = new Set(member.roles.cache.keys());
      }

      if (memberRoleIds) {
        const granted = new Set();
        let grants = []; // { section, actions }
        for (const entry of config.roles) {
          if (!memberRoleIds.has(entry.roleId)) continue;
          if (entry.sections.includes('*')) return res.json({ isManager: false, sections: ['*'], grants: [] });
          entry.sections.forEach(s => granted.add(s));
          if (entry.permissions?.length) {
            for (const p of entry.permissions) {
              if (p.actions?.length) {
                let existing = grants.find(g => g.section === p.section);
                if (existing) {
                  p.actions.forEach(a => { if (!existing.actions.includes(a)) existing.actions.push(a); });
                } else {
                  grants.push({ section: p.section, actions: [...p.actions] });
                }
              }
            }
          }
        }
        if (granted.size) return res.json({ isManager: false, sections: [...granted], grants });
      }
    }
  } catch {}

  // No access at all — still return shape (they wouldn't reach this via normal nav)
  return res.json({ isManager: false, sections: [], grants: [] });
});

module.exports = router;