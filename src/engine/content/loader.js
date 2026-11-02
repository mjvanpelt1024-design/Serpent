/* =========================================================
   src/engine/content/loader.js
   Reads every file under content/ (and any enabled mods) into one
   object, CONTENT, before the game's scripts run.

   Where files come from, in order of preference:
     1. Live files: the launcher (or any local web server) serves the
        folder, so editing a file and reloading shows the change.
     2. content.bundle.js: when index.html is opened straight from disk,
        browsers refuse to read loose files, so the loader falls back to
        a bundle made by tools/bundle-content.py.

   Every folder of records has an _index.dat listing its files in the
   order the game shows them. A file that isn't listed isn't loaded.
   ========================================================= */
"use strict";

const ContentLoader = (() => {
  const state = { mode: null, bundle: null, files: 0, warnings: [] };

  function warn(path, line, message) {
    state.warnings.push({ path, line, message });
  }
  const warnIn = path => (line, message) => warn(path, line, message);

  /* Loads content.bundle.js once, for when loose files can't be read */
  function loadBundle() {
    if (state.bundle) return Promise.resolve(state.bundle);
    return new Promise(resolve => {
      const s = document.createElement("script");
      s.src = "content.bundle.js";
      s.onload = () => { state.bundle = window.CONTENT_BUNDLE || {}; resolve(state.bundle); };
      s.onerror = () => { state.bundle = {}; resolve(state.bundle); };
      document.head.appendChild(s);
    });
  }

  /* One text file, or null if it doesn't exist */
  async function read(path, base = "") {
    const url = base + path;
    if (state.mode !== "bundle") {
      try {
        const res = await fetch(url, { cache: "no-store" });
        state.mode = "live";
        if (!res.ok) return null;
        state.files++;
        return await res.text();
      } catch (e) {
        if (state.mode === "live") return null;      // a real network problem, not a file:// page
        // Only a page opened from disk falls back to the bundle. A served page that hits one bad
        // request first must not switch to a bundle that may be out of date.
        if (location.protocol !== "file:") return null;
        state.mode = "bundle";
      }
    }
    const bundle = await loadBundle();
    if (base) return null;                           // mods only load live
    if (!(path in bundle)) return null;
    state.files++;
    return bundle[path];
  }

  async function need(path, base) {
    const text = await read(path, base);
    if (text === null) warn(path, 0, "missing file");
    return text || "";
  }

  /* A folder of value files listed by its _index.dat */
  async function records(dir, ext, base = "", optional = false) {
    const index = await read(dir + "_index.dat", base);
    if (index === null) { if (!optional) warn(dir + "_index.dat", 0, "missing file"); return []; }
    const ids = Formats.list(index);
    const texts = await Promise.all(ids.map(id => read(`${dir}${id}.${ext}`, base)));
    return ids.map((id, i) => {
      const path = `${dir}${id}.${ext}`;
      if (texts[i] === null) { warn(dir + "_index.dat", 0, `lists "${id}", but ${path} doesn't exist`); return null; }
      const rec = ext === "story" || ext === "level" ? documentRecord(texts[i], path, ext) : Formats.values(texts[i], warnIn(path));
      if (rec.id === undefined) rec.id = id;
      if (String(rec.id) !== id) warn(path, 0, `its id is "${rec.id}" but the file is named "${id}"`);
      rec.id = String(rec.id);
      rec._file = base + path;
      return rec;
    }).filter(Boolean);
  }

  function documentRecord(text, path, ext) {
    const doc = Formats.document(text, warnIn(path));
    if (ext === "story") doc.head.lines = Formats.paragraphs(doc.body);
    else doc.head.rows = doc.body.filter(l => l.trim() && !/^\s*#/.test(l)).map(l => l.replace(/\s+$/, ""));
    return doc.head;
  }

  /* The first real line of a small text file (the seed, the version) */
  const firstLine = text => (String(text || "").split(/\r?\n/).map(l => l.trim()).find(l => l && !l.startsWith("#")) || "");

  async function world(id) {
    const dir = `content/worlds/builtin/${id}/`;
    const [info, levels, seed, upgrades] = await Promise.all([
      need(dir + "world.txt"), need(dir + "levels.dat"), read(dir + "seed.txt"), records(dir + "upgrades/", "upg")
    ]);
    return { id, info: Formats.values(info, warnIn(dir + "world.txt")), levels: Formats.table(levels), seed: firstLine(seed) || "random", upgrades };
  }

  async function loadBase() {
    const C = {};
    const order = Formats.list(await need("content/worlds/world-order.dat"));
    const [version, economy, levelRules, rules, worlds, greatTree, items, skins, skinTiers, themes, themeTiers,
      flair, flairSlots, avatars, story, music, community] = await Promise.all([
      read("version.txt"),
      need("content/economy.txt"),
      need("content/rules/levels.dat"),
      need("content/rules/rules.txt"),
      Promise.all(order.map(world)),
      records("content/great-tree/upgrades/", "upg"),
      records("content/items/", "item"),
      records("content/skins/", "skin"),
      need("content/skins/tiers.dat"),
      records("content/themes/", "theme"),
      need("content/themes/tiers.dat"),
      records("content/flair/", "flair"),
      need("content/flair/slots.dat"),
      records("content/avatars/", "avatar"),
      records("content/story/", "story"),
      need("content/music/music.dat"),
      records("content/worlds/community/", "level", "", true)
    ]);
    C.version = firstLine(version) || "dev";
    C.economy = Formats.values(economy, warnIn("content/economy.txt"));
    C.levelRules = Formats.table(levelRules);
    C.rules = Formats.values(rules, warnIn("content/rules/rules.txt"));
    C.worldOrder = order;
    C.worlds = Object.fromEntries(worlds.map(w => [w.id, w]));
    C.greatTree = greatTree;
    C.items = items;
    C.skins = skins;
    C.skinTiers = Formats.table(skinTiers);
    C.themes = themes;
    C.themeTiers = Formats.table(themeTiers);
    C.flair = flair;
    C.flairSlots = Formats.table(flairSlots);
    C.avatars = avatars;
    C.story = story;
    C.music = Formats.table(music);
    C.communityLevels = community;
    C.mods = [];
    return C;
  }

  /* ----- Mods: folders that add to or change the base content ----- */
  const MOD_COLLECTIONS = [["skins", "skin"], ["themes", "theme"], ["avatars", "avatar"], ["story", "story"]];

  function mergeById(list, extra, modName) {
    extra.forEach(rec => {
      const at = list.findIndex(r => r.id === rec.id);
      rec._mod = modName;
      if (at >= 0) list[at] = Object.assign({}, list[at], rec);
      else list.push(rec);
    });
  }

  function deepMerge(into, from) {
    Object.entries(from).forEach(([k, v]) => {
      if (k === "__proto__" || k === "constructor" || k === "prototype") return;
      if (v && typeof v === "object" && !Array.isArray(v) && into[k] && typeof into[k] === "object" && !Array.isArray(into[k])) deepMerge(into[k], v);
      else into[k] = v;
    });
  }

  async function loadMods(C) {
    if (state.mode !== "live") return;
    const base = (window.SNAKE_LAUNCHER && window.SNAKE_LAUNCHER.modsUrl) || "mods/";
    const enabled = await read("_enabled.dat", base);
    if (enabled === null) return;
    for (const name of Formats.list(enabled)) {
      const root = base + name + "/";
      const info = Formats.values((await read("mod.txt", root)) || "", warnIn(`mods/${name}/mod.txt`));
      for (const [dir, ext] of MOD_COLLECTIONS) mergeById(C[dir], await records(dir + "/", ext, root, true), name);
      const econ = await read("economy.txt", root);
      if (econ !== null) deepMerge(C.economy, Formats.values(econ, warnIn(`mods/${name}/economy.txt`)));
      // Upgrade changes: any upgrade, by id, wherever it grows
      const ups = await records("upgrades/", "upg", root, true);
      const all = C.greatTree.concat(...Object.values(C.worlds).map(w => w.upgrades));
      ups.forEach(u => {
        const target = all.find(r => r.id === u.id);
        if (target) Object.assign(target, u, { _mod: name });
        else warn(`mods/${name}/upgrades/${u.id}.upg`, 0, "there's no upgrade with this id to change");
      });
      const music = await read("music/music.dat", root);
      if (music !== null) {
        Formats.table(music).forEach(row => {
          const at = C.music.findIndex(r => r[0] === row[0]);
          row._base = root + "music/";
          if (at >= 0) C.music[at] = row; else C.music.push(row);
        });
      }
      C.mods.push({ id: name, name: info.name || name, version: info.version || "", author: info.author || "" });
    }
  }

  async function load() {
    const C = await loadBase();
    await loadMods(C);
    C.source = state.mode;
    C.filesRead = state.files;
    C.warnings = state.warnings;
    return C;
  }

  return { load, read, state };
})();
