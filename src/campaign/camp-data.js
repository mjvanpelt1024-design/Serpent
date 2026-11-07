/* =========================================================
   src/campaign/camp-data.js
   The campaign's data (content/campaign/), arranged for lookups
   ========================================================= */
"use strict";

const CAMP = (() => {
  const C = CONTENT.campaign;
  const islands = C.islands.slice().sort((a, b) => a.n - b.n);
  const upgradeById = {};
  const treeOf = {};
  islands.forEach(isl => {
    const tree = (C.upgrades.trees || {})[isl.id] || { name: "Tree", upgrades: [] };
    isl.tree = tree;
    tree.upgrades.forEach(u => { upgradeById[u.id] = u; treeOf[u.id] = isl.id; });
  });
  const items = C.items.items || [];
  // build 53: nightmare mode's things (content/campaign/nightmare.json). They aren't in `items` (the merchants'
  // and finds' pools): only the deep sells them. itemById knows them, so a satchel can hold them.
  const NM = C.nightmare || {};
  const nmItems = (NM.items || []).map(it => Object.assign({ nightmare: true }, it));
  // its snakes' bites carry damage tags like any other hit
  if (C.foes) { C.foes.hits = C.foes.hits || {}; (NM.snakes || []).forEach(s => { if (s.hit && !C.foes.hits[s.id]) C.foes.hits[s.id] = s.hit; }); }
  // build 52: a trinket's major line also answers to .stat and .v (the workshop's code asks for those),
  // and armor pieces cost what their set's tier says
  ((C.crafting || {}).trinkets || []).forEach(t => { if (t.major && t.stat === undefined) { t.stat = t.major.stat; t.v = t.major.v; } });
  const sets = C.items.armorSets || [], tiers = C.items.armorTiers || [];
  items.forEach(it => {
    const s = it.set && sets.find(x => x.id === it.set);
    const t = s && tiers.find(x => x.tier === s.tier);
    if (t && !it.priceMult) it.priceMult = t.priceMult;
  });
  return {
    islands,
    islandById: Object.fromEntries(islands.map(i => [i.id, i])),
    items,
    itemById: Object.fromEntries(items.concat(nmItems).map(i => [i.id, i])),
    nightmare: NM,
    nmItems,
    families: C.items.families || {},
    rarities: C.items.rarities || [],
    rarityById: Object.fromEntries((C.items.rarities || []).map((r, i) => [r.id, Object.assign({ idx: i }, r)])),
    slots: C.items.slots || [],
    loot: C.items.loot || [],
    lootById: Object.fromEntries((C.items.loot || []).map(l => [l.id, l])),
    lootGrades: C.items.lootGrades || [],
    // the workshops behind the merchants (build 51): recipes, parts, training, the forge, the kitchen
    craft: C.crafting || {},
    craftById: Object.fromEntries([].concat((C.crafting || {}).trinkets || [], (C.crafting || {}).parts || []).map(t => [t.id, t])),
    recipeById: Object.fromEntries(((C.crafting || {}).recipes || []).map(r => [r.id, r])),
    ingredientById: Object.fromEntries(((C.crafting || {}).ingredients || []).map(r => [r.id, r])),
    upgradeById,
    treeOf,
    rules: C.rules,
    // build 52: armor sets, weapon traits, and the board's damage types (content/campaign/foes.json)
    armorSets: sets,
    armorSetById: Object.fromEntries(sets.map(s => [s.id, s])),
    armorTiers: tiers,
    statsByRarity: C.items.statsByRarity || [1, 2, 3, 4],
    weaponTraits: C.items.weaponTraits || {},
    foes: C.foes || {}
  };
})();

const LEVEL_COUNT = 15;
const BOSS_LEVELS = [5, 10, 15];
/* Shops branch off the path: the merchant after the first boss, the challenger after
   the second, the bank (and the bridge to the next island) after the last */
const SHOP_AFTER = { merchant: 5, challenger: 10, banker: 15, bridge: 15 };

const campIslandIdx = id => CAMP.islands.findIndex(i => i.id === id);
const campIsland = n => CAMP.islands[n];
const campLevelDef = (isl, n) => CAMP.islandById[isl].levels.find(l => l.n === n);
const campLevelId = (isl, n) => `${isl}:${n}`;
const campCurrency = isl => CAMP.islandById[isl].currency;
const rarityName = r => (CAMP.rarityById[r] || { name: r }).name;
const rarityColor = r => (CAMP.rarityById[r] || { color: "#fff" }).color;
const rarityIdx = r => (CAMP.rarityById[r] || { idx: 0 }).idx;
