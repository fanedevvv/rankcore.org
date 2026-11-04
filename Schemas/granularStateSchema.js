'use strict';

/**
 * Stores the bot-wide granular disabled sets in MongoDB so the state
 * survives deploys and process restarts without relying on a local file
 * that gets wiped whenever the project directory is replaced.
 *
 * There is exactly ONE document in this collection (singleton pattern).
 * The singleton is keyed by { key: 'global' }.
 */

const { Schema, model } = require('mongoose');

const granularStateSchema = new Schema({
  key:      { type: String, default: 'global', unique: true },
  events:   { type: [String], default: [] },   // disabled event keys
  commands: { type: [String], default: [] },   // disabled command names
  systems:  { type: [String], default: [] },   // disabled system keys
}, { timestamps: true });

module.exports = model('GranularState', granularStateSchema);