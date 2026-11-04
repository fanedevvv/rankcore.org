'use strict';
const { Schema, model } = require('mongoose');

/**
 * Staff Rating System
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks community ratings for individual staff members.
 * Users can upvote/downvote staff or leave a score + optional comment.
 * Ratings are guild-scoped and time-limited to prevent spam.
 */

const ratingEntrySchema = new Schema({
  raterId:    { type: String, required: true },  // user who left the rating
  score:      { type: Number, min: 1, max: 5, required: true },
  comment:    { type: String, default: '', maxlength: 300 },
  ratedAt:    { type: Date, default: Date.now },
  anonymous:  { type: Boolean, default: false },
}, { _id: false });

const staffRatingSchema = new Schema({
  guildId:    { type: String, required: true, index: true },
  staffId:    { type: String, required: true },   // staff member user ID

  // Aggregate stats (updated on each rating write for fast reads)
  totalRatings: { type: Number, default: 0 },
  totalScore:   { type: Number, default: 0 },      // sum of all scores
  averageScore: { type: Number, default: 0 },      // totalScore / totalRatings

  // Individual ratings (capped at 500 per staff member to avoid unbounded growth)
  ratings: { type: [ratingEntrySchema], default: [] },
}, { timestamps: true });

staffRatingSchema.index({ guildId: 1, staffId: 1 }, { unique: true });

/**
 * Add a new rating, updating aggregate stats.
 * Prevents duplicate ratings from the same user within a cooldown window.
 * @param {string} raterId
 * @param {number} score  1–5
 * @param {string} comment
 * @param {boolean} anonymous
 * @returns {{ success: boolean, reason?: string }}
 */
staffRatingSchema.methods.addRating = function (raterId, score, comment = '', anonymous = false) {
  const COOLDOWN_HOURS = 24;
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3_600_000);

  const recent = this.ratings.find(r => r.raterId === raterId && r.ratedAt > cutoff);
  if (recent) return { success: false, reason: `You can only rate this staff member once every ${COOLDOWN_HOURS} hours.` };

  // Cap array
  if (this.ratings.length >= 500) this.ratings.shift();

  this.ratings.push({ raterId, score, comment, anonymous, ratedAt: new Date() });
  this.totalRatings += 1;
  this.totalScore   += score;
  this.averageScore  = Math.round((this.totalScore / this.totalRatings) * 10) / 10;

  return { success: true };
};

// ── Staff Rating Config (per-guild settings) ──────────────────────────────────
const staffRatingConfigSchema = new Schema({
  guildId:         { type: String, required: true, unique: true },
  enabled:         { type: Boolean, default: false },
  logChannelId:    { type: String, default: null },   // where rating notifications are posted
  rateableRoleId:  { type: String, default: null },   // only users with this role can rate
  staffRoleId:     { type: String, default: null },   // who counts as rateable staff
  allowAnonymous:  { type: Boolean, default: true },
  cooldownHours:   { type: Number, default: 24 },
  minAccountAge:   { type: Number, default: 0 },      // days — prevents new accounts spamming
  requireText:     { type: Boolean, default: false }, // require a comment with every rating
  autoPost:        { type: Boolean, default: false },  // auto-post rating summary to log channel
}, { timestamps: true });

module.exports = {
  StaffRating:       model('StaffRating', staffRatingSchema),
  StaffRatingConfig: model('StaffRatingConfig', staffRatingConfigSchema),
};