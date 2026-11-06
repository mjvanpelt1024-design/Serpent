/* =========================================================
   src/dev/terminal/cmd-camp.js
   The terminal, for the campaign (build 51). The old commands worked on
   the old save (XP, Snakebucks, the old islands); this file clears them
   and registers the campaign's own, on the same machinery (registry.js,
   terminal.js, cmd-help.js): every command still reads

       group  subject.action  value

   Groups: dev (rules, runs, spawning, bosses, orders, shops), debug
   (sounds, music, settings, screens, story pages), attribute (gems,
   money, points, hearts, stats), item (every item in the game: give,
   take, wear, junk, recipes, skins and themes), upgrade (the five
   trees), level (wins and unlocks) and data (save codes, lists, resets).

   Opening the terminal marks the campaign save as cheated, for good
   (Settings says so), the first time. Shift+Alt+C opens and closes it
   from anywhere; during a level it pauses the level behind it.
   ========================================================= */
"use strict";

COMMANDS.length = 0;
TERM_GROUPS.splice(0, TERM_GROUPS.length,
  ["dev", "Bend the rules: god mode, speed, runs, spawning anything, bosses, workshop orders, shops and quests"],
  ["debug", "Look under the hood: live stats, the grid, sounds, music, settings, screens, story pages"],
  ["attribute", "Read and change numbers: gems, every island's money, spell points, hearts, armor, score, stats"],
  ["item", "Every item in the game: give, take, wear, junk, crafted pieces, recipes, skins and themes"],
  ["upgrade", "Move any upgrade on the five trees up and down, or a whole tree"],
  ["level", "Win, unlock and lock levels and islands; go anywhere on the map"],
  ["data", "Save codes, lists of every id, the status report and wiping parts of the save"]);
GROUP_IDS.splice(0, GROUP_IDS.length, ...TERM_GROUPS.map(g => g[0]));
Object.assign(GROUP_ALIAS, { items: "item", inv: "item", levels: "level", lvl: "level", progress: "level", attr: "attribute" });

const campNeed = () => { if (!camp) fail("no campaign save loaded"); };
const CR = (group, subject, action, args, desc, run, extra) => cmd(group, subject, action, args, desc, (a, ctx) => { campNeed(); return run(a, ctx); }, extra);
const inLevel = () => !!campRun && (gameState === "PLAYING" || pauseDetour);
const needLevel = () => { if (!inLevel()) fail("no level in progress. start one with: dev run.play keep 3 hold"); };

/* ----- Names the commands take ----- */
const termIslandIds = () => CAMP.islands.map(i => i.id);
function resolveIsland(tok) {
  const t = squash(tok);
  if (!t) return null;
  if (/^\d+$/.test(t)) return (CAMP.islands[Number(t) - 1] || {}).id || null;
  const I = CAMP.islands.find(i => i.id === t || squash(i.name) === t || squash(i.name).startsWith(t) || squash(i.currency.id) === t || squash(i.currency.plural) === t || squash(i.theme) === t);
  return I ? I.id : null;
}
const islandOr = (tok, def = camp.at) => { if (tok === undefined) return def; const k = resolveIsland(tok); if (!k) fail(`which island? ${termIslandIds().join(", ")} (or 1-5)`); return k; };
const allItemIds = () => CAMP.items.map(i => i.id).concat(CAMP.loot.map(l => l.id), Object.keys(CAMP.craftById));
const itemName = id => (CAMP.itemById[id] || CAMP.lootById[id] || CAMP.craftById[id] || { name: id }).name;
function resolveItem(tok) {
  const t = squash(tok);
  return allItemIds().find(id => squash(id) === t || squash(itemName(id)) === t || squash(itemName(id).replace(/^(rune of (the )?)/i, "")) === t) || null;
}
const GRADE_WORDS = { broken: 0, refurbished: 1, cracked: 2, repaired: 3, fine: 4, polished: 5, pristine: 6, legendary: 7 };
const resolveRarity = tok => CAMP.rarities.find(r => squash(r.id) === squash(tok) || squash(r.name) === squash(tok) || squash(r.id[0]) === squash(tok)) || null;
const upName = id => camel((CAMP.upgradeById[id] || {}).name || id);
const resolveUp = tok => Object.keys(CAMP.upgradeById).find(id => squash(id) === squash(tok) || squash(CAMP.upgradeById[id].name || "") === squash(tok)) || null;
const statKeys = () => [...new Set(CAMP.rules.achievements.map(a => a.stat).concat(Object.keys(camp ? camp.stats : {})))];
const ENTITY_SPAWNS = () => Object.keys(ENTITY_TYPES).filter(k => !ENTITY_TYPES[k].global);
const SPAWN_LIST = () => ["apple", "rock", "popsicle", "flea", "fire", "molasses", "loot", "rival"].concat(ENTITY_SPAWNS());

function campChanged() {
  saveCamp();
  if (typeof campWalletUpdate === "function") campWalletUpdate();
  if (campRun && typeof campHudUpdate === "function") { lastHeartsKey = ""; campHudUpdate(); }
}

/* =========================================================
   dev
   ========================================================= */
cmd("dev", "damage", "godmode", "[true|false]", "Invincible: walls, tails, hazards, enemies and bosses can't hurt you or end a level. No value flips it.", a => {
  save.dev.invincible = needBool(a[0], !save.dev.invincible);
  say(`[ok] damage.godmode = ${save.dev.invincible}`);
}, { examples: ["dev damage.godmode true", "dev damage.godmode off"], aliases: ["god", "invincible"] });
cmd("dev", "controls", "reverse", "[true|false]", "Reversed steering. No value flips it.", a => { save.dev.reverse = needBool(a[0], !save.dev.reverse); say(`[ok] controls.reverse = ${save.dev.reverse}`); });
const PARAM_RANGES_CAMP = { speedMult: [0.1, 5], scoreMult: [0, 1000], scrollMult: [0.1, 5], hazardMult: [0, 10] };
function setCampMult(key, label, v) {
  const [lo, hi] = PARAM_RANGES_CAMP[key];
  if (v < lo || v > hi) fail(`${label} goes from ${lo} to ${hi}`);
  save.dev[key] = Math.round(v * 100) / 100;
  say(`[ok] ${label} = x${save.dev[key]}${inLevel() && key === "speedMult" ? "  (takes hold on the next level)" : ""}`);
}
cmd("dev", "speed", "mult", "<x>", "How fast the snake moves, 0.1 to 5 (1 is normal). Applies from the next level.", a => setCampMult("speedMult", "speed.mult", needNum(a[0], "speed")), { examples: ["dev speed.mult 0.5"] });
cmd("dev", "speed", "reset", "", "Normal speed again.", () => setCampMult("speedMult", "speed.mult", 1));
cmd("dev", "score", "mult", "<x>", "Multiply every point you score, 0 to 1000.", a => setCampMult("scoreMult", "score.mult", needNum(a[0], "multiplier")), { examples: ["dev score.mult 10"] });
cmd("dev", "scroll", "mult", "<x>", "How fast the endless road scrolls, 0.1 to 5.", a => setCampMult("scrollMult", "scroll.mult", needNum(a[0], "multiplier")));
cmd("dev", "hazard", "mult", "<x>", "How often hazards, enemies and power-ups turn up, 0 (never) to 10.", a => setCampMult("hazardMult", "hazard.mult", needNum(a[0], "multiplier")), { examples: ["dev hazard.mult 0"] });
cmd("dev", "rules", "show", "", "List every rule you have bent.", () => { say(paramSummary() || "all normal"); return "quiet"; });
cmd("dev", "rules", "reset", "", "Godmode, reverse and every multiplier back to normal.", () => {
  const fresh = defaultDev();
  ["speedMult", "scoreMult", "xpMult", "scrollMult", "hazardMult", "invincible", "reverse"].forEach(k => { save.dev[k] = fresh[k]; });
  say("[ok] every rule is back to normal");
});

/* ----- Runs ----- */
let devAnyLevel = false;
(() => { const open = campLevelOpen; window.campLevelOpen = function () { return devAnyLevel || open.apply(this, arguments); }; })();
CR("dev", "run", "play", "<island> <level> [hold] [bare]", "Play any level of any island, open or not (it doesn't unlock anything). hold freezes it behind the terminal so you can set it up first; bare skips the carry box.", a => {
  const isl = islandOr(a[0]);
  const n = a[1] !== undefined && /^\d+$/.test(a[1]) ? Number(a[1]) : campNextLevel(isl) || 1;
  if (n < 1 || n > LEVEL_COUNT) fail(`level goes from 1 to ${LEVEL_COUNT}`);
  const flags = a.slice(2).map(x => x.toLowerCase());
  if (campRun) campLeaveRun();
  clearPauseState();
  devAnyLevel = true;
  try { campStart(isl, n); } finally { devAnyLevel = false; }
  if (!campRun) fail("that level wouldn't start");
  if (flags.includes("hold")) {
    reviveCountdown = 0;
    document.getElementById("countdown").hidden = true;
    paused = true; pauseStartedAt = performance.now(); pauseDetour = true;
    openScreen("console");
    consolePrint(`[ok] ${CAMP.islandById[isl].name} ${n}. ${campLevelDef(isl, n).name} is held. spawn and set things, then: dev run.resume`);
  }
  return "quiet";
}, { examples: ["dev run.play keep 7", "dev run.play crown 15 hold", "dev run.play 3 12"] });
CR("dev", "run", "resume", "", "Let a held level (or one paused behind the terminal) carry on.", () => {
  if (!pauseDetour || !campRun) fail("no held level. start one with: dev run.play keep 3 hold");
  pauseDetour = false; pauseOpen = false; reviveCountdown = 0;
  document.getElementById("pause").classList.remove("active");
  showScreen(null);
  resumeFromPause();
  return "quiet";
});
CR("dev", "run", "win", "", "Win the level in progress, with its full reward.", () => {
  needLevel();
  if (pauseDetour) { pauseDetour = false; pauseOpen = false; paused = false; showScreen(null); }
  campWinLevel();
  return "quiet";
}, { aliases: ["victory"] });
const CAMP_END = ["quit", "wall", "self", "poison", "flea", "fire", "boss", "lightning", "wasp", "bee", "rivalbonk"];
CR("dev", "run", "end", "[cause]", "Lose the level in progress as if that killed you: " + CAMP_END.join(", ") + " (default quit: points still pay).", a => {
  needLevel();
  const cause = (a[0] || "quit").toLowerCase();
  if (pauseDetour) { pauseDetour = false; pauseOpen = false; paused = false; showScreen(null); }
  campFail(cause);
  return "quiet";
}, { examples: ["dev run.end wall"] });

/* ----- Spawning and clearing ----- */
CR("dev", "spawn", slot("<thing>", SPAWN_LIST), "[count] [small|large]", "Drop anything into the level in progress: apples, rocks, every enemy, hazard and power-up (data list.spawns), loot, or the rival snake.", (a, ctx) => {
  needLevel();
  const what = ctx.action;
  let grade = 1, count = 1;
  a.forEach(x => { const t = x.toLowerCase(); if (t === "small") grade = 0; else if (t === "large" || t === "big") grade = 2; else if (Number.isFinite(parseNum(t))) count = Math.max(1, Math.min(100, Math.floor(parseNum(t)))); else fail(`'${x}' is not a size or a count`); });
  const now = performance.now();
  let placed = 0;
  for (let i = 0; i < count; i++) {
    if (what === "rival") { if (typeof spawnRival === "function") { campRival = null; spawnRival(now); } placed = campRival ? 1 : 0; break; }
    if (ENTITY_TYPES[what]) { if (spawnEntity(what, endless ? endlessSpawnX() - cell * 3 : undefined)) placed++; continue; }
    const spot = spotFor(grade, endless ? endlessSpawnX() - cell * 3 : undefined);
    if (!spot) break;
    if (what === "apple") apples.push(spot);
    else if (what === "rock") rocks.push(spot);
    else if (what === "popsicle") popsicles.push(Object.assign(spot, { isBonusApple: false, spawnAt: now, expiresAt: now + 15000 }));
    else if (what === "loot") { const l = rollLoot(campRun.islandN); campObjs.push({ kind: "loot", x: spot.x, y: spot.y, id: l.id, until: now + 20000 }); }
    else hazards.push(Object.assign(spot, { type: what, spawnAt: now, expiresAt: now + 20000 }));
    placed++;
  }
  if (!placed) fail("no room on the board (or nothing to aim at)");
  say(`[ok] spawned ${placed} ${what}`);
}, { examples: ["dev spawn.bee 3", "dev spawn.rival", "dev spawn.honeypot", "dev spawn.lava 4"] });
const PURGE = ["enemies", "hazards", "powers", "rocks", "apples", "rival", "all"];
CR("dev", "purge", slot("<thing>", () => PURGE), "", "Clear the level in progress of: " + PURGE.join(", ") + ".", (a, ctx) => {
  needLevel();
  const w = ctx.action, kind = e => ENTITY_TYPES[e.type].kind;
  const enemy = e => ["bee", "yellowjacket", "imp", "mole", "crab", "wisp", "wasp", "ghost"].includes(e.type);
  if (w === "enemies" || w === "all") entities = entities.filter(e => !enemy(e));
  if (w === "hazards" || w === "all") { entities = entities.filter(e => kind(e) !== "hazard" || (enemy(e) && w !== "all")); hazards = []; popsicles = []; }
  if (w === "powers" || w === "all") entities = entities.filter(e => kind(e) !== "power");
  if (w === "rocks" || w === "all") rocks = [];
  if (w === "apples" || w === "all") { apples = []; maintainApples(); }
  if (w === "rival" || w === "all") campRival = null;
  say(`[ok] purged ${w}`);
}, { examples: ["dev purge.enemies", "dev purge.all"] });

/* ----- The boss ----- */
CR("dev", "boss", "exhaust", "", "Wear the boss out right now (it can be bitten).", () => { needLevel(); if (!boss) fail("no boss in this level"); boss.stamina = 0; boss.exhaustStart = performance.now(); boss.exhaustedUntil = performance.now() + boss.def.exhaustMs * (1 + upPct("exhaust")); say("[ok] the boss is exhausted"); });
CR("dev", "boss", "hurt", "[n]", "Knock n hearts (armor first) off the boss. Default 1.", a => { needLevel(); if (!boss) fail("no boss in this level"); damageBoss(Math.max(1, Math.floor(needNum(a[0] || "1"))), "dev"); say(`[ok] boss: ${boss.armor} armor, ${boss.hearts} hearts`); });
CR("dev", "boss", "stamina", "<0-100>", "Set the boss's stamina, in percent.", a => { needLevel(); if (!boss) fail("no boss in this level"); boss.stamina = Math.max(0, Math.min(1, needNum(a[0]) / 100)); say(`[ok] boss stamina ${Math.round(boss.stamina * 100)}%`); });

/* ----- Workshop orders, shops, quests ----- */
CR("dev", "orders", "list", "", "Every workshop order and when it's ready.", () => {
  if (!camp.orders.length) { say("no orders"); return "quiet"; }
  camp.orders.forEach(o => say(`#${o.n}  ${o.kind.padEnd(6)} ${orderLabel(o).padEnd(28)} ${CAMP.islandById[o.isl].npcs.merchant.shop}  ${orderReady(o) ? "READY" : "in " + fmtLeft(o.readyAt - Date.now())}`));
  return "quiet";
});
CR("dev", "orders", "finish", "[all|n]", "Make orders ready now: all (default) or one by its number.", a => {
  const which = (a[0] || "all").toLowerCase();
  const list = which === "all" ? camp.orders : camp.orders.filter(o => String(o.n) === which.replace("#", ""));
  if (!list.length) fail("no such order. try: dev orders.list");
  list.forEach(o => { o.readyAt = Date.now() - 1; });
  campChanged(); campOrdersChanged();
  say(`[ok] ${list.length} order${list.length === 1 ? "" : "s"} ready to collect`);
}, { examples: ["dev orders.finish", "dev orders.finish 3"] });
CR("dev", "orders", "collect", "[all]", "Collect every ready order without visiting the shops.", () => {
  const ready = readyOrders();
  if (!ready.length) fail("nothing is ready. try: dev orders.finish");
  ready.forEach(o => say("  " + (campCollect(o.n) || orderLabel(o))));
  campChanged();
});
CR("dev", "orders", "clear", "", "Throw away every order (sealing spells and training familiars come home unchanged).", () => { camp.orders = []; campChanged(); campOrdersChanged(); say("[ok] no orders"); });
CR("dev", "shop", "restock", "[island|all]", "New stock on the merchant's shelf now.", a => {
  const list = (a[0] || "").toLowerCase() === "all" ? termIslandIds() : [islandOr(a[0])];
  list.forEach(isl => merchantStock(isl, true));
  if (currentScreen === "campshop") renderShop();
  say(`[ok] restocked ${list.join(", ")}`);
}, { examples: ["dev shop.restock spire", "dev shop.restock all"] });
CR("dev", "shop", "open", "<island> [merchant|challenger|banker] [work]", "Walk into a shop, open or not. work opens the merchant's workshop side.", a => {
  const isl = islandOr(a[0]);
  const kind = ["challenger", "banker"].find(k => a.map(x => x.toLowerCase()).includes(k)) || "merchant";
  clearPauseState(); if (campRun) campLeaveRun();
  openCampShop(isl, kind);
  if (kind === "merchant" && a.map(x => x.toLowerCase()).includes("work")) ssSwitch("work");
  return "quiet";
}, { examples: ["dev shop.open keep work", "dev shop.open reef challenger"] });
CR("dev", "quest", "new", "[island]", "A fresh quest from the island's challenger.", a => { const isl = islandOr(a[0]); camp.challenges[isl] = newChallenge(isl); campChanged(); say(`[ok] new quest on ${CAMP.islandById[isl].name}: levels ${camp.challenges[isl].levels.join(", ")}`); });
CR("dev", "quest", "done", "[island]", "Accept the island's quest and finish all three trials (claim it at the challenger).", a => {
  const isl = islandOr(a[0]);
  const C = challengeState(isl);
  Object.assign(C, { active: true, claimed: false, startedAt: Date.now(), endsAt: Date.now() + 7 * 86400000, done: [true, true, true] });
  campChanged();
  say(`[ok] quest on ${CAMP.islandById[isl].name} is done: claim it from ${CAMP.islandById[isl].npcs.challenger.name}`);
});
CR("dev", "daily", "reset", "", "Let the daily gift (a spell upgrade point) come again the next time the map opens.", () => { camp.daily = 0; campChanged(); say("[ok] the daily gift is waiting"); });

/* ----- The whole game at once ----- */
CR("dev", "everything", "unlock", "", "100%: every level won flawlessly with its challenge earned, every tree maxed, every achievement (with its gems), every recipe, skin and theme, every story page seen.", () => {
  let won = 0;
  CAMP.islands.forEach(I => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      winRec(I.id, n);
      Object.assign(camp.levels[campLevelId(I.id, n)], { flawless: true, bonus: true });
      won++;
    }
    STORY_BEATS.forEach(b => { if (!camp.storySeen.includes(storyId(I.id, b))) camp.storySeen.push(storyId(I.id, b)); });
  });
  Object.values(CAMP.upgradeById).forEach(u => { camp.upgrades[u.id] = u.values.length - 1; });
  let gems = 0;
  CAMP.rules.achievements.forEach(x => { if (!camp.achievements[x.id]) { camp.achievements[x.id] = true; camp.gems += x.gems; gems += x.gems; } });
  Object.keys(CAMP.recipeById).forEach(id => { if (!camp.recipes.includes(id)) camp.recipes.push(id); });
  CONTENT.skins.forEach(s => { if (!camp.skins.includes(s.id)) camp.skins.push(s.id); });
  CONTENT.themes.forEach(s => { if (!camp.themes.includes(s.id)) camp.themes.push(s.id); });
  campChanged();
  say(`[ok] 100%: ${won} levels won flawlessly, ${Object.keys(CAMP.upgradeById).length} upgrades maxed, ${CAMP.rules.achievements.length} achievements (+${gems} gems), ${camp.recipes.length} recipes, ${camp.skins.length} skins, ${camp.themes.length} themes`);
  note("want a full kit too? item everything.give legendary");
}, { aliases: ["100", "complete"] });

/* Wiping the whole game waits for the word CONFIRM, typed exactly, on the next line */
let resetPending = false;
CR("dev", "everything", "reset", "", "Reset the whole game back to nothing: a brand new save, every bent rule back to normal, the cheated marker gone. Asks you to type CONFIRM first, then closes the terminal.", () => {
  resetPending = true;
  consolePrint("This wipes EVERYTHING: every level, coin, gem, item, upgrade, recipe, skin and theme. Your settings stay.", "err");
  consolePrint("The save will no longer be marked as cheated. There is no undo.", "err");
  say("Type CONFIRM (in capitals) to reset the game. Anything else cancels.");
  return "quiet";
}, { aliases: ["wipe"] });
function resetEverythingForReal() {
  if (campRun) campLeaveRun();
  clearPauseState();
  resetCamp();                          // a fresh save (the old one is kept aside in storage, never loaded)
  camp.flags.cheats = false;
  camp.flags.restored = 0;
  saveCamp();
  // the old engine's half of the save: the terminal asks again next time, every rule back to normal
  save.cheats = false;
  save.dev = defaultDev();
  persist();
  applyCampCosmetics();
  campOrdersChanged();
  consoleLogEl.innerHTML = "";
  campTermBooted = false;
  showToast("The game is reset. A brand new adventure starts with Play.");
  openScreen("main");
}
(() => {
  const run = runConsole;
  window.runConsole = function (raw) {
    if (!resetPending) return run.apply(this, arguments);
    resetPending = false;
    const line = String(raw || "").trim();
    consolePrint(">> " + line, "in");
    if (line === "CONFIRM") { resetEverythingForReal(); return; }
    consolePrint("[cancelled] nothing was reset", "dim");
  };
})();

/* =========================================================
   attribute
   ========================================================= */
const numAct = slot("<get|set|add|sub>", () => ["get", "set", "add", "sub"]);
function applyNum(cur, act, a, min, max, what) {
  if (act === "get") return cur;
  const v = needNum(a[0], what);
  const out = act === "set" ? v : act === "add" ? cur + v : cur - v;
  return Math.max(min, Math.min(max, Math.round(out * 2) / 2));
}
CR("attribute", "gems", numAct, "[n]", "Gems: the one money every island shares.", (a, ctx) => {
  const v = applyNum(camp.gems, ctx.action, a, 0, 1e9, "gems");
  if (ctx.action === "get") { say(`gems = ${fmtInt(v)}`); return "quiet"; }
  camp.gems = Math.floor(v); campChanged(); say(`[ok] gems = ${fmtInt(camp.gems)}`);
}, { examples: ["attribute gems.set 500", "attribute gems.add 50"] });
CR("attribute", "money", numAct, "[n] [island|all]", "Each island's own money (Snaycoins, Slithers, Scales, Pearls, Orobucks). The island defaults to where you are; all changes every one.", (a, ctx) => {
  const isls = (a[ctx.action === "get" ? 0 : 1] || "").toLowerCase() === "all" ? termIslandIds() : [islandOr(a[ctx.action === "get" ? 0 : 1])];
  isls.forEach(isl => {
    const c = campCurrency(isl).id;
    const v = applyNum(camp.wallet[c] || 0, ctx.action, a, 0, 1e12, "money");
    if (ctx.action !== "get") camp.wallet[c] = Math.floor(v);
    say(`${ctx.action === "get" ? "" : "[ok] "}${campCurrency(isl).plural} = ${fmtInt(camp.wallet[c])}`);
  });
  if (ctx.action === "get") return "quiet";
  campChanged();
}, { examples: ["attribute money.set 5000 all", "attribute money.add 300 crown", "attribute money.get spire"] });
CR("attribute", "spellPoints", numAct, "[n]", "Spell upgrade points, spent at the Arcanum Spire's lectern.", (a, ctx) => {
  const v = applyNum(camp.spellPts, ctx.action, a, 0, 1e6, "points");
  if (ctx.action === "get") { say(`spell points = ${v}`); return "quiet"; }
  camp.spellPts = Math.floor(v); campChanged(); say(`[ok] spell points = ${camp.spellPts}`);
}, { examples: ["attribute spellPoints.set 80"] });
CR("attribute", "hearts", numAct, "[n]", "Hearts in the level in progress (halves allowed).", (a, ctx) => {
  needLevel();
  const v = applyNum(currentHearts, ctx.action, a, 0, 20, "hearts");
  if (ctx.action === "get") { say(`hearts = ${v}`); return "quiet"; }
  currentHearts = v; campRun.startHearts = Math.max(campRun.startHearts || 0, v); campChanged(); say(`[ok] hearts = ${currentHearts}`);
}, { examples: ["attribute hearts.set 5"] });
CR("attribute", "armor", numAct, "[plates]", "Armor plates in the level in progress.", (a, ctx) => {
  needLevel();
  const P = ARMOR_PIECES();
  const v = applyNum(campRun.armor / P, ctx.action, a, 0, 12, "plates");
  if (ctx.action === "get") { say(`armor = ${v} plates`); return "quiet"; }
  campRun.armor = Math.round(v * P); campRun.armorMax = Math.max(campRun.armorMax, campRun.armor); campSyncArmor(); campChanged(); say(`[ok] armor = ${v} plates`);
});
CR("attribute", "score", numAct, "[n]", "The score of the level in progress.", (a, ctx) => {
  needLevel();
  const v = applyNum(score, ctx.action, a, 0, 1e12, "score");
  if (ctx.action === "get") { say(`score = ${fmtInt(v)}`); return "quiet"; }
  score = Math.floor(v); updateHud(); say(`[ok] score = ${fmtInt(score)}`);
}, { examples: ["attribute score.add 5k"] });
CR("attribute", "length", "add", "<n>", "Grow (or with a minus, shrink) the snake in the level in progress.", a => { needLevel(); snake.maxCells = Math.max(2, snake.maxCells + Math.floor(needNum(a[0]))); say(`[ok] length ${snake.maxCells}`); });
CR("attribute", "stat", slot("<name>", statKeys), "[get|set n]", "A campaign statistic (the ones achievements count: data list.stats).", (a, ctx) => {
  const k = ctx.action;
  if (!a.length || a[0] === "get") { say(`${k} = ${fmtInt(campStatValue(k))}`); return "quiet"; }
  const v = needNum(a[a[0] === "set" ? 1 : 0]);
  camp.stats[k] = Math.max(0, Math.floor(v)); campCheckAch(); campChanged(); say(`[ok] ${k} = ${fmtInt(camp.stats[k])}`);
}, { examples: ["attribute stat.applesEaten 500", "attribute stat.levelsWon get"] });
CR("attribute", "achievements", "grant", "<id|all>", "Earn achievements (and their gems): one by id, or all.", a => {
  const t = (a[0] || "").toLowerCase();
  const list = t === "all" ? CAMP.rules.achievements : CAMP.rules.achievements.filter(x => squash(x.id) === squash(t));
  if (!list.length) fail("which achievement? try: data list.achievements");
  let gems = 0;
  list.forEach(x => { if (!camp.achievements[x.id]) { camp.achievements[x.id] = true; camp.gems += x.gems; gems += x.gems; } });
  campChanged(); say(`[ok] ${list.length} achievement${list.length === 1 ? "" : "s"}, +${gems} gems`);
});
CR("attribute", "achievements", "reset", "", "Forget every achievement (gems already paid stay).", () => { camp.achievements = {}; campChanged(); say("[ok] achievements cleared"); });
CR("attribute", "name", "set", "<name>", "The snake's name.", a => { if (!a.length) fail("what name?"); camp.name = a.join(" ").slice(0, 16); camp.named = true; applyCampCosmetics(); campChanged(); say(`[ok] name = ${camp.name}`); });

/* =========================================================
   item: every item in the game
   ========================================================= */
/* The words after `item <id>.give`: a rarity or a rune's condition, a count, fresh, lv=N, seal, train=N, parts, trinket=<id> */
function parseGive(id, a) {
  const d = CAMP.itemById[id];
  const out = { rarity: "common", n: 1, extra: {} };
  a.forEach(x => {
    const t = x.toLowerCase();
    const r = resolveRarity(t);
    if (d && d.family === "rune" && t in GRADE_WORDS) { out.extra.grade = GRADE_WORDS[t]; out.rarity = gradeRarity(GRADE_WORDS[t]); }
    else if (d && d.family === "rune" && r && !(t in GRADE_WORDS)) { out.rarity = r.id; }
    else if (r) out.rarity = r.id;
    else if (t === "fresh") out.extra.fresh = true;
    else if (t === "seal" || t === "sealed") out.extra.seal = true;
    else if (/^lv=\d+$/.test(t)) out.extra.lv = Math.min(10, Number(t.slice(3)));
    else if (/^train=\d+$/.test(t)) out.extra.train = Math.min(3, Number(t.slice(6)));
    else if (t === "parts") out.extra.parts = d && d.family === "gear" ? partsFor(id).map(p => p.id) : [];
    else if (/^trinket=/.test(t)) { const k = resolveItem(t.slice(8)); if (!k || !CAMP.craftById[k] || !CAMP.craftById[k].stat) fail("trinket=<id>, e.g. trinket=t_frost"); out.extra.trinket = k; }
    else if (Number.isFinite(parseNum(t))) out.n = Math.max(1, Math.min(999, Math.floor(parseNum(t))));
    else fail(`'${x}' isn't a rarity, a condition, a count, fresh, seal, lv=N, train=N, parts or trinket=<id>`);
  });
  return out;
}
function giveItem(id, p) {
  let last = null;
  for (let i = 0; i < p.n; i++) {
    last = campGive(id, p.rarity, Object.keys(p.extra).length ? JSON.parse(JSON.stringify(p.extra)) : null);
    if (last && (p.extra.parts || p.extra.trinket || p.extra.lv || p.extra.seal) && campItemSlot(id) !== "loot") last.uses = freshUses(last.id, last.rarity, last);
    if (["loot", "craft"].includes(campItemSlot(id)) && p.n > 1) { last.qty = Math.min(999, last.qty + p.n - 1); break; }
  }
  return last;
}
CR("item", slot("<item>", allItemIds, resolveItem), "give", "[rarity|condition] [count] [fresh] [lv=N] [seal] [train=N] [parts] [trinket=<id>]", "Give any item: gear, spells, snacks, familiars, runes (broken to legendary), heart canisters, junk, crafted trinkets and parts. Names work too (data list.items).", (a, ctx) => {
  const id = ctx.subject;
  const p = parseGive(id, a);
  const it = giveItem(id, p);
  campChanged();
  say(`[ok] +${p.n} ${campItemName(it)}${p.n > 1 && !["loot", "craft"].includes(campItemSlot(id)) ? "s" : ""}`);
}, { examples: ["item sword.give legendary parts trinket=t_rivet", "item fireball.give rare lv=10 seal", "item plenty.give polished", "item goblet.give 20", "item stew.give 4 fresh", "item crab.give train=3"] });
CR("item", slot("<item>", allItemIds, resolveItem), "take", "[count|all]", "Take items of that kind out of the satchel (the newest first).", (a, ctx) => {
  const id = ctx.subject;
  const all = (a[0] || "").toLowerCase() === "all";
  let n = all ? Infinity : Math.max(1, Math.floor(needNum(a[0] || "1")));
  let took = 0;
  camp.satchel.filter(it => it.id === id).reverse().forEach(it => {
    while (n > 0 && it.qty > 1) { it.qty--; n--; took++; }
    if (n > 0) { campDrop(it.uid); n--; took++; }
  });
  if (!took) fail(`you have no ${itemName(id)}`);
  campChanged(); say(`[ok] took ${took} ${itemName(id)}`);
});
CR("item", slot("<item>", allItemIds, resolveItem), "equip", "", "Wear, carry or bring the best one of that item you have (snacks go in the pocket).", (a, ctx) => {
  const list = camp.satchel.filter(it => it.id === ctx.subject).sort((x, y) => rarityIdx(y.rarity) - rarityIdx(x.rarity));
  if (!list.length) fail(`you have no ${itemName(ctx.subject)}. give one first: item ${ctx.subject}.give`);
  const it = list[0], slotId = campItemSlot(it.id);
  if (slotId === "food") { const f = camp.pocket.indexOf(0); if (f < 0) fail("the pocket is full"); if (!camp.pocket.includes(it.uid)) camp.pocket[f] = it.uid; }
  else if (["loot", "craft"].includes(slotId)) fail("that can't be worn");
  else camp.equip[slotId] = it.uid;
  campChanged(); say(`[ok] ${campItemName(it)} is on`);
});
CR("item", "satchel", "list", "[kind]", "Everything you own, with uids: gear, spell, food, pet, rune, canister, loot, craft or all.", a => {
  const k = (a[0] || "all").toLowerCase();
  const list = camp.satchel.filter(it => k === "all" || campItemSlot(it.id) === k || (k === "snack" && campItemSlot(it.id) === "food") || (k === "junk" && campItemSlot(it.id) === "loot"));
  if (!list.length) { say("nothing"); return "quiet"; }
  list.forEach(it => say(`#${String(it.uid).padEnd(5)} ${campItemSlot(it.id).padEnd(8)} ${campItemName(it)}${it.qty > 1 ? " x" + it.qty : ""}${Object.values(camp.equip).includes(it.uid) || camp.pocket.includes(it.uid) ? "  [on]" : ""}${itemAway(it.uid) ? "  [away]" : ""}`));
  return "quiet";
}, { examples: ["item satchel.list", "item satchel.list rune"] });
CR("item", "satchel", "clear", "yes", "Empty the satchel (everything you own goes).", a => { if ((a[0] || "").toLowerCase() !== "yes") fail("add yes to be sure: item satchel.clear yes"); camp.satchel = []; camp.equip = {}; camp.pocket = [0, 0, 0, 0]; campChanged(); say("[ok] the satchel is empty"); });
CR("item", "everything", "give", "[rarity]", "One of every gear, spell, snack, familiar and rune, and a heart canister (default rare).", a => {
  const r = a[0] ? resolveRarity(a[0]) : CAMP.rarityById.rare;
  if (!r) fail("rarity: common, uncommon, rare or legendary");
  CAMP.items.forEach(d => campGive(d.id, r.id));
  campChanged(); say(`[ok] +${CAMP.items.length} items, all ${r.name.toLowerCase()}`);
}, { aliases: ["all"] });
CR("item", "junk", "give", "[count] [common|uncommon|rare]", "Some of every junk material (or of one grade). Default 5 each.", a => {
  let n = 5, gr = null;
  a.forEach(x => { if (["common", "uncommon", "rare"].includes(x.toLowerCase())) gr = x.toLowerCase(); else n = Math.max(1, Math.min(999, Math.floor(needNum(x)))); });
  const list = CAMP.loot.filter(l => !gr || l.grade === gr);
  list.forEach(l => giveItem(l.id, { rarity: "common", n, extra: {} }));
  campChanged(); say(`[ok] +${n} of ${list.length} junk materials`);
}, { examples: ["item junk.give 10", "item junk.give 3 rare"] });
CR("item", "crafted", "give", "[count]", "Some of every trinket and part the workbench makes. Default 1 each.", a => {
  const n = Math.max(1, Math.min(99, Math.floor(needNum(a[0] || "1"))));
  Object.keys(CAMP.craftById).forEach(id => giveItem(id, { rarity: "common", n, extra: {} }));
  campChanged(); say(`[ok] +${n} of ${Object.keys(CAMP.craftById).length} trinkets and parts`);
});
CR("item", "recipes", "learn", "<id|all>", "Learn kitchen recipes: one by id, or all.", a => {
  const t = (a[0] || "").toLowerCase();
  const ids = t === "all" ? Object.keys(CAMP.recipeById) : Object.keys(CAMP.recipeById).filter(id => squash(id) === squash(t) || squash(CAMP.recipeById[id].name) === squash(t));
  if (!ids.length) fail("which recipe? try: data list.recipes");
  ids.forEach(id => { if (!camp.recipes.includes(id)) camp.recipes.push(id); });
  campChanged(); say(`[ok] know ${camp.recipes.length} of ${Object.keys(CAMP.recipeById).length} recipes`);
});
CR("item", "recipes", "forget", "", "Forget every recipe.", () => { camp.recipes = []; campChanged(); say("[ok] no recipes"); });
CR("item", "skins", "unlock", "<id|all>", "Own skins: one by id, or all (exclusives too).", a => {
  const t = (a[0] || "").toLowerCase();
  const ids = t === "all" ? CONTENT.skins.map(s => s.id) : CONTENT.skins.filter(s => squash(s.id) === squash(t) || squash(s.name || "") === squash(t)).map(s => s.id);
  if (!ids.length) fail("which skin? try: data list.skins");
  ids.forEach(id => { if (!camp.skins.includes(id)) camp.skins.push(id); });
  campChanged(); say(`[ok] own ${camp.skins.length} skins`);
});
CR("item", "themes", "unlock", "<id|all>", "Own themes: one by id, or all.", a => {
  const t = (a[0] || "").toLowerCase();
  const ids = t === "all" ? CONTENT.themes.map(s => s.id) : CONTENT.themes.filter(s => squash(s.id) === squash(t) || squash(s.name || "") === squash(t)).map(s => s.id);
  if (!ids.length) fail("which theme? try: data list.themes");
  ids.forEach(id => { if (!camp.themes.includes(id)) camp.themes.push(id); });
  campChanged(); say(`[ok] own ${camp.themes.length} themes`);
});
CR("item", "pocket", "fill", "", "Fill the snack pocket with the first snacks you have.", () => {
  const snacks = camp.satchel.filter(it => campItemSlot(it.id) === "food" && !camp.pocket.includes(it.uid));
  for (let i = 0; i < 4; i++) if (!camp.pocket[i] && snacks.length) camp.pocket[i] = snacks.shift().uid;
  campChanged(); say("[ok] pocket: " + camp.pocket.map(u => (u ? campItemName(satchelItem(u)) : "empty")).join(", "));
});

/* =========================================================
   upgrade
   ========================================================= */
const upIds = () => Object.keys(CAMP.upgradeById);
const upMax = id => CAMP.upgradeById[id].values.length - 1;
CR("upgrade", slot("<upgrade>", upIds, resolveUp), slot("<set|max|reset|advance|get>", () => ["set", "max", "reset", "advance", "get"]), "[n]", "Move one upgrade on the trees (data list.upgrades): set to a tier, max, reset to none, advance by n, or get.", (a, ctx) => {
  const id = ctx.subject, U = CAMP.upgradeById[id];
  const cur = camp.upgrades[id] || 0;
  let v = cur;
  if (ctx.action === "get") { say(`${U.name}: tier ${cur} of ${upMax(id)}  (${U.values[cur]})`); return "quiet"; }
  if (ctx.action === "max") v = upMax(id);
  else if (ctx.action === "reset") v = 0;
  else if (ctx.action === "set") v = Math.floor(needNum(a[0], "tier"));
  else v = cur + Math.floor(needNum(a[0] || "1"));
  camp.upgrades[id] = Math.max(0, Math.min(upMax(id), v));
  campChanged(); say(`[ok] ${U.name}: tier ${camp.upgrades[id]} of ${upMax(id)}`);
}, { examples: ["upgrade hearts.max", "upgrade plating.set 2", "upgrade sturdy.advance"] });
CR("upgrade", "tree", slot("<max|reset>", () => ["max", "reset"]), "[island|all]", "Max or reset a whole island's tree, or every tree.", (a, ctx) => {
  const isls = (a[0] || "").toLowerCase() === "all" ? termIslandIds() : [islandOr(a[0])];
  isls.forEach(isl => CAMP.islandById[isl].tree.upgrades.forEach(u => { camp.upgrades[u.id] = ctx.action === "max" ? u.values.length - 1 : 0; }));
  campChanged(); say(`[ok] ${ctx.action === "max" ? "maxed" : "reset"} ${isls.map(i => CAMP.islandById[i].tree.name).join(", ")}`);
}, { examples: ["upgrade tree.max all", "upgrade tree.reset keep"] });

/* =========================================================
   level
   ========================================================= */
const winRec = (isl, n) => { camp.levels[campLevelId(isl, n)] = Object.assign({ wins: 0, best: 0, flawless: false, bonus: false }, camp.levels[campLevelId(isl, n)]); camp.levels[campLevelId(isl, n)].wins = Math.max(1, camp.levels[campLevelId(isl, n)].wins); };
CR("level", slot("<island>", termIslandIds, resolveIsland), "unlock", "[n|all]", "Win every level of the island up to n (all: the whole island), which opens its shops, the bridge and the next island. Earlier islands are won too.", (a, ctx) => {
  const isl = ctx.subject, to = !a[0] || a[0].toLowerCase() === "all" ? LEVEL_COUNT : Math.max(0, Math.min(LEVEL_COUNT, Math.floor(needNum(a[0]))));
  CAMP.islands.slice(0, campIslandIdx(isl)).forEach(I => { for (let n = 1; n <= LEVEL_COUNT; n++) winRec(I.id, n); });
  for (let n = 1; n <= to; n++) winRec(isl, n);
  campChanged(); say(`[ok] ${CAMP.islandById[isl].name}: levels 1-${to} won`);
}, { examples: ["level keep.unlock all", "level reef.unlock 10"] });
CR("level", slot("<island>", termIslandIds, resolveIsland), "lock", "[from]", "Forget the island's wins from level `from` on (default 1), and every island after it.", (a, ctx) => {
  const isl = ctx.subject, from = Math.max(1, Math.floor(needNum(a[0] || "1")));
  Object.keys(camp.levels).forEach(k => { const [i, n] = k.split(":"); if ((i === isl && +n >= from) || campIslandIdx(i) > campIslandIdx(isl)) delete camp.levels[k]; });
  if (!campIslandOpen(camp.at)) camp.at = CAMP.islands[0].id;
  campChanged(); say(`[ok] ${CAMP.islandById[isl].name}: levels ${from}+ locked`);
});
CR("level", slot("<island>", termIslandIds, resolveIsland), "win", "<n>", "Mark one level won (it doesn't win the ones before it).", (a, ctx) => { const n = Math.floor(needNum(a[0], "level")); if (n < 1 || n > LEVEL_COUNT) fail("level 1-15"); winRec(ctx.subject, n); campChanged(); say(`[ok] ${ctx.subject} ${n} won`); });
CR("level", slot("<island>", termIslandIds, resolveIsland), "go", "", "Fly to the island on the map.", (a, ctx) => {
  if (!campIslandOpen(ctx.subject)) fail("that island isn't open. open it with: level " + CAMP.islands[campIslandIdx(ctx.subject) - 1].id + ".unlock all");
  camp.at = ctx.subject; mapReturnTo = ctx.subject; clearPauseState(); if (campRun) campLeaveRun();
  openScreen("modes");
  return "quiet";
});
CR("level", "everything", "unlock", "", "Win every level on every island.", () => { CAMP.islands.forEach(I => { for (let n = 1; n <= LEVEL_COUNT; n++) winRec(I.id, n); }); campChanged(); say("[ok] all 75 levels won"); }, { aliases: ["all"] });
CR("level", "challenges", "earn", "[island|all]", "Mark every level's one-time challenge reward as earned.", a => {
  const isls = (a[0] || "all").toLowerCase() === "all" ? termIslandIds() : [islandOr(a[0])];
  isls.forEach(isl => { for (let n = 1; n <= LEVEL_COUNT; n++) { winRec(isl, n); camp.levels[campLevelId(isl, n)].bonus = true; } });
  campChanged(); say(`[ok] challenges earned on ${isls.join(", ")}`);
});

/* =========================================================
   debug
   ========================================================= */
const STAT_NAMES_C = { fps: "statFps", speed: "statSpeed", rate: "statRate", items: "statItems", length: "statLength", distance: "statDistance" };
cmd("debug", "stat", slot("<name>", () => Object.keys(STAT_NAMES_C).concat("all")), "[true|false]", "A live readout under the board: " + Object.keys(STAT_NAMES_C).join(", ") + ", or all.", (a, ctx) => {
  const keys = ctx.action === "all" ? Object.values(STAT_NAMES_C) : [STAT_NAMES_C[ctx.action]];
  const on = needBool(a[0], !keys.every(k => save.dev[k]));
  keys.forEach(k => { save.dev[k] = on; });
  say(`[ok] stat.${ctx.action} = ${on}`);
});
cmd("debug", "grid", "show", "[true|false]", "Draw the movement grid over the board.", a => { save.dev.grid = needBool(a[0], !save.dev.grid); say(`[ok] grid.show = ${save.dev.grid}`); });
cmd("debug", "sfx", "play", "<sound>", "Play a sound effect (data list.sfx).", a => { const n = (a[0] || "").toLowerCase(); if (!SFX[n]) fail("unknown sound. try: data list.sfx"); sfx(n); say(`[ok] played ${n}`); return "quiet"; });
cmd("debug", "music", "play", "<track>", "Force a music theme (data list.music).", a => { const n = (a[0] || "").toLowerCase(); if (!TRACKS[n]) fail("unknown track. try: data list.music"); debugTrack = n; updateMusic(); say(`[ok] music = ${n}`); });
cmd("debug", "music", "off", "", "Silence the music.", () => { debugTrack = "off"; updateMusic(); say("[ok] music off"); });
cmd("debug", "music", "auto", "", "Let the game pick the music again.", () => { debugTrack = null; updateMusic(); say("[ok] music is back to normal"); });
cmd("debug", "setting", slot("<key>", () => Object.keys(save.settings)), "[value]", "Read or change a setting by its key (data list.settings).", (a, ctx) => {
  const k = ctx.action;
  if (!a.length) { say(`${k} = ${JSON.stringify(save.settings[k])}`); return "quiet"; }
  const cur = save.settings[k];
  const v = typeof cur === "boolean" ? needBool(a[0]) : typeof cur === "number" ? needNum(a[0], k) : a.join(" ");
  const probe = JSON.parse(JSON.stringify(save));
  probe.settings[k] = v;
  save.settings[k] = sanitizeSave(probe).settings[k];
  syncSettings(); updateMusic();
  say(`[ok] ${k} = ${JSON.stringify(save.settings[k])}`);
}, { examples: ["debug setting.musicVolume 80"] });
const CAMP_SCREENS = ["title", "map", "home", "shop", "workshop", "challenger", "bank", "tree", "satchel", "rack", "shelf", "den", "stones", "tailor", "trophies", "settings"];
cmd("debug", "screen", "open", "<screen> [island]", "Jump to a screen: " + CAMP_SCREENS.join(", ") + ". The island defaults to where you are. Leaving a level abandons it.", a => {
  campNeed();
  const s = (a[0] || "").toLowerCase();
  if (!CAMP_SCREENS.includes(s)) fail("open what? " + CAMP_SCREENS.join(", "));
  const isl = islandOr(a[1]);
  clearPauseState(); if (campRun) campLeaveRun();
  if (s === "title") openScreen("main");
  else if (s === "map") { mapReturnTo = isl; openScreen("modes"); }
  else if (s === "home") openCampHome(isl);
  else if (s === "shop" || s === "workshop") { openCampShop(isl, "merchant"); if (s === "workshop") ssSwitch("work"); }
  else if (s === "challenger" || s === "bank") openCampShop(isl, s === "bank" ? "banker" : "challenger");
  else if (s === "tree") openCampTree(isl);
  else if (["satchel", "rack", "shelf", "den", "stones"].includes(s)) { homeIsl = isl; openPicRoom(s); }
  else if (s === "tailor") openScreen("upgrades");
  else if (s === "trophies") openScreen("achievements");
  else openScreen("settings");
  return "quiet";
}, { examples: ["debug screen.open workshop crown", "debug screen.open rack"] });
cmd("debug", "story", "show", "<island> <arrive|boss1|boss2|boss3>", "Show a story placeholder page again.", a => {
  campNeed();
  const isl = islandOr(a[0]), beat = (a[1] || "arrive").toLowerCase();
  if (!STORY_BEATS.includes(beat)) fail("beat: " + STORY_BEATS.join(", "));
  camp.storySeen = camp.storySeen.filter(x => x !== storyId(isl, beat));
  campStoryBeat(isl, beat, 0);
  return "quiet";
}, { examples: ["debug story.show spire boss2"] });
cmd("debug", "toast", "show", "<text>", "Show a toast with your text.", a => { if (!a.length) fail("what text?"); showToast(a.join(" ")); });
cmd("debug", "confetti", "fire", "", "A burst of confetti.", () => { confetti(); });
cmd("debug", "fullscreen", "toggle", "", "Go full screen, or come back out.", () => { toggleFullscreen(); });
cmd("debug", "layout", "show", "", "How big the board is drawn, and which layout is in use.", () => {
  const r = stageEl.getBoundingClientRect();
  say(`board ${Math.round(r.width)}x${Math.round(r.height)} px  window ${window.innerWidth}x${window.innerHeight}  ${document.body.classList.contains("wide") ? "side rails" : "stacked"}`);
  return "quiet";
});

/* =========================================================
   data
   ========================================================= */
cmd("data", "saveCode", "generate", "", "Print a backup code of the campaign save (COIL1-...) and copy it where the browser allows.", () => {
  campNeed();
  const code = exportCamp();
  say(code);
  try { navigator.clipboard.writeText(code); note("(copied)"); } catch (e) { /* no clipboard */ }
  return "quiet";
});
cmd("data", "saveCode", "load", "<code> [yes]", "Replace the campaign save with a backup code. It checks the code first; add yes to go through with it.", a => {
  campNeed();
  if (!a[0]) fail("paste a COIL1- code");
  const got = parseCampCode(a[0]);
  if (got.err) fail(got.err);
  if ((a[1] || "").toLowerCase() !== "yes") { say(`the code is good: ${got.data.name}, ${Object.keys(got.data.levels).length} levels played. add yes to load it.`); return "quiet"; }
  importCamp(a[0]); campChanged(); say("[ok] loaded");
});
cmd("data", "save", "size", "", "How big the campaign save is.", () => { campNeed(); say(`${fmtInt(JSON.stringify(camp).length)} characters`); return "quiet"; });
cmd("data", "status", "show", "", "A summary of the save, the level in progress and any bent rules.", () => { statusReport(); return "quiet"; });
cmd("data", "build", "version", "", "The build number.", () => { say(BUILD_NUMBER); return "quiet"; });
const CAMP_LISTS = {
  islands: () => CAMP.islands.map(I => `${I.n}  ${I.id.padEnd(7)} ${I.name}  (${I.currency.plural}, sells ${CAMP.families[I.merchantFamily].name.toLowerCase()})`),
  levels: a => { const isl = islandOr(a[0]); return CAMP.islandById[isl].levels.map(l => `${String(l.n).padStart(2)}  ${l.name.padEnd(26)} ${l.kind}${campWon(isl, l.n) ? "  won" : ""}`); },
  items: () => CAMP.items.map(d => `${d.id.padEnd(12)} ${d.family.padEnd(7)} ${d.name}`),
  gear: () => CAMP.items.filter(d => d.family === "gear").map(d => `${d.id.padEnd(10)} ${d.name}`),
  spells: () => CAMP.items.filter(d => d.family === "spell").map(d => `${d.id.padEnd(10)} ${d.name}`),
  snacks: () => CAMP.items.filter(d => d.family === "food").map(d => `${d.id.padEnd(10)} ${d.name}`),
  familiars: () => CAMP.items.filter(d => d.family === "pet").map(d => `${d.id.padEnd(10)} ${d.name}`),
  runes: () => CAMP.items.filter(d => d.family === "rune").map(d => `${d.id.padEnd(10)} ${d.name}`).concat(["conditions: " + Object.keys(GRADE_WORDS).join(", ")]),
  junk: () => CAMP.loot.map(l => `${l.id.padEnd(11)} ${l.grade.padEnd(9)} ${l.name} (${CAMP.islands[l.island - 1].id})`),
  trinkets: () => (CRAFT.trinkets || []).map(t => `${t.id.padEnd(13)} ${t.name.padEnd(20)} ${t.needs.join(", ")}`),
  parts: () => (CRAFT.parts || []).map(t => `${t.id.padEnd(12)} ${t.name.padEnd(18)} ${t.fits}  ${t.needs.join(", ")}`),
  recipes: () => Object.values(CAMP.recipeById).map(r => `${r.id.padEnd(10)} ${r.name.padEnd(22)} ${r.rarity} ${r.makes} (${r.source})${camp.recipes.includes(r.id) ? "  known" : ""}`),
  ingredients: () => (CRAFT.ingredients || []).map(i => `${i.id.padEnd(9)} ${i.name.padEnd(16)} ${i.island} ${i.price}`),
  upgrades: () => Object.keys(CAMP.upgradeById).map(id => `${id.padEnd(12)} ${CAMP.upgradeById[id].name.padEnd(20)} ${CAMP.treeOf[id]}  tier ${camp.upgrades[id] || 0}/${upMax(id)}`),
  stats: () => statKeys().map(k => `${k.padEnd(16)} ${fmtInt(campStatValue(k))}`),
  achievements: () => CAMP.rules.achievements.map(x => `${x.id.padEnd(16)} ${x.name}${camp.achievements[x.id] ? "  done" : ""}`),
  spawns: () => [SPAWN_LIST().join(", ")],
  sfx: () => [Object.keys(SFX).join(", ")],
  music: () => [Object.keys(TRACKS).join(", ")],
  settings: () => [Object.keys(save.settings).join(", ")],
  screens: () => [CAMP_SCREENS.join(", ")],
  skins: () => CONTENT.skins.map(s => `${s.id.padEnd(14)} ${s.name || ""}${camp.skins.includes(s.id) ? "  owned" : ""}`),
  themes: () => CONTENT.themes.map(s => `${s.id.padEnd(14)} ${s.name || ""}${camp.themes.includes(s.id) ? "  owned" : ""}`)
};
cmd("data", "list", slot("<kind>", () => Object.keys(CAMP_LISTS)), "[island]", "List the names other commands take: " + Object.keys(CAMP_LISTS).join(", ") + ".", (a, ctx) => { campNeed(); CAMP_LISTS[ctx.action](a).forEach(l => say(l)); return "quiet"; }, { examples: ["data list.junk", "data list.levels reef"] });
const CAMP_RESETS = {
  story: c => { c.storySeen = []; }, orders: c => { c.orders = []; }, satchel: c => { c.satchel = []; c.equip = {}; c.pocket = [0, 0, 0, 0]; },
  upgrades: c => { c.upgrades = {}; }, wallet: c => { Object.keys(c.wallet).forEach(k => { c.wallet[k] = 0; }); c.gems = 0; }, stats: c => { c.stats = {}; },
  shops: c => { c.merchants = {}; c.challenges = {}; }, progress: c => { c.levels = {}; c.at = CAMP.islands[0].id; }
};
cmd("data", "reset", slot("<part>", () => Object.keys(CAMP_RESETS).concat("all")), "yes", "Wipe part of the campaign save: " + Object.keys(CAMP_RESETS).join(", ") + ", or all (starts over; the old save is kept aside).", (a, ctx) => {
  campNeed();
  if ((a[0] || "").toLowerCase() !== "yes") fail(`add yes to be sure: data reset.${ctx.action} yes`);
  if (ctx.action === "all") { resetCamp(); camp.flags.cheats = true; campChanged(); say("[ok] a fresh save (marked as cheated: the terminal made it)"); return; }
  CAMP_RESETS[ctx.action](camp);
  campChanged(); campOrdersChanged();
  say(`[ok] ${ctx.action} wiped`);
}, { examples: ["data reset.orders yes", "data reset.all yes"] });

/* =========================================================
   The status report, the banner, the manual's lists
   ========================================================= */
window.statusReport = function () {
  say(`build    ${BUILD_NUMBER}`);
  if (!camp) { say("no campaign save loaded"); return; }
  const won = Object.values(camp.levels).filter(r => r.wins > 0).length;
  say(`save     ${camp.name}  gems ${fmtInt(camp.gems)}  spell points ${camp.spellPts}  ${camp.flags.cheats ? "[cheated]" : ""}${camp.flags.modded ? " [modded]" : ""}`);
  say(`money    ${CAMP.islands.map(I => `${I.currency.plural} ${fmtInt(campWallet(I.id))}`).join("  ")}`);
  say(`progress ${won}/75 levels  islands ${islandsOpenCount()}/5  at ${camp.at}  items ${camp.satchel.length}  orders ${camp.orders.length} (${readyOrders().length} ready)  recipes ${camp.recipes.length}`);
  say(campRun ? `level    ${CAMP.islandById[campRun.isl].name} ${campRun.n}. ${campRun.def.name}  score ${fmtInt(score)}  hearts ${currentHearts}  armor ${campRun.armor / ARMOR_PIECES()}${pauseDetour ? "  [held]" : ""}` : "level    none");
  say("rules    " + (paramSummary() || "all normal"));
};
let campTermBooted = false;
window.bootTerminal = function () {
  renderTermGroups();
  if (campTermBooted) return;
  campTermBooted = true;
  consolePrint("SNAKE//TERMINAL  " + BUILD_NUMBER + "  (campaign)", "hdr");
  consolePrint("every command reads:  group subject.action value", "dim");
  consolePrint("groups: " + GROUP_IDS.join("  "), "dim");
  consolePrint("try: help   help item   item sword.give legendary   dev run.play keep 5 hold   attribute money.set 5000 all", "dim");
  consolePrint("Shift+Alt+C opens and closes this from anywhere.", "dim");
};

/* ----- Opening it: the first time marks the campaign save as cheated, for good ----- */
window.askConsole = function () {
  if (!activeSlot && typeof campEngineSlot === "function") campEngineSlot();
  if (camp && camp.flags.cheats) { save.cheats = true; persist(); openScreen("console"); return; }
  openConfirm({
    title: "Open the terminal?",
    text: `The terminal can change anything. Opening it marks ${camp ? camp.name : "this save"}'s campaign as cheated, for good (Settings will say so).`,
    ok: "Open it anyway",
    onOk: () => { save.cheats = true; persist(); if (camp) { camp.flags.cheats = true; saveCamp(); } openScreen("console"); }
  });
};
(() => {
  const nav = openScreen;
  window.openScreen = function (name) {
    if (name === "console" && camp && !camp.flags.cheats) { window.askConsole(); return; }
    return nav.apply(this, arguments);
  };
  // after any command: the campaign save is written and every money readout refreshed
  const refresh = refreshAfterCommand;
  window.refreshAfterCommand = function () { refresh.apply(this, arguments); if (camp) campChanged(); };
  // back out of the terminal into a paused level
  const back = goBack;
  window.goBack = function () {
    if (currentScreen === "console" && pauseDetour && campRun) { returnToPause(); return; }
    return back.apply(this, arguments);
  };
})();

/* ----- Shift+Alt+C: the terminal from anywhere ----- */
document.addEventListener("keydown", e => {
  if (!(e.shiftKey && e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC")) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (currentScreen === "console") { goBack(); return; }
  if (!camp) return;
  if (confirmOpen) return;
  // during a level: pause it, and the terminal sits in front of the pause menu
  if (campRun && gameState === "PLAYING" && !campRun.over) {
    if (!pauseOpen) pauseGame();
    if (pauseOpen) openFromPause("console");
    else {
      // mid-countdown: hold the level where it is
      paused = true; pauseStartedAt = performance.now(); reviveCountdown = 0;
      document.getElementById("countdown").hidden = true;
      pauseDetour = true; openScreen("console");
    }
    return;
  }
  openScreen("console");
}, true);
