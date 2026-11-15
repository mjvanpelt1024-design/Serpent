/* =========================================================
   src/campaign/camp-screens.js
   A campaign level inside the game's own screens: the game-over card
   says how the level went (with a Next button once it's won), Space
   casts your spell during a level, 1 to 4 eat from the pocket (Esc or
   P pauses), the pause menu
   drops the Tailor, and leaving a level by any other door tidies up.
   ========================================================= */
"use strict";

/* ----- The result: straight back to the map (build 51) -----
   No card in between: the map flies to the next stop (after a boss, its shop or the challenger
   or the bank, before the next level; after a quest trial, the next trial, or the challenger once
   all three are done; after a loss, the same level) and the run's numbers sit at the side of the
   close-up (renderNodeSide in map.js). */
let campResultShown = false;
const BOSS_SHOP_AFTER = { 5: "merchant", 10: "challenger", 15: "banker" };
function campResultPlan(won, lines, notes, line = "") {
  const { isl, n, def } = campRun;
  const rec = camp.levels[campLevelId(isl, n)];
  const report = {
    won, isl, n, name: def.name, score: Math.floor(score), lines, notes, line,
    title: won ? (def.kind === "boss" ? (def.goal.fight === 3 ? "Boss defeated!" : "Boss beaten!") : "Level complete!") : line === "You left the level." ? "Left the level" : "Defeated",
    best: !!(won && rec && rec.wins > 1 && score >= rec.best && campRun.prevBest < score)
  };
  let target = { key: isl, id: n };
  if (campRun.challenge >= 0) target = won ? (questNextStop(isl) || { key: isl, id: "challenger" }) : { key: isl, id: n };
  else if (won && BOSS_SHOP_AFTER[n] && campShopOpen(isl, BOSS_SHOP_AFTER[n])) target = { key: isl, id: BOSS_SHOP_AFTER[n] };
  else if (won && n < LEVEL_COUNT && campLevelOpen(isl, n + 1)) target = { key: isl, id: n + 1 };
  else if (won && n === LEVEL_COUNT) target = { key: isl, id: "bridge" };
  return { report, target };
}
/* A win or a loss: the end-of-run screen (camp-runend.js) says how it went, then Continue goes on to the map.
   Leaving a level on purpose goes straight back. */
function showCampResult(won, lines, notes, line = "") {
  const { report, target } = campResultPlan(won, lines, notes, line);
  if (line === "You left the level." || typeof showRunEnd !== "function") { campResultLeave(report, target); return; }
  showRunEnd(report, target);
}
function campResultLeave(report, target) {
  campLeaveRun();
  clearPauseState();
  campBackToMap(report, target);
}
/* The old card, kept for anything that still calls it by name */
function showCampResultCard(won, lines, notes, line = "") {
  const el = screenEls.gameover;
  const { isl, n, def } = campRun;
  const nextOpen = n < LEVEL_COUNT && campLevelOpen(isl, n + 1);
  const challenge = campRun.challenge >= 0;
  el.querySelector(".screen-title").textContent = won ? (def.kind === "boss" ? (def.goal.fight === 3 ? "Boss defeated!" : "Boss beaten!") : "Level complete!") : "Defeated";
  el.classList.toggle("won", won);
  finalScoreEl.textContent = `${fmtInt(score)} points`;
  finalExtraEl.innerHTML = `<span class="cr-kicker">${escapeAttr(CAMP.islandById[isl].name)} · ${n}. ${escapeAttr(def.name)}</span>` +
    lines.map(l => `<span class="cr-line">${l}</span>`).join("") + notes.map(l => `<span class="cr-line cr-new">${escapeAttr(l)}</span>`).join("");
  finalExtraEl.hidden = false;
  const rec = camp.levels[campLevelId(isl, n)];
  newBestEl.hidden = !(won && rec && rec.wins > 1 && score >= rec.best && campRun.prevBest < score);
  commentaryEl.textContent = line;
  commentaryEl.hidden = !line;
  document.getElementById("gameover-revive").hidden = true;
  const again = document.getElementById("gameover-again"), next = document.getElementById("gameover-next");
  again.textContent = won ? "Play again" : "Try again";
  next.hidden = !won || !nextOpen || challenge;
  next.textContent = `Next: ${n + 1}`;
  document.getElementById("gameover-menu").textContent = challenge ? "Challenger" : "Map";
  campResultShown = true;
  showScreen("gameover");
  updatePauseButton();
  campHudUpdate();
  (won && !next.hidden ? next : again).focus({ preventScroll: true });
}

/* Back to the map (or the challenger), on the level just played */
function campResultMap() {
  const isl = campRun ? campRun.isl : camp.at, n = campRun ? campRun.n : 1;
  const challenge = campRun && campRun.challenge >= 0;
  campLeaveRun();
  if (challenge && typeof openCampShop === "function") { openCampShop(isl, "challenger"); return; }
  lastPlayed = { key: isl, j: n, nm: false };
  mapReturnTo = isl;
  openScreen("modes");
}
function campResultAgain() { campLeaveRun(); campRestart(); }
function campResultNext() {
  if (!campLast) return;
  const { isl, n } = campLast;
  if (!(n < LEVEL_COUNT && campLevelOpen(isl, n + 1))) return;
  campLeaveRun();
  lastPlayed = { key: isl, j: n + 1, nm: false };
  campBeginLevel(isl, n + 1);
}

/* The card's buttons and keys do the campaign's thing while a level's result is showing */
(() => {
  const row = screenEls.gameover.querySelector(".row-buttons");
  const next = document.createElement("button");
  next.className = "btn btn-gold";
  next.id = "gameover-next";
  next.hidden = true;
  row.appendChild(next);
  next.addEventListener("click", campResultNext);
  const take = (id, fn) => document.getElementById(id).addEventListener("click", e => {
    if (!campResultShown) return;
    e.stopImmediatePropagation();
    fn();
  }, true);
  take("gameover-menu", campResultMap);
  take("gameover-again", campResultAgain);
  const begin = beginRun;
  window.beginRun = function () {
    if (campResultShown && currentScreen === "gameover") {
      const nx = document.getElementById("gameover-next");
      if (!nx.hidden && document.activeElement !== document.getElementById("gameover-again")) campResultNext(); else campResultAgain();
      return;
    }
    return begin.apply(this, arguments);
  };
  const leave = leaveGameover;
  window.leaveGameover = function () { if (campResultShown) { campResultMap(); return; } return leave.apply(this, arguments); };
})();

/* ----- Keys: Space casts during a level, 1 to 4 eat a snack, Esc or P pauses ----- */
(() => {
  const orig = handleKeyDown;
  document.removeEventListener("keydown", orig);
  const campKeys = e => {
    if (!campRun || e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return false;
    if (gameState === "PLAYING" && !pauseOpen && !introOpen && !loadoutOpen && !confirmOpen) {
      const key = e.key.toLowerCase();
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat && !reviveCountdown) campCast(); return true; }
      if (key === "e") { e.preventDefault(); return true; }            // no shedding in the campaign
      // 1 to 4: a bite of whatever's in that pocket slot (the number row or the keypad)
      const slot = /^(Digit|Numpad)([1-4])$/.exec(e.code);
      if (slot) { e.preventDefault(); if (!e.repeat && !reviveCountdown) campEatSnack(+slot[2] - 1); return true; }
    }
    return false;
  };
  window.handleKeyDown = function (e) { if (campKeys(e)) return; return orig.call(this, e); };
  document.addEventListener("keydown", window.handleKeyDown);
})();

/* ----- The pause menu: no Tailor mid-level; it says where you are ----- */
(() => {
  const orig = pauseGame;
  window.pauseGame = function () {
    orig.apply(this, arguments);
    const shop = document.getElementById("pause-shop");
    if (shop) shop.hidden = !!campRun;
    if (campRun && pauseOpen) document.getElementById("pause-score").textContent = `${campRun.def.n}. ${campRun.def.name} · ${fmtInt(score)} points`;
  };
})();

/* Leaving a level through some other door (Settings from pause comes back, so that stays) */
(() => {
  const orig = showScreen;
  window.showScreen = function (name) {
    if (name !== "gameover") campResultShown = false;
    if (campRun && name && !["gameover", "settings", "controls", "howto", "console"].includes(name)) campLeaveRun();
    orig.apply(this, arguments);
    if (name !== "gameover") {
      screenEls.gameover.classList.remove("won");
      document.getElementById("gameover-next").hidden = true;
      document.getElementById("gameover-menu").textContent = "Map";
      document.querySelector("#screen-gameover .screen-title").textContent = "Game over";
    }
    requestAnimationFrame(campHudPlace);
  };
})();

/* Touch screens: the on-screen Shed button becomes the spell button */
(() => {
  const orig = shedSkin;
  window.shedSkin = function () { if (campRun) { campCast(); return; } return orig.apply(this, arguments); };
  const touch = updateTouchControls;
  window.updateTouchControls = function () {
    touch.apply(this, arguments);
    if (campRun && gameState === "PLAYING" && !pauseOpen && touchControlsEl.style.display !== "none") {
      touchSelectBtn.style.display = "block";
      touchSelectBtn.textContent = "Spell";
    }
  };
})();
