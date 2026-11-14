// Tests for the .level format and the Labyrinth's loader (content/levels/).
// Run: node --test tools/tests/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
// Objects made inside a vm context have another realm; compare them as plain data
const plain = v => JSON.parse(JSON.stringify(v));
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

// formats.js is a plain script that defines Formats
const ctx = {};
vm.createContext(ctx);
vm.runInContext(read("src/engine/content/formats.js") + "\n;this.Formats = Formats;", ctx);
const Formats = ctx.Formats;

const indexRows = Formats.table(read("content/levels/index.dat"));
const levels = Object.fromEntries(indexRows.map(([name, file]) => {
  const text = read("content/levels/" + file);
  return [String(name), Object.assign(Formats.level(text), { name: String(name), file })];
}));
// The mazes (edge = maze with a span) have portals; the campaign's 20 x 20 and field boards have none
const mazes = Object.fromEntries(Object.entries(levels).filter(([, L]) => L.head.edge === "maze" && L.head.span));

test("index maps every listed name to a file that exists", () => {
  assert.ok(indexRows.length >= 4);
  for (const [name, file] of indexRows) assert.ok(fs.existsSync(path.join(ROOT, "content/levels", String(file))), `${name}: ${file}`);
});

test("every board is size x size, has one start and only known characters", () => {
  for (const [name, L] of Object.entries(levels)) {
    const T = L.head.size;
    assert.equal(L.board.length, T, name + " rows");
    L.board.forEach(row => assert.equal(row.length, T, name + " row length"));
    const starts = L.board.join("").split("S").length - 1;
    assert.equal(starts, 1, name + " start");
    // build 56's letters: gates, doors, turrets, belts, hazards and the marks a goal or a boss arena wants (docs/BUILD-56.md)
    assert.match(L.board.join(""), /^[.#PS123><^vabcd45678GEZWN~x*Bplmoh]*$/, name + " characters");
  }
});

test("portals: wall and exit squares are the same length, in a straight line, one step apart", () => {
  assert.ok(Object.keys(mazes).length >= 8, "the Labyrinth's three mazes and the five islands' mazes");
  for (const [name, L] of Object.entries(mazes)) {
    assert.ok(L.portals.length > 0, name + " has portals");
    for (const p of L.portals) {
      assert.equal(p.wall.length, p.exit.length, name + " lengths");
      // the maze wraps, so the step may cross the seam: compare the short way round
      const T = L.head.size, short = d => ((((d + T / 2) % T) + T) % T) - T / 2;
      const dx = short(p.exit[0][0] - p.wall[0][0]), dy = short(p.exit[0][1] - p.wall[0][1]);
      assert.equal(Math.abs(dx) + Math.abs(dy), 1, name + " one step");
      p.wall.forEach((w, i) => assert.deepEqual([short(p.exit[i][0] - w[0]), short(p.exit[i][1] - w[1])], [dx, dy], name + " straight"));
    }
  }
});

test("Formats.squares reads a square, a column, a row and refuses a box", () => {
  assert.deepEqual(plain(Formats.squares("4,2")), [[4, 2]]);
  assert.deepEqual(plain(Formats.squares("4,2-4")), [[4, 2], [4, 3], [4, 4]]);
  assert.deepEqual(plain(Formats.squares("4-6,9")), [[4, 9], [5, 9], [6, 9]]);
  let warned = false;
  assert.deepEqual(plain(Formats.squares("1-2,3-4", () => { warned = true; })), []);
  assert.ok(warned);
});

// Runs the real labyrinth.js buildMaze against a level file and checks what it builds
function buildFor(name) {
  const L = levels[name];
  const cellSize = 20;
  const sandbox = {
    CONTENT: { gameLevels: levels },
    cell: cellSize,
    cellKey: (x, y) => x + "," + y,
    levelName: () => name,
    currentModeKey: "labyrinth",
    currentLevel: 0,
    campRun: null,
    walls: null,
    maze: null,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/game/world/labyrinth.js"), sandbox);
  const start = vm.runInContext("buildMaze()", sandbox);
  return { L, start, walls: sandbox.walls, maze: sandbox.maze, cellSize };
}

test("buildMaze lays out the walls, start and portals from the file", () => {
  for (const name of Object.keys(mazes)) {
    const { L, start, walls, maze, cellSize } = buildFor(name);
    const T = L.head.size;
    const expectWalls = L.board.flatMap((row, y) => [...row].map((c, x) => (c === "#" || c === "P" ? [x, y, c] : null))).filter(Boolean);
    assert.equal(walls.size, expectWalls.length, name + " wall count");
    for (const [x, y, c] of expectWalls) assert.equal(walls.get(`${x * cellSize},${y * cellSize}`), c === "P" ? "purple" : "red", name + ` ${x},${y}`);
    const sy = L.board.findIndex(row => row.includes("S"));
    assert.deepEqual(plain(start), { x: L.board[sy].indexOf("S") * cellSize, y: sy * cellSize }, name + " start");
    assert.equal(maze.T, T);
    assert.equal(maze.W, T * cellSize);
    assert.equal(maze.groups.length, L.portals.length, name + " groups");
    maze.groups.forEach((g, i) => assert.equal(g.purple, walls.get(g.tiles[0]) === "purple", name + " purple " + i));
  }
});

test("every campaign level has a board file, and only the scroller is left without one", () => {
  const dir = path.join(ROOT, "content/campaign/islands");
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const isl = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    isl.levels.forEach((def, i) => {
      const id = `${isl.id}-${i + 1}`;
      if (def.layout === "tunnel") return;
      const L = levels[id];
      assert.ok(L, `${id} is listed in content/levels/index.dat`);
      const want = def.layout === "maze" ? 80 : def.layout === "field" ? 48 : 20;
      assert.equal(L.head.size, want, `${id} size`);
      if (def.layout === "pulse") assert.match(L.board.join(""), /[123]/, `${id} has pulse walls`);
    });
  }
});

test("a sandbox level file reads as a game level", () => {
  const ctx2 = {};
  vm.createContext(ctx2);
  vm.runInContext(read("src/game/sandbox/level-file.js") + "\n;this.levelFileText = levelFileText;", ctx2);
  const g = "S" + ".".repeat(19) + ("#".repeat(20)) + ".".repeat(360);
  const text = ctx2.levelFileText({ n: "Drop-in", e: "a", s: 7, g, pv: {}, ph: {}, k: "", th: "", vn: 0, it: [], off: [], sc: {}, b: "", bf: 3, r: { h: 3, ar: true, t: [] } });
  const L = Formats.level(text);
  assert.equal(L.head.size, 20);
  assert.equal(L.board.length, 20);
  assert.equal(L.board[0][0], "S");
  assert.equal(L.board[1], "#".repeat(20));
});