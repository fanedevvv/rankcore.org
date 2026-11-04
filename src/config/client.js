"use strict";

/**
 * client.js — Roco shared config export
 *
 * This file is required by cb-worker.js (and potentially other modules) to
 * access Roco's runtime config in child/worker processes that do not share
 * the parent's in-memory Discord.js Client instance.
 *
 * NOTE: cb-worker.js now loads config.js directly (the correct fix), but
 * this file is kept populated as a safe fallback for any other module that
 * does require('./client').config.
 */

let _config = null;

try {
  const cfg = require("./bot");
  _config = (cfg && typeof cfg === "object") ? cfg : {};
} catch (e) {
  console.error("[client.js] Failed to load config.js:", e.message);
  _config = {};
}

module.exports = {
  config: _config,
};