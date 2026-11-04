const { Schema, model } = require("mongoose");

const ownerSchema = new Schema({
    owners: {
        type: [String],
        default: () => [process.env.OWNER_ID].filter(Boolean), // ALWAYS included
    },
});

module.exports = model("BotOwners", ownerSchema);
