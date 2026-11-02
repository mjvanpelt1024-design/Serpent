/* =========================================================
   src/game/economy/ladder.js
   The economy's one source of truth: what a good run pays on each
   island, and every price counted in good runs (content/economy.txt,
   docs/DESIGN-46.md)
   ========================================================= */
"use strict";

const LADDER = ECON.ladder;
const ISLAND_COUNT = MODE_KEYS.length;
const islandIndex = key => MODE_KEYS.indexOf(key);

/* Rounds a price or a multiplier to a tidy number with three significant figures */
function tidy(n) {
  if (!(n > 0)) return 0;
  if (n < 10) return Math.round(n * 100) / 100;
  return Number(n.toPrecision(3));
}
const tidyPrice = n => Math.max(1, Math.round(tidy(n)));

/* ----- What each island pays ----- */
const worldMult = i => tidy(Math.pow(LADDER.worldGrowth, i));
const nmMult = i => tidy(Math.pow(LADDER.worldGrowth, ISLAND_COUNT - 1) * LADDER.nightmareStart * Math.pow(LADDER.nightmareGrowth, i));

// Islands no longer set their own multiplier: the ladder does, so income always climbs evenly
MODE_KEYS.forEach((key, i) => {
  modes[key].multiplier = worldMult(i);
  modes[key].nmMultiplier = nmMult(i);
});

/* How many islands are unlocked: the Great Tree may grow this far */
const islandsUnlocked = () => Math.max(1, save.unlockedModes.length);
const nightmaresUnlocked = () => save.unlockedNightmares.length;

/* The tiers a Great Tree part may reach right now. The dream roots follow the Nightmares. */
function greatTierCap(key, prestige = save.prestige) {
  const max = trackInfo(key, prestige).values.length;
  const share = upgradeTracks[key].requires === "nightmare"
    ? nightmaresUnlocked() / ISLAND_COUNT
    : islandsUnlocked() / ISLAND_COUNT;
  return Math.min(max, Math.ceil(max * share));
}

/* The Great Tree's boost to income once u islands are unlocked, assuming it's grown as far as it may */
function greatBoostAt(u) {
  const at = key => {
    const t = upgradeTracks[key];
    if (!t) return 1;
    const tier = Math.min(t.values.length, Math.ceil(t.values.length * Math.min(u, ISLAND_COUNT) / ISLAND_COUNT));
    return tier ? t.values[tier - 1] : t.base;
  };
  return (upgradeTracks.xp.base / at("xp")) * Math.sqrt(at("apple") * at("time"));
}

/* XP from a good run on island i, and on its Nightmare */
const goodRun = i => LADDER.runXp * worldMult(i) * greatBoostAt(i + 1);
const nmGoodRun = i => LADDER.runXp * nmMult(i) * greatBoostAt(ISLAND_COUNT);

/* A Nightmare-run save only ever plays Nightmares, so its prices follow them */
const nightmareSave = () => save.kind === "nightmare";
const anchorRun = i => (nightmareSave() ? nmGoodRun(i) : goodRun(i));

/* A good run on the best place you can play: what the Exchange, badges and items scale to */
function bestRun() {
  const best = MODE_KEYS.reduce((b, k, i) => (save.unlockedModes.includes(k) ? i : b), 0);
  let run = anchorRun(best);
  if (nightmareRealmOpen()) {
    const nm = MODE_KEYS.reduce((b, k, i) => (save.unlockedNightmares.includes(k) ? i : b), -1);
    if (nm >= 0) run = Math.max(run, nmGoodRun(nm));
  }
  return run;
}

/* XP per orb, crumb and allowance tick: keeps them a steady share of a run on every island */
function xpUnit() {
  const i = Math.max(0, islandIndex(currentModeKey));
  return (currentNightmare ? nmGoodRun(i) : anchorRun(i)) / LADDER.runXp;
}

/* ----- Island trees ----- */
const geomSum = (g, n) => (g === 1 ? n : (Math.pow(g, n) - 1) / (g - 1));
/* A count of good runs that rises evenly from the first island to the last */
const rampRuns = (first, last, i) => (typeof first === "number" ? first + (last - first) * i / Math.max(1, ISLAND_COUNT - 1) : last);

function islandTreePrices(area) {
  const i = islandIndex(area);
  const T = ECON.trees;
  const keys = TREES[area];
  const weight = keys.map((k, n) => T.treeNodeCost[n] || 1);
  const span = keys.reduce((s, k, n) => s + weight[n] * geomSum(T.tierGrowth, upgradeTracks[k].values.length), 0);
  const base = rampRuns(T.treeRunsFirst, T.treeRuns, i) * anchorRun(i) / span;
  return keys.map((k, n) => upgradeTracks[k].values.map((_, t) => tidyPrice(base * weight[n] * Math.pow(T.tierGrowth, t))));
}

/* The red Nightmare upgrade under an island: priced from that Nightmare's income */
function nightmareTrackPrices(area) {
  const i = islandIndex(area);
  const t = upgradeTracks[nmTrackKey(area)];
  const g = ECON.trees.tierGrowth;
  const base = ECON.nightmares.nmUpgradeRuns * nmGoodRun(i) / geomSum(g, t.values.length);
  return t.values.map((_, n) => tidyPrice(base * Math.pow(g, n)));
}

/* How much of an island's tree is grown, 0 to 1 */
function treeShare(area) {
  const keys = TREES[area] || [];
  let have = 0, all = 0;
  keys.forEach(k => { const n = upgradeTracks[k].values.length; all += n; have += Math.min(n, save.tiers[k] || 0); });
  return all ? have / all : 1;
}

function nmTrackShare(area) {
  const k = nmTrackKey(area);
  if (!k) return 1;
  const n = upgradeTracks[k].values.length;
  return n ? Math.min(n, save.tiers[k] || 0) / n : 1;
}

/* ----- Unlocking islands ----- */
function islandUnlockCost(key) {
  const i = islandIndex(key);
  return i <= 0 ? 0 : tidyPrice(rampRuns(ECON.unlock.unlockRunsFirst, ECON.unlock.unlockRuns, i - 1) * anchorRun(i - 1));
}

/* What the previous island's tree must reach first (a Nightmare-run save grows red upgrades instead) */
function islandUnlockGate(key) {
  const prev = MODE_KEYS[islandIndex(key) - 1];
  if (!prev) return { met: true, have: 1, need: 0, prev };
  if (nightmareSave()) {
    const need = ECON.nightmares.nmUnlockTreeShare;
    const have = nmTrackShare(prev);
    return { met: have >= need - 1e-9, have, need, prev, red: true };
  }
  const need = ECON.unlock.unlockTreeShare;
  const have = treeShare(prev);
  return { met: have >= need - 1e-9, have, need, prev };
}

/* ----- The Nightmare Realm ----- */
const nightmareRealmOpen = () => nightmareSave() || MODE_KEYS.every(m => save.unlockedModes.includes(m));

function nightmareUnlockCost(key) {
  const i = islandIndex(key);
  const runs = ECON.nightmares.nmUnlockRuns;
  return tidyPrice(i <= 0 ? runs * goodRun(ISLAND_COUNT - 1) : runs * nmGoodRun(i - 1));
}

function nightmareUnlockState(key) {
  const i = islandIndex(key);
  const prev = MODE_KEYS[i - 1];
  const realm = nightmareRealmOpen();
  const prevOk = !prev || save.unlockedNightmares.includes(prev);
  const need = ECON.nightmares.nmUnlockTreeShare;
  const share = prev ? nmTrackShare(prev) : 1;
  const treeOk = !prev || share >= need - 1e-9;
  const cost = nightmareUnlockCost(key);
  return { realm, prev, prevOk, treeOk, share, need, cost, affordable: save.xp >= cost, ready: realm && prevOk && treeOk && save.xp >= cost };
}

/* ----- Snakebucks ----- */
function xpPerBuck() {
  return Math.max(ECON.bucks.minXpPerBuck, tidyPrice(bestRun() / ECON.bucks.buckPerRun));
}

/* ----- The Great Tree, in Snakebucks ----- */
function greatWeight(key) {
  const t = upgradeTracks[key];
  const G = ECON.great;
  if (t.special) return G.special;
  if (CORE_TRACKS.includes(key)) return G.core;
  if (key === "hearts") return G.hearts;
  if (t.requires === "all") return G.all;
  if (t.requires === "nightmare") return G.nightmare;
  return G.every;
}

function greatPrices(key) {
  const G = ECON.great;
  const w = greatWeight(key);
  return upgradeTracks[key].values.map((_, t) => tidyPrice(G.unit * w * (1 + G.tierRise * t)));
}

/* ----- Badges, contracts, items, renaming ----- */
function badgePay(tierIndex, maxed) {
  const B = ECON.badges;
  const at = (list, i) => list[Math.min(i, list.length - 1)];
  const mult = maxed ? 1 + B.badgePathBonus : 1;
  return {
    xp: Math.max(1, Math.round(at(B.badgeRuns, tierIndex) * bestRun() * mult)),
    bucks: Math.round(at(B.badgeBucks, tierIndex) * mult)
  };
}

function itemPrice(key) {
  const I = ECON.items;
  const share = typeof I[key] === "number" ? I[key] : 0.6;
  const bought = Math.min(I.itemStepCap, save.consumableBought[key] || 0);
  return tidyPrice(share * bestRun() * (1 + I.itemStep * bought));
}

const renameCost = () => tidyPrice(ECON.rename.runs * bestRun());
