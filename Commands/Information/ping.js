// Commands/Utility/ping.js — Standalone slash command

const {
  SlashCommandBuilder,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SeparatorSpacingSize, MessageFlags,
} = require("discord.js");
const https = require("https");

const sep = () => new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

/**
 * HEAD request to Discord's API gateway — no auth, no body.
 * Measures pure TCP+TLS round-trip from VPS → Discord edge.
 */
function pingDiscordAPI() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request(
      { hostname: "discord.com", path: "/api/v10/gateway", method: "HEAD", timeout: 5000 },
      (res) => { res.resume(); res.on("end", () => resolve(Date.now() - start)); }
    );
    req.on("error",   () => resolve(-1));
    req.on("timeout", () => { req.destroy(); resolve(-1); });
    req.end();
  });
}

function latencyIcon(ms) {
  if (ms < 0)   return "❓";
  if (ms < 100) return "<:LEgreen:1567796933307666515>";
  if (ms < 250) return "🟡"; // ← swap for your amber emoji ID
  return "<:LEred:1567796934545121280>";
}

function statusLabel(ms) {
  if (ms < 0)   return "Unknown";
  if (ms < 100) return "Excellent";
  if (ms < 250) return "Good";
  return "High";
}

function accentColor(ms) {
  if (ms < 100) return 0x53ff6c;
  if (ms < 250) return 0xf59e0b;
  return 0xef4444;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's latency"),

  async execute(interaction, client) {
    // ── 1. Placeholder while we measure ────────────────────────────────────
    await interaction.reply({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x5865f2)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## <:ping:1567796998902521920>  Pinging…")
          )
          .addSeparatorComponents(sep())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("-# Measuring latencies, hang tight…")
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    // ── 2. Measure in parallel ──────────────────────────────────────────────
    // a) WebSocket heartbeat — the most reliable "bot ↔ Discord" metric.
    //    discord.js maintains this automatically; no extra request needed.
    const ws = client.ws.ping;

    // b) REST roundtrip — how long editReply takes end-to-end from our VPS.
    const restStart = Date.now();

    // c) API gateway — bare HEAD to /api/v10/gateway, no body.
    const [apiPing] = await Promise.all([
      pingDiscordAPI(),
      // REST is measured around the edit below; this slot is a placeholder
      Promise.resolve(),
    ]);

    const restLatency = Date.now() - restStart;

    // ── 3. Edit with real numbers ───────────────────────────────────────────
    const color = accentColor(ws);

    await interaction.editReply({
      components: [
        new ContainerBuilder()
          .setAccentColor(color)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## <:ping:1567796998902521920>  Pong!")
          )
          .addSeparatorComponents(sep())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**WebSocket (heartbeat)** — \`${ws >= 0 ? ws + "ms" : "N/A"}\`  ${latencyIcon(ws)}\n` +
              `**REST (edit roundtrip)** — \`${restLatency}ms\`  ${latencyIcon(restLatency)}\n` +
              `**API Gateway (HTTP HEAD)** — \`${apiPing >= 0 ? apiPing + "ms" : "failed"}\`  ${latencyIcon(apiPing)}\n` +
              `**Status** — ${latencyIcon(ws)} ${statusLabel(ws)}`
            )
          )
          .addSeparatorComponents(sep())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# Measured at ${new Date().toLocaleTimeString()}`
            )
          ),
      ],
    });
  },
};