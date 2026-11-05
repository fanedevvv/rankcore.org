'use strict';
const { model, Schema } = require('mongoose');

const TicketSetupSchema = new Schema({
  GuildID: { type: String, required: true, unique: true },

  Channel:     { type: String, default: null },
  Transcripts: { type: String, default: null },
  Handlers:    { type: String, default: null },
  Everyone:    { type: String, default: null },

  BlacklistedRoles:      { type: [String], default: [] },
  AdditionalManageRoles: { type: [String], default: [] },
  PingRoles:             { type: [String], default: [] },
  UrgentRoleId:          { type: String,   default: null },

  Title:        { type: String, default: 'Support Tickets' },
  Description:  { type: String, default: 'Select a category below to open a ticket.' },
  Color:        { type: String, default: '#6C53FF' },
  FooterText:   { type: String, default: '' },
  ThumbnailURL: { type: String, default: '' },
  BannerURL:    { type: String, default: '' },

  TicketPrefix:      { type: String,  default: 'ticket' },
  MaxTicketsPerUser: { type: Number,  default: 1 },

  // Ticket type: 'channel' = create separate channel (requires category), 'thread' = create thread in channel (requires thread channel)
  TicketType: { type: String, enum: ['channel', 'thread'], default: 'channel' },
  // For thread mode: the text channel where threads are created
  ThreadChannel: { type: String, default: null },
  // For channel mode: the default category for new tickets
  TicketCategory: { type: String, default: null },

  AutoCloseMinutes:        { type: Number, default: 0 },
  AutoCloseWarningMessage: { type: String, default: 'Your ticket will be closed soon due to inactivity.' },

  RequireReason:   { type: Boolean, default: true },
  MentionOnCreate: { type: Boolean, default: true },

  WelcomeTitle:   { type: String, default: 'Ticket Opened' },
  WelcomeMessage: { type: String, default: 'A staff member will be with you shortly. Please describe your issue in detail.' },

  RequireCloseReason: { type: Boolean, default: true },
  SendHTMLTranscript: { type: Boolean, default: true },
  SaveWebTranscript:  { type: Boolean, default: true },
  DMOnClose:          { type: Boolean, default: true },
  CloseMessage:       { type: String,  default: '' },

  EnablePriority: { type: Boolean, default: false },

  EnableRating:   { type: Boolean, default: false },
  RatingMessage:  { type: String, default: 'How was your support experience? Rate us below.' },

  AutoDeleteOnClose: { type: Boolean, default: false },

  Tags: [{
    name:  { type: String, required: true },
    color: { type: String, default: '#6b7280' },
    emoji: { type: String, default: '<:thread:1567797010692706324>' },
  }],

  Categories: [{
    emoji:           { type: String,  default: '<:gw:1567796972872536159>' },
    name:            { type: String,  required: true },
    value:           { type: String,  required: true },
    description:     { type: String,  default: 'Click to open a ticket' },
    // Per-category overrides (optional, falls back to global settings)
    ticketCategory:  { type: String,  default: null },   // for channel mode
    threadChannel:     { type: String,  default: null },   // for thread mode
    ticketType:       { type: String,  enum: ['channel', 'thread', ''], default: '' },  // '' = use global setting
    pingRoles:       { type: [String], default: [] },
    welcomeMessage:  { type: String,  default: '' },
    closeMessage:    { type: String,  default: '' },
    maxOpen:         { type: Number,  default: 0 },
    staffOnly:       { type: Boolean, default: false },
    defaultPriority: { type: String,  enum: ['low','medium','high','urgent',''], default: '' },
    channelPrefix:   { type: String,  default: '' },            // per-category channel name prefix
    // Per-category role/channel overrides (item 2)
    submissionChannelId: { type: String, default: null },   // override log channel per category
    deniedRoleId:        { type: String, default: null },   // role applied on ticket deny
    checkDuplicates:     { type: Boolean, default: false },  // diff-checker: block if open ticket exists
    // Intake questions — shown in the Discord modal when a user opens a ticket (max 5)
    // At least 1 question can be marked mandatory; up to 4 others are optional.
    intakeQuestions: [{
      id:          { type: String,  default: () => Math.random().toString(36).slice(2,8) },
      label:       { type: String,  required: true },
      placeholder: { type: String,  default: '' },
      required:    { type: Boolean, default: false },   // true = mandatory (max 1)
      mandatory:   { type: Boolean, default: false },   // alias kept for clarity
      short:       { type: Boolean, default: false },
      maxLength:   { type: Number,  default: 1000 },
      _id: false,
    }],
  }],
});

module.exports = model('TicketSetup', TicketSetupSchema);
