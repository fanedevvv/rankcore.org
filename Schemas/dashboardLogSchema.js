const { model, Schema } = require("mongoose");

// ── Embed Send Log ─────────────────────────────────────────────────────────────
// Replaces: dashboard/logs/embed_sends.json
const embedSendLogSchema = new Schema({
    userId:     { type: String, required: true },
    guildId:    { type: String, required: true, index: true },
    channelId:  { type: String, required: true },
    command:    { type: String, required: true },
    content:    { type: String, default: null },
    embed:      { type: Schema.Types.Mixed, default: null },
    components: { type: Schema.Types.Mixed, default: null },
    messageId:  { type: String, default: null },
    timestamp:  { type: Date, default: Date.now },
}, { timestamps: false });

// ── Verify Send Log ────────────────────────────────────────────────────────────
// Replaces: dashboard/logs/verify/verify_sends.json
const verifySendLogSchema = new Schema({
    userId:    { type: String, required: true },
    guildId:   { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    command:   { type: String, required: true },
    embed:     { type: Schema.Types.Mixed, default: null },
    fields:    { type: Schema.Types.Mixed, default: null },
    footer:    { type: Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
}, { timestamps: false });

module.exports = {
    EmbedSendLog:  model("embedSendLog",  embedSendLogSchema),
    VerifySendLog: model("verifySendLog", verifySendLogSchema),
};
