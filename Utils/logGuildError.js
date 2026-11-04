'use strict';

// logGuildError(guildId, source, err, context?)
// Saves an error to the GuildError collection so it shows up in the
// guild's dashboard Error Log tab.
// Call this wherever you catch errors that are guild-specific.

let GuildError;
function getModel() {
  if (!GuildError) GuildError = require('../Schemas/guilderrors');
  return GuildError;
}

async function logGuildError(guildId, source, err, context = null) {
  if (!guildId) return;
  try {
    const Model = getModel();
    await Model.create({
      guildId,
      level:   'error',
      source:  String(source || 'unknown').slice(0, 64),
      message: String(err?.message || err || 'Unknown error').slice(0, 1000),
      stack:   err?.stack ? String(err.stack).slice(0, 3000) : null,
      context: context ? JSON.parse(JSON.stringify(context)) : null,
    });
  } catch {
    // never throw from error logger
  }
}

async function logGuildWarn(guildId, source, message, context = null) {
  if (!guildId) return;
  try {
    const Model = getModel();
    await Model.create({
      guildId,
      level:   'warn',
      source:  String(source || 'unknown').slice(0, 64),
      message: String(message || 'Unknown warning').slice(0, 1000),
      stack:   null,
      context: context ? JSON.parse(JSON.stringify(context)) : null,
    });
  } catch {}
}

module.exports = { logGuildError, logGuildWarn };