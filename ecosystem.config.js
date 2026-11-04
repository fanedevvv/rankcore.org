/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║              NOXX — PM2 ECOSYSTEM CONFIG              ║
 * ║                                                       ║
 * ║  Three processes:                                     ║
 * ║    noxx-bot       — Discord bot core                 ║
 * ║    noxx-dashboard — Web dashboard (isolated)         ║
 * ║    noxx-cb        — Custom Branding manager          ║
 * ║                                                       ║
 * ║  All three run on the same server.                    ║
 * ║  Each process is fully isolated — a crash in one    ║
 * ║  NEVER takes down the others.                        ║
 * ╚═══════════════════════════════════════════════════════╝
 *
 * Usage:
 *   pm2 start ecosystem.config.js          # start all three
 *   pm2 start noxx-bot                     # start bot only
 *   pm2 start noxx-dashboard               # start dashboard only
 *   pm2 start noxx-cb                      # start CB manager only
 *   pm2 restart noxx-dashboard             # restart dashboard (bot & CB keep running)
 *   pm2 stop noxx-cb                       # stop all CB bots (bot & dashboard keep running)
 *   pm2 logs noxx-bot                      # bot logs
 *   pm2 logs noxx-dashboard                # dashboard logs
 *   pm2 logs noxx-cb                       # CB manager logs
 *
 * NOTE — autorestart is ON for the bot, but only triggers on exit code 1 (fatal crash).
 *   Rate limits and Discord API errors are handled in-process and never exit.
 *   The gateway watchdog in errorHandlers.js handles "alive but unresponsive" via
 *   reconnect — only calling exit(1) if that fails, which PM2 will then restart.
 *   Clean stops (pm2 stop / SIGTERM) exit with code 0 and are never restarted.
 */

module.exports = {
  apps: [
    // ─── Bot Core ──────────────────────────────────────────────────────────
    {
      name:      'noxx-bot',
      script:    'bot.js',

      // Runtime
      node_args: '--enable-source-maps',
      exec_mode: 'fork',
      instances: 1,

      // ── Restart policy ────────────────────────────────────────────────
      // autorestart is ON, but ONLY for non-zero exits (true crashes).
      //
      // Exit codes:
      //   0  → clean pm2 stop / SIGTERM           → do NOT restart
      //   1  → uncaughtException fatal exit        → restart with back-off
      //
      // Rate limits, Discord API errors, and stale interactions are caught
      // in-process by errorHandlers.js and never reach process.exit().
      // The gateway watchdog handles "alive but unresponsive" by reconnecting
      // the client — only calling exit(1) if the reconnect itself fails.
      autorestart:               true,
      watch:                     false,
      stop_exit_codes:           [0],     // clean stop — never revive
      exp_backoff_restart_delay: 5000,    // 5 s → 10 s → 20 s after crashes
      max_restarts:              10,      // give up after 10 rapid crashes
      kill_timeout:              8000,    // give the bot time to drain its queue
      listen_timeout:            5000,

      // Memory ceiling — the one case where a forced restart is justified.
      // If we genuinely hit 750 MB something is very wrong and a restart
      // is the right call.
      max_memory_restart: '750M',

      // Logs
      error_file:      './logs/bot-error.log',
      out_file:        './logs/bot-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      true,

      // Env
      env: {
        NODE_ENV:       'production',
        // Tell index.js NOT to start the dashboard — it's a separate process
        DASHBOARD_MODE: 'standalone',
        // CB bots are managed by the separate noxx-cb PM2 process.
        // Setting CB_STANDALONE=true makes noxx-bot use the HTTP proxy instead
        // of spawning CB workers in-process — so restarting noxx-bot never
        // touches noxx-cb or any CB workers.
        CB_STANDALONE:  'true',
        // CB_PORT must match what noxx-cb listens on (default 5183).
        CB_PORT:        '5183',
        // CB manager runs on the same server — always loopback.
        CB_HOST:        '127.0.0.1',
        // CB_API_SECRET: set via .env
      },
    },

    // ─── Dashboard (isolated) ───────────────────────────────────────────────
    {
      name:      'noxx-dashboard',
      script: 'src/standalone/dashboard-standalone.js',

      // Runtime
      node_args: '--enable-source-maps',
      exec_mode: 'fork',
      instances: 1,

      // Dashboard is stateless — restarting it is harmless and desirable
      autorestart:              true,
      watch:                    false,
      max_restarts:             15,
      // Exponential back-off so a crash loop doesn't spin endlessly:
      //   attempt 1 → 2 s, attempt 2 → 4 s … capped at 30 s
      exp_backoff_restart_delay: 2000,
      kill_timeout:              5000,
      listen_timeout:            5000,
      max_memory_restart:        '300M',

      // Logs
      error_file:      './logs/dashboard-error.log',
      out_file:        './logs/dashboard-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      true,

      // Env
      env: {
        NODE_ENV:         'production',
        LOG_PROCESS_NAME: 'DASHBOARD',
        // CB manager is on the same server — loopback address
        CB_PORT:          '5183',
        // CB_API_SECRET: set via .env
      },
    },

    // ─── Custom Branding Manager (isolated) ─────────────────────────────────
    {
      name:      'noxx-cb',
      script: 'src/standalone/cb-manager-standalone.js',

      // Runtime
      node_args: '--enable-source-maps',
      exec_mode: 'fork',
      instances: 1,

      // Restart policy — CB worker restarts are handled by the manager itself
      autorestart:              true,
      watch:                    false,
      max_restarts:             10,
      exp_backoff_restart_delay: 5000,
      kill_timeout:              8000,
      listen_timeout:            5000,
      max_memory_restart:        '500M',

      // Logs
      error_file:      './logs/cb-error.log',
      out_file:        './logs/cb-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      true,

      // Env — secret comes from .env
      env: {
        NODE_ENV:         'production',
        LOG_PROCESS_NAME: 'CB-MANAGER',
        // When running standalone, CB_STANDALONE must NOT be set on this process
        // or it would load the HTTP proxy instead of the real manager.
        CB_PORT:          '5183',
      },
    },
  ],
};