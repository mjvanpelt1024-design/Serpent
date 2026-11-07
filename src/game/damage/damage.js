/* =========================================================
   src/game/damage/damage.js
   The damage types, and the rules for immunity, resistance and weakness.
   Used by enemies, bosses, hazards, items, trinkets and the player.
   The naming scheme is written down in docs/DAMAGE.md. Keep the two in step.
   No game state in here: every function takes the data it needs.
   ========================================================= */
"use strict";

/* ---------- The six damage tags ----------
   Piercing and slashing are "physical"; the other four are "elemental". The group is for
   the player's eye only: the rules treat every tag the same. */
const DAMAGE_TAGS = ["piercing", "slashing", "fire", "ice", "electricity", "venom"];

/* ---------- Names ----------
   Every damage tag has a BROAD word (covers the whole tag) and a NARROW word (a family of
   sources inside the tag). Each word is used with a KIND: Resistance, Weakness, Immunity.
   So "Fire Resistance" is the broad stat for every fire hit, and "Ember Resistance" is the
   narrow stat for hits flagged family "ember". They are two separate stats: a trinket can
   give either one or both.

   Stat ids are lowercase, dotted, and use the narrow word itself when they are narrow:
     broad:  "fire.resistance"    name "Fire Resistance"
     narrow: "ember.resistance"   name "Ember Resistance"   (tag: fire, family: ember) */
const DAMAGE_NAMES = {
  piercing:    { broad: "Piercing",   narrow: "Barb" },
  slashing:    { broad: "Slashing",   narrow: "Edge" },
  fire:        { broad: "Fire",       narrow: "Ember" },
  ice:         { broad: "Ice",        narrow: "Rime" },
  electricity: { broad: "Electric",   narrow: "Spark" },
  venom:       { broad: "Venom",      narrow: "Toxin" }
};
const STAT_KINDS = ["resistance", "weakness", "immunity"];
const KIND_NAMES = { resistance: "Resistance", weakness: "Weakness", immunity: "Immunity" };

/* ---------- The rule numbers ----------
   Percentages. An enemy's static "resist" or "weak" line counts as this many points.
   Resistance is capped, so nothing can become invulnerable except by immunity. */
const RULE_RESIST_POINTS = 50;   // enemy "resist = [fire]" -> fire.resistance 50
const RULE_WEAK_POINTS = 50;     // enemy "weak = [ice]"    -> ice.weakness 50
const RULE_IMMUNE_POINTS = 1;    // enemy "immune = [venom]" -> venom.immunity 1 (any amount above 0 means immune)
const RESISTANCE_CAP = 90;       // resistance never takes more than 90% off a hit
const WEAKNESS_CAP = 200;        // weakness never adds more than 200% to a hit

/* Build the table of every stat once: id -> { id, tag, family, kind, name, broad } */
const DAMAGE_STATS = (() => {
  const table = {};
  for (const tag of DAMAGE_TAGS) {
    for (const kind of STAT_KINDS) {
      const broadId = `${tag}.${kind}`;
      table[broadId] = {
        id: broadId, tag, family: null, kind, broad: true,
        name: `${DAMAGE_NAMES[tag].broad} ${KIND_NAMES[kind]}`
      };
      const narrow = DAMAGE_NAMES[tag].narrow.toLowerCase();
      const narrowId = `${narrow}.${kind}`;
      table[narrowId] = {
        id: narrowId, tag, family: narrow, kind, broad: false,
        name: `${DAMAGE_NAMES[tag].narrow} ${KIND_NAMES[kind]}`
      };
    }
  }
  return table;
})();

/* Look up the stat for a tag, kind and optional family. Returns the stat id. */
function damageStatId(tag, kind, family) {
  if (family) return `${family}.${kind}`;
  return `${tag}.${kind}`;
}

/* The display name of a stat id, or the id itself if it is unknown. */
function damageStatName(id) {
  const s = DAMAGE_STATS[id];
  return s ? s.name : id;
}

/* ---------- Checking content ----------
   Returns a list of problems (empty = fine). Used by content tests and the loader.
   spec: { tags?, family?, immune?, resist?, weak?, grants? } */
function checkDamageSpec(spec, where) {
  const problems = [];
  const label = where || "damage spec";
  const checkTags = (list, field) => {
    if (list === undefined) return;
    if (!Array.isArray(list)) { problems.push(`${label}: ${field} must be a list`); return; }
    for (const t of list) {
      if (!DAMAGE_TAGS.includes(t)) problems.push(`${label}: ${field} has unknown tag "${t}"`);
    }
  };
  checkTags(spec.tags, "tags");
  checkTags(spec.immune, "immune");
  checkTags(spec.resist, "resist");
  checkTags(spec.weak, "weak");
  if (spec.family !== undefined && !Object.values(DAMAGE_NAMES).some(n => n.narrow.toLowerCase() === spec.family)) {
    problems.push(`${label}: family "${spec.family}" is not a narrow damage word`);
  }
  if (spec.grants !== undefined) {
    if (!Array.isArray(spec.grants)) problems.push(`${label}: grants must be a list`);
    else for (const g of spec.grants) {
      if (!DAMAGE_STATS[g.stat]) problems.push(`${label}: grants unknown stat "${g.stat}"`);
      if (typeof g.amount !== "number") problems.push(`${label}: grants ${g.stat} needs a number amount`);
    }
  }
  for (const tag of DAMAGE_TAGS) {
    const lists = ["immune", "resist", "weak"].filter(k => Array.isArray(spec[k]) && spec[k].includes(tag));
    if (lists.length > 1) problems.push(`${label}: ${tag} is listed under ${lists.join(" and ")}`);
  }
  return problems;
}

/* ---------- Making a target ----------
   A target is a flat record: stat id -> points. Enemies, bosses, hazards and the player
   all become one of these, so the same rules apply to all of them.
   - ownStats: the numbers the thing already has (a player's trinkets, say)
   - rules:    the static lines from an enemy or hazard file: immune / resist / weak */
function makeDamageTarget(rules, ownStats) {
  const out = {};
  const add = (id, n) => { out[id] = (out[id] || 0) + n; };
  if (rules) {
    for (const tag of rules.immune || []) add(damageStatId(tag, "immunity"), RULE_IMMUNE_POINTS);
    for (const tag of rules.resist || []) add(damageStatId(tag, "resistance"), RULE_RESIST_POINTS);
    for (const tag of rules.weak || []) add(damageStatId(tag, "weakness"), RULE_WEAK_POINTS);
  }
  if (ownStats) {
    for (const id of Object.keys(ownStats)) add(id, ownStats[id]);
  }
  return out;
}

/* Add grants (a trinket's lines, say) onto a stat record. Returns the same record. */
function addDamageGrants(record, grants) {
  for (const g of grants || []) record[g.stat] = (record[g.stat] || 0) + g.amount;
  return record;
}

/* ---------- Resolving a hit ----------
   hit: { amount, tags, family? }
   Rules, per tag of the hit:
   - Immunity (broad, or narrow when the family matches) anywhere: that tag does 0.
   - Otherwise: multiplier = (1 - resistance/100) * (1 + weakness/100), with resistance
     capped at RESISTANCE_CAP and weakness at WEAKNESS_CAP. Broad and narrow stats add up.
   - A hit with several tags multiplies the per-tag multipliers together, so one immune
     tag blocks the whole hit (a fire+ice hit against a fire-immune target does nothing).
   Returns { damage, multiplier, blocked, parts } where parts explains each tag. */
function resolveDamageHit(target, hit) {
  const tags = hit.tags || [];
  const family = hit.family || null;
  let multiplier = 1;
  const parts = [];
  for (const tag of tags) {
    const famOK = family && DAMAGE_NAMES[tag] && DAMAGE_NAMES[tag].narrow.toLowerCase() === family;
    const narrowFam = famOK ? family : null;
    const read = (kind) => {
      const broad = target[damageStatId(tag, kind)] || 0;
      const narrow = narrowFam ? (target[damageStatId(tag, kind, narrowFam)] || 0) : 0;
      return broad + narrow;
    };
    const immune = read("immunity") > 0;
    const resist = Math.min(read("resistance"), RESISTANCE_CAP);
    const weak = Math.min(read("weakness"), WEAKNESS_CAP);
    const tagMult = immune ? 0 : (1 - resist / 100) * (1 + weak / 100);
    multiplier *= tagMult;
    parts.push({ tag, immune, resist, weak, multiplier: tagMult });
  }
  if (!tags.length) multiplier = 1;
  return {
    damage: hit.amount * multiplier,
    multiplier,
    blocked: multiplier === 0,
    parts
  };
}

/* ---------- Node test hook ----------
   Lets tools/tests/damage.test.js load this file. In the game there is no `module`. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DAMAGE_TAGS, DAMAGE_NAMES, DAMAGE_STATS, STAT_KINDS, KIND_NAMES,
    RULE_RESIST_POINTS, RULE_WEAK_POINTS, RULE_IMMUNE_POINTS, RESISTANCE_CAP, WEAKNESS_CAP,
    damageStatId, damageStatName, checkDamageSpec, makeDamageTarget, addDamageGrants, resolveDamageHit
  };
}
