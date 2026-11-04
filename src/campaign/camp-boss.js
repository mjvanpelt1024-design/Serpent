/* =========================================================
   src/campaign/camp-boss.js
   The island boss: a big rival snake with hearts, armor and stamina.
   Every island has one boss, fought three times (levels 5, 10, 15):
     fight 1  Outlast it. Its stamina drains as it hunts you; at zero it
              gives up and you win. You can't hurt it yet.
     fight 2  Its stamina drains faster. At zero it's exhausted: slow, and
              open to bites. Each bite on its body knocks off a silver
              armor heart. No armor left = you win.
     fight 3  The armor is gone. Exhaust it and bite its red hearts to zero.
   Its numbers (hearts, armor, speed, stamina) come from the island's file.
   ========================================================= */
"use strict";

let boss = null;

const BOSS_DELAY = 1600;        // a moment before it moves at the start
const BOSS_RETREAT = 1500;      // it backs off after a hit either way
const BOSS_CHARGE_MS = 1700;
const BOSS_HIT_CD = 800;

function spawnBoss(def, fight) {
  const B = CAMP.islandById[campRun.isl].boss;
  const corners = [[N20 - 3, N20 - 3], [N20 - 3, 2], [2, N20 - 3], [N20 - 3, 10]]
    .map(([cx, cy]) => ({ x: cx * cell, y: cy * cell }))
    .filter(p => !walls.has(cellKey(p.x, p.y)))
    .sort((a, b) => (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)) - (Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)));
  const at = corners[0] || { x: (N20 - 3) * cell, y: (N20 - 3) * cell };
  const now = performance.now();
  boss = {
    def: B, fight, name: B.name,
    cells: [{ x: at.x, y: at.y }], prev: null, maxCells: B.length,
    moveAt: now + BOSS_DELAY, frozenUntil: 0, stunnedUntil: 0, retreatUntil: 0, hitCdUntil: 0,
    hearts: B.hearts, maxHearts: B.hearts,
    armor: fight === 3 ? 0 : B.armor, maxArmor: B.armor,
    stamina: 1, exhaustedUntil: 0, exhaustStart: 0,
    nextCharge: now + BOSS_DELAY + 4000 + Math.random() * 2000, chargeUntil: 0,
    dmg: 0, beaten: false
  };
  showToast(`${B.name}: "${B.taunt}"`);
  sfx("bad");
}

const bossExhausted = (ts = performance.now()) => !!boss && ts < boss.exhaustedUntil;
const bossCharging = (ts = performance.now()) => !!boss && ts < boss.chargeUntil;

function bossInterval(ts) {
  let rel = boss.def.speed * (1 + 0.07 * boss.dmg);
  if (bossCharging(ts)) rel *= 1.9;
  if (bossExhausted(ts)) rel *= 0.38;
  if (campRun.rune && campRun.rune.id === "stillness" && campRun.rune.rarity === "legendary") rel *= 0.85;
  return moveInterval / Math.max(0.15, rel);
}

/* How fast its stamina drains, per second, as a share of the full bar */
function bossDrain(ts) {
  let d = boss.def.drain[boss.fight - 1] / boss.def.stamina;
  d *= 1 + upPct("wear");
  if (campRun.rune && campRun.rune.id === "fury") d *= 1 + campRun.rune.power / 100;
  if (bossCharging(ts)) d *= 2.4;
  return d;
}

function tickBoss(ts, delta) {
  if (!boss || boss.beaten) return;
  const frozen = ts < boss.frozenUntil;
  // stamina
  if (bossExhausted(ts)) {
    const span = boss.exhaustedUntil - boss.exhaustStart;
    boss.stamina = Math.min(1, (ts - boss.exhaustStart) / span);
  } else if (ts > boss.moveAt - BOSS_DELAY / 2) {
    const legendFrost = frozen && campEquippedId("spell") === "frost" && campEquippedRarity("spell") === "legendary";
    if (!frozen || legendFrost) boss.stamina -= bossDrain(ts) * delta / 1000;
    if (boss.stamina <= 0) {
      boss.stamina = 0;
      if (boss.fight === 1) { bossGivesUp(); return; }
      exhaustBoss(ts);
    }
  }
  if (!bossExhausted(ts) && !bossCharging(ts) && ts >= boss.nextCharge && ts > boss.retreatUntil) {
    boss.chargeUntil = ts + BOSS_CHARGE_MS;
    boss.nextCharge = ts + BOSS_CHARGE_MS + 4500 + Math.random() * 3000;
    sfx("whoosh");
  }
  if (frozen || ts < boss.stunnedUntil || ts < boss.moveAt) return;
  boss.moveAt = ts + bossInterval(ts);
  stepBoss(ts);
}

function exhaustBoss(ts) {
  boss.exhaustStart = ts;
  boss.exhaustedUntil = ts + boss.def.exhaustMs * (1 + upPct("exhaust"));
  boss.chargeUntil = 0;
  showToast(`${boss.def.name.split(" ")[0]} is exhausted! Bite its body!`);
  sfx("medal");
}

function bossGivesUp() {
  boss.beaten = true;
  showToast(`${boss.def.name.split(" ")[0]} is out of breath and slinks away!`);
  campWinLevel();
}

const bossWrap = v => (edgeMode === "wall" ? v : ((v % boardSize) + boardSize) % boardSize);
function bossBlocked(x, y) {
  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return true;
  if (walls.has(cellKey(x, y))) return true;
  if (rocks.some(r => covers(r, x, y))) return true;
  if (boss.cells.slice(0, -1).some(c => c.x === x && c.y === y)) return true;
  return false;
}

function bossPath(target) {
  const head = boss.cells[0];
  const start = cellKey(head.x, head.y), goal = cellKey(target.x, target.y);
  const seen = new Map([[start, null]]);
  const queue = [head];
  const dirs = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]];
  let found = false;
  for (let qi = 0; qi < queue.length && qi < 3000; qi++) {
    const p = queue[qi];
    if (cellKey(p.x, p.y) === goal) { found = true; break; }
    for (const [dx, dy] of dirs) {
      const x = bossWrap(p.x + dx), y = bossWrap(p.y + dy);
      const k = cellKey(x, y);
      if (seen.has(k) || (k !== goal && bossBlocked(x, y))) continue;
      seen.set(k, cellKey(p.x, p.y));
      queue.push({ x, y });
    }
  }
  if (!found) return null;
  let k = goal, prev = seen.get(k);
  while (prev && prev !== start) { k = prev; prev = seen.get(k); }
  const [x, y] = k.split(",").map(Number);
  return { x, y };
}

function stepBoss(ts) {
  const head = boss.cells[0];
  const retreating = ts < boss.retreatUntil;
  let target;
  if (retreating) {
    // the far side of the board from your head
    target = { x: snake.x < boardSize / 2 ? (N20 - 2) * cell : cell, y: snake.y < boardSize / 2 ? (N20 - 2) * cell : cell };
  } else {
    // aims a couple of squares ahead of your head when charging
    const lead = bossCharging(ts) ? 2 : 0;
    target = { x: bossWrap(snake.x + Math.sign(snake.dx) * cell * lead), y: bossWrap(snake.y + Math.sign(snake.dy) * cell * lead) };
    if (bossBlocked(target.x, target.y)) target = { x: snake.x, y: snake.y };
  }
  let next = bossPath(target);
  if (!next) {
    const opts = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]
      .map(([dx, dy]) => ({ x: bossWrap(head.x + dx), y: bossWrap(head.y + dy) }))
      .filter(p => !bossBlocked(p.x, p.y))
      .sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)));
    next = opts[0];
  }
  if (!next) { boss.stunnedUntil = ts + 500; return; }
  boss.prev = boss.cells.map(c => ({ x: c.x, y: c.y }));
  boss.cells.unshift({ x: next.x, y: next.y });
  if (boss.cells.length > boss.maxCells) boss.cells.pop();

  if (next.x === snake.x && next.y === snake.y) { bossBitesHead(ts); return; }
  if (snake.cells.some((c, i) => i > 0 && c.x === next.x && c.y === next.y)) bossBitesBody(ts);
}

function bossRetreat(ts, ms = BOSS_RETREAT) {
  boss.retreatUntil = ts + ms;
  boss.chargeUntil = 0;
}

function bossBitesHead(ts) {
  bossRetreat(ts);
  if (ts < graceUntil) return;
  if (campGearBlocks("boss")) return;
  sfx("bad");
  buzz([60, 40, 60]);
  takeHit(1, "boss");
  graceUntil = Math.max(graceUntil, ts + 900);
}

function bossBitesBody(ts) {
  bossRetreat(ts);
  if (ts < graceUntil) return;
  if (campEquippedId("gear") === "thorns" && campUseGear("thorns")) {
    boss.stunnedUntil = ts + 1200;
    showToast("Thorn Mail! It pricked itself on your scales.");
    sfx("rock");
    if (campEquippedRarity("gear") === "legendary" && boss.armor > 0 && boss.fight === 2) damageBoss(1, "thorns");
    return;
  }
  if (campPetBlocks()) return;
  sfx("bad");
  takeHit(0.5, "boss");
  graceUntil = Math.max(graceUntil, ts + 700);
}

/* Your head moved into the boss. Returns true if the run ended. */
function bossTouchedBy(nx, ny, ts) {
  if (!boss || boss.beaten) return false;
  if (!boss.cells.some(c => c.x === nx && c.y === ny)) return false;
  if (ts < boss.hitCdUntil) return false;
  boss.hitCdUntil = ts + BOSS_HIT_CD;
  if (bossExhausted(ts) && boss.fight > 1) {
    let n = 1;
    if (campRun.rune && campRun.rune.id === "fury") n += campRun.rune.rarity === "legendary" ? 2 : 1;
    if (roll(upVal("bite"))) n++;
    damageBoss(n, "bite");
    graceUntil = Math.max(graceUntil, ts + 500);
    return gameState !== "PLAYING";
  }
  // a sword cracks armor even while it's fresh; a shield just shoves it back
  const gear = campEquippedId("gear");
  if (gear === "sword" && campUseGear("sword")) {
    if (boss.fight === 2 && boss.armor > 0) damageBoss(1, "sword");
    else { boss.stamina = Math.max(0.02, boss.stamina - 0.15); showToast("Your sword knocked the wind out of it!"); }
    bossRetreat(ts);
    graceUntil = Math.max(graceUntil, ts + 700);
    return gameState !== "PLAYING";
  }
  if (gear === "shield" && campUseGear("shield")) {
    showToast("Your shield shoved it back!");
    bossRetreat(ts);
    graceUntil = Math.max(graceUntil, ts + 700);
    return false;
  }
  bossRetreat(ts);
  if (ts < graceUntil) return false;
  if (campGuardHit("boss")) return false;
  sfx("bad");
  const dead = takeHit(1, "boss");
  graceUntil = Math.max(graceUntil, ts + 900);
  return dead;
}

/* Knocks off armor first (fight 2), then hearts (fight 3) */
function damageBoss(n, how) {
  if (!boss || boss.beaten) return;
  const ts = performance.now();
  for (let i = 0; i < n; i++) {
    if (boss.fight === 2) { if (boss.armor > 0) boss.armor--; }
    else if (boss.fight === 3) { if (boss.hearts > 0) boss.hearts--; }
  }
  boss.dmg++;
  boss.stunnedUntil = ts + 500;
  sfx("rock");
  buzz(40);
  campBossFlash = ts;
  if (boss.fight === 2 && boss.armor <= 0) {
    boss.beaten = true;
    showToast(`The armor is broken! ${boss.def.name.split(" ")[0]} flees to lick its wounds.`);
    campWinLevel();
    return;
  }
  if (boss.fight === 3 && boss.hearts <= 0) {
    boss.beaten = true;
    showToast(`${boss.def.name} is defeated!`);
    confetti();
    campWinLevel();
    return;
  }
  const left = boss.fight === 2 ? `${boss.armor} armor left` : `${boss.hearts} hearts left`;
  showToast(how === "fireball" ? `Fireball hit! ${left}.` : `Bite! ${left}.`);
}
let campBossFlash = 0;

/* ----- Drawing ----- */
function drawBoss(view, ts) {
  if (!boss || boss.beaten) return;
  const B = boss.def;
  const frozen = ts < boss.frozenUntil;
  const tired = bossExhausted(ts);
  const charging = bossCharging(ts);
  const f = Math.min(1, Math.max(0, 1 - (boss.moveAt - ts) / bossInterval(ts)));
  const flash = ts - campBossFlash < 220;
  for (let i = boss.cells.length - 1; i >= 0; i--) {
    const c = boss.cells[i];
    const p = boss.prev && boss.prev[i] ? boss.prev[i] : c;
    const jump = Math.abs(c.x - p.x) > cell * 2 || Math.abs(c.y - p.y) > cell * 2;
    const [x, y] = view.toScreen(jump ? c.x : p.x + (c.x - p.x) * f, jump ? c.y : p.y + (c.y - p.y) * f);
    const armored = boss.armor > 0;
    let col = i % 2 ? B.body : shade(B.body, 0.15);
    if (armored && i % 3 === 1) col = "#c8ced6";
    if (frozen) col = i % 2 ? "#9fd8ff" : "#7ab8e8";
    if (flash) col = "#ffffff";
    ctx.fillStyle = col;
    ctx.fillRect(x, y, cell - 1, cell - 1);
    ctx.fillStyle = armored && !frozen ? "rgba(232,240,255,0.35)" : B.belly;
    ctx.fillRect(x + cell * 0.25, y + cell * 0.25, cell * 0.5, cell * 0.5);
    if (i === 0) {
      if (charging) { ctx.save(); ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = cell; ctx.strokeStyle = "#ff3b3b"; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, cell + 1, cell + 1); ctx.restore(); }
      ctx.fillStyle = tired ? "#ffffff" : B.eye;
      const eh = tired ? cell * 0.08 : cell * 0.2;
      ctx.fillRect(x + cell * 0.18, y + cell * 0.25, cell * 0.22, eh);
      ctx.fillRect(x + cell * 0.6, y + cell * 0.25, cell * 0.22, eh);
      // a crest so you can tell it's a boss
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(x + cell * 0.2, y - cell * 0.2, cell * 0.15, cell * 0.25);
      ctx.fillRect(x + cell * 0.425, y - cell * 0.3, cell * 0.15, cell * 0.35);
      ctx.fillRect(x + cell * 0.65, y - cell * 0.2, cell * 0.15, cell * 0.25);
      if (tired) {
        ctx.fillStyle = "#cfe8ff";
        ctx.font = `700 ${Math.round(cell * 0.55)}px 'Pixelify Sans', system-ui, sans-serif`;
        ctx.fillText("z", x + cell * 0.9, y - cell * 0.1 - (ts / 300 % 1) * cell * 0.4);
      }
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
