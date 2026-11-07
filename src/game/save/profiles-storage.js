/* =========================================================
   src/game/save/profiles-storage.js
   Three profiles plus the shared half of the save
   ========================================================= */
"use strict";

/* =========================================================
   Saves: three profiles, plus what they all share.
   In memory there is one combined save object, as before. On disk it is
   split: the shared part (Snakebucks, the Great Tree, cosmetics, avatars,
   achievements, stats, settings) and the active profile's own part (XP,
   the map, the island trees, items, the story book).
   ========================================================= */
const META_KEY = "snakeMeta_v1";
const ACTIVE_KEY = "snakeActive_v1";
const PROFILE_SLOTS = 3;
const profileKey = n => "snakeProfile_" + n;
const SHARED_KEYS = ["snakebucks", "prestige", "ownedSkins", "selectedSkin", "ownedBackdrops", "selectedBackdrop", "cosmeticTiers",
  "ownedFlair", "flair", "ownedAvatars", "badges", "stats", "settings", "seenItems", "lifetimeScore", "lifetimeByMode", "gamesByMode",
  "levels", "community", "fullRun", "freebies", "parked"];
// the Great Tree's upgrades are shared (listed here because the tree itself is defined further down)
const SHARED_TIERS = CONTENT.greatTree.map(u => u.id);   // content/great-tree/upgrades
let activeSlot = 0;

/* Reads a saved object. Data that's there but can't be read is copied aside under a _rescue_ key
   before anything can overwrite it, so a damaged save is never silently lost. */
let rescuedKeys = [];
function readJson(key) {
  let r = null;
  try { r = store.getItem(key); } catch (e) { return null; }
  if (!r) return null;
  try {
    const v = JSON.parse(r);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch (e) { /* damaged: rescued below */ }
  if (!rescuedKeys.includes(key)) {         // once per key, however often the save list is drawn
    try { store.setItem(key + "_rescue_" + Date.now(), r); } catch (_) { /* storage full */ }
    rescuedKeys.push(key);
  }
  return null;
}
function writeJson(key, data) {
  try {
    store.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (!storageWarned) {
      storageWarned = true;
      setTimeout(() => { if (typeof showToast === "function") showToast("Could not save your progress. Storage may be full or blocked."); }, 0);
    }
  }
}

function splitSave(sv) {
  const meta = {}, prof = {};
  Object.keys(sv).forEach(k => {
    if (k === "tiers" || k === "treeMedals") return;
    if (SHARED_KEYS.includes(k)) meta[k] = sv[k];
    else prof[k] = sv[k];
  });
  meta.tiers = {}; prof.tiers = {};
  Object.entries(sv.tiers || {}).forEach(([k, v]) => { (SHARED_TIERS.includes(k) ? meta.tiers : prof.tiers)[k] = v; });
  meta.treeMedals = {}; prof.treeMedals = {};
  Object.entries(sv.treeMedals || {}).forEach(([k, v]) => { (k === "global" ? meta.treeMedals : prof.treeMedals)[k] = v; });
  meta.settings = Object.assign({}, sv.settings);
  delete meta.settings.snakeName;
  prof.name = sv.settings ? sv.settings.snakeName : "Noodle";
  return { meta, prof };
}

function mergeSave(meta, prof) {
  meta = meta || {};
  prof = prof || {};
  const raw = Object.assign({}, prof);
  SHARED_KEYS.forEach(k => { if (meta[k] !== undefined) raw[k] = meta[k]; });
  raw.tiers = Object.assign({}, prof.tiers, meta.tiers);
  raw.treeMedals = Object.assign({}, prof.treeMedals, meta.treeMedals);
  raw.settings = Object.assign({}, meta.settings, { snakeName: prof.name || "Noodle" });
  return raw;
}

function loadSave() {
  let meta = readJson(META_KEY);
  if (!meta) {
    // First launch of the profiles update: an old single save becomes profile 1
    let old = null;
    const raw = store.getItem(SAVE_KEY);
    if (raw) {
      try { old = JSON.parse(raw); } catch (e) {
        try { store.setItem(SAVE_KEY + "_rescue_" + Date.now(), raw); } catch (_) { /* storage full */ }
      }
    }
    if (!old) old = migrateLegacySave();
    if (old) {
      const s = sanitizeSave(old);
      // XP from the old economy would buy the whole new one: keep a fair amount
      s.xp = Math.min(s.xp, 5000);
      s.kind = "story";
      s.created = Date.now();
      const parts = splitSave(s);
      writeJson(META_KEY, parts.meta);
      writeJson(profileKey(1), parts.prof);
      store.setItem(ACTIVE_KEY, "1");
      activeSlot = 1;
      return s;
    }
    meta = {};
  }
  activeSlot = Number(store.getItem(ACTIVE_KEY)) || 0;
  if (!(activeSlot >= 1 && activeSlot <= PROFILE_SLOTS) || !store.getItem(profileKey(activeSlot))) activeSlot = 0;
  const prof = activeSlot ? readJson(profileKey(activeSlot)) : {};
  // A profile that couldn't be read is rescued (above) and not reopened, so it isn't written over
  if (activeSlot && !prof) activeSlot = 0;
  if (rescuedKeys.length) setTimeout(() => { if (typeof showToast === "function") showToast("Part of your save couldn't be read. A copy was kept; back up your progress from Settings."); }, 1500);
  return sanitizeSave(mergeSave(meta, prof));
}

let storageWarned = false;
function persistData(data) {
  const parts = splitSave(data);
  writeJson(META_KEY, parts.meta);
  if (activeSlot) writeJson(profileKey(activeSlot), parts.prof);
}

/* True when progress will really survive a restart */
function storageIsReal() {
  if (WORLD) return true;                   // a world is written to its .world file
  try { return store === window.localStorage; } catch (e) { return false; }
}

function persist() {
  persistData(save);
}
