/* =========================================================
   src/ui/map-isles.js
   What grows on the five islands: their ground, rock and scenery,
   the little pictures at every stop, the shopkeepers, and the living
   details (flags, waterfalls, sails, beams, smoke).

   Painted the way the rest of the map is (src/ui/map.js): one map
   pixel at a time, flat colors lit from the top left, no outlines.
   Positions are written along the island's flow: P(f, dy), where f
   runs from the home end (negative) to the far end, so the same
   layout works on islands that run left and islands that run right.
   ========================================================= */
"use strict";

const ISLE_THEME = {
  keep: {
    rock: [["#7a5232", "#6c482b"], ["#5e4a3a", "#4e4038"], ["#57545c", "#4c4a50"]],
    dirt: ["#c8b07a", "#a08a5a", "#e8d8a8"],
    hang: ["#3e2a1a", "#5aab45"],
    lip: ["#5a3a22", "#4e321c"], vine: ["#2f6a24", "#5ab046"], moss: ["#4f8f3a", "#3f7a30"]
  },
  spire: {
    rock: [["#7a6a8a", "#6e5e80"], ["#5e5478", "#54486e"], ["#4a4462", "#403a58"]],
    dirt: ["#9a9ad8", "#6a6aa8", "#d8d8ff"],
    hang: ["#7fe3ff", "#b36bff"],
    lip: ["#3e3460", "#362c54"], vine: ["#3a8a9a", "#7fe3ff"], moss: ["#5a8ab8", "#4a7aa8"]
  },
  hollow: {
    rock: [["#8a5a2a", "#7a4e24"], ["#6a4a30", "#5c4028"], ["#4e4440", "#443c38"]],
    dirt: ["#d8b070", "#a8803e", "#f0d8a0"],
    hang: ["#5a3a1a", "#c8a040"],
    lip: ["#5a3a1a", "#4e3216"], vine: ["#5a6a1a", "#c8a030"], moss: ["#8a8a34", "#7a7a2e"]
  },
  reef: {
    rock: [["#e0c890", "#d4b880"], ["#c88a7a", "#b87a6a"], ["#8a6a7a", "#7a5e6e"]],
    dirt: ["#a8784a", "#6a4a2a", "#c8986a"],
    hang: ["#3a8a5a", "#ff8a9a"],
    lip: ["#c8a870", "#b89860"], vine: ["#2a6a4a", "#3a9a5a"], moss: null, dots: "#f4ece0"
  },
  crown: {
    rock: [["#3a2a2a", "#322424"], ["#2a2028", "#241c22"], ["#1e1a20", "#18141a"]],
    dirt: ["#6a5050", "#4a3434", "#9a7a6a"],
    hang: ["#1a1418", "#ff6a1a"],
    lip: ["#241a1c", "#1e1618"], vine: null, moss: null
  }
};
const isleDirt = key => ISLE_THEME[key].dirt;

/* ----- Each island's own shape -----
   The grassy top is seen from above at a slant, so every column of it has a back rim and a
   front rim. hw: half its width toward the home end and toward the far end. p: how square
   those ends are (2 is an oval). th: how far the back and front rims sit from the middle.
   bumps: headlands (+) and coves (-) on the rims, [f, width, front, back]. jag: how ragged the
   rim is. facet: cut the rim into straight edges this long. teeth: a broken, saw-toothed rim.
   lobes: knolls and spits joined to the top, [f, dy, rx, ry, depth].
   The rock below is a stack of ever smaller copies of the outline, one per row down, so its
   layers curve the way the front rim does and its sides slope in like the underside of a
   real island. depth: how far it hangs. taper: how wide each row is, from the top (0) to
   the bottom (1). lean: the bottom drifts this far per row, toward the far end (+) or home
   (-). rag: how ragged its sides are. spikes: points hanging off the bottom, [f, half width,
   length, stuff]. islets: rocks floating nearby, [f, dy, width, kind]. */
const ISLE_SHAPE = {
  // Brightscale Keep: a rounded green meadow, the castle on a headland, a deep cone of earth
  keep: {
    hw: [154, 158], p: [2.5, 2.7], th: [32, 33], jag: 0.8,
    bumps: [[-92, 24, 0, 7], [-150, 12, 4, 3], [74, 30, 5, 0], [28, 6, -4, 0], [118, 14, 0, 3]],
    lobes: [],
    depth: 84, lean: -0.22, rag: 0.12,
    taper: zn => zn < 0.05 ? 1 - zn * 0.5 : Math.pow(1 - zn, 1.2) * 0.98,
    spikes: [[-38, 15, 24, "rock"], [36, 9, 16, "rock"], [-88, 6, 10, "rock"], [86, 5, 8, "rock"]],
    hangers: 16, vines: 14,
    islets: [[242, 38, 30, "meadow"], [-168, -72, 18, "rocks"], [287, 68, 13, "rocks"]]
  },
  // Arcanum Spire: cut like a gem, square-ended, with crystals growing out of its underside
  spire: {
    hw: [154, 154], p: [3.6, 3.2], th: [30, 32], jag: 0.3, facet: 13,
    bumps: [[-92, 20, 0, 6], [-20, 30, 4, 0], [92, 20, 0, 4]],
    lobes: [],
    depth: 70, lean: 0.08, rag: 0.06,
    taper: zn => Math.pow(1 - zn, 0.78),
    spikes: [[-104, 7, 30, "crystal"], [-58, 11, 46, "crystal"], [-14, 6, 26, "crystal"], [28, 10, 40, "crystal"], [74, 6, 24, "crystal"], [112, 5, 16, "crystal"]],
    hangers: 10, vines: 8,
    islets: [[-208, 16, 16, "crystal"], [196, 44, 20, "crystal"], [-170, 92, 11, "crystal"]]
  },
  // Feastwood Hollow: a broad, soft farm on tiers of earth, with a knoll past the far end
  hollow: {
    hw: [160, 156], p: [2.6, 2.6], th: [32, 34], jag: 0.7,
    bumps: [[-92, 22, 0, 5], [-40, 26, 3, 0], [60, 40, 3, 2]],
    lobes: [[176, -2, 30, 17, 30]],
    depth: 60, lean: 0, rag: 0.05,
    taper: zn => zn < 0.72 ? 1 - Math.floor(zn / 0.18) * 0.1 - zn * 0.05 : 0.6 * Math.pow(1 - (zn - 0.72) / 0.28, 0.7),
    spikes: [[-64, 16, 14, "rock"], [18, 22, 18, "rock"], [94, 12, 10, "rock"]],
    hangers: 26, vines: 12,
    islets: [[-214, 30, 22, "hay"], [262, 20, 14, "rocks"]]
  },
  // Tidecoil Reef: a sandy bowl of coral and sandstone, a sandbar trailing off its far end
  reef: {
    hw: [152, 158], p: [2.4, 2.8], th: [32, 33], jag: 0.6,
    bumps: [[-20, 50, 6, 0], [28, 12, 0, -4], [-148, 12, 0, 5]],
    lobes: [[184, 15, 38, 7, 10], [-162, -12, 18, 12, 30]],
    depth: 68, lean: 0.12, rag: 0.08,
    taper: zn => Math.pow(1 - Math.pow(zn, 1.5), 0.85),
    spikes: [[-70, 14, 16, "coral"], [-14, 18, 20, "coral"], [46, 12, 14, "coral"], [100, 9, 10, "coral"]],
    hangers: 18, vines: 12,
    islets: [[-187, -54, 22, "palm"], [268, 46, 12, "rocks"]]
  },
  // Cinder Crown: a broken, jagged crown of ash on a deep black spike of rock
  crown: {
    hw: [154, 156], p: [2.4, 2.6], th: [31, 32], jag: 1.0, teeth: 2.6,
    bumps: [[-92, 20, 0, 6], [-62, 8, -3, 0], [100, 12, 0, 4], [60, 30, 4, 0]],
    lobes: [[136, 22, 24, 11, 34]],
    depth: 80, lean: -0.3, rag: 0.22,
    taper: zn => Math.pow(1 - zn, 0.9) * (zn < 0.04 ? 1 : 0.97),
    spikes: [[-58, 10, 30, "obsidian"], [-18, 13, 34, "obsidian"], [-104, 6, 16, "obsidian"], [44, 6, 10, "obsidian"]],
    hangers: 12, vines: 0,
    islets: [[246, 24, 18, "cinder"], [296, -46, 14, "cinder"], [-198, -48, 10, "cinder"]]
  }
};
Object.keys(ISLE_SHAPE).forEach(k => { if (ISLANDS[k]) ISLANDS[k].depth = ISLE_SHAPE[k].depth; });

/* An island's outline, worked out once: for every column of its canvas (x from -reach to
   reach, the middle at 0), the main top's [back, front] and the whole top's, knolls and spits
   included. back and front: how far its grass reaches above and below the middle. */
const isleForms = {};
function isleForm(key) {
  if (isleForms[key]) return isleForms[key];
  const S = ISLE_SHAPE[key], isl = ISLANDS[key], d = isl.dir, seed = isl.n * 31 + 7;
  const raw = f => {
    const end = f < 0 ? 0 : 1, u = Math.abs(f) / S.hw[end];
    if (u >= 1) return null;
    const e = Math.pow(1 - Math.pow(u, S.p[end]), 1 / S.p[end]);
    let back = S.th[0] * e, front = S.th[1] * e;
    const fade = Math.min(1, e * 3);
    S.bumps.forEach(([bf, bw, bfr, bbk]) => { const k = Math.exp(-Math.pow((f - bf) / bw, 2)) * fade; front += bfr * k; back += bbk * k; });
    const q = f + 400;
    front += ((mapNoise(q, 3, 5, seed) - 0.5) * 2 + (mapHash(q, 4, seed) - 0.5) * 0.7) * S.jag * fade;
    back += ((mapNoise(q, 7, 5, seed) - 0.5) * 2 + (mapHash(q, 8, seed) - 0.5) * 0.7) * S.jag * fade;
    if (S.teeth) {
      const tri = v => 1 - Math.abs((((v % 14) + 14) % 14) / 7 - 1);
      front += S.teeth * tri(q + 5) * mapNoise(q, 2, 10, seed) * fade;
      back += S.teeth * tri(q) * mapNoise(q, 6, 10, seed) * fade;
    }
    return front + back < 1 ? null : [-back, front];
  };
  // a gem's facets: the rim sampled every few pixels and joined with straight edges
  const faceted = f => {
    const F = S.facet, k = Math.floor(f / F), t = f / F - k;
    const a = raw(k * F), b = raw((k + 1) * F);
    if (!a || !b) return raw(f);
    const j = k2 => (mapHash(k2, 5, seed) - 0.5) * 1.6;
    const back = a[0] + (b[0] - a[0]) * t + j(k) * (1 - t) + j(k + 1) * t;
    const front = a[1] + (b[1] - a[1]) * t - j(k + 7) * (1 - t) - j(k + 8) * t;
    return front - back < 1 ? null : [back, front];
  };
  const reach = Math.ceil(Math.max(S.hw[0], S.hw[1], ...S.lobes.map(l => Math.abs(l[0]) + l[2])) + 6 + Math.abs(S.lean) * S.depth);
  const main = [], top = [];
  let back = 0, front = 0;
  for (let x = -reach; x <= reach; x++) {
    const f = d * x;
    const span = S.facet ? faceted(f) : raw(f);
    main.push(span);
    let t = span ? span.slice() : null;
    S.lobes.forEach(([lf, ldy, rx, ry]) => {
      const u = Math.abs(f - lf) / rx;
      if (u >= 1) return;
      const e = Math.pow(1 - Math.pow(u, 2.4), 1 / 2.4), j = (mapHash(f + 400, 9, seed) - 0.5) * 0.8;
      const ls = [ldy - ry * e - j * 0.5, ldy + ry * e + j];
      t = t ? [Math.min(t[0], ls[0]), Math.max(t[1], ls[1])] : ls;
    });
    top.push(t);
    if (t) { back = Math.max(back, -t[0]); front = Math.max(front, t[1]); }
  }
  const drop = S.depth + Math.max(0, ...S.spikes.map(s => s[2])) + 8;
  return (isleForms[key] = { reach, main, top, back: Math.ceil(back) + 1, front: Math.ceil(front) + 1, drop });
}

/* The grass at a spot along the island's flow: [back, front], or null past its edge */
function isleSpan(key, f) {
  const form = isleForm(key);
  const i = Math.round(ISLANDS[key].dir * f) + form.reach;
  return form.top[i] || null;
}
const isleFront = (key, f) => (isleSpan(key, f) || [0, ISLANDS[key].th])[1];
const isleBack = (key, f) => (isleSpan(key, f) || [-ISLANDS[key].th, 0])[0];

/* ----- Painting the rock: a depth buffer of slices -----
   Each body (the island, its knolls, the spikes under it) is a stack of slices: row z of it
   is its outline shrunk by taper(z / depth) and lowered by z. The first slice to reach a
   pixel owns it, so a pixel knows how deep it is (its layer of rock) and where it sits
   across its slice (u, -1 at the lit left edge to 1 at the shaded right). */
function isleBuffer(W, H) {
  return { W, H, Z: new Int16Array(W * H).fill(-1), U: new Float32Array(W * H), B: new Uint8Array(W * H), img: new ImageData(W, H) };
}
const isleRgbMemo = new Map();
function isleSet(buf, x, y, hex) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= buf.W || y >= buf.H) return;
  let c = isleRgbMemo.get(hex);
  if (!c) { c = hexToRgb(hex); isleRgbMemo.set(hex, c); }
  const i = (y * buf.W + x) * 4, px = buf.img.data;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
}
const isleShadeMemo = new Map();
function isleShade(hex, k) {
  const key = hex + k;
  let v = isleShadeMemo.get(key);
  if (!v) { v = shadeHex(hex, k); isleShadeMemo.set(key, v); }
  return v;
}
const isleEllipse = (rx, ry, p = 2.2) => xr => {
  const u = Math.abs(xr) / rx;
  if (u >= 1) return null;
  const e = Math.pow(1 - Math.pow(u, p), 1 / p);
  return [-ry * e, ry * e];
};
function isleFill(buf, body, id) {
  const { W, H, Z, U, B } = buf;
  let tipY = -1, tipX = 0;
  for (let z = 0; z <= body.depth; z++) {
    const s = body.taper(z / body.depth);
    if (!(s > 0.03)) break;
    // ragged sides only ever bite in: the rock never pokes out past the grass above it
    const nl = 1 - Math.abs(mapNoise(z, 1, 5, body.seed) - 0.5) * body.rag * 1.6;
    const nr = 1 - Math.abs(mapNoise(z, 9, 5, body.seed) - 0.5) * body.rag * 1.6;
    const ox = body.x + body.lean * z, oy = body.y + z;
    const x0 = Math.max(0, Math.floor(ox - body.half[0] * s * nl)), x1 = Math.min(W - 1, Math.ceil(ox + body.half[1] * s * nr));
    for (let x = x0; x <= x1; x++) {
      const rx = x - ox, sx = s * (rx < 0 ? nl : nr);
      const span = body.rim(rx / sx);
      if (!span) continue;
      const u = rx / ((rx < 0 ? body.half[0] : body.half[1]) * sx);
      const y0 = Math.max(0, Math.ceil(oy + span[0] * s)), y1 = Math.min(H - 1, Math.floor(oy + span[1] * s));
      for (let y = y0; y <= y1; y++) {
        const i = y * W + x;
        if (Z[i] >= 0) continue;
        Z[i] = body.z0 + z; U[i] = u; B[i] = id;
        if (y > tipY) { tipY = y; tipX = x; }
      }
    }
  }
  return [tipX, tipY];
}

/* What the spikes are made of: crystal, obsidian or coral, each lit from the top left */
const ISLE_STUFF = {
  crystal: [["#e8fbff", "#7fe3ff", "#3aa8d8", "#24608a"], ["#f4e0ff", "#c890ff", "#8a50d8", "#4e2a8a"]],
  obsidian: [["#5a4a5e", "#2e2430", "#221a24", "#161018"]],
  coral: [["#ffc0c8", "#ff8a9a", "#d8607a", "#a84060"], ["#ffd0a0", "#ff9a5a", "#d8703a", "#a8502a"]]
};
function isleStuffColor(stuff, k, u, x, y, z, seed) {
  const P = ISLE_STUFF[stuff][k % ISLE_STUFF[stuff].length];
  let i = u < -0.45 ? 0 : u < 0.05 ? 1 : u < 0.55 ? 2 : 3;
  if (stuff === "crystal" && Math.abs(u + 0.15) < 0.12) i = 0;                          // the bright edge between two faces
  if (stuff === "obsidian") { if (Math.abs(mapNoise(x, y, 4, seed) - 0.5) < 0.035) return y % 2 ? "#ff6a1a" : "#ffb020"; if (i === 0 && (x + y) % 3) i = 1; }
  if (stuff === "coral" && mapHash(x, y, seed + 3) > 0.88) return "#7a2a40";            // the little holes
  return P[i];
}

/* The rock, the soil lip and the grass for one island (or an islet), into its canvas.
   Returns the tips of its spikes (where drips fall from). */
function paintIsleBody(g, key, cx, cy, fog, haze) {
  const isl = ISLANDS[key], S = ISLE_SHAPE[key], form = isleForm(key), d = isl.dir;
  const seed = isl.n * 31 + 7, R = form.reach;
  const buf = isleBuffer(g.canvas.width, g.canvas.height);
  const bodies = [];
  // the real half widths of the main top, left and right of the middle, for its light and shade
  let L = 0, Rr = 0;
  form.main.forEach((s, i) => { if (s) { const x = i - R; if (x < 0) L = Math.max(L, -x); else Rr = Math.max(Rr, x); } });
  // the island itself, then its knolls and spits, then the spikes under it
  bodies.push({ x: cx, y: cy, half: [L + 1, Rr + 1], rim: xr => form.main[Math.round(xr) + R] || null, depth: S.depth, taper: S.taper, lean: d * S.lean, rag: S.rag, seed, z0: 0, stuff: "rock", lip: true });
  S.lobes.forEach(([lf, ldy, rx, ry, ld], k) => bodies.push({ x: cx + d * lf, y: cy + ldy, half: [rx, rx], rim: isleEllipse(rx, ry, 2.4), depth: ld, taper: zn => Math.pow(1 - zn, 1.1), lean: 0, rag: 0.12, seed: seed + 11 + k, z0: 0, stuff: "rock", lip: true }));
  bodies.forEach((b, i) => isleFill(buf, b, i));
  // where the rock ends in each column, for the spikes and the things hanging off it
  const bottom = new Int16Array(buf.W).fill(-1);
  for (let x = 0; x < buf.W; x++) for (let y = buf.H - 1; y >= 0; y--) if (buf.Z[y * buf.W + x] >= 0) { bottom[x] = y; break; }
  const tips = [];
  S.spikes.forEach(([f, w, len, stuff], k) => {
    const x = Math.round(cx + d * f);
    if (bottom[x] < 0) return;
    const b = { x, y: bottom[x] - Math.round(w * 0.5), half: [w, w], rim: isleEllipse(w, w * 0.38, 2), depth: len, taper: stuff === "coral" ? zn => Math.sqrt(Math.max(0, 1 - zn * zn)) : zn => Math.pow(1 - zn, stuff === "crystal" ? 1 : 0.85), lean: d * (mapHash(k, 3, seed) - 0.5) * 0.3, rag: stuff === "crystal" ? 0 : 0.15, seed: seed + 40 + k, z0: S.depth - 2, stuff, k };
    bodies.push(b);
    tips.push(isleFill(buf, b, bodies.length - 1));
  });
  // paint every rock pixel
  const { W, H, Z, U, B } = buf;
  const T = ISLE_THEME[key];
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : Z[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, z = Z[i];
    if (z < 0) continue;
    const b = bodies[B[i]], u = U[i];
    let col;
    if (fog) { col = at(x + 1, y) < 0 ? haze(0.56) : (x + y) % 3 ? haze(0.66) : haze(0.62); isleSet(buf, x, y, col); continue; }
    const rock = b.stuff === "rock";
    if (rock && b.lip && z <= 2) col = T.lip[(x + z) & 1];
    else if (rock) {
      const band = z + mapNoise(x, z, 9, seed) * 6 - 3 + Math.sin(z * 0.35 + seed) * 1.2;
      col = isleRockColor(key, x, z, band, S.depth, seed);
      // moss and lichen on the sunny side, up near the grass
      if (T.moss && u < -0.2 && z < S.depth * 0.36 && mapNoise(x, z, 5, seed + 40) > 0.66) col = T.moss[(x + z) & 1];
      if (T.dots && z > 3 && mapHash(x, y, seed + 29) > 0.986) col = T.dots;                      // barnacles
      // cracks running down the face, and stones set in it
      const h = mapHash(x, Math.floor(z / 5), seed + 21);
      if (h > 0.972 && z % 5 < 3 && z > 4) col = isleShade(col, -0.3);
      else if (mapHash(x, y, seed + 23) > 0.993) col = isleShade(col, 0.3);
    } else col = isleStuffColor(b.stuff, b.k, u, x, y, z, seed);
    // light from the top left: bright down the left side, shaded down the right
    if (rock) {
      if (at(x + 1, y) < 0 || u > 0.9) col = isleShade(col, -0.4);
      else if (u > 0.55) col = isleShade(col, -0.17);
      else if (at(x - 1, y) < 0 || u < -0.88) col = isleShade(col, 0.2);
      else if (u < -0.45) col = isleShade(col, 0.07);
    }
    const up = at(x, y - 1), down = at(x, y + 1);
    if (down < 0) col = isleShade(col, -0.3);                                   // the underside, turning away
    else if (up >= 0 && z > 4 && up < z - 3) col = isleShade(col, -0.24);       // in the shadow of the shelf above
    else if (rock && b.lip && z === 3) col = isleShade(col, -0.2);               // the shadow under the grass
    isleSet(buf, x, y, col);
  }
  // the grass on top: brighter along the back rim, darker toward the front lip
  const [a, bb, edge] = fog ? [haze(0.84), haze(0.8), haze(0.7)] : MAP_BIOME[key];
  for (let x = -R; x <= R; x++) {
    const span = form.top[x + R];
    if (!span) continue;
    const y0 = Math.ceil(span[0]), y1 = Math.floor(span[1]);
    const first = !form.top[x + R - 1], last = !form.top[x + R + 1];
    for (let dy = y0; dy <= y1; dy++) {
      let col = ((x + dy) & 1) && mapHash(x, dy, seed + 5) > 0.45 ? bb : a;
      if (!fog) {
        col = isleGroundColor(key, x, dy, col, isl);
        if ((x + dy) & 1) { if (dy - y0 < 3) col = isleShade(col, 0.07); else if (y1 - dy < 7 && y1 - dy > 1) col = isleShade(col, -0.07); }
      }
      if (dy >= y1 - 1) col = edge;
      if (dy === y0 || (first && dy < y1 - 1)) col = fog ? haze(0.92) : isleShade(a, 0.2);
      if (last && dy > y0) col = edge;
      isleSet(buf, cx + x, cy + dy, col);
    }
    // tufts of grass spilling over the lip
    if (!fog) { const h = mapHash(x, 3, seed + 77); if (h > 0.78) isleSet(buf, cx + x, cy + y1 + 1, edge); if (h > 0.93) isleSet(buf, cx + x, cy + y1 + 2, isleShade(edge, -0.15)); }
  }
  g.putImageData(buf.img, 0, 0);
  if (fog) return { tips };
  // roots, crystals, kelp or drips: off the bottom of the rock, and out of its face
  for (let k = 0; k < (S.hangers || 0); k++) {
    const x = Math.round(cx + (mapHash(k, seed, 5) - 0.5) * 2 * Math.min(L, Rr) * 0.86);
    if (bottom[x] < 0) continue;
    const span = form.top[x - cx + R];
    const face = span && mapHash(k, seed, 6) < 0.4;
    const yTop = span ? cy + Math.floor(span[1]) + 4 : bottom[x] - 4;
    const y0 = face ? yTop + Math.round(mapHash(k, seed, 9) * Math.max(0, bottom[x] - yTop) * 0.55) : bottom[x] - 1;
    isleHanging(g, key, x, y0, 3 + Math.floor(mapHash(k, seed, 11) * 10), k);
  }
  // vines and moss trailing down from under the grass
  if (T.vine) for (let k = 0; k < (S.vines || 0); k++) {
    const x = Math.round(cx + (mapHash(k, seed, 31) - 0.5) * 2 * Math.min(L, Rr) * 0.9);
    const span = form.top[x - cx + R];
    if (!span) continue;
    const y0 = cy + Math.floor(span[1]) + 1, len = 4 + Math.floor(mapHash(k, seed, 33) * 12);
    for (let r = 0; r < len; r++) {
      const vx = x + Math.round(Math.sin(r * 0.7 + k) * 0.7);
      if (at(vx, y0 + r) < 0) break;
      mapRect(g, vx, y0 + r, 1, 1, T.vine[0]);
      if (r % 3 === 1) mapRect(g, vx + (r % 2 ? 1 : -1), y0 + r, 1, 1, T.vine[1]);
    }
  }
  return { tips: tips.filter(t => t[1] > 0) };
}

/* ----- The islets: little rocks floating near each island, bobbing on their own ----- */
const isletCache = {};
function isletArt(key, k) {
  const id = key + ":" + k;
  if (isletCache[id]) return isletCache[id];
  const [, , w, kind] = ISLE_SHAPE[key].islets[k];
  const isl = ISLANDS[key], seed = isl.n * 53 + k * 7 + 3;
  const hw = w / 2, th = Math.max(3, Math.round(w * 0.2)), depth = Math.round(w * 0.95);
  const W = w + 14, H = 22 + th * 2 + depth + 6;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const cx = Math.floor(W / 2), cy = 22 + th;
  const buf = isleBuffer(W, H);
  const rim = xr => { const u = Math.abs(xr) / hw; if (u >= 1) return null; const e = Math.pow(1 - Math.pow(u, 2.3), 1 / 2.3); return [-th * e, th * e + (mapHash(Math.round(xr) + 60, k, seed) - 0.5) * 0.8]; };
  isleFill(buf, { x: cx, y: cy, half: [hw, hw], rim, depth, taper: zn => Math.pow(1 - zn, 1.05), lean: (mapHash(k, 1, seed) - 0.5) * 0.4, rag: 0.3, seed, z0: 0 }, 0);
  const sand = kind === "palm", T = ISLE_THEME[key];
  const [a, b, edge] = sand ? ["#f0e2ae", "#e8d8a0", "#c8b07a"] : MAP_BIOME[key];
  const { Z, U } = buf;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : Z[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Z[y * W + x];
    if (z < 0) continue;
    const dy = y - cy, xr = x - cx, sp = rim(xr);
    let col;
    if (sp && dy <= sp[1]) {
      col = ((x + y) & 1) ? b : a;
      if (dy >= sp[1] - 1) col = edge;
      if (dy <= Math.ceil(sp[0]) || at(x - 1, y) < 0) col = isleShade(a, 0.2);
    } else {
      col = z <= 1 ? T.lip[(x + z) & 1] : isleRockColor(key, x, z, z * 2.6 + 6, depth * 2.6, seed);
      const u = U[y * W + x];
      if (at(x + 1, y) < 0 || u > 0.8) col = isleShade(col, -0.4);
      else if (at(x - 1, y) < 0 || u < -0.7) col = isleShade(col, 0.18);
      if (at(x, y + 1) < 0) col = isleShade(col, -0.3);
    }
    isleSet(buf, x, y, col);
  }
  g.putImageData(buf.img, 0, 0);
  const R = (x, y, ww, hh, cc) => mapRect(g, x, y, ww, hh, cc);
  const top = cy - 1;
  if (kind === "meadow") { isleTree(g, cx - 3, top + 1, "#3f8a3a", "#2f6a24", "#ff3b3b", 4); isleTuft(g, cx + 6, top + 1, "#4f8f3a"); R(cx + 3, top, 1, 1, "#ffe066"); R(cx - 9, top + 1, 1, 1, "#ff9ad5"); }
  else if (kind === "rocks") { isleRock(g, cx - 1, top + 2, 2, key === "crown" ? "#4a3a3a" : "#9a9a9a"); if (key !== "crown") isleTuft(g, cx + 3, top + 1, isleShade(a, -0.3)); }
  else if (kind === "crystal") { [[-3, 6, "#7fe3ff"], [0, 9, "#b36bff"], [3, 5, "#7fe3ff"]].forEach(([dx, hh, cc]) => { R(cx + dx, top - hh + 1, 2, hh, cc); R(cx + dx, top - hh + 1, 1, hh, isleShade(cc, 0.4)); R(cx + dx + 1, top - hh + 1, 1, 1, "#ffffff"); }); }
  else if (kind === "hay") { R(cx - 4, top - 3, 8, 4, "#e8c860"); R(cx - 3, top - 4, 6, 1, "#f8e090"); R(cx - 4, top - 1, 8, 1, "#c8a040"); R(cx + 5, top - 1, 3, 2, "#ff8c1a"); R(cx + 6, top - 2, 1, 1, "#3a6a1a"); }
  else if (kind === "palm") { R(cx, top - 8, 1, 9, "#8a6a3a"); R(cx + 1, top - 5, 1, 2, "#8a6a3a"); R(cx - 4, top - 9, 4, 1, "#3a9a4a"); R(cx + 1, top - 9, 4, 1, "#3a9a4a"); R(cx - 5, top - 8, 1, 1, "#2a7a3a"); R(cx + 5, top - 8, 1, 1, "#2a7a3a"); R(cx - 1, top - 10, 3, 1, "#5aba5a"); R(cx + 3, top, 2, 1, "#fff0e0"); }
  else if (kind === "cinder") { R(cx - 2, top - 1, 5, 2, "#1a1418"); R(cx - 1, top - 2, 3, 1, "#2e2428"); R(cx, top - 1, 1, 1, "#ff6a1a"); }
  return (isletCache[id] = { c, ox: cx, oy: cy });
}

/* ----- The rock under each island ----- */
function isleRockColor(key, x, r, band, depth, seed) {
  const T = ISLE_THEME[key].rock;
  const layer = band < depth * 0.26 ? 0 : band < depth * 0.62 ? 1 : 2;
  const [c0, c1] = T[layer];
  let col = ((x + r) & 1) && mapHash(x, r, seed + layer) > 0.5 ? c1 : c0;
  // a darker seam where two layers meet
  if (Math.abs(band - depth * 0.26) < 0.7 || Math.abs(band - depth * 0.62) < 0.7) col = shadeHex(c1, -0.18);
  const h = mapHash(x, r, seed + 17);
  if (key === "spire" && layer > 0 && h > 0.994 && mapNoise(x, r, 7, seed) > 0.55) col = h > 0.997 ? "#d8b0ff" : "#7fe3ff";   // crystal veins
  if (key === "crown" && mapNoise(x, r, 6, seed + 3) > 0.8 && Math.abs(mapNoise(x, r * 1.6, 4, seed + 9) - 0.5) < 0.03) col = r > depth * 0.5 ? "#ff7a1a" : "#c8401a";   // lava cracks
  if (key === "reef" && layer === 1 && h > 0.982) col = "#fff0e0";                               // shells in the sandstone
  if (key === "hollow" && layer === 0 && h > 0.975) col = "#c8a040";                             // buried roots, catching light
  if (key === "keep" && layer === 1 && h > 0.988) col = "#a8a4b0";                               // a glint of flint
  return col;
}

/* Roots, crystals, kelp or lava drips hanging under the rock */
function isleHanging(g, key, x, y0, len, k) {
  const [a, b] = ISLE_THEME[key].hang;
  for (let r = 0; r < len; r++) {
    let col = a;
    if (key === "spire") { col = r < len - 2 ? "#4e4060" : (k % 2 ? a : b); if (r >= len - 3) mapRect(g, x, y0 + r, 1, 1, col); else mapRect(g, x, y0 + r, r < 2 ? 2 : 1, 1, col); continue; }
    if (key === "crown") { col = r === len - 1 ? b : a; mapRect(g, x, y0 + r, r < len / 2 ? 2 : 1, 1, col); continue; }
    if (key === "reef") col = r % 3 === 1 ? shadeHex(a, 0.2) : a;
    if (r === len - 1) col = b;
    mapRect(g, x + (r > 2 && (k % 2) ? 1 : 0) + (key === "reef" ? Math.round(Math.sin(r * 0.9 + k) * 0.6) : 0), y0 + r, 1, 1, col);
  }
}

/* ----- The ground: patches of meadow, sand, wheat or cooling ash ----- */
function isleGroundColor(key, x, dy, col, isl) {
  const n = mapNoise(x + 200, dy + 200, 14, isl.n + 3);
  const h = mapHash(x, dy, isl.n + 61);
  if (key === "keep") {
    if (n > 0.66) return ((x + dy) & 1) ? "#79b85a" : "#6aa84f";
    if (n < 0.28) return ((x + dy) & 1) ? "#5a9a44" : "#61a049";
    if (h > 0.992) return ["#ff6b6b", "#ffe066", "#ffffff", "#ff9ad5"][Math.floor(h * 1000) % 4];
  } else if (key === "spire") {
    if (n > 0.66) return ((x + dy) & 1) ? "#7470c4" : "#6c68bc";
    if (n < 0.3) return ((x + dy) & 1) ? "#3e6a9a" : "#447096";
    if (n < 0.38) return ((x + dy) & 1) ? "#4a5ea4" : "#5060a8";
    if (h > 0.99) return h > 0.996 ? "#bff4ff" : "#d8b0ff";
  } else if (key === "hollow") {
    if (n > 0.62) return ((x + dy) & 1) ? "#c8b050" : "#d0b858";
    if (n < 0.3) return ((x + dy) & 1) ? "#8a8a34" : "#94903a";
    if (h > 0.986) return h > 0.994 ? "#ff8c1a" : "#c8402a";
  } else if (key === "reef") {
    // sand toward the front, sea grass toward the back
    const sand = dy / isl.th + (n - 0.5) * 1.1 > -0.15;
    if (sand) return ((x + dy) & 1) && h > 0.4 ? "#e8d8a0" : "#f0e2ae";
    if (h > 0.985) return "#ff9aa8";
  } else if (key === "crown") {
    if (n > 0.64) return ((x + dy) & 1) ? "#5a3434" : "#543030";
    if (n < 0.3) return ((x + dy) & 1) ? "#3a2a2e" : "#42302f";
    if (mapNoise(x + 50, dy, 11, isl.n + 8) > 0.6 && Math.abs(mapNoise(x, dy * 2, 9, isl.n + 5) - 0.5) < 0.022) return "#ff6a1a";
    if (h > 0.99) return "#ffb020";
  }
  return col;
}

/* ----- Small things to put on the ground ----- */
function isleTree(g, x, y, canopy, dark, fruit, h = 4) {
  mapRect(g, x, y - h + 2, 1, h, "#5a3a22");
  mapRect(g, x - 3, y - h - 2, 7, 3, canopy);
  mapRect(g, x - 2, y - h - 3, 5, 1, canopy);
  mapRect(g, x - 2, y - h + 1, 5, 1, dark);
  mapRect(g, x - 2, y - h - 2, 2, 1, shadeHex(canopy, 0.25));
  if (fruit) { mapRect(g, x - 1, y - h - 1, 1, 1, fruit); mapRect(g, x + 2, y - h, 1, 1, fruit); }
}
function islePine(g, x, y, c, h = 8) {
  mapRect(g, x, y - 1, 1, 2, "#4a3020");
  for (let j = 0; j < h; j++) {
    const w = 1 + Math.floor((j % 3 === 0 ? j - 1 : j) / 2) * 2;
    mapRect(g, x - Math.floor(w / 2), y - h + j - 1, w, 1, j % 3 === 0 ? shadeHex(c, 0.15) : c);
  }
}
function isleRock(g, x, y, s, c = "#9a9a9a") {
  mapRect(g, x - s, y - s + 1, s * 2 + 1, s, shadeHex(c, -0.3));
  mapRect(g, x - s + 1, y - s, s * 2 - 1, s, c);
  mapRect(g, x - s + 1, y - s, 1, 1, shadeHex(c, 0.35));
}
function isleTuft(g, x, y, c) { mapRect(g, x, y - 1, 1, 1, c); mapRect(g, x - 1, y, 1, 1, c); mapRect(g, x + 1, y, 1, 1, c); }
function isleHouse(g, x, y, w, h, wall, roof, door = "#4a3020") {
  mapRect(g, x, y - h, w, h, wall);
  mapRect(g, x + w - 1, y - h, 1, h, shadeHex(wall, -0.25));
  for (let j = 0; j < Math.ceil(w / 2) + 1; j++) mapRect(g, x - 1 + j, y - h - 1 - j, w + 2 - j * 2, 1, j ? roof : shadeHex(roof, -0.25));
  mapRect(g, x + Math.floor(w / 2), y - 3, 1, 3, door);
  if (w >= 6) mapRect(g, x + 1, y - h + 2, 1, 1, "#ffe08a");
}

/* An island's flow coordinates on its own canvas */
function isleAt(key, cx, cy) {
  const d = ISLANDS[key].dir;
  return (f, dy) => [Math.round(cx + d * f), Math.round(cy + dy)];
}

/* ----- The scenery: "under" goes beneath the paths, "over" sits on top of them ----- */
function paintIsleScenery(g, key, cx, cy, isl, pass) {
  const P = isleAt(key, cx, cy);
  const d = isl.dir;
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  const rnd = seededRandom(isl.n * 97 + (pass === "over" ? 5 : 1));
  const reach = isleForm(key).reach;
  // a spot is free when it's on the grass clear of the rim, away from every stop and the landmark
  const onGrass = (f, dy, m) => [f - 4, f, f + 4].every(ff => { const s = isleSpan(key, ff); return s && dy > s[0] + m && dy < s[1] - m; });
  const free = (f, dy, m = 3, gap = 1) => NODE_ORDER.every(id => { const [nf, ndy] = NODE_SPOTS[id]; return Math.abs(nf - f) > 9 * gap || Math.abs(ndy - dy) > 7 * gap; })
    && onGrass(f, dy, m) && !(Math.abs(f - LANDMARK_SPOT[0]) < 26 && dy < LANDMARK_SPOT[1] + 8);
  // a few spots in the gaps between the rows
  const scatter = (n, rows, fn) => {
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const f = (rnd() - 0.5) * isl.w * 0.92, dy = rows[Math.floor(rnd() * rows.length)] + Math.round((rnd() - 0.5) * 3);
      if (!free(f, dy)) continue;
      fn(...P(f, dy), i++);
    }
  };
  // spots anywhere on the grass, knolls and spits too
  const sprinkle = (n, fn, m = 2, gap = 0.6) => {
    for (let i = 0, tries = 0; i < n && tries < n * 14; tries++) {
      const f = (rnd() - 0.5) * 2 * (reach - 4), s = isleSpan(key, f);
      if (!s) continue;
      const dy = Math.round(s[0] + 2 + rnd() * (s[1] - s[0] - 4));
      if (!free(f, dy, m, gap)) continue;
      fn(...P(f, dy), i++, f, dy);
    }
  };
  const pondY = Math.round(isleFront(key, -40) - 4.5);
  if (pass === "under") {
    paintIsleGround(g, key, P, sprinkle, R);
    if (key === "keep") {
      // a pond at the front, spilling off the edge (the falls are drawn live)
      const [px, py] = P(-40, pondY);
      for (let j = -2; j <= 2; j++) { const w = 13 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#5a9ad8" : "#3f7fbf"); }
      R(px - 4, py - 2, 3, 1, "#bfe0ff");
      // wheat by the farm, hives by the gate
      for (let i = 0; i < 4; i++) { const [x, y] = P(-108 + i * 7, 7); for (let k = 0; k < 5; k++) R(x + k, y - (k % 2), 1, 2, k % 2 ? "#e0c060" : "#c8a040"); }
      // the jousting lists: a long fence
      { const [x0, y0] = P(-10, -13); const [x1] = P(60, -13); const a = Math.min(x0, x1), b = Math.max(x0, x1); for (let x = a; x <= b; x++) { R(x, y0, 1, 1, "#8a5a30"); if ((x - a) % 4 === 0) R(x, y0 - 2, 1, 3, "#5a3a20"); } }
    } else if (key === "spire") {
      // arcane circles, glowing faintly in the grass
      [[-100, 7], [20, -13], [-30, 7]].forEach(([f, dy], i) => {
        const [x, y] = P(f, dy);
        for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; R(x + Math.cos(t) * 6, y + Math.sin(t) * 2.4, 1, 1, i % 2 ? "#9a8af0" : "#7fe3ff"); }
        R(x - 1, y, 3, 1, "#d8c8ff");
      });
      // a pool of starlight at the front
      const [px, py] = P(-40, pondY);
      for (let j = -2; j <= 2; j++) { const w = 13 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#5a5ad8" : "#3a3aa0"); }
    } else if (key === "hollow") {
      // crop rows: furrowed soil and green shoots
      [[-110, 7, 26], [20, -13, 34], [-30, 7, 14]].forEach(([f, dy, w]) => {
        const [x0, y] = P(f, dy), x1 = P(f + w, dy)[0];
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { R(x, y - 1, 1, 1, "#7a5a2a"); R(x, y + 1, 1, 1, "#7a5a2a"); if (x % 2) R(x, y, 1, 1, "#5a8a2a"); }
      });
      // a duck pond at the front
      const [px, py] = P(-40, pondY);
      for (let j = -2; j <= 2; j++) { const w = 13 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#6aaac0" : "#4a8fa0"); }
    } else if (key === "reef") {
      // tide pools
      [[-40, pondY, 13], [-100, 7, 11], [26, -13, 9]].forEach(([f, dy, w0]) => {
        const [px, py] = P(f, dy);
        for (let j = -2; j <= 2; j++) { const w = w0 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#3a8ac0" : "#1a5a8a"); }
        R(px - 2, py - 1, 2, 1, "#9ad8ff");
      });
    } else if (key === "crown") {
      // lava pools, crusted at the edges
      [[-40, pondY, 13], [24, -13, 11], [-102, 7, 9]].forEach(([f, dy, w0]) => {
        const [px, py] = P(f, dy);
        for (let j = -2; j <= 2; j++) { const w = w0 - Math.abs(j) * 3; R(px - Math.floor(w / 2) - 1, py + j, w + 2, 1, "#2a1a1a"); R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#ffb020" : "#ff6a1a"); }
      });
    }
    paintLandmark2(g, key, P, isl);
    return;
  }

  // "over": trees, rocks and props scattered between the rows, a line along the back rim
  // ("rim") and little things along the front lip ("lip")
  const along = (fFrom, fTo, step, dy, fn) => {
    for (let f = fFrom; f <= fTo; f += step) {
      const rf = f + (rnd() - 0.5) * 3, s = isleSpan(key, rf);
      if (!s) continue;
      const y = dy === "rim" ? Math.round(s[0] + 3) : dy === "lip" ? Math.round(s[1] - 2) : dy;
      if (free(rf, y, typeof dy === "string" ? 1 : 3)) fn(...P(rf, y), rf);
    }
  };
  if (key === "keep") {
    along(-70, 130, 14, "rim", (x, y) => isleTree(g, x, y, "#3f8a3a", "#2f6a24", rnd() > 0.5 ? "#ff3b3b" : null, 3));
    scatter(7, [7, -13], (x, y, i) => i % 3 ? isleTuft(g, x, y, "#4f8f3a") : isleTree(g, x, y, "#4a9a3a", "#2f6a24", "#ff3b3b", 3));
    // two beehives by the gate
    [[-22, -12], [-16, -12]].forEach(([f, dy]) => { const [x, y] = P(f, dy); R(x - 1, y - 4, 3, 1, "#c08a10"); R(x - 2, y - 3, 5, 1, "#e0a820"); R(x - 2, y - 2, 5, 1, "#c08a10"); R(x - 1, y - 1, 3, 1, "#e0a820"); R(x, y - 2, 1, 1, "#3a2a10"); });
    // a cottage or two at the far end
    { const [x, y] = P(128, 9); isleHouse(g, x - 3, y, 7, 5, "#e8dcc0", "#b23a3a"); R(x + 2, y - 10, 2, 3, "#8a4a3a"); R(x + 2, y - 10, 2, 1, "#5a2a1a"); }   // its chimney smokes (drawn live)
  } else if (key === "spire") {
    along(-70, 130, 13, "rim", (x, y) => { const c = rnd() > 0.5 ? "#7fe3ff" : "#b36bff"; R(x, y - 4, 1, 4, c); R(x - 1, y - 2, 1, 2, shadeHex(c, -0.3)); R(x + 1, y - 3, 1, 3, shadeHex(c, 0.3)); });
    scatter(8, [7, -13], (x, y, i) => {
      if (i % 2) { R(x, y - 2, 1, 3, "#e8e0c8"); R(x - 2, y - 4, 5, 2, i % 4 === 1 ? "#c84a8a" : "#7a4ac8"); R(x - 1, y - 5, 3, 1, i % 4 === 1 ? "#e86aaa" : "#9a6ae8"); R(x - 1, y - 4, 1, 1, "#ffffff"); }
      else { const c = "#7fe3ff"; R(x, y - 3, 1, 3, c); R(x + 1, y - 2, 1, 2, "#b36bff"); }
    });
  } else if (key === "hollow") {
    along(-70, 130, 14, "rim", (x, y) => isleTree(g, x, y, rnd() > 0.5 ? "#d87a2a" : "#c8a030", "#8a4a1a", rnd() > 0.4 ? "#ff3b3b" : null, 3));
    scatter(8, [7, -13], (x, y, i) => {
      if (i % 3 === 0) { R(x - 2, y - 2, 5, 3, "#ff8c1a"); R(x - 1, y - 3, 3, 1, "#ffa83a"); R(x, y - 4, 1, 1, "#3a6a1a"); R(x - 2, y - 1, 1, 1, "#c86a10"); }
      else if (i % 3 === 1) { R(x - 2, y - 3, 5, 3, "#e8c860"); R(x - 2, y - 3, 5, 1, "#f8e090"); R(x - 1, y - 2, 1, 1, "#c8a040"); }
      else isleTuft(g, x, y, "#8a8a34");
    });
    // the scarecrow
    { const [x, y] = P(-6, 7); R(x, y - 7, 1, 7, "#6a4a2a"); R(x - 3, y - 6, 7, 1, "#6a4a2a"); R(x - 1, y - 9, 3, 3, "#e8c860"); R(x - 2, y - 10, 5, 1, "#5a3a1a"); R(x - 1, y - 5, 3, 3, "#3a6a8a"); }
  } else if (key === "reef") {
    along(-70, 130, 16, "rim", (x, y) => {
      R(x, y - 6, 1, 6, "#8a6a3a"); R(x + 1, y - 4, 1, 2, "#8a6a3a");
      R(x - 3, y - 7, 3, 1, "#3a9a4a"); R(x + 1, y - 7, 3, 1, "#3a9a4a"); R(x - 4, y - 6, 1, 1, "#2a7a3a"); R(x + 4, y - 6, 1, 1, "#2a7a3a"); R(x - 1, y - 8, 3, 1, "#5aba5a"); R(x, y - 6, 1, 1, "#8a5a2a");
    });
    scatter(9, [7, -13], (x, y, i) => {
      if (i % 3 === 0) { const c = ["#ff7a8a", "#ff9a3a", "#c85aa8"][i % 3]; R(x, y - 3, 1, 3, c); R(x - 1, y - 2, 1, 1, c); R(x + 1, y - 4, 1, 2, c); R(x - 2, y - 4, 1, 1, c); }
      else if (i % 3 === 1) { R(x - 1, y - 1, 3, 1, "#fff0e0"); R(x, y - 2, 1, 1, "#ffc8b8"); }
      else isleRock(g, x, y, 1, "#c8b8a8");
    });
  } else if (key === "crown") {
    along(-70, 130, 15, "rim", (x, y) => { const h = 4 + Math.floor(rnd() * 4); for (let j = 0; j < h; j++) R(x - (j < h / 2 ? 1 : 0), y - j, j < h / 2 ? 3 : 1, 1, j === h - 1 ? "#6a5a7a" : "#1e1a24"); R(x - 1, y - h + 2, 1, 1, "#5a4a6a"); });
    scatter(8, [7, -13], (x, y, i) => {
      if (i % 2) { R(x, y - 6, 1, 6, "#1a1418"); R(x - 2, y - 5, 2, 1, "#1a1418"); R(x + 1, y - 4, 2, 1, "#1a1418"); R(x - 3, y - 6, 1, 1, "#1a1418"); }
      else isleRock(g, x, y, 1, "#4a3a3a");
    });
  }
  paintIsleProps(g, key, P, { sprinkle, along, free, rnd, R });
  paintIsleWays(g, key, P, free, R);
}

/* ----- Signposts where the shops branch off, and lanterns along the open paths ----- */
const ISLE_SIGNS = [[5, "merchant"], [10, "challenger"], [15, "banker"]];
function isleLanterns(key) {
  if (ISLANDS[key].n < 2) return [];                  // only up where it's dusk or night
  const out = [];
  NODE_PATH.forEach(([a, b], i) => {
    if (i % 2 || nodeState(key, b) === "locked") return;
    const [fa, da] = NODE_SPOTS[a], [fb, db] = NODE_SPOTS[b];
    out.push([(fa + fb) / 2, Math.min(da, db) - 5]);
  });
  return out;
}
function paintIsleWays(g, key, P, free, R) {
  const accent = CAMP.islandById[key].colors.accent;
  // a signpost by each branch, its board in the island's color once the shop is open
  ISLE_SIGNS.forEach(([n, shop]) => {
    const [fa, da] = NODE_SPOTS[n], [fb, db] = NODE_SPOTS[shop];
    const f = fa + (fb - fa) * 0.4, dy = da + (db - da) * 0.4 - 6;
    if (!free(f, dy, 1, 0.55)) return;
    const [x, y] = P(f, dy), open = nodeState(key, shop) !== "locked", d = ISLANDS[key].dir * Math.sign(fb - fa || 1);
    R(x, y - 8, 1, 9, "#5a3a20"); R(x + 1, y - 8, 1, 9, "#3a2410");
    const bx = d > 0 ? x - 1 : x - 5;
    R(bx, y - 8, 7, 3, open ? accent : "#7a6a5a"); R(bx, y - 8, 7, 1, open ? shadeHex(accent, 0.35) : "#9a8a7a");
    R(d > 0 ? bx + 7 : bx - 1, y - 7, 1, 1, open ? accent : "#7a6a5a");          // the arrow's point
    R(bx + 2, y - 7, 3, 1, open ? shadeHex(accent, -0.45) : "#4a3a2a");          // the writing
  });
  // lantern posts (their glow is drawn live)
  isleLanterns(key).forEach(([f, dy]) => {
    if (!free(f, dy, 1, 0.5)) return;
    const [x, y] = P(f, dy);
    R(x, y - 7, 1, 7, "#2a2018"); R(x - 1, y, 3, 1, "#2a2018");
    R(x - 1, y - 10, 3, 3, "#1a1410"); R(x, y - 9, 1, 1, "#ffd27a"); R(x - 1, y - 11, 3, 1, "#3a2a1a");
  });
}

/* ----- The ground itself: blades, flowers, pebbles, shells, ash... (under the paths) ----- */
function paintIsleGround(g, key, P, sprinkle, R) {
  if (key === "keep") {
    sprinkle(170, (x, y, i) => {
      const k = i % 7;
      if (k < 2) { R(x, y, 1, 1, "#4f8f3a"); R(x, y - 1, 1, 1, k ? "#8fd06a" : "#3f7a30"); }                 // grass blades
      else if (k === 2) { R(x, y, 1, 1, ["#ffffff", "#ffe066", "#ff6b6b", "#ff9ad5", "#b0c8ff"][i % 5]); R(x, y + 1, 1, 1, "#3f7a30"); }
      else if (k === 3) { R(x, y, 2, 1, "#b8b4a8"); R(x, y + 1, 2, 1, "#6a8a4a"); R(x, y, 1, 1, "#d8d4c8"); }  // a pebble
      else if (k === 4) { R(x - 1, y, 3, 1, "#61a049"); R(x, y - 1, 1, 1, "#79b85a"); }                       // clover
      else if (k === 5) { R(x, y, 1, 1, "#ffffff"); R(x + 2, y + 1, 1, 1, "#ffffff"); R(x + 1, y, 1, 1, "#ffe066"); }   // daisies
      else { R(x, y, 3, 1, "#5a9a44"); R(x + 1, y - 1, 1, 1, "#4f8f3a"); }
    });
  } else if (key === "spire") {
    sprinkle(160, (x, y, i) => {
      const k = i % 6;
      if (k < 2) { R(x, y, 1, 1, "#3e6a9a"); R(x, y - 1, 1, 1, k ? "#8a88e0" : "#2e5a8a"); }
      else if (k === 2) { R(x, y, 1, 1, i % 2 ? "#bff4ff" : "#d8b0ff"); R(x - 1, y + 1, 3, 1, "#4a5ea4"); }    // glowing flowers
      else if (k === 3) { R(x, y, 2, 1, "#5a4a88"); R(x, y, 1, 1, "#9a8af0"); }                                 // rune pebbles
      else if (k === 4) { R(x, y, 1, 1, "#e8e0c8"); R(x - 1, y - 1, 3, 1, i % 2 ? "#7fe3ff" : "#c890ff"); }   // tiny mushrooms
      else R(x, y, 1, 1, "#ffffff");                                                                             // stardust
    });
  } else if (key === "hollow") {
    sprinkle(170, (x, y, i) => {
      const k = i % 6;
      if (k < 2) { R(x, y, 1, 1, ["#d87a2a", "#c8402a", "#e8c860", "#a8501a"][i % 4]); if (i % 3) R(x + 1, y, 1, 1, "#c86a20"); }   // fallen leaves
      else if (k === 2) { R(x, y, 2, 1, "#e8d080"); R(x + 1, y - 1, 1, 1, "#f0e0a0"); }                             // straw
      else if (k === 3) { R(x, y, 1, 1, "#e8dcc0"); R(x - 1, y - 1, 3, 1, "#c8402a"); R(x, y - 1, 1, 1, "#ffffff"); }  // a toadstool
      else if (k === 4) { R(x, y, 1, 1, "#a8a040"); R(x, y - 1, 1, 1, "#c8b050"); R(x + 1, y, 1, 1, "#8a8a34"); }   // dry grass
      else { R(x, y, 2, 1, "#9a8a70"); R(x, y, 1, 1, "#c8b8a0"); }
    });
  } else if (key === "reef") {
    sprinkle(170, (x, y, i, f, dy) => {
      const k = i % 6;
      if (k < 2 && dy < 0) { R(x, y, 1, 1, "#3a8a5a"); R(x, y - 1, 1, 1, k ? "#5aaa6a" : "#2a6a4a"); }             // sea grass
      else if (k < 2) { R(x - 1, y, 3, 1, "#f8ecc0"); }                                                             // ripples in the sand
      else if (k === 2) { R(x, y, 2, 1, i % 2 ? "#fff0e0" : "#ffc8b8"); R(x, y + 1, 1, 1, "#c8a888"); }            // shells
      else if (k === 3) { const c = i % 2 ? "#ff9a3a" : "#ff6a7a"; R(x, y - 1, 1, 3, c); R(x - 1, y, 3, 1, c); }   // a starfish
      else if (k === 4) { R(x, y, 2, 1, "#c8b8a8"); R(x, y, 1, 1, "#e8dcd0"); }
      else R(x, y, 1, 1, "#ffffff");
    });
  } else if (key === "crown") {
    sprinkle(170, (x, y, i) => {
      const k = i % 6;
      if (k === 0) { R(x, y, 1, 1, "#7a6a6a"); R(x + 1, y, 1, 1, "#5a4a4a"); }                                     // ash
      else if (k === 1) { R(x, y, 1, 1, i % 2 ? "#ff6a1a" : "#ffb020"); }                                           // embers
      else if (k === 2) { R(x, y - 1, 1, 2, "#1a1418"); R(x, y - 1, 1, 1, "#6a5a7a"); }                             // obsidian shards
      else if (k === 3) { R(x, y, 2, 1, "#e8e0c8"); R(x + 2, y - 1, 1, 1, "#c8c0a8"); }                             // old bones
      else if (k === 4) { R(x - 1, y, 3, 1, "#1e1418"); if (i % 3 === 0) R(x, y, 1, 1, "#c8401a"); }                 // cracks
      else { R(x, y, 2, 1, "#4a3a3a"); R(x, y, 1, 1, "#6a5a5a"); }
    });
    // vents in the ash (their smoke is drawn live)
    CROWN_VENTS.forEach(([f, dy]) => { const [x, y] = P(f, dy); R(x - 2, y, 5, 1, "#2a1a1a"); R(x - 1, y, 3, 1, "#120c0e"); R(x, y, 1, 1, "#ff6a1a"); R(x - 1, y - 1, 3, 1, "#3a2a2a"); });
  }
}
const CROWN_VENTS = [[-112, 7], [58, 7], [-6, -14]];

/* ----- More to stand on the grass: bushes, sheep, stones, sunflowers, a rowboat... ----- */
function paintIsleProps(g, key, P, { sprinkle, along, free, rnd, R }) {
  const at = (f, dy, fn) => { if (free(f, dy, 1, 0.7)) fn(...P(f, dy)); };
  if (key === "keep") {
    // bushes, boulders and sheep out in the meadow
    sprinkle(12, (x, y, i) => {
      if (i % 3 === 0) { R(x - 2, y - 2, 5, 2, "#3f8a3a"); R(x - 1, y - 3, 3, 1, "#4a9a3a"); R(x - 2, y - 2, 1, 1, "#5ab046"); R(x + 2, y - 1, 1, 1, "#2f6a24"); if (i % 2) R(x, y - 3, 1, 1, "#ff3b3b"); }
      else if (i % 3 === 1) isleRock(g, x, y, 2, "#a8a49a");
      else { R(x - 2, y - 3, 4, 3, "#e8e4dc"); R(x - 2, y - 3, 4, 1, "#ffffff"); R(x + (i % 2 ? 2 : -3), y - 3, 1, 2, "#3a3a3a"); R(x - 1, y, 1, 1, "#3a3a3a"); R(x + 1, y, 1, 1, "#3a3a3a"); }
    }, 3, 1);
    // stones and flowers along the front lip
    along(-150, 150, 11, "lip", (x, y, f) => { if (rnd() > 0.5) isleRock(g, x, y + 1, 1, "#a8a49a"); else { R(x, y, 1, 1, "#ff6b6b"); R(x + 1, y - 1, 1, 1, "#ffe066"); R(x, y + 1, 2, 1, "#3f7a30"); } });
    // pines on the headland at the home end
    [[-148, 2], [-142, -8]].forEach(([f, dy]) => at(f, dy, (x, y) => islePine(g, x, y, "#2f6a3a", 9)));
  } else if (key === "spire") {
    sprinkle(12, (x, y, i) => {
      if (i % 3 === 0) { R(x, y - 6, 2, 6, "#6a5a8a"); R(x, y - 6, 1, 6, "#8a7aaa"); R(x, y - 7, 2, 1, "#5a4a7a"); R(x, y - 4, 1, 1, i % 2 ? "#7fe3ff" : "#d8b0ff"); }   // a standing stone
      else if (i % 3 === 1) { R(x, y - 6, 1, 6, "#3a3268"); R(x - 1, y - 8, 3, 2, "#7fe3ff"); R(x, y - 8, 1, 1, "#ffffff"); R(x - 1, y, 3, 1, "#2a2448"); }          // a lamp
      else { R(x - 1, y - 3, 1, 3, "#b36bff"); R(x, y - 5, 2, 5, "#7fe3ff"); R(x, y - 5, 1, 5, "#bff4ff"); R(x + 2, y - 2, 1, 2, "#8a50d8"); }                     // a crystal cluster
    }, 3, 1);
    along(-150, 150, 12, "lip", (x, y) => { R(x, y - 1, 1, 2, rnd() > 0.5 ? "#7fe3ff" : "#b36bff"); R(x + 1, y, 1, 1, "#5a4a88"); });
  } else if (key === "hollow") {
    sprinkle(12, (x, y, i) => {
      if (i % 3 === 0) { R(x, y - 6, 1, 6, "#4a7a2a"); R(x - 1, y - 8, 3, 3, "#ffd23f"); R(x, y - 7, 1, 1, "#6a3a1a"); R(x + 1, y - 4, 1, 1, "#5a8a2a"); }      // a sunflower
      else if (i % 3 === 1) { R(x - 1, y - 4, 3, 4, "#8a5a30"); R(x - 1, y - 3, 3, 1, "#5a3a20"); R(x - 1, y - 4, 3, 1, "#c8402a"); R(x, y - 5, 1, 1, "#ff3b3b"); } // a barrel of apples
      else { R(x - 2, y - 3, 5, 3, "#e8c860"); R(x - 2, y - 3, 5, 1, "#f8e090"); R(x - 2, y - 1, 5, 1, "#c8a040"); }                                             // a hay bale
    }, 3, 1);
    along(-150, 150, 10, "lip", (x, y) => { if (rnd() > 0.5) { R(x, y, 1, 1, "#d87a2a"); R(x + 1, y - 1, 1, 1, "#c8402a"); } else isleTuft(g, x, y, "#8a8a34"); });
    // the knoll past the far end: a haystack, an apple tree and a patch of pumpkins
    at(170, 3, (x, y) => { for (let j = 0; j < 7; j++) R(x - 5 + Math.floor(j / 2), y - j, 11 - Math.floor(j / 2) * 2, 1, j % 2 ? "#e8c860" : "#d8b050"); R(x - 5, y, 11, 1, "#c8a040"); R(x - 1, y - 7, 2, 1, "#f8e090"); });
    at(186, -6, (x, y) => isleTree(g, x, y, "#d87a2a", "#8a4a1a", "#ff3b3b", 4));
    [[160, 10], [166, 12], [176, 11]].forEach(([f, dy]) => at(f, dy, (x, y) => { R(x - 1, y - 2, 3, 2, "#ff8c1a"); R(x, y - 3, 1, 1, "#3a6a1a"); }));
  } else if (key === "reef") {
    sprinkle(10, (x, y, i) => {
      if (i % 2) { R(x - 3, y - 1, 7, 1, "#8a6a4a"); R(x - 3, y - 2, 6, 1, "#a8886a"); R(x + 3, y - 2, 1, 1, "#6a4a2a"); }    // driftwood
      else isleRock(g, x, y, 2, "#b8a898");
    }, 3, 1);
    along(-150, 150, 10, "lip", (x, y) => { if (rnd() > 0.6) { R(x, y, 2, 1, "#fff0e0"); } else R(x, y, 1, 1, "#ffc8b8"); });
    // the sandbar: a rowboat pulled up on it, and shells
    at(194, 15, (x, y) => { R(x - 5, y - 2, 11, 2, "#8a4a2a"); R(x - 4, y, 9, 1, "#6a3a1a"); R(x - 5, y - 2, 11, 1, "#b86a3a"); R(x - 1, y - 3, 1, 1, "#d8c8a8"); R(x + 2, y - 5, 1, 4, "#5a3a1a"); });
    [[172, 17], [208, 14], [182, 19]].forEach(([f, dy]) => at(f, dy, (x, y) => { R(x, y, 2, 1, "#fff0e0"); R(x, y - 1, 1, 1, "#ffc8b8"); }));
    // the rocks at the home end, where the gulls nest
    [[-160, -8, 3], [-168, -4, 2], [-152, -3, 2]].forEach(([f, dy, s]) => at(f, dy, (x, y) => isleRock(g, x, y, s, "#a89a8a")));
  } else if (key === "crown") {
    sprinkle(12, (x, y, i) => {
      if (i % 3 === 0) { R(x, y - 5, 1, 5, "#1a1418"); R(x - 1, y - 2, 1, 2, "#2e2428"); R(x + 1, y - 3, 1, 3, "#241c22"); R(x, y - 5, 1, 1, "#6a5a7a"); }   // obsidian spikes
      else if (i % 3 === 1) { R(x - 1, y - 3, 3, 2, "#e8e0c8"); R(x - 1, y - 2, 1, 1, "#1a1418"); R(x + 1, y - 2, 1, 1, "#1a1418"); R(x, y - 1, 1, 1, "#c8c0a8"); }  // a skull
      else isleRock(g, x, y, 2, "#4a3a3a");
    }, 3, 1);
    along(-150, 150, 9, "lip", (x, y) => { if (rnd() > 0.5) { R(x, y - 2, 1, 3, "#1e1a24"); R(x, y - 2, 1, 1, "#5a4a6a"); } else R(x, y, 1, 1, "#ff6a1a"); });
    // the black promontory at the far end
    [[140, 24], [130, 27], [148, 21], [136, 18]].forEach(([f, dy], i) => at(f, dy, (x, y) => { const h = 4 + i * 2; R(x, y - h, 1, h, "#120c10"); R(x - 1, y - Math.floor(h / 2), 1, Math.floor(h / 2), "#241a1e"); R(x, y - h, 1, 1, "#7a6a8a"); }));
  }
}

/* ----- The big landmark at the back of the home end ----- */
const LANDMARK_SPOT = [-92, -22];
function paintLandmark2(g, key, P, isl) {
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  const [x, y] = P(...LANDMARK_SPOT);
  if (key === "keep") {
    // Brightscale Keep itself: a great square tower between two round ones
    const stone = ["#d8d2c4", "#b8b2a4", "#8f8a7e", "#6e6a62"];
    const wall = (x0, y0, w, h) => {
      R(x0, y0, w, h, stone[1]);
      R(x0, y0, 1, h, stone[0]);
      R(x0 + w - 2, y0, 2, h, stone[2]);
      for (let j = 3; j < h; j += 4) for (let i = (j % 8 ? 1 : 3); i < w - 2; i += 4) R(x0 + i, y0 + j, 2, 1, stone[2]);
      for (let i = 0; i < w; i += 2) R(x0 + i, y0 - 2, 1, 2, i % 4 ? stone[2] : stone[1]);
    };
    wall(x - 14, y - 12, 28, 12);                          // the curtain wall
    R(x - 3, y - 7, 6, 7, "#2a2018"); R(x - 2, y - 8, 4, 1, "#2a2018");            // the gate
    for (let i = 0; i < 4; i++) R(x - 3 + i * 2, y - 7, 1, 7, "#5a5048");          // portcullis
    wall(x - 9, y - 33, 18, 21);                           // the keep
    R(x - 2, y - 27, 4, 5, "#2a2018"); R(x - 1, y - 28, 2, 1, "#2a2018"); R(x - 1, y - 26, 2, 2, "#ffcf5a");   // a lit window
    R(x - 6, y - 20, 2, 3, "#2a2018"); R(x + 4, y - 20, 2, 3, "#2a2018");
    // round towers with red cones
    [[-15, 24], [15, 24]].forEach(([dx, h]) => {
      const tx = x + dx;
      R(tx - 4, y - h, 8, h, stone[1]); R(tx - 4, y - h, 2, h, stone[0]); R(tx + 2, y - h, 2, h, stone[2]);
      R(tx - 1, y - h + 6, 2, 3, "#2a2018");
      for (let j = 0; j < 9; j++) R(tx - 5 + Math.floor(j / 2), y - h - 1 - j, 10 - Math.floor(j / 2) * 2, 1, j % 3 === 0 ? "#8e2b2b" : "#c0392b");
      R(tx - 1, y - h - 10, 1, 1, "#ffd23f");
    });
    // banners on the keep
    [[-7, "#c0392b"], [5, "#2f5fbf"]].forEach(([dx, c]) => { R(x + dx, y - 31, 2, 7, c); R(x + dx, y - 25, 1, 1, c); R(x + dx + 1, y - 29, 1, 1, "#ffd23f"); });
  } else if (key === "spire") {
    // the Arcanum Spire: a slender tower, tall enough to scrape the stars
    const st = ["#9a8ac8", "#7a6aa8", "#5a4a88", "#3e3268"];
    R(x - 9, y - 4, 18, 4, st[2]); R(x - 9, y - 4, 18, 1, st[1]);                  // the plinth
    for (let j = 0; j < 38; j++) {
      const w = 10 - Math.floor(j / 13) * 2, x0 = x - Math.floor(w / 2);
      R(x0, y - 4 - j, w, 1, st[1]); R(x0, y - 4 - j, 1, 1, st[0]); R(x0 + w - 2, y - 4 - j, 2, 1, st[2]);
      if (j % 6 === 3) R(x0 + 1, y - 4 - j, w - 3, 1, st[3]);
    }
    [[6, 0], [16, 1], [26, 0]].forEach(([j, k]) => { R(x - 1 + k, y - 4 - j - 3, 2, 3, "#ffd27a"); R(x - 1 + k, y - 4 - j - 4, 2, 1, st[3]); });   // lit windows
    // the roof, and a ring of stone under it
    R(x - 5, y - 43, 10, 2, st[3]);
    for (let j = 0; j < 12; j++) R(x - 5 + Math.floor(j / 2), y - 44 - j, 10 - Math.floor(j / 2) * 2, 1, j % 3 === 0 ? "#2a3a9a" : "#3a5ad8");
    R(x, y - 57, 1, 2, "#ffd23f");
    // a smaller tower leaning on it
    R(x + 7, y - 18, 6, 14, st[1]); R(x + 11, y - 18, 2, 14, st[2]); R(x + 9, y - 13, 2, 3, "#ffd27a");
    for (let j = 0; j < 6; j++) R(x + 6 + Math.floor(j / 2), y - 19 - j, 8 - Math.floor(j / 2) * 2, 1, "#3a5ad8");
  } else if (key === "hollow") {
    // the windmill (its sails turn, drawn live) and a red barn
    const bx = x + 14 * ISLANDS[key].dir;
    isleHouse(g, bx - 8, y, 16, 9, "#b83a2a", "#7a2a1a", "#3a1a10");
    R(bx - 3, y - 7, 6, 7, "#e8dcc0"); R(bx - 2, y - 6, 4, 6, "#8a2a1a"); R(bx - 2, y - 6, 4, 1, "#e8dcc0"); R(bx, y - 6, 1, 6, "#e8dcc0");
    for (let j = 0; j < 26; j++) {
      const w = 10 - Math.floor(j / 6), x0 = x - Math.floor(w / 2);
      R(x0, y - j, w, 1, "#c8b8a0"); R(x0, y - j, 1, 1, "#e8dcc8"); R(x0 + w - 2, y - j, 2, 1, "#9a8a70");
    }
    R(x - 1, y - 6, 3, 6, "#5a3a20"); R(x - 1, y - 15, 2, 3, "#3a2a1a");
    for (let j = 0; j < 5; j++) R(x - 5 + j, y - 26 - j, 10 - j * 2, 1, j % 2 ? "#6a4a2a" : "#8a5a30");
  } else if (key === "reef") {
    // the lighthouse on a heap of rocks (its beam sweeps, drawn live)
    isleRock(g, x - 6, y + 1, 3, "#9a8a7a"); isleRock(g, x + 6, y + 1, 3, "#8a7a6a"); isleRock(g, x, y + 1, 4, "#a89a8a");
    for (let j = 0; j < 34; j++) {
      const w = 9 - Math.floor(j / 12), x0 = x - Math.floor(w / 2);
      const red = Math.floor(j / 5) % 2;
      R(x0, y - 3 - j, w, 1, red ? "#d83a3a" : "#f4f0e8"); R(x0 + w - 2, y - 3 - j, 2, 1, red ? "#a82a2a" : "#c8c0b8"); R(x0, y - 3 - j, 1, 1, red ? "#ff6a6a" : "#ffffff");
    }
    R(x - 5, y - 38, 10, 2, "#3a3a44"); R(x - 3, y - 43, 6, 5, "#2a3a4a"); R(x - 2, y - 42, 4, 3, "#fff6a8");
    for (let j = 0; j < 4; j++) R(x - 4 + j, y - 44 - j, 8 - j * 2, 1, "#d83a3a");
    R(x - 1, y - 13, 2, 3, "#3a3a44");
  } else if (key === "crown") {
    // the volcano, with a red glow in its throat (the smoke and sparks are drawn live)
    for (let j = 0; j < 30; j++) {
      const w = 54 - j * 1.5, x0 = x - w / 2;
      for (let i = 0; i < w; i++) {
        const lit = i < w * 0.32;
        R(x0 + i, y - j, 1, 1, lit ? (j % 4 ? "#4a3a3e" : "#54424a") : i > w * 0.8 ? "#1a1418" : (j + i) % 5 ? "#2e2428" : "#36292e");
      }
    }
    R(x - 6, y - 30, 12, 1, "#ff6a1a"); R(x - 4, y - 31, 8, 1, "#ffb020");
    // a lava flow down the side
    for (let j = 0; j < 28; j++) R(x - 3 + Math.round(Math.sin(j * 0.4) * 2 + j * 0.3), y - 29 + j, 2, 1, j % 3 ? "#ff6a1a" : "#ffb020");
  }
}

/* Behind an island: its islets, each bobbing to its own rhythm */
function drawIsleBehind(g, key, t, by) {
  const isl = ISLANDS[key];
  (ISLE_SHAPE[key].islets || []).forEach(([f, dy], k) => {
    const art = isletArt(key, k);
    const b = Math.round(Math.sin(t * (0.8 + k * 0.17) + isl.phase + k * 2.1) * 1.6);
    g.drawImage(art.c, Math.round(isl.x + isl.dir * f - art.ox), Math.round(isl.y + dy - art.oy + b));
  });
}

/* A bird, a bat or a gull: two wings and a body */
function drawFlier(g, x, y, flap, c, wide = 2) {
  const up = flap ? 1 : 0;
  mapRect(g, x - wide, y - up, wide, 1, c); mapRect(g, x + 1, y - up, wide, 1, c); mapRect(g, x, y, 1, 1, c);
}

/* ----- What moves on each island ----- */
function drawIsleLiving(g, key, t, by) {
  const isl = ISLANDS[key];
  const d = isl.dir;
  const P = (f, dy) => [Math.round(isl.x + d * f), Math.round(isl.y + dy + by)];
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  // falls off the front edge, from the pond
  const falls = { keep: "rgba(200,235,255,", spire: "rgba(170,240,255,", hollow: "rgba(200,235,255,", reef: "rgba(190,240,255,", crown: "rgba(255,160,60," }[key];
  {
    const [fx, fy] = P(-40, Math.round(isleFront(key, -40) - 1));
    for (let i = 0; i < 26; i++) { const ph = (t * 1.3 + i / 26) % 1; R(fx - 2 + (i % 4), fy + ph * 54, 1, 2 + (i % 2), `${falls}${(0.85 * (1 - ph)).toFixed(2)})`); }
    for (let i = 0; i < 3; i++) if (Math.sin(t * 5 + i * 2) > 0.6) R(fx - 3 + i * 3, fy + 1, 1, 1, "#ffffff");
  }
  // drops falling from the tips of the spikes under it: water, sparkles, crumbs, sand or lava
  const art = islandCache[key];
  if (art && art.tips) {
    const drip = { keep: "#9ad0ff", spire: "#bff4ff", hollow: "#8a6a3a", reef: "#f0e2ae", crown: "#ff8a2a" }[key];
    art.tips.forEach(([tx, ty], i) => {
      const x = isl.x - art.ox + tx, y = isl.y - art.oy + ty + by;
      const ph = (t * 0.45 + mapHash(i, 2, isl.n)) % 1.5;
      if (ph < 0.25) R(x, y + 1, 1, 1, drip);                                   // a drop gathering
      else if (ph < 1.25) { const k = ph - 0.25; R(x, y + 1 + k * k * 36, 1, key === "keep" ? 2 : 1, drip); }
      if (key === "spire" && Math.sin(t * 3 + i * 1.7) > 0.7) { g.fillStyle = "rgba(191,244,255,0.35)"; g.fillRect(x - 1, y - 2, 3, 3); }
      if (key === "crown") { g.fillStyle = `rgba(255,120,30,${0.18 + 0.12 * Math.sin(t * 2 + i)})`; g.fillRect(x - 1, y - 3, 3, 4); }
    });
  }
  const [lx, ly] = P(...LANDMARK_SPOT);
  if (key === "keep") {
    // flags on the towers, rippling
    [[-15, 24], [15, 24], [0, 33]].forEach(([dx, h], i) => {
      const fx = lx + dx, fy = ly - h - (dx ? 10 : 2);
      R(fx, fy - 4, 1, 5, "#5a3a20");
      for (let k = 0; k < 5; k++) R(fx + 1 + k, fy - 4 + Math.round(Math.sin(t * 6 - k * 0.9 + i) * 0.7), 1, 2, k % 2 ? "#c0392b" : "#ffd23f");
    });
    // bees about the hives
    for (let i = 0; i < 4; i++) { const [hx, hy] = P(-19, -15); const a = t * (2 + i * 0.4) + i * 1.6; R(hx + Math.cos(a) * (4 + i), hy + Math.sin(a * 1.3) * 2.5, 1, 1, i % 2 ? "#ffcf33" : "#1a1410"); }
    // a knight's pennant bobbing along the lists
    { const ph = (t * 0.12) % 1; const [ax] = P(-6, -13), [bx] = P(56, -13); const x = ax + (bx - ax) * (ph < 0.5 ? ph * 2 : 2 - ph * 2); const [, y] = P(0, -15); R(x, y - 3 + Math.round(Math.sin(t * 9)), 2, 2, "#c8ced6"); R(x, y - 1, 2, 1, "#5a3a20"); }
  } else if (key === "spire") {
    // the orb above the spire, and runestones circling it
    const ox = lx, oy = ly - 64;
    const glow = 0.5 + 0.5 * Math.sin(t * 2);
    g.fillStyle = `rgba(127,227,255,${0.18 + 0.2 * glow})`; g.fillRect(ox - 5, oy - 5, 11, 11);
    R(ox - 2, oy - 2, 5, 5, "#7fe3ff"); R(ox - 1, oy - 1, 2, 2, "#ffffff");
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + i * Math.PI / 2, rx = ox + Math.cos(a) * 12, ry = oy + 10 + Math.sin(a) * 4;
      R(rx - 1, ry - 1, 3, 3, Math.sin(a) > 0 ? "#6a5a8a" : "#4e4060"); R(rx, ry, 1, 1, i % 2 ? "#b36bff" : "#7fe3ff");
    }
    // sparkles drifting up off the crystals
    for (let i = 0; i < 10; i++) { const ph = (t * 0.3 + i / 10) % 1; const [sx, sy] = P(-80 + i * 18, -27); if (Math.sin(t * 4 + i) > 0) R(sx, sy - ph * 14, 1, 1, i % 2 ? "#d8b0ff" : "#bff4ff"); }
  } else if (key === "hollow") {
    // the windmill's sails
    const hx = lx, hy = ly - 22, a0 = t * 1.1;
    for (let k = 0; k < 4; k++) {
      const a = a0 + k * Math.PI / 2;
      for (let r = 2; r < 15; r++) { const px = hx + Math.cos(a) * r, py = hy + Math.sin(a) * r; R(px, py, 1, 1, "#5a3a20"); if (r > 4) R(px + Math.cos(a + Math.PI / 2) * 2, py + Math.sin(a + Math.PI / 2) * 2, 1, 1, r % 2 ? "#f0e8d8" : "#d8ccb0"); }
    }
    R(hx - 1, hy - 1, 2, 2, "#3a2a1a");
    // leaves tumbling off the orchard
    for (let i = 0; i < 6; i++) { const ph = (t * 0.25 + i / 6) % 1; const [sx, sy] = P(-60 + i * 28, -32); R(sx + Math.sin(t + i) * 4 + ph * 6, sy + ph * 20, 1, 1, i % 2 ? "#d87a2a" : "#c8a030"); }
  } else if (key === "reef") {
    // the lighthouse beam sweeping the sky
    const bx = lx, bby = ly - 41, a = Math.sin(t * 0.8) * 1.3 - Math.PI / 2 + (d > 0 ? 0.6 : -0.6);
    for (let r = 3; r < 60; r++) {
      const w = r * 0.18;
      g.fillStyle = `rgba(255,246,168,${0.35 * (1 - r / 60)})`;
      g.fillRect(Math.round(bx + Math.cos(a) * r - w / 2), Math.round(bby + Math.sin(a) * r - w / 2), Math.ceil(w), Math.ceil(w));
    }
    // ripples in the pools and a gull overhead
    [[-40, 27], [-100, 7], [26, -13]].forEach(([f, dy], i) => { if (Math.sin(t * 2 + i * 2) > 0.3) { const [x, y] = P(f + Math.sin(t + i) * 3, dy); R(x, y, 2, 1, "#c8f0ff"); } });
    { const gx = isl.x + Math.sin(t * 0.3) * 120, gy = isl.y - 60 + by + Math.sin(t * 0.7) * 6, f = Math.sin(t * 7) > 0; R(gx - 2, gy - (f ? 1 : 0), 2, 1, "#ffffff"); R(gx + 1, gy - (f ? 1 : 0), 2, 1, "#ffffff"); R(gx, gy, 1, 1, "#d8d8d8"); }
  } else if (key === "crown") {
    // smoke from the crater, and sparks
    for (let i = 0; i < 7; i++) {
      const ph = (t * 0.22 + i / 7) % 1;
      g.fillStyle = `rgba(70,60,66,${0.55 * (1 - ph)})`;
      const s = 3 + Math.round(ph * 7);
      g.fillRect(Math.round(lx + Math.sin(ph * 5 + i) * 3 + ph * 10 * d - s / 2), Math.round(ly - 32 - ph * 40), s, s);
    }
    for (let i = 0; i < 9; i++) { const ph = (t * 0.6 + i / 9) % 1; R(lx - 4 + mapHash(i, 3, 5) * 8 + Math.sin(t * 3 + i) * 2, ly - 31 - ph * 22, 1, 1, ph < 0.5 ? "#ffd23f" : "#ff6a1a"); }
    // the lava pools glow and bubble
    [[-40, 27], [24, -13], [-102, 7]].forEach(([f, dy], i) => { const [x, y] = P(f, dy); g.fillStyle = `rgba(255,140,30,${0.15 + 0.15 * Math.sin(t * 2 + i)})`; g.fillRect(x - 8, y - 4, 16, 8); if (Math.sin(t * 4 + i * 3) > 0.7) R(x + Math.round(Math.sin(t + i) * 3), y - 1, 1, 1, "#fff0a0"); });
    // embers rising off the whole island
    for (let i = 0; i < 8; i++) { const ph = (t * 0.18 + i / 8) % 1; const [sx, sy] = P(-130 + i * 36, 10); R(sx + Math.sin(t * 2 + i) * 3, sy - ph * 50, 1, 1, "#ff8a2a"); }
  }
  // creatures about the place
  if (key === "keep") {
    // butterflies over the meadow, and birds crossing the sky
    for (let i = 0; i < 3; i++) {
      const [x, y] = P(-100 + i * 80 + Math.sin(t * 0.5 + i * 2) * 20, 4 + Math.sin(t * 0.8 + i) * 6 - 6 - Math.abs(Math.sin(t * 3 + i)) * 2);
      const fl = Math.sin(t * 14 + i) > 0;
      R(x - (fl ? 1 : 0), y, fl ? 3 : 1, 1, ["#ffffff", "#ffe066", "#ff9ad5"][i]);
    }
    for (let i = 0; i < 2; i++) { const ph = (t * 0.04 + i * 0.5) % 1; drawFlier(g, isl.x - 230 + ph * 460, isl.y - 74 - i * 12 + Math.sin(t * 0.9 + i) * 4 + by, Math.sin(t * 8 + i) > 0, "#3a3a4a"); }
  } else if (key === "spire") {
    // wisps drifting around the island
    for (let i = 0; i < 5; i++) {
      const a = t * 0.35 + i * 1.26, [x, y] = P(Math.cos(a) * 134, Math.sin(a) * 26 - 10), gl = 0.5 + 0.5 * Math.sin(t * 3 + i);
      g.fillStyle = `rgba(127,227,255,${(0.2 * gl).toFixed(2)})`; g.fillRect(x - 1, y - 1, 3, 3);
      R(x, y, 1, 1, gl > 0.5 ? "#ffffff" : "#bff4ff");
    }
  } else if (key === "hollow") {
    // crows circling the scarecrow
    const [sx, sy] = P(-6, 7);
    for (let i = 0; i < 2; i++) { const a = t * 0.7 + i * Math.PI; drawFlier(g, sx + Math.cos(a) * (16 + i * 5), sy - 22 + Math.sin(a) * 4, Math.sin(t * 7 + i) > 0, "#1a1418"); }
  } else if (key === "reef") {
    // crabs scuttling along the sandbar, and foam lapping its edge
    for (let i = 0; i < 2; i++) {
      const [x, y] = P(172 + i * 22 + Math.sin(t * 0.6 + i * 3) * 9, 16 + i * 2), k = Math.sin(t * 6 + i) > 0 ? 1 : 0;
      R(x - 1, y - 1, 3, 1, "#e8503a"); R(x - 2, y - 2 + k, 1, 1, "#e8503a"); R(x + 2, y - 1 - k, 1, 1, "#e8503a"); R(x, y - 2, 1, 1, "#ffffff");
    }
    for (let f = 150; f < 222; f += 3) { const s = isleSpan(key, f); if (s && Math.sin(t * 2 + f * 0.3) > 0.5) { const [x, y] = P(f, s[1] + 1); R(x, y, 2, 1, "#ffffff"); } }
  } else if (key === "crown") {
    // smoke from the vents, and bats
    CROWN_VENTS.forEach(([f, dy], v) => {
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.3 + i / 4 + v * 0.3) % 1, s = 1 + Math.round(ph * 3), [x, y] = P(f + Math.sin(ph * 4 + i) * 2, dy - 2 - ph * 16);
        g.fillStyle = `rgba(80,70,76,${(0.5 * (1 - ph)).toFixed(2)})`; g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      }
    });
    for (let i = 0; i < 3; i++) { const a = t * (0.5 + i * 0.1) + i * 2; drawFlier(g, isl.x + Math.cos(a) * (120 + i * 20), isl.y - 50 + Math.sin(a * 2) * 10 + by, Math.sin(t * 12 + i) > 0, "#120c10", 1); }
  }
  // lanterns glowing along the open paths
  isleLanterns(key).forEach(([f, dy], i) => {
    const [x, y] = P(f, dy), fl = 0.5 + 0.5 * Math.sin(t * 7 + i * 2.3) * Math.sin(t * 3.1 + i);
    g.fillStyle = `rgba(255,200,110,${(0.14 + 0.1 * fl).toFixed(3)})`; g.fillRect(x - 4, y - 13, 9, 8);
    g.fillStyle = `rgba(255,220,150,${(0.22 + 0.12 * fl).toFixed(3)})`; g.fillRect(x - 2, y - 11, 5, 4);
    R(x, y - 9, 1, 1, fl > 0.6 ? "#fff6c4" : "#ffd27a");
  });
  // smoke from the cottage chimney on the first island
  if (key === "keep") {
    const [cx0, cy0] = P(128, 9);
    const sx = cx0 - 3 + 3, sy = cy0 - 11;
    for (let i = 0; i < 5; i++) { const ph = (t * 0.25 + i / 5) % 1, s = 1 + Math.round(ph * 3); g.fillStyle = `rgba(230,230,235,${(0.55 * (1 - ph)).toFixed(2)})`; g.fillRect(Math.round(sx + Math.sin(ph * 4 + i) * 2 + ph * 6 * d - s / 2), Math.round(sy - ph * 18), s, s); }
  }
  // mist where the falls tumble off into the clouds
  {
    const [fx, fy] = P(-40, Math.round(isleFront(key, -40) - 1) + 52);
    const mist = key === "crown" ? "255,150,70" : "255,255,255";
    for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i / 5) % 1; g.fillStyle = `rgba(${mist},${(0.25 * (1 - ph)).toFixed(2)})`; g.fillRect(Math.round(fx - 4 + i * 2 + Math.sin(t + i) * 2), Math.round(fy - ph * 6), 2, 2); }
  }
  // fireflies on the islands up in the dusk and the night
  if (isl.n >= 2) for (let i = 0; i < 6; i++) {
    const glow = Math.sin(t * 2.2 + i * 1.7);
    if (glow < 0.2) continue;
    const [fx, fy] = P(-120 + mapHash(i, isl.n, 3) * 240 + Math.sin(t * 0.5 + i) * 6, -10 + mapHash(i, isl.n, 4) * 30 + Math.cos(t * 0.6 + i) * 3);
    R(fx, fy, 1, 1, glow > 0.7 ? "#fff6a8" : "#c8d060");
  }
}

/* ----- The stops: a stone for each level, a lair for each boss, and the shopkeepers' places ----- */
function drawNodeArt(g, key, id, st, t, by) {
  const I = CAMP.islandById[key];
  const p = nodeAt(key, id);
  const x = p.x, y = p.y + by;
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const accent = I.colors.accent;
  if (typeof id === "number") {
    if (isBossLevel(id)) { drawLair(g, key, id, st, x, y, t); return; }
    // a flat stepping stone; a planted pennant once it's won
    R(x - 3, y, 7, 2, st === "locked" ? "#6a6a70" : "#a8a8b0"); R(x - 2, y, 5, 1, st === "locked" ? "#8a8a90" : "#d0d0d8"); R(x - 3, y + 2, 7, 1, "rgba(0,0,0,0.25)");
    if (st === "done") { const fx = x + 4; R(fx, y - 7, 1, 8, "#5a3a20"); R(fx + 1, y - 7 + Math.round(Math.sin(t * 5 + id) * 0.6), 3, 2, accent); R(fx + 1, y - 5, 2, 1, shadeHex(accent, -0.3)); }
    if (st === "next") { const k = 0.5 + 0.5 * Math.sin(t * 3); g.fillStyle = `rgba(255,224,120,${0.25 + 0.3 * k})`; g.fillRect(x - 5, y - 1, 11, 4); }
    return;
  }
  if (id === "home") { drawHomeTree(g, key, x, y, t); return; }
  if (id === "bridge") { drawGate(g, key, x, y, st, t); return; }
  drawStall(g, key, id, x, y, st, t);
  if (st !== "locked") drawKeeper(g, key, id, x + ISLANDS[key].dir * (id === "banker" ? -9 : 9), y + 1, t);
}

/* A boss's lair: a heap of rock with a black mouth, and eyes that watch you */
function drawLair(g, key, n, st, x, y, t) {
  const B = CAMP.islandById[key].boss;
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const big = n === LEVEL_COUNT ? 2 : n === 10 ? 1 : 0;
  const w = 19 + big * 3, h = 13 + big * 2;
  const rock = { keep: "#7a7472", spire: "#5a4a7a", hollow: "#7a5a3a", reef: "#6a7a8a", crown: "#3a2a2e" }[key];
  for (let j = 0; j < h; j++) { const ww = Math.round(w * Math.sqrt(1 - Math.pow(j / h, 2))); R(x - Math.floor(ww / 2), y + 1 - j, ww, 1, j > h * 0.6 ? shadeHex(rock, 0.2) : rock); }
  R(x - Math.floor(w / 2), y + 1, w, 1, shadeHex(rock, -0.35));
  // boulders on its flanks, and the mouth of the cave
  isleRock(g, x - Math.floor(w / 2) + 2, y + 1, 2, shadeHex(rock, 0.1)); isleRock(g, x + Math.floor(w / 2) - 2, y + 1, 2, shadeHex(rock, -0.1));
  R(x - 3, y - 5, 7, 6, "#0e0a0c"); R(x - 2, y - 6, 5, 1, "#0e0a0c");
  if (st === "done") {
    // the lair is empty, and your banner flies over it
    R(x + 5, y - h - 7, 1, 9, "#5a3a20");
    for (let k = 0; k < 5; k++) R(x + 6 + k, y - h - 7 + Math.round(Math.sin(t * 5 - k) * 0.6), 1, 3, k % 2 ? "#ffd23f" : CAMP.islandById[key].colors.accent);
    return;
  }
  const blink = (t + n) % 4 < 0.15;
  if (st !== "locked" && !blink) { R(x - 2, y - 3, 1, 1, B.eye); R(x + 2, y - 3, 1, 1, B.eye); if (Math.sin(t * 2 + n) > 0.4) { g.fillStyle = "rgba(255,60,60,0.25)"; g.fillRect(x - 3, y - 4, 7, 3); } }
  if (st === "next") { const k = 0.5 + 0.5 * Math.sin(t * 3); g.fillStyle = `rgba(255,90,110,${0.12 + 0.18 * k})`; g.fillRect(x - Math.floor(w / 2) - 1, y - h, w + 2, h + 2); }
  // bones by the door
  R(x - 6, y, 2, 1, "#e8e0c8"); R(x + 5, y, 1, 1, "#e8e0c8");
  // spikes on top for the last fight
  if (big === 2) for (let k = -1; k <= 1; k++) R(x + k * 4, y - h - 1 - (k ? 0 : 1), 1, 2, shadeHex(rock, -0.3));
}

/* The home tree: as tall and full as this island's upgrades, with your satchel against it */
function drawHomeTree(g, key, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const tree = CAMP.islandById[key].tree;
  const have = tree.upgrades.reduce((a, u) => a + upTier(u.id), 0);
  const total = tree.upgrades.reduce((a, u) => a + u.values.length - 1, 0);
  const f = total ? have / total : 0;
  const leaves = { keep: ["#2f7d2a", "#3f9a3a", "#5ab046", "#ff3b3b"], spire: ["#3a3a9a", "#5a5ac8", "#8a8af0", "#7fe3ff"], hollow: ["#a8501a", "#d87a2a", "#f0a840", "#ff3b3b"], reef: ["#1a7a6a", "#2a9a8a", "#5acaba", "#ff9ab0"], crown: ["#6a1a1a", "#a82a1a", "#e85a1a", "#ffd23f"] }[key];
  const hgt = 8 + Math.round(f * 10);
  R(x - 1, y - hgt, 2 + (f > 0.5 ? 1 : 0), hgt + 1, "#5a3a20"); R(x - 1, y - hgt, 1, hgt + 1, "#7a5232");
  R(x - 3, y, 2, 1, "#5a3a20"); R(x + 2, y, 2, 1, "#5a3a20");
  const r = 4 + f * 6, n = 30 + Math.round(f * 70);
  for (let i = 0; i < n; i++) {
    const a = mapHash(i, key.length, 71) * Math.PI * 2, dd = Math.sqrt(mapHash(i, key.length, 73)) * r;
    R(x + Math.cos(a) * dd * 1.3 + Math.sin(t * 1.3 + i) * 0.3, y - hgt + Math.sin(a) * dd * 0.85, 1, 1, leaves[i % 3]);
  }
  // fruit, one for every tier bought (up to a dozen), glinting
  for (let i = 0; i < Math.min(12, have); i++) {
    const a = i * 2.39, dd = r * (0.4 + 0.5 * mapHash(i, 9, 3));
    const fx = x + Math.cos(a) * dd * 1.2, fy = y - hgt + Math.sin(a) * dd * 0.7;
    R(fx, fy, 1, 1, leaves[3]);
    if (Math.sin(t * 3 + i * 2) > 0.92) R(fx, fy - 1, 1, 1, "#ffffff");
  }
  // the satchel, leaning on the trunk
  const sx = x + 3 * ISLANDS[key].dir;
  R(sx - 1, y - 3, 4, 3, "#b07a42"); R(sx - 1, y - 3, 4, 1, "#d09a5a"); R(sx, y - 4, 2, 1, "#5a3a1e"); R(sx + 1, y - 2, 1, 1, "#ffd23f");
}

/* The bridge: a stone arch where the Coil carries you up, torches lit once it's open */
function drawGate(g, key, x, y, st, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const open = st !== "locked";
  R(x - 6, y - 10, 3, 11, "#b8b2a4"); R(x + 4, y - 10, 3, 11, "#8f8a7e"); R(x - 6, y - 10, 1, 11, "#d8d2c4");
  R(x - 5, y - 12, 11, 2, "#b8b2a4"); R(x - 4, y - 13, 9, 1, "#d8d2c4"); R(x - 1, y - 14, 3, 1, "#ffd23f");
  R(x - 3, y - 10, 7, 11, open ? "#ffe9a0" : "#1a1418");
  if (open) { g.fillStyle = `rgba(255,240,170,${0.25 + 0.15 * Math.sin(t * 3)})`; g.fillRect(x - 5, y - 12, 11, 13); }
  else for (let i = 0; i < 4; i++) R(x - 3 + i * 2, y - 10, 1, 11, "#5a5048");
  // torches
  [-8, 8].forEach((dx, i) => {
    R(x + dx, y - 6, 1, 5, "#5a3a20");
    if (open) { const fl = Math.sin(t * 11 + i * 2) > 0; R(x + dx, y - 8, 1, 2, fl ? "#ffd23f" : "#ff8a1a"); R(x + dx + (fl ? 0 : 0), y - 9, 1, 1, fl ? "#ff6a1a" : "#ffd23f"); }
  });
}

/* The shopkeepers' places: a market stall, a challenger's tent, a bank */
function drawStall(g, key, id, x, y, st, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const I = CAMP.islandById[key];
  const accent = I.colors.accent;
  const shut = st === "locked";
  if (id === "merchant") {
    // a stall under a striped awning, its goods on the counter
    R(x - 7, y - 4, 14, 5, "#6a4a2a"); R(x - 7, y - 4, 14, 1, "#9a6a3a");
    R(x - 6, y - 10, 1, 6, "#5a3a1e"); R(x + 5, y - 10, 1, 6, "#5a3a1e");
    for (let i = -8; i <= 7; i++) R(x + i, y - 12, 1, 2, Math.floor((i + 20) / 2) % 2 ? accent : "#f4f0e8");
    for (let i = -8; i <= 7; i += 2) R(x + i, y - 10, 1, 1, Math.floor((i + 20) / 2) % 2 ? accent : "#f4f0e8");
    if (shut) { R(x - 5, y - 9, 10, 5, "#8a6a4a"); for (let j = 0; j < 5; j += 2) R(x - 5, y - 9 + j, 10, 1, "#6a4a2a"); return; }
    const goods = { gear: ["#c8ced6", "#9aa3ad", "#3a6ab8"], spell: ["#b36bff", "#7fe3ff", "#ff6a1a"], food: ["#d8a050", "#c86a2a", "#ff3b3b"], pet: ["#ffcf5a", "#ff5a3a", "#7ac85a"], rune: ["#3ddc84", "#ffd23f", "#ff3b3b"] }[I.merchantFamily] || ["#ffd23f", "#ff3b3b", "#3ddc84"];
    goods.forEach((c, i) => { R(x - 5 + i * 4, y - 6, 2, 2, c); R(x - 5 + i * 4, y - 6, 1, 1, shadeHex(c, 0.4)); });
  } else if (id === "challenger") {
    // a tall pointed tent with a pennant
    for (let j = 0; j < 12; j++) { const w = 2 + j; R(x - Math.floor(w / 2), y - 12 + j, w, 1, j % 3 === 2 ? shadeHex(accent, -0.25) : accent); R(x - Math.floor(w / 2), y - 12 + j, 1, 1, shadeHex(accent, 0.3)); }
    for (let j = 0; j < 12; j += 2) R(x - Math.floor((2 + j) / 2) + Math.floor((2 + j) / 2), y - 12 + j, 1, 2, "#f4f0e8");
    R(x - 2, y - 5, 4, 5, shut ? "#3a2a20" : "#1a1410"); if (!shut) R(x - 1, y - 4, 2, 1, "#ffd23f");
    R(x, y - 16, 1, 4, "#5a3a20");
    for (let k = 0; k < 4; k++) R(x + 1 + k, y - 16 + Math.round(Math.sin(t * 6 - k) * 0.6), 1, 2 - (k > 2 ? 1 : 0), k % 2 ? "#ffffff" : "#c0392b");
    if (shut) { R(x - 4, y - 7, 8, 1, "#5a3a20"); R(x - 3, y - 8, 1, 3, "#5a3a20"); R(x + 2, y - 8, 1, 3, "#5a3a20"); }
  } else {
    // the bank: steps, columns, a pediment and a coin turning on its roof
    const stone = shut ? ["#8a8680", "#6a6660", "#4a4640"] : ["#e8e0d0", "#c8c0b0", "#9a9284"];
    R(x - 8, y - 1, 16, 2, stone[2]); R(x - 7, y - 2, 14, 1, stone[1]);
    for (let i = 0; i < 4; i++) { R(x - 6 + i * 4, y - 9, 2, 7, stone[0]); R(x - 5 + i * 4, y - 9, 1, 7, stone[1]); }
    R(x - 8, y - 11, 16, 2, stone[1]); R(x - 8, y - 11, 16, 1, stone[0]);
    for (let j = 0; j < 4; j++) R(x - 7 + j * 2, y - 12 - j, 14 - j * 4, 1, j % 2 ? stone[1] : stone[0]);
    R(x - 1, y - 7, 2, 5, shut ? "#3a3632" : "#2a2018");
    if (shut) return;
    const c = I.currency.color, turn = Math.abs(Math.cos(t * 1.6)), cw = Math.max(1, Math.round(5 * turn));
    R(x, y - 19, 1, 3, "#5a3a1e");
    R(x - Math.floor(cw / 2), y - 24, cw, 5, c);
    if (cw >= 3) { R(x - Math.floor(cw / 2), y - 24, cw, 1, shadeHex(c, 0.5)); R(x, y - 23, 1, 3, shadeHex(c, -0.4)); }
  }
}

/* A shopkeeper: a little snake standing tall, in its hat. Each one is a sprite sheet,
   textures/scenes/keepers/<island>-<role>.png (keeper:<island>:<role>): three columns as it sways
   (left, upright, right), four rows (eyes open, blinking, tongue out, blinking with its tongue out),
   its anchor on the bottom of its coil. x, y is that spot; the map draws them small, the shops and
   their scenes three and four times the size. */
function drawKeeper(g, isl, role, x, y, t) {
  const sway = Math.round(Math.sin(t * 1.4 + role.length) * 0.6);
  const blink = (t * 0.7 + role.length) % 5 < 0.12;
  const tongue = Math.sin(t * 2 + role.length) > 0.85;
  texDrawAt(g, `keeper:${isl}:${role}`, Math.round(x), Math.round(y), sway + 1 + 3 * ((blink ? 1 : 0) + (tongue ? 2 : 0)));
}
