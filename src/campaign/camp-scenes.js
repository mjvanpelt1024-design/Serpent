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

/* The room behind the keeper, island by island */
function npcBackdrop(k, g, key, t) {
  const I = CAMP.islandById[key];
  const R = k.R;
  if (key === "keep") {
    k.sky("#8a8a8a", "#6a6662", 4);
    for (let y = 0; y < 48; y += 5) for (let x = (y / 5) % 2 ? -6 : 0; x < ART_W; x += 12) { R(x, y, 11, 4, (x + y) % 3 ? "#9a968e" : "#8e8a82"); R(x, y, 11, 1, "#aaa69e"); }
    // a window onto the morning, and a banner
    R(122, 6, 22, 20, "#5a5650"); R(124, 8, 18, 16, "#9fd4f4"); R(124, 18, 18, 6, "#8ac46a"); R(132, 8, 1, 16, "#5a5650"); R(124, 15, 18, 1, "#5a5650");
    R(14, 4, 12, 22, "#b23a3a"); R(14, 26, 6, 3, "#b23a3a"); R(20, 26, 6, 3, "#8e2b2b"); R(18, 10, 4, 8, "#ffd23f"); R(19, 9, 2, 1, "#ffd23f");
  } else if (key === "spire") {
    k.sky("#1a1650", "#3e2c78", 6);
    k.stars(30, 7, "#d8c8ff");
    // bookshelves glowing with spellbooks
    [[8, 0], [128, 1]].forEach(([x0, s]) => {
      R(x0, 6, 26, 42, "#3a2a1a"); R(x0 + 1, 7, 24, 40, "#2a1a10");
      for (let sh = 0; sh < 4; sh++) {
        R(x0 + 1, 16 + sh * 10, 24, 1, "#5a3a20");
        for (let b = 0; b < 7; b++) R(x0 + 2 + b * 3, 9 + sh * 10, 2, 7 - (b + sh + s) % 3, ["#b36bff", "#3a82e0", "#d1202a", "#3ddc84", "#ffd23f"][(b + sh * 2 + s) % 5]);
      }
    });
    k.glow(80, 14, 22, "rgba(127,227,255,ALPHA)", 0.25 + Math.sin(t * 2) * 0.1);
  } else if (key === "hollow") {
    k.sky("#c87a3a", "#e8a85a", 4);
    for (let x = 0; x < ART_W; x += 8) { R(x, 0, 7, 48, (x / 8) % 2 ? "#8a5a30" : "#9a6a3a"); R(x + 7, 0, 1, 48, "#5a3a1e"); }
    // herbs and onions hanging from a beam
    R(0, 4, ART_W, 3, "#5a3a1e");
    for (let i = 0; i < 9; i++) { const x = 8 + i * 18, sw = Math.round(Math.sin(t * 1.5 + i) * 0.7); R(x + sw, 7, 1, 5, "#c8a060"); R(x - 1 + sw, 12, 3, 4, i % 3 ? "#5a8a2a" : "#e8c070"); }
  } else if (key === "reef") {
    k.sky("#1a5a8a", "#0a2a4a", 6);
    k.rise(14, "rgba(200,240,255,0.8)", 10, 4);
    for (let i = 0; i < 5; i++) { const x = 6 + i * 36; for (let j = 0; j < 6; j++) R(x + Math.round(Math.sin(t * 1.2 + j * 0.6 + i) * 1.5), 48 - j * 4, 2, 4, "#2a7a4a"); }
    k.glow(30, 4, 30, "rgba(200,240,255,ALPHA)", 0.2);
  } else {
    k.sky("#2a1a1e", "#4a2020", 4);
    for (let i = 0; i < 6; i++) { const x = i * 30 + 6; R(x, 8, 2, 40, "#1a1216"); }
    k.glow(80, 52, 70, "rgba(255,110,30,ALPHA)", 0.3 + Math.sin(t * 1.3) * 0.08);
    k.rise(10, "#ff8a2a", 6, 9);
  }
  return I;
}

/* The keeper: the same snake that stands by the stall on the map, three times the size */
function npcKeeper(g, look, x, y, t, kind) {
  g.save();
  g.scale(3, 3);
  drawKeeper(g, look, Math.round(x / 3), Math.round(y / 3), t, kind);
  g.restore();
}

function drawNpcScene(k, g, key, kind, t) {
  const I = npcBackdrop(k, g, key, t);
  const R = k.R, accent = I.colors.accent;
  const look = I.npcs[kind].look;
  if (kind === "merchant") {
    // an awning, a counter and the island's wares
    for (let x = 0; x < ART_W; x += 8) { R(x, 0, 8, 7, (x / 8) % 2 ? accent : "#f4f0e8"); R(x + 2, 7, 4, 2, (x / 8) % 2 ? accent : "#f4f0e8"); }
    R(0, 9, ART_W, 1, "rgba(0,0,0,0.25)");
    npcKeeper(g, look, 54, 52, t, kind);
    R(0, 44, ART_W, 16, "#6a4a2a"); R(0, 44, ART_W, 2, "#9a6a3a"); R(0, 46, ART_W, 1, "#4a3018");
    for (let i = 0; i < 4; i++) R(10 + i * 40, 48, 30, 10, "#5a3a20");
    const fam = I.merchantFamily;
    const wares = CAMP.items.filter(it => it.family === fam).map(it => it.id);
    wares.forEach((id, i) => {
      const x = 84 + i * 15, bob = Math.round(Math.sin(t * 2 + i) * 0.6);
      R(x, 43, 12, 1, "rgba(0,0,0,0.3)");
      g.drawImage(texCanvas("ci:" + id), x, 31 + bob);
    });
    // a lantern swinging
    const sw = Math.round(Math.sin(t * 1.4) * 2);
    R(36 + sw, 10, 1, 8, "#3a2a1a"); R(34 + sw, 18, 5, 6, "#3a2a1a"); R(35 + sw, 19, 3, 4, "#ffd27a");
    k.glow(36 + sw, 21, 10, "rgba(255,210,120,ALPHA)", 0.3);
  } else if (kind === "challenger") {
    // a tent's striped walls, pennants, a straw target and torches
    for (let x = 0; x < ART_W; x += 10) { R(x, 0, 5, 48, accent); R(x + 5, 0, 5, 48, "#f4f0e8"); }
    g.globalAlpha = 0.35; R(0, 0, ART_W, 48, "#000"); g.globalAlpha = 1;
    for (let i = 0; i < 12; i++) { const x = 4 + i * 14, d = Math.round(Math.sin(t * 2 + i) * 0.8); R(x, 3, 1, 1, "#5a3a20"); for (let j = 0; j < 4; j++) R(x - 3 + j, 4 + j + d, 7 - j * 2, 1, i % 2 ? "#ffd23f" : "#c0392b"); }
    R(0, 2, ART_W, 1, "#5a3a20");
    R(0, 48, ART_W, 12, "#6a5a3a"); R(0, 48, ART_W, 1, "#8a7a5a");
    // the target
    const tx = 128, ty = 30;
    [[9, "#e8d8a0"], [7, "#c0392b"], [5, "#e8d8a0"], [3, "#c0392b"], [1, "#ffd23f"]].forEach(([r, c]) => { for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); R(tx - w, ty + yy, w * 2 + 1, 1, c); } });
    R(tx - 1, ty + 9, 3, 9, "#5a3a20");
    if (Math.sin(t * 0.8) > 0.2) { R(tx - 12, ty - 1, 11, 1, "#8a6a4a"); R(tx - 13, ty - 2, 2, 3, "#e8e8e8"); }
    [20, 152].forEach((x, i) => { R(x, 30, 2, 18, "#5a3a20"); k.flame(x + 1, 30, 7, i * 2); k.glow(x + 1, 26, 12, "rgba(255,170,60,ALPHA)", 0.3); });
    npcKeeper(g, look, 72, 57, t, kind);
  } else {
    // a vault: columns, a round door that turns, shelves of the island's coin
    R(0, 0, ART_W, 48, "rgba(0,0,0,0.25)");
    [[6, 0], [146, 1]].forEach(([x]) => { R(x, 0, 8, 48, "#d8d0c0"); R(x, 0, 2, 48, "#f0e8d8"); R(x + 6, 0, 2, 48, "#a89f8f"); R(x - 1, 0, 10, 3, "#c8c0b0"); });
    const vx = 118, vy = 24, a = t * 0.4;
    for (let yy = -15; yy <= 15; yy++) { const w = Math.round(Math.sqrt(225 - yy * yy)); R(vx - w, vy + yy, w * 2 + 1, 1, yy < -8 ? "#b8b8c0" : "#9a9aa4"); }
    for (let yy = -11; yy <= 11; yy++) { const w = Math.round(Math.sqrt(121 - yy * yy)); R(vx - w, vy + yy, w * 2 + 1, 1, "#7a7a84"); }
    for (let s = 0; s < 6; s++) { const ang = a + s * Math.PI / 3; for (let r = 2; r < 10; r++) R(vx + Math.cos(ang) * r, vy + Math.sin(ang) * r, 1, 1, "#d8d8e0"); }
    R(vx - 2, vy - 2, 5, 5, "#ffd23f");
    // coin stacks on the shelf
    const c = I.currency.color;
    R(20, 30, 70, 2, "#5a3a20");
    for (let i = 0; i < 8; i++) { const h = 2 + (i * 3) % 7; for (let j = 0; j < h; j++) R(24 + i * 8, 29 - j, 5, 1, j % 2 ? c : shadeHex(c, -0.25)); if (Math.sin(t * 3 + i) > 0.9) R(25 + i * 8, 29 - h, 1, 1, "#ffffff"); }
    R(0, 44, ART_W, 16, "#4a3a2a"); R(0, 44, ART_W, 2, "#7a6a4a");
    npcKeeper(g, look, 54, 52, t, kind);
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
