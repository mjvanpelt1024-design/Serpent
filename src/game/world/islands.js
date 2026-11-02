/* =========================================================
   src/game/world/islands.js
   Builds the islands, their Nightmares and the avatars from content/
   ========================================================= */
"use strict";

/* =========================================================
   Game modes
   ========================================================= */
const CONSUMABLE_KEYS_LIST = CONTENT.items.map(it => it.id);

/* Avatars for profiles (content/avatars/): a picture on a colored disc */
const AVATARS = CONTENT.avatars.map(a => Object.assign({ id: a.id, name: a.name, sprite: a.picture, bg: a.background }, a.free ? { free: true } : {}));
const AVATAR_BY_ID = Object.fromEntries(AVATARS.map(a => [a.id, a]));
const FREE_AVATARS = AVATARS.filter(a => a.free).map(a => a.id);

/* The islands, in unlock order (content/worlds/world-order.dat) */
const MODE_KEYS = CONTENT.worldOrder.slice();

/* Each island's rules come from the [rules] part of its world.txt.
   edge: "wrap" (no walls), "wall", "mirror" (exit a random wall), "endless" (side scroller) or "maze"
   startOrbs / orbChance: XP orbs at the start, and the chance per ORB_ROLL_MS of another */
const modes = {};
MODE_KEYS.forEach(key => {
  const w = CONTENT.worlds[key].info;
  const r = Object.assign({}, w.rules);
  const rules = r.description || "";
  delete r.description;
  modes[key] = Object.assign({ label: w.label || w.name || key, unlockAt: 0 }, r, { rules, spawns: w.spawns || {} });   // unlockAt: set by applyEconomy()
});

/* The tutorial borrows the engine without being a real mode */
modes.tutorial = { label: "Tutorial", speed: 6, edge: "wrap", multiplier: 1, startOrbs: 0, orbChance: 0, rules: "" };

/* Nightmare versions: same island, one brutal twist (the [nightmare] part of world.txt) */
const NIGHTMARES = {};
MODE_KEYS.forEach(key => {
  const n = CONTENT.worlds[key].info.nightmare || {};
  NIGHTMARES[key] = { name: n.name || "Nightmare", twist: n.twist || "", cost: 0 };   // cost: set by applyEconomy()
});
