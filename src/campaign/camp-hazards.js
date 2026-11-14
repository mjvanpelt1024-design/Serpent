/* =========================================================
   src/campaign/camp-hazards.js
   Build 56: eight new hazards and six new power-ups, on the same entity engine as the rest
   (src/game/flow/entities.js). Each has a TELL before it hurts, so every one can be read and beaten:

     turret    fires along its row or column; a line shows a moment before the shot
     cannon    the same, turning a quarter after every shot
     geyser    bubbles, then erupts in a plus; stand clear while it bubbles
     conveyor  a belt: it shoves you one extra square the way its arrows point
     blade     a saw riding a rail (shown faintly) back and forth
     mine      a plate that starts a short fuse when you step on it: run
     tar       slows you
     crumble   a cracked flagstone: step on it and it goes in a moment, and it's a pit until it mends

   Power-ups: sprout (apples round you), shrink (a shorter tail), boots (a burst of speed), lantern
   (sight in the dark), bell (every enemy dazed for a few seconds), anchor (nothing can push or pull you).

   Where each turns up: the island's file lists it under `hazards` in content/campaign/foes.json
   (HAZARD_ISLANDS below reads it), or a level's board puts it exactly where it wants it:
     4 5 6 7  turrets facing east, south, west, north     8  a cannon     G  a geyser
     E W N Z  belts running east, west, north, south     ~  tar     x  crumble     *  mine     B  a blade (its rail
     is the free squares round it)
   ========================================================= */
"use strict";

const HZ = (CAMP.foes || {}).hazards || {};
const HZ_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];           // east, south, west, north
const hzSprite = (type, g, x, y, w, rot = 0) => {
  if (!TextureLoader.has("foe:" + type)) return;
  g.save(); g.imageSmoothingEnabled = false;
  if (rot) { g.translate(x + w / 2, y + w / 2); g.rotate(rot * Math.PI / 2); g.translate(-w / 2, -w / 2); g.drawImage(texCanvas("foe:" + type), 0, 0, w, w); }
  else g.drawImage(texCanvas("foe:" + type), x, y, w, w);
  g.restore();
};
const hzNum = (id, key, d) => (HZ[id] && HZ[id][key] != null ? HZ[id][key] : d);
const bodyOnly = (x, y) => snake.cells.slice(1).some(c => c.x === x && c.y === y);

FOE_CAUSE_TEXT.turret = "A turret shot you."; FOE_CAUSE_TEXT.cannon = "A cannon shot you."; FOE_CAUSE_TEXT.geyser = "A geyser scalded you.";
FOE_CAUSE_TEXT.blade = "A saw blade cut you."; FOE_CAUSE_TEXT.mine = "A mine blew up."; FOE_CAUSE_TEXT.briar = "The briar pricked you.";
WARD_OF.turret = "bolt"; WARD_OF.cannon = "bolt"; WARD_OF.geyser = "heat"; WARD_OF.blade = "ground"; WARD_OF.briar = "sting";

/* Every square along a line from (x, y), a step at a time, until a wall or the edge */
function hzLane(x, y, dx, dy, max = 30) {
  const out = [];
  for (let k = 1; k <= max; k++) {
    const nx = x + dx * k * cell, ny = y + dy * k * cell;
    if (!inBoard(nx, ny) || walls.has(cellKey(nx, ny)) || rocks.some(r => covers(r, nx, ny))) break;
    out.push({ x: nx, y: ny });
  }
  return out;
}
/* A hit on whatever of you is in these squares: the head hurts, the body is robbed. Returns true if the run ended. */
function hzStrike(squares, cause, hearts, steal, ts) {
  if (starOn() || feverOn()) return false;
  if (squares.some(p => headAt(p.x, p.y))) {
    if (wardOn(WARD_OF[cause] || "bolt", ts)) { showToast("It glanced off."); return false; }
    sfx("flea");
    return takeHit(hearts, cause);
  }
  if (steal && squares.some(p => bodyOnly(p.x, p.y))) { campSteal(steal, ""); return false; }
  return false;
}

Object.assign(ENTITY_TYPES, {
  turret: {
    kind: "hazard", color: "#b0a090", label: "Turret", placed: true, passable: true, fact: "turrets fire along a line; the line shows first",
    tick(e, ts) {
      if (e.dir == null) { e.dir = e.dir0 != null ? e.dir0 : Math.floor(Math.random() * 4); e.nextAt = ts + 1800 + Math.random() * 1800; }
      if (e.fireAt) {
        if (ts < e.fireAt) return;
        e.fireAt = 0; e.flash = ts;
        const lane = hzLane(e.x, e.y, HZ_DIRS[e.dir][0], HZ_DIRS[e.dir][1]);
        e.lane = lane;
        sfx("fire");
        hzStrike(lane, "turret", 0.5, 80, ts);
        e.nextAt = ts + hzNum("turret", "every", 3600);
        return;
      }
      if (ts >= e.nextAt && !wardOn("sting", ts)) { e.fireAt = ts + hzNum("turret", "warn", 850); e.tell = ts; }
    },
    touch() { return false; },
    draw(g, x, y, w, ts, e) { hzLaneDraw(g, e, x, y, w, ts); hzSprite("turret", g, x, y, w, e.dir || 0); }
  },
  cannon: {
    kind: "hazard", color: "#8a7a6a", label: "Cannon", placed: true, passable: true, fact: "cannons turn a quarter after every shot",
    tick(e, ts) {
      if (e.dir == null) { e.dir = e.dir0 != null ? e.dir0 : Math.floor(Math.random() * 4); e.nextAt = ts + 2200 + Math.random() * 1500; }
      if (e.fireAt) {
        if (ts < e.fireAt) return;
        e.fireAt = 0; e.flash = ts;
        const lane = hzLane(e.x, e.y, HZ_DIRS[e.dir][0], HZ_DIRS[e.dir][1]);
        e.lane = lane;
        sfx("fire"); buzz(15);
        hzStrike(lane, "cannon", 1, 120, ts);
        e.dir = (e.dir + 1) % 4;
        e.nextAt = ts + hzNum("cannon", "every", 4200);
        return;
      }
      if (ts >= e.nextAt && !wardOn("sting", ts)) { e.fireAt = ts + hzNum("cannon", "warn", 1000); e.tell = ts; }
    },
    touch() { return false; },
    draw(g, x, y, w, ts, e) { hzLaneDraw(g, e, x, y, w, ts); hzSprite("cannon", g, x, y, w, e.dir || 0); }
  },
  geyser: {
    kind: "hazard", color: "#9ad8ff", label: "Geyser", placed: true, passable: true, floor: true, fact: "geysers bubble, then scald in a plus",
    tick(e, ts) {
      if (!e.nextAt) e.nextAt = ts + 1500 + Math.random() * 2500;
      if (e.state === "rumble") {
        if (ts < e.erupt) return;
        e.state = "erupt"; e.upUntil = ts + 650; sfx("molasses");
        const cs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => ({ x: e.x + a * cell, y: e.y + b * cell }));
        e.plus = cs;
        hzStrike(cs, "geyser", 0.5, 60, ts);
      } else if (e.state === "erupt") {
        if (ts >= e.upUntil) { e.state = null; e.nextAt = ts + hzNum("geyser", "every", 4400); }
      } else if (ts >= e.nextAt && !wardOn("heat", ts)) { e.state = "rumble"; e.erupt = ts + hzNum("geyser", "warn", 1100); }
    },
    touch() { return false; },
    draw(g, x, y, w, ts, e) {
      hzSprite("geyser", g, x, y, w);
      const k = (w + 1) / cell;
      if (e.state === "rumble") {
        g.save(); g.fillStyle = `rgba(190,235,255,${0.25 + 0.2 * Math.sin(ts / 50)})`; g.fillRect(x + 2, y + 2 + Math.sin(ts / 40) * 1.5, w - 4, w - 4);
        g.fillStyle = "rgba(255,255,255,0.7)"; for (let i = 0; i < 3; i++) g.fillRect(x + 4 + i * 4, y + w - 5 - ((ts / 60 + i * 5) % 8), 2, 2);
        g.restore();
      } else if (e.state === "erupt") {
        g.save();
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { g.fillStyle = a || b ? "rgba(210,240,255,0.7)" : "rgba(255,255,255,0.9)"; g.fillRect(x + a * (w + 1), y + b * (w + 1), w, w); });
        g.restore();
      }
    }
  },
  conveyor: {
    kind: "hazard", color: "#8a8f98", label: "Conveyor", placed: true, passable: true, floor: true, fact: "belts shove you one extra square along their arrows",
    touch(e) { if (campRun && !wardOn("anchor")) campRun.beltPush = { dx: HZ_DIRS[e.dir || 0][0] * cell, dy: HZ_DIRS[e.dir || 0][1] * cell }; return false; },
    draw(g, x, y, w, ts, e) {
      const d = e.dir == null ? 0 : e.dir;
      hzSprite("conveyor", g, x, y, w, d);
      // the arrows run
      const ph = (ts / 90) % 1;
      g.save(); g.globalAlpha = 0.5; g.fillStyle = "#ffe08a";
      const c = w / 2, o = (ph - 0.5) * w * 0.8;
      if (d % 2 === 0) g.fillRect(x + c + o * (d === 0 ? 1 : -1) - 1, y + c - 1, 3, 3); else g.fillRect(x + c - 1, y + c + o * (d === 1 ? 1 : -1) - 1, 3, 3);
      g.restore();
    }
  },
  blade: {
    kind: "hazard", color: "#c9d1db", label: "Saw blade", placed: true, passable: true, fact: "saw blades ride a rail back and forth",
    tick(e, ts) {
      if (!e.rail) {
        // the rail: the free run of squares around it, along whichever way is longer
        const run = (dx, dy) => { let a = 0; for (let k = 1; k <= 4; k++) { const x = e.x + dx * k * cell, y = e.y + dy * k * cell; if (!inBoard(x, y) || walls.has(cellKey(x, y))) break; a = k; } return a; };
        const h = run(-1, 0) + run(1, 0), v = run(0, -1) + run(0, 1);
        e.axis = h >= v ? [1, 0] : [0, 1];
        e.lo = run(-e.axis[0], -e.axis[1]); e.hi = run(e.axis[0], e.axis[1]);
        e.pos = 0; e.way = 1; e.rail = true; e.moveAt = ts + 700; e.home = { x: e.x, y: e.y };
      }
      if (ts < e.moveAt) return;
      e.moveAt = ts + hzNum("blade", "ms", 300);
      let np = e.pos + e.way;
      if (np > e.hi || np < -e.lo) { e.way = -e.way; np = e.pos + e.way; }
      e.fromX = e.x; e.fromY = e.y; e.hopAt = ts;
      e.pos = np;
      e.x = e.home.x + e.axis[0] * np * cell; e.y = e.home.y + e.axis[1] * np * cell;
      if (headAt(e.x, e.y)) { sfx("flea"); takeHit(1, "blade"); }
      else if (bodyOnly(e.x, e.y)) campSteal(100, "");
    },
    touch(e) { if (wardOn("ground")) return false; sfx("flea"); return takeHit(1, "blade"); },
    draw(g, x, y, w, ts, e) {
      if (e.rail && e.axis) {
        const k = (w + 1) / cell, ax = e.axis;
        g.save(); g.globalAlpha *= 0.3; g.fillStyle = "#4a4a52";
        const x0 = x - ax[0] * (e.pos + e.lo) * (w + 1), y0 = y - ax[1] * (e.pos + e.lo) * (w + 1), n = e.lo + e.hi + 1;
        if (ax[0]) g.fillRect(x0, y + w / 2 - 1, n * (w + 1) - 1, 3); else g.fillRect(x + w / 2 - 1, y0, 3, n * (w + 1) - 1);
        g.restore();
      }
      g.save(); g.translate(x + w / 2, y + w / 2); g.rotate(ts / 90); g.translate(-w / 2, -w / 2);
      g.imageSmoothingEnabled = false; if (TextureLoader.has("foe:blade")) g.drawImage(texCanvas("foe:blade"), 0, 0, w, w);
      g.restore();
    }
  },
  mine: {
    kind: "hazard", color: "#7a7a82", label: "Mine", placed: true, passable: true, floor: true, fact: "step on a mine and you have a moment to run",
    tick(e, ts) { if (e.armed && !e.blown && ts >= e.blowAt) { e.size = 1; explode(e); } },
    touch(e, ts) { if (!e.armed) { e.armed = true; e.blowAt = ts + hzNum("mine", "fuse", 800); sfx("tick"); } return false; },
    draw(g, x, y, w, ts, e) {
      if (e.blown) { const p = Math.max(0, (e.expiresAt - ts) / 500); g.save(); g.globalAlpha = p; g.fillStyle = "#ffb020"; g.fillRect(x - w, y - w, w * 3 + 2, w * 3 + 2); g.restore(); return; }
      hzSprite("mine", g, x, y, w);
      if (e.armed) { g.save(); g.fillStyle = Math.floor(ts / 70) % 2 ? "#ff3a3a" : "#ffffff"; g.globalAlpha = 0.75; g.fillRect(x + w * 0.35, y + w * 0.35, w * 0.3, w * 0.3); g.restore(); }
    }
  },
  tar: {
    kind: "hazard", color: "#2a2430", label: "Tar", placed: true, passable: true, floor: true, fact: "tar slows you down",
    touch(e, ts) { fx.slowFactor = 1.7; fx.slowUntil = Math.max(fx.slowUntil, ts) + 1300; return false; },
    draw(g, x, y, w, ts, e) { hzSprite("tar", g, x, y, w); if (Math.sin(ts / 400 + e.x * 0.3 + e.y) > 0.9) { g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x + w * 0.3, y + w * 0.3, 2, 2); } }
  },
  crumble: {
    kind: "hazard", color: "#9a8a72", label: "Cracked floor", placed: true, passable: true, floor: true, fact: "cracked flagstones fall away a moment after you step on them",
    tick(e, ts) {
      if (e.crackAt && !e.pit && ts >= e.crackAt) { e.pit = true; e.mendAt = ts + hzNum("crumble", "mend", 7000); sfx("rock"); }
      if (e.pit && ts >= e.mendAt) { e.pit = false; e.crackAt = 0; }
    },
    touch(e, ts) {
      if (e.pit) {
        if (guardCrash("sinkhole")) return false;
        if (wardOn("ground", ts)) { showToast("The rope held!"); return false; }
        endGame("sinkhole");
        return true;
      }
      if (!e.crackAt) { e.crackAt = ts + hzNum("crumble", "ms", 1300); sfx("tick"); }
      return false;
    },
    draw(g, x, y, w, ts, e) {
      if (e.pit) { g.fillStyle = "#120c08"; g.fillRect(x, y, w, w); g.fillStyle = "#3a2a1a"; g.fillRect(x, y, w, 2); return; }
      hzSprite("crumble", g, x, y, w);
      if (e.crackAt) { const left = e.crackAt - ts; g.fillStyle = `rgba(20,10,0,${0.2 + 0.4 * (1 - left / 1300)})`; g.fillRect(x + (Math.sin(ts / 30) > 0 ? 1 : 0), y, w, w); }
    }
  }
});
function hzLaneDraw(g, e, x, y, w, ts) {
  if (e.dir == null) return;
  const k = (w + 1);
  const d = HZ_DIRS[e.dir];
  if (e.fireAt) {
    // the line it is about to fire along, flickering faster as it nears
    const left = e.fireAt - ts, p = 1 - left / hzNum(e.type, "warn", 900);
    const lane = hzLane(e.x, e.y, d[0], d[1]);
    g.save(); g.fillStyle = `rgba(255,80,60,${0.1 + 0.25 * p * (0.6 + 0.4 * Math.sin(ts / 40))})`;
    lane.forEach(q => g.fillRect(x + (q.x - e.x) / cell * k, y + (q.y - e.y) / cell * k, w, w));
    g.restore();
  } else if (e.flash && ts - e.flash < 200 && e.lane) {
    g.save(); g.fillStyle = `rgba(255,240,160,${0.8 * (1 - (ts - e.flash) / 200)})`;
    e.lane.forEach(q => g.fillRect(x + (q.x - e.x) / cell * k, y + (q.y - e.y) / cell * k + w * 0.3, w, w * 0.4));
    g.restore();
  }
}
["turret", "cannon", "geyser", "conveyor", "blade", "mine", "tar", "crumble"].forEach(k => {
  if (!ENTITY_KEYS.includes(k)) ENTITY_KEYS.push(k);
  if (!HAZARD_SPAWNS.includes(k)) HAZARD_SPAWNS.push(k);
});
/* a belt shoves you after the step that put you on it */
(() => {
  const step = stepSnake;
  window.stepSnake = function (ts) {
    step.apply(this, arguments);
    if (campRun && campRun.beltPush && gameState === "PLAYING") {
      const p = campRun.beltPush; campRun.beltPush = null;
      blowSnake(Math.sign(p.dx), Math.sign(p.dy), ts || performance.now());
    }
  };
  // an anchor refuses any push or pull
  const blow = blowSnake;
  window.blowSnake = function () {
    if (campRun && wardOn("anchor")) { showToast("Anchored! You didn't budge."); sfx("pop"); return; }
    return blow.apply(this, arguments);
  };
})();

/* ===== Power-ups ===== */
const NEW_POWERS = {
  sprout: { color: "#7ee06a", label: "Sprout", said: "A sprout! Apples spring up round you.", fn() {
    let n = 0;
    for (let k = 0; k < 12 && n < 3; k++) {
      const at = freeNear(snake.x, snake.y, 2, 5);
      if (at && !apples.some(a => a.x === at.x && a.y === at.y)) { apples.push({ x: at.x, y: at.y, size: 1, small: false, spawnAt: performance.now() }); n++; }
    }
  } },
  shrink: { color: "#c9a8ff", label: "Shrink potion", said: "A shrink potion! Your tail gets shorter.", fn() {
    snake.maxCells = Math.max(3, snake.maxCells - 4);
    while (snake.cells.length > snake.maxCells) snake.cells.pop();
  } },
  boots: { color: "#ffb040", label: "Boots", said: "Boots! A burst of speed.", fn() { fx.fastUntil = Math.max(fx.fastUntil, performance.now()) + 5000; } },
  lantern: { color: "#ffe08a", label: "Lantern", said: "A lantern! You can see in the dark.", fn() { campRun.glowUntil = Math.max(campRun.glowUntil || 0, performance.now()) + 12000; } },
  bell: { color: "#ffd23f", label: "Bell", said: "A bell! Every enemy is dazed for a few seconds.", fn() {
    const ts = performance.now();
    entities.forEach(e => { if (ENTITY_TYPES[e.type].kind === "hazard" && ENTITY_TYPES[e.type].smash) e.stunUntil = ts + 3500; });
    if (boss && !boss.beaten) boss.stunnedUntil = Math.max(boss.stunnedUntil, ts + 1200);
  } },
  anchor: { color: "#9ab8d8", label: "Anchor", said: "An anchor! Nothing can push or pull you for a while.", fn() { campWard("anchor", 12); } }
};
Object.entries(NEW_POWERS).forEach(([id, P]) => {
  ENTITY_TYPES[id] = {
    kind: "power", color: P.color, label: P.label, life: [8000, 11000], fact: P.said,
    touch(e) {
      removeEntity(e);
      if (!campRun) return false;
      P.fn();
      showToast(P.said);
      runCount("powers");
      sfx("shimmer");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, P.color, ts); foeSprite(id, Math.round(w * 0.8), g, x + w * 0.1, y + w * 0.1); }
  };
  if (!ENTITY_KEYS.includes(id)) ENTITY_KEYS.push(id);
});
Object.assign(POWER_FOR, {
  sprout: ["pilferer", "crow"], shrink: ["blade", "bramble"], boots: ["turret", "cannon", "mine"], lantern: [], bell: ["sentry", "watcher", "leaper", "shadow", "ambusher", "bomber", "knight"],
  anchor: ["gale", "conveyor", "gust"]
});

/* ===== Placing a board's own tiles, and each island's hazards ===== */
let campBoardEnts = [];                      // [x, y, type, dir] from the board's letters
(() => {
  const start = campStart;
  window.campStart = function (isl, n, challengeIdx = -1, nmDef = null) {
    campBoardEnts = [];
    start.apply(this, arguments);
    if (!campRun) return;
    const ts = performance.now();
    campBoardEnts.forEach(([x, y, type, dir]) => {
      if (!ENTITY_TYPES[type]) return;
      const e = { type, x: x * cell, y: y * cell, size: 1, small: false, spawnAt: ts };
      if (dir != null) { e.dir = dir; e.dir0 = dir; }
      entities.push(e);
    });
  };
})();
/* A .level board's letters (camp-levels.js passes them here) */
const BOARD_ENTS = { 4: ["turret", 0], 5: ["turret", 1], 6: ["turret", 2], 7: ["turret", 3], 8: ["cannon", null], G: ["geyser", null], E: ["conveyor", 0], Z: ["conveyor", 1], W: ["conveyor", 2], N: ["conveyor", 3], "~": ["tar", null], x: ["crumble", null], "*": ["mine", null], B: ["blade", null] };

/* the islands' own: HAZARD_ISLANDS = { island: { n: [levels], add: { type: spawn } } } from foes.json */
(() => {
  const orig = campZoneSpawns;
  window.campZoneSpawns = function (isl, n, def, spawns) {
    orig.apply(this, arguments);
    if (def.kind === "boss") return;
    const H = (((CAMP.foes || {}).hazardLevels || {})[isl] || {})[n];
    if (H) Object.entries(H).forEach(([k, v]) => { if (!spawns[k]) spawns[k] = Object.assign({}, v); });
    // answers to the new trouble
    Object.entries(POWER_FOR).forEach(([p, list]) => { if (list.some(k => spawns[k]) && !spawns[p] && NEW_POWERS[p]) spawns[p] = { max: 1, delay: [16000, 26000] }; });
    if ((def.dark) && !spawns.lantern) spawns.lantern = { max: 1, delay: [14000, 20000] };
  };
})();

/* a snare catches an enemy that walks onto it (it's how you learn to lure a boss over one) */
(() => {
  const T = ENTITY_TYPES.trap;
  T.tick = function (e, ts) {
    const foe = entities.find(o => o !== e && o.x === e.x && o.y === e.y && ENTITY_TYPES[o.type].kind === "hazard" && ENTITY_TYPES[o.type].smash);
    if (foe) { foe.stunUntil = ts + 3500; removeEntity(e); sfx("rock"); showToast("A trap snapped shut on one of them!"); }
  };
})();
