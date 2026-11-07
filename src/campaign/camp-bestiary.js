/* =========================================================
   src/campaign/camp-bestiary.js
   Build 52's foes, all data in content/campaign/foes.json:
     enemies     new ones on every island, made from a few kinds of
                 movement (chaser, crawler, charger, drifter, blinker,
                 lurker), each with its own damage tags and its own
                 immune / resist / weak rules for your weapons
     power-ups   grant a resistance or an immunity for a few seconds
                 (Fireproof Salve: Fire Immunity; Ember Ward: Ember
                 Immunity, narrower but longer)
     boss traits each island boss's own: charges, blinks, minions,
                 trails, rage, regrowth, a last rally, devouring apples,
                 rings of frost
     champions   bosses you only meet in a challenger's quest (the
                 "Champion" twist), with abilities the island bosses
                 never have: storms, frost breath, venom spit, quakes,
                 swarms, mist and stone. Beat one for a bounty; the
                 level goes on either way.
   Sprites are 12 x 12 PNGs: foe:<id> in textures/index.json.
   ========================================================= */
"use strict";

const BEAST = CAMP.foes || {};
const BEAST_ENEMIES = BEAST.enemies || [];
const BEAST_POWERS = BEAST.powerups || [];
const CHAMPIONS = BEAST.champions || [];
const championById = id => CHAMPIONS.find(c => c.id === id) || null;

/* ----- The new enemies ----- */
const beastStep = (e, ts) => { e.fromX = e.x; e.fromY = e.y; e.hopAt = ts; };
const beastDrop = (e, def, x, y, ts) => {
  if (!def.drops || headAt(x, y) || bodyAt(x, y)) return;
  if (entities.filter(o => o.type === def.drops).length >= 6) return;
  if (entities.some(o => o.x === x && o.y === y)) return;
  entities.push({ type: def.drops, x, y, size: 1, small: true, spawnAt: ts, expiresAt: ts + 4500 });
};
/* How each kind moves. Every one of them stings your head (bite) and may steal from your body. */
const BEAST_TICK = {
  chaser: id => chaserTick(id),
  // along its row, turning at walls; now and then a row toward you (the crab's walk)
  crawler: id => function (e, ts) {
    const def = FOES[id];
    if (!e.moveAt) { e.moveAt = ts + 600; e.dir = e.dir || (Math.random() < 0.5 ? 1 : -1); }
    if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
    e.moveAt = ts + (def.ms || 420);
    if (!enemyCalm(ts) && Math.random() < 0.2 && e.y !== snake.y) { if (chaseStep(e, e.x, snake.y)) { enemyLanded(e, def); return; } }
    const to = stepOpen(e.x + e.dir * cell, e.y);
    if (!to) { e.dir = -e.dir; return; }
    beastStep(e, ts); e.x = to.x; e.y = to.y;
    enemyLanded(e, def);
  },
  // ambles about; when you line up with it (same row or column, close enough), it dashes at you
  charger: id => function (e, ts) {
    const def = FOES[id];
    if (!e.moveAt) e.moveAt = ts + 900;
    if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
    const lined = !enemyCalm(ts) && (e.x === snake.x || e.y === snake.y) && Math.abs(e.x - snake.x) + Math.abs(e.y - snake.y) <= (def.sight || 6) * cell;
    if (lined && !e.dashing) { e.dashing = true; e.tell = ts; e.moveAt = ts + 350; return; }
    if (e.dashing && !lined) e.dashing = false;
    e.moveAt = ts + (e.dashing ? def.dash || 160 : def.ms || 700);
    if (e.dashing) chaseStep(e, snake.x, snake.y, 0);
    else chaseStep(e, e.x + (Math.random() < 0.5 ? cell : -cell), e.y + (Math.random() < 0.5 ? cell : -cell), 0.6);
    enemyLanded(e, def);
  },
  // drifts after you, dropping a hazard behind it now and then (the wisp's way)
  drifter: id => function (e, ts) {
    const def = FOES[id];
    if (!e.moveAt) e.moveAt = ts + 900;
    if (ts < e.moveAt || ts < (e.stunUntil || 0)) return;
    e.moveAt = ts + (def.ms || 700);
    const fx = e.x, fy = e.y;
    if (enemyCalm(ts)) chaseStep(e, e.x + cell, e.y, 1); else chaseStep(e, snake.x, snake.y, 0.2);
    if (Math.random() < (def.dropChance || 0.25)) beastDrop(e, def, fx, fy, ts);
    enemyLanded(e, def);
  },
  // blinks in two or three squares from your head (the imp's way), leaving its hazard where it was
  blinker: id => function (e, ts) {
    const def = FOES[id];
    if (!e.blinkAt) e.blinkAt = ts + 1800;
    if (ts < e.blinkAt || ts < (e.stunUntil || 0)) return;
    const ev = def.every || [2600, 4000];
    e.blinkAt = ts + ev[0] + Math.random() * (ev[1] - ev[0]);
    if (enemyCalm(ts)) return;
    const set = occupiedSet();
    for (let k = 0; k < 12; k++) {
      const d = 2 + Math.floor(Math.random() * 2), a = Math.floor(Math.random() * 4);
      const to = stepOpen(snake.x + [d, -d, 0, 0][a] * cell + (a > 1 ? (Math.random() < 0.5 ? cell : -cell) : 0), snake.y + [0, 0, d, -d][a] * cell + (a < 2 ? (Math.random() < 0.5 ? cell : -cell) : 0));
      if (!to || set.has(cellKey(to.x, to.y)) || bodyAt(to.x, to.y)) continue;
      beastDrop(e, def, e.x, e.y, ts);
      e.x = to.x; e.y = to.y; e.blinked = ts;
      sfx("portal");
      return;
    }
  },
  // sits still; every few seconds its spines come out for a moment
  lurker: () => function (e, ts) {
    const def = FOES[e.type];
    if (!e.nextOut) e.nextOut = ts + 1500 + Math.random() * 1500;
    if (ts >= e.nextOut) { const ev = def.every || [2400, 3600]; e.outUntil = ts + (def.out || 1400); e.nextOut = e.outUntil + ev[0] + Math.random() * (ev[1] - ev[0]); }
  }
};
const lurkerOut = (e, ts = performance.now()) => ts < (e.outUntil || 0);

BEAST_ENEMIES.forEach(def => {
  FOES[def.id] = Object.assign({}, def);
  const kind = def.kind || "chaser";
  const T = {
    kind: "hazard", color: def.color || "#ffffff", label: def.label || def.id, life: def.life || [10000, 14000], smash: true, fact: def.fact || "",
    tick: (BEAST_TICK[kind] || BEAST_TICK.chaser)(def.id),
    touch(e, ts) {
      // an urchin with its spines in is a snack: eat it for points
      if (kind === "lurker" && !lurkerOut(e, ts)) { removeEntity(e); addScore(40 * scoreMultiplier); sfx("pop"); campBonusEvent("kill"); return false; }
      biteHead(e, FOES[def.id]);
      return gameState !== "PLAYING";
    },
    draw(g, x, y, w, ts, e) {
      if (kind === "blinker" && e.blinked && ts - e.blinked < 300) { g.fillStyle = "rgba(200,232,255,0.5)"; g.fillRect(x - 2, y - 2, w + 4, w + 4); }
      if (kind === "charger" && e.dashing) { g.fillStyle = "rgba(255,80,60,0.35)"; g.fillRect(x - 1, y - 1, w + 2, w + 2); }
      if (kind === "lurker" && lurkerOut(e, ts)) { g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x - 2, y - 2, w + 4, w + 4); }
      const bob = kind === "drifter" || kind === "blinker" ? Math.round(Math.sin(ts / 150) * 1.5) : kind === "charger" && e.dashing ? 0 : Math.sin(ts / 90) > 0 ? -1 : 0;
      foeSprite(def.id, w, g, x, y + bob, kind === "lurker" && !lurkerOut(e, ts) ? 0.75 : 1);
    }
  };
  if (kind === "lurker") T.placed = false;
  ENTITY_TYPES[def.id] = T;
  if (!ENTITY_KEYS.includes(def.id)) ENTITY_KEYS.push(def.id);
  if (!HAZARD_SPAWNS.includes(def.id)) HAZARD_SPAWNS.push(def.id);
  if (!ENEMY_CAUSES.includes(def.id)) ENEMY_CAUSES.push(def.id);
  // the honey pot calms every enemy; heat, cold and the rest follow their tags
  const tag = def.hit && def.hit.tags[0];
  WARD_OF[def.id] = tag === "fire" ? "heat" : tag === "ice" ? "cold" : tag === "electricity" ? "bolt" : "sting";
  FOE_CAUSE_TEXT[def.id] = `${def.name.replace(/^./, c => c.toUpperCase())} got you.`;
});

/* Chasers, chargers and drifters come in from the edges, far from your head */
(() => {
  const edgy = new Set(BEAST_ENEMIES.filter(d => ["chaser", "charger", "drifter"].includes(d.kind || "chaser")).map(d => d.id));
  const orig = spawnEntity;
  window.spawnEntity = function (type) {
    if (edgy.has(type) && !endless && !maze && typeof edgeSpot === "function") {
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

/* ----- Power-ups that grant resistance or immunity for a few seconds ----- */
BEAST_POWERS.forEach(P => {
  ENTITY_TYPES[P.id] = {
    kind: "power", color: P.color, label: P.label, life: [8000, 11000], fact: P.said,
    touch(e) {
      removeEntity(e);
      if (!campRun) return false;
      campGrant(P.grants, P.secs, P.label, P.color);
      showToast(P.said);
      runCount("powers");
      sfx("shimmer");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, P.color, ts); foeSprite(P.id, Math.round(w * 0.8), g, x + w * 0.1, y + w * 0.1); }
  };
  if (!ENTITY_KEYS.includes(P.id)) ENTITY_KEYS.push(P.id);
  POWER_FOR[P.id] = P.for || [];
});
// the old power-ups answer the new enemies too
(POWER_FOR.honeypot || []).push(...BEAST_ENEMIES.filter(d => WARD_OF[d.id] === "sting").map(d => d.id));
(POWER_FOR.net || []).push("urchin", "mantis", "knightling");

/* Each island's new enemies join its enemy levels from level `from` on (campZoneSpawns adds them) */
(() => {
  const orig = campZoneSpawns;
  window.campZoneSpawns = function (isl, n, def, spawns) {
    // the island's own new enemies first, so the power-ups that answer them follow
    if (def.kind === "enemy") BEAST_ENEMIES.forEach(e => {
      if ((e.islands || []).includes(isl) && n >= (e.from || 6) && !spawns[e.id]) spawns[e.id] = e.placedCount ? { count: e.placedCount } : { max: e.max || 1, delay: (e.delay || [9000, 13000]).slice() };
    });
    return orig.apply(this, arguments);
  };
})();

/* ----- Boss traits and champion abilities -----
   Each is a timer on the boss (boss.traitAt[id]); campShiftTimers moves them when you pause. */
const between = (r, d = [8000, 12000]) => { const v = r || d; return v[0] + Math.random() * (v[1] - v[0]); };
const bossName = () => boss.def.name.split(" ")[0];
/* A free square near (x, y), d1 to d2 squares away, not on a snake, wall or the boss */
function freeNear(x, y, d1, d2) {
  const set = occupiedSet();
  for (let k = 0; k < 30; k++) {
    const d = d1 + Math.floor(Math.random() * (d2 - d1 + 1));
    const a = Math.random() * Math.PI * 2;
    const to = stepOpen(x + Math.round(Math.cos(a) * d) * cell, y + Math.round(Math.sin(a) * d) * cell);
    if (to && !set.has(cellKey(to.x, to.y)) && !headAt(to.x, to.y) && !bodyAt(to.x, to.y)) return to;
  }
  return null;
}
function dropEntity(type, at, ts, life = 5000) {
  if (!at || !ENTITY_TYPES[type]) return null;
  const e = { type, x: at.x, y: at.y, size: 1, small: true, spawnAt: ts, expiresAt: ts + life };
  if (ENTITY_TYPES[type].spawn) ENTITY_TYPES[type].spawn(e, ts);
  entities.push(e);
  return e;
}
const bossHurt = () => (boss.fight === 3 ? boss.hearts / Math.max(1, boss.maxHearts) : boss.fight === 2 ? boss.armor / Math.max(1, boss.maxArmor) : boss.stamina);
const bossTrait = id => boss && (boss.traits || []).find(t => t.id === id);

const TRAIT_TICK = {
  // charges more often and for longer (adjusts each charge as it starts)
  charger(t, ts) {
    if (boss.chargeUntil > ts && boss._chargeSeen !== boss.chargeUntil) {
      const start = boss.chargeUntil - BOSS_CHARGE_MS;
      boss.chargeUntil = start + BOSS_CHARGE_MS * (t.longer || 1.2);
      boss.nextCharge = start + (boss.nextCharge - start) * (t.every || 0.75);
      boss._chargeSeen = boss.chargeUntil;
    }
  },
  blink(t, ts) {
    if (!due("blink", t, ts) || bossExhausted(ts)) return;
    const to = freeNear(snake.x, snake.y, 4, 6);
    if (!to) return;
    boss.cells = [{ x: to.x, y: to.y }];
    boss.prev = null;
    boss.moveAt = ts + 600;
    showToast(`${bossName()} blinks!`);
    sfx("portal");
  },
  summon(t, ts) {
    if (!due("summon", t, ts)) return;
    if (entities.filter(e => e.type === t.foe).length >= (t.max || 2)) return;
    const at = freeNear(boss.cells[0].x, boss.cells[0].y, 1, 3);
    if (!at || !ENTITY_TYPES[t.foe]) return;
    const e = { type: t.foe, x: at.x, y: at.y, size: 1, small: false, spawnAt: ts, expiresAt: ts + entityLife(t.foe) };
    if (ENTITY_TYPES[t.foe].spawn) ENTITY_TYPES[t.foe].spawn(e, ts);
    entities.push(e);
    showToast(`${bossName()} calls for help!`);
  },
  regen(t, ts) {
    if (!due("regen", t, ts, [t.every || 6000, t.every || 6000]) || bossExhausted(ts)) return;
    boss.stamina = Math.min(1, boss.stamina + (t.stamina || 0.04));
  },
  tide(t, ts) {
    if (!due("tide", t, ts)) return;
    const h = boss.cells[0], r = t.radius || 3;
    for (let a = 0; a < 8; a++) {
      const to = stepOpen(h.x + Math.round(Math.cos(a * Math.PI / 4) * r) * cell, h.y + Math.round(Math.sin(a * Math.PI / 4) * r) * cell);
      if (to && !headAt(to.x, to.y) && !bodyAt(to.x, to.y)) dropEntity("frost", to, ts, 5000);
    }
    sfx("molasses");
  },
  // champions only
  stormcall(t, ts) {
    if (!due("stormcall", t, ts)) return;
    const at = freeNear(snake.x, snake.y, 1, 3);
    if (at) dropEntity("lightning", at, ts, 4000);
  },
  frostbreath(t, ts) {
    if (!due("frostbreath", t, ts)) return;
    const h = boss.cells[0], n = boss.cells[1] || h;
    const dx = Math.sign(h.x - n.x) || 1, dy = Math.sign(h.y - n.y);
    for (let k = 1; k <= (t.reach || 4); k++) {
      const to = stepOpen(h.x + dx * cell * k, h.y + dy * cell * k);
      if (!to) break;
      if (!headAt(to.x, to.y) && !bodyAt(to.x, to.y)) dropEntity("frost", to, ts, 4500);
    }
    showToast(`${bossName()} breathes frost!`);
    sfx("molasses");
  },
  venomspit(t, ts) {
    if (!due("venomspit", t, ts)) return;
    const vx = Math.sign(snake.dx), vy = Math.sign(snake.dy);
    for (let k = 2; k < 2 + (t.count || 3); k++) {
      const to = stepOpen(snake.x + vx * cell * k, snake.y + vy * cell * k);
      if (to && !bodyAt(to.x, to.y)) dropEntity("acid", to, ts, 6000);
    }
    showToast(`${bossName()} spits venom ahead of you!`);
  },
  quake(t, ts) {
    if (!due("quake", t, ts)) return;
    for (let k = 0; k < (t.count || 3); k++) { const at = freeNear(snake.x, snake.y, 3, 8); if (at) rocks.push({ x: at.x, y: at.y, size: 1, small: false }); }
    showToast(`${bossName()} shakes the ground!`);
    sfx("rock");
    buzz(60);
  },
  swarm(t, ts) {
    if (!due("swarm", t, ts)) return;
    for (let k = 0; k < (t.count || 3); k++) {
      const at = freeNear(boss.cells[0].x, boss.cells[0].y, 1, 3);
      if (at && ENTITY_TYPES[t.foe]) { const e = { type: t.foe, x: at.x, y: at.y, size: 1, small: false, spawnAt: ts, expiresAt: ts + entityLife(t.foe) }; entities.push(e); }
    }
    showToast(`${bossName()} calls a swarm!`);
  },
  phase(t, ts) {
    if (!due("phase", t, ts)) return;
    boss.phaseUntil = ts + (t.secs || 2.5) * 1000;
    showToast(`${bossName()} turns to mist!`);
    sfx("shimmer");
  },
  harden(t, ts) {
    if (!due("harden", t, ts)) return;
    boss.hardenUntil = ts + (t.secs || 3) * 1000;
    showToast(`${bossName()} turns to stone!`);
    sfx("rock");
  }
};
/* Is the trait's timer up? Sets the next one. The first comes a little after the fight starts. */
function due(id, t, ts, range) {
  if (!boss.traitAt[id]) { boss.traitAt[id] = ts + between(range || t.every) * 0.7; return false; }
  if (ts < boss.traitAt[id]) return false;
  boss.traitAt[id] = ts + between(range || t.every);
  return true;
}

(() => {
  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== "function") { console.warn("bestiary hook: no " + name); return; }
    window[name] = fn(orig);
  };
  // traits tick with the boss
  wrap("tickBoss", orig => function (ts) {
    orig.apply(this, arguments);
    if (!boss || boss.beaten || (campRun ? campRun.over : currentModeKey !== "custom")) return;
    if (ts < boss.moveAt - BOSS_DELAY / 2) return;
    (boss.traits || []).forEach(t => { if (TRAIT_TICK[t.id]) TRAIT_TICK[t.id](t, ts); });
  });
  // rage: faster once badly hurt
  wrap("bossInterval", orig => function (ts) {
    const v = orig.apply(this, arguments);
    const t = bossTrait("enrage");
    if (t && bossHurt() <= (t.at || 0.5)) return v / (t.speed || 1.3);
    return v;
  });
  // a trail of its hazard behind it; devouring apples
  wrap("stepBoss", orig => function (ts) {
    const before = boss.cells[0];
    orig.apply(this, arguments);
    if (!boss || boss.beaten) return;
    const h = boss.cells[0];
    if (h === before) return;
    const trail = bossTrait("trail");
    if (trail && Math.random() < (trail.chance || 0.3) && entities.filter(e => e.type === trail.hazard).length < (trail.max || 6)) {
      const tail = boss.cells[boss.cells.length - 1];
      if (!headAt(tail.x, tail.y) && !bodyAt(tail.x, tail.y)) dropEntity(trail.hazard, tail, ts, 4000);
    }
    const dev = bossTrait("devour");
    if (dev) {
      const a = apples.find(x => x.x === h.x && x.y === h.y);
      if (a) {
        apples.splice(apples.indexOf(a), 1);
        maintainApples();
        boss.stamina = Math.min(1, boss.stamina + (dev.stamina || 0.08));
        showToast(`${bossName()} gobbles an apple and gets its breath back!`);
        sfx("pop");
      }
    }
  });
})();

/* ----- Champions: only in a challenger's quest (the "champion" twist) -----
   It comes onto the board a few seconds in and hunts you like a boss's last fight: hearts, no armor,
   wear it out and bite it when it's tired, or let it crash into you. Beat it for its bounty. */
function spawnChampion(c, ts) {
  const B = Object.assign({ armor: 0, resist: [] }, c, { drain: [c.drain[0], c.drain[0], c.drain[0]] });
  const isl = CAMP.islandById[c.island] ? c.island : (campRun && campRun.isl) || "keep";
  const n = CAMP.islandById[isl].n;
  spawnBossFrom(B, 3, n, isl, { traits: c.abilities || [], rules: c.rules || {} }, { champion: c.id, crest: c.crest || isl, bounty: c.bounty || {} });
  showToast(`${c.name} enters the fight!`);
  sfx("bad");
}
/* The champion of the island you're on */
const islandChampion = isl => CHAMPIONS.find(c => c.island === isl) || CHAMPIONS[0];
function championDown() {
  const c = championById(boss.champion), b = boss.bounty || {};
  boss.beaten = true;
  showToast(`${boss.def.name} is beaten! Bounty: ${fmtInt(b.points || 0)} points${b.coins ? ` and ${b.coins} coins` : ""}.`);
  if (b.points) addScore(b.points * scoreMultiplier);
  if (b.coins && campRun && campRun.isl) campPay(campRun.isl, b.coins);
  if (campRun) { campRun.championBeaten = c ? c.id : true; campBump("championsBeaten"); }
  confetti();
  sfx("medal");
  boss = null;
  updateHud();
}
(() => {
  const start = campStart;
  window.campStart = function (isl, n, challengeIdx = -1) {
    start.apply(this, arguments);
    if (campRun && campRun.mods.includes("champion") && !boss) {
      const c = islandChampion(isl);
      campRun.championAt = performance.now() + (c.arrive || 7000);
      campRun.championId = c.id;
    }
  };
  const tick = tickMechanics;
  window.tickMechanics = function (ts) {
    tick.apply(this, arguments);
    if (campRun && !campRun.over && gameState === "PLAYING" && campRun.championAt && ts >= campRun.championAt && !boss) {
      campRun.championAt = 0;
      spawnChampion(championById(campRun.championId) || islandChampion(campRun.isl), ts);
    }
  };
})();

/* The words for a boss's traits (wanted posters, the boss plate, the terminal) */
const traitWords = list => (list || []).map(t => ((BEAST.traits || {})[t.id] || { name: t.id }).name);

/* ----- The sandbox's boss (build 52) -----
   A sandbox level can name a boss to fight ("boss" in its .level file): an island's boss at one of its
   three fights, or a champion. It runs on the same boss engine, without your campaign kit (bare scales).
   Beating it doesn't end the level: it's a test bench. */
function sandboxBossStart(id, fight = 3) {
  const c = championById(id);
  if (c) { spawnChampion(c, performance.now()); return; }
  const I = CAMP.islandById[id];
  if (!I) return;
  spawnBossFrom(I.boss, fight, I.n, I.id, bossFoes(I.id));
  showToast(`${I.boss.name} (fight ${fight}): ${traitWords(boss.traits).join(", ")}`);
}
(() => {
  const inSandbox = () => !campRun && currentModeKey === "custom" && boss && !boss.beaten;
  const tick = tickMechanics;
  window.tickMechanics = function (ts, delta) {
    tick.apply(this, arguments);
    if (inSandbox() && gameState === "PLAYING") { tickBoss(ts, delta); tickShots(ts, delta); }
  };
  const draw = drawHunter;
  window.drawHunter = function (view, ts) { draw.apply(this, arguments); if (inSandbox()) drawBoss(view, ts); };
  const step = stepSnake;
  window.stepSnake = function (ts) {
    step.apply(this, arguments);
    if (inSandbox() && gameState === "PLAYING") bossTouchedBy(snake.x, snake.y, ts || performance.now());
  };
  const occ = occupiedSet;
  window.occupiedSet = function () {
    const set = occ.apply(this, arguments);
    if (inSandbox()) boss.cells.forEach(c => set.add(cellKey(c.x, c.y)));
    return set;
  };
})();
