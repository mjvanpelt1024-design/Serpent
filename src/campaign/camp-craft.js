/* =========================================================
   src/campaign/camp-craft.js
   The workshops behind the five merchants (build 51), their rules
   without their pictures (those are in camp-shop-stage.js):
     Armory    junk becomes trinkets and parts, fitted to gear for good
     Arcana    spell upgrade points, and wax seals
     Kitchen   recipes cooked into fresh snacks
     Familiars training that makes a familiar better
     Runes     five of a rune forged into one of a better condition
   Everything that takes time is an order (camp.orders) with a time it's
   ready; you collect it at its shop, and the map says when one is.
   The numbers are content/campaign/crafting.json.
   ========================================================= */
"use strict";

const CRAFT = CAMP.craft;
const HOUR = 3600000;
/* Which workshop each island's merchant keeps, by the family it sells */
const WORKSHOP_OF = { gear: "armory", spell: "arcana", food: "kitchen", pet: "kennel", rune: "forge" };
const WORKSHOP_KIND = { armory: "craft", arcana: "seal", kitchen: "cook", kennel: "train", forge: "forge" };
const WORKSHOP_NAME = { armory: "The Workbench", arcana: "The Sealing Desk", kitchen: "The Kitchen", kennel: "The Training Lagoon", forge: "The Rune Forge" };
const ORDER_SLOTS = 3;
const workshopOf = isl => WORKSHOP_OF[CAMP.islandById[isl].merchantFamily];
const islandOfWorkshop = ws => CAMP.islands.find(I => WORKSHOP_OF[I.merchantFamily] === ws).id;

/* ----- The save's new parts ----- */
CAMP_REPAIRS.push(c => {
  ["orders", "recipes"].forEach(k => { if (!Array.isArray(c[k])) c[k] = []; });
  if (!c.pins) c.pins = {};
  ["spellPts", "castPts", "daily"].forEach(k => { if (typeof c[k] !== "number") c[k] = 0; });
  if (!c.nextOrder) c.nextOrder = 1;
  c.nextOrder = Math.max(c.nextOrder, ...c.orders.map(o => o.n + 1), 1);
  c.satchel.forEach(it => {
    const d = CAMP.itemById[it.id];
    if (!Array.isArray(it.parts)) it.parts = [];
    ["trinket"].forEach(k => { if (typeof it[k] !== "string") it[k] = ""; });
    ["lv", "train"].forEach(k => { if (typeof it[k] !== "number") it[k] = 0; });
    if (typeof it.grade !== "number") it.grade = -1;
    if (!d) return;
    const fam = d.family;
    // gear from before build 51 gets the parts its rarity comes with, and lasts for good now
    if (fam === "gear") {
      if (!it.parts.length && !it._fitted) it.parts = builtInParts(it.id, it.rarity);
      it.parts = [...new Set(it.parts.filter(p => CAMP.craftById[p] && CAMP.craftById[p].fits === gearClass(it.id)))].slice(0, 2);
      if (it.trinket && !(CAMP.craftById[it.trinket] && CAMP.craftById[it.trinket].stat)) it.trinket = "";
    } else { it.parts = []; it.trinket = ""; }
    if (fam !== "spell") { it.lv = 0; it.seal = false; }
    if (fam !== "pet") it.train = 0;
    if (fam !== "rune") it.grade = -1;
    if (fam !== "food") it.fresh = false;
    // (gear and spells are refilled at the start of every level: campRefillKit)
  });
  // orders pointing at things that are gone are dropped (their item was sold, say)
  c.orders = c.orders.filter(o => !["seal", "train"].includes(o.kind) || c.satchel.some(it => it.uid === o.uid));
});

/* ----- Gear: one hit a level, plus each part fitted, plus a trinket ----- */
const gearClass = id => (id === "sword" ? "weapon" : "armor");
const partsFor = id => (CRAFT.parts || []).filter(p => p.fits === gearClass(id));
/* Gear from the merchant comes with parts already fitted: uncommon one, rare and legendary both */
function builtInParts(id, rarity) {
  const n = ((CRAFT.armory || {}).builtIn || {})[rarity] || 0;
  return partsFor(id).slice(0, n).map(p => p.id);
}
function gearUses(it) {
  const base = (CRAFT.armory || {}).baseUses || 1;
  const parts = it ? (it.parts || []).length : 0;
  return base + parts + (it && it.trinket ? 1 : 0) + upVal("sturdy");
}
const trinketDef = it => (it && it.trinket ? CAMP.craftById[it.trinket] : null);
/* What the worn gear's trinket adds to the level's stats (the rune table's names) */
function gearExtras() {
  const it = campEquipped("gear"), t = trinketDef(it);
  return t ? { [t.stat]: t.v } : {};
}
/* Fits a part or trinket from the satchel to a piece of gear, for good */
function campFit(gearUid, craftUid) {
  const g = satchelItem(gearUid), p = satchelItem(craftUid);
  if (!g || !p || campItemSlot(g.id) !== "gear" || !CAMP.craftById[p.id]) return "That doesn't fit.";
  const def = CAMP.craftById[p.id];
  if (def.stat) {
    if (g.trinket) return "This piece already has a trinket. Trinkets are fitted for good.";
    g.trinket = p.id;
  } else {
    if (def.fits !== gearClass(g.id)) return `${def.name} is for ${def.fits === "weapon" ? "weapons" : "armor"}.`;
    if (g.parts.includes(p.id)) return `This piece already has ${def.name}.`;
    g.parts.push(p.id);
  }
  if (p.qty > 1) p.qty--; else campDrop(p.uid);
  g.uses = freshUses(g.id, g.rarity, g);
  campBump("fitted");
  saveCamp();
  return "";
}

/* ----- Spells: ten levels bought with upgrade points, and a seal ----- */
const SP = CRAFT.spells || { maxLevel: 10, cost: [], powerPerLevel: 5, chargeAt: [], seal: {} };
const spellLevelCost = lv => SP.cost[lv] || 99;          // points for the next level from lv
const spellPointsIn = it => SP.cost.slice(0, it.lv || 0).reduce((a, b) => a + b, 0);
const spellCharges = it => SP.chargeAt.filter(l => (it.lv || 0) >= l).length + (it.seal ? SP.seal.charges || 0 : 0);
const spellPowerMult = it => 1 + ((it.lv || 0) * SP.powerPerLevel + (it.seal ? SP.seal.power || 0 : 0)) / 100;
function campSpellUp(uid, d) {
  const it = satchelItem(uid);
  if (!it || campItemSlot(it.id) !== "spell") return "";
  if (it.seal) return "It's sealed: no points go in or come out.";
  if (orderFor(uid)) return "It's away being sealed.";
  if (d > 0) {
    if (it.lv >= SP.maxLevel) return "It's at its best already.";
    const cost = spellLevelCost(it.lv);
    if (camp.spellPts < cost) return `You need ${cost} upgrade points for the next level.`;
    camp.spellPts -= cost; it.lv++;
  } else {
    if (it.lv <= 0) return "";
    it.lv--; camp.spellPts += spellLevelCost(it.lv);
  }
  it.uses = freshUses(it.id, it.rarity, it);
  saveCamp();
  return "";
}
/* Upgrade points: a daily gift, quests, challenges, casting, gems */
function campGiveSpellPts(n, why) {
  camp.spellPts += n;
  saveCamp();
  if (why) showToast(`+${n} spell upgrade point${n === 1 ? "" : "s"} (${why})`);
}
const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
function campDailyGift() {
  if (!camp || camp.daily >= dayNumber()) return;
  camp.daily = dayNumber();
  campGiveSpellPts(SP.dailyPoints || 1, "daily gift");
}
function campNoteCast() {
  camp.castPts++;
  if (camp.castPts >= (SP.castsPerPoint || 10)) { camp.castPts = 0; campGiveSpellPts(1, "practice makes perfect"); }
}

/* ----- Familiars: training makes them better ----- */
const TR = CRAFT.training || { maxLevel: 3, hours: [], price: [], better: 12 };
/* Cooldown familiars (lower is better) get quicker; the rest get stronger */
function petPower(it, base) {
  const k = (it.train || 0) * TR.better / 100;
  if (["firefly", "crab", "turtle"].includes(it.id)) return Math.max(1, Math.round(base * (1 - k) * 10) / 10);
  return Math.round(base * (1 + k) * 10) / 10;
}

/* ----- Runes: eight conditions, the in-between four forged from five ----- */
const FG = CRAFT.forge || { grades: ["Broken", "Refurbished", "Cracked", "Repaired", "Fine", "Polished", "Pristine", "Legendary"], hours: [], need: 5, lower: 15, legendBoost: 35, legendMild: 25, sell: [] };
const RUNE_GRADES8 = ["broken", "refurbished", "cracked", "repaired", "fine", "polished", "pristine", "legendary"];
/* A rune's exact condition 0-7: found and bought ones are 0, 2, 4 or 6 */
const runeGrade = it => (typeof it.grade === "number" && it.grade >= 0 ? it.grade : rarityIdx(it.rarity) * 2);
const gradeRarity = g => CAMP.rarities[Math.min(3, Math.floor((g + 1) / 2))].id;
/* A stat's value at a condition. Forged in-betweens are a little under the condition they copy
   (good sides weaker, bad sides worse); legendary is past pristine both ways */
function runeStatAt(v, g, good) {
  if (g % 2 === 0) return v[g / 2];
  const lower = FG.lower / 100;
  if (g === 7) return Math.round(v[3] * (good ? 1 + FG.legendBoost / 100 : 1 - FG.legendMild / 100) * 10) / 10;
  const like = v[(g + 1) / 2];
  return Math.round(like * (good ? 1 - lower : 1 + lower) * 10) / 10;
}
/* Five of the same rune in the same original condition, none of them active or busy */
function forgeStacks() {
  const groups = {};
  camp.satchel.forEach(it => {
    if (campItemSlot(it.id) !== "rune") return;
    const g = runeGrade(it);
    if (g % 2) return;
    (groups[it.id + ":" + g] = groups[it.id + ":" + g] || []).push(it);
  });
  return Object.entries(groups).map(([k, list]) => ({ id: k.split(":")[0], grade: +k.split(":")[1], list }));
}

/* ----- The kitchen ----- */
const KT = CRAFT.kitchen || { hours: [2, 4, 6, 8], freshCharges: 1, recipePrice: [], findShare: 0 };
const recipeCost = r => r.needs.map(id => CAMP.ingredientById[id]).filter(Boolean);
/* What a recipe's ingredients cost, island by island: { keep: 24, spire: 16 } */
function recipeBill(r) {
  const bill = {};
  recipeCost(r).forEach(i => { bill[i.island] = (bill[i.island] || 0) + Math.round(i.price * (1 + rarityIdx(r.rarity) * 0.5)); });
  return bill;
}
const canPayBill = bill => Object.entries(bill).every(([isl, n]) => campWallet(isl) >= n);
const recipePrice = r => (KT.recipePrice || [])[rarityIdx(r.rarity)] || 100;

/* ----- Orders ----- */
const orderFor = uid => camp.orders.find(o => o.uid === uid && ["seal", "train"].includes(o.kind)) || null;
const itemAway = uid => !!orderFor(uid);
const ordersAt = ws => camp.orders.filter(o => o.kind === WORKSHOP_KIND[ws]);
const orderReady = o => Date.now() >= o.readyAt;
const readyOrders = () => camp.orders.filter(orderReady);
function campOrder(ws, what, hours, extra = {}) {
  if (ordersAt(ws).length >= ORDER_SLOTS) return null;
  const now = Date.now();
  const o = Object.assign({ n: camp.nextOrder++, kind: WORKSHOP_KIND[ws], isl: islandOfWorkshop(ws), what, uid: 0, rarity: "common", grade: -1, at: now, readyAt: now + hours * HOUR }, extra);
  camp.orders.push(o);
  // an item that goes away comes off you while it's gone
  if (o.uid) { Object.keys(camp.equip).forEach(s => { if (camp.equip[s] === o.uid) delete camp.equip[s]; }); }
  saveCamp();
  campOrdersChanged();
  return o;
}
/* Picks up a ready order. Returns words for a toast. */
function campCollect(n) {
  const o = camp.orders.find(x => x.n === n);
  if (!o || !orderReady(o)) return "";
  camp.orders = camp.orders.filter(x => x !== o);
  let said = "";
  if (o.kind === "craft") { const it = campGive(o.what); said = `${CAMP.craftById[o.what].name} is ready. Fit it to your gear at the workbench.`; void it; }
  else if (o.kind === "seal") { const it = satchelItem(o.uid); if (it) { it.seal = true; it.uses = freshUses(it.id, it.rarity, it); said = `Your ${campItemName(it)} is sealed.`; } }
  else if (o.kind === "cook") {
    const r = CAMP.recipeById[o.what];
    const it = campGive(r.makes, r.rarity, { fresh: true });
    said = `${campItemName(it)}, fresh from the oven.`;
  } else if (o.kind === "train") { const it = satchelItem(o.uid); if (it) { it.train = Math.min(TR.maxLevel, (it.train || 0) + 1); said = `${campItemDef(it.id).name} is back from training, sharper than ever.`; } }
  else if (o.kind === "forge") {
    const it = campGive(o.what, gradeRarity(o.grade), { grade: o.grade });
    said = `Forged: ${campItemName(it)}.`;
  }
  campBump("ordersCollected");
  saveCamp();
  campOrdersChanged();
  return said;
}
function campCancelOrder(n) {
  const o = camp.orders.find(x => x.n === n);
  if (!o) return;
  camp.orders = camp.orders.filter(x => x !== o);
  saveCamp();
  campOrdersChanged();
}
/* Anything that shows orders redraws: the map's notices, the shop */
let ordersSeenReady = "";
function campOrdersChanged() {
  if (typeof renderOrderNotices === "function") renderOrderNotices();
}
/* Once a second: an order that just came ready says so */
setInterval(() => {
  if (!camp || !camp.orders || !camp.orders.length) return;
  const ready = readyOrders().map(o => o.n).join(",");
  if (ready !== ordersSeenReady) {
    const fresh = ready && ready.split(",").filter(n => !ordersSeenReady.split(",").includes(n));
    ordersSeenReady = ready;
    if (fresh && fresh.length && typeof campRun !== "undefined" && !campRun) {
      const o = camp.orders.find(x => String(x.n) === fresh[0]);
      if (o) showToast(`${CAMP.islandById[o.isl].npcs.merchant.name}: your order is ready to pick up!`);
    }
    campOrdersChanged();
  }
}, 1000);

/* How an order reads: "Frost Locket", "sealing Fireball", "Fresh Hearty Stew"... */
function orderLabel(o) {
  if (o.kind === "craft") return (CAMP.craftById[o.what] || { name: o.what }).name;
  if (o.kind === "cook") return `Fresh ${campItemDef(CAMP.recipeById[o.what].makes).name}`;
  if (o.kind === "forge") return `${FG.grades[o.grade]} ${campItemDef(o.what).name}`;
  const it = satchelItem(o.uid);
  if (o.kind === "seal") return `Sealing ${it ? campItemDef(it.id).name : "a spell"}`;
  return `${it ? campItemDef(it.id).name : "A familiar"} in training`;
}

/* ----- Junk: three grades, found island by island ----- */
const lootGrade = id => (CAMP.lootById[id] || {}).grade || "common";
const LOOT_GRADE_COLOR = () => Object.fromEntries((CAMP.lootGrades || []).map(g => [g.id, g.color]));
function rollLoot(islandN) {
  const pool = CAMP.loot.filter(l => l.island === islandN);
  const w = Object.fromEntries((CAMP.lootGrades || []).map(g => [g.id, g.weight]));
  let r = Math.random() * pool.reduce((a, l) => a + (w[l.grade] || 1), 0);
  for (const l of pool) { r -= w[l.grade] || 1; if (r <= 0) return l; }
  return pool[0];
}
/* How many of a junk material you have */
const haveLoot = id => camp.satchel.filter(it => it.id === id).reduce((a, it) => a + (it.qty || 1), 0);
function takeLoot(id, n = 1) {
  for (const it of camp.satchel.filter(x => x.id === id)) {
    while (n > 0 && it.qty > 0) { it.qty--; n--; }
    if (it.qty <= 0) campDrop(it.uid);
    if (n <= 0) break;
  }
}
const canCraft = def => def.needs.every(id => haveLoot(id) >= 1);
const craftHours = def => (def.hours || (CRAFT.armory.trinketHours || [2, 4, 6, 8])[(def.tier || 1) - 1] || 4);

/* ----- Words ----- */
function craftFacts(def) {
  if (def.stat) {
    const S = RUNE_STATS[def.stat] || FOE_STATS[def.stat];
    return `+1 hit absorbed. ${S ? S.long(def.v) : def.text}.`;
  }
  return def.text;
}
/* Stats only trinkets and the new foes use (the rune table's style) */
const FOE_STATS = {
  thiefGuard: { pct: true, long: v => `Point thieves take ${v}% less from your body`, short: v => `-${v}% stolen` },
  stingGuard: { pct: true, long: v => `${v}% of stings and bites on your body miss`, short: v => `${v}% body hits miss` },
  coldWard: { pct: true, long: v => `${v}% chance cold things miss you`, short: v => `${v}% cold ward` },
  heatWard: { pct: true, long: v => `${v}% chance hot things miss you`, short: v => `${v}% heat ward` }
};
Object.assign(RUNE_STATS, FOE_STATS);

/* Every picture here (junk, snacks, recipes, trinkets and parts, the forged rune conditions) is a
   PNG in textures/: junk/, items/, crafted/ and items/runes/<condition>/. */
