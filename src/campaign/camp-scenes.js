/* =========================================================
   src/campaign/camp-scenes.js
   The shopkeepers at home: little animated dioramas in the story
   book's own style (src/art/story-book-art.js), 160 x 60 pixels,
   drawn with the same kit. Each island has its own backdrop; each
   kind of shop has its own room: a market counter, a challenger's
   tent, a bank vault. The keeper is the same snake that stands by
   the stall on the map, three times the size.
   Shown at the top of the shop screen: watchArt(canvas, "npc:<island>:<kind>").
   ========================================================= */
"use strict";

/* The room behind the keeper, island by island: a picture, textures/scenes/npc/<island>/back.png
   (npc:<island>:back), and what moves or glows in it; on the Spire the bookshelves stand in front
   of its twinkling stars (shelves.png) */
function npcBackdrop(k, g, key, t) {
  const R = k.R;
  texDraw(g, `npc:${key}:back`, 0, 0);
  if (key === "spire") {
    k.stars(30, 7, "#d8c8ff");
    texLayer(g, "npc:spire:shelves", 0, 0);
    k.glow(80, 14, 22, "rgba(127,227,255,ALPHA)", 0.25 + Math.sin(t * 2) * 0.1);
  } else if (key === "hollow") {
    // herbs and onions hanging from a beam
    for (let i = 0; i < 9; i++) { const x = 8 + i * 18, sw = Math.round(Math.sin(t * 1.5 + i) * 0.7); R(x + sw, 7, 1, 5, "#c8a060"); R(x - 1 + sw, 12, 3, 4, i % 3 ? "#5a8a2a" : "#e8c070"); }
  } else if (key === "reef") {
    k.rise(14, "rgba(200,240,255,0.8)", 10, 4);
    for (let i = 0; i < 5; i++) { const x = 6 + i * 36; for (let j = 0; j < 6; j++) R(x + Math.round(Math.sin(t * 1.2 + j * 0.6 + i) * 1.5), 48 - j * 4, 2, 4, "#2a7a4a"); }
    k.glow(30, 4, 30, "rgba(200,240,255,ALPHA)", 0.2);
  } else if (key === "crown") {
    k.glow(80, 52, 70, "rgba(255,110,30,ALPHA)", 0.3 + Math.sin(t * 1.3) * 0.08);
    k.rise(10, "#ff8a2a", 6, 9);
  }
  return CAMP.islandById[key];
}

/* The keeper: the same snake that stands by the stall on the map, three times the size */
function npcKeeper(g, key, kind, x, y, t) {
  g.save();
  g.scale(3, 3);
  drawKeeper(g, key, kind, Math.round(x / 3), Math.round(y / 3), t);
  g.restore();
}

/* Each kind of shop's room: pictures in textures/scenes/npc/<island>/ (merchant.png, the awning;
   merchant-front.png, the counter in front of the keeper; challenger.png, the tent; banker.png and
   banker-front.png, the vault around its turning door), with what moves drawn between them */
function drawNpcScene(k, g, key, kind, t) {
  const I = npcBackdrop(k, g, key, t);
  const R = k.R;
  if (kind === "merchant") {
    texLayer(g, `npc:${key}:merchant`, 0, 0);
    npcKeeper(g, key, kind, 54, 52, t);
    texLayer(g, `npc:${key}:merchant-front`, 0, 0);
    const wares = CAMP.items.filter(it => it.family === I.merchantFamily).map(it => it.id);
    wares.forEach((id, i) => { const x = 84 + i * 15, bob = Math.round(Math.sin(t * 2 + i) * 0.6); g.drawImage(texCanvas("ci:" + id), x, 31 + bob); });
    // a lantern swinging
    const sw = Math.round(Math.sin(t * 1.4) * 2);
    R(36 + sw, 10, 1, 8, "#3a2a1a"); R(34 + sw, 18, 5, 6, "#3a2a1a"); R(35 + sw, 19, 3, 4, "#ffd27a");
    k.glow(36 + sw, 21, 10, "rgba(255,210,120,ALPHA)", 0.3);
  } else if (kind === "challenger") {
    texLayer(g, `npc:${key}:challenger`, 0, 0);
    texDraw(g, `npc:${key}:challenger-decor`, 0, 0);
    // pennants fluttering on the rope, an arrow in the target now and then, the torches' flames
    for (let i = 0; i < 12; i++) { const x = 4 + i * 14, d = Math.round(Math.sin(t * 2 + i) * 0.8); R(x, 3, 1, 1, "#5a3a20"); for (let j = 0; j < 4; j++) R(x - 3 + j, 4 + j + d, 7 - j * 2, 1, i % 2 ? "#ffd23f" : "#c0392b"); }
    const tx = 128, ty = 30;
    if (Math.sin(t * 0.8) > 0.2) { R(tx - 12, ty - 1, 11, 1, "#8a6a4a"); R(tx - 13, ty - 2, 2, 3, "#e8e8e8"); }
    [20, 152].forEach((x, i) => { k.flame(x + 1, 30, 7, i * 2); k.glow(x + 1, 26, 12, "rgba(255,170,60,ALPHA)", 0.3); });
    npcKeeper(g, key, kind, 72, 57, t);
    texDraw(g, `npc:${key}:challenger-front`, 0, 0);
  } else {
    texLayer(g, `npc:${key}:banker`, 0, 0);
    texDraw(g, `npc:${key}:banker-decor`, 0, 0);
    // the vault's round door turning, then the shelves of coin with a glint now and then
    const vx = 118, vy = 24, a = t * 0.4;
    for (let s = 0; s < 6; s++) { const ang = a + s * Math.PI / 3; for (let r = 2; r < 10; r++) R(vx + Math.cos(ang) * r, vy + Math.sin(ang) * r, 1, 1, "#d8d8e0"); }
    texLayer(g, `npc:${key}:banker-front`, 0, 0);
    for (let i = 0; i < 8; i++) { const h = 2 + (i * 3) % 7; if (Math.sin(t * 3 + i) > 0.9) R(25 + i * 8, 29 - h, 1, 1, "#ffffff"); }
    npcKeeper(g, key, kind, 54, 52, t);
  }
  k.vignette(0.4);
}

/* The story book draws these pages too */
(() => {
  const orig = drawPageArt;
  window.drawPageArt = function (c, id, t = performance.now() / 1000) {
    if (!String(id).startsWith("npc:")) return orig.apply(this, arguments);
    const g = c.getContext("2d");
    if (c.width !== ART_W) { c.width = ART_W; c.height = ART_H; }
    g.imageSmoothingEnabled = false;
    const [, key, kind] = id.split(":");
    drawNpcScene(artKit(g, t), g, key, kind, t);
  };
})();
