/* =========================================================
   src/campaign/camp-sprites.js
   The map's pixel art. A small toolkit (shaded blobs, walls, roofs,
   dithered glows, clouds) and everything drawn with it: trees, houses,
   crystals, the landmarks, and the spots on the path.

   House style, so everything matches:
     - light comes from the top left; shadows fall to the bottom right
     - every shape has a dark outline and three or four tones, blended
       with ordered (Bayer) dithering, never smooth gradients
     - glows are dithered halos, so magic still looks like pixels
   Everything here draws in map pixels on the world canvas.
   ========================================================= */
"use strict";

const pxBay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)] / 16;
function pxDot(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
function pxRow(g, x, y, w, c) { if (w > 0) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), 1); } }
function pxFill(g, x, y, w, h, c) { if (w > 0 && h > 0) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } }

/* Mixes two "#rrggbb" colors */
function pxMix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const pxDark = (c, t = 0.3) => pxMix(c, "#0a0812", t);
const pxLight = (c, t = 0.3) => pxMix(c, "#fffbe8", t);
/* A five-tone ramp from one color: outline, dark, mid, light, highlight */
const pxRamp = c => [pxDark(c, 0.62), pxDark(c, 0.28), c, pxLight(c, 0.22), pxLight(c, 0.5)];

/* A shaded, outlined blob: canopies, bushes, rocks, hills. pal = [outline, dark, mid, light, highlight] */
function pxBlob(g, cx, cy, rx, ry, pal, o = {}) {
  const wob = o.wobble || 0, seed = o.seed || 0;
  const inside = (x, y) => (x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2 <= 1 + (wob ? (cmHash(x + 99, y + 99, seed) - 0.5) * wob : 0);
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    let c;
    if (edge && !o.noOutline) c = pal[0];
    else {
      const n = -(x / (rx + 0.5)) * 0.55 - (y / (ry + 0.5)) * 0.85;
      const v = 0.42 + n * 0.5 + (cmHash(x, y, seed + 7) - 0.5) * (o.grain || 0.18);
      const k = Math.max(0, Math.min(3, Math.floor(v * 3.2 + pxBay(cx + x, cy + y) - 0.5)));
      c = pal[1 + k];
    }
    pxDot(g, cx + x, cy + y, c);
  }
}

/* A dithered halo of light; additive, so it brightens whatever is under it. Each size and color is baked once. */
const pxGlowCache = new Map();
function pxGlow(g, cx, cy, r, color, a = 0.6) {
  r = Math.max(2, Math.round(r));
  const key = r + color;
  let c = pxGlowCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = r * 2 + 1;
    const cg = c.getContext("2d");
    const [R, G, B] = hexToRgb(color);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      const f = (1 - d) * (1 - d);
      if (f * 1.4 < pxBay(x + r, y + r)) continue;
      cg.fillStyle = `rgba(${R},${G},${B},${Math.min(0.9, f * 0.9)})`;
      cg.fillRect(x + r, y + r, 1, 1);
    }
    pxGlowCache.set(key, c);
  }
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = Math.max(0, Math.min(1, a));
  g.drawImage(c, Math.round(cx - r), Math.round(cy - r));
  g.restore();
}

/* A wall: outlined, lit on the left, shaded on the right, with optional brick or plank lines */
function pxWall(g, x, y, w, h, pal, o = {}) {
  pxFill(g, x, y, w, h, pal[0]);
  pxFill(g, x + 1, y + 1, w - 2, h - 2, pal[2]);
  pxFill(g, x + 1, y + 1, 1, h - 2, pal[3]);
  pxFill(g, x + w - 2, y + 1, 1, h - 2, pal[1]);
  pxFill(g, x + 1, y + h - 2, w - 2, 1, pal[1]);
  if (o.bricks) for (let r = y + 3; r < y + h - 2; r += 3) {
    pxRow(g, x + 2, r, w - 4, pal[1]);
    for (let c = x + 2 + ((r - y) % 6 ? 2 : 0); c < x + w - 2; c += 4) pxDot(g, c, r + 1, pal[1]);
  }
  if (o.planks) for (let c = x + 3; c < x + w - 2; c += 3) pxFill(g, c, y + 1, 1, h - 3, pal[1]);
}

/* A gable roof seen from the front: the left slope catches the light */
function pxRoof(g, x, y, w, h, pal) {
  const mid = x + w / 2;
  for (let r = 0; r < h; r++) {
    const half = Math.round((w / 2) * ((r + 1) / h));
    const x0 = Math.round(mid - half), x1 = Math.round(mid + half);
    pxRow(g, x0, y + r, x1 - x0, pal[0]);
    if (r === 0) continue;
    pxRow(g, x0 + 1, y + r, Math.round(mid) - x0 - 1, r % 3 === 0 ? pal[2] : pal[3]);
    pxRow(g, Math.round(mid), y + r, x1 - Math.round(mid) - 1, r % 3 === 0 ? pal[0] : pal[1]);
  }
  pxRow(g, x - 1, y + h, w + 2, pal[0]);
}

/* A round tower or trunk: cylinder shading across its width */
function pxCylinder(g, x, y, w, h, pal) {
  for (let c = 0; c < w; c++) {
    const f = c / (w - 1);
    const col = c === 0 || c === w - 1 ? pal[0] : f < 0.3 ? pal[3] : f < 0.62 ? pal[2] : pal[1];
    pxFill(g, x + c, y, 1, h, col);
  }
}

/* A cone roof for a round tower */
function pxCone(g, cx, y, w, h, pal) {
  for (let r = 0; r < h; r++) {
    const half = Math.max(0, Math.round((w / 2) * (r / (h - 1))));
    for (let c = -half; c <= half; c++) {
      const f = (c + half) / Math.max(1, half * 2);
      const col = c === -half || c === half ? pal[0] : f < 0.35 ? pal[3] : f < 0.65 ? pal[2] : pal[1];
      pxDot(g, cx + c, y + r, col);
    }
  }
}

/* A window: dark frame, lit glass */
function pxWindow(g, x, y, w = 2, h = 2, lit = "#ffd98a") {
  pxFill(g, x - 1, y - 1, w + 2, h + 2, "#2a1e18");
  pxFill(g, x, y, w, h, lit);
  if (w > 1 && h > 1) pxDot(g, x, y, pxLight(lit, 0.5));
}

/* ----- Shared palettes ----- */
const PX_TRUNK = ["#2a1a10", "#4a3020", "#6a4a2a", "#8a6a3e"];
const PX_STONE = pxRamp("#9a948a");
const PX_DARKSTONE = pxRamp("#5a5560");
const PX_WOOD = pxRamp("#8a5a30");
const PX_GOLD = pxRamp("#e8b23a");
const PX_LEAVES = {
  medieval: pxRamp("#3f8a33"), wizard: pxRamp("#3a6a8a"), harvest: pxRamp("#b8862a"),
  ocean: pxRamp("#2a9a5a"), volcano: pxRamp("#5a3a3a")
};

/* ----- Plants ----- */
function pxTree(g, x, y, s, leaves, o = {}) {
  const th = Math.round(3 + s * 0.7), r = Math.round(2 + s);
  // shadow on the ground, down to the right
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(Math.round(x - r + 2), Math.round(y), r * 2, 2);
  pxFill(g, x - 1, y - th, 2, th, PX_TRUNK[1]);
  pxDot(g, x - 1, y - th, PX_TRUNK[3]);
  pxFill(g, x - 1, y - 1, 1, 1, PX_TRUNK[2]);
  const cy = y - th - Math.round(r * 0.55);
  pxBlob(g, x - Math.round(r * 0.55), cy + 1, Math.round(r * 0.6), Math.round(r * 0.5), leaves, { seed: x + 1 });
  pxBlob(g, x + Math.round(r * 0.55), cy + 1, Math.round(r * 0.6), Math.round(r * 0.5), leaves, { seed: x + 2 });
  pxBlob(g, x, cy - 1, r, Math.round(r * 0.78), leaves, { seed: x + 3, wobble: 0.25 });
  if (o.fruit) for (let k = 0; k < Math.round(s * 1.5); k++) pxDot(g, x - r + 1 + Math.round(cmHash(k, x, 3) * (r * 2 - 2)), cy - r * 0.5 + Math.round(cmHash(k, x, 4) * r), o.fruit);
}

function pxPine(g, x, y, s, leaves) {
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(Math.round(x - 2), Math.round(y), s + 3, 2);
  pxFill(g, x, y - 2, 1, 2, PX_TRUNK[1]);
  const h = s * 2 + 2;
  for (let r = 0; r < h; r++) {
    const tier = r % Math.max(3, Math.round(s * 0.7));
    const half = Math.round((r / h) * s * 0.7 + tier * 0.45);
    for (let c = -half; c <= half; c++) pxDot(g, x + c, y - 2 - h + r, c === -half || c === half ? leaves[0] : c < 0 ? leaves[3] : c < half * 0.5 ? leaves[2] : leaves[1]);
  }
}

function pxBush(g, x, y, s, leaves, berry) {
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.fillRect(Math.round(x - s + 1), Math.round(y), s * 2, 1);
  pxBlob(g, x, y - Math.round(s * 0.6), s, Math.round(s * 0.65), leaves, { seed: x + y, wobble: 0.3 });
  if (berry) { pxDot(g, x - 1, y - s * 0.7, berry); pxDot(g, x + 2, y - s * 0.4, berry); }
}

function pxRock(g, x, y, s, pal = PX_STONE) {
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(Math.round(x - s + 1), Math.round(y), s * 2, 1);
  pxBlob(g, x, y - Math.round(s * 0.5), s, Math.round(s * 0.62), pal, { seed: x * 3 + y, wobble: 0.35, grain: 0.3 });
}

function pxTuft(g, x, y, c) { pxDot(g, x - 1, y - 1, c); pxDot(g, x, y - 2, c); pxDot(g, x + 1, y - 1, c); }

function pxFlower(g, x, y, c) { pxDot(g, x, y - 1, c); pxDot(g, x, y, "#3a7a2a"); }

/* ----- Theme props ----- */
function pxHouse(g, x, y, roof = "#b23a3a", wall = "#e8dcc0") {
  const rp = pxRamp(roof), wp = pxRamp(wall);
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x - 5, y, 13, 2);
  pxWall(g, x - 5, y - 7, 11, 7, wp, { planks: false });
  pxFill(g, x - 5, y - 4, 11, 1, wp[1]);
  pxRoof(g, x - 7, y - 13, 15, 6, rp);
  pxFill(g, x - 1, y - 4, 3, 4, "#4a2e1a"); pxDot(g, x + 1, y - 2, "#c8a04a");
  pxWindow(g, x - 4, y - 6, 2, 2); pxWindow(g, x + 3, y - 6, 2, 2);
  pxFill(g, x + 3, y - 15, 2, 4, PX_STONE[1]); pxDot(g, x + 3, y - 15, PX_STONE[0]);
}

function pxWindmillBase(g, x, y) {
  const wp = pxRamp("#d8ccb0");
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x - 4, y, 11, 2);
  for (let r = 0; r < 16; r++) {
    const half = Math.round(3 + r * 0.2);
    for (let c = -half; c <= half; c++) pxDot(g, x + c, y - 16 + r, c === -half || c === half ? wp[0] : c < -half / 2 ? wp[3] : c < half / 3 ? wp[2] : wp[1]);
  }
  pxCone(g, x, y - 21, 9, 5, pxRamp("#8a3a2a"));
  pxFill(g, x - 1, y - 4, 3, 4, "#4a2e1a");
  pxWindow(g, x, y - 11, 1, 2);
}
function pxWindmillBlades(g, x, y, t) {
  const cx = x, cy = y - 17, a = t * 1.1;
  for (let k = 0; k < 4; k++) {
    const ang = a + k * Math.PI / 2;
    for (let r = 1; r <= 9; r++) {
      const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
      pxDot(g, px, py, "#5a3a20");
      if (r > 2) pxDot(g, px + Math.cos(ang + 1.57) * 1.2, py + Math.sin(ang + 1.57) * 1.2, "#f0e8d8");
    }
  }
  pxDot(g, cx, cy, "#2a1a10");
}

function pxCrystal(g, x, y, s, color) {
  const p = pxRamp(color);
  g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x - s, y, s * 2 + 1, 1);
  const shard = (bx, h, w) => {
    for (let r = 0; r < h; r++) {
      const half = r < 2 ? Math.floor(r / 2 * w) : w;
      for (let c = -half; c <= half; c++) pxDot(g, bx + c, y - h + r, c === -half || c === half ? p[0] : c < 0 ? p[4] : c === 0 ? p[3] : p[1]);
    }
  };
  shard(x - Math.round(s * 0.7), Math.round(s * 1.2), 1);
  shard(x + Math.round(s * 0.6), Math.round(s * 1.4), 1);
  shard(x, Math.round(s * 2.2), Math.max(1, Math.round(s * 0.45)));
}

function pxMushroom(g, x, y, cap) {
  const p = pxRamp(cap);
  pxFill(g, x, y - 3, 1, 3, "#e8e0d0");
  pxRow(g, x - 2, y - 4, 5, p[0]); pxRow(g, x - 1, y - 5, 3, p[2]); pxRow(g, x - 1, y - 4, 3, p[3]);
  pxDot(g, x - 1, y - 5, p[4]); pxDot(g, x + 1, y - 4, "#ffffff");
}

function pxRunestone(g, x, y, glow) {
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x - 2, y, 6, 1);
  pxWall(g, x - 2, y - 8, 5, 8, PX_DARKSTONE);
  pxDot(g, x, y - 6, glow); pxDot(g, x, y - 5, glow); pxDot(g, x - 1, y - 4, glow); pxDot(g, x + 1, y - 3, glow);
}

function pxHaystack(g, x, y) { pxBlob(g, x, y - 3, 5, 3, pxRamp("#e0b850"), { seed: x, grain: 0.35 }); for (let k = 0; k < 3; k++) pxDot(g, x - 3 + k * 3, y - 5 + (k % 2), "#f8e090"); }
function pxPumpkin(g, x, y) { pxBlob(g, x, y - 2, 2, 2, pxRamp("#e8781a"), { seed: x }); pxDot(g, x, y - 5, "#3a7a2a"); }
function pxBeehive(g, x, y) {
  pxFill(g, x, y - 9, 1, 3, PX_TRUNK[1]);
  for (let r = 0; r < 6; r++) { const half = 3 - Math.abs(r - 2.5) * 0.6 | 0; pxRow(g, x - half, y - 7 + r, half * 2 + 1, r % 2 ? "#c08a10" : "#e0a820"); }
  pxDot(g, x, y - 3, "#2a1a08");
}
function pxScarecrow(g, x, y) {
  pxFill(g, x, y - 10, 1, 10, PX_TRUNK[1]); pxRow(g, x - 4, y - 8, 9, PX_TRUNK[1]);
  pxFill(g, x - 2, y - 8, 5, 4, "#4a6aa8"); pxFill(g, x - 1, y - 12, 3, 3, "#e8d090"); pxRow(g, x - 2, y - 13, 5, "#8a5a2a");
}

function pxPalm(g, x, y, s) {
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x - 3, y, 10, 2);
  for (let r = 0; r < s; r++) pxFill(g, x + Math.round(Math.sin(r / s * 1.4) * 2), y - r, 2, 1, r % 2 ? PX_TRUNK[2] : PX_TRUNK[3]);
  const tx = x + Math.round(Math.sin(1.4) * 2), ty = y - s;
  const lp = pxRamp("#2aa85a");
  [[-1, 0.2], [1, 0.2], [-1, -0.5], [1, -0.5], [0, -1]].forEach(([d, up]) => {
    for (let k = 1; k <= 6; k++) { const px = tx + d * k + (d === 0 ? 0 : 0), py = ty + Math.round(k * k * 0.12) - Math.round(up * k * 0.6); pxDot(g, px, py, k > 4 ? lp[1] : lp[2]); pxDot(g, px, py + 1, lp[0]); }
  });
  pxDot(g, tx, ty + 1, "#6a3a1a"); pxDot(g, tx + 1, ty + 1, "#6a3a1a");
}
function pxCoral(g, x, y, color) {
  const p = pxRamp(color);
  const branch = (bx, h, lean) => { for (let r = 0; r < h; r++) pxDot(g, bx + Math.round(lean * r), y - r, r === h - 1 ? p[4] : p[2]); };
  branch(x, 6, 0); branch(x - 2, 4, -0.3); branch(x + 2, 5, 0.3); pxDot(g, x - 1, y - 3, p[3]);
}
function pxShell(g, x, y) { pxRow(g, x - 1, y - 1, 3, "#ffd8c8"); pxDot(g, x, y - 2, "#ffe8e0"); pxDot(g, x - 1, y, "#c87a6a"); pxDot(g, x + 1, y, "#c87a6a"); }

function pxObsidian(g, x, y, s) {
  const p = pxRamp("#3a2a44");
  for (let r = 0; r < s; r++) { const half = Math.round((r / s) * 2); for (let c = -half; c <= half; c++) pxDot(g, x + c, y - s + r, c === -half || c === half ? p[0] : c < 0 ? p[3] : p[1]); }
  pxDot(g, x, y - s + 1, "#c8a0ff");
}
function pxDeadTree(g, x, y) {
  const c = "#2a1e1e";
  pxFill(g, x, y - 9, 1, 9, c); pxDot(g, x - 1, y - 6, c); pxDot(g, x - 2, y - 7, c); pxDot(g, x + 1, y - 5, c); pxDot(g, x + 2, y - 6, c); pxDot(g, x + 3, y - 8, c); pxDot(g, x - 1, y - 9, c);
}

/* ----- The landmarks (bottom-center at x, y) ----- */
function pxCastle(g, x, y) {
  const st = pxRamp("#a8a29a"), rf = pxRamp("#3a5aa8");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 20, y, 44, 3);
  // curtain wall
  pxWall(g, x - 16, y - 13, 32, 13, st, { bricks: true });
  for (let c = x - 16; c < x + 16; c += 3) pxFill(g, c, y - 15, 2, 2, st[2]), pxDot(g, c + 1, y - 15, st[1]);
  // keep
  pxWall(g, x - 7, y - 26, 14, 14, st, { bricks: true });
  for (let c = x - 7; c < x + 7; c += 3) pxFill(g, c, y - 28, 2, 2, st[3]);
  pxWindow(g, x - 3, y - 22, 2, 3); pxWindow(g, x + 2, y - 22, 2, 3);
  // towers
  [-18, 15].forEach(dx => {
    pxCylinder(g, x + dx, y - 22, 6, 22, st);
    pxCone(g, x + dx + 3, y - 31, 8, 9, rf);
    pxWindow(g, x + dx + 2, y - 16, 1, 2);
    pxFill(g, x + dx + 3, y - 36, 1, 5, "#3a2a20");
  });
  // gate
  pxFill(g, x - 3, y - 8, 6, 8, "#2a1a12"); pxRow(g, x - 2, y - 9, 4, "#2a1a12");
  for (let c = x - 2; c <= x + 2; c += 2) pxFill(g, c, y - 8, 1, 7, "#6a5a4a");
}

function pxSpireTower(g, x, y) {
  const st = pxRamp("#6a6aa8"), rf = pxRamp("#5a2a9a");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 8, y, 20, 3);
  pxBlob(g, x, y - 2, 9, 3, PX_DARKSTONE, { seed: 4 });
  pxCylinder(g, x - 5, y - 44, 10, 42, st);
  for (let r = y - 40; r < y - 4; r += 5) pxRow(g, x - 4, r, 8, st[1]);
  pxCylinder(g, x - 6, y - 46, 12, 3, st);
  pxCone(g, x, y - 62, 14, 16, rf);
  pxFill(g, x, y - 67, 1, 5, "#ffd23f");
  [y - 38, y - 28, y - 18].forEach(wy => pxWindow(g, x - 1, wy, 2, 3, "#9fe8ff"));
  pxFill(g, x - 2, y - 8, 4, 6, "#1a1030");
}

function pxBarn(g, x, y) {
  const wp = pxRamp("#a83a2a"), rf = pxRamp("#6a3a2a");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 14, y, 32, 3);
  pxWall(g, x - 14, y - 12, 20, 12, wp, { planks: true });
  pxRoof(g, x - 16, y - 20, 24, 8, rf);
  pxFill(g, x - 7, y - 8, 6, 8, "#3a1a10"); pxRow(g, x - 7, y - 8, 6, "#e8e0c8"); pxDot(g, x - 7, y - 4, "#e8e0c8"); pxDot(g, x - 2, y - 4, "#e8e0c8");
  pxWindow(g, x - 5, y - 16, 2, 2);
  // silo
  pxCylinder(g, x + 8, y - 22, 8, 22, pxRamp("#c8b890"));
  pxBlob(g, x + 11, y - 22, 4, 3, pxRamp("#8a8a90"), { seed: 2 });
  for (let r = y - 18; r < y; r += 4) pxRow(g, x + 9, r, 6, "#a89870");
}

function pxShipwreck(g, x, y) {
  const wp = pxRamp("#7a4a2a");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 18, y, 38, 3);
  for (let r = 0; r < 9; r++) {
    const half = 18 - Math.round(r * r * 0.12);
    const off = Math.round(r * 0.3);
    pxRow(g, x - half + off, y - 9 + r, half * 2 - 2, r === 0 ? wp[3] : r % 3 === 0 ? wp[1] : wp[2]);
    pxDot(g, x - half + off, y - 9 + r, wp[0]); pxDot(g, x + half + off - 3, y - 9 + r, wp[0]);
  }
  pxFill(g, x - 3, y - 6, 5, 4, "#1a0e08");
  [-8, 4].forEach((dx, k) => {
    pxFill(g, x + dx, y - 26 + k * 6, 1, 18 - k * 6, "#5a3a20");
    for (let r = 0; r < 8 - k * 2; r++) pxRow(g, x + dx + 1, y - 24 + k * 6 + r, 6 - Math.abs(r - 3), r % 3 ? "#e8e0c8" : "#c8c0a8");
  });
  pxDot(g, x - 4, y - 18, "#1a0e08"); pxDot(g, x - 3, y - 17, "#1a0e08");
}

function pxVolcano(g, x, y) {
  const p = pxRamp("#4a3036");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 30, y, 64, 3);
  for (let r = 0; r < 34; r++) {
    const half = Math.round(6 + r * 0.82 + (cmHash(r, 5, 61) - 0.5) * 2);
    for (let c = -half; c <= half; c++) {
      const f = (c + half) / (half * 2);
      let col = c === -half || c === half ? p[0] : f < 0.3 ? p[3] : f < 0.6 ? p[2] : p[1];
      if (f > 0.25 && f < 0.6 && ((pxBay(x + c, y + r) > 0.7))) col = p[2];
      pxDot(g, x + c, y - 34 + r, col);
    }
  }
  pxRow(g, x - 6, y - 34, 13, "#ff8a1a"); pxRow(g, x - 5, y - 35, 11, "#ffd23f");
  // lava streams
  [[-2, 12], [4, 18], [-6, 22]].forEach(([dx, len], k) => { for (let r = 0; r < len; r++) pxDot(g, x + dx + Math.round(Math.sin(r * 0.4 + k) * 1.5) + (k === 2 ? -Math.round(r * 0.3) : Math.round(r * 0.25)), y - 33 + r, r < 3 ? "#ffd23f" : "#ff6a1a"); });
}

/* ----- The spots on the path (centered on x, y = where they meet the ground) ----- */
const PX_STONES = { static: pxRamp("#c8b07a"), enemy: pxRamp("#b8644a"), dynamic: pxRamp("#5a78c8") };
const PX_RUNE = { static: "#ffe9a0", enemy: "#ffb070", dynamic: "#9fe8ff" };

function pxPedestal(g, x, y, kind, state, t) {
  const p = state === "locked" ? pxRamp("#7a7a80") : PX_STONES[kind];
  g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(x - 5, y + 1, 12, 2);
  // the drum: a side band and an elliptical top
  for (let c = -5; c <= 5; c++) {
    const f = (c + 5) / 10;
    pxFill(g, x + c, y - 3, 1, 4, c === -5 || c === 5 ? p[0] : f < 0.3 ? p[2] : f < 0.7 ? p[1] : p[0]);
  }
  pxRow(g, x - 4, y + 1, 9, p[0]);
  for (let r = -2; r <= 2; r++) { const half = Math.round(5 * Math.sqrt(1 - (r / 2.6) ** 2)); pxRow(g, x - half, y - 5 + r, half * 2 + 1, r === -2 ? p[4] : r < 0 ? p[3] : p[2]); }
  pxDot(g, x - 5, y - 5, p[0]); pxDot(g, x + 5, y - 5, p[0]);
  if (state === "won") { pxRow(g, x - 4, y - 7, 9, "#ffd23f"); pxRow(g, x - 5, y - 6, 1, "#ffd23f"); pxRow(g, x + 5, y - 6, 1, "#ffd23f"); }
  // the rune carved on top
  const rc = state === "locked" ? "#4a4a50" : PX_RUNE[kind];
  pxDot(g, x - 1, y - 6, rc); pxDot(g, x, y - 5, rc); pxDot(g, x + 1, y - 6, rc); pxDot(g, x, y - 4, rc);
  if (state === "next") pxGlow(g, x, y - 5, 6, PX_RUNE[kind], 0.45 + 0.25 * Math.sin(t * 4));
}

function pxLair(g, x, y, eye, state, t) {
  const p = state === "locked" ? pxRamp("#5a5a60") : pxRamp("#4a3e44");
  g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x - 9, y + 1, 20, 2);
  pxBlob(g, x, y - 6, 10, 7, p, { seed: 13, wobble: 0.35, grain: 0.3 });
  pxBlob(g, x - 6, y - 3, 5, 4, p, { seed: 14, wobble: 0.3 });
  pxBlob(g, x + 7, y - 2, 4, 3, p, { seed: 15, wobble: 0.3 });
  // the cave mouth
  for (let r = 0; r < 7; r++) { const half = Math.round(4 * Math.sqrt(Math.min(1, (r + 1) / 4))); pxRow(g, x - half, y - 7 + r, half * 2 + 1, "#0a0608"); }
  if (state !== "locked") {
    const blink = (t * 0.7 + x) % 3.4 < 0.12;
    pxDot(g, x - 2, y - 4, eye); pxDot(g, x + 2, y - 4, eye);
    if (!blink) { pxDot(g, x - 2, y - 3, eye); pxDot(g, x + 2, y - 3, eye); }
    pxGlow(g, x, y - 4, 5, eye, 0.35);
    // torches either side
    [-9, 9].forEach((dx, k) => {
      pxFill(g, x + dx, y - 6, 1, 6, "#5a3a20");
      const f = Math.sin(t * 12 + k * 2) > 0;
      pxDot(g, x + dx, y - 7, "#ffd23f"); pxDot(g, x + dx, y - 8 - (f ? 1 : 0), "#ff8a1a");
      pxGlow(g, x + dx, y - 8, 5, "#ff9a3a", 0.4);
    });
  }
  // a skull on the doorstep
  pxRow(g, x - 1, y, 3, "#e8e0c8"); pxDot(g, x - 1, y + 1, "#e8e0c8"); pxDot(g, x + 1, y + 1, "#e8e0c8");
  if (state === "won") { pxFill(g, x + 5, y - 16, 1, 8, "#5a3a20"); pxFill(g, x + 6, y - 16, 4, 3, "#ffd23f"); pxDot(g, x + 9, y - 14, "#ffd23f"); }
}

function pxMerchant(g, x, y, accent, t) {
  const ap = pxRamp(accent);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 10, y + 1, 23, 2);
  pxFill(g, x - 9, y - 10, 1, 10, PX_WOOD[0]); pxFill(g, x + 9, y - 10, 1, 10, PX_WOOD[0]);
  // the striped awning, scalloped at the front
  for (let c = -10; c <= 10; c++) {
    const stripe = Math.floor((c + 10) / 3) % 2;
    pxFill(g, x + c, y - 15, 1, 4, stripe ? "#f4f0e8" : ap[2]);
    pxDot(g, x + c, y - 15, stripe ? "#ffffff" : ap[3]);
    if ((c + 10) % 3 !== 2) pxDot(g, x + c, y - 11, stripe ? "#d8d0c8" : ap[1]);
  }
  pxRow(g, x - 10, y - 16, 21, ap[0]);
  // the counter with wares
  pxWall(g, x - 9, y - 5, 19, 5, PX_WOOD, { planks: true });
  pxFill(g, x - 7, y - 7, 2, 2, "#9aa3ad"); pxDot(g, x - 7, y - 7, "#dfe6ee");
  pxFill(g, x - 3, y - 7, 2, 2, "#c8323a");
  pxFill(g, x + 5, y - 7, 3, 2, "#e8b23a"); pxDot(g, x + 5, y - 7, "#fff0a0");
  // a hanging lantern
  pxDot(g, x + 8, y - 10, "#2a1a10"); pxDot(g, x + 8, y - 9, "#ffd23f");
  pxGlow(g, x + 8, y - 9, 4, "#ffcf5a", 0.35 + 0.1 * Math.sin(t * 3));
}

function pxPavilion(g, x, y, accent, t) {
  const ap = pxRamp(accent);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 9, y + 1, 20, 2);
  for (let r = 0; r < 16; r++) {
    const half = Math.round(1 + r * 0.6);
    for (let c = -half; c <= half; c++) {
      const stripe = Math.floor((c + 20) / 2) % 2;
      pxDot(g, x + c, y - 16 + r, c === -half || c === half ? ap[0] : stripe ? ap[2] : (c < 0 ? "#f4f0e8" : "#d8d0c8"));
    }
  }
  pxFill(g, x - 2, y - 6, 5, 6, "#2a1a20");
  pxFill(g, x, y - 21, 1, 5, PX_WOOD[0]);
  const flap = Math.round(Math.sin(t * 5) * 1);
  pxRow(g, x + 1, y - 21, 4, "#ffd23f"); pxRow(g, x + 1, y - 20 + flap, 3, "#ffd23f");
  // a shield on a post
  pxFill(g, x + 10, y - 9, 1, 9, PX_WOOD[0]);
  pxFill(g, x + 8, y - 11, 5, 5, "#c8c8d0"); pxFill(g, x + 9, y - 10, 3, 3, ap[2]); pxDot(g, x + 10, y - 6, "#c8c8d0");
}

function pxVault(g, x, y, t) {
  const st = pxRamp("#e0d8c8");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 10, y + 1, 23, 2);
  pxWall(g, x - 10, y - 3, 21, 3, st);
  [-8, -3, 2, 7].forEach(dx => pxCylinder(g, x + dx, y - 12, 3, 9, st));
  pxWall(g, x - 11, y - 15, 23, 3, st);
  pxRoof(g, x - 10, y - 21, 21, 6, st);
  pxBlob(g, x, y - 23, 4, 3, PX_GOLD, { seed: 3 });
  pxFill(g, x - 1, y - 11, 3, 8, "#3a2a18");
  // a coin turning on the roof
  const cw = Math.max(1, Math.round(4 * Math.abs(Math.cos(t * 1.6))));
  pxFill(g, x - Math.floor(cw / 2), y - 31, cw, 5, "#ffd23f");
  if (cw > 2) pxDot(g, x, y - 29, "#a87a10");
  pxGlow(g, x, y - 29, 4, "#ffd23f", 0.3);
}

function pxGate(g, x, y, open, t) {
  const st = open ? pxRamp("#9a90a8") : pxRamp("#6a6a70");
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - 8, y + 1, 18, 2);
  pxWall(g, x - 8, y - 14, 4, 14, st); pxWall(g, x + 5, y - 14, 4, 14, st);
  for (let c = -8; c <= 8; c++) { const r = Math.round(Math.sqrt(Math.max(0, 64 - c * c)) * 0.6); pxFill(g, x + c, y - 15 - r, 1, 3, c < 0 ? st[3] : st[1]); pxDot(g, x + c, y - 16 - r, st[0]); }
  // runes on the pillars
  const rc = open ? "#b8f0ff" : "#3a3a44";
  [y - 11, y - 7, y - 3].forEach(ry => { pxDot(g, x - 6, ry, rc); pxDot(g, x + 7, ry, rc); });
  if (open) {
    // the portal shimmers
    for (let r = 0; r < 13; r++) for (let c = -3; c <= 4; c++) {
      const v = Math.sin(c * 0.9 + r * 0.6 - t * 4) * 0.5 + 0.5;
      if (v > pxBay(x + c, y + r)) pxDot(g, x + c, y - 14 + r, v > 0.8 ? "#ffffff" : v > 0.5 ? "#b8f0ff" : "#6ac8ff");
    }
    pxGlow(g, x, y - 8, 9, "#8ad8ff", 0.4 + 0.15 * Math.sin(t * 2));
  }
}

/* A shopkeeper leaning out to say hello */
function pxKeeper(g, x, y, look, t) {
  const bp = pxRamp(look.body);
  const bob = Math.round(Math.sin(t * 2 + x) * 0.6);
  y += bob;
  pxFill(g, x - 1, y - 2, 3, 4, bp[2]); pxDot(g, x - 1, y - 2, bp[3]);
  pxFill(g, x - 2, y - 6, 5, 4, bp[2]); pxRow(g, x - 2, y - 6, 5, bp[3]); pxRow(g, x - 2, y - 3, 5, bp[1]);
  pxDot(g, x - 1, y - 5, look.eye || "#ffd23f"); pxDot(g, x + 1, y - 5, look.eye || "#ffd23f");
  if ((t + x) % 4 < 0.3) pxDot(g, x, y - 2, "#ff3b5a");
  const hat = { helm: "#9aa3ad", wizard: "#3a3aa8", chef: "#ffffff", tophat: "#1a1a20", tricorn: "#1a1a20", crown: "#ffd23f", hood: pxDark(look.body, 0.4), fez: "#c8323a", beret: "#3a5a2a", straw: "#e8c870", shell: "#ffc8b8", horns: "#2a2028", hennin: "#c8508a" }[look.hat];
  if (!hat) return;
  pxRow(g, x - 2, y - 7, 5, hat);
  if (["wizard", "hennin"].includes(look.hat)) { pxRow(g, x - 1, y - 8, 3, hat); pxDot(g, x, y - 9, hat); pxDot(g, x + 1, y - 10, hat); }
  else if (["tophat", "chef", "crown", "fez"].includes(look.hat)) pxRow(g, x - 1, y - 8, 3, hat);
  else if (look.hat === "horns") { pxDot(g, x - 2, y - 8, hat); pxDot(g, x + 2, y - 8, hat); }
  else if (look.hat === "straw" || look.hat === "tricorn") pxRow(g, x - 3, y - 7, 7, hat);
}

/* ----- Clouds: puffy, shaded from above, cached in a few sizes and three lights ----- */
const PX_CLOUDS = { day: ["#c4cfe2", "#dce4f0", "#eef3fa", "#ffffff", "#ffffff"], dusk: ["#b88aa8", "#d8a8bc", "#f0c8d0", "#ffe4e4", "#fff4f0"], night: ["#3a3a6e", "#4a4a84", "#5e5e9a", "#7a7ab4", "#9a9acc"] };
const pxCloudCache = new Map();
function pxCloudArt(w, seed, light) {
  const key = w + ":" + seed + ":" + light;
  if (pxCloudCache.has(key)) return pxCloudCache.get(key);
  const h = Math.round(w * 0.45);
  const c = document.createElement("canvas");
  c.width = w + 4; c.height = h + 4;
  // (puffs are kept inside the canvas, so tops stay round)
  const g = c.getContext("2d");
  const pal = PX_CLOUDS[light];
  const n = 4 + Math.round(cmHash(seed, w, 1) * 3);
  // a soft flat base, with round puffs heaped on top: the middle ones biggest
  const puffs = [];
  for (let k = 0; k < n; k++) {
    const f = (k + 0.5) / n;
    const r = Math.max(3, Math.round(h * (0.26 + 0.22 * Math.sin(f * Math.PI)) * (0.8 + cmHash(k, seed, 2) * 0.35)));
    puffs.push([2 + r + Math.round(f * (w - r * 2)), Math.max(r + 1, h + 1 - Math.round(r * 0.8) - Math.round(cmHash(k, seed, 5) * h * 0.1)), r]);
  }
  const bx = w / 2 + 2, brx = w / 2 - 1, bry = Math.max(2, h * 0.22), by = h + 1 - bry;
  const inside = (x, y) => ((x - bx) / brx) ** 2 + ((y - by) / bry) ** 2 <= 1 || puffs.some(([px, py, r]) => (x - px) ** 2 + ((y - py) * 1.15) ** 2 <= r * r);
  for (let y = 0; y < h + 4; y++) for (let x = 0; x < w + 4; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x, y - 1) || !inside(x, y + 1) || !inside(x - 1, y) || !inside(x + 1, y);
    const v = 1 - y / (h + 2) + (cmHash(x, y, seed) - 0.5) * 0.15;
    const k = edge && y > h * 0.6 ? 0 : Math.max(1, Math.min(4, Math.floor(v * 4 + pxBay(x, y) * 0.9)));
    g.fillStyle = pal[k];
    g.fillRect(x, y, 1, 1);
  }
  pxCloudCache.set(key, c);
  return c;
}
