// Build 52's content against the damage rules (src/game/damage/damage.js, docs/DAMAGE.md):
// trinket and armor stat lines follow the naming scheme, every tag and stat the content names exists,
// and the sandbox's .level files carry the new enemies and a boss.
// Run from the game folder:  node --test tools/tests/*.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const D = require(path.join(ROOT, "src", "game", "damage", "damage.js"));
const json = rel => JSON.parse(fs.readFileSync(path.join(ROOT, "content", "campaign", rel), "utf8"));
const ITEMS = json("items.json");
const CRAFT = json("crafting.json");
const FOES = json("foes.json");

// The campaign's own stats that aren't damage stats: the rune table (src/campaign/camp-runes.js), the
// trinkets' four (camp-craft.js) and the spell stats (camp-arsenal.js)
const RUN_STATS = new Set(["applePoints", "points", "apples", "hazards", "speed", "money", "hearts", "armor", "damage", "bossDrain", "bite",
  "echo", "echoCut", "loot", "freeCasts", "castCooldown", "gemChance", "growth", "graceSecs", "thiefGuard", "stingGuard", "coldWard", "heatWard",
  "spellPower", "spellCharges"]);
const WORDS = Object.values(D.DAMAGE_NAMES).flatMap(n => [n.broad, n.narrow]);
const WORD_ID = w => (Object.entries(D.DAMAGE_NAMES).find(([, n]) => n.broad === w) || [w.toLowerCase()])[0];
const SPELL_STATS = new Set(WORDS.map(w => `${D.DAMAGE_NAMES[WORD_ID(w)] ? WORD_ID(w) : w.toLowerCase()}.spells`));
const known = stat => RUN_STATS.has(stat) || !!D.DAMAGE_STATS[stat] || SPELL_STATS.has(stat);
// a stat's name: the damage scheme's, or "<Word> Spells"
const statName = stat => {
  if (D.DAMAGE_STATS[stat]) return D.damageStatName(stat);
  const m = /^(\w+)\.spells$/.exec(stat);
  if (m) { const w = D.DAMAGE_NAMES[m[1]] ? D.DAMAGE_NAMES[m[1]].broad : m[1][0].toUpperCase() + m[1].slice(1); return `${w} Spells`; }
  return stat;
};
const firstWord = stat => statName(stat).split(" ")[0];

test("the spell stats use the same twelve words as the damage stats", () => {
  assert.equal(SPELL_STATS.size, 12);
  assert.ok(SPELL_STATS.has("fire.spells") && SPELL_STATS.has("ember.spells") && SPELL_STATS.has("electricity.spells") && SPELL_STATS.has("spark.spells"));
  assert.equal(statName("electricity.spells"), "Electric Spells");
  assert.equal(statName("ember.spells"), "Ember Spells");
});

test("every trinket gives two stats: a major one and a minor one, both known, never the same", () => {
  for (const t of CRAFT.trinkets) {
    assert.ok(t.major && t.minor, `${t.id} needs a major and a minor line`);
    assert.ok(known(t.major.stat), `${t.id}: major stat ${t.major.stat} unknown`);
    assert.ok(known(t.minor.stat), `${t.id}: minor stat ${t.minor.stat} unknown`);
    assert.notEqual(t.major.stat, t.minor.stat, t.id);
    assert.ok([1, 2, 3, 4].includes(t.tier), `${t.id}: tier is its rarity, 1-4`);
  }
});

// Build 53: a trinket has no name of its own. Every stat has a first name and a second name
// (crafting.json trinketWords); a trinket is its major stat's first name + its minor stat's second name,
// after its rarity, and its rarity scales its numbers (armory.trinketScale). Same rule as camp-craft.js.
const W = CRAFT.trinketWords;
const tName = t => `${W[t.major.stat][0]} ${W[t.minor.stat][1]}`;
const SCALE = CRAFT.armory.trinketScale;

test("every stat on a trinket has a first name and a second name, and every trinket's name is its own", () => {
  const names = new Set();
  for (const t of CRAFT.trinkets) {
    assert.ok(W[t.major.stat] && W[t.minor.stat], `${t.id}: both stats need words`);
    assert.ok(!("name" in t), `${t.id}: the name comes from the stats`);
    assert.ok(!names.has(tName(t)), `${t.id}: "${tName(t)}" is taken`);
    names.add(tName(t));
  }
});

test("the order of the stats is the name: Fire then Ember isn't Ember then Fire", () => {
  const fe = CRAFT.trinkets.find(t => t.major.stat === "fire.resistance" && t.minor.stat === "ember.resistance");
  const ef = CRAFT.trinkets.find(t => t.major.stat === "ember.resistance" && t.minor.stat === "fire.resistance");
  assert.ok(fe && ef);
  assert.equal(tName(fe), `${W["fire.resistance"][0]} ${W["ember.resistance"][1]}`);
  assert.equal(tName(ef), `${W["ember.resistance"][0]} ${W["fire.resistance"][1]}`);
  assert.notEqual(tName(fe), tName(ef));
  // the brief's own examples
  const cool = CRAFT.trinkets.find(t => t.major.stat === "ember.immunity" && t.minor.stat === "fire.resistance");
  assert.equal(tName(cool), "Cooling Body Fan");
  assert.equal(`${W["slashing.resistance"][0]} ${W["piercing.resistance"][1]}`, "Dense Chainmail Plating");
  // every tag has both orders of its two resistances
  for (const tag of D.DAMAGE_TAGS) {
    const narrow = D.DAMAGE_NAMES[tag].narrow.toLowerCase();
    assert.ok(CRAFT.trinkets.some(t => t.major.stat === `${tag}.resistance` && t.minor.stat === `${narrow}.resistance`), `${tag}: broad-first trinket`);
    assert.ok(CRAFT.trinkets.some(t => t.major.stat === `${narrow}.resistance` && t.minor.stat === `${tag}.resistance`), `${tag}: narrow-first trinket`);
  }
});

test("a trinket's numbers rise with its rarity; a legendary beats a common of the same recipe", () => {
  const order = ["common", "uncommon", "rare", "legendary"];
  for (let i = 1; i < order.length; i++) assert.ok(SCALE[order[i]] > SCALE[order[i - 1]], order[i]);
  assert.equal(CRAFT.armory.trinketRarity.length, 4);
  // a better recipe has better odds of a rare one
  const rareOdds = w => (w[2] + w[3]) / w.reduce((a, b) => a + b, 0);
  for (let i = 1; i < 4; i++) assert.ok(rareOdds(CRAFT.armory.trinketRarity[i]) > rareOdds(CRAFT.armory.trinketRarity[i - 1]), `tier ${i + 1}`);
  // immunities are on or off
  for (const t of CRAFT.trinkets) for (const l of [t.major, t.minor]) if (/\.immunity$/.test(l.stat)) assert.equal(l.v, 1, t.id);
});

test("armor: about ten sets, each a helmet and a body piece, okay to great", () => {
  const sets = ITEMS.armorSets;
  assert.ok(sets.length >= 10);
  const tiers = sets.map(s => s.tier);
  assert.equal(Math.min(...tiers), 1);
  assert.equal(Math.max(...tiers), 5);
  for (const s of sets) {
    const pieces = ITEMS.items.filter(i => i.set === s.id);
    assert.deepEqual(pieces.map(p => p.piece).sort(), ["body", "helmet"], s.id);
    for (const line of s.bonus.concat(s.bad || [])) assert.ok(known(line.stat), `${s.id}: ${line.stat}`);
  }
});

test("rarity sets how many stat lines an item has", () => {
  assert.deepEqual(ITEMS.statsByRarity, [1, 2, 3, 4]);
  const withStats = ITEMS.items.filter(i => i.stats);
  assert.ok(withStats.length >= 30);
  for (const it of withStats) {
    assert.ok(it.stats.length >= 1 && it.stats.length <= 4, it.id);
    for (const line of it.stats) assert.ok(known(line.stat) && line.v !== 0, `${it.id}: ${line.stat}`);
    if (it.piece === "helmet" || it.piece === "body") assert.equal(it.stats.length, 4, `${it.id}: four lines, one more per rarity`);
  }
});

test("armor and trinket lines read with the naming scheme's names", () => {
  const lines = ITEMS.items.filter(i => i.piece === "helmet" || i.piece === "body").flatMap(i => i.stats)
    .concat(CRAFT.trinkets.flatMap(t => [t.major, t.minor]))
    .filter(l => D.DAMAGE_STATS[l.stat]);
  assert.ok(lines.length > 60);
  for (const l of lines) {
    const s = D.DAMAGE_STATS[l.stat];
    assert.match(statName(l.stat), /^(Piercing|Barb|Slashing|Edge|Fire|Ember|Ice|Rime|Electric|Spark|Venom|Toxin) (Resistance|Weakness|Immunity)$/);
    assert.equal(statName(l.stat), `${s.broad ? D.DAMAGE_NAMES[s.tag].broad : D.DAMAGE_NAMES[s.tag].narrow} ${D.KIND_NAMES[s.kind]}`);
  }
  // the narrow and the broad stat are different stats with different names
  assert.notEqual(statName("fire.resistance"), statName("ember.resistance"));
});

test("weapons, spells and familiars come in several rarities with tags the rules know", () => {
  const fam = f => ITEMS.items.filter(i => i.family === f);
  const weapons = ITEMS.items.filter(i => i.piece === "weapon");
  assert.ok(weapons.length >= 8 && fam("spell").length >= 10 && fam("pet").length >= 10 && fam("rune").length >= 18);
  for (const w of weapons) {
    assert.deepEqual(D.checkDamageSpec({ tags: w.hit.tags, family: w.hit.family }, w.id), []);
    assert.equal(w.damage.length, 4, `${w.id}: a damage level per rarity`);
    assert.ok(w.damage.every((d, i) => i === 0 || d >= w.damage[i - 1]), `${w.id}: damage never drops with rarity`);
  }
  for (const s of fam("spell").filter(s => s.hit)) assert.deepEqual(D.checkDamageSpec({ tags: s.hit.tags, family: s.hit.family }, s.id), []);
  for (const r of fam("rune")) for (const line of r.good.concat(r.bad)) assert.ok(known(line.stat), `${r.id}: ${line.stat}`);
});

test("foes.json: hits, enemies, power-ups, bosses and champions pass the damage checks", () => {
  for (const [cause, h] of Object.entries(FOES.hits)) if (!cause.startsWith("_")) assert.deepEqual(D.checkDamageSpec(h, cause), []);
  for (const [foe, r] of Object.entries(FOES.rules)) if (!foe.startsWith("_")) assert.deepEqual(D.checkDamageSpec(r, foe), []);
  for (const e of FOES.enemies) assert.deepEqual(D.checkDamageSpec({ tags: e.hit.tags, family: e.hit.family, immune: e.immune, resist: e.resist, weak: e.weak }, e.id), []);
  for (const p of FOES.powerups) assert.deepEqual(D.checkDamageSpec({ grants: p.grants }, p.id), []);
  for (const [isl, b] of Object.entries(FOES.bosses)) if (!isl.startsWith("_")) assert.deepEqual(D.checkDamageSpec(b.rules, isl), []);
  for (const c of FOES.champions) assert.deepEqual(D.checkDamageSpec(c.rules, c.id), []);
  // power-ups grant resistance or immunity, broad and narrow
  const granted = FOES.powerups.flatMap(p => p.grants.map(g => D.DAMAGE_STATS[g.stat]));
  assert.ok(granted.some(s => s.kind === "immunity" && s.broad) && granted.some(s => s.kind === "immunity" && !s.broad) && granted.some(s => s.kind === "resistance"));
});

test("champions have abilities the island bosses never get", () => {
  const champOnly = new Set(Object.entries(FOES.traits).filter(([, t]) => t.champion).map(([id]) => id));
  assert.ok(champOnly.size >= 5);
  for (const [isl, b] of Object.entries(FOES.bosses)) if (!isl.startsWith("_")) for (const t of b.traits) assert.ok(!champOnly.has(t.id), `${isl} has ${t.id}`);
  for (const c of FOES.champions) assert.ok(c.abilities.some(a => champOnly.has(a.id)), c.id);
  assert.equal(FOES.champions.length, 5);
});

test("an enemy and a power-up resolve the way the rules say", () => {
  // a Flamebrand (fire, ember) against a cinder bat (immune to fire) does nothing; against a mantis (weak) more
  const bat = D.makeDamageTarget(FOES.enemies.find(e => e.id === "firebat"));
  const mantis = D.makeDamageTarget(FOES.enemies.find(e => e.id === "mantis"));
  const brand = ITEMS.items.find(i => i.id === "flamebrand").hit;
  assert.equal(D.resolveDamageHit(bat, { amount: 1, tags: brand.tags, family: brand.family }).blocked, true);
  assert.equal(D.resolveDamageHit(mantis, { amount: 1, tags: brand.tags, family: brand.family }).multiplier, 1.5);
  // the Ember Ward (Ember Immunity) stops embers but not lava (fire, no family)
  const ward = D.addDamageGrants({}, FOES.powerups.find(p => p.id === "emberward").grants);
  assert.equal(D.resolveDamageHit(ward, Object.assign({ amount: 1 }, FOES.hits.ember)).blocked, true);
  assert.equal(D.resolveDamageHit(ward, Object.assign({ amount: 1 }, FOES.hits.lava)).blocked, false);
});

test("the sandbox's .level files carry the new enemies and a boss", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src/game/sandbox/level-file.js"), "utf8") + "\n;this.levelFileText = levelFileText; this.parseLevelFile = parseLevelFile; this.SPAWNERS = LEVEL_FILE_SPAWNERS;", ctx);
  for (const e of FOES.enemies) assert.ok(ctx.SPAWNERS.includes(e.id), `${e.id} missing from LEVEL_FILE_SPAWNERS`);
  const g = Array(400).fill("."); g[205] = "S";
  const L = { n: "Boss test", e: "a", s: 7, g: g.join(""), pv: {}, ph: {}, k: "", th: "", vn: 0, it: [], off: [], sc: { scorpion: [[0, 3]], firebat: [[19, 5], [19, 7]] }, b: "crown", bf: 2, r: { h: 3, ar: true, t: [] } };
  const back = JSON.parse(JSON.stringify(ctx.parseLevelFile(ctx.levelFileText(L))));
  assert.deepEqual(back.sc, L.sc);
  assert.equal(back.b, "crown");
  assert.equal(back.bf, 2);
  const champ = ctx.parseLevelFile(ctx.levelFileText(Object.assign({}, L, { b: "ashwing", bf: 3 })));
  assert.equal(champ.b, "ashwing");
});
