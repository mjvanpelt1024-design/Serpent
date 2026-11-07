/* =========================================================
   src/ui/map-coil.js
   The Coil and the sky behind the map.

   The islands sit along the body of the Coil, the great serpent of
   the story: a road that winds right, climbs, winds back left and
   climbs again, up to its head at the Maw. The stretch you've
   unlocked glows gold and green, with light flowing along it toward
   your next island; the rest is cold stone, waiting.

   The sky is a separate layer behind the world. It goes from sunrise
   at the bottom (the Garden) to deep night at the top (the Maw), and
   its stars and far islands drift more slowly than the map as you
   drag, so the world has depth.
   ========================================================= */
"use strict";

/* ----- The path: a smooth curve through every island, in order -----
   The tail rises out of the cloud sea, threads under each island's grass
   from its home end to its far end, swings out past the end and climbs
   to the next island, which runs the other way: a road that winds right,
   climbs, winds back left and climbs again. Segments: 2i is island i's
   own stretch, 2i + 1 the climb from it to the next. */
const COIL = (() => {
  const pts = [];
  const isl = CAMP.islands.map(i => ISLANDS[i.id]);
  const first = isl[0];
  const end = (I, side, dy) => ({ x: I.x + side * (I.w / 2 + 2), y: I.y + dy });
  pts.push({ x: first.x - first.dir * (first.w / 2 + 52), y: MAP_H + 12, seg: 0, open: 1 });
  pts.push({ x: first.x - first.dir * (first.w / 2 + 34), y: first.y + 46, seg: 0, open: 1 });
  isl.forEach((I, i) => {
    pts.push(Object.assign(end(I, -I.dir, 8), { seg: 2 * i }));
    pts.push({ x: I.x - I.dir * I.w * 0.2, y: I.y + I.th + 5, seg: 2 * i });
    pts.push({ x: I.x + I.dir * I.w * 0.2, y: I.y + I.th + 3, seg: 2 * i });
    pts.push(Object.assign(end(I, I.dir, -4), { seg: 2 * i, open: 1 }));
    const next = isl[i + 1];
    if (next) {
      // the climb swings wide of both islands, whichever reaches further out on that side
      const out = I.dir > 0 ? Math.max(I.x, next.x) : Math.min(I.x, next.x);
      const side = out + I.dir * (I.w / 2 + 34);
      pts.push({ x: side, y: I.y - 22, seg: 2 * i + 1, open: 1 }, { x: side, y: next.y + 34, seg: 2 * i + 1, open: 1 });
    } else {
      // past the last island, the neck reaches out to where the head lies
      pts.push({ x: I.x + I.dir * (I.w / 2 + 30), y: I.y - 16, seg: 2 * i + 1 }, { x: I.x + I.dir * (I.w / 2 + 56), y: I.y - 34, seg: 2 * i + 1 });
    }
  });

  // Catmull-Rom through the points, then resampled to one map pixel apart
  const raw = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 2));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      // the body sways out in the open, and lies still where it passes through rock
      raw.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), seg: p1.seg, wave: Math.sin(t * Math.PI) * (p1.open && p2.open ? 1 : 0) });
    }
  }
  raw.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, seg: pts[pts.length - 1].seg, wave: 0 });
  // A serpent, not a pipe: the body sways between the islands, still where it passes through them
  for (let i = 0; i < raw.length; i++) {
    const a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    raw[i].ox = (-dy / len) * Math.sin(i / 13) * 4.5 * raw[i].wave;
    raw[i].oy = (dx / len) * Math.sin(i / 13) * 4.5 * raw[i].wave;
  }
  raw.forEach(p => { p.x += p.ox; p.y += p.oy; });
  const samples = [];
  let acc = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i) acc += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
    if (!samples.length || acc - samples[samples.length - 1].s >= 1) samples.push({ x: raw[i].x, y: raw[i].y, s: acc, seg: raw[i].seg });
  }
  samples.forEach((p, i) => {
    const a = samples[Math.max(0, i - 2)], b = samples[Math.min(samples.length - 1, i + 2)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    p.tx = dx / len; p.ty = dy / len;          // along the body
    p.nx = -p.ty; p.ny = p.tx;                 // across it
  });
  return { samples, length: acc };
})();

/* How far along the body you've come. Lit: every island you've reached and the climbs
   between them. The wake: the climb to the next island, while you work toward it. */
function coilProgress() {
  const open = CAMP.islands.filter(i => campIslandOpen(i.id)).length;
  const last = CAMP.islands.length;
  const done = campWon(CAMP.islands[last - 1].id, LEVEL_COUNT);
  return { litSegs: done ? 2 * last + 1 : 2 * open, frontier: done ? -1 : open };
}

/* Body width: a thin tail out of the clouds, a thick middle, a neck before the head */
function coilWidth(s) {
  const L = COIL.length;
  const tail = Math.min(1, s / 90), neck = Math.min(1, (L - s) / 30);
  return 3 + Math.round(6 * Math.min(tail, 1) * (0.55 + 0.45 * neck));
}

const COIL_LIT = ["#0f3b22", "#1f6e3a", "#2fa85a", "#7fe08a", "#ffe08a"];      // edge ... belly highlight
const COIL_STONE = ["#2a2e38", "#454b58", "#5d6474", "#7a8294", "#8f97a8"];
const COIL_WAKE = ["#3a2a18", "#6a4a24", "#9a7a3a", "#d0aa50", "#ffd23f"];       // the stretch just ahead of you
const COIL_BONE = ["#3a3530", "#6a6058", "#9a9080", "#c8bfa8", "#efe8d4"];       // build 53: under an island whose Maw is beaten
/* Has the Maw been beaten in the tunnel under island i (nightmare mode, camp-nightmare.js)? */
const coilMawSlain = i => !!(camp && camp.nm && CAMP.islands[i] && camp.nm.maw.includes(CAMP.islands[i].id));

/* The body is painted once into its own canvas, and again only when you unlock something */
let coilCache = null;
function coilArt() {
  const { litSegs, frontier } = coilProgress();
  const fogFrom = frontier === -1 ? 99 : 2 * frontier + 1;                    // past the next island, it's in the clouds
  const tag = litSegs + ":" + fogFrom + ":" + (camp && camp.nm ? camp.nm.maw.join(",") : "");
  if (coilCache && coilCache.tag === tag) return coilCache.c;
  const c = document.createElement("canvas");
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext("2d");
  const S = COIL.samples;
  // a soft shadow first, cast down and to the right
  g.fillStyle = "rgba(10, 8, 30, 0.22)";
  S.forEach(p => { const w = coilWidth(p.s); g.fillRect(Math.round(p.x - w / 2 + 2), Math.round(p.y - w / 2 + 3), w, w); });
  S.forEach(p => {
    const lit = p.seg < litSegs - 1;
    const wake = !lit && p.seg === litSegs - 1 && frontier !== -1;
    const fog = !lit && !wake && p.seg >= fogFrom;
    const pal = lit ? (coilMawSlain(Math.floor(p.seg / 2)) ? COIL_BONE : COIL_LIT) : wake ? COIL_WAKE : COIL_STONE;
    const w = coilWidth(p.s), half = w / 2;
    for (let o = -half; o <= half; o += 0.5) {
      const edge = Math.abs(o) / (half || 1);                     // 0 in the middle, 1 at the edge
      // light from the top left: the upper side of the body is brighter
      const lightSide = o * Math.sign(p.ny || 1) < 0;
      let shade = edge > 0.82 ? 0 : edge > 0.55 ? 1 : lightSide ? 3 : 2;
      // overlapping scales, every few pixels along the body, offset on each side
      const scale = Math.floor((p.s + (o > 0 ? 2 : 0)) / 4) % 2;
      if (scale && shade > 1) shade -= 1;
      if (Math.abs(o) < 0.6 && Math.floor(p.s / 3) % 2 === 0 && shade >= 2) shade = 4;   // the bright ridge down the spine
      g.fillStyle = pal[shade];
      if (fog) g.globalAlpha = 0.45;
      g.fillRect(Math.round(p.x + p.nx * o), Math.round(p.y + p.ny * o), 1, 1);
      g.globalAlpha = 1;
    }
  });
  coilCache = { tag, c };
  return c;
}

/* When a new stretch wakes up, a surge of light races along it */
let coilSeen = null;          // the lit length last time the map was drawn
let coilSurge = null;         // { from, to, at }

/* Each frame: light flowing along the lit body toward you, and the stretch ahead stirring */
function drawCoil(g, t) {
  g.drawImage(coilArt(), 0, 0);
  const S = COIL.samples;
  const { litSegs, frontier } = coilProgress();
  let litEnd = S.length;
  for (let i = 0; i < S.length; i++) if (S[i].seg >= litSegs - 1) { litEnd = i; break; }
  if (coilSeen !== null && litEnd > coilSeen) coilSurge = { from: coilSeen, to: litEnd, at: t };
  coilSeen = litEnd;
  if (coilSurge) {
    const k = (t - coilSurge.at) / 1.8;
    if (k >= 1.3) coilSurge = null;
    else {
      const at = Math.floor(coilSurge.from + (coilSurge.to - coilSurge.from) * Math.min(1, k));
      for (let j = 0; j < 24; j++) {
        const p = S[at - j];
        if (!p || at - j < coilSurge.from) break;
        const w = coilWidth(p.s) + 2;
        g.fillStyle = `rgba(255, 250, 210, ${(1 - j / 24) * Math.min(1, (1.3 - k) * 3)})`;
        g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - w / 2), w, w);
      }
      const p = S[at];
      if (p) for (let i = 0; i < 6; i++) {
        const a = t * 9 + i;
        mapRect(g, p.x + Math.cos(a) * (4 + i), p.y + Math.sin(a) * (4 + i), 1, 1, "#fff6c4");
      }
    }
  }
  // pulses of light travelling up the body
  const gap = 46, speed = 34;
  for (let k = 0; k * gap < litEnd; k++) {
    const head = Math.floor((t * speed + k * gap) % Math.max(1, litEnd));
    for (let j = 0; j < 7; j++) {
      const p = S[head - j];
      if (!p) break;
      const a = (1 - j / 7) * 0.85;
      g.fillStyle = `rgba(255, 240, 170, ${a})`;
      const w = Math.max(1, coilWidth(p.s) - 3);
      g.fillRect(Math.round(p.x - w / 2), Math.round(p.y - w / 2), w, w);
    }
  }
  // a few scales catching the light
  for (let i = 0; i < 10; i++) {
    const p = S[Math.floor(mapHash(i, Math.floor(t * 1.5), 17) * litEnd)];
    if (p && Math.sin(t * 6 + i) > 0.4) { g.fillStyle = "#fffbe0"; g.fillRect(Math.round(p.x), Math.round(p.y - 1), 1, 1); }
  }
  // the stretch to your next island: golden cracks breathing in and out
  if (frontier !== -1) {
    const glow = 0.35 + 0.35 * Math.sin(t * 2.4);
    for (let i = litEnd; i < S.length && S[i].seg === litSegs - 1; i += 3) {
      const p = S[i];
      if (Math.floor((p.s - t * 14) / 5) % 3) continue;
      g.fillStyle = `rgba(255, 210, 63, ${glow})`;
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
  drawCoilHead(g, t);
}

/* The head, lying past the last island. Its eyes open once you reach that island, and burn
   purple once its last boss falls. It faces the way the neck was going. */
function drawCoilHead(g, t) {
  const S = COIL.samples, p = S[S.length - 1];
  const x = Math.round(p.x), y = Math.round(p.y);
  const lastIsl = CAMP.islands[CAMP.islands.length - 1].id;
  const awake = campIslandOpen(lastIsl), realm = campWon(lastIsl, LEVEL_COUNT);
  // the Maw beaten in every tunnel: the head is bone, its eye shut for good
  const beaten = CAMP.islands.every((I, i) => coilMawSlain(i));
  const pal = beaten ? COIL_BONE : awake ? COIL_LIT : COIL_STONE;
  const flip = p.tx > 0;
  const R = (dx, dy, w, h, c) => mapRect(g, flip ? x - dx - w + 1 : x + dx, y + dy, w, h, c);
  const jaw = awake ? Math.max(0, Math.round(Math.sin(t * 0.9) * 2)) : 0;
  // facing left: the snout points the way the body was going
  R(-13, -4, 15, 7, pal[1]); R(-12, -5, 12, 1, pal[2]); R(-14, -3, 2, 5, pal[1]);
  R(-11, -4, 10, 2, pal[3]); R(-9, -5, 3, 1, pal[4]);
  R(-14, 3 + jaw, 13, 2, pal[1]); R(-13, 3 + jaw, 11, 1, pal[2]);                  // the lower jaw
  if (jaw) { R(-13, 3, 11, jaw, "#2a0a12"); for (let i = 0; i < 4; i++) R(-12 + i * 3, 3, 1, 1, "#e8e0c8"); }
  R(-15, -2, 1, 1, "#0a0a12"); R(-15, 0, 1, 1, "#0a0a12");                          // nostrils
  // the eye
  const blink = (t % 6) < 0.15;
  if (beaten) { R(-8, -4, 1, 1, "#0a0a12"); R(-6, -4, 1, 1, "#0a0a12"); R(-7, -3, 1, 1, "#0a0a12"); R(-8, -2, 1, 1, "#0a0a12"); R(-6, -2, 1, 1, "#0a0a12"); }
  else if (!awake || blink) R(-7, -3, 3, 1, "#0a0a12");
  else {
    const c = realm ? "#d06bff" : "#ffd23f";
    g.fillStyle = realm ? `rgba(208, 107, 255, ${0.25 + 0.2 * Math.sin(t * 3)})` : `rgba(255, 210, 63, ${0.25 + 0.2 * Math.sin(t * 3)})`;
    g.fillRect(flip ? x + 2 : x - 10, y - 6, 9, 7);
    R(-8, -4, 3, 3, c); R(-7, -4, 1, 3, "#0a0a12");
  }
  // a forked tongue, flicking, when it's awake
  if (awake && !beaten && Math.sin(t * 2.2) > 0.6) { R(-19, 1, 5, 1, "#ff3b6b"); R(-21, 0, 2, 1, "#ff3b6b"); R(-21, 2, 2, 1, "#ff3b6b"); }
}

/* ----- The sky: its own canvas behind the world, at a low resolution, with parallax ----- */
const SKY_STOPS = [          // [height out of 340, color]: night at the top, dusk, the day, and sunrise at the bottom
  [0, "#090820"], [45, "#1a1650"], [85, "#3e2c78"], [120, "#8a4f94"], [150, "#d47f93"],
  [180, "#c9a7c6"], [210, "#8fbfe6"], [250, "#79bdec"], [290, "#bfe0f2"], [320, "#ffe1bf"], [340, "#ffd09a"]
];
const SKY_RGB = SKY_STOPS.map(([y, c]) => [y * MAP_H / 340, hexToRgb(c)]);
function skyAt(y) {
  if (y <= SKY_RGB[0][0]) return SKY_RGB[0][1];
  for (let i = 1; i < SKY_RGB.length; i++) {
    const [y1, c1] = SKY_RGB[i], [y0, c0] = SKY_RGB[i - 1];
    if (y <= y1) { const k = (y - y0) / (y1 - y0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * k)); }
  }
  return SKY_RGB[SKY_RGB.length - 1][1];
}

const SKY_PX = 5;            // one sky pixel is this many screen pixels
let mapSkyEl = null;
function drawSky(t) {
  if (!mapSkyEl) {
    mapSkyEl = document.createElement("canvas");
    mapSkyEl.id = "map-sky";
    mapSkyEl.setAttribute("aria-hidden", "true");
    mapEl.insertBefore(mapSkyEl, mapEl.firstChild);
  }
  const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  const w = Math.max(1, Math.ceil(vw / SKY_PX)), h = Math.max(1, Math.ceil(vh / SKY_PX));
  if (mapSkyEl.width !== w || mapSkyEl.height !== h) { mapSkyEl.width = w; mapSkyEl.height = h; }
  const g = mapSkyEl.getContext("2d");
  const cam = mapCamNow();
  // map y of a sky row: where that row of the screen is looking in the world
  const worldY = row => ((row * SKY_PX - cam.ty) / cam.s) / 2;
  for (let r = 0; r < h; r++) {
    const wy = worldY(r);
    const [cr, cg, cb] = skyAt(wy + (BAYER[(r % 4) * 4] / 16 - 0.5) * 6);
    g.fillStyle = `rgb(${cr},${cg},${cb})`;
    g.fillRect(0, r, w, 1);
  }
  // parallax: the far layers move a fraction as fast as the map
  const px = cam.tx / SKY_PX, py = cam.ty / SKY_PX;
  // stars, brighter the higher you are
  for (let i = 0; i < 140; i++) {
    const sx = ((mapHash(i, 1, 91) * w * 3 + px * 0.12) % (w * 1.0) + w) % w;
    const sy = ((mapHash(i, 2, 91) * h * 3 + py * 0.12) % (h * 1.0) + h) % h;
    const wy = worldY(sy);
    const a = Math.max(0, Math.min(1, (MAP_H * 0.56 - wy) / (MAP_H * 0.35)));
    if (a <= 0) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + mapHash(i, 3, 91) * 3) + i);
    g.fillStyle = `rgba(255, 250, 230, ${a * (0.35 + tw * 0.65)})`;
    g.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }
  // now and then a shooting star streaks across the night up top
  {
    const cyc = 7, ph = (t % cyc) / cyc, k = Math.floor(t / cyc);
    if (ph < 0.12) {
      const sx = mapHash(k, 7, 95) * w, sy = mapHash(k, 8, 95) * h * 0.5, len = 9;
      const wy = worldY(sy);
      if (wy < MAP_H * 0.45) for (let j = 0; j < len; j++) {
        const q = ph / 0.12;
        g.fillStyle = `rgba(255, 250, 225, ${((1 - j / len) * (1 - q) * 0.9).toFixed(2)})`;
        g.fillRect(Math.floor(sx + q * 26 - j), Math.floor(sy + q * 10 - j * 0.4), 1, 1);
      }
    }
  }
  // far-off islands, silhouetted against the sky
  for (let i = 0; i < 9; i++) {
    const iw = 6 + mapHash(i, 4, 93) * 10;
    const sx = ((mapHash(i, 5, 93) * w * 2.2 + px * 0.3) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
    const sy = ((mapHash(i, 6, 93) * h * 2 + py * 0.3) % (h * 1.3) + h * 1.3) % (h * 1.3) - h * 0.15;
    const [r0, g0, b0] = skyAt(worldY(sy));
    // a flat, slightly lighter top and a rock that tapers away below, both faded into the haze
    const rock = `rgba(${Math.round(r0 * 0.72)},${Math.round(g0 * 0.72)},${Math.round(b0 * 0.82)},0.7)`;
    const top = `rgba(${Math.round(r0 * 0.86)},${Math.round(g0 * 0.9)},${Math.round(b0 * 0.88)},0.75)`;
    g.fillStyle = top;
    g.fillRect(Math.round(sx - iw / 2), Math.round(sy - 1), Math.round(iw), 2);
    g.fillStyle = rock;
    for (let r = 1; r < iw * 0.55; r++) {
      const ww = Math.max(1, Math.round(iw * Math.pow(1 - r / (iw * 0.55), 0.8)));
      g.fillRect(Math.round(sx - ww / 2), Math.round(sy + r), ww, 1);
    }
  }
  // the moon up in the night, the sun low in the morning
  const moonY = 40 * 2 * cam.s / SKY_PX + py * 0.7, moonX = w * 0.82 + px * 0.05;
  if (moonY > -10 && moonY < h + 10) {
    skyDisc(g, moonX, moonY, 7, "rgba(255, 250, 220, 0.12)");
    skyDisc(g, moonX, moonY, 4, "#fff6d8");
    skyDisc(g, moonX + 1.5, moonY - 1, 3.4, "rgba(26, 22, 80, 0.85)");          // a crescent
  }
  const sunY = (MAP_H - 30) * 2 * cam.s / SKY_PX + py * 0.7, sunX = w * 0.12 + px * 0.05;
  if (sunY > -14 && sunY < h + 14) {
    skyDisc(g, sunX, sunY, 11, "rgba(255, 210, 140, 0.18)");
    skyDisc(g, sunX, sunY, 8, "rgba(255, 220, 150, 0.3)");
    skyDisc(g, sunX, sunY, 5, "#fff0b8");
  }
}

/* A round, pixelly disc */
function skyDisc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}
