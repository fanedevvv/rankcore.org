// Schemas/tosSchema.js
const { Schema, model } = require("mongoose");

const tosSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    acceptedAt: { type: Date, default: Date.now },
});

module.exports = model("tosAcceptance", tosSchema);
