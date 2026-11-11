/* =========================================================
   src/campaign/camp-arsenal.js
   Damage types in the campaign (build 52): what your kit is made of
   and what every hit is made of. The rules themselves are step 2's
   (src/game/damage/damage.js, docs/DAMAGE.md); this file feeds them.

     stat lines   every weapon, armor piece and familiar has a list of
                  stats; its rarity sets how many of them it has
                  (statsByRarity: 1 common ... 4 legendary)
     armor sets   a helmet and a body piece of the same set give the
                  set's bonus (and its drawback) when both are worn
     trinkets     two lines each, a major one and a minor one; one fits
                  on any piece of gear or armor
     your target  everything above, your rune and any power-up you
                  picked up add up into one record of stat id -> points;
                  every hit's tags (foes.json "hits") are resolved
                  against it: immune, resisted, or worse (weak)
     weapons      a weapon's blows have tags and a damage level; foes
                  and bosses take them by their own immune/resist/weak
                  rules, and each tag brings a trait (burn, chill...)
     spells       spells have tags too; "<word>.spells" stats and
                  spellPower make them stronger

   New items borrow an old item's behavior with "acts" (an Ice Lance
   flies like a fireball). campItemActs(id) gives the borrowed id.
   ========================================================= */
"use strict";

/* ----- Words for every stat ----- */
const ARS_WORDS = (() => {
  const out = [];
  DAMAGE_TAGS.forEach(tag => {
    out.push({ word: DAMAGE_NAMES[tag].broad, id: tag, tag, family: null });
    out.push({ word: DAMAGE_NAMES[tag].narrow, id: DAMAGE_NAMES[tag].narrow.toLowerCase(), tag, family: DAMAGE_NAMES[tag].narrow.toLowerCase() });
  });
  return out;
})();
/* The spell stats: "fire.spells" (Fire Spells) boosts every spell with the fire tag, "ember.spells"
   (Ember Spells) only spells of the ember family. Same first-name / second-name words as damage. */
const SPELL_STATS = Object.fromEntries(ARS_WORDS.map(w => [`${w.id}.spells`, { id: `${w.id}.spells`, tag: w.tag, family: w.family, name: `${w.word} Spells` }]));

/* Every damage stat and spell stat joins the rune table, so runes, trinkets, armor and familiars can
   all use them and runeVal(id) reads them. Resistance and weakness are percentages; immunity is on or off. */
Object.values(DAMAGE_STATS).forEach(s => {
  RUNE_STATS[s.id] = s.kind === "immunity"
    ? { long: () => `${s.name}: ${s.broad ? s.tag : s.family} hits can't hurt you`, short: () => s.name }
    : { pct: true, long: v => `${s.name} ${v}%: ${s.broad ? s.tag : s.family} hits do ${v}% ${s.kind === "resistance" ? "less" : "more"} to you`, short: v => `${s.name} ${v}%` };
});
Object.values(SPELL_STATS).forEach(s => {
  RUNE_STATS[s.id] = { pct: true, long: v => `${s.name} +${v}%: ${s.family || s.tag} spells are ${v}% stronger`, short: v => `${s.name} +${v}%` };
});
Object.assign(RUNE_STATS, {
  spellPower: { pct: true, long: v => `Spell Power +${v}%: every spell is ${v}% stronger`, short: v => `Spell Power +${v}%` },
  // charges are whole: a forged in-between condition's 2.7 is 2
  spellCharges: { long: v => `+${Math.floor(v)} spell ${Math.floor(v) === 1 ? "charge" : "charges"} a level`, short: v => `+${Math.floor(v)} spell ${Math.floor(v) === 1 ? "charge" : "charges"}` }
});

/* A stat's name as the player sees it: "Fire Resistance", "Ember Spells", or the rune table's short words */
function arsStatName(id) {
  if (DAMAGE_STATS[id]) return DAMAGE_STATS[id].name;
  if (SPELL_STATS[id]) return SPELL_STATS[id].name;
  return id;
}
/* One stat line in words. A negative number reads the other way round ("recharges 15% faster"). */
function arsStatLine(stat, v, form = "short") {
  const S = RUNE_STATS[stat];
  if (!S) return `${stat} ${v}`;
  if (stat === "castCooldown" && v < 0) return form === "long" ? `Your spell recharges ${-v}% faster` : `spell recharge -${-v}%`;
  if (stat === "damage" && v < 0) return form === "long" ? `You take ${-v}% less damage` : `-${-v}% damage taken`;
  return S[form](v);
}
const arsLines = (list, form) => (list || []).map(s => arsStatLine(s.stat, s.v, form));

/* ----- Items ----- */
const campItemActs = id => { const d = campItemDef(id); return d && d.acts ? d.acts : id; };
const campItemPiece = id => { const d = campItemDef(id); return d && d.family === "gear" ? d.piece || "gear" : null; };
/* How many stat lines an item has at its rarity */
const statCount = rarity => CAMP.statsByRarity[rarityIdx(rarity)] || 1;
function itemStatLines(id, rarity) {
  const d = campItemDef(id);
  return d && d.stats ? d.stats.slice(0, statCount(rarity)) : [];
}
/* A trinket's two lines at a rarity: major first, then minor (build 53: the rarity scales the numbers) */
function trinketLines(t, rarity = "common") {
  if (!t) return [];
  return [t.major || { stat: t.stat, v: t.v }].concat(t.minor ? [t.minor] : []).map(l => ({ stat: l.stat, v: trinketVal(l.stat, l.v, rarity) }));
}
const armorSetOf = id => { const d = campItemDef(id); return d && d.set ? CAMP.armorSetById[d.set] || null : null; };
const armorTierName = tier => (CAMP.armorTiers.find(t => t.tier === tier) || { name: "" }).name;
/* Is the whole set on? Both pieces of the same set, worn */
function wornSet() {
  const h = campEquipped("helmet"), b = campEquipped("body");
  if (!h || !b) return null;
  const sh = armorSetOf(h.id), sb = armorSetOf(b.id);
  return sh && sb && sh.id === sb.id ? sh : null;
}

/* Everything your kit adds to a level's stat table (the rune table's names, read with runeVal):
   each worn piece's stat lines, every fitted trinket's two lines, your familiar's lines and the set bonus. */
function kitStats() {
  const out = {};
  const add = list => (list || []).forEach(s => { out[s.stat] = (out[s.stat] || 0) + s.v; });
  if (!camp) return out;
  ["gear", "helmet", "body", "pet"].forEach(slot => {
    const it = campEquipped(slot);
    if (!it || itemAway(it.uid)) return;
    add(itemStatLines(it.id, it.rarity));
    if (slot !== "pet") add(trinketLines(trinketDef(it), it.trinketR));
  });
  const set = wornSet();
  if (set) { add(set.bonus); add(set.bad); }
  return out;
}

/* ----- What hits are made of ----- */
const ENEMY_DEFS = () => CAMP.foes.enemies || [];
const enemyDef = type => ENEMY_DEFS().find(e => e.id === type) || null;
/* The tags of the hit a cause deals: { tags, family } or null */
function campHitFor(cause) {
  const H = CAMP.foes.hits || {};
  if (H[cause] && H[cause].tags) return H[cause];
  const e = enemyDef(cause);
  if (e && e.hit) return e.hit;
  if (boss && boss.champion && cause === "boss") return { tags: ["slashing"] };
  return null;
}
/* Power-ups grant stats for a few seconds: campRun.grants = [{ stat, amount, until, label, color }] */
function grantVal(stat, ts = performance.now()) {
  if (!campRun) return 0;
  let v = 0;
  (campRun.grants || []).forEach(g => { if (g.stat === stat && ts < g.until) v += g.amount; });
  // a spell that grants something while it's up (Flame Shroud: Fire Immunity)
  if (campRun.fieldGrants && fieldOn(ts)) campRun.fieldGrants.forEach(g => { if (g.stat === stat) v += g.amount; });
  return v;
}
function campGrant(list, secs, label, color) {
  campRun.grants = (campRun.grants || []).filter(g => g.until > performance.now());
  const until = performance.now() + secs * 1000;
  list.forEach(g => campRun.grants.push({ stat: g.stat, amount: g.amount, until, label, color }));
}
/* You, as a damage target: every damage stat from your kit, your rune and your power-ups */
function campPlayerTarget(ts = performance.now()) {
  const t = {};
  Object.keys(DAMAGE_STATS).forEach(id => { const v = runeVal(id) + grantVal(id, ts); if (v) t[id] = v; });
  return t;
}
/* A hit of `hearts` from `cause`, against your resistances. Returns { hearts, blocked, why }.
   Damage comes in halves: what resistance takes off (or weakness adds on) carries over between hits,
   so 50% resistance against half-heart hits lets every other one through. */
let arsLastToast = 0;
function campResistHit(hearts, cause) {
  const hit = campHitFor(cause);
  if (!campRun || !hit || !hit.tags || !hit.tags.length || hearts === Infinity) return { hearts, blocked: false };
  const r = resolveDamageHit(campPlayerTarget(), { amount: 1, tags: hit.tags, family: hit.family });
  const ts = performance.now();
  const say = text => { if (ts - arsLastToast > 1200) { arsLastToast = ts; showToast(text); } };
  if (r.blocked) {
    // which immunity did it: the broad one for the tag, or the narrow one for the hit's family
    const p = r.parts.find(x => x.immune);
    const target = campPlayerTarget();
    const broadId = `${p.tag}.immunity`, narrowId = hit.family ? `${hit.family}.immunity` : "";
    const name = (target[broadId] > 0 || !DAMAGE_STATS[narrowId] ? DAMAGE_STATS[broadId] : DAMAGE_STATS[narrowId]).name;
    say(`${name}! It can't hurt you.`);
    sfx("pop");
    return { hearts: 0, blocked: true, why: name };
  }
  if (r.multiplier === 1) return { hearts, blocked: false };
  const halves = hearts * 2 * r.multiplier + (campRun.resistCarry || 0);
  const whole = Math.floor(halves + 1e-9);
  campRun.resistCarry = halves - whole;
  if (whole <= 0) { say("Your resistance soaked that one up."); sfx("rock"); return { hearts: 0, blocked: true, why: "resistance" }; }
  return { hearts: whole / 2, blocked: false };
}

/* ----- Weapons: tags, damage levels and traits ----- */
const campWeapon = () => { if (campBare()) return null; const it = campEquipped("gear"); return it && campItemActs(it.id) === "sword" ? it : null; };
const weaponHit = it => { const d = it && campItemDef(it.id); return d && d.hit ? d.hit : null; };
const weaponTraits = it => { const d = it && campItemDef(it.id); return (d && d.traits) || []; };
/* How hard a weapon is at its rarity: what it adds to every blow on a boss */
const weaponDamage = it => { const d = campItemDef(it.id); return d && d.damage ? d.damage[rarityIdx(it.rarity)] : it.rarity === "legendary" ? 2 : 1; };
/* An enemy's static rules (immune / resist / weak), from foes.json */
function foeRules(type) {
  const e = enemyDef(type);
  if (e) return { immune: e.immune, resist: e.resist, weak: e.weak };
  return (CAMP.foes.rules || {})[type] || null;
}
/* How a foe takes a hit with these tags: the damage rules' multiplier (0 = immune) */
function foeTakes(type, hit) {
  if (!hit || !hit.tags || !hit.tags.length) return 1;
  const rules = foeRules(type);
  if (!rules) return 1;
  return resolveDamageHit(makeDamageTarget(rules), { amount: 1, tags: hit.tags, family: hit.family }).multiplier;
}
/* How the boss (or champion) takes a hit with these tags */
function bossTakes(hit) {
  if (!boss || !hit || !hit.tags || !hit.tags.length) return 1;
  return resolveDamageHit(makeDamageTarget(boss.rules || {}), { amount: 1, tags: hit.tags, family: hit.family }).multiplier;
}
/* n blows times a multiplier, in whole blows: what's left over carries to the next blow */
function bossBlows(n, mult) {
  if (mult === 1) return n;
  const v = n * mult + (boss.blowCarry || 0);
  const whole = Math.floor(v + 1e-9);
  boss.blowCarry = v - whole;
  return whole;
}
const tagWord = hit => (hit && hit.tags ? hit.tags.map(t => DAMAGE_NAMES[t].broad.toLowerCase()).join(" and ") : "");

/* An enemy cut down by a weapon with traits: shock leaps on, cleave takes the neighbors, chill slows hazards */
function weaponKillTraits(it, victim) {
  const traits = weaponTraits(it);
  if (!traits.length) return;
  const ts = performance.now();
  const foes = () => entities.filter(e => e !== victim && (FOES[e.type] || ["wasp", "ghost"].includes(e.type)));
  if (traits.includes("cleave")) {
    foes().filter(e => Math.abs(e.x - snake.x) <= cell && Math.abs(e.y - snake.y) <= cell && foeTakes(e.type, weaponHit(it)) > 0).forEach(e => { removeEntity(e); campBonusEvent("kill"); });
  }
  if (traits.includes("shock")) {
    const near = foes().filter(e => foeTakes(e.type, weaponHit(it)) > 0 && Math.abs(e.x - snake.x) + Math.abs(e.y - snake.y) <= cell * 5)
      .sort((a, b) => (Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)) - (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)))[0];
    if (near) { removeEntity(near); campBonusEvent("kill"); campRun.shockFx = { x: near.x, y: near.y, at: ts }; sfx("fire"); }
  }
  if (traits.includes("chill")) freezeHazards(1000);
}

/* A weapon (or a spell) with traits struck the boss: burn, chill, toxin. Pierce is counted in bossBlow. */
function bossTraits(traits, hit) {
  if (!boss || boss.beaten || !traits || !traits.length) return;
  const ts = performance.now();
  if (traits.includes("burn") && bossTakes({ tags: ["fire"] }) > 0 && !boss.burnAt) boss.burnAt = ts + 1500;
  if (traits.includes("chill") && bossTakes({ tags: ["ice"] }) > 0) boss.frozenUntil = Math.max(boss.frozenUntil, ts + 1200);
  if (traits.includes("toxin") && bossTakes({ tags: ["venom"] }) > 0) { if (!(boss.poisonUntil > ts)) showToast(`${boss.def.name.split(" ")[0]} is poisoned!`); boss.poisonUntil = ts + 8000; }
}

/* ----- Spells: tags, and what boosts them ----- */
const spellHit = it => { const d = it && campItemDef(it.id); return d && d.hit ? d.hit : null; };
/* Spell Power and the "<word>.spells" stats that match this spell's tags, in % */
function spellBoost(it) {
  if (!campRun || !it) return 0;
  let b = runeVal("spellPower");
  const hit = spellHit(it);
  if (hit && hit.tags) hit.tags.forEach(tag => {
    b += runeVal(`${tag}.spells`);
    const narrow = DAMAGE_NAMES[tag].narrow.toLowerCase();
    if (hit.family === narrow) b += runeVal(`${narrow}.spells`);
  });
  return b;
}

/* ----- Hooks ----- */
(() => {
  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== "function") { console.warn("arsenal hook: no " + name); return; }
    window[name] = fn(orig);
  };
  // the kit's stats (armor, weapon, familiar, trinkets, set bonus) go in the level's table with the rune's
  wrap("gearExtras", () => () => kitStats());
  // the shop's and Satchel's words: stat lines, tags, traits, the set
  wrap("itemFacts", orig => function (id, rarity, own) {
    const html = orig.apply(this, arguments);
    const d = campItemDef(id);
    if (!d || d.family === "rune") return html;
    const bits = [];
    const lines = itemStatLines(id, rarity);
    if (lines.length) bits.push(`<div class="shop-meta">${lines.map(s => `<span class="cs-stat">${escapeAttr(arsStatLine(s.stat, s.v))}</span>`).join("")}${d.stats.length > lines.length ? `<span class="cs-dim">${d.stats.length - lines.length} more at a higher rarity</span>` : ""}</div>`);
    if (d.hit) bits.push(`<div class="shop-meta"><span class="cs-tag">${escapeAttr(d.hit.tags.map(t => DAMAGE_NAMES[t].broad).join(" + "))}${d.hit.family ? ` (${escapeAttr(DAMAGE_NAMES[DAMAGE_STATS[d.hit.family + ".resistance"].tag].narrow)})` : ""}</span>${d.damage ? `<span class="cs-stat">Damage ${d.damage[rarityIdx(rarity)]}</span>` : ""}${(d.traits || []).map(t => `<span class="cs-good" title="${escapeAttr((CAMP.weaponTraits[t] || {}).text || "")}">${escapeAttr((CAMP.weaponTraits[t] || { name: t }).name)}</span>`).join("")}</div>`);
    const set = armorSetOf(id);
    if (set) bits.push(`<div class="shop-meta"><span class="cs-tag">${escapeAttr(set.name)} set · ${escapeAttr(armorTierName(set.tier))}</span><span class="cs-good">Both pieces: ${escapeAttr(arsLines(set.bonus).join(", "))}</span>${set.bad && set.bad.length ? `<span class="cs-weak">${escapeAttr(arsLines(set.bad).join(", "))}</span>` : ""}</div>`);
    if (d.grants) bits.push(`<div class="shop-meta"><span class="cs-good">While it's up: ${escapeAttr(arsLines(d.grants.map(g => ({ stat: g.stat, v: g.amount }))).join(", "))}</span></div>`);
    return html + bits.join("");
  });
  // a trinket's words: both lines
  wrap("craftFacts", orig => function (def, rarity) {
    if (!def || !def.major) return orig.apply(this, arguments);
    // a made one: its own rarity's numbers; a recipe: what each rarity it can come out as gives
    if (rarity) return `${trinketSummary(def, rarity)}. +1 hit absorbed on the piece it's fitted to.`;
    const w = (((CRAFT.armory || {}).trinketRarity) || [])[(def.tier || 1) - 1] || [1, 0, 0, 0];
    const can = CAMP.rarities.filter((r, i) => w[i] > 0);
    return `Comes out ${can.map(r => r.name.toLowerCase()).join(", ")}. ${can.map(r => `${r.name}: ${trinketSummary(def, r.id)}`).join(". ")}. +1 hit absorbed on the piece it's fitted to.`;
  });
  // armor sets cost what their tier says; a merchant's price
  wrap("offerPrice", orig => function (isl, o) {
    const p = orig.apply(this, arguments);
    const d = campItemDef(o.id);
    return d && d.priceMult ? Math.max(1, Math.round(p * d.priceMult)) : p;
  });
  // Spell Charges (armor, runes): more charges in your spell for the level
  wrap("campStart", orig => function () {
    orig.apply(this, arguments);
    if (!campRun || campBare()) return;
    const s = campEquipped("spell"), n = Math.floor(runeVal("spellCharges"));
    if (s && n > 0) s.uses += n;
  });
  // timed grants stop with the clock when you pause
  wrap("campShiftTimers", orig => function (d) {
    orig.apply(this, arguments);
    (campRun.grants || []).forEach(g => { g.until += d; });
    if (boss) ["burnAt", "poisonUntil", "phaseUntil", "hardenUntil"].forEach(k => { if (boss[k]) boss[k] += d; });
    if (boss && boss.traitAt) Object.keys(boss.traitAt).forEach(k => { boss.traitAt[k] += d; });
    if (campRun.championAt) campRun.championAt += d;
  });
  // poison makes a boss tire half again as fast
  wrap("bossDrain", orig => function (ts) {
    const d = orig.apply(this, arguments);
    return boss && ts < (boss.poisonUntil || 0) ? d * 1.5 : d;
  });
  // a burning boss takes one more blow a moment after it was struck
  wrap("tickBoss", orig => function (ts) {
    orig.apply(this, arguments);
    if (boss && !boss.beaten && boss.burnAt && ts >= boss.burnAt) {
      boss.burnAt = 0;
      if (!bossHardened(ts)) damageBoss(1, "burn");
    }
  });
})();
const bossHardened = (ts = performance.now()) => !!boss && (ts < (boss.hardenUntil || 0) || ts < (boss.phaseUntil || 0));
