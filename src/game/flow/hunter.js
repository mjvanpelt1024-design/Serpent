/* =========================================================
   src/game/flow/hunter.js
   The Hunter: a rival snake that hunts your head and steals your
   apples. Bite it with your body to stun it; three stuns and it's
   beaten. Islands with "hunter = true" in their [rules] have one.
   ========================================================= */
"use strict";

let hunter = null;        // { alive, cells, maxCells, dx, dy, moveAt, stunnedUntil, hits, respawnAt }
const HUNTER_FIRST = 5000;
const HUNTER_BACK = 25000;
const HUNTER_HP = 3;
const HUNTER_SLOW = 1.45;    // its moves take this much longer than yours
const HUNTER_STUN = 2500;

function hunterWanted() {
  const m = modes[currentModeKey];
  return !!(m && m.hunter) || !!nm.hunter;
}

function resetHunter() {
  hunter = hunterWanted() ? { alive: false, cells: [], respawnAt: HUNTER_FIRST, hits: 0, moveAt: 0, stunnedUntil: 0 } : null;
}

function spawnHunter() {
  // The corner farthest from your head, give or take
  const corners = [[1, 1], [cellsAcross - 2, 1], [1, cellsAcross - 2], [cellsAcross - 2, cellsAcross - 2]]
    .map(([cx, cy]) => ({ x: cx * cell, y: cy * cell }))
    .sort((a, b) => (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)) - (Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)));
  const set = occupiedSet();
  const at = corners.find(c => !set.has(cellKey(c.x, c.y))) || findFreeSpot(1, (x, y) => Math.abs(x - snake.x) + Math.abs(y - snake.y) < 8 * cell);
  if (!at) { hunter.respawnAt = runMs + 2000; return; }
  Object.assign(hunter, {
    alive: true, cells: [{ x: at.x, y: at.y }], maxCells: 5 + (nm.hunter ? 3 : 0), dx: 0, dy: 0, hits: 0,
    moveAt: performance.now() + 600, stunnedUntil: 0, prev: null
  });
  showToast("The Hunter is here. It wants your apples, and then it wants you.");
  sfx("bad");
}

const hunterInterval = () => moveInterval * HUNTER_SLOW * (1 + (getTrackValue("camouflage") + getTrackValue("nm_hunt")) / 100) / (nm.hunter ? 1.25 : 1);

function tickHunter(ts) {
  if (!hunter) return;
  if (!hunter.alive) {
    if (runMs >= hunter.respawnAt) spawnHunter();
    return;
  }
  if (ts < hunter.stunnedUntil || ts < hunter.moveAt) return;
  hunter.moveAt = ts + hunterInterval();
  stepHunter(ts);
}

const wrapCell = v => (edgeMode === "wall" ? v : ((v % boardSize) + boardSize) % boardSize);

/* Squares the Hunter won't step into */
function hunterBlocked(x, y, forPath) {
  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return true;
  const k = cellKey(x, y);
  if (walls.has(k)) return true;
  if (rocks.some(r => covers(r, x, y))) return true;
  if (entities.some(e => covers(e, x, y) && ["bramble", "bomb", "spikes"].includes(e.type))) return true;
  if (hunter.cells.slice(0, -1).some(c => c.x === x && c.y === y)) return true;
  if (forPath && huskAt(x, y)) return true;
  if (forPath && snake.cells.slice(1).some(c => c.x === x && c.y === y)) return true;
  return false;
}

/* Breadth-first search to the target; returns the first step */
function hunterPath(target) {
  const head = hunter.cells[0];
  const start = cellKey(head.x, head.y), goal = cellKey(target.x, target.y);
  const seen = new Map([[start, null]]);
  const queue = [head];
  const dirs = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]];
  let found = false;
  for (let qi = 0; qi < queue.length && qi < 4000; qi++) {
    const p = queue[qi];
    if (cellKey(p.x, p.y) === goal) { found = true; break; }
    for (const [dx, dy] of dirs) {
      const x = wrapCell(p.x + dx), y = wrapCell(p.y + dy);
      const k = cellKey(x, y);
      if (seen.has(k)) continue;
      if (k !== goal && hunterBlocked(x, y, true)) continue;
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

function stepHunter(ts) {
  const head = hunter.cells[0];
  const dist = p => Math.abs(p.x - head.x) + Math.abs(p.y - head.y);
  // It goes for an apple if one is much closer than you are (or Decoy fooled it)
  const apple = apples.filter(a => (a.size || 1) === 1).sort((a, b) => dist(a) - dist(b))[0];
  const goApple = apple && (dist(apple) < dist(snake) * 0.6 || roll(getTrackValue("decoy")));
  let next = hunterPath(goApple ? apple : snake) || (goApple ? hunterPath(snake) : null);
  if (!next) {
    // No way through: any free square that gets closer, or any free square at all
    const opts = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]
      .map(([dx, dy]) => ({ x: wrapCell(head.x + dx), y: wrapCell(head.y + dy) }))
      .filter(p => !hunterBlocked(p.x, p.y, false))
      .sort((a, b) => (Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)) - (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)));
    next = opts[0];
  }
  if (!next) { stunHunter("stuck"); return; }

  hunter.prev = hunter.cells.map(c => ({ x: c.x, y: c.y }));
  hunter.cells.unshift({ x: next.x, y: next.y });
  if (hunter.cells.length > hunter.maxCells) hunter.cells.pop();

  // What it ran into
  if (next.x === snake.x && next.y === snake.y) { hunterBites(); return; }
  if (snake.cells.some((c, i) => i > 0 && c.x === next.x && c.y === next.y) || huskAt(next.x, next.y)) {
    stunHunter(huskAt(next.x, next.y) ? "husk" : "body");
    return;
  }
  const ai = apples.findIndex(a => covers(a, next.x, next.y));
  if (ai >= 0) {
    apples.splice(ai, 1);
    hunter.maxCells++;
    runCount("stolen");
    if ((runCounts.stolen || 0) % 3 === 1) showToast("The Hunter stole an apple.");
    maintainApples();
  }
  const gi = entities.findIndex(e => e.type === "golden" && covers(e, next.x, next.y));
  if (gi >= 0) { entities.splice(gi, 1); hunter.maxCells += 2; showToast("The Hunter ate a Golden Apple. The nerve."); }
}

function hunterBites() {
  if (starOn()) { stunHunter("star"); return; }
  sfx("bad");
  buzz([60, 40, 60]);
  hunterRetreat();
  takeHit(1, "hunter");
}

/* After a bite it slinks off and comes back from a corner */
function hunterRetreat() {
  hunter.alive = false;
  hunter.respawnAt = runMs + 2500;
}

function stunHunter(why) {
  if (!hunter || !hunter.alive) return;
  const ts = performance.now();
  if (ts < hunter.stunnedUntil) return;
  hunter.stunnedUntil = ts + HUNTER_STUN;
  hunter.hits++;
  hunter.maxCells = Math.max(3, hunter.maxCells - 2);
  while (hunter.cells.length > hunter.maxCells) hunter.cells.pop();
  sfx("rock");
  if (hunter.hits >= HUNTER_HP) { beatHunter(); return; }
  showToast(why === "husk" ? "The Hunter tangled in your shed skin!" : `The Hunter is stunned! ${HUNTER_HP - hunter.hits} more and it's beaten.`);
}

function beatHunter() {
  const at = hunter.cells[0];
  hunter.alive = false;
  hunter.respawnAt = runMs + HUNTER_BACK;
  runCount("hunter");
  save.stats.huntersBeaten = (save.stats.huntersBeaten || 0) + 1;
  addScore(15 * 100 * scoreMultiplier * (1 + getTrackValue("taxidermy") / 100));
  // a trophy: big XP where it fell
  const set = occupiedSet();
  if (at && !set.has(cellKey(at.x, at.y))) makeOrb({ x: at.x, y: at.y, size: 1, small: false });
  grantXp(xpUnit() * 3 * (1 + getTrackValue("taxidermy") / 100));
  sfx("medal");
  showToast("You beat the Hunter! It will be back, angrier, later.");
}

/* Your head moved into the Hunter */
function hunterTouchedBy(nx, ny) {
  if (!hunter || !hunter.alive) return false;
  const i = hunter.cells.findIndex(c => c.x === nx && c.y === ny);
  if (i < 0) return false;
  if (starOn() || feverOn()) { stunHunter("star"); return false; }
  sfx("bad");
  hunterRetreat();
  return takeHit(1, "hunter");
}

function drawHunter(view, ts) {
  if (!hunter || !hunter.alive) return;
  const stunned = ts < hunter.stunnedUntil;
  const f = Math.min(1, Math.max(0, 1 - (hunter.moveAt - ts) / hunterInterval()));
  for (let i = hunter.cells.length - 1; i >= 0; i--) {
    const c = hunter.cells[i];
    const p = hunter.prev && hunter.prev[i] ? hunter.prev[i] : c;
    const jump = Math.abs(c.x - p.x) > cell * 2 || Math.abs(c.y - p.y) > cell * 2;
    const x0 = jump ? c.x : p.x + (c.x - p.x) * f, y0 = jump ? c.y : p.y + (c.y - p.y) * f;
    const [x, y] = view.toScreen(x0, y0);
    ctx.fillStyle = stunned ? (Math.floor(ts / 120) % 2 ? "#6a6470" : "#3a3640") : i === 0 ? "#2a0a12" : i % 2 ? "#7a1424" : "#5a0e1a";
    ctx.fillRect(x, y, cell - 1, cell - 1);
    if (i === 0) {
      ctx.fillStyle = stunned ? "#fff" : "#ffd23f";
      ctx.fillRect(x + cell * 0.2, y + cell * 0.25, cell * 0.2, cell * 0.2);
      ctx.fillRect(x + cell * 0.6, y + cell * 0.25, cell * 0.2, cell * 0.2);
      if (stunned) {
        ctx.fillStyle = "#ffd23f";
        const a = ts / 150;
        for (let s = 0; s < 3; s++) ctx.fillRect(x + cell / 2 + Math.cos(a + s * 2.1) * cell * 0.6 - 1, y - cell * 0.2 + Math.sin(a + s * 2.1) * cell * 0.25, 2, 2);
      }
    }
  }
}
