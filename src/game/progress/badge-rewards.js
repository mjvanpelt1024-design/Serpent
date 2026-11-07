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

const blankGrid = () => ".".repeat(SB_SIZE * SB_SIZE);
function newLevel(name = "My level") {
  const g = blankGrid().split("");
  g[10 * SB_SIZE + 5] = "S";
  g[10 * SB_SIZE + 14] = "A";
  return { v: 2, n: name, e: "w", s: 7, g: g.join(""), pv: {}, ph: {}, r: defaultRules(), k: "", th: "", vn: 0, it: [], off: [], sc: {} };
}
/* k: skin id ("" = yours), th: backdrop id ("" = yours), vn: disappearing red walls (seconds, 0 = off),
   it: boost items the run starts with, off: hazards switched off, sc: enemy spawner chips { type: [[x, y], ...] },
   b: a boss to fight ("" none; build 52), bf: which of its three fights (1-3) */
function normalizeLevel(l) {
  const out = Object.assign({ v: 2, e: "w", s: 7, pv: {}, ph: {}, k: "", th: "", vn: 0, it: [], off: [], sc: {}, b: "", bf: 3 }, l, { r: Object.assign(defaultRules(), l.r || {}) });
  out.bf = [1, 2, 3].includes(out.bf) ? out.bf : 3;
  // build 53: the kit it's played in ({ slot: { id, r } }, camp-sandbox.js); empty = the old sandbox, no kit
  out.kit = typeof sbKitClean === "function" ? sbKitClean(out.kit) : (out.kit && typeof out.kit === "object" ? out.kit : {});
  delete out.r.sp;   // spawners are chips now (sc)
  return out;
}

function sandboxUnlocked() {
  return save.dev.sandbox || (allModesUnlocked() && save.unlockedNightmares.length === MODE_KEYS.length);
}
