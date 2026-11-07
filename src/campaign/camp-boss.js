/* =========================================================
   src/campaign/camp-boss.js
   The island boss: a big rival snake with hearts, armor and stamina.
   Every island has one boss, fought three times (levels 5, 10, 15).

   Hurting it: when ITS head runs into YOUR snake, it hurts itself, so
   dodge, coil and let it crash. When YOUR head runs into IT, you get hurt
   (unless it's exhausted: then a bite on its body hurts it). A sword adds
   to every blow (and lets you strike it head-on), Thorn Mail pricks it
   when it rams your body, a fireball burns it, a force field zaps it, and
   frost freezes it, unless that boss shrugs the spell off ("resist" in
   its island's file).
     fight 1  Each blow knocks the wind out of it; its stamina drains as
              it hunts you too. At zero it gives up and you win.
     fight 2  Each blow knocks off a silver armor heart. No armor = a win.
              At zero stamina it's exhausted: slow, and open to bites.
     fight 3  No armor: each blow takes a red heart. None left = a win.

   How sharp it is (boss.smart) grows with every fight: the first island's
   first fight is a pushover that mostly wanders, and the last island's
   last fight hunts as hard as bosses ever did. A sharp boss cuts in front
   of your head and swerves rather than ram you; a dull one blunders in.
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
  const smart = bossSmartFor(CAMP.islandById[campRun.isl].n, fight);
  boss = {
    def: B, fight, name: B.name,
    cells: [{ x: at.x, y: at.y }], prev: null, maxCells: B.length,
    moveAt: now + BOSS_DELAY, frozenUntil: 0, stunnedUntil: 0, retreatUntil: 0, hitCdUntil: 0,
    hearts: B.hearts, maxHearts: B.hearts,
    armor: fight === 3 ? 0 : B.armor, maxArmor: B.armor,
    stamina: 1, exhaustedUntil: 0, exhaustStart: 0,
    nextCharge: now + BOSS_DELAY + (4000 + Math.random() * 2000) / (0.35 + 0.65 * smart), chargeUntil: 0,
    dmg: 0, beaten: false, smart, resist: B.resist || []
  };
  // no taunt: the story stays in the book (build 51)
  sfx("bad");
}

/* How sharp a boss is, 0 to 1: island n's fight f. The first is a pushover; the last is as sharp as bosses
   have ever been (1 = the old hunt). Fifteen fights in all, each a little sharper than the one before. */
function bossSmartFor(n, fight) {
  const i = (n - 1) * 3 + (fight - 1);
  return Math.min(1, 0.12 + 0.88 * i / 14);
}
/* Does this boss shrug off a spell? ("resist" in its island's file) */
const bossResists = id => !!boss && boss.resist.includes(id);

const bossExhausted = (ts = performance.now()) => !!boss && ts < boss.exhaustedUntil;
const bossCharging = (ts = performance.now()) => !!boss && ts < boss.chargeUntil;

function bossInterval(ts) {
  let rel = boss.def.speed * (1 + 0.07 * boss.dmg) * (0.62 + 0.38 * boss.smart);
  if (bossCharging(ts)) rel *= 1.9;
  if (bossExhausted(ts)) rel *= 0.38;
  return moveInterval / Math.max(0.15, rel);
}

/* How fast its stamina drains, per second, as a share of the full bar */
function bossDrain(ts) {
  let d = boss.def.drain[boss.fight - 1] / boss.def.stamina;
  d *= 1 + upPct("wear");
  d *= 1 + runeVal("bossDrain") / 100;
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
    boss.nextCharge = ts + BOSS_CHARGE_MS + (4500 + Math.random() * 3000) / (0.35 + 0.65 * boss.smart);
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

/* Which squares are your snake's: your head, or the rest of you */
const onSnake = p => snake.cells.findIndex(c => c.x === p.x && c.y === p.y);

/* A step that just carries on: straight ahead if it can, otherwise a turn (never doubling back) */
function bossWander() {
  const head = boss.cells[0], neck = boss.cells[1] || head;
  let dx = Math.sign(head.x - neck.x) * cell, dy = Math.sign(head.y - neck.y) * cell;
  if (Math.abs(head.x - neck.x) > cell * 2) dx = -dx;
  if (Math.abs(head.y - neck.y) > cell * 2) dy = -dy;
  const opts = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]
    .filter(([x, y]) => !(x === -dx && y === -dy && (dx || dy)))
    .map(([x, y]) => ({ x: bossWrap(head.x + x), y: bossWrap(head.y + y), straight: x === dx && y === dy }))
    .filter(p => !bossBlocked(p.x, p.y));
  if (!opts.length) return null;
  const ahead = opts.find(p => p.straight);
  if (ahead && Math.random() < 0.75) return ahead;
  return opts[Math.floor(Math.random() * opts.length)];
}

function stepBoss(ts) {
  const head = boss.cells[0];
  const retreating = ts < boss.retreatUntil;
  const charging = bossCharging(ts);
  const sm = boss.smart;
  let target;
  if (retreating) {
    // the far side of the board from your head
    target = { x: snake.x < boardSize / 2 ? (N20 - 2) * cell : cell, y: snake.y < boardSize / 2 ? (N20 - 2) * cell : cell };
  } else {
    // a sharp boss heads for the squares in front of your head, to get in your way; charging, it lunges
    const lead = charging ? 2 : Math.round(3 * sm);
    target = { x: bossWrap(snake.x + Math.sign(snake.dx) * cell * lead), y: bossWrap(snake.y + Math.sign(snake.dy) * cell * lead) };
    if (bossBlocked(target.x, target.y)) target = { x: snake.x, y: snake.y };
  }
  // a dull boss loses track of you: much of the time it just wanders on
  const chase = retreating || charging || Math.random() < 0.3 + 0.7 * sm;
  let next = chase ? bossPath(target) : bossWander();
  if (!next) next = bossWander();
  if (!next) {
    const opts = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]
      .map(([dx, dy]) => ({ x: bossWrap(head.x + dx), y: bossWrap(head.y + dy) }))
      .filter(p => !bossBlocked(p.x, p.y))
      .sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)));
    next = opts[0];
  }
  if (!next) { boss.stunnedUntil = ts + 500; return; }
  // running into you hurts it, so a sharp boss swerves at the last moment (unless it's charging)
  if (onSnake(next) >= 0 && !charging && Math.random() < 0.85 * sm) {
    const alt = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]
      .map(([dx, dy]) => ({ x: bossWrap(head.x + dx), y: bossWrap(head.y + dy) }))
      .filter(p => !bossBlocked(p.x, p.y) && onSnake(p) < 0)
      .sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)));
    if (alt.length) next = alt[0];
  }
  // it rammed you: it hurts itself, and bounces off instead of moving in
  const hit = onSnake(next);
  if (hit >= 0) { bossRams(ts, hit === 0); return; }
  boss.prev = boss.cells.map(c => ({ x: c.x, y: c.y }));
  boss.cells.unshift({ x: next.x, y: next.y });
  if (boss.cells.length > boss.maxCells) boss.cells.pop();
}

function bossRetreat(ts, ms = BOSS_RETREAT) {
  boss.retreatUntil = ts + ms;
  boss.chargeUntil = 0;
}

/* How hard a blow on the boss lands: one, more with a sword, a Rune of Fury or the Coral Fig's bites */
function bossBlow() {
  let n = 1;
  if (campEquippedId("gear") === "sword") n += campEquippedRarity("gear") === "legendary" ? 2 : 1;
  n += runeVal("bite");
  if (roll(upVal("bite"))) n++;
  return n;
}

/* The boss ran its head into your snake: it hurts itself. Thorn Mail on your body pricks it harder. */
function bossRams(ts, onHead) {
  bossRetreat(ts);
  boss.stunnedUntil = ts + 700;
  if (ts < boss.hitCdUntil) return;
  boss.hitCdUntil = ts + BOSS_HIT_CD;
  let n = bossBlow();
  if (!onHead && campEquippedId("gear") === "thorns") { n++; campUseGear("thorns", true); }
  sfx("rock");
  buzz([40, 30, 40]);
  damageBoss(n, onHead ? "head" : "ram");
}

/* Your head moved into the boss. Returns true if the run ended. */
function bossTouchedBy(nx, ny, ts) {
  if (!boss || boss.beaten) return false;
  if (!boss.cells.some(c => c.x === nx && c.y === ny)) return false;
  if (ts < boss.hitCdUntil) return false;
  boss.hitCdUntil = ts + BOSS_HIT_CD;
  // worn out, it's open: a bite on it hurts it, not you
  if (bossExhausted(ts) && boss.fight > 1) {
    damageBoss(bossBlow(), "bite");
    graceUntil = Math.max(graceUntil, ts + 500);
    return gameState !== "PLAYING";
  }
  // a force field zaps it instead of you
  if (fieldOn(ts) && !bossResists("forcefield")) {
    sfx("pop");
    bossRetreat(ts);
    damageBoss(1, "field");
    graceUntil = Math.max(graceUntil, ts + 700);
    return gameState !== "PLAYING";
  }
  // a sword strikes it head-on (one of the sword's hits for this level); a shield shoves it back
  const gear = campEquippedId("gear");
  if (gear === "sword" && campUseGear("sword")) {
    bossRetreat(ts);
    damageBoss(bossBlow(), "sword");
    graceUntil = Math.max(graceUntil, ts + 700);
    return gameState !== "PLAYING";
  }
  if (gear === "shield" && campUseGear("shield")) {
    showToast("Your shield shoved it back!");
    bossRetreat(ts);
    graceUntil = Math.max(graceUntil, ts + 700);
    return false;
  }
  // otherwise you ran into it: that hurts you
  bossRetreat(ts);
  if (ts < graceUntil) return false;
  if (campGuardHit("boss")) return false;
  sfx("bad");
  buzz([60, 40, 60]);
  const dead = takeHit(1, "boss");
  graceUntil = Math.max(graceUntil, ts + 900);
  return dead;
}

/* A blow of n on the boss: fight 1 knocks the wind out of it, fight 2 its armor, fight 3 its hearts */
function damageBoss(n, how) {
  if (!boss || boss.beaten) return;
  const ts = performance.now();
  if (boss.fight === 1) {
    boss.stamina = Math.max(0, boss.stamina - 0.22 * n);
    boss.dmg++;
    boss.stunnedUntil = Math.max(boss.stunnedUntil, ts + 500);
    campBossFlash = ts;
    sfx("rock");
    if (boss.stamina <= 0) { bossGivesUp(); return; }
    showToast(`${BOSS_HOW[how] || "A hit!"} ${boss.def.name.split(" ")[0]} is winded.`);
    return;
  }
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
  const left = boss.fight === 2 ? `${boss.armor} armor left` : `${boss.hearts} ${boss.hearts === 1 ? "heart" : "hearts"} left`;
  showToast(`${BOSS_HOW[how] || "A hit!"} ${left}.`);
}
const BOSS_HOW = { ram: "It crashed into you!", head: "It rammed your head and hurt itself!", bite: "Bite!", sword: "Your sword struck it!", fireball: "Fireball hit!", field: "Your force field zapped it!", thorns: "Your thorns pricked it!" };
let campBossFlash = 0;

/* ----- Drawing -----
   The boss is drawn the way your snake is (drawSnakeCell): the same rounded,
   lit segments, in its own colors. While it's armored, silver plates ride on
   its back. Its head wears its island's crown: a knight's helm, a wizard's
   hat, a glutton's jaw, a sea monster's fins, a wyrm's horns. */
function drawBoss(view, ts) {
  if (!boss || boss.beaten) return;
  const B = boss.def;
  const frozen = ts < boss.frozenUntil;
  const tired = bossExhausted(ts);
  const charging = bossCharging(ts);
  const f = Math.min(1, Math.max(0, 1 - (boss.moveAt - ts) / bossInterval(ts)));
  const flash = ts - campBossFlash < 220;
  const pts = boss.cells.map((c, i) => {
    const p = boss.prev && boss.prev[i] ? boss.prev[i] : c;
    const jump = Math.abs(c.x - p.x) > cell * 2 || Math.abs(c.y - p.y) > cell * 2;
    return view.toScreen(jump ? c.x : p.x + (c.x - p.x) * f, jump ? c.y : p.y + (c.y - p.y) * f);
  });
  // a red glow around it while it charges
  if (charging && !frozen) {
    ctx.save();
    ctx.shadowColor = "#ff3b3b";
    ctx.shadowBlur = cell * (0.8 + 0.4 * Math.sin(ts / 60));
    ctx.fillStyle = "rgba(255, 59, 59, 0.35)";
    pts.forEach(([x, y]) => ctx.fillRect(x - 2, y - 2, cell + 3, cell + 3));
    ctx.restore();
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y] = pts[i];
    let col = i % 2 ? B.body : shade(B.body, 0.18);
    if (frozen) col = i % 2 ? "#9fd8ff" : "#7ab8e8";
    if (tired && !frozen) col = shade(col, -0.25);
    if (flash) col = "#ffffff";
    if (i === 0) {
      // a head a size bigger than the body
      const grow = cell * 0.14;
      ctx.save();
      roundedPath(ctx, x - grow, y - grow, cell - 1 + grow * 2, cell - 1 + grow * 2, cell * 0.34);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.clip();
      ctx.fillRect(x - grow, y - grow, cell + grow * 2, (cell + grow * 2) * 0.26);
      ctx.restore();
      ctx.save();
      roundedPath(ctx, x - grow, y - grow, cell - 1 + grow * 2, cell - 1 + grow * 2, cell * 0.34);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = Math.max(1, cell * 0.1);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    drawSnakeCell(x, y, col);
    // the belly stripe
    ctx.fillStyle = flash ? "#ffffff" : B.belly;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x + cell * 0.32, y + cell * 0.32, cell * 0.34, cell * 0.34);
    ctx.globalAlpha = 1;
    // silver plates on its back while it's armored
    if (boss.armor > 0 && i > 0 && i % 2 === 1) {
      const k = cell / 20;
      ctx.fillStyle = "#5a6470";
      ctx.fillRect(x + 4 * k, y + 3 * k, 11 * k, 9 * k);
      ctx.fillStyle = "#dfe6ee";
      ctx.fillRect(x + 5 * k, y + 3 * k, 9 * k, 7 * k);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 5 * k, y + 3 * k, 3 * k, 2 * k);
      ctx.fillStyle = "#9aa3ad";
      ctx.fillRect(x + 7 * k, y + 10 * k, 5 * k, 2 * k);
    }
  }
  // the head: which way it looks, its crest, its eyes
  const [hx, hy] = pts[0];
  const nxt = boss.cells[1] || boss.cells[0];
  let fx = Math.sign(boss.cells[0].x - nxt.x), fy = Math.sign(boss.cells[0].y - nxt.y);
  if (Math.abs(boss.cells[0].x - nxt.x) > cell * 2) fx = -fx;
  if (Math.abs(boss.cells[0].y - nxt.y) > cell * 2) fy = -fy;
  if (!fx && !fy) fx = -1;
  drawBossCrest(hx, hy, fx, fy, ts);
  const k = cell / 20, cx = hx + (cell - 1) / 2, cy = hy + (cell - 1) / 2, px = -fy, py = fx;
  [1, -1].forEach(side => {
    const ex = cx + (px * 4.2 * side + fx * 2.5) * k, ey = cy + (py * 4.2 * side + fy * 2.5) * k;
    if (tired) {
      ctx.fillStyle = "#1a1418";
      ctx.fillRect(ex - 3 * k, ey - 0.6 * k, 6 * k, 1.6 * k);
      return;
    }
    // narrow, angry eyes that glow
    ctx.save();
    ctx.shadowColor = B.eye;
    ctx.shadowBlur = cell * 0.5;
    ctx.fillStyle = frozen ? "#e8f8ff" : B.eye;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 3.2 * k, 2 * k, Math.atan2(fy, fx) + side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(ex - 0.8 * k + fx * 0.8 * k, ey - 0.8 * k + fy * 0.8 * k, 1.6 * k, 1.6 * k);
  });
  // a flicking forked tongue when it's hungry, sleepy z's when it's spent
  if (!tired && !frozen && Math.sin(ts / 180) > 0.6) {
    ctx.fillStyle = "#ff3b6b";
    const tx = cx + fx * cell * 0.62, ty = cy + fy * cell * 0.62;
    ctx.fillRect(tx - 1.2 * k + fx * 2 * k, ty - 1.2 * k + fy * 2 * k, 2.4 * k + Math.abs(fx) * 3 * k, 2.4 * k + Math.abs(fy) * 3 * k);
  }
  if (tired) {
    ctx.fillStyle = "#cfe8ff";
    const ph = (ts / 900) % 1;
    ctx.font = `700 ${Math.round(cell * (0.45 + ph * 0.3))}px ${GAME_FONT}`;
    ctx.globalAlpha = 1 - ph;
    ctx.fillText("z", hx + cell * 0.8 + ph * cell * 0.4, hy - cell * 0.1 - ph * cell * 0.8);
    ctx.globalAlpha = 1;
  }
}

/* Each island's boss wears something of its island on its head */
function drawBossCrest(x, y, fx, fy, ts) {
  const k = cell / 20, isl = campRun.isl;
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a * k, y + b * k, w * k, h * k); };
  if (isl === "keep") {
    // a black knight's helm with a red plume
    R(1, -3, 17, 7, "#2a2a34"); R(2, -4, 15, 2, "#7a808c"); R(2, -2, 15, 4, "#5a606c"); R(2, -2, 3, 4, "#8a909c"); R(3, 1, 13, 1, "#14141a"); R(9, -4, 1, 6, "#9aa0ac");
    const wave = Math.round(Math.sin(ts / 120) * 1.5);
    R(8, -8 + wave, 3, 6, "#c0392b"); R(10, -9 + wave, 4, 3, "#e74c3c"); R(13, -8 + wave, 3, 2, "#c0392b");
  } else if (isl === "spire") {
    // a tall, crooked wizard's hat with stars
    R(1, -2, 17, 3, "#2a1a5a"); R(4, -6, 11, 4, "#3a2a7a"); R(6, -10, 7, 4, "#3a2a7a"); R(8, -14, 4, 4, "#3a2a7a"); R(11, -16, 3, 2, "#3a2a7a");
    R(6, -5, 2, 2, "#ffd23f"); R(10, -9, 1, 1, "#ffd23f"); R(12, -15, 1, 1, Math.sin(ts / 200) > 0 ? "#ffffff" : "#ffd23f");
  } else if (isl === "hollow") {
    // a glutton's bib and a fork stuck in its hat
    R(3, -3, 14, 4, "#f0f0f0"); R(4, -6, 12, 3, "#e8e8e8"); R(2, -5, 4, 3, "#f0f0f0"); R(14, -5, 4, 3, "#f0f0f0");
    R(16, -12, 1, 8, "#c8ced6"); R(15, -13, 1, 2, "#c8ced6"); R(17, -13, 1, 2, "#c8ced6");
  } else if (isl === "reef") {
    // a crown of fins and a coral spike
    for (let i = 0; i < 4; i++) R(2 + i * 4, -4 - (i % 2) * 2, 3, 5 + (i % 2) * 2, i % 2 ? "#3a8ac0" : "#2a6a9a");
    R(9, -9, 2, 5, "#ff7a8a"); R(7, -8, 1, 2, "#ff7a8a"); R(12, -7, 1, 2, "#ff7a8a");
  } else {
    // a wyrm's horns, glowing at the tips
    R(1, -3, 4, 4, "#2a1a1a"); R(-1, -7, 4, 4, "#2a1a1a"); R(-2, -10, 3, 3, "#ff8a1a");
    R(15, -3, 4, 4, "#2a1a1a"); R(17, -7, 4, 4, "#2a1a1a"); R(19, -10, 3, 3, "#ff8a1a");
    if (Math.sin(ts / 150) > 0.3) R(8, -4, 4, 2, "#ffb020");
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
