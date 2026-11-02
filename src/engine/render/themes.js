/* =========================================================
   src/engine/render/themes.js
   Applying a theme to the page and the board
   ========================================================= */
"use strict";

/* =========================================================
   Themes: each backdrop is a whole theme. It paints the board, sets the
   swirl behind everything, tints the panels, and brings its own flair.
   swirl: [bright, middle, deep]   fx: the flair drifting over the page
   ========================================================= */
/* The page look for each theme: from the swirl, highlight and particles in its file */
const THEME_STYLE = {};
CONTENT.themes.forEach(t => {
  const st = {};
  if (Array.isArray(t.swirl)) st.swirl = t.swirl.map(String);
  if (t.highlight) st.accent = String(t.highlight);
  if (t.particles) st.fx = String(t.particles);
  if (t.title) st.name = String(t.title);
  THEME_STYLE[t.id] = st;
});

const FX_NAMES = {
  dust: "drifting dust", hearts: "floating hearts", sparkle: "glints", stars: "twinkling stars", leaves: "falling leaves",
  embers: "rising embers", rain: "light rain", bubbles: "bubbles", petals: "falling petals", steam: "curls of steam",
  confetti: "confetti", snow: "snowfall", fireflies: "fireflies", bits: "falling code"
};

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hsl(h, s, l) {
  const f = n => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return "#" + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, "0")).join("");
}

/* Every token a theme sets. Panels take the hue of the deep swirl color, kept
   dark and calm so text stays readable on every theme. */
function themeFor(bd) {
  const st = THEME_STYLE[bd.id] || {};
  const swirl = st.swirl || [bd.accent || bd.base, bd.base, "#0c0c10"];
  const [h, s0] = rgbToHsl(hexToRgb(swirl[2]));
  const s = Math.min(0.42, Math.max(0.12, s0 * 0.7));
  return {
    swirl,
    accent: st.accent || "#3ddc3d",
    fx: st.fx || "dust",
    vars: {
      "--sw-a": swirl[0], "--sw-b": swirl[1], "--sw-c": swirl[2],
      "--panel": hsl(h, s, 0.17), "--panel-2": hsl(h, s, 0.24), "--panel-3": hsl(h, s * 1.1, 0.1),
      "--edge": hsl(h, s * 0.9, 0.33), "--ink-dim": hsl(h, Math.min(0.3, s), 0.76),
      "--accent": st.accent || "#3ddc3d", "--frame": hsl(h, s * 0.9, 0.33)
    }
  };
}

let activeTheme = null;

const themeName = bd => (THEME_STYLE[bd.id] && THEME_STYLE[bd.id].name) || bd.name;
function themeDesc(bd) {
  const board = bd.kind === "solid" ? "Plain board" : bd.group === "Gradients" ? "Gradient board" : "Patterned board";
  return `${board} with ${FX_NAMES[themeFor(bd).fx]}`;
}

/* A little card showing what a theme looks like: its swirl, a slice of its
   board with your snake on it, and its accent */
function themePreview(bd) {
  const t = themeFor(bd);
  const W = 112, H = 74;
  const c = document.createElement("canvas");
  c.className = "theme-preview";
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext("2d");
  g.scale(2, 2);
  const sw = g.createLinearGradient(0, 0, W, H);
  sw.addColorStop(0, t.swirl[0]);
  sw.addColorStop(0.5, t.swirl[1]);
  sw.addColorStop(1, t.swirl[2]);
  g.fillStyle = sw;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let i = -H; i < W; i += 12) { g.beginPath(); g.moveTo(i, H); g.lineTo(i + 6, H); g.lineTo(i + 6 + H, 0); g.lineTo(i + H, 0); g.fill(); }
  // the board slice, framed in the theme's panel color
  const bx = 30, by = 9, bs = 56;
  g.fillStyle = t.vars["--edge"];
  g.fillRect(bx - 3, by - 3, bs + 6, bs + 6);
  g.save();
  g.beginPath();
  g.rect(bx, by, bs, bs);
  g.clip();
  g.translate(bx, by);
  paintBackdrop(g, bd, bs, bs);
  g.restore();
  const skin = currentSkin();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = skin.colors[skin.order[i % skin.order.length]];
    g.fillRect(bx + 32 - i * 9, by + 24, 8, 8);
  }
  g.fillStyle = "#ff2b2b";
  g.fillRect(bx + 42, by + 24, 8, 8);
  g.fillStyle = t.accent;
  g.beginPath();
  g.arc(12, H - 12, 5, 0, Math.PI * 2);
  g.fill();
  return c;
}

function applyTheme() {
  const root = document.documentElement.style;
  const t = themeFor(save.settings.themedPage ? currentBackdrop() : backdropById.black);
  activeTheme = t;
  Object.entries(t.vars).forEach(([k, v]) => root.setProperty(k, v));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.swirl[2]);
  document.body.classList.toggle("no-crt", !save.settings.crt);
  tableFx.setTheme(t);
}
