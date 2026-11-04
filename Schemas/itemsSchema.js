// models/itemsSchema.js
const mongoose = require("mongoose");

const itemsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: { type: [String], default: ["Toy Car", "Video Game", "Candy", "Phone", "Book"] },
});

module.exports = mongoose.model("Items", itemsSchema);
