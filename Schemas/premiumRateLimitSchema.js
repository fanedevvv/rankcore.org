const mongoose = require("mongoose");

const premiumRateLimitSchema = new mongoose.Schema(
  {
    ipHash: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    ipEnc: {
      type:     String,
      default:  null,
      select:   false,
    },
    count: {
      type:    Number,
      default: 0,
    },
    windowExpiresAt: {
      type:     Date,
      required: true,
    },
  },
  { timestamps: false }
);

premiumRateLimitSchema.index({ windowExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PremiumRateLimit", premiumRateLimitSchema);
