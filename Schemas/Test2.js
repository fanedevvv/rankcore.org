const mongoose = require("mongoose");

const testSchema = new mongoose.Schema({
  name: String
});

module.exports = mongoose.models.Test2 || mongoose.model("Test2", testSchema);
