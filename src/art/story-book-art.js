/* =========================================================
   src/art/story-book-art.js
   Animated pixel dioramas for the story book
   ========================================================= */
"use strict";

/* =========================================================
   Story book pictures: small animated pixel dioramas.
   Each picture is 160 x 60 pixels, drawn fresh about 24 times a
   second while it is on screen, and stretched with chunky pixels.
   Your own snake, in your own skin, stars in most of them. What
   stands still is pictures in textures/scenes/story/ (a sky and
   layers per page); what moves is drawn here between them.
   ========================================================= */
const ART_W = 160;
const ART_H = 60;
const ART_SCENE = {
  intro: "garden", easy: "garden", levelsdone: "garden", nightmaresdone: "dawn", tutorial: "tutorial",
  shop: "shop", inventory: "satchel", achievements: "badges", stats: "ledger", settings: "curtain",
  classic: "classic", challenge: "quarry", insane: "parlor", chaos: "storm", mirror: "mirror", treasure: "vault",
  endless: "tunnel", inferno: "furnace", labyrinth: "maze", end: "ouroboros"
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const artCanvases = new Set();
let artRaf = 0;
let artLast = 0;

function artKit(g, t) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const mix = (a, b, k) => { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; };
  const kit = {
    R, mix,
    // The page's pictures (textures/scenes/story/): its sky or another picture as it is (a frame of
    // it, at x, y), and its layers, laid like the old drawing code laid them (see texLayer); a layer
    // with an anchor (a relic) has that pixel on x, y
    pic(id, frame = 0, x = 0, y = 0) { texDraw(g, id, x, y, frame); },
    layer(id, x = 0, y = 0) { const r = texResolve(id), a = (r && r.e.anchor) || [0, 0]; texLayer(g, id, Math.round(x) - a[0], Math.round(y) - a[1]); },
    // A small picture (or a frame of it) with its anchor on x, y, rounded as the old drawing code rounded;
    // or painted pixel by pixel, with an alpha over it or its key colors swapped (see texPaint)
    put(id, x, y, frame = 0) { texDrawAt(g, id, Math.round(x), Math.round(y), frame); },
    paint(id, x, y, opts) { const r = texResolve(id), a = (r && r.e.anchor) || [0, 0]; texPaint(g, id, Math.round(x) - a[0], Math.round(y) - a[1], opts); },
    // A rolling silhouette, scrolling at its own speed for parallax
    hills(color, base, amp, freq, speed, seed = 1) {
      g.fillStyle = color;
      for (let x = 0; x < ART_W; x++) {
        const u = x + t * speed;
        const h = Math.sin(u * freq + seed) * amp + Math.sin(u * freq * 2.3 + seed * 3) * amp * 0.4;
        const top = Math.round(base - h);
        g.fillRect(x, top, 1, ART_H - top);
      }
    },
    // Your snake, slithering along a gentle wave
    snake(x, y, n, opts = {}) {
      const skin = currentSkin();
      const dir = opts.dir || 1;
      const s = opts.size || 4;
      const wave = opts.wave === undefined ? 1.6 : opts.wave;
      const speed = opts.speed || 5;
      for (let i = n - 1; i >= 0; i--) {
        const sx = x - i * (s - 1) * dir;
        const sy = y + Math.round(Math.sin(t * speed - i * 0.8) * wave);
        R(sx, sy + 1, s, s, "rgba(0,0,0,0.3)");
        R(sx, sy, s, s, skinColorAt(skin, i, t * 1000));
        R(sx, sy, s, 1, "rgba(255,255,255,0.25)");
      }
      const hy = y + Math.round(Math.sin(t * speed) * wave);
      const ex = dir > 0 ? x + s - 2 : x;
      R(ex, hy + 1, 2, 2, "#ffffff");
      R(ex + (dir > 0 ? 1 : 0), hy + 1 + (Math.sin(t * 0.7) > 0.95 ? 0 : 1), 1, 1, "#111111");
      if (opts.tongue && Math.sin(t * 3) > 0.6) R(dir > 0 ? x + s : x - 2, hy + 2, 2, 1, "#ff3b6b");
    },
    // The cast, pictures in textures/scenes/story/kit/: an apple (or a big one); an orb, its glow
    // pulsing; a popsicle in any flavor (its key color swapped for c); the tortoise (three frames as its
    // head bobs), the raccoon (bobbing, its eyes open then shut; its tail's stripes wave), the beetle (three steps)
    apple(x, y, big = false) { kit.put(big ? "story:apple-big" : "story:apple", x, y); },
    orb(x, y) {
      const p = 0.5 + 0.5 * Math.sin(t * 4 + x);
      kit.paint("story:orb-glow", x, y, { alpha: 0.15 + p * 0.25 });
      kit.put("story:orb", x, y);
    },
    popsicle(x, y, c) { kit.paint("story:popsicle", x, y, { colors: { ice: c } }); kit.paint("story:popsicle-shine", x, y); },
    tortoise(x, y) { kit.put("story:tortoise", x, y, Math.round(Math.sin(t * 1.5) * 0.6) + 1); },
    raccoon(x, y) {
      const bob = Math.round(Math.sin(t * 2) * 0.6);
      const blink = (t % 3.2) < 0.12;
      kit.put("story:raccoon", x, y, (blink ? 3 : 0) + bob + 1);
      // the striped tail, peeking out
      for (let i = 0; i < 4; i++) kit.put("story:raccoon-tail", x + 5 + i * 2, y + 1 - Math.round(Math.sin(t * 3 + i) * 1), i % 2);
    },
    beetle(x, y) { kit.put("story:beetle", x, y, Math.round(Math.sin(t * 6)) + 1); },
    stars(n, seed = 1, color = "#ffffff") {
      for (let i = 0; i < n; i++) {
        const x = Math.floor(mapHash(i, seed, 31) * ART_W), y = Math.floor(mapHash(i, seed, 37) * ART_H * 0.6);
        const tw = Math.sin(t * (1 + mapHash(i, seed, 41) * 3) + i);
        if (tw > -0.3) R(x, y, 1, 1, tw > 0.7 ? color : mix(color, "#000000", 0.5));
      }
    },
    // Weather and dust: positions come from the clock, so nothing needs to be stored
    fall(n, color, speed, seed = 1, drift = 0, size = 1, y0 = 0, y1 = ART_H) {
      for (let i = 0; i < n; i++) {
        const ph = (t * speed * (0.6 + mapHash(i, seed, 3) * 0.8) / (y1 - y0) + mapHash(i, seed, 5)) % 1;
        const x = (mapHash(i, seed, 7) * ART_W + Math.sin(t + i) * drift + ART_W) % ART_W;
        R(x, y0 + ph * (y1 - y0), size, size, color);
      }
    },
    rise(n, color, speed, seed = 1, x0 = 0, x1 = ART_W, y1 = ART_H) {
      for (let i = 0; i < n; i++) {
        const ph = (t * speed * (0.6 + mapHash(i, seed, 3) * 0.8) / y1 + mapHash(i, seed, 5)) % 1;
        const x = x0 + mapHash(i, seed, 7) * (x1 - x0) + Math.sin(t * 2 + i) * 2;
        g.globalAlpha = 1 - ph;
        R(x, y1 - ph * y1, 1, 1, color);
      }
      g.globalAlpha = 1;
    },
    flame(x, y, h, seed = 0) {
      for (let j = 0; j < h; j++) {
        const w = Math.max(1, Math.round((h - j) / 2 + Math.sin(t * 9 + j + seed) * 0.8));
        const c = j < h * 0.3 ? "#ff4a1a" : j < h * 0.7 ? "#ff9a1a" : "#ffe066";
        R(x - Math.floor(w / 2) + Math.round(Math.sin(t * 7 + j * 0.7 + seed)), y - j, w, 1, c);
      }
    },
    glow(x, y, r, color, alpha = 0.35) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, color.replace("ALPHA", alpha));
      gr.addColorStop(1, color.replace("ALPHA", 0));
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    },
    vignette(strength = 0.45) {
      const gr = g.createRadialGradient(ART_W / 2, ART_H / 2, ART_H * 0.4, ART_W / 2, ART_H / 2, ART_W * 0.62);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, `rgba(20,10,0,${strength})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, ART_W, ART_H);
    }
  };
  return kit;
}

/* Each page's still parts are pictures in textures/scenes/story/<page>/: its sky (story:<page>:sky), then
   its layers (story:<page>:1, :2...) laid where they were always painted, between the things that move,
   glow or wear your skin, which are drawn here */
const ART_DRAW = {
  garden(k, t) {
    k.pic("story:garden:sky");
    k.glow(132, 10, 26, "rgba(255,240,170,ALPHA)", 0.5 + Math.sin(t) * 0.1);
    k.layer("story:garden:1"); // the sun
    for (let i = 0; i < 3; i++) k.put("story:garden:cloud", ((i * 70 + t * 3) % 220) - 30, 6 + i * 5);
    k.hills("#9fd38a", 40, 5, 0.05, 1.5, 2);
    k.hills("#6db55a", 46, 4, 0.08, 3, 5);
    k.layer("story:garden:2"); // the meadow
    for (let x = 0; x < ART_W; x += 3) k.R(x + Math.round(Math.sin(t * 2 + x) * 0.6), 47 - (x % 2), 1, 2, "#5ab046");
    k.layer("story:garden:3"); // its flowers, and the apple tree's trunk
    k.put("story:garden:canopy", 6 + Math.round(Math.sin(t * 1.2)), 15); // its leaves and apples, swaying
    k.snake(92 + Math.round(Math.sin(t * 0.6) * 6), 50, 7, { tongue: true });
    k.layer("story:garden:4"); // an apple in the grass
    for (let i = 0; i < 2; i++) { const bx = 60 + Math.sin(t * 0.7 + i * 2) * 30, by = 30 + Math.sin(t * 1.3 + i) * 6; const f = Math.sin(t * 14 + i) > 0; k.R(bx, by, 1, 1, "#ffffff"); k.R(bx - 1, by - (f ? 1 : 0), 1, 1, i ? "#ffd23f" : "#ff9ad5"); k.R(bx + 1, by - (f ? 1 : 0), 1, 1, i ? "#ffd23f" : "#ff9ad5"); }
  },
  dawn(k, t) {
    k.pic("story:dawn:sky");
    const rise = Math.min(1, (t % 12) / 6);
    k.glow(80, 44, 40, "rgba(255,200,120,ALPHA)", 0.6);
    k.put("story:dawn:sun", 70, 42 - rise * 6);
    k.hills("#b07aa0", 44, 4, 0.06, 1, 3);
    k.layer("story:dawn:1"); // the meadow
    // curled up, asleep
    const skin = currentSkin();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.R(80 + Math.cos(a) * 7, 50 + Math.sin(a) * 3, 4, 3, skinColorAt(skin, i, 0)); }
    for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3) % 1; k.paint("story:dawn:z", 92 + ph * 10, 44 - ph * 16, { alpha: 1 - ph }); }
  },
  tutorial(k, t) {
    k.pic("story:tutorial:sky");
    k.layer("story:tutorial:1"); // the grass, the purple post
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    k.glow(8, 30, 12, "rgba(143,77,255,ALPHA)", 0.3 * pulse);
    k.layer("story:tutorial:2"); // the red post, a rock
    const x = 20 + ((t * 14) % 100);
    k.snake(x, 44, 5);
    k.layer("story:tutorial:3"); // an apple
    k.orb(100, 30); k.orb(40, 24);
  },
  shop(k, t) {
    k.pic("story:shop:sky");
    k.layer("story:shop:1"); // the wall's shadowed planks
    k.layer("story:shop:2"); // the awning, and the shelves of jars full of XP
    // the jars glint now and then
    [16, 30].forEach((y, r) => { for (let i = 0; i < 4; i++) [12 + i * 10, 112 + i * 10].forEach(x => { if (Math.sin(t * 2 + i + r * 3 + x) > 0.92) k.R(x + 1, y + 1, 1, 1, "#ffffff"); }); });
    // the swinging lamp
    const sw = Math.sin(t * 1.4) * 4;
    k.put("story:shop:lamp-cord", 80 + sw * 0.5, 8); k.put("story:shop:lamp", 77 + sw, 16);
    k.glow(80 + sw, 22, 34, "rgba(255,220,140,ALPHA)", 0.38);
    k.layer("story:shop:3"); // the counter
    k.raccoon(80, 42);
    k.orb(100, 40);
    k.layer("story:shop:4"); // an apple on it
    k.vignette(0.5);
  },
  satchel(k, t) {
    k.pic("story:satchel:sky");
    k.layer("story:satchel:1"); // the wall's shadowed seams, the satchel
    const lift = Math.max(0, Math.sin(t * 0.9)) * 3;
    k.apple(66, 22 - lift); k.orb(84, 20 - lift);
    k.put("story:satchel:flap", 54, 18 - lift); // its flap and clasp, lifting off a stick
    for (let i = 0; i < 3; i++) k.R(60 + i * 2, 8 + i, 1, 18 - lift, "#5a3410");
    k.fall(10, "rgba(255,240,200,0.6)", 3, 4, 6);
    k.vignette(0.55);
  },
  badges(k, t) {
    k.pic("story:badges:sky");
    k.layer("story:badges:1"); // the board of badges
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) { const x = 16 + i * 11, y = 10 + r * 10; if (((t * 6) % 36 | 0) === i + r * 12) k.R(x + 1, y + 1, 2, 2, "#ffffff"); }
    const fl = 0.8 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7) * 0.1;
    k.layer("story:badges:2"); // the torch's post
    k.flame(5, 20, 6, 1); k.glow(5, 16, 30, "rgba(255,170,80,ALPHA)", 0.3 * fl);
    k.layer("story:badges:3"); // the floor
    k.tortoise(60 + Math.sin(t * 0.3) * 30, 48);
    k.vignette(0.55);
  },
  ledger(k, t) {
    k.pic("story:ledger:sky");
    const fl = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 5.3) * 0.07;
    k.glow(124, 26, 48, "rgba(255,190,110,ALPHA)", 0.45 * fl);
    k.layer("story:ledger:1"); // the candle
    k.flame(124, 30, 6, 2);
    k.layer("story:ledger:2"); // the open ledger
    const lines = Math.floor((t * 2) % 16);
    for (let i = 0; i < 6; i++) {
      const full = i * 2 < lines;
      k.R(32, 34 + i * 3, full ? 32 : 10, 1, "#7a6a4a");
      k.R(76, 34 + i * 3, i * 2 + 1 < lines ? 32 : 6, 1, "#7a6a4a");
    }
    const qx = 76 + ((lines % 2) * 16) + Math.sin(t * 8) * 2, qy = 34 + Math.floor(lines / 2) * 3;
    k.beetle(qx - 4, qy + 4);
    k.put("story:ledger:quill", qx, qy - 9);
    k.vignette(0.6);
  },
  curtain(k, t) {
    k.pic("story:curtain:sky");
    // the machinery of the world: its dials (a picture), their hands turning, its lights blinking
    k.layer("story:curtain:1");
    for (let i = 0; i < 4; i++) {
      const cx = 46 + i * 22, cy = 22, a = t * (0.6 + i * 0.4) + i;
      k.R(cx + Math.round(Math.cos(a) * 3), cy + Math.round(Math.sin(a) * 3), 1, 1, "#b23a3a");
      k.put("story:curtain:light", cx - 3, 36, Math.sin(t * 3 + i * 2) > 0 ? 0 : 1);
    }
    k.layer("story:curtain:2"); // the lever
    k.put("story:curtain:knob", 116 + Math.round(Math.sin(t) * 2), 22);
    k.layer("story:curtain:3"); // the stage's floor
    k.snake(84, 46, 4, { dir: -1, wave: 0.5 });
    // velvet curtains, breathing a little
    for (let side = 0; side < 2; side++) for (let i = 0; i < 6; i++) {
      const w = 34 + Math.round(Math.sin(t * 0.8 + i * 0.5) * 3);
      const x = side ? ART_W - w + i * 2 : i * 2 - 12;
      k.R(x + (side ? 0 : 0), 0, w - i * 4, ART_H, i % 2 ? "#7a1424" : "#961a2c");
    }
    k.layer("story:curtain:4"); // the pelmet over them
    k.vignette(0.4);
  },
  classic(k, t) {
    k.pic("story:classic:sky");
    for (let i = 0; i < 2; i++) k.put("story:classic:bird", (t * 9 + i * 80) % 200 - 20, 10 + i * 4, Math.sin(t * 10 + i) > 0 ? 1 : 0);
    k.layer("story:classic:1"); // the brick wall and the path
    // the carved brick, glowing faintly
    const p = 0.5 + 0.5 * Math.sin(t * 2);
    k.glow(118, 33, 10, "rgba(255,220,120,ALPHA)", 0.25 + p * 0.3);
    k.layer("story:classic:2");
    k.snake(70 + Math.round(Math.sin(t * 0.5) * 12), 50, 8);
  },
  quarry(k, t) {
    k.pic("story:quarry:sky");
    k.hills("#c9a978", 30, 6, 0.04, 1, 4);
    k.layer("story:quarry:1"); // the quarry face's seams
    k.hills("#a68a60", 40, 3, 0.09, 2, 9);
    k.layer("story:quarry:2"); // the floor, its rocks, the tortoise's slab
    k.tortoise(110, 36);
    const hue = (t * 80) % 360;
    if (Math.sin(t * 1.7) > -0.2) { k.R(66, 34, 3, 3, `hsl(${hue},100%,75%)`); k.glow(67, 35, 8, `hsla(${hue},100%,70%,ALPHA)`, 0.4); }
    k.snake(56, 50, 5);
    k.rise(10, "rgba(200,170,120,0.8)", 4, 3);
  },
  parlor(k, t) {
    k.pic("story:parlor:sky");
    k.layer("story:parlor:1"); // the tiled floor, the counter
    ["#4fd6ff", "#ff6fb0", "#b36bff", "#ffd23f", "#6ee7a8", "#ff8a3d", "#4fd6ff"].forEach((c, i) => k.popsicle(28 + i * 16, 28 + Math.round(Math.sin(t * 2 + i) * 1.4), c));
    for (let i = 0; i < 5; i++) if (Math.sin(t * 3 + i * 1.9) > 0.8) k.put("story:parlor:sparkle", 24 + i * 24, 24 + (i % 2) * 8);
    const hue = (t * 60) % 360;
    if (Math.sin(t * 0.8) > 0.2) { k.R(80, 12 + Math.sin(t * 2) * 2, 3, 3, `hsl(${hue},100%,75%)`); k.glow(81, 13, 9, `hsla(${hue},100%,70%,ALPHA)`, 0.4); }
    k.snake(96, 51, 6, { dir: -1 });
  },
  storm(k, t) {
    const flash = (t % 5) < 0.12 || ((t % 5) > 0.22 && (t % 5) < 0.3);
    k.pic("story:storm:sky", flash ? 1 : 0); // (its second frame: lit by the lightning)
    for (let i = 0; i < 4; i++) k.put("story:storm:cloud", ((i * 50 - t * 6) % 200 + 200) % 200 - 30, 2 + (i % 2) * 3);
    if (flash) k.pic("story:storm:bolt");
    k.layer("story:storm:1"); // the grass, the trees' trunks
    for (let i = 0; i < 6; i++) k.put("story:storm:canopy", 8 + i * 28, 32 + Math.round(Math.sin(t * 2 + i)));
    for (let i = 0; i < 14; i++) {
      const ph = (t * 0.5 * (0.7 + mapHash(i, 2, 3) * 0.6) + mapHash(i, 2, 5)) % 1;
      k.apple(mapHash(i, 2, 7) * 150 + Math.sin(t + i) * 3, -6 + ph * 56);
    }
    k.fall(30, "rgba(200,220,255,0.35)", 60, 9, 0, 1);
    k.snake(78, 52, 7, { speed: 8 });
  },
  mirror(k, t) {
    k.pic("story:mirror:sky");
    k.layer("story:mirror:1"); // the mirrors
    // in the middle mirror, something enormous winks (story:mirror:eye: open, shut)
    const open = ((t % 6) > 0.25 && (t % 6) < 5.6) ? 1 : 0;
    k.glow(80, 24, 14, "rgba(255,210,63,ALPHA)", 0.25);
    k.pic("story:mirror:eye", open ? 0 : 1, 72, 21);
    k.layer("story:mirror:2"); // the floor
    k.snake(46, 48, 5);
    k.snake(114, 48, 5, { dir: -1 });
    for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i * 0.7) % 2; const hop = ph < 1 ? Math.sin(ph * Math.PI) * 8 : 0; k.put("story:mirror:crumb", 30 + i * 45 + ph * 6, 44 - hop); }
  },
  vault(k, t) {
    k.pic("story:vault:sky");
    k.glow(40, 26, 30, "rgba(255,200,80,ALPHA)", 0.25);
    k.layer("story:vault:1"); // the round vault door
    // its wheel, turning slowly
    const a = t * 0.7;
    for (let i = 0; i < 3; i++) { const ang = a + i * Math.PI / 3; for (let r = -10; r <= 10; r++) k.R(40 + Math.round(Math.cos(ang) * r), 26 + Math.round(Math.sin(ang) * r), 2, 2, "#6a4c1e"); }
    for (let i = 0; i < 6; i++) { const ang = a + i * Math.PI / 3; k.R(39 + Math.round(Math.cos(ang) * 10), 25 + Math.round(Math.sin(ang) * 10), 3, 3, "#ffd23f"); }
    k.layer("story:vault:2"); // the wheel's hub, the floor
    for (let i = 0; i < 18; i++) k.put("story:vault:glitter", 70 + mapHash(i, 4, 1) * 86, 46 + mapHash(i, 4, 2) * 10, Math.sin(t * 3 + i) > 0.85 ? 1 : 0);
    k.layer("story:vault:3"); // the golden apple
    const p = 0.5 + 0.5 * Math.sin(t * 3);
    k.glow(140, 48, 8, "rgba(255,230,120,ALPHA)", 0.3 + p * 0.4);
    k.layer("story:vault:4"); // a gold bar
    k.snake(84, 50, 6, { size: 3 });
    k.vignette(0.5);
  },
  tunnel(k, t) {
    k.pic("story:tunnel:sky");
    k.glow(150, 30, 30, "rgba(255,210,63,ALPHA)", 0.18);
    k.put("story:tunnel:light", 140 + Math.sin(t * 2) * 4, 29);
    for (let x = 0; x < ART_W + 8; x += 8) {
      const off = (t * 40) % 8;
      const xx = x - off;
      const h = 10 + Math.round(6 * Math.sin((xx + t * 40) / 26));
      k.R(xx, 0, 8, h, "#9a2f30"); k.R(xx, h - 1, 8, 1, "#c84a4a");
      k.R(xx, ART_H - h, 8, h, "#9a2f30"); k.R(xx, ART_H - h, 8, 1, "#c84a4a");
    }
    for (let i = 0; i < 8; i++) { const y = 18 + mapHash(i, 7, 1) * 24, x = ((mapHash(i, 7, 2) * 200 - t * 120) % 200 + 200) % 200 - 20; k.R(x, y, 10, 1, "rgba(255,255,255,0.18)"); }
    k.snake(70, 28, 9, { speed: 9, wave: 2 });
    k.vignette(0.6);
  },
  furnace(k, t) {
    k.pic("story:furnace:sky");
    k.layer("story:furnace:1"); // the floor
    for (let i = 0; i < 12; i++) k.put("story:furnace:ember", i * 14 + 4, 52 + (i % 2), Math.sin(t * 4 + i) > 0 ? 0 : 1);
    [22, 60, 104, 140].forEach((x, i) => { k.flame(x, 50, 9 + (i % 2) * 5, i * 3); k.glow(x, 44, 14, "rgba(255,120,40,ALPHA)", 0.25); });
    const hum = 0.5 + 0.5 * Math.sin(t * 2.5);
    k.layer("story:furnace:2"); // the two purple pillars, humming
    [[8, 14], [146, 14]].forEach(([x, y]) => k.glow(x + 3, y + 15, 14, "rgba(160,100,255,ALPHA)", 0.15 + hum * 0.3));
    k.rise(24, "#ffb020", 10, 5);
    k.snake(84, 44, 6, { speed: 9 });
  },
  maze(k, t) {
    k.pic("story:maze:sky");
    k.layer("story:maze:1"); // the maze's walls
    const cx = 80, cy = 30, r = 12;
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2 + t * 0.6;
      k.R(cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r * 0.8 - 1, 3, 3, `hsl(${(i * 13 + t * 60) % 360},90%,70%)`);
    }
    k.glow(cx, cy, 22, "rgba(200,170,255,ALPHA)", 0.3);
    k.snake(36 + ((t * 8) % 20), 50, 5);
    k.vignette(0.6);
  },
  ouroboros(k, t) {
    k.pic("story:ouroboros:sky");
    k.stars(40, 4, "#fff6c4");
    const cx = 80, cy = 30, r = 18;
    k.glow(cx, cy, 34, "rgba(255,210,63,ALPHA)", 0.25 + Math.sin(t * 2) * 0.08);
    const n = 30, rot = t * 0.4;
    for (let i = n - 1; i >= 0; i--) {
      const a = rot + i / n * Math.PI * 1.85;
      const s = 4 - Math.floor(i / n * 2);
      k.R(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r * 0.8 - 2, s, s, i % 2 ? "#ffd23f" : "#e0a81a");
    }
    const ha = rot;
    k.R(cx + Math.cos(ha) * r - 3, cy + Math.sin(ha) * r * 0.8 - 3, 6, 6, "#ffe066");
    k.R(cx + Math.cos(ha) * r, cy + Math.sin(ha) * r * 0.8 - 2, 1, 1, "#111");
  }
};

/* A collectible, turning slowly under a spotlight: its picture (story:relic:<id>, its anchor on the
   middle of the spotlight), and what moves on it */
const RELIC_ART = {
  brick: k => k.layer("story:relic:brick"),
  pebble: k => k.layer("story:relic:pebble"),
  stick: k => k.layer("story:relic:stick"),
  shard: (k, t) => { k.layer("story:relic:shard"); if (Math.sin(t * 1.3) > 0.7) k.put("story:relic:shard-eye", -1, -2); },
  map: k => k.layer("story:relic:map"),
  ember: (k, t) => { k.layer("story:relic:ember"); k.flame(0, 6, 9, 1); },
  core: k => k.layer("story:relic:core"),
  scale: k => k.layer("story:relic:scale"),
  tip: (k, t) => { for (let i = 0; i < 9; i++) { const w = 6 - Math.floor(i / 2); k.R(-14 + i * 3, -w / 2 + Math.round(Math.sin(t * 4 + i) * 1), 3, w, skinColorAt(currentSkin(), i + 4, t * 1000)); } },
  blank: (k, t) => { k.layer("story:relic:blank"); k.glow(0, 0, 24, "rgba(255,255,220,ALPHA)", 0.35 + Math.sin(t * 2) * 0.15); }
};

function drawPageArt(c, id, t = performance.now() / 1000) {
  const g = c.getContext("2d");
  if (c.width !== ART_W) { c.width = ART_W; c.height = ART_H; }
  g.imageSmoothingEnabled = false;
  const k = artKit(g, t);
  const nightmare = id.startsWith("nm-");
  const relic = RELICS.find(r => r.id === id);
  if (relic) {
    k.pic("story:relic:sky");
    k.glow(80, 30, 40, "rgba(255,220,140,ALPHA)", 0.45);
    k.layer("story:relic:shadow");
    g.save();
    g.translate(80, 28 + Math.round(Math.sin(t * 1.6) * 2));
    (RELIC_ART[relic.id] || RELIC_ART.blank)(k, t);
    g.restore();
    for (let i = 0; i < 6; i++) {
      const a = t * 0.8 + i * Math.PI / 3, on = Math.sin(t * 3 + i * 2) > 0.3;
      if (on) k.put("story:relic:sparkle", 80 + Math.cos(a) * 30, 28 + Math.sin(a) * 14);
    }
    k.vignette(0.6);
    return;
  }
  const scene = nightmare ? ART_SCENE[id.slice(3)] : ART_SCENE[id];
  (ART_DRAW[scene] || ART_DRAW.garden)(k, t);
  if (nightmare) {
    // Night falls over the place (story:night, painted over it), and the coil opens one eye in the sky
    texPaint(g, "story:night", 0, 0);
    const blink = (t % 7);
    const open = blink > 0.3 && blink < 6.4 ? Math.min(1, (blink - 0.3) * 4, (6.4 - blink) * 4) : 0;
    k.glow(130, 13, 18, "rgba(255,80,140,ALPHA)", 0.25 * open);
    const h = Math.max(1, Math.round(6 * open));
    k.R(122, 13 - Math.floor(h / 2), 16, h, "#ffd23f");
    if (h > 2) k.R(128 + Math.round(Math.sin(t * 0.7) * 2), 13 - Math.floor(h / 2), 3, h, "#120814");
    k.stars(18, 9, "#d8c8ff");
  }
}

/* Keep every picture on screen moving, gently, and only while visible */
function artLoop(ts) {
  artRaf = 0;
  artCanvases.forEach(c => { if (!c.isConnected) artCanvases.delete(c); });
  if (!artCanvases.size) return;
  artRaf = requestAnimationFrame(artLoop);
  if (ts - artLast < 40) return;
  artLast = ts;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  artCanvases.forEach(c => {
    if (c.offsetParent === null) return;
    drawPageArt(c, c.dataset.page, still ? 2 : ts / 1000);
  });
}

function watchArt(c, id) {
  c.dataset.page = id;
  drawPageArt(c, id);
  artCanvases.add(c);
  if (!artRaf) artRaf = requestAnimationFrame(artLoop);
}
