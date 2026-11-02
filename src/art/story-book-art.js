/* =========================================================
   src/art/story-book-art.js
   Animated pixel dioramas for the story book
   ========================================================= */
"use strict";

/* =========================================================
   Story book pictures: small animated pixel dioramas.
   Each picture is 160 x 60 pixels, drawn fresh about 24 times a
   second while it is on screen, and stretched with chunky pixels.
   Your own snake, in your own skin, stars in most of them.
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
const artSkyCache = new Map();
let artRaf = 0;
let artLast = 0;

function artKit(g, t) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const mix = (a, b, k) => { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; };
  const kit = {
    R, mix,
    // A dithered vertical gradient: soft, but still made of pixels
    sky(top, bottom, steps = 6, y0 = 0, y1 = ART_H) {
      const key = [top, bottom, steps, y0, y1].join();
      let c = artSkyCache.get(key);
      if (!c) {
        c = document.createElement("canvas");
        c.width = ART_W;
        c.height = ART_H;
        const cg = c.getContext("2d");
        const cols = Array.from({ length: steps }, (_, i) => mix(top, bottom, i / (steps - 1)));
        for (let y = y0; y < y1; y++) {
          const f = ((y - y0) / (y1 - y0)) * (steps - 1);
          const lo = Math.floor(f), fr = f - lo;
          for (let x = 0; x < ART_W; x++) {
            cg.fillStyle = fr * 16 > BAYER[(y % 4) * 4 + (x % 4)] ? cols[Math.min(steps - 1, lo + 1)] : cols[lo];
            cg.fillRect(x, y, 1, 1);
          }
        }
        artSkyCache.set(key, c);
      }
      g.drawImage(c, 0, 0);
    },
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
    apple(x, y, big = false) {
      const s = big ? 8 : 4;
      R(x, y + 1, s, s - 1, "#d9202a");
      R(x + 1, y, s - 2, 1, "#d9202a");
      R(x + 1, y + 1, 1, 1, "#ff9a9a");
      R(x + s / 2, y - 1, 1, 2, "#5a3a1a");
      R(x + s / 2 + 1, y - 1, 2, 1, "#3ddc3d");
    },
    orb(x, y) {
      const p = 0.5 + 0.5 * Math.sin(t * 4 + x);
      R(x - 1, y - 1, 5, 5, `rgba(255,210,63,${0.15 + p * 0.25})`);
      R(x, y, 3, 3, "#ffd23f");
      R(x, y, 1, 1, "#fff6c4");
    },
    popsicle(x, y, c) {
      R(x, y, 4, 6, c); R(x, y, 1, 6, "rgba(255,255,255,0.45)"); R(x + 1, y + 6, 2, 3, "#d9b98a");
    },
    rock(x, y, s = 5) {
      R(x, y + 1, s + 1, s, "#4a4945"); R(x, y, s, s, "#9a9994"); R(x, y, s - 1, 1, "#c8c7c1"); R(x, y, 1, 1, "#e6e5df");
    },
    tortoise(x, y) {
      const bob = Math.round(Math.sin(t * 1.5) * 0.6);
      R(x - 7, y - 4, 14, 4, "#5f7f34"); R(x - 5, y - 6, 10, 2, "#6f9440"); R(x - 3, y - 7, 6, 1, "#7da84a");
      R(x - 4, y - 5, 2, 2, "#4a6a2a"); R(x + 1, y - 5, 2, 2, "#4a6a2a");
      R(x + 6, y - 4 + bob, 4, 3, "#8fb35a"); R(x + 8, y - 4 + bob, 1, 1, "#111");
      R(x - 6, y, 3, 2, "#4a6a2a"); R(x + 3, y, 3, 2, "#4a6a2a");
    },
    raccoon(x, y) {
      const bob = Math.round(Math.sin(t * 2) * 0.6);
      const blink = (t % 3.2) < 0.12;
      R(x - 5, y - 6 + bob, 10, 8, "#8a8a8a");
      R(x - 6, y - 8 + bob, 3, 3, "#6a6a6a"); R(x + 3, y - 8 + bob, 3, 3, "#6a6a6a");
      R(x - 4, y - 4 + bob, 8, 2, "#222");
      if (!blink) { R(x - 3, y - 4 + bob, 1, 1, "#fff"); R(x + 2, y - 4 + bob, 1, 1, "#fff"); }
      R(x - 1, y - 1 + bob, 2, 1, "#111");
      R(x - 2, y - 11 + bob, 4, 3, "#1a1a1a"); R(x - 3, y - 9 + bob, 6, 1, "#1a1a1a"); R(x - 2, y - 10 + bob, 4, 1, "#b23a3a");
      // the striped tail, peeking out
      for (let i = 0; i < 4; i++) R(x + 5 + i * 2, y + 1 - Math.round(Math.sin(t * 3 + i) * 1), 2, 2, i % 2 ? "#3a3a3a" : "#9a9a9a");
    },
    beetle(x, y) {
      const step = Math.round(Math.sin(t * 6));
      R(x - 3, y - 3, 6, 4, "#2b5a3a"); R(x - 3, y - 3, 6, 1, "#4f9a6a"); R(x, y - 3, 1, 4, "#1a3a24");
      R(x + 3, y - 2, 2, 2, "#1a1a1a"); R(x - 3, y + 1, 1, 1 + step, "#111"); R(x + 2, y + 1, 1, 1 - step + 1, "#111");
    },
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

const ART_DRAW = {
  garden(k, t) {
    k.sky("#7cc6f2", "#dff4ff");
    k.glow(132, 10, 26, "rgba(255,240,170,ALPHA)", 0.5 + Math.sin(t) * 0.1);
    k.R(128, 6, 8, 8, "#fff3b0"); k.R(129, 5, 6, 10, "#fff3b0"); k.R(127, 7, 10, 6, "#fff3b0");
    for (let i = 0; i < 3; i++) { const cx = ((i * 70 + t * 3) % 220) - 30; k.R(cx, 8 + i * 5, 18, 3, "#ffffff"); k.R(cx + 4, 6 + i * 5, 9, 2, "#ffffff"); }
    k.hills("#9fd38a", 40, 5, 0.05, 1.5, 2);
    k.hills("#6db55a", 46, 4, 0.08, 3, 5);
    k.R(0, 48, ART_W, 12, "#4f9a3a");
    for (let x = 0; x < ART_W; x += 3) k.R(x + Math.round(Math.sin(t * 2 + x) * 0.6), 47 - (x % 2), 1, 2, "#5ab046");
    [[12, "#ff6b6b"], [30, "#ffe066"], [96, "#ffffff"], [148, "#ff9ad5"], [72, "#ff6b6b"]].forEach(([x, c]) => k.R(x, 50 + (x % 5), 1, 1, c));
    // the apple tree
    const sway = Math.round(Math.sin(t * 1.2));
    k.R(16, 30, 3, 18, "#6a4426");
    k.R(6 + sway, 18, 22, 12, "#2f7d2a"); k.R(9 + sway, 15, 16, 4, "#3a9032"); k.R(8 + sway, 22, 4, 2, "#3a9032");
    k.apple(12 + sway, 22); k.apple(21 + sway, 25);
    k.snake(92 + Math.round(Math.sin(t * 0.6) * 6), 50, 7, { tongue: true });
    k.apple(124, 51);
    for (let i = 0; i < 2; i++) { const bx = 60 + Math.sin(t * 0.7 + i * 2) * 30, by = 30 + Math.sin(t * 1.3 + i) * 6; const f = Math.sin(t * 14 + i) > 0; k.R(bx, by, 1, 1, "#ffffff"); k.R(bx - 1, by - (f ? 1 : 0), 1, 1, i ? "#ffd23f" : "#ff9ad5"); k.R(bx + 1, by - (f ? 1 : 0), 1, 1, i ? "#ffd23f" : "#ff9ad5"); }
  },
  dawn(k, t) {
    k.sky("#f7a07a", "#ffe3b8");
    const rise = Math.min(1, (t % 12) / 6);
    k.glow(80, 44, 40, "rgba(255,200,120,ALPHA)", 0.6);
    k.R(70, 44 - rise * 6, 20, 8, "#ffd27a"); k.R(72, 42 - rise * 6, 16, 2, "#ffd27a");
    k.hills("#b07aa0", 44, 4, 0.06, 1, 3);
    k.R(0, 48, ART_W, 12, "#4f9a3a");
    // curled up, asleep
    const skin = currentSkin();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.R(80 + Math.cos(a) * 7, 50 + Math.sin(a) * 3, 4, 3, skinColorAt(skin, i, 0)); }
    for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3) % 1; g_text(k, "z", 92 + ph * 10, 44 - ph * 16, `rgba(80,60,90,${1 - ph})`); }
  },
  tutorial(k, t) {
    k.sky("#bfe6c4", "#eef9e6");
    k.R(0, 48, ART_W, 12, "#5aab45");
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    k.R(6, 10, 4, 38, "#8f4dff"); k.glow(8, 30, 12, "rgba(143,77,255,ALPHA)", 0.3 * pulse);
    k.R(150, 10, 4, 38, "#ff3b3b");
    k.rock(70, 43);
    const x = 20 + ((t * 14) % 100);
    k.snake(x, 44, 5);
    k.apple(118, 44);
    k.orb(100, 30); k.orb(40, 24);
  },
  shop(k, t) {
    k.sky("#4a2a18", "#7a4a2a");
    for (let y = 4; y < 44; y += 6) k.R(0, y, ART_W, 1, "rgba(0,0,0,0.25)");
    for (let i = 0; i < 9; i++) k.R(i * 18, 0, 18, 6, i % 2 ? "#f4efe2" : "#d0262e");
    for (let i = 0; i < 9; i++) k.R(i * 18 + 6, 6, 6, 2, i % 2 ? "#f4efe2" : "#d0262e");
    // shelves of jars full of XP
    [16, 30].forEach((y, r) => { k.R(8, y + 6, 44, 2, "#3a2210"); k.R(108, y + 6, 44, 2, "#3a2210");
      for (let i = 0; i < 4; i++) { [12 + i * 10, 112 + i * 10].forEach(x => { k.R(x, y, 6, 6, "rgba(200,230,255,0.35)"); k.R(x + 1, y + 2, 4, 4, i % 2 ? "#ffd23f" : "#3ddc3d"); if (Math.sin(t * 2 + i + r * 3 + x) > 0.92) k.R(x + 1, y + 1, 1, 1, "#ffffff"); }); } });
    // the swinging lamp
    const sw = Math.sin(t * 1.4) * 4;
    k.R(80 + sw * 0.5, 8, 1, 8, "#222"); k.R(77 + sw, 16, 7, 3, "#2a2a2a");
    k.glow(80 + sw, 22, 34, "rgba(255,220,140,ALPHA)", 0.38);
    k.R(30, 44, 100, 16, "#5a3418"); k.R(30, 44, 100, 2, "#8a5526");
    k.raccoon(80, 42);
    k.orb(100, 40); k.apple(56, 40);
    k.vignette(0.5);
  },
  satchel(k, t) {
    k.sky("#6a4a2a", "#8a6238");
    for (let x = 0; x < ART_W; x += 20) k.R(x, 0, 1, ART_H, "rgba(0,0,0,0.18)");
    const lift = Math.max(0, Math.sin(t * 0.9)) * 3;
    k.R(56, 26, 48, 26, "#8a5526"); k.R(56, 26, 48, 2, "#a8703a"); k.R(56, 50, 48, 2, "#5a3410");
    k.apple(66, 22 - lift); k.orb(84, 20 - lift); k.R(95, 18 - lift, 2, 8, "#d9b98a");
    k.R(54, 22 - lift, 52, 8, "#7a4820"); k.R(78, 28 - lift, 4, 5, "#d4a73a");
    for (let i = 0; i < 3; i++) k.R(60 + i * 2, 8 + i, 1, 18 - lift, "#5a3410");
    k.fall(10, "rgba(255,240,200,0.6)", 3, 4, 6);
    k.vignette(0.55);
  },
  badges(k, t) {
    k.sky("#2e2a20", "#4a3f2c");
    k.R(10, 6, 140, 34, "#5a4a32"); k.R(10, 6, 140, 1, "#7a6544");
    const cols = ["#cd7f32", "#c9ced6", "#ffd23f", "#6ee7d8", "#8ab4ff", "#ff77c8"];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) {
      const x = 16 + i * 11, y = 10 + r * 10, c = cols[(i + r * 2) % cols.length];
      k.R(x, y, 6, 6, c); k.R(x, y, 6, 1, "rgba(255,255,255,0.4)");
      if (((t * 6) % 36 | 0) === i + r * 12) k.R(x + 1, y + 1, 2, 2, "#ffffff");
    }
    const fl = 0.8 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7) * 0.1;
    k.R(4, 20, 3, 10, "#3a2a1a"); k.flame(5, 20, 6, 1); k.glow(5, 16, 30, "rgba(255,170,80,ALPHA)", 0.3 * fl);
    k.R(0, 48, ART_W, 12, "#2a2418");
    k.tortoise(60 + Math.sin(t * 0.3) * 30, 48);
    k.vignette(0.55);
  },
  ledger(k, t) {
    k.sky("#140e0a", "#2a1c12");
    const fl = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 5.3) * 0.07;
    k.glow(124, 26, 48, "rgba(255,190,110,ALPHA)", 0.45 * fl);
    k.R(122, 30, 4, 12, "#efe4c8"); k.flame(124, 30, 6, 2);
    k.R(26, 30, 90, 26, "#efe2c0"); k.R(70, 30, 2, 26, "#c9b48a");
    const lines = Math.floor((t * 2) % 16);
    for (let i = 0; i < 6; i++) {
      const full = i * 2 < lines;
      k.R(32, 34 + i * 3, full ? 32 : 10, 1, "#7a6a4a");
      k.R(76, 34 + i * 3, i * 2 + 1 < lines ? 32 : 6, 1, "#7a6a4a");
    }
    const qx = 76 + ((lines % 2) * 16) + Math.sin(t * 8) * 2, qy = 34 + Math.floor(lines / 2) * 3;
    k.beetle(qx - 4, qy + 4);
    k.R(qx, qy - 8, 1, 8, "#e8e8e8"); k.R(qx + 1, qy - 9, 2, 4, "#ffffff");
    k.vignette(0.6);
  },
  curtain(k, t) {
    k.sky("#140a14", "#2a1424");
    // the machinery of the world
    for (let i = 0; i < 4; i++) {
      const cx = 46 + i * 22, cy = 22;
      k.R(cx - 5, cy - 5, 11, 11, "#3a3a44"); k.R(cx - 4, cy - 4, 9, 9, "#d8d0b8");
      const a = t * (0.6 + i * 0.4) + i;
      k.R(cx + Math.round(Math.cos(a) * 3), cy + Math.round(Math.sin(a) * 3), 1, 1, "#b23a3a"); k.R(cx, cy, 1, 1, "#222");
      k.R(cx - 3, 36, 6, 4, Math.sin(t * 3 + i * 2) > 0 ? "#3ddc3d" : "#2a4a2a");
    }
    k.R(118, 26, 3, 16, "#888"); k.R(116 + Math.round(Math.sin(t) * 2), 22, 7, 5, "#ffd23f");
    k.R(0, 48, ART_W, 12, "#1a0e12");
    k.snake(84, 46, 4, { dir: -1, wave: 0.5 });
    // velvet curtains, breathing a little
    for (let side = 0; side < 2; side++) for (let i = 0; i < 6; i++) {
      const w = 34 + Math.round(Math.sin(t * 0.8 + i * 0.5) * 3);
      const x = side ? ART_W - w + i * 2 : i * 2 - 12;
      k.R(x + (side ? 0 : 0), 0, w - i * 4, ART_H, i % 2 ? "#7a1424" : "#961a2c");
    }
    k.R(0, 0, ART_W, 4, "#5a0e1a");
    k.vignette(0.4);
  },
  classic(k, t) {
    k.sky("#a9b9cc", "#dfe6ee");
    for (let i = 0; i < 2; i++) { const bx = (t * 9 + i * 80) % 200 - 20, by = 10 + i * 4; const f = Math.sin(t * 10 + i) > 0 ? 1 : 0; k.R(bx, by + f, 2, 1, "#333"); k.R(bx + 2, by, 1, 1, "#333"); k.R(bx + 3, by + f, 2, 1, "#333"); }
    k.R(0, 46, ART_W, 14, "#8a6a48");
    for (let y = 20; y < 46; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < ART_W; x += 8) { k.R(x, y, 7, 3, (x + y) % 3 ? "#b23a3a" : "#9a2f30"); }
    k.R(0, 20, ART_W, 1, "#7a2424");
    // the carved brick, glowing faintly
    const p = 0.5 + 0.5 * Math.sin(t * 2);
    k.glow(118, 33, 10, "rgba(255,220,120,ALPHA)", 0.25 + p * 0.3);
    k.R(114, 32, 7, 3, "#c86a4a");
    k.snake(70 + Math.round(Math.sin(t * 0.5) * 12), 50, 8);
  },
  quarry(k, t) {
    k.sky("#e8cfa0", "#f6e8c8");
    k.hills("#c9a978", 30, 6, 0.04, 1, 4);
    for (let y = 34; y < 48; y += 3) k.R(0, y, ART_W, 1, "rgba(120,90,50,0.25)");
    k.hills("#a68a60", 40, 3, 0.09, 2, 9);
    k.R(0, 48, ART_W, 12, "#b89a6a");
    k.rock(20, 40, 8); k.rock(132, 42, 6); k.rock(96, 44, 4); k.rock(40, 44, 3);
    k.R(104, 36, 14, 10, "#8a8984"); k.R(104, 36, 14, 1, "#b8b7b1");
    k.tortoise(110, 36);
    const hue = (t * 80) % 360;
    if (Math.sin(t * 1.7) > -0.2) { k.R(66, 34, 3, 3, `hsl(${hue},100%,75%)`); k.glow(67, 35, 8, `hsla(${hue},100%,70%,ALPHA)`, 0.4); }
    k.snake(56, 50, 5);
    k.rise(10, "rgba(200,170,120,0.8)", 4, 3);
  },
  parlor(k, t) {
    k.sky("#ffd6ea", "#d8ecff");
    for (let x = 0; x < ART_W; x += 8) for (let y = 48; y < ART_H; y += 4) k.R(x + ((y / 4) % 2) * 4, y, 4, 4, "#f4f4ff");
    k.R(0, 48, ART_W, 1, "#c9b8d8");
    k.R(20, 22, 120, 22, "#e8f6ff"); k.R(20, 22, 120, 2, "#ffffff"); k.R(20, 42, 120, 2, "#a8c8e0");
    ["#4fd6ff", "#ff6fb0", "#b36bff", "#ffd23f", "#6ee7a8", "#ff8a3d", "#4fd6ff"].forEach((c, i) => k.popsicle(28 + i * 16, 28 + Math.round(Math.sin(t * 2 + i) * 1.4), c));
    for (let i = 0; i < 5; i++) if (Math.sin(t * 3 + i * 1.9) > 0.8) { const x = 24 + i * 24, y = 24 + (i % 2) * 8; k.R(x - 1, y, 3, 1, "#fff"); k.R(x, y - 1, 1, 3, "#fff"); }
    const hue = (t * 60) % 360;
    if (Math.sin(t * 0.8) > 0.2) { k.R(80, 12 + Math.sin(t * 2) * 2, 3, 3, `hsl(${hue},100%,75%)`); k.glow(81, 13, 9, `hsla(${hue},100%,70%,ALPHA)`, 0.4); }
    k.snake(96, 51, 6, { dir: -1 });
  },
  storm(k, t) {
    const flash = (t % 5) < 0.12 || ((t % 5) > 0.22 && (t % 5) < 0.3);
    k.sky(flash ? "#c8d4ea" : "#3c4a66", flash ? "#e8eef8" : "#6a7a96");
    for (let i = 0; i < 4; i++) { const cx = ((i * 50 - t * 6) % 200 + 200) % 200 - 30; k.R(cx, 4 + (i % 2) * 3, 34, 6, "#4a5672"); k.R(cx + 6, 2 + (i % 2) * 3, 20, 3, "#56627e"); }
    if (flash) { let x = 110; for (let y = 6; y < 40; y += 3) { x += Math.round(Math.sin(y * 7) * 2); k.R(x, y, 1, 3, "#ffffff"); } }
    k.R(0, 48, ART_W, 12, "#3f7f35");
    for (let i = 0; i < 6; i++) { const x = 8 + i * 28; k.R(x + 4, 38, 2, 10, "#5a3a22"); k.R(x, 32 + Math.round(Math.sin(t * 2 + i)), 10, 7, "#2b6a26"); }
    for (let i = 0; i < 14; i++) {
      const ph = (t * 0.5 * (0.7 + mapHash(i, 2, 3) * 0.6) + mapHash(i, 2, 5)) % 1;
      k.apple(mapHash(i, 2, 7) * 150 + Math.sin(t + i) * 3, -6 + ph * 56);
    }
    k.fall(30, "rgba(200,220,255,0.35)", 60, 9, 0, 1);
    k.snake(78, 52, 7, { speed: 8 });
  },
  mirror(k, t) {
    k.sky("#1e1436", "#2c2048");
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 31;
      k.R(x, 6, 24, 40, "#b8a8ff"); k.R(x + 1, 7, 22, 38, "#3a2c66");
      k.R(x + 3, 9, 2, 30, "rgba(255,255,255,0.18)");
    }
    // in the middle mirror, something enormous winks
    const open = ((t % 6) > 0.25 && (t % 6) < 5.6) ? 1 : 0;
    k.glow(80, 24, 14, "rgba(255,210,63,ALPHA)", 0.25);
    k.R(72, 21, 16, 7 * open || 1, "#ffd23f"); if (open) k.R(78, 21, 4, 7, "#141010");
    k.R(0, 46, ART_W, 14, "#2a1f48");
    k.snake(46, 48, 5);
    k.snake(114, 48, 5, { dir: -1 });
    for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i * 0.7) % 2; const hop = ph < 1 ? Math.sin(ph * Math.PI) * 8 : 0; k.R(30 + i * 45 + ph * 6, 44 - hop, 2, 2, "#7a4a26"); }
  },
  vault(k, t) {
    k.sky("#2a2014", "#4a3820");
    k.glow(40, 26, 30, "rgba(255,200,80,ALPHA)", 0.25);
    // the round vault door, its wheel turning slowly
    for (let y = -19; y <= 19; y++) for (let x = -19; x <= 19; x++) {
      const d = Math.hypot(x, y);
      if (d <= 19) k.R(40 + x, 26 + y, 1, 1, d > 17 ? "#5a4018" : d > 15 ? "#a07a30" : (x + y) % 7 === 0 ? "#b8913c" : "#c9a04a");
    }
    for (let i = 0; i < 8; i++) { const a = Math.PI * 2 * i / 8; k.R(40 + Math.round(Math.cos(a) * 16.5), 26 + Math.round(Math.sin(a) * 16.5), 1, 1, "#ffe98a"); }
    const a = t * 0.7;
    for (let i = 0; i < 3; i++) { const ang = a + i * Math.PI / 3; for (let r = -10; r <= 10; r++) k.R(40 + Math.round(Math.cos(ang) * r), 26 + Math.round(Math.sin(ang) * r), 2, 2, "#6a4c1e"); }
    for (let i = 0; i < 6; i++) { const ang = a + i * Math.PI / 3; k.R(39 + Math.round(Math.cos(ang) * 10), 25 + Math.round(Math.sin(ang) * 10), 3, 3, "#ffd23f"); }
    k.R(37, 23, 6, 6, "#6a4c1e"); k.R(38, 24, 4, 4, "#ffe98a");
    k.R(0, 46, ART_W, 14, "#5a4422");
    for (let i = 0; i < 18; i++) { const x = 70 + mapHash(i, 4, 1) * 86, y = 46 + mapHash(i, 4, 2) * 10; k.R(x, y, 2, 1, Math.sin(t * 3 + i) > 0.85 ? "#ffffff" : "#ffd23f"); }
    k.apple(110, 34, true);
    const p = 0.5 + 0.5 * Math.sin(t * 3);
    k.glow(140, 48, 8, "rgba(255,230,120,ALPHA)", 0.3 + p * 0.4); k.R(138, 47, 4, 3, "#ffd23f");
    k.snake(84, 50, 6, { size: 3 });
    k.vignette(0.5);
  },
  tunnel(k, t) {
    k.sky("#0e0c0c", "#1c1414");
    k.glow(150, 30, 30, "rgba(255,210,63,ALPHA)", 0.18);
    k.R(140 + Math.sin(t * 2) * 4, 29, 10, 2, "#ffd23f");
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
    k.sky("#200806", "#4a120a");
    k.R(0, 50, ART_W, 10, "#5a1a12");
    for (let i = 0; i < 12; i++) k.R(i * 14 + 4, 52 + (i % 2), 6, 1, Math.sin(t * 4 + i) > 0 ? "#ff6a1a" : "#a8320e");
    [22, 60, 104, 140].forEach((x, i) => { k.flame(x, 50, 9 + (i % 2) * 5, i * 3); k.glow(x, 44, 14, "rgba(255,120,40,ALPHA)", 0.25); });
    const hum = 0.5 + 0.5 * Math.sin(t * 2.5);
    [[8, 14], [146, 14]].forEach(([x, y]) => { k.R(x, y, 6, 30, "#8f4dff"); k.R(x + 1, y + 1, 4, 28, "#6a2fd0"); k.glow(x + 3, y + 15, 14, "rgba(160,100,255,ALPHA)", 0.15 + hum * 0.3); });
    k.rise(24, "#ffb020", 10, 5);
    k.snake(84, 44, 6, { speed: 9 });
  },
  maze(k, t) {
    k.sky("#140e24", "#1c1530");
    for (let y = 2; y < ART_H; y += 8) for (let x = 2; x < ART_W; x += 8) {
      if (mapHash(x, y, 3) < 0.55) k.R(x, y, 8, 2, "#4a3a78");
      if (mapHash(x, y, 9) < 0.45) k.R(x, y, 2, 8, "#4a3a78");
    }
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
    k.sky("#0a0618", "#20103a");
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

/* Small pixel letters for the sleeping z's */
function g_text(k, ch, x, y, color) {
  if (ch === "z") { k.R(x, y, 3, 1, color); k.R(x + 1, y + 1, 1, 1, color); k.R(x, y + 2, 3, 1, color); }
}

/* A collectible, turning slowly under a spotlight */
const RELIC_ART = {
  brick: (k, t) => { k.R(-12, -6, 24, 12, "#b8623a"); k.R(-12, -6, 24, 2, "#d07a4a"); k.R(-12, 4, 24, 2, "#8a4428"); k.R(10, -6, 2, 3, "#5a2a10");
    for (let i = 0; i < 10; i++) { const a = 0.4 + i / 10 * 5.5; k.R(Math.round(Math.cos(a) * 4) - 1, Math.round(Math.sin(a) * 3), 1, 1, "#5a2a10"); } },
  pebble: (k) => { k.R(-9, -5, 18, 10, "#8a8a8a"); k.R(-10, -3, 20, 6, "#8a8a8a"); k.R(-6, -4, 6, 2, "#c8c8c8"); },
  stick: (k) => { k.R(-3, -14, 6, 26, "#d9b27c"); k.R(-3, -14, 1, 26, "#efd3a2"); k.R(-1, -8, 2, 1, "#7a5a30"); k.R(-1, -5, 2, 1, "#7a5a30"); for (let i = 0; i < 6; i++) k.R(-2 + (i % 3), 2 + Math.floor(i / 3), 1, 1, "#9a6a30"); },
  shard: (k, t) => { for (let j = 0; j < 22; j++) { const w = Math.round(10 - Math.abs(j - 9) * 0.9); k.R(-w / 2 + (j - 11) * 0.3, j - 11, Math.max(1, w), 1, j < 6 ? "#e9feff" : "#b9a6ff"); }
    if (Math.sin(t * 1.3) > 0.7) { k.R(-1, -2, 4, 2, "#ffd23f"); k.R(0, -2, 2, 2, "#111"); } },
  map: (k) => { k.R(-16, -10, 32, 20, "#e8d39a"); k.R(-16, -10, 32, 1, "#f6e6b8"); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; k.R(Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 5), 1, 1, "#8a3a2a"); } k.R(8, -2, 2, 2, "#b23a3a"); },
  ember: (k, t) => { k.R(-8, -12, 16, 24, "rgba(200,230,255,0.25)"); k.R(-8, -12, 16, 1, "#cfe8ff"); k.R(-8, -12, 1, 24, "#cfe8ff"); k.R(7, -12, 1, 24, "#cfe8ff"); k.R(-8, 11, 16, 1, "#cfe8ff"); k.R(-6, -14, 12, 2, "#8a6a4a"); k.flame(0, 6, 9, 1); },
  core: (k) => { k.R(-3, -10, 6, 20, "#f4e3b0"); k.R(-6, -12, 12, 4, "#d1202a"); k.R(-6, 8, 12, 4, "#d1202a"); k.R(-1, -16, 2, 4, "#5a3a1a"); k.R(-2, -2, 1, 2, "#3a2a1a"); k.R(1, 1, 1, 2, "#3a2a1a"); },
  scale: (k, t) => { for (let j = 0; j < 20; j++) { const w = Math.round(12 - Math.abs(j - 10) * 1.1); k.R(-w / 2, j - 10, w, 1, j < 5 ? "#fff1a8" : "#ffd23f"); } k.R(-1, -10, 1, 20, "rgba(184,134,11,0.6)"); },
  tip: (k, t) => { for (let i = 0; i < 9; i++) { const w = 6 - Math.floor(i / 2); k.R(-14 + i * 3, -w / 2 + Math.round(Math.sin(t * 4 + i) * 1), 3, w, skinColorAt(currentSkin(), i + 4, t * 1000)); } },
  blank: (k, t) => { k.R(-10, -14, 20, 28, "#ffffff"); k.R(-10, -14, 20, 1, "#f2f2f2"); k.R(9, -14, 1, 28, "#d9d0bb"); k.glow(0, 0, 24, "rgba(255,255,220,ALPHA)", 0.35 + Math.sin(t * 2) * 0.15); }
};

function drawPageArt(c, id, t = performance.now() / 1000) {
  const g = c.getContext("2d");
  if (c.width !== ART_W) { c.width = ART_W; c.height = ART_H; }
  g.imageSmoothingEnabled = false;
  const k = artKit(g, t);
  const nightmare = id.startsWith("nm-");
  const relic = RELICS.find(r => r.id === id);
  if (relic) {
    k.sky("#1a1208", "#3a2a14");
    k.glow(80, 30, 40, "rgba(255,220,140,ALPHA)", 0.45);
    k.R(54, 50, 52, 4, "rgba(0,0,0,0.35)");
    g.save();
    g.translate(80, 28 + Math.round(Math.sin(t * 1.6) * 2));
    (RELIC_ART[relic.id] || RELIC_ART.blank)(k, t);
    g.restore();
    for (let i = 0; i < 6; i++) {
      const a = t * 0.8 + i * Math.PI / 3, on = Math.sin(t * 3 + i * 2) > 0.3;
      if (on) { const x = 80 + Math.cos(a) * 30, y = 28 + Math.sin(a) * 14; k.R(x - 1, y, 3, 1, "#fff6c4"); k.R(x, y - 1, 1, 3, "#fff6c4"); }
    }
    k.vignette(0.6);
    return;
  }
  const scene = nightmare ? ART_SCENE[id.slice(3)] : ART_SCENE[id];
  (ART_DRAW[scene] || ART_DRAW.garden)(k, t);
  if (nightmare) {
    // Night falls over the place, and the coil opens one eye in the sky
    g.fillStyle = "rgba(24, 6, 48, 0.58)";
    g.fillRect(0, 0, ART_W, ART_H);
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
