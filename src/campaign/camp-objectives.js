/* =========================================================
   src/campaign/camp-objectives.js
   Build 56: things to DO on a board, beyond eating. Two parts that share their pieces:

   1. Boss objectives. Every island's boss is shielded in its second and third fights: blows
      only land while the shield is down, and the shield only goes down when you've done that
      boss's own thing. The island's levels teach the pieces of it first.
        keep    Grimscale   lure     trick it into the snares (it runs over them when it charges)
        spire   Hexfang     pylons   touch every crystal before they dim (in order, in the last fight)
        hollow  Gorgemaw    bait     spoiled fruit appears; it can't help gorging; strike while it's sick
        reef    Leviathorn  beacons  light every lamp at once; they gutter out one by one
        crown   Pyrrhus     lure     run it through the pools: it can't stay hot over water
      Fight 1 isn't shielded (it's the lesson): every success just knocks a third off its wind.
      The numbers are `objectives` in content/campaign/foes.json. An exhausted boss is open too.

   2. Three new level goals (a level's `goal`):
        beacons  light N lamps at once: each stays lit `lit` seconds after you touch it
        hold     stand inside the ring for N seconds in all; it moves; you drain a little outside it
        haul     carry a pouch to the drop-off, N times; a hit drops it
      Where a board wants its pieces, its .level file marks the spots: p pylon, l beacon, m snare or
      pool, o bait, h the ring's middle. Without marks they go on free squares.
   ========================================================= */
"use strict";

const OBJ_ALL = () => ((CAMP.foes || {}).objectives || {});
let campSpots = {};                                   // from the board: { pylon: [[x, y]...], beacon, mark, bait, hold }

const objShuffle = a => a.slice().sort(() => Math.random() - 0.5);
/* n free squares for a kind of piece: the board's own spots first, then wherever there's room */
function objSpots(kind, n, minHead = 3) {
  const set = occupiedSet();
  campObjs.forEach(o => set.add(cellKey(o.x, o.y)));
  if (boss) boss.cells.forEach(c => set.add(cellKey(c.x, c.y)));
  const out = [];
  const ok = p => !set.has(cellKey(p.x, p.y)) && !walls.has(cellKey(p.x, p.y)) && !out.some(q => q.x === p.x && q.y === p.y) && (Math.abs(p.x - snake.x) + Math.abs(p.y - snake.y)) / cell >= minHead;
  objShuffle((campSpots[kind] || []).map(([x, y]) => ({ x: x * cell, y: y * cell }))).forEach(p => { if (out.length < n && ok(p)) out.push(p); });
  for (let k = 0; out.length < n && k < 200; k++) {
    const p = { x: Math.floor(Math.random() * cellsAcross) * cell, y: Math.floor(Math.random() * cellsAcross) * cell };
    // spread them: not right on top of each other
    if (ok(p) && out.every(q => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) >= cell * 4)) out.push(p);
  }
  return out;
}

/* ===== Boss objectives ===== */
const bossOpenNow = (ts = performance.now()) => !!boss && (ts < (boss.openUntil || 0) || bossExhausted(ts));
const bossShieldUp = (ts = performance.now()) => !!boss && !!boss.obj && boss.shielded && !boss.beaten && !bossOpenNow(ts);

function bossObjSetup() {
  if (!boss || boss.champion) return;
  const o = OBJ_ALL()[boss.isl];
  if (!o) return;
  const f = (o.fights || [])[boss.fight - 1] || {};
  boss.obj = Object.assign({ kind: o.kind, mark: o.mark, name: o.name, hint: o.hint, color: o.color || "#ffd23f" }, f);
  boss.shielded = boss.fight > 1;
  boss.openUntil = 0;
  boss.objState = "wait";
  boss.objAt = performance.now() + 2600;
  boss.objHits = 0;
  boss.objDone = 0;
}
function bossObjClear() {
  campObjs = campObjs.filter(o => !["pylon", "beacon", "mark"].includes(o.kind));
  for (let i = apples.length - 1; i >= 0; i--) if (apples[i].bait) apples.splice(i, 1);
}
function bossObjSpawn(ts) {
  const O = boss.obj;
  bossObjClear();
  boss.objHits = 0;
  if (O.kind === "pylons") {
    objSpots("pylon", O.n).forEach((p, i) => campObjs.push({ kind: "pylon", x: p.x, y: p.y, n: i + 1, on: false }));
    boss.objDeadline = O.secs ? ts + O.secs * 1000 : 0;
    boss.objNext = 1;
  } else if (O.kind === "beacons") {
    objSpots("beacon", O.n).forEach(p => campObjs.push({ kind: "beacon", x: p.x, y: p.y, litUntil: 0 }));
  } else if (O.kind === "lure") {
    objSpots("mark", O.count || O.n + 2).forEach(p => campObjs.push({ kind: "mark", x: p.x, y: p.y, mark: O.mark || "snare" }));
  } else if (O.kind === "bait") {
    objSpots("bait", O.count || O.n + 1).forEach(p => apples.push({ x: p.x, y: p.y, size: 1, small: false, rotten: true, bait: true, spawnAt: ts }));
  }
  boss.objState = "active";
  showToast(O.fresh || ({ pylons: "The crystals flare! Touch them all.", beacons: "The lamps are dark. Light them all at once.", lure: O.mark === "pool" ? "Pools of water. Make it cross them." : "Snares in the grass. Make it run over them.", bait: "Spoiled fruit! It won't be able to resist." })[O.kind] || "");
}
function bossObjDone(ts) {
  const O = boss.obj, first = boss.def.name.split(" ")[0];
  bossObjClear();
  boss.objDone++;
  boss.objState = "rest";
  boss.objAt = ts + (boss.shielded ? (O.window || 7000) + 2200 : 3500);
  if (!boss.shielded) {
    // the lesson fight: every success knocks the wind out of it
    boss.stamina = Math.max(0, boss.stamina - (O.chunk || 0.34));
    boss.dmg++;
    boss.stunnedUntil = Math.max(boss.stunnedUntil, ts + 600);
    campBossFlash = ts;
    showToast(`${first} reels! (${Math.ceil(boss.stamina * 100)}% wind left)`);
    sfx("medal");
    if (boss.stamina <= 0) bossGivesUp();
    return;
  }
  boss.openUntil = ts + (O.window || 7000);
  boss.stunnedUntil = Math.max(boss.stunnedUntil, ts + 900);
  boss.chargeUntil = 0;
  campBossFlash = ts;
  showToast(`${first}'s shield is down! Strike now!`);
  sfx("unlock");
  buzz([40, 30, 40]);
}
function bossObjFail(ts, text) {
  bossObjClear();
  boss.objState = "rest";
  boss.objAt = ts + 2200;
  showToast(text);
  sfx("bad");
}

function tickBossObjective(ts) {
  if (!boss || boss.beaten || !boss.obj) return;
  const O = boss.obj;
  if (boss.objState === "rest") { if (ts >= boss.objAt && ts >= (boss.openUntil || 0)) boss.objState = "wait"; else return; }
  if (boss.objState === "wait") { if (ts >= boss.objAt && ts > boss.retreatUntil - 400) bossObjSpawn(ts); return; }
  if (boss.objState !== "active") return;
  const head = boss.cells[0];
  if (O.kind === "pylons") {
    if (boss.objDeadline && ts > boss.objDeadline) { bossObjFail(ts, "The crystals dim. Start again."); return; }
    if (campObjs.filter(o => o.kind === "pylon").every(o => o.on)) bossObjDone(ts);
  } else if (O.kind === "beacons") {
    const lamps = campObjs.filter(o => o.kind === "beacon");
    if (lamps.length && lamps.every(o => ts < o.litUntil)) bossObjDone(ts);
  } else if (O.kind === "lure") {
    // the boss's head over a snare or a pool (a charge doesn't swerve; a sharp boss steps round them otherwise)
    const i = campObjs.findIndex(o => o.kind === "mark" && o.x === head.x && o.y === head.y);
    if (i >= 0) {
      const m = campObjs.splice(i, 1)[0];
      boss.objHits++;
      boss.stunnedUntil = Math.max(boss.stunnedUntil, ts + 900);
      campBossFlash = ts;
      sfx(m.mark === "pool" ? "molasses" : "rock");
      showToast(m.mark === "pool" ? `${boss.def.name.split(" ")[0]} hisses as it cools! (${boss.objHits} of ${O.n})` : `Snap! (${boss.objHits} of ${O.n})`);
      if (boss.objHits >= O.n) { bossObjDone(ts); return; }
      // not enough left to finish: lay a fresh set
      if (campObjs.filter(o => o.kind === "mark").length < O.n - boss.objHits) {
        objSpots("mark", O.count || O.n + 2).forEach(p => campObjs.push({ kind: "mark", x: p.x, y: p.y, mark: O.mark || "snare" }));
      }
    }
  } else if (O.kind === "bait") {
    const i = apples.findIndex(a => a.bait && a.x === head.x && a.y === head.y);
    if (i >= 0) {
      apples.splice(i, 1);
      boss.objHits++;
      boss.stunnedUntil = Math.max(boss.stunnedUntil, ts + 700);
      campBossFlash = ts;
      sfx("pop");
      showToast(`${boss.def.name.split(" ")[0]} gobbles it and turns green! (${boss.objHits} of ${O.n})`);
      if (boss.objHits >= O.n) { bossObjDone(ts); return; }
    }
    // you ate the bait (or ran out of it): more appears
    const left = apples.filter(a => a.bait).length;
    if (left + boss.objHits < O.n) objSpots("bait", Math.max(1, O.n - boss.objHits - left)).forEach(p => apples.push({ x: p.x, y: p.y, size: 1, small: false, rotten: true, bait: true, spawnAt: ts }));
  }
}

/* The shield: blows are refused while it's up */
(() => {
  const dmg = damageBoss;
  let told = 0;
  window.damageBoss = function (n, how) {
    const ts = performance.now();
    if (bossShieldUp(ts)) {
      if (ts - told > 2500) { told = ts; showToast(`Its shield holds! ${boss.obj.hint || ""}`); }
      sfx("rock");
      return;
    }
    return dmg.apply(this, arguments);
  };
  // a boss with its shield down is dazed: slow, and a bite on its body hurts it
  const interval = bossInterval;
  window.bossInterval = function (ts) {
    const v = interval.apply(this, arguments);
    return boss && boss.openUntil && ts < boss.openUntil && !bossExhausted(ts) ? v / 0.5 : v;
  };
  const touched = bossTouchedBy;
  window.bossTouchedBy = function (nx, ny, ts) {
    if (boss && !boss.beaten && boss.openUntil && ts < boss.openUntil && !bossExhausted(ts) && boss.fight > 1 && boss.cells.some(c => c.x === nx && c.y === ny) && ts >= boss.hitCdUntil && ts >= (boss.phaseUntil || 0)) {
      boss.hitCdUntil = ts + BOSS_HIT_CD;
      damageBoss(bossBlow(), "bite");
      graceUntil = Math.max(graceUntil, ts + 500);
      return gameState !== "PLAYING";
    }
    return touched.apply(this, arguments);
  };
  // a boss lured by bait heads for it
  const path = bossPath;
  window.bossPath = function (target) {
    if (boss && boss.obj && boss.obj.kind === "bait" && boss.objState === "active" && !bossOpenNow()) {
      const h = boss.cells[0];
      const baits = apples.filter(a => a.bait).sort((a, b) => (Math.abs(a.x - h.x) + Math.abs(a.y - h.y)) - (Math.abs(b.x - h.x) + Math.abs(b.y - h.y)));
      if (baits.length) return path.call(this, { x: baits[0].x, y: baits[0].y });
    }
    // fight 3: a sharp boss steps round the snares and pools unless it's charging
    const next = path.apply(this, arguments);
    if (next && boss && boss.obj && boss.obj.kind === "lure" && boss.fight === 3 && !bossCharging() && Math.random() < 0.7 && campObjs.some(o => o.kind === "mark" && o.x === next.x && o.y === next.y)) {
      const h = boss.cells[0];
      const alt = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]].map(([dx, dy]) => ({ x: bossWrap(h.x + dx), y: bossWrap(h.y + dy) }))
        .filter(p => !bossBlocked(p.x, p.y) && !campObjs.some(o => o.kind === "mark" && o.x === p.x && o.y === p.y))
        .sort((a, b) => (Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)) - (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)));
      if (alt.length) return alt[0];
    }
    return next;
  };
  const spawn = spawnBoss;
  window.spawnBoss = function () { spawn.apply(this, arguments); bossObjSetup(); };
  const tick = tickBoss;
  window.tickBoss = function (ts, delta) { tick.apply(this, arguments); tickBossObjective(ts); };
  const shift = campShiftTimers;
  window.campShiftTimers = function (d) {
    shift.apply(this, arguments);
    if (boss && boss.obj) ["objAt", "objDeadline", "openUntil"].forEach(k => { if (boss[k]) boss[k] += d; });
    campObjs.forEach(o => { if (o.litUntil) o.litUntil += d; });
    if (campGoal && campGoal.zoneAt) campGoal.zoneAt += d;
  };
})();
/* the dome over a shielded boss, cracked while it's down */
(() => {
  const draw = drawBoss;
  window.drawBoss = function (view, ts) {
    draw.apply(this, arguments);
    if (!boss || boss.beaten || !boss.obj || !boss.shielded) return;
    const up = bossShieldUp(ts), c = boss.obj.color;
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(ts / 160);
    boss.cells.forEach((cell0, i) => {
      const [x, y] = view.toScreen(cell0.x, cell0.y);
      if (up) {
        ctx.globalAlpha = 0.16 + 0.1 * pulse;
        ctx.fillStyle = c; ctx.fillRect(x - 2, y - 2, cell + 3, cell + 3);
        ctx.globalAlpha = 0.5 + 0.2 * pulse;
        ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1.5, y - 1.5, cell + 2, cell + 2);
      } else if (i === 0 && Math.floor(ts / 140) % 2) {
        ctx.globalAlpha = 0.7; ctx.strokeStyle = "#fff"; ctx.setLineDash([3, 3]); ctx.strokeRect(x - 2, y - 2, cell + 4, cell + 4);
      }
    });
    // beams from lit pylons to the dome
    if (up && boss.obj.kind === "pylons") {
      const [hx, hy] = view.toScreen(boss.cells[0].x, boss.cells[0].y);
      campObjs.filter(o => o.kind === "pylon" && o.on).forEach(o => {
        const [px, py] = view.toScreen(o.x, o.y);
        ctx.globalAlpha = 0.5; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(px + cell / 2, py + cell / 2); ctx.lineTo(hx + cell / 2, hy + cell / 2); ctx.stroke();
      });
    }
    ctx.restore();
  };
})();

/* The words for the boss plate and the objective card */
function bossObjLine(ts = performance.now()) {
  if (!boss || !boss.obj) return "";
  const O = boss.obj;
  if (bossOpenNow(ts)) return "Shield down! Strike it!";
  const lead = boss.shielded ? "Shield up. " : "";
  if (boss.objState !== "active") return `${lead}${O.hint || ""}`;
  if (O.kind === "pylons") { const on = campObjs.filter(o => o.kind === "pylon" && o.on).length; return `${lead}Crystals ${on} of ${O.n}${O.secs ? ` (${Math.max(0, Math.ceil((boss.objDeadline - ts) / 1000))}s)` : ""}${O.ordered ? ", in order" : ""}`; }
  if (O.kind === "beacons") { const on = campObjs.filter(o => o.kind === "beacon" && ts < o.litUntil).length; return `${lead}Lamps lit ${on} of ${O.n}`; }
  if (O.kind === "lure") return `${lead}${O.mark === "pool" ? "Pools" : "Snares"} crossed ${boss.objHits} of ${O.n}`;
  if (O.kind === "bait") return `${lead}Fruit gobbled ${boss.objHits} of ${O.n}`;
  return lead;
}
const bossObjText = bossObjLine;

/* ===== New goals ===== */
Object.assign(GOAL_LABEL, {
  beacons: (n, g) => `Light ${n} lamps at once`,
  hold: n => `Hold the ring for ${n} seconds`,
  haul: n => `Deliver ${n} ${n === 1 ? "pouch" : "pouches"}`
});
(() => {
  const setup = campSetupGoal;
  window.campSetupGoal = function (def, mods) {
    setup.apply(this, arguments);
    const g = campGoal;
    if (!g) return;
    if (g.type === "beacons") objSpots("beacon", g.need, 2).forEach(p => campObjs.push({ kind: "beacon", x: p.x, y: p.y, litUntil: 0, goal: true }));
    if (g.type === "hold") { g.have = 0; holdZone(true); }
    if (g.type === "haul") { g.have = 0; g.carry = false; haulSpawn(); }
  };
  const progress = goalProgress;
  window.goalProgress = function () {
    const g = campGoal;
    if (g && g.type === "beacons") { const on = campObjs.filter(o => o.kind === "beacon" && performance.now() < o.litUntil).length; return { f: Math.min(1, on / g.need), text: `${on} / ${g.need} lit` }; }
    if (g && g.type === "hold") return { f: Math.min(1, g.have / g.need), text: `${Math.floor(g.have)} / ${g.need} s` };
    if (g && g.type === "haul") return { f: Math.min(1, g.have / g.need), text: g.carry ? `${g.have} / ${g.need}: to the drop-off!` : `${g.have} / ${g.need}` };
    if (g && g.type === "boss" && boss && boss.obj) { const p = progress.apply(this, arguments); return Object.assign(p, { text: bossObjLine() || p.text }); }
    return progress.apply(this, arguments);
  };
  const met = goalMet;
  window.goalMet = function () {
    const g = campGoal;
    if (g && g.type === "beacons") { const lamps = campObjs.filter(o => o.kind === "beacon" && o.goal); return lamps.length >= g.need && lamps.every(o => performance.now() < o.litUntil); }
    if (g && g.type === "hold") return g.have >= g.need;
    if (g && g.type === "haul") return g.have >= g.need;
    return met.apply(this, arguments);
  };
  const target = goalTarget;
  window.goalTarget = function () {
    const g = campGoal;
    if (g && ["beacons", "hold", "haul"].includes(g.type)) {
      const want = campObjs.filter(o => (o.kind === "beacon" && o.goal && performance.now() >= o.litUntil) || (g.type === "hold" && o.kind === "zone") || (g.type === "haul" && (g.carry ? o.kind === "dropoff" : o.kind === "pouch")));
      if (!want.length) return null;
      const d = o => Math.abs(o.x - snake.x) + Math.abs(o.y - snake.y);
      want.sort((a, b) => d(a) - d(b));
      const o = want[0], dx = o.x - snake.x, dy = o.y - snake.y;
      return { o, dx, dy, dist: Math.round((Math.abs(dx) + Math.abs(dy)) / cell) };
    }
    return target.apply(this, arguments);
  };
  const touch = touchCampObjs;
  window.touchCampObjs = function (nx, ny) {
    const ts = performance.now();
    for (let i = campObjs.length - 1; i >= 0; i--) {
      const o = campObjs[i];
      if (o.x !== nx || o.y !== ny) continue;
      if (o.kind === "pylon" && !o.on) {
        const O = boss && boss.obj;
        if (O && O.ordered && o.n !== boss.objNext) {
          campObjs.forEach(p => { if (p.kind === "pylon") p.on = false; });
          boss.objNext = 1;
          sfx("bad");
          showToast(`Wrong crystal: that was number ${o.n}. They all go dark.`);
          continue;
        }
        o.on = true; boss.objNext = (boss.objNext || 1) + 1;
        sfx("tick");
      } else if (o.kind === "beacon") {
        const lit = (campGoal && campGoal.type === "beacons" ? campGoal.lit : boss && boss.obj && boss.obj.lit) || 12;
        o.litUntil = ts + lit * 1000;
        o.litAt = ts;
        sfx("tick");
      } else if (o.kind === "pouch" && campGoal && campGoal.type === "haul" && !campGoal.carry) {
        campObjs.splice(i, 1); campGoal.carry = true; sfx("shimmer"); showToast("Got it! Take it to the drop-off.");
        haulDrop(true);
      } else if (o.kind === "dropoff" && campGoal && campGoal.carry) {
        campObjs.splice(i, 1); campGoal.carry = false; campGoal.have++; sfx("medal"); addScore(100 * scoreMultiplier);
        if (campGoal.have < campGoal.need) { showToast(`Delivered! ${campGoal.need - campGoal.have} to go.`); haulSpawn(); } else return true;
      }
    }
    return touch.apply(this, arguments);
  };
  const tickLevel = tickCampLevel;
  window.tickCampLevel = function (ts, delta) {
    tickLevel.apply(this, arguments);
    const g = campGoal;
    if (!g || !campRun) return;
    if (g.type === "hold") tickHold(ts, delta);
    if (g.type === "beacons" || (boss && boss.obj)) {
      // a lamp gutters out: a little warning
      campObjs.forEach(o => { if (o.kind === "beacon" && o.litUntil && ts > o.litUntil) o.litUntil = 0; });
    }
    if (g.type === "haul" && g.carry && !campObjs.some(o => o.kind === "dropoff")) haulDrop(true);
  };
  // a hit that lands drops what you're carrying
  const hurt = noteHurt;
  window.noteHurt = function () {
    hurt.apply(this, arguments);
    if (campRun && campGoal && campGoal.type === "haul" && campGoal.carry) {
      campGoal.carry = false;
      campObjs = campObjs.filter(o => o.kind !== "dropoff");
      campObjs.push({ kind: "pouch", x: snake.x, y: snake.y, back: true });
      showToast("You dropped the pouch!");
    }
  };
})();
function haulSpawn() {
  const s = objSpots("pouch", 1, 6)[0] || campSpot(26);
  if (s) campObjs.push({ kind: "pouch", x: s.x, y: s.y });
}
function haulDrop(show) {
  campObjs = campObjs.filter(o => o.kind !== "dropoff");
  // the drop-off is on the far side
  let best = null, bd = -1;
  for (let k = 0; k < 60; k++) {
    const p = { x: Math.floor(Math.random() * cellsAcross) * cell, y: Math.floor(Math.random() * cellsAcross) * cell };
    if (walls.has(cellKey(p.x, p.y)) || campObjs.some(o => o.x === p.x && o.y === p.y)) continue;
    const d = Math.abs(p.x - snake.x) + Math.abs(p.y - snake.y);
    if (d > bd) { bd = d; best = p; }
  }
  if (best) campObjs.push({ kind: "dropoff", x: best.x, y: best.y });
}
/* The ring: 3 x 3 squares around its middle; it moves each time you've held it a while */
function holdZone(first) {
  const g = campGoal;
  campObjs = campObjs.filter(o => o.kind !== "zone");
  let c = null;
  if (first && (campSpots.hold || []).length) { const s = campSpots.hold[Math.floor(Math.random() * campSpots.hold.length)]; c = { x: s[0] * cell, y: s[1] * cell }; }
  if (!c) {
    for (let k = 0; k < 80 && !c; k++) {
      const p = { x: (2 + Math.floor(Math.random() * (cellsAcross - 4))) * cell, y: (2 + Math.floor(Math.random() * (cellsAcross - 4))) * cell };
      let clear = true;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (walls.has(cellKey(p.x + a * cell, p.y + b * cell))) clear = false;
      if (clear && (Math.abs(p.x - snake.x) + Math.abs(p.y - snake.y)) / cell >= 5) c = p;
    }
  }
  if (!c) c = { x: 10 * cell, y: 10 * cell };
  campObjs.push({ kind: "zone", x: c.x, y: c.y });
  g.zoneHeld = 0;
}
function tickHold(ts, delta) {
  const g = campGoal, z = campObjs.find(o => o.kind === "zone");
  if (!z) return;
  const inside = Math.abs(snake.x - z.x) <= cell && Math.abs(snake.y - z.y) <= cell;
  const dt = delta / 1000;
  if (inside) {
    g.have += dt; g.zoneHeld = (g.zoneHeld || 0) + dt;
    if (g.zoneHeld >= (g.move || 7)) { holdZone(false); showToast("The ring moved!"); sfx("whoosh"); }
  } else g.have = Math.max(0, g.have - dt * (g.decay == null ? 0.35 : g.decay));
}

/* ----- Drawing the pieces ----- */
(() => {
  const draw = drawCampObj;
  window.drawCampObj = function (g, o, x, y, w, ts) {
    const put = (id, glow, dy = 0, s = 1) => {
      g.save(); g.imageSmoothingEnabled = false;
      if (glow) { g.shadowColor = glow; g.shadowBlur = w * 0.7; }
      const size = Math.round(w * s), off = Math.round((w - size) / 2);
      g.drawImage(texCanvas(id), x + off, y + off + dy, size, size);
      g.restore();
    };
    const bob = Math.round(Math.sin(ts / 260 + x) * w * 0.06);
    if (o.kind === "pylon") {
      put(o.on ? "board:pylon-on" : "board:pylon", o.on ? (boss && boss.obj ? boss.obj.color : "#c9a8ff") : null, o.on ? 0 : bob, 1.1);
      if (boss && boss.obj && boss.obj.ordered) {
        g.fillStyle = o.on ? "#1a0a3a" : "#fff";
        g.font = `700 ${Math.round(w * 0.42)}px ${GAME_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(o.n), x + w / 2, y + w * 0.62);
      }
      return;
    }
    if (o.kind === "beacon") {
      const lit = ts < o.litUntil, left = o.litUntil - ts;
      put(lit ? "board:beacon-on" : "board:beacon", lit ? "#ffb040" : null, 0, 1.1);
      if (lit) {
        // how long it has left: a ring that drains, and a flicker in the last seconds
        g.save(); g.strokeStyle = left < 3000 && Math.floor(ts / 120) % 2 ? "#ff6a3a" : "#ffe08a"; g.lineWidth = 2;
        const total = (campGoal && campGoal.type === "beacons" ? campGoal.lit : boss && boss.obj && boss.obj.lit) || 12;
        g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, left / (total * 1000)))); g.stroke(); g.restore();
      }
      return;
    }
    if (o.kind === "mark") { put(o.mark === "pool" ? "board:pool" : "board:snare", null, 0, 1); return; }
    if (o.kind === "pouch") { put("board:pouch", "#ffd23f", bob, 1); return; }
    if (o.kind === "dropoff") {
      const p = 0.5 + 0.5 * Math.sin(ts / 180);
      g.save(); g.fillStyle = `rgba(255,233,160,${0.15 + 0.2 * p})`; g.fillRect(x - w * 0.15, y - w * 0.15, w * 1.3, w * 1.3); g.restore();
      put("board:dropoff", "#ffd23f", 0, 1.1);
      return;
    }
    if (o.kind === "zone") {
      const p = 0.5 + 0.5 * Math.sin(ts / 220), s = (w + 1);
      g.save();
      g.fillStyle = `rgba(255,224,138,${0.12 + 0.08 * p})`; g.fillRect(x - s, y - s, s * 3, s * 3);
      g.strokeStyle = `rgba(255,224,138,${0.55 + 0.3 * p})`; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.strokeRect(x - s + 1, y - s + 1, s * 3 - 2, s * 3 - 2);
      g.restore();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.save(); g.fillStyle = "#8a7a62"; g.fillRect(x + a * s + 3, y + b * s + 3, w - 6, w - 6); g.fillStyle = "#c8b890"; g.fillRect(x + a * s + 3, y + b * s + 3, w - 6, 3); g.restore(); });
      return;
    }
    return draw.apply(this, arguments);
  };
  // what you carry rides on your head
  const hunter = drawHunter;
  window.drawHunter = function (view, ts) {
    hunter.apply(this, arguments);
    if (campRun && campGoal && campGoal.type === "haul" && campGoal.carry) {
      const [x, y] = view.toScreen(snake.x, snake.y);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 6;
      ctx.drawImage(texCanvas("board:pouch"), x + cell * 0.1, y - cell * 0.75, cell * 0.8, cell * 0.8);
      ctx.restore();
    }
  };
})();

/* A board's marks: p pylon, l beacon, m snare/pool, o bait, h ring middle (camp-levels.js reads them) */
(() => {
  const start = campStart;
  window.campStart = function () { campSpots = {}; return start.apply(this, arguments); };
})();

/* In the dark, a lit lamp lights the ground round it (and an unlit one shows as a faint ember, so it can be found) */
(() => {
  const hud = drawMechanicsHud;
  window.drawMechanicsHud = function (now) {
    hud.apply(this, arguments);
    if (!campRun || !nm.dark || !campObjs.some(o => o.kind === "beacon")) return;
    const view = makeView(now);
    ctx.save();
    campObjs.forEach(o => {
      if (o.kind !== "beacon") return;
      const [x, y] = view.toScreen(o.x, o.y), cx = x + cell / 2, cy = y + cell / 2;
      if (now < o.litUntil) {
        const r = cell * 4.2, gr = ctx.createRadialGradient(cx, cy, cell * 0.3, cx, cy, r);
        gr.addColorStop(0, "rgba(255,214,140,0.55)"); gr.addColorStop(1, "rgba(255,170,60,0)");
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(texCanvas("board:beacon-on"), x, y, cell, cell);
      } else {
        ctx.fillStyle = `rgba(255,150,60,${0.35 + 0.25 * Math.sin(now / 300 + o.x)})`; ctx.fillRect(cx - 2, cy - 2, 4, 4);
      }
    });
    ctx.restore();
  };
})();
