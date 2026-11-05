/* =========================================================
   src/campaign/camp-levels.js
   Level layouts and the ways to win one.

   Layouts (a level's "layout" in content/campaign/islands/*.json):
     static boards (20 x 20): open, pillars, rooms, cross, lanes, ring,
       comb, diamond, checker, spiral, arena
     dynamic: tunnel (the endless scroller), maze (the wrap-around maze),
       field (an endless wrap-around hall of mirrored walls that cascade
       out from the middle), pulse (walls that rise and fall on a beat)

   Goals (a level's "goal"):
     apples, score, length, survive (seconds), distance (meters),
     keys (pick up N, then reach the gate), buttons (press N plates,
     optionally in order, then touch the seal), relic (find one thing),
     shards (gather N), thief (catch a runaway N times), boss
   ========================================================= */
"use strict";

const N20 = 20;
const LAYOUTS = {
  open: () => ({ cells: [], start: [3, 10] }),
  pillars: () => {
    const c = [];
    [[4, 4], [14, 4], [4, 14], [14, 14], [9, 3], [9, 15]].forEach(([x, y]) => { c.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]); });
    return { cells: c, start: [2, 10] };
  },
  rooms: () => {
    const c = [];
    for (let i = 0; i < N20; i++) {
      if (![3, 4, 15, 16].includes(i)) { c.push([10, i]); c.push([i, 10]); }
    }
    return { cells: c.filter(([x, y]) => !(x === 10 && y === 10) || true), start: [2, 2] };
  },
  cross: () => {
    const c = [];
    for (let i = 5; i <= 14; i++) { if (i !== 9 && i !== 10) { c.push([9, i], [10, i], [i, 9], [i, 10]); } }
    return { cells: c, start: [2, 16] };
  },
  lanes: () => {
    const c = [];
    [5, 10, 15].forEach((y, k) => { for (let x = 3; x <= 16; x++) if (k % 2 ? x > 5 : x < 14) c.push([x, y]); });
    return { cells: c, start: [2, 2] };
  },
  ring: () => {
    const c = [];
    for (let i = 5; i <= 14; i++) {
      if (i === 9 || i === 10) continue;
      c.push([i, 5], [i, 14], [5, i], [14, i]);
    }
    c.push([5, 5], [14, 5], [5, 14], [14, 14]);
    return { cells: c, start: [2, 2] };
  },
  comb: () => {
    const c = [];
    [3, 7, 11, 15].forEach(x => { for (let y = 3; y <= 12; y++) c.push([x, y]); });
    [5, 9, 13].forEach(x => { for (let y = 8; y <= 16; y++) c.push([x, y]); });
    return { cells: c, start: [1, 18] };
  },
  diamond: () => {
    const c = [];
    for (let d = 0; d <= 6; d++) {
      if (d === 0) continue;
      [[10 - 7 + d, 10 - d], [10 + 7 - d - 1, 10 - d], [10 - 7 + d, 9 + d], [10 + 7 - d - 1, 9 + d]].forEach(p => c.push(p));
    }
    return { cells: c, start: [2, 2] };
  },
  checker: () => {
    const c = [];
    for (let y = 2; y < N20 - 1; y += 4) for (let x = 2; x < N20 - 1; x += 4) c.push([x, y]);
    return { cells: c, start: [1, 1] };
  },
  spiral: () => {
    const c = [];
    const ring = (a, b, gap) => {
      for (let i = a; i <= b; i++) {
        [[i, a], [i, b], [a, i], [b, i]].forEach(([x, y]) => { if (!gap(x, y)) c.push([x, y]); });
      }
    };
    ring(3, 16, (x, y) => y === 3 && x >= 4 && x <= 6);
    ring(7, 12, (x, y) => y === 12 && x >= 9 && x <= 10);
    return { cells: c, start: [1, 1] };
  },
  arena: () => ({ cells: [[5, 5], [14, 5], [5, 14], [14, 14]], start: [2, 10] }),
  pulse: () => ({ cells: [], start: [2, 2] })
};

/* The two wall sets a pulse level swaps between */
function pulseSets() {
  const a = [], b = [];
  for (let i = 3; i <= 16; i++) {
    if (i < 8 || i > 11) { a.push([6, i], [13, i]); b.push([i, 6], [i, 13]); }
  }
  for (let i = 8; i <= 11; i++) { a.push([i, 3], [i, 16]); b.push([3, i], [16, i]); }
  return [a, b];
}

/* ----- Live state for the level being played ----- */
let campObjs = [];         // { kind: key|door|plate|seal|relic|shard|thief|loot, x, y, ... }
let campGoal = null;       // { type, need, have, ... }
let pulse = null;          // { sets, on, next, warnAt }

const GOAL_LABEL = {
  apples: n => `Eat ${fmtInt(n)} apples`,
  score: n => `Reach ${fmtInt(n)} points`,
  length: n => `Grow to ${fmtInt(n)} long`,
  survive: n => `Survive ${fmtInt(n)} seconds`,
  distance: n => `Travel ${fmtInt(n)} meters`,
  keys: n => `Find ${n} keys, then the gate`,
  buttons: (n, g) => `Press ${n} plates${g && g.ordered ? " in order" : ""}`,
  relic: () => "Find the relic",
  shards: n => `Gather ${n} pouches`,
  thief: n => `Catch the thief ${n} times`,
  boss: (n, g) => ["", "Outlast the boss", "Break the boss's armor", "Defeat the boss"][g.fight] || "Beat the boss"
};
const goalText = g => (GOAL_LABEL[g.type] ? GOAL_LABEL[g.type](g.need, g) : "Win");

const RELIC_NAMES = { crown: "the Lost Crown", grimoire: "the Forbidden Grimoire", ladle: "the Golden Ladle", pearl: "the Pearl of Tides", eye: "the Dragon's Eye" };

/* ----- Building the board ----- */
function campBuildStatic(def) {
  const L = (LAYOUTS[def.layout] || LAYOUTS.open)();
  walls = new Map();
  if (def.layout === "pulse") {
    const [a, b] = pulseSets();
    pulse = { sets: [a, b], on: 0, next: performance.now() + 5000 };
    a.forEach(([x, y]) => walls.set(cellKey(x * cell, y * cell), "red"));
  } else pulse = null;
  L.cells.forEach(([x, y]) => { if (x >= 0 && y >= 0 && x < N20 && y < N20) walls.set(cellKey(x * cell, y * cell), "red"); });
  const [sx, sy] = L.start;
  walls.delete(cellKey(sx * cell, sy * cell));
  snake.x = sx * cell;
  snake.y = sy * cell;
  snake.dx = cell;
  snake.dy = 0;
  // keep a short runway in front of the head
  for (let k = 1; k <= 3; k++) walls.delete(cellKey((sx + k) * cell, sy * cell));
}

/* The endless field: a torus of mirrored walls, rings cascading out from a clearing */
const FIELD_T = 48;
function campBuildField(seedText) {
  const rng = seededRandom(seedFromText(seedText || "field"));
  const T = FIELD_T, C = T / 2;
  maze = { N: 1, S: T, T, W: T * cell, east: [[]], south: [[]], groups: [], prev: [], field: true };
  walls = new Map();
  const put = (x, y) => walls.set(cellKey((((x % T) + T) % T) * cell, (((y % T) + T) % T) * cell), "red");
  // one eighth is designed, the rest is its reflection
  const mirror8 = (dx, dy) => {
    const pts = new Set();
    [[dx, dy], [dy, dx]].forEach(([a, b]) => [[a, b], [-a, b], [a, -b], [-a, -b]].forEach(([p, q]) => pts.add(`${p},${q}`)));
    pts.forEach(s => { const [p, q] = s.split(",").map(Number); put(C + p, C + q); });
  };
  // square rings with doorways, every ring a little wider apart
  [7, 12, 18].forEach((r, ri) => {
    const doors = new Set();
    const nd = 1 + ri;
    for (let i = 0; i < nd; i++) doors.add(Math.floor(rng() * (r - 2)));
    for (let a = 0; a <= r; a++) {
      const gap = [...doors].some(d => Math.abs(a - d) <= 1);
      if (!gap) mirror8(a, r);
    }
  });
  // scattered pillars between the rings
  for (let i = 0; i < 26; i++) {
    const dx = 2 + Math.floor(rng() * 20), dy = Math.floor(rng() * (dx + 1));
    if ([7, 12, 18].some(r => Math.abs(Math.max(dx, dy) - r) <= 1)) continue;
    if (Math.max(dx, dy) < 4) continue;
    mirror8(dx, dy);
  }
  snake.x = C * cell;
  snake.y = C * cell;
  snake.dx = cell;
  snake.dy = 0;
  for (let k = -1; k <= 4; k++) walls.delete(cellKey((C + k) * cell, C * cell));
  return { x: snake.x, y: snake.y };
}

/* Picks a free square; far = prefer squares a long way from the head */
function campSpot(far = 0) {
  const set = occupiedSet();
  campObjs.forEach(o => set.add(cellKey(o.x, o.y)));
  set.add(cellKey(snake.x + snake.dx, snake.y + snake.dy));
  const span = maze ? maze.T : N20;
  const dist = (x, y) => maze ? (Math.abs(wrapDelta(x - snake.x)) + Math.abs(wrapDelta(y - snake.y))) / cell : (Math.abs(x - snake.x) + Math.abs(y - snake.y)) / cell;
  let best = null, bestD = -1;
  for (let i = 0; i < (far ? 160 : 60); i++) {
    const x = Math.floor(Math.random() * span) * cell, y = Math.floor(Math.random() * span) * cell;
    if (set.has(cellKey(x, y))) continue;
    const d = dist(x, y);
    if (d < 3) continue;
    if (!far) return { x, y };
    if (d > bestD && d <= far) { best = { x, y }; bestD = d; }
  }
  return best;
}

function campSetupGoal(def, mods) {
  const g = Object.assign({}, def.goal);
  if (mods.includes("greedy") && g.need && !["relic", "boss"].includes(g.type)) g.need = Math.ceil(g.need * 1.5);
  g.have = 0;
  campGoal = g;
  campObjs = [];
  const far = maze ? (maze.field ? 22 : 30) : 26;
  if (g.type === "keys") for (let i = 0; i < g.need; i++) { const s = campSpot(far); if (s) campObjs.push({ kind: "key", x: s.x, y: s.y }); }
  if (g.type === "shards") for (let i = 0; i < g.need; i++) { const s = campSpot(far); if (s) campObjs.push({ kind: "shard", x: s.x, y: s.y }); }
  if (g.type === "relic") { const s = campSpot(maze && !maze.field ? 34 : far); if (s) campObjs.push({ kind: "relic", x: s.x, y: s.y, item: g.item }); }
  if (g.type === "buttons") placePlates(g);
  if (g.type === "thief") spawnThief();
}

/* Plates sit out along the field's rings, spread evenly round the middle */
function placePlates(g) {
  const C = maze ? maze.T / 2 : 10;
  const radii = maze ? [5, 10, 15, 20] : [4, 7];
  const order = [];
  for (let i = 0; i < g.need; i++) order.push(i);
  order.sort(() => Math.random() - 0.5);
  for (let i = 0; i < g.need; i++) {
    const r = radii[i % radii.length];
    const a = (i / g.need) * Math.PI * 2 + Math.random() * 0.4;
    let tx = Math.round(C + Math.cos(a) * r), ty = Math.round(C + Math.sin(a) * r);
    let x = tx * cell, y = ty * cell;
    if (maze) { x = wrapW(x); y = wrapW(y); }
    // nudge off walls
    for (let k = 0; k < 12 && (walls.has(cellKey(x, y)) || campObjs.some(o => o.x === x && o.y === y)); k++) {
      x += cell * (k % 2 ? 1 : -1); if (maze) x = wrapW(x);
    }
    walls.delete(cellKey(x, y));
    campObjs.push({ kind: "plate", x, y, n: order[i] + 1, on: false });
  }
}

/* ----- The thief: runs from your head, and you have to corner it ----- */
function spawnThief() {
  const s = campSpot(12) || campSpot(0);
  if (s) campObjs.push({ kind: "thief", x: s.x, y: s.y, moveAt: performance.now() + 900, px: s.x, py: s.y, hopAt: 0 });
}

function tickThief(o, ts) {
  if (ts < o.moveAt || frozenNow(ts)) return;
  o.moveAt = ts + moveInterval * 1.35;
  const dirs = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]];
  const set = occupiedSet();
  campObjs.forEach(p => { if (p !== o) set.add(cellKey(p.x, p.y)); });
  const d = (x, y) => maze ? Math.abs(wrapDelta(x - snake.x)) + Math.abs(wrapDelta(y - snake.y)) : Math.abs(x - snake.x) + Math.abs(y - snake.y);
  const here = d(o.x, o.y);
  if (here > 9 * cell && Math.random() < 0.6) return;          // it rests when you're far away
  const opts = dirs.map(([dx, dy]) => {
    let x = o.x + dx, y = o.y + dy;
    if (maze) { x = wrapW(x); y = wrapW(y); }
    else if (edgeMode !== "wall") { x = (x + boardSize) % boardSize; y = (y + boardSize) % boardSize; }
    return { x, y };
  }).filter(p => (maze || (p.x >= 0 && p.y >= 0 && p.x < boardSize && p.y < boardSize)) && !set.has(cellKey(p.x, p.y)));
  if (!opts.length) return;
  opts.sort((a, b) => d(b.x, b.y) - d(a.x, a.y));
  const pick = Math.random() < 0.8 ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
  o.px = o.x; o.py = o.y; o.hopAt = ts;
  o.x = pick.x; o.y = pick.y;
}

/* ----- Each frame ----- */
function tickCampLevel(ts, delta) {
  campObjs.forEach(o => { if (o.kind === "thief") tickThief(o, ts); });
  if (pulse) tickPulse(ts);
}

const PULSE_MS = 5200, PULSE_WARN = 1300;
function tickPulse(ts) {
  if (ts < pulse.next) return;
  const next = 1 - pulse.on;
  const body = new Set(snake.cells.map(c => cellKey(c.x, c.y)));
  body.add(cellKey(snake.x, snake.y));
  body.add(cellKey(snake.x + snake.dx, snake.y + snake.dy));
  pulse.sets[pulse.on].forEach(([x, y]) => walls.delete(cellKey(x * cell, y * cell)));
  pulse.sets[next].forEach(([x, y]) => {
    const k = cellKey(x * cell, y * cell);
    if (body.has(k)) return;                        // a wall never grows inside the snake
    walls.set(k, "red");
    // anything standing there gets shoved out of the way
    [apples, rocks, hazards, popsicles].forEach(list => { for (let i = list.length - 1; i >= 0; i--) if (covers(list[i], x * cell, y * cell)) list.splice(i, 1); });
    entities = entities.filter(e => ENTITY_TYPES[e.type].global || !covers(e, x * cell, y * cell));
  });
  campObjs.forEach(o => { if (walls.has(cellKey(o.x, o.y))) { const s = campSpot(0); if (s) { o.x = s.x; o.y = s.y; } } });
  pulse.on = next;
  pulse.next = ts + PULSE_MS;
  maintainApples();
  sfx("whoosh");
}

/* The head reached a square: goal pieces react. Returns true if the level was won. */
function touchCampObjs(nx, ny) {
  for (let i = campObjs.length - 1; i >= 0; i--) {
    const o = campObjs[i];
    if (o.x !== nx || o.y !== ny) continue;
    if (o.kind === "key") {
      campObjs.splice(i, 1);
      campGoal.have++;
      campBump("keysFound");
      sfx("medal");
      if (campGoal.have >= campGoal.need) {
        const s = campSpot(maze ? 20 : 14) || campSpot(0);
        if (s) campObjs.push({ kind: "door", x: s.x, y: s.y });
        showToast("All keys found! The gate has appeared.");
      } else showToast(`Key ${campGoal.have} of ${campGoal.need}`);
    } else if (o.kind === "door") {
      return true;
    } else if (o.kind === "shard") {
      campObjs.splice(i, 1);
      campGoal.have++;
      sfx("bigxp");
      if (campGoal.have >= campGoal.need) return true;
      showToast(`${campGoal.have} of ${campGoal.need} gathered`);
    } else if (o.kind === "relic") {
      campBump("relicsFound");
      return true;
    } else if (o.kind === "plate" && !o.on) {
      const plates = campObjs.filter(p => p.kind === "plate");
      const nextN = plates.filter(p => p.on).length + 1;
      if (campGoal.ordered && o.n !== nextN) {
        plates.forEach(p => { p.on = false; });
        campGoal.have = 0;
        sfx("bad");
        showToast(`Wrong order: that was plate ${o.n}. All the plates reset.`);
        continue;
      }
      o.on = true;
      campGoal.have++;
      campBump("platesPressed");
      sfx("tick");
      if (campGoal.have >= campGoal.need) {
        const C = maze ? maze.T / 2 : 10;
        let x = C * cell, y = C * cell;
        if (walls.has(cellKey(x, y)) || (x === snake.x && y === snake.y)) { const s = campSpot(0); if (s) { x = s.x; y = s.y; } }
        campObjs.push({ kind: "seal", x, y });
        showToast("Every plate is down. The great seal has appeared in the middle.");
        sfx("unlock");
      }
    } else if (o.kind === "seal") {
      return true;
    } else if (o.kind === "thief") {
      campObjs.splice(i, 1);
      campGoal.have++;
      campBump("thievesCaught");
      sfx("medal");
      if (campGoal.have >= campGoal.need) return true;
      showToast(`Caught! ${campGoal.need - campGoal.have} to go. It ran off again.`);
      setTimeout(() => { if (gameState === "PLAYING" && campRun) spawnThief(); }, 300);
    } else if (o.kind === "loot") {
      campObjs.splice(i, 1);
      collectLoot(o);
    }
  }
  return false;
}

/* Things your head ran into this frame that a thief could also be standing on */
function thiefCaughtByBody() {
  campObjs.forEach(o => { if (o.kind === "thief" && o.x === snake.x && o.y === snake.y) touchCampObjs(o.x, o.y); });
}

/* How far along the goal is, 0..1 and as text */
function goalProgress() {
  const g = campGoal;
  if (!g) return { f: 0, text: "" };
  let have = g.have;
  if (g.type === "score") have = score;
  if (g.type === "apples") have = campRun.apples;
  if (g.type === "length") have = snake.maxCells;
  if (g.type === "survive") have = Math.floor(runMs / 1000);
  if (g.type === "distance") have = endlessDistance();
  if (g.type === "relic") return { f: 0, text: "Find " + (RELIC_NAMES[g.item] || "the relic") };
  if (g.type === "boss") {
    if (!boss) return { f: 0, text: "" };
    if (g.fight === 1) return { f: 1 - boss.stamina, text: `Stamina left: ${Math.ceil(boss.stamina * 100)}%` };
    if (g.fight === 2) return { f: 1 - boss.armor / Math.max(1, boss.maxArmor), text: `Armor left: ${boss.armor} of ${boss.maxArmor}` };
    return { f: 1 - boss.hearts / Math.max(1, boss.maxHearts), text: `Hearts left: ${boss.hearts} of ${boss.maxHearts}` };
  }
  if (g.type === "keys" && g.have >= g.need) return { f: 1, text: "Reach the gate" };
  if (g.type === "buttons" && g.have >= g.need) return { f: 1, text: "Touch the seal" };
  return { f: Math.min(1, have / g.need), text: `${fmtInt(Math.min(have, g.need))} / ${fmtInt(g.need)}` };
}

function goalMet() {
  const g = campGoal;
  if (!g) return false;
  if (g.type === "score") return score >= g.need;
  if (g.type === "apples") return campRun.apples >= g.need;
  if (g.type === "length") return snake.maxCells >= g.need;
  if (g.type === "survive") return runMs >= g.need * 1000;
  if (g.type === "distance") return endlessDistance() >= g.need;
  return false;
}

/* The nearest thing the goal wants, for the pointer at the side */
function goalTarget() {
  const want = campObjs.filter(o => ["key", "door", "relic", "shard", "seal", "thief"].includes(o.kind) || (o.kind === "plate" && !o.on && (!campGoal.ordered || o.n === campObjs.filter(p => p.kind === "plate" && p.on).length + 1)));
  if (!want.length) return null;
  const d = o => maze ? Math.abs(wrapDelta(o.x - snake.x)) + Math.abs(wrapDelta(o.y - snake.y)) : Math.abs(o.x - snake.x) + Math.abs(o.y - snake.y);
  want.sort((a, b) => d(a) - d(b));
  const o = want[0];
  const dx = maze ? wrapDelta(o.x - snake.x) : o.x - snake.x, dy = maze ? wrapDelta(o.y - snake.y) : o.y - snake.y;
  return { o, dx, dy, dist: Math.round((Math.abs(dx) + Math.abs(dy)) / cell) };
}

/* ----- Loot trinkets: little things to sell ----- */
function maybeLoot(ts) {
  if (!campRun || campRun.def.kind === "boss") return;
  if (ts < campRun.lootAt) return;
  campRun.lootAt = ts + CAMP.rules.rewards.lootEveryMs;
  if (campObjs.some(o => o.kind === "loot")) return;
  if (Math.random() > CAMP.rules.rewards.lootChance * (1 + upPct("lucky"))) return;
  const s = endless ? null : campSpot(0);
  if (!s) return;
  const pool = CAMP.loot.filter(l => l.island === campRun.islandN);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick) campObjs.push({ kind: "loot", x: s.x, y: s.y, id: pick.id, until: ts + 12000 });
}

function collectLoot(o) {
  campRun.loot.push(o.id);
  sfx("shimmer");
  showToast(`Found: ${CAMP.lootById[o.id].name}. Sell it at any merchant.`);
}

/* ----- Drawing the goal pieces ----- */
function drawCampObjs(view, ts) {
  campObjs = campObjs.filter(o => !o.until || ts < o.until);
  campObjs.forEach(o => {
    let wx = o.x, wy = o.y;
    if (o.kind === "thief" && o.hopAt && ts - o.hopAt < 160) {
      const t = (ts - o.hopAt) / 160;
      const dx = maze ? wrapDelta(o.x - o.px) : o.x - o.px, dy = maze ? wrapDelta(o.y - o.py) : o.y - o.py;
      if (Math.abs(dx) <= cell && Math.abs(dy) <= cell) { wx = o.px + dx * t; wy = o.py + dy * t; }
    }
    const [x, y] = view.toScreen(wx, wy);
    if (x < -cell || y < -cell || x > boardSize || y > viewH) return;
    drawCampObj(ctx, o, x, y, cell, ts);
  });
  if (pulse) {
    // the next set of walls glows before it rises
    const left = pulse.next - ts;
    if (left < PULSE_WARN) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(ts / 70);
      ctx.fillStyle = "#ff5a61";
      pulse.sets[1 - pulse.on].forEach(([cx, cy]) => { const [x, y] = view.toScreen(cx * cell, cy * cell); ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4); });
      ctx.restore();
    }
  }
}

function drawCampObj(g, o, x, y, w, ts) {
  const bob = Math.sin(ts / 260 + x) * w * 0.06;
  g.save();
  if (o.kind === "key") {
    g.fillStyle = "#ffd23f";
    g.fillRect(x + w * 0.2, y + w * 0.25 + bob, w * 0.3, w * 0.3);
    g.fillStyle = "#3a2a0a";
    g.fillRect(x + w * 0.29, y + w * 0.34 + bob, w * 0.12, w * 0.12);
    g.fillStyle = "#ffd23f";
    g.fillRect(x + w * 0.48, y + w * 0.36 + bob, w * 0.4, w * 0.1);
    g.fillRect(x + w * 0.72, y + w * 0.46 + bob, w * 0.08, w * 0.16);
    g.fillRect(x + w * 0.84, y + w * 0.46 + bob, w * 0.06, w * 0.12);
  } else if (o.kind === "door") {
    g.shadowColor = "#ffd23f"; g.shadowBlur = w * 0.6;
    g.fillStyle = "#6a4a2a"; g.fillRect(x + w * 0.1, y, w * 0.8, w);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.1, y, w * 0.8, w * 0.12);
    g.fillStyle = "#2a1a0a"; g.fillRect(x + w * 0.3, y + w * 0.3, w * 0.4, w * 0.7);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.58, y + w * 0.6, w * 0.08, w * 0.08);
  } else if (o.kind === "plate") {
    g.fillStyle = o.on ? "#3ddc84" : "#5a6070";
    g.fillRect(x + w * 0.08, y + w * 0.08, w * 0.84, w * 0.84);
    g.fillStyle = o.on ? "#b8ffd8" : "#8a92a4";
    g.fillRect(x + w * 0.18, y + w * 0.18, w * 0.64, w * 0.64);
    g.fillStyle = o.on ? "#0a3a1a" : "#1a1e26";
    g.font = `700 ${Math.round(w * 0.5)}px 'Pixelify Sans', system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(campGoal && campGoal.ordered ? String(o.n) : o.on ? "✓" : "", x + w / 2, y + w / 2 + 1);
  } else if (o.kind === "seal") {
    const p = 0.5 + 0.5 * Math.sin(ts / 160);
    g.shadowColor = "#b36bff"; g.shadowBlur = w * (0.5 + p);
    g.fillStyle = "#b36bff";
    g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.45, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(x + w / 2, y + w / 2, w * (0.18 + 0.06 * p), 0, Math.PI * 2); g.fill();
  } else if (o.kind === "relic") {
    g.shadowColor = "#ffd23f"; g.shadowBlur = w * 0.8;
    drawRelicIcon(g, o.item, x, y + bob, w);
  } else if (o.kind === "shard") {
    g.fillStyle = "#c89a4a"; g.fillRect(x + w * 0.22, y + w * 0.3 + bob, w * 0.56, w * 0.55);
    g.fillStyle = "#8a6a2a"; g.fillRect(x + w * 0.3, y + w * 0.18 + bob, w * 0.4, w * 0.16);
    g.fillStyle = "#ffe08a"; g.fillRect(x + w * 0.4, y + w * 0.5 + bob, w * 0.2, w * 0.2);
  } else if (o.kind === "thief") {
    g.fillStyle = "#8a6a4a"; g.fillRect(x + w * 0.15, y + w * 0.35, w * 0.65, w * 0.45);
    g.fillStyle = "#a8886a"; g.fillRect(x + w * 0.55, y + w * 0.22, w * 0.35, w * 0.35);
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.74, y + w * 0.3, w * 0.08, w * 0.08);
    g.fillStyle = "#ffb0c0"; g.fillRect(x + w * 0.88, y + w * 0.4, w * 0.08, w * 0.06);
    g.fillStyle = "#6a4a2a"; g.fillRect(x, y + w * 0.4, w * 0.2, w * 0.06);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.25, y + w * 0.2 + bob, w * 0.2, w * 0.2);  // the loot it stole
  } else if (o.kind === "loot") {
    const a = o.until ? Math.min(1, (o.until - ts) / 2500) : 1;
    g.globalAlpha = Math.max(0.3, a);
    g.shadowColor = "#fff"; g.shadowBlur = w * 0.4;
    g.fillStyle = "#e8e0c8"; g.fillRect(x + w * 0.25, y + w * 0.25 + bob, w * 0.5, w * 0.5);
    g.fillStyle = "#9a8a6a"; g.fillRect(x + w * 0.35, y + w * 0.35 + bob, w * 0.3, w * 0.3);
  }
  g.restore();
}

function drawRelicIcon(g, item, x, y, w) {
  if (item === "crown") {
    g.fillStyle = "#ffd23f";
    g.fillRect(x + w * 0.12, y + w * 0.45, w * 0.76, w * 0.35);
    [[0.12, 0.2], [0.42, 0.12], [0.72, 0.2]].forEach(([a, b]) => g.fillRect(x + w * a, y + w * b, w * 0.16, w * 0.3));
    g.fillStyle = "#ff3b3b"; g.fillRect(x + w * 0.44, y + w * 0.55, w * 0.12, w * 0.12);
  } else if (item === "grimoire") {
    g.fillStyle = "#5a2a8a"; g.fillRect(x + w * 0.18, y + w * 0.15, w * 0.64, w * 0.72);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.22, y + w * 0.15, w * 0.06, w * 0.72);
    g.fillStyle = "#b36bff"; g.fillRect(x + w * 0.42, y + w * 0.38, w * 0.22, w * 0.22);
  } else if (item === "ladle") {
    g.fillStyle = "#ffd23f";
    g.beginPath(); g.arc(x + w * 0.35, y + w * 0.65, w * 0.22, 0, Math.PI * 2); g.fill();
    g.fillRect(x + w * 0.45, y + w * 0.15, w * 0.1, w * 0.45);
  } else if (item === "pearl") {
    g.fillStyle = "#c87a8a"; g.fillRect(x + w * 0.1, y + w * 0.55, w * 0.8, w * 0.3);
    g.fillStyle = "#f0f4ff"; g.beginPath(); g.arc(x + w / 2, y + w * 0.45, w * 0.24, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = "#ff6a1a"; g.beginPath(); g.ellipse(x + w / 2, y + w / 2, w * 0.4, w * 0.28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.45, y + w * 0.25, w * 0.1, w * 0.5);
  }
}
