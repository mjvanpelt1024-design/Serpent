/* =========================================================
   src/art/island-art-46.js
   Story book pictures for the twelve islands added in build 46,
   drawn with the same kit as src/art/story-book-art.js (their still
   parts are pictures in textures/scenes/story/<page>/)
   ========================================================= */
"use strict";

Object.assign(ART_SCENE, {
  sunflower: "sunflower", bramble: "bramble", hive: "hive", thunder: "thunder", frost: "frost", hunt: "hunt",
  keg: "keg", moor: "moor", clockwork: "clockwork", chrono: "chrono", gale: "gale", maw: "maw"
});

Object.assign(ART_DRAW, {
  sunflower(k, t) {
    k.pic("story:sunflower:sky");
    k.glow(130, 12, 30, "rgba(255,230,140,ALPHA)", 0.6);
    k.layer("story:sunflower:1"); // the sun
    k.hills("#b8d860", 42, 4, 0.06, 2, 3);
    k.layer("story:sunflower:2"); // the field, the sunflowers' stalks
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 18, sway = Math.round(Math.sin(t * 1.4 + i) * 1), h = 14 + (i % 3) * 4;
      k.put("story:sunflower:head", x - 1 + sway, 44 - h);
    }
    k.snake(72 + Math.round(Math.sin(t * 0.7) * 8), 52, 7, { tongue: true });
    const gx = 112, gy = 50 + Math.round(Math.sin(t * 3));
    k.glow(gx + 2, gy + 2, 7, "rgba(255,210,63,ALPHA)", 0.6);
    k.put("story:sunflower:coin", gx, gy);
  },
  bramble(k, t) {
    k.pic("story:bramble:sky");
    k.hills("#2d4a22", 30, 6, 0.07, 1, 4);
    k.layer("story:bramble:1"); // the ground, the thorny bushes
    k.snake(60 + Math.round(Math.sin(t * 0.8) * 10), 52, 6);
    // the shears, glinting (story:bramble:shears: dull, glinting)
    k.pic("story:bramble:shears", Math.sin(t * 3) > 0.7 ? 1 : 0, 114, 50);
  },
  hive(k, t) {
    k.pic("story:hive:sky");
    k.layer("story:hive:1"); // the ground, and the hive itself, hanging from a branch
    for (let i = 0; i < 7; i++) {
      const a = t * (1.5 + i * 0.2) + i * 1.3;
      const x = 40 + Math.cos(a) * (18 + i * 6), y = 22 + Math.sin(a * 1.3) * 10;
      k.put("story:hive:bee", x, y); if (Math.sin(t * 30 + i) > 0) k.paint("story:hive:wing", x, y - 1);
    }
    k.snake(108 + Math.round(Math.sin(t * 0.7) * 6), 52, 7);
    k.layer("story:hive:2"); // a pail
  },
  thunder(k, t) {
    k.pic("story:thunder:sky");
    for (let i = 0; i < 4; i++) k.put("story:thunder:cloud", ((i * 50 + t * 6) % 220) - 30, 3 + i * 3);
    k.hills("#3a4048", 34, 10, 0.05, 1, 6);
    k.layer("story:thunder:1"); // the ground
    const flash = (t % 3.1) < 0.12;
    if (flash) {
      k.paint("story:thunder:flash", 0, 0);
      k.pic("story:thunder:bolt");
    } else if ((t % 3.1) > 2.5) {
      k.put("story:thunder:spark", 98, 46, Math.floor(t * 10) % 2 ? 0 : 1);
    }
    k.fall(30, "rgba(160,200,240,0.6)", 60, 3, 4);
    k.snake(50 + Math.round(Math.sin(t * 0.8) * 6), 52, 7);
    k.glow(140, 50, 8, "rgba(127,227,255,ALPHA)", 0.5);
    k.layer("story:thunder:2"); // a jar of lightning
  },
  frost(k, t) {
    k.pic("story:frost:sky");
    k.hills("#e8f4ff", 32, 8, 0.04, 1, 7);
    k.layer("story:frost:1"); // the snow, its patches of ice
    k.fall(36, "#ffffff", 14, 5, 6);
    // the snake slides, stiff and straight, across the ice
    const slide = ((t * 20) % 200) - 20;
    k.snake(slide, 50, 7, { wave: 0 });
    k.layer("story:frost:2"); // the hourglass, its sand stopped
  },
  hunt(k, t) {
    k.pic("story:hunt:sky");
    k.hills("#7a8a4a", 36, 6, 0.06, 2, 4);
    k.layer("story:hunt:1"); // the plain and its tall grass
    k.snake(56 + Math.round(Math.sin(t * 1.1) * 4), 52, 7);
    // the Hunter, dark, closing in from the right
    const hx = 128 - Math.round((t * 4) % 20);
    for (let i = 0; i < 7; i++) k.R(hx + i * 3, 52 + Math.round(Math.sin(t * 5 - i * 0.8) * 1.2), 4, 4, i === 0 ? "#2a0a12" : i % 2 ? "#7a1424" : "#5a0e1a");
    k.R(hx, 53, 1, 1, "#ffd23f"); k.R(hx + 2, 53, 1, 1, "#ffd23f");
    k.layer("story:hunt:2"); // an apple
  },
  keg(k, t) {
    k.pic("story:keg:sky");
    k.layer("story:keg:1"); // the floor, the kegs
    // a bomb, ticking down (story:keg:bomb: its fuse dark, sparking), and the blast it becomes
    const ph = t % 4;
    if (ph < 3.2) {
      k.pic("story:keg:bomb", Math.floor(t * 8) % 2 ? 1 : 0, 112, 41);
    } else {
      k.glow(116, 50, 22 * (ph - 3.2) / 0.8 + 4, "rgba(255,160,40,ALPHA)", 0.8);
    }
    k.snake(80 + Math.round(Math.sin(t * 0.9) * 4), 52, 6);
    const hue = (t * 120) % 360;
    k.R(146, 38, 5, 5, `hsl(${hue},95%,65%)`);
  },
  moor(k, t) {
    k.pic("story:moor:sky");
    k.stars(12, 4, "#c8d0ff");
    k.hills("#3a4a3a", 38, 4, 0.05, 2, 3);
    k.layer("story:moor:1"); // the moor, the old church
    for (let i = 0; i < 18; i++) k.R(0, 40 + (i % 6), ART_W, 1, `rgba(200,210,220,${0.05 + 0.03 * Math.sin(t + i)})`);
    for (let i = 0; i < 3; i++) {
      const x = 30 + i * 30 + Math.sin(t * 0.8 + i * 2) * 8, y = 28 + Math.sin(t * 1.3 + i) * 4;
      k.layer("story:moor:ghost", x, y);
    }
    k.snake(70, 52, 6);
  },
  clockwork(k, t) {
    k.pic("story:clockwork:sky");
    // a great turning gear
    const cx = 120, cy = 24, a = t * 0.6;
    for (let i = 0; i < 10; i++) { const ang = a + i * Math.PI / 5; k.R(cx + Math.cos(ang) * 16 - 2, cy + Math.sin(ang) * 16 - 2, 4, 4, "#b08a4a"); }
    k.glow(cx, cy, 15, "rgba(216,184,112,ALPHA)", 0.6);
    k.layer("story:clockwork:1"); // the gear's hub, the floor
    // spikes keeping time (story:clockwork:spikes: up, down)
    k.pic("story:clockwork:spikes", Math.sin(t * 2.4) > 0.2 ? 0 : 1, 8, 40);
    k.snake(30 + Math.round(Math.sin(t * 0.9) * 6), 52, 6);
    k.layer("story:clockwork:2"); // a scroll
  },
  chrono(k, t) {
    k.pic("story:chrono:sky");
    k.stars(20, 6, "#d8f8ff");
    // the rift
    for (let j = 0; j < 40; j++) { const w = 3 + Math.round(Math.sin(t * 2 + j * 0.4) * 2); k.R(80 - w / 2 + Math.sin(j * 0.5 + t) * 4, 4 + j, w, 1, j % 3 ? "#9fe8ff" : "#ffffff"); }
    k.layer("story:chrono:1"); // the ground
    // the snake, and its echo a step behind
    const x = 50 + Math.round(Math.sin(t * 0.8) * 10);
    g_echo(k, t, x + 40);
    k.snake(x, 52, 6);
    // an apple, rotting as you watch
    const rot = (t % 6) / 6;
    k.R(130, 50, 5, 5, k.mix("#d9202a", "#5a3a14", rot));
  },
  gale(k, t) {
    k.pic("story:gale:sky");
    for (let i = 0; i < 10; i++) { const y = 8 + i * 4, x = ((t * 60 + i * 37) % 220) - 30; k.R(x, y, 16 + (i % 3) * 6, 1, "rgba(255,255,255,0.7)"); }
    k.layer("story:gale:1"); // the cliffs and the gap between
    const push = Math.round(Math.sin(t * 1.6) * 4);
    k.snake(84 + push, 46, 7, { wave: 2.4, speed: 8 });
    k.layer("story:gale:2"); // a gem
  },
  maw(k, t) {
    k.pic("story:maw:sky");
    // the mouth, opening and closing around the land
    const open = 6 + Math.round(Math.sin(t * 0.9) * 4);
    for (let x = 0; x < ART_W; x += 8) { k.R(x, 0, 6, open + (x % 16 ? 2 : 0), "#e8e0c8"); k.R(x + 2, ART_H - open - 2, 6, open + 2, "#e8e0c8"); }
    k.layer("story:maw:1"); // the land between its jaws
    // pits, cracking and opening
    for (let i = 0; i < 3; i++) k.put("story:maw:pit", 24 + i * 46, 44, (t * 0.5 + i * 0.33) % 1 > 0.5 ? 0 : 1);
    k.snake(70 + Math.round(Math.sin(t * 1.2) * 6), 46, 7);
    k.pic("story:maw:gem", Math.sin(t * 4) > 0 ? 1 : 0, 140, 30); // (its rune, half and whole)
  }
});

/* The Chrono Rift's echo: a pale copy of the snake, a little behind */
function g_echo(k, t, x) {
  for (let i = 6; i >= 0; i--) k.R(x - i * 3, 52 + Math.round(Math.sin(t * 5 - 0.8 - i * 0.8) * 1.6), 4, 4, "rgba(159,232,255,0.55)");
}
