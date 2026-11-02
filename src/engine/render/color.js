/* =========================================================
   src/engine/render/color.js
   Color helpers: contrast, mixing, swapping clashing colors
   ========================================================= */
"use strict";

/* =========================================================
   Colour helpers: swap colours that match the backdrop
   ========================================================= */
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(rgb) {
  const f = c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

function colorsTooClose(a, b) {
  const bothVeryDark = relativeLuminance(a) < 0.025 && relativeLuminance(b) < 0.025;
  return bothVeryDark || colorDistance(a, b) < 130 || contrastRatio(a, b) < 1.2;
}

function computeVisibleColor(hex, backdrop) {
  const refs = [backdrop.base];
  if (backdrop.accent) refs.push(backdrop.accent);

  const rgb = hexToRgb(hex);
  const clash = refs.some(ref => colorsTooClose(rgb, hexToRgb(ref)));
  if (!clash) return hex;

  // First try a deeper or brighter shade of the same color, so an apple still
  // looks like an apple; only fall back to plain black or white if that fails
  const base = hexToRgb(backdrop.base);
  const goLight = contrastRatio([255, 255, 255], base) >= contrastRatio([0, 0, 0], base);
  for (const t of [0.45, 0.6, 0.75]) {
    const shade = rgb.map(v => Math.round(goLight ? v + (255 - v) * t : v * (1 - t)));
    if (!refs.some(ref => colorsTooClose(shade, hexToRgb(ref)))) {
      return "#" + shade.map(v => v.toString(16).padStart(2, "0")).join("");
    }
  }
  return goLight ? "#ffffff" : "#000000";
}

const visibleColorCache = new Map();
const skinColorCache = new Map();

/* Like visibleColor, but if swapping a color would make it match another color
   in the same skin (black and white stripes on black), use a gray instead so the
   pattern stays visible. */
function skinVisibleColor(skin, color) {
  const key = skin.id + "|" + color;
  let v = skinColorCache.get(key);
  if (v !== undefined) return v;

  v = visibleColor(color);
  if (v !== color) {
    const others = [...new Set(skin.colors.concat(skin.head ? [skin.head] : []))].filter(c => c !== color);
    // Only when the swap lands on a color the skin already shows as-is
    const clash = others.some(o => visibleColor(o) === o && colorsTooClose(hexToRgb(o), hexToRgb(v)));
    if (clash) {
      const base = hexToRgb(currentBackdrop().base);
      v = relativeLuminance(base) > 0.4 ? "#5c5c5c" : "#9a9a9a";
    }
  }
  skinColorCache.set(key, v);
  return v;
}

function visibleColor(hex) {
  let v = visibleColorCache.get(hex);
  if (v === undefined) {
    v = computeVisibleColor(hex, currentBackdrop());
    visibleColorCache.set(hex, v);
  }
  return v;
}
