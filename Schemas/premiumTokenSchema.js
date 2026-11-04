const mongoose = require("mongoose");
const premiumTokenSchema = new mongoose.Schema(
  {
    // SHA-256 hash of the raw token sent to the client
    tokenHash: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    // Which authenticated user this token belongs to — prevents one user
    // from racing another user's token even if they somehow obtained it.
    userId: {
      type:     String,
      required: true,
    },

    // Hard expiry stored in the document; TTL index drives automatic deletion.
    // The application also checks this on read as a belt-and-suspenders guard.
    expiresAt: {
      type:     Date,
      required: true,
    },

    // Whether the token has already been consumed.
    // We delete on use (atomic findOneAndDelete), but this field acts as a
    // safety net if two requests race between find and delete.
    used: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: false }
);

// MongoDB TTL index — automatically removes expired documents.
// The index fires approximately every 60 s on the MongoDB side.
premiumTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PremiumToken", premiumTokenSchema);