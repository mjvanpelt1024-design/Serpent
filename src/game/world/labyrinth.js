/* =========================================================
   src/game/world/labyrinth.js
   The Labyrinth's maze generator (settings and seed from its world folder)
   ========================================================= */
"use strict";

/* ----- Labyrinth: a wrap-around maze with 3-wide corridors.
   Every run starts in a clearing the size of a normal board, with one way out
   through the middle of each wall. Close to the clearing the maze is loose and
   forgiving; it tightens the further out you go. ----- */
const MAZE = Object.assign({ cells: 20, span: 4, clear: 5 }, (CONTENT.worlds.labyrinth && CONTENT.worlds.labyrinth.info.generator) || {});   // labyrinth/world.txt

const wrapW = v => (maze ? ((v % maze.W) + maze.W) % maze.W : v);
function wrapDelta(d) {
  const W = maze.W;
  d = ((d % W) + W) % W;
  return d > W / 2 ? d - W : d;
}

function buildMaze() {
  // Every random choice comes from the island's seed (labyrinth/seed.txt)
  const rng = worldRandom("labyrinth");
  const getRandomInt = rng.int;
  const N = MAZE.cells;
  const S = MAZE.span;
  const C = MAZE.clear;
  const T = N * S;
  const east = Array.from({ length: N }, () => Array(N).fill(false));
  const south = Array.from({ length: N }, () => Array(N).fill(false));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const wrap = v => (v + N) % N;
  const ci = getRandomInt(0, N), cj = getRandomInt(0, N);        // the clearing's top-left cell
  // how many cells away from the clearing a cell is (on the torus)
  const ringDist = (i, j) => {
    const d = (v, c) => { const r = ((v - c) % N + N) % N; return r < C ? 0 : Math.min(r - C + 1, N - r); };
    return Math.max(d(i, ci), d(j, cj));
  };

  // Carve a perfect maze on a torus, then knock out extra walls: lots near the clearing, fewer far away
  const stack = [[getRandomInt(0, N), getRandomInt(0, N)]];
  seen[stack[0][0]][stack[0][1]] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([a, b]) => [wrap(i + a), wrap(j + b), a, b])
      .filter(([a, b]) => !seen[a][b]);
    if (!next.length) { stack.pop(); continue; }
    const [ni, nj, a, b] = next[getRandomInt(0, next.length)];
    if (a === 1) east[i][j] = true;
    if (a === -1) east[ni][nj] = true;
    if (b === 1) south[i][j] = true;
    if (b === -1) south[ni][nj] = true;
    seen[ni][nj] = true;
    stack.push([ni, nj]);
  }
  const looseness = d => (d <= 1 ? 0.55 : d === 2 ? 0.38 : d === 3 ? 0.26 : 0.15);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = looseness(ringDist(i, j));
    if (!east[i][j] && rng() < p) east[i][j] = true;
    if (!south[i][j] && rng() < p) south[i][j] = true;
  }

  maze = { N, S, T, W: T * cell, east, south, groups: [], prev: [] };
  walls = new Map();
  const k = (tx, ty) => cellKey(((tx % T) + T) % T * cell, ((ty % T) + T) % T * cell);
  const wall = (tx, ty) => walls.set(k(tx, ty), "red");
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * S;
    const y = j * S;
    wall(x + S - 1, y + S - 1);
    for (let t = 0; t < S - 1; t++) {
      if (!east[i][j]) wall(x + S - 1, y + t);
      if (!south[i][j]) wall(x + t, y + S - 1);
    }
  }

  // The clearing: open ground the size of a board, walled in, with one gap in the middle of each side
  const X0 = ci * S, Y0 = cj * S, L = C * S;          // inside runs X0 .. X0+L-2
  for (let x = X0; x <= X0 + L - 2; x++) for (let y = Y0; y <= Y0 + L - 2; y++) walls.delete(k(x, y));
  const mid = Math.floor(C / 2) * S;                  // the middle cell along each side
  const gap = t => t >= mid && t < mid + S - 1;
  for (let t = -1; t <= L - 1; t++) {
    if (!gap(t)) { wall(X0 + t, Y0 - 1); wall(X0 + t, Y0 + L - 1); wall(X0 - 1, Y0 + t); wall(X0 + L - 1, Y0 + t); }
  }
  // and the corridor beyond each gap is kept open, so every way out really leads somewhere
  for (let t = 0; t < S - 1; t++) for (let d = 0; d < S - 1; d++) {
    walls.delete(k(X0 + mid + t, Y0 - 2 - d)); walls.delete(k(X0 + mid + t, Y0 + L + d));
    walls.delete(k(X0 - 2 - d, Y0 + mid + t)); walls.delete(k(X0 + L + d, Y0 + mid + t));
  }

  // Dead ends away from the clearing: the wall at the closed end can become a purple portal
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (ringDist(i, j) <= 1) continue;
    const open = { e: east[i][j], w: east[wrap(i - 1)][j], s: south[i][j], n: south[i][wrap(j - 1)] };
    const count = Object.values(open).filter(Boolean).length;
    if (count !== 1) continue;
    const x = i * S;
    const y = j * S;
    const span = Array.from({ length: S - 1 }, (_, t) => t);
    let g;
    if (open.e) g = { tiles: span.map(t => k(x - 1, y + t)), exits: span.map(t => [x, y + t]), dx: cell, dy: 0 };
    else if (open.w) g = { tiles: span.map(t => k(x + S - 1, y + t)), exits: span.map(t => [x + S - 2, y + t]), dx: -cell, dy: 0 };
    else if (open.s) g = { tiles: span.map(t => k(x + t, y - 1)), exits: span.map(t => [x + t, y]), dx: 0, dy: cell };
    else g = { tiles: span.map(t => k(x + t, y + S - 1)), exits: span.map(t => [x + t, y + S - 2]), dx: 0, dy: -cell };
    if (!g.tiles.every(t => walls.has(t))) continue;
    g.exits = g.exits.map(([tx, ty]) => ({ x: (((tx % T) + T) % T) * cell, y: (((ty % T) + T) % T) * cell }));
    g.purple = rng() < 0.45;
    if (g.purple) g.tiles.forEach(t => walls.set(t, "purple"));
    maze.groups.push(g);
  }

  // Start in the middle of the clearing, heading east
  const sx = ((X0 + Math.floor(L / 2) - 4) % T + T) % T, sy = ((Y0 + Math.floor(L / 2)) % T + T) % T;
  return { x: sx * cell, y: sy * cell };
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
