/* =========================================================
   src/art/room-3d.js
   The shops, the bank and the challenger's tent in 3D (build 55,
   three.js: assets/vendor/three; the map's own 3D is src/ui/map-3d.js).

   A room is a stack of cards at different depths, each painted from the
   same pictures the flat rooms used (textures/scenes/shops, textures/
   scenes/npc): the walls far back, the shelves, tent or vault in the
   middle, the keeper standing between them and the counter in front,
   and a vignette over it all. Move the mouse and the cards slide past
   each other (near ones against the look, far ones with it), a little
   dust floats at every depth, and the buttons laid over the shop (the
   shelf's things, the bell, the crate, the workshop's tools) ride the
   slide, each at the depth of what it sits on, so a click always lands
   on the thing you see. Chunky pixels, as ever: the room is drawn at
   its own small size and shown scaled up.

   Without WebGL, or with the "3D scenes" setting off, the rooms stay
   the flat pictures they were.
   ========================================================= */
"use strict";

const R3 = { rooms: {}, failed: false };
const R3_PAD = 12;                  // each card reaches this far past the picture so it never shows an edge as it slides
const R3_ZR = 400;
const r3Enabled = () => A3_OK && !R3.failed && !(typeof save !== "undefined" && save && save.settings && save.settings.map3d === false);
const r3Still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* A room: a canvas laid over the flat one, a camera that only slides, and the cards. host: the room's element
   (for the buttons over it); flat: the flat canvas it replaces (kept for the fallback, hidden meanwhile) */
function r3Room(key, w, h, flat, cls, mode) {
  if (R3.rooms[key]) return R3.rooms[key];
  if (!r3Enabled()) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.className = cls;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.display = "none";
    flat.parentNode.insertBefore(canvas, flat.nextSibling);
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    r.setClearColor(0x000000, 0);
    r.autoClear = true;
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); R3.failed = true; r3Hide(room); });
    const room = { key, w, h, flat, canvas, mode, r, cam: new THREE.Camera(), scene: new THREE.Scene(), L: [], sx: 0, sy: 0, shown: false };
    R3.rooms[key] = room;
    return room;
  } catch (e) {
    console.warn("The 3D room could not start; the flat one is used.", e);
    R3.failed = true;
    return null;
  }
}

/* A card at a depth z (nearer is bigger). Painted in the room's own pixels with r3Clear first. */
function r3Layer(room, z, order) {
  const c = document.createElement("canvas");
  c.width = room.w + R3_PAD * 2; c.height = room.h + R3_PAD * 2;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width, c.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  mesh.position.set(room.w / 2, -room.h / 2, z);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  room.scene.add(mesh);
  const L = { c, g, tex, mesh, z };
  room.L.push(L);
  return L;
}
function r3Clear(L) {
  L.g.setTransform(1, 0, 0, 1, 0, 0);
  L.g.clearRect(0, 0, L.c.width, L.c.height);
  L.g.setTransform(1, 0, 0, 1, R3_PAD, R3_PAD);
}
/* Stretch a card's edge rows and columns outward (a wall goes on past the picture) */
function r3Edges(room, L) {
  const { c, g } = L, p = R3_PAD, w = room.w, h = room.h;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(c, p, 0, 1, c.height, 0, 0, p, c.height);
  g.drawImage(c, p + w - 1, 0, 1, c.height, p + w, 0, p, c.height);
  g.drawImage(c, 0, p, c.width, 1, 0, 0, c.width, p);
  g.drawImage(c, 0, p + h - 1, c.width, 1, 0, p + h, c.width, p);
}

/* Dust drifting at every depth: far ones between the walls and the middle, near ones in front of it all */
function r3Dust(room, n, zmin, zmax, order, color) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) {
    seed.push([Math.random() * room.w, Math.random() * room.h, zmin + Math.random() * (zmax - zmin), 0.3 + Math.random() * 0.9, Math.random() * 6]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 1, sizeAttenuation: false, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false }));
  pts.renderOrder = order;
  pts.frustumCulled = false;
  room.scene.add(pts);
  return { pts, seed, pos, geo };
}
function r3DustStep(room, D, t) {
  D.seed.forEach((s, i) => {
    const x = (s[0] + Math.sin(t * 0.3 * s[3] + s[4]) * 5 + t * s[3] * 1.2) % room.w;
    const y = (s[1] - t * s[3] * 1.5 + room.h * 4) % room.h;
    D.pos[i * 3] = x; D.pos[i * 3 + 1] = -y; D.pos[i * 3 + 2] = s[2];
  });
  D.geo.attributes.position.needsUpdate = true;
}

/* The slide: the mouse's look (look-around.js) and a gentle sway of its own */
function r3Look(room, t, k = 0.1) {
  const lk = typeof SCR_LOOK !== "undefined" ? SCR_LOOK : { x: 0, y: 0 };
  const sw = r3Still ? 0 : 1;
  const lx = lk.x + sw * 0.35 * Math.sin(t * 0.4), ly = lk.y + sw * 0.18 * Math.sin(t * 0.31 + 1.1);
  room.sx = -lx * k;                 // near things slide against the look, far ones with it
  room.sy = -ly * k * 0.7;           // (down is positive)
  room.cam.projectionMatrix.set(
    2 / room.w, 0, 2 * room.sx / room.w, -1,
    0, 2 / room.h, -2 * room.sy / room.h, 1,
    0, 0, -1 / R3_ZR, 0,
    0, 0, 0, 1);
  room.cam.projectionMatrixInverse.copy(room.cam.projectionMatrix).invert();
}
function r3Render(room) {
  room.L.forEach(L => { L.tex.needsUpdate = true; });
  room.r.render(room.scene, room.cam);
  if (!room.shown) {
    room.shown = true;
    if (room.mode === "swap") room.flat.style.display = "none"; else room.flat.style.visibility = "hidden";
    room.canvas.style.display = "block";
  }
}
function r3Hide(room) {
  if (!room || !room.shown) return;
  room.shown = false;
  room.flat.style.visibility = "";
  room.flat.style.display = "";
  room.canvas.style.display = "none";
}
/* A button laid over a card rides the card's slide: its offset in the room's pixels, scaled to the screen */
function r3Ride(room, el, z) {
  const k = room.canvas.clientWidth / room.w || 1;
  const s = `${(room.sx * z * k).toFixed(1)}px ${(room.sy * z * k).toFixed(1)}px`;
  if (el._r3 !== s) { el._r3 = s; el.style.translate = s; }
}
function r3Unride(host) { host.querySelectorAll("*").forEach(el => { if (el._r3 !== undefined) { el._r3 = undefined; el.style.translate = ""; } }); }

/* ----- The merchant's shop and workshop (camp-shop-stage.js) ----- */
const R3_SHOP_Z = { back: -60, mid: -26, items: -14, keeper: -4, front: 26 };
const r3FlatStage = drawStage;
function r3ShopRoom() {
  const room = r3Room("shop", SS_W, SS_H, ssCanvas, "ss-3d", "overlay");
  if (!room || room.L.length) return room;
  room.B = r3Layer(room, R3_SHOP_Z.back, 0);
  room.farDust = r3Dust(room, 22, -45, -30, 1, 0xfff0c8);
  room.M = r3Layer(room, R3_SHOP_Z.mid, 2);
  room.I = r3Layer(room, R3_SHOP_Z.items, 3);
  room.K = r3Layer(room, R3_SHOP_Z.keeper, 4);
  room.F = r3Layer(room, R3_SHOP_Z.front, 5);
  room.nearDust = r3Dust(room, 14, 34, 52, 6, 0xffffff);
  return room;
}
window.drawStage = function (t, ts) {
  const room = typeof ssCanvas !== "undefined" ? r3ShopRoom() : null;
  if (!room) { return r3FlatStage(t, ts); }
  const { B, M, I, K, F } = room;
  [B, M, I, K, F].forEach(r3Clear);
  const ws = workshopOf(shopIsl);
  const fl = n => Math.round(Math.sin(t * 9 + n) * 1);
  // the walls, then the shelf and awning and the workshop's things
  texDraw(B.g, `shop:${shopIsl}:back`, 0, 0);
  if (SS_WALL_FX[shopIsl]) SS_WALL_FX[shopIsl](B.g, t);
  r3Edges(room, B);
  texLayer(M.g, `shop:${shopIsl}:middle`, 0, 0);
  texPaint(M.g, "shop:awning-shadow", SS_ROOM, 10);
  SS_WORK_FX[ws](M.g, t, fl);
  r3Edges(room, M);
  // the five things on the shelf
  const m = camp.merchants[shopIsl];
  for (let i = 0; i < 5; i++) {
    const x = SPOT_X(i), o = m && m.stock.find(s => s.spot === i);
    if (!o) { texDraw(I.g, "shop:sold-out", x - 8, 21); continue; }
    const bob = o.sold ? 0 : Math.round(Math.sin(t * 2 + i) * 0.7);
    I.g.globalAlpha = o.sold ? 0.3 : 1;
    const id = o.recipe ? "scroll" : CAMP.itemById[o.id].family === "rune" ? `ci:${o.id}:${RUNE_GRADES8[rarityIdx(o.rarity) * 2]}` : "ci:" + o.id;
    I.g.drawImage(texCanvas(id, "gift"), x - 12, 16 + bob, 24, 24);
    I.g.globalAlpha = 1;
    texPaint(I.g, "shop:item-shadow", x - 10, 40, { alpha: 0.25 });
    texPaint(I.g, "shop:ribbon", x - 11, 43, { colors: { ribbon: rarityColor(o.rarity) } });
    if (o.deal && !o.sold) texDraw(I.g, "shop:sale-tag", x + 6, 13);
  }
  // the keeper, slithering between the rooms (a little nearer to you in the workshop, behind the counter in the shop)
  const k = ssKeeper;
  const p = Math.min(1, (ts - k.at) / 1400);
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  k.x = k.from + (k.to - k.from) * e;
  const moving = p < 1 && k.from !== k.to;
  const kx = Math.round(k.x), ky = Math.round(98 - 16 * Math.max(0, Math.min(1, (k.x - 92) / 196))) + (moving ? Math.round(Math.sin(t * 22) * 1) : 0);
  K.g.save();
  if (moving && k.to < k.from) { K.g.translate(kx * 2, 0); K.g.scale(-1, 1); }
  K.g.scale(4, 4);
  drawKeeper(K.g, shopIsl, "merchant", Math.round(kx / 4), Math.round(ky / 4), t);
  K.g.restore();
  K.mesh.position.z = 6 - 14 * Math.max(0, Math.min(1, (k.x - 92) / 196));
  // the counter in front, and the lantern swinging over it
  texDraw(F.g, `shop:${shopIsl}:front`, 0, 0);
  texDraw(F.g, "shop:lantern", SS_ROOM + 148 + Math.round(Math.sin(t * 1.4) * 2), 11);
  r3Edges(room, F);
  r3DustStep(room, room.farDust, t); r3DustStep(room, room.nearDust, t * 1.3);
  r3Look(room, t);
  r3Render(room);
  // the buttons over the picture ride along, each at the depth of what it sits on
  Array.prototype.forEach.call(ssSpots.children, el => {
    const z = el.classList.contains("bell") || el.classList.contains("crate") ? R3_SHOP_Z.front : el.classList.contains("ws") || el.classList.contains("ss-sign") ? R3_SHOP_Z.mid : R3_SHOP_Z.items;
    r3Ride(room, el, z);
  });
};

/* ----- The challenger's tent, the bank, and the merchant's counter in the shop screen's picture (camp-scenes.js) ----- */
const R3_NPC_Z = { back: -50, mid: -22, keeper: -4, front: 22 };
function r3NpcRoom() {
  const flat = document.getElementById("cs-art");
  const room = r3Room("npc", ART_W, ART_H, flat, "book-art scene-banner ss-3d-npc", "swap");
  if (!room || room.L.length) return room;
  room.B = r3Layer(room, R3_NPC_Z.back, 0);
  room.farDust = r3Dust(room, 14, -40, -25, 1, 0xfff0c8);
  room.M = r3Layer(room, R3_NPC_Z.mid, 2);
  room.K = r3Layer(room, R3_NPC_Z.keeper, 3);
  room.F = r3Layer(room, R3_NPC_Z.front, 4);
  room.nearDust = r3Dust(room, 8, 30, 44, 5, 0xffffff);
  room.V = r3Layer(room, 0, 6);
  return room;
}
/* The same room drawScene paints flat (drawNpcScene), cut into its cards */
function r3NpcPaint(room, key, kind, t) {
  const { B, M, K, F, V } = room;
  [B, M, K, F, V].forEach(r3Clear);
  const kb = artKit(B.g, t), km = artKit(M.g, t), kf = artKit(F.g, t), kv = artKit(V.g, t);
  const I = npcBackdrop(kb, B.g, key, t);
  r3Edges(room, B);
  const R = km.R, Rf = kf.R;
  if (kind === "merchant") {
    texLayer(M.g, `npc:${key}:merchant`, 0, 0);
    npcKeeper(K.g, key, kind, 54, 52, t);
    texLayer(F.g, `npc:${key}:merchant-front`, 0, 0);
    const wares = CAMP.items.filter(it => it.family === I.merchantFamily).map(it => it.id);
    wares.forEach((id, i) => { const x = 84 + i * 15, bob = Math.round(Math.sin(t * 2 + i) * 0.6); F.g.drawImage(texCanvas("ci:" + id), x, 31 + bob); });
    const sw = Math.round(Math.sin(t * 1.4) * 2);
    Rf(36 + sw, 10, 1, 8, "#3a2a1a"); Rf(34 + sw, 18, 5, 6, "#3a2a1a"); Rf(35 + sw, 19, 3, 4, "#ffd27a");
    kf.glow(36 + sw, 21, 10, "rgba(255,210,120,ALPHA)", 0.3);
    r3Edges(room, F);
  } else if (kind === "challenger") {
    texLayer(M.g, `npc:${key}:challenger`, 0, 0);
    for (let i = 0; i < 12; i++) { const x = 4 + i * 14, d = Math.round(Math.sin(t * 2 + i) * 0.8); R(x, 3, 1, 1, "#5a3a20"); for (let j = 0; j < 4; j++) R(x - 3 + j, 4 + j + d, 7 - j * 2, 1, i % 2 ? "#ffd23f" : "#c0392b"); }
    const tx = 128, ty = 30;
    if (Math.sin(t * 0.8) > 0.2) { R(tx - 12, ty - 1, 11, 1, "#8a6a4a"); R(tx - 13, ty - 2, 2, 3, "#e8e8e8"); }
    [20, 152].forEach((x, i) => { km.flame(x + 1, 30, 7, i * 2); km.glow(x + 1, 26, 12, "rgba(255,170,60,ALPHA)", 0.3); });
    npcKeeper(K.g, key, kind, 72, 57, t);
    r3Edges(room, M);
  } else {
    texLayer(M.g, `npc:${key}:banker`, 0, 0);
    const vx = 118, vy = 24, a = t * 0.4;
    for (let s = 0; s < 6; s++) { const ang = a + s * Math.PI / 3; for (let r = 2; r < 10; r++) R(vx + Math.cos(ang) * r, vy + Math.sin(ang) * r, 1, 1, "#d8d8e0"); }
    texLayer(F.g, `npc:${key}:banker-front`, 0, 0);
    for (let i = 0; i < 8; i++) { const h = 2 + (i * 3) % 7; if (Math.sin(t * 3 + i) > 0.9) Rf(25 + i * 8, 29 - h, 1, 1, "#ffffff"); }
    npcKeeper(K.g, key, kind, 54, 52, t);
    r3Edges(room, M); r3Edges(room, F);
  }
  kv.vignette(0.4);
}

let r3NpcRaf = 0;
function r3NpcLoop(ts) {
  r3NpcRaf = 0;
  const room = R3.rooms.npc;
  if (currentScreen !== "campshop" || shopKind === "merchant" || !room || !r3Enabled()) { if (room) r3Hide(room); return; }
  r3NpcRaf = requestAnimationFrame(r3NpcLoop);
  if (Math.floor(ts / 40) === Math.floor((ts - 17) / 40)) return;
  const t = r3Still ? 2 : ts / 1000;
  r3NpcPaint(room, shopIsl, shopKind, t);
  r3DustStep(room, room.farDust, t); r3DustStep(room, room.nearDust, t * 1.3);
  r3Look(room, ts / 1000, 0.1);
  r3Render(room);
}
(() => {
  const open = openCampShop;
  window.openCampShop = function (isl, kind) {
    const r = open.apply(this, arguments);
    if (kind === "merchant") { if (R3.rooms.npc) r3Hide(R3.rooms.npc); return r; }
    const room = r3NpcRoom();
    if (room && !r3NpcRaf) r3NpcRaf = requestAnimationFrame(r3NpcLoop);
    return r;
  };
})();

/* The shop screen's flat picture comes back if the screen is left or the setting turned off */
(() => {
  const show = showScreen;
  window.showScreen = function (name) {
    const r = show.apply(this, arguments);
    if (name !== "campshop") Object.values(R3.rooms).forEach(r3Hide);
    return r;
  };
})();
