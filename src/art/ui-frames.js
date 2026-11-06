/* =========================================================
   src/art/ui-frames.js
   The menus' pixel frames, in the style of an old RPG's windows: a dark
   outline, a brass trim with a rivet in every corner, a bevel catching
   the light from the top left, and a lightly worn fill. Big windows get a
   double trim and a gem in each corner; buttons are chunky pixel blocks
   with a lip under them; tabs, chips and the parchment of a wanted poster
   are drawn the same way.

   Every frame is a tiny picture drawn once from the theme's own colors
   (so Theme colors still tint every panel) and handed to the styles as a
   CSS variable (--fx-*), used as a 9-slice border-image by
   styles/16-retro-fantasy.css. Drawn again whenever the theme changes.
   ========================================================= */
"use strict";

const fxCanvas = document.createElement("canvas").getContext("2d");
/* Any CSS color as [r, g, b] */
function fxRgb(css) {
  fxCanvas.fillStyle = "#000";
  fxCanvas.fillStyle = String(css).trim() || "#000";
  const v = fxCanvas.fillStyle;
  if (v[0] === "#") return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  const m = v.match(/[\d.]+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
}
const fxHex = c => "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/* Lighter (k > 0, toward white) or darker (k < 0) */
const fxShade = (css, k) => fxHex(fxRgb(css).map(v => (k >= 0 ? v + (255 - v) * k : v * (1 + k))));
const fxMix = (a, b, k) => { const A = fxRgb(a), B = fxRgb(b); return fxHex(A.map((v, i) => v + (B[i] - v) * k)); };

const FX_K = "#0b0907";
const FX_METALS = {
  brass: ["#fff0b0", "#f2c45a", "#c88a28", "#6e4410"],          // shine, light, body, shadow
  silver: ["#ffffff", "#dfe4ec", "#9aa3ad", "#454d58"],
  blood: ["#ffd0c8", "#ff6a5a", "#b82a24", "#581414"],
  violet: ["#ffffff", "#e2b4ff", "#9450e0", "#3a1462"]
};

function fxCanvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}
const fxUrl = c => `url("${c.toDataURL()}")`;

/* A framed plate: B pixels of frame on every side, a 5 x 5 fill in the middle.
   Layers from the outside in: outline, metal trim, a dark line, the bevel, the fill.
   The corners are notched one pixel and carry a rivet. */
function fxPlate(fill, metal = FX_METALS.brass, B = 5) {
  const N = B * 2 + 5;
  const [c, g] = fxCanvasOf(N, N);
  const [shine, light, body, shadow] = metal;
  const bevL = fxShade(fill, 0.17), bevS = fxShade(fill, -0.34), speck = fxShade(fill, -0.07);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.min(x, y, N - 1 - x, N - 1 - y);
    const lit = x + y < N - 1;                         // the top-left half catches the light
    let col = null;
    if (d === 0) col = FX_K;
    else if (d === 1) col = lit ? light : shadow;
    else if (d === 2) col = FX_K;
    else if (d === 3) col = lit ? bevL : bevS;
    else col = fill;
    // notched corners
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
    if (cx + cy < 1) col = null;
    else if (cx + cy === 1 && cx !== cy) col = FX_K;
    g.fillStyle = col || "rgba(0,0,0,0)";
    if (col) g.fillRect(x, y, 1, 1);
  }
  // a worn speck in the fill, so big panels aren't one flat color
  g.fillStyle = speck; g.fillRect(B + 2, B + 2, 1, 1);
  // a rivet in every corner, lit from the top left
  const stud = (x, y) => {
    g.fillStyle = FX_K; g.fillRect(x - 1, y - 1, 4, 4);
    g.fillStyle = body; g.fillRect(x, y, 2, 2);
    g.fillStyle = shine; g.fillRect(x, y, 1, 1);
    g.fillStyle = shadow; g.fillRect(x + 1, y + 1, 1, 1);
  };
  if (B >= 5) { stud(2, 2); stud(N - 4, 2); stud(2, N - 4); stud(N - 4, N - 4); }
  else { g.fillStyle = shine; g.fillRect(1, 1, 1, 1); }      // too small for rivets: a glint instead
  return c;
}

/* A big window: a double trim, and a gem set in each corner (B = 8) */
function fxWindow(fill, gem = "#3ddc84", metal = FX_METALS.brass) {
  const B = 8, N = B * 2 + 5;
  const [c, g] = fxCanvasOf(N, N);
  const [shine, light, body, shadow] = metal;
  const bevL = fxShade(fill, 0.15), bevS = fxShade(fill, -0.32);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.min(x, y, N - 1 - x, N - 1 - y);
    const lit = x + y < N - 1;
    let col;
    if (d === 0) col = FX_K;
    else if (d === 1) col = lit ? light : shadow;
    else if (d === 2) col = lit ? body : shadow;
    else if (d === 3) col = FX_K;
    else if (d === 4) col = lit ? body : shadow;
    else if (d === 5) col = FX_K;
    else if (d === 6) col = lit ? bevL : bevS;
    else col = fill;
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
    if (cx + cy < 2) col = cx + cy === 1 ? null : null;
    if (cx + cy === 2 && cx !== cy) col = FX_K;
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  // a cut gem in each corner, in a brass setting
  const gemAt = (x, y) => {
    g.fillStyle = FX_K; g.fillRect(x - 1, y - 1, 6, 6);
    g.fillStyle = body; g.fillRect(x, y, 4, 4);
    g.fillStyle = fxShade(gem, -0.35); g.fillRect(x + 1, y + 1, 2, 2);
    g.fillStyle = gem; g.fillRect(x + 1, y + 1, 1, 1);
    g.fillStyle = fxShade(gem, 0.6); g.fillRect(x + 1, y + 1, 1, 1);
    g.fillStyle = shine; g.fillRect(x, y, 1, 1);
  };
  gemAt(2, 2); gemAt(N - 6, 2); gemAt(2, N - 6); gemAt(N - 6, N - 6);
  // a little bar of brass at the middle of each side
  g.fillStyle = shine; g.fillRect(B + 2, 2, 1, 1); g.fillRect(2, B + 2, 1, 1);
  return c;
}

/* A button: 3 pixels of frame at the top and sides, 5 at the bottom for its lip.
   down: pressed, with the lip squashed and the light from below. tab: no lip. */
function fxButton(face, lip, kind = "up") {
  const W = 9, H = kind === "tab" ? 9 : 11;
  const [c, g] = fxCanvasOf(W, H);
  const hi = fxShade(face, 0.32), top = fxShade(face, 0.6), sh = fxShade(face, -0.24), lp = lip || fxShade(face, -0.45);
  const put = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const y0 = kind === "down" ? 2 : 0;                  // pressed: the face sits two pixels lower
  const yEnd = kind === "tab" ? H : kind === "down" ? H - 1 : H - 1;
  for (let y = y0; y < yEnd; y++) for (let x = 0; x < W; x++) {
    const edgeX = x === 0 || x === W - 1, edgeY = y === y0 || y === yEnd - 1;
    if (edgeX && edgeY) continue;                     // round off the corners
    let col = face;
    if (edgeX || y === y0 || (kind !== "tab" && y === yEnd - 1)) col = FX_K;
    else if (kind === "up" && y >= yEnd - 4) col = y === yEnd - 4 ? sh : lp;   // the lip under it
    else if (kind === "down") col = y === y0 + 1 ? sh : x === 1 ? sh : x === W - 2 ? hi : face;
    else if (y === y0 + 1) col = top;
    else if (x === 1) col = hi;
    else if (x === W - 2) col = sh;
    put(x, y, col);
  }
  return c;
}

/* Parchment: a wanted poster's paper, nailed up, with darker worn edges (B = 5) */
function fxParchment() {
  const B = 5, N = B * 2 + 5;
  const [c, g] = fxCanvasOf(N, N);
  const paper = "#ecd8a8", worn = "#d6b97f", burnt = "#a8844c";
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.min(x, y, N - 1 - x, N - 1 - y);
    let col = d === 0 ? "#3a2410" : d === 1 ? burnt : d === 2 ? worn : paper;
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
    if (cx + cy < 2) col = null;                      // torn corners
    else if (cx + cy === 2 && cx !== cy) col = "#3a2410";
    if ((x * 7 + y * 3) % 11 === 0 && d > 1 && d < 4) col = worn;
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  // the nails at the top corners
  [[3, 3], [N - 5, 3]].forEach(([x, y]) => { g.fillStyle = "#2a2a30"; g.fillRect(x, y, 2, 2); g.fillStyle = "#9aa3ad"; g.fillRect(x, y, 1, 1); });
  return c;
}

/* The frames of the moment, as CSS variables on <html> */
function paintUiFrames() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, d) => css.getPropertyValue(name).trim() || d;
  const panel = v("--panel", "#1d3a2e"), panel2 = v("--panel-2", "#26493a"), panel3 = v("--panel-3", "#11241c");
  const accent = v("--accent", "#3ddc84");
  const root = document.documentElement.style;
  const set = (name, canvas) => root.setProperty(name, fxUrl(canvas));
  set("--fx-plate", fxPlate(panel));
  set("--fx-plate-2", fxPlate(panel2));
  set("--fx-plate-3", fxPlate(panel3, FX_METALS.silver));
  set("--fx-plate-blue", fxPlate(v("--blue", "#2f9bff"), FX_METALS.silver));
  set("--fx-plate-boss", fxPlate(fxMix("#4a1020", panel, 0.4), FX_METALS.blood));
  set("--fx-plate-gold", fxPlate(fxMix("#5a3a08", panel, 0.35)));
  set("--fx-plate-violet", fxPlate(fxMix("#3a1462", panel, 0.4), FX_METALS.violet));
  set("--fx-chip", fxPlate(panel3, FX_METALS.brass, 3));
  set("--fx-window", fxWindow(panel, accent));
  set("--fx-parch", fxParchment());
  // buttons in every face color the game uses, pressed and not
  [["green", "--green", "--green-lip", "#4bc27a"], ["red", "--red", "--red-lip", "#ff5a4d"], ["blue", "--blue", "--blue-lip", "#2f9bff"],
   ["gold", "--gold", "--gold-lip", "#ffb020"], ["orange", "--orange", "--orange-lip", "#ff8a3d"], ["purple", "--purple", "--purple-lip", "#a46bff"]].forEach(([n, f, l, d]) => {
    set(`--fx-btn-${n}`, fxButton(v(f, d), v(l, fxShade(d, -0.45))));
    set(`--fx-btn-${n}-down`, fxButton(v(f, d), v(l, fxShade(d, -0.45)), "down"));
  });
  // brass brackets for the board's four corners
  const corner = flip => {
    const [c, g] = fxCanvasOf(12, 12);
    const [shine, light, body, shadow] = FX_METALS.brass;
    const px = (x, y, col) => { const X = flip & 1 ? 11 - x : x, Y = flip & 2 ? 11 - y : y; g.fillStyle = col; g.fillRect(X, Y, 1, 1); };
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
      const col = j === 0 || j === 3 ? FX_K : j === 1 ? light : shadow;
      if (i < 12 - j) { px(i, j, col); px(j, i, col); }
    }
    px(1, 1, shine); px(2, 1, shine); px(1, 2, shine);
    // a rivet where the arms meet
    px(4, 4, FX_K); px(5, 4, FX_K); px(4, 5, FX_K); px(5, 5, FX_K); px(5, 5, body); px(4, 4, shine);
    return c;
  };
  set("--fx-corner-tl", corner(0)); set("--fx-corner-tr", corner(1)); set("--fx-corner-bl", corner(2)); set("--fx-corner-br", corner(3));
  set("--fx-btn-dark", fxButton(panel2, panel3));
  set("--fx-btn-dark-down", fxButton(panel2, panel3, "down"));
  set("--fx-tab", fxButton(panel3, panel3, "tab"));
  set("--fx-tab-on", fxButton(panel2, panel3, "tab"));
}

/* A plate in an island's own colors, for the HUD's "where you are" */
const fxIslePlates = {};
function fxIslePlate(accent) {
  if (fxIslePlates[accent]) return fxIslePlates[accent];
  const panel = getComputedStyle(document.documentElement).getPropertyValue("--panel").trim() || "#1d3a2e";
  const fill = fxMix(accent, panel, 0.72);
  const metal = ["#fff6d0", fxShade(accent, 0.35), accent, fxShade(accent, -0.55)];
  return (fxIslePlates[accent] = fxUrl(fxPlate(fill, metal)));
}

/* Repaint whenever the theme's colors change */
(() => {
  const orig = applyTheme;
  window.applyTheme = function () {
    const out = orig.apply(this, arguments);
    paintUiFrames();
    Object.keys(fxIslePlates).forEach(k => delete fxIslePlates[k]);
    return out;
  };
})();
