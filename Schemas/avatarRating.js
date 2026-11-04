const mongoose = require("mongoose");

const avatarRatingSchema = new mongoose.Schema({
  Guild: String,
  User: String,
  Ratings: {
    type: [Number], // Array of all ratings
    default: [],
  },
});

module.exports = mongoose.model("avatarRating", avatarRatingSchema);
