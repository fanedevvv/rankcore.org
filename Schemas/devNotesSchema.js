const { Schema, model } = require("mongoose");

const devNotesSchema = new Schema({
  _id:       { type: String },                         // "devnotes" for shared board, ObjectId string for user notes
  title:     { type: String, default: "Untitled" },    // Note title
  content:   { type: String, default: "" },
  shared:    { type: Boolean, default: false },        // true = shared team board (singleton only)
  ownerId:   { type: String, default: null },          // Discord user ID (per-user notes)
  updatedBy: { type: String, default: null },          // Discord user ID of last editor
  createdAt: { type: Date,   default: Date.now },
  updatedAt: { type: Date,   default: Date.now },
});

module.exports = model("DevNotes", devNotesSchema);