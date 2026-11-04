'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { collectStatus, lookupGuild, collectShardStatus, collectModuleUpdate } = require('./statusCollector');
const cache = require('../lib/cache');

const WSS_PORT = 5185;
const BROADCAST_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;
const AUTH_TIMEOUT_MS = 10000;

class StatusWebSocketServer {
  constructor(client, opts = {}) {
    this.client     = client;
    this.port       = opts.port || WSS_PORT;
    this.host       = opts.host || '127.0.0.1';
    this.secret     = opts.secret || process.env.WSS_STATUS_SECRET || null;
    this.clients    = new Map();
    this._server    = null;
    this._wss       = null;
    this._broadcast = null;
    this._heartbeat = null;
    this._counter   = 0;
  }

  async start() {
    const httpServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Roco WSS Status');
    });

    this._wss = new WebSocketServer({ server: httpServer, path: '/status' });

    this._wss.on('connection', (ws, req) => {
      const id = ++this._counter;
      const ip = req.socket?.remoteAddress || 'unknown';

      let authed = false;
      let subs   = new Set(['status_update', 'shard_update', 'module_update']);

      const entry = { ws, id, ip, authed: false, subs, connectedAt: Date.now() };
      this.clients.set(id, entry);

      const authTimer = setTimeout(() => {
        if (!entry.authed) {
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout' }));
          ws.close(4001, 'Auth timeout');
          this.clients.delete(id);
        }
      }, AUTH_TIMEOUT_MS);

      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); }
        catch { ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' })); return; }

        switch (msg.type) {
          case 'auth': {
            if (this.secret && msg.token !== this.secret) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid auth token' }));
              ws.close(4003, 'Unauthorized');
              this.clients.delete(id);
              return;
            }
            entry.authed = true;
            clearTimeout(authTimer);
            ws.send(JSON.stringify({ type: 'auth_ok', clientId: id }));
            const status = collectStatus(this.client);
            status.type = 'status_update';
            ws.send(JSON.stringify(status));
            console.log(`[WSS] Client #${id} (${ip}) authenticated`);
            break;
          }

          case 'subscribe': {
            if (!entry.authed) return;
            const types = msg.types || [];
            entry.subs = new Set(types.length ? types : ['status_update']);
            ws.send(JSON.stringify({ type: 'subscribed', types: [...entry.subs] }));
            break;
          }

          case 'unsubscribe': {
            if (!entry.authed) return;
            const types = msg.types || [];
            for (const t of types) entry.subs.delete(t);
            ws.send(JSON.stringify({ type: 'unsubscribed', types: [...entry.subs] }));
            break;
          }

          case 'lookup_guild': {
            if (!entry.authed) return;
            const { guildId } = msg;
            if (!guildId || !/^\d{17,20}$/.test(guildId)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid guild ID', reqId: msg.reqId }));
              return;
            }
            const result = lookupGuild(this.client, guildId);
            if (msg.reqId) result.reqId = msg.reqId;
            ws.send(JSON.stringify(result));
            break;
          }

          case 'get_status': {
            if (!entry.authed) return;
            const status = collectStatus(this.client);
            status.type = 'status_update';
            ws.send(JSON.stringify(status));
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', ts: Date.now(), reqId: msg.reqId }));
            break;
          }

          default: {
            ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
            break;
          }
        }
      });

      ws.on('close', (code, reason) => {
        clearTimeout(authTimer);
        this.clients.delete(id);
        console.log(`[WSS] Client #${id} disconnected (${code}: ${reason || 'no reason'})`);
      });

      ws.on('error', (err) => {
        console.error(`[WSS] Client #${id} error:`, err.message);
        clearTimeout(authTimer);
        this.clients.delete(id);
      });
    });

    this._wss.on('error', (err) => {
      console.error('[WSS] Server error:', err.message);
    });

    this._broadcast = setInterval(() => {
      this._broadcastStatus();
    }, BROADCAST_INTERVAL_MS);

    this._heartbeat = setInterval(() => {
      const ts = Date.now();
      for (const [id, entry] of this.clients) {
        if (!entry.authed) continue;
        try {
          if (entry.ws.readyState === 1) {
            entry.ws.send(JSON.stringify({ type: 'heartbeat', ts }));
          }
        } catch {
          this.clients.delete(id);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);

    await new Promise((resolve, reject) => {
      const onErr = (err) => { this._server?.off('listening', onListen); reject(err); };
      const onListen = () => { this._server?.off('error', onErr); resolve(); };
      this._server = httpServer.listen(this.port, this.host, onListen);
      this._server.once('error', onErr);
    });

    console.log(`[WSS] Status WebSocket server listening on ws://${this.host}:${this.port}/status`);
  }

  async stop() {
    if (this._broadcast) { clearInterval(this._broadcast); this._broadcast = null; }
    if (this._heartbeat) { clearInterval(this._heartbeat); this._heartbeat = null; }

    for (const [id, entry] of this.clients) {
      try {
        entry.ws.send(JSON.stringify({ type: 'server_shutdown' }));
        entry.ws.close(1001, 'Server shutdown');
      } catch {}
    }
    this.clients.clear();

    if (this._wss) {
      this._wss.close();
      this._wss = null;
    }

    if (this._server) {
      await new Promise(r => this._server.close(r)).catch(() => {});
      this._server = null;
    }
  }

  _broadcastStatus() {
    if (this.clients.size === 0) return;

    const message = collectStatus(this.client);

    for (const [id, entry] of this.clients) {
      if (!entry.authed) continue;
      try {
        if (entry.ws.readyState === 1) {
          const data = { ...message };
          for (const key of Object.keys(data)) {
            if (key !== 'type' && !entry.subs.has(key)) {
              delete data[key];
            }
          }
          data.type = 'status_update';
          entry.ws.send(JSON.stringify(data));
        }
      } catch {
        this.clients.delete(id);
      }
    }
  }

  broadcastShardUpdate() {
    const message = collectShardStatus(this.client);
    for (const [, entry] of this.clients) {
      if (!entry.authed) continue;
      try {
        if (entry.ws.readyState === 1 && entry.subs.has('shard_update')) {
          entry.ws.send(JSON.stringify(message));
        }
      } catch {}
    }
  }

  broadcastModuleUpdate(name, state, extra) {
    const message = collectModuleUpdate(name, state, extra);
    for (const [, entry] of this.clients) {
      if (!entry.authed) continue;
      try {
        if (entry.ws.readyState === 1 && entry.subs.has('module_update')) {
          entry.ws.send(JSON.stringify(message));
        }
      } catch {}
    }
  }

  get connectedCount() {
    let count = 0;
    for (const [, e] of this.clients) if (e.authed) count++;
    return count;
  }
}

module.exports = StatusWebSocketServer;
