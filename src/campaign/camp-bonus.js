/* =========================================================
   src/campaign/camp-bonus.js
   Every level's bonus challenge: something extra to do in the level
   (smash three boulders, eat four apples in fifteen seconds, win without
   a scratch...). It's in the level's entry in content/campaign/islands
   ("bonus"), always shown beside the board even when you can't manage it
   yet, so there's something to work toward.

   The reward is a few gems, some of the island's money or some points.
   Gems and money are paid the first time only (the save remembers it in
   the level's record); points are added every time you do it.
   ========================================================= */
"use strict";

const BONUS_LABEL = {
  streak: b => `Eat ${b.need} apples within ${b.secs} seconds`,
  fast: b => `Win within ${b.need} seconds`,
  rocks: b => `Smash into ${b.need} boulder${b.need === 1 ? "" : "s"}`,
  length: b => `Grow to ${b.need} long`,
  points: b => `Score ${fmtInt(b.need)} points`,
  untouched: () => "Win without taking a hit",
  kills: b => `Defeat ${b.need} enem${b.need === 1 ? "y" : "ies"}`,
  spells: b => `Cast ${b.need} spell${b.need === 1 ? "" : "s"}`,
  loot: b => `Find ${b.need} trinket${b.need === 1 ? "" : "s"}`
};
const bonusText = b => (BONUS_LABEL[b.type] ? BONUS_LABEL[b.type](b) : "Something extra");

/* "1 gem", "16 Snaycoins", "200 points" */
function bonusRewardText(isl, b) {
  const r = b.reward || {};
  if (r.gems) return `${r.gems} gem${r.gems === 1 ? "" : "s"}`;
  if (r.coins) return campMoney(isl, r.coins);
  return `${fmtInt(r.points || 0)} points`;
}
const bonusOnce = b => !!(b.reward && (b.reward.gems || b.reward.coins));
const bonusEarned = (isl, n) => !!(camp.levels[campLevelId(isl, n)] && camp.levels[campLevelId(isl, n)].bonus);

function campBonusSetup(def) {
  // `before`: its gems or money were already won on an earlier run, so this time it pays nothing
  campRun.bonus = def.bonus ? Object.assign({}, def.bonus, { have: 0, done: false, times: [], before: bonusOnce(def.bonus) && bonusEarned(campRun.isl, campRun.n) }) : null;
}

/* Something happened on the board that a bonus might be counting */
function campBonusEvent(kind) {
  const b = campRun && campRun.bonus;
  if (!b || b.done || campRun.over) return;
  if (kind === "apple" && b.type === "streak") {
    const now = runMs;
    b.times.push(now);
    b.times = b.times.filter(t => now - t <= b.secs * 1000);
    b.have = Math.max(b.have, b.times.length);
  } else if ((kind === "rock" && b.type === "rocks") || (kind === "kill" && b.type === "kills") || (kind === "spell" && b.type === "spells") || (kind === "loot" && b.type === "loot")) b.have++;
  else return;
  if (b.need && b.have >= b.need) campBonusDone();
}

/* Checked every frame: the ones that count what you are, not what you did */
function campBonusTick() {
  const b = campRun && campRun.bonus;
  if (!b || b.done) return;
  if (b.type === "length") b.have = Math.max(b.have, snake.maxCells);
  else if (b.type === "points") b.have = Math.max(b.have, score);
  else if (b.type === "streak") b.times = b.times.filter(t => runMs - t <= b.secs * 1000);
  else return;
  if (b.have >= b.need) campBonusDone();
}

/* At a win: the ones that are about how you won */
function campBonusAtWin(lines) {
  const b = campRun && campRun.bonus;
  if (!b || b.done) return;
  if ((b.type === "fast" && runMs <= b.need * 1000) || (b.type === "untouched" && !campRun.hitTaken)) campBonusDone(lines);
}

function campBonusDone(lines) {
  const b = campRun.bonus;
  const { isl, n } = campRun;
  b.done = true;
  const r = b.reward || {};
  let paid = "";
  // build 51: a challenge done now and then pays a spell upgrade point too
  if (roll((CAMP.craft.spells || {}).challengePointChance || 0)) { camp.spellPts++; if (lines) lines.push("+1 spell upgrade point"); else showToast("+1 spell upgrade point"); }
  if (r.points) { score += r.points; paid = `+${fmtInt(r.points)} points`; }
  else if (!bonusEarned(isl, n)) {
    if (r.gems) addGems(r.gems);
    if (r.coins) campPay(isl, r.coins);
    const key = campLevelId(isl, n);
    camp.levels[key] = Object.assign({ wins: 0, best: 0, flawless: false }, camp.levels[key], { bonus: true });
    paid = `+${bonusRewardText(isl, b)}`;
    saveCamp();
  }
  campBump("bonusesDone");
  const text = `Challenge done: ${bonusText(b)}!${paid ? " " + paid : ""}`;
  if (lines) lines.push(text); else showToast(text);
  sfx("medal");
  updateHud();
}
