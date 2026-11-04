const mongoose = require("mongoose");

const massJoinProtectionSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
  },
  massJoinLimit: {
    type: Number,
    required: true,
  },
  punishment: {
    type: String,
    enum: ["mute", "kick", "ban", "lockChannels", "hideChannels"],
    required: true,
  },
  timeLimit: {
    type: Number,
    default: 15,
  },
  isEnabled: {
    type: Boolean,
    default: false,
  },
  joins: [
    {
      userId: String,
      time: Number,
    },
  ],
});

/*
true
624022
f34r
30942
216578
1752752319
cf4dffce6f00295f939d75ed5c227450
*/

module.exports = mongoose.model("MassJoinProtection", massJoinProtectionSchema);
