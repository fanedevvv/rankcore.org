const mongoose = require('mongoose');

const disabledPageSchema = new mongoose.Schema({
  pageKey:    { type: String, required: true, unique: true, index: true },
  reason:     { type: String, default: null },
  disabledBy: { type: String, default: null },
  disabledById: { type: String, default: null },
  disabledAt: { type: Number, default: Date.now },
}, {
  versionKey: false,
  timestamps: false,
});

disabledPageSchema.statics.isDisabled = async function (pageKey) {
  const doc = await this.findOne({ pageKey }).lean();
  return !!doc;
};

disabledPageSchema.statics.togglePage = async function (pageKey, data, enable) {
  if (enable) {
    return this.deleteOne({ pageKey });
  }
  return this.findOneAndUpdate(
    { pageKey },
    { $set: {
      reason: data.reason || null,
      disabledBy: data.disabledBy || null,
      disabledById: data.disabledById || null,
      disabledAt: Date.now(),
    }},
    { upsert: true, new: true }
  );
};

disabledPageSchema.statics.getAllDisabled = async function () {
  const docs = await this.find().lean();
  const map = {};
  for (const doc of docs) {
    map[doc.pageKey] = {
      reason: doc.reason,
      by: doc.disabledBy,
      byId: doc.disabledById,
      at: doc.disabledAt,
    };
  }
  return map;
};

module.exports = mongoose.models.DisabledPage || mongoose.model('DisabledPage', disabledPageSchema);
