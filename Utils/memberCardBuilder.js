"use strict";

/**
 * memberCardBuilder.js
 *
 * Self-contained welcome / goodbye card generator using @napi-rs/canvas.
 * Zero third-party card libraries — no welcomify, no canvacord.
 * Avatar fetching is handled via canvasUtils.loadAvatar() which:
 *   • Fetches via Node's native https (no external lib HTTP calls)
 *   • Has timeout + retry + Discord default-avatar fallback
 *   • Never throws — returns null if all attempts fail
 *
 * Exports:
 *   buildMemberCard(options) → Promise<Buffer>  (PNG)
 *
 * Options:
 *   type        "welcome" | "goodbye"
 *   username    string     — display name (will be clamped to fit)
 *   avatarUrl   string     — Discord CDN URL
 *   memberCount number     — guild member count
 *   background  string?    — custom background image URL (optional)
 *   accentColor string?    — hex without #, e.g. "53FF6C" (optional)
 */

const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { loadAvatar, drawBackground } = require("./canvasUtils");

const W = 800;
const H = 280;

const THEMES = {
  welcome: {
    accent:    "#53FF6C",
    accentRgb: "83,255,108",
    label:     "WELCOME",
    sub:       (count) => `You are member #${count.toLocaleString()}`,
    bgTheme:   "dark",
  },
  goodbye: {
    accent:    "#F87171",
    accentRgb: "248,113,113",
    label:     "GOODBYE",
    sub:       () => "They will be missed",
    bgTheme:   "dark",
  },
};

/**
 * Clip path helper — draws a circle clip on ctx centred at (cx, cy) with radius r.
 */
function circleClip(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

/**
 * Measure and clamp text to maxWidth, reducing font size if needed.
 */
function fitText(ctx, text, maxWidth, startSize, minSize = 18, weight = "700") {
  let size = startSize;
  ctx.font = `${weight} ${size}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${weight} ${size}px sans-serif`;
  }
  return size;
}

/**
 * Build the member card as a PNG Buffer.
 * @param {{
 *   type: "welcome"|"goodbye",
 *   username: string,
 *   avatarUrl: string,
 *   memberCount: number,
 *   background?: string,
 *   accentColor?: string,
 * }} options
 * @returns {Promise<Buffer>}
 */
async function buildMemberCard(options) {
  const {
    type = "welcome",
    username = "User",
    avatarUrl,
    memberCount = 0,
    background,
    accentColor,
  } = options;

  const theme = THEMES[type] || THEMES.welcome;
  const accent = accentColor ? `#${accentColor.replace("#", "")}` : theme.accent;
  const accentRgb = hexToRgb(accent) || theme.accentRgb;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── Background ─────────────────────────────────────────────────────────────
  if (background) {
    try {
      const bgBuf = await loadAvatar(background);
      if (bgBuf && Buffer.isBuffer(bgBuf)) {
        const bgImg = await loadImage(bgBuf);
        // Cover-fit
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const bw = bgImg.width  * scale;
        const bh = bgImg.height * scale;
        const bx = (W - bw) / 2;
        const by = (H - bh) / 2;
        ctx.drawImage(bgImg, bx, by, bw, bh);
        // Dark overlay so text is always readable
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, theme.bgTheme);
      }
    } catch {
      drawBackground(ctx, W, H, theme.bgTheme);
    }
  } else {
    drawBackground(ctx, W, H, theme.bgTheme);
  }

  // ── Accent bar (left edge) ─────────────────────────────────────────────────
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 5, H);

  // ── Avatar circle ─────────────────────────────────────────────────────────
  const AX = 100; // centre X
  const AY = H / 2;
  const AR = 80;  // radius

  // Glow ring
  const glowGrad = ctx.createRadialGradient(AX, AY, AR - 4, AX, AY, AR + 20);
  glowGrad.addColorStop(0, `rgba(${accentRgb},0.35)`);
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(AX, AY, AR + 20, 0, Math.PI * 2);
  ctx.fill();

  // Avatar
  const avatarBuf = await loadAvatar(avatarUrl);
  if (avatarBuf && Buffer.isBuffer(avatarBuf)) {
    try {
      const avatarImg = await loadImage(avatarBuf);
      ctx.save();
      circleClip(ctx, AX, AY, AR);
      ctx.drawImage(avatarImg, AX - AR, AY - AR, AR * 2, AR * 2);
      ctx.restore();
    } catch {
      // Draw coloured circle placeholder
      ctx.save();
      ctx.fillStyle = `rgba(${accentRgb},0.3)`;
      circleClip(ctx, AX, AY, AR);
      ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.fillStyle = `rgba(${accentRgb},0.3)`;
    circleClip(ctx, AX, AY, AR);
    ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2);
    ctx.restore();
  }

  // Accent ring border around avatar
  ctx.strokeStyle = accent;
  ctx.lineWidth   = 3.5;
  ctx.beginPath();
  ctx.arc(AX, AY, AR + 3, 0, Math.PI * 2);
  ctx.stroke();

  // ── Text block ─────────────────────────────────────────────────────────────
  const TX = AX + AR + 36; // text start X
  const textMaxW = W - TX - 30;

  // TYPE LABEL (WELCOME / GOODBYE)
  ctx.font      = "700 13px sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "3px";
  ctx.fillText(theme.label, TX, AY - 54);
  ctx.letterSpacing = "0px";

  // Divider line
  ctx.strokeStyle = `rgba(${accentRgb},0.4)`;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(TX, AY - 42);
  ctx.lineTo(TX + textMaxW, AY - 42);
  ctx.stroke();

  // Username
  // Strip only true control characters (not non-ASCII), so Unicode/emoji names render correctly
  const safeUsername = username.replace(/[\x00-\x1F\x7F]/g, "").trim() || username.trim() || "User";
  const userSize = fitText(ctx, safeUsername, textMaxW, 46, 22, "800");
  ctx.fillStyle = "#ffffff";
  ctx.fillText(safeUsername, TX, AY - 2);

  // Sub text
  const subText = theme.sub(memberCount);
  ctx.font      = "500 15px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(subText, TX, AY + 28);

  // Bottom accent strip
  const stripGrad = ctx.createLinearGradient(0, H - 3, W, H);
  stripGrad.addColorStop(0, accent);
  stripGrad.addColorStop(0.5, `rgba(${accentRgb},0.5)`);
  stripGrad.addColorStop(1, "transparent");
  ctx.fillStyle = stripGrad;
  ctx.fillRect(0, H - 3, W, 3);

  return canvas.toBuffer("image/png");
}

/**
 * Convert a hex colour string to an "R,G,B" string for rgba() use.
 * Returns null on failure.
 */
function hexToRgb(hex) {
  if (!hex) return null;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r},${g},${b}`;
}

module.exports = { buildMemberCard };