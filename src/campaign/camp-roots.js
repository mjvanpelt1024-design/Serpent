/* =========================================================
   src/campaign/camp-roots.js
   Nightmare mode's upgrades (build 53): the roots of each island's tree.
   On the same tree screen as the island's own tree, behaving the same way:
   the tree hangs upside down from the island's underside into the dark
   earth, its six roots in the places of its six branches, thickening and
   filling out tier by tier, fruiting when fully grown. Paid in the island's
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

/* The dark under the island: the island's rock along the top, earth below, a few stones and worms */
function rootsBackground(isl) {
  return g => {
    for (let y = 0; y < TREE_H; y++) {
      const k = y / TREE_H;
      g.fillStyle = `rgb(${Math.round(42 - 26 * k)}, ${Math.round(26 - 16 * k)}, ${Math.round(20 - 12 * k)})`;
      g.fillRect(0, y, TREE_W, 1);
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = i % 3 ? "rgba(0,0,0,0.25)" : "rgba(255,230,200,0.06)";
      g.fillRect(Math.floor(mapHash(i, 2, 7) * TREE_W), Math.floor(30 + mapHash(i, 3, 7) * (TREE_H - 30)), 2, 1);
    }
    const rock = (ISLE_THEME[isl] && ISLE_THEME[isl].rock) || [["#4a3a30", "#3a2c24"]];
    // the island's underside, where the tree comes through: the flipped tree's grass line is at TREE_H - 122
    const base = TREE_H - 122;
    for (let x = 0; x < TREE_W; x++) {
      const h = base + Math.round(Math.sin(x * 0.21) * 2 + mapHash(x, 1, 5) * 3);
      for (let y = 0; y < h; y++) { g.fillStyle = rock[y < h * 0.6 ? 0 : Math.min(1, rock.length - 1)][(x + y) & 1]; g.fillRect(x, y, 1, 1); }
      g.fillStyle = "#1a100a"; g.fillRect(x, h, 1, 1);
    }
  };
}

function renderRootsTree() {
  const isl = rootsIsl, I = CAMP.islandById[isl], R = CAMP.nightmare.roots[isl];
  if (treeCanvas.width !== TREE_W || treeCanvas.height !== TREE_H) { treeCanvas.width = TREE_W; treeCanvas.height = TREE_H; }
  document.getElementById("screen-tree").style.setProperty("--tree-ar", (TREE_W / TREE_H).toFixed(4));
  document.getElementById("tree-title").textContent = R.name;
  document.getElementById("tree-medals").innerHTML = `<span class="cw-chip plate">${coinHtml(isl)}<b>${fmtInt(campWallet(isl))}</b></span>`;
  treePinsEl.innerHTML = "";
  rootsList(isl).forEach((u, i) => {
    const pin = document.createElement("button");
    const tier = rootTier(u.id), max = u.v.length, price = rootPrice(isl, u);
    const ready = price !== null && campWallet(isl) >= price;
    pin.className = "tree-pin fruit" + (ready ? " ready" : "") + (price === null ? " maxed" : "") + (u.id === rootsSel ? " selected" : "");
    pin.dataset.key = "root-" + u.id;
    pin.style.left = (CTREE_NODES[i].x / TREE_W * 100) + "%";
    pin.style.top = ((TREE_H - CTREE_NODES[i].y) / TREE_H * 100) + "%";      // hung upside down
    pin.style.setProperty("--c", ROOT_LEAVES[isl][2]);
    pin.innerHTML = fruitInner("apple", "cu:" + u.icon) + `<span class="fr-tier">${price === null ? "MAX" : `${tier}/${max}`}</span>` + (price === null ? `<span class="fr-star">${STAR_SVG}</span>` : "");
    pin.setAttribute("aria-label", `${u.name}, tier ${tier} of ${max}`);
    pin.addEventListener("click", () => { rootsSel = u.id; sfx("click"); renderRootsTree(); });
    treePinsEl.appendChild(pin);
  });
  renderRootsCard();
  drawRootsTree(performance.now() / 1000);
  if (!treeRaf) treeRaf = requestAnimationFrame(window.treeLoop);
}

function drawRootsTree(t) {
  const ups = rootsList(rootsIsl);
  drawCampTree(treeCanvas, rootsIsl, t, {
    tiers: ups.map(u => rootTier(u.id)), maxes: ups.map(u => u.v.length),
    leaves: ROOT_LEAVES[rootsIsl], bark: ROOT_BARK, background: rootsBackground(rootsIsl), flip: true
  });
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
  treeCardEl.innerHTML = `<p class="tc-kicker">${CTREE_PART[i].replace("bough", "root").replace("Crown", "Taproot").replace("Trunk", "Root crown")} of ${escapeAttr(R.name)}</p>
    <div class="tc-pic fruit" style="--c:${ROOT_LEAVES[isl][2]}">${fruitInner("apple", "cu:" + u.icon)}</div>
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
