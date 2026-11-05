/* =========================================================
   src/game/start.js
   Startup
   ========================================================= */
"use strict";

/* =========================================================
   Start
   ========================================================= */
applyBackdrop();
syncSettings();
updateScale();
if (window.ResizeObserver) new ResizeObserver(() => updateScale(false)).observe(stageEl);
window.addEventListener("resize", () => updateScale());
document.addEventListener("fullscreenchange", () => {
  updateScale();
  if (currentScreen === "settings") renderSettings();
});
if (!storageIsReal()) setTimeout(() => showToast("This browser cannot keep your progress. Back it up from Settings."), 1500);
/* Rebuilds every price from the ladder (src/game/economy/ladder.js, content/economy.txt).
   Prices follow what the save can earn, so it runs at startup and whenever the save's
   reach changes: a new island or Nightmare, a profile switch, a restored backup. */
function applyEconomy() {
  const priced = k => !upgradeTracks[k].fixedPrices;        // a file can list its own prices
  // Island trees, in XP: the whole tree costs treeRuns good runs on that island
  MODE_KEYS.forEach(m => {
    const prices = islandTreePrices(m);
    TREES[m].forEach((k, i) => { if (priced(k)) upgradeTracks[k].prices = prices[i]; });
    const nk = nmTrackKey(m);
    if (nk && priced(nk)) upgradeTracks[nk].prices = nightmareTrackPrices(m);
  });
  // The Great Tree, in Snakebucks
  GLOBAL_KEYS.forEach(k => { if (priced(k)) upgradeTracks[k].prices = greatPrices(k); });
  // Islands and Nightmares
  MODE_KEYS.forEach(m => {
    modes[m].unlockAt = islandUnlockCost(m);
    NIGHTMARES[m].cost = nightmareUnlockCost(m);
  });

  // Cosmetics, in Snakebucks: each one you own makes the next cost the same step more
  const C = ECON.cosmetics;
  ECON.skinPrice = owned => C.skinStep[0] + C.skinStep[1] * Math.max(0, owned - 1);
  ECON.backdropPrice = owned => C.backdropStep[0] + C.backdropStep[1] * Math.max(0, owned - 1);
  COSMETIC_TIERS.skins.forEach((tier, idx) => { tier.fee = C.skinTier * idx; });
  COSMETIC_TIERS.backdrops.forEach((tier, idx) => { tier.fee = C.backdropTier * idx; });
  FLAIR.forEach(f => { f.price = f.reward || !f.priceRank ? 0 : C.flairStep * f.priceRank; });
  AVATARS.forEach((av, i) => { av.price = av.free ? 0 : C.avatarStep[0] + C.avatarStep[1] * i; });
}
applyEconomy();

checkTreeMedals(true);
checkBadges(true);
// The campaign's one save: signed, checked against its schema, and loaded before anything shows
loadCamp();
if (campLoadNote) setTimeout(() => showToast(campLoadNote), 1200);
// Brand-new players name their snake, see the opening scene, then play the tutorial
// New players start at the title; Play leads to the saves, and a new save starts with naming and the tour
updateLiveStats(true);
openScreen("main");
requestAnimationFrame(frame);
