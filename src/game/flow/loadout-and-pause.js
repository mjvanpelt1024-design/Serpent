/* =========================================================
   src/game/flow/loadout-and-pause.js
   Loadout, revives and pausing
   ========================================================= */
"use strict";

/* ----- Loadout: pick one-time items before a run ----- */
let loadoutOpen = false;
let loadoutChoice = {};

function beginRun() {
  if (currentModeKey === "custom") { if (customLevel) playCustom(customLevel, sbReturn); return; }
  if (!isModeUnlocked(currentModeKey)) return;
  if (hasBoostItems()) openLoadout();
  else startGame();
}

function openLoadout() {
  loadoutChoice = { gold: 0 };
  loadoutOpen = true;
  renderLoadout();
  document.getElementById("loadout").classList.add("active");
  document.getElementById("loadout-go").focus({ preventScroll: true });
}

function renderLoadout() {
  const list = document.getElementById("loadout-list");
  list.innerHTML = "";
  CONSUMABLE_KEYS.filter(k => (CONSUMABLES[k].boost || k === "goldheart") && save.consumables[k] > 0).forEach(k => {
    const row = document.createElement("div");
    row.className = "loadout-row";
    const info = document.createElement("div");
    info.className = "loadout-info";
    info.innerHTML = `<div class="shop-name">${CONSUMABLES[k].name}</div><div class="shop-desc">You have ${fmtInt(save.consumables[k])}</div>`;
    row.append(iconCanvas(k, 26), info);
    if (k === "goldheart") {
      const max = Math.min(MAX_GOLD_BROUGHT, save.consumables.goldheart);
      const step = document.createElement("div");
      step.className = "stepper";
      step.innerHTML = `<button class="btn btn-small" data-key="lo-gold-minus" aria-label="One fewer golden heart">-</button><span aria-live="polite">${loadoutChoice.gold}</span><button class="btn btn-small" data-key="lo-gold-plus" aria-label="One more golden heart">+</button>`;
      step.children[0].disabled = loadoutChoice.gold <= 0;
      step.children[2].disabled = loadoutChoice.gold >= max;
      step.children[0].addEventListener("click", () => { loadoutChoice.gold--; renderLoadout(); list.querySelector('[data-key="lo-gold-plus"]').focus(); });
      step.children[2].addEventListener("click", () => { loadoutChoice.gold++; renderLoadout(); list.querySelector('[data-key="lo-gold-plus"]').focus(); });
      row.append(step);
    } else {
      const on = !!loadoutChoice[k];
      const sw = document.createElement("button");
      sw.className = "switch";
      sw.dataset.key = "lo-" + k;
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", String(on));
      sw.setAttribute("aria-label", "Use " + CONSUMABLES[k].name);
      sw.addEventListener("click", () => { loadoutChoice[k] = !loadoutChoice[k]; renderLoadout(); list.querySelector(`[data-key="lo-${k}"]`).focus(); });
      row.append(sw);
    }
    list.appendChild(row);
  });
}

function closeLoadout() {
  loadoutOpen = false;
  document.getElementById("loadout").classList.remove("active");
}

function loadoutGo(useNothing = false) {
  pendingBoosts = useNothing ? {} : { ...loadoutChoice };
  closeLoadout();
  startGame();
}

/* Called by startGame: spends the chosen boosts. Golden hearts are only spent when they take a hit. */
function applyRunBoosts() {
  runBoosts = {};
  goldHearts = 0;
  const pick = pendingBoosts;
  pendingBoosts = {};
  CONSUMABLE_KEYS.forEach(k => {
    if (!CONSUMABLES[k].boost || !pick[k] || save.consumables[k] <= 0) return;
    save.consumables[k]--;
    save.stats.boostsUsed++;
    runBoosts[k] = true;
  });
  goldHearts = Math.max(0, Math.min(pick.gold || 0, save.consumables.goldheart, MAX_GOLD_BROUGHT));
}

/* ----- Revives ----- */
let runHistory = [];
let graceUntil = 0;
let reviveCountdown = 0;
let partingBase = 0;
let avgBeforeDeath = null;

function rememberStep() {
  runHistory.push({
    x: snake.x, y: snake.y, dx: snake.dx, dy: snake.dy, maxCells: snake.maxCells,
    cells: snake.cells.map(c => ({ x: c.x, y: c.y }))
  });
  if (runHistory.length > 6) runHistory.shift();
}

function canRevive() {
  return currentModeKey !== "custom" && save.consumables.revive > 0 && runHistory.length > 0;
}

function reviveRun() {
  if (gameState !== "GAMEOVER" || !canRevive()) return;
  save.consumables.revive--;
  save.stats.revivesUsed++;
  if (avgBeforeDeath !== null) save.avgRunXp = avgBeforeDeath;   // the run isn't over after all

  const snap = runHistory[0];
  runHistory = [];
  snake.x = snap.x;
  snake.y = snap.y;
  snake.dx = snap.dx;
  snake.dy = snap.dy;
  snake.maxCells = Math.max(snap.maxCells, currentNightmare && nm.starve ? 3 : 1);
  snake.cells = snap.cells;
  turnQueue = [];
  if (endless) {
    endless.camera = Math.min(endless.camera, snake.x - ENDLESS.startCol * cell);
    endless.prev = snake.cells.map(c => ({ ...c }));
  }
  if (maze) maze.prev = snake.cells.map(c => ({ ...c }));

  // Clear anything nasty right where you're coming back
  const near = it => snake.cells.slice(0, 3).some(c => Math.abs(c.x - it.x) <= cell * 2 && Math.abs(c.y - it.y) <= cell * 2);
  popsicles = popsicles.filter(p => p.isBonusApple || !near(p));
  hazards = hazards.filter(h => !near(h));
  rocks = rocks.filter(r => !near(r));

  persist();
  showScreen(null);
  const now = performance.now();
  lastFrameTs = now;
  graceUntil = now + 4500;
  paused = true;
  pauseStartedAt = now;
  reviveCountdown = 3;
  showCountdown();
  sfx("revive");
  buzz([40, 40, 40, 40, 100]);
  updateHud();
}

function showCountdown() {
  const el = document.getElementById("countdown");
  if (reviveCountdown <= 0) {
    el.hidden = true;
    if (gameState === "PLAYING") resumeFromPause();
    return;
  }
  el.hidden = false;
  el.textContent = String(reviveCountdown);
  el.classList.remove("tick");
  void el.offsetWidth;
  el.classList.add("tick");
  setTimeout(() => {
    if (gameState !== "PLAYING") { el.hidden = true; reviveCountdown = 0; return; }
    reviveCountdown--;
    showCountdown();
  }, 800);
}

/* ----- Pausing ----- */
let pauseOpen = false;

function canPause() {
  return gameState === "PLAYING" && !paused && !introOpen && !reviveCountdown && !tutorial && !sceneOpen;
}

function pauseGame() {
  if (!canPause()) return;
  paused = true;
  pauseOpen = true;
  pauseStartedAt = performance.now();
  const unit = save.settings.scoreUnit === "pts" ? "" : " " + scoreUnitLabel();
  document.getElementById("pause-score").textContent = `${modes[currentModeKey].label}${currentNightmare ? " Nightmare" : ""} · Score ${fmtInt(score)}${unit}`;
  document.getElementById("pause").classList.add("active");
  updatePauseButton();
  updateTouchControls();
  sfx("click");
  document.getElementById("pause-continue").focus({ preventScroll: true });
}

function continueGame() {
  if (!pauseOpen) return;
  pauseOpen = false;
  document.getElementById("pause").classList.remove("active");
  resumeFromPause();
  updatePauseButton();
  updateTouchControls();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

/* Quitting ends the run and shows your score, but doesn't count as a death */
function quitRun() {
  if (!pauseOpen) return;
  pauseOpen = false;
  document.getElementById("pause").classList.remove("active");
  paused = false;
  updatePauseButton();
  endGame("quit");
}

/* Keeps the screen awake while a run is actually in progress */
let wakeLock = null;
async function setWakeLock(on) {
  if (!navigator.wakeLock) return;
  try {
    if (on && save.settings.awake && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if ((!on || !save.settings.awake) && wakeLock) {
      const w = wakeLock;
      wakeLock = null;
      await w.release();
    }
  } catch (e) {
    wakeLock = null;   // not allowed right now (battery saver, hidden tab)
  }
}

function updatePauseButton() {
  setWakeLock(gameState === "PLAYING" && !pauseOpen && !paused);
  const btn = document.getElementById("pause-btn");
  if (!btn) return;
  btn.hidden = !(gameState === "PLAYING" && !tutorial && !pauseOpen);
  const slot = document.getElementById("pause-slot");
  if (slot) slot.classList.toggle("open", !btn.hidden);
}

/* From the pause menu you can pop into the Shop or Settings. The run waits, frozen,
   and Back returns to the same pause menu. */
let pauseDetour = false;

function openFromPause(screen) {
  if (!pauseOpen) return;
  pauseOpen = false;
  pauseDetour = true;
  document.getElementById("pause").classList.remove("active");
  openScreen(screen);
}

function returnToPause() {
  pauseDetour = false;
  pauseOpen = true;
  showScreen(null);
  document.getElementById("pause").classList.add("active");
  updatePauseButton();
  updateTouchControls();
  document.getElementById("pause-continue").focus({ preventScroll: true });
}

/* Called whenever a run is abandoned or replaced */
function clearPauseState() {
  pauseDetour = false;
  pauseOpen = false;
  paused = false;
  document.getElementById("pause").classList.remove("active");
}

/* Push every timer forward by however long the game sat paused */
function resumeFromPause() {
  if (!paused) return;
  const d = performance.now() - pauseStartedAt;
  [apples, orbs, popsicles, hazards, shimmers, relicItems].forEach(list => list.forEach(it => {
    if (it.spawnAt) it.spawnAt += d;
    if (it.expiresAt) it.expiresAt += d;
    if (it.nextHop) it.nextHop += d;
    if (it.hopAt) it.hopAt += d;
  }));
  ["fastUntil", "slowUntil", "pauseUntil"].forEach(k => { if (fx[k] > pauseStartedAt) fx[k] += d; });
  if (graceUntil > pauseStartedAt) graceUntil += d;
  // build 46: every clock on the board waits while you're paused
  entities.forEach(e => ["spawnAt", "expiresAt", "strikeAt", "blowAt", "openAt", "moveAt", "growAt", "hopAt"].forEach(k => { if (e[k]) e[k] += d; }));
  apples.forEach(a => { if (a.bornAt) a.bornAt += d; if (a.rotUntil) a.rotUntil += d; });
  husks.forEach(h => { h.expiresAt += d; });
  ["shieldUntil", "freezeUntil", "starUntil", "phantomUntil", "lodeUntil", "frenzyUntil"].forEach(k => { if (buffs[k] > pauseStartedAt) buffs[k] += d; });
  if (fever.until > pauseStartedAt) fever.until += d;
  if (shedReadyAt > pauseStartedAt) shedReadyAt += d;
  if (hunter) { hunter.moveAt += d; if (hunter.stunnedUntil > pauseStartedAt) hunter.stunnedUntil += d; }
  lastMoveTs = performance.now();
  lastFrameTs = performance.now();
  paused = false;
}
