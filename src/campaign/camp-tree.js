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

function openCampTree(isl, sel) {
  campTreeIsl = isl;
  const ups = CAMP.islandById[isl].tree.upgrades;
  campTreeSel = sel || (ups.find(u => upNextPrice(u.id) !== null && campWallet(isl) >= upNextPrice(u.id)) || ups[0]).id;
  treeArea = "camp";
  openScreen("tree");
}

/* The sky at the island's height on the map (dawn for the first, stars for the last) and the island the
   tree stands on: one picture per island, textures/scenes/tree/<island>.png */
const campTreeSky = isl => texCanvas("tree:" + isl);

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
  // (the island under the tree is part of the sky's picture)
  const iy = 122, cx = 100;
  // ----- the tree: one trunk from the roots to the crown, boughs curving out to each upgrade,
  // a canopy that's always there and fills out tier by tier -----
  const total = tiers.reduce((a, b) => a + b, 0), most = maxes.reduce((a, b) => a + b, 0) || 1;
  const grown = total / most;
  const nodes = CTREE_NODES.map((n, i) => ({ x: n.x + (i ? sway(i) : 0), y: n.y }));
  const bark = ["#3a2414", "#5a3a20", "#7a5232", "#9a6a40"];        // shadow, body, lit, shine
  // a brush that paints a round dab of bark, lit on its left
  const dab = (x, y, w) => {
    const r = w / 2;
    for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      R(x - half, y + dy, half * 2 + 1, 1, bark[1]);
      R(x - half, y + dy, 1, 1, bark[2]);
      R(x + half, y + dy, 1, 1, bark[0]);
    }
  };
  // a curved limb from (x0, y0) to (x1, y1), bowing up toward (bx, by), tapering w0 -> w1
  const limb = (x0, y0, bx, by, x1, y1, w0, w1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
    for (let i = 0; i <= n; i++) {
      const f = i / n, u = 1 - f;
      dab(u * u * x0 + 2 * u * f * bx + f * f * x1, u * u * y0 + 2 * u * f * by + f * f * y1, w0 + (w1 - w0) * f);
    }
  };
  // roots, spreading over the grass
  [-1, 1].forEach(side => { for (let k = 0; k < 3; k++) limb(cx, iy - 2, cx + side * (8 + k * 5), iy - 1 + k, cx + side * (14 + k * 7), iy + 2 + k, 3 - k * 0.5, 1); });
  // the trunk, all the way up to the crown's fruit, swaying a little at the top
  const tw0 = 10 + grown * 6, top = nodes[5];
  for (let y = iy; y >= top.y + 6; y--) {
    const f = (iy - y) / (iy - top.y);
    const x = cx + Math.sin(f * 2.4) * 2 * f + (top.x - cx) * f * f;
    const w = tw0 * (1 - f * 0.72);
    dab(x, y, w);
    // bark lines and a knot or two
    if (y % 5 === 0) R(x - w * 0.15, y, 1, 3, bark[0]);
    if (y === iy - 30) { R(x - 2, y, 3, 3, bark[0]); R(x - 1, y + 1, 1, 1, bark[3]); }
  }
  const trunkAt = y => { const f = (iy - y) / (iy - top.y); return cx + Math.sin(f * 2.4) * 2 * f + (top.x - cx) * f * f; };
  // boughs: low ones leave the trunk low, high ones high, each bowing up to its upgrade
  [[1, 100], [2, 98], [3, 74], [4, 72]].forEach(([i, fromY]) => {
    const n = nodes[i], x0 = trunkAt(fromY), side = Math.sign(n.x - cx);
    const frac = maxes[i] ? tiers[i] / maxes[i] : 0;
    limb(x0, fromY, x0 + (n.x - x0) * 0.45, fromY - 4 - (fromY - n.y) * 0.9, n.x, n.y + 3, 5 + frac * 2, 2);
    // a twig reaching on past the fruit
    limb(n.x, n.y + 3, n.x + side * 6, n.y - 2, n.x + side * 9, n.y - 6, 2, 1);
  });
  // a short sprig on the trunk where its own upgrade hangs
  limb(trunkAt(nodes[0].y + 2), nodes[0].y + 2, cx - 5, nodes[0].y - 2, cx - 9, nodes[0].y - 3, 2, 1);

  // the canopy: dark leaves behind, then the body, then the light catching the top-left of each clump
  const clumps = [
    [100, 24, 20], [74, 34, 16], [126, 36, 16], [62, 50, 15], [138, 52, 15], [50, 78, 14], [150, 80, 14], [100, 46, 18], [86, 62, 13], [114, 62, 13]
  ];
  const owner = [5, 3, 4, 3, 4, 1, 2, 5, 3, 4];          // which upgrade's growth fills out each clump
  const layer = (shade, dx, dy, k0) => clumps.forEach(([x, y, r0], ci) => {
    const fr = maxes[owner[ci]] ? tiers[owner[ci]] / maxes[owner[ci]] : 0;
    const r = r0 * (0.62 + 0.38 * Math.max(fr, grown));
    const count = Math.round(r * r * 0.55);
    for (let k = 0; k < count; k++) {
      const a = mapHash(k + k0, ci, 21) * Math.PI * 2, d = Math.sqrt(mapHash(k + k0, ci, 23)) * r;
      const lx = x + Math.cos(a) * d * 1.2 + dx + Math.sin(t * 1.4 + k * 0.7 + ci) * 0.4, ly = y + Math.sin(a) * d * 0.8 + dy;
      const lit = Math.cos(a) * -0.7 + Math.sin(a) * -0.7 > 0.35 && d > r * 0.45;
      R(lx, ly, 2, 2, shade === 0 ? shadeHex(leaves[0], -0.25) : shade === 1 ? leaves[(k % 2)] : lit ? leaves[2] : leaves[1]);
    }
  });
  layer(0, 2, 3, 0);
  layer(1, 0, 0, 500);
  layer(2, -1, -1, 900);
  // fruit on the boughs that are fully grown, glinting
  nodes.forEach((n, i) => {
    if (!maxes[i] || tiers[i] < maxes[i]) return;
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + 0.4, x = n.x + Math.cos(a) * 11, y = n.y + Math.sin(a) * 7;
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
