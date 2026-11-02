/* =========================================================
   src/art/island-art-46.js
   Story book pictures for the twelve islands added in build 46,
   drawn with the same kit as src/art/story-book-art.js
   ========================================================= */
"use strict";

Object.assign(ART_SCENE, {
  sunflower: "sunflower", bramble: "bramble", hive: "hive", thunder: "thunder", frost: "frost", hunt: "hunt",
  keg: "keg", moor: "moor", clockwork: "clockwork", chrono: "chrono", gale: "gale", maw: "maw"
});

Object.assign(ART_DRAW, {
  sunflower(k, t) {
    k.sky("#5fb8f2", "#fff2c4");
    k.glow(130, 12, 30, "rgba(255,230,140,ALPHA)", 0.6);
    k.R(126, 8, 9, 9, "#ffe066");
    k.hills("#b8d860", 42, 4, 0.06, 2, 3);
    k.R(0, 48, ART_W, 12, "#8ab82a");
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 18, sway = Math.round(Math.sin(t * 1.4 + i) * 1), h = 14 + (i % 3) * 4;
      k.R(x + 2, 48 - h, 1, h, "#3a7a2a");
      k.R(x - 1 + sway, 44 - h, 7, 6, "#ffcf33"); k.R(x + 1 + sway, 46 - h, 3, 2, "#7a4a18");
    }
    k.snake(72 + Math.round(Math.sin(t * 0.7) * 8), 52, 7, { tongue: true });
    const gx = 112, gy = 50 + Math.round(Math.sin(t * 3));
    k.glow(gx + 2, gy + 2, 7, "rgba(255,210,63,ALPHA)", 0.6);
    k.R(gx, gy, 5, 5, "#ffd23f"); k.R(gx + 1, gy, 1, 1, "#fff6c4");
  },
  bramble(k, t) {
    k.sky("#4a6a5a", "#9ab89a");
    k.hills("#2d4a22", 30, 6, 0.07, 1, 4);
    k.R(0, 46, ART_W, 14, "#2d5a1e");
    for (let i = 0; i < 14; i++) {
      const x = (i * 23 + 7) % ART_W, y = 34 + (i % 4) * 4;
      k.R(x, y, 8, 6, "#3f7a2a"); k.R(x + 1, y - 2, 5, 3, "#4f8f33");
      k.R(x - 1, y + 2, 1, 1, "#e8e0c8"); k.R(x + 8, y + 1, 1, 1, "#e8e0c8"); k.R(x + 3, y - 3, 1, 1, "#e8e0c8");
      if (i % 3 === 0) k.R(x + 5, y + 1, 1, 1, "#c0282e");
    }
    k.snake(60 + Math.round(Math.sin(t * 0.8) * 10), 52, 6);
    // the shears, glinting
    const gl = Math.sin(t * 3) > 0.7;
    k.R(118, 50, 8, 1, gl ? "#ffffff" : "#d8dde6"); k.R(118, 53, 8, 1, gl ? "#ffffff" : "#d8dde6"); k.R(114, 50, 4, 4, "#ff5a61");
  },
  hive(k, t) {
    k.sky("#f2c46a", "#fff2c4");
    k.R(0, 46, ART_W, 14, "#c89a30");
    // the hive itself, hanging from a branch
    k.R(20, 4, 60, 3, "#6a4426");
    for (let j = 0; j < 7; j++) { const w = 22 - Math.abs(j - 3) * 3; k.R(40 - w / 2, 8 + j * 4, w, 4, j % 2 ? "#e0a820" : "#c08a10"); }
    k.R(38, 30, 4, 3, "#3a2a10");
    for (let i = 0; i < 7; i++) {
      const a = t * (1.5 + i * 0.2) + i * 1.3;
      const x = 40 + Math.cos(a) * (18 + i * 6), y = 22 + Math.sin(a * 1.3) * 10;
      k.R(x, y, 2, 2, "#ffcf33"); k.R(x, y + 1, 2, 1, "#1a1410"); if (Math.sin(t * 30 + i) > 0) k.R(x, y - 1, 2, 1, "rgba(255,255,255,0.8)");
    }
    k.snake(108 + Math.round(Math.sin(t * 0.7) * 6), 52, 7);
    k.R(140, 46, 8, 9, "#c9ced6"); k.R(140, 46, 8, 1, "#ffffff"); k.R(141, 55, 6, 1, "#5b6470");
  },
  thunder(k, t) {
    k.sky("#2a3440", "#6a7a8a");
    for (let i = 0; i < 4; i++) { const cx = ((i * 50 + t * 6) % 220) - 30; k.R(cx, 6 + i * 3, 30, 5, "#4a5a6a"); k.R(cx + 6, 3 + i * 3, 16, 3, "#5a6a7a"); }
    k.hills("#3a4048", 34, 10, 0.05, 1, 6);
    k.R(0, 48, ART_W, 12, "#4a5260");
    const flash = (t % 3.1) < 0.12;
    if (flash) {
      k.R(0, 0, ART_W, ART_H, "rgba(255,255,255,0.35)");
      let x = 100; for (let y = 0; y < 48; y += 4) { k.R(x, y, 2, 4, "#fff7a0"); x += (y % 8 ? -2 : 3); }
    } else if ((t % 3.1) > 2.5) {
      k.R(98, 46, 8, 2, Math.floor(t * 10) % 2 ? "#fff7a0" : "#9ad8ff");
    }
    k.fall(30, "rgba(160,200,240,0.6)", 60, 3, 4);
    k.snake(50 + Math.round(Math.sin(t * 0.8) * 6), 52, 7);
    k.glow(140, 50, 8, "rgba(127,227,255,ALPHA)", 0.5);
    k.R(136, 47, 8, 7, "rgba(127,227,255,0.5)");
  },
  frost(k, t) {
    k.sky("#9ac8e8", "#f0f8ff");
    k.hills("#e8f4ff", 32, 8, 0.04, 1, 7);
    k.R(0, 44, ART_W, 16, "#c8dcf0");
    for (let x = 10; x < ART_W; x += 34) { k.R(x, 46, 24, 8, "rgba(190,232,255,0.8)"); k.R(x + 3, 48, 10, 1, "#ffffff"); }
    k.fall(36, "#ffffff", 14, 5, 6);
    // the snake slides, stiff and straight, across the ice
    const slide = ((t * 20) % 200) - 20;
    k.snake(slide, 50, 7, { wave: 0 });
    // the hourglass, its sand stopped
    k.R(130, 36, 8, 1, "#8a5a30"); k.R(130, 46, 8, 1, "#8a5a30"); k.R(131, 37, 6, 4, "rgba(220,240,255,0.9)"); k.R(133, 41, 2, 1, "#ffcf33"); k.R(131, 42, 6, 4, "rgba(220,240,255,0.9)"); k.R(132, 44, 4, 2, "#ffcf33");
  },
  hunt(k, t) {
    k.sky("#c8a870", "#f0dca0");
    k.hills("#7a8a4a", 36, 6, 0.06, 2, 4);
    k.R(0, 46, ART_W, 14, "#6a8a3a");
    for (let x = 0; x < ART_W; x += 2) k.R(x, 42 - (x % 5), 1, 5 + (x % 5), "#8aa050");
    k.snake(56 + Math.round(Math.sin(t * 1.1) * 4), 52, 7);
    // the Hunter, dark, closing in from the right
    const hx = 128 - Math.round((t * 4) % 20);
    for (let i = 0; i < 7; i++) k.R(hx + i * 3, 52 + Math.round(Math.sin(t * 5 - i * 0.8) * 1.2), 4, 4, i === 0 ? "#2a0a12" : i % 2 ? "#7a1424" : "#5a0e1a");
    k.R(hx, 53, 1, 1, "#ffd23f"); k.R(hx + 2, 53, 1, 1, "#ffd23f");
    k.apple(100, 51);
  },
  keg(k, t) {
    k.sky("#5a3a2a", "#c8885a");
    k.R(0, 46, ART_W, 14, "#5a4028");
    for (let i = 0; i < 3; i++) {
      const x = 14 + i * 24;
      k.R(x, 30, 16, 16, "#7a5232"); k.R(x, 33, 16, 2, "#3a2a1a"); k.R(x, 41, 16, 2, "#3a2a1a"); k.R(x + 6, 30, 4, 1, "#2a1a10");
    }
    // a bomb, ticking down, and the blast it becomes
    const ph = t % 4;
    if (ph < 3.2) {
      k.R(112, 46, 9, 8, "#2a2a30"); k.R(115, 43, 2, 3, "#8a6a3a");
      if (Math.floor(t * 8) % 2) k.R(114, 41, 3, 2, "#ffd23f");
    } else {
      k.glow(116, 50, 22 * (ph - 3.2) / 0.8 + 4, "rgba(255,160,40,ALPHA)", 0.8);
    }
    k.snake(80 + Math.round(Math.sin(t * 0.9) * 4), 52, 6);
    const hue = (t * 120) % 360;
    k.R(146, 38, 5, 5, `hsl(${hue},95%,65%)`);
  },
  moor(k, t) {
    k.sky("#2a2a38", "#6a7a7a");
    k.stars(12, 4, "#c8d0ff");
    k.hills("#3a4a3a", 38, 4, 0.05, 2, 3);
    k.R(0, 46, ART_W, 14, "#2a3a2a");
    // the old church
    k.R(118, 24, 22, 22, "#4a4a52"); k.R(126, 14, 6, 10, "#4a4a52"); k.R(128, 10, 2, 4, "#5a5a62"); k.R(127, 32, 4, 6, "#1a1a20");
    for (let i = 0; i < 18; i++) k.R(0, 40 + (i % 6), ART_W, 1, `rgba(200,210,220,${0.05 + 0.03 * Math.sin(t + i)})`);
    for (let i = 0; i < 3; i++) {
      const x = 30 + i * 30 + Math.sin(t * 0.8 + i * 2) * 8, y = 28 + Math.sin(t * 1.3 + i) * 4;
      k.R(x, y, 6, 6, "rgba(232,236,255,0.75)"); k.R(x + 1, y + 6, 1, 2, "rgba(232,236,255,0.6)"); k.R(x + 4, y + 6, 1, 2, "rgba(232,236,255,0.6)");
      k.R(x + 1, y + 2, 1, 1, "#2a2a40"); k.R(x + 4, y + 2, 1, 1, "#2a2a40");
    }
    k.snake(70, 52, 6);
  },
  clockwork(k, t) {
    k.sky("#5a4a38", "#b89a6a");
    // a great turning gear
    const cx = 120, cy = 24, a = t * 0.6;
    for (let i = 0; i < 10; i++) { const ang = a + i * Math.PI / 5; k.R(cx + Math.cos(ang) * 16 - 2, cy + Math.sin(ang) * 16 - 2, 4, 4, "#b08a4a"); }
    k.glow(cx, cy, 15, "rgba(216,184,112,ALPHA)", 0.6); k.R(cx - 3, cy - 3, 6, 6, "#5a4a38");
    k.R(0, 46, ART_W, 14, "#4a4038");
    // spikes keeping time
    const up = Math.sin(t * 2.4) > 0.2;
    for (let i = 0; i < 6; i++) { const x = 8 + i * 14; for (let s = 0; s < 3; s++) k.R(x + s * 3, up ? 40 : 44, 1, up ? 6 : 2, "#e8edf5"); }
    k.snake(30 + Math.round(Math.sin(t * 0.9) * 6), 52, 6);
    k.R(140, 44, 12, 9, "#e8d39a"); k.R(142, 46, 8, 1, "#5a3a1a"); k.R(142, 48, 6, 1, "#5a3a1a");
  },
  chrono(k, t) {
    k.sky("#1a1430", "#4a3a6a");
    k.stars(20, 6, "#d8f8ff");
    // the rift
    for (let j = 0; j < 40; j++) { const w = 3 + Math.round(Math.sin(t * 2 + j * 0.4) * 2); k.R(80 - w / 2 + Math.sin(j * 0.5 + t) * 4, 4 + j, w, 1, j % 3 ? "#9fe8ff" : "#ffffff"); }
    k.R(0, 48, ART_W, 12, "#2a2050");
    // the snake, and its echo a step behind
    const x = 50 + Math.round(Math.sin(t * 0.8) * 10);
    g_echo(k, t, x + 40);
    k.snake(x, 52, 6);
    // an apple, rotting as you watch
    const rot = (t % 6) / 6;
    k.R(130, 50, 5, 5, k.mix("#d9202a", "#5a3a14", rot));
  },
  gale(k, t) {
    k.sky("#7aa0c0", "#e8f4ff");
    for (let i = 0; i < 10; i++) { const y = 8 + i * 4, x = ((t * 60 + i * 37) % 220) - 30; k.R(x, y, 16 + (i % 3) * 6, 1, "rgba(255,255,255,0.7)"); }
    k.R(0, 40, 40, 20, "#6a7a88"); k.R(0, 40, 40, 2, "#8aa0b0");
    k.R(120, 44, 40, 16, "#6a7a88"); k.R(120, 44, 40, 2, "#8aa0b0");
    k.R(40, 50, 80, 10, "#4a5a68");
    const push = Math.round(Math.sin(t * 1.6) * 4);
    k.snake(84 + push, 46, 7, { wave: 2.4, speed: 8 });
    k.R(140, 38, 5, 5, "#ff5a61"); k.R(141, 39, 1, 1, "#ffffff");
  },
  maw(k, t) {
    k.sky("#120808", "#3a1010");
    // the mouth, opening and closing around the land
    const open = 6 + Math.round(Math.sin(t * 0.9) * 4);
    for (let x = 0; x < ART_W; x += 8) { k.R(x, 0, 6, open + (x % 16 ? 2 : 0), "#e8e0c8"); k.R(x + 2, ART_H - open - 2, 6, open + 2, "#e8e0c8"); }
    k.R(0, 42, ART_W, 10, "#3a1a1a");
    // pits, cracking and opening
    for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.33) % 1, x = 24 + i * 46; if (ph > 0.5) k.R(x, 44, 10, 5, "#000000"); else k.R(x + 2, 46, 6, 1, "#5a3a20"); }
    k.snake(70 + Math.round(Math.sin(t * 1.2) * 6), 46, 7);
    const g2 = Math.sin(t * 4) > 0;
    k.R(140, 30, 7, 7, "#e9fff1"); k.R(143, 31, 1, 3, "#1f8a4a"); if (g2) k.R(143, 33, 2, 1, "#1f8a4a");
  }
});

/* The Chrono Rift's echo: a pale copy of the snake, a little behind */
function g_echo(k, t, x) {
  for (let i = 6; i >= 0; i--) k.R(x - i * 3, 52 + Math.round(Math.sin(t * 5 - 0.8 - i * 0.8) * 1.6), 4, 4, "rgba(159,232,255,0.55)");
}
