/* =========================================================
   src/art/ui-frames.js
   The menus' pixel frames, in the style of an old RPG's windows: a dark
   outline, a brass trim with a rivet in every corner, a bevel catching
   the light from the top left, and a lightly worn fill. Big windows get a
   double trim and a gem in each corner; buttons are chunky pixel blocks
   with a lip under them; tabs, chips and the parchment of a wanted poster
   are drawn the same way.

   Every frame is a tiny color-swap picture in textures/ui/, filled in once
   from the theme's own colors (so Theme colors still tint every panel) and
   handed to the styles as a CSS variable (--fx-*), used as a 9-slice
   border-image by styles/16-retro-fantasy.css. Filled in again whenever
   the theme changes.
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

/* The frames are color-swap pictures in textures/ui/ (ui:plate, ui:chip, ui:window, ui:button-up,
   ui:button-down, ui:tab): painted in key colors that stand for the theme's colors and the metals, and
   filled in here. ui:parchment, the board's corners and the scroll are pictures as they are. */
function fxFrame(id, colors) {
  const src = texCanvas(id);
  const [c, g] = fxCanvasOf(src.width, src.height);
  texPaint(g, id, 0, 0, { colors });
  return c;
}
/* A framed plate: B pixels of frame on every side (5, or 3 for a chip), a 5 x 5 fill in the middle;
   outline, metal trim, a dark line, the bevel, the fill; notched corners with a rivet (a chip: a glint) */
function fxPlate(fill, metal = FX_METALS.brass, B = 5) {
  const [shine, light, body, shadow] = metal;
  return fxFrame(B >= 5 ? "ui:plate" : "ui:chip", { fill, fillLit: fxShade(fill, 0.17), fillDark: fxShade(fill, -0.34), fillSpeck: fxShade(fill, -0.07), shine, light, body, shadow });
}
/* A big window: a double trim, and a gem set in each corner (B = 8) */
function fxWindow(fill, gem = "#3ddc84", metal = FX_METALS.brass) {
  const [shine, light, body, shadow] = metal;
  return fxFrame("ui:window", { fill, fillLit: fxShade(fill, 0.15), fillDark: fxShade(fill, -0.32), shine, light, body, shadow, gemDark: fxShade(gem, -0.35), gemLit: fxShade(gem, 0.6) });
}
/* A button: 3 pixels of frame at the top and sides, 5 at the bottom for its lip.
   down: pressed, with the lip squashed and the light from below. tab: no lip. */
function fxButton(face, lip, kind = "up") {
  return fxFrame(kind === "tab" ? "ui:tab" : kind === "down" ? "ui:button-down" : "ui:button-up",
    { face, faceTop: fxShade(face, 0.6), faceHi: fxShade(face, 0.32), faceDark: fxShade(face, -0.24), lip: lip || fxShade(face, -0.45) });
}
/* Parchment: a wanted poster's paper, nailed up, with darker worn edges (B = 5) */
const fxParchment = () => texCanvas("ui:parchment");

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
  // brass brackets for the board's four corners (textures/ui/board-corner-*.png)
  ["tl", "tr", "bl", "br"].forEach(k => set(`--fx-corner-${k}`, texCanvas("ui:corner-" + k)));
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
