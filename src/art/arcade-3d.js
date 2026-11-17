/* =========================================================
   src/art/arcade-3d.js
   The title screen's arcade machine in 3D (three.js, assets/vendor/three).

   The machine is a real cabinet: two side panels with their art, the
   marquee (lit, your money in its readout), the screen's bezel, a
   speaker grille, a sloped control panel with a joystick and buttons,
   and the coin door below. The board, the menu over it and the snake
   that plays by itself are the game's own page, not a picture: every
   frame the page's board is warped (a CSS matrix3d) onto the cabinet's
   screen as the camera sees it, so it stays exactly in the screen and
   its buttons still work, whichever way you look.

   Press the machine's controls and they work on that snake
   (src/ui/title-demo.js): the joystick steers it (it plays by itself
   again a few seconds after you let go; if you steer it into itself it
   pops and starts over), red is turbo, yellow drops apples, blue drops
   a golden orb, 1P starts a new snake, 2P hands it back to itself.

   Your numbers are posters taped to the machine, the bosses' wanted
   posters hang on the wall behind it, and your stickers are slapped on
   all over, in all sizes; a sticker over a number peels back when you
   point at it. Move the mouse to look around: the same amount every
   way (over the screen only a little, so the menu holds still).

   Its pictures are drawn in pixels and keep their hard edges up close.
   Without WebGL (or three.js) the title screen keeps the flat arcade
   (camp-title.js).
   ========================================================= */
"use strict";

const A3_OK = (() => {
  if (typeof THREE === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
})();

/* Where everything goes, in the cabinet's own units (its screen is 200 wide, its middle is 0, 0). Edit freely.
   Posters and stickers name a face: "front" (x, y, z: on the front of whatever's at that z), "left" / "right"
   (the side panels' outsides: z along it, y), "wall" (x, y), "deck" (the control panel: x, z along it).
   at: what y is measured from: "kick" (the top of the front below the control panel), "marquee" (the
   middle of the marquee), "screen" (the screen's middle, the default). */
const A3 = {
  // your numbers: a poster each (40 x 54), taped to the coin door's sides, the marquee and the side panels
  stats: [
    { face: "front", at: "kick", x: -78, y: -36, z: 36.6, tilt: -5, band: "#d1202a", icon: "apple" },
    { face: "front", at: "kick", x: 80, y: -34, z: 36.6, tilt: 4, band: "#2f7dff", icon: "trophy" },
    { face: "front", at: "kick", x: -76, y: -98, z: 36.6, tilt: 3, band: "#ffd23f", icon: "flag" },
    { face: "front", at: "kick", x: 79, y: -100, z: 36.6, tilt: -4, band: "#3ddc84", icon: "skull" },
    { face: "left", z: -40, y: 10, tilt: 6, band: "#b36bff", icon: "medal" }
  ],
  // the wanted posters (50 x 70) on the wall behind; the sixth is the Maw's
  bounties: [[-215, 120, -3], [215, 140, 4], [-235, 20, 2], [240, 40, -2], [-225, -85, -4], [232, -60, 3]],
  // the stickers: one per finished island, then the Maw's, then spares for the quest bosses to come.
  // size in units (they come in all sizes); cover: the stat poster whose number it sits over (it peels)
  stickers: [
    { face: "front", x: -84, y: -62, z: 37.4, size: 24, tilt: -12, cover: 0 },
    { face: "front", at: "marquee", x: 96, y: -6, z: 31, size: 30, tilt: 14 },
    { face: "wall", x: -150, y: 175, size: 44, tilt: 8 },
    { face: "front", x: 78, y: -124, z: 37.4, size: 22, tilt: 10, cover: 3 },
    { face: "right", z: -60, y: 60, size: 40, tilt: -8 },
    { face: "deck", x: -92, z: 14, size: 16, tilt: 20 },
    { face: "front", x: -104, y: 8, z: 1.4, size: 20, tilt: -18 },
    { face: "left", z: -80, y: -110, size: 34, tilt: 12 },
    { face: "wall", x: 165, y: -150, size: 36, tilt: -14 },
    { face: "front", at: "kick", x: 2, y: -100, z: 40.6, size: 18, tilt: 6 }
  ]
};

const A3D = {
  on: false, built: false, aspect: 0, renderer: null, scene: null, camera: null, canvas: null,
  root: null, faces: {}, hits: [], hover: null, held: null, raf: 0, last: 0,
  look: { yaw: 0, pitch: 0, x: 0, y: 0, tyaw: 0, tpitch: 0, tx: 0, ty: 0 },
  base: null, ppu: 1, D: 600, sw: 100, sh: 100, rest: null, tag: "", stage: { w: 0, h: 0 },
  joy: null, buttons: [], peels: [], marquee: null, data: null
};

/* ----- Textures: little canvases, drawn in pixels ----- */
function a3Tex(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t._canvas = c;
  return t;
}
const a3Hash = (x, y, s = 1) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const A3_FONT = '"Press Start 2P", "Pixelify Sans", monospace';
const A3_TITLE = '"Jacquarda Bastarda 9", "Pixelify Sans", serif';

/* The side panels' art: deep green, a big snake coiled down it, a gold rim */
function a3SideArt(w, h) {
  return a3Tex(w, h, (g) => {
    g.fillStyle = "#0e1612"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (a3Hash(x, y, 3) > 0.86) { g.fillStyle = "#13201a"; g.fillRect(x, y, 2, 2); }
    // diagonal racing stripes
    for (let k = 0; k < 3; k++) { g.fillStyle = ["#1f6a3e", "#3fbf6f", "#b8902a"][k]; for (let y = 0; y < h; y++) g.fillRect(Math.round(w * 0.15 + y * 0.35 + k * 7) % (w + 40) - 20, y, 4, 1); }
    // the snake, in chunky squares
    const body = [];
    for (let i = 0; i < 60; i++) body.push([w / 2 + Math.sin(i * 0.28) * w * 0.28, h * 0.12 + i * h * 0.0125]);
    body.forEach(([x, y], i) => { g.fillStyle = i % 2 ? "#3fbf6f" : "#2e9a56"; g.fillRect(Math.round(x) - 5, Math.round(y) - 5, 10, 10); g.fillStyle = "#7ff0a8"; g.fillRect(Math.round(x) - 5, Math.round(y) - 5, 10, 2); });
    const [hx, hy] = body[body.length - 1];
    g.fillStyle = "#3fbf6f"; g.fillRect(hx - 8, hy, 16, 12);
    g.fillStyle = "#ffffff"; g.fillRect(hx - 6, hy + 4, 4, 4); g.fillRect(hx + 2, hy + 4, 4, 4);
    g.fillStyle = "#050706"; g.fillRect(hx - 5, hy + 5, 2, 2); g.fillRect(hx + 3, hy + 5, 2, 2);
    g.fillStyle = "#ff3b3b"; g.fillRect(hx - 1, hy + 12, 2, 6);
    g.strokeStyle = "#b8902a"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
}

/* The marquee: SERPENT in lights, and the readout under it (your money) */
function a3MarqueeArt() { return a3Tex(256, 64, a3PaintMarquee); }
function a3PaintMarquee(g, w, h) {
  {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#2c8f52"); grd.addColorStop(1, "#174e2e");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, y, w, 1); }
    // little circuit snakes either side
    [[10, 1], [w - 10, -1]].forEach(([x0, d]) => { for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { g.fillStyle = (r + k) % 2 ? "#7ff0a8" : "#3fbf6f"; g.fillRect(x0 + d * k * 6 - (d < 0 ? 5 : 0), 6 + r * 6, 5, 4); } });
    g.font = `16px ${A3_FONT}`; g.textAlign = "center"; g.textBaseline = "top";
    g.fillStyle = "#0b2a18"; g.fillText("SERPENT", w / 2 + 2, 6);
    g.fillStyle = "#eafff0"; g.fillText("SERPENT", w / 2, 4);
    // the readout
    g.fillStyle = "#06120c"; g.fillRect(44, 30, w - 88, 26);
    g.strokeStyle = "#b8902a"; g.lineWidth = 2; g.strokeRect(44, 30, w - 88, 26);
    const D = A3D.data;
    if (D) {
      g.font = `8px ${A3_FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
      const items = D.money.concat([{ c: "#7fe3ff", v: D.gems, gem: true }]);
      const cell = (w - 96) / Math.max(1, Math.ceil(items.length / 2)), rows = items.length > 3 ? 2 : 1;
      items.forEach((it, i) => {
        const col = rows === 2 ? i % Math.ceil(items.length / 2) : i, row = rows === 2 ? Math.floor(i / Math.ceil(items.length / 2)) : 0;
        const x = 50 + col * (rows === 2 ? cell : (w - 96) / items.length), y = rows === 2 ? 37 + row * 12 : 43;
        g.fillStyle = it.c;
        if (it.gem) { g.beginPath(); g.moveTo(x + 3, y - 3); g.lineTo(x + 6, y); g.lineTo(x + 3, y + 3); g.lineTo(x, y); g.fill(); }
        else g.fillRect(x, y - 3, 6, 6);
        g.fillStyle = "#c8ffd8"; g.fillText(a3Short(it.v), x + 9, y + 1);
      });
    }
  }
}
const a3Short = v => (v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e4 ? Math.round(v / 1e3) + "K" : String(v));

/* The coin door: brass frame, two lit coin slots */
function a3CoinDoorArt() {
  return a3Tex(72, 72, (g, w, h) => {
    g.fillStyle = "#8a6a2a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a2218"; g.fillRect(4, 4, w - 8, h - 8);
    [[12, 10], [42, 10]].forEach(([x, y]) => {
      g.fillStyle = "#ff8a1a"; g.fillRect(x, y, 18, 10);
      g.font = `7px ${A3_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#3a1a04"; g.fillText("25", x + 9, y + 5.5);
      g.fillStyle = "#050706"; g.fillRect(x + 7, y + 16, 4, 12);
      g.fillStyle = "#050706"; g.fillRect(x + 1, y + 42, 16, 6); g.fillStyle = "#b8902a"; g.fillRect(x + 1, y + 41, 16, 1);
    });
    g.fillStyle = "#b8902a"; g.fillRect(33, 28, 6, 8); g.fillStyle = "#050706"; g.fillRect(35, 31, 2, 3);
  });
}
function a3GrilleArt() {
  return a3Tex(64, 8, (g, w, h) => { g.fillStyle = "#0b0f0d"; g.fillRect(0, 0, w, h); for (let y = 1; y < h; y += 2) for (let x = (y >> 1) & 1; x < w; x += 2) { g.fillStyle = "#1d2823"; g.fillRect(x, y, 1, 1); } });
}

/* Paper: a poster of one of your numbers. Torn at the bottom, tape at the top, a stain or two */
function a3StatArt(slot, label, value, k) {
  return a3Tex(80, 108, (g, w, h) => {
    const tear = x => h - 4 - Math.round(a3Hash(x, k, 9) * 4);
    for (let x = 0; x < w; x++) for (let y = 0; y < tear(x); y++) {
      const f = a3Hash(x, y, k + 2);
      g.fillStyle = f > 0.93 ? "#e4d2a6" : f < 0.04 ? "#fff8e8" : y < 2 || x < 1 || x > w - 2 ? "#d8c08e" : "#f3e6c4";
      g.fillRect(x, y, 1, 1);
    }
    // the band across the top, with its label
    g.fillStyle = slot.band; g.fillRect(0, 6, w, 16); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 21, w, 1);
    g.font = `6px ${A3_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ffffff";
    const words = label.toUpperCase().split(" ");
    if (words.length > 1 && g.measureText(label.toUpperCase()).width > w - 6) { g.fillText(words[0], w / 2, 11); g.fillText(words.slice(1).join(" "), w / 2, 18); }
    else g.fillText(label.toUpperCase(), w / 2, 14.5);
    // a little picture
    const icon = slot.icon;
    try { const ic = texCanvas(icon); if (ic && ic.width) g.drawImage(ic, w / 2 - 12, 27, 24, 24); } catch (e) { /* no picture */ }
    // the number, big, and a pen line under it
    g.fillStyle = "#8a1a14";
    let size = 12;
    g.font = `${size}px ${A3_FONT}`;
    while (g.measureText(value).width > w - 8 && size > 6) { size--; g.font = `${size}px ${A3_FONT}`; }
    g.fillText(value, w / 2, 66);
    g.fillStyle = "#2a1a10";
    for (let x = 14; x < w - 14; x++) g.fillRect(x, 76 + Math.round(Math.sin(x * 0.4 + k) * 0.8), 1, 1);
    g.font = `5px ${A3_FONT}`; g.fillStyle = "#6a4a2a"; g.fillText(["keep going", "not bad", "...so far", "nice one", "wow"][k % 5], w / 2, 86);
    // a coffee ring on some, a fold, the tape
    if (k % 2) { g.strokeStyle = "rgba(120,70,20,0.28)"; g.lineWidth = 2; g.beginPath(); g.arc(w * 0.72, 92, 9, 0.3, 5.6); g.stroke(); }
    g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(0, 48, w, 1);
    g.fillStyle = "rgba(236,222,170,0.85)";
    g.save(); g.translate(w / 2, 3); g.rotate(-0.06); g.fillRect(-16, -4, 32, 8); g.restore();
  });
}

/* A wanted poster: WANTED, the boss's face, its name, its fights; crossed out once it falls */
function a3WantedArt(p, k) {
  return a3Tex(100, 140, (g, w, h) => {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const f = a3Hash(x, y, k + 11);
      if (edge < 2 && f > 0.6) continue;                 // ragged edges
      g.fillStyle = edge < 4 ? "#c8a870" : f > 0.92 ? "#d8bc84" : "#ead2a0";
      g.fillRect(x, y, 1, 1);
    }
    // corners curled and burnt a bit
    g.fillStyle = "rgba(90,50,20,0.35)"; g.fillRect(w - 10, 0, 10, 2); g.fillRect(0, h - 3, 14, 3);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `14px ${A3_TITLE}`; g.fillStyle = "#3a1a0a"; g.fillText(p.dead ? "Defeated" : "Wanted", w / 2, 16);
    g.fillStyle = "#3a1a0a"; g.fillRect(14, 25, w - 28, 1);
    // the face, framed
    g.fillStyle = "#3a2410"; g.fillRect(w / 2 - 28, 32, 56, 56);
    g.fillStyle = "#1a1410"; g.fillRect(w / 2 - 26, 34, 52, 52);
    if (p.face) { try { g.drawImage(p.face, w / 2 - 24, 36, 48, 48); } catch (e) { /* none */ } }
    else { g.font = `24px ${A3_FONT}`; g.fillStyle = "#5a4a3a"; g.fillText("?", w / 2, 62); }
    g.font = `7px ${A3_FONT}`; g.fillStyle = "#2a1a10";
    const nm = p.name.toUpperCase();
    let size = 7; while (g.measureText(nm).width > w - 10 && size > 4) { size--; g.font = `${size}px ${A3_FONT}`; }
    g.fillText(nm, w / 2, 98);
    g.font = `5px ${A3_FONT}`; g.fillStyle = "#6a3a1a"; g.fillText("REWARD", w / 2, 110);
    if (p.fights !== null) { for (let i = 0; i < p.of; i++) { g.fillStyle = i < p.fights ? "#8a1a14" : "#c8a870"; g.fillRect(w / 2 - p.of * 5 + i * 10 + 1, 118, 8, 8); g.fillStyle = "#3a1a0a"; g.fillRect(w / 2 - p.of * 5 + i * 10 + 1, 125, 8, 1); } }
    if (p.dead) {
      g.strokeStyle = "rgba(190,20,20,0.85)"; g.lineWidth = 6; g.lineCap = "round";
      g.beginPath(); g.moveTo(14, 34); g.lineTo(w - 14, 92); g.moveTo(w - 14, 34); g.lineTo(14, 92); g.stroke();
    }
    // the nail
    g.fillStyle = "#5a5a64"; g.fillRect(w / 2 - 2, 3, 4, 4); g.fillStyle = "#c8c8d0"; g.fillRect(w / 2 - 2, 3, 2, 2);
  });
}

/* A sticker: the island's mark with its die-cut border, made bigger */
function a3StickerArt(id) {
  const src = typeof stickerCanvas === "function" ? stickerCanvas(id) : null;
  return a3Tex(72, 72, (g) => { if (src) g.drawImage(src, 0, 0, 72, 72); });
}

/* ----- The cabinet ----- */
function a3Material(color, extra = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.05 }, extra)); }
function a3Box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  (parent || A3D.root).add(m);
  return m;
}

function a3Build(aspect) {
  const S = A3D.scene;
  if (A3D.root) { S.remove(A3D.root); A3D.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const root = A3D.root = new THREE.Group();
  S.add(root);
  A3D.hits = []; A3D.buttons = []; A3D.peels = []; A3D.faces = {};
  const sw = A3D.sw = 100, sh = A3D.sh = Math.round(100 * aspect);
  const IW = 236, T = 12, y0 = -sh - 44 - 160;
  A3D.floor = y0;
  const M = {
    body: a3Material("#121a16"), dark: a3Material("#0b0f0d"), black: a3Material("#050706"), trim: a3Material("#1d2823"),
    gold: a3Material("#b8902a", { metalness: 0.6, roughness: 0.4 }), deck: a3Material("#1a2420"), chrome: a3Material("#c8ccd0", { metalness: 0.8, roughness: 0.3 })
  };
  // the side panels: the cabinet's profile, cut out of a board
  const prof = [[-110, y0], [44, y0], [44, -sh - 44], [68, -sh - 40], [68, -sh - 20], [12, -sh - 6], [12, sh + 24], [32, sh + 28], [32, sh + 92], [-110, sh + 92]];
  const shape = new THREE.Shape();
  prof.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  const zs = prof.map(p => p[0]), ys = prof.map(p => p[1]);
  const bw = Math.max(...zs) - Math.min(...zs), bh = Math.max(...ys) - Math.min(...ys);
  const art = a3SideArt(160, Math.round(160 * bh / bw));
  art.repeat.set(1 / bw, 1 / bh); art.offset.set(-Math.min(...zs) / bw, -Math.min(...ys) / bh);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  [-1, 1].forEach(s => {
    const m = new THREE.Mesh(geo, [a3Material("#ffffff", { map: art }), M.gold]);
    m.position.set(s < 0 ? -IW / 2 : IW / 2 + T, 0, 0);
    m.castShadow = true; m.receiveShadow = true;
    root.add(m);
  });
  const x0 = -IW / 2, cw = IW;
  // the screen: its bezel round the opening (the page's board sits in it), a gold line, the dark behind
  a3Box(cw, 12, 4, M.trim, 0, sh + 6, -1);
  a3Box(cw, 12, 4, M.trim, 0, -sh - 6, -1);
  a3Box(IW / 2 - sw, 2 * sh + 24, 4, M.trim, x0 + (IW / 2 - sw) / 2, 0, -1);
  a3Box(IW / 2 - sw, 2 * sh + 24, 4, M.trim, -x0 - (IW / 2 - sw) / 2, 0, -1);
  [[0, sh + 1, 2 * sw + 4, 2], [0, -sh - 1, 2 * sw + 4, 2], [-sw - 1, 0, 2, 2 * sh], [sw + 1, 0, 2, 2 * sh]].forEach(([x, y, w, h]) => a3Box(w, h, 1.2, M.gold, x, y, 1.4));
  a3Box(2 * sw, 2 * sh, 2, M.black, 0, 0, -8);
  for (let k = -3; k <= 3; k++) [-1, 1].forEach(s => a3Box(2, 2, 1, M.gold, s * (sw + 8), k * sh / 3.5, 1.5));
  // the speaker grille and the marquee, lit from inside
  const grille = a3Box(cw, 14, 6, [M.dark, M.dark, M.dark, M.dark, a3Material("#ffffff", { map: a3GrilleArt() }), M.dark], 0, sh + 19, 3);
  void grille;
  A3D.marquee = a3MarqueeArt();
  const mq = a3Material("#ffffff", { map: A3D.marquee, emissive: "#ffffff", emissiveMap: A3D.marquee, emissiveIntensity: 0.85 });
  a3Box(cw, 62, 90, [M.trim, M.trim, M.trim, M.trim, mq, M.trim], 0, sh + 57, -15);
  [[0, sh + 89, cw, 2], [0, sh + 26.5, cw, 2]].forEach(([x, y, w, h]) => a3Box(w, h, 2, M.gold, x, y, 30.5));
  a3Box(cw + 2 * T, 6, 144, M.dark, 0, sh + 95, -38);
  // the control panel: a sloped deck with its joystick and buttons, and its lip
  const ang = Math.atan2(12, 58);
  const deck = new THREE.Group();
  deck.position.set(0, -sh - 18, 33); deck.rotation.x = ang;
  root.add(deck);
  A3D.faces.deck = deck;
  a3Box(cw, 6, Math.hypot(58, 12), M.deck, 0, -3, 0, deck);
  a3Box(cw, 1, 4, M.gold, 0, 0.2, 27.5, deck);
  a3Box(cw, 22, 22, M.body, 0, -sh - 33, 50);
  a3Box(cw, 34, 46, M.body, 0, -sh - 27, 18);
  // the joystick: a base, a shaft and a red ball that tilts the way you push
  const joy = new THREE.Group();
  joy.position.set(-62, 0, 2);
  deck.add(joy);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 2, 16), M.black); base.position.y = 1; base.castShadow = true; joy.add(base);
  const stick = new THREE.Group(); joy.add(stick);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 14, 8), M.chrome); shaft.position.y = 8; shaft.castShadow = true; stick.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(5.5, 12, 10), a3Material("#e8242a", { roughness: 0.35 })); ball.position.y = 16; ball.castShadow = true; stick.add(ball);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 4, 16), new THREE.MeshBasicMaterial({ visible: false })); pad.position.y = 2; joy.add(pad);
  A3D.joy = { group: joy, stick, tilt: { x: 0, z: 0 } };
  [pad, ball, shaft, base].forEach(m => A3D.hits.push({ mesh: m, kind: "joy", tip: "Joystick: steer the snake" }));
  // the buttons: two start buttons, then red, yellow and blue in two rows
  const button = (x, z, color, kind, tip, w = 0) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); deck.add(g);
    const ring = new THREE.Mesh(w ? new THREE.BoxGeometry(w + 3, 1, 7) : new THREE.CylinderGeometry(6.6, 6.6, 1, 14), M.black); ring.position.y = 0.5; g.add(ring);
    const cap = new THREE.Mesh(w ? new THREE.BoxGeometry(w, 3, 5) : new THREE.CylinderGeometry(5, 5.4, 3, 14), a3Material(color, { roughness: 0.4, emissive: color, emissiveIntensity: 0.15 }));
    cap.position.y = 2.2; cap.castShadow = true; g.add(cap);
    const b = { cap, kind, down: 0, rest: 2.2 };
    A3D.buttons.push(b);
    [cap, ring].forEach(m => A3D.hits.push({ mesh: m, kind, tip, button: b }));
  };
  button(-22, -14, "#f0f0f0", "start", "1P: a new snake", 8);
  button(-6, -14, "#f0f0f0", "auto", "2P: let it play by itself", 8);
  [[18, "#e8242a", "turbo", "Turbo"], [36, "#ffd23f", "feed", "Apples"], [54, "#2f7dff", "orb", "A golden orb"]].forEach(([x, c, k, tip]) => { button(x, -6, c, k, tip); button(x + 4, 9, c, k, tip); });
  // below: the front, the coin door, the plinth
  a3Box(cw, -sh - 44 - y0 - 10, 130, M.body, 0, (y0 + 10 - sh - 44) / 2, -29);
  A3D.faces.kick = { z: 36 };
  a3Box(72, 72, 4, [M.gold, M.gold, M.gold, M.gold, a3Material("#ffffff", { map: a3CoinDoorArt(), emissive: "#ff8a1a", emissiveMap: null, emissiveIntensity: 0 }), M.gold], 0, -sh - 44 - 66, 38);
  a3Box(cw + 2 * T - 6, 10, 150, M.black, 0, y0 + 5, -33);
  // the dark green glow strips down the front, either side
  [-1, 1].forEach(s => a3Box(2, 110, 1, a3Material("#3fbf6f", { emissive: "#3fbf6f", emissiveIntensity: 0.9 }), s * (IW / 2 - 6), -sh - 44 - 66, 36.6));
  // where the shadows fall: the wall behind and the floor
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.35 }));
  wall.position.z = -170; wall.receiveShadow = true; root.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1200), new THREE.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, y0, 300); floor.receiveShadow = true; root.add(floor);
  A3D.IW = IW; A3D.T = T;
  A3D.dressing = new THREE.Group(); root.add(A3D.dressing);
  A3D.built = true;
  A3D.aspect = aspect;
  A3D.tag = "";
}

/* A flat thing stuck to a face: returns its holder (oriented to the face, at the spot) */
function a3Stick(slot, w, h, mesh, lift = 0) {
  const holder = new THREE.Group();
  const sh = A3D.sh;
  slot = Object.assign({}, slot, { y: (slot.y || 0) + (slot.at === "kick" ? -sh - 44 : slot.at === "marquee" ? sh + 57 : 0) });
  const tilt = (slot.tilt || 0) * Math.PI / 180;
  const IW = A3D.IW, T = A3D.T;
  if (slot.face === "left") { holder.position.set(-IW / 2 - T - 0.4 - lift, slot.y, slot.z); holder.rotation.y = -Math.PI / 2; }
  else if (slot.face === "right") { holder.position.set(IW / 2 + T + 0.4 + lift, slot.y, slot.z); holder.rotation.y = Math.PI / 2; }
  else if (slot.face === "wall") holder.position.set(slot.x, slot.y, -168 + lift);
  else if (slot.face === "deck") { holder.position.set(slot.x, 0.6 + lift, slot.z); holder.rotation.x = -Math.PI / 2; A3D.faces.deck.add(holder); }
  else holder.position.set(slot.x, slot.y, (slot.z || 1) + lift);
  if (slot.face !== "deck") A3D.dressing.add(holder);
  const spin = new THREE.Group(); spin.rotation.z = tilt; holder.add(spin);
  spin.add(mesh);
  return { holder, spin };
}
function a3Plane(w, h, tex, extra = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), a3Material("#ffffff", Object.assign({ map: tex, transparent: true, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide }, extra)));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* The posters and stickers, from your save */
function a3Dress() {
  const D = A3D.data;
  if (!D) return;
  const tag = JSON.stringify([D.stats, D.posters.map(p => [p.name, p.dead, p.fights]), D.done.map(I => I.id), D.money.map(m => m.v), D.gems]);
  if (tag === A3D.tag) return;
  A3D.tag = tag;
  A3D.dressing.clear();
  if (A3D.faces.deck) A3D.faces.deck.children.filter(c => c._sticker).forEach(c => A3D.faces.deck.remove(c));
  A3D.hits = A3D.hits.filter(h => h.kind !== "peel");
  A3D.peels = [];
  // the marquee's readout
  const mc = A3D.marquee._canvas;
  a3PaintMarquee(mc.getContext("2d"), mc.width, mc.height); A3D.marquee.needsUpdate = true;
  // your numbers
  const statMeshes = [];
  D.stats.forEach(([label, v], i) => {
    const slot = A3.stats[i];
    if (!slot) return;
    const m = a3Plane(40, 54, a3StatArt(slot, label, v, i));
    statMeshes[i] = a3Stick(slot, 40, 54, m);
  });
  // the wanted posters, nailed to the wall
  D.posters.forEach((p, i) => {
    const b = A3.bounties[i];
    if (!b) return;
    a3Stick({ face: "wall", x: b[0], y: b[1], tilt: b[2] }, 50, 70, a3Plane(50, 70, a3WantedArt(p, i)), 1);
  });
  // the stickers, all sizes; one over a number sits on its poster and peels back when you point at it
  D.done.forEach((I, i) => {
    const slot = A3.stickers[i];
    if (!slot) return;
    const s = slot.size || 22;
    const m = a3Plane(s, s, a3StickerArt(I.id));
    m.position.set(s / 2, -s / 2, 0);
    // hinged at its top edge, so it can lift; centred where it's stuck
    const hinge = new THREE.Group(); hinge.position.set(-s / 2, s / 2, 0); hinge.add(m);
    const turn = new THREE.Group(); turn.rotation.z = (slot.tilt || 0) * Math.PI / 180; turn.add(hinge);
    const poster = slot.cover !== undefined ? statMeshes[slot.cover] : null;
    if (poster) { turn.position.set(0, -7, 0.35); poster.spin.add(turn); }
    else { const st = a3Stick(Object.assign({}, slot, { tilt: 0 }), s, s, turn, 0.3); st.holder._sticker = true; }
    if (poster) {
      const peel = { hinge, angle: 0, target: 0 };
      A3D.peels.push(peel);
      A3D.hits.push({ mesh: m, kind: "peel", tip: `${I.name}: finished`, peel });
      poster.spin.children.filter(c => c.isMesh).forEach(pm => A3D.hits.push({ mesh: pm, kind: "peel", tip: D.stats[slot.cover][0], peel }));
    }
  });
}

/* ----- The camera, and the page's board kept in the screen ----- */
function a3Layout() {
  const st = stageEl;
  const keep = st.style.transform;
  st.style.transform = "none";
  const r = st.getBoundingClientRect();
  st.style.transform = keep;
  A3D.base = { left: r.left, top: r.top, w: st.offsetWidth, h: st.offsetHeight };
  A3D.stage = { w: st.offsetWidth, h: st.offsetHeight };
  const vw = window.innerWidth, vh = window.innerHeight;
  const aspect = Math.round((st.offsetHeight / Math.max(1, st.offsetWidth)) * 50) / 50;
  if (!A3D.built || Math.abs(aspect - A3D.aspect) > 0.001) { a3Build(aspect); a3Dress(); }
  const sw = A3D.sw, sh = A3D.sh;
  // as big as the page would show the board, but small enough that the marquee and the control panel show too
  A3D.ppu = Math.min(r.width / (2 * sw), (vh - 24) / (2 * sh + 92 + 44));
  const fov = A3D.camera.fov * Math.PI / 180;
  A3D.D = (vh / 2) / (A3D.ppu * Math.tan(fov / 2));
  // the screen's middle sits where the marquee's top and the control panel's lip are framed in the window
  A3D.rest = { x: vw / 2, y: vh / 2 + ((sh + 92) - (sh + 44)) / 2 * A3D.ppu };
  A3D.renderer.setSize(vw, vh, false);
  A3D.camera.aspect = vw / vh;
  // how far you can look: the same every way
  A3D.reach = { pan: Math.min(220, 0.32 * (2 * sh + 300)), yaw: 0.3, pitch: 0.3 };
  a3Render(performance.now());
}

function a3Look(px, py) {
  const L = A3D.look, vw = window.innerWidth, vh = window.innerHeight;
  if (px === null || lookStill()) { L.tyaw = L.tpitch = L.tx = L.ty = 0; return; }
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  // over the screen a little (15%), past its edges the rest of the way; the same either way
  const sr = A3D.screenRect || { left: vw * 0.3, right: vw * 0.7, top: vh * 0.25, bottom: vh * 0.75 };
  const axis = (p, lo, hi, end) => {
    if (p < lo) return -(0.15 + 0.85 * ease((lo - p) / Math.max(1, lo)));
    if (p > hi) return 0.15 + 0.85 * ease((p - hi) / Math.max(1, end - hi));
    return 0.15 * ((p - (lo + hi) / 2) / ((hi - lo) / 2));
  };
  const ax = axis(px, sr.left, sr.right, vw), ay = axis(py, sr.top, sr.bottom, vh);
  L.tyaw = ax * A3D.reach.yaw; L.tpitch = -ay * A3D.reach.pitch;
  L.tx = ax * A3D.reach.pan; L.ty = -ay * A3D.reach.pan;
}

/* matrix3d taking a w x h box to the quad p (top left, top right, bottom right, bottom left) */
function a3Quad(w, h, p) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) { a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; hh = 0; }
  else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den; hh = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
  }
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${c},${f},0,1)`;
}

function a3Render(ts) {
  const L = A3D.look, cam = A3D.camera, vw = window.innerWidth, vh = window.innerHeight;
  const k = 0.09;
  L.yaw += (L.tyaw - L.yaw) * k; L.pitch += (L.tpitch - L.pitch) * k; L.x += (L.tx - L.x) * k; L.y += (L.ty - L.y) * k;
  // the camera circles the point it looks at (the screen's middle, panned), from the same distance
  const target = new THREE.Vector3(L.x, L.y, 0);
  cam.position.set(target.x + A3D.D * Math.sin(L.yaw) * Math.cos(L.pitch), target.y + A3D.D * Math.sin(L.pitch), A3D.D * Math.cos(L.yaw) * Math.cos(L.pitch));
  cam.lookAt(target);
  cam.setViewOffset(vw, vh, -(A3D.rest.x - vw / 2), -(A3D.rest.y - vh / 2), vw, vh);
  cam.updateProjectionMatrix();
  // the controls: buttons spring back up, the joystick leans the way it's pushed, stickers peel
  const now = ts;
  A3D.buttons.forEach(b => { b.cap.position.y = b.rest - (now < b.down ? 1.6 : 0); });
  if (A3D.joy) {
    const want = A3D.held && A3D.held.kind === "joy" && A3D.held.dir ? A3D.held.dir : { x: 0, y: 0 };
    const J = A3D.joy.tilt;
    J.x += (want.y * 0.45 - J.x) * 0.3; J.z += (-want.x * 0.45 - J.z) * 0.3;
    A3D.joy.stick.rotation.set(J.x, 0, J.z);
  }
  A3D.peels.forEach(p => { p.angle += (p.target - p.angle) * 0.2; p.hinge.rotation.x = -p.angle; });
  A3D.renderer.render(A3D.scene, cam);
  // the page's board, warped onto the screen
  const sw = A3D.sw, sh = A3D.sh, z = 0.2;
  const px = (x, y) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * vw, (1 - v.y) / 2 * vh]; };
  const q = [px(-sw, sh), px(sw, sh), px(sw, -sh), px(-sw, -sh)];
  const B = A3D.base;
  stageEl.style.transformOrigin = "0 0";
  stageEl.style.transform = a3Quad(B.w, B.h, q.map(([x, y]) => [x - B.left, y - B.top]));
  A3D.screenRect = { left: Math.min(q[0][0], q[3][0]), right: Math.max(q[1][0], q[2][0]), top: Math.min(q[0][1], q[1][1]), bottom: Math.max(q[2][1], q[3][1]) };
  // the wall (the swirl) drifts a third as far
  document.body.style.setProperty("--lx", (-(L.x + L.yaw * 300) * A3D.ppu * 0.35).toFixed(1) + "px");
  document.body.style.setProperty("--ly", ((L.y + L.pitch * 300) * A3D.ppu * 0.35).toFixed(1) + "px");
}

function a3Loop(ts) {
  A3D.raf = 0;
  if (!A3D.on) return;
  A3D.raf = requestAnimationFrame(a3Loop);
  if (stageEl.offsetWidth !== A3D.stage.w || stageEl.offsetHeight !== A3D.stage.h) a3Layout();
  a3Render(ts);
}

/* ----- Pressing things ----- */
const a3Ray = new THREE.Raycaster();
function a3Pick(e) {
  if (!A3D.on) return null;
  const v = new THREE.Vector2(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  a3Ray.setFromCamera(v, A3D.camera);
  const hit = a3Ray.intersectObjects(A3D.hits.map(h => h.mesh), false)[0];
  if (!hit) return null;
  const h = A3D.hits.find(x => x.mesh === hit.object);
  return h ? Object.assign({ point: hit.point }, h) : null;
}
const a3OnUi = t => !!(t && t.closest && t.closest("button, a, input, select, textarea, #stage, #hud, .modal.active, #toast, [role=dialog], .cw-bar"));
/* Which way the joystick is pushed: where the pointer's ray meets the control panel, from the stick */
function a3JoyDir() {
  const J = A3D.joy.group, origin = J.getWorldPosition(new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(J.getWorldQuaternion(new THREE.Quaternion()));
  const hit = a3Ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(up, origin), new THREE.Vector3());
  if (!hit) return null;
  const local = J.worldToLocal(hit);
  const dx = local.x, dz = local.z;
  if (Math.hypot(dx, dz) < 2.5) return null;
  return Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dz) };
}
function a3Press(h) {
  const now = performance.now();
  if (h.button) h.button.down = now + 160;
  sfx(h.kind === "joy" ? "tick" : "click");
  if (typeof demoControl === "function") demoControl(h.kind, h.dir);
}
window.addEventListener("pointermove", e => {
  if (!A3D.on) return;
  const h = a3OnUi(e.target) ? null : a3Pick(e);
  A3D.hover = h;
  document.body.style.cursor = h ? "pointer" : "";
  A3D.canvas.title = h ? h.tip : "";
  // pointing at a covered number (or its sticker) peels the sticker back
  A3D.peels.forEach(p => { p.target = h && h.peel === p ? 0.8 : 0; });
  if (A3D.held && A3D.held.kind === "joy" && h && h.kind === "joy") {
    const d = a3JoyDir();
    if (d && (!A3D.held.dir || d.x !== A3D.held.dir.x || d.y !== A3D.held.dir.y)) { A3D.held.dir = d; a3Press(A3D.held); }
  }
});
window.addEventListener("pointerdown", e => {
  if (!A3D.on || e.button !== 0 || a3OnUi(e.target)) return;
  const h = a3Pick(e);
  if (!h || h.kind === "peel") return;
  e.preventDefault();
  if (h.kind === "joy") { h.dir = a3JoyDir(); if (!h.dir) return; }
  A3D.held = h;
  a3Press(h);
});
window.addEventListener("pointerup", () => { A3D.held = null; });

/* ----- On and off (camp-title.js calls these) ----- */
function arcade3dFits() { return A3_OK && typeof arcadeFits === "function" && arcadeFits(); }
function arcade3dInit() {
  if (A3D.renderer) return true;
  try {
    const canvas = A3D.canvas = document.createElement("canvas");
    canvas.id = "title-3d";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.getElementById("title-machine"));
    const r = A3D.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    r.setPixelRatio(Math.min(1, window.devicePixelRatio || 1));
    r.useLegacyLights = true;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    const S = A3D.scene = new THREE.Scene();
    A3D.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 20, 6000);
    S.add(new THREE.HemisphereLight(0x5a7a6a, 0x101814, 1.1));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.35);
    key.position.set(-320, 520, 640); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 100, far: 2400 });
    S.add(key);
    const glow = new THREE.PointLight(0x3fbf6f, 1.4, 360); glow.position.set(0, 160, 90); S.add(glow);
    const screen = new THREE.PointLight(0x9fe0ff, 0.7, 320); screen.position.set(0, 0, 70); S.add(screen);
    A3D.lights = { glow, screen };
    // pixel fonts on the posters: draw them again once the fonts are in
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load(`12px ${A3_FONT}`), document.fonts.load(`14px ${A3_TITLE}`)]).then(() => { A3D.tag = ""; if (A3D.on) a3Dress(); });
    return true;
  } catch (e) {
    console.warn("arcade 3d: " + e.message);
    A3D.renderer = null;
    return false;
  }
}
/* The save's numbers for the machine: money, gems, your numbers, the bosses, the stickers */
function arcade3dShow(stats, done) {
  if (!arcade3dInit()) return false;
  const posters = CAMP.islands.map(I => {
    const seen = !placeFogged(I.id) && campIslandOpen(I.id), dead = islandDone(I.id);
    return { name: seen ? I.boss.name.split(" the ")[0] : "???", face: seen ? texCanvas("boss:" + I.id) : null, dead, fights: seen && !dead ? BOSS_LEVELS.filter(n => campWon(I.id, n)).length : null, of: 3 };
  });
  if (camp.nm && camp.nm.open) posters.push({ name: "The Maw", face: texCanvas("sticker:maw"), dead: mawDone(), fights: mawDone() ? null : camp.nm.maw.length, of: CAMP.islands.length });
  A3D.data = {
    stats, done, posters, gems: camp.gems,
    money: CAMP.islands.filter(I => campIslandOpen(I.id)).map(I => ({ c: I.currency.color, v: campWallet(I.id) }))
  };
  document.body.classList.add("arcade3d");
  A3D.on = true;
  a3Layout();
  a3Dress();
  if (!A3D.raf) A3D.raf = requestAnimationFrame(a3Loop);
  return true;
}
function arcade3dOff() {
  if (!A3D.on) return;
  A3D.on = false;
  document.body.classList.remove("arcade3d");
  document.body.style.cursor = "";
  stageEl.style.transform = "";
  stageEl.style.transformOrigin = "";
  A3D.look.yaw = A3D.look.pitch = A3D.look.x = A3D.look.y = 0;
  A3D.look.tyaw = A3D.look.tpitch = A3D.look.tx = A3D.look.ty = 0;
}
