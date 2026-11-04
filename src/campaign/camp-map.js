/* =========================================================
   src/campaign/camp-map.js
   The world map: five big islands strung along the Coil.
   Every island uses the same path:
     home base (0) -> 1 2 3 4 -> boss 5 -+-> 6 7 8 9 -> boss 10 -+-> 11 12 13 14 -> boss 15 -+-> bridge
                                         '-> merchant            '-> challenger              '-> bank
   Drag to look around, scroll or pinch to zoom, click a node for details.
   ========================================================= */
"use strict";

const CM_W = 2000, CM_H = 1560;
const CM_CENTERS = [[470, 1300], [1420, 1110], [560, 780], [1460, 520], [620, 230]];
/* One island's path, around its middle. Every island is laid out the same way. */
const CM_NODES = {
  base: [-205, 92],
  1: [-140, 120], 2: [-82, 132], 3: [-22, 124], 4: [38, 108], 5: [104, 76],
  merchant: [178, 112],
  6: [76, 14], 7: [16, -4], 8: [-44, 2], 9: [-104, -18], 10: [-164, -52],
  challenger: [-226, -10],
  11: [-118, -96], 12: [-58, -118], 13: [2, -124], 14: [62, -114], 15: [124, -86],
  banker: [194, -130], bridge: [214, -40]
};
const CM_PATH = ["base", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const CM_BRANCH = [[5, "merchant"], [10, "challenger"], [15, "banker"], [15, "bridge"]];

let cmCanvas = null, cmG = null;
let cmCam = { x: CM_CENTERS[0][0], y: CM_CENTERS[0][1], z: 1.6 };
let cmSel = null;            // { isl, node }
let cmHover = null;
let cmDrag = null;
let cmGlide = null;
let cmRaf = 0;
const cmIslandArt = new Map();

const cmWorld = (isl, node) => {
  const c = CM_CENTERS[campIslandIdx(isl)];
  const p = CM_NODES[node];
  return { x: c[0] + p[0], y: c[1] + p[1] };
};

function openCampMap(focus) {
  if (!camp) loadCamp();
  applyCampCosmetics();
  openScreen("camp");
  cmLayout();
  const isl = focus && focus.isl ? focus.isl : camp.at;
  const n = focus && focus.node ? focus.node : (campNextLevel(isl) || 15);
  const p = cmWorld(isl, n);
  const c = CM_CENTERS[campIslandIdx(isl)];
  cmCam = { x: (c[0] * 2 + p.x) / 3 + 40, y: (c[1] * 2 + p.y) / 3, z: cmDefaultZoom() };
  cmClamp();
  cmSel = null;
  cmCard();
  cmTopbar();
  cancelAnimationFrame(cmRaf);
  cmRaf = requestAnimationFrame(cmLoop);
  if (!camp.named) setTimeout(campAskName, 200);
  if (campLoadNote) { const t = campLoadNote; campLoadNote = ""; setTimeout(() => showToast(t), 400); }
}

const cmDefaultZoom = () => Math.max(0.9, Math.min(2.4, Math.min(window.innerWidth / 680, window.innerHeight / 540)));

function cmLayout() {
  if (!cmCanvas) {
    cmCanvas = document.getElementById("cm-canvas");
    cmG = cmCanvas.getContext("2d");
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
  const minZ = Math.max(w / CM_W, h / CM_H) * 1.02;
  cmCam.z = Math.max(minZ, Math.min(4, cmCam.z));
  const hw = w / 2 / cmCam.z, hh = h / 2 / cmCam.z;
  cmCam.x = Math.max(hw, Math.min(CM_W - hw, cmCam.x));
  cmCam.y = Math.max(hh, Math.min(CM_H - hh, cmCam.y));
}

const cmToScreen = (x, y) => {
  const w = cmCanvas.clientWidth, h = cmCanvas.clientHeight;
  return [(x - cmCam.x) * cmCam.z + w / 2, (y - cmCam.y) * cmCam.z + h / 2];
};
const cmToWorld = (sx, sy) => {
  const w = cmCanvas.clientWidth, h = cmCanvas.clientHeight;
  return [(sx - w / 2) / cmCam.z + cmCam.x, (sy - h / 2) / cmCam.z + cmCam.y];
};

/* ----- Input ----- */
function cmBindInput() {
  const el = cmCanvas;
  const pointers = new Map();
  el.addEventListener("pointerdown", e => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cmGlide = null;
    if (pointers.size === 1) cmDrag = { x: e.clientX, y: e.clientY, cx: cmCam.x, cy: cmCam.y, moved: 0, t: performance.now(), vx: 0, vy: 0, lx: e.clientX, ly: e.clientY };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cmDrag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), z: cmCam.z, moved: 99 };
    }
  });
  el.addEventListener("pointermove", e => {
    const rect = el.getBoundingClientRect();
    if (!pointers.has(e.pointerId)) { cmHover = cmHit(e.clientX - rect.left, e.clientY - rect.top); el.style.cursor = cmHover ? "pointer" : "grab"; return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!cmDrag) return;
    if (cmDrag.pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cmCam.z = cmDrag.z * Math.hypot(a.x - b.x, a.y - b.y) / cmDrag.pinch;
      cmClamp();
      return;
    }
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
    const rect = el.getBoundingClientRect();
    if (cmDrag.moved < 6 && !cmDrag.pinch) {
      const hit = cmHit(e.clientX - rect.left, e.clientY - rect.top);
      cmSelect(hit);
    } else if (!cmDrag.pinch && performance.now() - cmDrag.t < 80) {
      cmGlide = { vx: cmDrag.vx, vy: cmDrag.vy };
    }
    cmDrag = null;
    el.style.cursor = "grab";
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const [wx, wy] = cmToWorld(sx, sy);
    cmCam.z *= Math.exp(-e.deltaY * 0.0015);
    cmClamp();
    const [nx, ny] = cmToWorld(sx, sy);
    cmCam.x += wx - nx; cmCam.y += wy - ny;
    cmClamp();
  }, { passive: false });
  el.addEventListener("dblclick", e => {
    const rect = el.getBoundingClientRect();
    const [wx, wy] = cmToWorld(e.clientX - rect.left, e.clientY - rect.top);
    cmFly(wx, wy, cmCam.z > cmDefaultZoom() * 1.3 ? cmDefaultZoom() * 0.7 : cmDefaultZoom() * 1.6);
  });
}

function cmFly(x, y, z) {
  cmGlide = { to: { x, y, z: z || cmCam.z }, from: { ...cmCam }, t0: performance.now(), ms: 520 };
}

/* What's under a point on screen */
function cmHit(sx, sy) {
  let best = null, bestD = 1e9;
  CAMP.islands.forEach(isl => {
    Object.keys(CM_NODES).forEach(k => {
      const node = isNaN(+k) ? k : +k;
      const p = cmWorld(isl.id, node);
      const [x, y] = cmToScreen(p.x, p.y);
      const r = (node === "base" ? 26 : 17) * cmCam.z;
      const d = Math.hypot(sx - x, sy - y);
      if (d < r && d < bestD) { best = { isl: isl.id, node }; bestD = d; }
    });
  });
  return best;
}

/* ----- Node states ----- */
function cmNodeState(isl, node) {
  if (!campIslandOpen(isl)) return "fog";
  if (node === "base") return "open";
  if (typeof node === "number") {
    if (campWon(isl, node)) return "won";
    return campLevelOpen(isl, node) ? "next" : "locked";
  }
  return campShopOpen(isl, node) ? "open" : "locked";
}

function cmSelect(hit) {
  if (!hit) { cmSel = null; cmCard(); return; }
  const st = cmNodeState(hit.isl, hit.node);
  if (st === "fog") { showToast(`${CAMP.islandById[hit.isl].name} is across the sea. Beat the last boss before it to open the bridge.`); sfx("bad"); return; }
  cmSel = hit;
  camp.at = hit.isl;
  sfx("tab");
  cmCard();
  cmTopbar();
}

/* ----- The details card for the selected node ----- */
function cmCard() {
  const el = document.getElementById("cm-card");
  if (!cmSel) { el.classList.remove("open"); el.innerHTML = ""; return; }
  const { isl, node } = cmSel;
  const I = CAMP.islandById[isl];
  const st = cmNodeState(isl, node);
  let html = "";
  if (node === "base") {
    html = `<div class="cm-kind">Home base</div><h3>${I.tree.name}</h3>
      <p>Every island has one. The upgrade tree, your satchel, your trophies, skins and themes all live here.</p>
      <div class="cm-actions"><button class="btn btn-primary" data-cm="base">Visit</button></div>`;
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
      <div class="cm-actions">${st === "locked" ? `<span class="cm-lock">Win level ${node - 1} first</span>` : `<button class="btn btn-primary" data-cm="play" data-autofocus>${first ? "Play" : "Play again"}</button>`}<button class="btn" data-cm="satchel">Satchel</button></div>`;
  } else {
    const who = node === "bridge" ? null : I.npcs[node];
    const after = SHOP_AFTER[node];
    if (node === "bridge") {
      const next = CAMP.islands[campIslandIdx(isl) + 1];
      html = `<div class="cm-kind">Bridge</div><h3>${next ? "To " + next.name : "The Coil's Head"}</h3>
        <p>${next ? next.blurb : "The end of the road. The Coil rests its head here, and so may you."}</p>
        <div class="cm-actions">${st === "locked" ? `<span class="cm-lock">Beat level ${after} first</span>` : next ? `<button class="btn btn-primary" data-cm="cross">Cross</button>` : ""}</div>`;
    } else {
      html = `<div class="cm-kind">${{ merchant: "Merchant", challenger: "Challenger", banker: "Bank" }[node]}</div><h3>${who.shop}</h3>
        <canvas class="cm-portrait" width="96" height="96"></canvas>
        <p class="cm-who"><strong>${who.name}</strong> “${who.line}”</p>
        <div class="cm-actions">${st === "locked" ? `<span class="cm-lock">Opens after level ${after}</span>` : `<button class="btn btn-primary" data-cm="shop" data-autofocus>Go in</button>`}</div>`;
    }
  }
  el.innerHTML = `<button class="cm-x" data-cm="close" aria-label="Close">×</button>` + html;
  el.classList.add("open");
  const pc = el.querySelector(".cm-portrait");
  if (pc) { const g = pc.getContext("2d"); g.imageSmoothingEnabled = false; drawPortraitCard(g, CAMP.islandById[isl].npcs[node].look, 96, CAMP.islandById[isl]); }
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
  if (a === "close") { cmSel = null; cmCard(); return; }
  if (a === "play") { sfx("click"); campStart(isl, node); return; }
  if (a === "satchel") { openSatchel(() => cmCard()); return; }
  if (a === "base") { openCampBase(isl); return; }
  if (a === "shop") { openCampShop(isl, node); return; }
  if (a === "cross") {
    const next = CAMP.islands[campIslandIdx(isl) + 1];
    if (!next) return;
    camp.at = next.id;
    saveCamp();
    const p = cmWorld(next.id, campNextLevel(next.id) || 1);
    cmSel = { isl: next.id, node: "base" };
    cmFly(p.x, p.y, cmCam.z);
    cmCard();
    cmTopbar();
    sfx("whoosh");
  }
}

/* The gear you'd take into a level, at a glance */
function campLoadoutStrip() {
  const cells = CAMP.slots.map(s => {
    const it = campEquipped(s.id);
    return `<span class="cm-slot" title="${s.name}: ${it ? campItemName(it) : "none"}">${it ? campItemIconHtml(it, "small") : `<span class="ci-icon small empty"></span>`}</span>`;
  }).join("");
  return `<div class="cm-loadout"><span>Taking</span>${cells}</div>`;
}

/* Wallets along the top */
function cmTopbar() {
  const el = document.getElementById("cm-wallet");
  if (!el) return;
  const open = CAMP.islands.filter(i => campIslandOpen(i.id));
  el.innerHTML = open.map(i => `<span class="cm-coin ${i.id === camp.at ? "here" : ""}" title="${i.currency.plural}">${coinIconHtml(i.id)}${fmtInt(campWallet(i.id))}<small>${i.currency.short}</small></span>`).join("") +
    `<span class="cm-coin gems" title="Gems">${gemIconHtml()}${fmtInt(camp.gems)}</span>`;
  document.getElementById("cm-island").textContent = CAMP.islandById[camp.at].name;
}

/* ----- Drawing ----- */
function cmLoop(ts) {
  if (currentScreen !== "camp") return;
  cmRaf = requestAnimationFrame(cmLoop);
  if (cmGlide) {
    if (cmGlide.to) {
      const t = Math.min(1, (ts - cmGlide.t0) / cmGlide.ms), e = 1 - Math.pow(1 - t, 3);
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
  cmDraw(ts);
}

function cmDraw(ts) {
  const g = cmG, dpr = +cmCanvas.dataset.dpr || 1;
  const w = cmCanvas.clientWidth, h = cmCanvas.clientHeight;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the sea, deeper toward the far islands
  const sea = g.createLinearGradient(0, 0, 0, h);
  const top = cmToWorld(0, 0)[1] / CM_H;
  sea.addColorStop(0, mixHex("#0e1a3a", "#1a5a8a", Math.max(0, Math.min(1, top))));
  sea.addColorStop(1, mixHex("#0e1a3a", "#2a7aa8", Math.max(0, Math.min(1, cmToWorld(0, h)[1] / CM_H))));
  g.fillStyle = sea;
  g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(cmCam.z, cmCam.z);
  g.translate(-cmCam.x, -cmCam.y);
  g.imageSmoothingEnabled = false;
  cmDrawWaves(g, ts);
  for (let i = 0; i < CAMP.islands.length - 1; i++) cmDrawCoil(g, i, ts);
  cmDrawCoilHead(g, ts);
  CAMP.islands.forEach((isl, i) => {
    const c = CM_CENTERS[i];
    const art = cmArt(isl, i);
    g.drawImage(art, c[0] - 300, c[1] - 230, 600, 460);
    cmDrawPaths(g, isl, ts);
    Object.keys(CM_NODES).forEach(k => cmDrawNode(g, isl, isNaN(+k) ? k : +k, ts));
    cmDrawLabel(g, isl, c);
    if (!campIslandOpen(isl.id)) cmDrawFog(g, c, ts, i);
  });
  g.restore();
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function cmDrawWaves(g, ts) {
  const [x0, y0] = cmToWorld(0, 0), [x1, y1] = cmToWorld(cmCanvas.clientWidth, cmCanvas.clientHeight);
  g.fillStyle = "rgba(255,255,255,0.10)";
  const step = 46;
  for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
    for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
      const k = (x * 7 + y * 13) % 97;
      const ph = (ts / 1600 + k / 97) % 1;
      if (ph > 0.5) continue;
      g.globalAlpha = Math.sin(ph * 2 * Math.PI) * 0.5;
      g.fillRect(x + (k % 23), y + (k % 17), 8 + (k % 6), 2);
    }
  }
  g.globalAlpha = 1;
}

/* ----- Island terrain and props, drawn once ----- */
function cmArt(isl, idx) {
  const key = isl.id + ":" + (campIslandOpen(isl.id) ? 1 : 0);
  if (cmIslandArt.has(key)) return cmIslandArt.get(key);
  const W = 600, H = 460, S = 2;
  const c = document.createElement("canvas");
  c.width = W * S; c.height = H * S;
  const g = c.getContext("2d");
  g.scale(S, S);
  const rng = seededRandom(seedFromText("island-" + isl.id));
  const C = isl.colors;
  const cx = W / 2, cy = H / 2;
  // a lumpy outline
  const pts = [];
  const lumps = [rng() * 6, rng() * 6, rng() * 6];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 40) {
    const r = 1 + 0.06 * Math.sin(a * 3 + lumps[0]) + 0.04 * Math.sin(a * 5 + lumps[1]) + 0.03 * Math.sin(a * 9 + lumps[2]);
    pts.push([cx + Math.cos(a) * 272 * r, cy + Math.sin(a) * 194 * r]);
  }
  const blob = (grow, fill) => {
    g.beginPath();
    pts.forEach(([x, y], i) => { const X = cx + (x - cx) * grow, Y = cy + (y - cy) * grow; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  blob(1.08, "rgba(255,255,255,0.12)");   // surf
  blob(1.04, isl.theme === "volcano" ? "#3a2420" : "#e8d8a0");   // beach
  blob(1.0, C.edge);
  blob(0.96, C.grass);
  // texture
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.92;
    const x = cx + Math.cos(a) * 272 * r, y = cy + Math.sin(a) * 194 * r;
    g.fillStyle = rng() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
    g.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(rng() * 3), 2);
  }
  // props, kept off the path
  const nodePts = Object.values(CM_NODES).map(([x, y]) => [cx + x, cy + y]);
  const clear = (x, y, r) => nodePts.every(([a, b]) => Math.hypot(a - x, b - y) > r);
  const inside = (x, y) => ((x - cx) / 255) ** 2 + ((y - cy) / 178) ** 2 < 1;
  const props = [];
  for (let i = 0; i < 260 && props.length < 46; i++) {
    const x = cx + (rng() * 2 - 1) * 260, y = cy + (rng() * 2 - 1) * 180;
    if (!inside(x, y) || !clear(x, y, 30) || props.some(p => Math.hypot(p[0] - x, p[1] - y) < 22)) continue;
    props.push([x, y, rng()]);
  }
  props.sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => cmProp(g, isl.theme, x, y, r, C));
  // the landmark, in the empty middle-right
  g.save();
  g.translate(cx + 236, cy + 64);
  g.scale(0.62, 0.62);
  cmLandmark(g, isl.theme, 0, 0, C);
  g.restore();
  if (!campIslandOpen(isl.id)) {
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  }
  cmIslandArt.set(key, c);
  return c;
}

function cmProp(g, theme, x, y, r, C) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  if (theme === "medieval") {
    if (r < 0.55) { R(-1, -2, 3, 6, "#5a3a20"); R(-6, -12, 13, 10, "#3f7a2a"); R(-4, -15, 9, 4, "#4f8f33"); }
    else if (r < 0.75) { R(-5, -8, 10, 8, "#c8b898"); R(-6, -11, 12, 3, "#a83a2a"); R(-1, -5, 2, 5, "#5a3a20"); }
    else if (r < 0.88) { R(0, -14, 1, 14, "#5a3a20"); R(1, -14, 7, 5, "#c8323a"); }
    else { R(-4, -3, 8, 4, "#e8e0c8"); R(-3, -5, 6, 2, "#e8e0c8"); R(3, -6, 2, 2, "#e8e0c8"); }
  } else if (theme === "wizard") {
    if (r < 0.4) { for (let j = 0; j < 12; j++) R(-Math.floor(j / 3), -j, 1 + Math.floor(j / 3) * 2, 1, j > 9 ? "#d8b0ff" : "#8a6ad8"); }
    else if (r < 0.65) { R(-1, -2, 3, 6, "#3a2a5a"); R(-6, -12, 13, 10, "#2a5a6a"); R(-3, -14, 7, 3, "#3a7a8a"); R(-3, -9, 2, 2, "#ffe86a"); }
    else if (r < 0.85) { R(-5, -4, 10, 6, "#7a4a2a"); R(-4, -6, 8, 2, "#e8e0c8"); R(3, -9, 3, 3, "#b36bff"); }
    else { R(-2, -10, 4, 10, "#4a4a70"); R(-3, -12, 6, 2, "#6a6aa0"); R(-1, -8, 2, 2, "#7fe3ff"); }
  } else if (theme === "harvest") {
    if (r < 0.45) { R(-1, -2, 3, 6, "#6a4a2a"); R(-6, -12, 13, 10, "#5a8a2a"); R(-3, -9, 2, 2, "#ff3b3b"); R(2, -7, 2, 2, "#ff8c1a"); }
    else if (r < 0.65) { R(-6, -6, 12, 6, "#e8c060"); R(-4, -8, 8, 2, "#f0d070"); }
    else if (r < 0.82) { R(-1, -12, 2, 12, "#6a4a2a"); R(-5, -9, 10, 2, "#6a4a2a"); R(-3, -14, 6, 3, "#e8c060"); }
    else { R(-3, -6, 6, 6, "#e0a820"); R(-2, -7, 4, 1, "#c08a10"); R(-1, -3, 2, 1, "#3a2a10"); }
  } else if (theme === "ocean") {
    if (r < 0.4) { R(-1, -12, 2, 12, "#ff7a8a"); R(-5, -9, 4, 2, "#ff7a8a"); R(2, -7, 4, 2, "#ff7a8a"); R(-5, -11, 2, 2, "#ff7a8a"); }
    else if (r < 0.65) { for (let j = 0; j < 10; j++) R(Math.round(Math.sin(j * 0.8) * 2), -j, 2, 1, "#2a9a5a"); }
    else if (r < 0.85) { R(-4, -4, 8, 4, "#ffc8b8"); R(-2, -6, 4, 2, "#ffd8c8"); }
    else { R(-6, -3, 12, 3, "#c8b080"); R(-3, -5, 2, 2, "#c8b080"); }
  } else {
    if (r < 0.4) { R(-5, -4, 10, 4, "#2a2028"); R(-3, -6, 6, 2, "#3a3040"); R(-1, -5, 2, 1, "#ff6a1a"); }
    else if (r < 0.65) { R(-1, -2, 2, 4, "#2a1a1a"); R(-3, -8, 6, 6, "#1a1014"); R(-1, -10, 2, 2, "#1a1014"); }
    else if (r < 0.85) { R(-4, -2, 8, 2, "#ff6a1a"); R(-2, -3, 4, 1, "#ffd23f"); }
    else { R(-2, -8, 4, 8, "#4a3a40"); R(-1, -9, 2, 1, "#ff9a3a"); }
  }
}

function cmLandmark(g, theme, x, y, C) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  if (theme === "medieval") {
    R(-30, -40, 60, 40, "#a8a098"); R(-36, -58, 16, 58, "#b8b0a8"); R(20, -58, 16, 58, "#b8b0a8");
    for (let i = 0; i < 4; i++) { R(-36 + i * 4, -62, 2, 4, "#b8b0a8"); R(20 + i * 4, -62, 2, 4, "#b8b0a8"); }
    R(-8, -18, 16, 18, "#5a3a20"); R(-30, -44, 60, 4, "#c8c0b8");
    R(-29, -74, 2, 16, "#5a3a20"); R(-27, -74, 10, 6, "#d9b44a"); R(27, -74, 2, 16, "#5a3a20"); R(29, -74, 10, 6, "#c8323a");
  } else if (theme === "wizard") {
    R(-10, -90, 20, 90, "#5a5a90"); R(-14, -96, 28, 8, "#4a4a80"); for (let j = 0; j < 14; j++) R(-12 + j, -110 + j, 24 - j * 2, 1, "#3a3a8a");
    R(-4, -70, 8, 8, "#ffe86a"); R(-4, -40, 8, 8, "#ffe86a"); R(-20, -6, 40, 6, "#4a4a80");
  } else if (theme === "harvest") {
    R(-34, -30, 40, 30, "#a83a2a"); R(-38, -46, 48, 16, "#8a2a1a"); R(-18, -16, 10, 16, "#5a3a20");
    R(10, -50, 14, 50, "#c8b080"); R(6, -56, 22, 8, "#a89060");
    for (let i = 0; i < 4; i++) { const a = performance.now ? 0 : 0; R(14, -58 - i * 0, 2, 2, "#c8b080"); }
  } else if (theme === "ocean") {
    R(-40, -14, 80, 14, "#6a4a2a"); R(-32, -40, 6, 26, "#5a3a20"); R(-34, -40, 30, 18, "#e8e0c8"); R(8, -50, 6, 36, "#5a3a20"); R(10, -50, 26, 20, "#e8e0c8");
    R(-44, -8, 8, 8, "#5a3a20"); R(36, -8, 8, 8, "#5a3a20");
  } else {
    for (let j = 0; j < 40; j++) R(-j * 1.5, -60 + j * 1.5, j * 3 + 6, 2, j < 6 ? "#ff6a1a" : "#3a2a30");
    R(-6, -64, 12, 6, "#ff6a1a"); R(-3, -70, 6, 6, "rgba(120,110,120,0.6)"); R(-8, -80, 10, 8, "rgba(120,110,120,0.4)");
  }
}

/* ----- The path between nodes ----- */
function cmDrawPaths(g, isl, ts) {
  const seg = (a, b) => {
    const p = cmWorld(isl.id, a), q = cmWorld(isl.id, b);
    const lit = cmNodeState(isl.id, b) !== "locked" && cmNodeState(isl.id, b) !== "fog";
    g.strokeStyle = lit ? "rgba(255,226,140,0.95)" : "rgba(40,30,20,0.45)";
    g.lineWidth = lit ? 4 : 3;
    g.setLineDash(lit ? [] : [5, 5]);
    g.beginPath(); g.moveTo(p.x, p.y);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 - 8;
    g.quadraticCurveTo(mx, my, q.x, q.y);
    g.stroke();
    if (lit) {
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(p.x, p.y - 1); g.quadraticCurveTo(mx, my - 1, q.x, q.y - 1); g.stroke();
    }
  };
  g.save();
  g.lineCap = "round";
  for (let i = 0; i < CM_PATH.length - 1; i++) seg(CM_PATH[i], CM_PATH[i + 1]);
  CM_BRANCH.forEach(([a, b]) => seg(a, b));
  g.restore();
}

/* ----- Nodes ----- */
function cmDrawNode(g, isl, node, ts) {
  const p = cmWorld(isl.id, node);
  const st = cmNodeState(isl.id, node);
  const sel = cmSel && cmSel.isl === isl.id && cmSel.node === node;
  const hov = cmHover && cmHover.isl === isl.id && cmHover.node === node;
  const dim = st === "locked" || st === "fog";
  g.save();
  g.translate(p.x, p.y);
  if (sel || hov) { g.fillStyle = sel ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)"; g.beginPath(); g.ellipse(0, 4, 22, 12, 0, 0, Math.PI * 2); g.fill(); }
  if (st === "next") {
    const pul = 0.5 + 0.5 * Math.sin(ts / 260);
    g.strokeStyle = `rgba(255,236,120,${0.5 + 0.5 * pul})`;
    g.lineWidth = 2 + pul * 2;
    g.beginPath(); g.arc(0, -2, 17 + pul * 3, 0, Math.PI * 2); g.stroke();
  }
  if (dim) g.globalAlpha = st === "fog" ? 0.75 : 0.55;
  if (node === "base") cmNodeBase(g, isl, ts);
  else if (typeof node === "number") cmNodeLevel(g, isl, node, st, ts);
  else if (node === "bridge") cmNodeBridge(g, isl, ts);
  else cmNodeShop(g, isl, node, ts);
  g.globalAlpha = 1;
  if (st === "locked" && node !== "base") {
    g.fillStyle = "#2a2e36"; g.fillRect(-4, -4, 8, 7); g.strokeStyle = "#2a2e36"; g.lineWidth = 2; g.beginPath(); g.arc(0, -5, 3, Math.PI, 0); g.stroke();
    g.fillStyle = "#ffd23f"; g.fillRect(-1, -2, 2, 2);
  }
  g.restore();
}

function cmNodeLevel(g, isl, n, st, ts) {
  const d = campLevelDef(isl.id, n);
  const boss = d.kind === "boss";
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  if (boss) {
    // a dark lair with the boss peering out
    R(-15, -14, 30, 20, "#2a2028"); R(-13, -18, 26, 4, "#3a3040"); R(-9, -21, 18, 3, "#3a3040");
    R(-10, -10, 20, 16, "#0a0608");
    const B = isl.boss;
    const blink = (ts / 1000 + n) % 3 < 0.12;
    R(-6, -5, 4, blink ? 1 : 3, B.eye); R(2, -5, 4, blink ? 1 : 3, B.eye);
    R(-15, 6, 30, 3, "#4a4048");
    if (st === "won") { R(11, -26, 2, 12, "#5a3a20"); R(13, -26, 8, 5, "#ffd23f"); }
    else { R(-2, -30, 4, 6, "#e8e0c8"); R(-4, -28, 8, 2, "#e8e0c8"); }   // a bone banner
  } else {
    const base = { static: "#c8a46a", enemy: "#c8704a", dynamic: "#5a7ad0" }[d.kind];
    const top = st === "won" ? "#ffd23f" : base;
    g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(0, 7, 14, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = campShade(base, -0.3); g.beginPath(); g.ellipse(0, 2, 14, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = top; g.beginPath(); g.ellipse(0, -1, 14, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.ellipse(-3, -4, 8, 4, 0, 0, Math.PI * 2); g.fill();
    cmGoalGlyph(g, d.goal, -6, -10, 12, ts);
    if (st === "won" && camp.levels[campLevelId(isl.id, n)] && camp.levels[campLevelId(isl.id, n)].flawless) { R(9, -12, 4, 4, "#fff"); R(10, -13, 2, 6, "#fff"); }
  }
  // number
  g.font = "700 9px 'Pixelify Sans', system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,0.6)"; g.fillText(String(n), 0.5, 16.5);
  g.fillStyle = st === "won" ? "#ffe8a0" : "#ffffff"; g.fillText(String(n), 0, 16);
}

function cmGoalGlyph(g, goal, x, y, w, ts) {
  const R = px16(g, x, y, w);
  switch (goal.type) {
    case "apples": R(4, 5, 8, 8, "#ff2b2b"); R(5, 4, 6, 1, "#ff2b2b"); R(8, 2, 1, 3, "#5a3a20"); R(9, 2, 3, 2, "#3ddc3d"); break;
    case "score": R(7, 1, 2, 14, "#fff4b0"); R(1, 6, 14, 3, "#fff4b0"); R(4, 4, 8, 8, "#fff4b0"); break;
    case "length": R(2, 10, 4, 4, "#3ddc84"); R(6, 10, 4, 4, "#2fae6a"); R(10, 6, 4, 8, "#3ddc84"); R(11, 7, 1, 1, "#000"); break;
    case "survive": R(4, 2, 8, 2, "#e8e0c8"); R(5, 4, 6, 4, "#ffd23f"); R(7, 8, 2, 1, "#ffd23f"); R(5, 9, 6, 4, "#e8e0c8"); R(4, 13, 8, 2, "#e8e0c8"); break;
    case "distance": R(2, 7, 10, 2, "#ffffff"); R(10, 4, 2, 8, "#ffffff"); R(12, 6, 2, 4, "#ffffff"); break;
    case "keys": R(2, 5, 5, 5, "#ffd23f"); R(3, 6, 3, 3, "#5a3a20"); R(7, 7, 7, 2, "#ffd23f"); R(11, 9, 2, 3, "#ffd23f"); break;
    case "buttons": R(2, 6, 12, 6, "#5a6070"); R(4, 4, 8, 3, "#3ddc84"); break;
    case "relic": drawRelicIcon(g, goal.item, x, y, w); break;
    case "shards": R(4, 5, 8, 9, "#c89a4a"); R(5, 3, 6, 3, "#8a6a2a"); R(7, 8, 2, 2, "#ffe08a"); break;
    case "thief": R(3, 7, 9, 6, "#8a6a4a"); R(9, 5, 5, 5, "#a8886a"); R(11, 6, 1, 1, "#000"); R(0, 8, 3, 1, "#6a4a2a"); break;
  }
}

function cmNodeBase(g, isl, ts) {
  const C = isl.colors;
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(0, 10, 24, 7, 0, 0, Math.PI * 2); g.fill();
  R(-3, -8, 6, 18, "#6a4a2a"); R(-6, 6, 12, 4, "#6a4a2a");
  const sway = Math.sin(ts / 900) * 1;
  g.fillStyle = campShade(C.grass, -0.25); g.beginPath(); g.ellipse(sway, -18, 22, 15, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = campShade(C.grass, 0.15); g.beginPath(); g.ellipse(sway - 5, -22, 14, 9, 0, 0, Math.PI * 2); g.fill();
  [[-10, -16], [8, -20], [2, -10], [-4, -26]].forEach(([a, b], i) => R(a + sway, b, 3, 3, i % 2 ? C.accent : "#ff3b3b"));
  // the satchel against the trunk
  R(4, 2, 7, 7, "#8a5a2a"); R(5, 1, 5, 2, "#a87a3a"); R(7, 4, 2, 2, "#ffd23f");
  g.font = "700 8px 'Pixelify Sans', system-ui, sans-serif";
  g.textAlign = "center";
  g.fillStyle = "rgba(0,0,0,0.6)"; g.fillText("HOME", 0.5, 22.5);
  g.fillStyle = "#fff"; g.fillText("HOME", 0, 22);
}

function cmNodeShop(g, isl, kind, ts) {
  const C = isl.colors;
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(0, 9, 18, 5, 0, 0, Math.PI * 2); g.fill();
  if (kind === "merchant") {
    for (let i = 0; i < 6; i++) R(-15 + i * 5, -16 + Math.abs(i - 2.5) * 1.5, 5, 6, i % 2 ? "#ffffff" : C.accent);
    R(-14, -10, 28, 18, "#7a5a3a"); R(-12, -8, 24, 10, "#2a1a10");
    R(-14, 2, 28, 4, "#a87a4a");
  } else if (kind === "challenger") {
    R(-12, -22, 2, 30, "#5a3a20"); R(10, -22, 2, 30, "#5a3a20"); R(-12, -22, 24, 3, "#5a3a20");
    R(-9, -19, 18, 14, C.accent); R(-7, -17, 14, 10, campShade(C.accent, 0.3));
    R(-3, -15, 6, 6, "#ffd23f"); R(-1, -9, 2, 3, "#ffd23f");
  } else {
    R(-14, -14, 28, 4, "#e8e0c8"); R(-12, -10, 4, 16, "#d8d0c0"); R(-2, -10, 4, 16, "#d8d0c0"); R(8, -10, 4, 16, "#d8d0c0");
    R(-15, 5, 30, 4, "#c8c0b0"); R(-10, -19, 20, 5, "#e8e0c8"); R(-2, -18, 4, 3, "#ffd23f");
  }
  // the shopkeeper leans out to say hello
  const look = isl.npcs[kind].look;
  const bob = Math.sin(ts / 500 + kind.length) * 0.8;
  drawPortrait(g, look, -2, -8 + bob, 14, ts);
}

function cmNodeBridge(g, isl, ts) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  R(-14, -2, 28, 5, "#8a6a3a");
  for (let i = 0; i < 6; i++) R(-13 + i * 5, -3, 3, 7, "#a8804a");
  R(-15, -12, 3, 16, "#6a4a2a"); R(12, -12, 3, 16, "#6a4a2a");
  R(-12, -11, 24, 2, "#c8a060");
  const t = (ts / 600) % 1;
  R(-4 + t * 8, -20, 6, 2, "#fff"); R(2 + t * 8, -22, 2, 6, "#fff");
}

function cmDrawLabel(g, isl, c) {
  const open = campIslandOpen(isl.id);
  const y = c[1] - 215;
  g.save();
  g.font = "700 18px 'Pixelify Sans', system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  const text = `${isl.n}. ${isl.name}`;
  const w = g.measureText(text).width + 28;
  g.fillStyle = "rgba(10,14,24,0.7)";
  g.fillRect(c[0] - w / 2, y - 14, w, 28);
  g.fillStyle = isl.colors.accent;
  g.fillRect(c[0] - w / 2, y + 12, w, 2);
  g.fillStyle = open ? "#ffffff" : "#9aa0aa";
  g.fillText(text, c[0], y);
  g.restore();
}

function cmDrawFog(g, c, ts, i) {
  g.save();
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + i;
    const x = c[0] + Math.cos(a) * 170 + Math.sin(ts / 3000 + k) * 14, y = c[1] + Math.sin(a) * 110 + Math.cos(ts / 3500 + k) * 8;
    g.fillStyle = "rgba(220,228,240,0.55)";
    g.beginPath(); g.ellipse(x, y, 90, 46, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "rgba(220,228,240,0.45)";
  g.beginPath(); g.ellipse(c[0], c[1], 200, 120, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

/* ----- The Coil: the great serpent whose body bridges the islands ----- */
function coilCurve(i) {
  const a = cmWorld(CAMP.islands[i].id, "bridge");
  const b = cmWorld(CAMP.islands[i + 1].id, "base");
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny);
  const bend = (i % 2 ? -1 : 1) * 160;
  const c1 = { x: a.x + (b.x - a.x) * 0.25 + nx / nl * bend, y: a.y + (b.y - a.y) * 0.25 + ny / nl * bend };
  const c2 = { x: a.x + (b.x - a.x) * 0.75 - nx / nl * bend * 0.6, y: a.y + (b.y - a.y) * 0.75 - ny / nl * bend * 0.6 };
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 1 / 90) {
    const u = 1 - t;
    pts.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
    });
  }
  return pts;
}

function cmDrawCoil(g, i, ts) {
  const pts = coilCurve(i);
  const lit = campIslandOpen(CAMP.islands[i + 1].id);
  const wake = !lit && campIslandOpen(CAMP.islands[i].id);
  g.save();
  g.lineCap = "round"; g.lineJoin = "round";
  const stroke = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); };
  stroke(30, "rgba(0,0,0,0.25)");
  stroke(26, lit ? "#1f6a3a" : wake ? "#4a4a3a" : "#3a3e48");
  stroke(18, lit ? "#2f9e5a" : wake ? "#6a6a58" : "#555a66");
  // scales
  for (let k = 2; k < pts.length - 2; k += 2) {
    const p = pts[k], q = pts[k + 1];
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    g.save(); g.translate(p.x, p.y); g.rotate(ang);
    g.fillStyle = lit ? (k % 4 ? "#3fbe6a" : "#ffd23f") : wake ? "#7a7a68" : "#6a6e7a";
    g.fillRect(-2, -3, 4, 6);
    g.restore();
  }
  if (lit) {
    // light running toward the newer island
    const n = pts.length;
    for (let s = 0; s < 3; s++) {
      const k = Math.floor(((ts / 2200 + s / 3) % 1) * n);
      const p = pts[Math.min(n - 1, k)];
      g.fillStyle = "rgba(255,240,160,0.8)";
      g.beginPath(); g.arc(p.x, p.y, 6, 0, Math.PI * 2); g.fill();
    }
  } else if (wake) {
    const p = pts[Math.floor(pts.length / 2)];
    const pul = 0.5 + 0.5 * Math.sin(ts / 400);
    g.fillStyle = `rgba(255,210,63,${0.3 + 0.5 * pul})`;
    g.fillRect(p.x - 6, p.y - 1, 12, 2); g.fillRect(p.x - 1, p.y - 6, 2, 12);
  }
  g.restore();
}

function cmDrawCoilHead(g, ts) {
  const last = CAMP.islands[CAMP.islands.length - 1];
  const p = cmWorld(last.id, "bridge");
  const done = campWon(last.id, LEVEL_COUNT);
  g.save();
  g.translate(p.x + 70, p.y - 10);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(0, 14, 44, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = done ? "#2f9e5a" : "#555a66";
  g.fillRect(-60, -6, 40, 18);
  g.fillRect(-26, -16, 48, 30);
  g.fillRect(20, -10, 18, 20);
  g.fillStyle = done ? "#3fbe6a" : "#6a6e7a";
  g.fillRect(-22, -12, 40, 8);
  g.fillStyle = done ? "#ffd23f" : "#2a2e36";
  const open = done ? 6 : 1;
  g.fillRect(-4, -8, 8, open); g.fillRect(10, -8, 6, open);
  if (done && (ts / 1000) % 3 < 0.4) { g.fillStyle = "#ff3b5a"; g.fillRect(38, 0, 10, 2); g.fillRect(46, -2, 4, 2); g.fillRect(46, 2, 4, 2); }
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
    else showToast(`Welcome, ${camp.name}. Start at the first level on Brightscale Keep.`);
  };
  document.getElementById("camp-name-ok").addEventListener("click", ok);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); ok(); } });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
