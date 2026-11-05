/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              RANKCORE MODULE MANAGER                        ║
 * ║  Central registry and lifecycle controller.             ║
 * ║  Each "module" is an isolated unit that can be          ║
 * ║  started, stopped, and restarted independently          ║
 * ║  without affecting the bot or other modules.            ║
 * ╚══════════════════════════════════════════════════════════╝
 */

'use strict';

const EventEmitter = require('events');

// ─── Module States ────────────────────────────────────────────────────────────
const STATE = {
  STOPPED:  'stopped',
  STARTING: 'starting',
  RUNNING:  'running',
  STOPPING: 'stopping',
  ERROR:    'error',
  DISABLED: 'disabled',
};

// ─── Module Registry ──────────────────────────────────────────────────────────
class ModuleManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);

    /** @type {Map<string, ModuleEntry>} */
    this._modules = new Map();

    /** @type {Map<string, any[]>} – circular log buffer per module */
    this._logs = new Map();
    this._maxLogs = 200;
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a module definition.
   * @param {object} def
   * @param {string}   def.name          Unique identifier
   * @param {string}   def.label         Human-readable name
   * @param {string}   [def.description] Short description
   * @param {string}   [def.group]       Grouping for the dev panel
   * @param {boolean}  [def.critical]    If true, errors are still isolated
   * @param {Function} def.start         async (client) => cleanup  |  void
   * @param {Function} [def.stop]        async () => void  — called on stop
   */
  register(def) {
    if (this._modules.has(def.name)) {
      throw new Error(`[ModuleManager] Module "${def.name}" is already registered.`);
    }

    /** @type {ModuleEntry} */
    const entry = {
      name:        def.name,
      label:       def.label  || def.name,
      description: def.description || '',
      group:       def.group  || 'Other',
      critical:    def.critical || false,
      state:       STATE.STOPPED,
      startFn:     def.start,
      stopFn:      def.stop || null,
      _cleanup:    null,    // return value from start() if it's a function
      _client:     null,    // stored at start() time so stop/disable can pass it
      error:       null,
      startedAt:   null,
      restartCount: 0,
    };

    this._modules.set(def.name, entry);
    this._logs.set(def.name, []);
    return this;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async start(name, client) {
    const mod = this._get(name);
    if (mod.state === STATE.RUNNING) return;
    if (mod.state === STATE.DISABLED) {
      this._log(name, 'warn', `Module "${name}" is disabled — skipping start.`);
      return;
    }

    // Store the client reference so stop/disable can pass it to stopFn
    if (client) mod._client = client;

    this._setState(mod, STATE.STARTING);
    this._log(name, 'info', `Starting module "${mod.label}"…`);

    try {
      const result = await mod.startFn(client);

      // If start() returns a function, treat it as a cleanup callback
      if (typeof result === 'function') mod._cleanup = result;

      mod.error     = null;
      mod.startedAt = Date.now();
      this._setState(mod, STATE.RUNNING);
      this._log(name, 'info', `Module "${mod.label}" started <a:tickyy:1555544712687915008>`);
    } catch (err) {
      mod.error = err;
      this._setState(mod, STATE.ERROR);
      this._log(name, 'error', `Module "${mod.label}" failed to start: ${err.message}`);
      this.emit('moduleError', { name, error: err });
      // ──> Do NOT rethrow — caller must remain alive
    }
  }

  async stop(name, _client) {
    const mod = this._get(name);
    if (mod.state === STATE.STOPPED || mod.state === STATE.STOPPING) return;

    // Prefer the explicitly-passed client; fall back to the one stored at start time
    const client = _client || mod._client || null;

    this._setState(mod, STATE.STOPPING);
    this._log(name, 'info', `Stopping module "${mod.label}"…`);

    try {
      if (typeof mod._cleanup === 'function') await mod._cleanup();
      if (typeof mod.stopFn  === 'function') await mod.stopFn(client);
    } catch (err) {
      this._log(name, 'warn', `Cleanup error in "${mod.label}": ${err.message}`);
    }

    mod._cleanup  = null;
    mod.startedAt = null;
    this._setState(mod, STATE.STOPPED);
    this._log(name, 'info', `Module "${mod.label}" stopped.`);
  }

  async restart(name, client) {
    const mod = this._get(name);
    this._log(name, 'info', `Restarting module "${mod.label}"…`);
    await this.stop(name, client);
    mod.restartCount++;
    await this.start(name, client);
  }

  async disable(name, _client) {
    const mod = this._get(name);
    if (mod.state === STATE.DISABLED) return;

    // Prefer the explicitly-passed client; fall back to the one stored at start time
    const client = _client || mod._client || null;

    // Stop the module properly first so all listeners/timers are cleaned up
    if (mod.state === STATE.RUNNING || mod.state === STATE.STARTING || mod.state === STATE.ERROR) {
      this._setState(mod, STATE.STOPPING);
      try {
        if (typeof mod._cleanup === 'function') await mod._cleanup();
        if (typeof mod.stopFn  === 'function') await mod.stopFn(client);
      } catch (err) {
        this._log(name, 'warn', `Cleanup error while disabling "${mod.label}": ${err.message}`);
      }
      mod._cleanup  = null;
      mod.startedAt = null;
    }

    mod.state = STATE.DISABLED;
    this._log(name, 'warn', `Module "${mod.label}" disabled.`);
    this.emit('moduleStateChange', { name, state: STATE.DISABLED });
  }

  enable(name) {
    const mod = this._get(name);
    if (mod.state === STATE.DISABLED) {
      mod.state = STATE.STOPPED;
      this._log(name, 'info', `Module "${mod.label}" enabled.`);
      this.emit('moduleStateChange', { name, state: STATE.STOPPED });
    }
  }

  // ── Bulk ops ────────────────────────────────────────────────────────────────

  /**
   * Start all registered modules in registration order.
   * Failures in one module never block the rest.
   */
  async startAll(client) {
    for (const [name] of this._modules) {
      await this.start(name, client);
    }
  }

  async stopAll() {
    for (const [name] of this._modules) {
      await this.stop(name); // client retrieved from mod._client internally
    }
  }

  // ── Introspection ────────────────────────────────────────────────────────────

  getStatus(name) {
    const mod = this._get(name);
    return {
      name:         mod.name,
      label:        mod.label,
      description:  mod.description,
      group:        mod.group,
      state:        mod.state,
      error:        mod.error ? mod.error.message : null,
      startedAt:    mod.startedAt,
      uptime:       mod.startedAt ? Date.now() - mod.startedAt : null,
      restartCount: mod.restartCount,
      critical:     mod.critical,
    };
  }

  getAllStatus() {
    return Array.from(this._modules.keys()).map(n => this.getStatus(n));
  }

  getLogs(name, limit = 50) {
    if (!this._logs.has(name)) return [];
    const buf = this._logs.get(name);
    return buf.slice(-limit);
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  _get(name) {
    const mod = this._modules.get(name);
    if (!mod) throw new Error(`[ModuleManager] Unknown module: "${name}"`);
    return mod;
  }

  _setState(mod, state) {
    mod.state = state;
    this.emit('moduleStateChange', { name: mod.name, state });
  }

  _log(moduleName, level, message) {
    const entry = { ts: Date.now(), level, message };
    const buf   = this._logs.get(moduleName) || [];
    buf.push(entry);
    if (buf.length > this._maxLogs) buf.shift();
    this._logs.set(moduleName, buf);

    const prefix = `[${moduleName.toUpperCase()}]`;
    if (level === 'error') console.error(prefix, message);
    else if (level === 'warn')  console.warn(prefix, message);
    else                        console.log(prefix, message);

    this.emit('moduleLog', { name: moduleName, ...entry });
  }
}

module.exports = { ModuleManager, STATE, instance: new ModuleManager() };