// process.js
'use strict';

module.exports = (client) => {
    const shutdown = async (signal) => {
        console.log(`[PROCESS] ${signal} received, shutting down...`);
        try {
            if (client?.destroy) await client.destroy();
        } catch (err) {
            console.error('[PROCESS] Error during shutdown:', err);
        }
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // NOTE: uncaughtException and unhandledRejection are handled by
    // src/lib/errorHandlers.js which correctly swallows Discord API errors.
    // Registering them here too would cause double-handling and crash on
    // safe errors like 10062 (expired interaction).

    process.on('warning', (warning) => {
        console.warn('[WARNING]', warning.name, warning.message);
    });

    console.log('[PROCESS] Handlers loaded');
};