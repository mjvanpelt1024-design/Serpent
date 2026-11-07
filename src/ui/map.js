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
   grassy top. depth: how far the rock hangs down (each island's own, from ISLE_SHAPE in
   src/ui/map-isles.js). dir: which way its path runs (1 = right).
   They climb the sky in a zigzag: each one sits toward the side the Coil comes up on,
   [x from the middle, y]. */
const ISLE_STAGGER = [[-72, 0], [70, -2], [-62, 2], [78, -4], [-66, -10]];
const ISLANDS = {};
CAMP.islands.forEach((isl, i) => {
  const [sx, sy] = ISLE_STAGGER[i % ISLE_STAGGER.length];
  ISLANDS[isl.id] = { id: isl.id, n: i, x: 300 + sx, y: 722 - i * 138 + sy, w: 300, th: 32, depth: 76, dir: i % 2 ? -1 : 1, name: isl.name };
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

/* ----- One island, painted once into its own canvas (again when its paths change) -----
   Its outline, the rock under it and the grass on top come from src/ui/map-isles.js:
   every island has its own shape there. */
const ISLE_ROOM = 46;         // room above the grass for towers, trees and smoke
function paintIsland(key, fog) {
  const isl = ISLANDS[key];
  const form = isleForm(key);
  const W = form.reach * 2 + 24, H = ISLE_ROOM + form.back + form.front + form.drop + 16;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const cx = Math.floor(W / 2), cy = ISLE_ROOM + form.back;
  // pictures in textures/map/<island>/: an island you haven't reached is a silhouette in the haze
  // (fog.png); one you have is its rock and ground (under.png), the paths you've opened, then its
  // trees, houses and props (over.png), then the signposts and lanterns, which change as you go
  const base = `map:${key}:${fog ? "fog" : "under"}`;
  g.drawImage(texCanvas(base), 0, 0);
  if (!fog) {
    paintIslePaths(g, key, cx, cy, isl);
    texLayer(g, `map:${key}:over`, 0, 0);
    paintIsleWays(g, key, isleAt(key, cx, cy), isleFree(key));
  }
  // where drips fall from the spikes under it: listed with its picture ("tips"), so a repainted island can move them
  const e = TextureLoader.entry(base);
  return { c, ox: cx, oy: cy, tips: (e && e.tips) || [] };
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
  paintMapWorld(g, t);

  // pins ride along with their island
  mapPinsEl.querySelectorAll(".map-pin").forEach(pin => {
    const v = bob(ISLANDS[pin.dataset.area], t) * 2;
    if (pin._bob !== v) { pin._bob = v; pin.style.setProperty("--bob", v + "px"); }
  });
}

/* Everything in the world but the sky: clouds, the Coil, the islands and all that lives on them,
   your snake, the fog and the cloud sea. The title screen paints it too (src/art/title-scene.js). */
function paintMapWorld(g, t) {

  // clouds drifting between the islands, tinted by the sky around them
  for (let i = 0; i < 22; i++) {
    const w = 18 + mapHash(i, 7, 3) * 30;
    const x = ((mapHash(i, 7, 5) * (MAP_W + 120) + t * (1.2 + (i % 5) * 0.35)) % (MAP_W + 120)) - 60;
    const y = 20 + (i % 11) * (MAP_H / 11) + mapHash(i, 7, 9) * 24;
    const [r, gg, b] = skyAt(y);
    drawCloud(g, x, y, w, `rgba(${Math.round((r + 255 * 2) / 3)},${Math.round((gg + 255 * 2) / 3)},${Math.round((b + 255 * 2) / 3)},0.5)`);
  }

  // a flock of birds crossing the morning sky now and then
  {
    const ph = (t / 46) % 1, fx = -40 + ph * (MAP_W + 80), fy = 640 - ph * 60 + Math.sin(t * 0.8) * 4;
    for (let i = 0; i < 6; i++) {
      const bx = fx - Math.abs(i - 2.5) * 7 + (i > 2 ? 3 : 0), by = fy + Math.abs(i - 2.5) * 4, up = Math.sin(t * 9 + i) > 0;
      mapRect(g, bx - 2, by - (up ? 1 : 0), 2, 1, "#3a3a4a"); mapRect(g, bx + 1, by - (up ? 1 : 0), 2, 1, "#3a3a4a"); mapRect(g, bx, by, 1, 1, "#3a3a4a");
    }
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
    drawQuestTrail(g, key, t, by);
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
  if (mapPop && mapPop.focus) {
    // close enough to see the stop's own little picture and its neighbors on either side
    const p = nodeAt(mapPop.key, mapPop.j);
    const s = Math.max(mapNear() * 1.6, Math.min(mapMax() * 1.25, vh / 170));
    c = { s, tx: vw / 2 - p.x * 2 * s, ty: vh * 0.58 - (p.y - 6) * 2 * s };
    c.tx = Math.min(0, Math.max(vw - WORLD_W * s, c.tx));
    c.ty = Math.min(0, Math.max(vh - WORLD_H * s, c.ty));
  } else if (mapSel) {
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
        // A little give, so the swipe feels attached to the finger (sideways too, up close on a stop)
        const gx = mapPop && mapPop.focus ? Math.max(-60, Math.min(60, (x - x0) * 0.35)) : 0;
        if (dragged && !swipe.done) mapWorldEl.style.translate = `${gx}px ${Math.max(-40, Math.min(40, (y - y0) * 0.35))}px`;
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
        // up close on a stop, a drag to the left walks to the stop on the right, and the other way round
        if (mapPop && mapPop.focus && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) { swipe.done = true; stepNode(dx < 0 ? 1 : -1); }
        else if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.4) { swipe.done = true; stepPlace(dy > 0 ? 1 : -1); }
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
      if (wheelOut > 80) { wheelOut = 0; if (mapPop && mapPop.focus) closeLevelPop(); else closePlace(); }
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
/* What each of an island's side stops is called (its picture is pin:<stop>, textures/icons/map-pins/).
   The three shops go by their own names: The Coiled Anvil, The Tourney Tent, The Counting House... */
const NODE_LABEL = { home: "Home", merchant: "Merchant", challenger: "Challenger", banker: "Bank", bridge: "Bridge" };
const nodeLabel = (key, id) => (NPC_KINDS.includes(id) ? CAMP.islandById[key].npcs[id].shop : NODE_LABEL[id]);
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
        const Q = questFor(key), qi = Q ? Q.levels.indexOf(id) : -1;
        const qhtml = qi >= 0 ? `<span class="qbadge${Q.done[qi] ? " done" : ""}">${Q.done[qi] ? "&#10003;" : qi + 1}</span>` : "";
        // no labels on the map: a stop's name shows when the mouse is on it
        add(`level ${ns === "locked" ? "locked" : "open"} ${ns}${boss ? " boss" : ""}${rec && rec.flawless ? " flawless" : ""}${qi >= 0 ? " quest" + (Q.done[qi] ? " quest-done" : "") : ""}`, nodeKey(key, id), key, p.x, p.y - (boss ? 19 : 5), html + qhtml + `<span class="lbl">${escapeAttr(def.name)}</span>`,
          `${id}. ${def.name}${ns === "locked" ? ", locked" : ns === "done" ? ", won" : ""}`, pin => openLevelPop(key, id, false, pin));
      } else {
        const npc = NPC_KINDS.includes(id) ? CAMP.islandById[key].npcs[id] : null;
        const name = npc ? npc.name : id === "home" ? "Home base" : "The bridge";
        add(`prop node ${id} ${ns}`, nodeKey(key, id), key, p.x, p.y - NODE_PIN_LIFT[id],
          `<img class="pi" src="${iconUrl("pin:" + id, 2)}" alt="">${ns === "locked" ? `<span class="nlock">${LOCK_SVG}</span>` : ""}<span class="lbl">${escapeAttr(nodeLabel(key, id))}</span>`,
          `${name}${ns === "locked" ? ", locked" : ""}`,
          // home and the shops don't ask: a click walks straight in (a locked one flies close to say why)
          pin => ((id === "home" || NPC_KINDS.includes(id)) && ns !== "locked" ? openNode(key, id) : openLevelPop(key, id, false, pin)));
      }
    });
  });
  // your snake, coiled by the stop it's at: click it for your loadout
  const tv = add("traveler", "traveler", focusKey, 0, 0, "", "Your snake: change what you carry", () => { if (typeof openCampLoadout === "function") openCampLoadout(); });
  tv.title = "Your loadout";
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
    // up close, the stop's own pin is the button (it glows): click it to play, visit or cross
    pin.classList.toggle("focused", !!(mapPop && mapPop.focus && key === nodeKey(mapPop.key, mapPop.j)));
    const last = !!lastPlayed && key === nodeKey(lastPlayed.key, lastPlayed.j);
    pin.classList.toggle("last", last);
    const tag = pin.querySelector(".last-tag");
    if (last && !tag) pin.insertAdjacentHTML("beforeend", '<span class="last-tag">Last played</span>');
    if (!last && tag) tag.remove();
  });
  placeTraveler();
  renderLegend();
}

/* The snake's button sits on the little coil drawTraveler paints, wherever it is now */
function placeTraveler() {
  const tv = mapPinsEl.querySelector(".map-pin.traveler");
  if (!tv || !camp) return;
  const { key, id } = travelerSpot();
  const isl = ISLANDS[key], p = nodeAt(key, id);
  tv.dataset.area = key;
  tv.style.left = (p.x - isl.dir * 8) * 2 + "px";
  tv.style.top = (p.y + 2) * 2 + "px";
  tv.hidden = !(mapSel === key || (!mapSel && mapDeep));
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
  // up close on a stop, its scroll owns the top of the screen: never both at once
  if (mapPop && mapPop.focus) { mapBannerEl.classList.remove("open"); return; }
  const st = placeState(key);
  const I = CAMP.islandById[key];
  const b = mapBannerEl;
  b.style.setProperty("--m", I.colors.accent);
  const title = st === "fog" ? "Unexplored island" : I.name;
  // the only words up here are the island's name; the rest is a hover away
  let note = "";
  const i = campIslandIdx(key);
  if (st === "fog") note = `Lost in the clouds. Cross from ${CAMP.islands[i - 1].name} first.`;
  else if (st === "locked") note = `Beat the last boss of ${CAMP.islands[i - 1].name} to open the bridge.`;
  else {
    const won = Array.from({ length: LEVEL_COUNT }, (_, n) => n + 1).filter(n => campWon(key, n)).length;
    note = `${I.blurb} ${won} of ${LEVEL_COUNT} levels won.`;
  }
  b.innerHTML = `<div class="mbn-row">
      <button class="btn btn-small mb-nav" data-step="-1" aria-label="The island below" title="The island below" ${i === 0 ? "disabled" : ""}>&#9660;</button>
      <div class="mbn-mid" title="${escapeAttr(note)}"><span class="mbn-title">${st === "locked" ? LOCK_SVG : ""}${escapeAttr(title)}</span></div>
      <button class="btn btn-small mb-nav" data-step="1" aria-label="The island above" title="The island above" ${MAP_ORDER.slice(i + 1).every(k => placeState(k) === "fog") ? "disabled" : ""}>&#9650;</button>
    </div>`;
  b.classList.add("open");
  b.querySelectorAll("[data-step]").forEach(el => el.addEventListener("click", () => stepPlace(+el.dataset.step)));
}

/* ----- The legend: symbols down the side of the screen for home, the shops, the next level and the
   quest. No words until the mouse is on one. Each flies the map there; home and the shops walk in. ----- */
const mapLegendEl = document.createElement("nav");
mapLegendEl.id = "map-legend";
mapLegendEl.className = "map-legend";
mapLegendEl.setAttribute("aria-label", "Places on this island");
mapEl.appendChild(mapLegendEl);
mapLegendEl.addEventListener("click", e => e.stopPropagation());
mapLegendEl.addEventListener("pointerdown", e => e.stopPropagation());
function renderLegend() {
  // the island you're looking at, or (on the whole map, build 53) the one you're on: the legend is always there
  const key = mapSel || (camp && placeState(camp.at) === "open" ? camp.at : null);
  if (!key || currentScreen !== "modes" || placeState(key) !== "open" || !camp) { mapLegendEl.classList.remove("open"); mapLegendEl._h = ""; return; }
  mapLegendEl.dataset.key = key;
  const I = CAMP.islandById[key];
  const items = [{ k: "home", icon: iconUrl("pin:home", 2), tip: "Home base", cls: "home" }];
  NPC_KINDS.forEach(k => {
    const open = nodeState(key, k) !== "locked";
    items.push({ k, icon: iconUrl("pin:" + k, 2), tip: open ? `${I.npcs[k].shop}: ${I.npcs[k].name}` : `${I.npcs[k].shop}: beat the boss at level ${SHOP_AFTER[k]} first`, cls: k, off: !open });
  });
  const nx = campNextLevel(key);
  if (nx) items.push({ k: "next", icon: iconUrl(isBossLevel(nx) ? "skull" : "flag", 2), tip: `Next: ${nx}. ${campLevelDef(key, nx).name}`, cls: isBossLevel(nx) ? "boss" : "next" });
  const Q = questFor(key), qs = questNextStop(key);
  if (Q && qs) items.push({ k: "quest", icon: iconUrl("scroll", 2), tip: qs.id === "challenger" ? "Quest done: claim your reward" : `Quest: trial ${Q.done.filter(Boolean).length + 1} of ${Q.levels.length}`, cls: "quest" });
  // build 53: nightmare mode, once the last island is won (camp-nightmare.js)
  if (typeof nmUnlocked === "function" && nmUnlocked()) items.push({ k: "nightmare", icon: iconUrl("moon", 2), tip: `Nightmare: ${CAMP.nightmare.tunnels[nmCurrentTunnel()].name}`, cls: "nightmare" });
  const html = items.map(it => `<button class="lg-btn ${it.cls}" data-lg="${it.k}" aria-label="${escapeAttr(it.tip)}" ${it.off ? "disabled" : ""}>` +
    `<img src="${it.icon}" alt="">${it.off ? `<span class="lg-lock">${LOCK_SVG}</span>` : ""}<span class="lg-tip">${escapeAttr(it.tip)}</span></button>`).join("");
  if (mapLegendEl._h !== html) {
    mapLegendEl.innerHTML = html;
    mapLegendEl._h = html;
    mapLegendEl.querySelectorAll("[data-lg]").forEach(b => b.addEventListener("click", () => legendGo(mapSel || mapLegendEl.dataset.key, b.dataset.lg)));
  }
  mapLegendEl.classList.add("open");
}
function legendGo(key, k) {
  if (!key) return;
  sfx("click");
  if (k === "home") { openNode(key, "home"); return; }
  if (NPC_KINDS.includes(k)) { mapFlyTo(key, k, () => openNode(key, k)); return; }
  if (k === "next") { const n = campNextLevel(key); if (n) mapFlyTo(key, n); return; }
  if (k === "nightmare") { openNmTunnels(); return; }
  if (k === "quest") {
    const qs = questNextStop(key);
    if (qs) mapFlyTo(key, qs.id, qs.id === "challenger" ? () => openNode(key, "challenger") : null);
  }
}

/* A little coin: struck in pixels by src/art/coins.js */
function coinHtml(key) {
  return `<span class="coin" style="--cc:${CAMP.islandById[key].currency.color}" aria-hidden="true"></span>`;
}

/* ----- A stop's little bubble ----- */
function levelKindText(def) {
  if (def.kind === "boss") return `Boss fight ${def.goal.fight} of 3`;
  return { static: "Still board", enemy: "Board with enemies", dynamic: "Moving board" }[def.kind] || "Level";
}

/* ----- Up close on one stop: no bubble. The camera flies in to it, its button sits right on
   it (Play, Visit, Cross), a signpost beside a level holds its rules, a scroll at the top
   names it, and arrows at the sides of the screen step along the path. Esc steps back out. ----- */
const NODE_SEQ = ["home", 1, 2, 3, 4, 5, "merchant", 6, 7, 8, 9, 10, "challenger", 11, 12, 13, 14, 15, "banker", "bridge"];
const nodeHereEl = document.createElement("div");
nodeHereEl.id = "node-here";
nodeHereEl.className = "node-here";
mapWorldEl.appendChild(nodeHereEl);
const nodeScrollEl = document.createElement("div");
nodeScrollEl.id = "node-scroll";
nodeScrollEl.className = "node-scroll scroll-frame";
nodeScrollEl.setAttribute("aria-live", "polite");
mapEl.appendChild(nodeScrollEl);
/* Up to four arrows: each one sits on the side of the screen its stop lies on, and a boss
   has two ways on (its shop and the next level). Shops are dead ends: back to the boss. */
const nodeArrows = [0, 1, 2, 3].map(() => {
  const b = document.createElement("button");
  b.className = "node-arrow zone";
  b.addEventListener("click", e => { e.stopPropagation(); if (b._to) goNode(b._to); });
  mapEl.appendChild(b);
  return b;
});
let nodeLinksNow = [];

/* The stop before or after this one along the path, crossing to the island below or above */
function neighborNode(key, id, d) {
  const i = NODE_SEQ.indexOf(id) + d;
  if (i >= 0 && i < NODE_SEQ.length) return { key, id: NODE_SEQ[i] };
  const k = MAP_ORDER[MAP_ORDER.indexOf(key) + d];
  if (!k || placeState(k) === "fog") return null;
  return { key: k, id: d > 0 ? "home" : "bridge" };
}

/* Where you can walk from a stop: { to, role } with role back, next or shop.
   The path runs home, 1 to 15, the bridge; each boss also has its shop off to the side. */
const BOSS_SHOP = { 5: "merchant", 10: "challenger", 15: "banker" };
function nodeLinks(key, id) {
  const out = [];
  const add = (to, role) => { if (to) out.push({ to, role }); };
  const other = d => { const k = MAP_ORDER[MAP_ORDER.indexOf(key) + d]; return k && placeState(k) !== "fog" ? k : null; };
  if (id === "home") { const k = other(-1); if (k) add({ key: k, id: "bridge" }, "back"); add({ key, id: 1 }, "next"); }
  else if (typeof id === "number") {
    add({ key, id: id === 1 ? "home" : id - 1 }, "back");
    add({ key, id: id === LEVEL_COUNT ? "bridge" : id + 1 }, "next");
    if (BOSS_SHOP[id]) add({ key, id: BOSS_SHOP[id] }, "shop");
  } else if (NPC_KINDS.includes(id)) add({ key, id: SHOP_AFTER[id] }, "back");
  else if (id === "bridge") { add({ key, id: LEVEL_COUNT }, "back"); const k = other(1); if (k) add({ key: k, id: "home" }, "next"); }
  // on a quest: from the challenger or any trial, straight on to the next trial (or back to claim)
  const Q = questFor(key);
  if (Q && (id === "challenger" || Q.levels.includes(id))) {
    const nq = questNextFrom(key, id);
    if (nq && nq.id !== id) {
      const same = out.find(l => l.to.key === nq.key && l.to.id === nq.id);
      if (same) same.role = "quest"; else add(nq, "quest");
    }
  }
  // which side of the screen each lies on: the way it really is from here
  const from = nodeAt(key, id), dir = ISLANDS[key].dir;
  out.forEach(l => {
    const p = nodeAt(l.to.key, l.to.id);
    const dx = p.x - from.x;
    l.side = Math.abs(dx) >= 4 ? Math.sign(dx) : (l.role === "back" ? -dir : dir);
    l.dy = p.y - from.y;
  });
  return out;
}

function goNode(to) {
  if (!mapPop || !mapPop.focus) return;
  if (to.id === "home") { openNode(to.key, "home"); return; }
  // the shops are like home: walking toward one walks in
  if (NPC_KINDS.includes(to.id) && nodeState(to.key, to.id) !== "locked") { openNode(to.key, to.id); return; }
  if (to.key !== mapPop.key) selectPlace(to.key);
  openLevelPop(to.key, to.id, false, mapPinsEl.querySelector(`[data-key="${nodeKey(to.key, to.id)}"]`));
}

function nodeTitle(key, id) {
  if (typeof id === "number") return `${id}. ${campLevelDef(key, id).name}`;
  const I = CAMP.islandById[key];
  if (NPC_KINDS.includes(id)) return I.npcs[id].shop;
  if (id === "home") return "Home base";
  const next = CAMP.islands[campIslandIdx(key) + 1];
  return next ? `Bridge to ${next.name}` : "The Coil's head";
}

/* What an arrow says about where it goes: Home, Boss, Next island, a shop, or just Next */
function arrowLabel(from, to, d, role) {
  if (!to) return { word: d < 0 ? "Previous" : "Next", sub: "", cls: "" };
  const sub = nodeTitle(to.key, to.id);
  if (to.key !== from.key) return { word: d > 0 ? "Next island" : "Island below", sub: CAMP.islandById[to.key].name, cls: "island" };
  if (to.id === "home") return { word: "Home", sub: "", cls: "home" };
  if (typeof to.id === "number" && isBossLevel(to.id)) return { word: "Boss", sub, cls: "boss" };
  if (role === "quest") {
    const Q = questFor(to.key), qi = Q ? Q.levels.indexOf(to.id) : -1;
    return qi >= 0 ? { word: `Quest: trial ${qi + 1} of ${Q.levels.length}`, sub, cls: "quest" } : { word: "Quest done!", sub: "Claim your reward", cls: "quest" };
  }
  if (NPC_KINDS.includes(to.id)) return { word: nodeLabel(to.key, to.id), sub: CAMP.islandById[to.key].npcs[to.id].name, cls: "shop" };
  if (to.id === "bridge") return { word: "Bridge", sub: "", cls: "island" };
  return { word: role === "back" || d < 0 ? "Back" : "Next", sub, cls: "" };
}

/* The arrow keys: left and right take the arrow on that side (the way on before the way
   back, the way back before a shop); up and down take whichever goes up or down the island */
function stepNode(d, vertical = false) {
  if (!mapPop || !mapPop.focus || !nodeLinksNow.length) return;
  const rank = { quest: 0, next: 1, back: 2, shop: 3 };
  let pick = null;
  if (vertical) pick = nodeLinksNow.filter(l => Math.sign(l.dy) === d && Math.abs(l.dy) > 3).sort((a, b) => d * (b.dy - a.dy) || rank[a.role] - rank[b.role])[0];
  else pick = nodeLinksNow.filter(l => l.side === d).sort((a, b) => rank[a.role] - rank[b.role])[0];
  if (pick) goNode(pick.to);
}

function openLevelPop(key, j, nm, pinEl) {
  if (j === "home") { openNode(key, "home"); return; }
  // a click on the stop that's already up close: play it, or walk in
  if (mapPop && mapPop.focus && mapPop.key === key && mapPop.j === j) { actOnNode(key, j); return; }
  if (mapSel !== key) selectPlace(key);
  mapPop = { key, j, nm: false, pin: pinEl, focus: true };
  mapRules = false;
  mapBriefEl.classList.remove("open");
  mapPopEl.className = "map-pop";
  mapBannerEl.classList.remove("open");
  mapEl.classList.add("focus");
  sfx("click");
  updatePins();
  renderNodeFocus();
  layoutMap();
}

function renderNodeFocus() {
  const { key, j } = mapPop;
  const I = CAMP.islandById[key];
  const st = nodeState(key, j);
  const p = nodeAt(key, j);
  nodeHereEl.style.left = p.x * 2 + "px";
  // the caption hangs just under the stop's pin (side stops' pins stand higher, over their buildings)
  const lift = typeof j === "number" ? (isBossLevel(j) ? 19 : 5) : (NODE_PIN_LIFT[j] || 20) - 12;
  nodeHereEl.style.top = (p.y - lift + 6) * 2 + "px";
  nodeHereEl.style.setProperty("--m", I.colors.accent);
  let title = nodeTitle(key, j), sub = "", line = "", why = "", go = "", tag = "";
  if (typeof j === "number") {
    const def = campLevelDef(key, j);
    const rec = camp.levels[campLevelId(key, j)];
    sub = `${levelKindText(def)} · ${goalText(def.goal)}`;
    if (def.bonus) line = `Challenge: ${bonusText(def.bonus)} (${bonusOnce(def.bonus) && bonusEarned(key, j) ? "earned" : bonusRewardText(key, def.bonus)})`;
    if (!campIslandOpen(key)) why = "Reach this island first";
    else if (st === "locked") why = `Win ${j - 1}. ${campLevelDef(key, j - 1).name} first`;
    go = st === "done" ? "Play again" : "Play";
    if (rec && rec.wins) tag = `Best ${fmtInt(rec.best)}${rec.flawless ? " · flawless" : ""}`;
    const qi = questTrialAt(key, j);
    if (qi >= 0) {
      const Q = questFor(key);
      sub = `Quest trial ${qi + 1} of ${Q.levels.length} · ${goalText(def.goal)}`;
      line = `Twists: ${Q.mods[qi].map(m => (CAMP.rules.challenge.mods.find(x => x.id === m) || { name: m }).name).join(", ")}`;
      go = "Play trial";
    }
  } else {
    const next = CAMP.islands[campIslandIdx(key) + 1];
    if (NPC_KINDS.includes(j)) {
      sub = `${I.npcs[j].name}, ${{ merchant: "the merchant", challenger: "the challenger", banker: "the banker" }[j]}`;
      line = `"${I.npcs[j].line}"`;
      if (st === "locked") why = `Beat the boss at level ${SHOP_AFTER[j]} first`;
      go = "Visit";
    } else {
      sub = next ? "Ride the Coil up" : "The end of the road";
      line = next ? next.blurb : "There's nowhere higher to go. You made it.";
      if (!next) why = "This is the last island";
      else if (st === "locked") why = `Beat the boss at level ${LEVEL_COUNT} first`;
      go = "Cross";
    }
  }
  nodeScrollEl.innerHTML = `<h3 class="ns-title">${typeof j === "number" && isBossLevel(j) ? SKULL_SVG : ""}${escapeAttr(title)}</h3>`;
  nodeScrollEl.title = [I.name, sub, line].filter(Boolean).join("\n");
  nodeScrollEl.classList.add("open");
  const locked = st === "locked";
  nodeHereEl.className = "node-here open" + (typeof j === "number" ? " level" : " side") + (locked ? " locked" : "") + (ISLANDS[key].dir < 0 ? " flip" : "");
  // no button and no rules sign: the stop's own pin is what you click; a caption under it says so
  nodeHereEl.innerHTML = "";
  // the caption hangs off the pin itself, so it's always right under it
  mapPinsEl.querySelectorAll(".pin-hint").forEach(el => el.remove());
  const pinEl = mapPinsEl.querySelector(`[data-key="${nodeKey(key, j)}"]`);
  if (pinEl) pinEl.insertAdjacentHTML("beforeend", why ? `<span class="pin-hint why">${LOCK_SVG} ${escapeAttr(why)}</span>` : `<span class="pin-hint">&#9650; ${go}</span>`);
  if (pinEl) pinEl.title = why || go;
  void tag;
  renderNodeSide();
  // the ways on: a fifth of the screen on the side each stop really lies, split top and bottom
  // when two go the same way. Only a chevron shows; where it goes shows when the mouse is on it.
  nodeLinksNow = nodeLinks(key, j);
  nodeArrows.forEach(a => { a.className = "node-arrow zone"; a._to = null; });
  [-1, 1].forEach(side => {
    const here = nodeLinksNow.filter(l => l.side === side).sort((a, b) => a.dy - b.dy);
    here.forEach((l, k) => {
      const a = nodeArrows[nodeLinksNow.indexOf(l)];
      const d = l.role === "back" ? -1 : 1;
      const L = arrowLabel({ key }, l.to, d, l.role);
      a._to = l.to;
      a.disabled = false;
      a.className = `node-arrow zone ${side < 0 ? "prev" : "next"} open ${L.cls}${l.role === "shop" ? " fork" : ""}`;
      a.dataset.role = l.role;
      a.style.setProperty("--zk", k);
      a.style.setProperty("--zn", here.length);
      a.style.top = "";
      a.innerHTML = `<span class="na-chev" aria-hidden="true">${L.cls === "boss" ? SKULL_SVG : side < 0 ? "&#9664;" : "&#9654;"}</span>` +
        `<span class="na-tip"><span class="na-word">${escapeAttr(L.word)}</span>${L.sub ? `<span class="na-sub">${escapeAttr(L.sub)}</span>` : ""}</span>`;
      a.setAttribute("aria-label", `${L.word}${L.sub ? ": " + L.sub : ""}`);
    });
  });
  setTimeout(() => {
    if (!mapPop || !mapPop.focus) return;
    const pin = mapPinsEl.querySelector(`[data-key="${nodeKey(mapPop.key, mapPop.j)}"]`);
    const b = pin && nodeState(mapPop.key, mapPop.j) !== "locked" ? pin : nodeArrows.find(a => a._to);
    if (b) b.focus({ preventScroll: true });
  }, 60);
}

/* kept for the old callers: the focus has no bubble to place */
function positionPop() { }

/* Coming back to the map from a shop or a level: nothing of the old close-up stays up
   (its scroll would sit right on top of the island's banner) */
function resetNodeFocus() {
  nodeHereEl.className = "node-here";
  mapPinsEl.querySelectorAll(".pin-hint").forEach(el => el.remove());
  nodeSideEl.classList.remove("open");
  closeMapGoal();
  nodeScrollEl.classList.remove("open");
  nodeArrows.forEach(a => { a.className = "node-arrow zone"; a._to = null; });
  nodeLinksNow = [];
  mapEl.classList.remove("focus");
}

function closeLevelPop(quiet = false) {
  if (!mapPop && !mapRules) return false;
  const was = mapPop;
  mapPop = null;
  mapRules = false;
  mapPopEl.className = "map-pop";
  mapBriefEl.classList.remove("open");
  mapNight = false;
  mapEl.classList.remove("night", "focus");
  resetNodeFocus();
  updatePins();
  if (mapSel) { renderBanner(); layoutMap(); }
  if (!quiet && was) {
    const pin = mapPinsEl.querySelector(`[data-key="${nodeKey(was.key, was.j)}"]`);
    if (pin) setKbdFocus(pin);
  }
  return true;
}

/* While a stop is up close, the left and right arrow keys walk the path */
document.addEventListener("keydown", e => {
  if (currentScreen !== "modes" || !mapPop || !mapPop.focus || mapRules || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  const dir = { arrowleft: [-1, false], a: [-1, false], arrowright: [1, false], d: [1, false], arrowup: [-1, true], w: [-1, true], arrowdown: [1, true], s: [1, true] }[k];
  if (dir) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) stepNode(dir[0], dir[1]);
  }
}, true);

/* The stop up close was clicked: a level shows its objective first; the others walk in */
function actOnNode(key, j) {
  if (nodeState(key, j) === "locked") { sfx("bad"); return; }
  if (typeof j === "number") openMapGoal(key, j);
  else openNode(key, j);
}

function playLevel(key, j, trial = -1) {
  if (!campLevelOpen(key, j)) return;
  camp.at = key;
  saveCamp();
  lastPlayed = { key, j, nm: false };
  mapReturnTo = key;
  closeMapGoal();
  campBeginLevel(key, j, trial);
}

/* ----- Quests on the map: the challenger's three trials, ringed and joined by their own trail ----- */
function questFor(key) {
  const C = camp && camp.challenges && camp.challenges[key];
  return C && C.active && !C.claimed && C.levels.length && Date.now() < C.endsAt ? C : null;
}
/* Which trial this level is, if it's the one you play next (-1 if not): the trials go in order */
function questTrialAt(key, n) {
  const C = questFor(key);
  if (!C) return -1;
  const i = C.done.findIndex(d => !d);
  return i >= 0 && C.levels[i] === n ? i : -1;
}
/* Where the quest goes next: the first trial not done yet, or back to the challenger to claim */
function questNextStop(key) {
  const C = questFor(key);
  if (!C) return null;
  const i = C.done.findIndex(d => !d);
  return i >= 0 ? { key, id: C.levels[i] } : { key, id: "challenger" };
}
/* The quest arrow from a stop: the trials go in order. From the challenger (or the trial just
   played) on to the next one, and back to the challenger to claim once they're all done. */
function questNextFrom(key, id) {
  const C = questFor(key);
  if (!C) return null;
  const next = questNextStop(key);
  return next && next.id !== id ? next : null;
}
/* The trail: from the challenger's tent through the trials, arcing over the island's own path.
   Only the legs you've walked (gold) and the one to the next trial (a violet dashed line that
   marches along) are drawn: each new leg draws itself out when you come back to the map. */
const questLegSeen = {};        // island -> { leg, at }: the newest leg, and when it started drawing
function drawQuestTrail(g, key, t, by) {
  const C = questFor(key);
  if (!C) return;
  const stops = ["challenger"].concat(C.levels).map(id => { const p = nodeAt(key, id); return { x: p.x, y: p.y + by - 2 }; });
  const doneN = C.done.findIndex(d => !d) < 0 ? C.done.length : C.done.findIndex(d => !d);
  // all done: the last leg runs back from the final trial to the challenger
  if (doneN >= C.levels.length) stops.push(stops[0]);
  const lastLeg = doneN;
  const seen = questLegSeen[key];
  if (!seen || seen.leg !== lastLeg) questLegSeen[key] = { leg: lastLeg, at: t };
  const grow = Math.min(1, (t - questLegSeen[key].at) / 1.1);
  let run = 0;
  for (let leg = 0; leg < stops.length - 1 && leg <= lastLeg; leg++) {
    const a = stops[leg], b = stops[leg + 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(26, 8 + len * 0.18) * (leg % 2 ? 1 : -1);
    const cx = mx - dy / len * bend, cy = my + dx / len * bend - 6;
    const walked = leg < doneN;
    const n = Math.ceil(len * 1.6);
    const upto = leg === lastLeg ? Math.floor(n * grow) : n;
    for (let i = 0; i <= upto; i++) {
      const f = i / n, u = 1 - f;
      const x = u * u * a.x + 2 * u * f * cx + f * f * b.x, y = u * u * a.y + 2 * u * f * cy + f * f * b.y;
      run++;
      if ((run + Math.floor(t * 12)) % 8 > 4) continue;
      mapRect(g, x - 1, y, 3, 2, "#1a0a2a");
      mapRect(g, x - 1, y - 1, 2, 2, walked ? "#ffd23f" : "#c070ff");
    }
  }
}

/* Fly the map to a stop, up close; `then` runs once the camera has arrived (to walk into a shop) */
function mapFlyTo(key, id, then) {
  const go = () => {
    if (currentScreen !== "modes") return;
    if (mapSel !== key) selectPlace(key);
    const here = mapPop && mapPop.focus && mapPop.key === key && mapPop.j === id;
    if (!here) openLevelPop(key, id, false, mapPinsEl.querySelector(`[data-key="${nodeKey(key, id)}"]`));
    if (then) setTimeout(() => { if (currentScreen === "modes" && mapPop && mapPop.key === key && mapPop.j === id) then(); }, here ? 0 : 700);
  };
  if (currentScreen !== "modes") { mapReturnTo = key; openScreen("modes"); setTimeout(go, 120); }
  else go();
}

/* ----- The objective, on a card over the map, before a level begins ----- */
const mapGoalEl = document.createElement("div");
mapGoalEl.id = "map-goal";
mapGoalEl.className = "map-goal";
mapGoalEl.setAttribute("role", "dialog");
mapGoalEl.setAttribute("aria-modal", "true");
mapEl.appendChild(mapGoalEl);
let mapGoalFor = null;
function openMapGoal(key, j) {
  if (!campLevelOpen(key, j)) return;
  const I = CAMP.islandById[key], def = campLevelDef(key, j);
  const rec = camp.levels[campLevelId(key, j)];
  const first = !campWon(key, j);
  mapGoalFor = { key, j };
  const bonus = def.bonus ? `<div class="mg-row"><span class="mg-k">Challenge</span><span>${escapeAttr(bonusText(def.bonus))} <em>(${escapeAttr(bonusOnce(def.bonus) && bonusEarned(key, j) ? "earned" : bonusRewardText(key, def.bonus))})</em></span></div>` : "";
  const qi = questTrialAt(key, j), Q = questFor(key);
  const modOf = m => CAMP.rules.challenge.mods.find(x => x.id === m) || { name: m, text: "" };
  // a boss: how to hurt it, and any spell it shrugs off
  const bossRes = def.goal.type === "boss" && I.boss.resist && I.boss.resist.length ? I.boss.resist.map(id => (campItemDef(id) || { name: id }).name).join(", ") : "";
  const bossTip = def.goal.type === "boss" ? `<div class="mg-row"><span class="mg-k">How</span><span>Let its head crash into your body; don't run into it yourself.${def.goal.fight > 1 ? " Bite it while it's worn out." : ""} Swords, fireballs and force fields hurt it too.</span></div>` +
    (bossRes ? `<div class="mg-row"><span class="mg-k">Shrugs off</span><span>${escapeAttr(bossRes)}</span></div>` : "") : "";
  const quest = qi >= 0 ? `<div class="mg-quest"><p class="mg-label">Quest trial ${qi + 1} of ${Q.levels.length} · ${escapeAttr(I.npcs.challenger.name)}</p>` +
    Q.mods[qi].map(m => `<p class="mg-twist"><b>${escapeAttr(modOf(m).name)}</b> ${escapeAttr(modOf(m).text)}</p>`).join("") + `</div>` : "";
  mapGoalEl.innerHTML = `<div class="mg-card">
      <p class="mg-kicker">${escapeAttr(I.name)} · level ${j} · ${escapeAttr(levelKindText(def))}</p>
      <h3 class="mg-title">${isBossLevel(j) ? SKULL_SVG : ""}${escapeAttr(def.name)}</h3>
      <p class="mg-label">Objective</p>
      <p class="mg-goal">${escapeAttr(goalText(def.goal))}</p>
      <p class="mg-text">${escapeAttr(def.text || "")}</p>
      ${quest}${bossTip}${bonus}
      <div class="mg-row"><span class="mg-k">Reward</span><span>${coinHtml(key)} ${fmtInt(campRewardPreview(key, j, first))}${first ? " (first win)" : ""}, plus your points</span></div>
      ${rec && rec.wins ? `<div class="mg-row"><span class="mg-k">Best</span><span>${fmtInt(rec.best)}${rec.flawless ? " · flawless" : ""}</span></div>` : ""}
      <div class="mg-acts"><button class="btn" data-mg="back">Back</button>${qi >= 0 ? `<button class="btn btn-small" data-mg="plain">Normal run</button><button class="btn btn-purple" data-mg="go">Start trial</button>` : `<button class="btn btn-primary" data-mg="go">Start</button>`}</div>
    </div>`;
  mapGoalEl.classList.add("open");
  mapGoalEl.classList.toggle("quest", qi >= 0);
  sfx("tab");
  mapGoalEl.querySelector('[data-mg="go"]').addEventListener("click", e => { e.stopPropagation(); playLevel(key, j, qi); });
  const plain = mapGoalEl.querySelector('[data-mg="plain"]');
  if (plain) plain.addEventListener("click", e => { e.stopPropagation(); playLevel(key, j); });
  mapGoalEl.querySelector('[data-mg="back"]').addEventListener("click", e => { e.stopPropagation(); closeMapGoal(); });
  mapGoalEl.onclick = e => { if (e.target === mapGoalEl) closeMapGoal(); };
  setTimeout(() => { const b = mapGoalEl.querySelector('[data-mg="go"]'); if (b) b.focus({ preventScroll: true }); }, 40);
}
function closeMapGoal() {
  if (!mapGoalFor) return false;
  mapGoalFor = null;
  mapGoalEl.classList.remove("open");
  mapGoalEl.innerHTML = "";
  return true;
}
// Esc (or Back) closes the card before anything else on the map
(() => {
  const back = goBack;
  window.goBack = function () {
    if (currentScreen === "modes" && closeMapGoal()) return;
    return back.apply(this, arguments);
  };
})();

/* ----- At the side of a close-up: how your last run went (the stop's record is on its objective card) ----- */
const nodeSideEl = document.createElement("div");
nodeSideEl.id = "node-side";
nodeSideEl.className = "node-side plate";
nodeSideEl.setAttribute("aria-live", "polite");
mapEl.appendChild(nodeSideEl);
let campLastReport = null;      // { won, title, isl, n, name, score, best, lines, notes, line }
function renderNodeSide() {
  if (!mapPop || !mapPop.focus) { nodeSideEl.classList.remove("open"); return; }
  let html = "";
  const R = campLastReport;
  if (R) {
    html += `<div class="nsd-run ${R.won ? "won" : "lost"}"><button class="nsd-x" data-nsd="x" aria-label="Dismiss">&times;</button>
      <p class="nsd-kick">Last run · ${escapeAttr(CAMP.islandById[R.isl].name)} ${R.n}. ${escapeAttr(R.name)}</p>
      <p class="nsd-title">${escapeAttr(R.title)}</p>
      <p class="nsd-score">${fmtInt(R.score)} points${R.best ? ' <span class="nsd-best">new best!</span>' : ""}</p>
      ${R.lines.map(l => `<p class="nsd-line">${l}</p>`).join("")}${R.notes.map(l => `<p class="nsd-line nsd-new">${escapeAttr(l)}</p>`).join("")}
      ${R.line ? `<p class="nsd-line nsd-cause">${escapeAttr(R.line)}</p>` : ""}</div>`;
  }
  nodeSideEl.innerHTML = html;
  nodeSideEl.classList.toggle("open", !!html);
  const x = nodeSideEl.querySelector('[data-nsd="x"]');
  if (x) x.addEventListener("click", e => { e.stopPropagation(); campLastReport = null; renderNodeSide(); });
}

/* After a level: straight back to the map, up close on the next stop (its shop first, after a
   boss), with the run's numbers at the side. A loss comes back to the same level. */
function campBackToMap(report, target) {
  campLastReport = report;
  mapReturnTo = target.key;
  lastPlayed = { key: report.isl, j: report.n, nm: false };
  openScreen("modes");
  setTimeout(() => {
    if (currentScreen !== "modes") return;
    if (mapSel !== target.key) selectPlace(target.key);
    if (NPC_KINDS.includes(target.id) && nodeState(target.key, target.id) !== "locked") { mapFlyTo(target.key, target.id, () => openNode(target.key, target.id)); return; }
    openLevelPop(target.key, target.id, false, mapPinsEl.querySelector(`[data-key="${nodeKey(target.key, target.id)}"]`));
  }, 90);
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
  const res = def.goal.type === "boss" ? (CAMP.islandById[key].boss.resist || []) : [];
  if (res.length) out.push(["Shrugs off", escapeAttr(res.map(id => (campItemDef(id) || { name: id }).name).join(", "))]);
  if (sp.length) out.push(["Watch for", escapeAttr(sp.join(", "))]);
  if (def.bonus) out.push(["Challenge", `${escapeAttr(bonusText(def.bonus))} (${bonusOnce(def.bonus) && bonusEarned(key, j) ? "earned" : escapeAttr(bonusRewardText(key, def.bonus))})`]);
  const first = !campWon(key, j);
  out.push(["Reward", `${coinHtml(key)} ${fmtInt(campRewardPreview(key, j, first))} ${escapeAttr(campCurrency(key).plural)}${first ? " (first win)" : ""}, plus 1 for every ${fmtInt(CAMP.rules.rewards.pointsPerCoin || 50)} points, win or lose`]);
  return out;
}

/* ----- Clicks on the map ----- */
mapBriefEl.addEventListener("click", e => e.stopPropagation());
mapPopEl.addEventListener("click", e => e.stopPropagation());
mapBannerEl.addEventListener("click", e => e.stopPropagation());
nodeHereEl.addEventListener("click", e => e.stopPropagation());
nodeScrollEl.addEventListener("click", e => e.stopPropagation());
document.getElementById("map-out").addEventListener("click", e => { e.stopPropagation(); closePlace(); });
mapEl.addEventListener("click", e => {
  if (!e.target.isConnected) return;
  if (closeLevelPop()) return;
  if (mapSel) closePlace();
});
if (window.ResizeObserver) new ResizeObserver(() => { if (currentScreen === "modes") layoutMap(); }).observe(mapEl);
else window.addEventListener("resize", () => { if (currentScreen === "modes") layoutMap(); });

function updateDock() { /* the old Commons' landmarks are gone: home base is on every island */ }
