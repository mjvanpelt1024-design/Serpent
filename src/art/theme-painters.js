/* =========================================================
   src/art/theme-painters.js
   How each patterned theme paints the board
   ========================================================= */
"use strict";

/* A theme file (content/themes/*.theme) with "painter = name" has a picture: theme:<name> in
   textures/themes/, the board as it looks (400 x 400, 20 pixels to a square), or a tile that repeats
   across it from its top left corner (a brick, a check, a polka dot...). A new pattern is a new picture
   and its line in textures/index.json, plus a theme file that names it.

   A few paint a smooth gradient first, here, in their file's colors (this.base, this.accent; `this` is
   the theme): the sunset and the ocean are nothing but their gradient; the twilight's stars, the
   synthwave's sun and grid and the nebula's stars are pictures over theirs. */
const THEME_UNDER = {
  sunsetsky(g, w, h) {
    const grd = g.createLinearGradient(0, 0, 0, Math.max(h, 400));
    grd.addColorStop(0, this.base);
    grd.addColorStop(1, this.accent);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  },
  oceandeep(g, w, h) {
    const grd = g.createLinearGradient(0, 0, 0, Math.max(h, 400));
    grd.addColorStop(0, this.base);
    grd.addColorStop(1, this.accent);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  },
  twilight(g, w, h) {
    const grd = g.createLinearGradient(0, 0, 0, Math.max(h, 400));
    grd.addColorStop(0, this.base);
    grd.addColorStop(1, this.accent);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  },
  synthwave(g, w, h) {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#1a0b2e");
    grd.addColorStop(1, "#2d0b4e");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  },
  nebula(g, w, h) {
    g.fillStyle = this.base;
    g.fillRect(0, 0, w, h);
    [[80, 90, "rgba(157, 78, 221, 0.28)"], [300, 260, "rgba(0, 180, 216, 0.22)"], [240, 70, "rgba(247, 37, 133, 0.18)"], [70, 330, "rgba(0, 180, 216, 0.16)"]]
      .forEach(([cx, cy, color]) => {
        const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 140);
        grd.addColorStop(0, color);
        grd.addColorStop(1, "rgba(0, 0, 0, 0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      });
  }
};
/* Shrunk to fit a small preview (a Tailor card, the easel at home) instead of cut from the board's corner */
const THEME_FIT = new Set(["synthwave"]);

/* The whole board from a theme's picture, put together once */
const themeBoardCache = new Map();
function themeBoard(name) {
  if (themeBoardCache.has(name)) return themeBoardCache.get(name);
  const pic = texCanvas("theme:" + name), c = document.createElement("canvas");
  c.width = boardSize; c.height = boardSize;
  const g = c.getContext("2d");
  for (let y = 0; y < boardSize; y += pic.height) for (let x = 0; x < boardSize; x += pic.width) g.drawImage(pic, x, y);
  themeBoardCache.set(name, c);
  return c;
}
function themePainter(name) {
  return function (g, w, h) {
    if (THEME_UNDER[name]) THEME_UNDER[name].call(this, g, w, h);
    if (!TextureLoader.has("theme:" + name)) return;
    const c = themeBoard(name), was = g.imageSmoothingEnabled;
    if (THEME_FIT.has(name) && (w < boardSize || h < boardSize)) { g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, w, h); }
    else {
      const cw = Math.min(w, boardSize), ch = Math.min(h, boardSize);
      g.imageSmoothingEnabled = false;
      g.drawImage(c, 0, 0, cw, ch, 0, 0, cw, ch);
    }
    g.imageSmoothingEnabled = was;
  };
}
const THEME_PAINTERS = {};
new Set(TextureLoader.ids().filter(id => id.startsWith("theme:")).map(id => id.slice(6)).concat(Object.keys(THEME_UNDER)))
  .forEach(name => { THEME_PAINTERS[name] = themePainter(name); });
