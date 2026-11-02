/* =========================================================
   src/game/flow/snake.js
   Moving the snake
   ========================================================= */
"use strict";

/* ----- Snake ----- */
function resetSnake() {
  const start = Math.floor(cellsAcross * 0.4) * cell;
  snake.x = start;
  snake.y = start;
  snake.cells = [];
  snake.maxCells = 4;
  snake.dx = cell;
  snake.dy = 0;
  turnQueue = [];

  if (edgeMode === "endless") {
    snake.x = ENDLESS.startCol * cell;
    snake.y = Math.floor(cellsAcross / 2) * cell;
    snake.maxCells = ENDLESS.startLength;
    for (let i = 0; i < ENDLESS.startLength; i++) snake.cells.push({ x: snake.x - i * cell, y: snake.y });
  }
}

function startGame() {
  pauseDetour = false;
  if (currentModeKey !== "custom" && !isModeUnlocked(currentModeKey)) currentModeKey = "easy";
  applyMode(modes[currentModeKey]);

  score = 0;
  stopPopsicles();
  apples = [];
  orbs = [];
  rocks = [];
  entities = [];
  husks = [];
  hunter = null;
  echo = null;
  walls = new Map();
  panels = new Map();
  fx = { fastUntil: 0, slowUntil: 0, slowFactor: 1, pauseUntil: 0 };
  paused = false;
  closeIntroCard();
  orbAccumulator = 0;
  runMs = 0;
  allowanceAccumulator = 0;
  runXp = 0;
  runBank = 0;
  runPaidScore = 0;
  runPaidBank = 0;
  endless = edgeMode === "endless" ? { camera: 0, speed: ENDLESS.startSpeed * (endlessCfg.levelSpeed || 1), elapsed: 0, prev: [], lastCol: 0 } : null;
  if (endless) moveInterval = 1000 / (endless.speed * save.dev.speedMult);

  maze = null;
  innerSegments = [];
  nmAccumulator = 0;
  tutorial = null;
  shimmers = [];
  shimmerAccumulator = 0;
  relicItems = [];
  relicRolled = false;
  chatterAcc = 0;
  lastChatter = performance.now() - CHATTER_COOLDOWN + 8000;   // nothing in the first few seconds
  if (edgeMode === "maze") {
    const at = buildMaze();
    resetSnake();
    snake.x = at.x;
    snake.y = at.y;
  } else {
    resetSnake();
    buildInnerWalls();
    if (currentModeKey === "custom") applyCustomLevel();
  }
  if (endless) endless.prev = snake.cells.map(c => ({ x: c.x, y: c.y }));
  placeRocks();
  maintainApples();

  // Every run starts with the mode's XP orbs, placed independently of the apples
  spawnStartingOrbs();
  resetSpawnTimers();

  currentHearts = getTrackValue("hearts") + (currentNightmare ? getTrackValue("lucid") : 0);
  applyRunBoosts();
  resetMechanics();       // armor, Fever, contracts, the Hunter, Echoes (src/game/flow/mechanics.js)
  placeEntities();        // brambles, ice and spike traps
  lastAppleAt = -1e9;
  runHistory = [];
  graceUntil = 0;
  partingBase = 0;
  avgBeforeDeath = null;
  if (currentModeKey === "custom") currentHearts = customLevel.r.h;   // the level's own hearts rule
  if (currentNightmare) save.stats.nightmareGames++;
  save.stats.gamesPlayed++;
  if (save.gamesByMode[currentModeKey] !== undefined) save.gamesByMode[currentModeKey]++;
  save.stats.longestSnake = Math.max(save.stats.longestSnake, snake.maxCells);
  persist();

  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  showScreen(null);

  const now = performance.now();
  lastFrameTs = now;
  lastMoveTs = now;
  survivalAccumulator = 0;
}

function endGame(cause) {
  if (gameState !== "PLAYING") return;
  if (tutorial) { tutorialFail(cause); return; }

  frozenAt = performance.now();
  paused = false;
  closeIntroCard();

  const st = save.stats;
  const quit = cause === "quit";
  if (!quit) st.deaths++;
  if (cause === "wall" || cause === "behind") st.wallCrashes++;
  else if (cause === "self") st.tailBites++;
  else if (cause === "poison") st.poisoned++;
  if (endless) st.bestDistance = Math.max(st.bestDistance, endlessDistance());

  const bests = currentNightmare ? save.highScoresNightmare : save.highScores;
  const prevBest = bests[currentModeKey];
  const isBest = prevBest !== undefined && score > prevBest;
  if (isBest) bests[currentModeKey] = score;
  if (!quit) {
    if (runMs < 5000) st.quickDeaths++;
    if (!isBest && prevBest > 0 && score >= prevBest * 0.9) st.soClose++;
    st.sameCauseRun = cause === st.lastCause ? st.sameCauseRun + 1 : 1;
    st.lastCause = cause;
    st.sameCauseBest = Math.max(st.sameCauseBest, st.sameCauseRun);
  }
  if (cause === "hunger") st.hungerDeaths++;

  const paid = payRun();
  runXp = runPaidScore + runPaidBank;
  avgBeforeDeath = save.avgRunXp;
  save.avgRunXp = save.avgRunXp ? save.avgRunXp * 0.8 + runXp * 0.2 : runXp;

  let gift = 0;
  const giftPct = getTrackValue("parting");
  if (giftPct > 0 && paid > 0) { gift = Math.floor(paid * giftPct / 100); save.xp += gift; save.stats.xpEarned += gift; }
  partingBase = runXp;
  persist();
  updateHud();

  const unit = save.settings.scoreUnit === "pts" ? "" : " " + scoreUnitLabel();
  finalScoreEl.textContent = "Final score: " + fmtInt(score) + unit;
  const extras = [];
  extras.push(`+${fmtInt(paid + gift)} XP earned`);
  if (endless) extras.push(`Distance: ${fmtInt(endlessDistance())} m`);
  if (gift > 0) extras.push(`Parting Gift: +${fmtInt(gift)} XP`);
  finalExtraEl.textContent = extras.join("  |  ");
  finalExtraEl.hidden = !extras.length;
  newBestEl.hidden = !isBest;

  const line = quit ? "You walked away from the story. I am not offended. I am merely writing it down, in ink, where it will stay." : (causeLine(cause) || getCommentary(cause));
  commentaryEl.textContent = line;
  commentaryEl.hidden = !line;

  if (currentModeKey === "custom") restoreAfterCustom();
  const reviveBtn = document.getElementById("gameover-revive");
  reviveBtn.hidden = !canRevive();
  reviveBtn.textContent = `Revive (${save.consumables.revive} left)`;
  const levelNotes = recordLevelRun(quit);
  persist();
  showScreen("gameover");
  sfx(quit ? "click" : "death");
  levelNotes.forEach((n, i) => setTimeout(() => { showToast(n.text); sfx("unlock"); }, 700 + i * 2600));
  const nmScene = levelNotes.find(n => n.scene);
  if (nmScene && !save.pendingScene) setTimeout(() => sceneForUnlock(nmScene.scene, () => { if (save.unlockedNightmares.length === MODE_KEYS.length) sceneForUnlock("nightmaresdone"); }), 900);
  if (!quit) buzz([90, 50, 190]);
  if (save.pendingScene) {
    const id = save.pendingScene;
    save.pendingScene = null;
    persist();
    setTimeout(() => playScene(id, () => showToast("New Flair: Ancient Scales. Find it in your Inventory.")), 600);
  }
  checkBadges();

  const shakeClass = { subtle: "shake-subtle", normal: "shake", quake: "shake-quake" }[save.settings.shake];
  stageEl.classList.remove("shake", "shake-subtle", "shake-quake");
  if (shakeClass) {
    void stageEl.offsetWidth;
    stageEl.classList.add(shakeClass);
  }
  if (isBest && save.settings.confetti) confetti();
}
