const mongoose = require('mongoose');

const statusOverrideSchema = new mongoose.Schema({
  status:      { type: String, enum: ['operational', 'degraded', 'recovering', 'down'], required: true },
  reason:      { type: String, default: null },
  setBy:       { type: String, default: null },
  setById:     { type: String, default: null },
  setAt:       { type: Number, default: Date.now },
  expiresAt:   { type: Number, default: null },
}, {
  versionKey: false,
  timestamps: false,
});

statusOverrideSchema.statics.getOverride = async function () {
  const doc = await this.findOne().lean();
  if (!doc) return null;

  if (doc.expiresAt && Date.now() > doc.expiresAt) {
    await this.deleteMany({});
    return null;
  }

  return doc;
};

statusOverrideSchema.statics.setOverride = async function (obj) {
  if (obj === null) {
    return this.deleteMany({});
  }
  return this.findOneAndUpdate(
    {},
    { $set: obj },
    { upsert: true, new: true, lean: true }
  );
};

module.exports = mongoose.models.StatusOverride || mongoose.model('StatusOverride', statusOverrideSchema);
