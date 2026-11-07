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

function showHome() {
  openScreen("camphome");
  const I = CAMP.islandById[homeIsl];
  document.getElementById("ch-title").textContent = `${I.name}: home`;
  screenEls.camphome.style.setProperty("--isl", I.colors.accent);
  renderHomePins();
  layoutHome();
  if (!homeRaf) homeRaf = requestAnimationFrame(homeLoop);
}

function layoutHome() {
  const vw = homeViewEl.clientWidth, vh = homeViewEl.clientHeight;
  if (!vw || !vh) return;
  const w = Math.max(184, Math.min(320, Math.round(HOME_H * vw / vh)));
  if (w !== HOME_W || homeCanvas.width !== w) { HOME_W = w; homeCanvas.width = w; homeCanvas.height = HOME_H; renderHomePins(); }
  const s = Math.max(vw / HOME_W, vh / HOME_H);
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
  homeNotesEl.innerHTML = (bounty ? `<div class="plate cp-bounty">${bounty}</div>` : "") + `<div class="plate cp-trials">${campQuestHtml(null)}</div>`;
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

/* ----- The picture ----- */
const homeSkyCache = {};
function homeSky(isl) {
  const key = isl + HOME_W;
  if (homeSkyCache[key]) return homeSkyCache[key];
  const c = document.createElement("canvas");
  c.width = HOME_W; c.height = HOME_H;
  const g = c.getContext("2d");
  const y = ISLANDS[isl].y;
  const top = skyAt(y - 150), bottom = skyAt(y + 10);
  for (let yy = 0; yy < HOME_H; yy++) for (let x = 0; x < HOME_W; x++) {
    const k = Math.min(1, Math.max(0, yy / HOME_H + (BAYER[(yy % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.12));
    const q = Math.round(k * 9) / 9;
    g.fillStyle = `rgb(${top.map((v, i) => Math.round(v + (bottom[i] - v) * q)).join(",")})`;
    g.fillRect(x, yy, 1, 1);
  }
  return (homeSkyCache[key] = c);
}

const homeGroundCache = {};
function homeGround(isl) {
  const key = isl + HOME_W;
  if (homeGroundCache[key]) return homeGroundCache[key];
  const cx = Math.round(HOME_W / 2);
  const c = document.createElement("canvas");
  c.width = HOME_W; c.height = HOME_H;
  const g = c.getContext("2d");
  const isle = ISLANDS[isl];
  const [a, b, edge] = MAP_BIOME[isl];
  // the far rim of the island, then the grass coming toward you
  for (let x = 0; x < HOME_W; x++) {
    const top = 92 + Math.round(Math.sin(x * 0.04 + isle.n) * 2 + mapNoise(x, 0, 18, isle.n) * 3);
    for (let y = top; y < HOME_H; y++) {
      let col = ((x + y) & 1) && mapHash(x, y, isle.n + 5) > 0.45 ? b : a;
      col = isleGroundColor(isl, x - cx, Math.round((y - 113) * 0.8), col, isle);
      if (y === top) col = shadeHex(a, 0.25);
      else if (y === top + 1) col = shadeHex(a, 0.12);
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  // a path running off toward the levels, trodden like the map's
  const dirt = isleDirt(isl);
  for (let x = cx + 30; x < HOME_W; x++) {
    const y = 108 + Math.round(Math.sin(x * 0.07) * 2 + (x - cx - 30) * 0.12);
    g.fillStyle = dirt[0]; g.fillRect(x, y, 1, 4);
    g.fillStyle = dirt[1]; g.fillRect(x, y + 4, 1, 1);
    if (mapHash(x, y, 3) > 0.8) { g.fillStyle = dirt[2]; g.fillRect(x, y + 1, 1, 1); }
  }
  // the island's own little things in the grass
  const rnd = seededRandom(isle.n * 31 + 9);
  for (let i = 0; i < 14; i++) {
    const x = Math.round(rnd() * HOME_W), y = 100 + Math.round(rnd() * 32);
    if (Math.abs(x - cx) < 30 && y < 112) continue;
    if (isl === "keep") isleTuft(g, x, y, "#4f8f3a");
    else if (isl === "spire") { g.fillStyle = i % 2 ? "#7fe3ff" : "#b36bff"; g.fillRect(x, y - 3, 1, 3); g.fillRect(x + 1, y - 2, 1, 2); }
    else if (isl === "hollow") { if (i % 3) isleTuft(g, x, y, "#8a8a34"); else { g.fillStyle = "#ff8c1a"; g.fillRect(x - 2, y - 2, 5, 3); g.fillStyle = "#3a6a1a"; g.fillRect(x, y - 3, 1, 1); } }
    else if (isl === "reef") { g.fillStyle = i % 2 ? "#fff0e0" : "#ff9ab0"; g.fillRect(x - 1, y - 1, 3, 1); g.fillRect(x, y - 2, 1, 1); }
    else { g.fillStyle = "#1a1418"; g.fillRect(x, y - 4, 1, 4); g.fillRect(x - 1, y - 2, 1, 1); }
  }
  return (homeGroundCache[key] = c);
}

function drawHome(t) {
  const g = homeCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const isl = homeIsl, isle = ISLANDS[isl], I = CAMP.islandById[isl];
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  g.drawImage(homeSky(isl), 0, 0);
  // stars up high, the sun down low
  if (isle.n >= 2) for (let i = 0; i < 60; i++) { const tw = Math.sin(t * (1 + mapHash(i, 2, 7) * 3) + i); if (tw > -0.2) R(mapHash(i, 1, 7) * HOME_W, mapHash(i, 3, 7) * 70, 1, 1, tw > 0.7 ? "#fffbe0" : "rgba(255,250,230,0.5)"); }
  if (isle.n === 0) { skyDisc(g, 16, 74, 9, "rgba(255,220,150,0.3)"); skyDisc(g, 16, 74, 6, "#fff0b8"); }
  if (isle.n === 4) { skyDisc(g, HOME_W - 30, 22, 7, "rgba(255,250,220,0.15)"); skyDisc(g, HOME_W - 30, 22, 5, "#fff6d8"); skyDisc(g, HOME_W - 28, 21, 4.4, "rgba(40,30,80,0.9)"); }
  // far islands and clouds drifting by
  for (let i = 0; i < 5; i++) {
    const x = ((mapHash(i, 5, 3) * 300 + t * (0.6 + i * 0.2)) % 300) - 30, y = 20 + mapHash(i, 6, 3) * 50, w = 8 + mapHash(i, 7, 3) * 12;
    const [r0, g0, b0] = skyAt(isle.y - 150 + y * 1.2);
    g.fillStyle = `rgba(${Math.round(r0 * 0.75)},${Math.round(g0 * 0.78)},${Math.round(b0 * 0.85)},0.7)`;
    g.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 2);
    for (let r = 1; r < w * 0.5; r++) { const ww = Math.max(1, Math.round(w * (1 - r / (w * 0.5)))); g.fillRect(Math.round(x - ww / 2), Math.round(y + 1 + r), ww, 1); }
  }
  for (let i = 0; i < 6; i++) {
    const w = 20 + mapHash(i, 8, 3) * 26, x = ((mapHash(i, 9, 3) * 320 + t * (1.4 + i * 0.3)) % 320) - 40, y = 10 + i * 13;
    drawCloud(g, x, y, w, "rgba(255,255,255,0.55)");
  }
  g.drawImage(homeGround(isl), 0, 0);
  const cx = Math.round(HOME_W / 2);
  drawHomeTreeBig(g, isl, cx, 102, t);
  drawHomeTrophy(g, cx - 56, 104, t);
  drawHomeMirror(g, cx + 52, 104, t);
  drawHomeEasel(g, cx + 78, 106, t);
  drawHomeSatchel(g, cx + 13, 105, t);
  drawHomeCarving(g, t);
  // build 51: the rack, the shelf, the den and the stones, each once you can fill it
  const has = id => homeSpotsNow().some(sp => sp.id === id);
  if (has("rack")) drawHomeRack(g, cx - 66, 132, t);
  // you, curled up by the roots
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
  // fireflies in the evening islands, petals and leaves everywhere
  if (isle.n >= 2) for (let i = 0; i < 10; i++) { const glow = Math.sin(t * 2 + i * 1.7); if (glow > 0.1) R(10 + mapHash(i, 4, 5) * (HOME_W - 20) + Math.sin(t * 0.6 + i) * 8, 60 + mapHash(i, 5, 5) * 50 + Math.cos(t * 0.5 + i) * 5, 1, 1, glow > 0.6 ? "#fff6a8" : "#c8d060"); }
  for (let k = 0; k < 6; k++) { const ph = (t * 0.1 + k / 6) % 1; R(cx - 50 + k * 18 + Math.sin(t + k * 2) * 8, 20 + ph * 90, 1, 1, CTREE_LEAVES[isl][k % 3]); }
  if (has("shelf")) drawHomeShelf(g, cx - 43, 130, t);
  if (has("den")) drawHomeDen(g, cx + 28, 131, t);
  if (has("stones")) drawHomeStones(g, cx + 62, 130, t);
  drawHomeHover(g, t);
}

/* A weapon rack and an armor stand: whatever gear you wear hangs on it */
function drawHomeRack(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  R(x - 10, y - 2, 21, 2, "#4a3018");
  R(x - 9, y - 30, 2, 28, "#6a4628"); R(x + 8, y - 30, 2, 28, "#6a4628"); R(x - 10, y - 31, 21, 2, "#7a5232");
  R(x - 8, y - 20, 17, 1, "#5a3a20"); R(x - 8, y - 9, 17, 1, "#5a3a20");
  // a spear and a sword leaning on it, a shield hanging
  R(x - 6, y - 29, 1, 27, "#9aa3ad"); R(x - 7, y - 31, 3, 3, "#c8ced6");
  R(x + 5, y - 26, 1, 22, "#d8dde6"); R(x + 3, y - 8, 5, 1, "#c08a10");
  const it = campEquipped("gear");
  if (it) g.drawImage(texCanvas("ci:" + it.id, "ci:shield"), x - 5, y - 22, 10, 10);
  else { R(x - 4, y - 21, 8, 9, "#8a6a4a"); R(x - 3, y - 20, 6, 7, "#a8845a"); }
  if (Math.sin(t * 1.7) > 0.93) R(x + 5, y - 25, 1, 1, "#ffffff");
}
/* A little bookcase of spell scrolls, a candle on top */
function drawHomeShelf(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  R(x - 9, y - 24, 19, 24, "#4a2e18"); R(x - 8, y - 23, 17, 22, "#2a1a0e");
  R(x - 8, y - 16, 17, 1, "#6a4628"); R(x - 8, y - 8, 17, 1, "#6a4628");
  const cols = ["#b36bff", "#3a82e0", "#d1202a", "#3ddc84", "#ffd23f"];
  for (let i = 0; i < 4; i++) { R(x - 7 + i * 4, y - 22, 3, 6, cols[i]); R(x - 7 + i * 4, y - 14, 3, 6, cols[(i + 2) % 5]); R(x - 6 + i * 4, y - 6, 2, 5, cols[(i + 4) % 5]); }
  R(x + 4, y - 28, 2, 4, "#e8dcc0"); const fl = Math.sin(t * 9) > 0 ? 1 : 0; R(x + 4, y - 30 - fl, 2, 2, "#ffb020");
  g.fillStyle = `rgba(255,200,120,${0.12 + 0.05 * Math.sin(t * 5)})`; g.fillRect(x, y - 34, 10, 10);
}
/* A round cushioned basket; the familiar you bring naps in it */
function drawHomeDen(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  R(x - 11, y - 8, 23, 8, "#b08040"); for (let k = -10; k < 12; k += 3) R(x + k, y - 7, 1, 6, "#8a6030");
  R(x - 10, y - 10, 21, 3, "#7a6aa8"); R(x - 9, y - 10, 19, 1, "#9a8ac8"); R(x - 11, y, 23, 1, "rgba(0,0,0,0.3)");
  const it = campEquipped("pet");
  if (it) drawPetSprite(g, it.id, x - 6, y - 19 + Math.round(Math.sin(t * 1.5)), 12, t * 1000, { shells: 1 });
}
/* Three standing stones with carved runes; the active one glows */
function drawHomeStones(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const on = campEquipped("rune");
  const glow = on ? campItemDef(on.id).color : null;
  [[-7, 14], [0, 19], [7, 12]].forEach(([dx, h], i) => {
    R(x + dx - 3, y - h, 6, h, "#6a6260"); R(x + dx - 3, y - h, 6, 1, "#8a8280"); R(x + dx + 2, y - h, 1, h, "#4a4240");
    R(x + dx - 1, y - h + 4, 2, 1, i === 1 && glow ? glow : "#3a3230"); R(x + dx, y - h + 5, 1, 3, i === 1 && glow ? glow : "#3a3230");
  });
  if (glow) { g.fillStyle = glow; g.globalAlpha = 0.18 + 0.1 * Math.sin(t * 2); g.fillRect(x - 4, y - 24, 8, 10); g.globalAlpha = 1; }
  R(x - 11, y, 23, 1, "rgba(0,0,0,0.3)");
}

/* The carving in the trunk: an oval of bark stripped back and a sprouting leaf cut into it.
   When an upgrade is in reach, the cuts fill with gold and the edge glows. */
const CARVE_ROWS = [".....x.....", "....xxx....", "...x.x.x...", "..x..x..x..", ".....x.....", "...x.x.x...", "....xxx....", ".....x.....", ".....x....."];
function drawHomeCarving(g, t) {
  const b = homeCarving();
  const ready = treeReady();
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  const widths = [5, 7, 9, 11, 11, 11, 11, 11, 11, 11, 9, 7, 5];
  const glow = 0.5 + 0.5 * Math.sin(t * 3);
  widths.forEach((w, j) => {
    const x0 = b.x + (11 - w) / 2;
    R(x0, b.y + j, w, 1, j === 0 || j === 12 ? "#24140a" : j < 4 ? "#c8945a" : "#a8784a");
    R(x0, b.y + j, 1, 1, ready ? `rgba(255,${200 + Math.round(40 * glow)},90,1)` : "#24140a");
    R(x0 + w - 1, b.y + j, 1, 1, ready ? `rgba(255,${200 + Math.round(40 * glow)},90,1)` : "#24140a");
  });
  if (ready) { g.fillStyle = `rgba(255,210,90,${0.12 + 0.12 * glow})`; g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); }
  CARVE_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== "x") return;
    R(b.x + i, b.y + 2 + j, 1, 1, ready ? (j < 3 ? "#fff0a0" : "#ffd23f") : "#3a2414");
    if (!ready) R(b.x + i + 1, b.y + 3 + j, 1, 1, "#d8a868");
  }));
}

/* The tree, close up: trunk and boughs as thick as the upgrades bought, leaves and fruit */
function drawHomeTreeBig(g, isl, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const ups = CAMP.islandById[isl].tree.upgrades;
  const have = ups.reduce((a, u) => a + upTier(u.id), 0), total = ups.reduce((a, u) => a + u.values.length - 1, 0);
  const f = total ? have / total : 0;
  const leaves = CTREE_LEAVES[isl];
  const h = 40 + Math.round(f * 26), tw = 6 + Math.round(f * 6);
  // roots
  for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 8; k++) R(x + i * (tw / 2 + k), y - 2 + Math.round(k * 0.4), 2, 2, k % 3 ? "#5a3a20" : "#6a4628");
  // the trunk, lit from the left
  for (let j = 0; j < h; j++) {
    const w = Math.round(tw * (1 - j / h * 0.45));
    const sway = Math.round(Math.sin(t * 0.6 + j * 0.05) * (j / h) * 1.2);
    R(x - Math.floor(w / 2) + sway, y - j, w, 1, "#5a3a20");
    R(x - Math.floor(w / 2) + sway, y - j, 1, 1, "#8a6238");
    R(x - Math.floor(w / 2) + sway + w - 1, y - j, 1, 1, "#3a2414");
    if (j % 7 === 3) R(x - 1 + sway, y - j, 2, 1, "#4a2e18");
  }
  // boughs reaching out
  const bough = (a, len, at) => { for (let k = 0; k < len; k++) R(x + Math.cos(a) * k, y - at + Math.sin(a) * k * 0.6, 2, 2, "#5a3a20"); };
  bough(Math.PI + 0.4, 18 + f * 10, h * 0.62); bough(-0.4, 18 + f * 10, h * 0.6); bough(Math.PI + 0.9, 12 + f * 6, h * 0.82); bough(-0.9, 12 + f * 6, h * 0.8);
  // the canopy: clusters of leaves, fuller with every tier
  const clusters = [[0, -h - 4, 18], [-20, -h * 0.72, 14], [20, -h * 0.7, 14], [-30, -h * 0.5, 10], [30, -h * 0.48, 10], [-10, -h - 14, 12], [12, -h - 12, 12]];
  clusters.forEach(([dx, dy, r0], ci) => {
    const r = r0 * (0.7 + f * 0.6);
    const n = Math.round((60 + f * 140) * (r0 / 18));
    for (let k = 0; k < n; k++) {
      const a = mapHash(k, ci, 21) * Math.PI * 2, d = Math.sqrt(mapHash(k, ci, 23)) * r;
      const lx = x + dx + Math.cos(a) * d * 1.2 + Math.sin(t * 1.3 + k) * 0.4, ly = y + dy + Math.sin(a) * d * 0.8;
      R(lx, ly, 2, 2, leaves[(k + (Math.sin(a) < -0.3 ? 2 : Math.sin(a) > 0.4 ? 0 : 1)) % 3]);
    }
  });
  // fruit: one for every tier bought, glinting
  for (let i = 0; i < Math.min(30, have); i++) {
    const [dx, dy, r0] = clusters[i % clusters.length];
    const a = mapHash(i, 4, 9) * Math.PI * 2, d = r0 * 0.7 * Math.sqrt(mapHash(i, 5, 9));
    const fx = x + dx + Math.cos(a) * d * 1.2, fy = y + dy + Math.sin(a) * d * 0.8;
    R(fx, fy, 2, 2, leaves[3]);
    R(fx, fy, 1, 1, shadeHex(leaves[3], 0.5));
    if (Math.sin(t * 3 + i * 2) > 0.93) { R(fx - 1, fy, 1, 1, "#ffffff"); R(fx + 2, fy + 1, 1, 1, "#ffffff"); }
  }
  // a lantern hanging from a bough once the sky goes dark
  if (ISLANDS[isl].n >= 2) {
    const lx = x - 24 + Math.round(Math.sin(t * 1.2) * 1), ly = y - h * 0.6 + 6;
    R(lx, ly - 4, 1, 4, "#3a2a1a"); R(lx - 2, ly, 5, 5, "#3a2a1a"); R(lx - 1, ly + 1, 3, 3, "#ffd27a");
    for (let r = 3; r >= 1; r--) { g.fillStyle = `rgba(255,210,120,${(0.06 + 0.03 * Math.sin(t * 4)) * (4 - r)})`; g.fillRect(lx - 1 - r * 2, ly - r * 2, 5 + r * 4, 5 + r * 4); }
  }
}

/* The satchel, leaning on the trunk, with whatever you carry peeking out */
function drawHomeSatchel(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const full = camp.satchel.length;
  R(x - 1, y - 14, 1, 6, "#5a3a1e"); R(x + 13, y - 14, 1, 6, "#5a3a1e"); R(x, y - 15, 13, 1, "#5a3a1e");
  if (full) {
    const it = camp.satchel.slice(-2);
    it.forEach((e, i) => { g.drawImage(texCanvas("ci:" + e.id, "gift"), x + 1 + i * 6, y - 16, 7, 7); });
  }
  R(x, y - 10, 13, 10, "#b07a42"); R(x, y - 10, 13, 1, "#d09a5a"); R(x, y - 10, 1, 10, "#c88a50"); R(x + 12, y - 10, 1, 10, "#7a5232");
  R(x, y - 10, 13, 4, "#9a6a3a"); R(x, y - 7, 13, 1, "#5a3a1e");
  R(x + 5, y - 8, 3, 3, "#ffd23f"); R(x + 6, y - 7, 1, 1, "#a8860b");
  if (Math.sin(t * 2) > 0.9) R(x + 5, y - 8, 1, 1, "#ffffff");
  R(x, y, 13, 1, "rgba(0,0,0,0.3)");
}

/* A golden cup on a stone plinth, shining brighter with every achievement */
function drawHomeTrophy(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const got = Object.keys(camp.achievements).length;
  R(x - 7, y - 10, 14, 10, "#a8a29a"); R(x - 7, y - 10, 14, 1, "#d0cac0"); R(x - 7, y - 10, 2, 10, "#c0bab0"); R(x + 5, y - 10, 2, 10, "#7a766e");
  R(x - 8, y - 12, 16, 2, "#c0bab0"); R(x - 8, y - 1, 16, 1, "#6a665e");
  const cup = got ? ["#ffd23f", "#c08a10", "#fff6c4"] : ["#9aa3ad", "#5b6470", "#d8dde6"];
  R(x - 5, y - 22, 10, 6, cup[0]); R(x - 4, y - 16, 8, 1, cup[0]); R(x - 3, y - 15, 6, 1, cup[1]);
  R(x - 1, y - 14, 2, 2, cup[1]); R(x - 3, y - 13, 6, 1, cup[0]);
  R(x - 7, y - 21, 2, 1, cup[0]); R(x - 7, y - 20, 1, 3, cup[0]); R(x + 5, y - 21, 2, 1, cup[0]); R(x + 6, y - 20, 1, 3, cup[0]);
  R(x - 4, y - 22, 2, 5, cup[2]); R(x + 3, y - 22, 1, 6, cup[1]);
  if (got && Math.sin(t * 2.2) > 0.6) { R(x - 3, y - 25, 1, 3, "#ffffff"); R(x - 4, y - 24, 3, 1, "#ffffff"); }
  if (got) for (let r = 3; r >= 1; r--) { g.fillStyle = `rgba(255,210,63,${(0.05 + 0.03 * Math.sin(t * 2)) * (4 - r)})`; g.fillRect(x - 5 - r * 2, y - 22 - r * 2, 10 + r * 4, 9 + r * 4); }
}

/* A standing mirror, and you in it, in the skin you're wearing */
function drawHomeMirror(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  R(x - 8, y - 32, 16, 30, "#8a5a30"); R(x - 8, y - 32, 16, 1, "#b07a42"); R(x - 8, y - 32, 1, 30, "#a06a38");
  R(x - 6, y - 30, 12, 26, "#9ab8c8");
  for (let j = 0; j < 26; j++) R(x - 6, y - 30 + j, 12, 1, j < 9 ? "#b8d8e8" : j < 18 ? "#a8c8d8" : "#98b8c8");
  const skin = currentSkin();
  for (let i = 0; i < 8; i++) R(x - 4 + i, y - 8 - Math.round(Math.sin(t * 2 - i * 0.7) * 1.2), 2, 2, skinColorAt(skin, 7 - i, t * 1000));
  R(x + 3, y - 12, 3, 3, skinColorAt(skin, 0, t * 1000)); R(x + 4, y - 11, 1, 1, "#ffffff");
  // a shine sweeping across the glass
  const sh = ((t * 0.5) % 2) * 20 - 6;
  for (let j = 0; j < 26; j++) { const sx = Math.round(sh + j * 0.4); if (sx >= -6 && sx < 6) R(x + sx, y - 30 + j, 2, 1, "rgba(255,255,255,0.55)"); }
  R(x - 7, y - 2, 2, 3, "#5a3a1e"); R(x + 5, y - 2, 2, 3, "#5a3a1e");
  R(x - 1, y - 35, 2, 3, "#ffd23f");
}

/* An easel with a painting of the theme you're using */
const homeThemeCache = { id: null, c: null };
function drawHomeEasel(g, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  R(x - 6, y - 26, 1, 26, "#6a4628"); R(x + 6, y - 26, 1, 26, "#6a4628"); R(x, y - 30, 1, 30, "#5a3a20");
  R(x - 8, y - 10, 17, 2, "#7a5232");
  const bd = currentBackdrop();
  if (homeThemeCache.id !== bd.id) {
    const c = document.createElement("canvas");
    c.width = 40; c.height = 30;
    try { paintBackdrop(c.getContext("2d"), bd, 40, 30); } catch (e) { c.getContext("2d").fillStyle = "#111"; c.getContext("2d").fillRect(0, 0, 40, 30); }
    homeThemeCache.id = bd.id;
    homeThemeCache.c = c;
  }
  R(x - 9, y - 28, 19, 16, "#e8dcc0");
  g.drawImage(homeThemeCache.c, 0, 0, 40, 30, x - 8, y - 27, 17, 14);
  R(x - 9, y - 28, 19, 1, "#f8f0e0"); R(x + 9, y - 28, 1, 16, "#b8ac90");
  // a dab of paint drying on the ledge
  R(x - 6, y - 11, 2, 1, "#ff3b3b"); R(x - 3, y - 11, 2, 1, "#3a82e0"); R(x, y - 11, 2, 1, "#ffd23f");
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
