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
  up: [140, -10], 1: [104, 17], 2: [66, 17], 3: [28, 17], 4: [-10, 17], 5: [-48, 17], shop: [-92, 22], roots: [-134, 12],
  6: [-74, -4], 7: [-36, -4], 8: [2, -4], 9: [40, -4], 10: [78, -4], 11: [-20, -24]
};
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

/* An island's back side, painted once (again when its progress changes). Origin: (C.ox, C.oy) = its middle. */
function deepBackArt(key) {
  const open = typeof nmTunnelOpen === "function" && camp && camp.nm && nmTunnelOpen(key);
  const tag = !open ? "sealed" : DEEP_IDS.map(id => (typeof id !== "number" ? "" : nmLevelWon(key, id) ? "w" : nmTunLevelOpen(key, id) ? "o" : "-")).join("") + (nmMawSlain(key) ? "S" : "") + (nmShopOpen(key) ? "s" : "");
  const C = deepCache[key] || (deepCache[key] = {});
  if (C.art && C.tag === tag) return C;
  const I = ISLANDS[key], d = I.dir, seed = I.n * 13 + 5;
  const art = islandArt(key), src = texCanvas(`map:${key}:under`), form = isleForm(key);
  const W = src.width, H = src.height;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const ox = art.ox, oy = art.oy;
  // the island's rock and ground (the world mirrors it as it's seen from behind); its grass becomes the back face below
  g.drawImage(src, 0, 0);
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const T = (ISLE_THEME[key] || {}).rock || [["#4a3a30", "#3a2c24"], ["#3a2c24", "#2a2018"], ["#2a2018", "#1a1410"]];
  // the face: where the grass is on the front, now the island's back, raw stone (the world mirrors it)
  const local = (f, dy) => [Math.round(ox + d * f), Math.round(oy + dy)];
  const faceSpan = lx => form.top[lx - ox + form.reach] || null;
  const faceAt = (lx, ly) => { const s = faceSpan(lx); return s && ly - oy > s[0] && ly - oy < s[1] ? s : null; };
  for (let lx = ox - form.reach; lx <= ox + form.reach; lx++) {
    const s = faceSpan(lx);
    if (!s) continue;
    for (let ly = Math.ceil(oy + s[0]); ly <= Math.floor(oy + s[1]); ly++) {
      const edge = Math.min(ly - (oy + s[0]), oy + s[1] - ly);
      const band = (ly - oy - s[0]) / Math.max(1, s[1] - s[0]);
      const [c0, c1] = T[band < 0.5 ? 1 : 0];
      let col = ((lx + ly) & 1) && mapHash(lx, ly, seed) > 0.5 ? c1 : c0;
      if (edge < 1.5) col = shadeHex(c0, ly - oy > 0 ? 0.18 : -0.3);
      else if (mapHash(lx, ly, seed + 9) > 0.97) col = shadeHex(c0, -0.25);
      if (!open) col = shadeHex(col, -0.35);
      px(lx, ly, col);
    }
  }
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
    // the tunnel between the stops: dug out, lit where you've won
    const spot = id => local(DEEP_SPOTS[id][0], DEEP_SPOTS[id][1]);
    const leg = (a, b, lit) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(a[0] + (b[0] - a[0]) * i / n), y = Math.round(a[1] + (b[1] - a[1]) * i / n + Math.sin(i * 0.4 + n) * 0.8);
        if (!lit && i % 3) continue;
        px(x - 1, y, lit ? "#1a0a0e" : "#2a1a1e"); px(x, y, lit ? "#1a0a0e" : "#2a1a1e"); px(x + 1, y, lit ? "#1a0a0e" : "#2a1a1e");
        if (lit) px(x, y + 1, "#3a2028");
      }
    };
    leg(spot("up"), spot(1), true);
    for (let k = 1; k < 11; k++) leg(spot(k), spot(k + 1), nmLevelWon(key, k));
    leg(spot(5), spot("shop"), nmShopOpen(key));
    leg(spot("shop"), spot("roots"), true);
    // the roots of the Great Tree, poking through all over
    for (let i = 0; i < 26; i++) {
      const f = -140 + mapHash(i, 4, seed) * 280, dy = -20 + mapHash(i, 5, seed) * 42;
      let [x, y] = local(f, dy);
      if (!faceAt(x, y)) continue;
      const len = 3 + Math.floor(mapHash(i, 6, seed) * 6);
      for (let k = 0; k < len; k++) {
        if (!faceAt(x, y)) break;
        px(x, y, k % 2 ? "#6a4a2a" : "#4a3018");
        x += mapHash(i, k, seed) > 0.5 ? 1 : -1; y += k % 2;
      }
    }
    // a knot of them at the roots' stop
    const [rx, ry] = spot("roots");
    for (let k = -5; k <= 5; k++) { px(rx + k, ry + Math.round(Math.sin(k) * 2), "#6a4a2a"); px(rx + Math.round(Math.cos(k) * 3), ry + k / 2, "#4a3018"); }
    // the hole you came through, from below
    const [hx, hy] = spot("up");
    for (let dy = -3; dy <= 3; dy++) for (let dx = -8; dx <= 8; dx++) {
      const e = (dx * dx) / 64 + (dy * dy) / 9;
      if (e <= 1.1) px(hx + dx, hy + dy, e > 0.7 ? "#6a4a2a" : "#f6e8c8");      // daylight through it
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
  // the Maw's eye, open in its trench
  if (nmTunnelOpen(key) && !nmMawSlain(key) && (t % 5) > 0.25) {
    const [mf, mdy] = DEEP_SPOTS[11];
    mapRect(g, I.x + I.dir * (mf - 30) - 1, I.y + mdy - 3 + by, 3, 2, `rgba(255, 58, 58, ${0.7 + 0.3 * Math.sin(t * 3)})`);
  }
}

/* The hole in the grass, right way up (it opens as it's dug, with a little dust) */
function drawDeepHole(g, key, t, by) {
  if (typeof nmTunnelOpen !== "function" || !camp || !camp.nm || !nmTunnelOpen(key) || placeFogged(key)) return;
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
function enterUnder(key) {
  if (typeof nmTunnelOpen !== "function" || !nmTunnelOpen(key)) return;
  if (mapSel !== key) selectPlace(key);
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

/* The dig: the moment a tunnel opens, the map flies to its island, the ground gives way, and it all turns over */
function deepDig(key) {
  if (currentScreen !== "modes") return;
  deepReveal[key] = performance.now() / 1000;
  if (deepCache[key]) deepCache[key].art = null;
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
