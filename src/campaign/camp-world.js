/* =========================================================
   src/campaign/camp-world.js
   Painting the world map: the sky, the clouds, the five islands, the
   spots on their paths, the home trees, and the Coil. The camera, input
   and the details card are in src/campaign/camp-map.js; the toolkit and
   the sprites are in src/campaign/camp-sprites.js.

   Each island is one landmass, painted once into its own canvas: its
   coastline is a handful of soft blobs melted together, its paths are
   worn into the grass, and its underside hangs in ragged points of rock.
   Then it takes the light of its height in the sky, from the warm
   sunrise at the bottom to the blue night at the top, and only the
   things that glow (windows, crystals, lava, runes) shine through.
   ========================================================= */
"use strict";

/* ----- Each theme's colors ----- */
const CW_THEME = {
  medieval: {
    ground: ["#2f6a2a", "#3f8a33", "#55a03c", "#74b84a"], rim: "#a8dc78", lip: "#1e4a1a",
    path: ["#6a4a26", "#8a6a3a", "#b08a50", "#c8a468"], dirt: ["#5a3a1e", "#7a5232", "#8a6440"],
    rock: ["#6c482b", "#7a5232", "#5e4a3a", "#4e4038", "#4c4a50", "#3e3c44"], gem: "#ffd23f",
    flowers: ["#ffffff", "#ffe066", "#ff8ac8", "#ff6b6b"], tuft: "#8ac85a"
  },
  wizard: {
    ground: ["#26365e", "#2e4672", "#385a86", "#4e7a9c"], rim: "#9ad0e0", lip: "#141e3a",
    path: ["#3a3456", "#544a76", "#6e6496", "#8a80b0"], dirt: ["#2e2448", "#41365e", "#544872"],
    rock: ["#4a3d6a", "#5a4a7a", "#3a3050", "#463a5e", "#302a3c", "#262032"], gem: "#b8f0ff",
    flowers: ["#b8f0ff", "#e8b8ff", "#ffffff", "#9fe8ff"], tuft: "#6aa8c0"
  },
  harvest: {
    ground: ["#7a5a1e", "#9a7426", "#b88e30", "#d4ac44"], rim: "#f4d880", lip: "#4a3612",
    path: ["#5a3a1e", "#7a5232", "#9a7044", "#b48a58"], dirt: ["#4a2e16", "#6a4422", "#7a5430"],
    rock: ["#7a4e2b", "#8a5a32", "#5a3e2a", "#6a4a32", "#4a3e36", "#3a302a"], gem: "#ffb04a",
    flowers: ["#ff6a3a", "#ffe066", "#ffffff", "#c84a6a"], tuft: "#e8c060"
  },
  ocean: {
    ground: ["#c0a068", "#d4b47a", "#e4c88c", "#f2deaa"], rim: "#fff6d8", lip: "#8a6a44",
    path: ["#6a4a2a", "#8a6440", "#a07a50", "#b89064"], dirt: ["#8a6a44", "#a08050", "#b4946a"],
    rock: ["#b88e6a", "#c8a07a", "#8a6a62", "#a07a68", "#5a5a6a", "#4a4a5a"], gem: "#7affe0",
    flowers: ["#ff9aa8", "#ffffff", "#7affe0", "#ffd23f"], tuft: "#5ab868", grass: ["#3a9a4a", "#4ab05a", "#5cc46a"]
  },
  volcano: {
    ground: ["#221a20", "#2e242a", "#3c3036", "#4e3e44"], rim: "#7a6064", lip: "#0e0a0c",
    path: ["#3a1a12", "#5a2a18", "#7a3a20", "#a04a26"], dirt: ["#1e1418", "#2a1e22", "#3a2a2e"],
    rock: ["#2e2222", "#3a2a2a", "#221a20", "#2a2026", "#181418", "#1e181c"], gem: "#ff6a1a",
    flowers: ["#ff6a1a", "#ffd23f", "#ff9a3a", "#ff3b1a"], tuft: "#5a4a4e"
  }
};

/* The light each island sits in: sunrise, day, dusk, twilight, night */
const CW_LIGHT = [["#ffb070", 0.12], ["#fff0d8", 0.04], ["#ff8aa8", 0.14], ["#6a4ab0", 0.24], ["#14205a", 0.36]];

/* ----- Value noise ----- */
function cwNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = cmHash(xi, yi, s), b = cmHash(xi + 1, yi, s), c = cmHash(xi, yi + 1, s), d = cmHash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const cwFbm = (x, y, s) => cwNoise(x, y, s) * 0.6 + cwNoise(x * 2.1, y * 2.1, s + 1) * 0.3 + cwNoise(x * 4.3, y * 4.3, s + 2) * 0.1;

/* ----- One island, painted once ----- */
const CW_W = 560, CW_H = 430, CW_OX = 280, CW_OY = 130;     // canvas size, and where the island's middle sits in it
const cwArt = new Map();

function cwIsland(isl, i) {
  const fog = !campIslandOpen(isl.id);
  const key = isl.id + (fog ? ":fog" : ":on");
  if (cwArt.has(key)) return cwArt.get(key);
  let art = cwArt.get(isl.id + ":base");
  if (!art) { art = cwPaintIsland(isl, i); cwArt.set(isl.id + ":base", art); }
  if (fog) {
    const c = document.createElement("canvas");
    c.width = CW_W; c.height = CW_H;
    const g = c.getContext("2d");
    g.filter = "grayscale(1) brightness(1.35) contrast(0.7)";
    g.drawImage(art.canvas, 0, 0);
    g.filter = "none";
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(200,212,232,0.35)";
    g.fillRect(0, 0, CW_W, CW_H);
    art = Object.assign({}, art, { canvas: c, lights: [] });
  }
  cwArt.set(key, art);
  return art;
}

function cwPaintIsland(isl, idx) {
  const T = CW_THEME[isl.theme];
  const seed = 101 + idx * 977;
  const c = document.createElement("canvas");
  c.width = CW_W; c.height = CW_H;
  const g = c.getContext("2d");
  const W = CW_W, H = CW_H, OX = CW_OX, OY = CW_OY;
  const lights = [], falls = [];

  // the top: soft blobs, melted together, with a ragged edge
  const mask = new Uint8Array(W * H);
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lx = x - OX, ly = y - OY;
    let f = 0;
    for (const [bx, by, a, b] of CM_LOBES) { const d = 1 - ((lx - bx) / a) ** 2 - ((ly - by) / b) ** 2; if (d > 0) f += d; }
    if (f > 0.08 + (cwFbm(x * 0.05, y * 0.08, seed) - 0.5) * 0.14) mask[y * W + x] = 1;
  }
  // close the bays: grow the land, then shrink it back, so the lobes melt into one solid mass
  const morph = (grow, r) => {
    const tmp = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let d = -r; d <= r && v === (grow ? 0 : 1); d++) { const xx = x + d; const m = xx >= 0 && xx < W ? mask[y * W + xx] : 0; if (grow ? m : !m) v = grow ? 1 : 0; }
      tmp[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let d = -r; d <= r && v === (grow ? 0 : 1); d++) { const yy = y + d; const m = yy >= 0 && yy < H ? tmp[yy * W + x] : 0; if (grow ? m : !m) v = grow ? 1 : 0; }
      mask[y * W + x] = v;
    }
  };
  morph(true, 14);
  morph(false, 14);
  // round off the corners the square fill left: blur the land and keep what's more than half solid
  for (let pass = 0; pass < 2; pass++) {
    const S = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += mask[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    const r = 6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      const sum = S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
      mask[y * W + x] = sum / ((x1 - x0) * (y1 - y0)) > 0.5 ? 1 : 0;
    }
  }
  // every path and spot is on solid ground
  const paths = CM_EDGES.map(([a, b]) => cmLocalPath(isl.id, a, b).map(p => ({ x: Math.round(p.x - CM_CENTERS[idx][0] + OX), y: Math.round(p.y - CM_CENTERS[idx][1] + OY) })));
  const stamp = (cx, cy, r) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y * 2 <= r * r && cx + x >= 0 && cy + y >= 0 && cx + x < W && cy + y < H) mask[(cy + y) * W + cx + x] = 1; };
  paths.forEach(pts => pts.forEach(p => stamp(p.x, p.y, 7)));
  Object.values(CM_NODES).forEach(([x, y]) => stamp(OX + x, OY + y, 13));
  Object.values(CM_FEATURE).forEach(([x, y]) => stamp(OX + x, OY + y, 16));
  // one landmass: keep only what's joined to the middle
  {
    const keep = new Uint8Array(W * H);
    const q = [OY * W + OX];
    keep[q[0]] = 1;
    while (q.length) {
      const k = q.pop(), x = k % W, y = (k - x) / W;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = (y + dy) * W + x + dx; if (at(x + dx, y + dy) && !keep[n]) { keep[n] = 1; q.push(n); } });
    }
    mask.set(keep);
  }
  // how far each top pixel is from the edge (up to 4)
  const dist = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y)) dist[y * W + x] = 9;
  for (let pass = 1; pass <= 4; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (dist[k] !== 9) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = at(x + dx, y + dy) ? dist[(y + dy) * W + x + dx] : 0; return v === pass - 1 || !at(x + dx, y + dy); });
    if (n) dist[k] = pass;
  }

  // ---- the underside: rock hanging in ragged points ----
  const R = T.rock;
  let minX = W, maxX = 0;
  const ymax = new Int16Array(W).fill(-1), cnt = new Int16Array(W);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (at(x, y)) { ymax[x] = y; cnt[x]++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const midX = (minX + maxX) / 2, halfW = (maxX - minX) / 2;
  const depthAt = x => {
    if (ymax[x] < 0) return 0;
    const e = Math.abs(x - midX) / halfW;
    let d = 128 * Math.pow(Math.max(0, 1 - e * e), 0.8) * (0.7 + 0.3 * cwNoise(x * 0.03, 3, seed + 4));
    d *= Math.min(1, cnt[x] / 60 + 0.25);
    // a few long hanging points, each one tapering
    const sp = cwNoise(x * 0.09, 7, seed + 5);
    if (sp > 0.58) d += Math.pow((sp - 0.58) / 0.42, 1.6) * 60;
    d += (cwNoise(x * 0.5, 9, seed + 6) - 0.5) * 5;
    return Math.max(4, d);
  };
  const depth = new Float32Array(W);
  for (let x = 0; x < W; x++) depth[x] = depthAt(x);
  {
    const bottom = Array.from({ length: W }, (_, x) => (ymax[x] < 0 ? -1 : ymax[x] + depth[x]));
    for (let x = minX; x <= maxX; x++) {
      if (ymax[x] < 0) continue;
      let l = -1, r = -1;
      for (let d = 1; d <= 18; d++) { if (x - d >= 0) l = Math.max(l, bottom[x - d]); if (x + d < W) r = Math.max(r, bottom[x + d]); }
      const fill = Math.min(l, r) - 4;
      if (fill > bottom[x]) depth[x] = fill - ymax[x];
    }
  }
  for (let x = minX; x <= maxX; x++) {
    if (ymax[x] < 0) continue;
    const top = ymax[x] + 1, d = depth[x];
    const slope = (depth[Math.min(W - 1, x + 2)] - depth[Math.max(0, x - 2)]);
    for (let r = 0; r <= d; r++) {
      const y = top + r;
      if (y >= H) break;
      let col;
      if (r < 2) col = T.lip;
      else if (r < 7) col = T.dirt[r < 4 ? 0 : (cmHash(x, r, seed) > 0.5 ? 1 : 2)];
      else {
        const k = (r - 7) / Math.max(8, d - 7) + (cwNoise(x * 0.2, r * 0.1, seed + 8) - 0.5) * 0.25;
        const band = k < 0.33 ? 0 : k < 0.66 ? 2 : 4;
        const th = (k * 3) % 1;
        col = th > pxBay(x, y) * 0.8 + 0.1 ? R[band + 1] : R[band];
        if (cwNoise(x * 0.08, r * 0.45, seed + 9) > 0.78) col = R[Math.min(5, band + 1)];      // seams in the rock
        // light from the left: faces turning left are lit, faces turning right in shadow
        if (slope > 1.5 && r > d * 0.25) col = pxDark(col, 0.28);
        else if (slope < -1.5 && r > d * 0.25) col = pxLight(col, 0.14);
        if (x - minX < 6 || x > maxX - 4) col = x - minX < 6 ? pxLight(col, 0.1) : pxDark(col, 0.3);
      }
      if (r >= d - 1.2) col = "#140e10";
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
    // glowing gems in the rock
    if (cmHash(x, 1, seed + 11) > 0.965 && d > 30) {
      const gy = top + 12 + Math.floor(cmHash(x, 2, seed) * (d - 24));
      pxDot(g, x, gy, T.gem); pxDot(g, x, gy - 1, pxLight(T.gem, 0.5)); pxDot(g, x + 1, gy, pxDark(T.gem, 0.3));
      lights.push({ x, y: gy, r: 4, c: T.gem, a: 0.35 });
    }
    // roots and vines hanging off the lip
    if (cmHash(x, 3, seed + 12) > 0.93) {
      const len = 4 + Math.floor(cmHash(x, 4, seed) * 14);
      for (let r = 0; r < len; r++) pxDot(g, x + (r > len / 2 && cmHash(x, 5, seed) > 0.5 ? 1 : 0), top + 2 + r, r === len - 1 ? T.tuft : r % 3 ? "#3a2614" : "#4a3020");
    }
  }
  // inside a bay, the cliff face behind drops all the way down to the land in front of it
  for (let x = minX; x <= maxX; x++) {
    for (let y = 1; y < (ymax[x] || 0); y++) {
      if (!at(x, y) || at(x, y + 1)) continue;
      let yy = y + 1, r = 0;
      while (yy < H && !at(x, yy)) {
        let col = r < 2 ? T.lip : r < 6 ? T.dirt[(r + x) % 3] : R[(cwNoise(x * 0.2, yy * 0.15, seed + 13) > 0.5 ? 1 : 0) + (r > 18 ? 2 : 0)];
        if (r >= 6 && cmHash(x, yy, seed + 14) > 0.9) col = R[3];
        g.fillStyle = col;
        g.fillRect(x, yy, 1, 1);
        yy++; r++;
      }
    }
  }
  // waterfalls (in the islands that have water) pour off the front edge
  if (isl.theme === "volcano") {
    [[-70], [96]].forEach(([dx]) => {
      const x = Math.round(OX + dx);
      if (ymax[x] > 0) { falls.push({ x, y: ymax[x] + 1, len: Math.round(depth[x] + 30), c: "#ff6a1a", lava: true }); lights.push({ x, y: ymax[x] + 6, r: 8, c: "#ff6a1a", a: 0.4 }); }
    });
  }
  if (["medieval", "wizard", "ocean"].includes(isl.theme)) {
    [[-92, 0], [70, 1]].forEach(([dx]) => {
      const x = Math.round(OX + dx);
      if (ymax[x] > 0) falls.push({ x, y: ymax[x] + 1, len: Math.round(depth[x] + 40), c: isl.theme === "wizard" ? "#9fe8ff" : "#cfeaff" });
    });
  }

  // ---- the top: grass (or sand, or ash), worn paths, flowers ----
  const G = T.ground;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    const k = y * W + x, d = dist[k];
    let v = cwFbm(x * 0.045, y * 0.07, seed + 20) * 0.75 + cwNoise(x * 0.4, y * 0.5, seed + 21) * 0.25;
    if (!at(x, y - 1) || (d <= 2 && !at(x, y - 3))) v += 0.35;              // the far rim catches the light
    if (d <= 3 && !at(x, y + 3)) v -= 0.18 * (4 - d);                       // the near edge falls into shade
    let col = G[Math.max(0, Math.min(3, Math.floor(v * 4 + pxBay(x, y) - 0.5)))];
    if (T.grass) {                                                             // islands of grass on the sand
      const gv = cwFbm(x * 0.03, y * 0.05, seed + 40);
      if (gv > 0.58) col = T.grass[Math.max(0, Math.min(2, Math.floor((gv - 0.58) * 14 + pxBay(x, y))))];
    }
    if (!at(x, y - 1)) col = T.rim;
    if (!at(x, y + 1)) col = T.lip;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }
  // the volcano island is cracked with glowing seams
  if (isl.theme === "volcano") {
    // pale ash drifts
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!at(x, y) || dist[y * W + x] < 2) continue;
      const v = cwFbm(x * 0.04, y * 0.06, seed + 90);
      if (v > 0.6 && v - 0.6 > pxBay(x, y) * 0.2) pxDot(g, x, y, v > 0.68 ? "#6a5a5e" : "#544548");
    }
    for (let n = 0; n < 18; n++) {
      let x = OX - 170 + cmHash(n, 1, seed) * 340, y = OY - 50 + cmHash(n, 2, seed) * 110;
      let a = cmHash(n, 3, seed) * 6.28;
      for (let s = 0; s < 34; s++) {
        a += (cmHash(n, s, seed + 3) - 0.5) * 0.9;
        x += Math.cos(a); y += Math.sin(a) * 0.6;
        if (!at(Math.round(x), Math.round(y)) || dist[Math.round(y) * W + Math.round(x)] < 3) break;
        pxDot(g, x, y, s % 4 ? "#ff6a1a" : "#ffb030");
        if (s % 6 === 0) lights.push({ x: Math.round(x), y: Math.round(y), r: 3, c: "#ff6a1a", a: 0.3 });
      }
    }
  }
  // worn paths
  const P = T.path;
  const pathMask = new Uint8Array(W * H);
  paths.forEach(pts => pts.forEach(p => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const r2 = dx * dx + dy * dy * 1.6;
      if (r2 > 5) continue;
      const x = p.x + dx, y = p.y + dy;
      if (!at(x, y)) continue;
      const k = y * W + x;
      pathMask[k] = Math.max(pathMask[k], r2 <= 1.5 ? 3 : r2 <= 3 ? 2 : 1);
    }
  }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = pathMask[y * W + x];
    if (!m || !at(x, y)) continue;
    if (m === 1 && pxBay(x, y) > 0.5) continue;                              // a dithered edge into the grass
    let col = m === 1 ? P[0] : m === 2 ? P[1] : (cmHash(x, y, seed + 30) > 0.8 ? P[3] : P[2]);
    if (m === 3 && cmHash(x, y, seed + 31) > 0.93) col = P[0];               // pebbles
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }

  // ---- what grows and stands on it ----
  const L = (x, y) => [OX + x, OY + y];
  const blocked = (x, y, r) => {
    for (const [k, [nx, ny]] of Object.entries(CM_NODES)) if (Math.hypot(OX + nx - x, (OY + ny - y) * 1.5) < r + (k === "home" ? 40 : 14)) return true;
    for (const [fx, fy] of Object.values(CM_FEATURE)) if (Math.hypot(OX + fx - x, (OY + fy - y) * 1.5) < r + 26) return true;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -r; dx <= r; dx += 2) if (pathMask[(y + dy) * W + x + dx]) return true;
    return !at(x, y) || dist[y * W + x] < 4 || !at(x - r, y) || !at(x + r, y);
  };
  // the pool, field or lagoon
  cwFeature(g, isl, ...L(...CM_FEATURE.pool), T, lights, seed);
  // grass details
  for (let n = 0; n < 900; n++) {
    const x = Math.floor(OX - 250 + cmHash(n, 1, seed + 50) * 500), y = Math.floor(OY - 110 + cmHash(n, 2, seed + 50) * 220);
    if (!at(x, y) || dist[y * W + x] < 3 || pathMask[y * W + x]) continue;
    const r = cmHash(n, 3, seed + 50);
    if (r < 0.55) pxTuft(g, x, y, T.tuft);
    else if (r < 0.75) pxFlower(g, x, y, T.flowers[n % T.flowers.length]);
    else if (r < 0.8 && isl.theme === "ocean") pxShell(g, x, y);
  }
  // scattered props, sorted back to front
  const props = [];
  for (let n = 0; n < 1400 && props.length < (isl.theme === "volcano" ? 64 : 48); n++) {
    const x = Math.floor(OX - 240 + cmHash(n, 1, seed + 60) * 480), y = Math.floor(OY - 100 + cmHash(n, 2, seed + 60) * 200);
    if (blocked(x, y, 6) || props.some(p => Math.hypot(p[0] - x, (p[1] - y) * 1.5) < 13)) continue;
    props.push([x, y, cmHash(n, 3, seed + 60)]);
  }
  // the grove and the landmark join the sorting, so near things overlap far ones
  const grove = [];
  const [gx, gy] = L(...CM_FEATURE.grove);
  for (let n = 0; n < 7; n++) grove.push([gx - 22 + (n % 4) * 14 + (n > 3 ? 7 : 0), gy - 8 + (n > 3 ? 12 : 0) + Math.round(cmHash(n, 1, seed) * 3), "grove", n]);
  const items = props.map(p => [p[0], p[1], "prop", p[2]]).concat(grove, [[...L(...CM_FEATURE.landmark), "landmark"]]);
  items.sort((a, b) => a[1] - b[1]).forEach(([x, y, kind, r]) => {
    if (kind === "landmark") cwLandmark(g, isl, x, y + 10, lights);
    else if (kind === "grove") cwGroveTree(g, isl, x, y, r);
    else cwProp(g, isl, x, y, r, lights);
  });

  // ---- the light of its height in the sky ----
  const [tint, a] = CW_LIGHT[idx];
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = tint;
  g.globalAlpha = a;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  return { canvas: c, lights, falls };
}

/* The water (or wheat, or lava) in the island's corner */
function cwFeature(g, isl, x, y, T, lights, seed) {
  const pool = (rx, ry, pal, shore) => {
    for (let dy = -ry - 2; dy <= ry + 2; dy++) for (let dx = -rx - 3; dx <= rx + 3; dx++) {
      const d = (dx / (rx + 0.5)) ** 2 + (dy / (ry + 0.5)) ** 2 + (cwNoise((x + dx) * 0.3, (y + dy) * 0.3, seed + 70) - 0.5) * 0.3;
      if (d > 1.32) continue;
      let col;
      if (d > 1) col = shore[d > 1.18 ? 0 : 1];
      else {
        const v = (dy + ry) / (ry * 2) * 0.7 + (1 - d) * 0.3;
        col = pal[Math.max(0, Math.min(3, Math.floor(v * 3.6 + pxBay(x + dx, y + dy) - 0.5)))];
        if (dy < -ry * 0.6 && d < 0.9) col = pal[0];                          // the far bank's shadow on the water
      }
      pxDot(g, x + dx, y + dy, col);
    }
  };
  if (isl.theme === "medieval") {
    pool(22, 10, ["#2a5a8a", "#3a78a8", "#4a90c0", "#6ab0d8"], ["#5a4a2a", "#c8b080"]);
    [[-10, -2], [6, 3], [12, -4]].forEach(([dx, dy]) => { pxRow(g, x + dx, y + dy, 3, "#3a8a3a"); pxDot(g, x + dx + 1, y + dy - 1, "#5ab04a"); });
    pxDot(g, x + 6, y + 2, "#ff8ac8");
    for (let k = 0; k < 5; k++) { pxFill(g, x - 26 + k, y - 1 - (k % 2) * 2, 1, 3 + (k % 2) * 2, "#4a7a2a"); pxDot(g, x - 26 + k, y - 3 - (k % 2) * 2, "#7a5a2a"); }
  } else if (isl.theme === "wizard") {
    pool(20, 9, ["#2a6a9a", "#3a9ac8", "#6ad0f0", "#b8f4ff"], ["#2a2448", "#6a5a8a"]);
    lights.push({ x, y, r: 16, c: "#7fe3ff", a: 0.35 });
    [[-26, -2], [24, -3], [-14, 10], [16, 10]].forEach(([dx, dy]) => pxRunestone(g, x + dx, y + dy, "#9fe8ff"));
  } else if (isl.theme === "harvest") {
    for (let dy = -9; dy <= 9; dy++) for (let dx = -24; dx <= 24; dx++) {
      if ((dx / 25) ** 2 + (dy / 10) ** 2 > 1) continue;
      const row = (dy + 20) % 3;
      pxDot(g, x + dx, y + dy, row === 0 ? "#8a6a1a" : (dx + dy) % 4 === 0 ? "#fff0a0" : row === 1 ? "#e8c050" : "#d4a838");
    }
    pxScarecrow(g, x + 4, y + 2);
  } else if (isl.theme === "ocean") {
    pool(24, 11, ["#1a7a9a", "#2aa8b8", "#4ad0d0", "#9af0e8"], ["#d4b47a", "#f2e2b0"]);
    pxPalm(g, x - 22, y - 4, 14);
    pxCoral(g, x + 8, y + 2, "#ff7a8a");
  } else {
    pool(20, 9, ["#c8301a", "#ff6a1a", "#ffa030", "#ffe070"], ["#140c0e", "#3a2224"]);
    lights.push({ x, y, r: 18, c: "#ff6a1a", a: 0.45 });
    pxObsidian(g, x - 24, y + 2, 9); pxObsidian(g, x + 22, y - 2, 7);
  }
}

function cwGroveTree(g, isl, x, y, n) {
  const T = isl.theme;
  if (T === "medieval") (n % 3 === 1 ? pxPine(g, x, y, 5, pxRamp("#2f6a3a")) : pxTree(g, x, y, 5 + (n % 2), PX_LEAVES.medieval, { fruit: n % 3 === 0 ? "#ff3b3b" : null }));
  else if (T === "wizard") (n % 2 ? pxCrystal(g, x, y, 4 + (n % 3), "#9a7ae0") : pxTree(g, x, y, 5, pxRamp("#3a5a9a"), { fruit: "#b8f0ff" }));
  else if (T === "harvest") pxTree(g, x, y, 5, pxRamp(["#c8682a", "#b88a2a", "#a84a2a"][n % 3]), { fruit: n % 2 ? "#ff3b3b" : "#ffd23f" });
  else if (T === "ocean") (n % 2 ? pxPalm(g, x, y, 12 + (n % 3) * 2) : pxBush(g, x, y, 4, pxRamp("#2a9a5a"), "#ff7a8a"));
  else (n % 2 ? pxObsidian(g, x, y, 7 + (n % 3) * 2) : pxDeadTree(g, x, y));
}

function cwProp(g, isl, x, y, r, lights) {
  const T = isl.theme;
  if (T === "medieval") {
    if (r < 0.34) pxTree(g, x, y, 4 + Math.round(r * 6), PX_LEAVES.medieval, { fruit: r < 0.12 ? "#ff3b3b" : null });
    else if (r < 0.5) pxBush(g, x, y, 3, pxRamp("#3a7a2e"), r < 0.42 ? "#ff6b6b" : null);
    else if (r < 0.64) { pxHouse(g, x, y, ["#b23a3a", "#3a5aa8", "#8a5a2a"][Math.floor(r * 30) % 3]); lights.push({ x: x - 3, y: y - 5, r: 4, c: "#ffcf5a", a: 0.25 }, { x: x + 4, y: y - 5, r: 4, c: "#ffcf5a", a: 0.25 }); }
    else if (r < 0.72) pxRock(g, x, y, 3);
    else if (r < 0.8) { pxFill(g, x, y - 9, 1, 9, PX_WOOD[0]); pxFill(g, x + 1, y - 9, 4, 3, r < 0.76 ? "#d9b44a" : "#c8323a"); }
    else if (r < 0.86 && cwWindmills.filter(m => m.isl === isl.id).length < 2) { pxWindmillBase(g, x, y); cwWindmills.push({ isl: isl.id, x, y }); }
    else pxPine(g, x, y, 4, pxRamp("#2f6a3a"));
  } else if (T === "wizard") {
    if (r < 0.3) { pxCrystal(g, x, y, 3 + Math.round(r * 8), ["#9a7ae0", "#6ac8f0", "#e07ac8"][Math.floor(r * 40) % 3]); lights.push({ x, y: y - 4, r: 6, c: "#b8a0ff", a: 0.3 }); }
    else if (r < 0.48) { pxMushroom(g, x, y, "#7fe3ff"); pxMushroom(g, x + 4, y + 1, "#c88aff"); lights.push({ x: x + 2, y: y - 4, r: 4, c: "#7fe3ff", a: 0.3 }); }
    else if (r < 0.62) pxTree(g, x, y, 4, pxRamp("#3a5a9a"), { fruit: "#b8f0ff" });
    else if (r < 0.74) { pxRunestone(g, x, y, "#9fe8ff"); lights.push({ x, y: y - 5, r: 4, c: "#9fe8ff", a: 0.3 }); }
    else if (r < 0.86) pxRock(g, x, y, 3, PX_DARKSTONE);
    else pxBush(g, x, y, 3, pxRamp("#2e4a7a"), "#e8b8ff");
  } else if (T === "harvest") {
    if (r < 0.3) pxTree(g, x, y, 4 + Math.round(r * 5), pxRamp(["#c8682a", "#b88a2a", "#a84a2a"][Math.floor(r * 30) % 3]), { fruit: "#ff3b3b" });
    else if (r < 0.45) { pxHaystack(g, x, y); }
    else if (r < 0.58) { pxPumpkin(g, x, y); pxPumpkin(g, x + 4, y + 1); pxPumpkin(g, x - 3, y + 2); }
    else if (r < 0.68) pxBeehive(g, x, y);
    else if (r < 0.8) { pxHouse(g, x, y, "#6a3a2a", "#e0c890"); lights.push({ x: x - 3, y: y - 5, r: 4, c: "#ffcf5a", a: 0.25 }); }
    else pxBush(g, x, y, 3, pxRamp("#8a7a2a"), "#c83a3a");
  } else if (T === "ocean") {
    if (r < 0.3) pxPalm(g, x, y, 10 + Math.round(r * 12));
    else if (r < 0.5) pxCoral(g, x, y, ["#ff7a8a", "#ffb05a", "#c87aff"][Math.floor(r * 40) % 3]);
    else if (r < 0.62) pxRock(g, x, y, 3, pxRamp("#a89080"));
    else if (r < 0.74) pxBush(g, x, y, 3, pxRamp("#2a9a5a"), null);
    else if (r < 0.84) { pxHouse(g, x, y, "#2a8a9a", "#f0e4c8"); lights.push({ x: x - 3, y: y - 5, r: 4, c: "#ffcf5a", a: 0.25 }); }
    else { pxShell(g, x, y); pxShell(g, x + 3, y + 1); }
  } else {
    if (r < 0.28) pxObsidian(g, x, y, 5 + Math.round(r * 14));
    else if (r < 0.46) pxDeadTree(g, x, y);
    else if (r < 0.62) pxRock(g, x, y, 3, PX_DARKSTONE);
    else if (r < 0.76) { pxRow(g, x - 2, y, 5, "#ff6a1a"); pxRow(g, x - 1, y - 1, 3, "#ffd23f"); lights.push({ x, y, r: 5, c: "#ff6a1a", a: 0.35 }); cwSmokes.push({ isl: isl.id, x, y: y - 2 }); }
    else pxCrystal(g, x, y, 3, "#ff8a3a");
  }
}

function cwLandmark(g, isl, x, y, lights) {
  const T = isl.theme;
  if (T === "medieval") {
    pxCastle(g, x, y);
    lights.push({ x: x - 2, y: y - 21, r: 5, c: "#ffcf5a", a: 0.3 }, { x: x + 3, y: y - 21, r: 5, c: "#ffcf5a", a: 0.3 });
    cwFlags.push({ isl: isl.id, x: x - 15, y: y - 36, c: "#d9b44a" }, { isl: isl.id, x: x + 18, y: y - 36, c: "#c8323a" });
  } else if (T === "wizard") {
    pxSpireTower(g, x, y);
    [y - 37, y - 27, y - 17].forEach(wy => lights.push({ x, y: wy, r: 6, c: "#7fe3ff", a: 0.4 }));
    lights.push({ x, y: y - 67, r: 7, c: "#ffd23f", a: 0.4 });
  } else if (T === "harvest") {
    pxBarn(g, x, y);
    lights.push({ x: x - 4, y: y - 15, r: 5, c: "#ffcf5a", a: 0.3 });
  } else if (T === "ocean") {
    pxShipwreck(g, x, y);
  } else {
    pxVolcano(g, x, y);
    lights.push({ x, y: y - 34, r: 12, c: "#ff6a1a", a: 0.6 });
    cwSmokes.push({ isl: isl.id, x, y: y - 36, big: true });
  }
}

/* Moving bits found while painting: windmill sails, flags and smoke */
const cwWindmills = [], cwFlags = [], cwSmokes = [];

/* ----- Drawing the world each frame ----- */
function cmDrawWorld(g, t) {
  cwFarClouds(g, t);
  cwCoilHead(g, t);
  // from the top of the sky down: each island, then the stretch of Coil that lands on it
  const [vx0, vy0] = cmToWorld(0, 0), [vx1, vy1] = cmToWorld(cmCanvas.clientWidth, cmCanvas.clientHeight);
  for (let i = CAMP.islands.length - 1; i >= 0; i--) {
    const c = CM_CENTERS[i];
    // islands off the screen are skipped
    if (c[0] + CW_W / 2 >= vx0 && c[0] - CW_W / 2 <= vx1 && c[1] + CW_H - CW_OY >= vy0 && c[1] - CW_OY - 80 <= vy1) cwDrawIsland(g, CAMP.islands[i], i, t);
    if (i > 0) cwDrawCoil(g, i - 1, t);
  }
  cwDrawCoil(g, -1, t);
  cwCoilSurge(g, t);
  cmDrawTraveler(g, t);
  cwNearClouds(g, t);
}

const cwBob = i => cmBob(i, cmT);

function cwDrawIsland(g, isl, i, t) {
  const art = cwIsland(isl, i);
  const c = CM_CENTERS[i], by = cwBob(i);
  const ox = c[0] - CW_OX, oy = c[1] - CW_OY + by;
  const open = campIslandOpen(isl.id);
  // waterfalls first, so they pour from behind the lip
  art.falls.forEach(f => {
    if (!open) return;
    for (let r = 0; r < f.len; r++) {
      const ph = ((r - t * 40) % 7 + 7) % 7;
      const a = Math.max(0, 1 - r / f.len);
      g.fillStyle = ph < 2 ? (f.lava ? `rgba(255,220,90,${0.95 * a})` : `rgba(255,255,255,${0.9 * a})`) : `rgba(${hexToRgb(f.c).join(",")},${0.8 * a})`;
      g.fillRect(ox + f.x, oy + f.y + r, 2, 1);
      if (r > f.len * 0.4 && cmHash(r, f.x, Math.floor(t * 8)) > 0.92) pxDot(g, ox + f.x + (r % 2 ? -1 : 2), oy + f.y + r, `rgba(255,255,255,${0.6 * a})`);
    }
  });
  g.drawImage(art.canvas, Math.round(ox), Math.round(oy));
  if (!open) { cwFog(g, c, i, t); return; }
  // things that glow: brighter as the sky darkens
  const night = [0.25, 0.15, 0.5, 0.75, 1][i];
  art.lights.forEach((L, k) => pxGlow(g, ox + L.x, oy + L.y, L.r, L.c, L.a * (0.6 + 0.6 * night) * (0.85 + 0.15 * Math.sin(t * 2 + k))));
  // moving things
  cwWindmills.forEach(m => { if (m.isl === isl.id) pxWindmillBlades(g, ox + m.x, oy + m.y, t); });
  cwFlags.forEach(f => { if (f.isl !== isl.id) return; for (let k = 0; k < 4; k++) pxFill(g, ox + f.x + 1 + k, oy + f.y + Math.round(Math.sin(t * 6 - k) * 0.7), 1, 2, f.c); });
  cwSmokes.forEach(s => {
    if (s.isl !== isl.id) return;
    for (let k = 0; k < (s.big ? 6 : 3); k++) {
      const ph = (t * (s.big ? 0.25 : 0.4) + k / (s.big ? 6 : 3)) % 1;
      const w = (s.big ? 3 : 1) + Math.round(ph * (s.big ? 7 : 3));
      g.fillStyle = `rgba(${s.big ? "90,80,84" : "70,60,64"},${0.55 * (1 - ph)})`;
      g.fillRect(Math.round(ox + s.x - w / 2 + Math.sin(ph * 5 + k) * 3 + ph * 8), Math.round(oy + s.y - ph * (s.big ? 40 : 16)), w, Math.max(1, Math.round(w * 0.7)));
    }
  });
  cwLiving(g, isl, i, ox + CW_OX, oy + CW_OY, t);
  Object.keys(CM_NODES).forEach(k => cwNode(g, isl, isNaN(+k) ? k : +k, t));
}

/* Small lives on each island */
function cwLiving(g, isl, i, x, y, t) {
  const [px, py] = CM_FEATURE.pool;
  if (isl.theme === "medieval") {
    // ripples on the pond, birds over the castle
    for (let k = 0; k < 3; k++) if (Math.sin(t * 2 + k * 2) > 0.7) pxRow(g, x + px - 8 + k * 7, y + py - 2 + k * 2, 3, "#bfe4ff");
    for (let k = 0; k < 3; k++) { const a = t * 0.6 + k * 2.1; const bx = x - 126 + Math.cos(a) * 30, byy = y - 112 + Math.sin(a * 1.4) * 6; pxDot(g, bx - 1, byy, "#2a2a3a"); pxDot(g, bx + 1, byy, "#2a2a3a"); pxDot(g, bx, byy + (Math.sin(t * 9 + k) > 0 ? 1 : -1), "#2a2a3a"); }
  } else if (isl.theme === "wizard") {
    // motes of light drifting up off the pool
    for (let k = 0; k < 10; k++) { const ph = (t * 0.3 + k / 10) % 1; pxDot(g, x + px - 16 + (k * 7) % 32 + Math.sin(t + k) * 2, y + py - ph * 30, ph < 0.8 ? (k % 2 ? "#b8f0ff" : "#e8b8ff") : "#ffffff"); }
    // a few runes orbit the tower
    for (let k = 0; k < 5; k++) { const a = t * 0.9 + k * 1.26; pxDot(g, x - 126 + Math.cos(a) * 13, y - 82 + Math.sin(a) * 4, "#ffd23f"); }
  } else if (isl.theme === "harvest") {
    for (let k = 0; k < 5; k++) { const a = t * (2 + k * 0.4) + k * 1.6; pxDot(g, x + 60 + Math.cos(a) * (6 + k * 2), y - 20 + Math.sin(a * 1.3) * 3, k % 2 ? "#ffcf33" : "#1a1410"); }
    for (let k = 0; k < 4; k++) { const ph = (t * 0.2 + k / 4) % 1; pxDot(g, x - 40 + k * 30 + Math.sin(t * 2 + k) * 6, y - 60 + ph * 50, "#e8781a"); }
  } else if (isl.theme === "ocean") {
    for (let k = 0; k < 4; k++) if (Math.sin(t * 2.4 + k * 1.7) > 0.6) pxRow(g, x + px - 12 + k * 7, y + py - 3 + (k % 2) * 4, 2, "#e8ffff");
    for (let k = 0; k < 2; k++) { const a = t * 0.5 + k * 3; const gx = x + Math.cos(a) * 140, gy = y - 70 + Math.sin(a * 2) * 10; pxDot(g, gx - 1, gy, "#f4f4f4"); pxDot(g, gx + 1, gy, "#f4f4f4"); pxDot(g, gx, gy - (Math.sin(t * 8) > 0 ? 1 : 0), "#f4f4f4"); }
  } else {
    // embers rising
    for (let k = 0; k < 12; k++) { const ph = (t * 0.35 + k / 12) % 1; pxDot(g, x - 140 + (k * 37) % 280 + Math.sin(t + k) * 3, y + 20 - ph * 90, ph < 0.6 ? "#ffb030" : "#ff5a1a"); }
  }
  // fireflies come out on the night islands
  if (i >= 3) for (let k = 0; k < 10; k++) { const a = t * 0.4 + k * 0.7; if (Math.sin(t * 3 + k * 1.3) > 0.2) pxDot(g, x - 150 + (k * 31) % 300 + Math.cos(a) * 6, y - 40 + (k * 17) % 80 + Math.sin(a * 1.6) * 4, "#fff6a0"); }
}

/* Clouds hiding the islands you haven't reached */
function cwFog(g, c, i, t) {
  for (let k = 0; k < 9; k++) {
    const w = 70 + Math.round(cmHash(k, i, 4) * 60);
    const x = c[0] - 200 + cmHash(k, i, 5) * 330 + Math.sin(t * 0.3 + k) * 5, y = c[1] - 60 + (k % 4) * 34 + cmHash(k, i, 6) * 10;
    g.globalAlpha = 0.95;
    g.drawImage(pxCloudArt(w, k + i * 9, i >= 3 ? "night" : i >= 2 ? "dusk" : "day"), Math.round(x), Math.round(y));
    g.globalAlpha = 1;
  }
}

/* ----- The spots on the path ----- */
function cwNode(g, isl, node, t) {
  const p = cmPos(isl.id, node, t);
  const st = cmNodeState(isl.id, node);
  const x = Math.round(p.x), y = Math.round(p.y);
  if (node === "home") { cwHome(g, isl, x, y, t); return; }
  if (typeof node === "number") {
    const d = campLevelDef(isl.id, node);
    if (d.kind === "boss") pxLair(g, x, y, isl.boss.eye, st, t);
    else {
      pxPedestal(g, x, y, d.kind, st, t);
      if (st !== "locked") cwGlyph(g, d.goal, x, y - 12, t);
      if (st === "won") {
        pxFill(g, x + 6, y - 12, 1, 9, "#5a3a20");
        const fl = (camp.levels[campLevelId(isl.id, node)] || {}).flawless ? "#ffffff" : isl.colors.accent;
        for (let k = 0; k < 4; k++) pxFill(g, x + 7 + k, y - 12 + Math.round(Math.sin(t * 5 - k) * 0.6), 1, 2, fl);
      }
    }
  } else if (node === "bridge") pxGate(g, x, y, st !== "locked", t);
  else {
    if (node === "merchant") pxMerchant(g, x, y, isl.colors.accent, t);
    else if (node === "challenger") pxPavilion(g, x, y, isl.colors.accent, t);
    else pxVault(g, x, y, t);
    if (st !== "locked") pxKeeper(g, x + (node === "banker" ? -13 : node === "challenger" ? -11 : 0), y - (node === "merchant" ? 5 : 1), isl.npcs[node].look, t);
  }
  if (st === "locked") {
    const lx = x, ly = y - (typeof node === "string" ? 22 : 9);
    pxFill(g, lx - 2, ly, 5, 4, "#2a2e36"); pxRow(g, lx - 1, ly - 2, 3, "#2a2e36"); pxDot(g, lx - 1, ly - 1, "#2a2e36"); pxDot(g, lx + 1, ly - 1, "#2a2e36"); pxDot(g, lx, ly + 1, "#ffd23f");
  }
}

/* A tiny picture of each goal, floating over its stone */
function cwGlyph(g, goal, x, y, t) {
  const b = Math.round(Math.sin(t * 2 + x * 0.3) * 0.7);
  const R = (a, c, w, h, col) => pxFill(g, x + a, y + c + b, w, h, col);
  R(-3, -3, 7, 6, "rgba(10,10,20,0.35)");
  switch (goal.type) {
    case "apples": R(-1, -1, 3, 3, "#ff2b2b"); R(-1, -1, 1, 1, "#ff9a9a"); R(0, -2, 1, 1, "#5a3a20"); R(1, -2, 1, 1, "#3ddc3d"); break;
    case "score": R(0, -2, 1, 5, "#fff4b0"); R(-2, 0, 5, 1, "#fff4b0"); R(-1, -1, 3, 3, "#ffe86a"); break;
    case "length": R(-2, 0, 2, 2, "#3ddc84"); R(0, 0, 2, 2, "#2fae6a"); R(2, -1, 2, 2, "#3ddc84"); R(3, -1, 1, 1, "#ffffff"); break;
    case "survive": R(-1, -2, 3, 1, "#e8e0c8"); R(0, -1, 1, 1, "#ffd23f"); R(0, 0, 1, 1, "#ffd23f"); R(-1, 1, 3, 1, "#e8e0c8"); break;
    case "distance": R(-2, 0, 4, 1, "#ffffff"); R(1, -1, 1, 3, "#ffffff"); R(2, 0, 1, 1, "#ffffff"); break;
    case "keys": R(-2, -1, 2, 2, "#ffd23f"); R(0, 0, 3, 1, "#ffd23f"); R(2, 1, 1, 1, "#ffd23f"); break;
    case "buttons": R(-2, 0, 5, 2, "#8a92a4"); R(-1, -1, 3, 1, "#3ddc84"); break;
    case "relic": R(-2, -1, 5, 3, "#ffd23f"); R(-2, -2, 1, 1, "#ffd23f"); R(0, -2, 1, 1, "#ffd23f"); R(2, -2, 1, 1, "#ffd23f"); R(0, 0, 1, 1, "#ff3b3b"); break;
    case "shards": R(-1, -1, 3, 3, "#c89a4a"); R(0, -2, 1, 1, "#8a6a2a"); R(0, 0, 1, 1, "#ffe08a"); break;
    case "thief": R(-2, 0, 4, 2, "#8a6a4a"); R(1, -1, 2, 2, "#a8886a"); R(-3, 0, 1, 1, "#6a4a2a"); R(2, -1, 1, 1, "#000000"); break;
  }
}

/* The home tree: a sapling until you buy its first upgrade, then taller, wider and fruitier with every tier */
function cwHome(g, isl, x, y, t) {
  const target = cmTreeGrowth(isl.id);
  const shown = cmGrowShown[isl.id] === undefined ? target : cmGrowShown[isl.id];
  const gr = shown + (target - shown) * 0.04;
  cmGrowShown[isl.id] = Math.abs(target - gr) < 0.002 ? target : gr;
  const growing = Math.abs(target - gr) > 0.004;
  const leafBase = { medieval: "#3f8a33", wizard: "#4a6ac0", harvest: "#c8782a", ocean: "#e86a8a", volcano: "#a8401a" }[isl.theme];
  const fruit = { medieval: "#ff3b3b", wizard: "#b8f0ff", harvest: "#ffd23f", ocean: "#f8f4ff", volcano: "#ffb020" }[isl.theme];
  const leaves = pxRamp(leafBase);
  // a ring of stones around the roots
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(x - 8 - Math.round(gr * 10), y + 1, 16 + Math.round(gr * 20), 2);
  // a ring of glowing blossoms around the roots
  const ringR = 16 + Math.round(gr * 8);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + t * 0.15;
    const fx = x + Math.round(Math.cos(a) * ringR), fy = y + Math.round(Math.sin(a) * ringR * 0.38);
    pxDot(g, fx, fy, k % 2 ? "#fff6c4" : leafBase);
    if (Math.sin(t * 2 + k) > 0.7) pxDot(g, fx, fy - 1, "#ffffff");
  }
  {
    const th = 14 + Math.round(gr * 20), tw = gr > 0.6 ? 5 : gr > 0.25 ? 4 : 3;
    if (gr > 0.3) { pxRow(g, x - tw - 1, y, 2, PX_TRUNK[1]); pxRow(g, x + tw - 1, y, 2, PX_TRUNK[1]); }
    for (let c = 0; c < tw; c++) pxFill(g, x - Math.floor(tw / 2) + c, y - th, 1, th, c === 0 ? PX_TRUNK[3] : c === tw - 1 ? PX_TRUNK[0] : PX_TRUNK[2]);
    const reach = Math.round(2 + gr * 8);
    if (gr > 0.15) { pxRow(g, x - reach, y - th + 2, reach, PX_TRUNK[1]); pxRow(g, x + 1, y - th + 3, reach, PX_TRUNK[1]); pxDot(g, x - reach, y - th + 1, PX_TRUNK[1]); }
    const sway = Math.round(Math.sin(t * 0.9) * 0.6);
    const cr = 11 + Math.round(gr * 14);
    const cy = y - th - Math.round(cr * 0.45);
    if (gr > 0.2) { pxBlob(g, x - Math.round(cr * 0.75) + sway, cy + 2, Math.round(cr * 0.55), Math.round(cr * 0.45), leaves, { seed: 4, wobble: 0.3 }); pxBlob(g, x + Math.round(cr * 0.75) + sway, cy + 2, Math.round(cr * 0.55), Math.round(cr * 0.45), leaves, { seed: 5, wobble: 0.3 }); }
    pxBlob(g, x + sway, cy, cr, Math.round(cr * 0.72), leaves, { seed: 6, wobble: 0.25 });
    if (gr > 0.5) pxBlob(g, x - Math.round(cr * 0.2) + sway, cy - Math.round(cr * 0.55), Math.round(cr * 0.55), Math.round(cr * 0.4), leaves, { seed: 7, wobble: 0.3 });
    // one fruit for every tier bought on this tree
    const tiers = isl.tree.upgrades.reduce((a, u) => a + upTier(u.id), 0);
    for (let k = 0; k < tiers; k++) {
      const a = k * 2.399, rr = Math.sqrt((k + 0.5) / Math.max(1, tiers)) * cr * 0.8;
      const fx = x + Math.round(Math.cos(a) * rr) + sway, fy = cy + Math.round(Math.sin(a) * rr * 0.62);
      pxDot(g, fx, fy, fruit); pxDot(g, fx, fy + 1, pxDark(fruit, 0.35));
    }
    // a soft glow around the tree, stronger as it grows
    pxGlow(g, x, cy, cr + 8, "#fff0a0", 0.2 + gr * 0.25 + 0.08 * Math.sin(t * 2));
    if (target >= 1) for (let k = 0; k < 6; k++) if (Math.sin(t * 3 + k * 1.7) > 0.6) pxDot(g, x + Math.round(Math.cos(k * 1.3) * cr), cy + Math.round(Math.sin(k * 2.1) * cr * 0.6), "#fffbe0");
  }
  if (growing) for (let k = 0; k < 8; k++) { const a = t * 4 + k * 0.8; pxDot(g, x + Math.round(Math.cos(a) * (8 + gr * 10)), y - 10 - Math.round(gr * 14) + Math.round(Math.sin(a) * 6), "#fff6c4"); }
  // keepsakes, only once you have something they're for
  Object.entries(cmKeepsakes()).forEach(([k, on]) => {
    if (!on) return;
    if (cmSeenKeep[isl.id + k] === undefined) cmSeenKeep[isl.id + k] = t;
    const age = t - cmSeenKeep[isl.id + k];
    const [dx, dy] = CM_KEEP_AT[k];
    const X = x + dx, Y = y + dy + (age < 0.6 ? Math.round((1 - age / 0.6) * -5) : 0);
    g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(X - 3, Y + 1, 7, 1);
    if (k === "satchel") {
      pxBlob(g, X, Y - 2, 3, 2, PX_WOOD, { seed: 9 });
      pxRow(g, X - 3, Y - 5, 7, PX_WOOD[0]); pxDot(g, X - 2, Y - 6, PX_WOOD[0]); pxDot(g, X + 2, Y - 6, PX_WOOD[0]); pxRow(g, X - 1, Y - 7, 3, PX_WOOD[0]);
      pxDot(g, X, Y - 3, "#ffd23f"); pxDot(g, X + 3, Y - 4, "#c8323a"); pxDot(g, X + 3, Y - 5, "#e8e0c8");
    } else if (k === "trophy") {
      pxWall(g, X - 3, Y - 2, 7, 3, PX_WOOD);
      pxBlob(g, X, Y - 6, 2, 2, PX_GOLD, { seed: 3 }); pxDot(g, X - 3, Y - 7, PX_GOLD[2]); pxDot(g, X + 3, Y - 7, PX_GOLD[2]); pxFill(g, X, Y - 4, 1, 2, PX_GOLD[1]);
      pxGlow(g, X, Y - 6, 4, "#ffd23f", 0.25);
    } else if (k === "mirror") {
      pxFill(g, X, Y - 2, 1, 3, PX_WOOD[1]); pxRow(g, X - 2, Y, 5, PX_WOOD[1]);
      pxFill(g, X - 2, Y - 10, 5, 8, PX_GOLD[1]); pxFill(g, X - 1, Y - 9, 3, 6, "#9fd8f0"); pxDot(g, X - 1, Y - 9, "#e8f8ff");
      const sk = currentSkin(); pxDot(g, X, Y - 6, skinColorAt(sk, 0, t * 1000)); pxDot(g, X + 1, Y - 5, skinColorAt(sk, 1, t * 1000));
    } else {
      pxDot(g, X - 3, Y, PX_WOOD[1]); pxDot(g, X + 3, Y, PX_WOOD[1]); pxFill(g, X, Y - 10, 1, 10, PX_WOOD[0]);
      pxWall(g, X - 3, Y - 9, 7, 6, ["#8a7a60", "#d8ccb4", "#f0e8d8", "#ffffff"]);
      pxDot(g, X - 1, Y - 7, "#ff5a61"); pxDot(g, X, Y - 6, "#3ddc84"); pxDot(g, X + 1, Y - 7, "#38bdf8"); pxDot(g, X - 1, Y - 5, "#ffd23f");
    }
    if (age < 1.2) for (let s = 0; s < 5; s++) { const a = t * 6 + s * 1.26; pxDot(g, X + Math.round(Math.cos(a) * 5), Y - 4 + Math.round(Math.sin(a) * 5), "#fff6c4"); }
  });
}

/* ----- The Coil ----- */
const CMC_LIT = ["#0b2e1a", "#1f6e3a", "#2fa85a", "#6ad47a", "#ffe08a"];
const CMC_STONE = ["#22262e", "#3c424e", "#545a68", "#6e7686", "#8a92a2"];
const CMC_WAKE = ["#2e2012", "#5a3e1e", "#8a6a32", "#c8a04a", "#ffd23f"];

/* Points along the stretch from island i's gate up to island i+1's shore; -1 is the tail rising from the clouds */
const cmCoilCache = {};
function coilSamples(i) {
  if (cmCoilCache[i]) return cmCoilCache[i];
  let a, b, c1, c2;
  if (i < 0) {
    const h = cmPos(CAMP.islands[0].id, "home", 0);
    a = { x: h.x - 190, y: CM_H - 4 }; b = { x: h.x - 2, y: h.y + 22 };
    c1 = { x: a.x + 20, y: a.y - 110 }; c2 = { x: b.x - 120, y: b.y + 50 };
  } else {
    const p = cmPos(CAMP.islands[i].id, "bridge", 0), q = cmPos(CAMP.islands[i + 1].id, "home", 0);
    a = { x: p.x, y: p.y - 26 }; b = { x: q.x, y: q.y + 24 };
    const dir = b.x > a.x ? 1 : -1;
    c1 = { x: a.x - dir * 30, y: a.y - 90 }; c2 = { x: b.x - dir * 150, y: b.y + 80 };
  }
  const raw = [];
  for (let k = 0; k <= 500; k++) {
    const t = k / 500, u = 1 - t;
    raw.push({ x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y });
  }
  const out = [];
  let acc = 0;
  for (let k = 1; k < raw.length; k++) {
    acc += Math.hypot(raw[k].x - raw[k - 1].x, raw[k].y - raw[k - 1].y);
    if (acc >= 1 || k === raw.length - 1) {
      acc = 0;
      const dx = raw[k].x - raw[k - 1].x, dy = raw[k].y - raw[k - 1].y, l = Math.hypot(dx, dy) || 1;
      out.push({ x: raw[k].x, y: raw[k].y, nx: -dy / l, ny: dx / l, s: out.length });
    }
  }
  cmCoilCache[i] = out;
  return out;
}

const coilW = (s, L) => 4 + Math.round(5 * Math.min(1, s / 40, (L - s) / 40));

function coilState(i) {
  if (i < 0) return "lit";
  if (campIslandOpen(CAMP.islands[i + 1].id)) return "lit";
  return campIslandOpen(CAMP.islands[i].id) ? "wake" : "stone";
}

const cmCoilArt = {};
function cwCoilBody(i) {
  const st = coilState(i), key = i + ":" + st;
  if (cmCoilArt[key]) return cmCoilArt[key];
  const S = coilSamples(i), L = S.length;
  const xs = S.map(p => p.x), ys = S.map(p => p.y);
  const x0 = Math.floor(Math.min(...xs)) - 10, y0 = Math.floor(Math.min(...ys)) - 10;
  const c = document.createElement("canvas");
  c.width = Math.ceil(Math.max(...xs)) - x0 + 20; c.height = Math.ceil(Math.max(...ys)) - y0 + 20;
  const g = c.getContext("2d");
  const pal = st === "lit" ? CMC_LIT : st === "wake" ? CMC_WAKE : CMC_STONE;
  g.fillStyle = "rgba(10,8,30,0.25)";
  S.forEach(p => { const w = coilW(p.s, L); g.fillRect(Math.round(p.x - x0 - w / 2 + 3), Math.round(p.y - y0 - w / 2 + 4), w, w); });
  S.forEach(p => {
    const w = coilW(p.s, L), half = w / 2;
    for (let o = -half; o <= half; o += 0.5) {
      const edge = Math.abs(o) / (half || 1);
      const lit = o * Math.sign(p.ny || 1) < 0;
      let shade = edge > 0.84 ? 0 : edge > 0.6 ? 1 : lit ? 3 : 2;
      // overlapping scales, offset on each side
      const sc = (p.s + (o > 0 ? 3 : 0)) % 6;
      if (sc === 0 && shade > 1) shade -= 1;
      if (sc === 1 && edge < 0.6 && lit) shade = 4;
      // the belly stripe down the spine
      if (Math.abs(o) < 0.7 && Math.floor(p.s / 4) % 2 === 0 && shade >= 2) shade = 4;
      g.fillStyle = pal[shade];
      g.globalAlpha = st === "stone" ? 0.8 : 1;
      g.fillRect(Math.round(p.x - x0 + p.nx * o), Math.round(p.y - y0 + p.ny * o), 1, 1);
    }
  });
  g.globalAlpha = 1;
  cmCoilArt[key] = { c, x0, y0 };
  return cmCoilArt[key];
}

function cwDrawCoil(g, i, t) {
  const art = cwCoilBody(i);
  g.drawImage(art.c, art.x0, art.y0);
  const S = coilSamples(i), st = coilState(i);
  if (st === "lit") {
    // light flows along the body toward the next island
    for (let k = 0; k * 50 < S.length; k++) {
      const head = Math.floor((t * 34 + k * 50) % S.length);
      for (let j = 0; j < 9; j++) {
        const p = S[head - j];
        if (!p) break;
        g.fillStyle = `rgba(255,240,170,${(1 - j / 9) * 0.8})`;
        const w = Math.max(1, coilW(p.s, S.length) - 4);
        g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - w / 2), w, w);
      }
      pxGlow(g, S[head].x, S[head].y, 6, "#ffe9a0", 0.25);
    }
    for (let k = 0; k < 8; k++) { const p = S[Math.floor(cmHash(k, Math.floor(t * 1.5) + i + 9, 17) * S.length)]; if (p && Math.sin(t * 6 + k) > 0.4) pxDot(g, p.x, p.y - 2, "#fffbe0"); }
  } else if (st === "wake") {
    const glow = 0.35 + 0.35 * Math.sin(t * 2.4);
    for (let k = 0; k < S.length; k += 3) { const p = S[k]; if (Math.floor((p.s - t * 14) / 8) % 4) continue; g.fillStyle = `rgba(255,210,63,${glow})`; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  }
}

let cmCoilSeen = null, cmCoilSurge = null;
function cwCoilSurge(g, t) {
  const litNow = CAMP.islands.filter(isl => campIslandOpen(isl.id)).length;
  if (cmCoilSeen !== null && litNow > cmCoilSeen) cmCoilSurge = { i: litNow - 2, at: t };
  cmCoilSeen = litNow;
  if (!cmCoilSurge) return;
  const S = coilSamples(cmCoilSurge.i), k = (t - cmCoilSurge.at) / 2;
  if (k >= 1.3) { cmCoilSurge = null; return; }
  const at = Math.floor(S.length * Math.min(1, k));
  for (let j = 0; j < 36; j++) { const p = S[at - j]; if (!p) break; const w = coilW(p.s, S.length) + 2; g.fillStyle = `rgba(255,250,210,${(1 - j / 36) * Math.min(1, (1.3 - k) * 3)})`; g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - w / 2), w, w); }
  if (S[at]) pxGlow(g, S[at].x, S[at].y, 12, "#fff0a0", 0.6);
}

/* The head rises from behind the last island: its eyes open once the Cinder Crown is beaten */
function cwCoilHead(g, t) {
  const last = CAMP.islands[CAMP.islands.length - 1];
  const p = cmPos(last.id, "bridge", t);
  const awake = campWon(last.id, LEVEL_COUNT);
  const pal = awake ? CMC_LIT : CMC_STONE;
  const x = Math.round(p.x + 40), y = Math.round(p.y - 46);
  // the neck curls up from behind the gate
  for (let k = 0; k <= 50; k++) {
    const f = k / 50, nx = p.x + 6 + Math.sin(f * 2.4) * 30 * f, ny = p.y - 20 - f * 26;
    for (let o = -4; o <= 4; o++) pxDot(g, nx + o, ny, Math.abs(o) === 4 ? pal[0] : o < -1 ? pal[3] : (k % 6 < 2 && Math.abs(o) < 2) ? pal[4] : pal[2]);
  }
  const R = (dx, dy, w, h, c) => pxFill(g, x + dx, y + dy, w, h, c);
  const jaw = awake ? Math.max(0, Math.round(Math.sin(t * 0.9) * 3)) : 0;
  R(-18, -6, 22, 10, pal[0]); R(-17, -5, 20, 8, pal[2]); R(-16, -5, 16, 2, pal[3]); R(-12, -6, 5, 1, pal[4]);
  R(-20, -3, 3, 6, pal[0]); R(-19, -2, 2, 4, pal[1]);
  R(-19, 4 + jaw, 18, 3, pal[0]); R(-18, 4 + jaw, 16, 2, pal[1]);
  if (jaw) { R(-18, 4, 16, jaw, "#2a0a12"); for (let k = 0; k < 5; k++) R(-17 + k * 3, 4, 1, 1, "#e8e0c8"); }
  R(-20, -2, 1, 1, "#0a0a12"); R(-20, 1, 1, 1, "#0a0a12");
  // horns
  R(-2, -9, 2, 3, pal[1]); R(0, -11, 2, 2, pal[1]); R(-6, -8, 2, 2, pal[1]);
  if (!awake || (t % 6) < 0.15) R(-10, -3, 4, 1, "#0a0a12");
  else { pxGlow(g, x - 8, y - 2, 7, "#ffd23f", 0.5 + 0.2 * Math.sin(t * 3)); R(-11, -4, 4, 3, "#ffd23f"); R(-10, -4, 1, 3, "#0a0a12"); }
  if (awake && Math.sin(t * 2.2) > 0.6) { R(-26, 1, 7, 1, "#ff3b6b"); R(-28, 0, 2, 1, "#ff3b6b"); R(-28, 2, 2, 1, "#ff3b6b"); }
}

/* ----- The sky ----- */
const CM_SKY = [[0, "#070618"], [200, "#16124a"], [380, "#3a2a74"], [560, "#84498e"], [700, "#d07a90"],
  [830, "#cba6c6"], [960, "#8fbfe6"], [1130, "#79bdec"], [1300, "#bfe0f2"], [1460, "#ffe1bf"], [1640, "#ffcf98"]].map(([y, c]) => [y, hexToRgb(c)]);
function cmSkyAt(y) {
  if (y <= CM_SKY[0][0]) return CM_SKY[0][1];
  for (let i = 1; i < CM_SKY.length; i++) {
    const [y1, c1] = CM_SKY[i], [y0, c0] = CM_SKY[i - 1];
    if (y <= y1) { const k = (y - y0) / (y1 - y0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); }
  }
  return CM_SKY[CM_SKY.length - 1][1];
}

const CM_SKY_PX = 4;
let cwShoot = null;
let cwSkyBuf = null;
function cmDrawSky(out, vw, vh, t) {
  const w = Math.max(1, Math.ceil(vw / CM_SKY_PX)), h = Math.max(1, Math.ceil(vh / CM_SKY_PX));
  if (cmSky.width !== w || cmSky.height !== h) { cmSky.width = w; cmSky.height = h; }
  const g = cmSky.getContext("2d");
  const worldY = row => cmToWorld(0, row * CM_SKY_PX)[1];
  // the gradient, dithered, written straight into one pixel buffer
  if (!cwSkyBuf || cwSkyBuf.width !== w || cwSkyBuf.height !== h) cwSkyBuf = g.createImageData(w, h);
  const D = cwSkyBuf.data;
  for (let r = 0; r < h; r++) {
    const wy = worldY(r);
    const cols = [0, 1, 2, 3].map(b => cmSkyAt(wy + (BAYER[(r % 4) * 4 + b] / 16 - 0.5) * 18));
    for (let x = 0; x < w; x++) {
      const c = cols[x & 3], k = (r * w + x) * 4;
      D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2]; D[k + 3] = 255;
    }
  }
  g.putImageData(cwSkyBuf, 0, 0);
  const px = -cmCam.x * cmCam.z / CM_SKY_PX, py = -cmCam.y * cmCam.z / CM_SKY_PX;
  // an aurora over the night islands
  for (let x = 0; x < w; x++) {
    const wx = cmToWorld(x * CM_SKY_PX, 0)[0];
    const base = 160 + Math.sin(wx * 0.012 + t * 0.15) * 40 + Math.sin(wx * 0.031 - t * 0.1) * 16;
    for (let k = 0; k < 26; k++) {
      const wy = base + k * 3;
      const sy = (wy - cmCam.y) * cmCam.z / CM_SKY_PX + h / 2;
      if (sy < 0 || sy >= h) continue;
      const a = Math.sin(k / 26 * Math.PI) * (0.18 + 0.12 * Math.sin(wx * 0.05 + t * 0.6));
      if (a < pxBay(x, Math.floor(sy)) * 0.4) continue;
      g.fillStyle = k < 13 ? `rgba(90,255,190,${a})` : `rgba(180,120,255,${a})`;
      g.fillRect(x, Math.floor(sy), 1, 1);
    }
  }
  // stars, brighter higher up, some of them twinkling crosses
  for (let i = 0; i < 260; i++) {
    const sx = ((cmHash(i, 1, 91) * w * 3 + px * 0.1) % w + w) % w;
    const sy = ((cmHash(i, 2, 91) * h * 3 + py * 0.1) % h + h) % h;
    const a = Math.max(0, Math.min(1, (820 - worldY(sy)) / 420));
    if (a <= 0) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + cmHash(i, 3, 91) * 3) + i);
    g.fillStyle = `rgba(255,250,230,${a * (0.3 + tw * 0.7)})`;
    g.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
    if (i % 23 === 0 && tw > 0.8) { g.fillRect(Math.floor(sx) - 1, Math.floor(sy), 3, 1); g.fillRect(Math.floor(sx), Math.floor(sy) - 1, 1, 3); }
  }
  // now and then, a shooting star
  if (!cwShoot && Math.random() < 0.004) cwShoot = { x: Math.random() * w, y: Math.random() * h * 0.5, at: t };
  if (cwShoot) {
    const k = (t - cwShoot.at) / 0.9;
    if (k > 1 || (820 - worldY(cwShoot.y)) < 0) cwShoot = null;
    else for (let j = 0; j < 10; j++) { g.fillStyle = `rgba(255,255,240,${(1 - j / 10) * (1 - k)})`; g.fillRect(Math.floor(cwShoot.x + k * 40 - j * 2), Math.floor(cwShoot.y + k * 14 - j * 0.7), 1, 1); }
  }
  // far-off islands in the haze
  for (let i = 0; i < 12; i++) {
    const iw = 8 + cmHash(i, 4, 93) * 14;
    const sx = ((cmHash(i, 5, 93) * w * 2.2 + px * 0.28) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
    const sy = ((cmHash(i, 6, 93) * h * 2 + py * 0.28) % (h * 1.3) + h * 1.3) % (h * 1.3) - h * 0.15;
    const [r0, g0, b0] = cmSkyAt(worldY(sy));
    g.fillStyle = `rgba(${Math.round(r0 * 0.84)},${Math.round(g0 * 0.9)},${Math.round(b0 * 0.88)},0.8)`;
    g.fillRect(Math.round(sx - iw / 2), Math.round(sy - 1), Math.round(iw), 2);
    g.fillStyle = `rgba(${Math.round(r0 * 0.7)},${Math.round(g0 * 0.7)},${Math.round(b0 * 0.82)},0.75)`;
    for (let r = 1; r < iw * 0.6; r++) {
      const ww = Math.max(1, Math.round(iw * Math.pow(1 - r / (iw * 0.6), 0.8) * (0.8 + 0.2 * cmHash(r, i, 3))));
      g.fillRect(Math.round(sx - ww / 2), Math.round(sy + r), ww, 1);
    }
  }
  // the moon over the Cinder Crown, the sun rising under Brightscale Keep, light rays at dawn
  const [, moonSy] = cmToScreen(0, 110), [, sunSy] = cmToScreen(0, 1560);
  const mx = w * 0.78 + px * 0.04, my = moonSy / CM_SKY_PX * 0.7 + py * 0.02;
  if (my > -16 && my < h + 16) { cmDisc(g, mx, my, 14, "rgba(255,250,220,0.08)"); cmDisc(g, mx, my, 10, "rgba(255,250,220,0.12)"); cmDisc(g, mx, my, 6, "#fff6d8"); cmDisc(g, mx + 2, my - 1, 5.2, "rgba(22,18,70,0.9)"); }
  const sx = w * 0.16 + px * 0.04, sy = sunSy / CM_SKY_PX;
  if (sy > -40 && sy < h + 20) {
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32 + Math.sin(t * 0.2 + k) * 0.03;
      g.fillStyle = `rgba(255,236,190,${0.07 + 0.03 * Math.sin(t + k)})`;
      for (let r = 10; r < 70; r++) { const rx = sx + Math.cos(a) * r, ry = sy + Math.sin(a) * r; if (pxBay(Math.floor(rx), Math.floor(ry)) < 0.6) g.fillRect(Math.floor(rx), Math.floor(ry), 2, 1); }
    }
    cmDisc(g, sx, sy, 16, "rgba(255,210,140,0.16)"); cmDisc(g, sx, sy, 11, "rgba(255,220,150,0.28)"); cmDisc(g, sx, sy, 7, "#fff0b8");
  }
  out.drawImage(cmSky, 0, 0, w * CM_SKY_PX, h * CM_SKY_PX);
}
function cmDisc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) { const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1); }
}

/* Clouds behind everything, drifting, lit by the sky around them */
function cwFarClouds(g, t) {
  for (let i = 0; i < 26; i++) {
    const w = 30 + Math.round(cmHash(i, 7, 3) * 50);
    const x = ((cmHash(i, 7, 5) * (CM_W + 200) + t * (1 + (i % 5) * 0.35)) % (CM_W + 200)) - 100;
    const y = 40 + (i / 26) * (CM_H - 120) + cmHash(i, 7, 9) * 40;
    const light = y < 560 ? "night" : y < 900 ? "dusk" : "day";
    g.globalAlpha = 0.55;
    g.drawImage(pxCloudArt(w, i, light), Math.round(x), Math.round(y));
  }
  g.globalAlpha = 1;
}

/* The sea of clouds far below */
function cwNearClouds(g, t) {
  for (let k = 0; k < 16; k++) {
    const w = 90 + Math.round(cmHash(k, 9, 3) * 70);
    const x = ((k * 66 + t * 3 * (k % 2 ? 1 : -1)) % (CM_W + 160) + CM_W + 160) % (CM_W + 160) - 120;
    g.drawImage(pxCloudArt(w, 80 + k, "day"), Math.round(x), CM_H - 34 + (k % 3) * 6);
  }
  for (let x = 0; x < CM_W; x++) {
    const hh = 12 + Math.round(Math.sin((x + t * 4) * 0.11) * 3 + Math.sin((x - t * 2.5) * 0.29) * 2);
    pxFill(g, x, CM_H - hh, 1, hh, "#fbe9dc");
    pxDot(g, x, CM_H - hh, "#ffffff");
  }
}

/* ----- Crisp things drawn over the scaled-up world: names, numbers, rings ----- */
function cmDrawOverlay(g, t) {
  const z = cmCam.z;
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  CAMP.islands.forEach((isl, i) => {
    const c = CM_CENTERS[i];
    const open = campIslandOpen(isl.id);
    if (z < 6) {
      const [x, y] = cmToScreen(c[0] - 150, c[1] - 112);
      const fs = Math.max(13, Math.min(24, z * 6));
      g.font = `700 ${fs}px 'Pixelify Sans', system-ui, sans-serif`;
      const text = open ? `${isl.n}. ${isl.name}` : `${isl.n}. ${isl.name} · in the clouds`;
      const w = g.measureText(text).width + fs * 1.6;
      const hgt = fs * 1.7;
      g.fillStyle = "rgba(14,10,30,0.72)";
      g.fillRect(x - w / 2, y - hgt / 2, w, hgt);
      g.strokeStyle = isl.colors.accent;
      g.lineWidth = 2;
      g.strokeRect(x - w / 2 + 3, y - hgt / 2 + 3, w - 6, hgt - 6);
      g.fillStyle = open ? "#fff6dc" : "#aab0ba";
      g.fillText(text, x, y + 1);
    }
    if (!open) return;
    Object.keys(CM_NODES).forEach(k => {
      const node = isNaN(+k) ? k : +k;
      const p = cmPos(isl.id, node, t);
      const st = cmNodeState(isl.id, node);
      const sel = cmSel && cmSel.isl === isl.id && cmSel.node === node;
      const hov = cmHover && cmHover.isl === isl.id && cmHover.node === node;
      const [x, y] = cmToScreen(p.x, p.y);
      const big = typeof node === "string";
      if (st === "next") {
        const pul = 0.5 + 0.5 * Math.sin(t * 4);
        g.strokeStyle = `rgba(255,236,120,${0.45 + 0.5 * pul})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y - z, (8 + pul * 2) * z, (4 + pul) * z, 0, 0, Math.PI * 2); g.stroke();
      }
      if (sel || hov) {
        g.strokeStyle = sel ? "#ffffff" : "rgba(255,255,255,0.6)";
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        g.lineDashOffset = -t * 20;
        const rx = (big ? 16 : 9) * z;
        g.beginPath(); g.ellipse(x, y - (big ? 4 : 1) * z, rx, rx * 0.5, 0, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
      }
      if (typeof node === "number" && z >= 2.2) {
        const fs = Math.max(11, Math.min(18, z * 3.4));
        g.font = `700 ${fs}px 'Pixelify Sans', system-ui, sans-serif`;
        g.fillStyle = "rgba(0,0,0,0.65)";
        g.fillText(String(node), x + 1, y + 4.6 * z + 1);
        g.fillStyle = st === "won" ? "#ffe8a0" : st === "locked" ? "#c8ccd4" : "#ffffff";
        g.fillText(String(node), x, y + 4.6 * z);
      }
    });
  });
  g.restore();
}
