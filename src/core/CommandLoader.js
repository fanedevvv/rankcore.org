/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║          UNIVERSAL COMMAND LOADER — Auto-Inject Discord.js Exports        ║
 * ║                                                                            ║
 * ║  Loads command files WITHOUT requiring edits to individual command files.  ║
 * ║  Automatically injects discord.js exports into the command module scope.   ║
 * ║                                                                            ║
 * ║  Usage:                                                                    ║
 * ║    const loader = new CommandLoader(discordClient);                       ║
 * ║    const command = loader.loadCommand('/path/to/command.js');             ║
 * ║                                                                            ║
 * ║  All commands now have access to SlashCommandBuilder, Client, etc.        ║
 * ║  without any imports or requires in their code.                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const Module = require('module');

class CommandLoader {
  constructor(discordClient) {
    this.client = discordClient;
    this.cache = new Map();
    
    // Pre-load all discord.js exports that commands might need
    try {
      const discordjs = require('discord.js');
      this.discordExports = {
        SlashCommandBuilder: discordjs.SlashCommandBuilder,
        ContextMenuCommandBuilder: discordjs.ContextMenuCommandBuilder,
        Client: discordjs.Client,
        Intents: discordjs.Intents,
        GatewayIntentBits: discordjs.GatewayIntentBits,
        ChannelType: discordjs.ChannelType,
        PermissionFlagsBits: discordjs.PermissionFlagsBits,
        EmbedBuilder: discordjs.EmbedBuilder,
        ButtonBuilder: discordjs.ButtonBuilder,
        SelectMenuBuilder: discordjs.SelectMenuBuilder,
        ActionRowBuilder: discordjs.ActionRowBuilder,
        ButtonStyle: discordjs.ButtonStyle,
        ComponentType: discordjs.ComponentType,
        InteractionType: discordjs.InteractionType,
        Collection: discordjs.Collection,
        REST: discordjs.REST,
        Routes: discordjs.Routes,
      };
    } catch (e) {
      throw new Error(`Failed to load discord.js: ${e.message}`);
    }
  }

  /**
   * Load a command file and inject discord.js exports into its scope
   * @param {string} filePath - Absolute path to the command file
   * @returns {object} The exported command module
   */
  loadCommand(filePath) {
    // Return cached version if already loaded
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }

    try {
      // Read the command file as text
      const code = fs.readFileSync(filePath, 'utf8');

      // Create a module-like object to hold exports
      const moduleObj = { exports: {} };

      // Create an injected require function
      const injectedRequire = this._createRequireFunction(filePath);

      // Create the sandbox with all necessary globals
      const sandbox = {
        // Node.js globals
        require: injectedRequire,
        module: moduleObj,
        exports: moduleObj.exports,
        __filename: filePath,
        __dirname: path.dirname(filePath),
        process,
        console,
        Buffer,
        setImmediate,
        setInterval,
        setTimeout,
        clearImmediate,
        clearInterval,
        clearTimeout,
        global,

        // Discord.js exports (auto-injected)
        ...this.discordExports,
      };

      // Wrap the code in a function scope to preserve 'this' and module behavior
      const wrappedCode = `(function(module, exports, require, __filename, __dirname) {
${code}
})`;

      // Execute the code in the sandbox context
      const script = new vm.Script(wrappedCode, { filename: filePath });
      const contextifiedSandbox = vm.createContext(sandbox);
      const fn = script.runInContext(contextifiedSandbox);

      // Call the wrapped function with module context
      fn(moduleObj, moduleObj.exports, injectedRequire, filePath, path.dirname(filePath));

      // Cache and return
      this.cache.set(filePath, moduleObj.exports);
      return moduleObj.exports;
    } catch (e) {
      throw new Error(`Failed to load command ${path.basename(filePath)}: ${e.message}`);
    }
  }

  /**
   * Create a require function that prioritizes discord.js exports
   * @private
   */
  _createRequireFunction(filePath) {
    const self = this;
    const originalRequire = Module.createRequire(filePath);

    return function(id) {
      // If they require 'discord.js', return our pre-loaded exports
      if (id === 'discord.js') {
        return self.discordExports;
      }

      // For relative paths, resolve relative to the command file directory
      if (id.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filePath), id);
        return originalRequire(resolvedPath);
      }

      // For node_modules, use the normal require
      return originalRequire(id);
    };
  }

  /**
   * Load multiple command files from a directory
   * @param {string} dirPath - Absolute path to commands directory
   * @param {object} options - { recursive: true/false, pattern: glob pattern }
   * @returns {Map} Map of command name -> command module
   */
  loadDirectory(dirPath, options = {}) {
    const { recursive = true } = options;
    const commands = new Map();

    const loadDir = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (recursive) loadDir(fullPath);
        } else if (file.endsWith('.js')) {
          try {
            const cmd = this.loadCommand(fullPath);
            const cmdName = cmd.data?.name || path.basename(file, '.js');
            commands.set(cmdName, cmd);
          } catch (e) {
            // Log but continue loading other commands
            console.error(`[CommandLoader] Failed to load ${file}:`, e.message);
          }
        }
      }
    };

    loadDir(dirPath);
    return commands;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get list of loaded command names
   */
  getCached() {
    return Array.from(this.cache.keys());
  }
}

module.exports = CommandLoader;