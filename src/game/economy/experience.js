/* =========================================================
   src/game/economy/experience.js
   Earning and spending XP and Snakebucks
   ========================================================= */
"use strict";

/* =========================================================
   Experience
   ========================================================= */
function getTrackValue(key) {
  if (!upgradeTracks[key]) return 0;
  return trackValueAt(key, save.tiers[key] || 0);
}

function getPointsPerXp() {
  return getTrackValue("xp");
}

function nextTierCost(key) {
  const prices = trackInfo(key, save.prestige).prices;
  const tier = save.tiers[key];
  return tier >= prices.length ? null : prices[tier];
}

/* The Great Tree can only grow as far as your islands allow (src/game/economy/ladder.js) */
const atGreatCap = key => isGreat(key) && nextTierCost(key) !== null && (save.tiers[key] || 0) >= greatTierCap(key);

/* Points build toward the next XP. Changing the booster only changes the
   target going forward; it never cashes in old score retroactively. */
let runXp = 0;          // XP earned during the current run
let runBank = 0;        // XP picked up during the run (orbs, allowance, badges), paid at the end
let runPaidScore = 0;   // score XP already paid (a revive carries the run on)
let runPaidBank = 0;
let devXpCarry = 0;     // fractional XP left over from the dev XP multiplier

function grantXp(n, { direct = false } = {}) {
  const scaled = n * save.dev.xpMult + devXpCarry;
  const whole = Math.floor(scaled);
  devXpCarry = scaled - whole;
  if (whole <= 0) return 0;
  // During a run, XP is only banked; it's all paid when the run ends
  if (gameState === "PLAYING" && !direct) { runBank += whole; runXp += whole; return whole; }
  save.xp += whole;
  save.stats.xpEarned += whole;
  return whole;
}

/* Pays out a run: XP for the final score, plus everything banked along the way */
function payRun() {
  const fromScore = Math.floor(score / getPointsPerXp() * save.dev.xpMult);
  const pay = Math.max(0, fromScore - runPaidScore) + Math.max(0, runBank - runPaidBank);
  runPaidScore = Math.max(runPaidScore, fromScore);
  runPaidBank = runBank;
  save.xp += pay;
  save.stats.xpEarned += pay;
  return pay;
}
const pendingRunXp = () => Math.max(0, Math.floor(score / getPointsPerXp() * save.dev.xpMult) - runPaidScore) + Math.max(0, runBank - runPaidBank);

/* Outside a run (a sandbox test, a terminal gift) points still turn straight into XP */
function gainXpProgress(points) {
  if (!(points > 0)) return;
  if (gameState === "PLAYING") return;     // in a run, the final score pays at the end
  const per = getPointsPerXp();
  save.xpProgress += points;
  if (save.xpProgress >= per) {
    const gained = Math.floor(save.xpProgress / per);
    save.xpProgress = Math.round((save.xpProgress - gained * per) * 1e4) / 1e4;
    grantXp(gained);
  }
}

function addScore(amount) {
  amount *= save.dev.scoreMult;
  if (runBoosts.booster) amount *= BOOSTER_MULT;
  amount *= buffScoreMult();          // Fever and the Frenzy Clock
  if (gameState === "PLAYING" && performance.now() < fx.fastUntil) amount *= 1 + getTrackValue("kindling") / 100;
  score += Math.round(amount);
  save.lifetimeScore = round2(save.lifetimeScore + amount);
  if (gameState === "PLAYING" && save.lifetimeByMode[currentModeKey] !== undefined) {
    save.lifetimeByMode[currentModeKey] = round2(save.lifetimeByMode[currentModeKey] + amount);
  }
  gainXpProgress(amount);
  persist();
  updateHud();
}

function spendBucks(cost) {
  if (save.snakebucks < cost) return false;
  save.snakebucks -= cost;
  return true;
}
/* The Great Tree is bought with Snakebucks; everything on an island with XP */
const isGreat = k => GLOBAL_KEYS.includes(k);
const walletFor = k => (isGreat(k) ? save.snakebucks : save.xp);
const curFor = k => (isGreat(k) ? "SB" : "XP");

function spendXp(cost) {
  if (save.xp < cost) return false;
  save.xp -= cost;
  save.stats.xpSpent += cost;
  return true;
}

/* Rescales progress so the bar stays at the same percentage */
function setXpBoosterTier(newTier) {
  const oldPer = getPointsPerXp();
  save.tiers.xp = newTier;
  const newPer = getPointsPerXp();
  save.xpProgress = round2(Math.min(newPer - 0.01, (save.xpProgress / oldPer) * newPer));
  if (save.xpProgress < 0) save.xpProgress = 0;
}

/* Mode-specific upgrades stay locked until that mode is unlocked.
   Tiers already owned are kept and still work. */
function allModesUnlocked() {
  return MODE_KEYS.every(m => save.unlockedModes.includes(m));
}

function isTrackLocked(key) {
  if (!treeNodeOpen(key)) return true;
  const needed = upgradeTracks[key].requires;
  if (upgradeTracks[key].nightmareOf) return !save.nmUpgrades.includes(upgradeTracks[key].nightmareOf);   // opens with its Nightmare
  if (!needed) return false;
  if (needed === "all") return !allModesUnlocked();
  if (needed === "nightmare") return !save.unlockedNightmares.length;
  return !isModeUnlocked(needed);
}

/* What the next prestige asks for. Prestige is the end of an era, so it wants the era's work done. */
const prestigeFee = rank => ECON.prestige.rankFee[rank];
function prestigeNeeds() {
  const next = save.prestige + 1;
  const main = ["xp", "time", "apple", "hearts"];
  const reqs = [
    { label: "Trunk and boughs fully grown", have: main.reduce((a, k) => a + (save.tiers[k] || 0), 0), need: main.reduce((a, k) => a + upgradeTracks[k].values.length, 0) }
  ];
  reqs.forEach(r => { r.met = r.have >= r.need; r.have = Math.min(r.have, r.need); });
  return { reqs, met: reqs.every(r => r.met), fee: prestigeFee(next) };
}

function canPrestige() {
  if (save.prestige >= MAX_PRESTIGE) return false;
  const n = prestigeNeeds();
  return n.met && save.snakebucks >= n.fee;
}

function doPrestige() {
  if (!canPrestige()) return;
  if (!spendBucks(prestigeNeeds().fee)) return;
  const oldPer = getPointsPerXp();
  save.prestige++;
  CORE_TRACKS.concat(RANKED_TRACKS).forEach(k => { save.tiers[k] = 0; });
  const newPer = getPointsPerXp();
  save.xpProgress = Math.max(0, Math.min(newPer * 0.9999, (save.xpProgress / oldPer) * newPer));
  persist();
  sfx("unlock");
  updateHud();
  checkBadges();
  showToast(`The Great Tree is now ${PRESTIGE_RANKS[save.prestige]} ranked!`);
  if (currentScreen === "tree") renderTree();
}

function confirmPrestige() {
  const next = PRESTIGE_RANKS[save.prestige + 1];
  openConfirm({
    title: `Prestige to ${next}?`,
    text: `The whole Great Tree is cut back to tier 0, everything but its dream roots. It grows back stronger: the trunk and boughs keep what you've earned as their new starting point and grow ${PRESTIGE_STRENGTH}x further, and every other part comes back 50% stronger. Prices climb. This costs ${fmtInt(prestigeNeeds().fee)} Snakebucks.`,
    ok: `Prestige to ${next} for ${fmtShort(prestigeNeeds().fee)} SB`,
    gold: true,
    onOk: doPrestige
  });
}

function purchaseUpgrade(key) {
  if (isTrackLocked(key) || atGreatCap(key)) return false;
  const cost = nextTierCost(key);
  if (cost === null || !(isGreat(key) ? spendBucks(cost) : spendXp(cost))) return false;

  if (key === "xp") setXpBoosterTier(save.tiers.xp + 1);
  else save.tiers[key]++;

  persist();
  sfx("buy");
  updateHud();
  renderUpgradeBody();
  checkBadges();
  checkTreeMedals();
  if (currentScreen === "global") renderGlobal();
  return true;
}
