/* =========================================================
   src/ui/map-deep.js
   Nightmare mode on the map (build 53): the tunnel under an island.

   Once a tunnel is open (camp-nightmare.js nmTunnelOpen), its island has a
   hole dug in the grass at its far end (a pin: go underground). Underground
   (mapUnder), the view drops below the island and the ground is cut away: a
   cave hangs under it, the roots of the Great Tree reaching down from its
   ceiling, the tunnel winding through three rows of stops (levels 1 to 10,
   the shop of the deep off level 5), and on the cave floor the Maw itself,
   coiled, its eye open in the dark, bone once it's beaten there.

   The stops are ordinary map pins (map.js renderModes): "nm-<island>-<id>",
   id roots, 1-10, shop, 11 (the Maw), and hole (on the grass: go down) and
   up (at the top of the shaft: back to the surface). They show only while
   you're underground there.
   ========================================================= */
"use strict";

const DEEP_IDS = ["roots", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "shop", 11];
const DEEP_TOP = 40, DEEP_BOTTOM = 182, DEEP_HALF = 150;     // the cave, below the island's middle (map pixels)
const deepCache = {};
const deepReveal = {};       // island -> the time its cave was dug open (for the dig)
let mapUnder = null;         // the island you're underground at, or null

/* Where the stops are, from the island's middle: [along its flow (+ = the far end), down] */
const DEEP_SPOTS = {
  1: [112, 66], 2: [64, 66], 3: [16, 66], 4: [-32, 66], 5: [-80, 66], roots: [-108, 56],
  shop: [-120, 104], 6: [-72, 106], 7: [-24, 106], 8: [24, 106], 9: [72, 106],
  10: [96, 146], 11: [8, 150], up: [98, 47]
};
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

/* The cave's outline: half its width on each row, from the island's middle */
function deepRows(key) {
  const C = deepCache[key] || (deepCache[key] = {});
  if (C.rows) return C.rows;
  const seed = ISLANDS[key].n * 13 + 5, rows = [];
  for (let y = DEEP_TOP; y <= DEEP_BOTTOM; y++) {
    const u = (y - DEEP_TOP) / (DEEP_BOTTOM - DEEP_TOP);
    // wide under the island, swelling in the middle, rounding off at the floor
    const shape = Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.92 + 0.25);
    const w = DEEP_HALF * (0.62 + 0.4 * shape) + (mapNoise(y, 3, 9, seed) - 0.5) * 10;
    const mid = Math.sin(u * 5 + seed) * 4;
    rows.push([y, Math.round(mid - w), Math.round(mid + w)]);
  }
  return (C.rows = rows);
}
/* Is a map point inside the cave under island key? */
function deepInside(key, x, y) {
  const I = ISLANDS[key], r = deepRows(key).find(r => r[0] === Math.round(y - I.y));
  if (!r) return false;
  const lx = (x - I.x) * I.dir;      // the rows are drawn mirrored on a left-running island
  return lx > r[1] + 4 && lx < r[2] - 4;
}

/* The cave, painted once (again when its progress or the Maw changes), in map pixels from
   (island x - DEEP_HALF - 12, island y + DEEP_TOP - 8) */
function deepArt(key) {
  const tag = DEEP_IDS.map(id => (typeof id !== "number" ? "" : nmLevelWon(key, id) ? "w" : nmTunLevelOpen(key, id) ? "o" : "-")).join("") + (nmMawSlain(key) ? "S" : "") + (nmShopOpen(key) ? "s" : "");
  const C = deepCache[key] || (deepCache[key] = {});
  if (C.art && C.tag === tag) return C.art;
  const I = ISLANDS[key], seed = I.n * 13 + 5, d = I.dir;
  const W = DEEP_HALF * 2 + 24, H = DEEP_BOTTOM - DEEP_TOP + 22;
  const ox = DEEP_HALF + 12, oy = 8 - DEEP_TOP;          // island-middle-relative (lx, dy) -> canvas (ox + lx, oy + dy)
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const rock = (ISLE_THEME[key] && ISLE_THEME[key].rock) || [["#4a3a30", "#3a2c24"], ["#3a2c24", "#2a2018"], ["#2a2018", "#1a1410"]];
  const rows = deepRows(key);
  // the rock around the cave: the island's own, a band six thick, darker toward the bottom
  rows.forEach(([y, l, r], i) => {
    const u = i / rows.length, layer = u < 0.3 ? 0 : u < 0.7 ? 1 : 2;
    for (let lx = l - 7; lx <= r + 7; lx++) {
      const x = ox + lx * d, yy = oy + y;
      if (lx >= l && lx <= r) {
        let col = u < 0.5 ? "#1f0f1a" : "#140810";
        if (mapHash(lx, y, seed) > 0.94) col = "#2c1626";
        px(x, yy, col);
      } else {
        const [c0, c1] = rock[layer];
        px(x, yy, ((lx + y) & 1) && mapHash(lx, y, seed + 2) > 0.5 ? c1 : c0);
      }
    }
  });
  // the floor and the roof: a closing band of rock under the cave
  for (let k = 1; k <= 7; k++) {
    const [y, l, r] = rows[rows.length - 1];
    const shrink = k * k * 1.6;
    for (let lx = Math.round(l - 7 + shrink); lx <= Math.round(r + 7 - shrink); lx++) px(ox + lx * d, oy + y + k, rock[2][(lx + k) & 1]);
  }
  const rowAt = y => rows.find(r => r[0] === y);
  const open = (lx, y) => { const r = rowAt(y); return !!r && lx > r[1] && lx < r[2]; };
  // a lighter rim along the cave's ceiling
  rows.forEach(([y, l, r]) => { for (let lx = l; lx <= r; lx++) if (!open(lx, y - 1)) px(ox + lx * d, oy + y, "#5a3440"); });
  // the Maw on the floor: a great coil of body across the cave, its head by the lair
  const slain = nmMawSlain(key);
  const pal = slain ? ["#3a3530", "#6a6058", "#9a9080", "#c8bfa8", "#efe8d4"] : ["#2a0818", "#5a1430", "#8a2046", "#c04a6a", "#f0a0b0"];
  const floor = DEEP_BOTTOM - 14;
  for (let lx = -DEEP_HALF; lx <= DEEP_HALF; lx++) {
    const cy = floor + Math.round(Math.sin(lx * 0.05 + seed) * 4);
    for (let o = -6; o <= 6; o++) {
      if (!open(lx, cy + o)) continue;
      const edge = Math.abs(o) / 6;
      let shade = edge > 0.8 ? 0 : edge > 0.5 ? 1 : o < 0 ? 3 : 2;
      if (Math.floor((lx + (o > 0 ? 2 : 0)) / 4) % 2 && shade > 1) shade--;
      if (o === -2 && ((lx % 7) + 7) % 7 < 2) shade = 4;
      px(ox + lx * d, oy + cy + o, pal[shade]);
    }
  }
  // its head, by the lair: a wide snout, the jaw a little open
  const [hf, hdy] = DEEP_SPOTS[11];
  const hx = hf - 34, hy = floor - 2;
  for (let o = -9; o <= 7; o++) for (let k = -14; k <= 14; k++) {
    const e = (k * k) / 196 + (o * o) / (o < 0 ? 81 : 49);
    if (e > 1 || !open(hx + k, hy + o)) continue;
    px(ox + (hx + k) * d, oy + hy + o, e > 0.8 ? pal[0] : o < -3 ? pal[3] : pal[2]);
  }
  if (!slain) for (let k = -10; k <= 10; k += 3) px(ox + (hx + k) * d, oy + hy + 3, "#efe8d4");     // teeth
  // the roots of the Great Tree, hanging from the ceiling
  rows.slice(0, 2).forEach(([y, l, r]) => {
    for (let lx = l + 4; lx < r - 4; lx += 5 + Math.floor(mapHash(lx, y, seed + 3) * 7)) {
      const len = 4 + Math.floor(mapHash(lx, y, seed + 4) * 14);
      for (let k = 0; k < len; k++) {
        const xx = lx + (k > len / 2 && mapHash(lx, k, seed) > 0.5 ? 1 : 0);
        if (!open(xx, y + k)) break;
        px(ox + xx * d, oy + y + k, k % 3 ? "#6a4a2a" : "#4a3018");
      }
    }
  });
  // the tunnel between the stops: lit where you've won
  const spot = id => { const [f, dy] = DEEP_SPOTS[id]; return { x: ox + f * d, y: oy + dy }; };
  const leg = (a, b, lit) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 0; i <= n; i += lit ? 1 : 2) {
      const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n + Math.sin(i * 0.3) * 0.8);
      g.fillStyle = lit ? "#a8705a" : "#4a2a36"; g.fillRect(x - (lit ? 1 : 0), y, lit ? 3 : 1, lit ? 2 : 1);
    }
  };
  leg(spot("up"), spot(1), true);
  for (let k = 1; k < 11; k++) leg(spot(k), spot(k + 1), nmLevelWon(key, k));
  leg(spot(5), spot("shop"), nmShopOpen(key));
  leg(spot(5), spot("roots"), true);
  // the shaft up to the hole: a ladder against the ceiling
  const up = spot("up");
  for (let y = 2; y < up.y; y++) { px(up.x - 3 * d, y, "#7a5a3a"); px(up.x + 3 * d, y, "#7a5a3a"); if (y % 4 === 0) for (let k = -2; k <= 2; k++) px(up.x + k * d, y, "#5a3e24"); }
  C.art = c; C.tag = tag; C.ox = ox; C.oy = oy;
  return c;
}

/* Each frame. On the surface: the hole in the grass. Underground: the cave over everything below. */
function drawDeep(g, key, t, by) {
  if (typeof nmTunnelOpen !== "function" || !camp || !camp.nm || !nmTunnelOpen(key) || placeFogged(key)) return;
  const I = ISLANDS[key], h = deepHole(key);
  const since = deepReveal[key] !== undefined ? t - deepReveal[key] : 99;
  // the hole: a dark pit with a ring of dug earth, opening as it's dug
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
  if (mapUnder !== key) return;
  const art = deepArt(key), C = deepCache[key];
  g.drawImage(art, I.x - C.ox, I.y - C.oy + by);
  // the Maw's eye, open in the dark (a slow blink)
  if (!nmMawSlain(key)) {
    const [hf] = DEEP_SPOTS[11], ex = I.x + I.dir * (hf - 34 - 7), ey = I.y + DEEP_BOTTOM - 14 - 7 + by;
    if ((t % 5) > 0.25) { mapRect(g, ex, ey, 3, 2, `rgba(255, 58, 58, ${0.7 + 0.3 * Math.sin(t * 3)})`); mapRect(g, ex + 1, ey, 1, 2, "#1a0408"); }
  }
}

/* Going down, and back up */
function enterUnder(key) {
  if (typeof nmTunnelOpen !== "function" || !nmTunnelOpen(key)) return;
  if (mapSel !== key) selectPlace(key);
  mapUnder = key;
  if (typeof mapEl !== "undefined") mapEl.classList.add("under");
  sfx("whoosh");
  updatePins();
  renderBanner();
  layoutMap();
}
function leaveUnder() {
  if (!mapUnder) return false;
  mapUnder = null;
  mapEl.classList.remove("under");
  sfx("whoosh");
  updatePins();
  renderBanner();
  layoutMap();
  return true;
}

/* The dig: the moment a tunnel opens, the map flies to its island, the ground gives way and you go down */
function deepDig(key) {
  if (currentScreen !== "modes") return;
  deepReveal[key] = performance.now() / 1000;
  if (deepCache[key]) deepCache[key].art = null;
  if (mapUnder && mapUnder !== key) leaveUnder();
  selectPlace(key);
  sfx("rock");
  mapEl.classList.remove("shake");
  void mapEl.offsetWidth;
  mapEl.classList.add("shake");
  setTimeout(() => mapEl.classList.remove("shake"), 900);
  showToast(`The ground gives way under ${CAMP.islandById[key].name}. Something vast is down there.`);
  setTimeout(() => { if (currentScreen === "modes" && mapSel === key) { sfx("portal"); enterUnder(key); } }, 1500);
}
