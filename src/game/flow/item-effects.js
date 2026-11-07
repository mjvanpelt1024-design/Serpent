/* =========================================================
   src/game/flow/item-effects.js
   What each item and hazard does
   ========================================================= */
"use strict";

/* A small burst of confetti over the board */
function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ffd23f", "#3ddc3d", "#ff5d8f", "#38bdf8", "#b36bff", "#ff8c1a"];
  const layer = document.createElement("div");
  layer.className = "confetti";
  for (let i = 0; i < 46; i++) {
    const bit = document.createElement("span");
    bit.style.left = Math.random() * 100 + "%";
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = Math.random() * 0.35 + "s";
    bit.style.animationDuration = 1.1 + Math.random() * 0.8 + "s";
    bit.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    bit.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");
    layer.appendChild(bit);
  }
  (document.body.classList.contains("menu-full") ? document.body : stageEl).appendChild(layer);
  setTimeout(() => layer.remove(), 2400);
}

/* ----- What each item does ----- */
function eatApple(size, small) {
  const grade = small ? 0 : (size === 2 ? 2 : 1);
  let points = 100 * scoreMultiplier * getTrackValue("apple") * [0.5, 1, 5][grade];
  if (grade === 2 && bigSpawns) points *= getTrackValue("midas") / 5;   // Midas Touch in Treasure
  if (currentModeKey === "chaos") points *= getTrackValue("sugar");
  if (runBoosts.doubleapple) points *= 2;
  points *= inMode("easy", "snack", 1) * inMode("challenge", "accepted", 1) * worldApplePoints();
  const nowTs = performance.now();
  if (currentModeKey === "classic" && nowTs - lastAppleAt < 5000) points *= 1 + getTrackValue("combo") / 100;
  lastAppleAt = nowTs;
  if (currentModeKey === "insane" && roll(getTrackValue("healer"))) {
    if (currentHearts < getTrackValue("hearts")) {
      currentHearts = Math.min(getTrackValue("hearts"), currentHearts + 0.5);
      showToast("Heart Healer! Half a heart back.");
      updateHud();
    }
  }

  if (grade === 2) save.stats.bigApples++;
  if (grade === 0) save.stats.smallApples++;

  if (endless) jumpForward(ENDLESS.jump[grade] + (roll(getTrackValue("jets")) ? 1 : 0));
  else snake.maxCells += grade === 2 ? 5 : 1;
  if (nm.sugar) moveInterval = Math.max(baseInterval / 2, moveInterval / (1 + 0.03 * (1 - getTrackValue("nm_chaos") / 100)));

  save.stats.applesEaten++;
  save.stats.longestSnake = Math.max(save.stats.longestSnake, snake.maxCells);
  runCount("apples");
  addFever([0.06, 0.12, 0.3][grade]);
  appleSideEffects();
  addScore(points);
  sfx(grade === 2 ? "bigapple" : "apple");
}

function collectOrb(orb) {
  const grade = gradeOf(orb);
  save.stats.orbsCollected++;
  runCount("orbs");
  addFever(0.04);
  // Orbs are worth the same share of a good run on every island (xpUnit, src/game/economy/ladder.js)
  const unit = xpUnit();
  if (grade === 0) grantXp(unit * 0.5 * (1 + inMode("easy", "crumbs") / 100));
  else if (grade === 2) grantXp(unit * (5 + inMode("treasure", "chest")));
  else grantXp(unit * (currentModeKey === "classic" && roll(getTrackValue("retro")) ? 2 : 1));
  sfx(grade === 2 ? "bigxp" : "xp");
  persist();
  updateHud();
}

/* Rocks and fleas cut your score; Hard Hat softens it */
function loseScore(fraction) {
  const softened = Math.min(0.99, fraction * (getTrackValue("resist") / 50));
  score = Math.max(0, score * (1 - softened));
  updateHud();
}

/* Heart damage. Infinity = instant game over. Returns true if the snake died. */
function takeHit(hearts, cause, { popsicle = false } = {}) {
  if (save.dev.invincible) return false;
  if (guardHit()) return false;               // the Rampage Star, or a bubble shield (mechanics.js)

  if (popsicle) {
    if (hearts === Infinity && roll(getTrackValue("thickskin"))) {
      hearts = 1;
      showToast("Thick Skin! That mega pop only cost a heart.");
    }
    let saved = null;
    if (roll(getTrackValue("antidote"))) saved = "Antidote! That popsicle did nothing.";
    else if (roll(getTrackValue("ironstomach"))) saved = "Iron Stomach! No damage taken.";
    if (saved) {
      save.stats.antidotes++;
      save.stats.poisonsSurvived++;
      sfx("buy");
      showToast(saved);
      return false;
    }
    if (hearts !== Infinity && roll(getTrackValue("halfheart"))) {
      hearts /= 2;
      showToast("Half Measures! Only half the damage.");
    }
  }

  if (armorAbsorb()) return false;            // an armor plate takes any one hit

  noteHurt();
  if (hearts !== Infinity && goldHearts > 0) {
    goldHearts--;
    save.consumables.goldheart = Math.max(0, save.consumables.goldheart - 1);
    save.stats.goldHeartsUsed++;
    persist();
    sfx("heart");
    buzz(30);
    showToast("Your golden heart took the hit. It's gone for good.");
    sfx("goldheart");
    lastHeartsKey = "";
    updateHud();
    return false;
  }

  if (hearts !== Infinity && currentHearts >= hearts - 1e-9) {
    currentHearts = Math.max(0, Math.round((currentHearts - hearts) * 2) / 2);
    save.stats.poisonsSurvived++;
    if (popsicle && currentModeKey === "insane" && getTrackValue("coldcomfort") > 0) addScore(getTrackValue("coldcomfort"));
    sfx("heart");
    buzz(45);
    updateHud();
    return false;
  }

  endGame(cause);
  return true;
}

function hitRock(rock) {
  if (starOn()) { addScore(50 * scoreMultiplier); runCount("smashed"); sfx("rock"); return; }   // Rampage smashes rocks
  save.stats.rocksHit++;
  loseScore([0.25, 0.5, 0.99][gradeOf(rock)]);
  sfx("rock");
}

/* Returns true if the snake died */
function hitPopsicle(p) {
  // Fever and the Rampage Star burst small and normal popsicles for points
  if ((feverOn() && gradeOf(p) < 2) || starOn()) { addScore(50 * scoreMultiplier); runCount("smashed"); sfx("rock"); return false; }
  save.stats.popsiclesEaten++;
  sfx("bad");
  if (nm.noMercy && !save.dev.invincible) {
    if (dreamCatch("That popsicle missed.")) return false;
    if (roll(getTrackValue("nm_insane"))) { showToast("Mercy Rule! You survived."); return false; }
    endGame("poison");
    return true;
  }
  return takeHit([0.5, 1, Infinity][gradeOf(p)], "poison", { popsicle: true });
}

/* Returns true if the snake died */
function hitHazard(h, ts) {
  const grade = gradeOf(h);
  if (h.type !== "molasses" && ((feverOn() && grade < 2) || starOn())) { addScore(50 * scoreMultiplier); runCount("smashed"); sfx("rock"); return false; }
  if (h.type === "flea") {
    save.stats.fleasHit++;
    sfx("flea");
    if (currentModeKey === "mirror" && roll(getTrackValue("collar"))) { showToast("Flea Collar! That flea did nothing."); return false; }
    if (grade === 0) { loseScore(0.5); return false; }
    if (grade === 2) loseScore(0.5);
    return takeHit(grade === 1 ? 0.5 : 1, "flea");
  }
  if (h.type === "fire") {
    save.stats.firesHit++;
    sfx("fire");
    fx.fastUntil = Math.max(fx.fastUntil, ts) + FIRE_MS * (1 - getTrackValue("retardant") / 100);
    if (grade > 0 && roll(getTrackValue("mitts"))) { showToast("Oven Mitts! No burns."); return false; }
    if (grade === 1) loseScore(0.5);
    if (grade === 2) return takeHit(0.5, "fire");
    return false;
  }
  if (h.type === "molasses") {
    save.stats.molassesHit++;
    sfx("molasses");
    const skip = 1 - getTrackValue("syrup") / 100;
    fx.slowFactor = grade === 0 ? 1.4 : 1.8;
    fx.slowUntil = ts + (grade === 0 ? 4000 : 5000) * skip;
    if (grade === 2) fx.pauseUntil = ts + 1500 * skip;
    return false;
  }
  return false;
}

function pickMirrorExit(avoidSide = -1) {
  const blocked = occupiedSet({ itemsOnly: true });
  // Apples and orbs are fine to land on; hazards and your own body are not.
  // The body is added last so an item under it can never make that square look safe.
  apples.forEach(a => blocked.delete(cellKey(a.x, a.y)));
  orbs.forEach(o => blocked.delete(cellKey(o.x, o.y)));
  snake.cells.forEach(c => blocked.add(cellKey(c.x, c.y)));
  blocked.add(cellKey(snake.x, snake.y));

  const last = boardSize - cell;
  for (let attempt = 0; attempt < 80; attempt++) {
    const side = getRandomInt(0, 4);
    if (side === avoidSide) continue;
    const along = getRandomInt(0, cellsAcross) * cell;
    if (avoidSide === 1 && (side === 0 || side === 2) && along >= boardSize - cell * 2) continue;
    let exit;
    if (side === 0) exit = { x: along, y: 0, dx: 0, dy: cell };         // top, heading down
    else if (side === 1) exit = { x: last, y: along, dx: -cell, dy: 0 }; // right, heading left
    else if (side === 2) exit = { x: along, y: last, dx: 0, dy: -cell }; // bottom, heading up
    else exit = { x: 0, y: along, dx: cell, dy: 0 };                     // left, heading right
    if (!blocked.has(cellKey(exit.x, exit.y))) return exit;
  }
  return null;
}

/* Endless: an apple shoves the whole snake forward, as far as the path is clear */
function jumpForward(cols) {
  const danger = new Set();
  [popsicles, rocks, hazards].forEach(list => list.forEach(p => {
    const n = p.size || 1;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) danger.add(cellKey(p.x + a * cell, p.y + b * cell));
  }));
  const body = new Set(snake.cells.map(c => cellKey(c.x, c.y)));

  // The whole snake moves, so every segment's landing spot must be clear,
  // not just the head's path (a bent body used to land on popsicles and hide them)
  let clear = 0;
  for (let k = 1; k <= cols; k++) {
    const x = snake.x + k * cell;
    const [top, bottom] = endlessRows(x);
    const row = snake.y / cell;
    if (row < top || row >= bottom || danger.has(cellKey(x, snake.y)) || body.has(cellKey(x, snake.y))) break;
    if (snake.cells.some(c => danger.has(cellKey(c.x + k * cell, c.y)))) break;
    clear = k;
  }
  if (!clear) return;
  snake.x += clear * cell;
  snake.cells.forEach(c => { c.x += clear * cell; });
  // A moment of protection so you're never launched face first into something
  graceUntil = Math.max(graceUntil, performance.now() + ENDLESS.jumpGraceMs);
}

function spawnEndlessItems() {
  const x = endlessSpawnX();
  if (Math.random() < ENDLESS.appleChance) spawnApple(x);
  const ramp = endless.speed / (ENDLESS.startSpeed * (endlessCfg.levelSpeed || 1)) * (runBoosts.repellent ? 0.5 : 1);
  if (spec.popsicle && Math.random() < save.dev.hazardMult * spec.popsicle.rate * ramp * (1 - getTrackValue("scout") / 100) * (1 - getTrackValue("popcontrol") / 100)) spawnPopsicle(x);
  if (spec.flea && Math.random() < save.dev.hazardMult * spec.flea.rate * ramp) spawnHazard("flea", x);
  if (spec.rock && Math.random() < save.dev.hazardMult * spec.rock.rate) {
    const spot = spotFor(rollGrade(spec.rock), x);
    if (spot) rocks.push(spot);
  }
}

/* Runs every frame in Endless: speed ramp, smooth camera, falling behind */
function updateEndless(ts, delta) {
  endless.elapsed += delta;
  const ramp = ENDLESS.rampPerSec * (1 - getTrackValue("cruise") / 100);
  const lvl = endlessCfg.levelSpeed || 1;
  endless.speed = Math.min(Math.min(15, ENDLESS.maxSpeed * lvl), ENDLESS.startSpeed * lvl + ramp * (endless.elapsed / 1000));
  moveInterval = 1000 / (endless.speed * save.dev.speedMult);

  endless.camera += (endless.speed * save.dev.speedMult * save.dev.scrollMult * cell * endlessCfg.scrollRatio * delta) / 1000;

  // Never let the snake get too far ahead of the screen
  const prevHead = endless.prev[0] || snake.cells[0] || snake;
  const headX = prevHead.x + (snake.x - prevHead.x) * stepProgress(ts);
  endless.camera = Math.max(endless.camera, headX - ENDLESS.maxCol * cell);

  const col = Math.floor(endless.camera / cell);
  if (col > endless.lastCol) {
    save.stats.totalDistance += col - endless.lastCol;
    endless.lastCol = col;
  }

  const stillHere = o => o.x + (o.size || 1) * cell > endless.camera - cell;
  apples = apples.filter(stillHere);
  popsicles = popsicles.filter(stillHere);
  orbs = orbs.filter(stillHere);
  rocks = rocks.filter(stillHere);
  hazards = hazards.filter(stillHere);
  entities = entities.filter(e => ENTITY_TYPES[e.type].global || stillHere(e));

  if (snake.x + cell * 0.5 < endless.camera && !save.dev.invincible) endGame("behind");
}

function stepSnake(ts = performance.now()) {
  rememberStep();
  const grace = ts < graceUntil;
  if (endless) endless.prev = snake.cells.map(c => ({ x: c.x, y: c.y }));
  if (maze) maze.prev = snake.cells.map(c => ({ x: c.x, y: c.y }));

  // On ice the snake slides straight on: turns wait until it's off
  if (turnQueue.length && (!onIce() || iceGrips())) {
    const turn = turnQueue.shift();
    snake.dx = turn.dx;
    snake.dy = turn.dy;
  }

  let nx = snake.x + snake.dx;
  let ny = snake.y + snake.dy;
  if (panels.size) {
    const hit = panelCrossing(snake.x / cell, snake.y / cell, Math.sign(snake.dx), Math.sign(snake.dy));
    if (hit && hit.kind === "red" && !save.dev.invincible && !grace) { if (!guardCrash("wall")) endGame("wall"); return; }
    if (hit && hit.kind === "purple") {
      const exit = panelPortalExit(hit.key);
      if (exit) {
        snake.x = exit.x - exit.dx;   // step "into" the exit square below
        snake.y = exit.y - exit.dy;
        snake.dx = exit.dx;
        snake.dy = exit.dy;
        nx = exit.x;
        ny = exit.y;
        turnQueue = [];
        save.stats.portalWarps++;
        sfx("portal");
      }
    }
  }
  if (edgeMode === "maze") {
    nx = wrapW(nx);
    ny = wrapW(ny);
  }
  const offBoard = edgeMode !== "maze" && (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize);

  if (edgeMode === "endless") {
    if (nx + cell * 0.5 < endless.camera && !save.dev.invincible) {
      endGame("behind");
      return;
    }
    const [top, bottom] = endlessRows(nx);
    const row = ny / cell;
    if ((ny < 0 || ny >= boardSize || row < top || row >= bottom) && !save.dev.invincible) {
      if (!guardCrash("wall")) endGame("wall");
      return;
    }
  } else if (offBoard && edgeMode === "tutorial") {
    if (nx >= boardSize) { endGame("wall"); return; }        // the red side
    const exit = pickMirrorExit(1);
    if (exit) {
      nx = exit.x;
      ny = exit.y;
      snake.dx = exit.dx;
      snake.dy = exit.dy;
      turnQueue = [];
      sfx("portal");
      setTimeout(() => tutorialEvent("portal"), 0);
    } else {
      nx = (nx + boardSize) % boardSize;
      ny = (ny + boardSize) % boardSize;
    }
  } else if (offBoard) {
    if (edgeMode === "wall" && !save.dev.invincible) {
      if (!guardCrash("wall")) endGame("wall");
      return;
    }

    let exit = null;
    if (edgeMode === "mirror" && !roll(getTrackValue("compass"))) exit = pickMirrorExit();

    if (exit) {
      nx = exit.x;
      ny = exit.y;
      snake.dx = exit.dx;
      snake.dy = exit.dy;
      turnQueue = [];
      save.stats.mirrorWarps++;
      if (nm.flip && !roll(getTrackValue("nm_mirror"))) {
        runReversed = !runReversed;
        showToast(runReversed ? "Controls flipped!" : "Controls back to normal");
      }
    } else {
      nx = (nx + boardSize) % boardSize;
      ny = (ny + boardSize) % boardSize;
    }
    save.stats.screenLoops++;
  }

  const wallKind = walls.get(cellKey(nx, ny));
  if (wallKind === "purple") {
    const exit = portalExit(cellKey(nx, ny));
    if (exit) {
      nx = exit.x;
      ny = exit.y;
      snake.dx = exit.dx;
      snake.dy = exit.dy;
      turnQueue = [];
      save.stats.portalWarps++;
      sfx("portal");
      if (currentModeKey === "inferno" && getTrackValue("portalpro") > 0) addScore(getTrackValue("portalpro") * scoreMultiplier);
    } else if (!save.dev.invincible) {
      if (!guardCrash("wall")) endGame("wall");
      return;
    }
  } else if (wallKind === "red" && !save.dev.invincible) {
    if (!guardCrash("wall")) endGame("wall");
    return;
  }

  snake.x = nx;
  snake.y = ny;
  snake.cells.unshift({ x: nx, y: ny });
  if (snake.cells.length > snake.maxCells) snake.cells.pop();

  if (resolveContact(nx, ny, ts, grace)) return;
  if (stepEchoes(grace)) return;
  if (gameState !== "PLAYING") return;

  if (edgeMode === "endless") spawnEndlessItems();
  else maintainApples();
}

/* Everything a head can land on, in order: fruit, rocks, pickups, popsicles, hazards, enemies, its own body.
   Returns true when the step ends here (the game is over, or the snake was sent elsewhere). Normal steps
   and gusts both land the head through this, so a blown snake meets the same things a walking one does. */
function resolveContact(nx, ny, ts, grace) {
  const appleIndex = apples.findIndex(a => covers(a, nx, ny));
  if (appleIndex !== -1 && apples[appleIndex].fake) {
    apples.splice(appleIndex, 1);
    hitRock({ size: 2 });
    showToast("Fool's gold! That was a boulder.");
  } else if (appleIndex !== -1 && apples[appleIndex].rotten) {
    apples.splice(appleIndex, 1);
    eatRotten();
    maintainApples();
  } else if (appleIndex !== -1) {
    const eaten = apples.splice(appleIndex, 1)[0];
    eatApple(eaten.size || 1, eaten.small);
    if (tutorial) tutorialEvent("apple");
    // In Endless the apple may have jumped the snake forward
    nx = snake.x;
    ny = snake.y;
  }

  const orbIndex = orbs.findIndex(o => covers(o, nx, ny));
  if (orbIndex !== -1) collectOrb(orbs.splice(orbIndex, 1)[0]);

  const rockIndex = phantomOn(ts) ? -1 : rocks.findIndex(r => covers(r, nx, ny));   // a Phantom slides through rocks
  if (rockIndex !== -1) {
    hitRock(rocks.splice(rockIndex, 1)[0]);
    if (tutorial) tutorialEvent("rock");
  }

  const relicIndex = relicItems.findIndex(r => covers(r, nx, ny));
  if (relicIndex !== -1) collectRelic(relicItems.splice(relicIndex, 1)[0]);

  const shimmerIndex = shimmers.findIndex(sh => covers(sh, nx, ny));
  if (shimmerIndex !== -1) {
    shimmers.splice(shimmerIndex, 1);
    collectShimmer();
  }

  const hitIndex = popsicles.findIndex(p => covers(p, nx, ny));
  if (hitIndex !== -1) {
    const hit = popsicles.splice(hitIndex, 1)[0];
    if (hit.isBonusApple) eatApple(hit.size || 1, hit.small);
    else if (!grace && hitPopsicle(hit)) return true;
  }

  const hazardIndex = hazards.findIndex(h => covers(h, nx, ny));
  if (hazardIndex !== -1) {
    const h = hazards.splice(hazardIndex, 1)[0];
    if (!grace && hitHazard(h, ts)) return true;
  }

  // build 46: hazards and power-ups, the Hunter, Echoes
  if (touchEntities(nx, ny, ts, grace) || gameState !== "PLAYING") return true;
  if (!grace && hunterTouchedBy(nx, ny)) return true;
  if (gameState !== "PLAYING") return true;

  // A Phantom slides through its own body
  for (let i = 1; i < snake.cells.length && !save.dev.invincible && !grace && !phantomOn(ts); i++) {
    if (snake.cells[i].x === nx && snake.cells[i].y === ny) {
      if (guardCrash("self")) break;
      endGame("self");
      return true;
    }
  }

  return false;
}

function setDirection(dx, dy) {
  if (gameState !== "PLAYING" || (paused && !reviveCountdown)) return;

  const last = turnQueue.length ? turnQueue[turnQueue.length - 1] : { dx: snake.dx, dy: snake.dy };
  if (dx === last.dx && dy === last.dy) return;   // already heading that way
  if (dx === -last.dx && dy === -last.dy) return; // no reversing into yourself
  if (turnQueue.length >= save.settings.buffer) return;

  turnQueue.push({ dx, dy });
}

function handleDirectionInput(direction) {
  if (save.dev.reverse !== runReversed) direction = { left: "right", right: "left", up: "down", down: "up" }[direction] || direction;
  const vectors = {
    left: [-cell, 0],
    up: [0, -cell],
    right: [cell, 0],
    down: [0, cell]
  };
  const v = vectors[direction];
  if (v) setDirection(v[0], v[1]);
}
