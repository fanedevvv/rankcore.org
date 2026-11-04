const mongoose = require("mongoose");

const catSchema = new mongoose.Schema({
    Guild: String,
    User: String,
    LockedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CatLock", catSchema);