const mongoose = require('mongoose');

const pendingDeletionSchema = new mongoose.Schema({
  guildId:  { type: String, required: true, unique: true, index: true },
  leftAt:   { type: Number, required: true, index: true },
}, {
  versionKey: false,
  timestamps: false,
});

pendingDeletionSchema.statics.markForDeletion = async function (guildId) {
  return this.findOneAndUpdate(
    { guildId },
    { $set: { leftAt: Date.now() } },
    { upsert: true, new: true }
  );
};

pendingDeletionSchema.statics.removeIfRejoined = async function (guildId) {
  return this.deleteOne({ guildId });
};

pendingDeletionSchema.statics.getExpired = async function (ageMs = 3 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - ageMs;
  return this.find({ leftAt: { $lt: cutoff } }).lean();
};

pendingDeletionSchema.statics.removeGuild = async function (guildId) {
  return this.deleteOne({ guildId });
};

module.exports = mongoose.models.PendingDeletion || mongoose.model('PendingDeletion', pendingDeletionSchema);
