const mongoose = require("mongoose");

const blockedTagsSchema = new mongoose.Schema({
    Guild: { type: String, required: true },
    Enabled: { type: Boolean, default: false },
    Tags: { type: [String], default: [] } // Fetched from API
});

module.exports = mongoose.model("BlockedTags", blockedTagsSchema);
