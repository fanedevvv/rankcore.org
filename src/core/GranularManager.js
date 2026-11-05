'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║               RANKCORE GRANULAR MANAGER                        ║
 * ║  Tracks every individual event handler, slash command,     ║
 * ║  prefix command, and system so any one of them can be      ║
 * ║  enabled or disabled at runtime without restarting.        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Three registries:
 *   events   – keyed by "<EventName>:<filePath>"   e.g. "messageCreate:Events/Others/welcome.js"
 *   commands – keyed by command name               e.g. "ban", "kick"
 *   systems  – keyed by filename stem              e.g. "leveling", "antiscam"
 *
 * FIX: State is now persisted to MongoDB (GranularState schema) so it
 * survives deploys that replace the project directory. The local file
 * (src/core/data/granular-state.json) is kept as a fast synchronous
 * fallback for the very first read before MongoDB is connected —
 * changes are always written to both.
 *
 * Startup sequence:
 *   1. Constructor reads the local file synchronously (instant, no I/O wait).
 *   2. Once MongoDB is ready, call granularManager.syncFromDB() — this
 *      overwrites the in-memory state with the authoritative DB copy and
 *      re-writes the local file to match.
 *   3. All subsequent changes are written to both stores immediately.
 */

const EventEmitter = require('events');
const fs   = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'data', 'granular-state.json');

// ── Local file helpers (synchronous, used only at startup) ────────────────────

function ensureDataDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadFileState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        events:   new Set(Array.isArray(raw.events)   ? raw.events   : []),
        commands: new Set(Array.isArray(raw.commands) ? raw.commands : []),
        systems:  new Set(Array.isArray(raw.systems)  ? raw.systems  : []),
      };
    }
  } catch (err) {
    console.error('[GranularManager] Failed to load state file, starting fresh:', err.message);
  }
  return { events: new Set(), commands: new Set(), systems: new Set() };
}

function writeFileState(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      events:   [...state.events],
      commands: [...state.commands],
      systems:  [...state.systems],
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[GranularManager] Failed to write local state file:', err.message);
  }
}

// ── MongoDB helper ────────────────────────────────────────────────────────────

/**
 * Lazily require the schema so GranularManager can be instantiated before
 * Mongoose is connected (the module is a singleton required at process start).
 * The actual DB calls only happen after syncFromDB() / _saveDB() are invoked.
 */
function getSchema() {
  return require('../../Schemas/granularStateSchema');
}

// ── Manager ───────────────────────────────────────────────────────────────────

class GranularManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);

    // Bootstrap from the local file — synchronous, available before DB connect
    const saved = loadFileState();
    this._disabledEvents   = saved.events;
    this._disabledCommands = saved.commands;
    this._disabledSystems  = saved.systems;

    // Metadata registries — populated automatically by the loaders
    /** @type {Map<string, { event: string, file: string, group: string }>} */
    this._eventMeta   = new Map();
    /** @type {Map<string, { name: string, category: string, description: string }>} */
    this._commandMeta = new Map();
    /** @type {Map<string, { file: string, group: string }>} */
    this._systemMeta  = new Map();

    // Debounce timer for DB writes
    this._saveTimer = null;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  /**
   * Call once after MongoDB is connected (e.g. near the end of index.js boot).
   * Loads the authoritative state from the DB and overwrites the in-memory sets
   * and local file.  If no DB document exists yet, seeds one from the current
   * in-memory state (which came from the local file).
   */
  async syncFromDB() {
    try {
      const GranularState = getSchema();
      let doc = await GranularState.findOne({ key: 'global' }).lean();

      if (!doc) {
        // First run after migration — seed from whatever the local file had
        await GranularState.findOneAndUpdate(
          { key: 'global' },
          {
            $setOnInsert: {
              events:   [...this._disabledEvents],
              commands: [...this._disabledCommands],
              systems:  [...this._disabledSystems],
            },
          },
          { upsert: true }
        );
        console.log('[GranularManager] Seeded MongoDB from local file state.');
        return;
      }

      // Overwrite in-memory state with the authoritative DB copy
      this._disabledEvents   = new Set(Array.isArray(doc.events)   ? doc.events   : []);
      this._disabledCommands = new Set(Array.isArray(doc.commands) ? doc.commands : []);
      this._disabledSystems  = new Set(Array.isArray(doc.systems)  ? doc.systems  : []);

      // Keep the local file in sync so the next cold-start fast-path is accurate
      writeFileState({
        events:   this._disabledEvents,
        commands: this._disabledCommands,
        systems:  this._disabledSystems,
      });

      console.log('[GranularManager] Loaded state from MongoDB.');
    } catch (err) {
      console.error('[GranularManager] syncFromDB failed (running from local file):', err.message);
    }
  }

  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveNow(), 500);
  }

  _saveNow() {
    const state = {
      events:   this._disabledEvents,
      commands: this._disabledCommands,
      systems:  this._disabledSystems,
    };

    // 1. Write local file synchronously (instant)
    writeFileState(state);

    // 2. Write to MongoDB asynchronously (fire and forget — errors are logged)
    this._saveDB(state).catch(err =>
      console.error('[GranularManager] DB save failed:', err.message)
    );
  }

  async _saveDB(state) {
    const GranularState = getSchema();
    await GranularState.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          events:   [...state.events],
          commands: [...state.commands],
          systems:  [...state.systems],
        },
      },
      { upsert: true }
    );
  }

  // ── Event registry ───────────────────────────────────────────────────────────

  /** Called by handelEvents.js for every file it loads */
  registerEvent(key, meta) {
    this._eventMeta.set(key, meta);
  }

  isEventEnabled(key) {
    return !this._disabledEvents.has(key);
  }

  disableEvent(key) {
    this._disabledEvents.add(key);
    this._scheduleSave();
    this.emit('change', { type: 'event', key, state: 'disabled' });
  }

  enableEvent(key) {
    this._disabledEvents.delete(key);
    this._scheduleSave();
    this.emit('change', { type: 'event', key, state: 'enabled' });
  }

  // ── Command registry ─────────────────────────────────────────────────────────

  /** Called by modules/index.js slash-commands loader */
  registerCommand(name, meta) {
    this._commandMeta.set(name, meta);
  }

  isCommandEnabled(name) {
    return !this._disabledCommands.has(name);
  }

  disableCommand(name) {
    this._disabledCommands.add(name);
    this._scheduleSave();
    this.emit('change', { type: 'command', key: name, state: 'disabled' });
  }

  enableCommand(name) {
    this._disabledCommands.delete(name);
    this._scheduleSave();
    this.emit('change', { type: 'command', key: name, state: 'enabled' });
  }

  // ── System registry ──────────────────────────────────────────────────────────

  /** Called by modules/index.js systems loader */
  registerSystem(key, meta) {
    this._systemMeta.set(key, meta);
  }

  isSystemEnabled(key) {
    return !this._disabledSystems.has(key);
  }

  disableSystem(key) {
    this._disabledSystems.add(key);
    this._scheduleSave();
    this.emit('change', { type: 'system', key, state: 'disabled' });
  }

  enableSystem(key) {
    this._disabledSystems.delete(key);
    this._scheduleSave();
    this.emit('change', { type: 'system', key, state: 'enabled' });
  }

  // ── Introspection ─────────────────────────────────────────────────────────────

  getAllEvents() {
    return Array.from(this._eventMeta.entries()).map(([key, meta]) => ({
      key,
      ...meta,
      enabled: this.isEventEnabled(key),
    }));
  }

  getAllCommands() {
    return Array.from(this._commandMeta.entries()).map(([name, meta]) => ({
      name,
      ...meta,
      enabled: this.isCommandEnabled(name),
    }));
  }

  getAllSystems() {
    return Array.from(this._systemMeta.entries()).map(([key, meta]) => ({
      key,
      ...meta,
      enabled: this.isSystemEnabled(key),
    }));
  }

  getAll() {
    return {
      events:   this.getAllEvents(),
      commands: this.getAllCommands(),
      systems:  this.getAllSystems(),
    };
  }
}

module.exports = { GranularManager, instance: new GranularManager() };