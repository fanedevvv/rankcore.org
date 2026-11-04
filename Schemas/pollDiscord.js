const { model, Schema } = require("mongoose");

const schema = new Schema({
    Guild:    String,
    Author:   String,
    Channel:  String,
    Message:  String,
    isAdmin:  Boolean,
    // %%VERSION%%
    Question: String,
    Answers:  Array,
    Duration: String,
    AllowMultiSelect: Boolean,

    // ── Restart-survival fields ──────────────────────────────────────
    // Votes stored as { "0": ["userId1","userId2"], "1": [...], ... }
    Votes:     { type: Object, default: {} },
    // Unix timestamp (seconds) when the poll ends
    EndTs:     { type: Number, default: 0 },
    // Hex accent colour, e.g. 0x5865f2
    Accent:    { type: Number, default: 0 },
    // Display tag of the poll author
    AuthorTag: { type: String, default: "" },
})

module.exports = model("discord_polls", schema);