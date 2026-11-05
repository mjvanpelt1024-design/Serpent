/* =========================================================
   src/campaign/camp-tree.js
   Each island's upgrade tree, on the old tree screen: the same little
   island in the sky, a trunk and branches that thicken as they grow,
   leaves that fill in tier by tier and fruit once a part is fully
   grown. Six upgrades per tree, paid in that island's money; every
   upgrade works on every island.
   ========================================================= */
"use strict";

let campTreeIsl = null;
let campTreeSel = null;
/* Where each of the six upgrades grows: trunk, two low boughs, two high boughs, the crown */
const CTREE_NODES = [{ x: 100, y: 100 }, { x: 52, y: 80 }, { x: 148, y: 82 }, { x: 64, y: 46 }, { x: 136, y: 48 }, { x: 100, y: 22 }];
const CTREE_PART = ["Trunk", "Left bough", "Right bough", "High left bough", "High right bough", "Crown"];
const CTREE_LEAVES = {
  keep: ["#2f7d2a", "#3f9a3a", "#5ab046", "#ff3b3b"], spire: ["#3a3a9a", "#5a5ac8", "#8a8af0", "#7fe3ff"], hollow: ["#a8501a", "#d87a2a", "#f0a840", "#ff3b3b"],
  reef: ["#1a7a6a", "#2a9a8a", "#5acaba", "#ff9ab0"], crown: ["#6a1a1a", "#a82a1a", "#e85a1a", "#ffd23f"]
};
const ctreeSkyCache = {};

function openCampTree(isl, sel) {
  campTreeIsl = isl;
  const ups = CAMP.islandById[isl].tree.upgrades;
  campTreeSel = sel || (ups.find(u => upNextPrice(u.id) !== null && campWallet(isl) >= upNextPrice(u.id)) || ups[0]).id;
  treeArea = "camp";
  openScreen("tree");
}

function campTreeSky(isl) {
  if (ctreeSkyCache[isl]) return ctreeSkyCache[isl];
  const c = document.createElement("canvas");
  c.width = TREE_W;
  c.height = TREE_H;
  const g = c.getContext("2d");
  // the sky at the island's height on the map: dawn for the first, stars for the last
  const y = ISLANDS[isl].y;
  const top = skyAt(y - 120), bottom = skyAt(y + 40);
  for (let yy = 0; yy < TREE_H; yy++) for (let x = 0; x < TREE_W; x++) {
    const k = Math.min(1, Math.max(0, yy / TREE_H + (BAYER[(yy % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.1));
    const q = Math.round(k * 7) / 7;
    g.fillStyle = `rgb(${top.map((v, i) => Math.round(v + (bottom[i] - v) * q)).join(",")})`;
    g.fillRect(x, yy, 1, 1);
  }
  const night = ISLANDS[isl].n >= 2;
  for (let i = 0; i < (night ? 50 : 14); i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + mapHash(i, 3, 61) * 0.5})`;
    g.fillRect(Math.round(mapHash(i, 3, 61) * TREE_W), Math.round(mapHash(i, 4, 61) * TREE_H * 0.5), 1, 1);
  }
  return (ctreeSkyCache[isl] = c);
}

function drawCampTree(c, isl, t) {
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(campTreeSky(isl), 0, 0);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const ups = CAMP.islandById[isl].tree.upgrades;
  const tiers = ups.map(u => upTier(u.id));
  const maxes = ups.map(u => u.values.length - 1);
  const leaves = CTREE_LEAVES[isl];
  const sway = i => Math.sin(t * 1.1 + i * 1.7) * (i ? 1.2 : 0.4);
  for (let i = 0; i < 3; i++) {
    const w = 26 + i * 8, x = ((i * 90 + t * (2 + i)) % 260) - 40, y = 12 + i * 22;
    R(x, y, w, 4, "rgba(255,255,255,0.4)"); R(x + 6, y - 3, w * 0.45, 3, "rgba(255,255,255,0.4)");
  }
  // the island, in its own colors
  const iy = 122, iw = 150, cx = 100;
  const [ga, gb, ge] = MAP_BIOME[isl];
  for (let r = 0; r < 34; r++) {
    const half = (iw / 2) * Math.pow(1 - r / 34, 0.8) + (mapHash(r, 5, 9) - 0.5) * 3;
    if (half < 1) break;
    for (let x = -Math.round(half); x <= Math.round(half); x++) R(cx + x, iy + 6 + r, 1, 1, x === Math.round(half) ? "#2e2420" : isleRockColor(isl, x, r, r, 34, 9));
  }
  for (let dy = -7; dy <= 7; dy++) {
    const half = (iw / 2) * Math.sqrt(1 - Math.pow(dy / 7.5, 2));
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      let col = ((x + dy) & 1) && mapHash(x, dy, 8) > 0.45 ? gb : ga;
      if (dy >= 6) col = ge;
      if (dy === -7) col = shadeHex(ga, 0.2);
      R(cx + x, iy + dy, 1, 1, col);
    }
  }
  // limbs, thicker as their part grows
  const limb = (x0, y0, x1, y1, w) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const ww = Math.max(1, Math.round(w * (1 - f * 0.35)));
      R(x - ww / 2, y, ww, 1, "#5a3a20");
      R(x - ww / 2, y, 1, 1, "#7a5232");
    }
  };
  const total = tiers.reduce((a, b) => a + b, 0);
  const nodes = CTREE_NODES.map((n, i) => ({ x: n.x + sway(i), y: n.y }));
  const tw = 4 + Math.floor(total / 6);
  limb(cx, iy, cx, 70, tw);
  R(cx - tw / 2 - 3, iy - 1, 3, 2, "#5a3a20"); R(cx + tw / 2, iy - 1, 3, 2, "#5a3a20");
  [[1, 92], [2, 90], [3, 70], [4, 70], [5, 60]].forEach(([i, fy]) => {
    const w = 2 + Math.floor(tiers[i] / 2);
    limb(cx, fy, nodes[i].x, nodes[i].y + 4, w);
  });
  // leaves: a cluster on every part, fuller with every tier; fruit when it's fully grown
  nodes.forEach((n, i) => {
    const frac = maxes[i] ? tiers[i] / maxes[i] : 0;
    const count = 24 + Math.round(frac * 110);
    const rad = 8 + frac * 11;
    for (let k = 0; k < count; k++) {
      const a = mapHash(k, i, 21) * Math.PI * 2, d = Math.sqrt(mapHash(k, i, 23)) * rad;
      R(n.x + Math.cos(a) * d * 1.25 + Math.sin(t * 1.5 + k) * 0.4, n.y + Math.sin(a) * d * 0.8, 2, 2, leaves[k % 3]);
    }
    if (tiers[i] >= maxes[i] && maxes[i]) for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + 0.4, x = n.x + Math.cos(a) * rad * 0.9, y = n.y + Math.sin(a) * rad * 0.55;
      R(x, y, 2, 2, leaves[3]);
      if (Math.sin(t * 3 + k * 2 + i) > 0.85) R(x, y, 1, 1, "#ffffff");
    }
  });
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.12 + k / 4) % 1;
    R(60 + k * 25 + Math.sin(t + k * 2) * 6, 30 + ph * 85, 1, 1, leaves[k % 3]);
  }
}

function renderCampTree() {
  const isl = campTreeIsl;
  const I = CAMP.islandById[isl];
  if (treeCanvas.width !== TREE_W || treeCanvas.height !== TREE_H) { treeCanvas.width = TREE_W; treeCanvas.height = TREE_H; }
  document.getElementById("screen-tree").style.setProperty("--tree-ar", (TREE_W / TREE_H).toFixed(4));
  document.getElementById("tree-title").textContent = I.tree.name;
  document.getElementById("tree-medals").innerHTML = `<span class="cw-chip plate">${coinHtml(isl)}<b>${fmtInt(campWallet(isl))}</b></span>`;
  treePinsEl.innerHTML = "";
  I.tree.upgrades.forEach((u, i) => {
    const pin = document.createElement("button");
    const tier = upTier(u.id), max = u.values.length - 1, price = upNextPrice(u.id);
    const ready = price !== null && campWallet(isl) >= price;
    pin.className = "tree-pin fruit" + (ready ? " ready" : "") + (price === null ? " maxed" : "") + (u.id === campTreeSel ? " selected" : "");
    pin.dataset.key = "node-" + u.id;
    pin.style.left = (CTREE_NODES[i].x / TREE_W * 100) + "%";
    pin.style.top = (CTREE_NODES[i].y / TREE_H * 100) + "%";
    pin.style.setProperty("--c", I.colors.accent);
    pin.innerHTML = fruitInner("apple", "cu:" + u.icon) + `<span class="fr-tier">${price === null ? "MAX" : `${tier}/${max}`}</span>` + (price === null ? `<span class="fr-star">${STAR_SVG}</span>` : "");
    pin.setAttribute("aria-label", `${u.name}, tier ${tier} of ${max}`);
    pin.addEventListener("click", () => { campTreeSel = u.id; sfx("click"); renderCampTree(); });
    treePinsEl.appendChild(pin);
  });
  renderCampTreeCard();
  drawCampTree(treeCanvas, isl, performance.now() / 1000);
  if (!treeRaf) treeRaf = requestAnimationFrame(treeLoop);
}

const upText = (u, v) => escapeAttr(u.text.replace("{v}", fmtInt(v)));
/* Just the number, with whatever is stuck to it ("+15%") and a unit word after it ("40 seconds") */
function upValue(u, v) {
  const m = u.text.match(/(\S*)\{v\}(\S*)(?:\s+(seconds|uses|charges|hearts|plates|minutes))?/);
  if (!m) return fmtInt(v);
  return escapeAttr(`${m[1]}${fmtInt(v)}${m[2].replace(/[.,:]+$/, "")}${m[3] ? " " + m[3] : ""}`);
}

function renderCampTreeCard() {
  const isl = campTreeIsl, I = CAMP.islandById[isl];
  const ups = I.tree.upgrades;
  const i = ups.findIndex(u => u.id === campTreeSel);
  const u = ups[i];
  const tier = upTier(u.id), max = u.values.length - 1, price = upNextPrice(u.id);
  const can = price !== null && campWallet(isl) >= price;
  treeCardEl.style.setProperty("--c", I.colors.accent);
  const action = price === null
    ? `<button class="btn tc-buy tc-max" disabled>Fully grown</button>`
    : `<button class="btn ${can ? "btn-gold" : ""} tc-buy" data-buy ${can ? "" : "disabled"}>${can ? "Grow" : "Need"} <b>${fmtInt(price)}</b> ${escapeAttr(I.currency.plural)}</button>`;
  treeCardEl.innerHTML = `<p class="tc-kicker">${CTREE_PART[i]} of ${escapeAttr(I.tree.name)}</p>
    <div class="tc-pic fruit" style="--c:${I.colors.accent}">${fruitInner("apple", "cu:" + u.icon)}</div>
    <h3 class="tc-name">${escapeAttr(u.name)}</h3>
    <p class="tc-desc">${upText(u, u.values[Math.max(1, tier)])} Works on every island.</p>
    <div class="tc-val"><span>${upValue(u, u.values[tier])}</span>${price === null ? "" : ` <span class="tc-arrow">&#9654;</span> <b>${upValue(u, u.values[tier + 1])}</b>`}</div>
    <div class="tc-seg">${Array.from({ length: max }, (_, k) => `<span${k < tier ? ' class="on"' : ""}></span>`).join("")}</div>
    <p class="tc-tier">Tier ${tier} of ${max}</p>
    <div class="tc-actions">${action}</div>`;
  const buy = treeCardEl.querySelector("[data-buy]");
  if (buy) buy.addEventListener("click", () => {
    if (!campBuyUpgrade(u.id)) { sfx("bad"); return; }
    sfx("buy");
    showToast(`${u.name} grew to tier ${upTier(u.id)}.`);
    renderCampTree();
    const again = treeCardEl.querySelector("[data-buy]");
    if (again && !again.disabled) again.focus({ preventScroll: true });
  });
}

/* The tree screen draws the campaign's trees when one is open */
(() => {
  const render = renderTree;
  window.renderTree = function () { if (treeArea === "camp") { renderCampTree(); return; } return render.apply(this, arguments); };
  const paint = paintTree;
  window.paintTree = function (t) { if (treeArea === "camp") { drawCampTree(treeCanvas, campTreeIsl, t); return; } return paint.apply(this, arguments); };
  const loop = treeLoop;
  window.treeLoop = function (ts) {
    if (treeArea !== "camp") return loop.apply(this, arguments);
    treeRaf = 0;
    if (currentScreen !== "tree") return;
    treeRaf = requestAnimationFrame(window.treeLoop);
    drawCampTree(treeCanvas, campTreeIsl, ts / 1000);
  };
})();
