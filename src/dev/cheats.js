/* =========================================================
   src/dev/cheats.js
   The cheat engine the terminal drives
   ========================================================= */
"use strict";

/* =========================================================
   Cheat engine (driven by the terminal)
   ========================================================= */
function devSay(text) {
  consolePrint(text);
}

function devWipe(what) {
  if (what === "story-all") {
    save.dev.storyAll = true;
    save.named = true;
    save.tutorialDone = true;
    STORY_ORDER.forEach(id => { if (!save.seenScenes.includes(id)) save.seenScenes.push(id); });
    CRYPTIC_TIERS.forEach(t => { if (!save.badges.includes("cryptic:" + t)) save.badges.push("cryptic:" + t); });
    devSay("Every page of the story book is open, Coil lines included.");
  } else if (what === "story-reset") {
    save.dev.storyAll = false;
    save.seenScenes = [];
    save.relics = [];
    save.badges = save.badges.filter(b => !b.startsWith("cryptic:") && !b.startsWith("relics:"));
    save.stats.shimmers = 0;
    save.bookPage = 0;
    save.bookSeenUpTo = 0;
    save.bookOpened = false;
    save.pendingScene = null;
    devSay("Story reset: scenes will play again, collectibles and Coil lines are gone.");
  } else if (what === "relics-all") {
    RELICS.forEach(r => { if (!save.relics.includes(r.id)) save.relics.push(r.id); });
    if (!save.ownedFlair.includes("ancient")) save.ownedFlair.push("ancient");
    devSay("All ten collectibles found.");
  } else if (what === "relic-now" || what === "shimmer-now") {
    if (gameState !== "PLAYING") { devSay("Start a run first, then use this."); persist(); return; }
    const spot = spotFor(1);
    if (!spot) { devSay("No room on the board."); return; }
    const now = performance.now();
    if (what === "shimmer-now") shimmers.push(Object.assign(spot, { spawnAt: now, expiresAt: now + SHIMMER_LIFE }));
    else {
      const r = relicFor(currentModeKey);
      if (!r) { devSay("This mode doesn't hide a collectible."); return; }
      relicItems.push(Object.assign(spot, { relic: r.id, spawnAt: now, expiresAt: now + RELIC_LIFE }));
    }
    devSay(what === "shimmer-now" ? "A shimmer appeared." : "A collectible appeared.");
  } else if (what === "firstrun") {
    save.named = false;
    save.tutorialDone = false;
    devSay("First run reset. Reload the page to name your snake and play the tutorial again.");
  } else if (what === "sandbox") {
    save.dev.sandbox = true;
    devSay("Sandbox unlocked.");
  } else if (what === "items-all") {
    CONSUMABLE_KEYS.forEach(k => { save.consumables[k] = Math.min(999, save.consumables[k] + 10); });
    devSay("Added 10 of every one-time item.");
  } else if (what === "flair-all") {
    FLAIR.forEach(f => { if (!save.ownedFlair.includes(f.id)) save.ownedFlair.push(f.id); });
    devSay("Every Flair item is yours.");
  } else if (what === "nmup-all") {
    save.nmUpgrades = MODE_KEYS.slice();
    devSay("Every red Nightmare track is unlocked.");
  } else if (what === "upgrades") {
    setXpBoosterTier(0);
    save.tiers = defaultTiers();
    devSay("All gameplay upgrades reset.");
  } else if (what === "highscores") {
    save.highScores = zeroModes();
    devSay("High scores reset.");
  } else if (what === "stats") {
    save.stats = defaultStats();
    devSay("Stats reset.");
  } else if (what === "cosmetics") {
    save.ownedSkins = ["classic"];
    save.selectedSkin = "classic";
    save.ownedBackdrops = ["black"];
    save.selectedBackdrop = "black";
    save.cosmeticTiers = { skins: ["Starter"], backdrops: ["Starter"] };
    applyBackdrop();
    devSay("Skins and backdrops reset.");
  } else if (what === "unlocks") {
    save.unlockedModes = ["easy"];
    save.unlockedNightmares = [];
    devSay("Mode unlocks reset. Only Easy is open.");
  } else if (what === "tiers-all") {
    save.cosmeticTiers = { skins: COSMETIC_TIERS.skins.map(t => t.group), backdrops: COSMETIC_TIERS.backdrops.map(t => t.group) };
    devSay("Every skin and backdrop tier is open.");
  } else if (what === "settings") {
    save.settings = defaultSettings();
    syncSettings();
    devSay("Settings reset.");
  } else if (what === "badges") {
    save.badges = [];
    devSay("Achievements reset. Anything you still qualify for comes back next time progress is checked.");
  } else if (what === "badges-all") {
    save.badges = Array.from(BADGE_IDS);
    devSay(`All ${BADGE_TOTAL} achievements earned.`);
  } else if (what === "modes-all") {
    save.unlockedModes = MODE_KEYS.slice();
    save.unlockedNightmares = MODE_KEYS.slice();
    devSay("Every mode and Nightmare unlocked. Master and Nightmare upgrades are open.");
  } else if (what === "core-max") {
    setXpBoosterTier(upgradeTracks.xp.values.length);
    save.tiers.time = upgradeTracks.time.values.length;
    save.tiers.apple = upgradeTracks.apple.values.length;
    devSay("Core stats maxed. Prestige is ready.");
  } else if (what === "prestige") {
    const oldPer = getPointsPerXp();
    save.prestige = 0;
    save.xpProgress = Math.min(getPointsPerXp() * 0.9999, (save.xpProgress / oldPer) * getPointsPerXp());
    devSay("Prestige reset to none.");
  }
  persist();
  updateHud();
}

let confirmAction = null;
let confirmReturnFocus = null;


const LIVE_STATS = [
  ["statFps", "Frames per second"],
  ["statSpeed", "Snake speed"],
  ["statRate", "Score per second"],
  ["statRunXp", "XP this run"],
  ["statItems", "Items on the board"],
  ["statLength", "Snake length"],
  ["statDistance", "Endless distance"]
];

/* ----- Live stats strip under the board ----- */
const liveStatsEl = document.getElementById("live-stats");
let fpsFrames = 0;
let fpsValue = 0;
let fpsSince = 0;
let liveStatsAt = 0;
const scoreHistory = [];

function updateLiveStats(force) {
  const on = LIVE_STATS.filter(([k]) => save.dev[k]);
  liveStatsEl.hidden = !on.length;
  if (!on.length) return;
  const now = performance.now();
  if (!force && now - liveStatsAt < 250) return;
  liveStatsAt = now;

  const playing = gameState === "PLAYING" || gameState === "GAMEOVER";
  const rate = (() => {
    if (scoreHistory.length < 2) return 0;
    const a = scoreHistory[0], b = scoreHistory[scoreHistory.length - 1];
    return b[0] > a[0] ? ((b[1] - a[1]) / (b[0] - a[0])) * 1000 : 0;
  })();
  const values = {
    statFps: fpsValue,
    statSpeed: playing ? (1000 / moveInterval).toFixed(1) + " moves/s" : "-",
    statRate: playing ? fmtInt(rate) : "-",
    statRunXp: fmtInt(runXp),
    statItems: playing ? `${apples.length} apples, ${popsicles.length} popsicles, ${orbs.length} orbs` : "-",
    statLength: playing ? snake.cells.length : "-",
    statDistance: endless ? fmtInt(endlessDistance()) + " m" : "-"
  };
  const short = { statFps: "FPS", statSpeed: "Speed", statRate: "Score/s", statRunXp: "Run XP", statItems: "Items", statLength: "Length", statDistance: "Distance" };
  liveStatsEl.innerHTML = on.map(([k]) => `<span><b>${short[k]}</b>${values[k]}</span>`).join("");
}

function tickLiveStats(ts) {
  fpsFrames++;
  if (ts - fpsSince >= 1000) {
    fpsValue = Math.round((fpsFrames * 1000) / (ts - fpsSince));
    fpsFrames = 0;
    fpsSince = ts;
  }
  if (gameState === "PLAYING") {
    scoreHistory.push([ts, score]);
    while (scoreHistory.length && ts - scoreHistory[0][0] > 5000) scoreHistory.shift();
  }
  updateLiveStats(false);
}

/* Terminal screen: banner and the group chips */
let terminalBooted = false;
function bootTerminal() {
  renderTermGroups();
  if (terminalBooted) return;
  terminalBooted = true;
  consolePrint("SNAKE//TERMINAL  " + BUILD_NUMBER, "hdr");
  consolePrint("every command reads:  group subject.action value", "dim");
  consolePrint("groups: dev  debug  attribute  upgrade  data", "dim");
  consolePrint("try: help   help dev   dev damage.godmode true   attribute xp.set 150", "dim");
}
