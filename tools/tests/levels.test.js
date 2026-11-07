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
    assert.match(L.board.join(""), /^[.#PS]*$/, name + " characters");
  }
});

test("portals: wall and exit squares are the same length, in a straight line, one step apart", () => {
  for (const [name, L] of Object.entries(levels)) {
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
  for (const name of Object.keys(levels)) {
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
