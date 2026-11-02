/* =========================================================
   src/game/flow/game-flow.js
   Starting, running and ending a run
   ========================================================= */
"use strict";

/* =========================================================
   Game flow
   ========================================================= */
let cell = 20;            // size of one gameplay square (10 in Treasure)
let cellsAcross = 20;
let edgeMode = "wrap";
let apples = [];          // { x, y, size, small }   size = squares it covers (1 or 2)
let targetApples = 1;
let bigSpawns = false;
let endless = null;       // scroller state while playing Endless
let rocks = [];           // placed at the start of a run, never respawn
let hazards = [];         // fleas, fire and molasses: { type, x, y, size, small, spawnAt, expiresAt }
let walls = new Map();    // walls inside the board: cellKey -> "red" | "purple"
let spawnTimers = {};
let fx = { fastUntil: 0, slowUntil: 0, slowFactor: 1, pauseUntil: 0 };
let spec = {};            // which items this run can spawn
let paused = false;
let lastAppleAt = -1e9;   // for Combo Meal
let pauseStartedAt = 0;

/* Every item comes in small (half a square), normal (one square) and large (2x2) */
const ITEM_INFO = {
  apple: { color: "#ff2b2b", label: "Apple" },
  xp: { color: "#c8e03a", label: "Experience" },
  rock: { color: "#b9b9b9", label: "Rock" },
  popsicle: { color: "#2f7dff", label: "Popsicle" },
  flea: { color: "#4e2810", label: "Flea" },
  fire: { color: "#ff4a1a", label: "Fire" },
  molasses: { color: "#a8661e", label: "Molasses" }
};

const LIFETIME = {
  popsicle: [5000, 10000],
  flea: [4000, 8000],
  fire: [5000, 9000],
  molasses: [14000, 22000],
  xpLarge: [7000, 9000]
};

const FIRE_BOOST = 1.45;          // how much faster fire makes you
const FIRE_MS = 4000;

/* What each island can spawn comes from the [spawns] part of its world.txt.
   s / l = percent chance an item is small / large. */
const MODE_ITEMS = Object.fromEntries(MODE_KEYS.map(k => [k, modes[k].spawns || {}]));

/* Endless lives in world coordinates with a smooth camera. The camera scrolls a
   little slower than the snake, so heading right slowly wins back ground after a dodge. */
const ENDLESS = {
  startSpeed: 7,
  maxSpeed: 12,           // stays below Chaos, even with Brake Pedal maxed
  rampPerSec: 0.05,
  scrollRatio: 0.85,
  startCol: 7,            // where the head starts on screen
  maxCol: 13,             // the camera speeds up if you get further ahead than this
  startLength: 18,        // long enough to trail off the left edge
  maxWall: 5,
  minWall: 1,
  period: 180,            // columns for the tunnel to squeeze in and back out
  appleChance: 0.08,
  jump: [1, 3, 8],        // columns an apple jumps you forward: small, normal, huge
  jumpGraceMs: 900,       // can't be hurt for a moment after a jump
  bigJump: 4
};

function applyMode(mode) {
  cell = mode.cell || grid;
  cellsAcross = boardSize / cell;
  edgeMode = mode.edge;
  wallsMode = mode.edge === "wall";
  scoreMultiplier = mode.multiplier;
  bigSpawns = !!mode.bigSpawns;
  spec = MODE_ITEMS[currentModeKey] || {};

  // Older names other parts of the game still read
  hazardMode = !!spec.popsicle;
  maxPopsicle = spec.popsicle ? spec.popsicle.max || 0 : 0;
  popsicleEffect = spec.popsicle ? "death" : "none";

  let speed = mode.speed;
  if (currentModeKey === "chaos") speed *= 1 - getTrackValue("brake") / 100;
  speed *= 1 - (inMode("classic", "steady") + inMode("challenge", "wind")) / 100;
  moveInterval = 1000 / (speed * save.dev.speedMult);

  if (mode.edge === "endless") targetApples = 0;
  else if (currentModeKey === "chaos") targetApples = getTrackValue("rain");
  else if (currentModeKey === "inferno") targetApples = 4;
  else if (currentModeKey === "labyrinth") targetApples = 6 + getTrackValue("scent");
  else if (typeof mode.apples === "number") targetApples = mode.apples;
  else targetApples = 1;

  applyNightmare();
  applyLevel();
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

const cellKey = (x, y) => x + "," + y;
const gradeOf = it => (it.small ? 0 : (it.size === 2 ? 2 : 1));
const roll = pct => Math.random() * 100 < pct;
/* A mode's own upgrade only counts while you're playing that mode */
const inMode = (mode, key, off = 0) => (currentModeKey === mode ? getTrackValue(key) : off);

function covers(item, x, y) {
  const span = (item.size || 1) * cell;
  return x >= item.x && x < item.x + span && y >= item.y && y < item.y + span;
}

function occupiedSet({ itemsOnly = false } = {}) {
  const set = new Set();
  const addItem = it => {
    const n = it.size || 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) set.add(cellKey(it.x + i * cell, it.y + j * cell));
    }
  };
  if (!itemsOnly) {
    set.add(cellKey(snake.x, snake.y));
    snake.cells.forEach(c => set.add(cellKey(c.x, c.y)));
  }
  apples.forEach(addItem);
  popsicles.forEach(addItem);
  orbs.forEach(addItem);
  rocks.forEach(addItem);
  hazards.forEach(addItem);
  shimmers.forEach(addItem);
  relicItems.forEach(addItem);
  walls.forEach((_, key) => set.add(key));
  // build 46: hazards and power-ups, shed skins, the Hunter and Echoes
  entities.forEach(e => { if (!ENTITY_TYPES[e.type].global) addItem(e); });
  husks.forEach(h => h.cells.forEach(c => set.add(cellKey(c.x, c.y))));
  if (hunter && hunter.alive) hunter.cells.forEach(c => set.add(cellKey(c.x, c.y)));
  if (echo && echo.active) echoCells().forEach(c => set.add(cellKey(c.x, c.y)));
  return set;
}

function areaFree(set, x, y, size) {
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (set.has(cellKey(x + i * cell, y + j * cell))) return false;
    }
  }
  return true;
}

function findFreeSpot(size = 1, avoid) {
  const set = occupiedSet();
  const max = cellsAcross - size;
  const okSpot = (x, y) => areaFree(set, x, y, size) && (!avoid || !avoid(x, y));
  for (let attempt = 0; attempt < 300; attempt++) {
    const x = getRandomInt(0, max + 1) * cell;
    const y = getRandomInt(0, max + 1) * cell;
    if (okSpot(x, y)) return { x, y };
  }
  for (let gy = 0; gy <= max; gy++) {
    for (let gx = 0; gx <= max; gx++) {
      if (okSpot(gx * cell, gy * cell)) return { x: gx * cell, y: gy * cell };
    }
  }
  return null;
}

/* ----- Endless tunnel ----- */
function endlessWallAt(worldCol) {
  const e = endlessCfg;
  const phase = 0.5 + 0.5 * Math.cos((2 * Math.PI * worldCol) / e.period);
  return Math.round(e.minWall + (e.maxWall - e.minWall) * phase);
}

function endlessRows(worldX) {
  const t = endlessWallAt(Math.floor(worldX / cell));
  return [t, cellsAcross - t];
}

/* First column that is fully off the right edge of the screen */
function endlessSpawnX() {
  return (Math.floor((endless.camera + boardSize) / cell) + 1) * cell;
}

function findEndlessSpot(worldX, size = 1) {
  let top = 0;
  let bottom = cellsAcross;
  for (let i = 0; i < size; i++) {
    const [t, b] = endlessRows(worldX + i * cell);
    top = Math.max(top, t);
    bottom = Math.min(bottom, b);
  }
  if (bottom - top < size) return null;
  const set = occupiedSet();
  for (let attempt = 0; attempt < 20; attempt++) {
    const y = getRandomInt(top, bottom - size + 1) * cell;
    if (areaFree(set, worldX, y, size)) return { x: worldX, y };
  }
  return null;
}

function endlessDistance() {
  return endless ? Math.floor(endless.camera / cell) : 0;
}

/* ----- Speed effects (fire and molasses) ----- */
function speedFactor(ts) {
  let f = 1;
  if (ts < fx.fastUntil) f *= FIRE_BOOST;
  if (ts < fx.slowUntil) f /= fx.slowFactor;
  return f;
}

function currentInterval(ts) {
  return moveInterval / speedFactor(ts);
}

function stepProgress(ts) {
  return Math.min(1, Math.max(0, (ts - lastMoveTs) / currentInterval(ts)));
}

/* ----- Spawning ----- */
function rollGrade(sizes) {
  if (!sizes) return 1;
  const r = Math.random() * 100;
  if (sizes.l && r < sizes.l) return 2;
  if (sizes.s && r < (sizes.l || 0) + sizes.s) return 0;
  return 1;
}

/* Finds room for an item of a given size; large falls back to normal if the board is crowded */
function spotFor(grade, worldX) {
  const tryGrade = g => {
    const span = g === 2 ? 2 : 1;
    const spot = edgeMode === "endless" ? findEndlessSpot(worldX, span) : edgeMode === "maze" ? findMazeSpot(span) : findFreeSpot(span);
    return spot ? { x: spot.x, y: spot.y, size: span, small: g === 0 } : null;
  };
  return tryGrade(grade) || (grade === 2 ? tryGrade(1) : null);
}

/* Treasure uses Gold Rush; every other mode can get big apples from Big Appetite */
function bigAppleChance() {
  return bigSpawns ? getTrackValue("goldrush") : getTrackValue("bigappetite");
}

function rollAppleGrade() {
  if (roll(bigAppleChance())) return 2;
  return spec.apple && roll(spec.apple.s || 0) ? 0 : 1;
}

function spawnApple(worldX) {
  const spot = spotFor(rollAppleGrade(), worldX);
  if (!spot) return false;
  if (nm.fools && spot.size === 2 && roll(35)) {
    spot.fake = true;
    spot.dull = roll(getTrackValue("nm_treasure"));   // Jeweler's Eye
  }
  spot.bornAt = performance.now();
  apples.push(spot);
  return true;
}

/* Rotten apples don't count: a fresh one grows when one rots */
function maintainApples() {
  while (apples.filter(a => !a.rotten).length < targetApples) {
    if (!spawnApple()) break;
  }
}

function startingOrbCount() {
  return modes[currentModeKey].startOrbs + getTrackValue("welcome");
}

function maxOrbs() {
  return Math.max(MAX_ORBS, startingOrbCount());
}

function makeOrb(spot) {
  if (spot.size === 2) {
    const now = performance.now();
    spot.spawnAt = now;
    spot.expiresAt = now + getRandomInt(...LIFETIME.xpLarge);   // big XP doesn't wait around
  }
  orbs.push(spot);
}

function spawnOrb(worldX) {
  if (orbs.filter(o => !o.placed).length >= MAX_ORBS && (edgeMode === "maze" || orbs.length >= maxOrbs())) return;
  const x = edgeMode === "endless" ? (worldX === undefined ? endlessSpawnX() : worldX) : undefined;
  const spot = spotFor(rollGrade(spec.xp), x);
  if (spot) makeOrb(spot);
}

function spawnStartingOrbs() {
  const count = startingOrbCount();
  if (edgeMode === "endless") {
    // Spread them along the tunnel ahead so they scroll in over the first stretch
    for (let i = 0; i < count; i++) {
      const spot = spotFor(rollGrade(spec.xp), (ENDLESS.startCol + 4 + i * 3) * cell);
      if (spot) makeOrb(spot);
    }
  } else if (edgeMode === "maze") {
    for (let i = 0; i < count; i++) {
      const g = rollGrade(spec.xp);
      const at = findMazeSpot(g === 2 ? 2 : 1, true);
      if (at) orbs.push({ x: at.x, y: at.y, size: g === 2 ? 2 : 1, small: g === 0, placed: true });
    }
  } else {
    for (let i = 0; i < count; i++) spawnOrb();
  }
}

function spawnPopsicle(worldX) {
  const sizes = spec.popsicle || {};
  const spot = spotFor(rollGrade(sizes), worldX);
  if (!spot) return;

  const isBonusApple = roll(getTrackValue("luck"));
  const now = performance.now();
  let life = getRandomInt(...LIFETIME.popsicle);
  if (edgeMode === "endless") life = isBonusApple ? 6000 : 1e9; // they scroll away instead
  else if (!isBonusApple && currentModeKey === "mirror") life *= 1 - getTrackValue("melt") / 100;

  popsicles.push(Object.assign(spot, { isBonusApple, spawnAt: now, expiresAt: now + life }));
  if (isBonusApple) save.stats.popsiclesConverted++;
}

/* Fleas hop to a nearby free square every so often */
const FLEA_HOP_MS = [450, 900];
const FLEA_HOP_ANIM = 160;

function fleaCanLand(h, x, y, set) {
  const span = h.size || 1;
  for (let i = 0; i < span; i++) for (let j = 0; j < span; j++) {
    const cx = x + i * cell;
    const cy = y + j * cell;
    if (set.has(cellKey(cx, cy))) return false;
    if (edgeMode === "maze") {
      if (cx >= maze.W || cy >= maze.W) return false;     // stay off the wrap seam
    } else if (edgeMode === "endless") {
      const [top, bottom] = endlessRows(cx);
      if (cy < top * cell || cy >= bottom * cell || cx < endless.camera) return false;
    } else if (cx < 0 || cy < 0 || cx >= boardSize || cy >= boardSize) {
      return false;
    }
  }
  return true;
}

function hopFleas(ts) {
  let set = null;
  hazards.forEach(h => {
    if (h.type !== "flea") return;
    if (!h.nextHop) { h.nextHop = ts + getRandomInt(...FLEA_HOP_MS); return; }
    if (ts < h.nextHop) return;
    h.nextHop = ts + getRandomInt(...FLEA_HOP_MS);
    if (!set) {
      set = occupiedSet();
      // the cell in front of the head counts as taken, so a flea never hops into your mouth
      set.add(cellKey(snake.x + snake.dx, snake.y + snake.dy));
    }
    const span = h.size || 1;
    for (let i = 0; i < span; i++) for (let j = 0; j < span; j++) set.delete(cellKey(h.x + i * cell, h.y + j * cell));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      let nx = h.x + dx * cell;
      let ny = h.y + dy * cell;
      if (edgeMode === "maze") { nx = wrapW(nx); ny = wrapW(ny); }
      if (!fleaCanLand(h, nx, ny, set)) continue;
      h.fromX = h.x;
      h.fromY = h.y;
      h.hopAt = ts;
      h.x = nx;
      h.y = ny;
      break;
    }
    for (let i = 0; i < span; i++) for (let j = 0; j < span; j++) set.add(cellKey(h.x + i * cell, h.y + j * cell));
  });
}

function spawnHazard(type, worldX) {
  const spot = spotFor(rollGrade(spec[type]), worldX);
  if (!spot) return;
  const now = performance.now();
  const life = edgeMode === "endless" ? 1e9 : getRandomInt(...LIFETIME[type]);
  hazards.push(Object.assign(spot, { type, spawnAt: now, expiresAt: now + life }));
}

/* Rocks are placed once at the start of a run, away from where the snake begins */
function placeRocks() {
  const r = spec.rock;
  if (!r || !r.count) return;
  const hx = snake.x / cell;
  const hy = snake.y / cell;
  const avoid = (x, y) => {
    const cx = x / cell;
    const cy = y / cell;
    if (Math.abs(cy - hy) <= 1 && cx >= hx - 2 && cx <= hx + 7) return true;   // the lane ahead
    return Math.abs(cx - hx) + Math.abs(cy - hy) < 4;
  };
  for (let i = 0; i < r.count; i++) {
    if (currentModeKey === "challenge" && roll(getTrackValue("rockdodge"))) continue;
    let g = rollGrade(r);
    let spot = null;
    while (!spot && g >= 0) {
      const span = g === 2 ? 2 : 1;
      const at = edgeMode === "maze" ? findMazeSpot(span, true) : findFreeSpot(span, avoid);
      if (at) spot = { x: at.x, y: at.y, size: span, small: g === 0 };
      g = g === 2 ? 1 : -1;
    }
    if (spot) rocks.push(spot);
  }
}

function randomDelay(range) {
  return getRandomInt(range[0], range[1]);
}

function resetSpawnTimers() {
  spawnTimers = {};
  ["popsicle", "flea", "fire", "molasses"].concat(ENTITY_KEYS).forEach(t => {
    if (spec[t] && spec[t].delay) spawnTimers[t] = randomDelay(spec[t].delay);
  });
}

/* Lucky Charms (the Great Tree) brings power-ups round sooner */
const powerHaste = () => 1 + getTrackValue("lucky") / 100;

/* Hazard timers run on game time, so they stop while the game is paused */
function tickSpawns(delta) {
  const frozen = frozenNow(performance.now());
  Object.keys(spawnTimers).forEach(t => {
    const power = isPower(t) || t === "molasses";
    if (frozen && !power) return;                 // the Hourglass holds every hazard back
    spawnTimers[t] -= delta * (power ? powerHaste() : save.dev.hazardMult);
    if (spawnTimers[t] > 0) return;
    spawnTimers[t] = randomDelay(spec[t].delay);
    const count = t === "popsicle" ? popsicles.length : ENTITY_TYPES[t] ? entities.filter(e => e.type === t).length : hazards.filter(h => h.type === t).length;
    if (count >= spec[t].max) return;
    if (runBoosts.repellent && !power && roll(50)) return;
    if (ENTITY_TYPES[t]) {
      spawnEntity(t, edgeMode === "endless" ? endlessSpawnX() : undefined);
    } else if (t === "popsicle") {
      if (roll(getTrackValue("popcontrol"))) return;
      spawnPopsicle();
    } else {
      spawnHazard(t);
    }
  });
}

/* Kept for older callers: wipes popsicles and other timed hazards */
function stopPopsicles() {
  popsicles = [];
  hazards = [];
  spawnTimers = {};
  if (popsicleSpawnTimeout !== null) {
    clearTimeout(popsicleSpawnTimeout);
    popsicleSpawnTimeout = null;
  }
}

function schedulePopsicle() {
  resetSpawnTimers();
}
