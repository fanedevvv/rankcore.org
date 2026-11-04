"use strict";
const { model, Schema } = require("mongoose");

const AnswerSchema = new Schema({
  questionId:  { type: String, required: true },
  label:       { type: String, required: true },
  answer:      { type: String, default: "" },
}, { _id: false });

const StaffApplicationSubmissionSchema = new Schema({
  guildId:     { type: String, required: true, index: true },
  panelId:     { type: String, required: true, index: true },
  submissionId:{ type: String, required: true, unique: true }, // random slug

  // Applicant
  userId:      { type: String, required: true },
  userTag:     { type: String, default: "" },      // username#discriminator at time of apply
  userAvatar:  { type: String, default: null },

  // Answers
  answers:     { type: [AnswerSchema], default: [] },

  // Review state
  status:      { type: String, default: "pending", enum: ["pending", "accepted", "denied"] },
  reviewedBy:  { type: String, default: null },    // userId of reviewer
  reviewNote:  { type: String, default: "" },      // optional note added on accept/deny

  // Discord message tracking
  logMessageId:   { type: String, default: null }, // message in log channel
  logChannelId:   { type: String, default: null },
  reviewViaCB:    { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model("StaffApplicationSubmission", StaffApplicationSubmissionSchema);
