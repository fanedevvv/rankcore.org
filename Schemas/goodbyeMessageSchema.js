const { model, Schema } = require("mongoose");

const goodbyeMessageSchema = new Schema({
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
  // DM user on leave
  dmEnabled:    { type: Boolean, default: false },
  dmMessage:    { type: String, default: "" },
  // Add "Invited by @user · N invites" to the message (from the invite tracker's join record)
  showInvites:  { type: Boolean, default: false },
  inviteTitle:  { type: String, default: "" },   // empty = "📨 Invited by"
  inviteText:   { type: String, default: "" },   // empty = "{inviter} · **{invites}** invites"
});

module.exports = model("GoodbyeMessage", goodbyeMessageSchema);