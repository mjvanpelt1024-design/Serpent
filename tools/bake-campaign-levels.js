// Writes every campaign level's board to a .level file in content/levels/campaign/.
// One-off migration (build 53): the boards used to be built in code (camp-levels.js LAYOUTS,
// the seeded field, the seeded maze). Now the game reads the files, and nothing generates a board.
// Run: node tools/bake-campaign-levels.js [--force]   (existing files are kept unless --force)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "content", "levels", "campaign");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const force = process.argv.includes("--force");

// camp-levels.js and random.js are plain scripts; run them with just enough globals for their builders
const ctx = { walls: null, maze: null, snake: {}, cell: 1, cellKey: (x, y) => `${x},${y}`, performance: { now: () => 0 } };
vm.createContext(ctx);
vm.runInContext(read("src/engine/core/random.js") + "\n" + read("src/campaign/camp-levels.js") +
  "\n;this.LAYOUTS = LAYOUTS; this.pulseSets = pulseSets; this.campBuildField = campBuildField; this.FIELD_T = FIELD_T;" +
  " this.seededRandom = seededRandom; this.seedFromText = seedFromText;", ctx);

const header = (title, lines) => [
  "# ==================================================================",
  `#  ${title}`,
  "#  A campaign level's board. Format: docs/CONTENT-FORMATS.md (Levels).",
  "#  The island's file (content/campaign/islands/) still holds the goal, speed and spawns;",
  "#  this file is the board: walls, portal walls and where the snake starts.",
  "#    .  open   #  red wall   P  portal wall   S  snake start",
  "#    1 2 3  pulse walls: 1 up first, 2 up second, 3 always up",
  "# ==================================================================",
  "",
  ...lines
];

function grid(T) { return Array.from({ length: T }, () => Array(T).fill(".")); }

/* A static 20 x 20 board, or a pulse board */
function staticBoard(def) {
  const L = ctx.LAYOUTS[def.layout] ? ctx.LAYOUTS[def.layout]() : ctx.LAYOUTS.open();
  const g = grid(20);
  L.cells.forEach(([x, y]) => { if (x >= 0 && y >= 0 && x < 20 && y < 20) g[y][x] = "#"; });
  if (def.layout === "pulse") {
    const [a, b] = ctx.pulseSets();
    const ka = new Set(a.map(p => p.join(","))), kb = new Set(b.map(p => p.join(",")));
    new Set([...ka, ...kb]).forEach(k => {
      const [x, y] = k.split(",").map(Number);
      g[y][x] = ka.has(k) && kb.has(k) ? "3" : ka.has(k) ? "1" : "2";
    });
  }
  const [sx, sy] = L.start;
  g[sy][sx] = "S";
  return { size: 20, rows: g.map(r => r.join("")), portals: [] };
}

/* The field: a 48 x 48 wrap-around hall, from its old seed */
function fieldBoard(seedText) {
  const start = ctx.campBuildField(seedText);
  const T = ctx.FIELD_T, g = grid(T);
  ctx.walls.forEach((v, k) => { const [x, y] = k.split(",").map(Number); g[y][x] = "#"; });
  g[start.y][start.x] = "S";
  return { size: T, rows: g.map(r => r.join("")), portals: [] };
}

/* A maze: the old Labyrinth generator (removed from labyrinth.js in 0eccdbe), seeded per level */
function mazeBoard(seedText) {
  const rng = ctx.seededRandom(ctx.seedFromText(seedText));
  const int = (min, max) => min + Math.floor(rng() * (max - min));
  const N = 20, S = 4, C = 5, T = N * S;
  const east = Array.from({ length: N }, () => Array(N).fill(false));
  const south = Array.from({ length: N }, () => Array(N).fill(false));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const wrap = v => (v + N) % N;
  const ci = int(0, N), cj = int(0, N);
  const ringDist = (i, j) => {
    const d = (v, c) => { const r = ((v - c) % N + N) % N; return r < C ? 0 : Math.min(r - C + 1, N - r); };
    return Math.max(d(i, ci), d(j, cj));
  };
  const stack = [[int(0, N), int(0, N)]];
  seen[stack[0][0]][stack[0][1]] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [wrap(i + a), wrap(j + b), a, b]).filter(([a, b]) => !seen[a][b]);
    if (!next.length) { stack.pop(); continue; }
    const [ni, nj, a, b] = next[int(0, next.length)];
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
  const g = grid(T);
  const m = v => ((v % T) + T) % T;
  const set = (x, y, ch) => { g[m(y)][m(x)] = ch; };
  const get = (x, y) => g[m(y)][m(x)];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * S, y = j * S;
    set(x + S - 1, y + S - 1, "#");
    for (let t = 0; t < S - 1; t++) {
      if (!east[i][j]) set(x + S - 1, y + t, "#");
      if (!south[i][j]) set(x + t, y + S - 1, "#");
    }
  }
  const X0 = ci * S, Y0 = cj * S, L = C * S;
  for (let x = X0; x <= X0 + L - 2; x++) for (let y = Y0; y <= Y0 + L - 2; y++) set(x, y, ".");
  const mid = Math.floor(C / 2) * S;
  const gap = t => t >= mid && t < mid + S - 1;
  for (let t = -1; t <= L - 1; t++) {
    if (!gap(t)) { set(X0 + t, Y0 - 1, "#"); set(X0 + t, Y0 + L - 1, "#"); set(X0 - 1, Y0 + t, "#"); set(X0 + L - 1, Y0 + t, "#"); }
  }
  for (let t = 0; t < S - 1; t++) for (let d = 0; d < S - 1; d++) {
    set(X0 + mid + t, Y0 - 2 - d, "."); set(X0 + mid + t, Y0 + L + d, ".");
    set(X0 - 2 - d, Y0 + mid + t, "."); set(X0 + L + d, Y0 + mid + t, ".");
  }
  const portals = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (ringDist(i, j) <= 1) continue;
    const open = { e: east[i][j], w: east[wrap(i - 1)][j], s: south[i][j], n: south[i][wrap(j - 1)] };
    if (Object.values(open).filter(Boolean).length !== 1) continue;
    const x = i * S, y = j * S;
    const span = Array.from({ length: S - 1 }, (_, t) => t);
    let w, e;
    if (open.e) { w = span.map(t => [x - 1, y + t]); e = span.map(t => [x, y + t]); }
    else if (open.w) { w = span.map(t => [x + S - 1, y + t]); e = span.map(t => [x + S - 2, y + t]); }
    else if (open.s) { w = span.map(t => [x + t, y - 1]); e = span.map(t => [x + t, y]); }
    else { w = span.map(t => [x + t, y + S - 1]); e = span.map(t => [x + t, y + S - 2]); }
    if (!w.every(([a, b]) => get(a, b) !== ".")) continue;
    const purple = rng() < 0.45;
    if (purple) w.forEach(([a, b]) => set(a, b, "P"));
    portals.push({ wall: w.map(([a, b]) => [m(a), m(b)]), exit: e.map(([a, b]) => [m(a), m(b)]) });
  }
  const sx = m(X0 + Math.floor(L / 2) - 4), sy = m(Y0 + Math.floor(L / 2));
  set(sx, sy, "S");
  return { size: T, span: S, rows: g.map(r => r.join("")), portals };
}

/* A line of squares as "x0-x1,y" or "x,y0-y1" (the order kept: first to last) */
function line(sq) {
  const [a, b] = [sq[0], sq[sq.length - 1]];
  if (a[1] === b[1]) return `${a[0]}${a[0] !== b[0] ? "-" + b[0] : ""},${a[1]}`;
  return `${a[0]},${a[1]}${a[1] !== b[1] ? "-" + b[1] : ""}`;
}

fs.mkdirSync(OUT, { recursive: true });
const index = [];
const islands = fs.readdirSync(path.join(ROOT, "content/campaign/islands")).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(read("content/campaign/islands/" + f))).sort((a, b) => a.n - b.n);
let wrote = 0, kept = 0;
for (const isl of islands) {
  isl.levels.forEach((def, i) => {
    const n = i + 1, id = `${isl.id}-${n}`, file = `campaign/${id}.level`;
    index.push(`${id} | ${file}`);
    const dest = path.join(OUT, `${id}.level`);
    if (fs.existsSync(dest) && !force) { kept++; return; }
    if (def.layout === "tunnel") throw new Error(`${id}: the scroller has no board (docs/PHYSICS.md)`);
    const B = def.layout === "maze" ? mazeBoard(id) : def.layout === "field" ? fieldBoard(id) : staticBoard(def);
    const edge = def.layout === "maze" ? "maze" : def.layout === "field" ? "wrap" : (def.edge || "wall");
    const lines = [
      `name    = ${def.name}`,
      `island  = ${isl.id}`,
      `level   = ${n}`,
      `layout  = ${def.layout}`,
      `size    = ${B.size}`,
      `edge    = ${edge}`
    ];
    if (B.span) lines.push(`span    = ${B.span}                       # squares per maze cell`);
    if (B.portals.length) {
      lines.push("", "# Dead-end portals: the wall squares, then the squares they lead to (straight lines).", "[portals]");
      B.portals.forEach((p, k) => lines.push(`p${String(k + 1).padStart(2, "0")} = "${line(p.wall)} > ${line(p.exit)}"`));
    }
    const text = header(def.name, lines).concat(["---"], B.rows).join("\n") + "\n";
    fs.writeFileSync(dest, text);
    wrote++;
  });
}
// ----- Nightmare mode (build 53): each tunnel level's board is its base level's board, a quarter turn
// clockwise; the Maw's board (level 11) is the island's last arena, turned the same way.
const NM = JSON.parse(read("content/campaign/nightmare.json"));
const NM_OUT = path.join(ROOT, "content", "levels", "nightmare");
fs.mkdirSync(NM_OUT, { recursive: true });
const turn = rows => rows.map((_, y) => rows.map((__, x) => rows[rows.length - 1 - x][y]).join(""));
for (const islId of NM.order) {
  const isl = islands.find(i => i.id === islId);
  const T = NM.tunnels[islId];
  for (let k = 1; k <= NM.levels + 1; k++) {
    const id = `nm-${islId}-${k}`, file = `nightmare/${islId}-${k}.level`;
    index.push(`${id} | ${file}`);
    const dest = path.join(NM_OUT, `${islId}-${k}.level`);
    if (fs.existsSync(dest) && !force) { kept++; continue; }
    const baseN = k <= NM.levels ? NM.base[k - 1] : isl.levels.length;
    const src = read(`content/levels/campaign/${islId}-${baseN}.level`).replace(/\r/g, "").split("\n");
    const rows = src.slice(src.indexOf("---") + 1).filter(l => l.trim());
    const name = k <= NM.levels ? T.names[k - 1] : `${T.name}: the Maw`;
    const lines = [`name    = ${name}`, `island  = ${islId}`, `level   = ${k}`, `tunnel  = ${T.name}`, `size    = ${rows.length}`, "edge    = wall"];
    const text = header(`${name} (nightmare, under ${isl.name})`, lines).concat(["---"], turn(rows)).join("\n") + "\n";
    fs.writeFileSync(dest, text);
    wrote++;
  }
}

console.log(`wrote ${wrote} level files, kept ${kept}; index lines:`);
console.log(index.join("\n"));
