/* =========================================================
   src/game/flow/nightmares.js
   Nightmare twists, inner walls and portals
   ========================================================= */
"use strict";

/* =========================================================
   Nightmares, inner walls, portals and the Labyrinth
   ========================================================= */
let currentNightmare = false;   // playing the Nightmare version of currentModeKey
let nm = {};                    // this run's twist
let runReversed = false;        // Topsy-Turvy
let nmAccumulator = 0;
let endlessCfg = { ...ENDLESS };
let innerSegments = [];         // Inferno's inner walls, as segments
let maze = null;                // Labyrinth state
let baseInterval = 200;

function applyNightmare() {
  nm = {};
  runReversed = false;
  endlessCfg = { ...ENDLESS };
  baseInterval = moveInterval;
  if (!currentNightmare) return;

  scoreMultiplier = modes[currentModeKey].nmMultiplier * (1 + getTrackValue("baddreams") / 100);
  spec = JSON.parse(JSON.stringify(spec));   // copy, so the twist never edits the table
  const k = currentModeKey;
  if (k === "easy") nm.starve = true;
  if (k === "classic") nm.dark = true;
  if (k === "challenge") nm.avalanche = true;
  if (k === "insane") nm.noMercy = true;
  if (k === "chaos") nm.sugar = true;
  if (k === "mirror") nm.flip = true;
  if (k === "treasure") nm.fools = true;
  if (k === "endless") Object.assign(endlessCfg, { maxWall: 7, minWall: 3, scrollRatio: 0.93 - getTrackValue("nm_endless") / 100 });
  if (k === "inferno") spec.fire = { max: 10 - getTrackValue("nm_inferno"), delay: [700, 1800], s: 20, l: 40 };
  if (k === "labyrinth") {
    spec.molasses = { max: 10, delay: [1500, 3500], s: 30, l: 30 };
    nm.wildPortals = true;
  }
  // Islands from build 46 describe their twist in the [nightmare] part of world.txt:
  // flags, an apple rot time, and [nightmare.spawns.<type>] to change what turns up
  const twist = (CONTENT.worlds[k] && CONTENT.worlds[k].info.nightmare) || {};
  if (twist.spawns) Object.entries(twist.spawns).forEach(([type, o]) => { spec[type] = Object.assign({}, spec[type] || {}, o); });
  NIGHTMARE_FLAGS.forEach(f => { if (twist[f] === true) nm[f] = true; });
  if (typeof twist.rot === "number") nm.rot = twist.rot;
}
const NIGHTMARE_FLAGS = ["hunter", "echoes", "overgrowth", "supercell", "shortfuse", "poltergeist", "overclock", "fastsink"];

/* Returns true if Dream Catcher saved you */
function dreamCatch(text) {
  if (!roll(getTrackValue("dreamcatcher"))) return false;
  showToast("Dream Catcher! " + text);
  sfx("buy");
  return true;
}

/* Called every frame during a Nightmare */
function tickNightmare(delta) {
  if (!currentNightmare && !nm.custom) return;
  nmAccumulator += delta;
  const starveMs = 4000 + getTrackValue("nm_easy") * 1000;
  const rockMs = 2500 + getTrackValue("nm_challenge") * 1000;
  if (nm.starve && nmAccumulator >= starveMs) {
    nmAccumulator -= starveMs;
    snake.maxCells--;
    while (snake.cells.length > Math.max(1, snake.maxCells)) snake.cells.pop();
    if (snake.maxCells < 2) {
      if (dreamCatch("You found a crumb.")) snake.maxCells = 3;
      else endGame("hunger");
    }
  }
  if (nm.avalanche && nmAccumulator >= rockMs) {
    nmAccumulator -= rockMs;
    if (rocks.length < 30) {
      const g = rollGrade({ s: 20, l: 25 });
      const span = g === 2 ? 2 : 1;
      const hx = snake.x / cell;
      const hy = snake.y / cell;
      const at = findFreeSpot(span, (x, y) => Math.abs(x / cell - hx) + Math.abs(y / cell - hy) < 4);
      if (at) rocks.push({ x: at.x, y: at.y, size: span, small: g === 0 });
    }
  }
  if (!nm.starve && !nm.avalanche) nmAccumulator = 0;
}

/* ----- Inferno: walls in the middle of the board ----- */
function buildInnerWalls() {
  innerSegments = [];
  if (!modes[currentModeKey].innerWalls) return;
  const n = cellsAcross;
  const hx = snake.x / cell;
  const hy = snake.y / cell;
  const place = kind => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const vertical = Math.random() < 0.5;
      const len = getRandomInt(4, 9);
      const x0 = getRandomInt(3, n - 3 - (vertical ? 0 : len));
      const y0 = getRandomInt(3, n - 3 - (vertical ? len : 0));
      const cells = [];
      for (let i = 0; i < len; i++) cells.push([x0 + (vertical ? 0 : i), y0 + (vertical ? i : 0)]);
      const bad = cells.some(([cx, cy]) => {
        if (Math.abs(cy - hy) <= 2 && cx >= hx - 4 && cx <= hx + 10) return true;   // keep the start lane clear
        for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) {
          if (walls.has(cellKey((cx + ax) * cell, (cy + ay) * cell))) return true;
        }
        return false;
      });
      if (bad) continue;
      cells.forEach(([cx, cy]) => walls.set(cellKey(cx * cell, cy * cell), kind));
      innerSegments.push({ kind, cells });
      return;
    }
  };
  for (let i = 0; i < 4; i++) place("red");
  for (let i = 0; i < 3; i++) place("purple");
}

/* Stepping into a purple wall pops you out beside a different purple wall, never into a red one */
function portalExit(fromKey) {
  if (maze) return mazePortalExit(fromKey);
  const from = innerSegments.find(sg => sg.cells.some(([x, y]) => cellKey(x * cell, y * cell) === fromKey));
  const targets = innerSegments.filter(sg => sg.kind === "purple" && sg !== from).sort(() => Math.random() - 0.5);
  const body = new Set(snake.cells.map(c => cellKey(c.x, c.y)));
  const besideSource = (x, y) => from && from.cells.some(([cx, cy]) => Math.abs(cx * cell - x) + Math.abs(cy * cell - y) <= cell);
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < boardSize && y < boardSize && !walls.has(cellKey(x, y)) && !body.has(cellKey(x, y));
  for (const strict of [true, false]) {
    const exit = findPortalExit(targets, (x, y) => inBounds(x, y) && (!strict || !besideSource(x, y)));
    if (exit) return exit;
  }
  return null;
}

function findPortalExit(targets, open) {
  for (const sg of targets) {
    const cells = sg.cells.slice().sort(() => Math.random() - 0.5);
    for (const [cx, cy] of cells) {
      const wx = cx * cell;
      const wy = cy * cell;
      // Keep going the same way if there's room, otherwise step out to any open side
      const options = [[snake.dx, snake.dy], [cell, 0], [-cell, 0], [0, cell], [0, -cell]];
      for (const [dx, dy] of options) {
        const ex = wx + dx;
        const ey = wy + dy;
        if (!open(ex, ey)) continue;
        const keepDir = open(ex + snake.dx, ey + snake.dy) && !(dx === -snake.dx && dy === -snake.dy);
        return keepDir && dx === snake.dx && dy === snake.dy
          ? { x: ex, y: ey, dx: snake.dx, dy: snake.dy }
          : { x: ex, y: ey, dx, dy };
      }
    }
  }
  return null;
}
