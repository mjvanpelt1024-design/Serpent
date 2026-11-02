/* =========================================================
   src/engine/core/storage.js
   Where saves live: localStorage, or an in-memory stand-in
   ========================================================= */
"use strict";

/* =========================================================
   Storage: localStorage, or an in-memory stand-in if blocked
   ========================================================= */
const store = (() => {
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
