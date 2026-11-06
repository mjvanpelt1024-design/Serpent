/* =========================================================
   src/campaign/camp-items.js
   What gear, spells, snacks, familiars and runes do in a level.
   The numbers live in content/campaign/items.json; this is the behavior.
   ========================================================= */
"use strict";

const ENEMY_CAUSES = ["flea", "wasp", "ghost", "hunter", "boss", "echo"];
const ELEMENT_CAUSES = ["fire", "lightning", "bomb"];

const campBare = () => !!(campRun && campRun.mods.includes("bare"));
const campEquippedId = slot => { if (campBare()) return null; const it = campEquipped(slot); return it ? it.id : null; };
const campEquippedRarity = slot => { const it = campEquipped(slot); return it ? it.rarity : null; };
const campItemPower = it => { const d = campItemDef(it.id); return d && d.power ? d.power[rarityIdx(it.rarity)] : 0; };

/* Spends one use of the worn gear; at none left it breaks */
function campUseGear(id, free = false) {
  const it = campEquipped("gear");
  if (campBare() || !it || it.id !== id) return false;
  if (free) { campRun.gearFx = performance.now(); return true; }
  it.uses--;
  campRun.gearFx = performance.now();
  if (it.uses <= 0) {
    showToast(`Your ${campItemName(it)} broke!`);
    campDrop(it.uid);
    campBump("itemsBroken");
    sfx("bad");
  }
  saveCamp();
  return true;
}

/* ----- The pocket: four snacks, eaten with keys 1 to 4 -----
   Each bite spends a charge; at none left the snack is gone and its slot empties.
   A bite that would do nothing (full hearts, whole armor, no gear) isn't taken. */
const pocketItem = i => (camp.pocket[i] ? satchelItem(camp.pocket[i]) : null);
function campEatSnack(i) {
  if (!campRun || gameState !== "PLAYING" || paused || campRun.over) return;
  const it = pocketItem(i);
  if (campBare()) { showToast("Bare Scales: no snacks in this quest."); return; }
  if (!it) { showToast(`Pocket slot ${i + 1} is empty.`); sfx("bad"); return; }
  const d = campItemDef(it.id), p = campItemPower(it), leg = it.rarity === "legendary";
  const P = ARMOR_PIECES();
  let said = "";
  if (it.id === "stew") {
    const max = campRun.startHearts || 0;
    if (currentHearts >= max) { showToast(max ? "Your hearts are already full." : "You have no hearts to heal yet."); sfx("bad"); return; }
    currentHearts = Math.min(max, currentHearts + p);
    said = "Hearty Stew! You feel better already.";
  } else if (it.id === "bread") {
    if (campRun.armor >= campRun.armorMax) { showToast(campRun.armorMax ? "Your armor is whole." : "You have no armor for it to grow back."); sfx("bad"); return; }
    campRun.armor = Math.min(campRun.armorMax, (Math.floor(campRun.armor / P) + p) * P);
    campSyncArmor();
    said = "Honey Bread! Your armor grows back.";
  } else if (it.id === "pie") {
    const g = campEquipped("gear");
    const full = g ? freshUses(g.id, g.rarity) : 0;
    if (!g || g.uses >= full) { showToast(g ? "Your gear is good as new." : "You have no gear to patch."); sfx("bad"); return; }
    g.uses = Math.min(full, g.uses + p);
    campRun.gearFx = performance.now();
    said = `Tinker's Pie patched your ${d && campItemDef(g.id).name}!`;
  } else if (it.id === "jerky") {
    const s = campEquipped("spell");
    const full = s ? freshUses(s.id, s.rarity) : 0;
    if (!s || s.uses >= full) { showToast(s ? "Your spell is fully charged." : "You have no spell to recharge."); sfx("bad"); return; }
    s.uses = Math.min(full, s.uses + p);
    said = "Spice Jerky! Your spell gets its spark back.";
  } else if (it.id === "tart") {
    if (campRun.phoenix) { showToast("The tart's warmth is already with you."); sfx("bad"); return; }
    campRun.phoenix = p;
    said = "Phoenix Tart! The next blow that would end you won't.";
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
   type: rock, popsicle, flea, fire, wasp, ghost, bramble, spikes.
   Returns "kill", "shove" or null (gear didn't help). */
function campGearMeets(type) {
  const gear = campEquippedId("gear");
  const leg = campEquippedRarity("gear") === "legendary";
  if (fieldOn()) { sfx("pop"); return "kill"; }
  const enemy = ["flea", "wasp", "ghost"].includes(type);
  if (gear === "sword") {
    if (enemy) { campUseGear("sword"); showToast("Your sword cut it down!"); sfx("rock"); campBonusEvent("kill"); return "kill"; }
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
  if (!it || campBare()) { showToast(campBare() ? "Bare Scales: no spells on this quest." : "No spell ready. Buy one on the Arcanum Spire."); return; }
  const ts = performance.now();
  if (ts < campRun.castReadyAt) return;
  campRun.castReadyAt = ts + 1500 * (1 - upPct("recharge")) * (1 + runeVal("castCooldown") / 100);
  const leg = it.rarity === "legendary";
  const p = campItemPower(it);
  let ok = true;
  if (it.id === "forcefield") { campRun.fieldUntil = ts + p * 1000; campRun.fieldBounce = leg; sfx("shimmer"); }
  else if (it.id === "fireball") ok = castFireball(p * (leg ? 2 : 1));
  else if (it.id === "blink") ok = castBlink(p, leg);
  else if (it.id === "frost") {
    freezeHazards(p * 1000);
    if (boss) boss.frozenUntil = ts + p * 500;
    if (hunter && hunter.alive) hunter.stunnedUntil = ts + p * 1000;
    campObjs.forEach(o => { if (o.kind === "thief") o.moveAt = ts + p * 1000; });
    sfx("molasses");
  } else if (it.id === "magnet") { buffs.lodeUntil = ts + p * 1000; campRun.magnetDouble = leg ? ts + p * 1000 : 0; sfx("portal"); }
  if (!ok) { campRun.castReadyAt = ts + 300; return; }
  // the Rune of the Sage's free casts go first, and don't spend the spell's charges
  if (campRun.freeCasts > 0) campRun.freeCasts--;
  else it.uses--;
  campBump("spellsCast");
  campBonusEvent("spell");
  if (it.uses <= 0) {
    showToast(`Your ${campItemDef(it.id).name} is spent.`);
    campDrop(it.uid);
  }
  saveCamp();
}

let campShots = [];        // fireballs in flight: { x, y, target, born }

function fireTargets() {
  const list = [];
  if (boss && !boss.beaten) list.push({ kind: "boss", get x() { return boss.cells[0].x; }, get y() { return boss.cells[0].y; } });
  if (hunter && hunter.alive) list.push({ kind: "hunter", get x() { return hunter.cells[0].x; }, get y() { return hunter.cells[0].y; } });
  entities.forEach(e => { if (["wasp", "ghost", "bramble", "bomb", "spikes"].includes(e.type)) list.push({ kind: "entity", ref: e, x: e.x, y: e.y }); });
  hazards.forEach(h => { if (h.type === "flea" || h.type === "fire") list.push({ kind: "hazard", ref: h, x: h.x, y: h.y }); });
  popsicles.forEach(pp => { if (!pp.isBonusApple) list.push({ kind: "popsicle", ref: pp, x: pp.x, y: pp.y }); });
  return list;
}

function castFireball(n) {
  const dist = t => maze ? Math.abs(wrapDelta(t.x - snake.x)) + Math.abs(wrapDelta(t.y - snake.y)) : Math.abs(t.x - snake.x) + Math.abs(t.y - snake.y);
  const targets = fireTargets().sort((a, b) => dist(a) - dist(b));
  if (!targets.length) { showToast("Nothing to burn."); return false; }
  for (let i = 0; i < n; i++) {
    const t = targets[Math.min(i, targets.length - 1)];
    campShots.push({ x: snake.x + cell / 2, y: snake.y + cell / 2, target: t, born: performance.now(), trail: [] });
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
    if (d <= step || ts - s.born > 2500) { fireballHits(t); return false; }
    s.x += dx / d * step; s.y += dy / d * step;
    return true;
  });
}

function fireballHits(t) {
  sfx("rock");
  if (t.kind === "boss" && boss && !boss.beaten) {
    if (boss.fight === 2 && boss.armor > 0) damageBoss(1, "fireball");
    else { boss.stamina = Math.max(0.02, boss.stamina - 0.2); showToast("Fireball! It's winded."); }
  } else if (t.kind === "hunter" && hunter && hunter.alive) stunHunter("star");
  else if (t.kind === "entity") { if (["wasp", "ghost"].includes(t.ref.type)) campBonusEvent("kill"); removeEntity(t.ref); }
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
  campRun.pet = it ? { id: it.id, rarity: it.rarity, nextAt: performance.now() + 2500, readyAt: 0, shells: it.id === "turtle" ? (it.rarity === "legendary" ? 2 : 1) : 0, fx: 0, fxAt: null } : null;
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
    const types = it.rarity === "legendary" ? ["wasp", "bramble", "spikes"] : ["wasp", "bramble"];
    const e = entities.find(x => types.includes(x.type) && near(x, range));
    const f = hazards.find(h => h.type === "flea" && near(h, range));
    const r = it.rarity === "legendary" ? rocks.find(x => near(x, range)) : null;
    const hit = e || f || r;
    if (!hit) { P.nextAt = ts + 500; return; }
    if (e) { if (e.type === "wasp") campBonusEvent("kill"); removeEntity(e); }
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
  drawPetSprite(ctx, P.id, x, y, cell * 0.8, ts, P);
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

function drawPetSprite(g, id, x, y, w, ts, P) {
  g.save();
  if (id === "firefly") {
    g.shadowColor = "#ffe86a"; g.shadowBlur = w * (0.6 + 0.4 * Math.sin(ts / 120));
    g.fillStyle = "#ffe86a"; g.fillRect(x + w * 0.35, y + w * 0.45, w * 0.3, w * 0.3);
    g.shadowBlur = 0;
    g.fillStyle = "#3a3020"; g.fillRect(x + w * 0.35, y + w * 0.25, w * 0.3, w * 0.22);
    g.fillStyle = "rgba(220,240,255,0.8)"; g.fillRect(x + w * 0.1, y + w * 0.15 + (Math.sin(ts / 40) > 0 ? 0 : w * 0.08), w * 0.25, w * 0.15); g.fillRect(x + w * 0.65, y + w * 0.15 + (Math.sin(ts / 40) > 0 ? 0 : w * 0.08), w * 0.25, w * 0.15);
  } else if (id === "crab") {
    g.fillStyle = "#ff5a3a"; g.fillRect(x + w * 0.2, y + w * 0.4, w * 0.6, w * 0.35);
    g.fillRect(x, y + w * 0.2 + (Math.sin(ts / 150) > 0 ? 0 : w * 0.08), w * 0.2, w * 0.2); g.fillRect(x + w * 0.8, y + w * 0.2, w * 0.2, w * 0.2);
    g.fillStyle = "#fff"; g.fillRect(x + w * 0.32, y + w * 0.3, w * 0.1, w * 0.1); g.fillRect(x + w * 0.58, y + w * 0.3, w * 0.1, w * 0.1);
  } else if (id === "turtle") {
    const ready = P && P.shells > 0;
    g.fillStyle = "#7ac85a"; g.fillRect(x + w * 0.75, y + w * 0.45, w * 0.22, w * 0.2);
    g.fillStyle = ready ? "#3a8a3a" : "#6a6a6a"; g.fillRect(x + w * 0.1, y + w * 0.3, w * 0.65, w * 0.45);
    g.fillStyle = ready ? "#5ab05a" : "#8a8a8a"; g.fillRect(x + w * 0.22, y + w * 0.38, w * 0.4, w * 0.25);
  } else if (id === "puffer") {
    g.fillStyle = "#ffcf5a"; g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.36, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c89a2a"; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fillRect(x + w / 2 + Math.cos(a) * w * 0.42 - 1, y + w / 2 + Math.sin(a) * w * 0.42 - 1, 2, 2); }
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.58, y + w * 0.38, w * 0.1, w * 0.1);
  } else if (id === "seahorse") {
    g.fillStyle = "#ff9ac8"; g.fillRect(x + w * 0.35, y + w * 0.15, w * 0.35, w * 0.3); g.fillRect(x + w * 0.3, y + w * 0.4, w * 0.3, w * 0.35); g.fillRect(x + w * 0.42, y + w * 0.72, w * 0.18, w * 0.2);
    g.fillRect(x + w * 0.68, y + w * 0.22, w * 0.2, w * 0.1);
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.5, y + w * 0.22, w * 0.08, w * 0.08);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.36, y + w * 0.05, w * 0.2, w * 0.08);   // a tiny monocle chain, presumably
  }
  g.restore();
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
