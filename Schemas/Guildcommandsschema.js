const { Schema, model } = require('mongoose');

// Per-guild command settings. All commands are registered globally and ON by default;
// disabledCommands lists the ones a server manager switched off (enforced in slash.js).
const guildCommandsSchema = new Schema({
  guildId:             { type: String, required: true, unique: true },
  disabledCommands:    { type: [String], default: [] },       // command names switched OFF in this server
  enabledCommands:     { type: [String], default: [] },       // legacy opt-in list (only read by Custom Branding bots)
  commandDescriptions: { type: Map, of: String, default: {} }, // command name → custom description
}, { timestamps: true });

module.exports = model('GuildCommands', guildCommandsSchema);