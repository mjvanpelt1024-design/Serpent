/* =========================================================
   src/ui/map.js
   The map: islands, bridges, the Commons, pins and camera
   ========================================================= */
"use strict";

/* =========================================================
   The Map: floating islands strung along the body of the Coil,
   a road that winds right, climbs, winds back left and climbs
   again, from the Commons at the bottom to the Maw at the top
   (src/ui/map-coil.js). It fills the screen; drag to travel along
   it, scroll or pinch to zoom. Fly into an island to see its
   levels on top and its Nightmares hanging underneath. Painted at
   a low resolution and shown with chunky pixels; it animates only
   while open.
   ========================================================= */
const MAP_W = 600;            // map pixels (each one is 2 world units)
const MAP_H = 340;
/* x, y: the middle of the island's grassy top. w: its width */
/* x, y: the middle of the island's grassy top. w: its width. The islands come from the
   [map] part of each world.txt; the Workshop and the Commons are fixed parts of the map. */
const ISLANDS = {};
MODE_KEYS.forEach(key => {
  const m = CONTENT.worlds[key].info.map || {};
  ISLANDS[key] = { x: m.x, y: m.y, w: m.width, name: CONTENT.worlds[key].info.name || key };
});
ISLANDS.sandbox = { x: 70, y: 54, w: 26, name: "Workshop" };
ISLANDS.commons = { x: 74, y: 290, w: 128, name: "The Commons" };
const MAP_PLACES = ISLANDS;
const MAP_ORDER = MODE_KEYS.concat("sandbox");
Object.values(ISLANDS).forEach(i => {
  i.th = Math.max(3, Math.round(i.w * 0.16));       // half the thickness of the grassy top
  i.depth = Math.round(i.w * 0.5);                  // how far the rock hangs down
  i.phase = (i.x * 7 + i.y * 3) % 10;
});
ISLANDS.commons.th = 5;                             // the Commons is long and flat, a village green
ISLANDS.commons.depth = 16;
/* The four landmarks on the Commons, and the screens they open */
const COMMONS = [
  { id: "inventory", name: "The Satchel", label: "Inventory", dx: -28 },
  { id: "exchange", name: "The Exchange", label: "XP to Snakebucks", dx: 26 }
];

const MAP_BIOME = Object.fromEntries(MODE_KEYS.map(key => [key, (CONTENT.worlds[key].info.map || {}).colors || ["#5aab45", "#4f9a3a", "#2f6a24"]]));
MAP_BIOME.sandbox = ["#eadcbc", "#dccdab", "#b39f78"];
MAP_BIOME.commons = ["#6cbf52", "#5aab45", "#2f6a24"];

let mapSel = null;            // the area being looked at, or null for the whole world
let mapLevel = { j: 0, nm: false };
let mapNight = false;
let mapRaf = 0;
let mapFrame = 0;
const mapFog = {};
const islandCache = {};
let mapDeep = false;

const mapEl = document.getElementById("map");
const mapWorldEl = document.getElementById("map-world");
const mapCanvas = document.getElementById("map-canvas");
const mapPinsEl = document.getElementById("map-pins");
const mapBriefEl = document.getElementById("map-brief");

function mapHash(x, y, seed = 7) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mapNoise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = mapHash(x0, y0, seed), b = mapHash(x0 + 1, y0, seed);
  const c = mapHash(x0, y0 + 1, seed), d = mapHash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const nextLockedIndex = () => {
  const i = MODE_KEYS.findIndex(k => !isModeUnlocked(k));
  return i === -1 ? MODE_KEYS.length : i;
};

function placeFogged(key) {
  if (key === "commons") return false;
  if (key === "sandbox") return !allModesUnlocked();
  if (isModeUnlocked(key)) return false;            // an island you own is never lost in the clouds
  return MODE_KEYS.indexOf(key) > nextLockedIndex();
}

function placeState(key) {
  if (key === "sandbox") return sandboxUnlocked() ? "open" : placeFogged(key) ? "fog" : "locked";
  if (isModeUnlocked(key)) return "open";
  if (placeFogged(key)) return "fog";
  return modeUnlockState(key).ready ? "ready" : "locked";
}

function placeTitle(key) {
  return key === "sandbox" ? "The Workshop" : STORY[key].title;
}

function mapRect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

function mapTree(g, x, y, canopy, fruit) {
  mapRect(g, x, y + 3, 1, 3, "#5a3a22");
  mapRect(g, x - 2, y - 1, 5, 4, canopy);
  mapRect(g, x - 1, y - 2, 3, 1, canopy);
  if (fruit) { mapRect(g, x - 1, y, 1, 1, fruit); mapRect(g, x + 1, y + 1, 1, 1, fruit); }
}

/* Where the level and Nightmare markers sit, relative to the island */
function levelSpots(key) {
  const i = ISLANDS[key];
  const dx = Math.round(i.w * 0.3);
  return {
    top: [-dx, 0, dx].map((x, j) => ({ x: i.x + x, y: i.y + (j === 1 ? -1 : 1) })),
    under: [-Math.round(i.w * 0.24), 0, Math.round(i.w * 0.24)].map((x, j) => ({ x: i.x + x, y: i.y + i.th + i.depth + 4 + (j === 1 ? 4 : 0) }))
  };
}

/* ----- One island, painted once into its own little canvas ----- */
function paintIsland(key, fog) {
  const isl = ISLANDS[key];
  const W = isl.w + 10, H = isl.th * 2 + isl.depth + 20;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const cx = Math.floor(W / 2), cy = isl.th + 12;      // room above for landmarks
  const [a, b, edge] = fog ? ["#c9d2df", "#bcc6d4", "#9aa6b8"] : MAP_BIOME[key];
  const seed = key.length * 13 + isl.x;
  // the rock underneath, tapering to a ragged point
  for (let r = 0; r <= isl.depth; r++) {
    const f = 1 - r / isl.depth;
    const half = (isl.w / 2) * Math.pow(f, 0.8) + (mapHash(r, seed, 3) - 0.5) * 2.2;
    if (half < 0.6) break;
    const y = cy + isl.th - 1 + r;
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      let col;
      if (fog) col = (x + r) % 3 ? "#aab4c4" : "#9ea9ba";
      else if (r < isl.depth * 0.28) col = ((x + r) & 1) && mapHash(x, r, seed) > 0.5 ? "#6c482b" : "#7a5232";
      else if (r < isl.depth * 0.62) col = mapHash(x, r, seed + 1) > 0.7 ? "#4e4038" : "#5e4a3a";
      else col = mapHash(x, r, seed + 2) > 0.6 ? "#57545c" : "#4c4a50";
      if (x === Math.round(half)) col = fog ? "#8c97a8" : "#2e2420";
      if (x === -Math.round(half) && !fog) col = "#8a6440";
      mapRect(g, cx + x, y, 1, 1, col);
    }
  }
  // roots and vines hanging off the underside
  if (!fog) for (let k = 0; k < 4; k++) {
    const x = cx - isl.w / 3 + k * (isl.w / 4.4);
    const y0 = cy + isl.th + Math.round(isl.depth * 0.3 * mapHash(k, seed, 9));
    const len = 2 + Math.floor(mapHash(k, seed, 11) * 5);
    for (let r = 0; r < len; r++) mapRect(g, x + (r > 2 ? 1 : 0), y0 + r, 1, 1, r === len - 1 && key === "easy" ? "#5aab45" : "#3e2a1a");
  }
  // the grassy top
  for (let dy = -isl.th; dy <= isl.th; dy++) {
    const half = (isl.w / 2) * Math.sqrt(1 - Math.pow(dy / (isl.th + 0.5), 2));
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      let col = ((x + dy) & 1) && mapHash(x, dy, seed + 5) > 0.45 ? b : a;
      if (dy >= isl.th - 1) col = edge;
      if (dy === -isl.th || (dy < 0 && Math.abs(x) >= Math.round(half) - 1)) col = fog ? "#e3e9f1" : shadeHex(a, 0.18);
      mapRect(g, cx + x, cy + dy, 1, 1, col);
    }
  }
  if (!fog) paintLandmark(g, key, cx, cy, isl);
  return { c, ox: cx, oy: cy };
}

function shadeHex(hex, k) {
  const c = hexToRgb(hex).map(v => Math.round(v + (255 - v) * k));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}

function paintLandmark(g, key, x, y, isl) {
  const r = seededRandom(key.length * 977);
  const spot = (rx, ry) => [x + (r() - 0.5) * isl.w * rx, y + (r() - 0.5) * isl.th * 2 * ry];
  if (key === "easy") {
    for (let i = 0; i < 16; i++) { const [px, py] = spot(0.85, 0.8); mapRect(g, px, py, 1, 1, ["#ff6b6b", "#ffe066", "#ffffff", "#ff9ad5"][i % 4]); }
    mapTree(g, x - 9, y - 6, "#2f7d2a", "#ff3b3b"); mapTree(g, x + 10, y - 5, "#2f7d2a", "#ff3b3b");
  } else if (key === "classic") {
    const w = 16, h = 6, x0 = x - 8, y0 = y - 6;
    for (let i = 0; i < w; i++) { mapRect(g, x0 + i, y0, 1, 2, i % 3 ? "#b23a3a" : "#8e2b2b"); if (i < 6 || i > 9) mapRect(g, x0 + i, y0 + h, 1, 2, i % 3 ? "#b23a3a" : "#8e2b2b"); }
    for (let j = 0; j < h; j++) { mapRect(g, x0, y0 + j, 2, 1, "#9a2f30"); mapRect(g, x0 + w - 2, y0 + j, 2, 1, "#9a2f30"); }
  } else if (key === "challenge") {
    for (let i = 0; i < 6; i++) { const [px, py] = spot(0.8, 0.5); const s = 2 + Math.floor(r() * 3); mapRect(g, px, py - s + 1, s + 1, s, "#5d5c58"); mapRect(g, px, py - s, s, s, "#c2c1bb"); mapRect(g, px, py - s, 1, 1, "#eeede8"); }
  } else if (key === "insane") {
    ["#4fd6ff", "#ff6fb0", "#b36bff"].forEach((c, i) => { const px = x - 7 + i * 6, py = y - 7; mapRect(g, px, py, 3, 5, c); mapRect(g, px, py, 1, 5, "rgba(255,255,255,0.5)"); mapRect(g, px + 1, py + 5, 1, 2, "#d9b98a"); });
  } else if (key === "chaos") {
    for (let i = 0; i < 4; i++) mapTree(g, x - 10 + i * 7, y - 6 + (i % 2) * 2, "#2b6a26", "#ff3b3b");
  } else if (key === "mirror") {
    for (let i = 0; i < 5; i++) { const px = x - 9 + i * 4.5, h = 4 + (i % 3) * 2; for (let j = 0; j < h; j++) mapRect(g, px - Math.floor(j / 3), y - j, 1 + Math.floor(j / 1.5), 1, j > h - 3 ? "#e9feff" : "#8fe3ff"); }
  } else if (key === "treasure") {
    for (let j = 0; j < 10; j++) mapRect(g, x - j, y - 11 + j, j * 2 + 1, 1, j < 2 ? "#efe7d5" : "#8a6a3a");
    mapRect(g, x - 2, y - 5, 5, 5, "#ffcf33"); mapRect(g, x - 1, y - 4, 3, 4, "#b8860b");
  } else if (key === "endless") {
    for (let j = 0; j < 7; j++) { const w = 18 - Math.abs(j - 6) * 2.4; mapRect(g, x - w / 2, y - 7 + j, w, 1, "#8c7a5c"); }
    mapRect(g, x - 2, y - 4, 4, 4, "#141010"); mapRect(g, x - 1, y - 5, 2, 1, "#141010");
    for (let i = 0; i < 10; i++) { mapRect(g, x + 2 + i, y, 1, 1, "#3a2c20"); if (i % 2 === 0) mapRect(g, x + 2 + i, y - 1, 1, 2, "#5e4a36"); }
  } else if (key === "inferno") {
    for (let i = 0; i < 8; i++) { const [px, py] = spot(0.8, 0.6); mapRect(g, px, py, 2 + Math.floor(r() * 3), 1, "#ff6a1a"); }
    mapRect(g, x + 5, y - 10, 3, 9, "#2a1512"); mapRect(g, x + 4, y - 11, 5, 2, "#3c1f19");
  } else if (key === "labyrinth") {
    for (let j = -isl.th + 1; j < isl.th; j += 2) for (let i = -10; i <= 10; i++) if (mapHash(i + 50, j + 50, 9) < 0.6) mapRect(g, x + i, y + j, 1, 1, "#a896e0");
  } else if (key === "sunflower") {
    for (let i = 0; i < 6; i++) { const px = x - 12 + i * 5, h = 4 + (i % 3); mapRect(g, px, y - h, 1, h, "#3a7a2a"); mapRect(g, px - 1, y - h - 2, 3, 3, "#ffcf33"); mapRect(g, px, y - h - 1, 1, 1, "#7a4a18"); }
  } else if (key === "bramble") {
    for (let i = 0; i < 5; i++) { const [px, py] = spot(0.8, 0.5); mapRect(g, px - 2, py - 3, 5, 3, "#2d5a1e"); mapRect(g, px - 1, py - 4, 3, 1, "#3f7a2a"); mapRect(g, px + 1, py - 3, 1, 1, "#c0282e"); mapRect(g, px - 3, py - 2, 1, 1, "#e8e0c8"); }
  } else if (key === "hive") {
    mapRect(g, x - 1, y - 14, 2, 3, "#5a3a20");
    for (let j = 0; j < 7; j++) { const w = 9 - Math.abs(j - 3) * 2; mapRect(g, x - Math.floor(w / 2), y - 11 + j, w, 1, j % 2 ? "#e0a820" : "#c08a10"); }
    mapRect(g, x - 1, y - 6, 2, 1, "#3a2a10");
  } else if (key === "thunder") {
    for (let j = 0; j < 10; j++) { const w = j * 2 + 1; mapRect(g, x - j, y - 11 + j, w, 1, j < 3 ? "#e8f4ff" : "#5a6878"); }
    mapRect(g, x - 9, y - 14, 18, 3, "#3a4048"); mapRect(g, x - 6, y - 16, 10, 2, "#4a5260");
  } else if (key === "frost") {
    for (let i = 0; i < 5; i++) { const px = x - 10 + i * 5, h = 3 + ((i * 3) % 5); for (let j = 0; j < h; j++) mapRect(g, px, y - j, 1 + (j < 2 ? 1 : 0), 1, j > h - 2 ? "#ffffff" : "#bfe8ff"); }
    for (let i = 0; i < 6; i++) { const [px, py] = spot(0.8, 0.6); mapRect(g, px, py, 2, 1, "#e8f8ff"); }
  } else if (key === "hunt") {
    for (let x2 = -12; x2 <= 12; x2 += 2) mapRect(g, x + x2, y - 2 - (Math.abs(x2) % 3), 1, 3 + (Math.abs(x2) % 3), "#8aa050");
    for (let i = 0; i < 6; i++) mapRect(g, x - 2 + i * 2, y - 3 + (i % 2), 2, 2, i === 0 ? "#2a0a12" : "#7a1424");
    mapRect(g, x - 2, y - 3, 1, 1, "#ffd23f");
  } else if (key === "keg") {
    for (let i = 0; i < 3; i++) { const px = x - 9 + i * 7; mapRect(g, px, y - 7, 5, 7, "#7a5232"); mapRect(g, px, y - 6, 5, 1, "#3a2a1a"); mapRect(g, px, y - 2, 5, 1, "#3a2a1a"); }
    mapRect(g, x + 10, y - 4, 3, 3, "#2a2a30"); mapRect(g, x + 11, y - 6, 1, 2, "#8a6a3a");
  } else if (key === "moor") {
    mapRect(g, x + 2, y - 12, 9, 12, "#4a4a52"); mapRect(g, x + 5, y - 17, 3, 5, "#4a4a52"); mapRect(g, x + 6, y - 19, 1, 2, "#6a6a72"); mapRect(g, x + 5, y - 6, 3, 4, "#1a1a20");
    for (let i = 0; i < 3; i++) { const px = x - 11 + i * 4; mapRect(g, px, y - 4, 3, 4, "#8a8a92"); mapRect(g, px + 1, y - 5, 1, 1, "#8a8a92"); }
  } else if (key === "clockwork") {
    mapRect(g, x - 3, y - 15, 7, 15, "#8a8070"); mapRect(g, x - 4, y - 16, 9, 2, "#6a6058");
    mapRect(g, x - 2, y - 13, 5, 5, "#e8d39a"); mapRect(g, x, y - 12, 1, 3, "#3a2a1a"); mapRect(g, x, y - 10, 2, 1, "#3a2a1a");
    for (let i = 0; i < 4; i++) mapRect(g, x - 11 + i * 2, y - 2, 1, 2, "#c9ced6");
  } else if (key === "chrono") {
    for (let j = 0; j < 14; j++) mapRect(g, x - 1 + Math.round(Math.sin(j * 0.7) * 1.5), y - 16 + j, 2, 1, j % 3 ? "#9fe8ff" : "#ffffff");
    for (let i = 0; i < 4; i++) { const [px, py] = spot(0.8, 0.5); mapRect(g, px, py, 2, 2, "#5a4a9a"); }
  } else if (key === "gale") {
    mapRect(g, x - 8, y - 12, 1, 12, "#5a3a20");
    for (let i = 0; i < 4; i++) mapRect(g, x - 7 + i * 2, y - 12 + Math.floor(i / 2), 2, 2, i % 2 ? "#ffffff" : "#ff5a61");
    for (let i = 0; i < 3; i++) { const px = x + 3 + i * 4; for (let j = 0; j < 4 + i; j++) mapRect(g, px - Math.floor(j / 2), y - j, 1 + Math.floor(j / 2) * 2, 1, "#2a5a3a"); }
  } else if (key === "maw") {
    for (let i = 0; i < 7; i++) { const px = x - 14 + i * 4.5; for (let j = 0; j < 5; j++) mapRect(g, px + Math.floor(j / 2), y - 5 + j, Math.max(1, 3 - j), 1, "#e8e0c8"); }
    mapRect(g, x - 5, y - 2, 10, 3, "#120808");
  } else if (key === "sandbox") {
    mapRect(g, x - 7, y - 2, 14, 2, "#7a4f2a"); mapRect(g, x - 6, y, 1, 3, "#5a3a1e"); mapRect(g, x + 5, y, 1, 3, "#5a3a1e");
    mapRect(g, x - 3, y - 8, 6, 6, "#ffffff"); mapRect(g, x + 4, y - 6, 1, 4, "#2f2f2f");
  }
}

function islandArt(key) {
  const fog = placeFogged(key);
  const tag = fog ? "fog" : "on";
  if (!islandCache[key] || islandCache[key].tag !== tag) islandCache[key] = { tag, ...paintIsland(key, fog) };
  return islandCache[key];
}

function drawCloud(g, x, y, w, color) {
  g.fillStyle = color;
  const h = Math.max(2, Math.round(w * 0.22));
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), h);
  g.fillRect(Math.round(x + w * 0.15), Math.round(y - h * 0.6), Math.round(w * 0.4), h);
  g.fillRect(Math.round(x + w * 0.45), Math.round(y - h), Math.round(w * 0.35), h);
}

/* A rope bridge, sagging a little in the middle */
function drawBridge(g, a, b, t, lit) {
  const A = ISLANDS[a], B = ISLANDS[b];
  const dir = Math.sign(B.x - A.x) || 1;
  const x0 = A.x + dir * (A.w / 2 - 2), y0 = A.y + A.th - 1 + bob(A, t);
  const x1 = B.x - dir * (B.w / 2 - 2), y1 = B.y + B.th - 1 + bob(B, t);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const sag = len * 0.14;
  const steps = Math.ceil(len);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f + Math.sin(f * Math.PI) * sag;
    if (!lit && i % 3) continue;
    mapRect(g, x, y + 1, 1, 1, "rgba(0,0,0,0.25)");
    mapRect(g, x, y, 1, 1, lit ? (i % 2 ? "#a8743e" : "#8a5a30") : "rgba(90,70,50,0.6)");
    if (lit && i % 4 === 0) mapRect(g, x, y - 2, 1, 2, "#4a3020");
  }
}

const bob = (isl, t) => Math.round(Math.sin(t * 0.8 + isl.phase) * 1);

/* The landmarks on the Commons: a satchel on a stall, and the Exchange's booth */
function drawCommons(g, t, by) {
  const isl = ISLANDS.commons;
  const R = (x, y, w, h, c) => mapRect(g, x, y + by, w, h, c);
  const base = isl.y - 1;
  // a path along the green
  for (let x = -56; x <= 56; x++) if ((x + 56) % 3) R(isl.x + x, base + 2 + Math.round(Math.sin(x * 0.2)), 1, 1, "#c8b07a");
  // The Satchel, on a little stall
  {
    const x = isl.x + COMMONS[0].dx;
    R(x - 6, base - 5, 12, 1, "#7a4f2a"); R(x - 6, base - 4, 1, 4, "#5a3a1e"); R(x + 5, base - 4, 1, 4, "#5a3a1e");
    R(x - 4, base - 11, 8, 6, "#b07a42"); R(x - 4, base - 11, 8, 1, "#d09a5a"); R(x - 4, base - 8, 8, 1, "#5a3a1e");
    R(x - 1, base - 9, 2, 2, "#ffd23f");
    R(x - 3, base - 13, 1, 2, "#5a3a1e"); R(x + 2, base - 13, 1, 2, "#5a3a1e"); R(x - 2, base - 14, 4, 1, "#5a3a1e");
    // things peeking out
    R(x - 3, base - 12, 1, 1, "#ff3b3b"); R(x + 1, base - 12, 1, 1, "#9be870");
  }
  // The Exchange: a booth under a striped awning, with a big Snakebuck turning on a post
  {
    const x = isl.x + COMMONS[1].dx;
    R(x - 8, base - 6, 16, 6, "#6a4a2a"); R(x - 8, base - 6, 16, 1, "#9a6a3a"); R(x - 2, base - 4, 4, 1, "#ffd23f");
    R(x - 7, base - 12, 1, 6, "#5a3a1e"); R(x + 6, base - 12, 1, 6, "#5a3a1e");
    for (let i = -9; i <= 8; i++) { R(x + i, base - 14, 1, 2, Math.floor((i + 20) / 2) % 2 ? "#2fbf6a" : "#f4fff4"); }
    for (let i = -9; i <= 8; i += 2) R(x + i, base - 12, 1, 1, Math.floor((i + 20) / 2) % 2 ? "#2fbf6a" : "#f4fff4");
    // little stacks of coins on the counter
    R(x - 6, base - 8, 2, 2, "#3ddc84"); R(x - 6, base - 9, 2, 1, "#9bffc4"); R(x + 4, base - 7, 2, 1, "#3ddc84"); R(x + 4, base - 8, 2, 1, "#9bffc4");
    // the turning coin
    R(x, base - 22, 1, 8, "#5a3a1e");
    const turn = Math.abs(Math.cos(t * 1.6)), cw = Math.max(1, Math.round(6 * turn));
    R(x - Math.floor(cw / 2), base - 27, cw, 6, "#2fbf6a");
    if (cw >= 3) { R(x - Math.floor(cw / 2), base - 27, cw, 1, "#9bffc4"); R(x, base - 26, 1, 4, "#0e4a2a"); }
  }
  // a few villagers' lanterns
  for (let i = 0; i < 3; i++) { const x = isl.x - 52 + i * 52; R(x, base - 6, 1, 6, "#5a3a20"); R(x - 1, base - 8, 3, 2, Math.sin(t * 3 + i) > 0 ? "#ffd23f" : "#ffb020"); }
}

function drawMap(ts) {
  const g = mapCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const t = ts / 1000;
  drawSky(t);
  g.clearRect(0, 0, MAP_W, MAP_H);

  // clouds drifting between the rows, tinted by the sky around them
  for (let i = 0; i < 14; i++) {
    const w = 18 + mapHash(i, 7, 3) * 26;
    const x = ((mapHash(i, 7, 5) * (MAP_W + 120) + t * (1.2 + (i % 5) * 0.35)) % (MAP_W + 120)) - 60;
    const y = 20 + (i % 7) * (MAP_H / 7) + mapHash(i, 7, 9) * 18;
    const [r, gg, b] = skyAt(y);
    drawCloud(g, x, y, w, `rgba(${Math.round((r + 255 * 2) / 3)},${Math.round((gg + 255 * 2) / 3)},${Math.round((b + 255 * 2) / 3)},0.5)`);
  }

  // the Coil: the road every island hangs on
  drawCoil(g, t);
  if (!placeFogged("sandbox")) drawBridge(g, "maw", "sandbox", t, sandboxUnlocked());

  // the Commons, with its four landmarks
  {
    const isl = ISLANDS.commons, art = islandArt("commons"), by = bob(isl, t);
    g.drawImage(art.c, isl.x - art.ox, isl.y - art.oy + by);
    drawCommons(g, t, by);
  }

  // the islands, bobbing gently
  MAP_ORDER.forEach(key => {
    const isl = ISLANDS[key];
    const art = islandArt(key);
    const by = bob(isl, t);
    g.drawImage(art.c, isl.x - art.ox, isl.y - art.oy + by);
    if (placeFogged(key)) return;
    if (key !== "sandbox" && isModeUnlocked(key)) drawIslandTree(g, key, t, by);
    // Nightmare platforms hanging on chains underneath
    if (key !== "sandbox" && isModeUnlocked(key)) {
      levelSpots(key).under.forEach((p, j) => {
        const open = nmLevelOpen(key, j);
        const top = isl.y + isl.th + Math.round(isl.depth * 0.35) + by;
        for (let y = top; y < p.y + by - 1; y += 2) mapRect(g, p.x, y, 1, 1, open ? "#c48ad8" : "#6a6470");
        mapRect(g, p.x - 3, p.y + by - 1, 7, 2, open ? "#3a1d4a" : "#3a3640");
        if (open) { g.fillStyle = `rgba(200,120,255,${0.25 + 0.2 * Math.sin(t * 2 + j)})`; g.fillRect(p.x - 4, p.y + by - 2, 9, 4); }
      });
    }
  });

  // little living details
  const at = k => ({ x: ISLANDS[k].x, y: ISLANDS[k].y + bob(ISLANDS[k], t) });
  if (!placeFogged("easy")) {                              // a waterfall off the Garden
    const p = at("easy");
    for (let i = 0; i < 14; i++) { const ph = (t * 1.4 + i / 14) % 1; mapRect(g, p.x + 14, p.y + 4 + ph * 34, 1, 2, `rgba(200,235,255,${0.85 * (1 - ph)})`); }
  }
  if (!placeFogged("chaos")) for (let i = 0; i < 4; i++) {
    const p = at("chaos"), ph = (t * 0.6 + i / 4) % 1;
    mapRect(g, p.x - 10 + i * 7, p.y - 9 + ph * 10, 1, 1, "#ff3b3b");
  }
  if (!placeFogged("insane")) for (let i = 0; i < 4; i++) if (Math.sin(t * 3 + i * 2.1) > 0.85) { const p = at("insane"); const x = p.x - 10 + mapHash(i, 1) * 20, y = p.y - 3 + mapHash(i, 2) * 5; mapRect(g, x - 1, y, 3, 1, "#fff"); mapRect(g, x, y - 1, 1, 3, "#fff"); }
  if (!placeFogged("mirror")) for (let i = 0; i < 3; i++) if (Math.sin(t * 2.4 + i * 1.7) > 0.9) { const p = at("mirror"); const x = p.x - 8 + mapHash(i, 3) * 16, y = p.y - 7 + mapHash(i, 4) * 6; mapRect(g, x - 1, y, 3, 1, "#fff"); mapRect(g, x, y - 1, 1, 3, "#fff"); }
  if (!placeFogged("inferno")) {
    const p = at("inferno");
    for (let i = 0; i < 6; i++) { const f = 0.5 + 0.5 * Math.sin(t * 7 + i * 3); mapRect(g, p.x - 10 + mapHash(i, 5) * 20, p.y - 2 + mapHash(i, 6) * 5, 1, 1, f > 0.6 ? "#ffd23f" : "#ff4a1a"); }
    for (let i = 0; i < 3; i++) { const ph = (t * 0.35 + i / 3) % 1; g.fillStyle = `rgba(60,55,55,${0.5 * (1 - ph)})`; g.fillRect(Math.round(p.x + 6 + Math.sin(ph * 6 + i) * 2 - ph * 3), Math.round(p.y - 12 - ph * 14), 2 + Math.round(ph * 3), 2 + Math.round(ph * 2)); }
  }
  if (!placeFogged("labyrinth")) {
    const p = at("labyrinth"), hue = (t * 40) % 360, glow = 0.5 + 0.5 * Math.sin(t * 2);
    g.fillStyle = `hsla(${hue},100%,70%,${0.35 + glow * 0.5})`; g.fillRect(p.x - 2, p.y - 2, 5, 4);
    g.fillStyle = `hsla(${(hue + 120) % 360},100%,80%,${0.6 + glow * 0.4})`; g.fillRect(p.x - 1, p.y - 1, 3, 2);
  }
  if (!placeFogged("treasure") && Math.sin(t * 1.7) > 0.8) { const p = at("treasure"); mapRect(g, p.x - 2, p.y - 5, 1, 1, "#ffffff"); }
  if (!placeFogged("hive")) for (let i = 0; i < 4; i++) {           // bees about the hive
    const p = at("hive"), a = t * (2 + i * 0.4) + i * 1.6;
    mapRect(g, p.x + Math.cos(a) * (6 + i * 2), p.y - 8 + Math.sin(a * 1.3) * 4, 1, 1, i % 2 ? "#ffcf33" : "#1a1410");
  }
  if (!placeFogged("thunder") && (t % 4.3) < 0.12) {                // a flash over the peak
    const p = at("thunder");
    let x = p.x + 2; for (let y = p.y - 26; y < p.y - 12; y += 2) { mapRect(g, x, y, 1, 2, "#fff7a0"); x += (y % 4 ? -1 : 1); }
  }
  if (!placeFogged("chrono")) {                                      // the rift breathes
    const p = at("chrono"), glow = 0.3 + 0.3 * Math.sin(t * 2);
    g.fillStyle = `rgba(159, 232, 255, ${glow})`; g.fillRect(p.x - 3, p.y - 17, 6, 16);
  }
  if (!placeFogged("moor")) for (let i = 0; i < 2; i++) {            // a wisp or two
    const p = at("moor"), ph = (t * 0.4 + i * 0.5) % 1;
    g.fillStyle = `rgba(232, 236, 255, ${0.6 * Math.sin(ph * Math.PI)})`; g.fillRect(Math.round(p.x - 10 + i * 8 + Math.sin(t + i) * 3), Math.round(p.y - 6 - ph * 10), 2, 2);
  }
  if (!placeFogged("gale")) for (let i = 0; i < 3; i++) {            // wind streaks
    const p = at("gale"), ph = (t * 0.9 + i / 3) % 1;
    g.fillStyle = `rgba(255, 255, 255, ${0.7 * Math.sin(ph * Math.PI)})`; g.fillRect(Math.round(p.x - 18 + ph * 36), Math.round(p.y - 14 + i * 4), 5, 1);
  }
  if (!placeFogged("keg") && Math.sin(t * 9) > 0.3) { const p = at("keg"); mapRect(g, p.x + 11, p.y - 7, 1, 1, "#ffd23f"); }
  if (!placeFogged("maw")) {                                         // a red glow in the throat
    const p = at("maw");
    g.fillStyle = `rgba(255, 59, 59, ${0.25 + 0.2 * Math.sin(t * 1.4)})`; g.fillRect(p.x - 5, p.y - 2, 10, 3);
  }

  // your snake, napping on the last island you played
  const home = MODE_KEYS.includes(save.mapHome) && isModeUnlocked(save.mapHome) ? save.mapHome : "easy";
  if (!mapSel || mapSel !== home) {
    const skin = currentSkin(), p = at(home), isl = ISLANDS[home];
    const hx = p.x - Math.round(isl.w * 0.15), hy = p.y + 1;
    for (let i = 4; i >= 0; i--) mapRect(g, hx - i * 2, hy + Math.round(Math.sin(t * 4 - i * 0.9)), 2, 2, skin.colors[skin.order[i % skin.order.length]]);
    mapRect(g, hx + 1, hy + Math.round(Math.sin(t * 4)), 1, 1, "#ffffff");
  }

  // clouds over the places you have not reached, thinning as they open
  MAP_ORDER.forEach(k => {
    const target = placeFogged(k) ? 1 : 0;
    if (mapFog[k] === undefined) mapFog[k] = target;
    mapFog[k] += (target - mapFog[k]) * 0.06;
    if (mapFog[k] < 0.01) return;
    const p = ISLANDS[k];
    g.globalAlpha = mapFog[k] * 0.9;
    for (let i = 0; i < 4; i++) {
      const w = 14 + mapHash(i, k.length, 4) * 10;
      drawCloud(g, p.x - w / 2 + Math.sin(t * 0.4 + i) * 3 + (i - 1.5) * 6, p.y + 2 + (i % 2) * 6, w, i % 2 ? "#f4f7fb" : "#dfe6ef");
    }
    g.globalAlpha = 1;
  });

  // a sea of clouds far below, lit by the sunrise
  for (let x = 0; x < MAP_W; x++) {
    const h = 9 + Math.round(Math.sin((x + t * 4) * 0.13) * 2 + Math.sin((x - t * 2.5) * 0.31) * 1.5);
    mapRect(g, x, MAP_H - h, 1, h, "#fbe9dc");
    mapRect(g, x, MAP_H - h, 1, 2, "#ffffff");
    if ((x + Math.floor(t * 6)) % 23 === 0) mapRect(g, x, MAP_H - h + 3, 4, 1, "#f2cdb8");
  }

  // pins ride along with their island
  mapPinsEl.querySelectorAll(".map-pin").forEach(pin => {
    const v = bob(ISLANDS[pin.dataset.area], t) * 2;
    if (pin._bob !== v) { pin._bob = v; pin.style.setProperty("--bob", v + "px"); }
  });
}

function mapLoop(ts) {
  mapRaf = 0;
  if (currentScreen !== "modes") return;
  mapRaf = requestAnimationFrame(mapLoop);
  if (++mapFrame % 2 && mapFrame > 1) return;
  drawMap(ts);
}
/* The map always covers the whole screen. It opens close enough to read, on the
   island you're working toward; drag to travel, scroll or pinch to zoom.
   Zoomed all the way out, the whole map still fills the screen. */
let mapCam = null;          // the view: { s, tx, ty }, kept between visits

const WORLD_W = MAP_W * 2, WORLD_H = MAP_H * 2;
/* The smallest scale: the world just covers the screen */
function mapFit() {
  const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  return Math.max(vw / WORLD_W, vh / WORLD_H);
}
/* The usual scale: one row of islands, with a glimpse of the rows above and below */
const mapNear = () => Math.max(mapFit(), mapEl.clientHeight / 250);
const mapMax = () => mapNear() * 2.2;

/* Keep the world covering the view: never a gap at any edge */
function clampCam(c) {
  const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  c.s = Math.max(mapFit(), Math.min(mapMax(), c.s));
  c.tx = Math.min(0, Math.max(vw - WORLD_W * c.s, c.tx));
  c.ty = Math.min(0, Math.max(vh - WORLD_H * c.s, c.ty));
  return c;
}

/* A view centered on a map point at a scale */
function camOn(x, y, s) {
  const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  return clampCam({ s, tx: vw / 2 - x * 2 * s, ty: vh / 2 - y * 2 * s });
}

/* Where the camera starts: the island you're working toward, or home */
function homeCam() {
  const next = MODE_KEYS[Math.min(MODE_KEYS.length - 1, nextLockedIndex())];
  const key = next && !isModeUnlocked(next) ? next : MODE_KEYS.includes(save.mapHome) && isModeUnlocked(save.mapHome) ? save.mapHome : "easy";
  const isl = ISLANDS[key];
  return camOn(isl.x, isl.y + 2, mapNear());
}

let camShown = null;        // the view on screen right now (for the sky's parallax)
const mapCamNow = () => camShown || mapCam || { s: 1, tx: 0, ty: 0 };

function applyCam(c) {
  const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mui")) || 1;
  camShown = { ...c };
  mapWorldEl.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
  mapWorldEl.style.setProperty("--inv", (ui * (mapSel ? 1.1 : 1) / Math.max(c.s, mapFit() * 0.9)).toFixed(4));
  mapEl.classList.toggle("can-pan", !mapSel);
  const deep = !mapSel && c.s >= mapNear() * 1.35;
  if (deep !== mapDeep) { mapDeep = deep; updatePins(); }
}

function layoutMap() {
  const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  if (!vw || !vh) return;
  if (mapCanvas.width !== MAP_W || mapCanvas.height !== MAP_H) { mapCanvas.width = MAP_W; mapCanvas.height = MAP_H; }
  mapWorldEl.style.width = WORLD_W + "px";
  mapWorldEl.style.height = WORLD_H + "px";
  let c;
  if (mapSel) {
    // Frame the whole island, from its tree down to its Nightmares, below the banner
    const isl = ISLANDS[mapSel];
    const top = isl.y - isl.th - 18, bottom = isl.y + isl.th + isl.depth + 10;
    const tall = (bottom - top) * 2, wide = (isl.w + 18) * 2;
    const bannerBottom = mapBannerEl.classList.contains("open") ? mapBannerEl.offsetTop + mapBannerEl.offsetHeight + 6 : 6;
    const room = Math.max(vh * 0.4, vh - bannerBottom - 8);
    const s = Math.max(mapNear() * 1.1, Math.min(mapMax() * 1.4, room / tall, (vw * 0.9) / wide));
    c = { s, tx: vw / 2 - isl.x * 2 * s, ty: bannerBottom + room / 2 - ((top + bottom) / 2) * 2 * s };
    c.tx = Math.min(0, Math.max(vw - WORLD_W * s, c.tx));
    c.ty = Math.min(0, Math.max(vh - WORLD_H * s, c.ty));
  } else {
    mapCam = clampCam(mapCam || homeCam());
    c = mapCam;
  }
  applyCam(c);
}

/* Zoom by a factor around a point on screen */
function zoomMapAt(factor, px, py) {
  const cur = mapCam || homeCam();
  const s = Math.max(mapFit(), Math.min(mapMax(), cur.s * factor));
  const k = s / cur.s;
  mapCam = clampCam({ s, tx: px - (px - cur.tx) * k, ty: py - (py - cur.ty) * k });
  layoutMap();
}

(() => {
  const ptrs = new Map();
  let start = null, dragged = false;
  const local = e => { const r = mapEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let swipe = null;            // up close on an island: a sideways swipe moves to the next one
  const inCard = t => mapBriefEl.contains(t) || mapPopEl.contains(t) || mapBannerEl.contains(t);
  mapEl.addEventListener("pointerdown", e => {
    if (mapBriefEl.contains(e.target)) return;
    if (mapSel) {
      if (inCard(e.target)) return;
      ptrs.set(e.pointerId, local(e));
      swipe = { pts: new Map(ptrs), done: false };
      dragged = false;
      return;
    }
    ptrs.set(e.pointerId, local(e));
    dragged = false;
    stopGlide();
    const cur = mapCam || homeCam();
    start = { cam: { ...cur }, pts: new Map(ptrs), trail: [] };
  });
  mapEl.addEventListener("pointermove", e => {
    if (mapSel && swipe && ptrs.has(e.pointerId)) {
      ptrs.set(e.pointerId, local(e));
      const ids = [...ptrs.keys()];
      if (ids.length >= 2 && swipe.pts.size >= 2 && !swipe.done) {
        // Pinching in while up close zooms back out to the whole map
        const [a, b] = ids.slice(0, 2).map(id => ptrs.get(id));
        const [a0, b0] = ids.slice(0, 2).map(id => swipe.pts.get(id) || ptrs.get(id));
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]), d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1;
        if (d / d0 < 0.75) { swipe.done = true; dragged = true; closePlace(); }
      } else if (ids.length === 1) {
        const [x0, y0] = swipe.pts.get(ids[0]) || ptrs.get(ids[0]);
        const [x, y] = ptrs.get(ids[0]);
        if (Math.hypot(x - x0, y - y0) > 10) dragged = true;
        // A little give, so the swipe feels attached to the finger
        if (dragged && !swipe.done) mapWorldEl.style.translate = `${Math.max(-40, Math.min(40, (x - x0) * 0.35))}px 0`;
      }
      return;
    }
    if (!ptrs.has(e.pointerId) || !start) return;
    ptrs.set(e.pointerId, local(e));
    const ids = [...ptrs.keys()];
    if (ids.length === 1) {
      const [x0, y0] = start.pts.get(ids[0]) || ptrs.get(ids[0]);
      const [x, y] = ptrs.get(ids[0]);
      if (!dragged && Math.hypot(x - x0, y - y0) < 6) return;
      if (!dragged) { dragged = true; mapEl.classList.add("dragging"); try { mapEl.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } }
      mapCam = clampCam({ s: start.cam.s, tx: start.cam.tx + x - x0, ty: start.cam.ty + y - y0 });
      start.trail.push({ x, y, at: performance.now() });
      if (start.trail.length > 6) start.trail.shift();
      layoutMap();
    } else if (ids.length >= 2 && start.pts.size >= 2) {
      // Pinch: zoom by how far the fingers have spread, around their middle
      const [a, b] = ids.slice(0, 2).map(id => ptrs.get(id));
      const [a0, b0] = ids.slice(0, 2).map(id => start.pts.get(id) || ptrs.get(id));
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mx0 = (a0[0] + b0[0]) / 2, my0 = (a0[1] + b0[1]) / 2;
      const s = Math.max(mapFit(), Math.min(mapMax(), start.cam.s * d / d0));
      const k = s / start.cam.s;
      dragged = true;
      mapEl.classList.add("dragging");
      mapCam = clampCam({ s, tx: mx - (mx0 - start.cam.tx) * k, ty: my - (my0 - start.cam.ty) * k });
      layoutMap();
    }
  });
  const end = e => {
    if (swipe) {
      const p0 = swipe.pts.get(e.pointerId), p1 = ptrs.get(e.pointerId);
      ptrs.delete(e.pointerId);
      mapWorldEl.style.translate = "";
      if (!swipe.done && p0 && p1 && swipe.pts.size === 1 && e.type === "pointerup") {
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { swipe.done = true; stepPlace(dx < 0 ? 1 : -1); }
      }
      if (!ptrs.size) swipe = null;
      return;
    }
    ptrs.delete(e.pointerId);
    if (ptrs.size) {
      const cur = mapCam || homeCam();
      start = { cam: { ...cur }, pts: new Map(ptrs), trail: [] };
    } else {
      // A flick keeps the map gliding for a moment
      const tr = start && start.trail;
      if (dragged && tr && tr.length >= 2) {
        const a = tr[0], b = tr[tr.length - 1], dt = Math.max(16, b.at - a.at);
        if (performance.now() - b.at < 80) glide((b.x - a.x) / dt * 16, (b.y - a.y) / dt * 16);
      }
      start = null;
      mapEl.classList.remove("dragging");
    }
  };
  mapEl.addEventListener("pointerup", end);
  mapEl.addEventListener("pointercancel", end);
  // A drag is not a tap: don't let it open whatever pin it ended on
  mapEl.addEventListener("click", e => {
    if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
  }, true);
  let wheelOut = 0;
  mapEl.addEventListener("wheel", e => {
    if (mapBriefEl.contains(e.target)) return;
    if (mapSel) {
      // Scrolling out while up close goes back to the whole map
      if (inCard(e.target)) return;
      e.preventDefault();
      wheelOut = Math.max(0, wheelOut + e.deltaY);
      clearTimeout(mapEl._wheelOutT);
      mapEl._wheelOutT = setTimeout(() => { wheelOut = 0; }, 250);
      if (wheelOut > 80) { wheelOut = 0; closePlace(); }
      return;
    }
    e.preventDefault();
    const [x, y] = local(e);
    mapEl.classList.add("dragging");
    zoomMapAt(Math.exp(-e.deltaY * 0.0016), x, y);
    clearTimeout(mapEl._wheelT);
    mapEl._wheelT = setTimeout(() => mapEl.classList.remove("dragging"), 120);
  }, { passive: false });
  mapEl.addEventListener("dblclick", e => {
    if (mapSel || mapBriefEl.contains(e.target)) return;
    const [x, y] = local(e);
    zoomMapAt(mapCam && mapCam.s > mapNear() * 1.2 ? 1 / 1.8 : 1.8, x, y);
  });
})();


/* The map keeps drifting after a flick, slowing to a stop */
let glideRaf = 0;
function glide(vx, vy) {
  stopGlide();
  mapEl.classList.add("dragging");
  const step = () => {
    vx *= 0.92; vy *= 0.92;
    if (Math.abs(vx) + Math.abs(vy) < 0.4 || !mapCam || mapSel || currentScreen !== "modes") { stopGlide(); return; }
    mapCam = clampCam({ s: mapCam.s, tx: mapCam.tx + vx, ty: mapCam.ty + vy });
    layoutMap();
    glideRaf = requestAnimationFrame(step);
  };
  glideRaf = requestAnimationFrame(step);
}
function stopGlide() {
  if (!glideRaf) return;
  cancelAnimationFrame(glideRaf);
  glideRaf = 0;
  mapEl.classList.remove("dragging");
}

/* ----- Pins: one per island from afar; levels, Nightmares and the tree up close ----- */
let mapPop = null;              // { key, j, nm } while a level's little bubble is open
let mapRules = false;           // the rules card is showing
let mapReturnTo = null;         // reopen this island when coming back to the map
let lastPlayed = null;          // { key, j, nm } of the last level started from the map
const mapPopEl = document.getElementById("map-pop");
const mapBannerEl = document.getElementById("map-banner");

const LEAF_SVG = '<svg class="leaf" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4 3 7 7 7 11a7 7 0 0 1-6 6.9V22h-2v-2.1A7 7 0 0 1 5 13c0-4 3-8 7-11z"/></svg>';

function renderModes(justUnlocked) {
  document.getElementById("map-hint").textContent = isTouchDevice() ? "Drag to explore, pinch to zoom" : "Drag to explore, scroll to zoom";
  mapPinsEl.innerHTML = "";
  const home = MODE_KEYS.includes(save.mapHome) && isModeUnlocked(save.mapHome) ? save.mapHome : null;
  const focusKey = justUnlocked || home || MODE_KEYS[Math.max(0, nextLockedIndex() - 1)];
  const add = (cls, key, area, x, y, html, label, onClick) => {
    const pin = document.createElement("button");
    pin.className = "map-pin " + cls;
    pin.dataset.key = key;
    pin.dataset.area = area;
    pin.style.left = x * 2 + "px";
    pin.style.top = y * 2 + "px";
    pin.style.setProperty("--m", area === "sandbox" ? "#2f9bff" : MEDAL_COLORS[area]);
    pin.innerHTML = html;
    pin.setAttribute("aria-label", label);
    pin.addEventListener("click", e => { e.stopPropagation(); onClick(pin); });
    mapPinsEl.appendChild(pin);
    return pin;
  };
  MAP_ORDER.forEach(key => {
    const st = placeState(key);
    const isl = ISLANDS[key];
    const inner = st === "open" ? `<span class="dot"></span>` : st === "fog" ? `<span class="q">?</span>` : LOCK_SVG;
    const label = st === "fog" ? "" : `<span class="lbl">${isl.name}</span>`;
    const grow = st === "open" && key !== "sandbox" && treeAffordable(key) ? `<span class="grow">+</span>` : "";
    const pin = add("area " + st, "place-" + key, key, isl.x, isl.y - 2, inner + label + grow,
      st === "fog" ? "An unexplored island" : `${placeTitle(key)}${st === "ready" ? ", ready to unlock" : st === "locked" ? ", locked" : ""}`,
      () => selectPlace(key));
    if (key === focusKey) pin.dataset.autofocus = "";
    if (key === justUnlocked) pin.classList.add("just-unlocked");
    if (key === "sandbox" || st === "fog") return;
    const spots = levelSpots(key);
    for (let j = 0; j < LEVELS_PER_AREA; j++) {
      const open = levelOpen(key, j);
      if (save.kind !== "nightmare") add(`level ${open ? "open" : "locked"}`, `lv-${key}-${j}`, key, spots.top[j].x, spots.top[j].y, `<span class="n">${ROMAN3[j]}</span>`,
        `${levelName(key, j)}${open ? "" : ", locked"}`, pin => openLevelPop(key, j, false, pin));
      if (isModeUnlocked(key) && nightmareRealmOpen()) {
        const nopen = nmLevelOpen(key, j);
        add(`level nmp ${nopen ? "open" : "locked"}`, `nm-${key}-${j}`, key, spots.under[j].x, spots.under[j].y, SKULL_SVG,
          `Nightmare: ${levelName(key, j, true)}${nopen ? "" : ", locked"}`, pin => openLevelPop(key, j, true, pin));
      }
    }
    if (isModeUnlocked(key)) {
      const tp = treeSpot(key);
      add(`level treep${treeAffordable(key) ? " ready" : ""}`, `tree-${key}`, key, tp.x, tp.y - 11, LEAF_SVG,
        `${STORY[key].title} upgrade tree`, () => openTreeFromMap(key));
    }
  });
  // The Commons' landmarks: always there on the whole map
  COMMONS.forEach(c => {
    const isl = ISLANDS.commons;
    const ready = c.id === "exchange" && save.xp >= xpPerBuck() * 50;
    const pin = add("prop" + (ready ? " ready" : ""), "prop-" + c.id, "commons", isl.x + c.dx, isl.y - 31,
      `<img class="pi" src="${iconUrl("place:" + c.id, 2)}" alt=""><span class="lbl">${c.label}</span>${ready ? '<span class="grow">+</span>' : ""}`,
      `${c.name}: ${c.label}`, () => openPlace(c.id));
    pin.style.setProperty("--m", ["#d09a5a", "#2fbf6a"][COMMONS.indexOf(c)]);
  });
  updatePins();
  if (mapSel) renderBanner();
  requestAnimationFrame(layoutMap);
  if (!mapRaf) mapRaf = requestAnimationFrame(mapLoop);
  if (justUnlocked) setTimeout(() => selectPlace(justUnlocked), mapSel ? 0 : 350);
}

/* Which pins show: islands from afar, an island's levels and tree up close */
function updatePins() {
  mapPinsEl.querySelectorAll(".map-pin").forEach(pin => {
    const area = pin.dataset.area;
    if (pin.classList.contains("prop")) { pin.hidden = !!mapSel; return; }
    const near = mapSel === area || (!mapSel && mapDeep);
    const isArea = pin.classList.contains("area");
    const fog = placeFogged(area);
    pin.hidden = isArea ? (near && !fog && area !== "sandbox") : !near;
    const key = pin.dataset.key;
    pin.classList.toggle("selected", !!mapPop && mapPop.key === area &&
      key === (mapPop.nm ? `nm-${area}-${mapPop.j}` : `lv-${area}-${mapPop.j}`));
    const last = !!lastPlayed && key === `${lastPlayed.nm ? "nm" : "lv"}-${lastPlayed.key}-${lastPlayed.j}`;
    pin.classList.toggle("last", last);
    const tag = pin.querySelector(".last-tag");
    if (last && !tag) pin.insertAdjacentHTML("beforeend", '<span class="last-tag">Last played</span>');
    if (!last && tag) tag.remove();
  });
}

function selectPlace(key) {
  const switching = key !== mapSel;
  closeLevelPop(true);
  mapSel = key;
  mapNight = false;
  if (switching) sfx("whoosh");
  mapEl.classList.add("zoomed");
  updatePins();
  renderBanner();
  layoutMap();
  setTimeout(() => {
    if (currentScreen !== "modes" || mapSel !== key) return;
    const first = mapPinsEl.querySelector(`.map-pin.level.open[data-area="${key}"]:not([hidden])`) || mapBannerEl.querySelector("button:not(:disabled)");
    if (first && switching) first.focus({ preventScroll: true });
  }, 80);
}

function closePlace() {
  if (!mapSel) return;
  const was = mapSel;
  closeLevelPop(true);
  mapSel = null;
  mapNight = false;
  sfx("whoosh");
  mapEl.classList.remove("zoomed", "night");
  mapBannerEl.classList.remove("open");
  layoutMap();
  updatePins();
  const pin = mapPinsEl.querySelector(`[data-key="place-${was}"]`);
  if (pin && !pin.hidden) setKbdFocus(pin);
}

function stepPlace(d) {
  if (!mapSel) return;
  const visible = MAP_ORDER.filter(k => placeState(k) !== "fog");
  const i = visible.indexOf(mapSel);
  const next = visible[(i + d + visible.length) % visible.length];
  if (next && next !== mapSel) selectPlace(next);
}

/* ----- The banner over a chosen island: its name, medals and what you can do ----- */
function renderBanner() {
  const key = mapSel;
  if (!key) return;
  const st = placeState(key);
  const b = mapBannerEl;
  b.style.setProperty("--m", key === "sandbox" ? "#2f9bff" : MEDAL_COLORS[key]);
  let title = key === "sandbox" ? "The Workshop" : st === "fog" ? "Unexplored island" : STORY[key].title;
  let action = "", note = "";
  if (key === "sandbox") {
    action = st === "open" ? `<button class="btn btn-small btn-blue" data-go-place>Open the workshop</button>` : "";
    note = st === "open" ? "Build, share and play your own levels." : "Opens once every island, and every Nightmare, is yours.";
  } else if (st === "fog") {
    note = `Lost in the clouds. Open ${STORY[MODE_KEYS[MODE_KEYS.indexOf(key) - 1]].title} first.`;
  } else if (!isModeUnlocked(key)) {
    action = st === "ready"
      ? `<button class="btn btn-small btn-gold" data-unlock>Unlock for ${fmtInt(modes[key].unlockAt)} XP</button>`
      : `<button class="btn btn-small" disabled>${LOCK_SVG} ${escapeAttr(unlockBlocker(key))}</button>`;
    note = modes[key].rules;
  } else {
    action = `<button class="btn btn-small btn-green" data-tree>${LEAF_SVG} Upgrade tree${treeAffordable(key) ? " <b>+</b>" : ""}</button>`;
    note = "Tap a level to play it. Tap the tree to grow it.";
    // The Nightmare Realm hangs under every island once all of them are yours
    if (nightmareRealmOpen() && !save.unlockedNightmares.includes(key)) {
      const ns = nightmareUnlockState(key);
      action += ns.ready
        ? `<button class="btn btn-small btn-purple" data-nm-unlock>${SKULL_SVG} Nightmare: ${fmtInt(ns.cost)} XP</button>`
        : `<button class="btn btn-small" disabled>${SKULL_SVG} ${escapeAttr(nightmareBlocker(key))}</button>`;
    }
  }
  b.innerHTML = `<div class="mbn-row">
      <button class="btn btn-small mb-nav" data-step="-1" aria-label="Previous island">&#9664;</button>
      <div class="mbn-mid"><span class="mbn-title">${escapeAttr(title)}</span>${MODE_KEYS.includes(key) && st !== "fog" ? medalSlots(key) : ""}</div>
      <button class="btn btn-small mb-nav" data-step="1" aria-label="Next island">&#9654;</button>
    </div>
    <p class="mbn-note">${escapeAttr(note)}</p>${action ? `<div class="mbn-act">${action}</div>` : ""}`;
  b.classList.add("open");
  b.querySelectorAll("[data-step]").forEach(el => el.addEventListener("click", () => stepPlace(+el.dataset.step)));
  const go = b.querySelector("[data-go-place]");
  if (go) go.addEventListener("click", () => openShelf());
  const un = b.querySelector("[data-unlock]");
  if (un) un.addEventListener("click", () => unlockMode(key));
  const nu = b.querySelector("[data-nm-unlock]");
  if (nu) nu.addEventListener("click", () => unlockNightmare(key));
  const tr = b.querySelector("[data-tree]");
  if (tr) tr.addEventListener("click", () => openTreeFromMap(key));
}

/* ----- A level's little bubble: Rules and Play ----- */
function openLevelPop(key, j, nm, pinEl) {
  if (mapSel !== key) selectPlace(key);
  mapPop = { key, j, nm, pin: pinEl };
  mapRules = false;
  mapBriefEl.classList.remove("open");
  mapNight = nm;
  mapEl.classList.toggle("night", nm);
  sfx("click");
  updatePins();
  const open = nm ? nmLevelOpen(key, j) : levelOpen(key, j);
  const owned = isModeUnlocked(key);
  let why = "";
  if (!owned) why = "Unlock the island first";
  else if (!open && nm && !save.unlockedNightmares.includes(key)) why = nightmareBlocker(key) || "Unlock this Nightmare from the island's banner";
  else if (!open) why = `Play ${levelName(key, j - 1, nm)} first`;
  const best = save.levelBest[levelKey(key, j, nm)];
  mapPopEl.style.setProperty("--m", nm ? "#b0285e" : MEDAL_COLORS[key]);
  mapPopEl.className = "map-pop open" + (nm ? " nm" : "");
  mapPopEl.innerHTML = `<p class="mp-name">${nm ? SKULL_SVG : ""}${escapeAttr(levelName(key, j, nm))}</p>
    <p class="mp-sub">${nm ? "Nightmare" : "Level"} ${ROMAN3[j]}, ${levelMult(key, j, nm)}x score${best ? `, best ${fmtCompact(best)}` : ""}</p>
    ${why ? `<p class="mp-why">${LOCK_SVG}${escapeAttr(why)}</p>` : ""}
    <div class="mp-btns"><button class="btn btn-small" data-rules>Rules</button><button class="btn btn-small ${nm ? "nm-start" : "btn-primary"}" data-play ${open ? "" : "disabled"}>Play</button></div>`;
  positionPop(pinEl);
  mapPopEl.querySelector("[data-rules]").addEventListener("click", () => openLevelRules());
  mapPopEl.querySelector("[data-play]").addEventListener("click", () => playLevel(key, j, nm));
  setTimeout(() => {
    const b = mapPopEl.querySelector("[data-play]:not(:disabled)") || mapPopEl.querySelector("[data-rules]");
    if (b) b.focus({ preventScroll: true });
  }, 30);
}

/* Sits above the pin, or below it if there is no room, and never off the edges */
function positionPop(pinEl) {
  if (!pinEl || !mapPop) return;
  requestAnimationFrame(() => {
    if (!mapPop) return;
    const m = mapEl.getBoundingClientRect(), p = pinEl.getBoundingClientRect();
    const w = mapPopEl.offsetWidth, h = mapPopEl.offsetHeight;
    let x = p.left + p.width / 2 - m.left - w / 2;
    let y = p.top - m.top - h - 10;
    let below = false;
    if (y < 6) { y = p.bottom - m.top + 10; below = true; }
    x = Math.max(6, Math.min(m.width - w - 6, x));
    y = Math.max(6, Math.min(m.height - h - 6, y));
    mapPopEl.style.left = x + "px";
    mapPopEl.style.top = y + "px";
    mapPopEl.style.setProperty("--tail", (p.left + p.width / 2 - m.left - x) + "px");
    mapPopEl.classList.toggle("below", below);
  });
}

function closeLevelPop(quiet = false) {
  if (!mapPop && !mapRules) return false;
  const was = mapPop;
  mapPop = null;
  mapRules = false;
  mapPopEl.className = "map-pop";
  mapBriefEl.classList.remove("open");
  mapNight = false;
  mapEl.classList.remove("night");
  updatePins();
  if (!quiet && was) {
    const pin = mapPinsEl.querySelector(`[data-key="${was.nm ? "nm" : "lv"}-${was.key}-${was.j}"]`);
    if (pin) setKbdFocus(pin);
  }
  return true;
}

function playLevel(key, j, nm) {
  if (!(nm ? nmLevelOpen(key, j) : levelOpen(key, j))) return;
  save.mapHome = key;
  persist();
  currentModeKey = key;
  currentLevel = j;
  currentNightmare = nm;
  lastPlayed = { key, j, nm };
  beginRun();
}

/* ----- The rules card, only when asked for ----- */
function openLevelRules() {
  if (!mapPop) return;
  const { key, j, nm } = mapPop;
  mapRules = true;
  mapPopEl.className = "map-pop";
  const mode = modes[key];
  const open = nm ? nmLevelOpen(key, j) : levelOpen(key, j);
  const prevN = currentNightmare, prevL = currentLevel;
  currentNightmare = nm;
  currentLevel = j;
  const facts = '<dl class="facts">' + modeFacts(key).map(([label, t, frame]) =>
    `<div class="fact"><dt>${label}</dt><dd>${frame ? `<span class="frame-dot ${frame}" aria-hidden="true"></span>` : ""}${t}</dd></div>`).join("") + "</dl>";
  currentNightmare = prevN;
  currentLevel = prevL;
  const text = nm ? NIGHTMARES[key].twist : mode.rules;
  const line = nm ? `The ${NIGHTMARES[key].name} twist, at the pace of ${levelName(key, j)}.` : LEVEL_LINES[j];
  mapBriefEl.style.setProperty("--m", nm ? "#b0285e" : MEDAL_COLORS[key]);
  mapBriefEl.innerHTML = `<p class="mb-kicker">${escapeAttr(STORY[key].title)}</p>
    <h3 class="mb-title">${escapeAttr(levelName(key, j, nm))}</h3>
    <p class="mb-sub">${nm ? "Nightmare" : "Level"} ${ROMAN3[j]}, ${levelMult(key, j, nm)}x score</p>
    <p class="mb-text">${escapeAttr(text)}</p><p class="mb-line">${escapeAttr(line)}</p>${facts}
    <div class="mb-buttons"><button class="btn" data-map-back>Close</button><button class="btn ${nm ? "nm-start" : "btn-primary"}" data-play ${open ? "" : "disabled"}>Play</button></div>`;
  mapBriefEl.classList.add("open");
  sfx("page");
  mapBriefEl.querySelector("[data-map-back]").addEventListener("click", () => {
    const keep = mapPop;
    mapRules = false;
    mapBriefEl.classList.remove("open");
    const pin = keep && mapPinsEl.querySelector(`[data-key="${keep.nm ? "nm" : "lv"}-${keep.key}-${keep.j}"]`);
    if (keep && pin) openLevelPop(keep.key, keep.j, keep.nm, pin);
  });
  mapBriefEl.querySelector("[data-play]").addEventListener("click", () => playLevel(key, j, nm));
  setTimeout(() => { const b = mapBriefEl.querySelector("[data-play]:not(:disabled)") || mapBriefEl.querySelector("[data-map-back]"); if (b) b.focus({ preventScroll: true }); }, 60);
}

/* ----- Trees on the map ----- */
function treeSpot(key) {
  const isl = ISLANDS[key];
  return { x: isl.x + Math.round(isl.w * 0.08), y: isl.y - isl.th + 1 };
}

/* A little tree at the back of each island you own, as big as its upgrades */
function drawIslandTree(g, key, t, by) {
  const keys = TREES[key];
  const have = keys.reduce((a, k) => a + treeTier(k), 0);
  const total = keys.reduce((a, k) => a + trackInfo(k, save.prestige).values.length, 0);
  const f = total ? have / total : 0;
  const { x, y } = treeSpot(key);
  const base = y + by;
  const h = 4 + Math.round(f * 9);
  const leaves = TREE_LEAVES[key];
  mapRect(g, x, base - h, 1 + (f > 0.5 ? 1 : 0), h, "#5a3a20");
  const r = 2 + f * 4;
  const n = 10 + Math.round(f * 30);
  for (let i = 0; i < n; i++) {
    const a = mapHash(i, key.length, 71) * Math.PI * 2, d = Math.sqrt(mapHash(i, key.length, 73)) * r;
    mapRect(g, x + Math.cos(a) * d * 1.2 + Math.sin(t * 1.3 + i) * 0.3, base - h + Math.sin(a) * d * 0.8, 1, 1, leaves[i % 3]);
  }
  keys.forEach((k, i) => { if (trackMaxed(k)) mapRect(g, x - 2 + i * 1.5, base - h + (i % 2), 1, 1, leaves[3]); });
}

function openTreeFromMap(key) {
  mapReturnTo = key;
  sfx("tab");
  openTree(key);
}

/* ----- Clicks on the map ----- */
mapBriefEl.addEventListener("click", e => e.stopPropagation());
mapPopEl.addEventListener("click", e => e.stopPropagation());
mapBannerEl.addEventListener("click", e => e.stopPropagation());
document.getElementById("map-out").addEventListener("click", e => { e.stopPropagation(); closePlace(); });
mapEl.addEventListener("click", e => {
  if (!e.target.isConnected) return;
  if (closeLevelPop()) return;
  if (mapSel) closePlace();
});
if (window.ResizeObserver) new ResizeObserver(() => { if (currentScreen === "modes") { layoutMap(); if (mapPop && !mapRules) setTimeout(() => positionPop(mapPop && mapPop.pin), 720); } }).observe(mapEl);
else window.addEventListener("resize", () => { if (currentScreen === "modes") layoutMap(); });

/* The landmarks on the Commons */
function openPlace(id) {
  sfx("tab");
  if (id === "exchange") openExchange();
  else openScreen(id);
}

function updateDock() {
  const ex = mapPinsEl.querySelector('[data-key="prop-exchange"]');
  if (ex) ex.classList.toggle("ready", save.xp >= xpPerBuck() * 50);
}
