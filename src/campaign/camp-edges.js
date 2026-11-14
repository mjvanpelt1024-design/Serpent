/* =========================================================
   src/campaign/camp-edges.js
   Build 56: the board's four sides, each its own kind of edge, and two kinds of tile inside
   the board (one-way gates and linked doors).

   The old engine knows three edges for a whole board: open (wrap), wall and mirror. A level's
   `edges` (content/campaign/islands/*.json) now names each side on its own:

     { "edge": "wrap", "edges": { "right": "stair", "top": { "kind": "link", "to": "left" } } }

   A side not named uses the level's `edge` (wrap = open, wall, mirror). Kinds:

     open     comes out the other side (a loop)
     wall     dead
     mirror   comes out of a random side (the old mirror)
     stair    comes out the other side ONE ROW LOWER (a side) or one column to the right (the top
              and bottom). `shift` changes how far. The board is a spiral: a long way round.
     link     always comes out of one chosen side: `to` is "left" | "right" | "top" | "bottom"
              (heading in from it), `flip` reverses where along that side, `shift` slides it
     bounce   a bumper: the snake turns along the edge instead of leaving (`turn`: "cw", "ccw"
              or "auto", the side with room)
     briar    thorns: half a heart (a piercing hit), then it bounces you like a bumper
     toll     comes out the other side, for a toll: `pay` points (or two tail squares if you
              can't pay)
     tide     the sea washes in and out: open for a while, a wall while it's in (it flashes first)
     lock     a wall until `after` is done ({ apples: n } | { score: n } | { secs: n } | { pieces: n }),
              then it is `then` (open by default)

   Inside the board (a .level file):  > < ^ v   one-way gates (only that way; the other way is a wall)
                                      a b c d   linked doors: touch one and come out just past the
                                                other one with the same letter, still heading the
                                                way you were.
   ========================================================= */
"use strict";

const EDGE_SIDES = ["top", "right", "bottom", "left"];
const EDGE_TIDE = { period: 9000, open: 5600, warn: 1300 };
const EDGE_NAMES = {
  open: ["Open", "comes out the other side"],
  wall: ["Wall", "deadly"],
  mirror: ["Mirror", "comes out a random side"],
  stair: ["Stairs", "comes out the other side one row lower"],
  link: ["Link", "always comes out a chosen side"],
  bounce: ["Bumper", "turns you along the edge"],
  briar: ["Briar", "pricks you, then turns you along the edge"],
  toll: ["Toll", "open, for a price"],
  tide: ["Tide", "open, then a wall, as the sea comes and goes"],
  lock: ["Lock", "a wall until the level says so"]
};
const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };

/* A level's four sides, each { kind, ...its numbers }; from its `edge` and `edges` */
function campEdgeSpec(def) {
  const base = def.edge === "wall" ? "wall" : def.edge === "mirror" ? "mirror" : "open";
  const out = {};
  EDGE_SIDES.forEach(s => {
    let v = (def.edges || {})[s];
    if (v == null) v = base;
    out[s] = typeof v === "string" ? { kind: v } : Object.assign({}, v);
    if (out[s].kind === "wrap") out[s].kind = "open";
  });
  return out;
}
/* Does a level need the side-by-side rules (any side that isn't plain open)? */
const campEdgesPlain = spec => EDGE_SIDES.every(s => spec[s].kind === "open");

/* The words for a level's special sides, for the objective card and the countdown */
function campEdgeLines(def) {
  if (!def || !def.edges) return [];
  const spec = campEdgeSpec(def);
  const lines = [];
  EDGE_SIDES.forEach(s => {
    const k = spec[s].kind;
    if (k === "open" || (k === "wall" && def.edge === "wall") || (k === "mirror" && def.edge === "mirror")) return;
    let t = EDGE_NAMES[k] ? EDGE_NAMES[k][0] : k;
    if (k === "link") t += ` to the ${spec[s].to}${spec[s].flip ? " (flipped)" : ""}`;
    if (k === "toll") t += ` (${spec[s].pay || 60} points)`;
    if (k === "lock") t += ` (${campLockText(spec[s].after)})`;
    lines.push(`${s[0].toUpperCase() + s.slice(1)}: ${t}`);
  });
  return lines;
}
function campLockText(a) {
  if (!a) return "opens when the level says so";
  if (a.apples) return `opens after ${a.apples} apples`;
  if (a.score) return `opens at ${fmtInt(a.score)} points`;
  if (a.secs) return `opens after ${a.secs} seconds`;
  if (a.pieces) return `opens after ${a.pieces} pieces`;
  return "opens when the level says so";
}

/* ----- Live state ----- */
let campEdges = null;       // { top, right, bottom, left } while a campaign level with special sides runs
function campEdgeSetup(def) {
  campEdges = null;
  if (!campRun || !def || !def.edges) return;
  const spec = campEdgeSpec(def);
  if (campEdgesPlain(spec)) return;
  // a little state each side keeps: when its lock opened, its link colors; tides start out of step
  EDGE_SIDES.forEach((s, i) => { spec[s].side = s; if (spec[s].kind === "tide" && spec[s].phase == null) spec[s].phase = i * 3300; });
  campEdges = spec;
}
/* Is a lock's condition met? */
function lockOpen(e) {
  const a = e.after || {};
  if (e._open) return true;
  let ok = false;
  if (a.apples) ok = campRun.apples >= a.apples;
  else if (a.score) ok = score >= a.score;
  else if (a.secs) ok = runMs >= a.secs * 1000;
  else if (a.pieces) ok = !!campGoal && campGoal.have >= a.pieces;
  else ok = !!campGoal && campGoal.type !== "boss" && campGoal.have >= campGoal.need;
  if (ok) { e._open = true; showToast(`The ${e.side} edge unlocked!`); sfx("unlock"); }
  return ok;
}
/* Is a tide edge open right now? */
function tideOpen(e, ts = runMs) {
  const t = (ts + (e.phase || 0)) % EDGE_TIDE.period;
  return t < EDGE_TIDE.open;
}
function tideWarn(e, ts = runMs) {
  const t = (ts + (e.phase || 0)) % EDGE_TIDE.period;
  return (t >= EDGE_TIDE.open - EDGE_TIDE.warn && t < EDGE_TIDE.open) || t >= EDGE_TIDE.period - EDGE_TIDE.warn;
}
/* What a side is doing right now: its kind, as if it were plain (a lock that opened is its `then`) */
function edgeNow(e) {
  if (e.kind === "lock") return lockOpen(e) ? (typeof e.then === "string" ? e.then : (e.then && e.then.kind) || "open") : "wall";
  if (e.kind === "tide") return tideOpen(e) ? "open" : "wall";
  return e.kind;
}

/* ----- The step ----- */
const lastSq = () => boardSize - cell;
const solidAt = (x, y) => {
  const k = walls.get(cellKey(x, y));
  return (k && (k === "red" || k === "purple" || k.startsWith("gate:") || k.startsWith("door:"))) || rocks.some(r => covers(r, x, y)) || snake.cells.some((c, i) => i > 0 && c.x === x && c.y === y);
};
/* The square the head will step onto, and the way it'll be heading, as stepSnake will work them out */
function peekHead() {
  let dx = snake.dx, dy = snake.dy;
  if (turnQueue.length && !onIce()) { dx = turnQueue[0].dx; dy = turnQueue[0].dy; }
  return { dx, dy, x: snake.x + dx, y: snake.y + dy };
}
/* Where a link or stair lands: { x, y, dx, dy } */
function edgeExit(e, side, hx, hy, hdx, hdy) {
  const last = lastSq(), vert = side === "left" || side === "right";
  const along = vert ? hy : hx;
  const shift = (e.shift != null ? e.shift : 1) * cell;
  const wrapA = v => ((v % boardSize) + boardSize) % boardSize;
  if (e.kind === "stair") {
    // the same way on, one row lower (or one column over from the top and bottom)
    if (side === "right") return { x: 0, y: wrapA(hy + shift), dx: hdx, dy: hdy };
    if (side === "left") return { x: last, y: wrapA(hy + shift), dx: hdx, dy: hdy };
    if (side === "bottom") return { x: wrapA(hx + shift), y: 0, dx: hdx, dy: hdy };
    return { x: wrapA(hx + shift), y: last, dx: hdx, dy: hdy };
  }
  if (e.kind === "link") {
    const to = e.to && OPPOSITE[e.to] ? e.to : OPPOSITE[side];
    let a = e.flip ? last - along : along;
    a = wrapA(a + (e.shift || 0) * cell);
    if (to === "left") return { x: 0, y: a, dx: cell, dy: 0 };
    if (to === "right") return { x: last, y: a, dx: -cell, dy: 0 };
    if (to === "top") return { x: a, y: 0, dx: 0, dy: cell };
    return { x: a, y: last, dx: 0, dy: -cell };
  }
  // open: straight across
  if (side === "right") return { x: 0, y: hy, dx: hdx, dy: hdy };
  if (side === "left") return { x: last, y: hy, dx: hdx, dy: hdy };
  if (side === "bottom") return { x: hx, y: 0, dx: hdx, dy: hdy };
  return { x: hx, y: last, dx: hdx, dy: hdy };
}
/* An exit blocked by a wall or rock slides along the side to the next free square, so no edge is a trap */
function edgeFree(ex) {
  if (!solidAt(ex.x, ex.y)) return ex;
  const vert = ex.dx !== 0;
  for (let k = 1; k <= 4; k++) for (const s of [1, -1]) {
    const x = vert ? ex.x : ex.x + s * k * cell, y = vert ? ex.y + s * k * cell : ex.y;
    if (x >= 0 && y >= 0 && x < boardSize && y < boardSize && !solidAt(x, y)) return Object.assign({}, ex, { x, y });
  }
  return ex;
}

/* Which side a step off the board crosses */
const sideOf = (nx, ny) => (nx < 0 ? "left" : nx >= boardSize ? "right" : ny < 0 ? "top" : "bottom");

/* Run the real step with the head moved so it lands on `ex`, heading ex.dx, ex.dy. Turns still waiting on the
   queue (that weren't used to reach the edge) are kept for the steps after, unless the heading changed. */
function stepVia(step, ts, ex, keepQueue, consumed) {
  const rest = keepQueue ? turnQueue.slice(consumed ? 1 : 0) : [];
  rememberStep();                                   // the revive point is where the head really was
  const remember = window.rememberStep;
  window.rememberStep = () => {};
  turnQueue = [];
  snake.dx = ex.dx; snake.dy = ex.dy;
  snake.x = ex.x - ex.dx; snake.y = ex.y - ex.dy;
  try { step(ts); } finally { window.rememberStep = remember; }
  if (gameState === "PLAYING") turnQueue = rest;
}

/* The step, with each side's own rules */
(() => {
  const step = stepSnake;
  window.stepSnake = function (ts = performance.now()) {
    if (!campRun || gameState !== "PLAYING") return step.call(this, ts);
    const run = step;
    // tiles inside the board: one-way gates and linked doors
    const p = peekHead();
    const inside = p.x >= 0 && p.y >= 0 && p.x < boardSize && p.y < boardSize;
    if (inside) {
      const kind = walls.get(cellKey(p.x, p.y));
      if (kind && kind.startsWith("gate:")) {
        if (kind[5] !== dirLetter(p.dx, p.dy)) { if (save.dev.invincible) return run.call(this, ts); if (!guardCrash("wall")) endGame("wall"); return; }
        return run.call(this, ts);
      }
      if (kind && kind.startsWith("door:")) {
        const to = doorPartner(p.x, p.y, kind);
        if (to) {
          const ex = { x: to.x + p.dx, y: to.y + p.dy, dx: p.dx, dy: p.dy };
          // out the far side of the other door; if something's in the way, the door is just a wall
          if (ex.x < 0 || ex.y < 0 || ex.x >= boardSize || ex.y >= boardSize || solidAt(ex.x, ex.y)) { if (!guardCrash("wall")) endGame("wall"); return; }
          sfx("portal");
          const consumed = turnQueue.length && !onIce();
          return stepVia(run, ts, ex, true, consumed);
        }
      }
    }
    if (!campEdges || inside) return run.call(this, ts);
    // off the board: which side, and what is it now?
    const side = sideOf(p.x, p.y), E = campEdges[side];
    let kind = edgeNow(E);
    const consumed = turnQueue.length && !onIce();
    if (kind === "wall") return run.call(this, ts);                 // the engine's own edge mode is "wall": it kills
    if (kind === "mirror") {
      let exit = roll(getTrackValue("compass")) ? null : pickMirrorExit();
      if (exit) { sfx("portal"); save.stats.mirrorWarps++; return stepVia(run, ts, exit, false, consumed); }
      kind = "open";
    }
    if (kind === "bounce" || kind === "briar") {
      if (kind === "briar") {
        sfx("flea");
        if (!roll(getTrackValue("thickhide"))) {
          if (takeHit(0.5, "briar") || gameState !== "PLAYING") return;
        } else showToast("The briar couldn't get through.");
      }
      // turn along the edge; if neither way is free it's a wall after all
      const hd = { dx: p.dx, dy: p.dy };
      const opts = [[hd.dy, hd.dx], [-hd.dy, -hd.dx]].filter(([dx, dy]) => {
        const x = snake.x + dx, y = snake.y + dy;
        return x >= 0 && y >= 0 && x < boardSize && y < boardSize && !solidAt(x, y);
      });
      if (!opts.length) return run.call(this, ts);
      let pick = opts[0];
      const mode = E.turn || "auto";
      if (opts.length > 1) {
        if (mode === "cw") pick = opts.find(([dx, dy]) => dx * -hd.dy + dy * hd.dx > 0) || opts[0];
        else if (mode === "ccw") pick = opts.find(([dx, dy]) => dx * -hd.dy + dy * hd.dx < 0) || opts[0];
        else pick = opts.sort((a, b) => roomAlong(snake.x, snake.y, b[0], b[1]) - roomAlong(snake.x, snake.y, a[0], a[1]))[0];
      }
      sfx("rock");
      E.bumped = performance.now();
      // heading along the edge: the engine steps on from here
      turnQueue = [];
      snake.dx = pick[0]; snake.dy = pick[1];
      return run.call(this, ts);
    }
    // everything left leaves by one side and lands on another (or the same line, across)
    if (kind === "toll") {
      const pay = E.pay || 60;
      if (score >= pay) { score -= pay; showFloat(`-${pay}`, "#ffd23f"); campRun.stolen = (campRun.stolen || 0) + pay; sfx("xp"); }
      else { snake.maxCells = Math.max(3, snake.maxCells - 2); while (snake.cells.length > snake.maxCells) snake.cells.pop(); showToast("You couldn't pay the toll: it took your tail."); sfx("bad"); }
      E.paid = performance.now();
      if (typeof updateHud === "function") updateHud();
      kind = "open";
    }
    if (kind === "open" || kind === "stair" || kind === "link") {
      const hdx = p.dx, hdy = p.dy;
      const probe = kind === "open" ? Object.assign({}, E, { kind: "open" }) : E;
      const ex = edgeFree(edgeExit(probe, side, snake.x, snake.y, hdx, hdy));
      if (kind === "stair" || kind === "link") { E.used = performance.now(); sfx("portal"); }
      save.stats.screenLoops++;
      return stepVia(run, ts, ex, kind !== "link", consumed);
    }
    return run.call(this, ts);
  };
})();
function dirLetter(dx, dy) { return dx > 0 ? "r" : dx < 0 ? "l" : dy > 0 ? "d" : "u"; }
function roomAlong(x, y, dx, dy) {
  let n = 0;
  for (let k = 1; k < 20; k++) {
    const sx = x + dx * k, sy = y + dy * k;
    if (sx < 0 || sy < 0 || sx >= boardSize || sy >= boardSize || solidAt(sx, sy)) break;
    n++;
  }
  return n;
}
function doorPartner(x, y, kind) {
  for (const [k, v] of walls) if (v === kind && k !== cellKey(x, y)) { const [px, py] = k.split(",").map(Number); return { x: px, y: py }; }
  return null;
}

/* ----- Drawing: a strip along each special side, and the tiles inside ----- */
const LINK_COLORS = ["#ff9a3d", "#44d7e8", "#e86bd8", "#9be84a"];
function drawEdges(view, ts) {
  if (!campEdges) return;
  const W = boardSize, t = 5, g = ctx;
  g.save();
  // link pairs share a color: the side it leaves by and the side it comes out of
  const linkOf = {};
  let li = 0;
  EDGE_SIDES.forEach(s => { const e = campEdges[s]; if (e.kind === "link") { e._col = LINK_COLORS[li % LINK_COLORS.length]; li++; linkOf[e.to] = e; } });
  EDGE_SIDES.forEach(s => {
    const e = campEdges[s];
    const kind = edgeNow(e);
    const strip = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const horiz = s === "top" || s === "bottom";
    const len = W;
    const at = (a, b, c, d) => horiz ? [a, s === "top" ? b : W - b - d, c, d] : [s === "left" ? b : W - b - d, a, d, c];
    const bar = (b, d, c) => strip(...at(0, b, len, d), c);
    let base = null;
    if (e.kind === "link" || kind === "link") base = e._col;
    if (e.kind === "lock") base = kind === "wall" ? "#7a8290" : "#3ddc84";
    if (e.kind === "tide") base = kind === "wall" ? (tideWarn(e) && Math.floor(ts / 110) % 2 ? "#ffffff" : "#2c6fb8") : (tideWarn(e) && Math.floor(ts / 110) % 2 ? "#ffd2c0" : "#7fd8ff");
    if (e.kind === "stair") base = "#4fd3c4";
    if (e.kind === "bounce") base = "#ffd23f";
    if (e.kind === "briar") base = "#2f8a2a";
    if (e.kind === "toll") base = "#e8b020";
    if (e.kind === "mirror") base = "#c9a8ff";
    const arrivals = linkOf[s];
    if (e.kind === "wall" || (e.kind !== "wall" && edgeNow(e) === "wall" && (e.kind === "lock" || e.kind === "tide"))) {
      bar(0, t, e.kind === "wall" ? "#b8323a" : base);
      bar(0, 2, e.kind === "wall" ? "#ff5a61" : "rgba(255,255,255,0.55)");
    } else if (base) {
      bar(0, t, base);
      bar(t - 2, 2, "rgba(0,0,0,0.25)");
    }
    // marks along it
    const marks = Math.floor(len / (cell * 2));
    for (let i = 0; i < marks; i++) {
      const a = i * cell * 2 + cell * 0.5 + 2;
      const m = (b, d, c, ww = 3) => strip(...at(a, b, ww, d), c);
      if (e.kind === "stair") {
        // little steps down the way you'll come out
        const k = Math.floor(ts / 160 + i) % 3;
        m(1 + (k === 0 ? 0 : 0), 3, "#e8fffb", 2); m(0, 1, "#1d7a70", 4);
      } else if (e.kind === "bounce") {
        const bump = e.bumped && ts - e.bumped < 220 ? 2 : 0;
        m(1, 2 + bump, "#fff3a8", 4); m(3 + bump, 1, "#a87a10", 4);
      } else if (e.kind === "briar") { m(1, 4, "#1a5a1a", 2); m(0, 2, "#c0e8a0", 1); m(3, 2, "#c0e8a0", 1); }
      else if (e.kind === "toll") { m(1, 3, "#fff0a0", 3); m(2, 1, "#a87a10", 3); }
      else if (e.kind === "tide") { const wv = Math.sin(ts / 260 + i) > 0 ? 1 : 0; m(wv, 2, "rgba(255,255,255,0.6)", 4); }
      else if (e.kind === "lock" && kind === "wall") { m(0, 3, "#2a2e36", 3); m(1, 1, "#ffd23f", 1); }
      else if (e.kind === "link") { const k = (Math.floor(ts / 140) + i) % 4; m(k === 0 ? 3 : 0, 2, "#fff", 2); }
      else if (e.kind === "mirror") { m(1, 2, Math.sin(ts / 200 + i) > 0.3 ? "#fff" : "#8a6ad8", 3); }
    }
    // where a link comes out
    if (arrivals) {
      const dash = Math.floor(ts / 160) % 2;
      for (let i = 0; i < marks; i++) { const a = i * cell * 2 + cell * 0.5 + 2; strip(...at(a + (dash ? 3 : 0), t + 1, 4, 2), arrivals._col); }
      bar(0, 2, arrivals._col);
    }
  });
  g.restore();
}
/* A small label on the end of the strip: a link's partner, a toll's price */
(() => {
  const draw = drawGamePanels;
  window.drawGamePanels = function (view) {
    draw.apply(this, arguments);
    if (campRun && campEdges) { try { drawEdges(view, performance.now()); } catch (e) { /* a missing frame is better than a stopped game */ } }
  };
  const wall = paintWall;
  window.paintWall = function (x, y, kind) {
    if (kind && kind.startsWith && (kind.startsWith("gate:") || kind.startsWith("door:"))) return paintSpecialTile(x, y, kind);
    return wall.apply(this, arguments);
  };
})();

const DOOR_COLORS = { a: "#ff9a3d", b: "#44d7e8", c: "#e86bd8", d: "#9be84a" };
function paintSpecialTile(x, y, kind) {
  const g = ctx, ts = performance.now(), w = cell - 1;
  if (kind.startsWith("gate:")) {
    const d = kind[5];
    g.fillStyle = "#5a4a3a"; g.fillRect(x, y, cell, cell);
    g.fillStyle = "#8a7258"; g.fillRect(x, y, cell, 2); g.fillRect(x, y, 2, cell);
    g.fillStyle = "#c8a45a";
    // an arrow pointing the way it lets you through
    const c = cell / 2, a = 4, p = Math.sin(ts / 220) > 0 ? 1 : 0;
    g.beginPath();
    if (d === "r") { g.moveTo(x + c + 5 + p, y + c); g.lineTo(x + c - 3, y + c - 6); g.lineTo(x + c - 3, y + c + 6); }
    else if (d === "l") { g.moveTo(x + c - 5 - p, y + c); g.lineTo(x + c + 3, y + c - 6); g.lineTo(x + c + 3, y + c + 6); }
    else if (d === "d") { g.moveTo(x + c, y + c + 5 + p); g.lineTo(x + c - 6, y + c - 3); g.lineTo(x + c + 6, y + c - 3); }
    else { g.moveTo(x + c, y + c - 5 - p); g.lineTo(x + c - 6, y + c + 3); g.lineTo(x + c + 6, y + c + 3); }
    g.closePath(); g.fill();
    return;
  }
  const col = DOOR_COLORS[kind[5]] || "#fff";
  g.save();
  g.shadowColor = col; g.shadowBlur = cell * 0.5;
  g.fillStyle = "#2a1a3a"; g.fillRect(x, y, cell, cell);
  g.restore();
  g.fillStyle = col;
  g.fillRect(x + 1, y + 1, w - 1, 2); g.fillRect(x + 1, y + cell - 3, w - 1, 2); g.fillRect(x + 1, y + 1, 2, w - 1); g.fillRect(x + cell - 3, y + 1, 2, w - 1);
  const s = Math.floor(ts / 120) % 4;
  g.fillStyle = "#fff";
  const o = [[6, 6], [11, 6], [11, 11], [6, 11]][s];
  g.fillRect(x + o[0], y + o[1], 3, 3);
  g.fillStyle = col;
  g.fillRect(x + 8, y + 8, 3, 3);
}

/* a campaign run's own bookkeeping */
(() => {
  const leave = campLeaveRun;
  window.campLeaveRun = function () { campEdges = null; return leave.apply(this, arguments); };
  const start = campStart;
  window.campStart = function (isl, n, challengeIdx = -1, nmDef = null) {
    start.apply(this, arguments);
    if (!campRun) return;
    campEdgeSetup(campRun.def);
    const lines = campEdgeLines(campRun.def);
    if (lines.length) setTimeout(() => { if (campRun && campEdges) showToast(lines.join(" | ")); }, 900);
  };
  const shift = campShiftTimers;
  window.campShiftTimers = function (d) { shift.apply(this, arguments); };
})();
