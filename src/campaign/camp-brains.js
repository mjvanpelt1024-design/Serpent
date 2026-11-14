/* =========================================================
   src/campaign/camp-brains.js
   Build 56: fourteen new ways for an enemy to think. Before this, nearly every enemy chased your head
   (a chaser, a charger that dashed, a drifter...). A "brain" is what an enemy in content/campaign/foes.json
   names as its `kind`; each one needs you to do something different:

     ambusher   aims for where you're GOING, four squares ahead, so running straight on is what it wants
     shadow     walks your exact trail, a touch faster than you: stop and it catches your tail
     mirror     your reflection across the board; when you go right it goes left, and you meet in the middle
     sentry     patrols a line; anything in its sight gets chased for a few seconds, then it goes back
     watcher    only moves while you are NOT looking at it (facing it freezes it to stone)
     orbiter    circles an apple, guarding it, and shoves off to chase you when you step into its ring
     leaper     jumps (a knight's L, or three in a line) onto the square it has just marked
     burrower   tunnels under the ground; cracks open where you'll be, rises for a moment, and dives
     sleeper    asleep until you eat an apple near it (or brush past), then hunts for a while and dozes off
     pilferer   steals apples off the board and runs; catch it and it drops points (it never hurts)
     pincer     comes in a pack from different sides and closes the ring
     bomber     keeps its distance and lobs bombs where you are heading
     gale       sits still and every few seconds sucks (or blows) you a square along the line to it
     tailbiter  goes for your tail, not your head

   Every one of them still bites the head and steals from the body like the older enemies do (`bite`, `steal`
   in foes.json), takes your weapons by its own immune/resist/weak lists, and shows its tell before it acts.
   A brain is { tick(id) -> fn(e, ts), draw?, touch?, spawn?(def) -> fn(e, ts), edge?: comes in from an edge }.
   ========================================================= */
"use strict";

/* ----- Where you've been: the shadow walks it ----- */
let brainTrail = [];          // your head's squares this level, oldest first
let brainBase = 0;            // how many have been dropped off the front (an index stays an index)
(() => {
  const tick = tickMechanics;
  window.tickMechanics = function (ts) {
    tick.apply(this, arguments);
    if (!campRun || gameState !== "PLAYING") return;
    const l = brainTrail[brainTrail.length - 1];
    if (!l || l.x !== snake.x || l.y !== snake.y) {
      brainTrail.push({ x: snake.x, y: snake.y });
      if (brainTrail.length > 2400) { brainTrail.splice(0, 600); brainBase += 600; }
    }
  };
  const start = campStart;
  window.campStart = function () { brainTrail = []; brainBase = 0; return start.apply(this, arguments); };
  // eating an apple wakes the sleepers nearby
  const eat = eatApple;
  window.eatApple = function () {
    const r = eat.apply(this, arguments);
    if (campRun) entities.forEach(e => { const B = e.sleeper; if (B && e.asleep && Math.abs(e.x - snake.x) + Math.abs(e.y - snake.y) <= (FOES[e.type].hear || 7) * cell) brainWake(e, performance.now()); });
    return r;
  };
})();
function brainWake(e, ts) {
  e.asleep = false;
  e.wakeAt = ts + 600;
  e.awakeUntil = ts + (FOES[e.type].awake || 6500);
  e.tell = ts;
  sfx("bad");
}

/* ----- small helpers ----- */
const cellsAway = (e, x, y) => (Math.abs(e.x - x) + Math.abs(e.y - y)) / cell;
const headDist = e => cellsAway(e, snake.x, snake.y);
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const insideB = (x, y) => x >= 0 && y >= 0 && x < boardSize && y < boardSize;
/* A free square at least d squares from the head, for things that don't come in from an edge */
function farSpot(d = 7) {
  const set = occupiedSet();
  for (let k = 0; k < 80; k++) {
    const x = Math.floor(Math.random() * cellsAcross) * cell, y = Math.floor(Math.random() * cellsAcross) * cell;
    if (!insideB(x, y) || set.has(cellKey(x, y)) || walls.has(cellKey(x, y))) continue;
    if ((Math.abs(x - snake.x) + Math.abs(y - snake.y)) / cell < d) continue;
    return { x, y };
  }
  return null;
}
/* Is the line between two squares in a row or column clear of walls? */
function lineClear(x1, y1, x2, y2) {
  const dx = sgn(x2 - x1) * cell, dy = sgn(y2 - y1) * cell;
  if ((dx && dy) || (!dx && !dy)) return false;
  let x = x1 + dx, y = y1 + dy;
  for (let k = 0; k < 40 && (x !== x2 || y !== y2); k++) { if (walls.has(cellKey(x, y)) || rocks.some(r => covers(r, x, y))) return false; x += dx; y += dy; }
  return true;
}
const hopTo = (e, to, ts) => { beastStep(e, ts); e.x = to.x; e.y = to.y; };
const faint = (g, x, y, w, c) => { g.fillStyle = c; g.fillRect(x, y, w, w); };
/* a "!" over an enemy that has just noticed you, "z" over one that's asleep */
function sign(g, x, y, w, text, color) {
  g.save();
  g.fillStyle = color;
  g.font = `700 ${Math.max(7, Math.round(w * 0.7))}px ${GAME_FONT}`;
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillText(text, x + w / 2, y - 1);
  g.restore();
}
/* draws squares of the board (world squares) as tinted boxes: telegraphs. x, y is the entity's own screen
   position, so another world square sits at the same offset, scaled by how big the squares are drawn */
function tellSquare(g, e, x, y, w, wx, wy, color, a = 0.35) {
  const k = (w + 1) / cell;
  const sx = x + (wx - e.x) * k, sy = y + (wy - e.y) * k;
  g.save(); g.globalAlpha *= a; g.fillStyle = color; g.fillRect(sx, sy, w, w); g.restore();
}
const eMs = (def, d) => (def.ms || d) * (wardOn("sting") ? 1.6 : 1);
const calmWander = (e, ts) => chaseStep(e, e.x + (Math.random() < 0.5 ? cell : -cell), e.y + (Math.random() < 0.5 ? cell : -cell), 1);

const BRAINS = {
  /* aims where you're going */
  ambusher: {
    edge: true,
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 800;
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + eMs(def, 480);
      if (enemyCalm(ts)) { calmWander(e, ts); return; }
      const lead = def.lead || 4;
      let tx = snake.x + sgn(snake.dx) * cell * lead, ty = snake.y + sgn(snake.dy) * cell * lead;
      tx = Math.max(0, Math.min(boardSize - cell, tx)); ty = Math.max(0, Math.min(boardSize - cell, ty));
      // close in, it goes straight for you
      if (headDist(e) <= 3 || walls.has(cellKey(tx, ty))) { tx = snake.x; ty = snake.y; }
      e.aim = { x: tx, y: ty };
      chaseStep(e, tx, ty, def.wobble || 0.05);
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts) { if (e.aim && !enemyCalm(ts)) tellSquare(g, e, x, y, w, e.aim.x, e.aim.y, "#ff5a3a", 0.18 + 0.1 * Math.sin(ts / 120)); }
  },

  /* walks your trail, a little faster than you walk it */
  shadow: {
    spawn: def => function (e, ts) {
      const delay = def.lag || 9;
      const i = Math.max(0, brainTrail.length - 1 - delay);
      const p = brainTrail[i];
      if (p && brainTrail.length > delay + 2 && !headAt(p.x, p.y) && !bodyAt(p.x, p.y)) { e.x = p.x; e.y = p.y; e.idx = brainBase + i; }
      else { const s = farSpot(9); if (s) { e.x = s.x; e.y = s.y; } e.idx = null; }
    },
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + moveInterval * (def.rate || 0.9) * (wardOn("sting") ? 1.5 : 1);
      if (enemyCalm(ts)) { calmWander(e, ts); return; }
      // no trail to walk yet (it came in from afar): head for the trail's oldest square
      if (e.idx == null) { const p = brainTrail[0]; if (p && !chaseStep(e, p.x, p.y, 0)) calmWander(e, ts); if (p && e.x === p.x && e.y === p.y) e.idx = brainBase; enemyLanded(e, def); return; }
      const at = e.idx - brainBase;
      const p = brainTrail[Math.max(0, Math.min(brainTrail.length - 1, at))];
      if (!p) return;
      if (e.x === p.x && e.y === p.y) e.idx++;
      else if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > cell * 2) {
        // it was knocked off the trail (walls, a hop): back to the nearest square of it
        let best = 0, bd = 1e9;
        for (let i = Math.max(0, at - 6); i < Math.min(brainTrail.length, at + 12); i++) { const d = Math.abs(brainTrail[i].x - e.x) + Math.abs(brainTrail[i].y - e.y); if (d < bd) { bd = d; best = i; } }
        e.idx = brainBase + best;
      }
      const q = brainTrail[Math.max(0, Math.min(brainTrail.length - 1, e.idx - brainBase))];
      if (q && (e.x !== q.x || e.y !== q.y)) { beastStep(e, ts); e.x = q.x; e.y = q.y; e.idx++; }
      enemyLanded(e, def);
    },
  },

  /* your reflection */
  mirror: {
    edge: true,
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + eMs(def, 190);
      if (enemyCalm(ts)) { calmWander(e, ts); return; }
      const ax = def.axis || "x";
      const tx = ax === "y" ? snake.x : boardSize - cell - snake.x;
      const ty = ax === "x" ? snake.y : boardSize - cell - snake.y;
      e.reflect = { x: tx, y: ty };
      if (e.x === tx && e.y === ty) { enemyLanded(e, def); return; }
      if (!chaseStep(e, tx, ty, 0)) return;
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts) { g.save(); g.globalAlpha *= 0.9; g.strokeStyle = "rgba(190,170,255,0.7)"; g.strokeRect(x - 1, y - 1, w + 2, w + 2); g.restore(); }
  },

  /* patrols a line; sees along it; chases a few seconds; goes back to patrolling */
  sentry: {
    spawn: def => function (e, ts) { const s = farSpot(8); if (s) { e.x = s.x; e.y = s.y; } const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)]; e.fx = d[0]; e.fy = d[1]; },
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (e.fx == null) { e.fx = 1; e.fy = 0; }
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < (e.stunUntil || 0)) return;
      const sight = def.sight || 6;
      // does it see you? along the way it faces, close enough, nothing in between (or you're right beside it)
      const sees = !enemyCalm(ts) && ((headDist(e) <= 2) || (lineClear(e.x, e.y, snake.x, snake.y) && sgn(snake.x - e.x) === e.fx && sgn(snake.y - e.y) === e.fy && headDist(e) <= sight));
      if (sees && ts >= (e.alertUntil || 0) && !e.alert) { e.alert = true; e.alertUntil = ts + (def.chase || 3800); e.tell = ts; e.moveAt = ts + 350; sfx("bad"); }
      if (e.alert && ts >= e.alertUntil) { e.alert = false; e.moveAt = ts + 600; }
      if (ts < e.moveAt) return;
      if (e.alert) {
        e.moveAt = ts + eMs(def, 520) * 0.62;
        chaseStep(e, snake.x, snake.y, 0);
        if (Math.abs(snake.x - e.x) >= Math.abs(snake.y - e.y)) { e.fx = sgn(snake.x - e.x) || e.fx; e.fy = 0; } else { e.fy = sgn(snake.y - e.y) || e.fy; e.fx = 0; }
        enemyLanded(e, def);
        return;
      }
      e.moveAt = ts + eMs(def, 560);
      let to = stepOpen(e.x + e.fx * cell, e.y + e.fy * cell);
      if (!to || (entities.some(o => o !== e && o.x === to.x && o.y === to.y && ENTITY_TYPES[o.type].kind === "hazard"))) {
        // at a wall it turns a quarter, clockwise: it paces a loop
        const t = e.fx; e.fx = -e.fy; e.fy = t;
        to = stepOpen(e.x + e.fx * cell, e.y + e.fy * cell);
        if (!to) { e.fx = -e.fx; e.fy = -e.fy; return; }
      }
      hopTo(e, to, ts);
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts, def) {
      // the sight line: a faint strip along the way it's facing
      const sight = (def && def.sight) || 6;
      g.save();
      g.globalAlpha *= e.alert ? 0.3 : 0.14;
      g.fillStyle = e.alert ? "#ff4a3a" : "#ffe08a";
      const k = (w + 1) / cell;
      for (let i = 1; i <= sight; i++) {
        const wx = e.x + e.fx * cell * i, wy = e.y + e.fy * cell * i;
        if (!insideB(wx, wy) || walls.has(cellKey(wx, wy))) break;
        g.fillRect(x + (wx - e.x) * k, y + (wy - e.y) * k, w, w);
      }
      g.restore();
      if (e.alert && ts - e.tell < 1400) sign(g, x, y, w, "!", "#ff5a4a");
    }
  },

  /* frozen while you face it */
  watcher: {
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 1000;
      // watched: you're heading toward it, within a wide cone
      const vx = e.x - snake.x, vy = e.y - snake.y;
      const dot = vx * sgn(snake.dx) + vy * sgn(snake.dy);
      const perp = Math.abs(vx * sgn(snake.dy)) + Math.abs(vy * sgn(snake.dx));
      e.watched = !enemyCalm(ts) && dot > 0 && perp <= Math.max(cell, dot * 0.9);
      if (ts < e.moveAt || ts < (e.stunUntil || 0) || enemyCalm(ts)) return;
      if (e.watched) { e.moveAt = ts + 120; return; }
      e.moveAt = ts + eMs(def, 300);
      chaseStep(e, snake.x, snake.y, 0.05);
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts) {
      if (e.watched) { g.save(); g.fillStyle = "rgba(200,205,215,0.5)"; g.fillRect(x, y, w, w); g.restore(); }
    }
  },

  /* circles an apple; chases when you cross its ring */
  orbiter: {
    spawn: def => function (e, ts) { const s = farSpot(5); if (s) { e.x = s.x; e.y = s.y; } },
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) { e.moveAt = ts + 900; e.dir = Math.random() < 0.5 ? 1 : -1; }
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      const R = def.radius || 2;
      if (!e.anchor || !apples.includes(e.anchor)) {
        const live = apples.filter(a => !a.rotten);
        e.anchor = live.length ? live.slice().sort((a, b) => (Math.abs(a.x - e.x) + Math.abs(a.y - e.y)) - (Math.abs(b.x - e.x) + Math.abs(b.y - e.y)))[0] : null;
      }
      if (enemyCalm(ts) || !e.anchor) { e.moveAt = ts + 500; calmWander(e, ts); return; }
      // you're inside its ring: it breaks off to chase you for a moment
      const a = e.anchor, rd = Math.max(Math.abs(snake.x - a.x), Math.abs(snake.y - a.y)) / cell;
      if (rd <= R + 0.5 && ts >= (e.chaseUntil || 0) + 1500) { e.chaseUntil = ts + 2200; e.tell = ts; }
      if (ts < (e.chaseUntil || 0)) { e.moveAt = ts + eMs(def, 260) * 0.7; chaseStep(e, snake.x, snake.y, 0); enemyLanded(e, def); return; }
      e.moveAt = ts + eMs(def, 280);
      // step round the square ring of radius R: the next square of the ring clockwise
      const cx = a.x, cy = a.y, ringR = R * cell;
      const ring = [];
      for (let i = -R; i <= R; i++) ring.push([cx + i * cell, cy - ringR]);
      for (let i = -R + 1; i <= R; i++) ring.push([cx + ringR, cy + i * cell]);
      for (let i = R - 1; i >= -R; i--) ring.push([cx + i * cell, cy + ringR]);
      for (let i = R - 1; i > -R; i--) ring.push([cx - ringR, cy + i * cell]);
      let k = ring.findIndex(p => p[0] === e.x && p[1] === e.y);
      if (k < 0) { chaseStep(e, ring[0][0], ring[0][1], 0); e.ringAt = null; enemyLanded(e, def); return; }
      for (let tries = 1; tries <= ring.length; tries++) {
        const p = ring[((k + e.dir * tries) % ring.length + ring.length) % ring.length];
        const to = stepOpen(p[0], p[1]);
        if (to && Math.abs(to.x - e.x) + Math.abs(to.y - e.y) <= cell * 2) { hopTo(e, to, ts); break; }
      }
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts, def) {
      if (!e.anchor || enemyCalm(ts)) return;
      const R = (def && def.radius) || 2, k = (w + 1) / cell;
      g.save(); g.globalAlpha *= 0.28 + 0.1 * Math.sin(ts / 200); g.strokeStyle = "#ffe08a"; g.setLineDash([3, 3]);
      g.strokeRect(x + (e.anchor.x - R * cell - e.x) * k, y + (e.anchor.y - R * cell - e.y) * k, (2 * R + 1) * cell * k - 1, (2 * R + 1) * cell * k - 1);
      g.restore();
    }
  },

  /* jumps onto the square it has marked: a knight's L, or three straight */
  leaper: {
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 1100;
      if (ts < (e.stunUntil || 0)) return;
      // landing: the marked square, a beat after it was marked
      if (e.jumpTo) {
        if (ts < e.jumpAt) return;
        const to = e.jumpTo; e.jumpTo = null; e.moveAt = ts + eMs(def, 1100);
        e.fromX = e.x; e.fromY = e.y; e.hopAt = ts; e.hopLen = 380; e.x = to.x; e.y = to.y; e.arc = ts;
        if (!enemyLanded(e, def) && (def.shake || 0) && headDist(e) <= 2) buzz(15);
        return;
      }
      if (ts < e.moveAt) return;
      if (enemyCalm(ts)) { e.moveAt = ts + 700; calmWander(e, ts); return; }
      const line = (def.pattern || "knight") === "line";
      let cands = [];
      if (line) {
        // three squares straight along the axis it is most off by (it hops when you're lined up and near, otherwise creeps)
        const dx = snake.x - e.x, dy = snake.y - e.y;
        const d = Math.abs(dx) >= Math.abs(dy) ? [sgn(dx), 0] : [0, sgn(dy)];
        for (let n = 3; n >= 2 && !cands.length; n--) { const p = stepOpen(e.x + d[0] * cell * n, e.y + d[1] * cell * n); if (p) cands.push(p); }
        if (!cands.length || headDist(e) > 9) { e.moveAt = ts + 520; chaseStep(e, snake.x, snake.y, 0.2); enemyLanded(e, def); return; }
      } else {
        [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, b]) => {
          const p = stepOpen(e.x + a * cell, e.y + b * cell);
          if (p && !entities.some(o => o !== e && o.x === p.x && o.y === p.y)) cands.push(p);
        });
      }
      if (!cands.length) { e.moveAt = ts + 600; return; }
      cands.sort((a, b) => (Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)) - (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)));
      e.jumpTo = Math.random() < 0.75 ? cands[0] : cands[Math.min(cands.length - 1, 1)];
      e.jumpAt = ts + (def.warn || 650);
      e.tell = ts;
    },
    draw(g, e, x, y, w, ts) {
      if (e.jumpTo) {
        const p = 0.5 + 0.5 * Math.sin(ts / 70);
        tellSquare(g, e, x, y, w, e.jumpTo.x, e.jumpTo.y, "#ff3a3a", 0.25 + 0.3 * p);
        g.save(); g.globalAlpha *= 0.5; g.strokeStyle = "#ff8a7a"; g.strokeRect(x + (e.jumpTo.x - e.x) * (w + 1) / cell, y + (e.jumpTo.y - e.y) * (w + 1) / cell, w, w); g.restore();
      }
    },
    lift(e, ts) {
      // a little hop while it's in the air
      if (e.arc && ts - e.arc < 380) return -Math.round(Math.sin((ts - e.arc) / 380 * Math.PI) * 7);
      return 0;
    }
  },

  /* under the ground: ripples, a crack where you'll be, a moment up, down again */
  burrower: {
    spawn: def => function (e, ts) { const s = farSpot(8); if (s) { e.x = s.x; e.y = s.y; } e.state = "under"; e.moveAt = ts + 1200; e.dust = []; },
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.state) { e.state = "under"; e.moveAt = ts + 1200; e.dust = []; }
      if (ts < (e.stunUntil || 0)) return;
      if (e.state === "under") {
        if (ts < e.moveAt) return;
        e.moveAt = ts + eMs(def, 360);
        if (enemyCalm(ts)) { e.dust.push({ x: e.x, y: e.y, t: ts }); chaseStep(e, e.x + cell, e.y, 1); return; }
        e.dust.push({ x: e.x, y: e.y, t: ts }); if (e.dust.length > 7) e.dust.shift();
        // dug in close enough, it picks where you'll be and cracks the ground there
        if (headDist(e) <= (def.reach || 4) && ts >= (e.cool || 0)) {
          const lead = 2;
          let tx = snake.x + sgn(snake.dx) * cell * lead, ty = snake.y + sgn(snake.dy) * cell * lead;
          const to = stepOpen(tx, ty) || stepOpen(snake.x, snake.y);
          if (to) { e.state = "warn"; e.target = to; e.warnAt = ts + (def.warn || 800); e.tell = ts; sfx("rock"); return; }
        }
        // under ground it passes through everything but the board's edge
        const dx = sgn(snake.x - e.x) * cell, dy = sgn(snake.y - e.y) * cell;
        const opt = (Math.abs(snake.x - e.x) > Math.abs(snake.y - e.y) || !dy) && dx ? [dx, 0] : [0, dy];
        const x = e.x + opt[0], y = e.y + opt[1];
        if (insideB(x, y) && !walls.has(cellKey(x, y))) { beastStep(e, ts); e.x = x; e.y = y; }
      } else if (e.state === "warn") {
        if (ts < e.warnAt) return;
        e.x = e.target.x; e.y = e.target.y; e.state = "up"; e.upUntil = ts + (def.up || 1500); e.hopAt = 0;
        sfx("rock"); buzz(25);
        // it breaks the surface under the head or the body: that's a bite or a theft
        if (headAt(e.x, e.y)) biteHead(e, def);
        else if (bodyAt(e.x, e.y)) { campSteal(def.steal || 100, def.name); e.stunUntil = ts + 600; }
      } else if (e.state === "up") {
        if (ts < e.upUntil) return;
        e.state = "under"; e.cool = ts + 2200; e.moveAt = ts + 500; e.dust = [];
      }
    },
    touch(e, ts, def) {
      if (e.state !== "up") return false;                                // under the ground, nothing to touch
      biteHead(e, def);
      return gameState !== "PLAYING";
    },
    draw(g, e, x, y, w, ts, def) {
      const k = (w + 1) / cell;
      if (e.state === "up") { g.save(); g.fillStyle = "#4a3422"; g.fillRect(x - 1, y + w * 0.62, w + 2, w * 0.4); g.restore(); return false; }
      // ripples: a trail of dirt behind it; cracks on the square it has picked
      (e.dust || []).forEach((d, i) => { g.save(); g.globalAlpha *= 0.15 + i * 0.05; g.fillStyle = "#6b4a2a"; g.fillRect(x + (d.x - e.x) * k + 3, y + (d.y - e.y) * k + 5, w - 6, w - 8); g.restore(); });
      g.save(); g.fillStyle = "#6b4a2a"; g.globalAlpha *= 0.8; g.fillRect(x + 3, y + w - 5, w - 6, 3); g.fillRect(x + 6, y + w - 8, w - 12, 3); g.restore();
      if (e.state === "warn") {
        const t = e.target, p = (ts - e.tell) / (def.warn || 800);
        g.save(); g.strokeStyle = `rgba(60,30,10,${0.5 + 0.4 * Math.sin(ts / 60)})`; g.lineWidth = 2;
        const sx = x + (t.x - e.x) * k, sy = y + (t.y - e.y) * k;
        g.beginPath(); g.moveTo(sx + 3, sy + 4); g.lineTo(sx + w * 0.5, sy + w * 0.5); g.lineTo(sx + w - 3, sy + 3); g.moveTo(sx + w * 0.5, sy + w * 0.5); g.lineTo(sx + w * 0.4, sy + w - 3); g.stroke();
        g.fillStyle = `rgba(255,90,60,${0.18 + 0.4 * p})`; g.fillRect(sx, sy, w, w);
        g.restore();
      }
      return true;     // hides the sprite
    }
  },

  /* dozing until something wakes it */
  sleeper: {
    spawn: def => function (e, ts) { const s = farSpot(7); if (s) { e.x = s.x; e.y = s.y; } e.asleep = true; e.sleeper = true; },
    tick: id => function (e, ts) {
      const def = FOES[id];
      e.sleeper = true;
      if (e.asleep === undefined) e.asleep = true;
      if (e.asleep) {
        // brushing past wakes it too
        if (!enemyCalm(ts) && headDist(e) <= (def.nudge || 2)) brainWake(e, ts);
        return;
      }
      if (ts < (e.wakeAt || 0) || ts < (e.stunUntil || 0)) return;
      if (ts >= e.awakeUntil) { e.asleep = true; return; }
      if (!e.moveAt || ts >= e.moveAt) {
        e.moveAt = ts + eMs(def, 330);
        if (enemyCalm(ts)) { calmWander(e, ts); return; }
        chaseStep(e, snake.x, snake.y, 0.05);
        enemyLanded(e, def);
      }
    },
    draw(g, e, x, y, w, ts) {
      if (e.asleep) {
        g.save(); g.fillStyle = "rgba(20,24,40,0.35)"; g.fillRect(x, y, w, w); g.restore();
        const p = (ts / 900) % 1;
        sign(g, x + w * 0.55 + p * 4, y - p * w * 0.6, w * 0.8, "z", `rgba(210,225,255,${1 - p})`);
      } else if (ts - (e.tell || 0) < 700) sign(g, x, y, w, "!", "#ff5a4a");
    },
    dim: e => (e.asleep ? 0.7 : 1)
  },

  /* steals apples; harmless; catch it for points */
  pilferer: {
    edge: true,
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + eMs(def, 330) * (e.loaded ? 0.8 : 1);
      if (enemyCalm(ts)) { calmWander(e, ts); return; }
      if (e.loaded) {
        // away from you, out the nearest edge
        const dx = sgn(e.x - snake.x) * cell, dy = sgn(e.y - snake.y) * cell;
        const edgeD = [e.x, boardSize - cell - e.x, e.y, boardSize - cell - e.y];
        const k = edgeD.indexOf(Math.min(...edgeD));
        if (edgeD[k] === 0) { removeEntity(e); showToast("The thief got away with the apple."); return; }
        const tx = [-cell, boardSize, e.x, e.x][k], ty = [e.y, e.y, -cell, boardSize][k];
        const step = [[sgn(tx - e.x) * cell, 0], [0, sgn(ty - e.y) * cell]].filter(([a, b]) => a || b);
        for (const [a, b] of step) { const to = stepOpen(e.x + a, e.y + b); if (to) { hopTo(e, to, ts); return; } }
        calmWander(e, ts);
        return;
      }
      const live = apples.filter(a => !a.rotten);
      if (!live.length) { calmWander(e, ts); return; }
      // the apple it can reach first (and that you can't, if it can help it)
      live.sort((a, b) => ((Math.abs(a.x - e.x) + Math.abs(a.y - e.y)) - (Math.abs(b.x - e.x) + Math.abs(b.y - e.y))) + ((Math.abs(a.x - snake.x) + Math.abs(a.y - snake.y)) < (Math.abs(b.x - snake.x) + Math.abs(b.y - snake.y)) ? 20 : -20));
      const a = live[0];
      if (!chaseStep(e, a.x, a.y, 0.1)) calmWander(e, ts);
      if (e.x === a.x && e.y === a.y) {
        const i = apples.indexOf(a); if (i >= 0) apples.splice(i, 1);
        maintainApples();
        e.loaded = true;
        showToast("A thief snatched an apple! Catch it before it gets away.");
        sfx("flea");
      }
    },
    touch(e, ts, def) {
      // your head on it: caught
      removeEntity(e);
      sfx("medal");
      addScore((def.bounty || 150) * scoreMultiplier);
      campBonusEvent("kill");
      showFloat(`+${def.bounty || 150}`, "#ffd23f");
      if (e.loaded) { const s = campSpot(0); if (s) apples.push({ x: s.x, y: s.y, size: 1, small: false, spawnAt: performance.now() }); }
      return false;
    },
    draw(g, e, x, y, w, ts) { if (e.loaded) { g.save(); g.fillStyle = "#e0262e"; g.fillRect(x + w * 0.62, y - 2, 4, 4); g.fillStyle = "#3aa83a"; g.fillRect(x + w * 0.72, y - 3, 2, 2); g.restore(); } }
  },

  /* a pack that surrounds */
  pincer: {
    edge: true,
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) { e.moveAt = ts + 900; const mates = entities.filter(o => o.type === id); e.slot = (mates.indexOf(e) + 4) % 4; }
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + eMs(def, 400);
      if (enemyCalm(ts)) { calmWander(e, ts); return; }
      // each of the pack takes a square three off your head, a different side each: when they're all there they close in
      const off = [[0, -3], [3, 0], [0, 3], [-3, 0]][e.slot || 0];
      const mates = entities.filter(o => o.type === id);
      const settled = mates.every(m => Math.abs(m.x - (snake.x + [[0, -3], [3, 0], [0, 3], [-3, 0]][m.slot || 0][0] * cell)) + Math.abs(m.y - (snake.y + [[0, -3], [3, 0], [0, 3], [-3, 0]][m.slot || 0][1] * cell)) <= cell * 3);
      let tx = snake.x + off[0] * cell, ty = snake.y + off[1] * cell;
      tx = Math.max(0, Math.min(boardSize - cell, tx)); ty = Math.max(0, Math.min(boardSize - cell, ty));
      e.closing = settled && mates.length > 1;
      if (e.closing || headDist(e) <= 3) { tx = snake.x; ty = snake.y; }
      chaseStep(e, tx, ty, def.wobble || 0.05);
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts) { if (e.closing) { g.save(); g.fillStyle = "rgba(255,70,50,0.3)"; g.fillRect(x - 1, y - 1, w + 2, w + 2); g.restore(); } }
  },

  /* keeps away and lobs bombs where you're going */
  bomber: {
    spawn: def => function (e, ts) { const s = farSpot(7); if (s) { e.x = s.x; e.y = s.y; } },
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) { e.moveAt = ts + 900; e.throwAt = ts + 2500; }
      if (ts < (e.stunUntil || 0)) return;
      // the wind-up, then the bomb lands three squares ahead of you
      if (e.windAt) {
        if (ts < e.windAt) return;
        e.windAt = 0;
        const bombs = entities.filter(o => o.type === "bomb").length;
        if (bombs < (def.maxBombs || 3)) {
          const ahead = [3, 4, 2].map(n => ({ x: snake.x + sgn(snake.dx) * cell * n, y: snake.y + sgn(snake.dy) * cell * n })).map(p => stepOpen(p.x, p.y)).find(p => p && !headAt(p.x, p.y) && !bodyAt(p.x, p.y) && !entities.some(o => o.x === p.x && o.y === p.y));
          const at = ahead || freeNear(snake.x, snake.y, 2, 4);
          if (at) { dropEntity("bomb", at, ts, 6500); sfx("fire"); }
        }
        e.throwAt = ts + between(def.every, [3200, 5000]);
        return;
      }
      if (!enemyCalm(ts) && ts >= e.throwAt && headDist(e) <= 12) { e.windAt = ts + 520; e.tell = ts; return; }
      if (ts < e.moveAt) return;
      e.moveAt = ts + eMs(def, 520);
      const d = headDist(e);
      // it keeps a distance: away when you're close, nearer when you're far, otherwise it ambles
      if (d < 5) chaseStep(e, e.x + sgn(e.x - snake.x) * cell * 2, e.y + sgn(e.y - snake.y) * cell * 2, 0.2);
      else if (d > 9) chaseStep(e, snake.x, snake.y, 0.3);
      else calmWander(e, ts);
      enemyLanded(e, def);
    },
    draw(g, e, x, y, w, ts) { if (e.windAt) { sign(g, x, y - 1, w, "!", "#ffb040"); g.save(); g.fillStyle = "#2a2a30"; g.fillRect(x + w * 0.3, y - 4 - Math.abs(Math.sin(ts / 70)) * 2, w * 0.4, w * 0.35); g.restore(); } }
  },

  /* sits still and tugs you in */
  gale: {
    spawn: def => function (e, ts) { const s = farSpot(6); if (s) { e.x = s.x; e.y = s.y; } },
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.nextAt) e.nextAt = ts + 2500 + Math.random() * 2000;
      if (e.blowIn) {
        if (ts < e.blowIn) return;
        e.blowIn = 0;
        // a pull (or push) one square along the line to it
        const dx = e.x - snake.x, dy = e.y - snake.y;
        let mx, my;
        if (Math.abs(dx) >= Math.abs(dy)) { mx = sgn(dx); my = 0; } else { mx = 0; my = sgn(dy); }
        if (def.push) { mx = -mx; my = -my; }
        if (mx || my) blowSnake(mx, my, ts);
        e.nextAt = ts + between(def.every, [4200, 6200]);
        return;
      }
      if (ts < e.nextAt || enemyCalm(ts) || ts < (e.stunUntil || 0)) return;
      if (headDist(e) <= (def.range || 11)) { e.blowIn = ts + (def.warn || 900); e.tell = ts; sfx("whoosh"); } else e.nextAt = ts + 1500;
    },
    touch(e, ts, def) { biteHead(e, def); return gameState !== "PLAYING"; },
    draw(g, e, x, y, w, ts, def) {
      if (!e.blowIn) return;
      // chevrons running along the line to you (or away from you, for a push): where the tug will go
      const dx = snake.x - e.x, dy = snake.y - e.y, k = (w + 1) / cell;
      const horiz = Math.abs(dx) >= Math.abs(dy), s = sgn(horiz ? dx : dy) * (def.push ? -1 : 1);
      const len = Math.min(5, Math.max(2, Math.round((horiz ? Math.abs(dx) : Math.abs(dy)) / cell)));
      g.save(); g.strokeStyle = "#e6f6ff"; g.lineWidth = 2;
      for (let i = 0; i < len; i++) {
        const ph = ((ts / 110 + i) % len) / len;
        const d = (ph * len + 0.5) * cell * k * s;
        const cx = x + w / 2 + (horiz ? d : 0), cy = y + w / 2 + (horiz ? 0 : d);
        g.globalAlpha = 0.3 + 0.4 * (1 - ph);
        g.beginPath();
        if (horiz) { g.moveTo(cx - s * 3, cy - 4); g.lineTo(cx, cy); g.lineTo(cx - s * 3, cy + 4); } else { g.moveTo(cx - 4, cy - s * 3); g.lineTo(cx, cy); g.lineTo(cx + 4, cy - s * 3); }
        g.stroke();
      }
      g.restore();
    }
  },

  /* goes for your tail */
  tailbiter: {
    edge: true,
    tick: id => function (e, ts) {
      const def = FOES[id];
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + eMs(def, 380);
      if (enemyCalm(ts)) { calmWander(e, ts); return; }
      const tail = snake.cells[snake.cells.length - 1] || snake;
      chaseStep(e, tail.x, tail.y, def.wobble || 0.1);
      enemyLanded(e, def);
    }
  }
};
