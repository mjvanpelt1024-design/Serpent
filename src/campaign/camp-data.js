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
  return {
    islands,
    islandById: Object.fromEntries(islands.map(i => [i.id, i])),
    items,
    itemById: Object.fromEntries(items.map(i => [i.id, i])),
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
    rules: C.rules
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
