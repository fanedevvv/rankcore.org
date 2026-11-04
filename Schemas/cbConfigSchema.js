const mongoose = require("mongoose");

const cbConfigSchema = new mongoose.Schema({
  _id: { type: String, default: "global" },
  globalDisabled: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

cbConfigSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("CbConfig", cbConfigSchema);
