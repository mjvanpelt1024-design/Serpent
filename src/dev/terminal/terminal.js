/* =========================================================
   src/dev/terminal/terminal.js
   The terminal: input, history and output
   ========================================================= */
"use strict";

/* =========================================================
   Terminal: the secret console. Tap the version number in Settings five times.
   Every command has the same shape:

       group  subject.action  value

   for example `dev damage.godmode true` or `upgrade appleErApples.advance 4`.
   All of them live in one registry, so help, tab completion and the PDF manual agree.
   ========================================================= */
const consoleLogEl = document.getElementById("console-log");
const consoleInputEl = document.getElementById("console-input");
const consoleHistory = [];
let consoleHistoryAt = 0;

const say = t => consolePrint(t);
const note = t => consolePrint(t, "dim");

function consolePrint(text, cls) {
  String(text).split("\n").forEach(part => {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = part;
    consoleLogEl.appendChild(line);
  });
  while (consoleLogEl.childNodes.length > 400) consoleLogEl.removeChild(consoleLogEl.firstChild);
  consoleLogEl.scrollTop = consoleLogEl.scrollHeight;
}

const TERM_GROUPS = [
  ["dev", "Bend the rules: god mode, speed and score multipliers, runs, spawning, unlocking content"],
  ["debug", "Look under the hood: live stats, the grid, sounds, music, settings, screens and test bubbles"],
  ["attribute", "Read and change numbers: XP, lifetime score, rank, run score, hearts, stats, items, best scores"],
  ["upgrade", "Move any upgrade track, or a whole island tree, up and down. Medals too"],
  ["data", "Save codes, lists of every id, the status report and wiping parts of the save"]
];
const GROUP_IDS = TERM_GROUPS.map(g => g[0]);
const GROUP_ALIAS = {
  developer: "dev", devs: "dev", cheat: "dev", cheats: "dev",
  dbg: "debug", debugs: "debug",
  attributes: "attribute", attr: "attribute", attrs: "attribute", attrib: "attribute",
  upgrades: "upgrade", upg: "upgrade", upgs: "upgrade",
  datas: "data", save: "data"
};
const META = ["help", "clear", "exit", "version", "status"];
const META_ALIAS = { "?": "help", cls: "clear", q: "exit", quit: "exit", man: "help" };

function resolveGroup(s) {
  s = String(s || "").toLowerCase();
  if (GROUP_IDS.includes(s)) return s;
  if (GROUP_ALIAS[s]) return GROUP_ALIAS[s];
  return null;
}

class CmdError extends Error {}
const fail = msg => { throw new CmdError(msg); };

/* ----- Reading what you type ----- */
function parseNum(s) {
  if (s === undefined || s === null) return NaN;
  const t = String(s).toLowerCase().replace(/[,_]/g, "");
  const m = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)(k|m|b|t|qa|qi)?$/.exec(t);
  if (!m) return NaN;
  return Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18 }[m[2]] || 1);
}

function parseBool(s, fallback) {
  if (s === undefined) return fallback;
  const t = String(s).toLowerCase();
  if (["true", "on", "yes", "y", "1", "enable", "enabled"].includes(t)) return true;
  if (["false", "off", "no", "n", "0", "disable", "disabled"].includes(t)) return false;
  return null;
}

const needNum = (s, what = "value") => {
  if (s === undefined) fail(`${what} needs a number`);
  const n = parseNum(s);
  if (!Number.isFinite(n)) fail(`${what} must be a number (try 5000, 2.5k, 3m, 5b or 1e9)`);
  return n;
};
const needBool = (s, fallback) => {
  const b = parseBool(s, fallback);
  if (b === null || b === undefined) fail("expected true or false (on/off works too)");
  return b;
};

/* Words, with quotes keeping spaces together */
function splitWords(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  if (out[0] && out[0].toLowerCase() === "terminal") out.shift();
  return out;
}

/* ----- Names: ids, labels and camelCase all work ----- */
const squash = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const camel = label => String(label).replace(/['’]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean)
  .map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join("");

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/* The closest name in a list, if it is close enough to be a typo */
function nearest(tok, names) {
  const t = squash(tok);
  if (!t) return null;
  let best = null;
  names.forEach(n => {
    const d = editDistance(t, squash(n));
    if (!best || d < best[0]) best = [d, n];
  });
  if (!best) return null;
  const limit = t.length >= 8 ? 3 : t.length >= 5 ? 2 : 1;
  return best[0] <= limit ? best[1] : null;
}

const trackName = k => camel(upgradeTracks[k].label);
const islandName = m => camel((ISLANDS[m] && ISLANDS[m].name) || modes[m].label);

function resolveTrack(tok) {
  const t = squash(tok);
  return Object.keys(upgradeTracks).find(k => squash(k) === t || squash(upgradeTracks[k].label) === t) || null;
}

/* A mode by key, label, island name or number (1 is Easy / the Garden) */
function resolveMode(tok) {
  const t = squash(tok);
  if (/^\d+$/.test(t)) return MODE_KEYS[Number(t) - 1] || null;
  return MODE_KEYS.find(m => m === t || squash(modes[m].label) === t || (ISLANDS[m] && squash(ISLANDS[m].name) === t)) || null;
}

/* spec: all, next, a number, a range like 2-5, a name, or a comma list of those */
function selectFrom(spec, all, resolve, nextFn, what, listName) {
  const s = String(spec === undefined ? "" : spec).toLowerCase();
  if (!s) fail(`which ${what}? use all, next, a number, a range like 2-5, or a name`);
  if (s === "all") return all.slice();
  if (s === "next") {
    const n = nextFn();
    if (!n) fail(`nothing left: no ${what} to change`);
    return Array.isArray(n) ? n : [n];
  }
  const out = [];
  s.split(",").forEach(part => {
    const r = /^(\d+)-(\d+)$/.exec(part);
    if (r) {
      const a = Number(r[1]);
      const b = Number(r[2]);
      if (a < 1 || b > all.length || a > b) fail(`range ${part} must sit inside 1-${all.length}`);
      for (let i = a; i <= b; i++) out.push(all[i - 1]);
      return;
    }
    if (/^\d+$/.test(part) && (Number(part) < 1 || Number(part) > all.length)) fail(`${part} is outside 1-${all.length}`);
    const k = /^\d+$/.test(part) ? all[Number(part) - 1] : resolve(part);
    if (!k) fail(`unknown ${what} '${part}'. try: data list.${listName}`);
    (Array.isArray(k) ? k : [k]).forEach(x => out.push(x));
  });
  return Array.from(new Set(out));
}

const inRun = () => gameState === "PLAYING" || pauseDetour;
const needRun = () => { if (!inRun()) fail("no run in progress. start one with: dev run.play <island> hold"); };
const ordered = (list, order) => order.filter(x => list.includes(x));

function setTierSafe(key, n) {
  if (key === "xp") setXpBoosterTier(n);
  else save.tiers[key] = n;
}

function refreshAfterCommand() {
  persist();
  updateHud();
  updateLiveStats(true);
}

/* The group chips in the terminal header: tap one to start typing in that group */
function renderTermGroups() {
  const el = document.getElementById("term-gates");
  if (!el) return;
  el.innerHTML = TERM_GROUPS.map(([id, d]) => `<button type="button" data-group="${id}" title="${escapeAttr(d)}">${id}</button>`).join("");
}
