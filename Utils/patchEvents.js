module.exports = (client) => {
    // Bridge deprecated → new event names
    const EVENT_ALIASES = {
        webhookUpdate: 'webhooksUpdate',
    };

    const originalOn = client.on.bind(client);
    const originalOnce = client.once.bind(client);

    client.on = (event, listener) => {
        const mapped = EVENT_ALIASES[event] ?? event;
        return originalOn(mapped, listener);
    };

    client.once = (event, listener) => {
        const mapped = EVENT_ALIASES[event] ?? event;
        return originalOnce(mapped, listener);
    };
};
