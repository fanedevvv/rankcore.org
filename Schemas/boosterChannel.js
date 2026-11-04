const { model, Schema } = require("mongoose");

const boosterMessageSchema = new Schema({
  guildId:      { type: String, required: true, unique: true },
  channelId:    { type: String, default: "" },
  message:      { type: String, default: "" },
  isEmbed:      { type: Boolean, default: false },
  isImage:      { type: Boolean, default: false },
  // Embed fields
  author:       { type: String, default: "" },
  authorIcon:   { type: String, default: "" },
  title:        { type: String, default: "" },
  titleUrl:     { type: String, default: "" },
  description:  { type: String, default: "" },
  color:        { type: String, default: "" },
  thumbnail:    { type: String, default: "" },
  embedImage:   { type: String, default: "" },
  footer:       { type: String, default: "" },
  footerIcon:   { type: String, default: "" },
  timestamp:    { type: Boolean, default: false },
  // Card image background
  image:        { type: String, default: "" },
  // DM booster
  dmEnabled:    { type: Boolean, default: false },
  dmMessage:    { type: String, default: "" },
});

module.exports = model("BoosterMessage", boosterMessageSchema);