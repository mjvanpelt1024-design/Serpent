/* =========================================================
   src/art/title-scene.js
   The world behind the title screen: the map itself (src/ui/map.js),
   the five islands, the Coil, the clouds and the cloud sea, painted one
   map pixel to one screen block in the sky's own colors, and drifting
   slowly from the sunrise at the bottom up to the stars and back, with
   a dark edge so the menu stays easy to read. Islands you haven't
   reached are silhouettes, as on the map.
   ========================================================= */
"use strict";

const titleSceneEl = document.createElement("canvas");
titleSceneEl.id = "title-scene";
titleSceneEl.setAttribute("aria-hidden", "true");
document.body.insertBefore(titleSceneEl, document.body.firstChild);
const titleWorld = document.createElement("canvas");
titleWorld.width = MAP_W;
titleWorld.height = MAP_H;
const TITLE_ROWS = 300;            // how much of the world shows, top to bottom, in map pixels
let titleRaf = 0;
let titleLast = 0;
const titleSkyCache = { key: "", c: null };

function titleLoop(ts) {
  titleRaf = 0;
  if (currentScreen !== "main" || !camp) return;
  titleRaf = requestAnimationFrame(titleLoop);
  if (ts - titleLast < 60) return;
  titleLast = ts;
  drawTitleScene(ts / 1000);
}

function drawTitleScene(t) {
  const H = TITLE_ROWS, W = Math.max(160, Math.round(H * window.innerWidth / Math.max(1, window.innerHeight)));
  if (titleSceneEl.width !== W || titleSceneEl.height !== H) { titleSceneEl.width = W; titleSceneEl.height = H; }
  const g = titleSceneEl.getContext("2d");
  g.imageSmoothingEnabled = false;
  // up and down the world, slowly: two minutes from the sunrise to the stars and back
  const travel = MAP_H - H;
  const top = Math.round(travel * (0.5 + 0.5 * Math.cos(t * Math.PI / 60)));
  const left = Math.round((MAP_W - W) / 2);
  // the sky, with stars where it's dark
  const key = [W, H, top].join(":");
  if (titleSkyCache.key !== key) {
    const c = titleSkyCache.c || document.createElement("canvas");
    c.width = W; c.height = H;
    const sg = c.getContext("2d");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 4) {
      const [r, gg, b] = skyAt(top + y + (BAYER[(y % 4) * 4 + (x / 4) % 4] / 16 - 0.5) * 8);
      sg.fillStyle = `rgb(${r},${gg},${b})`;
      sg.fillRect(x, y, 4, 1);
    }
    titleSkyCache.key = key;
    titleSkyCache.c = c;
  }
  g.drawImage(titleSkyCache.c, 0, 0);
  for (let i = 0; i < 90; i++) {
    const sx = mapHash(i, 1, 51) * W, wy = mapHash(i, 2, 51) * MAP_H * 0.6;
    const y = wy - top;
    if (y < 0 || y >= H) continue;
    const a = Math.max(0, Math.min(1, (MAP_H * 0.5 - wy) / (MAP_H * 0.3)));
    if (a <= 0 || Math.sin(t * (1 + mapHash(i, 3, 51) * 3) + i) < -0.4) continue;
    g.fillStyle = `rgba(255,250,230,${a})`;
    g.fillRect(Math.round(sx), Math.round(y), 1, 1);
  }
  // the world itself, as the map paints it
  const wg = titleWorld.getContext("2d");
  wg.imageSmoothingEnabled = false;
  wg.clearRect(0, 0, MAP_W, MAP_H);
  paintMapWorld(wg, t);
  g.drawImage(titleWorld, left, top, W, H, 0, 0, W, H);
}

/* Runs only while the title screen is up */
(() => {
  const orig = showScreen;
  window.showScreen = function (name) {
    orig.apply(this, arguments);
    document.body.classList.toggle("title-world", name === "main");
    if (name === "main" && !titleRaf) titleRaf = requestAnimationFrame(titleLoop);
  };
})();
