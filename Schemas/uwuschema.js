const mongoose = require("mongoose");

const uwuSchema = new mongoose.Schema({
    Guild: String,
    User: String,
});

module.exports = mongoose.model("UwULock", uwuSchema);
