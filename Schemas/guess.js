'use strict';
const { Schema, model } = require('mongoose');

const guessSchema = new Schema({
  guildId:   { type: String, required: true, unique: true },
  channelId: { type: String, required: true },

  // Core
  number:    { type: Number, required: true, default: 100 },
  minNumber: { type: Number, default: 1 },
  maxNumber: { type: Number, default: 1000 },

  // Behaviour
  enabled:         { type: Boolean, default: true },
  allowRepeats:    { type: Boolean, default: false },  // same user can't guess twice in a row
  deleteWrong:     { type: Boolean, default: false },  // auto-delete wrong guesses
  hintsEnabled:    { type: Boolean, default: true },   // too high / too low hints
  cooldownSeconds: { type: Number,  default: 0 },      // per-user guess cooldown (0 = none)

  // Win behaviour
  autoReset:       { type: Boolean, default: true },   // auto-pick new number on win
  winRoleId:       { type: String,  default: null },   // role given to winner
  winRoleDuration: { type: Number,  default: 0 },      // hours to keep it (0 = permanent)

  // Messages (support {user} {number} {tries} variables)
  msgWin:     { type: String, default: '<:boost:1567796953599836280> {user} guessed the number **{number}** in **{tries}** tries!' },
  msgTooHigh: { type: String, default: '<:n_utils:1567796996830658573> Too high! Guess lower.' },
  msgTooLow:  { type: String, default: '<:n_utils:1567796996830658573> Too low! Guess higher.' },
  msgCooldown:{ type: String, default: '<:n_loading:1567796992556666982> Slow down! Try again in {seconds}s.' },
  msgRepeat:  { type: String, default: '<:restrict:1567797003638022166> You just guessed — let someone else try!' },

  // Stats
  totalGames:  { type: Number, default: 0 },
  lastWinnerId:{ type: String, default: null },
  lastWinAt:   { type: Date,   default: null },
}, { timestamps: true });

module.exports = model('guess', guessSchema, 'guessInfo');
