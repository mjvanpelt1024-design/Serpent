/* =========================================================
   src/game/progress/badge-rewards.js
   XP rewards for badges
   ========================================================= */
"use strict";

/* =========================================================
   Badge rewards: every tier pays Snakebucks (a fixed amount) and XP
   (a share of a good run on your best island), and finishing a path
   pays its last tier again several times over (content/economy.txt [badges])
   ========================================================= */
function payBadge(family, tierIndex, silent) {
  const maxed = tierIndex === family.tiers.length - 1;
  // Catching up quietly on load (old saves) pays nothing: rewards are for badges earned from here on
  if (silent || window.__NO_BADGE_XP) return { got: 0, bucks: 0, maxed };
  const pay = badgePay(tierIndex, maxed);
  const keepRun = runXp;
  // Badge XP goes straight to the save, never into the run, so it can't feed Parting Gift
  const got = grantXp(pay.xp, { direct: true });
  runXp = keepRun;
  save.snakebucks += pay.bucks;
  save.stats.badgeXp += got;
  save.stats.badgeBucks = (save.stats.badgeBucks || 0) + pay.bucks;
  return { got, bucks: pay.bucks, maxed };
}


let sbLevel = null;
let sbCat = "walls";
let sbTool = "#";
let sbSize = 1;
let sbPainting = false;
let sbShelfTab = "mine";
let customLevel = null;
let customBackup = null;
let sbReturn = false;

function sandboxUnlocked() {
  return save.dev.sandbox || (allModesUnlocked() && save.unlockedNightmares.length === MODE_KEYS.length);
}
