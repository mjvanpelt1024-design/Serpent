/* =========================================================
   src/game/progress/badges.js
   Achievement families and their tiers
   ========================================================= */
"use strict";

/* =========================================================
   Achievements: each family is a stat with milestone tiers,
   and every tier is its own badge
   ========================================================= */
const POW10 = [10, 100, 1000, 10000, 100000, 1000000];
const TIER_COLORS = ["#cd7f32", "#c9ced6", "#ffd23f", "#6ee7d8", "#8ab4ff", "#ff77c8"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

const upgradeTiersOwned = () => Object.values(save.tiers).reduce((a, b) => a + b, 0);

const BADGE_FAMILIES = [
  { id: "xp", group: "general", name: "Experienced", desc: "Earn {n} XP", tiers: POW10, metric: () => save.stats.xpEarned },
  { id: "spent", group: "general", name: "Big Spender", desc: "Spend {n} XP", tiers: POW10, metric: () => save.stats.xpSpent },
  { id: "score", group: "general", name: "Point Hoarder", desc: "Score {n} lifetime points", tiers: [1e3, 1e4, 1e5, 1e6, 1e7, 1e8], metric: () => save.lifetimeScore },
  { id: "apples", group: "general", name: "Apple Muncher", desc: "Eat {n} apples", tiers: POW10, metric: () => save.stats.applesEaten },
  { id: "orbs", group: "general", name: "Orb Collector", desc: "Collect {n} XP orbs", tiers: [10, 100, 1000, 10000, 100000], metric: () => save.stats.orbsCollected },
  { id: "popsicles", group: "general", name: "Brain Freeze", desc: "Eat {n} popsicles", tiers: [1, 10, 100, 1000, 10000], metric: () => save.stats.popsiclesEaten },
  { id: "converted", group: "general", name: "Lucky Break", desc: "See {n} popsicles turn into apples", tiers: [1, 10, 100, 1000, 10000], metric: () => save.stats.popsiclesConverted },
  { id: "survived", group: "general", name: "Close Call", desc: "Survive {n} poisonous popsicles", tiers: [1, 10, 100, 1000], metric: () => save.stats.poisonsSurvived },
  { id: "games", group: "general", name: "Regular", desc: "Play {n} games", tiers: [1, 10, 100, 1000, 10000], metric: () => save.stats.gamesPlayed },
  { id: "time", group: "general", name: "Time Well Spent", desc: "Play for {n}", tiers: [6e4, 6e5, 36e5, 36e6, 36e7], metric: () => save.stats.timePlayedMs, unit: "time" },
  { id: "deaths", group: "general", name: "Try, Try Again", desc: "Lose {n} games", tiers: [1, 10, 100, 1000, 10000], metric: () => save.stats.deaths },
  { id: "walls", group: "general", name: "Wall Hugger", desc: "Crash into a wall {n} times", tiers: [1, 10, 100, 1000, 10000], metric: () => save.stats.wallCrashes },
  { id: "tails", group: "general", name: "Ouroboros", desc: "Bite your own tail {n} times", tiers: [1, 10, 100, 1000, 10000], metric: () => save.stats.tailBites },
  { id: "loops", group: "general", name: "Frequent Flyer", desc: "Loop through the edge {n} times", tiers: [10, 100, 1000, 10000, 100000], metric: () => save.stats.screenLoops },
  { id: "length", group: "general", name: "Long Boi", desc: "Grow a snake to {n} segments", tiers: [10, 25, 50, 100, 250], metric: () => save.stats.longestSnake },
  { id: "tiers", group: "general", name: "Tinkerer", desc: "Own {n} upgrade tiers", tiers: [1, 10, 50, 100, 250], metric: upgradeTiersOwned },
  { id: "skins", group: "general", name: "Dress Up", desc: "Own {n} skins", tiers: [2, 5, 10, 25, 50], metric: () => save.ownedSkins.length },
  { id: "backdrops", group: "general", name: "Interior Designer", desc: "Own {n} themes", tiers: [2, 5, 10, 20, 40], metric: () => save.ownedBackdrops.length },
  { id: "prestige", group: "general", name: "Prestigious", desc: "Reach core stats prestige rank {n}", tiers: [1, 2, 3], metric: () => save.prestige },
  { id: "modes", group: "general", name: "Explorer", desc: "Unlock {n} islands", tiers: [2, 4, 6, 8, 12, 16, 22], metric: () => save.unlockedModes.length },

  { id: "speedbump", group: "general", name: "Speed Bump", desc: "End {n} runs in under 5 seconds", tiers: [1, 10, 50, 250], metric: () => save.stats.quickDeaths },
  { id: "soclose", group: "general", name: "So Close", desc: "Finish {n} runs within 10% of your best without beating it", tiers: [1, 10, 50, 250], metric: () => save.stats.soClose },
  { id: "dejavu", group: "general", name: "Deja Vu", desc: "Die the same way {n} times in a row", tiers: [3, 5, 10, 25], metric: () => save.stats.sameCauseBest },
  { id: "hangry", group: "general", name: "Hangry", desc: "Starve {n} times in the Starving Nightmare", tiers: [1, 10, 50], metric: () => save.stats.hungerDeaths },
  { id: "overdressed", group: "general", name: "Overdressed", desc: "Wear something in all 5 Flair slots at once", tiers: [1], metric: () => (["head", "face", "cape", "body", "tail"].every(k => save.flair[k]) ? 1 : 0) },
  { id: "relics", group: "general", name: "Relic Hunter", desc: "Find {n} relics", tiers: [1, 3, 5, 10], metric: () => save.relics.length },
  { id: "cryptic", group: "general", name: "The Coil", story: true, desc: "...", tiers: [1, 5, 25, 100, 250, 500, 1000, 2500], metric: () => save.stats.shimmers },
  { id: "rocks", group: "general", name: "Rock Bottom", desc: "Bonk into {n} rocks", tiers: [1, 10, 100, 1000], metric: () => save.stats.rocksHit },
  { id: "fleas", group: "general", name: "Itchy", desc: "Catch {n} fleas", tiers: [1, 10, 100, 1000], metric: () => save.stats.fleasHit },
  { id: "portals", group: "inferno", name: "Portal Hopper", desc: "Hop through {n} purple portals", tiers: [10, 100, 1000, 10000], metric: () => save.stats.portalWarps },
  { id: "fire", group: "inferno", name: "Hot Stuff", desc: "Touch {n} fires", tiers: [1, 10, 100, 1000], metric: () => save.stats.firesHit },
  { id: "molasses", group: "labyrinth", name: "Sticky Situation", desc: "Get stuck in {n} molasses puddles", tiers: [1, 10, 100, 1000], metric: () => save.stats.molassesHit },
  { id: "nightmares", group: "general", name: "Nightmare Fuel", desc: "Play {n} Nightmare runs", tiers: [1, 10, 100, 1000], metric: () => save.stats.nightmareGames },
  { id: "warps", group: "mirror", name: "Through the Looking Glass", desc: "Warp through {n} Mirror edges", tiers: [10, 100, 1000, 10000], metric: () => save.stats.mirrorWarps },
  { id: "bigapples", group: "treasure", name: "Treasure Hunter", desc: "Eat {n} big apples", tiers: [1, 10, 100, 1000], metric: () => save.stats.bigApples },
  { id: "distance", group: "endless", name: "Long Haul", desc: "Travel {n} m in one Endless run", tiers: [100, 500, 1000, 5000, 10000], metric: () => save.stats.bestDistance },
  // build 46
  { id: "golden", group: "general", name: "Midas Mouth", desc: "Eat {n} Golden Apples", tiers: [1, 10, 100, 1000], metric: () => save.stats.goldenApples },
  { id: "fevers", group: "general", name: "Running Hot", desc: "Catch Fever {n} times", tiers: [1, 10, 100, 1000], metric: () => save.stats.fevers },
  { id: "sheds", group: "general", name: "Fresh Skin", desc: "Shed your skin {n} times", tiers: [1, 10, 100, 1000], metric: () => save.stats.sheds },
  { id: "hunters", group: "general", name: "Big Game", desc: "Beat the Hunter {n} times", tiers: [1, 5, 25, 100], metric: () => save.stats.huntersBeaten },
  { id: "contracts", group: "general", name: "Bounty Board", desc: "Finish {n} Bounty Contracts", tiers: [1, 10, 50, 250], metric: () => save.stats.contracts },
  { id: "nmunlocks", group: "general", name: "Bad Dreams", desc: "Unlock {n} Nightmare islands", tiers: [1, 3, 5, 10, 16, 22], metric: () => save.unlockedNightmares.length }
];

MODE_KEYS.forEach(m => {
  const label = () => modes[m].label;
  BADGE_FAMILIES.push(
    { id: m + "-best", group: m, name: label() + " Legend", desc: "Score {n} in one " + label() + " run", tiers: [1e3, 1e4, 1e5, 1e6], metric: () => save.highScores[m] },
    { id: m + "-life", group: m, name: label() + " Veteran", desc: "Score {n} lifetime points in " + label(), tiers: [1e4, 1e5, 1e6, 1e7], metric: () => save.lifetimeByMode[m] },
    { id: m + "-games", group: m, name: label() + " Regular", desc: "Play " + label() + " {n} times", tiers: [1, 10, 100, 1000], metric: () => save.gamesByMode[m] }
  );
});

const BADGE_IDS = new Set();
BADGE_FAMILIES.forEach(f => f.tiers.forEach(t => BADGE_IDS.add(f.id + ":" + t)));
const BADGE_TOTAL = BADGE_IDS.size;

const SHAKE_OPTIONS = [
  ["off", "Off"],
  ["subtle", "Subtle"],
  ["normal", "Normal"],
  ["quake", "Earthquake"]
];

const SCORE_UNITS = [
  ["pts", "Points", "pts"],
  ["cal", "Calories", "calories"],
  ["vibes", "Vibes", "vibes"],
  ["bucks", "Snek bucks", "snek bucks"],
  ["apples", "Apple-equivalents", "apple-equivalents"]
];

const SWIPE_OPTIONS = [
  ["low", "Low", 40],
  ["medium", "Medium", 24],
  ["high", "High", 14]
];

let save = loadSave();
