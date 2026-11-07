/* =========================================================
   src/campaign/camp-sandbox.js
   A sandbox level with a kit (build 53): weapons, armor, spells, familiars
   and runes from anywhere in the game, chosen in the sandbox's Loadout panel.

   The campaign's items only work in a campaign level, so a sandbox level
   with a kit plays as one (campStart with a level made from the sandbox
   level, the way nightmare levels do), wearing the kit instead of yours:
     the board      its walls, portal walls (red outside a maze) and start
                    (registered as the board "sandbox-run")
     spawns         its spawner chips (more chips, more often) and its placed
                    rocks and hazards (by how many, not where)
     the rest       edges, speed, hearts, twists, its boss or champion
   Not in a kit run: food and power-up squares, wall panels, disappearing walls,
   the old boost items, the level's own skin and theme. A level with no kit
   plays exactly as before.

   Nothing of a kit run touches your save: the kit is made up for the run
   (sbKitNow, camp-save.js), nothing is paid or recorded, and the save is put
   back as it was when the run ends.
   ========================================================= */
"use strict";

const SBK_SLOTS = [["gear", "Gear or weapon"], ["helmet", "Helmet"], ["body", "Body armor"], ["spell", "Spell"], ["pet", "Familiar"], ["rune", "Rune"]];
const SBK_RARITIES = () => CAMP.rarities.map(r => r.id);
/* Everything that goes in a slot, nightmare things too */
const sbKitChoices = slot => CAMP.items.concat(CAMP.nmItems || []).filter(d => d.family !== "vessel" && campItemSlot(d.id) === slot);

/* A level's kit, cleaned: { slot: { id, r } } with only items that fit their slot */
function sbKitClean(kit) {
  const out = {};
  if (!kit || typeof kit !== "object" || typeof CAMP === "undefined") return out;
  SBK_SLOTS.forEach(([slot]) => {
    const k = kit[slot];
    if (!k || !campItemDef(k.id) || campItemSlot(k.id) !== slot) return;
    out[slot] = { id: k.id, r: SBK_RARITIES().includes(k.r) ? k.r : "common" };
  });
  return out;
}
const sbHasKit = L => !!(L && L.kit && Object.keys(sbKitClean(L.kit)).length);

/* The kit as items for the run: never in the satchel, whole at the start */
function sbKitItems(kit) {
  const out = {};
  let uid = -1;
  Object.entries(sbKitClean(kit)).forEach(([slot, k]) => {
    const it = { uid: uid--, id: k.id, rarity: k.r, uses: 0, qty: 1, parts: [], trinket: "", lv: 0, seal: false, train: 0, grade: -1, fresh: false };
    it.parts = typeof builtInParts === "function" && slot === "gear" ? builtInParts(k.id, k.r) : [];
    it.uses = freshUses(k.id, k.r, it);
    out[slot] = it;
  });
  return out;
}

let sbKitSaved = null;        // the save as it was before the kit run, put back after
let sbKitFrom = false;        // the run was started from the editor (true) or the level list

/* Plays sandbox level L (already checked) as a campaign level wearing its kit */
function sbKitPlay(L, fromEditor) {
  if (!camp) return false;
  const SPAWN_ENTITY = typeof ENTITY_TYPES !== "undefined" ? ENTITY_TYPES : {};
  const spawns = {};
  // spawner chips: each one more of that enemy, turning up more often
  Object.entries(L.sc || {}).forEach(([t, chips]) => {
    if (!chips.length || (L.off || []).includes(t)) return;
    const n = chips.length;
    spawns[t] = { max: n, delay: [Math.round(7000 / n), Math.round(11000 / n)] };
  });
  // placed rocks and hazards: as many as the board has, wherever the level puts them
  const placed = {};
  for (const ch of L.g) { const it = SB_CHAR[ch]; if (it && it.type !== "apple" && it.type !== "xp" && !(L.off || []).includes(it.type)) placed[it.type] = (placed[it.type] || 0) + 1; }
  Object.entries(placed).forEach(([t, n]) => {
    if (t === "rock") spawns.rock = Object.assign(spawns.rock || {}, { count: n });
    else if (!spawns[t] && (HAZARD_SPAWNS.includes(t) || SPAWN_ENTITY[t])) spawns[t] = { max: n, delay: [3000, 7000] };
  });
  // the board, as a .level board the campaign reads
  const rows = [];
  for (let y = 0; y < SB_SIZE; y++) rows.push(L.g.slice(y * SB_SIZE, (y + 1) * SB_SIZE).replace(/[^#PS]/g, "."));
  CONTENT.gameLevels["sandbox-run"] = { head: { size: SB_SIZE }, board: rows, portals: [], name: "sandbox-run", file: "(the sandbox)" };
  const islandBoss = L.b && CAMP.islandById[L.b];
  const champion = L.b && !islandBoss && typeof championById === "function" && championById(L.b);
  const def = {
    n: 1, name: L.n, kind: islandBoss ? "boss" : "static", layout: "open", edge: { w: "wrap", a: "wall", m: "mirror" }[L.e] || "wall",
    speed: L.s, goal: islandBoss ? { type: "boss", fight: L.bf } : { type: "score", need: 1e9 }, spawns, text: "",
    board: "sandbox-run", sandbox: true
  };
  sbKitSaved = JSON.stringify(camp);
  sbKitFrom = !!fromEditor;
  sbKitNow = sbKitItems(L.kit);
  customLevel = JSON.parse(JSON.stringify(L));      // Try again plays it again (loadout-and-pause.js)
  sbReturn = !!fromEditor;
  campStart(islandBoss ? L.b : CAMP.islands[0].id, 1, -1, def);
  if (!campRun) { sbKitEnd(); return false; }
  // the level's own hearts (and the kit's), its twists, no rival snake; a champion if it has one
  currentHearts = Math.max(0, L.r.h + runeVal("hearts"));
  campRun.startHearts = currentHearts;
  campRun.rivalAt = Infinity;
  (L.r.t || []).forEach(t => { nm[t] = true; });
  if (champion && typeof spawnChampion === "function") spawnChampion(champion, performance.now());
  lastHeartsKey = "";
  updateHud();
  return true;
}

/* The run is over: the kit goes, and the save is exactly as it was */
function sbKitEnd() {
  sbKitNow = null;
  delete CONTENT.gameLevels["sandbox-run"];
  if (sbKitSaved) { camp = JSON.parse(sbKitSaved); saveCamp(); }     // the save just as it was (it was whole then)
  sbKitSaved = null;
}

(() => {
  const wrap = (name, fn) => { const orig = window[name]; if (typeof orig !== "function") { console.warn("sandbox kit hook: no " + name); return; } window[name] = fn(orig); };
  const kitRun = () => !!(campRun && campRun.sandbox);
  // a kit run never pays, records or finds anything
  wrap("campWinLevel", orig => function () {
    if (!kitRun()) return orig.apply(this, arguments);
    if (campRun.over || gameState !== "PLAYING") return;
    campStopBoard();
    sfx("medal");
    showCampResult(true, [], []);
  });
  wrap("campFail", orig => function (cause) {
    if (!kitRun()) return orig.apply(this, arguments);
    campStopBoard();
    if (cause !== "quit") sfx("death");
    showCampResult(false, [], [], cause === "quit" ? "You left the level." : campCauseText(cause));
  });
  // and goes back to the sandbox, not the map
  wrap("showCampResult", orig => function (won, lines, notes, line = "") {
    if (!kitRun()) return orig.apply(this, arguments);
    const pts = Math.floor(score), name = campRun.def.name;
    campLeaveRun();
    clearPauseState();
    showToast(`${name}: ${won ? "won" : line || "over"} · ${fmtInt(pts)} points`);
    currentModeKey = "easy";
    openScreen(sbKitFrom ? "sandbox" : "shelf");
  });
  wrap("campRestart", orig => function () {
    if (customLevel && sbHasKit(customLevel) && campLast && campLast.sandbox) { playCustom(customLevel, sbReturn); return; }
    return orig.apply(this, arguments);
  });
  wrap("campLeaveRun", orig => function () {
    const was = kitRun();
    if (was) campLast = { isl: campRun.isl, n: 1, challenge: -1, sandbox: true };
    const r = orig.apply(this, arguments);
    if (was) sbKitEnd();
    return r;
  });
})();
