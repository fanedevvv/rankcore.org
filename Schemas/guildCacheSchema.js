const mongoose = require("mongoose");
const guildCacheSchema = new mongoose.Schema(
  {
    guildId: {
      type:     String,
      required: true,
    },

    // Matches the keys in GUILD_FETCHERS ("welcome", "ticket", "leveling", …)
    key: {
      type:     String,
      required: true,
    },

    // The raw value returned by the fetcher (document, array, nested object, or null)
    data: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Absolute expiry timestamp — TTL index fires once this date passes.
    expiresAt: {
      type:     Date,
      required: true,
    },
  },
  { timestamps: false }
);

// Compound unique index: one cache entry per guild+key combination.
// This also enforces that an upsert on {guildId, key} touches exactly one doc.
guildCacheSchema.index({ guildId: 1, key: 1 }, { unique: true });

// TTL index for automatic eviction — mirrors CACHE_TTL (30 s) without a setInterval.
guildCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("GuildCache", guildCacheSchema);