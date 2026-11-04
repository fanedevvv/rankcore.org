const { model, Schema } = require("mongoose");

let reaction = new Schema({
    Guild: String,
    Message: String,
    Emoji: String,
    Role: String
});

const ReactionRole = model("rrs", reaction);

// Named export required by scripts/migration_reactionroles.js
const ReactionRoleGroup = ReactionRole;

module.exports = ReactionRole;
module.exports.ReactionRoleGroup = ReactionRoleGroup;