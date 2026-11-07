// Round trip for sandbox .level files (src/game/sandbox/level-file.js).
// Run: node --test tools/tests/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "src/game/sandbox/level-file.js"), "utf8") + "\n;this.levelFileText = levelFileText; this.parseLevelFile = parseLevelFile;", ctx);
const plain = v => JSON.parse(JSON.stringify(v));

function sample() {
  const g = Array(400).fill(".");
  g[10 * 20 + 5] = "S"; g[10 * 20 + 14] = "A"; g[3 * 20 + 3] = "#"; g[4 * 20 + 3] = "P";
  return { n: "The Donut", e: "a", s: 10, g: g.join(""), pv: { "3,4": "r" }, ph: { "7,8": "p" }, k: "classic", th: "black",
    vn: 4, it: ["booster"], off: ["rock"], sc: { popsicle: [[0, 3], [0, 9]], flea: [[19, 5]] }, r: { h: 2, ar: false, t: ["dark"] } };
}

test("a level survives writing and reading as .level text", () => {
  const L = sample();
  const text = ctx.levelFileText(L);
  const back = plain(ctx.parseLevelFile(text));
  assert.equal(back.n, "The Donut");
  assert.equal(back.e, "a");
  assert.equal(back.s, 10);
  assert.equal(back.g, L.g);
  assert.deepEqual(back.pv, L.pv);
  assert.deepEqual(back.ph, L.ph);
  assert.equal(back.k, "classic");
  assert.equal(back.th, "black");
  assert.equal(back.vn, 4);
  assert.deepEqual(back.it, ["booster"]);
  assert.deepEqual(back.off, ["rock"]);
  assert.deepEqual(back.sc, L.sc);
  assert.equal(back.r.h, 2);
  assert.equal(back.r.ar, false);
  assert.deepEqual(back.r.t, ["dark"]);
});

test("bad files are refused", () => {
  assert.equal(ctx.parseLevelFile("name = x\n"), null);
  assert.equal(ctx.parseLevelFile("---\n" + "..\n".repeat(3)), null);
  const bad = levelRows(() => "?");
  assert.equal(ctx.parseLevelFile("---\n" + bad), null);
});

function levelRows(fn) {
  return Array.from({ length: 20 }, () => Array.from({ length: 20 }, fn).join("")).join("\n");
}
