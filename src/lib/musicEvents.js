/*
██████╗  █████╗ ███████╗ ██████╗ ██████╗ 
██╔══██╗██╔══██╗╚══███╔╝██╔═██╗██╔══██╗
██████╔╝███████║  ███╔╝ ██║   ██║██████╔╝
██╔══██╗██╔══██║ ███╔╝  ██║   ██║██╔══██╗
██║  ██║██║  ██║███████╗╚██████╔╝██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝

Developed by: @arpandevv. All rights reserved. (2025)
MIT License
*/

module.exports = (client) => {

    const theme = {
        reset: "\x1b[0m",
        bright: "\x1b[1m",
        dim: "\x1b[2m",
        cyan: "\x1b[36m",
        yellow: "\x1b[33m",
        green: "\x1b[32m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        red: "\x1b[31m",
        gray: "\x1b[90m"
    };

    const sep = theme.gray + '-------------------------------------------' + theme.reset;

    const logStep = (label, message, color = theme.cyan) => {
        console.log(sep);
        console.log(`${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset} ${color}${theme.bright}[${label}]${theme.reset} ${message}`);
        console.log(sep);
    };

    // -------------------------------
    // Lavalink Event Handlers
    // -------------------------------
    client.manager.shoukaku.on('ready', (name) => {
        logStep('LAVALINK', `Node ${name}: Ready!`, theme.green);
    });

    client.manager.shoukaku.on('error', (name, error) => {
        logStep('LAVALINK', `Node ${name}: Error Caught, ${error}`, theme.red);
    });

    client.manager.shoukaku.on('close', (name, code, reason) => {
        logStep('LAVALINK', `Node ${name}: Closed | Code: ${code} | Reason: ${reason || 'No reason'}`, theme.yellow);
    });

    // -------------------------------
    // Player Event Handlers
    // -------------------------------
    const handlePlayerEvent = async (eventFile, ...args) => {
        try {
            const event = require(`../../Events/Lavalink/${eventFile}`);
            await event.execute(client, ...args);
            logStep('PLAYER', `${eventFile} executed successfully.`, theme.green);
        } catch (error) {
            logStep('PLAYER', `Error executing ${eventFile}: ${error}`, theme.red);
        }
    };

    client.manager.on('playerStart', (player, track) => handlePlayerEvent('playerStart.js', player, track));
    client.manager.on('playerEmpty', (player) => handlePlayerEvent('playerEmpty.js', player));
    client.manager.on('playerEnd', (player) => handlePlayerEvent('playerEnd.js', player));

    logStep('MUSIC', 'All music event listeners loaded.', theme.cyan);
};
