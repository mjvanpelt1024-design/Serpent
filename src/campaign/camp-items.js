/* =========================================================
   src/campaign/camp-items.js
   What gear, spells, snacks, familiars and runes do in a level.
   The numbers live in content/campaign/items.json; this is the behavior.
   ========================================================= */
"use strict";

const ENEMY_CAUSES = ["flea", "wasp", "ghost", "hunter", "boss", "echo", "bee", "yellowjacket", "imp", "mole", "crab", "wisp", "rivalbonk"];
const ELEMENT_CAUSES = ["fire", "lightning", "bomb", "ember", "lava"];

/* Bare scales: a quest twist, and the sandbox too (build 52: a sandbox boss fight uses no campaign kit) */
const campBare = () => (campRun ? campRun.mods.includes("bare") : currentModeKey === "custom");
/* What you're wearing in a slot, by id. Spent gear (no hits left this level) counts as nothing.
   A new item that borrows an old one's behavior ("acts", build 52) answers with the old one's id:
   every weapon is a "sword" here, the Ice Lance a "fireball", the hedgehog a "turtle". */
const campEquippedId = slot => { if (campBare()) return null; const it = campEquipped(slot); if (it && slot === "gear" && campRun && it.uses <= 0) return null; return it ? campItemActs(it.id) : null; };
const campEquippedRarity = slot => { const it = campEquipped(slot); return it ? it.rarity : null; };
/* An item's power at its rarity: a spell's levels and seal add to it, training sharpens a familiar */
const campItemPower = it => {
  const d = campItemDef(it.id);
  if (!d || !d.power) return 0;
  const base = d.power[rarityIdx(it.rarity)];
  // build 52: Spell Power and "<word>.spells" stats (trinkets, armor, runes) make spells stronger too
  const boost = d.family === "spell" && typeof spellBoost === "function" ? spellBoost(it) : 0;
  if (d.family === "spell") return d.unit === "targets" || d.unit === "squares" ? base + Math.floor((it.lv || 0) / 4) + (it.seal ? 1 : 0) + Math.floor(boost / (d.unit === "targets" ? 40 : 25)) : Math.round(base * spellPowerMult(it) * (1 + boost / 100) * 10) / 10;
  if (d.family === "pet") return petPower(it, base);
  return base;
};

/* Spends one of the worn gear's hits for this level. Gear lasts for good now (build 51):
   at none left it's spent until the next level, and it's whole again then. */
function campUseGear(id, free = false) {
  const it = campEquipped("gear");
  if (campBare() || !it || campItemActs(it.id) !== id || it.uses <= 0) return false;
  if (free) { campRun.gearFx = performance.now(); return true; }
  it.uses--;
  campRun.gearFx = performance.now();
  if (it.uses <= 0) {
    showToast(`Your ${campItemDef(it.id).name} is spent for this level.`);
    campBump("itemsBroken");
    sfx("bad");
  }
  return true;
}
/* Gear and spells are whole again for every level */
function campRefillKit() {
  if (!camp) return;
  camp.satchel.forEach(it => { const s = campItemSlot(it.id); if (s === "gear" || s === "spell") it.uses = freshUses(it.id, it.rarity, it); });
}

/* ----- The pocket: four snacks, eaten with keys 1 to 4 -----
   Each bite spends a charge; at none left the snack is gone and its slot empties.
   A bite that would do nothing (full hearts, whole armor, no gear) isn't taken. */
const pocketItem = i => (sbKitNow ? null : camp.pocket[i] ? satchelItem(camp.pocket[i]) : null);   // a sandbox kit has no snacks
function campEatSnack(i) {
  if (!campRun || gameState !== "PLAYING" || paused || campRun.over) return;
  const it = pocketItem(i);
  if (campBare()) { showToast("Bare Scales: no snacks in this quest."); return; }
  if (!it) { showToast(`Pocket slot ${i + 1} is empty.`); sfx("bad"); return; }
  const d = campItemDef(it.id), p = campItemPower(it), leg = it.rarity === "legendary";
  // a snack can eat like another ("acts", build 53: nightmare snacks)
  const act = campItemActs(it.id);
  const P = ARMOR_PIECES();
  let said = "";
  if (act === "stew") {
    const max = campRun.startHearts || 0;
    if (currentHearts >= max) { showToast(max ? "Your hearts are already full." : "You have no hearts to heal yet."); sfx("bad"); return; }
    currentHearts = Math.min(max, currentHearts + p);
    said = "Hearty Stew! You feel better already.";
  } else if (act === "bread") {
    if (campRun.armor >= campRun.armorMax) { showToast(campRun.armorMax ? "Your armor is whole." : "You have no armor for it to grow back."); sfx("bad"); return; }
    campRun.armor = Math.min(campRun.armorMax, (Math.floor(campRun.armor / P) + p) * P);
    campSyncArmor();
    said = "Honey Bread! Your armor grows back.";
  } else if (act === "pie") {
    const g = campEquipped("gear");
    const full = g ? freshUses(g.id, g.rarity, g) : 0;
    if (!g || g.uses >= full) { showToast(g ? "Your gear is good as new." : "You have no gear to patch."); sfx("bad"); return; }
    g.uses = Math.min(full, g.uses + p);
    campRun.gearFx = performance.now();
    said = `Tinker's Pie patched your ${d && campItemDef(g.id).name}!`;
  } else if (act === "jerky") {
    const s = campEquipped("spell");
    const full = s ? freshUses(s.id, s.rarity, s) : 0;
    if (!s || s.uses >= full) { showToast(s ? "Your spell is fully charged." : "You have no spell to recharge."); sfx("bad"); return; }
    s.uses = Math.min(full, s.uses + p);
    said = "Spice Jerky! Your spell gets its spark back.";
  } else if (act === "tart") {
    if (campRun.phoenix) { showToast("The tart's warmth is already with you."); sfx("bad"); return; }
    campRun.phoenix = p;
    said = "Phoenix Tart! The next blow that would end you won't.";
  } else {
    // the six snacks of build 51: each a few seconds of something (camp-foes.js reads them)
    const r = campSnackEffect(act, p, leg);
    if (!r) return;
    said = r;
  }
  it.uses--;
  lastHeartsKey = "";
  showToast(said);
  sfx("heart");
  campBump("snacksEaten");
  if (it.uses <= 0) { campDrop(it.uid); showToast(`That was the last of the ${d.name}.`); }
  saveCamp();
  updateHud();
}

/* Pushes a hazard or enemy one or two squares to the side of the snake's path */
function shoveAside(obj) {
  const side = [[snake.dy, snake.dx], [-snake.dy, -snake.dx]].sort(() => Math.random() - 0.5);
  const set = occupiedSet();
  campObjs.forEach(o => set.add(cellKey(o.x, o.y)));
  for (const k of [1, 2]) for (const [dx, dy] of side) {
    let x = obj.x + Math.sign(dx) * cell * k, y = obj.y + Math.sign(dy) * cell * k;
    if (maze) { x = wrapW(x); y = wrapW(y); }
    else if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) continue;
    if (set.has(cellKey(x, y))) continue;
    obj.x = x; obj.y = y;
    return true;
  }
  return false;
}

/* The head ran into something. Gear gets the first say.
   type: rock, popsicle, flea, fire, wasp, ghost, bramble, spikes. foe: the enemy's own type, when
   the island's enemies are counted as wasps (a weapon's tags meet that enemy's rules, build 52).
   Returns "kill", "shove" or null (gear didn't help). */
function campGearMeets(type, foe = type) {
  const gear = campEquippedId("gear");
  const leg = campEquippedRarity("gear") === "legendary";
  if (fieldOn()) { sfx("pop"); return "kill"; }
  const enemy = ["flea", "wasp", "ghost"].includes(type);
  if (gear === "sword") {
    if (enemy) {
      // a weapon's tags against the enemy's rules: immune, it does nothing; resisted, it costs another hit; weak, it's free
      const w = campEquipped("gear"), mult = foeTakes(foe, weaponHit(w)), name = campItemDef(w.id).name;
      if (mult <= 0) { showToast(`Your ${name} does nothing to it: it's immune to ${tagWord(weaponHit(w))}.`); sfx("bad"); return null; }
      campUseGear("sword", mult > 1);
      if (mult < 1 && w.uses > 0) campUseGear("sword");
      showToast(mult > 1 ? `Your ${name} cut right through it!` : mult < 1 ? `Your ${name} cut it down, barely.` : `Your ${name} cut it down!`);
      sfx("rock"); campBonusEvent("kill");
      weaponKillTraits(w, null);
      return "kill";
    }
    if (["rock", "popsicle", "bramble", "spikes"].includes(type)) {
      const it = campEquipped("gear");
      if (leg) campUseGear("sword");
      else { it.uses = 1; campUseGear("sword"); }
      sfx("rock");
      return "shove";
    }
  }
  if (gear === "shield" && ["rock", "popsicle", "flea", "wasp", "ghost", "bramble", "spikes"].includes(type)) {
    campUseGear("shield", leg && type === "rock");
    sfx("rock");
    return "shove";
  }
  if (gear === "cloak" && ["fire", "popsicle"].includes(type)) {
    campUseGear("cloak", leg && type === "fire");
    sfx("pop");
    return "kill";
  }
  return null;
}

/* Run-wide guards before a hit lands: the force field, the turtle, the wards. True = no damage. */
function campGuardHit(cause) {
  const ts = performance.now();
  if (fieldOn(ts)) { sfx("pop"); return true; }
  if (ELEMENT_CAUSES.includes(cause) && campEquippedId("gear") === "cloak") {
    campUseGear("cloak", campEquippedRarity("gear") === "legendary" && cause === "fire");
    showToast("Your Ember Cloak took the heat.");
    return true;
  }
  if (campPetBlocks()) return true;
  const ward = ENEMY_CAUSES.includes(cause) ? upVal("enemyward") : upVal("hazardward");
  if (ward > 0 && roll(ward)) { showToast(ENEMY_CAUSES.includes(cause) ? "Enemy Ward!" : "Hazard Ward!"); sfx("buy"); return true; }
  return false;
}

/* What head-on gear does against a boss's bite on your head */
function campGearBlocks(cause) {
  if (fieldOn()) { sfx("pop"); return true; }
  const gear = campEquippedId("gear");
  if (cause === "boss" && gear === "shield") { campUseGear("shield"); showToast("Your shield caught the bite!"); return true; }
  return campPetBlocks();
}

/* The turtle takes a hit, then needs time to recover */
function campPetBlocks() {
  if (campEquippedId("pet") !== "turtle" || !campRun.pet) return false;
  const ts = performance.now();
  if (campRun.pet.shells > 0) {
    campRun.pet.shells--;
    campRun.pet.readyAt = ts + campItemPower(campEquipped("pet")) * 1000 * (1 - upPct("petbond"));
    showToast("Shellby took that hit for you!");
    sfx("rock");
    return true;
  }
  return false;
}

/* ----- Spells: Space casts the one you carry ----- */
const fieldOn = (ts = performance.now()) => !!campRun && ts < (campRun.fieldUntil || 0);

function campCast() {
  if (!campRun || gameState !== "PLAYING" || paused) return;
  const it = campEquipped("spell");
  if (it && it.uses <= 0 && !campBare() && !(campRun.freeCasts > 0)) { showToast("Your spell is out of charges for this level."); sfx("bad"); return; }
  if (!it || campBare()) { showToast(campBare() ? "Bare Scales: no spells on this quest." : "No spell ready. Buy one on the Arcanum Spire."); return; }
  const ts = performance.now();
  if (ts < campRun.castReadyAt) return;
  campRun.castReadyAt = ts + 1500 * (1 - upPct("recharge")) * (1 + runeVal("castCooldown") / 100);
  const leg = it.rarity === "legendary";
  const p = campItemPower(it);
  let ok = true;
  // a new spell casts the way the one it borrows from does ("acts", build 52)
  const act = campItemActs(it.id);
  if (act === "forcefield") { campRun.fieldUntil = ts + p * 1000; campRun.fieldBounce = leg; campRun.fieldSpell = it.id; campRun.fieldGrants = campItemDef(it.id).grants || null; sfx("shimmer"); }
  else if (act === "fireball") ok = castFireball(p * (leg && it.id === "fireball" ? 2 : 1), it.id);
  else if (act === "blink") ok = castBlink(p, leg);
  else if (act === "frost") {
    freezeHazards(p * 1000);
    if (boss && !boss.beaten) {
      if (bossResists("frost")) showToast(`${boss.def.name.split(" ")[0]} shakes off the frost!`);
      else boss.frozenUntil = ts + p * 500;
    }
    if (hunter && hunter.alive) hunter.stunnedUntil = ts + p * 1000;
    campObjs.forEach(o => { if (o.kind === "thief") o.moveAt = ts + p * 1000; });
    sfx("molasses");
  } else if (act === "magnet") { buffs.lodeUntil = ts + p * 1000; campRun.magnetDouble = leg ? ts + p * 1000 : 0; sfx("portal"); }
  if (!ok) { campRun.castReadyAt = ts + 300; return; }
  // the Rune of the Sage's free casts go first, and don't spend the spell's charges
  if (campRun.freeCasts > 0) campRun.freeCasts--;
  else it.uses--;
  campBump("spellsCast");
  campBonusEvent("spell");
  campNoteCast();
  // spells last for good now (build 51): out of charges until the next level
  if (it.uses <= 0) showToast(`Your ${campItemDef(it.id).name} is out of charges for this level.`);
  saveCamp();
}

let campShots = [];        // fireballs in flight: { x, y, target, born, spell }

function fireTargets() {
  const list = [];
  if (boss && !boss.beaten) list.push({ kind: "boss", get x() { return boss.cells[0].x; }, get y() { return boss.cells[0].y; } });
  if (hunter && hunter.alive) list.push({ kind: "hunter", get x() { return hunter.cells[0].x; }, get y() { return hunter.cells[0].y; } });
  // every enemy is a target too (build 52: the islands' own ones and the new ones), and the hazards a spell can burn
  entities.forEach(e => { if (["wasp", "ghost", "bramble", "bomb", "spikes"].includes(e.type) || FOES[e.type] || ["ember", "acid", "frost"].includes(e.type)) list.push({ kind: "entity", ref: e, x: e.x, y: e.y }); });
  hazards.forEach(h => { if (h.type === "flea" || h.type === "fire") list.push({ kind: "hazard", ref: h, x: h.x, y: h.y }); });
  popsicles.forEach(pp => { if (!pp.isBonusApple) list.push({ kind: "popsicle", ref: pp, x: pp.x, y: pp.y }); });
  return list;
}

function castFireball(n, spell = "fireball") {
  const dist = t => maze ? Math.abs(wrapDelta(t.x - snake.x)) + Math.abs(wrapDelta(t.y - snake.y)) : Math.abs(t.x - snake.x) + Math.abs(t.y - snake.y);
  const targets = fireTargets().sort((a, b) => dist(a) - dist(b));
  if (!targets.length) { showToast("Nothing to burn."); return false; }
  for (let i = 0; i < n; i++) {
    const t = targets[Math.min(i, targets.length - 1)];
    campShots.push({ x: snake.x + cell / 2, y: snake.y + cell / 2, target: t, born: performance.now(), trail: [], spell });
  }
  sfx("fire");
  return true;
}

function tickShots(ts, delta) {
  campShots = campShots.filter(s => {
    const t = s.target;
    const tx = (t.kind === "boss" && boss ? boss.cells[0].x : t.kind === "hunter" && hunter ? hunter.cells[0].x : t.ref ? t.ref.x : t.x) + cell / 2;
    const ty = (t.kind === "boss" && boss ? boss.cells[0].y : t.kind === "hunter" && hunter ? hunter.cells[0].y : t.ref ? t.ref.y : t.y) + cell / 2;
    let dx = maze ? wrapDelta(tx - s.x) : tx - s.x, dy = maze ? wrapDelta(ty - s.y) : ty - s.y;
    const d = Math.hypot(dx, dy);
    const step = cell * 22 * delta / 1000;
    s.trail.unshift({ x: s.x, y: s.y });
    if (s.trail.length > 6) s.trail.pop();
    if (d <= step || ts - s.born > 2500) { fireballHits(t, s.spell); return false; }
    s.x += dx / d * step; s.y += dy / d * step;
    return true;
  });
}

function fireballHits(t, spell = "fireball") {
  sfx("rock");
  const hit = spellHit({ id: spell });
  if (t.kind === "boss" && boss && !boss.beaten) {
    // a fireball hurts a boss in every fight, unless it's fireproof; the spell's tags meet the boss's rules (damageBoss)
    if (bossResists(spell)) showToast(`${boss.def.name.split(" ")[0]} shrugs off the ${spell === "fireball" ? "flames" : campItemDef(spell).name}!`);
    else damageBoss(1, spell === "fireball" ? "fireball" : "spell:" + spell);
  } else if (t.kind === "hunter" && hunter && hunter.alive) stunHunter("star");
  else if (t.kind === "entity") {
    // an enemy immune to the spell's tags doesn't feel it
    if (hit && FOES[t.ref.type] && foeTakes(t.ref.type, hit) <= 0) { showToast(`It shrugs off the ${tagWord(hit)}.`); return; }
    if (["wasp", "ghost"].includes(t.ref.type) || FOES[t.ref.type]) campBonusEvent("kill");
    removeEntity(t.ref);
    const d = campItemDef(spell);
    if (d && d.traits && d.traits.includes("chill")) freezeHazards(800);
  }
  else if (t.kind === "hazard") { const i = hazards.indexOf(t.ref); if (i >= 0) { if (t.ref.type === "flea") campBonusEvent("kill"); hazards.splice(i, 1); } }
  else if (t.kind === "popsicle") { const i = popsicles.indexOf(t.ref); if (i >= 0) popsicles.splice(i, 1); }
}

function castBlink(n, leg) {
  const vx = Math.sign(snake.dx), vy = Math.sign(snake.dy);
  const fit = (x, y) => {
    if (maze) return !walls.has(cellKey(wrapW(x), wrapW(y)));
    if (endless) { const [top, bottom] = endlessRows(x); return y >= top * cell && y < bottom * cell; }
    if (edgeMode !== "wall" && edgeMode !== "mirror") return !walls.has(cellKey(((x % boardSize) + boardSize) % boardSize, ((y % boardSize) + boardSize) % boardSize));
    return x >= 0 && y >= 0 && x < boardSize && y < boardSize && !walls.has(cellKey(x, y));
  };
  for (let k = n; k >= 1; k--) {
    const ox = vx * cell * k, oy = vy * cell * k;
    const cells = snake.cells.length ? snake.cells : [{ x: snake.x, y: snake.y }];
    if (!cells.every(c => fit(c.x + ox, c.y + oy))) continue;
    const norm = (x, y) => maze ? [wrapW(x), wrapW(y)] : endless ? [x, y] : edgeMode !== "wall" && edgeMode !== "mirror" ? [((x % boardSize) + boardSize) % boardSize, ((y % boardSize) + boardSize) % boardSize] : [x, y];
    snake.cells.forEach(c => { [c.x, c.y] = norm(c.x + ox, c.y + oy); });
    [snake.x, snake.y] = norm(snake.x + ox, snake.y + oy);
    if (endless) endless.prev = snake.cells.map(c => ({ x: c.x, y: c.y }));
    if (maze) maze.prev = snake.cells.map(c => ({ x: c.x, y: c.y }));
    graceUntil = Math.max(graceUntil, performance.now() + (leg ? 1000 : 250));
    campRun.blinkFx = performance.now();
    sfx("portal");
    return true;
  }
  showToast("No room to blink.");
  return false;
}

/* ----- Familiars ----- */
function campPetSetup() {
  const it = campBare() ? null : campEquipped("pet");
  // a familiar that borrows another's behavior ("acts") acts as that one; the real id keeps its picture
  const act = it ? campItemActs(it.id) : null;
  campRun.pet = it ? { id: act, real: it.id, rarity: it.rarity, nextAt: performance.now() + 2500, readyAt: 0, shells: act === "turtle" ? (it.rarity === "legendary" ? 2 : 1) : 0, fx: 0, fxAt: null } : null;
}

function tickPet(ts) {
  const P = campRun.pet;
  if (!P) return;
  const it = campEquipped("pet");
  if (!it) { campRun.pet = null; return; }
  const p = campItemPower(it);
  const range = (campItemDef(it.id).range || [2, 2, 3, 3])[rarityIdx(it.rarity)];
  const speed = 1 - upPct("petbond");
  const near = (o, r) => (maze ? Math.max(Math.abs(wrapDelta(o.x - snake.x)), Math.abs(wrapDelta(o.y - snake.y))) : Math.max(Math.abs(o.x - snake.x), Math.abs(o.y - snake.y))) <= r * cell;
  if (P.id === "turtle") {
    const max = it.rarity === "legendary" ? 2 : 1;
    if (P.shells < max && P.readyAt && ts >= P.readyAt) { P.shells++; P.readyAt = P.shells < max ? ts + p * 1000 * speed : 0; }
    return;
  }
  if (P.id === "puffer") {
    if (ts < P.nextAt) return;
    P.nextAt = ts + 400;
    entities.forEach(e => {
      if ((e.type === "wasp" || e.type === "ghost") && near(e, p)) {
        const ax = Math.sign(e.x - snake.x) || 1, ay = Math.sign(e.y - snake.y);
        const x = e.x + ax * cell, y = e.y + ay * cell;
        if (maze || (x >= 0 && y >= 0 && x < boardSize && y < boardSize)) { e.x = maze ? wrapW(x) : x; e.y = maze ? wrapW(y) : y; P.fxAt = { x: e.x, y: e.y }; P.fx = ts; }
      }
    });
    if (hunter && hunter.alive && near(hunter.cells[0], p)) { hunter.stunnedUntil = Math.max(hunter.stunnedUntil, ts + 350); P.fx = ts; }
    if (boss && !boss.beaten && near(boss.cells[0], p) && ts > (P.bossCd || 0)) {
      P.bossCd = ts + 2600;
      bossRetreat(ts, 700);
      if (it.rarity === "legendary") boss.stamina = Math.max(0.02, boss.stamina - 0.04);
      P.fx = ts;
    }
    return;
  }
  if (ts < P.nextAt) return;
  P.nextAt = ts + p * 1000 * speed;
  if (P.id === "firefly") {
    const a = apples.filter(x => !x.rotten && !x.fake && near(x, range))[0];
    if (!a) { P.nextAt = ts + 700; return; }
    apples.splice(apples.indexOf(a), 1);
    P.fxAt = { x: a.x, y: a.y }; P.fx = ts;
    eatApple(a.size || 1, a.small);
    if (it.rarity === "legendary") { campRun.apples++; }
    maintainApples();
  } else if (P.id === "crab") {
    // a familiar that borrows the crab's snip has its own list of what it snips (build 52)
    const own = campItemDef(it.id).snips;
    const types = own || (it.rarity === "legendary" ? ["wasp", "bramble", "spikes"] : ["wasp", "bramble"]);
    const e = entities.find(x => types.includes(x.type) && near(x, range));
    const f = hazards.find(h => (own ? own.includes(h.type) : h.type === "flea") && near(h, range));
    const r = it.rarity === "legendary" ? rocks.find(x => near(x, range)) : null;
    const hit = e || f || r;
    if (!hit) { P.nextAt = ts + 500; return; }
    if (e) { if (e.type === "wasp" || FOES[e.type]) campBonusEvent("kill"); removeEntity(e); }
    else if (f) { campBonusEvent("kill"); hazards.splice(hazards.indexOf(f), 1); }
    else rocks.splice(rocks.indexOf(r), 1);
    P.fxAt = { x: hit.x, y: hit.y }; P.fx = ts;
    sfx("rock");
  }
}

/* The familiar trots along beside the snake */
function drawPet(view, ts) {
  const P = campRun && campRun.pet;
  if (!P) return;
  // beside the neck, on the snake's left, so it never hides under the body
  const seg = snake.cells[Math.min(1, snake.cells.length - 1)] || snake;
  const [sx, sy] = view.toScreen(seg.x, seg.y);
  const px = Math.sign(snake.dy), py = -Math.sign(snake.dx);
  const x = sx + px * cell * 0.95 + cell * 0.1 + Math.sin(ts / 300) * cell * 0.08, y = sy + py * cell * 0.95 + cell * 0.1 + Math.cos(ts / 240) * cell * 0.1;
  drawPetSprite(ctx, P.real || P.id, x, y, cell * 0.8, ts, P);
  if (P.fxAt && ts - P.fx < 300) {
    const [fx, fy] = view.toScreen(P.fxAt.x, P.fxAt.y);
    ctx.save();
    ctx.strokeStyle = P.id === "firefly" ? "#ffe86a" : "#ffffff";
    ctx.globalAlpha = 1 - (ts - P.fx) / 300;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + cell * 0.4, y + cell * 0.4); ctx.lineTo(fx + cell / 2, fy + cell / 2); ctx.stroke();
    ctx.restore();
  }
}


/* Fireballs, the force field and the familiar */
function drawCampEffects(view, ts) {
  campShots.forEach(s => {
    s.trail.forEach((p, i) => {
      const [x, y] = view.toScreen(p.x, p.y);
      ctx.fillStyle = `rgba(255,${120 + i * 15},40,${0.6 - i * 0.09})`;
      ctx.beginPath(); ctx.arc(x, y, cell * (0.3 - i * 0.03), 0, Math.PI * 2); ctx.fill();
    });
    const [x, y] = view.toScreen(s.x, s.y);
    ctx.save(); ctx.shadowColor = "#ff6a1a"; ctx.shadowBlur = cell;
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(x, y, cell * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  if (fieldOn(ts)) {
    const [x, y] = view.toScreen(snake.x, snake.y);
    const left = campRun.fieldUntil - ts;
    ctx.save();
    ctx.globalAlpha = left < 1000 && Math.floor(ts / 100) % 2 ? 0.3 : 0.6;
    ctx.strokeStyle = "#7fe3ff"; ctx.lineWidth = 2;
    ctx.shadowColor = "#7fe3ff"; ctx.shadowBlur = cell * 0.6;
    ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.95, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
