/* =========================================================
   src/engine/core/storage.js
   Where saves live: localStorage, or an in-memory stand-in
   ========================================================= */
"use strict";

/* =========================================================
   Storage: localStorage, or an in-memory stand-in if blocked
   A world (SerpentGame.exe --world <id>, see docs/WORLDS.md) keeps
   its keys in memory instead, loaded from its .world file, and
   src/game/save/world-save.js writes them back to that file.
   ========================================================= */
const WORLD = (typeof window !== "undefined" && window.SNAKE_WORLD) || null;
let worldDirty = false;                     // something changed since the last write to the file
function worldStore(world) {
  const data = new Map(Object.entries((world && world.data) || {}));
  const changed = () => { worldDirty = true; };
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); changed(); },
    removeItem: k => { if (data.delete(k)) changed(); },
    key: i => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; },
    snapshot: () => Object.fromEntries(data)
  };
}
const store = (() => {
  if (WORLD) return worldStore(WORLD);
  try {
    const probe = "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (e) {
    const mem = new Map();
    return {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: k => { mem.delete(k); },
      key: i => Array.from(mem.keys())[i] ?? null,
      get length() { return mem.size; }
    };
  }
})();

const BUILD_NUMBER = CONTENT.version;      // version.txt, in the game folder
const SAVE_KEY = "snakeSave_v4";
