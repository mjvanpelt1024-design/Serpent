/* =========================================================
   src/game/world/labyrinth.js
   The Labyrinth's mazes. Every maze is a .level file (content/levels/, listed in
   index.dat); nothing here generates a layout. Format: docs/CONTENT-FORMATS.md (Levels).
   ========================================================= */
"use strict";

/* ----- Labyrinth: a wrap-around maze, read from its .level file. Each file has the walls
   (red #, portal P), the snake's start (S) and the dead-end portals. ----- */

const wrapW = v => (maze ? ((v % maze.W) + maze.W) % maze.W : v);
function wrapDelta(d) {
  const W = maze.W;
  d = ((d % W) + W) % W;
  return d > W / 2 ? d - W : d;
}

/* The name of the level being played: the campaign's maze, or the island's level */
function mazeLevelName() {
  if (campRun) return campRun.def.name;
  return levelName(currentModeKey, currentLevel);
}

/* Builds the maze for this run from its .level file and returns where the snake starts */
function buildMaze() {
  const name = mazeLevelName();
  const L = CONTENT.gameLevels[name];
  walls = new Map();
  if (!L) {
    console.warn(`No .level file for "${name}": check content/levels/index.dat`);
    maze = { N: 1, S: 4, T: 20, W: 20 * cell, groups: [], prev: [] };
    return { x: 0, y: 0 };
  }
  const T = L.head.size || L.board.length;
  const S = L.head.span || 4;
  if (L.board.length !== T || L.board.some(row => row.length !== T)) {
    console.warn(`${L.file}: the board should be ${T} rows of ${T} squares`);
  }
  let start = { x: 0, y: 0 };
  L.board.forEach((row, y) => [...row].forEach((ch, x) => {
    const key = cellKey(x * cell, y * cell);
    if (ch === "#") walls.set(key, "red");
    else if (ch === "P") walls.set(key, "purple");
    else if (ch === "S") start = { x: x * cell, y: y * cell };
  }));
  // Each portal: its wall squares lead to its exit squares, one square away from the wall.
  // The maze wraps, so a step can cross the seam: take the short way round.
  const short = d => ((((d + T / 2) % T) + T) % T) - T / 2;
  const groups = L.portals.map(p => {
    const [w0, e0] = [p.wall[0], p.exit[0]];
    return {
      tiles: p.wall.map(([x, y]) => cellKey(x * cell, y * cell)),
      exits: p.exit.map(([x, y]) => ({ x: x * cell, y: y * cell })),
      dx: short(e0[0] - w0[0]) * cell,
      dy: short(e0[1] - w0[1]) * cell,
      purple: walls.get(cellKey(w0[0] * cell, w0[1] * cell)) === "purple"
    };
  });
  maze = { N: T / S, S, T, W: T * cell, groups, prev: [] };
  return start;
}

function mazePortalExit(fromKey) {
  const from = maze.groups.find(g => g.tiles.includes(fromKey));
  const near = g => g.exits.every(e => Math.abs(wrapDelta(e.x - snake.x)) <= 8 * cell && Math.abs(wrapDelta(e.y - snake.y)) <= 8 * cell);
  const wild = nm.wildPortals && !roll(getTrackValue("nm_labyrinth"));
  let pool = maze.groups.filter(g => g !== from && g.purple && (wild || near(g)));
  if (!pool.length && !wild) {
    // No other portal on screen: turn a nearby dead end purple so the link always lands in view
    const reds = maze.groups.filter(g => g !== from && !g.purple && near(g));
    if (reds.length) {
      const g = reds[getRandomInt(0, reds.length)];
      g.purple = true;
      g.tiles.forEach(t => walls.set(t, "purple"));
      pool = [g];
    }
  }
  if (!pool.length && !wild) {
    const made = makeOnScreenPortal();
    if (made) pool = [made];
  }
  if (!pool.length) pool = maze.groups.filter(g => g !== from && g.purple);
  if (!pool.length) return null;
  const body = new Set(snake.cells.map(c => cellKey(c.x, c.y)));
  const g = pool[getRandomInt(0, pool.length)];
  const exit = g.exits.find(e => !body.has(cellKey(e.x, e.y))) || g.exits[0];
  return { x: exit.x, y: exit.y, dx: g.dx, dy: g.dy, near: near(g) };
}

/* Turns a wall on screen into a portal, with open corridor in front of it */
function makeOnScreenPortal() {
  const T = maze.T;
  const hx = snake.x / cell;
  const hy = snake.y / cell;
  const body = new Set(snake.cells.map(c => cellKey(c.x, c.y)));
  const key = (tx, ty) => cellKey((((tx % T) + T) % T) * cell, (((ty % T) + T) % T) * cell);
  const free = (tx, ty) => !walls.has(key(tx, ty)) && !body.has(key(tx, ty));
  const tries = [];
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (Math.abs(dx) + Math.abs(dy) >= 4) tries.push([dx, dy]);
  tries.sort(() => Math.random() - 0.5);
  for (const [dx, dy] of tries) {
    const tx = hx + dx;
    const ty = hy + dy;
    if (walls.get(key(tx, ty)) !== "red") continue;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // two open squares straight out from the wall, so you don't pop out into another wall
      if (!free(tx + ax, ty + ay) || !free(tx + ax * 2, ty + ay * 2)) continue;
      const ex = ((tx + ax) % T + T) % T;
      const ey = ((ty + ay) % T + T) % T;
      const g = { tiles: [key(tx, ty)], exits: [{ x: ex * cell, y: ey * cell }], dx: ax * cell, dy: ay * cell, purple: true };
      walls.set(g.tiles[0], "purple");
      maze.groups.push(g);
      return g;
    }
  }
  return null;
}

function findMazeSpot(span, anywhere = false) {
  const set = occupiedSet();
  const hx = snake.x / cell;
  const hy = snake.y / cell;
  const T = maze.T;
  for (let attempt = 0; attempt < 250; attempt++) {
    let tx;
    let ty;
    if (anywhere) {
      tx = getRandomInt(0, T);
      ty = getRandomInt(0, T);
    } else {
      const dx = getRandomInt(-12, 13);
      const dy = getRandomInt(-12, 13);
      if (Math.abs(dx) + Math.abs(dy) < 4) continue;
      tx = ((hx + dx) % T + T) % T;
      ty = ((hy + dy) % T + T) % T;
    }
    if (tx > T - span || ty > T - span) continue;   // big items never straddle the wrap seam
    if (anywhere && Math.abs(tx - hx) + Math.abs(ty - hy) < 6) continue;
    if (areaFree(set, tx * cell, ty * cell, span)) return { x: tx * cell, y: ty * cell };
  }
  return null;
}

function mazeDistance(it) {
  return Math.max(Math.abs(wrapDelta(it.x - snake.x)), Math.abs(wrapDelta(it.y - snake.y))) / cell;
}
