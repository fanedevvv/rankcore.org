const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema(
  {
    // Singleton doc — always use _id: "maintenance"
    _id: { type: String, default: "maintenance" },

    enabled: { type: Boolean, default: false },

    // Headline shown on the maintenance page
    title: {
      type: String,
      default: "We're offline for maintenance!",
      maxlength: 120,
    },

    // Longer description / reason
    message: {
      type: String,
      default: "We're making some improvements. We'll be back shortly.",
      maxlength: 500,
    },

    // Optional ETA — if set, a countdown is shown; if null, no countdown
    eta: { type: Date, default: null },

    // Who triggered the maintenance mode and when
    triggeredBy: { type: String, default: null }, // Discord user ID
    triggeredAt: { type: Date, default: null },

    // IPs/paths to bypass maintenance (comma-separated or array)
    bypassIPs: { type: [String], default: [] },
  },
  {
    // Disable auto _id since we use a fixed string key
    _id: false,
    versionKey: false,
    timestamps: false,
  }
);

module.exports =
  mongoose.models.Maintenance ||
  mongoose.model("Maintenance", maintenanceSchema);