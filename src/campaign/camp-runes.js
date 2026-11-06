/* =========================================================
   src/campaign/camp-runes.js
   Runes: yours for good. A rune never wears out or burns up. One is
   active at a time (camp.equip.rune), shown under your hearts, and both
   its sides work in every level until you take it off between levels.

   A rune is data (content/campaign/items.json, family "rune"): a good
   side and a bad side, each a list of stats with four values, one per
   condition. Its condition is its rarity, named by the family's grades:
     broken    a chip knocked out of its corner
     cracked   a crack across its face
     fine      as it was carved
     pristine  polished, and it shines
   A better condition makes the good side stronger and the bad side milder.

   Everything a rune can do is a stat in RUNE_STATS below: how it reads,
   long (the Satchel, the shops) and short (beside your hearts). The
   game asks runeVal(stat) wherever that stat matters, so a new rune is
   just data, and a new kind of effect is one entry here, one check in
   tools/check-campaign.py (RUNE_STATS) and one runeVal() where it acts.
   ========================================================= */
"use strict";

const RUNE_GRADE_IDS = ["broken", "cracked", "fine", "pristine"];
const runeGradeId = it => RUNE_GRADE_IDS[rarityIdx(it.rarity)] || "fine";

/* ----- What a rune can do ----- */
const runeAbs = v => Math.abs(v);
const runeS = (n, w, ws = w + "s") => (Math.abs(n) <= 1 ? w : ws);
const runeHalf = v => fmtHalf(Math.abs(v));
const RUNE_STATS = {
  applePoints: { pct: true, long: v => `Apples are worth ${runeAbs(v)}% ${v > 0 ? "more" : "fewer"} points`, short: v => `${v > 0 ? "+" : "-"}${runeAbs(v)}% per apple` },
  points: { pct: true, long: v => `Every point is worth ${runeAbs(v)}% ${v > 0 ? "more" : "less"}`, short: v => `${v > 0 ? "+" : "-"}${runeAbs(v)}% points` },
  apples: { long: v => `${v} extra ${runeS(v, "apple")} on the board`, short: v => `+${v} ${runeS(v, "apple")}` },
  hazards: { pct: true, long: v => `Hazards come ${runeAbs(v)}% ${v > 0 ? "faster" : "slower"}`, short: v => `hazards ${runeAbs(v)}% ${v > 0 ? "faster" : "slower"}` },
  speed: { pct: true, long: v => `You move ${runeAbs(v)}% ${v > 0 ? "faster" : "slower"}`, short: v => `move ${runeAbs(v)}% ${v > 0 ? "faster" : "slower"}` },
  money: { pct: true, long: v => `${runeAbs(v)}% ${v > 0 ? "more" : "less"} money from every level`, short: v => `${v > 0 ? "+" : "-"}${runeAbs(v)}% money` },
  hearts: { long: v => (v > 0 ? `${runeHalf(v)} extra ${runeS(v, "heart")}` : `${runeHalf(v)} ${runeS(v, "heart")} fewer`), short: v => `${v > 0 ? "+" : "-"}${runeHalf(v)} ${runeS(v, "heart")}` },
  armor: { long: v => `${v} extra armor ${runeS(v, "plate")}`, short: v => `+${v} armor ${runeS(v, "plate")}` },
  damage: { pct: true, long: v => `You take ${v}% more damage`, short: v => `+${v}% damage taken` },
  bossDrain: { pct: true, long: v => `Bosses tire ${v}% faster`, short: v => `bosses tire ${v}% faster` },
  bite: { long: v => `Your bites hit a tired boss ${v} harder`, short: v => `+${v} boss bite` },
  echo: { long: v => `If you die, you come back once with ${runeHalf(v)} ${runeS(v, "heart")}`, short: v => `1 revive, ${runeHalf(v)} ${runeS(v, "heart")}` },
  echoCut: { pct: true, long: v => `The level pays ${v}% less if the echo saves you`, short: v => `-${v}% pay if revived` },
  loot: { pct: true, long: v => `Trinkets turn up ${v}% more often`, short: v => `+${v}% trinkets` },
  freeCasts: { long: v => `${v} free ${runeS(v, "cast")} of your spell in every level`, short: v => `+${v} free ${runeS(v, "cast")}` },
  castCooldown: { pct: true, long: v => `Your spell takes ${v}% longer to recharge`, short: v => `spell recharge +${v}%` },
  gemChance: { pct: true, long: v => `${v}% chance of a gem every time you win`, short: v => `${v}% gem on a win` },
  growth: { long: v => `Every apple makes you ${v} longer than usual`, short: v => `+${v} length per apple` },
  graceSecs: { long: v => `After every hit you're safe for ${v} ${runeS(v, "second")}`, short: v => `${v}s safe after a hit` }
};

/* A rune's two sides at its condition: { good: [{stat, v}], bad: [{stat, v}] }.
   Runecraft (the Ember Ash) makes the good side's percentages stronger. */
function runeSides(it) {
  const d = campItemDef(it.id);
  const g = rarityIdx(it.rarity);
  const craft = 1 + upPct("runecraft");
  const side = (list, good) => (list || []).map(s => {
    let v = s.v[g];
    if (good && RUNE_STATS[s.stat] && RUNE_STATS[s.stat].pct) v = Math.round(v * craft);
    return { stat: s.stat, v };
  });
  return d ? { good: side(d.good, true), bad: side(d.bad, false) } : { good: [], bad: [] };
}

/* The rune a level runs with: its sides added up into one table of stats */
function runeForRun(it) {
  const s = runeSides(it), vals = {};
  s.good.concat(s.bad).forEach(x => { vals[x.stat] = (vals[x.stat] || 0) + x.v; });
  return { id: it.id, rarity: it.rarity, uid: it.uid, vals };
}
/* What the running level's rune does to `stat` (0 when there's no rune) */
const runeVal = stat => (campRun && campRun.rune && campRun.rune.vals[stat]) || 0;

/* Words: each side as a list of phrases */
function runeWords(it, form = "long") {
  const s = runeSides(it);
  const say = list => list.map(x => (RUNE_STATS[x.stat] ? RUNE_STATS[x.stat][form](x.v) : x.stat));
  return { good: say(s.good), bad: say(s.bad) };
}
const runeSentence = list => (list.length ? list.join(". ").replace(/^./, c => c.toUpperCase()) + "." : "");

/* The blurb beside the rune under your hearts */
function runeBlurbHtml(it) {
  if (!it) return `<span class="rb-none">No rune selected</span>`;
  const w = runeWords(it, "short");
  return `<span class="rb-good">${w.good.map(escapeAttr).join(", ")}</span><span class="rb-bad">${w.bad.map(escapeAttr).join(", ")}</span>`;
}

/* What an item does and where it's weak, in words for its rows: runes say their numbers */
function campItemDoes(it) {
  const d = campItemDef(it.id);
  if (!d) return "";
  return campItemSlot(it.id) === "rune" ? runeSentence(runeWords(it).good) : d.does;
}
function campItemWeak(it) {
  const d = campItemDef(it.id);
  if (!d) return "";
  return campItemSlot(it.id) === "rune" ? runeSentence(runeWords(it).bad) : d.weak;
}

/* ----- The pictures: a carved stone per rune, in four conditions ----- */
/* A rune's glyph, 7 x 7, carved into the plain stone: x is the glyph's color */
function runeStoneRows(glyph, col) {
  return ["...kkkkkk...", "..ksssssSk.."]
    .concat(glyph.map(r => ".k" + [...r].map(ch => (ch === "x" ? col : "s")).join("") + "Sk."))
    .concat([".kSSSSSSSSk.", "..kkkkkkkk..", "............"]);
}
const RUNE_GLYPHS = {
  haste: [["....xx.", "...xx..", "..xx...", ".xxxxx.", "...xx..", "..xx...", ".xx...."], "o"],
  iron: [[".xxxxx.", ".x...x.", ".x.x.x.", ".x...x.", "..x.x..", "...x...", "......."], "B"],
  vigor: [["......."  , ".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."], "r"],
  magpie: [["..xxx..", ".x...x.", "x..x..x", "x.xxx.x", "x..x..x", ".x...x.", "..xxx.."], "Y"],
  sage: [["...x...", ".x.x.x.", "..xxx..", "xxxxxxx", "..xxx..", ".x.x.x.", "...x..."], "m"],
  greed: [["......." , ".xxxxx.", "x.x.x.x", ".x...x.", "..x.x..", "...x...", "......."], "p"],
  calm: [["......." , ".x...x.", "x.x.x.x", ".......", ".x...x.", "x.x.x.x", "......."], "b"],
  grace: [["....xx.", "...xxx.", "..xxx..", ".xxx...", ".xx....", "x.x....", "x......"], "w"]
};
Object.entries(RUNE_GLYPHS).forEach(([id, [glyph, col]]) => { SPRITES["rune_" + id] = runeStoneRows(glyph, col); });

/* Broken: a chip knocked off the top-right corner, its raw edge pale.
   Cracked: a split down the face. Pristine: polished glints along the top-left. */
function runeVariant(rows, grade) {
  const g = rows.map(r => [...r]);
  const at = (x, y) => (g[y] && g[y][x]) || ".";
  if (grade === "broken") {
    const gone = (x, y) => y <= 4 && x - y > 5;
    const was = rows.map(r => [...r]);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (gone(x, y)) g[y][x] = ".";
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      if (g[y][x] === "." || gone(x, y)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => gone(x + dx, y + dy) && (was[y + dy] || [])[x + dx] !== ".");
      if (edge) { g[y][x] = "k"; if (at(x - 1, y) === "s" || at(x - 1, y) === "S") g[y][x - 1] = "W"; }
    }
    // a crumb of the missing corner, fallen beside it
    g[6][11] = "k";
  } else if (grade === "cracked") {
    [[5, 1], [5, 2], [6, 3], [5, 4], [4, 5], [5, 6], [4, 7], [4, 8], [7, 4], [8, 5]].forEach(([x, y]) => { if (at(x, y) !== ".") g[y][x] = "k"; });
    [[6, 2], [6, 5], [5, 7]].forEach(([x, y]) => { if (at(x, y) === "s") g[y][x] = "W"; });
  } else if (grade === "pristine") {
    [[3, 1], [4, 1], [2, 2], [2, 3], [9, 2]].forEach(([x, y]) => { if (at(x, y) === "s" || at(x, y) === "S") g[y][x] = "w"; });
  }
  return g.map(r => r.join(""));
}

/* Every rune gets a picture per condition: ci:<id>:<grade> */
(() => {
  CAMP.items.filter(i => i.family === "rune").forEach(r => {
    const base = ITEM_SPRITE[r.id] ? ITEM_SPRITE[r.id][0] : "rune_" + r.id;
    if (!SPRITES[base]) return;
    ICON_FOR["ci:" + r.id] = [base];
    RUNE_GRADE_IDS.forEach(grade => {
      const name = `${base}_${grade}`;
      SPRITES[name] = grade === "fine" ? SPRITES[base] : runeVariant(SPRITES[base], grade);
      ICON_FOR[`ci:${r.id}:${grade}`] = [name];
    });
    if (typeof RUNE_COLORS === "object") RUNE_COLORS[r.id] = r.color;
  });
})();
const runeIconUrl = (it, scale = 3) => iconUrl(`ci:${it.id}:${runeGradeId(it)}`, scale);

/* The empty rune slot: the stone's shadow */
let runeShadowCache = "";
function runeShadowUrl() {
  if (runeShadowCache) return runeShadowCache;
  const c = document.createElement("canvas");
  c.width = c.height = 12;
  const g = c.getContext("2d");
  SPRITES.rune.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    g.fillStyle = ch === "k" ? HEART_PALS.empty.k : HEART_PALS.empty.r;
    g.fillRect(x, y, 1, 1);
  }));
  return (runeShadowCache = c.toDataURL());
}

/* ----- Old saves: runes used to stack and burn up; now each is its own stone ----- */
function campSplitRunes(c) {
  const out = [];
  c.satchel.forEach(it => {
    out.push(it);
    if (!CAMP.itemById[it.id] || CAMP.itemById[it.id].family !== "rune") return;
    for (let k = 1; k < (it.qty || 1) && out.length < 400; k++) out.push({ uid: c.nextUid++, id: it.id, rarity: it.rarity, uses: 0, qty: 1 });
    it.qty = 1;
  });
  c.satchel = out;
}
