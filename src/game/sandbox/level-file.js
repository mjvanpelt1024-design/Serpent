/* =========================================================
   src/game/sandbox/level-file.js
   Sandbox levels as .level text: write and read. No DOM, no game state,
   so tools/tests can load it. Format: docs/CONTENT-FORMATS.md (Sandbox levels)
   ========================================================= */
"use strict";

const LEVEL_FILE_SIZE = 20;
const LEVEL_FILE_CHARS = ".#PSAaXxRrOoFfHhMm@*%&!^~";
const LEVEL_FILE_EDGES = { wrap: "w", walls: "a", mirror: "m" };
const LEVEL_FILE_SPEEDS = [5, 7, 10];
const LEVEL_FILE_SPAWNERS = ["popsicle", "flea", "fire", "molasses",
  // build 52: the campaign's new enemies (content/campaign/foes.json; tools/tests/arsenal.test.js keeps the two in step)
  "knightling", "scorpion", "sparkbeetle", "inkwraith", "mantis", "viper", "frostsprite", "urchin", "firebat"];

/* Level object -> .level text. L must already be normalized. */
function levelFileText(L) {
  const edgeName = Object.keys(LEVEL_FILE_EDGES).find(k => LEVEL_FILE_EDGES[k] === L.e) || "wrap";
  const name = String(L.n || "Sandbox level").replace(/[\r\n]+/g, " ").slice(0, 24);
  const out = [
    "# Sandbox level. Format: docs/CONTENT-FORMATS.md (Sandbox levels)",
    `name     = ${name}`,
    `edge     = ${edgeName}`,
    `speed    = ${L.s}`,
    `hearts   = ${L.r.h}`,
    `apples   = ${L.r.ar ? "respawn" : "once"}`,
    `skin     = ${L.k || ""}`,
    `theme    = ${L.th || ""}`,
    `vanish   = ${L.vn || 0}          # seconds a red wall is gone, then back. 0 = off`,
    `items    = ${(L.it || []).join(", ")}`,
    `twists   = ${(L.r.t || []).join(", ")}`,
    `off      = ${(L.off || []).join(", ")}          # hazards turned off in this level`,
    `boss     = ${L.b || ""}          # an island (its boss) or a champion, or empty for none`,
    `fight    = ${L.bf || 3}          # which of the boss's three fights: 1 stamina, 2 armor, 3 hearts`,
    "",
    "[panels]                     # wall panels: v = the line left of square x,y; h = the line above it",
  ];
  const panelLines = (prefix, obj) => Object.entries(obj || {}).map(([k, v]) => `${prefix}${k} = ${v === "p" ? "purple" : "red"}`);
  out.push(...panelLines("v", L.pv), ...panelLines("h", L.ph));
  out.push("", "[spawners]                    # chips on the edge: more chips of one enemy, more of them turn up");
  LEVEL_FILE_SPAWNERS.forEach(t => {
    const chips = (L.sc && L.sc[t]) || [];
    if (chips.length) out.push(`${t} = ${chips.map(([x, y]) => `${x},${y}`).join("; ")}`);
  });
  out.push("", "---");
  for (let r = 0; r < LEVEL_FILE_SIZE; r++) out.push(L.g.slice(r * LEVEL_FILE_SIZE, (r + 1) * LEVEL_FILE_SIZE));
  return out.join("\n") + "\n";
}

/* .level text -> plain level data (not normalized), or null when it isn't a valid level */
function parseLevelFile(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const sep = lines.findIndex(l => l.trim() === "---");
  if (sep < 0) return null;
  const rows = lines.slice(sep + 1).map(l => l.trim()).filter(l => l.length);
  if (rows.length !== LEVEL_FILE_SIZE || rows.some(r => r.length !== LEVEL_FILE_SIZE)) return null;
  const g = rows.join("");
  for (const ch of g) if (!LEVEL_FILE_CHARS.includes(ch)) return null;

  const list = v => String(v || "").split(",").map(s => s.trim()).filter(Boolean);
  const L = { n: "Sandbox level", e: "w", s: 7, g, pv: {}, ph: {}, k: "", th: "", vn: 0, it: [], off: [], sc: {}, b: "", bf: 3, r: { h: 3, ar: true, t: [] } };
  let section = "";
  for (const raw of lines.slice(0, sep)) {
    const line = raw.replace(/\s#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const sec = /^\[(\w+)\]$/.exec(line);
    if (sec) { section = sec[1]; continue; }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (section === "panels") {
      const m = /^([vh])(\d{1,2}),(\d{1,2})$/.exec(key);
      if (!m) continue;
      const kind = val === "purple" ? "p" : val === "red" ? "r" : null;
      if (!kind) continue;
      (m[1] === "v" ? L.pv : L.ph)[`${m[2]},${m[3]}`] = kind;
    } else if (section === "spawners") {
      if (!LEVEL_FILE_SPAWNERS.includes(key)) continue;
      L.sc[key] = val.split(";").map(p => p.trim().split(",").map(Number)).filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < LEVEL_FILE_SIZE && y < LEVEL_FILE_SIZE);
    } else {
      switch (key) {
        case "name": L.n = val.slice(0, 24) || L.n; break;
        case "edge": if (LEVEL_FILE_EDGES[val]) L.e = LEVEL_FILE_EDGES[val]; break;
        case "speed": if (LEVEL_FILE_SPEEDS.includes(Number(val))) L.s = Number(val); break;
        case "hearts": L.r.h = Math.max(0, Math.min(5, Math.round(Number(val)) || 0)); break;
        case "apples": L.r.ar = val !== "once"; break;
        case "skin": L.k = val; break;
        case "theme": L.th = val; break;
        case "vanish": L.vn = Math.max(0, Math.min(30, Math.round(Number(val)) || 0)); break;
        case "items": L.it = list(val); break;
        case "twists": L.r.t = list(val); break;
        case "off": L.off = list(val); break;
        case "boss": L.b = /^[a-z]{0,24}$/.test(val) ? val : ""; break;
        case "fight": if ([1, 2, 3].includes(Number(val))) L.bf = Number(val); break;
      }
    }
  }
  return L;
}
