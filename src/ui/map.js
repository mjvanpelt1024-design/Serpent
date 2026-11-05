/* =========================================================
   src/ui/map.js
   The map: five islands on the Coil, their paths and stops, pins and camera
   ========================================================= */
"use strict";

/* =========================================================
   The Map: five big floating islands strung along the body of the
   Coil (src/ui/map-coil.js), from the sunrise at the bottom of the sky
   to the stars at the top. Each island is a walk of twenty stops: home
   base, fifteen levels on a winding path (bosses at 5, 10 and 15), and
   the merchant, the challenger, the bank and the bridge that branch off
   after each boss. It fills the screen; drag to travel, scroll or pinch
   to zoom, and fly into an island to see its paths. Painted at a low
   resolution and shown with chunky pixels; it animates only while open.
   The scenery on each island is in src/ui/map-isles.js.
   ========================================================= */
const MAP_W = 600;            // map pixels (each one is 2 world units)
const MAP_H = 830;
/* x, y: the middle of the island's grassy top. w: its width. th: half the depth of the
   grassy top. depth: how far the rock hangs down. dir: which way its path runs (1 = right). */
const ISLANDS = {};
CAMP.islands.forEach((isl, i) => {
  ISLANDS[isl.id] = { id: isl.id, n: i, x: 300, y: 722 - i * 138, w: 300, th: 32, depth: 76, dir: i % 2 ? -1 : 1, name: isl.name };
});
const MAP_PLACES = ISLANDS;
const MAP_ORDER = CAMP.islands.map(i => i.id);
Object.values(ISLANDS).forEach(i => { i.phase = (i.x * 7 + i.y * 3) % 10; });

/* Grass colors: [main, dither, edge]. The old islands' colors stay for their trees' sake. */
const MAP_BIOME = Object.fromEntries(MODE_KEYS.map(key => [key, (CONTENT.worlds[key].info.map || {}).colors || ["#5aab45", "#4f9a3a", "#2f6a24"]]));
CAMP.islands.forEach(isl => { MAP_BIOME[isl.id] = [isl.colors.grass, shadeHex(isl.colors.grass, -0.1), isl.colors.edge]; });

/* ----- The twenty stops on every island -----
   f: how far along the island's flow (negative = the home end), dy: front (+) or back (-) */
const NODE_SPOTS = {
  home: [-132, 16], 1: [-92, 17], 2: [-58, 17], 3: [-24, 17], 4: [10, 17], 5: [47, 15], merchant: [98, 21],
  6: [68, -4], 7: [34, -4], 8: [0, -4], 9: [-34, -4], 10: [-70, -5], challenger: [-122, -6],
  11: [-58, -23], 12: [-24, -23], 13: [10, -23], 14: [44, -23], 15: [80, -24], banker: [116, -3], bridge: [146, -12]
};
const NODE_ORDER = ["home"].concat(Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1), ["merchant", "challenger", "banker", "bridge"]);
/* The path, and the branches that open after each boss */
const NODE_PATH = [["home", 1]].concat(Array.from({ length: LEVEL_COUNT - 1 }, (_, i) => [i + 1, i + 2]), [[15, "bridge"]]);
const NODE_BRANCH = [[5, "merchant"], [10, "challenger"], [15, "banker"]];
const NPC_KINDS = ["merchant", "challenger", "banker"];

function nodeAt(key, id) {
  const I = ISLANDS[key];
  const [f, dy] = NODE_SPOTS[id];
  return { x: Math.round(I.x + I.dir * f), y: Math.round(I.y + dy) };
}

/* What a stop is doing: done, open, next (the one to play), locked */
function nodeState(key, id) {
  if (!campIslandOpen(key)) return "locked";
  if (id === "home") return "open";
  if (typeof id === "number") {
    if (campWon(key, id)) return "done";
    return campLevelOpen(key, id) ? "next" : "locked";
  }
  if (id === "bridge") return campIslandIdx(key) < CAMP.islands.length - 1 && campWon(key, LEVEL_COUNT) ? "open" : "locked";
  return campShopOpen(key, id) ? "open" : "locked";
}
const isBossLevel = n => BOSS_LEVELS.includes(n);

let mapSel = null;            // the island being looked at, or null for the whole world
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

/* How many islands are open, and which ones still sit in the clouds */
const openIslandCount = () => CAMP.islands.filter(i => campIslandOpen(i.id)).length;
const nextLockedIndex = () => openIslandCount();

function placeFogged(key) {
  if (campIslandOpen(key)) return false;            // an island you've reached is never lost in the clouds
  return campIslandIdx(key) > nextLockedIndex();
}

function placeState(key) {
  if (campIslandOpen(key)) return "open";
  return placeFogged(key) ? "fog" : "locked";
}

function placeTitle(key) {
  return CAMP.islandById[key].name;
}

function mapRect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

function mapTree(g, x, y, canopy, fruit) {
  mapRect(g, x, y + 3, 1, 3, "#5a3a22");
  mapRect(g, x - 2, y - 1, 5, 4, canopy);
  mapRect(g, x - 1, y - 2, 3, 1, canopy);
  if (fruit) { mapRect(g, x - 1, y, 1, 1, fruit); mapRect(g, x + 1, y + 1, 1, 1, fruit); }
}

/* How wide the grassy top is at a row: a soft, wide plateau rather than a thin oval */
function isleHalf(isl, dy) {
  const k = Math.min(1, Math.abs(dy) / (isl.th + 0.5));
  return (isl.w / 2) * Math.pow(1 - Math.pow(k, 2.6), 1 / 2.6);
}

/* ----- One island, painted once into its own canvas (again when its paths change) ----- */
const ISLE_ROOM = 46;         // room above the grass for towers, trees and smoke
function paintIsland(key, fog) {
  const isl = ISLANDS[key];
  const W = isl.w + 24, H = ISLE_ROOM + isl.th * 2 + isl.depth + 12;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const cx = Math.floor(W / 2), cy = ISLE_ROOM + isl.th;
  // an island you haven't reached is a silhouette against the sky around it
  const haze = k => { const [r, gg, bb] = skyAt(isl.y); return "#" + [r, gg, bb].map(v => Math.round(v * k).toString(16).padStart(2, "0")).join(""); };
  const [a, b, edge] = fog ? [haze(0.84), haze(0.8), haze(0.7)] : MAP_BIOME[key];
  const seed = isl.n * 31 + 7;
  // the rock underneath, tapering to a ragged point, in bands: soil, stone, deep stone
  for (let r = 0; r <= isl.depth; r++) {
    const f = 1 - r / isl.depth;
    const half = (isl.w / 2 - 4) * (r < 6 ? 1 - r * 0.012 : Math.pow(f, 1.25) * 0.93 + 0.0) + (mapNoise(r, seed, 4, 3) - 0.5) * 8 + (mapHash(r, seed, 3) - 0.5) * 2;
    if (half < 0.6) break;
    const y = cy + isl.th - 3 + r;
    const wob = Math.sin(r * 0.35 + seed) * 1.2;
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      const band = r + mapNoise(x, r, 9, seed) * 6 - 3 + wob;
      let col;
      if (fog) col = (x + r) % 3 ? haze(0.66) : haze(0.62);
      else col = isleRockColor(key, x, r, band, isl.depth, seed);
      if (x >= Math.round(half) - 1) col = fog ? haze(0.56) : "#2e2420";
      else if (x <= -Math.round(half) + 1 && !fog) col = shadeHex(col, 0.18);
      mapRect(g, cx + x, y, 1, 1, col);
    }
  }
  // roots, vines and drips hanging off the underside
  if (!fog) for (let k = 0; k < 9; k++) {
    const x = cx - isl.w * 0.4 + k * (isl.w * 0.8 / 8) + (mapHash(k, seed, 5) - 0.5) * 8;
    const y0 = cy + isl.th - 2 + Math.round(isl.depth * 0.25 * mapHash(k, seed, 9));
    const len = 3 + Math.floor(mapHash(k, seed, 11) * 9);
    isleHanging(g, key, x, y0, len, k);
  }
  // the soil lip under the front of the grass, for depth
  for (let dy = isl.th - 5; dy <= isl.th; dy++) {
    const half = isleHalf(isl, dy);
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      mapRect(g, cx + x, cy + dy + 2, 1, 1, fog ? haze(0.7) : mapHash(x, dy, seed + 7) > 0.5 ? "#6c482b" : "#7a5232");
    }
  }
  // the grassy top
  for (let dy = -isl.th; dy <= isl.th; dy++) {
    const half = isleHalf(isl, dy) + (mapHash(dy, seed, 13) - 0.5) * 1.4;
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      let col = ((x + dy) & 1) && mapHash(x, dy, seed + 5) > 0.45 ? b : a;
      if (!fog) col = isleGroundColor(key, x, dy, col, isl);
      if (dy >= isl.th - 2) col = edge;
      if (dy === -isl.th || (dy < 0 && Math.abs(x) >= Math.round(half) - 1)) col = fog ? haze(0.92) : shadeHex(a, 0.2);
      mapRect(g, cx + x, cy + dy, 1, 1, col);
    }
  }
  if (fog) {
    // only the outline of its landmark shows through the haze
    const sil = document.createElement("canvas");
    sil.width = W; sil.height = H;
    const sg = sil.getContext("2d");
    paintLandmark2(sg, key, isleAt(key, cx, cy), isl);
    sg.globalCompositeOperation = "source-in";
    sg.fillStyle = haze(0.74);
    sg.fillRect(0, 0, W, H);
    g.drawImage(sil, 0, 0);
  } else {
    paintIsleScenery(g, key, cx, cy, isl, "under");
    paintIslePaths(g, key, cx, cy, isl);
    paintIsleScenery(g, key, cx, cy, isl, "over");
  }
  return { c, ox: cx, oy: cy };
}

function shadeHex(hex, k) {
  const c = hexToRgb(hex).map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return "#" + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

/* The dirt paths between the stops. Paths you've opened are trodden smooth; the rest are faint. */
function paintIslePaths(g, key, cx, cy, isl) {
  const I = ISLANDS[key];
  const dirt = isleDirt(key);
  const local = id => { const p = nodeAt(key, id); return { x: p.x - I.x + cx, y: p.y - I.y + cy }; };
  const walk = (a, b, open, branch) => {
    const A = local(a), B = local(b);
    const n = Math.ceil(Math.hypot(B.x - A.x, B.y - A.y));
    const w = branch ? 2 : 3;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      // a gentle wave, so it reads as a trodden path and not a ruler line
      const x = A.x + (B.x - A.x) * f;
      const y = A.y + (B.y - A.y) * f + Math.sin(f * Math.PI * 2 + n) * (A.y === B.y ? 1.2 : 0);
      if (!open) { if (i % 3 === 0) mapRect(g, x, y + 1, 1, 1, "rgba(40,30,20,0.28)"); continue; }
      mapRect(g, x - 1, y, w, 2, dirt[0]);
      mapRect(g, x - 1, y + 2, w, 1, dirt[1]);
      if (mapHash(i, n, 3) > 0.82) mapRect(g, x, y, 1, 1, dirt[2]);
    }
  };
  NODE_PATH.forEach(([a, b]) => walk(a, b, nodeState(key, b) !== "locked", false));
  NODE_BRANCH.forEach(([a, b]) => walk(a, b, nodeState(key, b) !== "locked", true));
}

function pathTag(key) {
  return NODE_ORDER.map(id => nodeState(key, id)[0]).join("");
}

function islandArt(key) {
  const fog = placeFogged(key);
  const tag = fog ? "fog" : "on:" + pathTag(key);
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

const bob = (isl, t) => Math.round(Math.sin(t * 0.7 + isl.phase) * 1);

function drawMap(ts) {
  const g = mapCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const t = ts / 1000;
  drawSky(t);
  g.clearRect(0, 0, MAP_W, MAP_H);

  // clouds drifting between the islands, tinted by the sky around them
  for (let i = 0; i < 22; i++) {
    const w = 18 + mapHash(i, 7, 3) * 30;
    const x = ((mapHash(i, 7, 5) * (MAP_W + 120) + t * (1.2 + (i % 5) * 0.35)) % (MAP_W + 120)) - 60;
    const y = 20 + (i % 11) * (MAP_H / 11) + mapHash(i, 7, 9) * 24;
    const [r, gg, b] = skyAt(y);
    drawCloud(g, x, y, w, `rgba(${Math.round((r + 255 * 2) / 3)},${Math.round((gg + 255 * 2) / 3)},${Math.round((b + 255 * 2) / 3)},0.5)`);
  }

  // the Coil: the body every island hangs on
  drawCoil(g, t);

  // the islands, bobbing gently, with everything that lives on them
  MAP_ORDER.forEach(key => {
    const isl = ISLANDS[key];
    const art = islandArt(key);
    const by = bob(isl, t);
    if (!placeFogged(key)) drawIsleBehind(g, key, t, by);
    g.drawImage(art.c, isl.x - art.ox, isl.y - art.oy + by);
    if (placeFogged(key)) return;
    drawIsleLiving(g, key, t, by);
    NODE_ORDER.forEach(id => drawNodeArt(g, key, id, nodeState(key, id), t, by));
  });

  // your snake, waiting by the next thing to do
  drawTraveler(g, t);

  // clouds over the places you have not reached, thinning as they open
  MAP_ORDER.forEach(k => {
    const target = placeFogged(k) ? 1 : 0;
    if (mapFog[k] === undefined) mapFog[k] = target;
    mapFog[k] += (target - mapFog[k]) * 0.06;
    if (mapFog[k] < 0.01) return;
    const p = ISLANDS[k];
    const [r, gg, bb] = skyAt(p.y);
    const tint = k => `rgb(${Math.round(r + (255 - r) * k)},${Math.round(gg + (255 - gg) * k)},${Math.round(bb + (255 - bb) * k)})`;
    g.globalAlpha = mapFog[k] * 0.85;
    for (let i = 0; i < 13; i++) {
      const w = 30 + mapHash(i, p.n, 4) * 36;
      drawCloud(g, p.x - w / 2 + Math.sin(t * 0.35 + i) * 6 + (i - 6) * 25, p.y - 2 + (i % 3) * 13 + mapHash(i, p.n, 6) * 8, w, tint(i % 2 ? 0.7 : 0.55));
    }
    g.globalAlpha = 1;
  });

  // a sea of clouds far below, lit by the sunrise
  for (let x = 0; x < MAP_W; x++) {
    const h = 10 + Math.round(Math.sin((x + t * 4) * 0.13) * 2 + Math.sin((x - t * 2.5) * 0.31) * 1.5);
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

/* Where your snake waits: the last level you played, or the next one to play */
function travelerSpot() {
  const key = campIslandOpen(camp.at) ? camp.at : CAMP.islands[0].id;
  if (lastPlayed && lastPlayed.key === key) return { key, id: lastPlayed.j };
  return { key, id: campNextLevel(key) || "home" };
}

function drawTraveler(g, t) {
  const { key, id } = travelerSpot();
  const isl = ISLANDS[key], p = nodeAt(key, id), by = bob(isl, t);
  const skin = currentSkin();
  const hx = p.x - isl.dir * 8, hy = p.y + 3 + by;
  // a little coil of snake beside the stop, head up, looking about
  for (let i = 6; i >= 1; i--) {
    const a = -isl.dir * (i * 0.95) + t * 0.6;
    mapRect(g, hx + Math.cos(a) * 2.6 - 1, hy + Math.sin(a) * 1.4, 2, 2, skin.colors[skin.order[i % skin.order.length]]);
  }
  const look = Math.sin(t * 0.9) > 0 ? 1 : -1;
  const hb = Math.round(Math.sin(t * 3) * 0.6);
  mapRect(g, hx - 1, hy - 3 + hb, 2, 3, skin.colors[skin.order[0]]);
  mapRect(g, hx + (look > 0 ? 0 : -1), hy - 3 + hb, 1, 1, "#ffffff");
  if (Math.sin(t * 2.3) > 0.85) mapRect(g, hx + (look > 0 ? 1 : -2), hy - 2 + hb, 1, 1, "#ff3b6b");
}

function mapLoop(ts) {
  mapRaf = 0;
  if (currentScreen !== "modes") return;
  mapRaf = requestAnimationFrame(mapLoop);
  if (++mapFrame % 2 && mapFrame > 1) return;
  drawMap(ts);
}
/* The map always covers the whole screen. It opens close enough to read, on the
   island you're working on; drag to travel, scroll or pinch to zoom.
   Zoomed all the way out, the whole map still fills the screen. */
let mapCam = null;          // the view: { s, tx, ty }, kept between visits

const WORLD_W = MAP_W * 2, WORLD_H = MAP_H * 2;
/* The smallest scale: the world just covers the screen */
function mapFit() {
  const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  return Math.max(vw / WORLD_W, vh / WORLD_H);
}
/* The usual scale: one island, with a glimpse of the ones above and below */
const mapNear = () => Math.max(mapFit(), Math.min(mapEl.clientHeight / 330, mapEl.clientWidth / 660));
const mapMax = () => mapNear() * 2.4;

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

/* Where the camera starts: the island you're on */
function homeCam() {
  const key = campIslandOpen(camp.at) ? camp.at : CAMP.islands[0].id;
  const isl = ISLANDS[key];
  return camOn(isl.x, isl.y + 4, mapNear());
}

let camShown = null;        // the view on screen right now (for the sky's parallax)
const mapCamNow = () => camShown || mapCam || { s: 1, tx: 0, ty: 0 };

function applyCam(c) {
  const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mui")) || 1;
  camShown = { ...c };
  mapWorldEl.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
  mapWorldEl.style.setProperty("--inv", (ui * (mapSel ? 1.1 : 1) / Math.max(c.s, mapFit() * 0.9)).toFixed(4));
  mapEl.classList.toggle("can-pan", !mapSel);
  // on a small screen the stops sit close together: their labels give way
  mapEl.classList.toggle("tight", c.s * 2 < 1.6);
  const deep = !mapSel && c.s >= mapNear() * 0.92;
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
    // Frame the whole island, from its tallest tower down to its rock, below the banner
    const isl = ISLANDS[mapSel];
    const top = isl.y - isl.th - 34, bottom = isl.y + isl.th + isl.depth * 0.5;
    const tall = (bottom - top) * 2, wide = (isl.w + 50) * 2;
    const bannerBottom = mapBannerEl.classList.contains("open") ? mapBannerEl.offsetTop + mapBannerEl.offsetHeight + 6 : 6;
    const room = Math.max(vh * 0.4, vh - bannerBottom - 8);
    const s = Math.max(mapFit(), Math.min(mapMax() * 1.4, room / tall, vw / wide));
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
  let swipe = null;            // up close on an island: a swipe up or down moves to the next one
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
        if (dragged && !swipe.done) mapWorldEl.style.translate = `0 ${Math.max(-40, Math.min(40, (y - y0) * 0.35))}px`;
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
        // up close, a swipe down climbs to the island above, a swipe up drops to the one below
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
        if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.4) { swipe.done = true; stepPlace(dy > 0 ? 1 : -1); }
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

/* ----- Pins: one per island from afar; its twenty stops up close ----- */
let mapPop = null;              // { key, j, nm } while a stop's little bubble is open (j: its id)
let mapRules = false;           // the rules card is showing
let mapReturnTo = null;         // reopen this island when coming back to the map
let lastPlayed = null;          // { key, j, nm } of the last level started from the map
const mapPopEl = document.getElementById("map-pop");
const mapBannerEl = document.getElementById("map-banner");

const LEAF_SVG = '<svg class="leaf" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4 3 7 7 7 11a7 7 0 0 1-6 6.9V22h-2v-2.1A7 7 0 0 1 5 13c0-4 3-8 7-11z"/></svg>';
const CROWN_SVG = '<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18v3H3zM3 7l5 4 4-7 4 7 5-4-2 10H5z"/></svg>';
/* What each of an island's side stops is called, and its picture */
const NODE_ICON = { home: "tree", merchant: "bag", challenger: "flag", banker: "coins", bridge: "gate" };
const NODE_LABEL = { home: "Home", merchant: "Merchant", challenger: "Challenger", banker: "Bank", bridge: "Bridge" };
const NODE_PIN_LIFT = { home: 22, merchant: 24, challenger: 28, banker: 32, bridge: 24 };
const nodeKey = (key, id) => (typeof id === "number" ? `lv-${key}-${id}` : `np-${key}-${id}`);

function renderModes(justUnlocked) {
  document.getElementById("map-hint").textContent = isTouchDevice() ? "Drag to explore, pinch to zoom" : "Drag to explore, scroll to zoom";
  mapPinsEl.innerHTML = "";
  const add = (cls, key, area, x, y, html, label, onClick) => {
    const pin = document.createElement("button");
    pin.className = "map-pin " + cls;
    pin.dataset.key = key;
    pin.dataset.area = area;
    pin.style.left = x * 2 + "px";
    pin.style.top = y * 2 + "px";
    pin.style.setProperty("--m", CAMP.islandById[area].colors.accent);
    pin.innerHTML = html;
    pin.setAttribute("aria-label", label);
    pin.addEventListener("click", e => { e.stopPropagation(); onClick(pin); });
    mapPinsEl.appendChild(pin);
    return pin;
  };
  const focusKey = justUnlocked || (campIslandOpen(camp.at) ? camp.at : CAMP.islands[0].id);
  MAP_ORDER.forEach(key => {
    const st = placeState(key);
    const isl = ISLANDS[key];
    const inner = st === "open" ? `<span class="dot"></span>` : st === "fog" ? `<span class="q">?</span>` : LOCK_SVG;
    const label = st === "fog" ? "" : `<span class="lbl">${escapeAttr(isl.name)}</span>`;
    const pin = add("area " + st, "place-" + key, key, isl.x, isl.y - isl.th - 10, inner + label,
      st === "fog" ? "An unexplored island" : `${placeTitle(key)}${st === "locked" ? ", locked" : ""}`,
      () => selectPlace(key));
    if (key === focusKey) pin.dataset.autofocus = "";
    if (key === justUnlocked) pin.classList.add("just-unlocked");
    if (st === "fog") return;
    NODE_ORDER.forEach(id => {
      const p = nodeAt(key, id), ns = nodeState(key, id);
      if (typeof id === "number") {
        const def = campLevelDef(key, id);
        const boss = isBossLevel(id);
        const html = boss ? (ns === "done" ? CROWN_SVG : SKULL_SVG) : `<span class="n">${id}</span>`;
        const rec = camp.levels[campLevelId(key, id)];
        add(`level ${ns === "locked" ? "locked" : "open"} ${ns}${boss ? " boss" : ""}${rec && rec.flawless ? " flawless" : ""}`, nodeKey(key, id), key, p.x, p.y - (boss ? 19 : 5), html,
          `${id}. ${def.name}${ns === "locked" ? ", locked" : ns === "done" ? ", won" : ""}`, pin => openLevelPop(key, id, false, pin));
      } else {
        const npc = NPC_KINDS.includes(id) ? CAMP.islandById[key].npcs[id] : null;
        const name = npc ? npc.name : id === "home" ? "Home base" : "The bridge";
        add(`prop node ${id} ${ns}`, nodeKey(key, id), key, p.x, p.y - NODE_PIN_LIFT[id],
          `<img class="pi" src="${iconUrl(NODE_ICON[id], 2)}" alt="">${ns === "locked" ? `<span class="nlock">${LOCK_SVG}</span>` : ""}<span class="lbl">${NODE_LABEL[id]}</span>`,
          `${name}${ns === "locked" ? ", locked" : ""}`, pin => openLevelPop(key, id, false, pin));
      }
    });
  });
  updatePins();
  if (mapSel) renderBanner();
  requestAnimationFrame(layoutMap);
  if (!mapRaf) mapRaf = requestAnimationFrame(mapLoop);
  if (justUnlocked) setTimeout(() => selectPlace(justUnlocked), mapSel ? 0 : 350);
}

/* Which pins show: islands from afar, an island's stops up close */
function updatePins() {
  mapPinsEl.querySelectorAll(".map-pin").forEach(pin => {
    const area = pin.dataset.area;
    const near = mapSel === area || (!mapSel && mapDeep);
    const isArea = pin.classList.contains("area");
    const fog = placeFogged(area);
    pin.hidden = isArea ? (near && !fog) : !near;
    const key = pin.dataset.key;
    pin.classList.toggle("selected", !!mapPop && mapPop.key === area && key === nodeKey(area, mapPop.j));
    const last = !!lastPlayed && key === nodeKey(lastPlayed.key, lastPlayed.j);
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
    const first = mapPinsEl.querySelector(`.map-pin.level.next[data-area="${key}"]:not([hidden])`) || mapPinsEl.querySelector(`.map-pin.level.open[data-area="${key}"]:not([hidden])`) || mapBannerEl.querySelector("button:not(:disabled)");
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
  // step back out over the island you were looking at, not wherever the camera was before
  const isl = ISLANDS[was];
  mapCam = camOn(isl.x, isl.y + 4, mapNear());
  layoutMap();
  updatePins();
  const pin = mapPinsEl.querySelector(`[data-key="place-${was}"]`);
  if (pin && !pin.hidden) setKbdFocus(pin);
}

/* Up close, the arrows (or a swipe) step to the island above or below */
function stepPlace(d) {
  if (!mapSel) return;
  const visible = MAP_ORDER.filter(k => placeState(k) !== "fog");
  const i = visible.indexOf(mapSel);
  const next = visible[i + d];
  if (next && next !== mapSel) selectPlace(next);
}

/* ----- The banner over a chosen island: its name, its money and its home ----- */
function renderBanner() {
  const key = mapSel;
  if (!key) return;
  const st = placeState(key);
  const I = CAMP.islandById[key];
  const b = mapBannerEl;
  b.style.setProperty("--m", I.colors.accent);
  const title = st === "fog" ? "Unexplored island" : I.name;
  let action = "", note = "";
  const i = campIslandIdx(key);
  if (st === "fog") note = `Lost in the clouds. Cross from ${CAMP.islands[i - 1].name} first.`;
  else if (st === "locked") note = `Beat the last boss of ${CAMP.islands[i - 1].name} to open the bridge.`;
  else {
    const won = Array.from({ length: LEVEL_COUNT }, (_, n) => n + 1).filter(n => campWon(key, n)).length;
    note = `${I.blurb} ${won} of ${LEVEL_COUNT} levels won.`;
    action = `<span class="mbn-coin" title="${escapeAttr(I.currency.plural)}">${coinHtml(key)}${fmtInt(campWallet(key))}</span>` +
      `<button class="btn btn-small btn-green" data-home>${LEAF_SVG} Home base</button>`;
    const nx = campNextLevel(key);
    if (nx) action += `<button class="btn btn-small btn-primary" data-next>Level ${nx}</button>`;
  }
  b.innerHTML = `<div class="mbn-row">
      <button class="btn btn-small mb-nav" data-step="-1" aria-label="The island below" ${i === 0 ? "disabled" : ""}>&#9660;</button>
      <div class="mbn-mid"><span class="mbn-title">${escapeAttr(title)}</span></div>
      <button class="btn btn-small mb-nav" data-step="1" aria-label="The island above" ${MAP_ORDER.slice(i + 1).every(k => placeState(k) === "fog") ? "disabled" : ""}>&#9650;</button>
    </div>
    <p class="mbn-note">${escapeAttr(note)}</p>${action ? `<div class="mbn-act">${action}</div>` : ""}`;
  b.classList.add("open");
  b.querySelectorAll("[data-step]").forEach(el => el.addEventListener("click", () => stepPlace(+el.dataset.step)));
  const home = b.querySelector("[data-home]");
  if (home) home.addEventListener("click", () => openNode(key, "home"));
  const nx = b.querySelector("[data-next]");
  if (nx) nx.addEventListener("click", () => {
    const n = campNextLevel(key);
    const pin = mapPinsEl.querySelector(`[data-key="${nodeKey(key, n)}"]`);
    openLevelPop(key, n, false, pin);
  });
}

/* A little coin in an island's currency color */
function coinHtml(key) {
  return `<span class="coin" style="--cc:${CAMP.islandById[key].currency.color}" aria-hidden="true"></span>`;
}

/* ----- A stop's little bubble ----- */
function levelKindText(def) {
  if (def.kind === "boss") return `Boss fight ${def.goal.fight} of 3`;
  return { static: "Still board", enemy: "Board with enemies", dynamic: "Moving board" }[def.kind] || "Level";
}

function openLevelPop(key, j, nm, pinEl) {
  if (mapSel !== key) selectPlace(key);
  mapPop = { key, j, nm: false, pin: pinEl };
  mapRules = false;
  mapBriefEl.classList.remove("open");
  sfx("click");
  updatePins();
  const I = CAMP.islandById[key];
  const st = nodeState(key, j);
  mapPopEl.style.setProperty("--m", I.colors.accent);
  mapPopEl.className = "map-pop open";
  if (typeof j === "number") {
    const def = campLevelDef(key, j);
    const rec = camp.levels[campLevelId(key, j)];
    let why = "";
    if (!campIslandOpen(key)) why = "Reach this island first";
    else if (st === "locked") why = `Win ${j - 1}. ${campLevelDef(key, j - 1).name} first`;
    mapPopEl.innerHTML = `<p class="mp-name">${isBossLevel(j) ? SKULL_SVG : ""}${j}. ${escapeAttr(def.name)}</p>
      <p class="mp-sub">${levelKindText(def)}${rec && rec.wins ? `, best ${fmtCompact(rec.best)}` : ""}</p>
      <p class="mp-goal">${escapeAttr(goalText(def.goal))}</p>
      ${why ? `<p class="mp-why">${LOCK_SVG}${escapeAttr(why)}</p>` : ""}
      <div class="mp-btns"><button class="btn btn-small" data-rules>Rules</button><button class="btn btn-small btn-primary" data-play ${st === "locked" ? "disabled" : ""}>${st === "done" ? "Again" : "Play"}</button></div>`;
    mapPopEl.querySelector("[data-rules]").addEventListener("click", () => openLevelRules());
    mapPopEl.querySelector("[data-play]").addEventListener("click", () => playLevel(key, j));
  } else {
    const npc = NPC_KINDS.includes(j) ? I.npcs[j] : null;
    const next = CAMP.islands[campIslandIdx(key) + 1];
    let name, sub, line, why = "", go;
    if (npc) {
      name = npc.name; sub = npc.shop; line = `"${npc.line}"`;
      if (st === "locked") why = `Beat the boss at level ${SHOP_AFTER[j]} first`;
      go = "Visit";
    } else if (j === "home") {
      name = "Home base"; sub = I.tree.name; line = "The island's upgrade tree, your satchel and everything you've collected.";
      go = "Go home";
    } else {
      name = next ? `Bridge to ${next.name}` : "The Coil's head"; sub = next ? "Ride the Coil up" : "The end of the road";
      line = next ? next.blurb : "There's nowhere higher to go. You made it.";
      if (!next) why = "This is the last island";
      else if (st === "locked") why = `Beat the boss at level ${LEVEL_COUNT} first`;
      go = "Cross";
    }
    mapPopEl.innerHTML = `<p class="mp-name">${escapeAttr(name)}</p><p class="mp-sub">${escapeAttr(sub)}</p>
      <p class="mp-line">${escapeAttr(line)}</p>
      ${why ? `<p class="mp-why">${LOCK_SVG}${escapeAttr(why)}</p>` : ""}
      <div class="mp-btns one"><button class="btn btn-small btn-primary" data-go ${st === "locked" ? "disabled" : ""}>${go}</button></div>`;
    mapPopEl.querySelector("[data-go]").addEventListener("click", () => openNode(key, j));
  }
  positionPop(pinEl);
  setTimeout(() => {
    const b = mapPopEl.querySelector("[data-play]:not(:disabled), [data-go]:not(:disabled)") || mapPopEl.querySelector("[data-rules]");
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
    const pin = mapPinsEl.querySelector(`[data-key="${nodeKey(was.key, was.j)}"]`);
    if (pin) setKbdFocus(pin);
  }
  return true;
}

function playLevel(key, j) {
  if (!campLevelOpen(key, j)) return;
  camp.at = key;
  saveCamp();
  lastPlayed = { key, j, nm: false };
  mapReturnTo = key;
  campBeginLevel(key, j);
}

/* The side stops: home, the three shopkeepers, the bridge */
function openNode(key, id) {
  if (nodeState(key, id) === "locked") return;
  sfx("tab");
  mapReturnTo = key;
  if (id === "bridge") {
    const next = CAMP.islands[campIslandIdx(key) + 1];
    if (!next) return;
    closeLevelPop(true);
    camp.at = next.id;
    saveCamp();
    sfx("portal");
    selectPlace(next.id);
    return;
  }
  if (id === "home") { if (typeof openCampHome === "function") openCampHome(key); return; }
  if (typeof openCampShop === "function") openCampShop(key, id);
}

/* ----- The rules card, only when asked for ----- */
function openLevelRules() {
  if (!mapPop || typeof mapPop.j !== "number") return;
  const { key, j } = mapPop;
  const def = campLevelDef(key, j);
  const I = CAMP.islandById[key];
  mapRules = true;
  mapPopEl.className = "map-pop";
  const open = campLevelOpen(key, j);
  const facts = '<dl class="facts">' + campLevelFacts(key, j).map(([label, t, frame]) =>
    `<div class="fact"><dt>${label}</dt><dd>${frame ? `<span class="frame-dot ${frame}" aria-hidden="true"></span>` : ""}${t}</dd></div>`).join("") + "</dl>";
  mapBriefEl.style.setProperty("--m", I.colors.accent);
  mapBriefEl.innerHTML = `<p class="mb-kicker">${escapeAttr(I.name)}</p>
    <h3 class="mb-title">${escapeAttr(def.name)}</h3>
    <p class="mb-sub">Level ${j}, ${levelKindText(def).toLowerCase()}</p>
    <p class="mb-text">${escapeAttr(def.text)}</p>${facts}
    <div class="mb-buttons"><button class="btn" data-map-back>Close</button><button class="btn btn-primary" data-play ${open ? "" : "disabled"}>Play</button></div>`;
  mapBriefEl.classList.add("open");
  sfx("page");
  mapBriefEl.querySelector("[data-map-back]").addEventListener("click", () => {
    const keep = mapPop;
    mapRules = false;
    mapBriefEl.classList.remove("open");
    const pin = keep && mapPinsEl.querySelector(`[data-key="${nodeKey(keep.key, keep.j)}"]`);
    if (keep && pin) openLevelPop(keep.key, keep.j, false, pin);
  });
  mapBriefEl.querySelector("[data-play]").addEventListener("click", () => playLevel(key, j));
  setTimeout(() => { const b = mapBriefEl.querySelector("[data-play]:not(:disabled)") || mapBriefEl.querySelector("[data-map-back]"); if (b) b.focus({ preventScroll: true }); }, 60);
}

/* The facts on a level's rules card */
const EDGE_TEXT = {
  wrap: ["The edges wrap around", "walls-off"], wall: ["Walls all around", "walls-on"], mirror: ["The edges mirror", "walls-mirror"],
  endless: ["An endless road: keep up with the screen", "walls-endless"], maze: ["An endless maze that wraps around", "walls-off"]
};
const SPAWN_NAMES = {
  popsicle: "popsicles", flea: "fleas", fire: "fire", molasses: "molasses", rock: "rocks", bramble: "brambles", wasp: "bees",
  lightning: "lightning", ice: "ice", bomb: "bombs", ghost: "ghosts", spikes: "spike traps", gust: "gusts", sinkhole: "sinkholes",
  golden: "golden apples", frenzy: "frenzy fruit", shears: "shears", armor: "armor", shield: "bubbles", hourglass: "hourglasses",
  star: "stars", phantom: "phantoms", lodestone: "lodestones"
};
function campLevelFacts(key, j) {
  const def = campLevelDef(key, j);
  const out = [["Goal", escapeAttr(goalText(def.goal))]];
  const edge = EDGE_TEXT[{ tunnel: "endless", maze: "maze", field: "maze" }[def.layout] || def.edge] || EDGE_TEXT.wall;
  out.push(["Board", edge[0], edge[1]]);
  const sp = Object.keys(def.spawns || {}).map(k => SPAWN_NAMES[k] || k);
  if (def.goal.type === "boss") sp.unshift(CAMP.islandById[key].boss.name);
  if (sp.length) out.push(["Watch for", escapeAttr(sp.join(", "))]);
  const first = !campWon(key, j);
  out.push(["Reward", `${coinHtml(key)} ${fmtInt(campRewardPreview(key, j, first))} ${escapeAttr(campCurrency(key).plural)}${first ? " (first win)" : ""}`]);
  return out;
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

function updateDock() { /* the old Commons' landmarks are gone: home base is on every island */ }
