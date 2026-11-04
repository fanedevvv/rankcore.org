'use strict';
/**
 * dashboard/routes/Staff/staffrecovery.js
 *
 * Routes:
 *   GET  /guild/:id/staff-recovery                       → serve page
 *   GET  /api/guild/:id/staff-recovery/keys              → list active keys (hashed, suffix only)
 *   POST /api/guild/:id/staff-recovery/generate          → generate a new key (returns plain once)
 *   DELETE /api/guild/:id/staff-recovery/key/:keyId      → revoke a key
 *   GET  /api/guild/:id/staff-recovery/audit             → audit log
 *   POST /api/guild/:id/staff-recovery/settings          → save settings
 */

const router = require('express').Router();
const path   = require('path');
const { isAuth, sendHTMLWithNonce, checkGuildAccess } = require('../../middleware');
const StaffRecoveryKey = require('../../../Schemas/staffRecoveryKey');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/staff-recovery',
  isAuth, checkGuildAccess,
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/staff-recovery.html'))
);

// ── GET keys list (never expose full hash, only last 4 chars) ─────────────────
router.get('/api/guild/:id/staff-recovery/keys', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const doc = await StaffRecoveryKey.findOne({ guildId: req.params.id })
      .select('_id label keyHash generatedBy generatedAt expiresAt used usedBy usedAt assignedUser settings')
      .lean();

    const settings = doc?.settings ?? {};

    if (!doc || !doc.keyHash) return res.json({ keys: [], settings });

    const key = {
      _id:          doc._id,
      label:        doc.label || 'Recovery Key',
      suffix:       doc.keyHash ? doc.keyHash.slice(-4).toUpperCase() : '????',
      generatedBy:  doc.generatedBy,
      generatedAt:  doc.generatedAt,
      expiresAt:    doc.expiresAt,
      status:       doc.used ? 'used' : (doc.expiresAt && doc.expiresAt < new Date() ? 'expired' : 'active'),
      usedBy:       doc.usedBy,
      assignedUser: doc.assignedUser,
      expiresIn:    doc.expiresAt ? formatRelative(doc.expiresAt) : 'Never',
    };

    res.json({ keys: [key], settings });
  } catch (err) {
    console.error('[staff-recovery GET keys]', err);
    res.status(500).json({ error: 'Failed to load keys' });
  }
});

// ── POST generate ─────────────────────────────────────────────────────────────
router.post('/api/guild/:id/staff-recovery/generate', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { label, assignedUser, roles, expiry = 48 } = req.body;

    if (!label?.trim()) return res.status(400).json({ error: 'Label is required' });

    // Generate plain key
    const plain = StaffRecoveryKey.generatePlainKey();
    const hash  = StaffRecoveryKey.hashKey(plain);

    const expiresAt = new Date(Date.now() + Number(expiry) * 3_600_000);

    await StaffRecoveryKey.findOneAndUpdate(
      { guildId: req.params.id },
      {
        $set: {
          keyHash:      hash,
          generatedBy:  req.user.id,
          generatedAt:  new Date(),
          expiresAt,
          used:         false,
          usedBy:       null,
          usedAt:       null,
          label:        label,
          assignedUser: assignedUser || null,
          roles:        Array.isArray(roles) ? roles : [],
        },
        $push: {
          auditLog: {
            action:    'generated',
            userId:    req.user.id,
            timestamp: new Date(),
            note:      label,
          },
        },
      },
      { upsert: true, new: true }
    );

    // Return the plain key ONCE — never stored again
    res.json({ success: true, key: plain });
  } catch (err) {
    console.error('[staff-recovery POST generate]', err);
    res.status(500).json({ error: 'Failed to generate key' });
  }
});

// ── DELETE revoke ─────────────────────────────────────────────────────────────
router.delete('/api/guild/:id/staff-recovery/key/:keyId', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const doc = await StaffRecoveryKey.findOneAndUpdate(
      { _id: req.params.keyId, guildId: req.params.id },
      {
        $set: { keyHash: null, used: true },
        $push: {
          auditLog: {
            action:    'revoked',
            userId:    req.user.id,
            timestamp: new Date(),
            note:      'Manual revocation via dashboard',
          },
        },
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: 'Key not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[staff-recovery DELETE revoke]', err);
    res.status(500).json({ error: 'Failed to revoke key' });
  }
});

// ── GET audit log ─────────────────────────────────────────────────────────────
router.get('/api/guild/:id/staff-recovery/audit', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const doc = await StaffRecoveryKey.findOne({ guildId: req.params.id })
      .select('auditLog')
      .lean();

    const log = (doc?.auditLog ?? [])
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// ── POST settings ─────────────────────────────────────────────────────────────
router.post('/api/guild/:id/staff-recovery/settings', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { defaultExpiry, alertChannelId, logUsage, revokeOnUse, dmKey } = req.body;
    // Store in the recovery key doc as settings sub-object
    await StaffRecoveryKey.findOneAndUpdate(
      { guildId: req.params.id },
      {
        $set: {
          'settings.defaultExpiry':  defaultExpiry,
          'settings.alertChannelId': alertChannelId,
          'settings.logUsage':       logUsage,
          'settings.revokeOnUse':    revokeOnUse,
          'settings.dmKey':          dmKey,
        },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function formatRelative(date) {
  const diff = date - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

module.exports = router;