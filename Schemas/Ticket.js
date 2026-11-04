'use strict';
const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  authorId:   { type: String, required: true },
  authorName: { type: String, default: 'Staff' },
  content:    { type: String, required: true },
  createdAt:  { type: Date,   default: Date.now },
});

const TicketSchema = new mongoose.Schema({
  GuildID:   { type: String, required: true },
  OwnerID:   { type: String, required: true },
  MembersID: { type: [String], default: [] },
  TicketID:  { type: String, required: true },
  ChannelID: { type: String, required: true },
  Category:  { type: String, default: null },

  Locked:    { type: Boolean, default: false },
  Claimed:   { type: Boolean, default: false },
  ClaimedBy: { type: String,  default: null },
  AssignedTo:{ type: String,  default: null },

  Priority:  { type: String, enum: ['low','medium','high','urgent', null], default: null },
  Tags:      { type: [String], default: [] },
  Notes:     { type: [NoteSchema], default: [] },

  Rating:       { type: Number, min: 1, max: 5, default: null },
  RatingMessageId: { type: String, default: null }, // DM message id for the rating

  Closed:           { type: Boolean, default: false },
  CreatedAt:        { type: Date,    default: Date.now },
  ClosedAt:         { type: Date,    default: null },
  FirstResponseAt:  { type: Date,    default: null }, // first staff message timestamp
  RemindTimeout:    Number,
});

module.exports = mongoose.model('Ticket', TicketSchema);
