/* =========================================================
   src/campaign/camp-base.js
   Home base: the clearing on every island where the upgrade tree grows.
   Click the tree and the view moves in close: the satchel leans on the
   trunk, a trophy sits on a stump, a mirror and an easel stand nearby.
     canopy   the upgrade trees (every open island's, paid in its currency)
     satchel  everything you carry, and what you take into levels
     trophy   achievements
     mirror   skins (gems)
     easel    themes (gems)
   The same base is on every island, so nothing ever needs a trip back.
   Also here: the modal every campaign panel opens in.
   ========================================================= */
"use strict";

let cbIsl = "keep";
let cbView = "grove";        // grove, or close (zoomed in on the trunk)
let cbZoom = 0;              // 0 = grove, 1 = close, animated between
let cbRaf = 0;
let cbCanvas = null;
let cbHover = null;

/* Where things are in the scene, in scene units (320 x 200, the trunk's foot at 160, 150) */
const CB_SPOTS = {
  tree: { x: 160, y: 95, r: 50, view: "grove", label: "Look closer" },
  canopy: { x: 160, y: 84, r: 18, view: "close", label: "Upgrade tree" },
  satchel: { x: 132, y: 146, r: 13, view: "close", label: "Satchel" },
  trophy: { x: 196, y: 140, r: 12, view: "close", label: "Achievements" },
  mirror: { x: 228, y: 132, r: 14, view: "close", label: "Skins" },
  easel: { x: 92, y: 132, r: 14, view: "close", label: "Themes" }
};

function openCampBase(isl) {
  cbIsl = isl || camp.at;
  cbView = "grove";
  cbZoom = 0;
  openScreen("campbase");
  cbCanvas = document.getElementById("cb-canvas");
  if (!cbCanvas.dataset.bound) {
    cbCanvas.dataset.bound = "1";
    cbCanvas.addEventListener("pointermove", e => { cbHover = cbHit(e); cbCanvas.style.cursor = cbHover ? "pointer" : "default"; cbLabels(); });
    cbCanvas.addEventListener("click", e => { const h = cbHit(e); if (h) cbOpen(h); });
    document.getElementById("cb-back").addEventListener("click", () => { if (cbView === "close") cbSetView("grove"); else openCampMap({ isl: cbIsl, node: "base" }); });
  }
  document.getElementById("cb-title").textContent = `${CAMP.islandById[cbIsl].name} · ${CAMP.islandById[cbIsl].tree.name}`;
  cbLabels();
  cancelAnimationFrame(cbRaf);
  cbRaf = requestAnimationFrame(cbLoop);
}

function cbSetView(v) {
  cbView = v;
  sfx("whoosh");
  cbLabels();
}

/* The scene is scaled to cover the window; returns scene -> screen */
function cbXform() {
  const w = cbCanvas.clientWidth, h = cbCanvas.clientHeight;
  const base = Math.max(w / 320, h / 200);
  const z = 1 + cbZoom * 0.75;
  const fx = 160, fy = 70 + cbZoom * 42;      // where the camera looks
  const s = base * z;
  return { s, ox: w / 2 - fx * s, oy: h / 2 - fy * s };
}

function cbHit(e) {
  const r = cbCanvas.getBoundingClientRect();
  const { s, ox, oy } = cbXform();
  const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
  for (const [k, p] of Object.entries(CB_SPOTS)) {
    if (p.view !== cbView) continue;
    if (Math.hypot(x - p.x, y - p.y) < p.r) return k;
  }
  return null;
}

function cbOpen(k) {
  sfx("click");
  if (k === "tree") { cbSetView("close"); return; }
  if (k === "canopy") openUpgradesPanel(cbIsl);
  else if (k === "satchel") openSatchel();
  else if (k === "trophy") openAchievementsPanel();
  else if (k === "mirror") openSkinsPanel();
  else if (k === "easel") openThemesPanel();
}

/* Floating labels on the hotspots, which are also the keyboard's way in */
function cbLabels() {
  const box = document.getElementById("cb-spots");
  if (!box || !cbCanvas) return;
  const { s, ox, oy } = cbXform();
  box.innerHTML = Object.entries(CB_SPOTS).filter(([, p]) => p.view === cbView).map(([k, p]) =>
    `<button class="cb-spot ${cbHover === k ? "hover" : ""}" data-spot="${k}" style="left:${(ox + p.x * s).toFixed(0)}px;top:${(oy + (p.y - p.r * 0.9) * s).toFixed(0)}px">${p.label}</button>`).join("");
  box.querySelectorAll("[data-spot]").forEach(b => b.addEventListener("click", () => cbOpen(b.dataset.spot)));
  document.getElementById("cb-back").textContent = cbView === "close" ? "Step back" : "Map";
}

function cbLoop(ts) {
  if (currentScreen !== "campbase") return;
  cbRaf = requestAnimationFrame(cbLoop);
  const want = cbView === "close" ? 1 : 0;
  if (Math.abs(cbZoom - want) > 0.001) {
    cbZoom += (want - cbZoom) * 0.12;
    if (Math.abs(cbZoom - want) < 0.002) cbZoom = want;
    cbLabels();
  }
  cbDraw(ts);
}

function cbDraw(ts) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cbCanvas.clientWidth, h = cbCanvas.clientHeight;
  if (cbCanvas.width !== Math.round(w * dpr) || cbCanvas.height !== Math.round(h * dpr)) { cbCanvas.width = Math.round(w * dpr); cbCanvas.height = Math.round(h * dpr); cbLabels(); }
  const g = cbCanvas.getContext("2d");
  const I = CAMP.islandById[cbIsl];
  const C = I.colors;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  const { s, ox, oy } = cbXform();
  g.save();
  g.translate(ox, oy);
  g.scale(s, s);
  const R = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  // sky and hills
  const sky = g.createLinearGradient(0, -60, 0, 140);
  const skies = { medieval: ["#7ab8e8", "#cfe8f8"], wizard: ["#2a2a6a", "#8a6ad8"], harvest: ["#f0a860", "#ffe0a0"], ocean: ["#1a5a8a", "#6ac8d8"], volcano: ["#2a0a0a", "#a83a1a"] }[I.theme];
  sky.addColorStop(0, skies[0]); sky.addColorStop(1, skies[1]);
  g.fillStyle = sky; g.fillRect(-200, -200, 720, 400);
  if (I.theme === "wizard" || I.theme === "volcano") for (let i = 0; i < 40; i++) R((i * 73) % 520 - 100, (i * 37) % 120 - 60, 1, 1, I.theme === "wizard" ? "#ffffff" : "#ffb070");
  g.fillStyle = campShade(C.grass, -0.2);
  g.beginPath(); g.moveTo(-200, 130); for (let x = -200; x <= 520; x += 20) g.lineTo(x, 118 + Math.sin(x / 47) * 8); g.lineTo(520, 400); g.lineTo(-200, 400); g.fill();
  R(-200, 140, 720, 260, C.grass);
  for (let i = 0; i < 120; i++) R((i * 53) % 700 - 190, 142 + (i * 29) % 60, 2, 1, "rgba(0,0,0,0.12)");
  // the tree
  cbTree(g, I, ts);
  // things at the foot of the tree
  cbSatchel(g, 132, 146, ts);
  cbStump(g, 196, 140);
  cbMirror(g, 228, 132, ts);
  cbEasel(g, 92, 132, ts);
  // the map signpost and a couple of island touches
  R(40, 118, 3, 26, "#6a4a2a"); R(28, 118, 28, 8, "#a87a4a"); R(30, 120, 24, 1, "#6a4a2a");
  g.restore();
  // the hover glow
  if (cbHover) {
    const p = CB_SPOTS[cbHover];
    g.save();
    g.strokeStyle = "rgba(255,240,160,0.8)"; g.lineWidth = 2;
    g.setLineDash([6, 4]); g.lineDashOffset = -ts / 40;
    g.beginPath(); g.arc(ox + p.x * s, oy + p.y * s, p.r * s, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
}

function cbTree(g, I, ts) {
  const C = I.colors;
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const trunk = { medieval: "#6a4a2a", wizard: "#4a3a5a", harvest: "#7a5a3a", ocean: "#c86a7a", volcano: "#2a1a1a" }[I.theme];
  // roots and trunk
  R(146, 96, 28, 56, trunk); R(140, 140, 40, 12, trunk); R(132, 148, 12, 4, trunk); R(176, 148, 12, 4, trunk);
  R(150, 100, 4, 46, campShade(trunk, 0.2)); R(164, 112, 3, 30, campShade(trunk, -0.2));
  R(170, 112, 6, 6, campShade(trunk, -0.35));
  // canopy: one big crown, tinted by the island
  const sway = Math.sin(ts / 1400) * 1.5;
  const leaf = { medieval: ["#2f6a2a", "#3f8a33", "#5aa840"], wizard: ["#3a2a7a", "#5a3aa8", "#8a6ad8"], harvest: ["#5a7a2a", "#7a9a3a", "#a8b84a"], ocean: ["#c84a6a", "#e86a8a", "#ff9ab0"], volcano: ["#3a1a1a", "#6a2a1a", "#a83a1a"] }[I.theme];
  const blobs = [[160, 60, 62, 38], [120, 74, 36, 24], [200, 72, 38, 26], [140, 44, 32, 22], [184, 44, 30, 20], [160, 30, 28, 18]];
  blobs.forEach(([x, y, rx, ry], i) => { g.fillStyle = leaf[0]; g.beginPath(); g.ellipse(x + sway * (i % 2 ? 1 : -1), y + 3, rx, ry, 0, 0, Math.PI * 2); g.fill(); });
  blobs.forEach(([x, y, rx, ry], i) => { g.fillStyle = leaf[1]; g.beginPath(); g.ellipse(x + sway * (i % 2 ? 1 : -1), y, rx * 0.9, ry * 0.85, 0, 0, Math.PI * 2); g.fill(); });
  blobs.forEach(([x, y, rx, ry], i) => { g.fillStyle = leaf[2]; g.beginPath(); g.ellipse(x - rx * 0.25 + sway, y - ry * 0.3, rx * 0.45, ry * 0.35, 0, 0, Math.PI * 2); g.fill(); });
  // fruit: one per upgrade on this island's tree, lit when bought
  const ups = I.tree.upgrades;
  const spots = [[124, 70], [146, 52], [172, 46], [196, 66], [140, 82], [182, 84]];
  ups.forEach((u, i) => {
    const [x, y] = spots[i % spots.length];
    const t = upTier(u.id), max = u.values.length - 1;
    const fruit = { medieval: "#ff3b3b", wizard: "#7fe3ff", harvest: "#ffd23f", ocean: "#f0f4ff", volcano: "#ff8c1a" }[I.theme];
    g.fillStyle = t ? fruit : "rgba(0,0,0,0.25)";
    g.beginPath(); g.arc(x + sway, y, 3.2, 0, Math.PI * 2); g.fill();
    if (t >= max) { g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(x - 1 + sway, y - 2, 1, 1); }
  });
  if (I.theme === "wizard" || I.theme === "volcano") {
    for (let i = 0; i < 6; i++) {
      const a = ts / 1800 + i;
      g.fillStyle = I.theme === "wizard" ? "rgba(255,232,106,0.9)" : "rgba(255,140,40,0.9)";
      g.fillRect(160 + Math.cos(a) * 70, 60 + Math.sin(a * 1.3) * 34, 2, 2);
    }
  }
}

function cbSatchel(g, x, y, ts) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  R(-10, -10, 20, 14, "#8a5a2a"); R(-11, -12, 22, 4, "#a87a3a"); R(-8, -16, 2, 6, "#6a4a1a"); R(6, -16, 2, 6, "#6a4a1a"); R(-8, -17, 16, 2, "#6a4a1a");
  R(-3, -9, 6, 5, "#ffd23f"); R(-1, -7, 2, 2, "#8a5a2a"); R(-10, 2, 20, 2, "#6a4a1a");
  R(9, -4, 4, 6, "#c8323a");   // a scroll sticking out
}
function cbStump(g, x, y) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  R(-9, -2, 18, 10, "#7a5a3a"); R(-10, -4, 20, 3, "#a8885a"); R(-6, -3, 12, 1, "#8a6a4a");
  R(-5, -14, 10, 7, "#ffd23f"); R(-7, -14, 2, 4, "#ffd23f"); R(5, -14, 2, 4, "#ffd23f"); R(-1, -7, 2, 3, "#ffd23f"); R(-4, -4, 8, 2, "#d8a020");
  R(-3, -12, 2, 3, "#fff4b0");
}
function cbMirror(g, x, y, ts) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  R(-1, 4, 2, 12, "#6a4a2a"); R(-6, 15, 12, 2, "#6a4a2a");
  R(-8, -16, 16, 22, "#c8a04a"); R(-6, -14, 12, 18, "#9fd8f0");
  const shine = (ts / 1500) % 1;
  R(-6 + shine * 10, -14, 2, 18, "rgba(255,255,255,0.5)");
  // a reflected snake
  const sk = currentSkin();
  for (let i = 0; i < 4; i++) R(-4 + i * 2, -2 - (i === 3 ? 2 : 0), 2, 2, skinColorAt(sk, 3 - i, ts));
}
function cbEasel(g, x, y, ts) {
  const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  R(-8, -6, 2, 22, "#8a6a3a"); R(6, -6, 2, 22, "#8a6a3a"); R(-1, -10, 2, 26, "#6a4a2a");
  R(-10, -18, 20, 15, "#f0e8d8");
  const bd = currentBackdrop();
  const cols = bd.colors || [bd.color || "#222", "#444"];
  for (let i = 0; i < 4; i++) R(-9 + i * 4.5, -17, 4.5, 13, cols[i % cols.length] || "#333");
  R(4, 6, 10, 6, "#c8a070"); R(6, 7, 2, 2, "#ff3b3b"); R(9, 7, 2, 2, "#3ddc84"); R(11, 9, 2, 2, "#38bdf8");
}

/* ----- The modal every campaign panel uses ----- */
let campModalOpen = false;
let campModalAfter = null;
function openCampModal(html, opts = {}) {
  const el = document.getElementById("camp-modal");
  el.querySelector(".camp-modal-box").innerHTML = `<button class="cm-x" data-close aria-label="Close">×</button>` + html;
  el.querySelector(".camp-modal-box").className = "camp-modal-box " + (opts.cls || "");
  el.classList.add("active");
  campModalOpen = true;
  campModalAfter = opts.after || null;
  el.querySelector("[data-close]").addEventListener("click", closeCampModal);
}
function closeCampModal() {
  const el = document.getElementById("camp-modal");
  el.classList.remove("active");
  campModalOpen = false;
  const after = campModalAfter;
  campModalAfter = null;
  if (currentScreen === "camp") { cmTopbar(); cmCard(); }
  if (after) after();
}

/* ----- Upgrades ----- */
let upTab = null;
function openUpgradesPanel(isl) {
  upTab = isl;
  renderUpgrades();
}
function renderUpgrades() {
  const open = CAMP.islands.filter(i => campIslandOpen(i.id));
  if (!open.some(i => i.id === upTab)) upTab = open[0].id;
  const I = CAMP.islandById[upTab];
  const tabs = open.map(i => `<button class="tab" data-up="${i.id}" aria-selected="${i.id === upTab}">${i.name}</button>`).join("");
  const rows = I.tree.upgrades.map(u => {
    const t = upTier(u.id), max = u.values.length - 1;
    const now = u.text.replace("{v}", fmtInt(u.values[t]));
    const next = t < max ? u.text.replace("{v}", fmtInt(u.values[t + 1])) : null;
    const price = upNextPrice(u.id);
    const can = price !== null && campWallet(upTab) >= price;
    let pips = "";
    for (let i = 0; i < max; i++) pips += `<i class="${i < t ? "on" : ""}"></i>`;
    return `<div class="up-row ${t >= max ? "maxed" : ""}">
      <img class="up-ico" src="${campUpIconUrl(u.icon)}" alt="">
      <div class="up-body"><div class="up-name">${u.name} <span class="ch-pips">${pips}</span></div>
        <div class="up-now">${t ? "Now: " + now : "Not yet grown"}</div>
        ${next ? `<div class="up-next">Next: ${next}</div>` : `<div class="up-next">Fully grown</div>`}</div>
      ${price !== null ? `<button class="btn btn-small ${can ? "btn-primary" : ""}" data-buy="${u.id}" ${can ? "" : "disabled"}>${coinIconHtml(upTab)} ${fmtInt(price)}</button>` : ""}
    </div>`;
  }).join("");
  openCampModal(`<h3>${I.tree.name}</h3>
    <p class="cb-note">Every upgrade works on every island. Each tree is paid in its own island's currency: you have ${coinIconHtml(upTab)} <strong>${campMoney(upTab, campWallet(upTab))}</strong>.</p>
    <div class="tabs cb-tabs">${tabs}</div><div class="up-list">${rows}</div>`, { cls: "wide" });
  const box = document.querySelector("#camp-modal .camp-modal-box");
  box.querySelectorAll("[data-up]").forEach(b => b.addEventListener("click", () => { upTab = b.dataset.up; sfx("tab"); renderUpgrades(); }));
  box.querySelectorAll("[data-buy]").forEach(b => b.addEventListener("click", () => {
    if (campBuyUpgrade(b.dataset.buy)) { sfx("buy"); showToast(`${CAMP.upgradeById[b.dataset.buy].name} grew!`); }
    else sfx("bad");
    renderUpgrades();
  }));
}

/* ----- The satchel: everything you carry, and the five slots ----- */
let satSel = null;
function openSatchel(after) {
  satSel = null;
  renderSatchel(after);
}
function renderSatchel(after) {
  const slots = CAMP.slots.map(s => {
    const it = campEquipped(s.id);
    return `<button class="sat-slot ${it ? "" : "empty"}" data-slot="${s.id}" title="${s.help}">
      ${it ? campItemIconHtml(it) : `<span class="ci-icon empty"></span>`}
      <span class="sat-k">${s.name}</span><span class="sat-v">${it ? `<span style="color:${rarityColor(it.rarity)}">${campItemDef(it.id).name}</span>${itUsesText(it)}` : "Empty"}</span></button>`;
  }).join("");
  const groups = CAMP.slots.map(s => ({ s, items: camp.satchel.filter(it => campItemSlot(it.id) === s.id) })).filter(x => x.items.length);
  const loot = camp.satchel.filter(it => campItemSlot(it.id) === "loot");
  const card = it => `<button class="sat-item ${satSel === it.uid ? "sel" : ""} ${Object.values(camp.equip).includes(it.uid) ? "on" : ""}" data-it="${it.uid}">${campItemIconHtml(it)}${it.qty > 1 ? `<b class="sat-q">×${it.qty}</b>` : ""}</button>`;
  const list = groups.map(x => `<div class="sat-group"><div class="sat-gh">${x.s.name}</div><div class="sat-grid">${x.items.map(card).join("")}</div></div>`).join("") +
    (loot.length ? `<div class="sat-group"><div class="sat-gh">Trinkets</div><div class="sat-grid">${loot.map(card).join("")}</div></div>` : "");
  const sel = camp.satchel.find(it => it.uid === satSel);
  openCampModal(`<h3>Satchel</h3>
    <p class="cb-note">A snake has no hands: one of each kind at a time. Swap freely between levels.</p>
    <div class="sat-slots">${slots}</div>
    <div class="sat-body"><div class="sat-list">${list || `<p class="cb-empty">Nothing yet. Merchants open after each island's first boss.</p>`}</div>
    <div class="sat-detail">${sel ? itemDetailHtml(sel) : `<p class="cb-empty">Pick something to see what it does.</p>`}</div></div>`, { cls: "wide", after });
  const box = document.querySelector("#camp-modal .camp-modal-box");
  box.querySelectorAll("[data-it]").forEach(b => b.addEventListener("click", () => { satSel = +b.dataset.it; sfx("tab"); renderSatchel(after); }));
  box.querySelectorAll("[data-slot]").forEach(b => b.addEventListener("click", () => { const it = campEquipped(b.dataset.slot); if (it) { satSel = it.uid; renderSatchel(after); } }));
  const eq = box.querySelector("[data-equip]");
  if (eq) eq.addEventListener("click", () => {
    const it = camp.satchel.find(x => x.uid === satSel);
    const slot = campItemSlot(it.id);
    if (camp.equip[slot] === it.uid) delete camp.equip[slot]; else camp.equip[slot] = it.uid;
    saveCamp(); sfx("toggle"); renderSatchel(after);
  });
}
function itUsesText(it) {
  const slot = campItemSlot(it.id);
  if (slot === "gear") return ` · ${it.uses} use${it.uses === 1 ? "" : "s"}`;
  if (slot === "spell" || slot === "food") return ` · ${it.uses} charge${it.uses === 1 ? "" : "s"}`;
  if (slot === "rune" && it.qty > 1) return ` · ×${it.qty}`;
  return "";
}
function itemDetailHtml(it) {
  const d = campItemDef(it.id);
  if (!d) {
    const l = CAMP.lootById[it.id];
    return `<div class="sat-dh">${campItemIconHtml(it, "big")}<div><h4>${l.name}</h4><div class="sat-r">Trinket ×${it.qty}</div></div></div>
      <p>Worth ${coinIconHtml(campItemIsland(it.id))} ${campMoney(campItemIsland(it.id), campSellPrice(it))} each to a merchant. Collect them, or sell them.</p>`;
  }
  const slot = campItemSlot(it.id);
  const on = camp.equip[slot] === it.uid;
  const r = rarityIdx(it.rarity);
  const stat = d.power ? `<div class="sat-stat">${d.power[r]} ${d.unit}</div>` : "";
  return `<div class="sat-dh">${campItemIconHtml(it, "big")}<div><h4 style="color:${rarityColor(it.rarity)}">${campItemName(it)}</h4><div class="sat-r">${CAMP.slots.find(s => s.id === slot).name}${itUsesText(it)}</div></div></div>
    ${stat}<p>${d.does}</p>
    <p class="sat-good"><strong>Good against:</strong> ${d.strong}</p>
    <p class="sat-bad"><strong>Weakness:</strong> ${d.weak}</p>
    ${it.rarity === "legendary" ? `<p class="sat-leg"><strong>Legendary:</strong> ${d.legend}</p>` : `<p class="sat-dim">Legendary: ${d.legend}</p>`}
    <button class="btn ${on ? "" : "btn-primary"}" data-equip>${on ? "Take off" : "Equip"}</button>`;
}

/* ----- Achievements ----- */
function openAchievementsPanel() {
  const list = CAMP.rules.achievements.map(a => {
    const have = Math.min(a.need, campStatValue(a.stat)), done = camp.achievements[a.id];
    return `<div class="ach-row2 ${done ? "done" : ""}"><div><div class="ach-n">${a.name}</div><div class="ach-t">${a.text}</div>
      <div class="ch-bar"><span style="width:${(have / a.need * 100).toFixed(1)}%"></span></div></div>
      <div class="ach-g">${done ? "✓" : `${fmtInt(have)} / ${fmtInt(a.need)}`}<br>${gemIconHtml()} ${a.gems}</div></div>`;
  }).join("");
  const n = CAMP.rules.achievements.filter(a => camp.achievements[a.id]).length;
  openCampModal(`<h3>Achievements</h3><p class="cb-note">${n} of ${CAMP.rules.achievements.length} earned. Each one pays gems.</p><div class="ach-list2">${list}</div>`, { cls: "wide" });
}

/* ----- Skins and themes, bought with gems ----- */
const cosmeticPrice = (kind, i) => { const p = CAMP.rules.cosmetics[kind === "skin" ? "skinPrice" : "themePrice"]; return Math.min(p[2], p[0] + p[1] * i); };
function skinPreviewUrl(skin) {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 24;
  const g = c.getContext("2d");
  for (let i = 0; i < 6; i++) { g.fillStyle = skinVisibleColor(skin, skinColorAt(skin, 5 - i, 0)); g.fillRect(i * 16, 4, 15, 15); }
  g.fillStyle = "#fff"; g.fillRect(84, 7, 3, 3); g.fillRect(84, 13, 3, 3);
  return c.toDataURL();
}
function themePreviewUrl(bd) {
  const c = document.createElement("canvas");
  c.width = 80; c.height = 50;
  const g = c.getContext("2d");
  try { paintBackdrop(g, bd, 80, 50); } catch (e) { g.fillStyle = "#222"; g.fillRect(0, 0, 80, 50); }
  return c.toDataURL();
}
function openSkinsPanel() { renderCosmetics("skin"); }
function openThemesPanel() { renderCosmetics("theme"); }
function renderCosmetics(kind) {
  const isSkin = kind === "skin";
  const list = isSkin ? skins : backdrops;
  const owned = isSkin ? camp.skins : camp.themes;
  const cur = isSkin ? camp.skin : camp.theme;
  const excl = CAMP.rules.cosmetics[isSkin ? "exclusiveSkins" : "exclusiveThemes"];
  const cards = list.map((it, i) => {
    const have = owned.includes(it.id), ex = excl.includes(it.id);
    const price = cosmeticPrice(kind, i);
    const img = isSkin ? skinPreviewUrl(it) : themePreviewUrl(it);
    let btn;
    if (it.id === cur) btn = `<span class="cos-on">Wearing</span>`;
    else if (have) btn = `<button class="btn btn-small" data-wear="${it.id}">Use</button>`;
    else if (ex) btn = `<span class="cos-ex">Challenge reward</span>`;
    else btn = `<button class="btn btn-small ${camp.gems >= price ? "btn-primary" : ""}" data-buyc="${it.id}" data-p="${price}" ${camp.gems >= price ? "" : "disabled"}>${gemIconHtml()} ${price}</button>`;
    return `<div class="cos-card ${have ? "own" : ""} ${ex && !have ? "excl" : ""}"><img src="${img}" alt=""><div class="cos-n">${it.name || it.id}</div>${btn}</div>`;
  }).join("");
  openCampModal(`<h3>${isSkin ? "Skins" : "Themes"}</h3><p class="cb-note">You have ${gemIconHtml()} <strong>${fmtInt(camp.gems)}</strong> gems. ${CAMP.rules.gems.storeSoon} Some are only won from challenges.</p><div class="cos-grid">${cards}</div>`, { cls: "wide" });
  const box = document.querySelector("#camp-modal .camp-modal-box");
  box.querySelectorAll("[data-wear]").forEach(b => b.addEventListener("click", () => {
    if (isSkin) camp.skin = b.dataset.wear; else camp.theme = b.dataset.wear;
    saveCamp(); applyCampCosmetics(); sfx("toggle"); renderCosmetics(kind);
  }));
  box.querySelectorAll("[data-buyc]").forEach(b => b.addEventListener("click", () => {
    const p = +b.dataset.p;
    if (camp.gems < p) { sfx("bad"); return; }
    camp.gems -= p;
    owned.push(b.dataset.buyc);
    if (isSkin) camp.skin = b.dataset.buyc; else camp.theme = b.dataset.buyc;
    saveCamp(); applyCampCosmetics(); sfx("buy"); renderCosmetics(kind);
  }));
}
