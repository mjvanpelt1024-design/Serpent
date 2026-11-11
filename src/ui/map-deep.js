/* =========================================================
   src/ui/map-deep.js
   Nightmare mode on the map (build 53): the back side of the islands.

   Once a tunnel is open (camp-nightmare.js nmTunnelOpen), its island has a
   hole dug in the grass at its far end. Click it and the whole world turns
   around (mapFlip): you're looking at it from behind, so everything, the
   Coil and the islands, is mirrored left to right under a darker sky, and
   every island shows its back side. On the back of an island whose tunnel
   is open, the tunnel is carved into the stone: the hole you came
   through at the far end, ten levels winding back and forth, the roots of
   the Great Tree poking through, the shop of the deep, and along the back
   a trench where the Maw lies, crimson and awake, bone once it's beaten
   there. An island whose tunnel isn't open yet is plain, sealed stone.

   The stops are ordinary map pins (map.js renderModes): "nm-<island>-<id>",
   id roots, 1-10, shop, 11 (the Maw), up (the hole, from below: flip back),
   and hole (on the grass: turn around). The tunnel's pins show only from
   behind, the surface's only from the front. Every pin keeps its spot in the
   world's own coordinates (pin._x); mapMirrorX puts it where it shows.
   ========================================================= */
"use strict";

const DEEP_IDS = ["roots", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "shop", 11];
/* Where the stops are on the back face, from the island's middle: [along its flow (+ = the far end), dy] */
const DEEP_SPOTS = {
  up: [140, -10], roots: [124, 14], 1: [96, 17], 2: [58, 17], 3: [20, 17], 4: [-18, 17], 5: [-56, 17], shop: [-98, 22],
  6: [-74, -4], 7: [-36, -4], 8: [2, -4], 9: [40, -4], 10: [78, -4], 11: [-20, -24]
};

/* ----- The tunnel's stops in the map's own stop system (map.js nodeAt, nodeState, nodeLinks...):
   ids "n1" to "n11" (the levels, 11 the Maw), "nroots", "nshop", "nup" (the hole, seen from behind).
   The path runs nup, n1 ... n11; the roots branch off between the hole and level 1, the shop off level 5. */
const isDeepId = id => typeof id === "string" && /^n(\d+|roots|shop|up)$/.test(id);
const deepRaw = id => { const r = id.slice(1); return /^\d+$/.test(r) ? Number(r) : r; };
const deepNodeAt = (key, id) => { const p = deepStop(key, deepRaw(id)); return { x: mapMirrorX(p.x), y: p.y }; };
function deepNodeState(key, id) {
  const r = deepRaw(id);
  if (r === "up" || r === "roots") return "open";
  if (r === "shop") return nmShopOpen(key) ? "open" : "locked";
  return nmLevelWon(key, r) ? "done" : nmTunLevelOpen(key, r) ? "next" : "locked";
}
function deepNodeLinks(key, id) {
  const r = deepRaw(id), out = [], add = (to, role) => out.push({ to: { key, id: to }, role });
  if (r === "up") {
    add("n1", "next"); add("nroots", "shop");
    // further down, the way in is the Maw's body: back up it to the tunnel above's lair
    const above = deepAbove(key);
    if (above) out.push({ to: { key: above, id: "n11" }, role: "back" });
  }
  else if (r === "roots") add("nup", "back");
  else if (r === "shop") add("n5", "back");
  else {
    add(r === 1 ? "nup" : "n" + (r - 1), "back");
    if (r < 11) add("n" + (r + 1), "next");
    // the Maw beaten: its body leads on down to the next tunnel
    const below = r === 11 && deepBelow(key);
    if (below && nmTunnelOpen(below)) out.push({ to: { key: below, id: "nup" }, role: "next" });
    if (r === 5) add("nshop", "shop");
  }
  return out;
}
function deepNodeTitle(key, id) {
  const r = deepRaw(id), T = CAMP.nightmare.tunnels[key];
  if (r === "up") return key === deepTop() ? "The hole" : "The Maw's body";
  if (r === "roots") return CAMP.nightmare.roots[key].name;
  if (r === "shop") return CAMP.islandById[key].npcs.merchant.shop;
  return r === 11 ? "The Maw" : `${r}. ${T.names[r - 1]}`;
}
const deepCache = {};
const deepReveal = {};       // island -> the time its hole was dug (for the dig)
let mapFlip = false;         // the world seen from behind: mirrored, every island's back side
let deepFlipAnim = null;     // { to, at, pivot } while the world turns
const DEEP_FLIP_SECS = 0.8;

function deepStop(key, id) {
  const I = ISLANDS[key];
  if (id === "hole") return deepHole(key);
  const [f, dy] = DEEP_SPOTS[id];
  return { x: Math.round(I.x + I.dir * f), y: Math.round(I.y + dy) };
}
/* The hole: on the grass at the far end, clear of the stops */
function deepHole(key) {
  const C = deepCache[key] || (deepCache[key] = {});
  if (C.hole) return C.hole;
  const I = ISLANDS[key], free = isleFree(key);
  let hf = 120;
  for (let f = 132; f > 60; f -= 2) if (free(f, 14, 4, 1.2)) { hf = f; break; }
  return (C.hole = { x: Math.round(I.x + I.dir * hf), y: Math.round(I.y + 14) });
}
/* Is a map point on an island's back face (where the grass is on the front)? World coordinates. */
function deepOnFace(key, x, y) {
  const I = ISLANDS[key], s = isleSpan(key, (x - I.x) * I.dir);
  return !!s && y - I.y > s[0] + 2 && y - I.y < s[1] - 2;
}

/* The world from behind is mirrored about the map's middle: where a world x shows */
const mapMirrored = () => mapFlip && !deepFlipAnim;
const mapMirrorX = x => (mapMirrored() ? MAP_W - x : x);

/* How to draw the world this frame: mirrored (seen from behind), and while it turns, squeezed about
   the pivot (the island in view) by k, 1 to -1. back: whether the islands show their back sides. */
function deepWorldTurn(t) {
  if (typeof currentScreen !== "undefined" && currentScreen !== "modes") return { k: 1, mirrored: false, back: false };
  if (!deepFlipAnim) return { k: 1, mirrored: mapFlip, back: mapFlip };
  const A = deepFlipAnim;
  if (A.at === null) A.at = t;
  const p = Math.min(1, (t - A.at) / DEEP_FLIP_SECS);
  if (p >= 1) {
    deepFlipAnim = null;
    // the turn is done: frame the mirrored world (the island in view stays put), no slide
    mapEl.classList.add("dragging");
    layoutMap();
    updatePins();
    requestAnimationFrame(() => mapEl.classList.remove("dragging"));
    return { k: 1, mirrored: mapFlip, back: mapFlip };
  }
  const k = Math.cos(Math.PI * (p < 0.5 ? p * p * 2 : 1 - Math.pow(1 - p, 2) * 2));
  const from = !A.to;                      // turning back starts from the mirrored world
  return { k, mirrored: from, back: from !== (k < 0), pivot: A.pivot };
}

/* ----- Each tunnel dressed in its island's own stuff (build 53 review): what hangs under the island,
   carried underground. Pictures in textures/map/deep/ (tools/textures/deep-art.py). stat: drawn once
   into the back's picture; anim: drawn every frame (frames that flicker, shimmer or sparkle);
   fx: the air down there (embers, bubbles, sparkles, spores, drips). ----- */
const DEEP_LOOK = {
  crown: { stat: ["obsidian", "obsidian", "stalagmite"], anim: ["lava-pool", "gem-red", "lava-pool"], fx: "embers", air: "#160808" },
  spire: { stat: ["crystal-violet", "crystal-ice", "crystal-violet", "stalagmite"], anim: ["gem-blue", "rune-mark"], fx: "sparkles", air: "#120c22" },
  hollow: { stat: ["toadstool", "stalagmite", "toadstool"], anim: ["amber", "amber"], hang: "roots-tangle", fx: "spores", air: "#140c06" },
  reef: { stat: ["coral-pink", "coral-fan", "shell", "coral-pink"], anim: ["pearl", "kelp", "pool"], fx: "bubbles", air: "#0a1418" },
  keep: { stat: ["ore", "stalagmite", "ore"], anim: ["glowcap", "pool", "glowcap"], beams: true, fx: "drips", air: "#0e0c0c" }
};
const deepTop = () => CAMP.nightmare.order[0];                     // the only island with a hole in its grass
const deepAbove = key => CAMP.nightmare.order[nmDepth(key) - 1] || null;
const deepBelow = key => CAMP.nightmare.order[nmDepth(key) + 1] || null;

/* The tunnel's legs, stop to stop (the same ones its pins walk): [from, to, walked] */
function deepLegs(key) {
  const legs = [["up", 1, true]];
  for (let k = 1; k < 11; k++) legs.push([k, k + 1, nmLevelWon(key, k)]);
  legs.push([5, "shop", nmShopOpen(key)]);
  return legs;
}

/* An island's back side, painted once (again when its progress changes). Origin: (C.ox, C.oy) = its middle. */
function deepBackArt(key) {
  const open = typeof nmTunnelOpen === "function" && camp && camp.nm && nmTunnelOpen(key);
  const tag = !open ? "sealed" : DEEP_IDS.map(id => (typeof id !== "number" ? "" : nmLevelWon(key, id) ? "w" : nmTunLevelOpen(key, id) ? "o" : "-")).join("") + (nmMawSlain(key) ? "S" : "") + (nmShopOpen(key) ? "s" : "") + (key === deepTop() ? "T" : "");
  const C = deepCache[key] || (deepCache[key] = {});
  if (C.art && C.tag === tag) return C;
  const I = ISLANDS[key], d = I.dir, seed = I.n * 13 + 5;
  const art = islandArt(key), src = texCanvas(`map:${key}:under`), form = isleForm(key);
  const W = src.width, H = src.height;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const ox = art.ox, oy = art.oy;
  const LOOK = DEEP_LOOK[key] || DEEP_LOOK.keep;
  // the island's rock and ground (the world mirrors it as it's seen from behind); its grass becomes the back face below
  g.drawImage(src, 0, 0);
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const T = (ISLE_THEME[key] || {}).rock || [["#4a3a30", "#3a2c24"], ["#3a2c24", "#2a2018"], ["#2a2018", "#1a1410"]];
  const wall = [shadeHex(T[0][0], -0.18), shadeHex(T[1][0], -0.22), shadeHex(T[2][0], -0.25), shadeHex(T[2][1], -0.45)];   // lit .. deep
  const local = (f, dy) => [Math.round(ox + d * f), Math.round(oy + dy)];
  const faceSpan = lx => form.top[lx - ox + form.reach] || null;
  const faceAt = (lx, ly) => { const s = faceSpan(lx); return s && ly - oy > s[0] && ly - oy < s[1] ? s : null; };
  // the face: the stone the island is made of, cut open, in layers that wave along it
  for (let lx = ox - form.reach; lx <= ox + form.reach; lx++) {
    const s = faceSpan(lx);
    if (!s) continue;
    for (let ly = Math.ceil(oy + s[0]); ly <= Math.floor(oy + s[1]); ly++) {
      const edge = Math.min(ly - (oy + s[0]), oy + s[1] - ly);
      const band = (ly - oy - s[0]) / Math.max(1, s[1] - s[0]);
      const layer = Math.floor((ly - oy + Math.sin(lx * 0.07 + seed) * 2.5 + Math.sin(lx * 0.023) * 3) / 5);
      let col = wall[Math.min(3, Math.floor(band * 2.6) + (layer & 1 ? 1 : 0))];
      if (((lx + ly) & 1) && mapHash(lx, ly, seed) > 0.6) col = shadeHex(col, -0.1);
      if (mapHash(lx, ly, seed + 9) > 0.985) col = shadeHex(col, 0.18);                       // a glint in the stone
      if (mapHash(lx >> 1, ly, seed + 3) > 0.993) col = shadeHex(col, -0.4);                  // a crack
      if (edge < 1.5) col = shadeHex(wall[0], ly - oy > 0 ? 0.12 : -0.35);
      if (!open) col = shadeHex(col, -0.35);
      px(lx, ly, col);
    }
  }
  C.anim = [];
  if (open) {
    // the Maw's trench along the back, and the Maw in it
    const slain = nmMawSlain(key);
    const pal = slain ? ["#3a3530", "#6a6058", "#9a9080", "#c8bfa8", "#efe8d4"] : ["#2a0818", "#5a1430", "#8a2046", "#c04a6a", "#f0a0b0"];
    for (let f = -150; f <= 150; f++) {
      const cy = -24 + Math.round(Math.sin(f * 0.05 + seed) * 2);
      for (let o = -6; o <= 6; o++) {
        const [x, y] = local(f, cy + o);
        if (!faceAt(x, y) || !faceAt(x, y - 2) || !faceAt(x, y + 2)) continue;
        if (Math.abs(o) >= 5) { px(x, y, "#0e0608"); continue; }       // the trench's dark walls
        const e = Math.abs(o) / 4;
        let shade = e > 0.8 ? 0 : e > 0.5 ? 1 : o < 0 ? 3 : 2;
        if (Math.floor((f + (o > 0 ? 2 : 0)) / 4) % 2 && shade > 1) shade--;
        if (o === -1 && ((f % 7) + 7) % 7 < 2) shade = 4;
        px(x, y, pal[shade]);
      }
    }
    // its head, raised at the lair, jaw open
    const [mf, mdy] = DEEP_SPOTS[11];
    for (let o = -6; o <= 5; o++) for (let k = -12; k <= 12; k++) {
      const e = (k * k) / 144 + (o * o) / (o < 0 ? 36 : 25);
      if (e > 1) continue;
      const [x, y] = local(mf - 22 + k, mdy + o);
      px(x, y, e > 0.8 ? pal[0] : o < -2 ? pal[3] : pal[2]);
    }
    if (!slain) for (let k = -9; k <= 9; k += 3) { const [x, y] = local(mf - 22 + k, mdy + 3); px(x, y, "#efe8d4"); }

    // ----- the tunnel: carved out of the rock stop to stop, its floor a trodden path like the ones above -----
    const spot = id => local(DEEP_SPOTS[id][0], DEEP_SPOTS[id][1]);
    const mid = [Math.round((spot("up")[0] + spot(1)[0]) / 2), Math.round((spot("up")[1] + spot(1)[1]) / 2)];
    const legs = deepLegs(key).map(([a, b, lit]) => [spot(a), spot(b), lit]).concat([[mid, spot("roots"), true]]);
    const carved = [];                            // every point of the tunnel's floor, to keep things off it
    const along = (A, B, fn) => {
      const n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1])) || 1;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        fn(Math.round(A[0] + (B[0] - A[0]) * f), Math.round(A[1] + (B[1] - A[1]) * f + Math.sin(f * Math.PI * 2 + n) * (A[1] === B[1] ? 1.2 : 0)), i, n);
      }
    };
    // the hollow: dark air over the floor
    legs.forEach(([A, B, lit]) => along(A, B, (x, y) => {
      carved.push([x, y]);
      const r = lit ? 4 : 3;
      for (let dy = -r - 3; dy <= 1; dy++) for (let dx = -r; dx <= r; dx++) {
        if ((dx * dx) / (r * r) + ((dy + 2) * (dy + 2)) / ((r + 1) * (r + 1)) > 1) continue;
        if (!faceAt(x + dx, y + dy)) continue;
        px(x + dx, y + dy, dy >= 0 ? shadeHex(wall[2], -0.25) : shadeHex(LOOK.air, lit ? 0.12 : 0));
      }
    }));
    // its ceiling's edge, picked out in the lit stone
    legs.forEach(([A, B, lit]) => along(A, B, (x, y) => {
      const r = lit ? 4 : 3;
      for (let dx = -r + 1; dx <= r - 1; dx++) {
        const yy = y - r - 4 + (Math.abs(dx) > r - 2 ? 1 : 0);
        if (faceAt(x + dx, yy) && !carved.some(([cx, cy]) => cx === x + dx && Math.abs(cy - yy) < r + 2 && cy > yy + r)) px(x + dx, yy, shadeHex(wall[0], -0.05));
      }
    }));
    // the path: trodden smooth where you've won your way, faint where you haven't yet
    const dirt = isleDirt(key).map((h, i) => shadeHex(h, i === 2 ? 0 : -0.08));
    legs.forEach(([A, B, lit]) => along(A, B, (x, y, i, n) => {
      if (!lit) { if (i % 3 === 0) px(x, y + 1, shadeHex(dirt[1], -0.3)); return; }
      g.fillStyle = dirt[0]; g.fillRect(x - 1, y, 3, 2);
      g.fillStyle = dirt[1]; g.fillRect(x - 1, y + 2, 3, 1);
      if (mapHash(i, n, 3) > 0.82) px(x, y, dirt[2]);
    }));
    const nearPath = (x, y, r) => carved.some(([cx, cy]) => Math.abs(cx - x) < r && Math.abs(cy - y) < r);
    const stops = DEEP_IDS.concat(["up"]).map(spot);
    const nearStop = (x, y, r) => stops.some(([sx, sy]) => Math.abs(sx - x) < r && Math.abs(sy - y) < r);
    // stalactites from the tunnel's ceiling, in the island's own rock
    const rockColors = { rock: shadeHex(wall[0], -0.1), rockLit: shadeHex(wall[0], 0.12), rockDark: wall[2] };
    legs.forEach(([A, B], li) => along(A, B, (x, y, i) => {
      if ((i + li * 5) % 13 || nearStop(x, y, 6) || mapHash(i, li, seed) < 0.45) return;
      const yy = y - 8;
      if (faceAt(x, yy - 1)) texPaint(g, "deep:stalactite", x - 1, yy, { colors: rockColors });
    }));
    // mine timbers holding up the Iron Tail, a lantern on each
    if (LOOK.beams) legs.forEach(([A, B, lit], li) => along(A, B, (x, y, i) => {
      if (!lit || (i + li * 7) % 21 || nearStop(x, y, 7)) return;
      texDrawAt(g, "deep:beam", x, y + 1);
      C.anim.push({ id: "deep:lantern", x: x - ox, y: y - 8 - oy, rate: 3 + (i % 3) });
    }));
    // the island's own things, in the rock around the tunnel
    const pool = LOOK.stat.map(id => ({ id, a: false })).concat(LOOK.anim.map(id => ({ id, a: true })));
    let placed = 0;
    for (let i = 0; i < 300 && placed < 34; i++) {
      const f = -150 + mapHash(i, 11, seed) * 300, dy = -14 + mapHash(i, 12, seed) * 40;
      const [x, y] = local(f, dy);
      if (!faceAt(x, y) || !faceAt(x - 4, y - 8) || !faceAt(x + 4, y + 2) || nearPath(x, y + 2, 7) || nearStop(x, y, 10)) continue;
      const pick = pool[Math.floor(mapHash(i, 13, seed) * pool.length)];
      const id = "deep:" + pick.id;
      if (pick.a) C.anim.push({ id, x: x - ox, y: y - oy, rate: 1.5 + mapHash(i, 14, seed) * 2 });
      else if (id === "deep:stalagmite") texPaint(g, id, x - 1, y - 3, { colors: rockColors });
      else texDrawAt(g, id, x, y);
      placed++;
    }
    // roots of the tree above, poking through; hanging thick where the island's made of them
    for (let i = 0; i < 26; i++) {
      const f = -140 + mapHash(i, 4, seed) * 280, dy = -16 + mapHash(i, 5, seed) * 36;
      let [x, y] = local(f, dy);
      if (!faceAt(x, y) || nearPath(x, y, 5)) continue;
      const len = 3 + Math.floor(mapHash(i, 6, seed) * 6);
      for (let k = 0; k < len; k++) {
        if (!faceAt(x, y)) break;
        px(x, y, k % 2 ? "#6a4a2a" : "#4a3018");
        x += mapHash(i, k, seed) > 0.5 ? 1 : -1; y += k % 2;
      }
    }
    if (LOOK.hang) legs.forEach(([A, B], li) => along(A, B, (x, y, i) => {
      if ((i + li * 3) % 17 || nearStop(x, y, 7)) return;
      texDrawAt(g, "deep:" + LOOK.hang, x, y - 8);
    }));
    // the roots' stop: a knot of them where the path branches off
    const [rx, ry] = spot("roots");
    texDrawAt(g, "deep:root-knot", rx, ry + 2);
    // where the tunnel starts: on the top island, the hole you came down (daylight, and a ladder);
    // further down, the way in through the Maw's body from the tunnel above
    const [hx, hy] = spot("up");
    if (key === deepTop()) {
      for (let dy = -14; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) {
        const k = Math.abs(dx) / 4.5;
        if (k > 1 || !faceAt(hx + dx, hy + dy)) continue;
        px(hx + dx, hy + dy, shadeHex("#f6e8c8", -0.15 - k * 0.45 - Math.max(0, dy + 14) * 0.02));
      }
      texDrawAt(g, "deep:ladder", hx, hy - 13);
    } else {
      texDrawAt(g, "deep:maw-door", hx, hy + 2);
    }
  }
  Object.assign(C, { art: c, tag, ox, oy });
  return C;
}

/* One island on the map, for paintMapWorld: its front (surface()) or its back */
function deepDrawIsland(g, key, t, by, back, surface) {
  const I = ISLANDS[key];
  if (!back || placeFogged(key)) { surface(); return; }
  const B = deepBackArt(key);
  g.drawImage(B.art, I.x - B.ox, I.y - B.oy + by);
  if (!nmTunnelOpen(key)) return;
  // what flickers, shimmers and sparkles
  (B.anim || []).forEach((a, i) => texDrawAt(g, a.id, Math.round(I.x + a.x), Math.round(I.y + a.y + by), Math.floor(t * a.rate + i * 0.37) % 2));
  // the Maw's eye, open in its trench
  if (!nmMawSlain(key) && (t % 5) > 0.25) {
    const [mf, mdy] = DEEP_SPOTS[11];
    mapRect(g, I.x + I.dir * (mf - 30) - 1, I.y + mdy - 3 + by, 3, 2, `rgba(255, 58, 58, ${0.7 + 0.3 * Math.sin(t * 3)})`);
  }
  drawDeepStops(g, key, t, by);
  drawDeepAir(g, key, t, by);
}

/* The tunnel's stops, like the ones above: a stepping stone for each level (a pennant once it's won, a
   glow on the next, a torch by the ones you've reached), the merchant's stall and its keeper off level 5 */
function drawDeepStops(g, key, t, by) {
  for (let k = 1; k <= 10; k++) {
    const p = deepStop(key, k), x = p.x, y = p.y + by;
    const won = nmLevelWon(key, k), open = nmTunLevelOpen(key, k);
    texPaint(g, "map:stone", Math.round(x) - 3, Math.round(y), { frame: open ? 1 : 0 });
    if (won) {
      const fx = x + 4;
      texDraw(g, "map:pennant-pole", Math.round(fx), Math.round(y - 7));
      texPaint(g, "map:pennant", Math.round(fx + 1), Math.round(y - 7 + Math.round(Math.sin(t * 5 + k) * 0.6)), { colors: { flag: "#c03e5c" } });
      texPaint(g, "map:pennant-shade", Math.round(fx + 1), Math.round(y - 5), { colors: { shade: "#7a1a34" } });
    } else if (open) { const s = 0.5 + 0.5 * Math.sin(t * 3); texPaint(g, "map:stone-glow", x - 5, y - 1, { alpha: 0.25 + 0.3 * s }); }
    if (open && k % 2) { texDraw(g, "map:lantern-post", Math.round(x - 6), Math.round(y - 11)); texDraw(g, "map:torch-flame", Math.round(x - 6), Math.round(y - 13), Math.sin(t * 11 + k) > 0 ? 0 : 1); }
  }
  const s = deepStop(key, "shop"), shut = !nmShopOpen(key);
  const id = `map:${key}:stall-merchant`;
  texPaint(g, id, Math.round(s.x) - texAnchor(id)[0], Math.round(s.y + by) - texAnchor(id)[1], { frame: shut ? 1 : 0, colors: { accent: "#8a2046", accentDark: "#5a1430", accentLit: "#c04a6a" } });
  if (!shut) drawKeeper(g, key, "merchant", s.x + ISLANDS[key].dir * 9, s.y + by + 1, t);
}

/* The air in each tunnel: embers rising in the Gullet, sparkles in the Spine, spores in the Gizzard,
   bubbles in the Belly, drips in the Iron Tail */
function drawDeepAir(g, key, t, by) {
  const I = ISLANDS[key], look = DEEP_LOOK[key] || DEEP_LOOK.keep;
  for (let i = 0; i < 18; i++) {
    const f = -130 + mapHash(i, 21, I.n) * 260, dy = -14 + mapHash(i, 22, I.n) * 34;
    const x0 = I.x + I.dir * f, y0 = I.y + dy + by;
    const ph = (t * (0.25 + mapHash(i, 23, I.n) * 0.3) + mapHash(i, 24, I.n)) % 1;
    if (look.fx === "embers") mapRect(g, x0 + Math.sin(t * 2 + i) * 2, y0 - ph * 12, 1, 1, ph > 0.7 ? "#ffb030" : "#ff6a1a");
    else if (look.fx === "bubbles") { if (ph < 0.85) mapRect(g, x0 + Math.sin(t * 3 + i), y0 - ph * 14, 1, 1, "rgba(200,240,255,0.8)"); }
    else if (look.fx === "sparkles") { if (Math.sin(t * 4 + i * 2.3) > 0.9) mapRect(g, x0, y0, 1, 1, i % 2 ? "#ffffff" : "#7fe3ff"); }
    else if (look.fx === "spores") mapRect(g, x0 + Math.sin(t * 0.8 + i) * 3, y0 + Math.cos(t * 0.6 + i) * 2, 1, 1, `rgba(255,200,90,${(0.4 + 0.4 * Math.sin(t * 2 + i)).toFixed(2)})`);
    else if (ph > 0.4) mapRect(g, x0, y0 - 6 + (ph - 0.4) * 16, 1, 1, "rgba(150,190,230,0.75)");
  }
}

/* The hole in the grass, right way up (it opens as it's dug, with a little dust) */
function drawDeepHole(g, key, t, by) {
  if (typeof nmTunnelOpen !== "function" || !camp || !camp.nm || key !== deepTop() || !nmTunnelOpen(key) || placeFogged(key)) return;
  const h = deepHole(key);
  const since = deepReveal[key] !== undefined ? t - deepReveal[key] : 99;
  const grow = Math.min(1, Math.max(0.2, since / 1.2));
  for (let dy = -3; dy <= 3; dy++) for (let dx = -9; dx <= 9; dx++) {
    const e = ((dx * dx) / 81 + (dy * dy) / 9) / grow;
    if (e > 1.15) continue;
    mapRect(g, h.x + dx, h.y + dy + by, 1, 1, e > 0.75 ? "#6a4a2a" : e > 0.55 ? "#3a2414" : "#0a0406");
  }
  if (since < 3) for (let i = 0; i < 14; i++) {
    const x = h.x + (mapHash(i, 3, 9) - 0.5) * 16, y = h.y - 2 - ((since * 26 + i * 5) % 18);
    mapRect(g, x, y + by, 1, 1, "#8a6a4a");
  }
}

/* Turning the map over, and back. key: the island to look at once it's over. */
function enterUnder(key, instant = false) {
  if (typeof nmTunnelOpen !== "function" || !nmTunnelOpen(key)) return;
  if (mapSel !== key) selectPlace(key);
  // coming back from a level (or a shop, or the roots): already around the back, no turn to watch
  if (!mapFlip && instant) { mapFlip = true; deepFlipAnim = null; mapEl.classList.add("flipped"); }
  deepRemember(true, key);
  if (!mapFlip) {
    // turn about the island in view, where it shows now (the world isn't mirrored yet)
    deepFlipAnim = { to: true, at: null, pivot: ISLANDS[key].x };
    mapFlip = true;
    mapEl.classList.add("flipped");
    sfx("whoosh");
  }
  updatePins();
  renderBanner();
  renderLegend();
  layoutMap();
}
function leaveUnder() {
  if (!mapFlip) return false;
  const k = mapSel || mapViewIsl;
  deepRemember(false, k);
  deepFlipAnim = { to: false, at: null, pivot: k ? MAP_W - ISLANDS[k].x : MAP_W / 2 };
  mapFlip = false;
  mapEl.classList.remove("flipped");
  sfx("whoosh");
  updatePins();
  renderBanner();
  renderLegend();
  layoutMap();
  return true;
}
const deepFlipping = () => !!deepFlipAnim;

/* Where you were (build 53 review): underground or not, and on which island, kept in the save so the map
   opens there again, in a later session too */
function deepRemember(under, key) {
  if (!camp || !camp.nm) return;
  const at = key && campIslandOpen(key) ? key : camp.at;
  if (camp.nm.under === under && camp.at === at) return;
  camp.nm.under = under;
  camp.at = at;
  saveCamp();
}
/* The map just opened on island key: around the back again if that's where you left it */
function deepResume(key) {
  if (!camp || !camp.nm || !camp.nm.under || typeof nmTunnelOpen !== "function" || !nmTunnelOpen(key)) return false;
  enterUnder(key, true);
  return true;
}
/* The side button (the legend's moon): turn the world around where you are, or back */
function deepToggle() {
  if (mapFlip) { leaveUnder(); return; }
  const here = mapSel || mapViewIsl || camp.at;
  enterUnder(here && nmTunnelOpen(here) ? here : nmCurrentTunnel());
}
/* The tunnel's first stop, clicked: on the top island the hole (turn back around); further down, the
   Maw's body (up it to the tunnel above, at its Maw) */
function deepUpAct(key) {
  const above = deepAbove(key);
  if (key === deepTop() || !above) { leaveUnder(); return; }
  selectPlace(above);
  openLevelPop(above, "n11", false, mapPinsEl.querySelector(`[data-key="nm-${above}-11"]`));
}

/* The dig: the moment a tunnel opens, the map flies to its island, the ground gives way, and it all turns over */
function deepDig(key) {
  if (currentScreen !== "modes") return;
  deepReveal[key] = performance.now() / 1000;
  if (deepCache[key]) deepCache[key].art = null;
  if (key !== deepTop()) {
    // no hole up here: the beaten Maw's body opens into the next tunnel down, and you go straight there
    if (!mapFlip) enterUnder(key); else selectPlace(key);
    deepRemember(true, key);
    sfx("rock");
    mapEl.classList.remove("shake"); void mapEl.offsetWidth; mapEl.classList.add("shake");
    setTimeout(() => mapEl.classList.remove("shake"), 900);
    showToast(`The Maw's body goes on down, into ${CAMP.nightmare.tunnels[key].name} under ${CAMP.islandById[key].name}.`);
    return;
  }
  if (mapFlip) leaveUnder();
  selectPlace(key);
  sfx("rock");
  mapEl.classList.remove("shake");
  void mapEl.offsetWidth;
  mapEl.classList.add("shake");
  setTimeout(() => mapEl.classList.remove("shake"), 900);
  showToast(`The ground gives way under ${CAMP.islandById[key].name}. Something vast is down there.`);
  setTimeout(() => { if (currentScreen === "modes" && mapSel === key) { sfx("portal"); enterUnder(key); } }, 1600);
}
