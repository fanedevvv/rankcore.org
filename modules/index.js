'use strict';

const { GLOBAL_COMMAND_LIMIT, RETIRED_COMMANDS } = require('../Utils/globalCommands');
const path = require('path');
const { instance: manager }   = require('../src/core/moduleManager');
const { instance: granular }  = require('../src/core/GranularManager');
const cbMgr                   = require('../src/core/CustomBrandingManager');

// ════════════════════════════════════════════════════════════════════════════
//  CORE GROUP
// ════════════════════════════════════════════════════════════════════════════

manager.register({
  name:        'events',
  label:       'Event Handlers',
  group:       'Core',
  description: 'Loads all Discord.js event files from /Events',
  critical:    true,
  async start(client) {
    await client.handleEvents(path.join(__dirname, '..', 'Events'));
  },
  async stop(client) {
    if (typeof client.removeAllHandledEvents === 'function') {
      client.removeAllHandledEvents();
    }
  },
});

manager.register({
  name:        'slash-commands',
  label:       'Slash Commands',
  group:       'Core',
  description: 'Loads slash command files from /Commands and registers with Discord',
  critical:    true,
  async start(client) {
    const fs  = require('fs');
    const pth = require('path');
    const { REST, Routes, SlashCommandBuilder, PermissionsBitField, ContextMenuCommandBuilder, ChannelType } = require('discord.js');

    // Command files in Commands/Setups/ use SlashCommandBuilder and PermissionsBitField
    // as bare globals (no require in each file). Inject them so they resolve correctly.
    if (!global.SlashCommandBuilder)        global.SlashCommandBuilder        = SlashCommandBuilder;
    if (!global.PermissionsBitField)        global.PermissionsBitField        = PermissionsBitField;
    if (!global.ContextMenuCommandBuilder)  global.ContextMenuCommandBuilder  = ContextMenuCommandBuilder;
    if (!global.ChannelType)               global.ChannelType               = ChannelType;

    const commandsPath = pth.join(__dirname, '..', 'Commands');
    const commandsFile = pth.join(__dirname, '..', 'src', 'data', 'registeredCommands.json');

    const folders = fs.readdirSync(commandsPath)
      .filter(f => fs.statSync(pth.join(commandsPath, f)).isDirectory());

    let loaded = 0;
    for (const folder of folders) {
      const folderPath = pth.join(commandsPath, folder);
      for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
        try {
          const cmd = require(pth.join(folderPath, file));
          if (cmd?.data && typeof cmd.data.toJSON === 'function' && !RETIRED_COMMANDS.has(cmd.data.name)) {
            cmd.category = folder;
            client.commands.set(cmd.data.name, cmd);

            // Register in granular registry
            granular.registerCommand(cmd.data.name, {
              name:        cmd.data.name,
              category:    folder,
              description: cmd.data.description || '',
            });

            loaded++;
          }
        } catch (e) {
          console.error(`[slash-commands] Failed to load ${file}: ${e.message}`);
        }
      }
    }

    // Every command is registered GLOBALLY (see Utils/globalCommands.js); per-server
    // switches are enforced at runtime by the gate in Events/Client/interaction/slash.js.
    let globalCmds = [...client.commands.values()]
      .filter(c => c?.data && typeof c.data.toJSON === 'function')
      .map(c => c.data.toJSON())
      .sort((a, b) => (a.name === 'help' ? -1 : b.name === 'help' ? 1 : 0));
    if (globalCmds.length > GLOBAL_COMMAND_LIMIT) {
      const dropped = globalCmds.slice(GLOBAL_COMMAND_LIMIT).map(c => '/' + c.name);
      console.error(`[slash-commands] ${globalCmds.length} commands exceed Discord's ${GLOBAL_COMMAND_LIMIT}-command limit — NOT registered: ${dropped.join(', ')}`);
      globalCmds = globalCmds.slice(0, GLOBAL_COMMAND_LIMIT);
    }

    // Write ALL commands to registeredCommands.json (not just /help).
    // The guild command sync endpoint reads this file to find the payload to
    // push to Discord when a guild enables a command from the dashboard.
    const allCmds = [...client.commands.values()]
      .filter(c => c?.data && typeof c.data.toJSON === 'function')
      .map(c => c.data.toJSON());
    fs.writeFileSync(commandsFile, JSON.stringify(allCmds), 'utf-8');

    // Track global-only commands separately to avoid re-registering on every restart
    const globalCacheFile = commandsFile + '.global';
    let lastGlobal = [];
    try { lastGlobal = JSON.parse(fs.readFileSync(globalCacheFile, 'utf-8')); } catch {}

    if (JSON.stringify(globalCmds) !== JSON.stringify(lastGlobal)) {
      const rest = new REST({ version: '10' }).setToken(process.env.token);
      await rest.put(Routes.applicationCommands(client.config.clientId), { body: globalCmds });
      fs.writeFileSync(globalCacheFile, JSON.stringify(globalCmds), 'utf-8');
      console.log(`[slash-commands] Registered ${globalCmds.length} global commands.`);
    } else {
      console.log('[slash-commands] No changes to global commands.');
    }

    console.log(`[slash-commands] Loaded ${loaded} slash commands (${allCmds.length} written to registeredCommands.json).`);
  },
  async stop(client) {
    const count = client.commands.size;
    client.commands.clear();
    console.log(`[slash-commands] Cleared ${count} commands from memory.`);
  },
});

manager.register({
  name:        'functions',
  label:       'Function Handlers',
  group:       'Core',
  description: 'Loads handler files from /Functions',
  critical:    true,
  async start(client) {
    const fs  = require('fs');
    const pth = require('path');

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = pth.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        try {
          const fn = require(full);
          if (typeof fn === 'function') fn(client);
        } catch (e) {
          console.error(`[functions] Failed to load ${entry.name}: ${e.message}`);
        }
      }
    }
    walk(pth.join(__dirname, '..', 'Functions'));
  },
  async stop(client) {
    console.log('[functions] Function handlers stopped (in-memory references retained until restart).');
  },
});

manager.register({
  name:        'triggers',
  label:       'Trigger Handlers',
  group:       'Core',
  description: 'Loads trigger files from /Triggers',
  async start(client) {
    const fs  = require('fs');
    const pth = require('path');
    const dir = pth.join(__dirname, '..', 'Triggers');
    if (!fs.existsSync(dir)) return;

    function walk(d) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = pth.join(d, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        try {
          const t = require(full);
          if (typeof t === 'function') t(client);
          else if (typeof t?.execute === 'function') t.execute(client);
        } catch (e) {
          console.error(`[triggers] Failed to load ${entry.name}: ${e.message}`);
        }
      }
    }
    walk(dir);
  },
  async stop(client) {
    console.log('[triggers] Trigger handlers stopped (restart to fully reload).');
  },
});

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEMS GROUP
// ════════════════════════════════════════════════════════════════════════════

manager.register({
  name:        'systems',
  label:       'Bot Systems',
  group:       'Systems',
  description: 'Loads all feature systems from /Systems (leveling, automod, etc.)',
  async start(client) {
    const fs  = require('fs');
    const pth = require('path');
    const dir = pth.join(__dirname, '..', 'Systems');
    if (!fs.existsSync(dir)) return;

    // Per-system listener registry so stop() can surgically remove them
    if (!client._systemListeners) client._systemListeners = new Map();

    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const key      = path.basename(file, '.js');   // e.g. "leveling"
      const fullPath = pth.join(dir, file);

      // Register in granular registry (safe to call multiple times)
      granular.registerSystem(key, {
        file:  `Systems/${file}`,
        group: 'Systems',
        label: key,
      });

      // Remove any listeners left over from a previous start() of this system
      const oldListeners = client._systemListeners.get(key) || [];
      for (const { event, fn } of oldListeners) {
        client.removeListener(event, fn);
      }

      // Bust require cache so a restart picks up fresh code
      delete require.cache[require.resolve(fullPath)];

      // Track every new listener this system registers
      const listeners   = [];
      const _origOn     = client.on.bind(client);
      const _origOnce   = client.once.bind(client);

      // Systems that must run even in Custom Branding guilds (security-critical)
      const CB_EXEMPT_SYSTEMS = ['verification', 'antiNuke-system', 'antiraid-system'];

      client.on = (event, handler) => {
        const wrapped = async (...args) => {
          if (!granular.isSystemEnabled(key)) return;
          const guildId = args[0]?.guild?.id;
          if (guildId && !CB_EXEMPT_SYSTEMS.includes(key)) {
            if (cbMgr._ready && !cbMgr._pollSucceeded) {
              await Promise.race([
                cbMgr._ready,
                new Promise(resolve => setTimeout(resolve, 2000))
              ]);
            }
            const active = cbMgr.isActive(guildId);
            if (active) return;
          }
          return handler(...args);
        };
        listeners.push({ event, fn: wrapped });
        return _origOn(event, wrapped);
      };
      client.once = (event, handler) => {
        const wrapped = async (...args) => {
          if (!granular.isSystemEnabled(key)) return;
          const guildId = args[0]?.guild?.id;
          if (guildId && !CB_EXEMPT_SYSTEMS.includes(key)) {
            if (cbMgr._ready && !cbMgr._pollSucceeded) {
              await Promise.race([
                cbMgr._ready,
                new Promise(resolve => setTimeout(resolve, 2000))
              ]);
            }
            const active = cbMgr.isActive(guildId);
            if (active) return;
          }
          return handler(...args);
        };
        listeners.push({ event, fn: wrapped });
        return _origOnce(event, wrapped);
      };

      try {
        require(fullPath)(client);
        client._systemListeners.set(key, listeners);
      } catch (e) {
        console.error(`[systems] Failed to load ${file}: ${e.message}`);
      } finally {
        client.on   = _origOn;
        client.once = _origOnce;
      }
    }
  },
  async stop(client) {
    if (client._systemListeners) {
      for (const [key, listeners] of client._systemListeners) {
        for (const { event, fn } of listeners) {
          client.removeListener(event, fn);
        }
      }
      client._systemListeners.clear();
    }
    console.log('[systems] Bot systems stopped — all listeners removed.');
  },
});

manager.register({
  name:        'music',
  label:       'Music / Lavalink',
  group:       'Systems',
  description: 'Kazagumo music manager and Lavalink event bridge',
  async start(client) {
    const { Kazagumo, Plugins } = require('kazagumo');
    const { Connectors }        = require('shoukaku');
    const Spotify               = require('kazagumo-spotify');
    const KazagumoFilter        = require('kazagumo-filter');

    const cfg   = client.config;
    const hasSpotify = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
    const Nodes = [{
      name:   cfg.lavalink.name,
      url:    cfg.lavalink.url,
      auth:   cfg.lavalink.auth,
      secure: cfg.lavalink.secure,
    }];

    client.manager = new Kazagumo(
      {
        // Spotify search needs API credentials — fall back to YouTube without them
        defaultSearchEngine: hasSpotify ? 'spotify' : 'youtube',
        plugins: [
          new Plugins.PlayerMoved(client),
          new KazagumoFilter(),
          ...(hasSpotify ? [new Spotify({
            clientId:          process.env.SPOTIFY_CLIENT_ID,
            clientSecret:      process.env.SPOTIFY_CLIENT_SECRET,
            playlistPageLimit: 1,
            albumPageLimit:    1,
            searchLimit:       10,
            searchMarket:      'IN',
          })] : []),
        ],
        send: (guildId, payload) => {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return;
          guild.shard.send(payload);
        },
      },
      new Connectors.DiscordJS(client),
      Nodes,
      {
        userAgent:        'RocoBot/1.0',
        resume:           false,
        moveOnDisconnect: false,
        dave:             true,
      }
    );

    client.music = client.manager;
    require(path.join(__dirname, '..', 'src', 'lib', 'musicEvents.js'))(client);
    console.log(`[music] Lavalink manager initialized on node: ${Nodes[0].name}`);
  },
  async stop(client) {
    try {
      if (client.manager) {
        for (const [, player] of client.manager.players) {
          await player.destroy().catch(() => {});
        }
        client.manager = null;
        client.music   = null;
        console.log('[music] Lavalink manager destroyed.');
      }
    } catch (err) {
      console.warn('[music] Error during stop:', err.message);
    }
  },
});

manager.register({
  name:        'cron',
  label:       'Cron / Scheduled Tasks',
  group:       'Systems',
  description: 'Runs periodic background jobs (reminders, giveaway checks, etc.)',
  async start(client) {
    const cronJobs = require(path.join(__dirname, '..', 'src', 'lib', 'cronJobs.js'));
    const jobs = cronJobs(client);
    client._cronJobs = Array.isArray(jobs) ? jobs : [];
  },
  async stop(client) {
    if (Array.isArray(client._cronJobs)) {
      for (const job of client._cronJobs) {
        if (typeof job?.stop === 'function') job.stop();
      }
      client._cronJobs = [];
      console.log('[cron] All scheduled jobs stopped.');
    }
  },
});

manager.register({
  name:        'error-handlers',
  label:       'Process Error Handlers',
  group:       'Systems',
  description: 'Catches unhandled promise rejections and uncaught exceptions',
  critical:    true,
  async start(client) {
    require(path.join(__dirname, '..', 'src', 'lib', 'errorHandlers.js'))(client);
  },
  async stop(client) {
    console.log('[error-handlers] Error handlers stopped.');
  },
});

// ════════════════════════════════════════════════════════════════════════════
//  API GROUP
// ════════════════════════════════════════════════════════════════════════════

manager.register({
  name:        'internal-api',
  label:       'Internal Bot Proxy API',
  group:       'API',
  description: 'Localhost-only REST proxy on port 5182 — used by standalone dashboard',
  async start(client) {
    const modulePath = path.join(__dirname, '..', 'src', 'api', 'internal.js');
    delete require.cache[require.resolve(modulePath)];
    const server = require(modulePath)(client);
    client._internalApiServer = server;
    return async () => {
      await new Promise(r => server.close(r)).catch(() => {});
      client._internalApiServer = null;
    };
  },
  async stop(client) {
    if (client._internalApiServer) {
      await new Promise(r => client._internalApiServer.close(r)).catch(() => {});
      client._internalApiServer = null;
      delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'api', 'internal.js'))];
      console.log('[internal-api] Server closed.');
    }
  },
});

manager.register({
  name:        'api-server',
  label:       'Public API Server',
  group:       'API',
  description: 'Express API on port 5181 — bot stats, cluster info, etc.',
  async start(client) {
    const modulePath = path.join(__dirname, '..', 'src', 'api', 'server.js');
    delete require.cache[require.resolve(modulePath)];
    const mod = require(modulePath);
    const app = mod(client);
    client._apiServer = app;
    return async () => {
      if (client._apiServer?._server) {
        await new Promise(r => client._apiServer._server.close(r)).catch(() => {});
        client._apiServer = null;
      }
    };
  },
  async stop(client) {
    if (client._apiServer?._server) {
      await new Promise(r => client._apiServer._server.close(r)).catch(() => {});
      client._apiServer = null;
      delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'api', 'server.js'))];
      console.log('[api-server] Server closed.');
    }
  },
});

// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD GROUP
//
//  NOTE: The Web Dashboard is intentionally NOT registered in ModuleManager.
//  It runs as a completely separate PM2 process (pm2 start dashboard/server.js)
//  and has its own lifecycle independent of the bot. Registering it here caused
//  it to appear permanently "stopped" in the bot's module registry (because the
//  bot never calls start() on it), which in turn triggered false degraded-state
//  incidents on the status page.
//
//  To manage the dashboard use PM2 directly:
//    pm2 start / stop / restart / logs dashboard
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES GROUP
// ════════════════════════════════════════════════════════════════════════════

manager.register({
  name:        'log-handlers',
  label:       'Log Handlers',
  group:       'Utilities',
  description: 'Starts handleLogs (webhook/Discord logging) and uptimePinger',
  async start(client) {
    // Remove any listeners left over from a previous start
    if (client._logHandlerListeners) {
      for (const { event, fn } of client._logHandlerListeners) {
        client.removeListener(event, fn);
      }
    }
    client._logHandlerListeners = [];

    const logsMainPath = path.join(__dirname, '..', 'Events', 'Others', 'logsmain.js');
    const uptimePath   = path.join(__dirname, '..', 'Events', 'Others', 'uptimePinger.js');

    const { handleLogs } = require(logsMainPath);
    const uptimePinger   = require(uptimePath);
    const mgr = client.moduleManager;

    // Intercept client.on/once to track every listener handleLogs registers
    // AND gate each one on the module being in 'running' state.
    const listeners   = client._logHandlerListeners;
    const _origOn     = client.on.bind(client);
    const _origOnce   = client.once.bind(client);

    client.on = (event, handler) => {
      const wrapped = async (...args) => {
        if (mgr?._modules.get('log-handlers')?.state !== 'running') return;
        // CB gate: if a CB bot is actively running for this guild, let it
        // handle logging — skip all processing here, not just delivery.
        try {
          const cbMgr = require('../src/core/CustomBrandingManager');
          const guildId = args[0]?.guild?.id ?? args[0]?.guildId ?? args[0]?.id;
          if (guildId) {
            if (cbMgr._ready && !cbMgr._pollSucceeded) {
              await Promise.race([
                cbMgr._ready,
                new Promise(resolve => setTimeout(resolve, 2000))
              ]);
            }
            if (cbMgr.isActive(guildId)) return;
          }
        } catch { /* non-critical */ }
        return handler(...args);
      };
      listeners.push({ event, fn: wrapped });
      return _origOn(event, wrapped);
    };
    client.once = (event, handler) => {
      const wrapped = async (...args) => {
        if (mgr?._modules.get('log-handlers')?.state !== 'running') return;
        // CB gate: same as above for once-listeners
        try {
          const cbMgr = require('../src/core/CustomBrandingManager');
          const guildId = args[0]?.guild?.id ?? args[0]?.guildId ?? args[0]?.id;
          if (guildId) {
            if (cbMgr._ready && !cbMgr._pollSucceeded) {
              await Promise.race([
                cbMgr._ready,
                new Promise(resolve => setTimeout(resolve, 2000))
              ]);
            }
            if (cbMgr.isActive(guildId)) return;
          }
        } catch { /* non-critical */ }
        return handler(...args);
      };
      listeners.push({ event, fn: wrapped });
      return _origOnce(event, wrapped);
    };

    handleLogs(client);

    // Restore before uptimePinger (uses setInterval, not client.on)
    client.on   = _origOn;
    client.once = _origOnce;

    await uptimePinger(client);
  },
  async stop(client) {
    // Remove every listener handleLogs registered
    if (client._logHandlerListeners) {
      for (const { event, fn } of client._logHandlerListeners) {
        client.removeListener(event, fn);
      }
      client._logHandlerListeners = [];
    }
    if (client._uptimePingerInterval) {
      clearInterval(client._uptimePingerInterval);
      client._uptimePingerInterval = null;
    }
    if (client._uptimePingerTimeout) {
      clearTimeout(client._uptimePingerTimeout);
      client._uptimePingerTimeout = null;
    }
    console.log('[log-handlers] Log handlers stopped — all listeners removed.');
  },
});

module.exports = manager;