const { model, Schema } = require('mongoose');

let memberStats = new Schema({
    GuildID: String,
    Date: { type: Date, default: Date.now },
    Members: Number,
    Humans: Number,
    Bots: Number
});

// One document per guild per calendar day — prevents duplicate entries
// when the bot restarts multiple times in the same day.
memberStats.index({ GuildID: 1, Date: 1 }, { unique: true });

module.exports = model('memberStats', memberStats);