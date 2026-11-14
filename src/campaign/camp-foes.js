/* =========================================================
   src/campaign/camp-foes.js
   Enemies, hazards and power-ups (build 51), on the old entity engine
   (src/game/flow/entities.js), drawn as 12 x 12 pixel sprites
   (textures/foes/, textures/hazards/, textures/powerups/).

   Enemies come in two kinds of trouble: a THIEF steals a set number of
   points when it touches your body (never half your score any more),
   a BITER hurts when it meets your head; some do both. Each island has
   its own, and a few are copies with stronger numbers:
     bee > wasp > yellow jacket   thieves on the body, a sting to the head
     imp (Spire)       blinks next to you; a magic sting goes through armor
     mole (Hollow)     pops out of the ground; never chases
     crab (Reef)       scuttles along a row, pinching
     wisp (Crown)      drifts after you, dropping embers
     the rival snake   any island, on a timer: wanders after an apple
                       the long way round, eats it and leaves (or leaves
                       when you get there first). Bonk it with your head:
                       a heart through armor. It runs into you: it's gone.
   Hazards fit their island: embers on the Keep and in the Hollow (half a
   heart), acid on the Spire (through armor), frost and ice on the Reef
   (half a heart and slow), fire and lava on the Crown (fire: half a heart
   through armor and a burst of speed). Traps can turn up on any island
   but only on certain levels, and every island shares the same zones:
   its rim crumbles into sinkholes, the merchant's ice box leaks
   popsicles, and the climb to the last lair gathers storms, more
   lightning at every level up. The map shows each zone (map-isles cues
   at the bottom of this file). Power-ups follow the trouble: where
   there are stings there's honey, where there's fire there's water.
   ========================================================= */
"use strict";

/* ----- Sprites: 12 x 12 PNGs, foe:<type> in textures/index.json -----
   enemies in textures/foes/, hazards in textures/hazards/, power-ups in textures/powerups/ */
const foeSprite = (type, w, g, x, y, alpha = 1) => {
  if (!TextureLoader.has("foe:" + type)) return;
  g.imageSmoothingEnabled = false;
  if (alpha !== 1) g.globalAlpha *= alpha;
  g.drawImage(texCanvas("foe:" + type), x, y, w, w);
};

/* What a hit is called on the result card */
const FOE_CAUSE_TEXT = {
  bee: "A bee stung you.", yellowjacket: "A yellow jacket stung you.", imp: "An imp hexed you.", mole: "A mole bit you.",
  crab: "A crab pinched you.", wisp: "A wisp burned you.", ember: "Embers burned you.", acid: "You slid into acid.",
  frost: "Frost bit you.", lava: "You fell in the lava.", trap: "A trap snapped shut.", rivalbonk: "You bonked heads with the rival snake."
};
/* Which hits each ward stops: heat, cold, stings (all enemies), lightning, the ground, magic */
const WARD_OF = {
  fire: "heat", ember: "heat", lava: "heat", wisp: "heat",
  frost: "cold", poison: "cold", ice: "cold",
  bee: "sting", wasp: "sting", yellowjacket: "sting", flea: "sting", crab: "sting", mole: "sting", imp: "sting", ghost: "sting", hunter: "sting",
  lightning: "bolt", sinkhole: "ground", trap: "ground", acid: "magic"
};
const wardOn = (kind, ts = performance.now()) => !!(campRun && campRun.wards && ts < (campRun.wards[kind] || 0));
function campWard(kind, secs) {
  campRun.wards = campRun.wards || {};
  campRun.wards[kind] = Math.max(campRun.wards[kind] || 0, performance.now()) + secs * 1000;
}

/* ----- A thief's take: a set number of points, bigger on higher islands ----- */
function campSteal(base, who) {
  if (!campRun) return;
  if (runeVal("stingGuard") && roll(runeVal("stingGuard"))) { showToast("It missed!"); return; }
  const isl = campRun.islandN || 1;
  let n = Math.round(base * (1 + (isl - 1) * 0.35) * (1 - Math.min(90, runeVal("thiefGuard")) / 100));
  n = Math.min(n, Math.max(0, Math.floor(score)));
  if (n <= 0) return;
  score -= n;
  campRun.stolen = (campRun.stolen || 0) + n;
  showFloat(`-${fmtInt(n)}`, "#ff6a5a");
  if (who) showToast(`${who} stole ${fmtInt(n)} points!`);
  sfx("flea");
  updateHud();
}
/* A little number floating off the head */
function showFloat(text, color) {
  if (typeof floaters !== "undefined" && Array.isArray(floaters)) floaters.push({ x: snake.x, y: snake.y, text, color, born: performance.now() });
}
/* In the campaign, the old "lose a share of your score" (rocks, fleas, fire) is a set amount too */
(() => {
  const orig = loseScore;
  window.loseScore = function (fraction) {
    if (!campRun) return orig.apply(this, arguments);
    campSteal(Math.round(Math.min(0.99, fraction) * 200), "");
  };
})();

/* ----- Moving things: a step at a time toward a target ----- */
const bodyAt = (x, y) => snake.cells.slice(1).some(c => c.x === x && c.y === y);
const headAt = (x, y) => snake.x === x && snake.y === y;
function stepOpen(x, y) {
  if (edgeMode !== "wall") { x = wrapBoard(x); y = wrapBoard(y); }
  if (!inBoard(x, y) || walls.has(cellKey(x, y)) || huskAt(x, y)) return null;
  return { x, y };
}
/* One square toward (tx, ty); wobble: chance of a step sideways instead */
function chaseStep(e, tx, ty, wobble = 0) {
  const opts = [];
  const sx = stepToward(e.x, tx), sy = stepToward(e.y, ty);
  if (sx) opts.push([sx, 0]);
  if (sy) opts.push([0, sy]);
  if (opts.length === 2 && Math.random() < 0.5) opts.reverse();
  if (!opts.length || Math.random() < wobble) opts.unshift(...[[cell, 0], [-cell, 0], [0, cell], [0, -cell]].sort(() => Math.random() - 0.5).slice(0, 2));
  for (const [dx, dy] of opts) {
    const to = stepOpen(e.x + dx, e.y + dy);
    if (!to) continue;
    if (entities.some(o => o !== e && o.x === to.x && o.y === to.y && ENTITY_TYPES[o.type].kind === "hazard" && !ENTITY_TYPES[o.type].floor)) continue;
    e.fromX = e.x; e.fromY = e.y; e.hopAt = performance.now();
    e.x = to.x; e.y = to.y;
    return true;
  }
  return false;
}
const enemyCalm = ts => wardOn("sting", ts) || (campRun && ts < (campRun.jellyUntil || 0));

/* After moving: did it land on the head (bite) or the body (steal)? */
function enemyLanded(e, def) {
  if (headAt(e.x, e.y)) { biteHead(e, def); return true; }
  if (def.steal && bodyAt(e.x, e.y)) {
    if (campRun && campRun.jellyLeg && performance.now() < (campRun.jellyUntil || 0)) { e.stunUntil = performance.now() + 2500; return false; }
    campSteal(def.steal, def.name);
    // it hops off to get away with it
    e.stunUntil = performance.now() + 1500;
    if (def.oneSteal) removeEntity(e);
    return true;
  }
  return false;
}
function biteHead(e, def) {
  removeEntity(e);
  if (starOn() || feverOn() || fieldOn()) { smashEntity(e); return; }
  // every island enemy meets your gear as a wasp would, but with its own damage rules (build 52)
  const r = campGearMeets(FOES[e.type] ? "wasp" : e.type, e.type);
  if (r === "kill") return;
  if (r === "shove") { shoveAside(e); entities.push(e); return; }
  if (campRun && campRun.wards && campRun.wards.net > 0) { campRun.wards.net--; showToast("The net caught it!"); sfx("pop"); return; }
  sfx("flea");
  takeHit(def.bite, e.type);
}

/* ----- The new entities ----- */
const FOES = {
  /* -- enemies: stingers -- */
  bee: { name: "A bee", steal: 60, bite: 0.5, ms: 520, wobble: 0.15 },
  yellowjacket: { name: "A yellow jacket", steal: 200, bite: 1, ms: 340, wobble: 0.05 },
  imp: { name: "An imp", steal: 100, bite: 0.5 },
  mole: { name: "A mole", steal: 80, bite: 1 },
  crab: { name: "A crab", steal: 150, bite: 0.5, ms: 380 },
  wisp: { name: "A wisp", steal: 150, bite: 0.5, ms: 700 }
};
const chaserTick = type => function (e, ts) {
  const def = FOES[type];
  if (!e.moveAt) e.moveAt = ts + 700;
  if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
  e.moveAt = ts + def.ms * (1 + upPct("enemyward") * 0) * (wardOn("sting", ts) ? 1.6 : 1);
  if (enemyCalm(ts)) { chaseStep(e, e.x + (Math.random() < 0.5 ? cell : -cell), e.y + (Math.random() < 0.5 ? cell : -cell), 1); return; }
  chaseStep(e, snake.x, snake.y, def.wobble || 0);
  enemyLanded(e, def);
};
Object.assign(ENTITY_TYPES, {
  bee: {
    kind: "hazard", color: "#ffd23f", label: "Bee", life: [9000, 13000], smash: true, fact: "bees chase you and steal points from your body",
    tick: chaserTick("bee"),
    touch(e) { biteHead(e, FOES.bee); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts) { foeSprite("bee", w, g, x, y + (Math.sin(ts / 60) > 0 ? -1 : 0)); }
  },
  yellowjacket: {
    kind: "hazard", color: "#ffb020", label: "Yellow jacket", life: [8000, 12000], smash: true, fact: "yellow jackets are fast, sting hard and steal a lot",
    tick: chaserTick("yellowjacket"),
    touch(e) { biteHead(e, FOES.yellowjacket); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts) { foeSprite("yellowjacket", w, g, x, y + (Math.sin(ts / 40) > 0 ? -1 : 0)); }
  },
  imp: {
    kind: "hazard", color: "#a855f7", label: "Imp", life: [10000, 14000], smash: true, fact: "imps blink in beside you; their hex goes through armor",
    tick(e, ts) {
      if (!e.blinkAt) e.blinkAt = ts + 1800;
      if (ts < e.blinkAt || ts < (e.stunUntil || 0)) return;
      e.blinkAt = ts + 2600 + Math.random() * 1600;
      if (enemyCalm(ts)) return;
      // blink to a free square two or three away from the head, then drift one step at it
      const set = occupiedSet();
      for (let k = 0; k < 12; k++) {
        const d = 2 + Math.floor(Math.random() * 2), a = Math.floor(Math.random() * 4);
        const x = snake.x + [d, -d, 0, 0][a] * cell + (a > 1 ? (Math.random() < 0.5 ? cell : -cell) : 0), y = snake.y + [0, 0, d, -d][a] * cell + (a < 2 ? (Math.random() < 0.5 ? cell : -cell) : 0);
        const to = stepOpen(x, y);
        if (!to || set.has(cellKey(to.x, to.y)) || bodyAt(to.x, to.y)) continue;
        e.x = to.x; e.y = to.y; e.blinked = ts;
        sfx("portal");
        return;
      }
    },
    touch(e) { biteHead(e, FOES.imp); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts, e) {
      const fresh = e.blinked && ts - e.blinked < 300;
      if (fresh) { g.fillStyle = "rgba(200,140,255,0.5)"; g.fillRect(x - 2, y - 2, w + 4, w + 4); }
      foeSprite("imp", w, g, x, y + Math.round(Math.sin(ts / 200) * 1));
    }
  },
  mole: {
    kind: "hazard", color: "#7a6a5a", label: "Mole", life: [6000, 6000], fact: "moles pop out of the ground and bite",
    spawn(e, ts) { e.upAt = ts + 1600; },
    tick(e, ts) {
      if (ts < e.upAt) return;
      if (!e.up) { e.up = true; sfx("rock"); if (headAt(e.x, e.y)) biteHead(e, FOES.mole); else if (bodyAt(e.x, e.y)) { campSteal(FOES.mole.steal, FOES.mole.name); removeEntity(e); } }
    },
    touch(e, ts) { if (ts < e.upAt) return false; biteHead(e, FOES.mole); return gameState !== "PLAYING"; },
    passable: true,
    draw(g, x, y, w, ts, e) {
      if (ts < e.upAt) { g.fillStyle = "#6a4a2a"; g.fillRect(x + w * 0.15, y + w * 0.55, w * 0.7, w * 0.35); g.fillStyle = "#8a6a4a"; g.fillRect(x + w * 0.3, y + w * 0.45, w * 0.4, w * 0.15); return; }
      foeSprite("mole", w, g, x, y);
    }
  },
  crab: {
    kind: "hazard", color: "#ff5a3a", label: "Crab", life: [10000, 14000], smash: true, fact: "crabs scuttle along their row and pinch",
    spawn(e) { e.dir = Math.random() < 0.5 ? 1 : -1; },
    tick(e, ts) {
      const def = FOES.crab;
      if (!e.moveAt) e.moveAt = ts + 600;
      if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
      e.moveAt = ts + def.ms;
      // sideways along its row; at an edge or wall it turns round, and now and then steps a row toward you
      if (!enemyCalm(ts) && Math.random() < 0.18 && e.y !== snake.y) { if (chaseStep(e, e.x, snake.y)) { enemyLanded(e, def); return; } }
      const to = stepOpen(e.x + e.dir * cell, e.y);
      if (!to) { e.dir = -e.dir; return; }
      e.fromX = e.x; e.fromY = e.y; e.hopAt = ts; e.x = to.x; e.y = to.y;
      enemyLanded(e, def);
    },
    touch(e) { biteHead(e, FOES.crab); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts) { foeSprite("crab", w, g, x + (Math.sin(ts / 90) > 0 ? 1 : 0), y); }
  },
  wisp: {
    kind: "hazard", color: "#ff8c1a", label: "Wisp", life: [10000, 14000], smash: true, fact: "wisps drift after you and leave embers behind",
    tick(e, ts) {
      const def = FOES.wisp;
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < e.moveAt) return;
      e.moveAt = ts + def.ms;
      const fromX = e.x, fromY = e.y;
      if (enemyCalm(ts)) chaseStep(e, e.x + cell, e.y, 1); else chaseStep(e, snake.x, snake.y, 0.2);
      // an ember where it was, now and then
      if (Math.random() < 0.3 && !headAt(fromX, fromY) && !bodyAt(fromX, fromY) && entities.filter(o => o.type === "ember").length < 6) entities.push({ type: "ember", x: fromX, y: fromY, size: 1, small: true, spawnAt: ts, expiresAt: ts + 4500 });
      enemyLanded(e, def);
    },
    touch(e) { biteHead(e, FOES.wisp); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts) { g.save(); g.shadowColor = "#ffb040"; g.shadowBlur = w * 0.5; foeSprite("wisp", w, g, x, y + Math.round(Math.sin(ts / 150) * 1.5)); g.restore(); }
  },

  /* -- hazards -- */
  ember: {
    kind: "hazard", color: "#ff8c1a", label: "Embers", life: [5000, 8000], smash: true, fact: "embers burn: half a heart",
    touch(e) { removeEntity(e); if (wardOn("heat") || (campRun && performance.now() < (campRun.heatUntil || 0))) return false; if (runeVal("heatWard") && roll(runeVal("heatWard"))) { showToast("Your trinket kept the heat off."); return false; } sfx("fire"); return takeHit(0.5, "ember"); },
    draw(g, x, y, w, ts) { foeSprite("ember", w, g, x, y + (Math.sin(ts / 80) > 0.5 ? -1 : 0)); }
  },
  acid: {
    kind: "hazard", color: "#3ddc84", label: "Acid", life: [9000, 13000], passable: true, floor: true, fact: "acid eats through armor",
    touch(e) { removeEntity(e); if (wardOn("magic")) return false; sfx("molasses"); return takeHit(0.5, "acid"); },
    draw(g, x, y, w, ts) { foeSprite("acid", w, g, x, y); if (Math.sin(ts / 200 + x) > 0.8) { g.fillStyle = "#c8ffd8"; g.fillRect(x + w * 0.4, y + w * 0.2, Math.max(1, w * 0.12), Math.max(1, w * 0.12)); } }
  },
  frost: {
    kind: "hazard", color: "#bfe8ff", label: "Frost", life: [7000, 10000], passable: true, floor: true, fact: "frost bites and slows you down",
    touch(e, ts) {
      removeEntity(e);
      if (wardOn("cold")) return false;
      if (runeVal("coldWard") && roll(runeVal("coldWard"))) { showToast("Your trinket kept the cold off."); return false; }
      fx.slowFactor = 1.5; fx.slowUntil = Math.max(fx.slowUntil, ts) + 2500 * (1 - upPct("shorten"));
      sfx("molasses");
      return takeHit(0.5, "frost");
    },
    draw(g, x, y, w) { g.fillStyle = "rgba(190,232,255,0.35)"; g.fillRect(x, y, w + 1, w + 1); foeSprite("frost", w, g, x, y); }
  },
  lava: {
    kind: "hazard", color: "#ff4a1a", label: "Lava", placed: true, floor: true, passable: true, fact: "lava: a whole heart",
    touch(e, ts) {
      if (ts < (e.cool || 0)) return false;
      e.cool = ts + 1200;
      if (wardOn("heat") || ts < (campRun && campRun.heatUntil || 0)) return false;
      if (runeVal("heatWard") && roll(runeVal("heatWard"))) { showToast("Your trinket kept the heat off."); return false; }
      sfx("fire");
      return takeHit(1, "lava");
    },
    draw(g, x, y, w, ts) { foeSprite("lava", w, g, x, y); if (Math.sin(ts / 180 + y) > 0.85) { g.fillStyle = "#fff0a0"; g.fillRect(x + w * 0.5, y + w * 0.35, Math.max(1, w * 0.1), Math.max(1, w * 0.1)); } }
  },
  trap: {
    kind: "hazard", color: "#9aa3ad", label: "Trap", placed: true, passable: true, fact: "traps snap shut: half a heart, and they hold you a moment",
    touch(e, ts) {
      removeEntity(e);
      if (wardOn("ground")) { showToast("You stepped right over it."); return false; }
      fx.pauseUntil = Math.max(fx.pauseUntil || 0, ts + 600);
      sfx("rock");
      return takeHit(0.5, "trap");
    },
    draw(g, x, y, w) { foeSprite("trap", w, g, x, y); }
  },

  /* -- power-ups that follow the trouble -- */
  honeypot: { kind: "power", color: "#ffd23f", label: "Honey pot", life: [8000, 11000], ward: ["sting", 7], said: "Honey! Enemies would rather have that than you." },
  waterskin: { kind: "power", color: "#3a82e0", label: "Waterskin", life: [8000, 11000], ward: ["heat", 9], said: "A waterskin! Heat can't touch you for a while." },
  mitten: { kind: "power", color: "#7fe3ff", label: "Mittens", life: [8000, 11000], ward: ["cold", 9], said: "Mittens! Cold can't touch you for a while." },
  rod: { kind: "power", color: "#9ad8ff", label: "Lightning rod", life: [8000, 11000], ward: ["bolt", 10], said: "A lightning rod! Bolts go to ground for a while." },
  rope: { kind: "power", color: "#b07a42", label: "Rope", life: [8000, 11000], ward: ["ground", 10], said: "A rope! Traps and sinkholes can't catch you for a while." },
  antidote: { kind: "power", color: "#3ddc3d", label: "Antidote", life: [8000, 11000], ward: ["magic", 9], said: "An antidote! Acid and hexes can't hurt you for a while." },
  net: { kind: "power", color: "#e8e0c8", label: "Net", life: [8000, 11000], net: 1, said: "A net! It catches the next thing that bites at you." }
});
// power-ups share their touch and their look
["honeypot", "waterskin", "mitten", "rod", "rope", "antidote", "net"].forEach(id => {
  const T = ENTITY_TYPES[id];
  T.touch = e => {
    removeEntity(e);
    if (!campRun) return false;
    if (T.ward) campWard(T.ward[0], T.ward[1]);
    if (T.net) { campRun.wards = campRun.wards || {}; campRun.wards.net = (campRun.wards.net || 0) + T.net; }
    showToast(T.said);
    runCount("powers");
    sfx("shimmer");
    return false;
  };
  T.draw = (g, x, y, w, ts) => { powerDisc(g, x, y, w, T.color, ts); foeSprite(id, Math.round(w * 0.8), g, x + w * 0.1, y + w * 0.1); };
});
["bee", "yellowjacket", "imp", "mole", "crab", "wisp", "ember", "acid", "frost", "lava", "trap", "honeypot", "waterskin", "mitten", "rod", "rope", "antidote", "net"].forEach(k => { if (!ENTITY_KEYS.includes(k)) ENTITY_KEYS.push(k); });
/* Chasers come in from the edges, like the old wasps */
(() => {
  const orig = spawnEntity;
  window.spawnEntity = function (type, worldX) {
    if (campRun && ["bee", "yellowjacket", "wisp"].includes(type) && !endless && !maze) {
      const spot = edgeSpot();
      if (!spot) return null;
      const ts = tnow(), t = ENTITY_TYPES[type];
      const e = Object.assign(spot, { type, spawnAt: ts, expiresAt: ts + entityLife(type) });
      if (t.spawn) t.spawn(e, ts);
      entities.push(e);
      return e;
    }
    return orig.apply(this, arguments);
  };
})();

/* ----- The old ones, in the campaign's rules ----- */
(() => {
  // the wasp: steals from your body now, stings your head as before
  const W = ENTITY_TYPES.wasp, wtick = W.tick;
  W.tick = function (e, ts) {
    if (!campRun) return wtick.apply(this, arguments);
    if (enemyCalm(ts)) { if (!e.moveAt || ts >= e.moveAt) { e.moveAt = ts + 520; chaseStep(e, e.x + cell, e.y + cell, 1); } return; }
    const was = [e.x, e.y];
    wtick.apply(this, arguments);
    if ((e.x !== was[0] || e.y !== was[1]) && bodyAt(e.x, e.y) && ts >= (e.stunUntil || 0)) { campSteal(120, "A wasp"); e.stunUntil = ts + 1500; }
  };
  const wdraw = W.draw;
  W.draw = function (g, x, y, w, ts) { if (!campRun) return wdraw.apply(this, arguments); foeSprite("wasp", w, g, x, y + (Math.sin(ts / 50) > 0 ? -1 : 0)); };
  // the sinkhole: a rope saves you
  const S = ENTITY_TYPES.sinkhole, stouch = S.touch;
  S.touch = function (e, ts) { if (campRun && ts >= e.openAt && wardOn("ground", ts)) { showToast("The rope held!"); removeEntity(e); return false; } return stouch.apply(this, arguments); };
  // lightning: a rod sends it to ground
  const L = ENTITY_TYPES.lightning, ltick = L.tick;
  L.tick = function (e, ts) { if (campRun && !e.struck && ts >= e.strikeAt && wardOn("bolt", ts)) { e.struck = true; showToast("Your rod took the bolt."); sfx("fire"); return; } return ltick.apply(this, arguments); };
})();

/* Fire on the Crown: half a heart through armor and a burst of speed. Hits that a ward stops */
(() => {
  const hit = hitHazard;
  window.hitHazard = function (h, ts) {
    if (!campRun || h.type !== "fire") return hit.apply(this, arguments);
    const r = campGearMeets("fire");
    if (r === "shove") { shoveAside(h); hazards.push(h); return false; }
    if (r === "kill") return false;
    fx.fastUntil = Math.max(fx.fastUntil, ts) + FIRE_MS * (1 - upPct("shorten"));
    sfx("fire");
    if (wardOn("heat", ts) || ts < (campRun.heatUntil || 0)) return false;
    if (runeVal("heatWard") && roll(runeVal("heatWard"))) { showToast("Your trinket kept the heat off."); return false; }
    return takeHit(0.5, "fire");
  };
  const guard = campGuardHit;
  window.campGuardHit = function (cause) {
    const w = WARD_OF[cause];
    if (campRun && w && wardOn(w)) { sfx("pop"); return true; }
    if (campRun && w === "sting" && performance.now() < (campRun.jellyUntil || 0)) { sfx("pop"); return true; }
    if (campRun && cause === "lightning" && campRun.peppLeg && performance.now() < (campRun.heatUntil || 0)) return true;
    return guard.apply(this, arguments);
  };
})();

/* ----- The rival snake: any island, on a timer ----- */
let campRival = null;        // { cells, target, moveAt, leaving, born }
const RIVAL_LEN = 5;
function rivalSetup() {
  campRival = null;
  if (!campRun) return;
  const d = campRun.def;
  campRun.rivalAt = d.kind === "boss" || endless || maze ? Infinity : performance.now() + 22000 + Math.random() * 30000;
}
function rivalTarget() {
  const targets = apples.filter(a => !a.rotten).map(a => ({ kind: "apple", ref: a, x: a.x, y: a.y }))
    .concat(campObjs.filter(o => o.kind === "loot").map(o => ({ kind: "loot", ref: o, x: o.x, y: o.y })));
  if (!targets.length) return null;
  return targets[Math.floor(Math.random() * targets.length)];
}
function spawnRival(ts) {
  const spot = edgeSpot();
  const target = rivalTarget();
  if (!spot || !target) { campRun.rivalAt = ts + 8000; return; }
  campRival = { cells: [{ x: spot.x, y: spot.y }], grow: RIVAL_LEN - 1, target, moveAt: ts + 400, leaving: false, born: ts, bonked: 0 };
  showToast("A rival snake slithers in, after your apples!");
  sfx("portal");
}
function tickRival(ts) {
  if (!campRun || campRun.over) return;
  if (!campRival) { if (ts >= (campRun.rivalAt || Infinity)) spawnRival(ts); return; }
  const R = campRival;
  if (ts < R.moveAt) return;
  R.moveAt = ts + moveInterval * 1.35;
  const head = R.cells[0];
  // its target gone (you ate it): it gives up and heads off
  if (!R.leaving && !(R.target.kind === "apple" ? apples.includes(R.target.ref) : campObjs.includes(R.target.ref))) { R.leaving = true; showToast("The rival snake sulks off."); }
  let tx, ty;
  if (R.leaving) {
    // out the nearest edge
    const d = [head.x, boardSize - cell - head.x, head.y, boardSize - cell - head.y];
    const k = d.indexOf(Math.min(...d));
    tx = [-cell * 3, boardSize + cell * 2, head.x, head.x][k]; ty = [head.y, head.y, -cell * 3, boardSize + cell * 2][k];
  } else { tx = R.target.x; ty = R.target.y; }
  // the long way round: a third of its steps wander
  const opts = [];
  const sx = stepToward(head.x, tx), sy = stepToward(head.y, ty);
  if (sx) opts.push([sx, 0]);
  if (sy) opts.push([0, sy]);
  if (Math.random() < 0.33 || !opts.length) opts.unshift(...[[cell, 0], [-cell, 0], [0, cell], [0, -cell]].sort(() => Math.random() - 0.5));
  let moved = false;
  for (const [dx, dy] of opts) {
    const x = head.x + dx, y = head.y + dy;
    const off = x < 0 || y < 0 || x >= boardSize || y >= boardSize;
    if (off && !R.leaving) continue;
    if (!off && (walls.has(cellKey(x, y)) || R.cells.some(c => c.x === x && c.y === y))) continue;
    if (off) { campRival = null; campRun.rivalAt = ts + 30000 + Math.random() * 30000; return; }
    // into you: it's the one that loses
    if (snake.cells.some(c => c.x === x && c.y === y)) {
      campRival = null;
      campRun.rivalAt = ts + 35000 + Math.random() * 30000;
      showToast("The rival snake ran into you and fled for good!");
      sfx("pop");
      addScore(50 * scoreMultiplier);
      return;
    }
    R.cells.unshift({ x, y });
    if (R.grow > 0) R.grow--; else R.cells.pop();
    moved = true;
    break;
  }
  if (!moved) return;
  const h = R.cells[0];
  if (!R.leaving && h.x === R.target.x && h.y === R.target.y) {
    if (R.target.kind === "apple") { const i = apples.indexOf(R.target.ref); if (i >= 0) apples.splice(i, 1); maintainApples(); }
    else { const i = campObjs.indexOf(R.target.ref); if (i >= 0) campObjs.splice(i, 1); }
    R.leaving = true;
    sfx("pop");
    showToast(R.target.kind === "apple" ? "The rival snake ate an apple and is off." : "The rival snake snatched your trinket!");
  }
}
/* Your head runs into it: a heart, straight through armor */
function rivalBonk(nx, ny, ts) {
  if (!campRival || ts < (campRival.bonked || 0)) return false;
  if (!campRival.cells.some(c => c.x === nx && c.y === ny)) return false;
  campRival.bonked = ts + 1200;
  campRival.leaving = true;
  graceUntil = Math.max(graceUntil, ts + 700);
  sfx("rock");
  return takeHit(1, "rivalbonk");
}
function drawRival(view, ts) {
  if (!campRival) return;
  const R = campRival;
  R.cells.forEach((c, i) => {
    const [x, y] = view.toScreen(c.x, c.y);
    const w = cell - 1;
    ctx.fillStyle = i === 0 ? "#3a8a3a" : i % 2 ? "#2f6a2a" : "#4a9a3a";
    ctx.fillRect(x, y, w, w);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y, w, Math.max(1, w * 0.2));
    if (i === 0) {
      ctx.fillStyle = "#fff"; ctx.fillRect(x + w * 0.2, y + w * 0.2, w * 0.25, w * 0.25); ctx.fillRect(x + w * 0.55, y + w * 0.2, w * 0.25, w * 0.25);
      ctx.fillStyle = "#c0201a"; ctx.fillRect(x + w * 0.28, y + w * 0.28, w * 0.12, w * 0.12); ctx.fillRect(x + w * 0.63, y + w * 0.28, w * 0.12, w * 0.12);
      if (R.leaving) { ctx.fillStyle = "rgba(160,200,255,0.8)"; ctx.fillRect(x + w * 0.85, y - w * 0.1, w * 0.15, w * 0.3); }
    }
  });
}

/* ----- Zones: what turns up where on every island ----- */
const ZONES = () => (CAMP.rules.zones || { edge: [2, 3], shop: [6], trap: [8, 9], mountain: [11, 12, 13, 14] });
function zoneOf(n) {
  const Z = ZONES();
  return Object.keys(Z).filter(k => k !== "_about" && Z[k].includes(n));
}
/* What each island adds: its own enemies and hazards, then the zones, then the power-ups that answer them */
const ISLAND_FOES = {
  keep: { swap: { wasp: "bee" } },
  spire: { add: { imp: { max: 1, delay: [7000, 11000] }, acid: { max: 2, delay: [6000, 10000] } }, on: "enemy" },
  hollow: { swap: { fire: "ember" }, add: { mole: { max: 2, delay: [4000, 7000] } }, on: "enemy" },
  reef: { add: { crab: { max: 2, delay: [5000, 8000] }, frost: { max: 2, delay: [6000, 9000] } }, on: "enemy" },
  crown: { swap: { wasp: "yellowjacket" }, add: { wisp: { max: 1, delay: [8000, 12000] } }, on: "enemy", placed: { lava: { count: 3 } } }
};
const POWER_FOR = { honeypot: ["bee", "wasp", "yellowjacket"], waterskin: ["fire", "ember", "lava", "wisp"], mitten: ["frost", "ice", "popsicle"], rod: ["lightning"], rope: ["sinkhole", "trap"], antidote: ["acid", "imp"], net: ["crab", "mole", "flea", "ghost"] };
function campZoneSpawns(isl, n, def, spawns) {
  if (def.kind === "boss") return;
  const F = ISLAND_FOES[isl] || {};
  const endlessLv = def.edge === "endless" || def.layout === "tunnel";
  Object.entries(F.swap || {}).forEach(([a, b]) => { if (spawns[a]) { spawns[b] = spawns[a]; delete spawns[a]; } });
  // build 56: a level marked `exact` is designed spawn by spawn: only the swaps above and the zones it lists (`zones`) apply
  if (!def.exact && F.add && (def.kind === "enemy" || (def.kind === "dynamic" && !endlessLv && n % 2 === 0))) Object.entries(F.add).forEach(([k, v]) => { if (!spawns[k]) spawns[k] = Object.assign({}, v); });
  if (!def.exact && F.placed && def.kind === "static" && n > 1 && !endlessLv) Object.entries(F.placed).forEach(([k, v]) => { if (!spawns[k]) spawns[k] = Object.assign({}, v); });
  // the zones every island shares
  if (!endlessLv) (def.zones || zoneOf(n)).forEach(z => {
    if (z === "edge" && !spawns.sinkhole) spawns.sinkhole = { max: 1, delay: [9000, 14000] };
    if (z === "shop" && !spawns.popsicle) spawns.popsicle = { max: 2, delay: [5000, 9000], s: 40 };
    if (z === "trap" && !spawns.trap) spawns.trap = { count: 3 + (n % 2) };
    if (z === "mountain") {
      // the climb to the last lair: every level up, more lightning
      const step = ZONES().mountain.indexOf(n);
      spawns.lightning = { max: 1 + (step >= 2 ? 1 : 0), delay: [[10000, 15000], [8000, 12000], [6000, 9500], [4500, 7500]][Math.max(0, Math.min(3, step))] };
    }
  });
  // and something to answer each kind of trouble
  Object.entries(POWER_FOR).forEach(([p, list]) => { if (list.some(k => spawns[k]) && !spawns[p]) spawns[p] = { max: 1, delay: [15000, 24000] }; });
}

/* ----- The six new snacks: each a few seconds of something ----- */
function campSnackEffect(id, p, leg) {
  const ts = performance.now();
  if (id === "plum") { campRun.plumUntil = Math.max(campRun.plumUntil || 0, ts) + p * 1000; campRun.plumMult = leg ? 3 : 2; return `Sugar Plum! Apples are worth ${leg ? "triple" : "double"} for ${p} seconds.`; }
  if (id === "pepper") { campRun.heatUntil = Math.max(campRun.heatUntil || 0, ts) + p * 1000; campRun.peppLeg = leg; fx.fastUntil = Math.max(fx.fastUntil, ts) + Math.min(p, 3) * 1000; return `Fire Pepper! Heat can't hurt you for ${p} seconds.`; }
  if (id === "mint") { fx.slowFactor = 1.6; fx.slowUntil = Math.max(fx.slowUntil, ts) + p * 1000; if (leg) freezeHazards(p * 500); return `Mint Leaf! Everything slows down for ${p} seconds.`; }
  if (id === "glowberry") { if (!nm.dark) { showToast("It's not dark here: the Glow Berry would be wasted."); sfx("bad"); return ""; } campRun.glowUntil = Math.max(campRun.glowUntil || 0, ts) + p * 1000; return `Glow Berry! You can see for ${p} seconds.`; }
  if (id === "candy") { campRun.smashes = (campRun.smashes || 0) + p; campRun.candyLeg = leg; return `Rock Candy! Your head smashes the next ${p} thing${p === 1 ? "" : "s"} it hits.`; }
  if (id === "jelly") { campRun.jellyUntil = Math.max(campRun.jellyUntil || 0, ts) + p * 1000; campRun.jellyLeg = leg; return `Royal Jelly! Enemies leave you alone for ${p} seconds.`; }
  return "";
}

/* ----- Hooks into the run ----- */
(() => {
  // apples worth double (or triple) under a Sugar Plum
  const eat = eatApple;
  window.eatApple = function () {
    if (!campRun || performance.now() >= (campRun.plumUntil || 0)) return eat.apply(this, arguments);
    const before = score;
    eat.apply(this, arguments);
    score += Math.round((score - before) * ((campRun.plumMult || 2) - 1));
  };
  // Rock Candy: rocks and popsicles shatter on your head
  const smashed = () => { campRun.smashes--; if (campRun.candyLeg) addScore(80 * scoreMultiplier); sfx("rock"); runCount("smashed"); return true; };
  const rock = hitRock;
  window.hitRock = function () { if (campRun && campRun.smashes > 0) { smashed(); return; } return rock.apply(this, arguments); };
  const pop = hitPopsicle;
  window.hitPopsicle = function () { if (campRun && campRun.smashes > 0) { smashed(); return false; } return pop.apply(this, arguments); };
  const touch = touchEntities;
  window.touchEntities = function (nx, ny, ts, grace) {
    if (campRun && campRun.smashes > 0) {
      const hit = entities.find(e => covers(e, nx, ny) && ENTITY_TYPES[e.type].kind === "hazard" && ENTITY_TYPES[e.type].smash);
      if (hit) { removeEntity(hit); smashed(); }
    }
    return touch.apply(this, arguments);
  };
  // a Glow Berry lights the dark like a big firefly
  const track = getTrackValue;
  window.getTrackValue = function (key) {
    const v = track.apply(this, arguments);
    if (key === "nightlight" && campRun && performance.now() < (campRun.glowUntil || 0)) return Math.max(v, 6);
    return v;
  };
  // the rival snake moves with the level, is drawn with it, and bonks
  const tick = tickMechanics;
  window.tickMechanics = function (ts) {
    tick.apply(this, arguments);
    if (campRun && gameState === "PLAYING" && !campRun.over) tickRival(ts);
  };
  const draw = drawHunter;
  window.drawHunter = function (view, ts) { draw.apply(this, arguments); if (campRun) drawRival(view, ts); };
  const step = stepSnake;
  window.stepSnake = function (ts) {
    step.apply(this, arguments);
    if (campRun && gameState === "PLAYING" && !campRun.over && campRival) rivalBonk(snake.x, snake.y, ts || performance.now());
  };
  const occ = occupiedSet;
  window.occupiedSet = function () {
    const set = occ.apply(this, arguments);
    if (campRun && campRival) campRival.cells.forEach(c => set.add(cellKey(c.x, c.y)));
    return set;
  };
  const shift = campShiftTimers;
  window.campShiftTimers = function (d) {
    shift.apply(this, arguments);
    ["rivalAt", "plumUntil", "heatUntil", "jellyUntil", "glowUntil"].forEach(k => { if (campRun[k] && campRun[k] !== Infinity) campRun[k] += d; });
    if (campRun.wards) Object.keys(campRun.wards).forEach(k => { if (k !== "net") campRun.wards[k] += d; });
    if (campRival) campRival.moveAt += d;
  };
  const leave = campLeaveRun;
  window.campLeaveRun = function () { campRival = null; return leave.apply(this, arguments); };
  const pet = campPetSetup;
  window.campPetSetup = function () { pet.apply(this, arguments); rivalSetup(); };
})();

/* ----- On the map: each zone shows around its stops ----- */
function drawZoneCues(g, key, t) {
  if (!ISLANDS[key] || placeFogged(key)) return;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const Z = ZONES();
  // storm clouds over the climb, darker and busier at every level up, lightning flickering
  (Z.mountain || []).forEach((n, i) => {
    const p = nodeAt(key, n), k = i + 1;
    for (let c = 0; c < 1 + k; c++) {
      const cx = p.x - 6 + c * 5 + Math.sin(t * 0.6 + c + n) * 2, cy = p.y - 16 - (c % 2) * 2;
      g.fillStyle = `rgba(${70 - k * 8},${70 - k * 8},${90 - k * 8},${0.55 + k * 0.08})`;
      g.fillRect(Math.round(cx - 4), Math.round(cy), 9, 3); g.fillRect(Math.round(cx - 2), Math.round(cy - 2), 5, 2);
    }
    if (Math.sin(t * (2 + k) + n * 3) > 0.94 - k * 0.02) { R(p.x + 1, p.y - 13, 1, 3, "#fff7a0"); R(p.x, p.y - 10, 1, 3, "#fff7a0"); R(p.x + 1, p.y - 7, 1, 2, "#fff7a0"); }
  });
  // the rim crumbling: cracks in the grass by the edge stops
  (Z.edge || []).forEach(n => { const p = nodeAt(key, n); R(p.x - 7, p.y + 5, 3, 1, "#3a2414"); R(p.x - 5, p.y + 6, 2, 1, "#3a2414"); R(p.x + 4, p.y + 4, 1, 1, "#3a2414"); R(p.x + 5, p.y + 5, 3, 1, "#3a2414"); });
  // frost on the grass by the merchant's leaky ice box
  (Z.shop || []).forEach(n => { const p = nodeAt(key, n); [[-6, 4], [5, 3], [-3, 6], [7, 6]].forEach(([dx, dy], i) => R(p.x + dx, p.y + dy, 2, 1, Math.sin(t * 2 + i) > 0 ? "#dff4ff" : "#a8d8f0")); });
  // a snare or two in the grass by the trap stops
  (Z.trap || []).forEach(n => { const p = nodeAt(key, n); R(p.x - 8, p.y + 4, 4, 1, "#9aa3ad"); R(p.x - 8, p.y + 3, 1, 1, "#9aa3ad"); R(p.x - 5, p.y + 3, 1, 1, "#9aa3ad"); });
}
(() => {
  if (typeof paintMapWorld !== "function") return;
  const orig = paintMapWorld;
  window.paintMapWorld = function (g, t) {
    orig.apply(this, arguments);
    try { CAMP.islands.forEach(I => { if (campIslandOpen(I.id)) drawZoneCues(g, I.id, t); }); } catch (e) { /* the map can paint without them */ }
  };
})();
