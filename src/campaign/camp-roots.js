/* =========================================================
   src/campaign/camp-roots.js
   Nightmare mode's upgrades (build 53): the roots of each island's tree.
   On the same screen as the island's own tree, behaving the same way, but
   its own picture: a slice of the island's ground with six roots growing
   under the trunk, longer, thicker and fuller tier by tier, glowing
   nodules on the ones fully grown (build 53 review). Paid in the island's
   money at deep prices (times the tunnel's depth); every root works in
   every nightmare level and never above ground. Data: nightmare.json roots.
   Opened from a tunnel's roots stop on the map (the branch between the hole
   and level 1); Back returns to the map, still around the back.
   ========================================================= */
"use strict";

let rootsIsl = null, rootsSel = null;
const ROOT_LEAVES = { keep: ["#5a3a1a", "#7a5226", "#a8783a", "#e8c86a"], spire: ["#3a2a5a", "#5a4a8a", "#8a7ac8", "#7fe3ff"],
  hollow: ["#5a2a12", "#8a4a1a", "#b8743a", "#ff9a3a"], reef: ["#2a4a4a", "#3a6a6a", "#6aa0a0", "#ff9ab0"], crown: ["#3a0a0a", "#6a1a12", "#a8341a", "#ffd23f"] };
const ROOT_BARK = ["#1e120a", "#3a2614", "#5a3a20", "#7a5232"];
const rootsList = isl => CAMP.nightmare.roots[isl].upgrades;
const rootTier = id => (camp.nm.roots[id] || 0);
const rootPrice = (isl, u) => { const t = rootTier(u.id); return t >= u.v.length ? null : u.cost[t] * (nmDepth(isl) + 1); };

function openRootsTree(isl, sel) {
  if (!nmTunnelOpen(isl)) return;
  rootsIsl = isl;
  nmIsl = isl;
  const ups = rootsList(isl);
  rootsSel = sel || (ups.find(u => rootPrice(isl, u) !== null && campWallet(isl) >= rootPrice(isl, u)) || ups[0]).id;
  nmShopReturn = isl;            // back on the map: around the back again
  mapReturnTo = isl;
  BACK_TARGET.tree = "modes";    // the island's own tree goes back home (openCampTree sets it again)
  treeArea = "roots";
  sfx("tab");
  openScreen("tree");
}

/* ----- The picture (build 53 review): real roots, not the tree upside down -----
   A slice of the island's ground: the grass along the top with the tree's trunk going up out of it,
   then the island's own soil and stone in layers, dressed in the same things as its tunnel
   (textures/map/deep/). Under the trunk, six roots: the root crown's spread just under the grass,
   two shallow roots reaching out to the sides, two deep ones off the taproot, and the taproot going
   straight down. Each is as long and as thick as its upgrade is grown (a stub pointing the way at
   tier 0), sprouts rootlets and root hairs as it grows, and bears glowing nodules once it's full.
   Its upgrade's pin rides on its tip. */
const ROOT_PARTS = ["Root crown", "Left root", "Right root", "Deep left root", "Deep right root", "Taproot"];
const ROOT_TRUNK = { x: 100, y: 22 };           // where the trunk meets its roots
/* Each root: where it leaves (a point, or a place along the taproot), the bend it makes, where its tip
   reaches when it's fully grown */
const ROOT_PATHS = [
  null,                                                                  // the root crown: its spread, drawn below
  { from: [96, 24], bend: [64, 26], to: [30, 50] },
  { from: [104, 24], bend: [138, 28], to: [170, 54] },
  { from: "tap", at: 0.36, bend: [76, 72], to: [52, 104] },
  { from: "tap", at: 0.42, bend: [126, 78], to: [148, 108] },
  { from: [100, 24], bend: [98, 80], to: [101, 138] }
];
const rootGrow = (tiers, maxes, i) => (maxes[i] ? tiers[i] / maxes[i] : 0);
const rootLen = fr => 0.3 + 0.7 * fr;
const qbez = (a, b, c, f) => { const u = 1 - f; return [u * u * a[0] + 2 * u * f * b[0] + f * f * c[0], u * u * a[1] + 2 * u * f * b[1] + f * f * c[1]]; };
/* The taproot's line as far as it's grown (never shorter than where the deep roots leave it) */
function tapReach(tiers, maxes) {
  const need = Math.max(rootGrow(tiers, maxes, 3) > 0 || tiers[3] ? ROOT_PATHS[3].at + 0.04 : 0, rootGrow(tiers, maxes, 4) > 0 || tiers[4] ? ROOT_PATHS[4].at + 0.04 : 0);
  return Math.max(rootLen(rootGrow(tiers, maxes, 5)), need, ROOT_PATHS[4].at + 0.04);
}
function rootStart(i, tiers, maxes) {
  const P = ROOT_PATHS[i];
  if (P.from !== "tap") return P.from;
  const T = ROOT_PATHS[5];
  return qbez(T.from, T.bend, T.to, P.at);
}
/* Where each root's tip is now: its pin goes there */
function rootTips(tiers, maxes) {
  return ROOT_PATHS.map((P, i) => {
    if (!P) return [ROOT_TRUNK.x, ROOT_TRUNK.y + 4];
    const L = i === 5 ? tapReach(tiers, maxes) : rootLen(rootGrow(tiers, maxes, i));
    return qbez(rootStart(i, tiers, maxes), P.bend, P.to, L);
  });
}

/* The ground, once per island: grass, soil and stone in layers, pebbles, the island's own things */
const rootsBgCache = {};
function rootsBackground(isl) {
  if (rootsBgCache[isl]) return rootsBgCache[isl];
  const c = document.createElement("canvas");
  c.width = TREE_W; c.height = TREE_H;
  const g = c.getContext("2d");
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const TH = ISLE_THEME[isl] || ISLE_THEME.keep;
  const rock = TH.rock, grass = TH.moss || TH.vine || TH.hang, seed = 31 + campIslandIdx(isl) * 7;
  const layers = [shadeHex(rock[0][0], -0.15), shadeHex(rock[0][1], -0.25), shadeHex(rock[1][0], -0.3), shadeHex(rock[1][1], -0.4), shadeHex(rock[2][0], -0.45), shadeHex(rock[2][1], -0.58)];
  // the night above the grass
  for (let y = 0; y < 12; y++) R(0, y, TREE_W, 1, shadeHex("#1a1830", -0.2 + y * 0.02));
  for (let x = 0; x < TREE_W; x++) {
    const top = 11 + Math.round(Math.sin(x * 0.18 + seed) * 1 + mapHash(x, 1, seed));
    // grass blades, then the soil and stone below in waving layers
    if (grass) { R(x, top - 1 - (mapHash(x, 2, seed) > 0.6 ? 1 : 0), 1, 2, grass[x % 2]); }
    for (let y = top + 1; y < TREE_H; y++) {
      const depth = (y - top) / (TREE_H - top);
      const wob = Math.sin(x * 0.06 + y * 0.02 + seed) * 4 + Math.sin(x * 0.17) * 1.5;
      let li = Math.min(layers.length - 1, Math.floor(depth * layers.length + wob / 22));
      li = Math.max(0, li);
      let col = layers[li];
      if (((x + y) & 1) && mapHash(x, y, seed) > 0.55) col = shadeHex(col, -0.08);
      if (mapHash(x, y, seed + 4) > 0.992) col = shadeHex(col, 0.25);
      R(x, y, 1, 1, col);
    }
    R(x, top, 1, 1, shadeHex(layers[0], 0.15));
  }
  // pebbles and stones, lit from the top left
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(mapHash(i, 3, seed) * TREE_W), y = 18 + Math.floor(mapHash(i, 4, seed) * (TREE_H - 20)), w = 2 + Math.floor(mapHash(i, 5, seed) * 3);
    R(x, y, w, 2, shadeHex(layers[3], 0.25)); R(x, y, w, 1, shadeHex(layers[3], 0.45)); R(x + w - 1, y + 1, 1, 1, shadeHex(layers[5], -0.2));
  }
  // the island's own things, in the soil away from where the roots grow
  const look = (typeof DEEP_LOOK !== "undefined" && DEEP_LOOK[isl]) || { stat: [], anim: [] };
  const things = look.stat.concat(look.anim).filter(id => id !== "stalagmite");
  const tips = ROOT_PATHS.map((P, i) => P ? [P.to, P.bend] : [[100, 24], [100, 24]]).flat();
  let placed = 0;
  for (let i = 0; i < 200 && placed < 16 && things.length; i++) {
    const x = 8 + Math.floor(mapHash(i, 6, seed) * (TREE_W - 16)), y = 30 + Math.floor(mapHash(i, 7, seed) * (TREE_H - 36));
    if (Math.abs(x - 100) < 14 || tips.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 16)) continue;
    texDrawAt(g, "deep:" + things[Math.floor(mapHash(i, 8, seed) * things.length)], x, y);
    placed++;
  }
  // the trunk going up out of the ground
  for (let y = 0; y <= 14; y++) {
    const w = 12 + Math.max(0, y - 9);
    R(100 - w / 2, y, w, 1, ROOT_BARK[2]); R(100 - w / 2, y, 1, 1, ROOT_BARK[3]); R(100 + w / 2 - 1, y, 1, 1, ROOT_BARK[0]);
    if (y % 4 === 1) R(98, y, 1, 3, ROOT_BARK[1]);
  }
  return (rootsBgCache[isl] = c);
}

/* The roots themselves, again only when they've grown */
const rootsArtCache = {};
function rootsArt(isl, tiers, maxes) {
  const tag = isl + ":" + tiers.join(",");
  if (rootsArtCache.tag === tag) return rootsArtCache.c;
  const c = rootsArtCache.c || document.createElement("canvas");
  c.width = TREE_W; c.height = TREE_H;
  const g = c.getContext("2d");
  g.clearRect(0, 0, TREE_W, TREE_H);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const B = ROOT_BARK, seed = 7 + campIslandIdx(isl);
  // a round dab of root, lit on its top and shaded underneath
  const dab = (x, y, w) => {
    const r = Math.max(0.5, w / 2);
    for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      R(x - half, y + dy, half * 2 + 1, 1, dy < -r / 3 ? B[3] : dy > r / 3 ? B[1] : B[2]);
    }
    R(x - Math.round(r), y + Math.floor(r), Math.round(r) * 2 + 1, 1, B[0]);
  };
  // a curved root from a through b toward c, as far as f1 of the way, tapering w0 -> w1
  const root = (a, b, cc, f1, w0, w1, wig = 0, s = 0) => {
    const len = Math.hypot(cc[0] - a[0], cc[1] - a[1]) * f1;
    const n = Math.max(2, Math.ceil(len * 1.4));
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * f1;
      const [x, y] = qbez(a, b, cc, f);
      dab(x + Math.sin(i * 0.5 + s) * wig, y + Math.cos(i * 0.4 + s) * wig * 0.5, w0 + (w1 - w0) * (i / n));
    }
  };
  // a thin rootlet: one pixel wide, wandering
  const rootlet = (x, y, ang, len, s) => {
    for (let k = 0; k < len; k++) {
      ang += (mapHash(k, s, seed) - 0.5) * 0.7;
      x += Math.cos(ang); y += Math.sin(ang) * 0.8 + 0.25;
      R(x, y, 1, 1, k < len * 0.5 ? B[2] : B[1]);
    }
  };
  const fr = i => rootGrow(tiers, maxes, i);
  // tier 0: a faint line toward where the root will reach
  ROOT_PATHS.forEach((P, i) => {
    if (!P || tiers[i]) return;
    const a = rootStart(i, tiers, maxes);
    for (let k = 0; k <= 30; k++) if (k % 3 === 0) { const [x, y] = qbez(a, P.bend, P.to, 0.3 + 0.7 * k / 30); R(x, y, 1, 1, "rgba(255, 220, 160, 0.3)"); }
  });
  // the taproot first (the deep roots come off it), then the rest
  const draw = i => {
    const P = ROOT_PATHS[i], a = rootStart(i, tiers, maxes), f = fr(i);
    const L = i === 5 ? tapReach(tiers, maxes) : rootLen(f);
    const w0 = (i === 5 ? 5 : i >= 3 ? 3 : 4) + f * (i === 5 ? 5 : 3);
    root(a, P.bend, P.to, L, w0, 1, 0.4, i);
    // rootlets along it, more the more it's grown, and root hairs bunched at its tip
    const count = Math.round(2 + f * 9);
    for (let k = 0; k < count; k++) {
      const at = (0.15 + 0.8 * (k + 0.5) / count) * L;
      const [x, y] = qbez(a, P.bend, P.to, at);
      const [x2, y2] = qbez(a, P.bend, P.to, Math.min(1, at + 0.02));
      const along = Math.atan2(y2 - y, x2 - x), side = k % 2 ? 1 : -1;
      rootlet(x, y, along + side * (0.9 + mapHash(k, i, seed) * 0.5), 3 + Math.round(mapHash(k, i + 9, seed) * (4 + f * 6)), k + i * 31);
    }
    if (f >= 0.5) { const [tx, ty] = qbez(a, P.bend, P.to, L); for (let k = 0; k < 6; k++) rootlet(tx, ty, Math.PI / 2 + (k - 2.5) * 0.45, 3 + Math.round(f * 4), 200 + k + i * 9); }
  };
  draw(5);
  [3, 4, 1, 2].forEach(draw);
  // the root crown: the flare under the trunk, and its spread along under the grass, both ways
  const f0 = fr(0);
  for (let y = 14; y <= 26; y++) { const w = 14 + (y - 14) * (0.7 + f0 * 0.5); dab(100, y, Math.min(w, 22 + f0 * 6) * (y > 22 ? (27 - y) / 5 : 1)); }
  [-1, 1].forEach(sd => {
    const reach = 18 + f0 * 46;
    root([100 + sd * 6, 18], [100 + sd * reach * 0.5, 15], [100 + sd * reach, 19], 1, 3 + f0 * 2, 1, 0.3, sd);
    for (let k = 0; k < 2 + Math.round(f0 * 6); k++) rootlet(100 + sd * (10 + k * reach / 8), 18, Math.PI / 2 + sd * 0.4, 3 + Math.round(f0 * 4), 400 + k + (sd > 0 ? 50 : 0));
  });
  rootsArtCache.tag = tag; rootsArtCache.c = c;
  return c;
}

function drawRootsTree(t) {
  const isl = rootsIsl, ups = rootsList(isl);
  const tiers = ups.map(u => rootTier(u.id)), maxes = ups.map(u => u.v.length);
  const g = treeCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(rootsBackground(isl), 0, 0);
  g.drawImage(rootsArt(isl, tiers, maxes), 0, 0);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const glow = ROOT_LEAVES[isl][3];
  // a fully grown root bears glowing nodules along it
  ROOT_PATHS.forEach((P, i) => {
    if (!maxes[i] || tiers[i] < maxes[i]) return;
    for (let k = 0; k < 5; k++) {
      let x, y;
      if (!P) { x = 100 + (k - 2) * 9; y = 17 + (k % 2); }
      else [x, y] = qbez(rootStart(i, tiers, maxes), P.bend, P.to, 0.25 + k * 0.17);
      R(x - 1, y - 1, 3, 3, shadeHex(glow, -0.35)); R(x, y - 1, 2, 2, glow);
      if (Math.sin(t * 3 + k * 2 + i) > 0.8) R(x, y - 1, 1, 1, "#ffffff");
    }
  });
  // the earth breathing: specks of soil falling, a worm going about its business
  for (let k = 0; k < 6; k++) { const ph = (t * 0.08 + k / 6) % 1; R(20 + k * 31 + Math.sin(k * 3) * 6, 16 + ph * 120, 1, 1, "rgba(255,230,190,0.18)"); }
  const wx = ((t * 6) % (TREE_W + 40)) - 20, wy = 120 + Math.sin(t * 0.3) * 6;
  for (let k = 0; k < 6; k++) R(wx - k, wy + Math.round(Math.sin(t * 6 - k * 0.8)), 1, 1, k ? "#c8707a" : "#e8909a");
}

function renderRootsTree() {
  const isl = rootsIsl, I = CAMP.islandById[isl], R = CAMP.nightmare.roots[isl];
  if (treeCanvas.width !== TREE_W || treeCanvas.height !== TREE_H) { treeCanvas.width = TREE_W; treeCanvas.height = TREE_H; }
  document.getElementById("screen-tree").style.setProperty("--tree-ar", (TREE_W / TREE_H).toFixed(4));
  document.getElementById("tree-title").textContent = R.name;
  document.getElementById("tree-medals").innerHTML = `<span class="cw-chip plate">${coinHtml(isl)}<b>${fmtInt(campWallet(isl))}</b></span>`;
  treePinsEl.innerHTML = "";
  const tips = rootTips(rootsList(isl).map(u => rootTier(u.id)), rootsList(isl).map(u => u.v.length));
  rootsList(isl).forEach((u, i) => {
    const pin = document.createElement("button");
    const tier = rootTier(u.id), max = u.v.length, price = rootPrice(isl, u);
    const ready = price !== null && campWallet(isl) >= price;
    pin.className = "tree-pin fruit" + (ready ? " ready" : "") + (price === null ? " maxed" : "") + (u.id === rootsSel ? " selected" : "");
    pin.dataset.key = "root-" + u.id;
    // on its root's tip, wherever it has grown to
    pin.style.left = (tips[i][0] / TREE_W * 100) + "%";
    pin.style.top = (tips[i][1] / TREE_H * 100) + "%";
    pin.style.setProperty("--c", ROOT_LEAVES[isl][2]);
    pin.innerHTML = fruitInner("tuber", "cu:" + u.icon) + `<span class="fr-tier">${price === null ? "MAX" : `${tier}/${max}`}</span>` + (price === null ? `<span class="fr-star">${STAR_SVG}</span>` : "");
    pin.setAttribute("aria-label", `${u.name}, tier ${tier} of ${max}`);
    pin.addEventListener("click", () => { rootsSel = u.id; sfx("click"); renderRootsTree(); });
    treePinsEl.appendChild(pin);
  });
  renderRootsCard();
  drawRootsTree(performance.now() / 1000);
  if (!treeRaf) treeRaf = requestAnimationFrame(window.treeLoop);
}

function renderRootsCard() {
  const isl = rootsIsl, I = CAMP.islandById[isl], R = CAMP.nightmare.roots[isl];
  const ups = rootsList(isl), i = ups.findIndex(u => u.id === rootsSel), u = ups[i];
  const tier = rootTier(u.id), max = u.v.length, price = rootPrice(isl, u);
  const can = price !== null && campWallet(isl) >= price;
  const val = k => (k <= 0 ? "0" : fmtInt(u.v[k - 1]));
  const txt = k => escapeAttr(u.text.replace("{v}", val(Math.max(1, k))));
  treeCardEl.style.setProperty("--c", ROOT_LEAVES[isl][2]);
  const action = price === null
    ? `<button class="btn tc-buy tc-max" disabled>Fully grown</button>`
    : `<button class="btn ${can ? "btn-gold" : ""} tc-buy" data-buy ${can ? "" : "disabled"}>${can ? "Grow" : "Need"} <b>${fmtInt(price)}</b> ${escapeAttr(I.currency.plural)}</button>`;
  treeCardEl.innerHTML = `<p class="tc-kicker">${ROOT_PARTS[i]} of ${escapeAttr(R.name)}</p>
    <div class="tc-pic fruit" style="--c:${ROOT_LEAVES[isl][2]}">${fruitInner("tuber", "cu:" + u.icon)}</div>
    <h3 class="tc-name">${escapeAttr(u.name)}</h3>
    <p class="tc-desc">${txt(tier)} Works in every nightmare level.</p>
    <div class="tc-val"><span>${val(tier)}</span>${price === null ? "" : ` <span class="tc-arrow">&#9654;</span> <b>${val(tier + 1)}</b>`}</div>
    <div class="tc-seg">${Array.from({ length: max }, (_, k) => `<span${k < tier ? ' class="on"' : ""}></span>`).join("")}</div>
    <p class="tc-tier">Tier ${tier} of ${max}</p>
    <div class="tc-actions">${action}</div>`;
  const buy = treeCardEl.querySelector("[data-buy]");
  if (buy) buy.addEventListener("click", () => {
    if (!nmRootBuy(u.id)) { sfx("bad"); return; }
    showToast(`${u.name} grew to tier ${rootTier(u.id)}.`);
    renderRootsTree();
    const again = treeCardEl.querySelector("[data-buy]");
    if (again && !again.disabled) again.focus({ preventScroll: true });
  });
}

/* The tree screen draws the roots when they're open */
(() => {
  const openTree = window.openCampTree;
  window.openCampTree = function () { BACK_TARGET.tree = "camphome"; return openTree.apply(this, arguments); };
  const render = window.renderTree;
  window.renderTree = function () { if (treeArea === "roots") { renderRootsTree(); return; } return render.apply(this, arguments); };
  const paint = window.paintTree;
  window.paintTree = function (t) { if (treeArea === "roots") { drawRootsTree(t); return; } return paint.apply(this, arguments); };
  const loop = window.treeLoop;
  window.treeLoop = function (ts) {
    if (treeArea !== "roots") return loop.apply(this, arguments);
    treeRaf = 0;
    if (currentScreen !== "tree") return;
    treeRaf = requestAnimationFrame(window.treeLoop);
    drawRootsTree(ts / 1000);
  };
})();
