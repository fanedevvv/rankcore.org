'use strict';
/**
 * dashboard/routes/Staff/staffrating.js
 *
 * Routes:
 *   GET  /guild/:id/staff-rating                          → serve page
 *   GET  /api/guild/:id/staff-rating/config               → get config
 *   POST /api/guild/:id/staff-rating/config               → save config
 *   GET  /api/guild/:id/staff-rating/leaderboard          → leaderboard
 *   GET  /api/guild/:id/staff-rating/reviews              → all reviews (filterable)
 *   GET  /api/guild/:id/staff-rating/member/:userId       → one staff member's ratings
 *   DELETE /api/guild/:id/staff-rating/review/:staffId/:idx → remove a review (admin)
 *   DELETE /api/guild/:id/staff-rating/reset              → reset all ratings
 */

const router = require('express').Router();
const path   = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess, checkGuildAccess } = require('../../middleware');
const { StaffRating, StaffRatingConfig } = require('../../../Schemas/staffRatingSchema');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/staff-rating',
  isAuth, checkGuildAccess,
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/staff-rating.html'))
);

// ── GET config ────────────────────────────────────────────────────────────────
router.get('/api/guild/:id/staff-rating/config', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const config = await StaffRatingConfig.findOne({ guildId: req.params.id }).lean();
    res.json(config ?? { guildId: req.params.id, enabled: false });
  } catch (err) {
    console.error('[staff-rating GET config]', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// ── POST config ───────────────────────────────────────────────────────────────
router.post('/api/guild/:id/staff-rating/config', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { enabled, logChannelId, staffRoleId, rateableRoleId, allowAnonymous,
            cooldownHours, minAccountAge, requireText, autoPost } = req.body;

    await StaffRatingConfig.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: { enabled, logChannelId, staffRoleId, rateableRoleId, allowAnonymous,
                cooldownHours, minAccountAge, requireText, autoPost } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[staff-rating POST config]', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// ── GET leaderboard ───────────────────────────────────────────────────────────
router.get('/api/guild/:id/staff-rating/leaderboard', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const ratings = await StaffRating.find({ guildId: req.params.id })
      .select('staffId totalRatings averageScore')
      .sort({ averageScore: -1, totalRatings: -1 })
      .limit(50)
      .lean();
    res.json(ratings);
  } catch (err) {
    console.error('[staff-rating GET leaderboard]', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ── GET reviews (optionally filtered by staffId or score) ─────────────────────
router.get('/api/guild/:id/staff-rating/reviews', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { staffId, score } = req.query;
    const query = { guildId: req.params.id };
    if (staffId) query.staffId = staffId;

    const docs = await StaffRating.find(query).lean();

    // Flatten all individual rating entries
    let reviews = [];
    for (const doc of docs) {
      for (const r of doc.ratings) {
        if (score && String(r.score) !== String(score)) continue;
        reviews.push({
          staffId:   doc.staffId,
          raterId:   r.anonymous ? null : r.raterId,
          score:     r.score,
          comment:   r.comment,
          ratedAt:   r.ratedAt,
          anonymous: r.anonymous,
        });
      }
    }

    // Sort newest first
    reviews.sort((a, b) => new Date(b.ratedAt) - new Date(a.ratedAt));
    res.json(reviews.slice(0, 200));
  } catch (err) {
    console.error('[staff-rating GET reviews]', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// ── GET one staff member's rating doc ─────────────────────────────────────────
router.get('/api/guild/:id/staff-rating/member/:userId', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const doc = await StaffRating.findOne({
      guildId: req.params.id,
      staffId: req.params.userId,
    }).lean();
    res.json(doc ?? { staffId: req.params.userId, totalRatings: 0, averageScore: 0, ratings: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load member ratings' });
  }
});

// ── DELETE reset all ratings ──────────────────────────────────────────────────
router.delete('/api/guild/:id/staff-rating/reset', isAuth, checkGuildAccess, async (req, res) => {
  try {
    await StaffRating.deleteMany({ guildId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset ratings' });
  }
});

module.exports = router;
