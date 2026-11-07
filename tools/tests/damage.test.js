// Tests for src/game/damage/damage.js
// Run from the game folder:  node --test tools/tests/
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const D = require(path.join(__dirname, "..", "..", "src", "game", "damage", "damage.js"));

// Test enemies and hazards: small fixtures, not game content.
const WASP = { name: "Test Wasp", immune: ["venom"] };
const GOLEM = { name: "Test Golem", resist: ["piercing"], weak: ["electricity"] };
const SLIME = { name: "Test Slime", immune: ["fire"], weak: ["ice"] };
const FIRE_VENT = { name: "Test Fire Vent", tags: ["fire"], family: "ember" };
const PLAIN_FIRE = { name: "Test Torch", tags: ["fire"] };
const FROST_SPIKE = { name: "Test Frost Spike", tags: ["ice", "piercing"] };

const target = (def, own) => D.makeDamageTarget(def, own);
const hit = (amount, def) => ({ amount, tags: def.tags, family: def.family });

test("six damage tags, and every tag has a broad and a narrow word", () => {
  assert.deepEqual(D.DAMAGE_TAGS, ["piercing", "slashing", "fire", "ice", "electricity", "venom"]);
  for (const tag of D.DAMAGE_TAGS) {
    assert.ok(D.DAMAGE_NAMES[tag].broad, `${tag} broad word`);
    assert.ok(D.DAMAGE_NAMES[tag].narrow, `${tag} narrow word`);
  }
});

test("every stat has a unique id and a unique name: 6 tags x 3 kinds x 2 names", () => {
  const ids = Object.keys(D.DAMAGE_STATS);
  assert.equal(ids.length, 36);
  const names = new Set(ids.map(id => D.DAMAGE_STATS[id].name));
  assert.equal(names.size, 36);
  assert.equal(D.damageStatName("fire.resistance"), "Fire Resistance");
  assert.equal(D.damageStatName("ember.resistance"), "Ember Resistance");
  assert.equal(D.damageStatName("nope.resistance"), "nope.resistance");
});

test("immunity: a venom-immune wasp takes nothing from venom", () => {
  const r = D.resolveDamageHit(target(WASP), { amount: 10, tags: ["venom"] });
  assert.equal(r.damage, 0);
  assert.equal(r.blocked, true);
});

test("resistance: a golem takes half from piercing", () => {
  const r = D.resolveDamageHit(target(GOLEM), { amount: 10, tags: ["piercing"] });
  assert.equal(r.damage, 5);
  assert.equal(r.blocked, false);
});

test("weakness: a golem takes half again from electricity", () => {
  const r = D.resolveDamageHit(target(GOLEM), { amount: 10, tags: ["electricity"] });
  assert.equal(r.damage, 15);
});

test("a tag the target has no rule for does normal damage", () => {
  const r = D.resolveDamageHit(target(GOLEM), { amount: 10, tags: ["slashing"] });
  assert.equal(r.damage, 10);
  assert.equal(r.multiplier, 1);
});

test("a hit with no tags is normal damage", () => {
  assert.equal(D.resolveDamageHit(target(WASP), { amount: 7, tags: [] }).damage, 7);
});

test("multi-tag hits multiply: one immune tag blocks the whole hit", () => {
  // Slime is fire-immune and ice-weak: the frost spike's ice tag does 15, its piercing does 10,
  // but a fire+ice hit is blocked by fire immunity.
  const fireIce = D.resolveDamageHit(target(SLIME), { amount: 10, tags: ["fire", "ice"] });
  assert.equal(fireIce.damage, 0);
  assert.equal(fireIce.blocked, true);
  const iceOnly = D.resolveDamageHit(target(SLIME), { amount: 10, tags: ["ice"] });
  assert.equal(iceOnly.damage, 15);
});

test("a frost spike against a golem multiplies its two tags", () => {
  // ice: normal (1). piercing: resisted to 0.5. 10 * 1 * 0.5 = 5
  const r = D.resolveDamageHit(target(GOLEM, null), hit(10, FROST_SPIKE));
  assert.equal(r.damage, 5);
  assert.equal(r.parts.length, 2);
});

test("resistance is capped at 90%, so a cap-busting stack still lets 10% through", () => {
  // Golem adds 50 piercing resistance on top of 80 from the player: 130, capped at 90.
  const stacked = target(GOLEM, { "piercing.resistance": 80 });
  const r = D.resolveDamageHit(stacked, { amount: 100, tags: ["piercing"] });
  assert.ok(Math.abs(r.damage - 10) < 1e-9, `expected 10, got ${r.damage}`);
});

test("weakness is capped at +200%", () => {
  const r = D.resolveDamageHit({ "fire.weakness": 500 }, { amount: 10, tags: ["fire"] });
  assert.equal(r.damage, 30);
});

test("a narrow stat only counts for hits that carry its family", () => {
  // A trinket that gives Ember Resistance 20 should not help against a plain torch.
  const trinket = D.addDamageGrants({}, [{ stat: "ember.resistance", amount: 20 }]);
  const vsVent = D.resolveDamageHit(target(null, trinket), hit(10, FIRE_VENT));
  const vsTorch = D.resolveDamageHit(target(null, trinket), hit(10, PLAIN_FIRE));
  assert.equal(vsVent.damage, 8);
  assert.equal(vsTorch.damage, 10);
});

test("a trinket line can give both a broad and a narrow stat, and they add up", () => {
  const trinket = D.addDamageGrants({}, [
    { stat: "fire.resistance", amount: 10 },
    { stat: "ember.resistance", amount: 10 }
  ]);
  assert.equal(D.resolveDamageHit(target(null, trinket), hit(10, FIRE_VENT)).damage, 8);
  assert.equal(D.resolveDamageHit(target(null, trinket), hit(10, PLAIN_FIRE)).damage, 9);
});

test("the player's own stats and an enemy's rules stack in one target", () => {
  // Golem resists piercing 50. Player adds piercing resistance 20 (broad): 70 off, 30% through.
  const t = target(GOLEM, { "piercing.resistance": 20 });
  assert.ok(Math.abs(D.resolveDamageHit(t, { amount: 10, tags: ["piercing"] }).damage - 3) < 1e-9);
});

test("an immunity from a trinket works on a narrow family", () => {
  const t = target(null, { "spark.immunity": 1 });
  assert.equal(D.resolveDamageHit(t, { amount: 10, tags: ["electricity"], family: "spark" }).damage, 0);
  assert.equal(D.resolveDamageHit(t, { amount: 10, tags: ["electricity"] }).damage, 10);
});

test("checkDamageSpec accepts a good spec and reports the bad parts", () => {
  assert.deepEqual(D.checkDamageSpec(FIRE_VENT, "vent"), []);
  assert.deepEqual(D.checkDamageSpec(GOLEM, "golem"), []);
  const bad = D.checkDamageSpec({
    tags: ["lava"],
    family: "flame",
    immune: ["fire"],
    resist: ["fire"],
    grants: [{ stat: "fire.speed", amount: 1 }, { stat: "ice.resistance" }]
  }, "bad");
  const text = bad.join("\n");
  assert.match(text, /unknown tag "lava"/);
  assert.match(text, /family "flame"/);
  assert.match(text, /fire is listed under immune and resist/);
  assert.match(text, /unknown stat "fire.speed"/);
  assert.match(text, /ice.resistance needs a number amount/);
});

test("every enemy rule ends up in the right stat id", () => {
  const t = target({ immune: ["venom"], resist: ["ice"], weak: ["fire"] });
  assert.equal(t["venom.immunity"], 1);
  assert.equal(t["ice.resistance"], 50);
  assert.equal(t["fire.weakness"], 50);
});
