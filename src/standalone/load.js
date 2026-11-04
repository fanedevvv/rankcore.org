const { ShardingManager } = require('discord.js');
require('dotenv').config();
const si = require("systeminformation");
const logs = require('../../Utils/logs');

// -------------------------------
// Theme & Separator Configuration
// -------------------------------
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

/**
 * Custom log function for major sections
 */
const logStep = (label, message, color = theme.cyan) => {
    console.log(sep);
    console.log(`${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset} ${color}${theme.bright}[${label}]${theme.reset} ${message}`);
    console.log(sep);
};

/**
 * Log for system details
 */
const logDetail = (type, info) => {
    console.log(`${theme.gray} ├─ [${type}]${theme.reset} ${theme.dim}${info}${theme.reset}`);
};

// -------------------------------
// System Information Logic
// -------------------------------
async function getSystemInfo() {
    logStep('SPECS', 'Fetching Host System Resources...', theme.magenta);
    try {
        const cpuInfo = await si.cpu();
        logDetail('CPU', `${cpuInfo.manufacturer} ${cpuInfo.brand}`);

        const memInfo = await si.memLayout();
        memInfo.forEach((mem, index) => {
            logDetail(`RAM-${index + 1}`, `${mem.manufacturer || "Generic"} ${mem.partNum}`);
        });

        const gpuInfo = await si.graphics();
        gpuInfo.controllers.forEach((gpu, index) => {
            logDetail(`GPU-${index + 1}`, gpu.model);
        });
    } catch (error) {
        console.log(`${theme.red}[ERROR] Specs Fetch Failed: ${error.message}${theme.reset}`);
    }
}

// -------------------------------
// Main Execution Block
// -------------------------------
async function main() {
    await getSystemInfo();

    logStep('SHARDING', 'Initializing Sharding Manager...', theme.blue);

    const manager = new ShardingManager('../../index.js', {
        token: process.env.token,
        totalShards: 1 // Adjust if needed for production
    });

    manager.on('shardCreate', shard => {
        console.log(`${theme.gray} ├─ [SHARD]${theme.reset} ${theme.green}Launched Shard ID:${theme.reset} ${theme.bright}${theme.yellow}${shard.id}${theme.reset}`);
    });

    try {
        await manager.spawn();
        console.log(sep);
        console.log(`${theme.bright}${theme.green}[SUCCESS] Sharding Manager Online.${theme.reset}`);
        console.log(sep);
    } catch (error) {
        console.log(sep);
        console.log(`${theme.red}[CRITICAL] Spawning Failed: ${error}${theme.reset}`);
        console.log(sep);
    }
}

// Execute with error handling
main().catch(error => {
    console.log(`${theme.red}[FATAL] Application crashed during boot: ${error}${theme.reset}`);
    process.exit(1);
});