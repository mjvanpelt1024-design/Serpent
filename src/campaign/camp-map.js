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

const CM_W = 760, CM_H = 1120;                     // the world, in map pixels
const CM_CENTERS = [[250, 990], [510, 800], [250, 610], [510, 420], [330, 232]];
const CM_MAIN = { hw: 118, th: 40, depth: 74 };
const CM_ISLETS = {
  home: { x: 0, y: 76, hw: 44, th: 13, depth: 26 },
  merchant: { x: 160, y: 32, hw: 25, th: 8, depth: 17 },
  challenger: { x: -162, y: -6, hw: 25, th: 8, depth: 17 },
  banker: { x: 158, y: -42, hw: 25, th: 8, depth: 17 },
  bridge: { x: 0, y: -88, hw: 13, th: 4, depth: 11 }
};
const CM_NODES = {
  home: [0, 76],
  1: [-78, 22], 2: [-39, 25], 3: [0, 26], 4: [39, 25], 5: [78, 22],
  6: [86, 0], 7: [43, 1], 8: [0, 2], 9: [-43, 1], 10: [-86, 0],
  11: [-78, -22], 12: [-39, -25], 13: [0, -26], 14: [39, -25], 15: [78, -22],
  merchant: [160, 32], challenger: [-162, -6], banker: [158, -42], bridge: [0, -88]
};
const CM_EDGES = [["home", 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [11, 12], [12, 13], [13, 14], [14, 15], [5, "merchant"], [10, "challenger"], [15, "banker"], [15, "bridge"]];
const CM_ROPES = ["home-1", "5-merchant", "10-challenger", "15-banker", "15-bridge"];   // these cross open sky

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

const cmDefaultZoom = () => Math.max(1, Math.min(9, Math.min(window.innerWidth / 380, window.innerHeight / 250)));

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
      const [x, y] = cmToScreen(p.x, p.y - (node === "home" ? 8 : 2));
      const r = Math.max(14, (node === "home" ? 16 : 8) * cmCam.z);
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

function cmEdgePoints(a, b) {
  const A = cmParse(a), B = cmParse(b);
  if (A.isl !== B.isl) {
    // riding the Coil from one island's bridge to the next island's home
    const i = Math.min(campIslandIdx(A.isl), campIslandIdx(B.isl));
    const pts = coilSamples(i).map(p => ({ x: p.x, y: p.y }));
    return campIslandIdx(A.isl) < campIslandIdx(B.isl) ? pts : pts.reverse();
  }
  const p = cmPos(A.isl, A.node, 0), q = cmPos(B.isl, B.node, 0);
  const out = [];
  const rope = CM_ROPES.includes(`${A.node}-${B.node}`) || CM_ROPES.includes(`${B.node}-${A.node}`);
  const n = Math.max(4, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 3));
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    out.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f + (rope ? Math.sin(f * Math.PI) * 5 : -Math.sin(f * Math.PI) * 2) });
  }
  return out;
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
  const z = Math.max(6, Math.min(22, Math.min(cmCanvas.clientWidth / 120, cmCanvas.clientHeight / 80)));
  cmFly(p.x + 14, p.y - 12, z, 800);
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
const CM_KEEP_AT = { satchel: [-12, -1], trophy: [12, -1], mirror: [24, -3], easel: [-25, -3] };
const CM_KEEP_LABEL = { canopy: "Upgrade tree", satchel: "Satchel", trophy: "Achievements", mirror: "Skins", easel: "Themes" };
const cmSeenKeep = {};

function cmSpots() {
  const box = document.getElementById("cm-spots");
  if (!box) return;
  if (!cmHome || currentScreen !== "camp") { box.innerHTML = ""; return; }
  const k = cmKeepsakes();
  const gr = cmTreeGrowth(cmHome);
  const list = [["canopy", 0, -16 - Math.round(gr * 20)]].concat(Object.keys(CM_KEEP_AT).filter(n => k[n]).map(n => [n, CM_KEEP_AT[n][0], CM_KEEP_AT[n][1] - 9]));
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
  if (cmHome && !cmGlide && !cmTraveler.crossing) { const p = cmPos(cmHome, "home", 0); if (cmCam.z < 3 || Math.hypot(p.x - cmCam.x, p.y - cmCam.y) > 90) { cmHome = null; cmSpots(); } }
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

/* ----- The sky: sunrise at the bottom, the day, dusk, and stars at the top ----- */
const CM_SKY = [[0, "#090820"], [150, "#1a1650"], [280, "#3e2c78"], [400, "#8a4f94"], [500, "#d47f93"],
  [600, "#c9a7c6"], [700, "#8fbfe6"], [830, "#79bdec"], [960, "#bfe0f2"], [1060, "#ffe1bf"], [1120, "#ffd09a"]].map(([y, c]) => [y, hexToRgb(c)]);
function cmSkyAt(y) {
  if (y <= CM_SKY[0][0]) return CM_SKY[0][1];
  for (let i = 1; i < CM_SKY.length; i++) {
    const [y1, c1] = CM_SKY[i], [y0, c0] = CM_SKY[i - 1];
    if (y <= y1) { const k = (y - y0) / (y1 - y0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); }
  }
  return CM_SKY[CM_SKY.length - 1][1];
}

const CM_SKY_PX = 5;
function cmDrawSky(out, vw, vh, t) {
  const w = Math.max(1, Math.ceil(vw / CM_SKY_PX)), h = Math.max(1, Math.ceil(vh / CM_SKY_PX));
  if (cmSky.width !== w || cmSky.height !== h) { cmSky.width = w; cmSky.height = h; }
  const g = cmSky.getContext("2d");
  const worldY = row => cmToWorld(0, row * CM_SKY_PX)[1];
  for (let r = 0; r < h; r++) {
    const [cr, cg, cb] = cmSkyAt(worldY(r) + (BAYER[(r % 4) * 4] / 16 - 0.5) * 14);
    g.fillStyle = `rgb(${cr},${cg},${cb})`;
    g.fillRect(0, r, w, 1);
  }
  // the far layers drift a fraction as fast as the world
  const px = -cmCam.x * cmCam.z / CM_SKY_PX, py = -cmCam.y * cmCam.z / CM_SKY_PX;
  for (let i = 0; i < 170; i++) {
    const sx = ((cmHash(i, 1, 91) * w * 3 + px * 0.1) % w + w) % w;
    const sy = ((cmHash(i, 2, 91) * h * 3 + py * 0.1) % h + h) % h;
    const a = Math.max(0, Math.min(1, (560 - worldY(sy)) / 300));
    if (a <= 0) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + cmHash(i, 3, 91) * 3) + i);
    g.fillStyle = `rgba(255, 250, 230, ${a * (0.3 + tw * 0.7)})`;
    g.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    const iw = 6 + cmHash(i, 4, 93) * 11;
    const sx = ((cmHash(i, 5, 93) * w * 2.2 + px * 0.28) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
    const sy = ((cmHash(i, 6, 93) * h * 2 + py * 0.28) % (h * 1.3) + h * 1.3) % (h * 1.3) - h * 0.15;
    const [r0, g0, b0] = cmSkyAt(worldY(sy));
    g.fillStyle = `rgba(${Math.round(r0 * 0.86)},${Math.round(g0 * 0.9)},${Math.round(b0 * 0.88)},0.75)`;
    g.fillRect(Math.round(sx - iw / 2), Math.round(sy - 1), Math.round(iw), 2);
    g.fillStyle = `rgba(${Math.round(r0 * 0.72)},${Math.round(g0 * 0.72)},${Math.round(b0 * 0.82)},0.7)`;
    for (let r = 1; r < iw * 0.55; r++) {
      const ww = Math.max(1, Math.round(iw * Math.pow(1 - r / (iw * 0.55), 0.8)));
      g.fillRect(Math.round(sx - ww / 2), Math.round(sy + r), ww, 1);
    }
  }
  // the moon over the Cinder Crown, the sun under Brightscale Keep
  const [, moonSy] = cmToScreen(0, 90), [, sunSy] = cmToScreen(0, 1070);
  const mx = w * 0.8 + px * 0.04, my = moonSy / CM_SKY_PX * 0.6 + py * 0.02;
  if (my > -12 && my < h + 12) { cmDisc(g, mx, my, 9, "rgba(255,250,220,0.12)"); cmDisc(g, mx, my, 5, "#fff6d8"); cmDisc(g, mx + 2, my - 1, 4.2, "rgba(26,22,80,0.88)"); }
  const sx = w * 0.14 + px * 0.04, sy = sunSy / CM_SKY_PX;
  if (sy > -16 && sy < h + 16) { cmDisc(g, sx, sy, 13, "rgba(255,210,140,0.18)"); cmDisc(g, sx, sy, 9, "rgba(255,220,150,0.3)"); cmDisc(g, sx, sy, 6, "#fff0b8"); }
  out.drawImage(cmSky, 0, 0, w * CM_SKY_PX, h * CM_SKY_PX);
}
function cmDisc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) { const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1); }
}

/* ----- The world ----- */
function cmCloud(g, x, y, w, color) {
  g.fillStyle = color;
  const h = Math.max(2, Math.round(w * 0.22));
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), h);
  g.fillRect(Math.round(x + w * 0.15), Math.round(y - h * 0.6), Math.round(w * 0.4), h);
  g.fillRect(Math.round(x + w * 0.45), Math.round(y - h), Math.round(w * 0.35), h);
}

function cmDrawWorld(g, t) {
  // clouds far behind, tinted by the sky around them
  for (let i = 0; i < 22; i++) {
    const w = 22 + cmHash(i, 7, 3) * 40;
    const x = ((cmHash(i, 7, 5) * (CM_W + 160) + t * (1.2 + (i % 5) * 0.4)) % (CM_W + 160)) - 80;
    const y = 30 + (i / 22) * (CM_H - 80) + cmHash(i, 7, 9) * 30;
    const [r, gg, b] = cmSkyAt(y);
    cmCloud(g, x, y, w, `rgba(${Math.round((r + 510) / 3)},${Math.round((gg + 510) / 3)},${Math.round((b + 510) / 3)},0.45)`);
  }
  // the Coil, behind the islands it carries you between
  cmDrawCoil(g, t);
  CAMP.islands.forEach((isl, i) => cmDrawIsland(g, isl, i, t));
  cmDrawCoilHead(g, t);
  cmDrawTraveler(g, t);
  // clouds over islands you haven't reached
  CAMP.islands.forEach((isl, i) => {
    if (campIslandOpen(isl.id)) return;
    const c = CM_CENTERS[i];
    for (let k = 0; k < 9; k++) {
      const w = 40 + cmHash(k, i, 4) * 50;
      const x = c[0] - 130 + cmHash(k, i, 5) * 210 + Math.sin(t * 0.3 + k) * 4, y = c[1] - 40 + (k % 5) * 26 + cmHash(k, i, 6) * 8;
      cmCloud(g, x, y, w, k % 2 ? "rgba(244,247,251,0.92)" : "rgba(223,230,239,0.92)");
    }
  });
  // a sea of clouds far below, lit by the sunrise
  for (let x = 0; x < CM_W; x++) {
    const hh = 14 + Math.round(Math.sin((x + t * 4) * 0.11) * 3 + Math.sin((x - t * 2.5) * 0.29) * 2);
    cmRect(g, x, CM_H - hh, 1, hh, "#fbe9dc");
    cmRect(g, x, CM_H - hh, 1, 2, "#ffffff");
    if ((x + Math.floor(t * 6)) % 29 === 0) cmRect(g, x, CM_H - hh + 4, 5, 1, "#f2cdb8");
  }
}

/* ----- Floating islands, painted once ----- */
const CM_ROCK = {
  medieval: ["#7a5232", "#6c482b", "#5e4a3a", "#4e4038", "#57545c", "#4c4a50"],
  wizard: ["#5a4a7a", "#4a3d6a", "#463a5e", "#3a3050", "#3a3448", "#302a3c"],
  harvest: ["#8a5a32", "#7a4e2b", "#6a4a32", "#5a3e2a", "#55463c", "#4a3e36"],
  ocean: ["#c8a07a", "#b88e6a", "#a07a68", "#8a6a62", "#6a6a7a", "#5a5a6a"],
  volcano: ["#3a2a2a", "#2e2222", "#2a2026", "#221a20", "#1e181c", "#181418"]
};

function cmPaintFloat(isl, hw, th, depth, seed, fog) {
  const W = hw * 2 + 8, H = th * 2 + depth + 10;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const cx = Math.floor(W / 2), cy = th + 2;
  const C = isl.colors;
  const rock = fog ? ["#aab4c4", "#9ea9ba", "#aab4c4", "#9ea9ba", "#a4aebe", "#98a2b4"] : CM_ROCK[isl.theme];
  const [a, b, edge] = fog ? ["#c9d2df", "#bcc6d4", "#9aa6b8"] : [C.grass, campShade(C.grass, -0.08), C.edge];
  // the rock underneath: column by column, so the underside hangs in ragged points
  const smooth = (v, s) => { const i = Math.floor(v), f = v - i, a = cmHash(i, s, 41), b = cmHash(i + 1, s, 41); return a + (b - a) * (f * f * (3 - 2 * f)); };
  for (let x = -hw; x <= hw; x++) {
    const e = Math.abs(x) / hw;
    const col = depth * Math.pow(Math.max(0, 1 - e * e), 0.85) * (0.62 + 0.38 * smooth(x * 0.11 + 10, seed)) + (cmHash(x, seed, 5) - 0.5) * 3;
    for (let r = 0; r <= col; r++) {
      const y = cy + th - 1 + r;
      const k = r / depth + (smooth(x * 0.3, seed + 3) - 0.5) * 0.12;
      const band = k < 0.28 ? 0 : k < 0.6 ? 2 : 4;
      let c = cmHash(x, r, seed + band) > 0.55 ? rock[band + 1] : rock[band];
      if (!fog && (x + Math.floor(r / 3)) % 7 === 0 && r > 2) c = rock[Math.min(5, band + 1)];   // strata
      if (r >= col - 1) c = fog ? "#8c97a8" : "#2e2420";
      else if (x > hw * 0.55 && !fog) c = campShade(c, -0.18);                                     // the shaded side
      else if (x < -hw * 0.6 && !fog && r < col * 0.5) c = campShade(c, 0.14);                     // the lit side
      if (!fog && isl.theme === "volcano" && cmHash(x, r, seed + 9) > 0.985) c = "#ff6a1a";
      if (!fog && isl.theme === "wizard" && cmHash(x, r, seed + 9) > 0.992) c = "#b8f0ff";
      cmRect(g, cx + x, y, 1, 1, c);
    }
  }
  if (!fog) {
    const n = Math.max(2, Math.round(hw / 14));
    for (let k = 0; k < n; k++) {
      const x = cx - hw * 0.7 + k * (hw * 1.4 / Math.max(1, n - 1));
      const y0 = cy + th + Math.round(depth * 0.3 * cmHash(k, seed, 9));
      const len = 2 + Math.floor(cmHash(k, seed, 11) * (depth * 0.25));
      for (let r = 0; r < len; r++) cmRect(g, x + (r > 2 ? 1 : 0), y0 + r, 1, 1, r === len - 1 ? campShade(C.grass, -0.1) : "#3e2a1a");
    }
  }
  for (let dy = -th; dy <= th; dy++) {
    const half = hw * Math.sqrt(Math.max(0, 1 - Math.pow(dy / (th + 0.5), 2)));
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      let col = ((x + dy) & 1) && cmHash(x, dy, seed + 5) > 0.45 ? b : a;
      if (dy >= th - 1) col = edge;
      if (dy === -th || (dy < 0 && Math.abs(x) >= Math.round(half) - 1)) col = fog ? "#e3e9f1" : campShade(a, 0.18);
      cmRect(g, cx + x, cy + dy, 1, 1, col);
    }
  }
  return { c, ox: cx, oy: cy, g };
}

function cmIslandArt(isl, i) {
  const fog = !campIslandOpen(isl.id);
  const key = isl.id + (fog ? ":fog" : ":on");
  if (cmArtCache.has(key)) return cmArtCache.get(key);
  const seed = 31 + i * 97;
  const main = cmPaintFloat(isl, CM_MAIN.hw, CM_MAIN.th, CM_MAIN.depth, seed, fog);
  if (!fog) {
    const g = main.g, cx = main.ox, cy = main.oy;
    const rng = seededRandom(seed);
    const nodes = Object.entries(CM_NODES).filter(([k]) => !CM_ISLETS[k]).map(([, p]) => p);
    const clear = (x, y, r) => nodes.every(([a, b]) => Math.hypot(a - x, (b - y) * 1.6) > r) && Math.hypot(x + 60, y + 34) > 16;
    const props = [];
    for (let k = 0; k < 400 && props.length < 34; k++) {
      const x = (rng() * 2 - 1) * (CM_MAIN.hw - 6), y = (rng() * 2 - 1) * (CM_MAIN.th - 4);
      if ((x / (CM_MAIN.hw - 6)) ** 2 + (y / (CM_MAIN.th - 3)) ** 2 > 1 || !clear(x, y, 10) || props.some(p => Math.hypot(p[0] - x, (p[1] - y) * 1.6) < 9)) continue;
      props.push([x, y, rng()]);
    }
    // a trail worn between the levels
    for (let j = 1; j < 15; j++) {
      const [ax, ay] = CM_NODES[j], [bx, by] = CM_NODES[j + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let s = 0; s <= n; s++) if (s % 3 !== 2) cmRect(g, cx + ax + (bx - ax) * s / n, cy + ay + (by - ay) * s / n + 1, 1, 1, "rgba(110,80,40,0.45)");
    }
    props.sort((p, q) => p[1] - q[1]).forEach(([x, y, r]) => cmProp(g, isl.theme, cx + x, cy + y, r));
    cmLandmark(g, isl.theme, cx - 60, cy - 31);
  }
  const islets = {};
  Object.entries(CM_ISLETS).forEach(([k, d], j) => {
    islets[k] = cmPaintFloat(isl, d.hw, d.th, d.depth, seed + 13 * (j + 1), fog);
    if (!fog && k !== "home" && k !== "bridge") {
      const r = seededRandom(seed + j);
      cmProp(islets[k].g, isl.theme, islets[k].ox - 17, islets[k].oy + 1, r() * 0.5);
      cmProp(islets[k].g, isl.theme, islets[k].ox + 17, islets[k].oy + 1, r() * 0.5);
    }
    if (!fog && k === "home") {
      const r = seededRandom(seed + 77);
      [[-34, 2], [33, 3], [-30, -5], [30, -6]].forEach(([dx, dy]) => cmProp(islets[k].g, isl.theme, islets[k].ox + dx, islets[k].oy + dy, r() * 0.45));
    }
  });
  const art = { main, islets };
  cmArtCache.set(key, art);
  return art;
}

function cmProp(g, theme, x, y, r) {
  const R = (a, b, w, h, col) => cmRect(g, x + a, y + b, w, h, col);
  if (theme === "medieval") {
    if (r < 0.5) { R(0, 1, 1, 3, "#5a3a22"); R(-2, -2, 5, 4, "#2f7d2a"); R(-1, -3, 3, 1, "#3f9a33"); if (r < 0.2) R(1, -1, 1, 1, "#ff3b3b"); }
    else if (r < 0.7) { R(-3, -2, 6, 4, "#e8dcc0"); R(-4, -4, 8, 2, "#b23a3a"); R(-3, -5, 6, 1, "#c84a4a"); R(-1, 0, 2, 2, "#5a3a22"); }
    else if (r < 0.85) { R(0, -6, 1, 7, "#5a3a22"); R(1, -6, 3, 2, r < 0.78 ? "#d9b44a" : "#3a6ab8"); }
    else { R(-2, -1, 4, 2, "#f4f4f4"); R(-1, -2, 3, 1, "#f4f4f4"); R(2, -2, 1, 1, "#3a3a3a"); }
  } else if (theme === "wizard") {
    if (r < 0.35) { for (let j = 0; j < 6; j++) R(-Math.floor(j / 3), -j, 1 + Math.floor(j / 3) * 2, 1, j > 4 ? "#e8d0ff" : "#9a7ae0"); }
    else if (r < 0.6) { R(0, 1, 1, 3, "#3a2a5a"); R(-2, -2, 5, 4, "#2a6a7a"); R(-1, -3, 3, 1, "#3a8a9a"); R(-1, -1, 1, 1, "#ffe86a"); }
    else if (r < 0.8) { R(-2, -1, 4, 3, "#7a4a2a"); R(-2, -2, 4, 1, "#e8e0c8"); R(1, -4, 1, 2, "#b36bff"); }
    else { R(-1, -5, 2, 6, "#4a4a7a"); R(-2, -6, 4, 1, "#6a6aa0"); R(0, -4, 1, 1, "#7fe3ff"); }
  } else if (theme === "harvest") {
    if (r < 0.4) { R(0, 1, 1, 3, "#6a4a2a"); R(-2, -2, 5, 4, "#5a8a2a"); R(-1, -1, 1, 1, "#ff3b3b"); R(1, 0, 1, 1, "#ff8c1a"); }
    else if (r < 0.6) { R(-3, -1, 6, 3, "#e8c060"); R(-2, -2, 4, 1, "#f0d070"); }
    else if (r < 0.78) { R(-2, -1, 4, 3, "#ff8c1a"); R(-1, -2, 2, 1, "#ffa83a"); R(0, -3, 1, 1, "#3a7a2a"); }
    else { R(-1, -3, 3, 3, "#e0a820"); R(-1, -4, 3, 1, "#c08a10"); R(0, -2, 1, 1, "#3a2a10"); }
  } else if (theme === "ocean") {
    if (r < 0.35) { R(0, -5, 1, 6, "#ff7a8a"); R(-2, -4, 2, 1, "#ff7a8a"); R(1, -3, 2, 1, "#ff7a8a"); R(-2, -5, 1, 1, "#ff9aa8"); }
    else if (r < 0.6) { for (let j = 0; j < 6; j++) R(Math.round(Math.sin(j * 0.9)), -j, 1, 1, "#2a9a5a"); }
    else if (r < 0.8) { R(-2, -1, 4, 2, "#ffc8b8"); R(-1, -2, 2, 1, "#ffd8c8"); R(0, -1, 1, 1, "#c87a6a"); }
    else { R(-1, 0, 3, 1, "#4a90c8"); R(-2, 1, 5, 1, "#5aa0d8"); }
  } else {
    if (r < 0.35) { R(-2, -2, 4, 3, "#2a2028"); R(-1, -3, 2, 1, "#3a3040"); R(0, -2, 1, 1, "#ff6a1a"); }
    else if (r < 0.6) { R(0, 0, 1, 2, "#2a1a1a"); R(-1, -3, 3, 3, "#1a1014"); R(0, -4, 1, 1, "#1a1014"); }
    else if (r < 0.8) { R(-2, 0, 4, 1, "#ff6a1a"); R(-1, -1, 2, 1, "#ffd23f"); }
    else { R(-1, -4, 2, 4, "#4a3a40"); R(0, -5, 1, 1, "#ff9a3a"); }
  }
}

function cmLandmark(g, theme, x, y) {
  const R = (a, b, w, h, col) => cmRect(g, x + a, y + b, w, h, col);
  if (theme === "medieval") {
    R(-8, -10, 16, 10, "#a8a098"); R(-10, -16, 5, 16, "#b8b0a8"); R(5, -16, 5, 16, "#b8b0a8");
    for (let k = 0; k < 3; k++) { R(-10 + k * 2, -17, 1, 1, "#b8b0a8"); R(5 + k * 2, -17, 1, 1, "#b8b0a8"); }
    R(-2, -5, 4, 5, "#5a3a20"); R(-8, -11, 16, 1, "#c8c0b8");
    R(-8, -22, 1, 6, "#5a3a20"); R(-7, -22, 4, 2, "#d9b44a"); R(8, -22, 1, 6, "#5a3a20"); R(9, -22, 4, 2, "#c8323a");
  } else if (theme === "wizard") {
    R(-3, -26, 6, 26, "#5a5a90"); R(-4, -28, 8, 2, "#4a4a80"); for (let j = 0; j < 6; j++) R(-4 + j * 0.7, -34 + j, 8 - j * 1.4, 1, "#3a3a8a");
    R(-1, -20, 2, 2, "#ffe86a"); R(-1, -12, 2, 2, "#ffe86a"); R(-6, -2, 12, 2, "#4a4a80");
  } else if (theme === "harvest") {
    R(-10, -8, 12, 8, "#a83a2a"); R(-11, -12, 14, 4, "#8a2a1a"); R(-6, -4, 3, 4, "#5a3a20");
    R(4, -14, 4, 14, "#c8b080"); R(3, -16, 6, 2, "#a89060"); R(1, -15, 2, 1, "#c8b080"); R(9, -15, 2, 1, "#c8b080");
  } else if (theme === "ocean") {
    R(-12, -4, 24, 4, "#6a4a2a"); R(-9, -12, 2, 8, "#5a3a20"); R(-10, -12, 9, 5, "#e8e0c8"); R(3, -15, 2, 11, "#5a3a20"); R(4, -15, 8, 6, "#e8e0c8");
  } else {
    for (let j = 0; j < 14; j++) R(-j * 0.9, -14 + j, j * 1.8 + 3, 1, j < 3 ? "#ff6a1a" : "#3a2a30");
    R(-2, -15, 4, 2, "#ff6a1a");
  }
}

function cmDrawIsland(g, isl, i, t) {
  const art = cmIslandArt(isl, i);
  const c = CM_CENTERS[i], by = cmBob(i, t);
  const open = campIslandOpen(isl.id);
  const blit = (a, x, y) => g.drawImage(a.c, Math.round(x - a.ox), Math.round(y - a.oy + by));
  // islets behind the main island first, then the island, then the ones in front
  ["bridge", "banker", "challenger"].forEach(k => blit(art.islets[k], c[0] + CM_ISLETS[k].x, c[1] + CM_ISLETS[k].y));
  blit(art.main, c[0], c[1]);
  ["merchant", "home"].forEach(k => blit(art.islets[k], c[0] + CM_ISLETS[k].x, c[1] + CM_ISLETS[k].y));
  if (!open) return;
  cmDrawPaths(g, isl, t);
  cmLiving(g, isl, c[0], c[1] + by, t);
  Object.keys(CM_NODES).forEach(k => cmDrawNode(g, isl, isNaN(+k) ? k : +k, t));
}

/* Plank bridges across the sky between the islets and the island */
function cmDrawPaths(g, isl, t) {
  const by = cmBob(campIslandIdx(isl.id), t);
  CM_EDGES.forEach(([a, b]) => {
    if (!CM_ROPES.includes(`${a}-${b}`)) return;          // trails between levels are painted on the ground
    const lit = !["locked", "fog"].includes(cmNodeState(isl.id, b)) && !["locked", "fog"].includes(cmNodeState(isl.id, a));
    const pts = cmEdgePoints(cmKey(isl.id, a), cmKey(isl.id, b));
    pts.forEach((p, k) => {
      if (k < 2 || k > pts.length - 3) return;
      if (!lit && k % 3) return;
      cmRect(g, p.x, p.y + 1 + by, 1, 1, "rgba(0,0,0,0.25)");
      cmRect(g, p.x, p.y + by, 1, 1, lit ? (k % 2 ? "#a8743e" : "#8a5a30") : "rgba(90,70,50,0.55)");
      if (lit && k % 4 === 0) cmRect(g, p.x, p.y - 2 + by, 1, 2, "#4a3020");
    });
  });
}

/* Little things moving on each island */
function cmLiving(g, isl, x, y, t) {
  if (isl.theme === "medieval") {
    if (Math.sin(t * 5) > 0) cmRect(g, x - 52, y - 53, 1, 1, "#d9b44a");
    for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; cmRect(g, x - 20 + k * 30 + Math.sin(t + k) * 3, y - 34 - ph * 4, 1, 1, `rgba(255,255,255,${0.6 * (1 - ph)})`); }
  } else if (isl.theme === "wizard") {
    for (let k = 0; k < 8; k++) { const a = t * 0.8 + k; cmRect(g, x - 60 + Math.cos(a) * 12, y - 52 + Math.sin(a * 1.3) * 7, 1, 1, k % 2 ? "#ffe86a" : "#b36bff"); }
  } else if (isl.theme === "harvest") {
    for (let k = 0; k < 4; k++) { const a = t * (2 + k * 0.4) + k * 1.6; cmRect(g, x - 52 + Math.cos(a) * (5 + k * 2), y - 40 + Math.sin(a * 1.3) * 3, 1, 1, k % 2 ? "#ffcf33" : "#1a1410"); }
  } else if (isl.theme === "ocean") {
    for (let k = 0; k < 18; k++) { const ph = (t * 1.3 + k / 18) % 1; cmRect(g, x + 96, y + 30 + ph * 44, 1, 2, `rgba(200,235,255,${0.85 * (1 - ph)})`); }
    for (let k = 0; k < 4; k++) { const ph = (t * 0.4 + k / 4) % 1; cmRect(g, x - 20 + k * 22, y - 10 - ph * 12, 1, 1, `rgba(220,240,255,${0.7 * Math.sin(ph * Math.PI)})`); }
  } else {
    for (let k = 0; k < 3; k++) { const ph = (t * 0.35 + k / 3) % 1; g.fillStyle = `rgba(70,60,60,${0.55 * (1 - ph)})`; g.fillRect(Math.round(x - 60 + Math.sin(ph * 6 + k) * 2 - ph * 3), Math.round(y - 47 - ph * 16), 2 + Math.round(ph * 3), 2 + Math.round(ph * 2)); }
    cmRect(g, x - 61, y - 46, 2, 1, Math.sin(t * 4) > 0 ? "#ffd23f" : "#ff6a1a");
  }
}

/* ----- The spots on the path ----- */
function cmDrawNode(g, isl, node, t) {
  const p = cmPos(isl.id, node, t);
  const st = cmNodeState(isl.id, node);
  const x = Math.round(p.x), y = Math.round(p.y);
  const R = (a, b, w, h, col) => cmRect(g, x + a, y + b, w, h, col);
  if (node === "home") { cmDrawHome(g, isl, x, y, t); return; }
  g.save();
  if (st === "locked") g.globalAlpha = 0.6;
  if (typeof node === "number") {
    const d = campLevelDef(isl.id, node);
    if (d.kind === "boss") {
      R(-6, -6, 12, 7, "#2a2028"); R(-5, -8, 10, 2, "#3a3040"); R(-3, -9, 6, 1, "#3a3040");
      R(-4, -5, 8, 6, "#0a0608");
      const blink = (t + node) % 3.5 < 0.12;
      R(-3, -3, 2, blink ? 1 : 2, isl.boss.eye); R(1, -3, 2, blink ? 1 : 2, isl.boss.eye);
      R(-6, 1, 12, 1, "#4a4048");
      if (st === "won") { R(5, -13, 1, 6, "#5a3a20"); R(6, -13, 3, 2, "#ffd23f"); }
      else { R(-1, -13, 2, 4, "#e8e0c8"); R(-2, -12, 4, 1, "#e8e0c8"); }
    } else {
      const base = { static: "#c8a46a", enemy: "#c8704a", dynamic: "#6a8ad8" }[d.kind];
      const top = st === "won" ? "#ffd23f" : base;
      R(-4, 1, 9, 1, "rgba(0,0,0,0.3)");
      R(-4, -1, 9, 2, campShade(base, -0.35));
      R(-4, -3, 9, 2, top); R(-3, -4, 7, 1, top);
      R(-2, -4, 3, 1, "rgba(255,255,255,0.45)");
      cmGlyph(g, d.goal, x, y - 8, t);
      if (st === "won") { R(4, -9, 1, 5, "#5a3a20"); R(5, -9, 2, 2, (camp.levels[campLevelId(isl.id, node)] || {}).flawless ? "#ffffff" : "#ff5a61"); }
    }
  } else if (node === "bridge") {
    R(-5, -9, 2, 9, "#8a8270"); R(3, -9, 2, 9, "#8a8270"); R(-4, -10, 8, 2, "#a89c84"); R(-2, -11, 4, 1, "#a89c84");
    if (st !== "locked") { g.fillStyle = `rgba(255,236,140,${0.35 + 0.25 * Math.sin(t * 3)})`; g.fillRect(x - 3, y - 8, 6, 8); }
  } else {
    cmDrawStall(g, isl, node, x, y, t);
  }
  g.restore();
  if (st === "locked") { R(-1, -6, 3, 3, "#2a2e36"); R(0, -7, 1, 1, "#2a2e36"); R(0, -5, 1, 1, "#ffd23f"); }
}

/* A tiny picture of each goal, floating over its stone */
function cmGlyph(g, goal, x, y, t) {
  const bobY = Math.round(Math.sin(t * 2 + x) * 0.5);
  const R = (a, b, w, h, col) => cmRect(g, x + a, y + b + bobY, w, h, col);
  switch (goal.type) {
    case "apples": R(-1, -1, 3, 3, "#ff2b2b"); R(0, -2, 1, 1, "#5a3a20"); R(1, -2, 1, 1, "#3ddc3d"); break;
    case "score": R(0, -2, 1, 5, "#fff4b0"); R(-2, 0, 5, 1, "#fff4b0"); R(-1, -1, 3, 3, "#ffe86a"); break;
    case "length": R(-2, 0, 2, 2, "#3ddc84"); R(0, 0, 2, 2, "#2fae6a"); R(2, -1, 2, 2, "#3ddc84"); break;
    case "survive": R(-1, -2, 3, 1, "#e8e0c8"); R(0, -1, 1, 2, "#ffd23f"); R(-1, 1, 3, 1, "#e8e0c8"); break;
    case "distance": R(-2, 0, 4, 1, "#ffffff"); R(1, -1, 1, 3, "#ffffff"); R(2, 0, 1, 1, "#ffffff"); break;
    case "keys": R(-2, -1, 2, 2, "#ffd23f"); R(0, 0, 3, 1, "#ffd23f"); R(2, 1, 1, 1, "#ffd23f"); break;
    case "buttons": R(-2, 0, 5, 2, "#5a6070"); R(-1, -1, 3, 1, "#3ddc84"); break;
    case "relic": R(-2, -1, 5, 3, "#ffd23f"); R(-2, -2, 1, 1, "#ffd23f"); R(0, -2, 1, 1, "#ffd23f"); R(2, -2, 1, 1, "#ffd23f"); R(0, 0, 1, 1, "#ff3b3b"); break;
    case "shards": R(-1, -1, 3, 3, "#c89a4a"); R(0, -2, 1, 1, "#8a6a2a"); break;
    case "thief": R(-2, 0, 4, 2, "#8a6a4a"); R(1, -1, 2, 2, "#a8886a"); R(-3, 0, 1, 1, "#6a4a2a"); break;
  }
}

/* A shopkeeper's stall on its islet, with the shopkeeper leaning out */
function cmDrawStall(g, isl, kind, x, y, t) {
  const C = isl.colors;
  const R = (a, b, w, h, col) => cmRect(g, x + a, y + b, w, h, col);
  const look = isl.npcs[kind].look;
  if (kind === "merchant") {
    for (let k = 0; k < 6; k++) R(-7 + k * 2.4, -10, 3, 2, k % 2 ? "#ffffff" : C.accent);
    R(-7, -8, 1, 7, "#5a3a20"); R(6, -8, 1, 7, "#5a3a20");
    R(-7, -3, 14, 3, "#8a5a30"); R(-7, -3, 14, 1, "#a87a4a");
    R(-5, -5, 2, 2, "#9aa3ad"); R(3, -5, 2, 2, "#ffd23f");
  } else if (kind === "challenger") {
    R(-6, -12, 1, 12, "#5a3a20"); R(5, -12, 1, 12, "#5a3a20"); R(-6, -12, 12, 1, "#5a3a20");
    R(-5, -11, 10, 6, C.accent); R(-1, -10, 2, 3, "#ffd23f"); R(-2, -11, 4, 1, "#ffd23f");
    R(6, -14 + (Math.sin(t * 4) > 0 ? 1 : 0), 4, 2, "#ff5a61");
  } else {
    R(-7, -9, 14, 2, "#e8e0c8"); R(-6, -7, 2, 7, "#d8d0c0"); R(-1, -7, 2, 7, "#d8d0c0"); R(4, -7, 2, 7, "#d8d0c0");
    R(-7, -1, 14, 2, "#c8c0b0"); R(-4, -11, 8, 2, "#e8e0c8"); R(-1, -11, 2, 1, "#ffd23f");
    const cw = Math.max(1, Math.round(4 * Math.abs(Math.cos(t * 1.6))));
    R(9, -12, 1, 9, "#5a3a20"); R(10 - Math.floor(cw / 2), -15, cw, 4, "#ffd23f");
  }
  // the shopkeeper, bobbing
  const bob = Math.round(Math.sin(t * 2 + kind.length));
  const hx = kind === "banker" ? -12 : 9, hy = -4 + bob;
  R(hx - 1, hy, 3, 4, look.body); R(hx - 2, hy - 3, 5, 3, look.body);
  R(hx - 1, hy - 2, 1, 1, look.eye || "#ffd23f"); R(hx + 1, hy - 2, 1, 1, look.eye || "#ffd23f");
  const hat = { helm: "#9aa3ad", wizard: "#3a3aa8", chef: "#ffffff", tophat: "#1a1a20", tricorn: "#1a1a20", crown: "#ffd23f", hood: campShade(look.body, -0.35), fez: "#c8323a", beret: "#3a5a2a", straw: "#e8c870", shell: "#ffc8b8", horns: "#2a2028", hennin: "#c8508a" }[look.hat];
  if (hat) { R(hx - 2, hy - 4, 5, 1, hat); if (["wizard", "tophat", "chef", "hennin", "crown"].includes(look.hat)) R(hx - 1, hy - 6, 3, 2, hat); }
}

/* The home islet: the island's tree, grown as far as you've upgraded it, and your keepsakes */
function cmDrawHome(g, isl, x, y, t) {
  const target = cmTreeGrowth(isl.id);
  const shown = cmGrowShown[isl.id] === undefined ? target : cmGrowShown[isl.id];
  const gr = shown + (target - shown) * 0.04;
  cmGrowShown[isl.id] = Math.abs(target - gr) < 0.002 ? target : gr;
  const growing = Math.abs(target - gr) > 0.004;
  const R = (a, b, w, h, col) => cmRect(g, x + a, y + b, w, h, col);
  const leaf = { medieval: ["#2f6a2a", "#3f8a33", "#5aa840"], wizard: ["#3a2a7a", "#5a3aa8", "#8a6ad8"], harvest: ["#5a7a2a", "#7a9a3a", "#a8b84a"], ocean: ["#c84a6a", "#e86a8a", "#ff9ab0"], volcano: ["#5a1a1a", "#8a2a1a", "#c8401a"] }[isl.theme];
  const trunk = { medieval: "#6a4a2a", wizard: "#4a3a5a", harvest: "#7a5a3a", ocean: "#b86a7a", volcano: "#2a1a1a" }[isl.theme];
  const fruit = { medieval: "#ff3b3b", wizard: "#7fe3ff", harvest: "#ffd23f", ocean: "#f0f4ff", volcano: "#ffb020" }[isl.theme];
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(x - 6 - Math.round(gr * 8), y + 1, 12 + Math.round(gr * 16), 2);
  if (gr < 0.02) {
    // a sapling in a ring of stones, waiting for its first upgrade
    [-4, -2, 2, 4].forEach((sx, k) => R(sx, k % 3 ? 0 : -1, 2, 1, "#9a948a"));
    R(0, -7, 1, 7, "#5a8a3a");
    R(-3, -6, 3, 2, leaf[1]); R(1, -8, 3, 2, leaf[1]); R(-2, -9, 2, 1, leaf[2]); R(1, -4, 2, 1, leaf[2]);
    if (Math.sin(t * 2) > 0.6) R(2, -10, 1, 1, "#fff6c4");
  } else {
    const th = 5 + Math.round(gr * 13), tw = gr > 0.55 ? 3 : gr > 0.2 ? 2 : 1;
    R(-Math.floor(tw / 2), -th, tw, th, trunk);
    if (tw > 1) R(-Math.floor(tw / 2), -th, 1, th, campShade(trunk, 0.25));
    if (gr > 0.35) { R(-3, -1, 2, 1, trunk); R(2, -1, 2, 1, trunk); }
    const reach = Math.round(2 + gr * 6);
    if (gr > 0.15) { R(-reach, -th + 2, reach, 1, trunk); R(1, -th + 3, reach, 1, trunk); }
    const sway = Math.round(Math.sin(t * 0.9) * 0.6);
    const cr = 3 + Math.round(gr * 9);
    const cy0 = -th - Math.round(cr * 0.5);
    const blob = (bx, bY, rx, ry, col) => { for (let yy = -ry; yy <= ry; yy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / (ry + 0.5)) ** 2))); R(bx - hw + sway, bY + yy, hw * 2 + 1, 1, col); } };
    blob(0, cy0 + 1, cr, Math.round(cr * 0.7), leaf[0]);
    if (gr > 0.25) { blob(-Math.round(cr * 0.7), cy0 + 2, Math.round(cr * 0.55), Math.round(cr * 0.45), leaf[0]); blob(Math.round(cr * 0.7), cy0 + 2, Math.round(cr * 0.55), Math.round(cr * 0.45), leaf[0]); }
    blob(0, cy0, Math.round(cr * 0.85), Math.round(cr * 0.6), leaf[1]);
    blob(-Math.round(cr * 0.3), cy0 - Math.round(cr * 0.3), Math.round(cr * 0.4), Math.round(cr * 0.3), leaf[2]);
    // one fruit for every tier bought on this tree
    const tiers = isl.tree.upgrades.reduce((a, u) => a + upTier(u.id), 0);
    for (let k = 0; k < tiers; k++) {
      const a = k * 2.399, rr = Math.sqrt((k + 0.5) / Math.max(1, tiers)) * cr * 0.8;
      R(Math.round(Math.cos(a) * rr) + sway, cy0 + Math.round(Math.sin(a) * rr * 0.6), 1, 1, fruit);
    }
    if (target >= 1) for (let k = 0; k < 5; k++) if (Math.sin(t * 3 + k * 1.7) > 0.7) R(Math.round(Math.cos(k * 1.3) * cr), cy0 + Math.round(Math.sin(k * 2.1) * cr * 0.6), 1, 1, "#fffbe0");
  }
  if (growing) for (let k = 0; k < 6; k++) { const a = t * 4 + k; R(Math.round(Math.cos(a) * (6 + gr * 8)), -8 - Math.round(gr * 12) + Math.round(Math.sin(a) * 5), 1, 1, "#fff6c4"); }
  // keepsakes, only once you have something they're for
  Object.entries(cmKeepsakes()).forEach(([k, on]) => {
    if (!on) return;
    if (cmSeenKeep[isl.id + k] === undefined) cmSeenKeep[isl.id + k] = t;
    const age = t - cmSeenKeep[isl.id + k];
    const [dx, dy] = CM_KEEP_AT[k];
    const X = x + dx, Y = y + dy + (age < 0.6 ? Math.round((1 - age / 0.6) * -4) : 0);
    const K = (a, b, w, h, col) => cmRect(g, X + a, Y + b, w, h, col);
    if (k === "satchel") { K(-2, -3, 5, 4, "#8a5a2a"); K(-2, -4, 5, 1, "#a87a3a"); K(0, -2, 1, 1, "#ffd23f"); K(-1, -5, 1, 1, "#6a4a1a"); K(1, -5, 1, 1, "#6a4a1a"); }
    else if (k === "trophy") { K(-2, -1, 5, 2, "#7a5a3a"); K(-1, -5, 3, 3, "#ffd23f"); K(-2, -5, 1, 1, "#ffd23f"); K(2, -5, 1, 1, "#ffd23f"); K(0, -2, 1, 1, "#d8a020"); }
    else if (k === "mirror") { K(0, -1, 1, 2, "#6a4a2a"); K(-1, -7, 3, 6, "#c8a04a"); K(0, -6, 1, 4, "#9fd8f0"); }
    else { K(-2, -1, 1, 2, "#8a6a3a"); K(2, -1, 1, 2, "#8a6a3a"); K(-2, -6, 5, 5, "#f0e8d8"); K(-1, -5, 1, 3, "#ff5a61"); K(0, -5, 1, 3, "#3ddc84"); K(1, -5, 1, 3, "#38bdf8"); }
    if (age < 1.2) for (let s = 0; s < 4; s++) { const a = t * 6 + s * 1.6; K(Math.round(Math.cos(a) * 4), -3 + Math.round(Math.sin(a) * 4), 1, 1, "#fff6c4"); }
  });
}

/* ----- The Coil: the great serpent whose body carries you between islands ----- */
const CMC_LIT = ["#0f3b22", "#1f6e3a", "#2fa85a", "#7fe08a", "#ffe08a"];
const CMC_STONE = ["#2a2e38", "#454b58", "#5d6474", "#7a8294", "#8f97a8"];
const CMC_WAKE = ["#3a2a18", "#6a4a24", "#9a7a3a", "#d0aa50", "#ffd23f"];

/* Points along the stretch from island i's bridge to island i+1's home; -1 is the tail rising out of the clouds */
const cmCoilCache = {};
function coilSamples(i) {
  if (cmCoilCache[i]) return cmCoilCache[i];
  let a, b;
  if (i < 0) {
    const h = cmPos(CAMP.islands[0].id, "home", 0);
    a = { x: h.x - 150, y: CM_H - 6 }; b = { x: h.x - 22, y: h.y + 6 };
  } else {
    const p = cmPos(CAMP.islands[i].id, "bridge", 0), q = cmPos(CAMP.islands[i + 1].id, "home", 0);
    a = { x: p.x, y: p.y - 4 }; b = { x: q.x + (q.x > p.x ? -22 : 22), y: q.y + 6 };
  }
  const dir = b.x > a.x ? 1 : -1;
  const c1 = { x: a.x - dir * 70, y: a.y - 60 }, c2 = { x: b.x - dir * 90, y: b.y + 70 };
  const raw = [];
  for (let k = 0; k <= 400; k++) {
    const t = k / 400, u = 1 - t;
    raw.push({ x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y });
  }
  // even spacing, about one sample per map pixel, with normals for the body's width
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

const coilW = (s, L) => 3 + Math.round(4 * Math.min(1, s / 30, (L - s) / 30));

/* Stretch i is lit once island i+1 is open; the stretch ahead of you stirs */
function coilState(i) {
  if (i < 0) return "lit";
  if (campIslandOpen(CAMP.islands[i + 1].id)) return "lit";
  return campIslandOpen(CAMP.islands[i].id) ? "wake" : "stone";
}

const cmCoilArt = {};
function cmCoilBody(i) {
  const st = coilState(i);
  const key = i + ":" + st;
  if (cmCoilArt[key]) return cmCoilArt[key];
  const c = document.createElement("canvas");
  c.width = CM_W; c.height = CM_H;
  const g = c.getContext("2d");
  const S = coilSamples(i), L = S.length;
  const pal = st === "lit" ? CMC_LIT : st === "wake" ? CMC_WAKE : CMC_STONE;
  g.fillStyle = "rgba(10,8,30,0.22)";
  S.forEach(p => { const w = coilW(p.s, L); g.fillRect(Math.round(p.x - w / 2 + 2), Math.round(p.y - w / 2 + 3), w, w); });
  S.forEach(p => {
    const w = coilW(p.s, L), half = w / 2;
    for (let o = -half; o <= half; o += 0.5) {
      const edge = Math.abs(o) / (half || 1);
      const lightSide = o * Math.sign(p.ny || 1) < 0;
      let shade = edge > 0.82 ? 0 : edge > 0.55 ? 1 : lightSide ? 3 : 2;
      if (Math.floor((p.s + (o > 0 ? 2 : 0)) / 4) % 2 && shade > 1) shade -= 1;
      if (Math.abs(o) < 0.6 && Math.floor(p.s / 3) % 2 === 0 && shade >= 2) shade = 4;
      g.fillStyle = pal[shade];
      if (st === "stone") g.globalAlpha = 0.7;
      g.fillRect(Math.round(p.x + p.nx * o), Math.round(p.y + p.ny * o), 1, 1);
      g.globalAlpha = 1;
    }
  });
  cmCoilArt[key] = c;
  return c;
}

let cmCoilSeen = null, cmCoilSurge = null;
function cmDrawCoil(g, t) {
  for (let i = -1; i < CAMP.islands.length - 1; i++) {
    g.drawImage(cmCoilBody(i), 0, 0);
    const S = coilSamples(i), st = coilState(i);
    if (st === "lit") {
      for (let k = 0; k * 40 < S.length; k++) {
        const head = Math.floor((t * 30 + k * 40) % S.length);
        for (let j = 0; j < 7; j++) {
          const p = S[head - j];
          if (!p) break;
          g.fillStyle = `rgba(255,240,170,${(1 - j / 7) * 0.85})`;
          const w = Math.max(1, coilW(p.s, S.length) - 3);
          g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - w / 2), w, w);
        }
      }
      for (let k = 0; k < 6; k++) { const p = S[Math.floor(cmHash(k, Math.floor(t * 1.5) + i + 9, 17) * S.length)]; if (p && Math.sin(t * 6 + k) > 0.4) cmRect(g, p.x, p.y - 1, 1, 1, "#fffbe0"); }
    } else if (st === "wake") {
      const glow = 0.35 + 0.35 * Math.sin(t * 2.4);
      for (let k = 0; k < S.length; k += 3) { const p = S[k]; if (Math.floor((p.s - t * 14) / 5) % 3) continue; g.fillStyle = `rgba(255,210,63,${glow})`; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    }
  }
  // a surge of light runs up a stretch the moment it wakes
  const litNow = CAMP.islands.filter(isl => campIslandOpen(isl.id)).length;
  if (cmCoilSeen !== null && litNow > cmCoilSeen) cmCoilSurge = { i: litNow - 2, at: t };
  cmCoilSeen = litNow;
  if (cmCoilSurge) {
    const S = coilSamples(cmCoilSurge.i), k = (t - cmCoilSurge.at) / 2;
    if (k >= 1.3) cmCoilSurge = null;
    else {
      const at = Math.floor(S.length * Math.min(1, k));
      for (let j = 0; j < 30; j++) { const p = S[at - j]; if (!p) break; const w = coilW(p.s, S.length) + 2; g.fillStyle = `rgba(255,250,210,${(1 - j / 30) * Math.min(1, (1.3 - k) * 3)})`; g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - w / 2), w, w); }
    }
  }
}

/* The head rests by the last island: its eyes open once the Cinder Crown is beaten */
function cmDrawCoilHead(g, t) {
  const last = CAMP.islands[CAMP.islands.length - 1];
  const p = cmPos(last.id, "bridge", t);
  const awake = campWon(last.id, LEVEL_COUNT);
  const pal = awake ? CMC_LIT : CMC_STONE;
  const x = Math.round(p.x + 36), y = Math.round(p.y - 8);
  const R = (dx, dy, w, h, c) => cmRect(g, x + dx, y + dy, w, h, c);
  for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 1.6 + 1.2; R(Math.round(Math.cos(a) * 9) - 4, Math.round(Math.sin(a) * 4) + 8, 4, 3, k % 4 < 2 ? pal[2] : pal[1]); }
  const jaw = awake ? Math.max(0, Math.round(Math.sin(t * 0.9) * 2)) : 0;
  R(-13, -4, 15, 7, pal[1]); R(-12, -5, 12, 1, pal[2]); R(-14, -3, 2, 5, pal[1]);
  R(-11, -4, 10, 2, pal[3]); R(-9, -5, 3, 1, pal[4]);
  R(-14, 3 + jaw, 13, 2, pal[1]); R(-13, 3 + jaw, 11, 1, pal[2]);
  if (jaw) { R(-13, 3, 11, jaw, "#2a0a12"); for (let k = 0; k < 4; k++) R(-12 + k * 3, 3, 1, 1, "#e8e0c8"); }
  R(-15, -2, 1, 1, "#0a0a12"); R(-15, 0, 1, 1, "#0a0a12");
  if (!awake || (t % 6) < 0.15) R(-7, -3, 3, 1, "#0a0a12");
  else { g.fillStyle = `rgba(255,210,63,${0.25 + 0.2 * Math.sin(t * 3)})`; g.fillRect(x - 10, y - 6, 9, 7); R(-8, -4, 3, 3, "#ffd23f"); R(-7, -4, 1, 3, "#0a0a12"); }
  if (awake && Math.sin(t * 2.2) > 0.6) { R(-19, 1, 5, 1, "#ff3b6b"); R(-21, 0, 2, 1, "#ff3b6b"); R(-21, 2, 2, 1, "#ff3b6b"); }
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
    if (z < 7) {
      const [x, y] = cmToScreen(c[0] - 118, c[1] - CM_MAIN.th - 22);
      const fs = Math.max(13, Math.min(26, z * 4.2));
      g.font = `700 ${fs}px 'Pixelify Sans', system-ui, sans-serif`;
      const text = open ? `${isl.n}. ${isl.name}` : `${isl.n}. ${isl.name} · in the clouds`;
      const w = g.measureText(text).width + fs * 1.4;
      g.fillStyle = "rgba(10,14,24,0.62)";
      g.fillRect(x - w / 2, y - fs * 0.8, w, fs * 1.6);
      g.fillStyle = isl.colors.accent;
      g.fillRect(x - w / 2, y + fs * 0.8 - 2, w, 2);
      g.fillStyle = open ? "#ffffff" : "#aab0ba";
      g.fillText(text, x, y);
    }
    if (!open) return;
    Object.keys(CM_NODES).forEach(k => {
      const node = isNaN(+k) ? k : +k;
      const p = cmPos(isl.id, node, t);
      const st = cmNodeState(isl.id, node);
      const sel = cmSel && cmSel.isl === isl.id && cmSel.node === node;
      const hov = cmHover && cmHover.isl === isl.id && cmHover.node === node;
      const [x, y] = cmToScreen(p.x, p.y);
      if (st === "next") {
        const pul = 0.5 + 0.5 * Math.sin(t * 4);
        g.strokeStyle = `rgba(255,236,120,${0.5 + 0.5 * pul})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y - z, (6 + pul * 1.5) * z, (3.2 + pul) * z, 0, 0, Math.PI * 2); g.stroke();
      }
      if (sel || hov) {
        g.strokeStyle = sel ? "#ffffff" : "rgba(255,255,255,0.6)";
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        g.lineDashOffset = -t * 20;
        const rx = (node === "home" ? 14 : 7.5) * z;
        g.beginPath(); g.ellipse(x, y - (node === "home" ? 6 : 1) * z, rx, rx * 0.55, 0, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
      }
      if (typeof node === "number" && z >= 3) {
        const fs = Math.max(10, Math.min(16, z * 1.9));
        g.font = `700 ${fs}px 'Pixelify Sans', system-ui, sans-serif`;
        g.fillStyle = "rgba(0,0,0,0.6)";
        g.fillText(String(node), x + 1, y + 3.4 * z + 1);
        g.fillStyle = st === "won" ? "#ffe8a0" : st === "locked" ? "#c8ccd4" : "#ffffff";
        g.fillText(String(node), x, y + 3.4 * z);
      }
    });
  });
  g.restore();
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
