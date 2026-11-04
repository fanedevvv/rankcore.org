const { model, Schema } = require('mongoose');

const afkSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  reason: { type: String, default: "No Reason Given" },
  nickname: { type: String },
  timestamp: { type: Number, default: Date.now }
}, {
  indexes: [
    { userId: 1, guildId: 1 },
    { guildId: 1 }
  ]
});

const AFK_GUILD_PREFIX = 'AFK_GUILD_SETTINGS_';

module.exports = model('afkS', afkSchema);

module.exports.isGuildAfkEnabled = async function(guildId) {
  const settings = await this.findOne({ guildId: AFK_GUILD_PREFIX + guildId });
  return settings?.enabled ?? false;
};

module.exports.setGuildAfkEnabled = async function(guildId, enabled) {
  await this.findOneAndUpdate(
    { guildId: AFK_GUILD_PREFIX + guildId },
    { guildId: AFK_GUILD_PREFIX + guildId, enabled },
    { upsert: true, new: true }
  );
};