const { model, Schema } = require('mongoose');

let countschema = new Schema({
    Guild: String,
    Channel: String,
    Count: { type: Number, default: 0 },
    LastUser: { type: String, default: null },

    // New features
    HighScore: { type: Number, default: 0 },          // All-time high score
    AllowWords: { type: Boolean, default: true },      // Allow text alongside numbers
    FailAction: { type: String, default: 'reset' },   // 'reset' | 'warn' (warn = no reset, just notify)
    FailRole: { type: String, default: null },         // Role to assign on fail
    RewardRoles: { type: Map, of: String, default: {} }, // milestone -> roleId map e.g. { "100": "roleId" }
    WebhookURL: { type: String, default: null, select: false },       // Optional webhook for milestone alerts
    CountHistory: { type: [Object], default: [] },     // Last 10 reset events { user, count, reason, date }
    TotalCounts: { type: Number, default: 0 },         // Lifetime successful counts
    TotalFails: { type: Number, default: 0 },          // Lifetime fails
    Milestones: { type: [Number], default: [10, 25, 50, 100, 250, 500, 1000] }, // Custom milestone numbers
    CountdownMode: { type: Boolean, default: false },  // Count down from a start number
    CountdownStart: { type: Number, default: 100 },    // Starting number for countdown
    PingOnFail: { type: Boolean, default: false },     // Ping the user who failed
    ShowLeaderboard: { type: Boolean, default: true }, // Track per-user counts
    UserCounts: { type: Map, of: Number, default: {} }, // userId -> count of successful counts
});

module.exports = model('countschema', countschema);