/* =========================================================
   src/campaign/camp-home.js
   Home base: on every island, the home stop is that island's tree.
   Clicking it flies the map's camera in close, and the island's home
   opens: the tree itself, as tall and full as its upgrades, with your
   satchel leaning on the trunk, a trophy on its plinth, a standing
   mirror with your snake in it and an easel showing your theme.
   Painted like the map (one chunky pixel at a time, lit from the top
   left), in the sky at the island's height. Nothing floats over the
   picture: you click the things themselves (they light up under the
   pointer), and each opens its page:
     the carving  in the tree's trunk: the island's upgrades (camp-tree.js)
     the satchel  your kit and loot (the old Satchel screen)
     the trophy   achievements (the old Trophy Hall)
     the mirror   skins, and the easel themes (the old Tailor, for gems)
   ========================================================= */
"use strict";

screenEls.camphome = document.getElementById("screen-camphome");
BACK_TARGET.camphome = "modes";
/* 135 pixels tall; as wide as the window's shape allows, with everything kept near the middle */
const HOME_H = 135;
let HOME_W = 240;
let homeIsl = "keep";
let homeRaf = 0;
const homeCanvas = document.getElementById("home-canvas");
const homeViewEl = document.getElementById("home-view");
const homeWorldEl = document.getElementById("home-world");
const homePinsEl = document.getElementById("home-pins");
/* The things you can click: where they stand (dx from the middle, y), how big, what they're called */
/* Build 51: each kind of thing has its own place, shown once you can get that kind of thing */
const homeHas = fam => { const I = CAMP.islands.find(x => x.merchantFamily === fam); return (I && campShopOpen(I.id, "merchant")) || camp.satchel.some(it => campItemDef(it.id) && campItemDef(it.id).family === fam); };
const HOME_SPOTS = [
  { id: "tree", label: "Upgrades" },
  { id: "satchel", dx: 11, y: 87, w: 17, h: 19, label: "Satchel" },
  { id: "trophy", dx: -66, y: 77, w: 20, h: 28, label: "Achievements" },
  { id: "mirror", dx: 43, y: 66, w: 18, h: 40, label: "Skins" },
  { id: "easel", dx: 68, y: 74, w: 21, h: 33, label: "Themes" },
  { id: "rack", dx: -76, y: 99, w: 21, h: 33, label: "Armory rack", when: () => homeHas("gear") },
  { id: "shelf", dx: -52, y: 104, w: 19, h: 26, label: "Spell shelf", when: () => homeHas("spell") },
  { id: "den", dx: 17, y: 116, w: 23, h: 15, label: "Familiar den", when: () => homeHas("pet") },
  { id: "stones", dx: 54, y: 110, w: 17, h: 20, label: "Rune stones", when: () => homeHas("rune") }
];
const homeSpotsNow = () => HOME_SPOTS.filter(sp => !sp.when || sp.when());
let homeHover = null;           // the thing under the pointer (or keyboard focus)
const homeTagEl = document.createElement("span");
homeTagEl.className = "home-tag scroll-frame";
const homeNotesEl = document.createElement("div");
homeNotesEl.id = "home-notes";
screenEls.camphome.appendChild(homeNotesEl);

/* The carving in the trunk: low on the trunk, the height of a snake's head */
function homeCarving() {
  const ups = CAMP.islandById[homeIsl].tree.upgrades;
  const have = ups.reduce((a, u) => a + upTier(u.id), 0), total = ups.reduce((a, u) => a + u.values.length - 1, 0);
  const h = 40 + Math.round((total ? have / total : 0) * 26);
  return { x: Math.round(HOME_W / 2) - 5, y: 102 - Math.round(h * 0.42) - 6, w: 11, h: 13 };
}
const spotBox = sp => (sp.id === "tree" ? homeCarving() : { x: Math.round(HOME_W / 2) + sp.dx, y: sp.y, w: sp.w, h: sp.h });
const treeReady = () => CAMP.islandById[homeIsl].tree.upgrades.some(u => upNextPrice(u.id) !== null && campWallet(homeIsl) >= upNextPrice(u.id));

/* From the map: the camera dives at the home tree, then the home opens */
function openCampHome(isl) {
  homeIsl = isl;
  mapReturnTo = isl;
  camp.at = isl;
  saveCamp();
  if (currentScreen === "modes") {
    const p = nodeAt(isl, "home");
    const vw = mapEl.clientWidth, vh = mapEl.clientHeight, s = mapMax() * 3.2;
    closeLevelPop(true);
    applyCam({ s, tx: vw / 2 - p.x * 2 * s, ty: vh / 2 - (p.y - 8) * 2 * s });
    mapEl.classList.add("diving");
    sfx("whoosh");
    setTimeout(() => { mapEl.classList.remove("diving"); showHome(); }, 520);
    return;
  }
  showHome();
}

/* The sides of the screen, like a stop up close on the map (build 53: zones, not buttons): a fifth of the
   screen on the right walks on to level 1, on the left down to the island below's bridge when there is one.
   Only a chevron shows; where it goes shows on hover. Each flies the map straight to that stop. */
const homeArrows = [-1, 1].map(side => {
  const b = document.createElement("button");
  b.className = "node-arrow zone " + (side < 0 ? "prev" : "next");
  b.addEventListener("click", e => { e.stopPropagation(); if (b._to) mapFlyTo(b._to.key, b._to.id); });
  screenEls.camphome.appendChild(b);
  return b;
});
function renderHomeArrows() {
  homeArrows.forEach(a => { a.className = "node-arrow zone " + (a === homeArrows[0] ? "prev" : "next"); a._to = null; });
  nodeLinks(homeIsl, "home").forEach(l => {
    const a = homeArrows[l.role === "back" ? 0 : 1];
    const L = arrowLabel({ key: homeIsl }, l.to, l.role === "back" ? -1 : 1, l.role);
    const word = typeof l.to.id === "number" && l.to.key === homeIsl ? `Level ${l.to.id}` : L.word;
    a._to = l.to;
    a.className += ` open ${L.cls}`;
    a.innerHTML = `<span class="na-chev" aria-hidden="true">${l.role === "back" ? "&#9664;" : "&#9654;"}</span>` +
      `<span class="na-tip"><span class="na-word">${escapeAttr(word)}</span>${L.sub ? `<span class="na-sub">${escapeAttr(L.sub)}</span>` : ""}</span>`;
    a.setAttribute("aria-label", `${word}${L.sub ? ": " + L.sub : ""}`);
  });
}

function showHome() {
  openScreen("camphome");
  const I = CAMP.islandById[homeIsl];
  document.getElementById("ch-title").textContent = `${I.name}: home`;
  screenEls.camphome.style.setProperty("--isl", I.colors.accent);
  renderHomeArrows();
  renderHomePins();
  layoutHome();
  if (!homeRaf) homeRaf = requestAnimationFrame(homeLoop);
}

function layoutHome() {
  const vw = homeViewEl.clientWidth, vh = homeViewEl.clientHeight;
  if (!vw || !vh) return;
  const w = Math.max(184, Math.min(320, Math.round(HOME_H * vw / vh)));
  if (w !== HOME_W || homeCanvas.width !== w) { HOME_W = w; homeCanvas.width = w; homeCanvas.height = HOME_H; renderHomePins(); }
  const s = Math.max(vw / HOME_W, vh / HOME_H) * 1.05;      // (5% over: room to look around, look-around.js)
  homeWorldEl.style.width = HOME_W + "px";
  homeWorldEl.style.height = HOME_H + "px";
  homeWorldEl.style.transform = `translate(${(vw - HOME_W * s) / 2}px, ${(vh - HOME_H * s) / 2}px) scale(${s})`;
  homeWorldEl.style.setProperty("--inv", (1 / s * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mui")) || 1)).toFixed(4));
}

/* Each thing gets a button the size of its picture: invisible, so the picture is what you click */
function renderHomePins() {
  homePinsEl.innerHTML = "";
  homeSpotsNow().forEach(sp => {
    const b = spotBox(sp);
    const btn = document.createElement("button");
    btn.className = "home-spot";
    btn.dataset.key = "home-" + sp.id;
    Object.assign(btn.style, { left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px" });
    btn.setAttribute("aria-label", sp.id === "tree" ? `Upgrades: ${CAMP.islandById[homeIsl].tree.name}` : sp.label);
    const show = () => { homeHover = sp.id; placeHomeTag(sp); };
    const hide = () => { if (homeHover === sp.id) { homeHover = null; homeTagEl.classList.remove("open"); } };
    btn.addEventListener("pointerenter", show);
    btn.addEventListener("focus", show);
    btn.addEventListener("pointerleave", hide);
    btn.addEventListener("blur", hide);
    btn.addEventListener("click", () => openHomeThing(sp.id));
    homePinsEl.appendChild(btn);
  });
  homePinsEl.appendChild(homeTagEl);
  renderHomeNotes();
}

/* A little scroll over whatever's under the pointer, saying what it is */
function placeHomeTag(sp) {
  const b = spotBox(sp);
  const count = room => (typeof picItems === "function" ? picItems(room).length : 0);
  const room = { satchel: "satchel", rack: "rack", shelf: "shelf", den: "den", stones: "stones" }[sp.id];
  const extra = sp.id === "tree" && treeReady() ? " +" : room && count(room) ? ` (${count(room)})` : sp.id === "trophy" ? ` ${Object.keys(camp.achievements).length}/${CAMP.rules.achievements.length}` : "";
  homeTagEl.textContent = sp.label + extra;
  homeTagEl.style.left = (b.x + b.w / 2) + "px";
  homeTagEl.style.top = b.y + "px";
  homeTagEl.classList.add("open");
}

/* The notice board beside the tree: the bounty on the island's next boss, and your quest */
function renderHomeNotes() {
  const bounty = campBountyHtml(homeIsl);
  homeNotesEl.innerHTML = (bounty ? `<div class="plate cp-bounty">${bounty}</div>` : "") + (campActiveQuest() ? `<div class="plate cp-trials">${campQuestHtml(null)}</div>` : "");
}

function openHomeThing(id) {
  sfx("tab");
  homeHover = null;
  homeTagEl.classList.remove("open");
  if (id === "tree") openCampTree(homeIsl);
  else if (["satchel", "rack", "shelf", "den", "stones"].includes(id)) openPicRoom(id);
  else if (id === "trophy") openScreen("achievements");
  else { upgradeTab = id === "mirror" ? "skins" : "backdrops"; openScreen("upgrades"); }
}

/* The outline of whatever's under the pointer, a pixel wide, gently pulsing */
function drawHomeHover(g, t) {
  if (!homeHover) return;
  const sp = HOME_SPOTS.find(x => x.id === homeHover);
  if (!sp) return;
  const b = spotBox(sp);
  const a = 0.55 + 0.35 * Math.sin(t * 6);
  g.fillStyle = `rgba(255,240,170,${a})`;
  g.fillRect(b.x - 1, b.y - 1, b.w + 2, 1); g.fillRect(b.x - 1, b.y + b.h, b.w + 2, 1);
  g.fillRect(b.x - 1, b.y, 1, b.h); g.fillRect(b.x + b.w, b.y, 1, b.h);
  [[b.x - 1, b.y - 1], [b.x + b.w, b.y - 1], [b.x - 1, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([x, y]) => { g.fillStyle = "#ffffff"; g.fillRect(x, y, 1, 1); });
}

function homeLoop(ts) {
  homeRaf = 0;
  if (currentScreen !== "camphome") return;
  homeRaf = requestAnimationFrame(homeLoop);
  if (Math.floor(ts / 40) === Math.floor((ts - 17) / 40)) return;
  drawHome(ts / 1000);
}

/* ----- The picture -----
   Home is painted in textures/scenes/home/ (home:... in the index). Each island has sky.png and
   ground.png, 320 wide and centered (a narrower window shows their middle), tree.png (a sprite sheet:
   a row for every upgrade tier bought, four columns as its leaves stir), its far islands and its
   falling leaf. The rest is the same on every island: sun, moon, stars, clouds, the trophy, mirror,
   easel, satchel, rack, shelf, den, stones and the carving. What moves is placed and timed here. */
const HOME_PLATE_W = 320;
const HOME_TREE_STEP = 2 * Math.PI / 1.3 / 4;    // a quarter of the leaves' stir: one frame of the tree
const homeTier = isl => { const ups = CAMP.islandById[isl].tree.upgrades; return { have: ups.reduce((a, u) => a + upTier(u.id), 0), total: ups.reduce((a, u) => a + u.values.length - 1, 0) }; };

/* The sky's things: stars up high, the sun down low, the moon; then far islands and clouds drifting by */
function drawHomeSky(g, isl, t) { drawHomeStars(g, isl, t); drawHomeDrift(g, isl, t); }
function drawHomeStars(g, isl, t) {
  const isle = ISLANDS[isl];
  if (isle.n >= 2) for (let i = 0; i < 60; i++) { const tw = Math.sin(t * (1 + mapHash(i, 2, 7) * 3) + i); if (tw > -0.2) texPaint(g, "home:star", Math.round(mapHash(i, 1, 7) * HOME_W), Math.round(mapHash(i, 3, 7) * 70), { frame: tw > 0.7 ? 0 : 1 }); }
  if (isle.n === 0) texLayer(g, "home:sun", 16 - 9, 74 - 9);
  if (isle.n === 4) { texLayer(g, "home:moon", HOME_W - 30 - 7, 22 - 7); texLayer(g, "home:moon-shadow", HOME_W - 28 - 5, 21 - 5); }
}
/* Each far island and cloud is one picture (a cloud: a sheet of its three puffs, laid one over another),
   placed on the nearest whole pixel as it drifts */
function drawHomeDrift(g, isl, t) {
  for (let i = 0; i < 5; i++) {
    const x = ((mapHash(i, 5, 3) * 300 + t * (0.6 + i * 0.2)) % 300) - 30, y = 20 + mapHash(i, 6, 3) * 50;
    texPaint(g, `home:${isl}:far-${i + 1}`, Math.round(x) - 20, Math.floor(y));
  }
  for (let i = 0; i < 6; i++) {
    const x = ((mapHash(i, 9, 3) * 320 + t * (1.4 + i * 0.3)) % 320) - 40, y = 10 + i * 13;
    for (let p = 0; p < 3; p++) texPaint(g, `home:cloud-${i + 1}`, Math.round(x) - 40, y - 12, { frame: p, alpha: 0.55 });   // three puffs, one over another
  }
}

function drawHome(t) {
  const g = homeCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const isl = homeIsl, isle = ISLANDS[isl];
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  const cx = Math.round(HOME_W / 2), ox = cx - HOME_PLATE_W / 2;
  g.drawImage(texCanvas(`home:${isl}:sky`), ox, 0);
  drawHomeSky(g, isl, t);
  g.drawImage(texCanvas(`home:${isl}:ground`), ox, 0);
  drawHomeTreeBig(g, isl, cx, 102, t);
  drawHomeTrophy(g, cx - 56, 104, t);
  drawHomeMirror(g, cx + 52, 104, t);
  drawHomeEasel(g, cx + 78, 106, t);
  drawHomeSatchel(g, cx + 13, 105, t);
  drawHomeCarving(g, t);
  // build 51: the rack, the shelf, the den and the stones, each once you can fill it
  const has = id => homeSpotsNow().some(sp => sp.id === id);
  if (has("rack")) drawHomeRack(g, cx - 66, 132, t);
  // you, curled up by the roots (drawn from your skin's colors)
  const skin = currentSkin();
  const sx = cx - 24, sy = 112;
  // its shadow on the grass, then one unbroken coil: from the tail tip, tucked under, round to the neck
  g.fillStyle = "rgba(0,0,0,0.16)";
  [[-7, 15], [-8, 17], [-7, 15]].forEach(([dx, w], j) => g.fillRect(Math.round(sx + 1.5 + dx), sy + 3 + j, w, 1));
  const COIL = 40;
  for (let k = COIL - 1; k >= 0; k--) {
    const u = k / (COIL - 1), a = -0.5 + u * Math.PI * 2 * 0.96;   // u: 0 at the neck, 1 at the tail
    const s = u > 0.94 ? 1 : u > 0.82 ? 2 : 3, off = (3 - s) / 2;
    const x = sx + Math.cos(a) * 7 + off, y = sy + Math.sin(a) * 3 + off;
    R(x, y, s, s, skinColorAt(skin, 1 + Math.floor(u * 12), t * 1000));
    R(x, y, s, 1, "rgba(255,255,255,0.22)");
  }
  const awake = Math.sin(t * 0.35) > 0.2;
  const hx = sx + 8, hy = sy - 3 + (awake ? -2 : 0);
  if (awake) R(hx, hy + 3, 3, 3, skinColorAt(skin, 0, t * 1000));           // the neck, raised
  R(hx, hy, 4, 4, skinColorAt(skin, 0, t * 1000)); R(hx, hy, 4, 1, "rgba(255,255,255,0.3)");
  if (awake) { R(hx + 2, hy + 1, 2, 2, "#ffffff"); R(hx + 3, hy + 1 + (Math.sin(t * 0.7) > 0.95 ? 0 : 1), 1, 1, "#111"); if (Math.sin(t * 3) > 0.7) R(hx + 4, hy + 3, 2, 1, "#ff3b6b"); }
  else { R(hx + 2, hy + 2, 2, 1, "#111"); for (let i = 0; i < 2; i++) { const ph = (t * 0.4 + i / 2) % 1; g.globalAlpha = 1 - ph; g.fillStyle = "#e8e0ff"; g.font = `6px ${GAME_FONT}`; g.fillText("z", hx + 6 + ph * 6, hy - 2 - ph * 10); g.globalAlpha = 1; } }
  // fireflies in the evening islands, leaves drifting down everywhere
  if (isle.n >= 2) for (let i = 0; i < 10; i++) { const glow = Math.sin(t * 2 + i * 1.7); if (glow > 0.1) texDraw(g, "home:firefly", Math.round(10 + mapHash(i, 4, 5) * (HOME_W - 20) + Math.sin(t * 0.6 + i) * 8), Math.round(60 + mapHash(i, 5, 5) * 50 + Math.cos(t * 0.5 + i) * 5), glow > 0.6 ? 0 : 1); }
  for (let k = 0; k < 6; k++) { const ph = (t * 0.1 + k / 6) % 1; texDraw(g, `home:${isl}:leaf`, Math.round(cx - 50 + k * 18 + Math.sin(t + k * 2) * 8), Math.round(20 + ph * 90), k % 3); }
  if (has("shelf")) drawHomeShelf(g, cx - 43, 130, t);
  if (has("den")) drawHomeDen(g, cx + 28, 131, t);
  if (has("stones")) drawHomeStones(g, cx + 62, 130, t);
  drawHomeHover(g, t);
}

/* A weapon rack and an armor stand: whatever gear you wear hangs on it */
function drawHomeRack(g, x, y, t) {
  texDraw(g, "home:rack", x - 10, y - 31);
  const it = campEquipped("gear");
  if (it) g.drawImage(texCanvas("ci:" + it.id, "ci:shield"), x - 5, y - 22, 10, 10);
  else texDraw(g, "home:rack-empty", x - 4, y - 21);
  if (Math.sin(t * 1.7) > 0.93) texDraw(g, "home:glint", x + 5, y - 25);
}
/* A little bookcase of spell scrolls, a candle on top: its flame flickers and glows */
function drawHomeShelf(g, x, y, t) {
  texDraw(g, "home:shelf", x - 9, y - 28);
  texDraw(g, "home:shelf-flame", x + 4, y - 30 - (Math.sin(t * 9) > 0 ? 1 : 0));
  texPaint(g, "home:shelf-glow", x, y - 34, { alpha: 0.12 + 0.05 * Math.sin(t * 5) });
}
/* A round cushioned basket; the familiar you bring naps in it */
function drawHomeDen(g, x, y, t) {
  texLayer(g, "home:den", x - 11, y - 10);
  const it = campEquipped("pet");
  if (it) drawPetSprite(g, it.id, x - 6, y - 19 + Math.round(Math.sin(t * 1.5)), 12, t * 1000, { shells: 1 });
}
/* Three standing stones with carved runes; the middle one's rune is in your active rune's color, and glows */
function drawHomeStones(g, x, y, t) {
  const on = campEquipped("rune");
  const glow = on ? campItemDef(on.id).color : null;
  texPaint(g, "home:stones", x - 11, y - 19, { colors: { rune: glow || "#3a3230" } });
  if (glow) texPaint(g, "home:stones-glow", x - 4, y - 24, { alpha: 0.18 + 0.1 * Math.sin(t * 2), colors: { glow } });
}

/* The carving in the trunk: an oval of bark stripped back and a sprouting leaf cut into it.
   When an upgrade is in reach, the cuts fill with gold and the edge glows (its key color, swapped
   for a gold that pulses) */
function drawHomeCarving(g, t) {
  const b = homeCarving();
  const ready = treeReady();
  const glow = 0.5 + 0.5 * Math.sin(t * 3);
  texPaint(g, "home:carving", b.x, b.y, { frame: ready ? 1 : 0, colors: { edge: `rgba(255,${200 + Math.round(40 * glow)},90,1)` } });
  if (ready) texPaint(g, "home:carving-glow", b.x - 2, b.y - 2, { alpha: 0.12 + 0.12 * glow });
  texDraw(g, "home:carving-cuts", b.x, b.y + 2, ready ? 1 : 0);
}

/* The tree, close up: a row of its sheet for every upgrade tier bought (or as many rows as the
   sheet has, spread over the tiers), its leaves stirring; fruit glinting, a lantern after dark */
function drawHomeTreeBig(g, isl, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const { have, total } = homeTier(isl);
  const id = `home:${isl}:tree`, rows = Math.max(1, Math.ceil(texFrameCount(id) / 4));
  const f = total ? have / total : 0;
  texDrawAt(g, id, x, y, Math.round(f * (rows - 1)) * 4 + Math.floor(t / HOME_TREE_STEP) % 4);
  const h = 40 + Math.round(f * 26);
  // the fruit's glints: one fruit for every tier bought, among the leaves
  const clusters = [[0, -h - 4, 18], [-20, -h * 0.72, 14], [20, -h * 0.7, 14], [-30, -h * 0.5, 10], [30, -h * 0.48, 10], [-10, -h - 14, 12], [12, -h - 12, 12]];
  const fruit = [];
  for (let i = 0; i < Math.min(30, have); i++) {
    const [dx, dy, r0] = clusters[i % clusters.length];
    const a = mapHash(i, 4, 9) * Math.PI * 2, d = r0 * 0.7 * Math.sqrt(mapHash(i, 5, 9));
    fruit.push([x + dx + Math.cos(a) * d * 1.2, y + dy + Math.sin(a) * d * 0.8]);
  }
  // (the fruit are in the sheet, so a glint is left off wherever a later fruit sits over it, as it always was)
  const under = (i, px, py) => fruit.some(([fx, fy], j) => j > i && px >= Math.round(fx) && px < Math.round(fx) + 2 && py >= Math.round(fy) && py < Math.round(fy) + 2);
  fruit.forEach(([fx, fy], i) => {
    if (Math.sin(t * 3 + i * 2) <= 0.93) return;
    [[Math.round(fx - 1), Math.round(fy)], [Math.round(fx + 2), Math.round(fy + 1)]].forEach(([px, py]) => { if (!under(i, px, py)) texDraw(g, "home:glint", px, py); });
  });
  // a lantern hanging from a bough once the sky goes dark, its light breathing
  if (ISLANDS[isl].n >= 2) {
    const lx = x - 24 + Math.round(Math.sin(t * 1.2) * 1), ly = y - h * 0.6 + 6;
    texDraw(g, "home:lantern", lx - 2, Math.round(ly) - 4);
    for (let r = 3; r >= 1; r--) texPaint(g, `home:lantern-glow-${r}`, lx - 1 - r * 2, ly - r * 2, { alpha: (0.06 + 0.03 * Math.sin(t * 4)) * (4 - r) });
  }
  void R;
}

/* The satchel, leaning on the trunk, with whatever you carry peeking out */
function drawHomeSatchel(g, x, y, t) {
  texDraw(g, "home:satchel-strap", x - 1, y - 15);
  if (camp.satchel.length) camp.satchel.slice(-2).forEach((e, i) => { g.drawImage(texCanvas("ci:" + e.id, "gift"), x + 1 + i * 6, y - 16, 7, 7); });
  texLayer(g, "home:satchel", x, y - 10);
  if (Math.sin(t * 2) > 0.9) texDraw(g, "home:glint", x + 5, y - 8);
}

/* A golden cup on a stone plinth (silver until your first achievement), shining and glowing */
function drawHomeTrophy(g, x, y, t) {
  const got = Object.keys(camp.achievements).length;
  texDraw(g, "home:trophy", x - 8, y - 22, got ? 1 : 0);
  if (got && Math.sin(t * 2.2) > 0.6) texDraw(g, "home:trophy-glint", x - 4, y - 25);
  if (got) for (let r = 3; r >= 1; r--) texPaint(g, `home:trophy-glow-${r}`, x - 5 - r * 2, y - 22 - r * 2, { alpha: (0.05 + 0.03 * Math.sin(t * 2)) * (4 - r) });
}

/* A standing mirror, and you in it, in the skin you're wearing (drawn from its colors) */
function drawHomeMirror(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  texDraw(g, "home:mirror", x - 8, y - 35);
  const skin = currentSkin();
  for (let i = 0; i < 8; i++) R(x - 4 + i, y - 8 - Math.round(Math.sin(t * 2 - i * 0.7) * 1.2), 2, 2, skinColorAt(skin, 7 - i, t * 1000));
  R(x + 3, y - 12, 3, 3, skinColorAt(skin, 0, t * 1000)); R(x + 4, y - 11, 1, 1, "#ffffff");
  // a shine sweeping across the glass
  const sh = ((t * 0.5) % 2) * 20 - 6;
  for (let j = 0; j < 26; j++) { const sx = Math.round(sh + j * 0.4); if (sx >= -6 && sx < 6) texPaint(g, "home:mirror-shine", x + sx, y - 30 + j, { alpha: 0.55 }); }
}

/* An easel with a painting of the theme you're using */
const homeThemeCache = { id: null, c: null };
function drawHomeEasel(g, x, y, t) {
  texDraw(g, "home:easel", x - 9, y - 30);
  const bd = currentBackdrop();
  if (homeThemeCache.id !== bd.id) {
    const c = document.createElement("canvas");
    c.width = 40; c.height = 30;
    try { paintBackdrop(c.getContext("2d"), bd, 40, 30); } catch (e) { c.getContext("2d").fillStyle = "#111"; c.getContext("2d").fillRect(0, 0, 40, 30); }
    homeThemeCache.id = bd.id;
    homeThemeCache.c = c;
  }
  g.drawImage(homeThemeCache.c, 0, 0, 40, 30, x - 8, y - 27, 17, 14);
  void t;
}

/* Coming back from the tree, the satchel or the Tailor redraws home; leaving goes out to the map */
(() => {
  const orig = openScreen;
  window.openScreen = function (name) {
    if (name === "modes" && currentScreen === "camphome") mapReturnTo = homeIsl;
    orig.apply(this, arguments);
    if (name === "camphome") {
      renderHomePins();
      requestAnimationFrame(layoutHome);
      layoutHome();
      if (!homeRaf) homeRaf = requestAnimationFrame(homeLoop);
    }
  };
})();
window.addEventListener("resize", () => { if (currentScreen === "camphome") layoutHome(); });
