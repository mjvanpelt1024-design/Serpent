/* =========================================================
   src/campaign/camp-run.js
   Playing a campaign level on the existing engine.

   A level is played as the "campaign" mode: its rules are built from the
   level's entry in content/campaign/islands/*.json, then the engine's
   ordinary startGame() runs it. The hooks at the bottom of this file add
   the campaign's parts (goals, the boss, items, rewards) and switch off
   the old game's parts (XP, story, badges) while a campaign level runs.
   Every hook does nothing at all when no campaign level is running.
   ========================================================= */
"use strict";

let campRun = null;

/* How many hearts a level starts with. You start the game with none (one hit ends a run);
   Stout Heart on the first island's tree adds them. */
function campHearts(mods, rune) {
  if (mods.includes("glass")) return 0;
  let h = CAMP.rules.snake.hearts + upVal("hearts");
  if (rune && rune.id === "fortune") h -= 1;
  return Math.max(0, h);
}

/* ----- Hearts and armor -----
   Hearts come in halves. Armor plates come only from upgrades, and each has four pieces
   (rules.snake.armorPieces): every half heart of damage knocks one off, so a plate goes
   dented, cracked, half gone, gone, and what's left of a big hit carries on to the next
   plate. Breakers (rules.damage.crush) knock off two pieces per half heart; piercing hits
   (rules.damage.pierce) go straight through to the hearts. Armor works with no hearts at all.
   A heart canister's purple hearts and armor are spent before your own, and never refill. */
const ARMOR_PIECES = () => CAMP.rules.snake.armorPieces || 4;
function campArmorStart(mods) {
  if (mods.includes("glass")) return 0;
  return Math.min(CAMP.rules.snake.armorCap + upVal("armorcap"), upVal("plating")) * ARMOR_PIECES();
}
/* The engine still counts whole plates for its own odds and ends */
function campSyncArmor() {
  currentArmor = Math.ceil(campRun.armor / ARMOR_PIECES());
  lastHeartsKey = "";
}
/* The canister you carry into this level, if it still holds anything */
function campVessel() {
  if (!campRun || campBare() || campRun.mods.includes("glass")) return null;
  const it = campEquipped("canister");
  return it && it.uses > 0 ? it : null;
}

/* A hit of `hearts` (in hearts, halves allowed) from `cause`. True if the snake died. */
function campDamage(hearts, cause) {
  const D = CAMP.rules.damage || {};
  const pierce = (D.pierce || []).includes(cause), crush = (D.crush || []).includes(cause);
  let halves = hearts === Infinity ? Infinity : Math.max(1, Math.round(hearts * 2));
  const v = campVessel(), vArmor = v && vesselHoldsArmor(v);
  const armorBefore = campRun.armor, heartsBefore = currentHearts;
  let lost = [];
  // armor soaks a hit in pieces: one per half heart, two for a breaker; what's left carries on
  const soak = have => {
    if (pierce || halves === Infinity || halves <= 0 || have <= 0) return 0;
    let pcs = halves * (crush ? 2 : 1);
    const t = Math.min(pcs, have);
    pcs -= t;
    halves = Math.ceil(pcs / (crush ? 2 : 1));
    return t;
  };
  // the canister's purple pieces go first, then your armor, then your hearts
  if (v && vArmor) { const t = soak(v.uses); v.uses -= t; if (t) lost.push("purple armor"); }
  if (v && !vArmor && halves > 0 && v.uses > 0) {
    const t = Math.min(halves === Infinity ? v.uses : halves, v.uses);
    v.uses -= t;
    if (halves !== Infinity) halves -= t;
    lost.push("purple heart");
    campRun.lostHeart = true;
  }
  campRun.armor -= soak(campRun.armor);
  if (v && v.uses <= 0) {
    campDrop(v.uid);
    showToast("The Heart Canister is empty. It crumbles to dust.");
    sfx("bad");
  }
  if (v) saveCamp();
  campSyncArmor();
  noteHurt();
  if (halves > 0) {
    const own = Math.round(currentHearts * 2);
    if (halves === Infinity || halves > own) {
      // the engine lets you live on zero hearts; the hit after that is the one that kills
      currentHearts = 0;
      if (campTryRevive(cause)) return false;
      endGame(cause);
      return true;
    }
    currentHearts = (own - halves) / 2;
    if (currentHearts < heartsBefore) campRun.lostHeart = true;
  }
  if (lost.includes("purple armor") && campRun.armor === armorBefore) { showToast(v.uses > 0 ? "Your purple armor took the hit." : "Your last purple plate shattered."); sfx("rock"); }
  else if (campRun.armor < armorBefore) {
    runCount("armorUsed");
    const P = ARMOR_PIECES(), stage = campRun.armor % P;
    showToast(campRun.armor <= 0 ? "Your last armor plate broke." : stage === 0 ? "An armor plate broke." : ["", "Your armor is down to half a plate.", "Your armor cracked.", "Your armor took a dent."][Math.round(stage * 4 / P)] || "Your armor took the hit.");
    sfx("rock");
  } else if (lost.includes("purple heart") && currentHearts === heartsBefore && v.uses > 0) showToast(`A purple heart took the hit. ${fmtHalf(v.uses / 2)} left.`);
  else if (!lost.length && halves === 0) sfx("rock");
  if (currentHearts < heartsBefore || lost.includes("purple heart")) sfx("heart");
  buzz(45);
  updateHud();
  return false;
}
const vesselHoldsArmor = it => { const d = campItemDef(it.id); return !!(d && d.armor && d.armor[rarityIdx(it.rarity)] > 0); };

/* From the map or a challenge: choose what to carry, then play */
function campBeginLevel(isl, n, challengeIdx = -1) {
  if (typeof openCampKit === "function" && openCampKit(isl, n, challengeIdx)) return;
  campStart(isl, n, challengeIdx);
}

function campStart(isl, n, challengeIdx = -1) {
  const def = campLevelDef(isl, n);
  if (!def || !campLevelOpen(isl, n)) return;
  const C = camp.challenges[isl];
  const mods = challengeIdx >= 0 && C && C.active ? (C.mods[challengeIdx] || []).slice() : [];

  // a rune burns up as the level starts (Runecraft might save it)
  let rune = null;
  const rIt = campEquipped("rune");
  if (rIt && !mods.includes("bare")) {
    rune = { id: rIt.id, rarity: rIt.rarity, power: campItemPower(rIt) };
    if (!roll(upVal("runecraft"))) {
      rIt.qty--;
      if (rIt.qty <= 0) campDrop(rIt.uid);
    } else showToast("Runecraft! The rune survived.");
  }

  const spawns = JSON.parse(JSON.stringify(def.spawns || {}));
  if (mods.includes("swarm")) Object.values(spawns).forEach(s => {
    if (s.max) s.max *= 2;
    if (s.count) s.count *= 2;
    if (s.rate) s.rate *= 2;
    if (s.delay) s.delay = s.delay.map(d => Math.round(d * 0.6));
  });
  if (mods.includes("rocky")) {
    if (def.edge === "endless") spawns.rock = Object.assign({ rate: 0 }, spawns.rock || {}, { rate: ((spawns.rock || {}).rate || 0) + 0.06 });
    else spawns.rock = Object.assign({}, spawns.rock || {}, { count: ((spawns.rock || {}).count || 0) + 10 });
  }
  if (upVal("golden") > 0 && def.edge !== "endless") spawns.golden = spawns.golden || { max: 1, delay: [upVal("golden") * 800, upVal("golden") * 1200] };
  if (rune && rune.id === "plenty") Object.values(spawns).forEach(s => { if (s.delay) s.delay = s.delay.map(d => Math.round(d * 0.8)); });
  MODE_ITEMS.campaign = spawns;

  let mult = 1 + upPct("scoremult");
  if (rune && rune.id === "plenty") mult *= 1 + rune.power / 100;
  if (rune && rune.id === "stillness") mult *= 0.85;
  let speed = def.speed * (mods.includes("swift") ? 1.2 : 1) * (1 - upPct("calm"));
  if (rune && rune.id === "stillness") speed *= 1 - rune.power / 100;
  const apples = 1 + upVal("orchard") + (rune && rune.id === "plenty" ? (rune.rarity === "legendary" ? 2 : 1) : 0);
  const edge = { tunnel: "endless", maze: "maze", field: "maze" }[def.layout] || def.edge;
  const island = CAMP.islandById[isl];
  modes.campaign = { label: def.name, speed, edge, multiplier: mult, startOrbs: 0, orbChance: 0, apples, hunter: !!def.hunter, rules: "" };

  campRun = {
    isl, islandN: island.n, n, def, mods, challenge: challengeIdx, rune,
    apples: 0, lostHeart: false, loot: [], canisters: [], lootAt: performance.now() + 6000,
    castReadyAt: 0, fieldUntil: 0, pet: null, gearFx: 0, blinkFx: 0,
    secondWind: upVal("secondwind") > 0, echoReady: !!(rune && rune.id === "echo"), echoUsed: false,
    over: false, speed, prevBest: (camp.levels[campLevelId(isl, n)] || { best: 0 }).best
  };
  campShots = [];
  boss = null;
  pulse = null;
  campObjs = [];
  currentModeKey = "campaign";
  currentNightmare = false;
  pendingBoosts = {};
  camp.at = isl;
  document.body.classList.add("camp-run");
  startGame();

  currentHearts = campHearts(mods, rune);
  campRun.startHearts = currentHearts;
  campRun.armor = campRun.armorMax = campArmorStart(mods);
  campSyncArmor();
  goldHearts = 0;
  if (def.dark || mods.includes("dark")) nm.dark = true;
  campSetupGoal(def, mods);
  if (def.goal.type === "boss") spawnBoss(def, def.goal.fight);
  campPetSetup();
  if (rune) showToast(`${campItemName(rune)} burns bright.`);
  saveCamp();
  campHudBuild();
  lastHeartsKey = "";
  updateHud();
  campCountdown();
}

/* Every level opens on the board with the old 3, 2, 1 countdown, and says what it wants */
function campCountdown() {
  paused = true;
  pauseStartedAt = performance.now();
  reviveCountdown = 3;
  showCountdown();
  const d = campRun.def;
  setTimeout(() => { if (campRun && campRun.def === d) showToast(`${d.n}. ${d.name}: ${goalText(campGoal)}`); }, 120);
}

/* Pausing stops every campaign clock too */
function campShiftTimers(d) {
  if (boss) ["moveAt", "frozenUntil", "stunnedUntil", "retreatUntil", "hitCdUntil", "exhaustedUntil", "exhaustStart", "nextCharge", "chargeUntil"].forEach(k => { if (boss[k]) boss[k] += d; });
  ["lootAt", "castReadyAt", "fieldUntil", "magnetDouble", "gearFx", "blinkFx"].forEach(k => { if (campRun[k]) campRun[k] += d; });
  if (campRun.pet) ["nextAt", "readyAt", "bossCd", "fx"].forEach(k => { if (campRun.pet[k]) campRun.pet[k] += d; });
  if (pulse) pulse.next += d;
  campObjs.forEach(o => ["moveAt", "hopAt", "until"].forEach(k => { if (o[k]) o[k] += d; }));
  campShots.forEach(s => { s.born += d; });
}

function campRestart() {
  if (!campLast) return;
  const { isl, n, challenge } = campLast;
  if (challenge >= 0 && !(camp.challenges[isl] && camp.challenges[isl].active)) campStart(isl, n);
  else campStart(isl, n, challenge);
}
let campLast = null;

/* ----- Winning and losing ----- */
/* What a win pays before the run's own bonuses: shown on the rules card */
function campRewardPreview(isl, n, first) {
  const R = CAMP.rules.rewards;
  const def = campLevelDef(isl, n);
  let r = (R.winBase + R.perLevel * def.n) * (def.kind === "boss" ? R.bossMult : 1);
  if (!first) r *= R.replayShare;
  return Math.max(1, Math.round(r * (1 + upPct("bounty")) * (1 + upPct("mastery"))));
}

/* Every run's points turn into this island's money, won or lost */
function campPointsPay() {
  const per = CAMP.rules.rewards.pointsPerCoin || 50;
  return Math.max(0, Math.floor(Math.max(0, score) / per * (1 + upPct("mastery"))));
}
function campPayPoints(lines) {
  const pts = campPointsPay();
  if (pts > 0) {
    campPay(campRun.isl, pts);
    lines.push(`+${campMoney(campRun.isl, pts)} from ${fmtInt(score)} points`);
  }
  return pts;
}

function campReward(first) {
  const R = CAMP.rules.rewards;
  const def = campRun.def;
  let r = (R.winBase + R.perLevel * def.n) * (def.kind === "boss" ? R.bossMult : 1);
  if (!first) r *= R.replayShare;
  if (!campRun.lostHeart) r *= 1 + R.flawlessBonus;
  r *= (1 + upPct("bounty")) * (1 + upPct("mastery"));
  const pet = campEquipped("pet");
  if (pet && pet.id === "seahorse" && !campBare()) r *= 1 + campItemPower(pet) / 100;
  if (campRun.rune && campRun.rune.id === "fortune") r *= 1 + campRun.rune.power / 100;
  if (campRun.echoUsed) r *= 1 - campRun.rune.power / 100;
  return Math.max(1, Math.round(r));
}

/* Trinkets and heart canisters picked up on the board go into the satchel */
function campGiveFinds(lines, verb) {
  const cans = campRun.canisters || [];
  campRun.loot.forEach(id => campGive(id));
  cans.forEach(r => campGive("canister", r));
  const names = campRun.loot.map(id => CAMP.lootById[id].name).concat(cans.map(r => `${rarityName(r)} Heart Canister`));
  if (names.length) lines.push(`${verb}: ${names.join(", ")}`);
  campRun.loot = [];
  campRun.canisters = [];
}

function campStopBoard() {
  frozenAt = performance.now();
  paused = false;
  closeIntroCard();
  campRun.over = true;
}

function campWinLevel() {
  if (!campRun || campRun.over || gameState !== "PLAYING") return;
  campStopBoard();
  const { isl, n, def } = campRun;
  const key = campLevelId(isl, n);
  const first = !campWon(isl, n);
  const rec = camp.levels[key] || { wins: 0, best: 0, flawless: false };
  rec.wins++;
  rec.best = Math.max(rec.best, score);
  if (!campRun.lostHeart) rec.flawless = true;
  camp.levels[key] = rec;
  const pay = campReward(first);
  campPay(isl, pay);
  const lines = [`+${campMoney(isl, pay)} for the win${first ? " (first win)" : ""}`];
  campPayPoints(lines);
  campBump("levelsWon");
  if (!campRun.lostHeart) { campBump("flawless"); lines.push("Flawless: not a heart lost"); }
  if (def.kind === "boss") { campBump("bossFights"); if (def.goal.fight === 3) campBump("bossesSlain"); }
  if (endless) campBump("distance", endlessDistance());
  // trinkets found on the way, and the odd lucky extra
  const pet = campEquipped("pet");
  if ((pet && pet.id === "seahorse" && pet.rarity === "legendary" && !campBare()) || (campRun.rune && campRun.rune.id === "fortune" && campRun.rune.rarity === "legendary")) {
    const pool = CAMP.loot.filter(l => l.island === campRun.islandN);
    if (pool.length) campRun.loot.push(pool[Math.floor(Math.random() * pool.length)].id);
  }
  campGiveFinds(lines, "Found");
  if (roll(upVal("gemfinder"))) { addGems(1); lines.push("+1 gem (Gem Finder)"); }
  // the challenge
  const C = camp.challenges[isl];
  if (campRun.challenge >= 0 && C && C.active) {
    C.done[campRun.challenge] = true;
    lines.push(C.done.every(Boolean) ? "Challenge complete! Claim your reward from the challenger." : `Challenge trial ${C.done.filter(Boolean).length} of 3 done`);
  }
  // what just opened
  const notes = [];
  if (first) {
    if (n < LEVEL_COUNT) notes.push(`Level ${n + 1} is open: ${campLevelDef(isl, n + 1).name}`);
    const isle = CAMP.islandById[isl];
    if (n === SHOP_AFTER.merchant) notes.push(`${isle.npcs.merchant.name} opened ${isle.npcs.merchant.shop}`);
    if (n === SHOP_AFTER.challenger) notes.push(`${isle.npcs.challenger.name} has challenges for you`);
    if (n === LEVEL_COUNT) {
      notes.push(`${isle.npcs.banker.name}'s bank is open`);
      const next = CAMP.islands[campIslandIdx(isl) + 1];
      if (next) notes.push(`The bridge to ${next.name} is open!`);
      else notes.push("You have conquered every island. The Coil bows to you.");
    }
  }
  campLast = { isl, n, challenge: campRun.challenge };
  campCheckAch();
  saveCamp();
  sfx("medal");
  if (save.settings.confetti) confetti();
  showCampResult(true, lines, notes);
}

function campFail(cause) {
  campStopBoard();
  campBump("deaths");
  // points still pay, and trinkets and canisters are kept even when you lose
  const lines = [];
  const pts = campPayPoints(lines);
  campGiveFinds(lines, "Kept");
  campLast = { isl: campRun.isl, n: campRun.n, challenge: campRun.challenge };
  saveCamp();
  if (cause === "quit") {
    if (pts > 0) showToast(`Your ${fmtInt(score)} points paid ${campMoney(campRun.isl, pts)}.`);
    campLeaveRun(); openScreen("modes"); return;
  }
  sfx("death");
  buzz([90, 50, 190]);
  const line = causeLine(cause) || getCommentary(cause);
  showCampResult(false, lines, [], line);
  const shakeClass = { subtle: "shake-subtle", normal: "shake", quake: "shake-quake" }[save.settings.shake];
  stageEl.classList.remove("shake", "shake-subtle", "shake-quake");
  if (shakeClass) { void stageEl.offsetWidth; stageEl.classList.add(shakeClass); }
}

/* Back to the menus: the engine forgets the level */
function campLeaveRun() {
  campRun = null;
  boss = null;
  pulse = null;
  campObjs = [];
  campShots = [];
  nm = {};
  document.body.classList.remove("camp-run");
  campHudHide();
  currentModeKey = MODE_KEYS[0];
  updateHud();
}

/* Snacks and revives: a killing blow, caught. Returns true if the snake lives on. */
function campTryRevive(cause) {
  const ts = performance.now();
  const back = hearts => {
    currentHearts = Math.max(currentHearts, hearts);
    graceUntil = ts + 1800;
    lastHeartsKey = "";
    if (["wall", "behind"].includes(cause)) deflectSnake();
    if (cause === "behind" && endless) endless.camera = Math.max(0, snake.x - ENDLESS.startCol * cell);
    sfx("revive");
    updateHud();
    return true;
  };
  if (campRun.secondWind) { campRun.secondWind = false; showToast("Second Wind! Not today."); return back(upVal("secondwind")); }
  const tart = campBare() ? null : campEquipped("food");
  if (tart && tart.id === "tart" && tart.uses > 0) { useFood(tart, "Phoenix Tart! You rise from the crumbs."); return back(campItemPower(tart)); }
  if (campRun.echoReady) {
    campRun.echoReady = false; campRun.echoUsed = true;
    showToast("The Rune of Echoes calls you back!");
    return back(campRun.rune.rarity === "legendary" ? 2 : 1);
  }
  return false;
}

/* ----- The hooks ----- */
(() => {
  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== "function") { console.warn("campaign hook: no " + name); return; }
    window[name] = fn(orig);
  };

  wrap("resumeFromPause", orig => function () {
    if (campRun && paused) campShiftTimers(performance.now() - pauseStartedAt);
    return orig.apply(this, arguments);
  });
  wrap("isModeUnlocked", orig => k => k === "campaign" || orig(k));
  wrap("featureOn", orig => name => (campRun ? false : orig(name)));
  wrap("buildInnerWalls", orig => function () { if (campRun) { campBuildStatic(campRun.def); return; } return orig.apply(this, arguments); });
  wrap("buildMaze", orig => function () {
    if (campRun && campRun.def.layout === "field") return campBuildField(`${campRun.isl}-${campRun.n}`);
    return orig.apply(this, arguments);
  });
  wrap("applyLevel", orig => function () {
    if (campRun) { baseInterval = moveInterval; endlessCfg.levelSpeed = campRun.speed / ENDLESS.startSpeed; return; }
    return orig.apply(this, arguments);
  });

  /* The old upgrades don't apply in the campaign: every track is at its base value,
     except the few the engine reads that the campaign has its own version of */
  wrap("getTrackValue", orig => key => {
    if (!campRun) return orig(key);
    if (!upgradeTracks[key]) return 0;
    const base = trackValueAt(key, 0);
    if (key === "time") return base * (1 + upPct("passive"));
    if (key === "nightlight") return campEquippedId("pet") === "firefly" ? 2.5 : 0;
    if (key === "hearts") return campRun.startHearts || CAMP.rules.snake.hearts;
    if (key === "retardant" || key === "syrup") return upVal("shorten");
    return base;
  });

  ["checkIntros", "tickChatter", "tickShimmers", "tickRelic", "checkBadges", "checkContract"].forEach(name =>
    wrap(name, orig => function () { if (campRun) return; return orig.apply(this, arguments); }));
  wrap("drawMechanicsHud", orig => function () { if (campRun) return; return orig.apply(this, arguments); });

  wrap("occupiedSet", orig => function (opts) {
    const set = orig.call(this, opts);
    if (campRun) {
      if (boss && !boss.beaten) boss.cells.forEach(c => set.add(cellKey(c.x, c.y)));
      campObjs.forEach(o => set.add(cellKey(o.x, o.y)));
    }
    return set;
  });

  wrap("endGame", orig => function (cause) {
    if (!campRun) return orig.apply(this, arguments);
    if (gameState !== "PLAYING" || campRun.over) return;
    if (cause !== "quit" && campTryRevive(cause)) return;
    campFail(cause);
  });

  wrap("takeHit", orig => function (hearts, cause, opts) {
    if (!campRun) return orig.apply(this, arguments);
    if (save.dev.invincible) return false;
    if (campGuardHit(cause)) return false;
    if (guardHit()) return false;                 // the Rampage Star, or a bubble shield
    if (campRun.rune && campRun.rune.id === "fury" && hearts !== Infinity) hearts *= 2;
    const armorBefore = campRun.armor, before = currentHearts;
    if (campDamage(hearts, cause)) return true;
    // snacks that fire after the fact
    const food = campBare() ? null : campEquipped("food");
    if (food && food.uses > 0) {
      if (food.id === "stew" && currentHearts < 1 && currentHearts < before) {
        currentHearts = Math.min(Math.max(campRun.startHearts, 1), currentHearts + campItemPower(food));
        useFood(food, "Hearty Stew! You feel better already.");
        lastHeartsKey = "";
        updateHud();
      } else if (food.id === "bread" && armorBefore > 0 && campRun.armor === 0) {
        const n = campItemPower(food) * ARMOR_PIECES();
        useFood(food, "Honey Bread! Your armor is growing back.");
        setTimeout(() => { if (campRun && gameState === "PLAYING") { campRun.armor = Math.min(campRun.armor + n, campRun.armorMax); campSyncArmor(); updateHud(); } }, 1500);
      }
    }
    return false;
  });
  // armor only comes from upgrades in the campaign: a stray armor pickup pays points instead
  wrap("addArmor", orig => function () {
    if (!campRun) return orig.apply(this, arguments);
    addScore(30 * scoreMultiplier);
  });

  wrap("guardCrash", orig => function (cause) {
    if (!campRun) return orig.apply(this, arguments);
    const ts = performance.now();
    if (cause === "wall") {
      if (campEquippedId("gear") === "helm") {
        campUseGear("helm", campEquippedRarity("gear") === "legendary" && roll(50));
        deflectSnake();
        graceUntil = Math.max(graceUntil, ts + 400);
        showToast("Bonk! The Bulwark Helm bounced you off.");
        sfx("rock");
        return true;
      }
      if (fieldOn(ts)) {
        if (campRun.fieldBounce) { campRun.fieldBounce = false; campRun.fieldUntil = 0; deflectSnake(); graceUntil = Math.max(graceUntil, ts + 400); sfx("pop"); return true; }
        campRun.fieldUntil = 0;
        sfx("pop");
        showToast("Walls pop force fields.");
      }
    }
    if (cause === "self" && campEquippedId("gear") === "thorns") {
      campUseGear("thorns");
      graceUntil = Math.max(graceUntil, ts + 300);
      return true;
    }
    return orig.apply(this, arguments);
  });

  /* Gear against what the head runs into */
  wrap("hitRock", orig => function (rock) {
    if (!campRun) return orig.apply(this, arguments);
    const r = campGearMeets("rock");
    if (r === "shove") { shoveAside(rock); rocks.push(rock); return; }
    if (r === "kill") return;
    if (roll(upVal("hazardward"))) { showToast("Hazard Ward!"); return; }
    return orig.apply(this, arguments);
  });
  wrap("hitPopsicle", orig => function (p) {
    if (!campRun) return orig.apply(this, arguments);
    const r = campGearMeets("popsicle");
    if (r === "shove") { shoveAside(p); popsicles.push(p); return false; }
    if (r === "kill") return false;
    return orig.apply(this, arguments);
  });
  wrap("hitHazard", orig => function (h, ts) {
    if (!campRun) return orig.apply(this, arguments);
    if (h.type === "flea" || h.type === "fire") {
      const r = campGearMeets(h.type);
      if (r === "shove") { shoveAside(h); hazards.push(h); return false; }
      if (r === "kill") return false;
      if (h.type === "fire" && campGuardHit("fire")) return false;
    }
    return orig.apply(this, arguments);
  });
  wrap("touchEntities", orig => function (nx, ny, ts, grace) {
    if (campRun) {
      entities.filter(e => !ENTITY_TYPES[e.type].global && covers(e, nx, ny) && ["wasp", "ghost", "bramble", "spikes"].includes(e.type)).forEach(e => {
        if (e.type === "spikes" && !spikesUp()) return;
        if (e.type === "ghost" && phantomOn()) return;
        const r = campGearMeets(e.type);
        if (r === "kill") removeEntity(e);
        else if (r === "shove" && !shoveAside(e)) removeEntity(e);
      });
    }
    return orig.apply(this, arguments);
  });
  wrap("hunterTouchedBy", orig => function (nx, ny) {
    if (!campRun || !hunter || !hunter.alive || !hunter.cells.some(c => c.x === nx && c.y === ny)) return orig.apply(this, arguments);
    const gear = campEquippedId("gear");
    if (gear === "sword" && campUseGear("sword")) { beatHunter(); return false; }
    if (gear === "shield" && campUseGear("shield")) { stunHunter("body"); return false; }
    if (campGuardHit("hunter")) { hunterRetreat(); return false; }
    return orig.apply(this, arguments);
  });

  wrap("eatApple", orig => function (size, small) {
    if (!campRun) return orig.apply(this, arguments);
    const before = score;
    orig.apply(this, arguments);
    let extra = upPct("applevalue");
    if (campRun.magnetDouble && performance.now() < campRun.magnetDouble) extra += 1;
    if (extra > 0) score += Math.round((score - before) * extra);
    campRun.apples++;
    campBump("applesEaten");
  });

  wrap("stepSnake", orig => function (ts) {
    orig.apply(this, arguments);
    if (!campRun || gameState !== "PLAYING" || campRun.over) return;
    const t = ts || performance.now();
    if (touchCampObjs(snake.x, snake.y)) { campWinLevel(); return; }
    if (bossTouchedBy(snake.x, snake.y, t)) return;
    if (gameState === "PLAYING" && goalMet()) campWinLevel();
  });

  wrap("tickMechanics", orig => function (ts, delta) {
    orig.apply(this, arguments);
    if (!campRun || gameState !== "PLAYING" || campRun.over) return;
    tickCampLevel(ts, delta);
    tickBoss(ts, delta);
    tickShots(ts, delta);
    tickPet(ts);
    maybeLoot(ts);
    if (campRun.mods.includes("clock") && runMs > 90000) { campFail("hunger"); return; }
    if (gameState === "PLAYING" && !campRun.over && goalMet()) campWinLevel();
    campHudTick(ts);
  });

  wrap("drawHunter", orig => function (view, ts) {
    orig.apply(this, arguments);
    if (!campRun) return;
    drawCampObjs(view, ts);
    drawBoss(view, ts);
    drawCampEffects(view, ts);
  });

  // the familiar is drawn after the snake, so it's never hidden under the body
  wrap("drawBuffAura", orig => function (hx, hy, ts) {
    orig.apply(this, arguments);
    if (campRun) drawPet(makeView(ts), ts);
  });

})();
