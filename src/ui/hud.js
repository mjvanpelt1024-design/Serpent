/* =========================================================
   src/ui/hud.js
   The heads-up display
   ========================================================= */
"use strict";

/* =========================================================
   HUD
   ========================================================= */
const HEART_SVG_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const ARMOR_SVG_PATH = "M12 2l8 3v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V5z";
let lastHeartsKey = "";

function renderHearts() {
  const vals = upgradeTracks.hearts.values;
  const max = Math.ceil(vals[vals.length - 1]);   // heart slots, not upgrade tiers
  const owned = getTrackValue("hearts");
  const shown = gameState === "PLAYING" ? currentHearts : owned;
  const gold = gameState === "PLAYING" ? goldHearts : 0;
  const armor = gameState === "PLAYING" ? currentArmor : 0;
  const key = max + ":" + shown + ":" + gold + ":" + armor;
  if (key === lastHeartsKey) return;
  lastHeartsKey = key;

  const svg = cls => `<svg class="heart ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_SVG_PATH}"/></svg>`;
  const full = Math.floor(shown + 1e-9);
  const half = shown - full > 0.25;
  let html = "";
  for (let i = 0; i < full; i++) html += svg("full");
  for (let i = 0; i < gold; i++) html += svg("gold");
  if (half) html += svg("half");
  for (let i = full + (half ? 1 : 0); i < max; i++) html += svg("empty");
  for (let i = 0; i < armor; i++) html += `<svg class="heart armor" viewBox="0 0 24 24" aria-hidden="true"><path d="${ARMOR_SVG_PATH}"/></svg>`;
  heartsEl.innerHTML = html;
  heartsEl.setAttribute("aria-label", `${shown} of ${max} hearts${gold ? `, plus ${gold} golden` : ""}${armor ? `, and ${armor} armor plate${armor === 1 ? "" : "s"}` : ""}`);
}

let lastHudScore = 0;
function updateHud() {
  xpAmountEl.textContent = fmtInt(save.xp);
  const pend = gameState === "PLAYING" ? pendingRunXp() : 0;
  xpPendingEl.textContent = pend > 0 ? "+" + fmtInt(pend) : "";
  bucksAmountEl.textContent = fmtInt(save.snakebucks || 0);
  document.body.classList.toggle("no-profile", !activeSlot);

  const per = getPointsPerXp();
  xpFillEl.style.width = "0%";
  xpEl.title = `XP is paid when a run ends: ${fmtPerXp(per)} of your final score, plus any XP you picked up`;

  const showScore = save.settings.showScore && (gameState === "PLAYING" || gameState === "GAMEOVER");
  if (!showScore) {
    hudScoreEl.textContent = "";
  } else {
    const label = save.settings.scoreUnit === "pts" ? "Score" : scoreUnitLabel()[0].toUpperCase() + scoreUnitLabel().slice(1);
    const table = currentNightmare ? save.highScoresNightmare : save.highScores;
    const best = save.settings.showBest ? `<span class="best">Best ${fmtInt(table[currentModeKey] || 0)}</span>` : "";
    hudScoreEl.innerHTML = `<span class="lbl">${label}</span><span class="num">${fmtInt(score)}</span>${best}`;
    // A little bump whenever the score jumps by more than the passive tick
    if (score - lastHudScore > 10 * scoreMultiplier * 1.5 && gameState === "PLAYING") {
      const n = hudScoreEl.querySelector(".num");
      if (n) n.classList.add("pop");
    }
    lastHudScore = score;
  }

  renderHearts();
}
