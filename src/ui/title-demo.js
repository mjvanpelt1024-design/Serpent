/* =========================================================
   src/ui/title-demo.js
   The living title screen
   ========================================================= */
"use strict";

/* =========================================================
   The living title screen: while the main menu is open, your snake
   (your skin, your Flair, your theme) plays by itself behind it,
   chasing apples and orbs. It has its own little board and never
   touches the real game state.
   ========================================================= */
const DEMO_CELL = 20;
const DEMO_SPEED = 7;              // moves a second
const DEMO_LINES = [
  "While you decide, {name} is practicing. I wish it would not.",
  "{name} is eating apples unsupervised. Nothing good has ever come of that.",
  "This is the menu, the safest place in the story, which is not saying much.",
  "You may begin whenever you like. The misfortune will wait. It is very patient.",
  "{name} does not know it is being watched. I prefer it that way.",
  "Every apple here is free. I am told this is called a demonstration. I call it a delay."
];
let demo = null;

function demoReset() {
  const cols = boardSize / DEMO_CELL;
  const rows = Math.max(8, Math.floor(viewH / DEMO_CELL));
  const y = Math.floor(rows * 0.8);
  demo = {
    cols, rows,
    body: [{ x: 4, y }, { x: 3, y }, { x: 2, y }, { x: 1, y }],
    prev: null,
    dir: { x: 1, y: 0 },
    grow: 0,
    apples: [],
    orbs: [],
    parts: [],
    acc: 0,
    last: 0,
    eaten: 0,
    nextLine: performance.now() + 25000 + Math.random() * 20000,
    fade: 0
  };
  for (let i = 0; i < 2; i++) demoSpawn("apples");
  demoSpawn("orbs");
}

function demoFree(x, y) {
  return !demo.body.some(c => c.x === x && c.y === y) && !demo.apples.some(a => a.x === x && a.y === y) && !demo.orbs.some(a => a.x === x && a.y === y);
}

function demoSpawn(kind) {
  for (let tries = 0; tries < 60; tries++) {
    const x = Math.floor(Math.random() * demo.cols);
    const y = 1 + Math.floor(Math.random() * (demo.rows - 2));
    if (demoFree(x, y)) { demo[kind].push({ x, y, born: performance.now() }); return; }
  }
}

const demoWrap = (v, n) => ((v % n) + n) % n;

/* Find a way to the nearest snack that does not run through the body.
   If there isn't one, take the step with the most room around it. */
function demoThink() {
  const { cols, rows, body } = demo;
  const blocked = new Set(body.slice(0, -1).map(c => c.x + "," + c.y));
  const goals = new Set(demo.apples.concat(demo.orbs).map(a => a.x + "," + a.y));
  const head = body[0];
  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const seen = new Map([[head.x + "," + head.y, null]]);
  const queue = [head];
  let found = null;
  while (queue.length && !found) {
    const c = queue.shift();
    for (const d of dirs) {
      const n = { x: demoWrap(c.x + d.x, cols), y: demoWrap(c.y + d.y, rows) };
      const k = n.x + "," + n.y;
      if (seen.has(k) || blocked.has(k)) continue;
      seen.set(k, c.x + "," + c.y);
      if (goals.has(k)) { found = k; break; }
      queue.push(n);
    }
  }
  if (found) {
    let k = found;
    while (seen.get(k) !== head.x + "," + head.y) k = seen.get(k);
    const [nx, ny] = k.split(",").map(Number);
    const dx = nx - head.x, dy = ny - head.y;
    return { x: Math.abs(dx) > 1 ? -Math.sign(dx) : dx, y: Math.abs(dy) > 1 ? -Math.sign(dy) : dy };
  }
  let best = null, room = -1;
  dirs.forEach(d => {
    if (d.x === -demo.dir.x && d.y === -demo.dir.y) return;
    const n = { x: demoWrap(head.x + d.x, cols), y: demoWrap(head.y + d.y, rows) };
    if (blocked.has(n.x + "," + n.y)) return;
    let free = 0;
    dirs.forEach(e => { if (!blocked.has(demoWrap(n.x + e.x, cols) + "," + demoWrap(n.y + e.y, rows))) free++; });
    if (free > room) { room = free; best = d; }
  });
  return best;
}

function demoBurst(x, y, colors, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
    demo.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5 + Math.random() * 0.4, age: 0, c: colors[i % colors.length], s: 2 + Math.floor(Math.random() * 3) });
  }
}

function demoStep() {
  const d = demoThink();
  if (!d) { demoBurst(demo.body[0].x * DEMO_CELL + 10, demo.body[0].y * DEMO_CELL + 10, ["#ffffff", "#cccccc"], 20); demoReset(); return; }
  demo.dir = d;
  demo.prev = demo.body.map(c => ({ ...c }));
  const head = { x: demoWrap(demo.body[0].x + d.x, demo.cols), y: demoWrap(demo.body[0].y + d.y, demo.rows) };
  demo.body.unshift(head);
  const ai = demo.apples.findIndex(a => a.x === head.x && a.y === head.y);
  const oi = demo.orbs.findIndex(a => a.x === head.x && a.y === head.y);
  if (ai !== -1) {
    demo.apples.splice(ai, 1);
    demo.grow += 1;
    demo.eaten++;
    demoBurst(head.x * DEMO_CELL + 10, head.y * DEMO_CELL + 10, ["#ff3b3b", "#ff9a9a", "#3ddc3d", "#ffffff"]);
    demoSpawn("apples");
  } else if (oi !== -1) {
    demo.orbs.splice(oi, 1);
    demoBurst(head.x * DEMO_CELL + 10, head.y * DEMO_CELL + 10, ["#ffd23f", "#fff6c4"], 10);
    setTimeout(() => demo && demoSpawn("orbs"), 1500 + Math.random() * 3000);
  }
  if (demo.grow > 0) demo.grow--;
  else demo.body.pop();
  // A snake that gets too long starts over, before it fills the board
  if (demo.body.length > 26) { demoBurst(head.x * DEMO_CELL + 10, head.y * DEMO_CELL + 10, ["#ffd23f", "#ffffff", "#b36bff"], 26); demo.body = demo.body.slice(0, 5); }
}

function drawDemo(ts) {
  if (!demo || demo.rows !== Math.max(8, Math.floor(viewH / DEMO_CELL))) demoReset();
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dt = Math.min(0.1, (ts - (demo.last || ts)) / 1000);
  demo.last = ts;
  demo.fade = Math.min(1, demo.fade + dt * 1.5);
  if (!still) {
    demo.acc += dt;
    const stepT = 1 / DEMO_SPEED;
    while (demo.acc >= stepT) { demo.acc -= stepT; demoStep(); }
  }
  const lerp = still ? 1 : Math.min(1, demo.acc * DEMO_SPEED);
  const keepCell = cell;
  cell = DEMO_CELL;
  ctx.save();
  ctx.globalAlpha = demo.fade;

  demo.apples.forEach(a => {
    const pop = Math.min(1, (ts - a.born) / 250);
    drawItem(ctx, "apple", a.x * DEMO_CELL, a.y * DEMO_CELL, 1, pop < 1, demo.fade, ts, DEMO_CELL);
  });
  demo.orbs.forEach(a => drawItem(ctx, "xp", a.x * DEMO_CELL, a.y * DEMO_CELL, 1, false, demo.fade, ts, DEMO_CELL));

  // Slide each segment from where it was to where it is, unless it wrapped
  const skin = currentSkin();
  const segs = demo.body.map((c, i) => {
    const p = demo.prev && (demo.prev[i] || demo.prev[demo.prev.length - 1]);
    let x = c.x, y = c.y;
    if (p && Math.abs(p.x - c.x) <= 1 && Math.abs(p.y - c.y) <= 1) { x = p.x + (c.x - p.x) * lerp; y = p.y + (c.y - p.y) * lerp; }
    return { x: x * DEMO_CELL, y: y * DEMO_CELL };
  });
  if (save.settings.details) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    segs.forEach(sg => ctx.fillRect(sg.x, sg.y + 3, DEMO_CELL - 1, DEMO_CELL - 1));
  }
  for (let i = segs.length - 1; i >= 0; i--) drawSnakeCell(segs[i].x, segs[i].y, skinColorAt(skin, i, ts));
  drawFlairSet(ctx, save.flair, segs, DEMO_CELL, demo.fade, ts);

  // Sparks from whatever it just ate
  demo.parts = demo.parts.filter(p => (p.age += dt) < p.life);
  demo.parts.forEach(p => {
    p.vy += 340 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = demo.fade * (1 - p.age / p.life);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
  });
  ctx.restore();
  cell = keepCell;

  // Now and then, the narrator remarks on it
  if (save.settings.chatter && ts > demo.nextLine && !toastBusy && demo.eaten > 3) {
    demo.nextLine = ts + 60000 + Math.random() * 40000;
    const span = document.createElement("span");
    span.textContent = withName(DEMO_LINES[Math.floor(Math.random() * DEMO_LINES.length)]);
    queueToast(span.innerHTML, "narrator");
  }
}
