const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs   = require('fs');

// ── Font directory ────────────────────────────────────────────────────────────
// Production: place fonts in a `fonts/` folder next to this file.
// Dev: automatically uses the canvas-design skill font directory.
const LOCAL_FONTS = path.join(__dirname, 'fonts');
const SKILL_FONTS = '/mnt/skills/examples/canvas-design/canvas-fonts';
const FONT_DIR    = fs.existsSync(LOCAL_FONTS + '/Italiana-Regular.ttf')
  ? LOCAL_FONTS
  : SKILL_FONTS;

// Needed fonts (copy these to your `fonts/` folder in production):
//   Italiana-Regular.ttf      — romantic serif for names
//   CrimsonPro-Italic.ttf     — elegant italic for the tagline
//   InstrumentSans-Bold.ttf   — clean sans-serif for percent + header
//   NotoColorEmoji.ttf        — full-colour emoji (system: /usr/share/fonts/truetype/noto/)

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const reg = (file, name) => {
    try {
      const p = file.startsWith('/') ? file : path.join(FONT_DIR, file);
      GlobalFonts.registerFromPath(p, name);
    } catch (e) {
      console.warn(`[CompatImage] Could not load font "${name}":`, e.message);
    }
  };

  reg('Italiana-Regular.ttf',    'Italiana');
  reg('CrimsonPro-Italic.ttf',   'CrimsonItalic');
  reg('InstrumentSans-Bold.ttf', 'InstrumentBold');
  // NotoColorEmoji lives in the system font directory on Linux
  reg('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 'NotoEmoji');

  fontsRegistered = true;
}

// Font stacks — always append NotoEmoji so emojis fall back correctly
const F_NAME   = 'Italiana, NotoEmoji';        // romantic serif for names
const F_ITALIC = 'CrimsonItalic, NotoEmoji';   // elegant italic for tagline
const F_UI     = 'InstrumentBold, NotoEmoji';  // clean bold for percent + header

// ── Name fitting ──────────────────────────────────────────────────────────────
const MAX_NAME_W = 275; // px available per name (each occupies ~1/3 of canvas width)
const MAX_SIZE   = 58;
const MIN_SIZE   = 20;
const SIZE_STEP  = 2;

/**
 * Returns { size, text } so the name fits within maxWidth pixels.
 * First tries scaling the font down; if still too wide at MIN_SIZE,
 * truncates grapheme-by-grapheme and appends '…'.
 */
function fitName(ctx, name, maxWidth = MAX_NAME_W) {
  // Step 1 — scale down font size
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= SIZE_STEP) {
    ctx.font = `${size}px ${F_NAME}`;
    if (ctx.measureText(name).width <= maxWidth) {
      return { size, text: name };
    }
  }

  // Step 2 — still overflowing at min size: truncate character by character
  ctx.font = `${MIN_SIZE}px ${F_NAME}`;
  const segs = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(name)]
    .map(s => s.segment);
  let out = '';
  for (const ch of segs) {
    if (ctx.measureText(out + ch + '…').width > maxWidth) break;
    out += ch;
  }
  return { size: MIN_SIZE, text: out + '…' };
}

// ── Heart path ────────────────────────────────────────────────────────────────
// Local coords: top of bumps ≈ y=-1, bottom tip = y=+2
// Visual centre ≈ anchor + 0.3 × scale
function drawHeart(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, -0.5);
  ctx.bezierCurveTo( 0,   -1,   -1.4, -1,   -1.4, 0);
  ctx.bezierCurveTo(-1.4,  0.8,  0,    1.3,  0,    2);
  ctx.bezierCurveTo( 0,    1.3,  1.4,  0.8,  1.4,  0);
  ctx.bezierCurveTo( 1.4, -1,    0,   -1,    0,   -0.5);
  ctx.closePath();
  ctx.restore();
}

// ── Colour themes ─────────────────────────────────────────────────────────────
const TIER_THEMES = {
  doomed:    { primary: '#8b1a1a', glow: '#cc3333', accent: '#ff6666', text: '#ffcccc' },
  rocky:     { primary: '#7a3500', glow: '#cc6600', accent: '#ffaa44', text: '#ffe0bb' },
  potential: { primary: '#5a4a00', glow: '#ccaa00', accent: '#ffe066', text: '#fff7cc' },
  lovely:    { primary: '#3d007a', glow: '#9933ff', accent: '#cc88ff', text: '#eedeff' },
  soulmates: { primary: '#8b0030', glow: '#ff0055', accent: '#ff6ba8', text: '#fff5f8' },
  perfect:   { primary: '#7a0060', glow: '#ff00cc', accent: '#ff88ee', text: '#fff0fc' },
};

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * @param {string} nameA    Display name (may contain emojis)
 * @param {string} nameB    Display name (may contain emojis)
 * @param {number} percent  1–100
 * @param {string} tier     Colour tier key
 * @param {string} line     Cheesy tagline (may contain emojis)
 * @returns {Buffer} PNG
 */
function generateCompatibilityImage(nameA, nameB, percent, tier, line) {
  ensureFonts();

  // Normalise names: convert fancy Unicode letters → plain text, strip unrenderable symbols
  nameA = normalizeDisplayName(nameA);
  nameB = normalizeDisplayName(nameB);
  // Guard: if normalisation strips everything, fall back to original
  if (!nameA.trim()) nameA = '???';
  if (!nameB.trim()) nameB = '???';

  const W = 820, H = 440;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const theme  = TIER_THEMES[tier] || TIER_THEMES.soulmates;

  // ── Background ───────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    '#0d0018');
  bg.addColorStop(0.45, shiftColor(theme.primary, -20));
  bg.addColorStop(1,    '#050010');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Centre glow
  const midGlow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 220);
  midGlow.addColorStop(0, hexAlpha(theme.glow, 0.12));
  midGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = midGlow;
  ctx.fillRect(0, 0, W, H);

  // ── Scattered background hearts ──────────────────────────────────────────────
  const scatter = [
    { x: 58,  y: 48,  s: 12, a: 0.07 }, { x: 762, y: 38,  s: 10, a: 0.06 },
    { x: 28,  y: 345, s:  9, a: 0.07 }, { x: 792, y: 358, s: 11, a: 0.07 },
    { x: 142, y: 410, s:  8, a: 0.05 }, { x: 678, y: 402, s:  9, a: 0.06 },
    { x: 400, y:  18, s:  8, a: 0.05 }, { x:  98, y: 202, s:  6, a: 0.04 },
    { x: 722, y: 208, s:  7, a: 0.05 }, { x: 198, y: 382, s:  7, a: 0.04 },
    { x: 622, y: 378, s:  6, a: 0.04 }, { x: 322, y: 422, s:  5, a: 0.04 },
    { x: 490, y: 410, s:  6, a: 0.04 }, { x: 555, y:  25, s:  6, a: 0.04 },
  ];
  scatter.forEach(h => {
    ctx.globalAlpha = h.a;
    drawHeart(ctx, h.x, h.y, h.s);
    ctx.fillStyle = theme.accent;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // ── Divider lines ─────────────────────────────────────────────────────────────
  ctx.strokeStyle = hexAlpha(theme.accent, 0.18);
  ctx.lineWidth   = 1;
  [82, H - 82].forEach(y => {
    ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 50, y); ctx.stroke();
  });

  // ── Header label ──────────────────────────────────────────────────────────────
  ctx.font         = `11px ${F_UI}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = hexAlpha(theme.accent, 0.55);
  ctx.fillText('C O M P A T I B I L I T Y', W / 2, 52);

  // ── Names ─────────────────────────────────────────────────────────────────────
  const NAME_Y = H / 2 - 8;

  // Pre-measure both names so we can position them properly
  const fitA = fitName(ctx, nameA);
  const fitB = fitName(ctx, nameB);

  ctx.shadowColor  = theme.glow;
  ctx.shadowBlur   = 24;
  ctx.fillStyle    = theme.text;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `${fitA.size}px ${F_NAME}`;
  ctx.fillText(fitA.text, W * 0.24, NAME_Y);

  ctx.font = `${fitB.size}px ${F_NAME}`;
  ctx.fillText(fitB.text, W * 0.76, NAME_Y);

  ctx.shadowBlur = 0;

  // ── Central heart ─────────────────────────────────────────────────────────────
  const cx       = W / 2;
  const cy_heart = H / 2 - 10;
  const SCALE    = 40;
  const PCT_Y    = cy_heart + Math.round(SCALE * 0.3); // visual centre of heart body

  // Outer glow rings
  [80, 58, 42].forEach((r, i) => {
    ctx.globalAlpha = 0.04 + i * 0.02;
    drawHeart(ctx, cx, cy_heart, r);
    ctx.fillStyle = theme.glow;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Main filled heart
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur  = 45;
  drawHeart(ctx, cx, cy_heart, SCALE);
  const hGrad = ctx.createRadialGradient(cx - 8, cy_heart - 10, 2, cx, cy_heart + 30, 56);
  hGrad.addColorStop(0,   theme.accent);
  hGrad.addColorStop(0.5, theme.glow);
  hGrad.addColorStop(1,   theme.primary);
  ctx.fillStyle = hGrad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Shimmer highlight (upper lobe only — drawn before percent so percent sits on top)
  ctx.globalAlpha = 0.22;
  drawHeart(ctx, cx - 5, cy_heart - 12, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Percent — centred in heart body ───────────────────────────────────────────
  ctx.font         = `bold 26px ${F_UI}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur   = 8;
  ctx.fillStyle    = '#ffffff';
  ctx.fillText(`${percent}%`, cx, PCT_Y);
  ctx.shadowBlur   = 0;

  // ── Heart progress meter ───────────────────────────────────────────────────────
  const filledHearts = Math.round((percent / 100) * 10);
  for (let i = 0; i < 10; i++) {
    const hx = W / 2 - 4.5 * 32 + i * 32 + 16;
    const hy = H - 94;
    ctx.globalAlpha = i < filledHearts ? 0.85 : 0.12;
    drawHeart(ctx, hx, hy, 7);
    ctx.fillStyle = i < filledHearts ? theme.accent : '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Cheesy tagline ─────────────────────────────────────────────────────────────
  ctx.font         = `italic 19px ${F_ITALIC}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = hexAlpha(theme.text, 0.88);
  ctx.fillText(line, W / 2, H - 46);

  return canvas.toBuffer('image/png');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shiftColor(hex, amount) {
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


// ── Unicode name normaliser ───────────────────────────────────────────────────
// Discord users often have "fancy text" names built from Mathematical
// Alphanumeric Symbols (𝑳𝒂𝒖𝒓𝒆𝒏), fullwidth ASCII (ａｂｃ), and decorative
// symbols (⋆｡˚) that our fonts have no glyphs for — they render as □ boxes.
// This function converts them to readable plain text and strips the rest,
// while preserving real emoji (handled by NotoEmoji).

const MATH_ALPHA_RANGES = [
  [0x1D400, 0x1D41A], // Bold
  [0x1D434, 0x1D44E], // Italic
  [0x1D468, 0x1D482], // Bold Italic
  [0x1D49C, 0x1D4B6], // Script
  [0x1D4D0, 0x1D4EA], // Bold Script
  [0x1D504, 0x1D51E], // Fraktur
  [0x1D538, 0x1D552], // Double-struck
  [0x1D56C, 0x1D586], // Bold Fraktur
  [0x1D5A0, 0x1D5BA], // Sans-serif
  [0x1D5D4, 0x1D5EE], // Sans-serif Bold
  [0x1D608, 0x1D622], // Sans-serif Italic
  [0x1D63C, 0x1D656], // Sans-serif Bold Italic
  [0x1D670, 0x1D68A], // Monospace
];

const _mathMap = new Map();
for (const [capStart, lowStart] of MATH_ALPHA_RANGES) {
  for (let i = 0; i < 26; i++) {
    _mathMap.set(capStart + i, String.fromCharCode(65 + i));
    _mathMap.set(lowStart + i, String.fromCharCode(97 + i));
  }
}
// Exception codepoints scattered across the block (holes in sequential ranges)
const _SINGLE = {
  0x212C:'B', 0x2130:'E', 0x2131:'F', 0x210B:'H', 0x2110:'I', 0x2112:'L',
  0x2133:'M', 0x211B:'R', 0x212F:'e', 0x210A:'g', 0x2113:'l', 0x2134:'o',
  0x210C:'H', 0x2111:'I', 0x211C:'R', 0x2128:'Z', 0x2102:'C', 0x210D:'H',
  0x2115:'N', 0x2119:'P', 0x211A:'Q', 0x211D:'R', 0x2124:'Z', 0x1D455:'h',
  0x1D49D:'B', 0x1D4A0:'E', 0x1D4A1:'F', 0x1D4A3:'H', 0x1D4A4:'I',
  0x1D4A7:'L', 0x1D4A8:'M', 0x1D4AD:'R', 0x1D4BA:'e', 0x1D4BC:'g',
  0x1D4C4:'o', 0x1D506:'C', 0x1D50B:'H', 0x1D50C:'I', 0x1D515:'R',
  0x1D51D:'Z', 0x1D53A:'C', 0x1D53F:'H', 0x1D545:'N', 0x1D547:'P',
  0x1D548:'Q', 0x1D549:'R', 0x1D551:'Z',
};
for (const [cp, ch] of Object.entries(_SINGLE)) _mathMap.set(Number(cp), ch);
// Math digits (Bold, Double-struck, Sans-serif, Sans-serif Bold, Monospace)
for (const start of [0x1D7CE, 0x1D7D8, 0x1D7E2, 0x1D7EC, 0x1D7F6]) {
  for (let i = 0; i < 10; i++) _mathMap.set(start + i, String(i));
}

function normalizeDisplayName(name) {
  let out = '';
  for (const ch of name) {
    const cp = ch.codePointAt(0);

    // 1. Mathematical alphanumeric symbols → plain ASCII
    if (_mathMap.has(cp)) { out += _mathMap.get(cp); continue; }

    // 2. Fullwidth ASCII (！–～) → normal ASCII
    if (cp >= 0xFF01 && cp <= 0xFF5E) { out += String.fromCharCode(cp - 0xFF01 + 0x21); continue; }
    if (cp === 0x3000) { out += ' '; continue; } // Ideographic space

    // 3. Emoji — keep as-is (NotoEmoji renders them)
    if (/\p{Emoji_Presentation}/u.test(ch) || /\p{Extended_Pictographic}/u.test(ch)) {
      out += ch; continue;
    }

    // 4. Basic Latin + Latin Extended (plain text, accented chars, etc.)
    if (cp <= 0x2AF) { out += ch; continue; }

    // 5. Common non-Latin scripts (render fine with system fallback fonts)
    if (
      (cp >= 0x0370 && cp <= 0x03FF) || // Greek
      (cp >= 0x0400 && cp <= 0x04FF) || // Cyrillic
      (cp >= 0x0600 && cp <= 0x06FF) || // Arabic
      (cp >= 0x0900 && cp <= 0x097F) || // Devanagari
      (cp >= 0x3040 && cp <= 0x30FF) || // Hiragana / Katakana
      (cp >= 0x4E00 && cp <= 0x9FFF) || // CJK Unified Ideographs
      (cp >= 0xAC00 && cp <= 0xD7AF)    // Hangul Syllables
    ) { out += ch; continue; }

    // 6. Anything else (decorative symbols, combining ornaments,
    //    Oriya digits, private-use, etc.) — strip silently
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

module.exports = { generateCompatibilityImage };