/* =========================================================
   src/engine/render/scene-art.js
   Drawing the bigger pictures in textures/ (the scenes: rooms, shops,
   home...) and the moving bits over them. Every picture is a PNG;
   textures/index.json says which file, and for some of them:

     "frames": 2       a sprite sheet: that many frames side by side,
                       all the same width; the game picks which to show
     "columns": 3      ...laid out in rows of that many instead (frame 0
                       top left, along the row, then the next row down)
     "anchor": [4, 13] the pixel of each frame that sits on the point the
                       game draws it at (a keeper's feet), for texDrawAt()
     "keys": { "#ff00ff": "pip" }
                       a color-swap picture: pixels in a key color are
                       painted in a color the game supplies (a rarity,
                       an island's money, a theme), everything else as
                       it is

   texDraw(g, id, x, y, frame)   a picture or one frame of it, as it is
   texPaint(g, id, x, y, opts)   the same picture painted pixel by pixel
                                 the way the game's own drawing code
                                 paints: with an alpha over it (lights
                                 that pulse, embers that fade) and/or
                                 its key colors swapped ({ alpha, frame,
                                 colors: { pip: "#3ddc84" } })
   Pictures with no entry draw the pink checkerboard and warn once, like icons.
   ========================================================= */
"use strict";

/* How many frames a picture has, and where one of them is in the sheet */
const texFrameCount = id => { const r = texResolve(id); return r && r.e.frames > 1 ? Math.floor(r.e.frames) : 1; };
function texFrameBox(id, frame = 0) {
  const r = texResolve(id), c = texCanvas(id), n = texFrameCount(id);
  const cols = r && r.e.columns > 0 ? Math.min(n, Math.floor(r.e.columns)) : n, rows = Math.ceil(n / cols);
  const w = Math.floor(c.width / cols), h = Math.floor(c.height / rows);
  const k = ((Math.floor(frame) % n) + n) % n;
  return { c, sx: (k % cols) * w, sy: Math.floor(k / cols) * h, w, h };
}

/* A picture, or one frame of a sprite sheet, as it is, at x, y (scaled to w x h if given) */
function texDraw(g, id, x, y, frame = 0, w, h) {
  const b = texFrameBox(id, frame);
  g.drawImage(b.c, b.sx, b.sy, b.w, b.h, x, y, w === undefined ? b.w : w, h === undefined ? b.h : h);
}
/* The same, with the frame's anchor pixel on x, y */
function texDrawAt(g, id, x, y, frame = 0) {
  const r = texResolve(id), a = (r && r.e.anchor) || [0, 0];
  texDraw(g, id, x - a[0], y - a[1], frame);
}

/* A picture's pixels as runs of one color along each row, worked out once per frame:
   [x, y, length, r, g, b, a, key name or null] */
const texRunCache = new Map();
function texRuns(id, frame = 0) {
  const r = texResolve(id);
  const b = texFrameBox(id, frame);
  const cacheKey = (r ? r.e.file : "?" + id) + "#" + b.sx + "," + b.sy;
  if (texRunCache.has(cacheKey)) return texRunCache.get(cacheKey);
  const keys = {};
  Object.entries((r && r.e.keys) || {}).forEach(([hex, name]) => { const [kr, kg, kb] = hexRgb(hex); keys[(kr << 16) | (kg << 8) | kb] = name; });
  const px = pixelsOf(b.c), W = b.c.width, runs = [];
  for (let y = 0; y < b.h; y++) {
    let x = 0;
    while (x < b.w) {
      const i = ((b.sy + y) * W + b.sx + x) * 4;
      if (!px[i + 3]) { x++; continue; }
      let n = 1;
      const same = j => px[j] === px[i] && px[j + 1] === px[i + 1] && px[j + 2] === px[i + 2] && px[j + 3] === px[i + 3];
      while (x + n < b.w && same(((b.sy + y) * W + b.sx + x + n) * 4)) n++;
      const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      runs.push([x, y, n, px[i], px[i + 1], px[i + 2], px[i + 3], keys[k] || null]);
      x += n;
    }
  }
  // one color all over: painted as one rectangle (the same at any position, whole or fractional)
  if (runs.length === b.h && runs.every(r => r[0] === 0 && r[2] === b.w && r[3] === runs[0][3] && r[4] === runs[0][4] && r[5] === runs[0][5] && r[6] === runs[0][6] && r[7] === runs[0][7])) runs.solid = { w: b.w, h: b.h };
  texRunCache.set(cacheKey, runs);
  return runs;
}

/* A picture painted pixel by pixel: with an alpha over it, and/or its key colors swapped */
function texPaint(g, id, x, y, { alpha = 1, frame = 0, colors = null } = {}) {
  const runs = texRuns(id, frame);
  const was = g.globalAlpha;
  const rects = runs.solid ? [[0, 0, runs.solid.w].concat(runs[0].slice(3))] : runs;
  for (const [rx, ry, n, r, gg, b, a, key] of rects) {
    const swap = key && colors && colors[key];
    if (swap) {
      // a supplied color is used as it's given; any alpha goes over it as the canvas's own
      if (alpha !== 1 || a !== 255) g.globalAlpha = was * (a === 255 ? alpha : alpha * a / 255);
      g.fillStyle = swap;
    } else {
      g.fillStyle = `rgba(${r},${gg},${b},${a === 255 ? alpha : alpha * a / 255})`;
    }
    g.fillRect(x + rx, y + ry, n, runs.solid ? runs.solid.h : 1);
    g.globalAlpha = was;
  }
}

/* A layer of a scene: its solid pixels drawn as they are, its see-through ones (shadows, a tint)
   painted over whatever is under them, the way the old drawing code laid them down */
const texLayerCache = new Map();
function texLayer(g, id, x, y) {
  const r = texResolve(id);
  const src = texCanvas(id);
  const cacheKey = r ? r.e.file : "?" + id;
  let L = texLayerCache.get(cacheKey);
  if (!L) {
    const px = pixelsOf(src), W = src.width, H = src.height;
    const solid = document.createElement("canvas");
    solid.width = W; solid.height = H;
    const sg = solid.getContext("2d"), img = sg.createImageData(W, H);
    const runs = [];
    for (let yy = 0; yy < H; yy++) {
      let xx = 0;
      while (xx < W) {
        const i = (yy * W + xx) * 4, a = px[i + 3];
        if (a === 255) { for (let c = 0; c < 4; c++) img.data[i + c] = px[i + c]; xx++; continue; }
        if (!a) { xx++; continue; }
        let n = 1;
        while (xx + n < W) { const j = (yy * W + xx + n) * 4; if (px[j] !== px[i] || px[j + 1] !== px[i + 1] || px[j + 2] !== px[i + 2] || px[j + 3] !== a) break; n++; }
        runs.push([xx, yy, n, `rgba(${px[i]},${px[i + 1]},${px[i + 2]},${a / 255})`]);
        xx += n;
      }
    }
    sg.putImageData(img, 0, 0);
    L = { solid, runs };
    texLayerCache.set(cacheKey, L);
  }
  g.drawImage(L.solid, x, y);
  for (const [rx, ry, n, fill] of L.runs) { g.fillStyle = fill; g.fillRect(x + rx, y + ry, n, 1); }
}
