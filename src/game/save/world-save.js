/* =========================================================
   src/game/save/world-save.js
   The game's side of a world: keeps its .world file up to date
   ========================================================= */
"use strict";

/* =========================================================
   A world is one save, kept in a .world file by the launcher
   (docs/WORLDS.md). The game holds it in memory (storage.js) and
   asks the launcher to write it: on a timer when something changed,
   and once more when the window closes.
   ========================================================= */
const WORLD_AUTOSAVE_MS = 60000;

// The file's text, as the launcher stores it
// (Its picture and its mods are the saves window's: they're written back as they came.)
function worldFileText() {
  const file = {
    format: "snakegame-world",
    version: 1,
    id: WORLD.id,
    title: WORLD.title,
    created: WORLD.created,
    saved: Date.now()
  };
  if (WORLD.icon) file.icon = WORLD.icon;
  if (Array.isArray(WORLD.mods)) file.mods = WORLD.mods;
  file.data = store.snapshot();
  return JSON.stringify(file);
}

// Asks the launcher to write the file. Returns false when there is no launcher to write it.
function writeWorldFile() {
  if (!WORLD) return false;
  const host = window.chrome && window.chrome.webview;
  if (!host) return false;
  try {
    host.postMessage("world:write:" + WORLD.id + ":" + worldFileText());
    worldDirty = false;
    return true;
  } catch (e) {
    return false;
  }
}

if (!WORLD && window.SNAKE_WORLD_ERROR) {
  // The launcher's file couldn't be read: the game can't save to it, so say so
  setTimeout(() => { if (typeof showToast === "function") showToast("This save file can't be read, so nothing is written to it. Open Serpent Saves to choose another."); }, 1500);
}

// A mod this save was made with isn't in the mods folder any more: it plays without it, and says so
if (typeof CONTENT !== "undefined" && (CONTENT.modsMissing || []).length) {
  const names = CONTENT.modsMissing.map(p => p.split("/").pop());
  setTimeout(() => { if (typeof showToast === "function") showToast(`Playing without ${names.join(", ")}: ${names.length === 1 ? "that mod isn't" : "those mods aren't"} in the mods folder.`); }, 2000);
}

if (WORLD) {
  // Autosave: a minute after the last change at most
  setInterval(() => { if (worldDirty) writeWorldFile(); }, WORLD_AUTOSAVE_MS);

  // Called by the launcher when the window closes: the save is written, then the window may go.
  // (If this never runs, the launcher closes the window after two seconds anyway.)
  window.__worldFlush = () => {
    try {
      persist();
      writeWorldFile();
    } finally {
      window.chrome.webview.postMessage("world:flushed");
    }
  };
}
