const { Schema, model } = require('mongoose');

let sticky = new Schema({
    Guild: String,
    Message: String,
    Channel: String,
    Count: Number,
    Cap: Number,
    LastMessageId: { type: String, default: null },
    UseEmbed: { type: Boolean, default: true },       // false = send as plain text
    EmbedColor: { type: String, default: null },      // null = use client default
    IgnoreBots: { type: Boolean, default: true },     // true = bot messages don't count toward cap / don't trigger resend
    ConvoDetection: { type: Boolean, default: false },// true = suppress sticky during active conversations
    ConvoWindowMs: { type: Number, default: 8000 },   // ms window used to detect a conversation burst
});

module.exports = model('stickyschema', sticky);