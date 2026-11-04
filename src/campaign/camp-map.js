/* =========================================================
   src/campaign/camp-map.js
   The world: five floating islands climbing from the sunrise to the
   stars, strung together by the Coil. Everything happens on this one
   screen: your snake travels the paths and rides the Coil from island to
   island, and each island's home tree grows here as you upgrade it.

   Every island uses the same layout:
                                 (bridge islet, where the Coil leaves)
       challenger islet   11 12 13 14 15 - bank islet
                          10  9  8  7  6
                           1  2  3  4  5 - merchant islet
                         (home islet: the tree, where the Coil arrives)

   The world is drawn in chunky "map pixels" on a small canvas, then
   scaled up without smoothing, so it keeps the pixel-art look at any zoom.
   ========================================================= */
"use strict";

const CM_W = 900, CM_H = 1640;                     // the world, in map pixels
const CM_CENTERS = [[300, 1380], [600, 1110], [300, 840], [600, 570], [450, 300]];
/* The coastline: soft blobs melted into one landmass (metaballs), then a little ragged noise.
   [x, y, half-width, half-height] around the island's middle. */
const CM_LOBES = [
  [0, 0, 158, 60], [-4, 78, 62, 28], [190, 34, 56, 24], [-196, -6, 56, 24], [182, -50, 52, 22],
  [10, -88, 50, 20], [-126, -58, 54, 26], [-126, 60, 50, 24], [128, 68, 48, 22]
];
const CM_FEATURE = { landmark: [-126, -52], pool: [-126, 60], grove: [128, 66] };
const CM_NODES = {
  home: [-4, 80],
  1: [-100, 36], 2: [-50, 38], 3: [0, 38], 4: [50, 38], 5: [100, 36],
  6: [108, 2], 7: [54, 3], 8: [0, 4], 9: [-54, 3], 10: [-108, 2],
  11: [-100, -32], 12: [-50, -34], 13: [0, -34], 14: [50, -34], 15: [100, -32],
  merchant: [194, 34], challenger: [-200, -6], banker: [186, -52], bridge: [12, -92]
};
const CM_EDGES = [["home", 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [11, 12], [12, 13], [13, 14], [14, 15], [5, "merchant"], [10, "challenger"], [15, "banker"], [15, "bridge"]];
/* Bends in the longer paths, so they wind across the land */
const CM_WAY = { "home-1": [[-44, 66], [-84, 50]], "15-bridge": [[76, -54], [40, -76]], "5-merchant": [[146, 42]], "10-challenger": [[-154, -2]], "15-banker": [[144, -46]], "5-6": [[112, 18]], "10-11": [[-112, -16]] };

const cmKey = (isl, node) => isl + ":" + node;
const cmParse = k => { const [isl, n] = k.split(":"); return { isl, node: isNaN(+n) ? n : +n }; };
const cmBob = (i, t) => Math.round(Math.sin(t * 0.7 + i * 1.9) * 1);
function cmPos(isl, node, t = cmT) {
  const i = campIslandIdx(isl), c = CM_CENTERS[i], p = CM_NODES[node];
  return { x: c[0] + p[0], y: c[1] + p[1] + cmBob(i, t) };
}
function cmHash(x, y, s = 7) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function cmRect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

let cmCanvas = null, cmG = null;
let cmWorld = null, cmWG = null;                  // the world canvas, in map pixels
let cmSky = null;
let cmCam = { x: CM_CENTERS[0][0], y: CM_CENTERS[0][1], z: 4 };
let cmSel = null;            // { isl, node } shown in the card
let cmHover = null;
let cmDrag = null;
let cmGlide = null;
let cmRaf = 0;
let cmT = 0;
let cmHome = null;           // the island whose home is open, close up
const cmArtCache = new Map();

/* ----- Opening ----- */
function openCampMap(focus) {
  if (!camp) loadCamp();
  applyCampCosmetics();
  openScreen("camp");
  cmLayout();
  const isl = focus && focus.isl ? focus.isl : camp.at;
  if (!cmTraveler.at || !campIslandOpen(cmParse(cmTraveler.at).isl)) cmTraveler.at = cmKey(isl, campNextLevel(isl) || 15);
  const node = focus && focus.node !== undefined ? focus.node : cmParse(cmTraveler.at).node;
  if (focus && focus.node !== undefined && campIslandOpen(isl)) { cmTraveler.at = cmKey(isl, node); cmTraveler.path = null; }
  const p = cmPos(isl, node);
  const c = CM_CENTERS[campIslandIdx(isl)];
  cmCam = { x: (c[0] * 2 + p.x) / 3, y: (c[1] * 2 + p.y) / 3 + 6, z: cmDefaultZoom() };
  cmClamp();
  cmSel = null;
  cmHome = null;
  cmCard();
  cmTopbar();
  cmSpots();
  cancelAnimationFrame(cmRaf);
  cmRaf = requestAnimationFrame(cmLoop);
  if (!camp.named) setTimeout(campAskName, 200);
  if (campLoadNote) { const t = campLoadNote; campLoadNote = ""; setTimeout(() => showToast(t), 400); }
}

const cmDefaultZoom = () => Math.max(1, Math.min(8, Math.min(window.innerWidth / 560, window.innerHeight / 320)));

function cmLayout() {
  if (!cmCanvas) {
    cmCanvas = document.getElementById("cm-canvas");
    cmG = cmCanvas.getContext("2d");
    cmWorld = document.createElement("canvas");
    cmWorld.width = CM_W; cmWorld.height = CM_H;
    cmWG = cmWorld.getContext("2d");
    cmSky = document.createElement("canvas");
    cmBindInput();
    window.addEventListener("resize", () => { if (currentScreen === "camp") { cmLayout(); cmClamp(); } });
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cmCanvas.clientWidth || window.innerWidth, h = cmCanvas.clientHeight || window.innerHeight;
  cmCanvas.width = Math.round(w * dpr);
  cmCanvas.height = Math.round(h * dpr);
  cmCanvas.dataset.dpr = dpr;
}

function cmClamp() {
  const w = cmCanvas ? cmCanvas.clientWidth : window.innerWidth, h = cmCanvas ? cmCanvas.clientHeight : window.innerHeight;
  const minZ = Math.max(w / CM_W, h / CM_H) * 1.01;
  cmCam.z = Math.max(minZ, Math.min(26, cmCam.z));
  const hw = w / 2 / cmCam.z, hh = h / 2 / cmCam.z;
  cmCam.x = Math.max(hw, Math.min(CM_W - hw, cmCam.x));
  cmCam.y = Math.max(hh, Math.min(CM_H - hh, cmCam.y));
}

const cmToScreen = (x, y) => [(x - cmCam.x) * cmCam.z + cmCanvas.clientWidth / 2, (y - cmCam.y) * cmCam.z + cmCanvas.clientHeight / 2];
const cmToWorld = (sx, sy) => [(sx - cmCanvas.clientWidth / 2) / cmCam.z + cmCam.x, (sy - cmCanvas.clientHeight / 2) / cmCam.z + cmCam.y];

/* ----- Input: drag anywhere, scroll or pinch to zoom, click a spot ----- */
function cmBindInput() {
  const el = cmCanvas;
  const pointers = new Map();
  el.addEventListener("pointerdown", e => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cmGlide = null;
    if (pointers.size === 1) cmDrag = { x: e.clientX, y: e.clientY, cx: cmCam.x, cy: cmCam.y, moved: 0, t: performance.now(), vx: 0, vy: 0, lx: e.clientX, ly: e.clientY };
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; cmDrag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), z: cmCam.z, moved: 99 }; }
  });
  el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect();
    if (!pointers.has(e.pointerId)) { cmHover = cmHit(e.clientX - r.left, e.clientY - r.top); el.style.cursor = cmHover ? "pointer" : "grab"; return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!cmDrag) return;
    if (cmDrag.pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; cmCam.z = cmDrag.z * Math.hypot(a.x - b.x, a.y - b.y) / cmDrag.pinch; cmClamp(); return; }
    const dx = e.clientX - cmDrag.x, dy = e.clientY - cmDrag.y;
    cmDrag.moved = Math.max(cmDrag.moved, Math.hypot(dx, dy));
    const now = performance.now(), dt = Math.max(1, now - cmDrag.t);
    cmDrag.vx = (e.clientX - cmDrag.lx) / dt; cmDrag.vy = (e.clientY - cmDrag.ly) / dt;
    cmDrag.lx = e.clientX; cmDrag.ly = e.clientY; cmDrag.t = now;
    cmCam.x = cmDrag.cx - dx / cmCam.z;
    cmCam.y = cmDrag.cy - dy / cmCam.z;
    cmClamp();
    el.style.cursor = "grabbing";
  });
  const up = e => {
    pointers.delete(e.pointerId);
    if (!cmDrag) return;
    const r = el.getBoundingClientRect();
    if (cmDrag.moved < 6 && !cmDrag.pinch) cmSelect(cmHit(e.clientX - r.left, e.clientY - r.top));
    else if (!cmDrag.pinch && performance.now() - cmDrag.t < 80) cmGlide = { vx: cmDrag.vx, vy: cmDrag.vy };
    cmDrag = null;
    el.style.cursor = "grab";
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", e => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const [wx, wy] = cmToWorld(sx, sy);
    cmCam.z *= Math.exp(-e.deltaY * 0.0015);
    cmClamp();
    const [nx, ny] = cmToWorld(sx, sy);
    cmCam.x += wx - nx; cmCam.y += wy - ny;
    cmClamp();
  }, { passive: false });
  el.addEventListener("dblclick", e => {
    const r = el.getBoundingClientRect();
    const [wx, wy] = cmToWorld(e.clientX - r.left, e.clientY - r.top);
    cmFly(wx, wy, cmCam.z > cmDefaultZoom() * 1.3 ? cmDefaultZoom() * 0.6 : cmDefaultZoom() * 1.8);
  });
}

function cmFly(x, y, z, ms = 650) {
  cmGlide = { to: { x, y, z: z || cmCam.z }, from: { ...cmCam }, t0: performance.now(), ms };
}

function cmHit(sx, sy) {
  let best = null, bestD = 1e9;
  CAMP.islands.forEach(isl => {
    Object.keys(CM_NODES).forEach(k => {
      const node = isNaN(+k) ? k : +k;
      const p = cmPos(isl.id, node);
      const big = node === "home" || typeof node === "string";
      const [x, y] = cmToScreen(p.x, p.y - (big ? 10 : 3));
      const r = Math.max(14, (big ? 14 : 8) * cmCam.z);
      const d = Math.hypot(sx - x, sy - y);
      if (d < r && d < bestD) { best = { isl: isl.id, node }; bestD = d; }
    });
  });
  return best;
}

/* ----- Node states ----- */
function cmNodeState(isl, node) {
  if (!campIslandOpen(isl)) return "fog";
  if (node === "home") return "open";
  if (typeof node === "number") return campWon(isl, node) ? "won" : campLevelOpen(isl, node) ? "next" : "locked";
  return campShopOpen(isl, node) ? "open" : "locked";
}

function cmSelect(hit) {
  if (!hit) { cmSel = null; cmHome = null; cmCard(); cmSpots(); return; }
  const st = cmNodeState(hit.isl, hit.node);
  if (st === "fog") { showToast(`${CAMP.islandById[hit.isl].name} is still in the clouds. Beat the last boss before it to wake the Coil.`); sfx("bad"); return; }
  cmSel = hit;
  camp.at = hit.isl;
  sfx("tab");
  // your snake goes there, as far as the open path allows
  if (st !== "locked") cmTravel(hit.isl, hit.node);
  if (hit.node === "home") {
    // across the sky, the close-up waits until the Coil has carried you there
    if (cmTraveler.crossing) { cmHome = null; cmTraveler.onArrive = () => cmFocusHome(hit.isl); }
    else cmFocusHome(hit.isl);
  }
  else {
    cmHome = null;
    const p = cmPos(hit.isl, hit.node);
    if (Math.abs(p.x - cmCam.x) * cmCam.z > cmCanvas.clientWidth * 0.3 || Math.abs(p.y - cmCam.y) * cmCam.z > cmCanvas.clientHeight * 0.3) cmFly(p.x + 30 / Math.max(1, cmCam.z / 4), p.y, cmCam.z);
  }
  cmCard();
  cmTopbar();
  cmSpots();
}

/* ----- Your snake on the map ----- */
const cmTraveler = { at: null, path: null, d: 0, trail: [] };

/* The points along one step of the journey: a winding path on the ground, or a ride on the Coil */
function cmLocalPath(isl, a, b) {
  const way = CM_WAY[`${a}-${b}`] || (CM_WAY[`${b}-${a}`] ? CM_WAY[`${b}-${a}`].slice().reverse() : []);
  const i = campIslandIdx(isl), c = CM_CENTERS[i];
  const pts = [CM_NODES[a]].concat(way, [CM_NODES[b]]).map(([x, y]) => ({ x: c[0] + x, y: c[1] + y }));
  const out = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const p = pts[s], q = pts[s + 1];
    const n = Math.max(3, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 2));
    for (let k = s ? 1 : 0; k <= n; k++) {
      const f = k / n;
      out.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f - Math.sin(f * Math.PI) * 2 });
    }
  }
  return out;
}

function cmEdgePoints(a, b) {
  const A = cmParse(a), B = cmParse(b);
  if (A.isl !== B.isl) {
    // up from the bridge gate, along the Coil, and onto the next island's shore
    const lo = campIslandIdx(A.isl) < campIslandIdx(B.isl) ? A : B, hi = lo === A ? B : A;
    const g = cmPos(lo.isl, "bridge", 0), h = cmPos(hi.isl, "home", 0);
    const pts = [{ x: g.x, y: g.y }].concat(coilSamples(campIslandIdx(lo.isl)).map(p => ({ x: p.x, y: p.y })), [{ x: h.x, y: h.y }]);
    return lo === A ? pts : pts.reverse();
  }
  return cmLocalPath(A.isl, A.node, B.node);
}

function cmNeighbors(k) {
  const { isl, node } = cmParse(k);
  const out = [];
  CM_EDGES.forEach(([a, b]) => {
    if (a === node) out.push(cmKey(isl, b));
    if (b === node) out.push(cmKey(isl, a));
  });
  const i = campIslandIdx(isl);
  if (node === "bridge" && CAMP.islands[i + 1] && campIslandOpen(CAMP.islands[i + 1].id)) out.push(cmKey(CAMP.islands[i + 1].id, "home"));
  if (node === "home" && i > 0) out.push(cmKey(CAMP.islands[i - 1].id, "bridge"));
  // only along open ground
  return out.filter(n => { const p = cmParse(n); const s = cmNodeState(p.isl, p.node); return s !== "fog" && s !== "locked"; });
}

function cmTravel(isl, node) {
  const goal = cmKey(isl, node);
  const from = cmTraveler.at;
  if (!from || from === goal) { cmTraveler.at = goal; return; }
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const k = q.shift();
    if (k === goal) break;
    cmNeighbors(k).forEach(n => { if (!prev.has(n)) { prev.set(n, k); q.push(n); } });
  }
  if (!prev.has(goal)) { cmTraveler.at = goal; cmTraveler.path = null; cmTraveler.trail = []; return; }
  const keys = [];
  for (let k = goal; k; k = prev.get(k)) keys.unshift(k);
  let pts = [];
  for (let j = 0; j < keys.length - 1; j++) pts = pts.concat(cmEdgePoints(keys[j], keys[j + 1]));
  cmTraveler.path = pts;
  cmTraveler.d = 0;
  cmTraveler.at = goal;
  cmTraveler.crossing = keys.some(k => cmParse(k).isl !== cmParse(keys[0]).isl);
  cmTraveler.onArrive = null;
}

function cmTravelerPos() {
  const T = cmTraveler;
  if (T.path && T.path.length) return T.path[Math.min(T.path.length - 1, Math.floor(T.d))];
  const { isl, node } = cmParse(T.at);
  const p = cmPos(isl, node);
  return node === "home" ? { x: p.x + 9, y: p.y + 2 } : { x: p.x + 7, y: p.y + 2 };
}

function cmTickTraveler(dt) {
  const T = cmTraveler;
  if (!T.at) return;
  if (T.path) {
    T.d += dt * (T.crossing ? 0.11 : 0.06);         // points per ms; the Coil is a fast ride
    if (T.crossing) { const p = cmTravelerPos(); cmCam.x += (p.x - cmCam.x) * 0.08; cmCam.y += (p.y - cmCam.y) * 0.08; cmClamp(); }
    if (T.d >= T.path.length - 1) {
      T.path = null; T.crossing = false;
      const done = T.onArrive; T.onArrive = null;
      if (done) done();
    }
  }
  const p = cmTravelerPos();
  const last = T.trail[0];
  if (!last || Math.hypot(last.x - p.x, last.y - p.y) >= 1.6) { T.trail.unshift({ x: p.x, y: p.y }); if (T.trail.length > 12) T.trail.pop(); }
}

function cmDrawTraveler(g, t) {
  const T = cmTraveler;
  if (!T.at) return;
  const skin = currentSkin();
  const moving = !!T.path;
  // the body follows the trail it left; waiting, it lies in a little S beside the spot
  const pts = T.trail.slice();
  while (pts.length < 11) {
    const last = pts[pts.length - 1] || cmTravelerPos();
    const k = pts.length;
    pts.push({ x: last.x - 1, y: last.y + (Math.floor(k / 3) % 2 ? 0.5 : -0.5) });
  }
  for (let i = 5; i >= 0; i--) {
    const p = pts[i * 2];
    const wig = moving ? 0 : Math.round(Math.sin(t * 3 - i * 0.9) * 0.6);
    cmRect(g, p.x - 1, p.y + 1 + wig, 2, 1, "rgba(0,0,0,0.3)");
    cmRect(g, p.x - 1, p.y - 1 + wig, 2, 2, skin.colors[skin.order[i % skin.order.length]]);
  }
  const h = pts[0];
  cmRect(g, h.x, h.y - 1, 1, 1, "#ffffff");
  if (!moving && (t % 3) < 0.25) cmRect(g, h.x + 1, h.y, 2, 1, "#ff3b5a");
}

/* ----- The details card ----- */
function cmCard() {
  const el = document.getElementById("cm-card");
  if (!cmSel) { el.classList.remove("open"); el.innerHTML = ""; return; }
  const { isl, node } = cmSel;
  const I = CAMP.islandById[isl];
  const st = cmNodeState(isl, node);
  let html = "";
  if (node === "home") {
    const ups = I.tree.upgrades, got = ups.reduce((a, u) => a + upTier(u.id), 0), max = ups.reduce((a, u) => a + u.values.length - 1, 0);
    html = `<div class="cm-kind">Home</div><h3>${I.tree.name}</h3>
      <p>The tree grows as you buy its upgrades (${got} of ${max} so far). Things you collect gather around it: click them.</p>
      <div class="cm-actions"><button class="btn btn-primary" data-cm="tree" data-autofocus>Upgrade tree</button>${camp.satchel.length ? `<button class="btn" data-cm="satchel">Satchel</button>` : ""}</div>`;
  } else if (typeof node === "number") {
    const d = campLevelDef(isl, node);
    const rec = camp.levels[campLevelId(isl, node)];
    const first = !campWon(isl, node);
    const R = CAMP.rules.rewards;
    const base = (R.winBase + R.perLevel * node) * (d.kind === "boss" ? R.bossMult : 1) * (1 + upPct("bounty")) * (1 + upPct("mastery"));
    const pay = Math.round(first ? base : base * R.replayShare);
    const kinds = { static: "Level", enemy: "Level · Enemies", dynamic: "Level · Shifting", boss: "Boss fight" };
    const haz = Object.keys(d.spawns || {}).map(k => (ENTITY_TYPES[k] ? ENTITY_TYPES[k].label : (ITEM_INFO[k] || { label: k }).label)).concat(d.hunter ? ["Rival snake"] : []).concat(d.dark ? ["Darkness"] : []);
    html = `<div class="cm-kind">${kinds[d.kind]} ${node}</div><h3>${d.name}</h3>
      <p>${d.text}</p>
      <div class="cm-goal"><span>Goal</span><strong>${goalText(d.goal)}</strong></div>
      ${haz.length ? `<div class="cm-haz">${haz.map(h => `<span>${h}</span>`).join("")}</div>` : ""}
      <div class="cm-pay">${coinIconHtml(isl)} ${first ? "First win" : "Replay"}: <strong>${campMoney(isl, pay)}</strong>${rec && rec.best ? `<span class="cm-best">Best ${fmtInt(rec.best)}</span>` : ""}${rec && rec.flawless ? `<span class="cm-best">Flawless</span>` : ""}</div>
      ${campLoadoutStrip()}
      <div class="cm-actions">${st === "locked" ? `<span class="cm-lock">Win level ${node - 1} first</span>` : `<button class="btn btn-primary" data-cm="play" data-autofocus>${first ? "Play" : "Play again"}</button>`}${camp.satchel.length ? `<button class="btn" data-cm="satchel">Satchel</button>` : ""}</div>`;
  } else if (node === "bridge") {
    const next = CAMP.islands[campIslandIdx(isl) + 1];
    html = `<div class="cm-kind">The Coil</div><h3>${next ? "To " + next.name : "The Coil's Head"}</h3>
      <p>${next ? next.blurb : "The end of the road. The Coil rests its head here, and so may you."}</p>
      <div class="cm-actions">${st === "locked" ? `<span class="cm-lock">Beat level ${SHOP_AFTER.bridge} first</span>` : next ? `<button class="btn btn-primary" data-cm="cross" data-autofocus>Ride the Coil</button>` : ""}</div>`;
  } else {
    const who = I.npcs[node];
    html = `<div class="cm-kind">${{ merchant: "Merchant", challenger: "Challenger", banker: "Bank" }[node]}</div><h3>${who.shop}</h3>
      <canvas class="cm-portrait" width="96" height="96"></canvas>
      <p class="cm-who"><strong>${who.name}</strong> “${who.line}”</p>
      <div class="cm-actions">${st === "locked" ? `<span class="cm-lock">Opens after level ${SHOP_AFTER[node]}</span>` : `<button class="btn btn-primary" data-cm="shop" data-autofocus>Go in</button>`}</div>`;
  }
  el.innerHTML = `<button class="cm-x" data-cm="close" aria-label="Close">×</button>` + html;
  el.classList.add("open");
  const pc = el.querySelector(".cm-portrait");
  if (pc) { const g = pc.getContext("2d"); g.imageSmoothingEnabled = false; drawPortraitCard(g, I.npcs[node].look, 96, I); }
  el.querySelectorAll("[data-cm]").forEach(b => b.addEventListener("click", () => cmAction(b.dataset.cm)));
  const auto = el.querySelector("[data-autofocus]");
  if (auto) auto.focus({ preventScroll: true });
}

function drawPortraitCard(g, look, size, isl) {
  g.clearRect(0, 0, size, size);
  g.fillStyle = isl.colors.accent;
  g.globalAlpha = 0.25;
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 1;
  drawPortrait(g, look, size * 0.12, size * 0.22, size * 0.76, performance.now());
}

function cmAction(a) {
  if (!cmSel) return;
  const { isl, node } = cmSel;
  if (a === "close") { cmSel = null; cmHome = null; cmCard(); cmSpots(); return; }
  if (a === "play") { sfx("click"); campStart(isl, node); return; }
  if (a === "satchel") { openSatchel(() => cmCard()); return; }
  if (a === "tree") { openUpgradesPanel(isl); return; }
  if (a === "shop") { openCampShop(isl, node); return; }
  if (a === "cross") {
    const next = CAMP.islands[campIslandIdx(isl) + 1];
    if (!next) return;
    camp.at = next.id;
    saveCamp();
    cmTravel(next.id, "home");
    cmTraveler.onArrive = () => cmFocusHome(next.id);
    cmSel = { isl: next.id, node: "home" };
    cmHome = null;
    cmCard();
    cmTopbar();
    cmSpots();
    sfx("whoosh");
    showToast(`The Coil carries you up to ${next.name}.`);
  }
}

/* The gear you'd take into a level, at a glance */
function campLoadoutStrip() {
  if (!camp.satchel.some(it => campItemSlot(it.id) !== "loot")) return "";
  const cells = CAMP.slots.map(s => {
    const it = campEquipped(s.id);
    return `<span class="cm-slot" title="${s.name}: ${it ? campItemName(it) : "none"}">${it ? campItemIconHtml(it, "small") : `<span class="ci-icon small empty"></span>`}</span>`;
  }).join("");
  return `<div class="cm-loadout"><span>Taking</span>${cells}</div>`;
}

function cmTopbar() {
  const el = document.getElementById("cm-wallet");
  if (!el) return;
  const open = CAMP.islands.filter(i => campIslandOpen(i.id));
  el.innerHTML = open.map(i => `<span class="cm-coin ${i.id === camp.at ? "here" : ""}" title="${i.currency.plural}">${coinIconHtml(i.id)}${fmtInt(campWallet(i.id))}<small>${i.currency.short}</small></span>`).join("") +
    `<span class="cm-coin gems" title="Gems">${gemIconHtml()}${fmtInt(camp.gems)}</span>`;
  document.getElementById("cm-island").textContent = CAMP.islandById[camp.at].name;
  document.getElementById("cm-satchel").hidden = !camp.satchel.length;
}

/* ----- Home, close up: the tree and what's gathered under it ----- */
function cmFocusHome(isl) {
  cmHome = isl;
  const p = cmPos(isl, "home", 0);
  const z = Math.max(5, Math.min(20, Math.min(cmCanvas.clientWidth / 150, cmCanvas.clientHeight / 95)));
  cmFly(p.x + 18, p.y - 14, z, 800);
  cmSpots();
}

/* Which keepsakes have turned up under the tree: each only once you have something it's for */
function cmKeepsakes() {
  return {
    satchel: camp.satchel.length > 0,
    trophy: CAMP.rules.achievements.some(a => camp.achievements[a.id]),
    mirror: camp.skins.length > CAMP.rules.cosmetics.freeSkins.length || camp.gems >= cosmeticPrice("skin", 0),
    easel: camp.themes.length > CAMP.rules.cosmetics.freeThemes.length || camp.gems >= cosmeticPrice("theme", 0)
  };
}
const CM_KEEP_AT = { satchel: [-18, 2], trophy: [18, 2], mirror: [32, -2], easel: [-33, -2] };
const CM_KEEP_LABEL = { canopy: "Upgrade tree", satchel: "Satchel", trophy: "Achievements", mirror: "Skins", easel: "Themes" };
const cmSeenKeep = {};

function cmSpots() {
  const box = document.getElementById("cm-spots");
  if (!box) return;
  if (!cmHome || currentScreen !== "camp") { box.innerHTML = ""; return; }
  const k = cmKeepsakes();
  const gr = cmTreeGrowth(cmHome);
  const list = [["canopy", 0, -26 - Math.round(gr * 26)]].concat(Object.keys(CM_KEEP_AT).filter(n => k[n]).map(n => [n, CM_KEEP_AT[n][0], CM_KEEP_AT[n][1] - 9]));
  box.innerHTML = list.map(([n, dx, dy]) => `<button class="cb-spot" data-spot="${n}" data-dx="${dx}" data-dy="${dy}">${CM_KEEP_LABEL[n]}</button>`).join("");
  box.querySelectorAll("[data-spot]").forEach(b => b.addEventListener("click", () => {
    sfx("click");
    const n = b.dataset.spot;
    if (n === "canopy") openUpgradesPanel(cmHome);
    else if (n === "satchel") openSatchel();
    else if (n === "trophy") openAchievementsPanel();
    else if (n === "mirror") openSkinsPanel();
    else openThemesPanel();
  }));
  cmPlaceSpots();
}

function cmPlaceSpots() {
  const box = document.getElementById("cm-spots");
  if (!box || !cmHome) return;
  const p = cmPos(cmHome, "home");
  const show = cmCam.z > 4.5;
  box.querySelectorAll("[data-spot]").forEach(b => {
    const [x, y] = cmToScreen(p.x + +b.dataset.dx, p.y + +b.dataset.dy);
    b.style.left = x.toFixed(0) + "px";
    b.style.top = y.toFixed(0) + "px";
    b.hidden = !show;
  });
}

/* How grown an island's tree is, 0 to 1 */
const cmGrowShown = {};
function cmTreeGrowth(isl) {
  const ups = CAMP.islandById[isl].tree.upgrades;
  const max = ups.reduce((a, u) => a + u.values.length - 1, 0);
  return max ? ups.reduce((a, u) => a + upTier(u.id), 0) / max : 0;
}

/* ----- The loop ----- */
let cmLast = 0;
function cmLoop(ts) {
  if (currentScreen !== "camp") return;
  cmRaf = requestAnimationFrame(cmLoop);
  cmStep(ts);
}

function cmStep(ts) {
  const dt = Math.min(64, ts - (cmLast || ts));
  cmLast = ts;
  cmT = ts / 1000;
  if (cmGlide) {
    if (cmGlide.to) {
      const t = Math.min(1, (ts - cmGlide.t0) / cmGlide.ms), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      cmCam.x = cmGlide.from.x + (cmGlide.to.x - cmGlide.from.x) * e;
      cmCam.y = cmGlide.from.y + (cmGlide.to.y - cmGlide.from.y) * e;
      cmCam.z = cmGlide.from.z + (cmGlide.to.z - cmGlide.from.z) * e;
      if (t >= 1) cmGlide = null;
    } else {
      cmCam.x -= cmGlide.vx * 16 / cmCam.z; cmCam.y -= cmGlide.vy * 16 / cmCam.z;
      cmGlide.vx *= 0.92; cmGlide.vy *= 0.92;
      if (Math.abs(cmGlide.vx) + Math.abs(cmGlide.vy) < 0.01) cmGlide = null;
    }
    cmClamp();
  }
  cmTickTraveler(dt);
  // drifting away from home closes it
  if (cmHome && !cmGlide && !cmTraveler.crossing) { const p = cmPos(cmHome, "home", 0); if (cmCam.z < 3 || Math.hypot(p.x - cmCam.x, p.y - cmCam.y) > 140) { cmHome = null; cmSpots(); } }
  cmDraw(ts);
  cmPlaceSpots();
}

function cmDraw(ts) {
  const t = ts / 1000;
  cmT = t;
  const dpr = +cmCanvas.dataset.dpr || 1;
  const w = cmCanvas.clientWidth, h = cmCanvas.clientHeight;
  const g = cmG;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  cmDrawSky(g, w, h, t);
  const W = cmWG;
  W.clearRect(0, 0, CM_W, CM_H);
  cmDrawWorld(W, t);
  const [x0, y0] = cmToWorld(0, 0);
  g.drawImage(cmWorld, 0, 0, CM_W, CM_H, -x0 * cmCam.z, -y0 * cmCam.z, CM_W * cmCam.z, CM_H * cmCam.z);
  cmDrawOverlay(g, t);
}

/* ----- Naming the snake on a new save ----- */
function campAskName(after) {
  openCampModal(`<h3>Name your snake</h3><p>Every hero needs a name. Five islands are waiting to mispronounce it.</p>
    <input id="camp-name" class="text-input" maxlength="16" autocomplete="off" spellcheck="false" value="${escapeHtml(camp.name)}">
    <div class="row-buttons"><button class="btn btn-primary" id="camp-name-ok">That's the one</button></div>`);
  const inp = document.getElementById("camp-name");
  const ok = () => {
    const v = inp.value.trim().replace(/[<>]/g, "").slice(0, 16);
    camp.name = v || "Noodle";
    camp.named = true;
    save.name = camp.name;
    saveCamp();
    closeCampModal();
    if (after) { after(); showToast(`Your snake is now called ${camp.name}.`); }
    else showToast(`Welcome, ${camp.name}. Your journey starts at the bottom of the sky, on Brightscale Keep.`);
  };
  document.getElementById("camp-name-ok").addEventListener("click", ok);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); ok(); } });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
