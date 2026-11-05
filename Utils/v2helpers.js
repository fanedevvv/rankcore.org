/**
 * v2helpers.js — Shared Components V2 builder utilities for RankCore bot
 * Provides consistent styling and reusable builder functions across all slash commands
 */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { parseEmoji } = require('./emojis');
// ─────────────────────── CONSTANTS ────────────────────────────────────────────

const SUPPORT_URL     = "https://discord.gg/wPJ5kSM4Ea";
const INVITE_URL      = (clientId) => `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=303600576574&scope=bot%20applications.commands`;
const VOTE_URL        = "https://top.gg/bot/960624234688811188";

// Default accent colours by type
const ACCENT = {
  default:    0xa78bfa,  // purple
  success:    0x22c55e,  // green
  error:      0xef4444,  // red
  warning:    0xf59e0b,  // amber
  info:       0x3b82f6,  // blue
  moderation: 0xf97316,  // orange
  setup:      0x6366f1,  // indigo
  music:      0x06b6d4,  // cyan
  economy:    0xfbbf24,  // gold
  fun:        0xec4899,  // pink
};

// ─────────────────────── UTILITY HELPERS ──────────────────────────────────────

/**
 * Resolve an accent integer from a hex config string or category name
 */
function resolveAccent(clientConfig, category = "default") {
  if (typeof clientConfig?.embedColor === "string" && clientConfig.embedColor.startsWith("#")) {
    return parseInt(clientConfig.embedColor.slice(1), 16);
  }
  return ACCENT[category] ?? ACCENT.default;
}

/**
 * Standard help row appended to all command responses
 */
function helpRow(clientId, opts = {}) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Support")
      .setStyle(ButtonStyle.Link)
      .setEmoji(parseEmoji("<:n_utils:1555544669545431062>"))
      .setURL(SUPPORT_URL),
  );
  if (opts.invite !== false) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("Invite RankCore")
        .setStyle(ButtonStyle.Link)
        .setEmoji(parseEmoji("<:n_add:1555544335036973106>"))
        .setURL(INVITE_URL(clientId)),
    );
  }
  return row;
}

/**
 * Standard divider separator
 */
function divider(small = false) {
  return new SeparatorBuilder()
    .setSpacing(small ? SeparatorSpacingSize.Small : SeparatorSpacingSize.Large)
    .setDivider(true);
}

// ─────────────────────── RESPONSE BUILDERS ────────────────────────────────────

/**
 * Build a simple success/info response container
 * @param {string} title  - Bold heading line
 * @param {string} body   - Main body text (markdown supported)
 * @param {object} opts   - { accent, clientId, fields: [{name, value}], footer }
 */
function successContainer(title, body, opts = {}) {
  const accent = opts.accent ?? ACCENT.success;
  const container = new ContainerBuilder().setAccentColor(accent);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${title}`)
  );
  container.addSeparatorComponents(divider(true));

  if (body) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(body)
    );
  }

  if (opts.fields?.length) {
    const fieldLines = opts.fields.map(f => `**${f.name}**\n${f.value}`).join("\n\n");
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(fieldLines)
    );
  }

  if (opts.footer) {
    container.addSeparatorComponents(divider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${opts.footer}`)
    );
  }

  if (opts.clientId) {
    container.addSeparatorComponents(divider(true));
    container.addActionRowComponents(helpRow(opts.clientId, opts));
  }

  return container;
}

/**
 * Build an error response container
 */
function errorContainer(title, body, opts = {}) {
  return successContainer(title, body, { accent: ACCENT.error, ...opts });
}

/**
 * Build a config/info panel container (for setup commands)
 * @param {string} title
 * @param {string} statusText  - Status line
 * @param {string} configText  - Config fields in markdown
 * @param {ActionRowBuilder[]} actionRows
 * @param {object} opts
 */
function configContainer(title, statusText, configText, actionRows = [], opts = {}) {
  const accent = opts.accent ?? ACCENT.setup;
  const container = new ContainerBuilder().setAccentColor(accent);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## <:n_utils:1555544669545431062>  ${title}`)
  );
  container.addSeparatorComponents(divider(true));

  if (statusText) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(statusText)
    );
  }

  if (configText) {
    container.addSeparatorComponents(divider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(configText)
    );
  }

  for (const row of actionRows) {
    container.addSeparatorComponents(divider(true));
    container.addActionRowComponents(row);
  }

  if (opts.clientId) {
    container.addSeparatorComponents(divider(true));
    container.addActionRowComponents(helpRow(opts.clientId));
  }

  return container;
}

/**
 * Build a moderation action container (ban, kick, warn, etc.)
 * @param {string} icon       - Emoji icon e.g. "<:ban:1555544356352430202>"
 * @param {string} action     - Action name e.g. "Ban Executed"
 * @param {string} target     - Target display string
 * @param {string} reason     - Reason string
 * @param {object} opts       - extra fields, accent, clientId
 */
function modActionContainer(icon, action, target, reason, opts = {}) {
  const accent = opts.accent ?? ACCENT.moderation;
  const container = new ContainerBuilder().setAccentColor(accent);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${icon}  ${action}`)
  );
  container.addSeparatorComponents(divider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Target** — ${target}\n**Reason** — ${reason}`
    )
  );

  if (opts.extra) {
    container.addSeparatorComponents(divider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(opts.extra)
    );
  }

  if (opts.footer) {
    container.addSeparatorComponents(divider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${opts.footer}`)
    );
  }

  if (opts.clientId) {
    container.addSeparatorComponents(divider(true));
    container.addActionRowComponents(helpRow(opts.clientId, { invite: false }));
  }

  return container;
}

/**
 * Reply helpers — wrap common patterns
 */
const v2Reply = {
  /** Ephemeral error reply */
  async error(interaction, title, body, client) {
    const container = errorContainer(title, body, {
      clientId: client?.user?.id,
      accent: ACCENT.error,
    });
    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },

  /** Ephemeral success reply */
  async success(interaction, title, body, client, opts = {}) {
    const container = successContainer(title, body, {
      clientId: client?.user?.id,
      accent: ACCENT.success,
      ...opts,
    });
    return interaction.reply({
      components: [container],
      flags: (opts.ephemeral ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
    });
  },

  /** Non-ephemeral mod action reply */
  async modAction(interaction, icon, action, target, reason, client, opts = {}) {
    const container = modActionContainer(icon, action, target, reason, {
      clientId: client?.user?.id,
      ...opts,
    });
    return interaction.reply({
      components: [container],
      flags: (opts.ephemeral ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
    });
  },
};

// ─────────────────────── STATUS LINE HELPERS ──────────────────────────────────

function statusLine(enabled, label = "System") {
  if (enabled) {
    return `<:LEgreen:1555544256356159600> **${label}** — \`ENABLED\``;
  }
  return `<:LEred:1555544262123323422> **${label}** — \`DISABLED\``;
}

function configLine(label, value) {
  return `**${label}** — ${value ?? "`Not configured`"}`;
}

// ─────────────────────── EXPORTS ──────────────────────────────────────────────

module.exports = {
  ACCENT,
  SUPPORT_URL,
  INVITE_URL,
  resolveAccent,
  helpRow,
  divider,
  successContainer,
  errorContainer,
  configContainer,
  modActionContainer,
  v2Reply,
  statusLine,
  configLine,
};
