/* =========================================================
   src/game/flow/mechanics.js
   The run mechanics added in build 46: armor, Fever, the power-up
   buffs, Shed Skin, Bounty Contracts and the meters that show them.
   Each mechanic starts on the island that introduces it and stays on
   every island after it.
   ========================================================= */
"use strict";

let buffs = {};           // shield, shieldUntil, freezeUntil, starUntil, phantomUntil, lodeUntil, frenzyUntil
let currentArmor = 0;
const MAX_ARMOR = 5;
let fever = { meter: 0, until: 0 };
let husks = [];           // shed skins: { cells: [{x, y}], expiresAt }
let shedReadyAt = 0;
let contract = null;
let runCounts = {};

/* Which island introduces each mechanic */
const FEATURE_FROM = { fever: "sunflower", armor: "hive", shed: "hunt", contracts: "clockwork" };

function featureOn(name) {
  if (tutorial || currentModeKey === "custom" || currentModeKey === "tutorial") return false;
  const from = FEATURE_FROM[name];
  if (!from || !MODE_KEYS.includes(from) || !MODE_KEYS.includes(currentModeKey)) return false;
  return islandIndex(currentModeKey) >= islandIndex(from) && isModeUnlocked(from);
}

const starOn = (ts = performance.now()) => ts < (buffs.starUntil || 0);
const phantomOn = (ts = performance.now()) => ts < (buffs.phantomUntil || 0);
const frenzyOn = (ts = performance.now()) => ts < (buffs.frenzyUntil || 0);
const feverOn = (ts = performance.now()) => ts < fever.until;
const lodeOn = (ts = performance.now()) => ts < (buffs.lodeUntil || 0);
const shieldOn = (ts = performance.now()) => !!buffs.shield && ts < (buffs.shieldUntil || 0);

function runCount(name, n = 1) { runCounts[name] = (runCounts[name] || 0) + n; }

/* ----- A new run ----- */
function resetMechanics() {
  buffs = {};
  entities = [];
  husks = [];
  runCounts = { lastHurt: 0 };
  fever = { meter: 0, until: 0 };
  currentArmor = 0;
  if (featureOn("armor")) currentArmor = Math.min(MAX_ARMOR, Math.floor(getTrackValue("scalearmor")) + (runBoosts.polish ? 2 : 0));
  if (featureOn("fever") && runBoosts.feverdream) fever.meter = 0.999;
  shedReadyAt = performance.now() + 3000;
  contract = featureOn("contracts") ? pickContract() : null;
  resetHunter();
  resetEchoes();
}

/* ----- Armor ----- */
function addArmor(n) {
  if (currentArmor >= MAX_ARMOR) { addScore(30 * scoreMultiplier); showToast("Armor is full. Points instead."); return; }
  currentArmor = Math.min(MAX_ARMOR, currentArmor + n);
  lastHeartsKey = "";
  updateHud();
  showToast("Armor plate! It will take one hit for you.");
}

/* Called from takeHit: a plate takes any hit of hazard damage, even a mega pop */
function armorAbsorb() {
  if (currentArmor <= 0) return false;
  currentArmor--;
  lastHeartsKey = "";
  sfx("rock");
  buzz(30);
  showToast(currentArmor ? `Armor took the hit. ${currentArmor} plate${currentArmor === 1 ? "" : "s"} left.` : "Your last armor plate broke.");
  runCount("armorUsed");
  updateHud();
  return true;
}

/* Before any damage: the Rampage Star ignores it, a bubble pops instead */
function guardHit() {
  if (starOn()) return true;
  if (shieldOn()) { popShield(); return true; }
  return false;
}

function popShield() {
  buffs.shield = false;
  sfx("bad");
  showToast("Your bubble popped. That was the one hit it could take.");
}

/* Walls, your own tail, pits: only a bubble shield saves you, and the snake turns aside */
function guardCrash(cause) {
  if (!shieldOn()) return false;
  popShield();
  deflectSnake();
  graceUntil = Math.max(graceUntil, performance.now() + 400);
  return true;
}

function deflectSnake() {
  const free = (dx, dy) => {
    let x = snake.x + dx, y = snake.y + dy;
    if (edgeMode !== "wall") { x = ((x % boardSize) + boardSize) % boardSize; y = ((y % boardSize) + boardSize) % boardSize; }
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return false;
    if (walls.has(cellKey(x, y))) return false;
    return !snake.cells.some((c, i) => i > 0 && c.x === x && c.y === y);
  };
  const turns = [[snake.dy, snake.dx], [-snake.dy, -snake.dx]].sort(() => Math.random() - 0.5);
  const pick = turns.find(([dx, dy]) => free(dx, dy));
  if (pick) { snake.dx = pick[0]; snake.dy = pick[1]; }
  turnQueue = [];
}

/* Any time damage actually lands */
function noteHurt() {
  runCounts.lastHurt = runMs;
  runCount("hurt");
}

/* ----- Fever ----- */
const FEVER_MS = 8000;
function addFever(amount) {
  if (!featureOn("fever") || feverOn()) return;
  fever.meter += amount * (1 + getTrackValue("feverpitch") / 100);
  if (fever.meter >= 1) {
    fever.meter = 0;
    fever.until = performance.now() + FEVER_MS * (1 + getTrackValue("feverpitch") / 100);
    runCount("fevers");
    save.stats.fevers = (save.stats.fevers || 0) + 1;
    showToast("FEVER! Triple points, and small hazards burst when you touch them.");
    sfx("bigxp");
  }
}

/* Extra score from Fever and the Frenzy Clock */
function buffScoreMult() {
  let m = 1;
  if (gameState !== "PLAYING") return m;
  if (feverOn()) m *= 3;
  if (frenzyOn()) m *= 2;
  return m;
}

/* ----- Shed Skin ----- */
const SHED_CD = 20000;
const HUSK_MS = 10000;
const shedCooldown = () => SHED_CD * (1 - getTrackValue("molting") / 100);
const canShed = () => featureOn("shed") && gameState === "PLAYING" && !paused && snake.cells.length >= 6 && performance.now() >= shedReadyAt && !endless;

function shedSkin() {
  if (!canShed()) {
    if (featureOn("shed") && gameState === "PLAYING" && !paused) sfx("bad");
    return;
  }
  const keep = Math.max(3, Math.ceil(snake.cells.length / 2));
  const shed = snake.cells.slice(keep).map(c => ({ x: c.x, y: c.y }));
  snake.cells.length = keep;
  snake.maxCells = keep;
  husks.push({ cells: shed, expiresAt: performance.now() + HUSK_MS });
  shedReadyAt = performance.now() + shedCooldown();
  runCount("sheds");
  save.stats.sheds = (save.stats.sheds || 0) + 1;
  sfx("molasses");
}

/* Old skins crumble into XP crumbs */
function tickHusks(ts) {
  husks = husks.filter(h => {
    if (ts < h.expiresAt) return true;
    const crumbs = Math.min(6, Math.max(1, Math.floor(h.cells.length / 3)));
    const set = occupiedSet();
    h.cells.forEach(c => set.delete(cellKey(c.x, c.y)));      // the husk's own squares are where the crumbs go
    snake.cells.forEach(c => set.add(cellKey(c.x, c.y)));
    h.cells.slice().sort(() => Math.random() - 0.5).slice(0, crumbs).forEach(c => {
      if (!set.has(cellKey(c.x, c.y))) orbs.push({ x: c.x, y: c.y, size: 1, small: true });
    });
    return false;
  });
}

/* ----- Lodestone ----- */
let lodeAcc = 0;
function tickLodestone(delta) {
  if (!lodeOn() || endless || maze) return;
  lodeAcc += delta;
  if (lodeAcc < 250) return;
  lodeAcc = 0;
  const set = occupiedSet();
  [apples, orbs].forEach(list => list.forEach(it => {
    if ((it.size || 1) > 1 || !nearHead(it, 6)) return;
    const dx = stepToward(it.x, snake.x), dy = stepToward(it.y, snake.y);
    const [mx, my] = Math.abs(it.x - snake.x) >= Math.abs(it.y - snake.y) ? [dx, 0] : [0, dy];
    const x = it.x + mx, y = it.y + my;
    if (!inBoard(x, y) || (set.has(cellKey(x, y)) && !(x === snake.x && y === snake.y))) return;
    if (bodyHas(x, y) && !(x === snake.x && y === snake.y)) return;
    set.delete(cellKey(it.x, it.y));
    it.x = x; it.y = y;
    set.add(cellKey(x, y));
  }));
}

/* ----- Rotten apples (islands with a rot rule) ----- */
function tickRot(ts) {
  const rot = nm.rot || (modes[currentModeKey] && modes[currentModeKey].rot);
  if (!rot) return;
  const ms = rot * (1 + (getTrackValue("preserve") + (currentNightmare ? getTrackValue("nm_sunflower") : 0)) / 100);
  let rotted = false;
  apples.forEach(a => {
    if (!a.bornAt) a.bornAt = ts;
    if (!a.rotten && !a.fake && ts - a.bornAt > ms) { a.rotten = true; a.rotUntil = ts + 9000; rotted = true; }
  });
  apples = apples.filter(a => !a.rotten || ts < a.rotUntil);
  if (rotted) maintainApples();
}

function eatRotten(a) {
  sfx("bad");
  loseScore(0.15);
  if (!endless) {
    snake.maxCells = Math.max(2, snake.maxCells - 3);
    while (snake.cells.length > snake.maxCells) snake.cells.pop();
  }
  runCount("rotten");
  showToast("Rotten! That apple had been waiting far too long.");
}

/* ----- Bounty Contracts ----- */
const CONTRACTS = [
  { id: "apples", text: n => `Eat ${n} apples`, n: () => 8 + 3 * currentLevel, have: () => runCounts.apples || 0 },
  { id: "orbs", text: n => `Collect ${n} XP orbs`, n: () => 5 + currentLevel, have: () => runCounts.orbs || 0 },
  { id: "unhurt", text: n => `Go ${n} seconds without getting hurt`, n: () => 40 + 10 * currentLevel, have: () => Math.floor((runMs - (runCounts.lastHurt || 0)) / 1000) },
  { id: "length", text: n => `Grow to ${n} long`, n: () => 18 + 4 * currentLevel, have: () => snake.cells.length, when: () => !endless },
  { id: "powers", text: n => `Use ${n} power-ups`, n: () => 3, have: () => runCounts.powers || 0, when: () => ENTITY_KEYS.some(k => isPower(k) && spec[k]) },
  { id: "golden", text: n => `Eat ${n} Golden Apples`, n: () => 2, have: () => runCounts.golden || 0, when: () => !!spec.golden },
  { id: "hunter", text: () => "Defeat the Hunter", n: () => 1, have: () => runCounts.hunter || 0, when: () => !!hunter },
  { id: "smash", text: n => `Smash ${n} hazards`, n: () => 5, have: () => runCounts.smashed || 0, when: () => featureOn("fever") || !!spec.star },
  { id: "sheds", text: n => `Shed your skin ${n} times`, n: () => 2, have: () => runCounts.sheds || 0, when: () => featureOn("shed") }
];

function pickContract() {
  const pool = CONTRACTS.filter(c => !c.when || c.when());
  const c = pool[getRandomInt(0, pool.length)];
  return { def: c, need: c.n(), done: false };
}

function checkContract() {
  if (!contract || contract.done) return;
  if (contract.def.have() < contract.need) return;
  contract.done = true;
  const boost = 1 + getTrackValue("bounty") / 100;
  const xp = grantXp(ECON.contracts.contractRuns * xpUnit() * LADDER.runXp * boost);
  const sb = Math.round(ECON.contracts.contractBucks * boost);
  save.snakebucks += sb;
  save.stats.contracts = (save.stats.contracts || 0) + 1;
  persist();
  sfx("medal");
  showToast(`Contract done: ${contract.def.text(contract.need)}! +${fmtInt(xp)} XP, +${sb} SB`);
  updateHud();
}

/* ----- The new islands' own upgrades -----
   Most declare an effect in their .upg file instead of needing code:
   applePoints and passivePoints multiply, orbChance adds a percent. */
function worldEffect(effect, mode = "mul") {
  const keys = TREES[currentModeKey];
  const start = mode === "mul" ? 1 : 0;
  if (!keys) return start;
  return keys.reduce((acc, k) => (upgradeTracks[k].effect === effect ? (mode === "mul" ? acc * getTrackValue(k) : acc + getTrackValue(k)) : acc), start);
}
const worldApplePoints = () => worldEffect("applePoints");
const worldTrunkPassive = () => worldEffect("passivePoints") * (onIce() ? 1 + getTrackValue("skater") / 100 : 1);
const worldOrbBonus = () => worldEffect("orbChance", "add");

/* Things that happen when you eat an apple on some islands */
function appleSideEffects() {
  // Swatter (the Hive): squash the nearest wasp
  if (roll(getTrackValue("swatter"))) {
    const w = entities.filter(e => e.type === "wasp").sort((a, b) => Math.hypot(a.x - snake.x, a.y - snake.y) - Math.hypot(b.x - snake.x, b.y - snake.y))[0];
    if (w) { removeEntity(w); showToast("Swatted!"); }
  }
  // Exorcist (the Haunted Moor): ghosts near you vanish
  if (roll(getTrackValue("exorcist"))) {
    const before = entities.length;
    entities = entities.filter(e => e.type !== "ghost" || !nearHead(e, 4));
    if (entities.length < before) showToast("Exorcised! The ghosts have gone quiet.");
  }
}

/* ----- Each frame ----- */
let mechSecond = 0;
function tickMechanics(ts, delta) {
  if (buffs.shield && ts >= (buffs.shieldUntil || 0)) buffs.shield = false;
  if (!feverOn(ts) && fever.meter > 0) fever.meter = Math.max(0, fever.meter - delta / 1000 * 0.035);
  tickEntities(ts, delta);
  tickHusks(ts);
  tickLodestone(delta);
  tickRot(ts);
  if (!frozenNow(ts)) tickHunter(ts);
  mechSecond += delta;
  if (mechSecond >= 500) { mechSecond = 0; checkContract(); }
}

/* ----- Drawing: husks, buffs on the snake, and the meters along the bottom of the board ----- */
function drawHusks(view, ts) {
  husks.forEach(h => {
    const left = h.expiresAt - ts;
    ctx.save();
    ctx.globalAlpha = left < 1500 ? 0.3 + 0.4 * (left / 1500) : 0.75;
    h.cells.forEach(c => {
      const [x, y] = view.toScreen(c.x, c.y);
      ctx.fillStyle = "#d8c8a0";
      ctx.fillRect(x + 1, y + 1, cell - 3, cell - 3);
      ctx.fillStyle = "rgba(120,100,60,0.6)";
      ctx.fillRect(x + cell * 0.25, y + cell * 0.25, cell * 0.2, cell * 0.2);
      ctx.fillRect(x + cell * 0.55, y + cell * 0.55, cell * 0.2, cell * 0.2);
    });
    ctx.restore();
  });
}

/* Glows around the head for the active buffs */
function drawBuffAura(headX, headY, ts) {
  const cx = headX + cell / 2, cy = headY + cell / 2;
  const ring = (color, r, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); };
  ctx.save();
  if (shieldOn(ts)) ring("rgba(127,227,255,0.85)", cell * 0.95, 2);
  if (starOn(ts)) ring(`hsl(${(ts / 4) % 360},95%,65%)`, cell * 0.8, 3);
  if (feverOn(ts)) { ctx.shadowColor = "#ff8c1a"; ctx.shadowBlur = cell; ring("rgba(255,140,26,0.8)", cell * 0.7, 2); }
  if (lodeOn(ts)) ring("rgba(255,90,97,0.5)", cell * (1.5 + 0.3 * Math.sin(ts / 120)), 1);
  ctx.restore();
}

function drawMechanicsHud(ts) {
  if (gameState !== "PLAYING" && gameState !== "GAMEOVER") return;
  const chips = [];
  if (shieldOn(ts)) chips.push(["Bubble", "#7fe3ff", (buffs.shieldUntil - ts) / 1000]);
  if (starOn(ts)) chips.push(["Rampage", "#ff77c8", (buffs.starUntil - ts) / 1000]);
  if (phantomOn(ts)) chips.push(["Phantom", "#b36bff", (buffs.phantomUntil - ts) / 1000]);
  if (lodeOn(ts)) chips.push(["Lodestone", "#ff5a61", (buffs.lodeUntil - ts) / 1000]);
  if (frenzyOn(ts)) chips.push(["Frenzy 2x", "#3ddc84", (buffs.frenzyUntil - ts) / 1000]);
  if (frozenNow(ts)) chips.push(["Frozen", "#ffcf8a", (buffs.freezeUntil - ts) / 1000]);
  const fev = featureOn("fever"), shed = featureOn("shed");
  if (!chips.length && !fev && !shed && !contract) return;

  const g = ctx;
  g.save();
  g.font = `600 9px ${GAME_FONT}`;
  g.textBaseline = "middle";
  const y = viewH - 13;
  let x = 4;
  const pill = (w, color) => {
    g.fillStyle = "rgba(10,14,20,0.62)";
    g.fillRect(x, y - 6, w, 12);
    g.fillStyle = color;
    g.fillRect(x, y + 5, w, 1);
  };
  if (fev) {
    const w = 64;
    pill(w, "#ff8c1a");
    const on = feverOn(ts);
    const f = on ? (fever.until - ts) / (FEVER_MS * (1 + getTrackValue("feverpitch") / 100)) : fever.meter;
    g.fillStyle = on ? (Math.floor(ts / 120) % 2 ? "#ffb020" : "#ff5a1a") : "#ff8c1a";
    g.fillRect(x + 1, y - 5, Math.max(0, (w - 2) * Math.min(1, f)), 10);
    g.fillStyle = "#fff";
    g.fillText(on ? "FEVER 3x" : "Fever", x + 4, y);
    x += w + 4;
  }
  if (shed) {
    const w = 46;
    pill(w, "#d8c8a0");
    const left = Math.max(0, shedReadyAt - ts);
    const f = 1 - left / shedCooldown();
    g.fillStyle = canShed() ? "#d8c8a0" : "rgba(216,200,160,0.45)";
    g.fillRect(x + 1, y - 5, Math.max(0, (w - 2) * Math.min(1, f)), 10);
    g.fillStyle = canShed() ? "#1a1410" : "#fff";
    g.fillText(isTouchDevice() ? "Shed" : "E: Shed", x + 4, y);
    x += w + 4;
  }
  chips.forEach(([label, color, secs]) => {
    const w = g.measureText(label).width + 22;
    pill(w, color);
    g.fillStyle = color;
    g.fillText(`${label} ${Math.ceil(secs)}`, x + 4, y);
    x += w + 4;
  });
  if (contract) {
    const have = Math.min(contract.need, contract.def.have());
    const text = contract.done ? `Contract done: ${contract.def.text(contract.need)}` : `Contract: ${contract.def.text(contract.need)} (${fmtInt(have)}/${fmtInt(contract.need)})`;
    const w = g.measureText(text).width + 8;
    const cx = 4, cy = viewH - 28;
    g.fillStyle = "rgba(10,14,20,0.62)";
    g.fillRect(cx, cy - 6, w, 12);
    g.fillStyle = contract.done ? "#3ddc84" : "#ffd23f";
    g.fillText(text, cx + 4, cy);
  }
  g.restore();
}

/* ----- Death lines for the new ways to go ----- */
const CAUSE_LINES = {
  bramble: ["The brambles had been growing toward {name} all along. Patience is a thorn's only virtue.", "Pricked to the end. The garden has teeth, it turns out, and they are green."],
  wasp: ["The wasp did exactly what wasps are for. I have never forgiven a wasp, and I never shall.", "Stung. {name} was minding its own business, which the wasp considered an invitation."],
  lightning: ["Lightning struck the same snake once, which was enough.", "There was a flash, and a warning before the flash, and {name} read neither."],
  bomb: ["It ticked. Things that tick should be listened to. That is the whole lesson.", "Boom, as they say, in the trade. {name} was far too close to the trade."],
  ghost: ["Haunted to the last. The ghost does not know it is a ghost, and neither, now, does {name}.", "Something cold passed through {name}. I shan't say what. It is still in the room."],
  spikes: ["The spikes kept perfect time. {name} did not.", "Up, down, up. {name} picked the wrong one, which was always going to be the up."],
  sinkhole: ["The ground opened its mouth, and {name} walked in like a polite guest.", "There was a crack, and then there was a hole, and then there was a story about a hole."],
  hunter: ["The Hunter got there first. It always means to. Today it meant it more.", "Two snakes, one board. I did warn {name} there wasn't room."],
  echo: ["{name} ran into its own past, which is what pasts are for.", "The echo was only {name}, a little earlier. That did not make it any softer."]
};

function causeLine(cause) {
  const pool = CAUSE_LINES[cause];
  if (!pool || save.settings.commentary === "off") return null;
  return pool[getRandomInt(0, pool.length)].split("{name}").join(snakeName());
}
