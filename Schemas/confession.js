const mongoose = require('mongoose');

const confessionConfigSchema = new mongoose.Schema({
    Guild: { type: String, required: true, unique: true },

    // ── Core channels ────────────────────────────────────────────────────────
    ConfessionChannel:  { type: String, default: null },
    ReviewChannel:      { type: String, default: null },
    LogChannel:         { type: String, default: null },
    ReportChannel:      { type: String, default: null },   // ← NEW: dedicated report destination

    // ── Review settings ──────────────────────────────────────────────────────
    ReviewEnabled:      { type: Boolean, default: false },
    AnonymousReview:    { type: Boolean, default: true },
    ReviewPingRole:     { type: String,  default: null },
    AutoApproveAfterMs: { type: Number,  default: 0 },

    // ── Posting settings ─────────────────────────────────────────────────────
    ConfessionPingRole: { type: String,  default: null },
    ReportPingRole:     { type: String,  default: null },  // ← NEW: role pinged on reports
    ConfessionTitle:    { type: String,  default: '<:suggestion:1555544601501237322> Anonymous Confession' },
    ConfessionColor:    { type: String,  default: '#5865F2' },
    ConfessionFooter:   { type: String,  default: '' },
    ShowConfessionNumber: { type: Boolean, default: true },

    // ── Numbering ────────────────────────────────────────────────────────────
    ConfessionCount:    { type: Number,  default: 0 },

    // ── Cooldowns ────────────────────────────────────────────────────────────
    CooldownSeconds:    { type: Number,  default: 60 },

    // ── Length limits ────────────────────────────────────────────────────────
    MaxConfessionLength: { type: Number, default: 2000 },
    MinConfessionLength: { type: Number, default: 10 },

    // ── Access control ───────────────────────────────────────────────────────
    Blacklist:          { type: [String], default: [] },
    TrustedUsers:       { type: [String], default: [] },
    ModeratorRoles:     { type: [String], default: [] },
    RequiredRoles:      { type: [String], default: [] },

    // ── Word filter ──────────────────────────────────────────────────────────
    WordFilterEnabled:  { type: Boolean, default: false },
    BlockedWords:       { type: [String], default: [] },
    FilterAction:       { type: String,  default: 'block', enum: ['block', 'review'] },

    // ── Reactions ────────────────────────────────────────────────────────────
    ReactionsEnabled:   { type: Boolean, default: true },
    ReactionEmojis:     { type: [String], default: ['<:Red_Heart:1555544329605615758>', '😂', '😮', '😢'] },

    // ── Scheduled confessions ────────────────────────────────────────────────
    ScheduledConfessions: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // ── Categories ───────────────────────────────────────────────────────────
    CategoriesEnabled:  { type: Boolean, default: false },
    Categories: [{
        label:   { type: String },
        emoji:   { type: String },
        channel: { type: String, default: null },
    }],

    // ── DM notifications ────────────────────────────────────────────────────
    DMOnApprove:        { type: Boolean, default: false },
    DMOnDeny:           { type: Boolean, default: false },

    // ── Thread replies ───────────────────────────────────────────────────────
    ThreadReplies:      { type: Boolean, default: false },

    // ── Stats ────────────────────────────────────────────────────────────────
    TotalPosted:        { type: Number, default: 0 },
    TotalDenied:        { type: Number, default: 0 },
    TotalFiltered:      { type: Number, default: 0 },
});

module.exports = mongoose.model('confessionConfig', confessionConfigSchema);