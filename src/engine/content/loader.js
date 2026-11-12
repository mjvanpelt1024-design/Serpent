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
    // A board's rows can start with # (a red wall), so a level's body is never comment-filtered
    else doc.head.rows = doc.body.filter(l => l.trim() && (ext === "level" || !/^\s*#/.test(l))).map(l => l.replace(/\s+$/, ""));
    return doc.head;
  }

  /* The first real line of a small text file (the version) */
  const firstLine = text => (String(text || "").split(/\r?\n/).map(l => l.trim()).find(l => l && !l.startsWith("#")) || "");

  /* The game's levels built from .level files. content/levels/index.dat maps each level's name
     to its file: "Hedgerow | labyrinth-1.level". Keyed by name, as the worlds name them. */
  async function gameLevels() {
    const dir = "content/levels/";
    const rows = Formats.table(await need(dir + "index.dat"));
    const texts = await Promise.all(rows.map(r => read(dir + String(r[1]))));
    const out = {};
    rows.forEach((r, i) => {
      const name = String(r[0]), file = String(r[1]);
      if (texts[i] === null) { warn(dir + "index.dat", 0, `lists "${file}", but ${dir}${file} doesn't exist`); return; }
      if (out[name]) { warn(dir + "index.dat", 0, `"${name}" is listed twice; the last one wins`); }
      out[name] = Object.assign(Formats.level(texts[i], warnIn(dir + file)), { name, file: dir + file });
    });
    return out;
  }

  async function world(id) {
    const dir = `content/worlds/builtin/${id}/`;
    const [info, levels, upgrades] = await Promise.all([
      need(dir + "world.txt"), need(dir + "levels.dat"), records(dir + "upgrades/", "upg")
    ]);
    return { id, info: Formats.values(info, warnIn(dir + "world.txt")), levels: Formats.table(levels), upgrades };
  }

  async function loadBase() {
    const C = {};
    const order = Formats.list(await need("content/worlds/world-order.dat"));
    const [version, economy, levelRules, rules, worlds, greatTree, items, skins, skinTiers, themes, themeTiers,
      flair, flairSlots, avatars, story, music, community, gameLevelFiles] = await Promise.all([
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
      records("content/worlds/community/", "level", "", true),
      gameLevels()
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
    C.gameLevels = gameLevelFiles;   // name -> parsed .level file (see gameLevels() above)
    C.mods = [];
    return C;
  }

  /* ----- Mods: folders that add to or change the base content -----
     Two kinds (docs/MODDING.md), by the folder they're in, mods/content/ or mods/cosmetic/:
       content   skins, themes, avatars, story, upgrades, prices, campaign items and armor sets,
                 pictures, music. Chosen when a save is made, and kept with it for good.
       cosmetic  how the game looks and sounds: the screen filter (filter.txt), the stats overlay
                 (overlay.txt), pictures, music. Switched on and off whenever you like.
     Which mods load: the save's own list (the .world file's "mods", set in the saves window), or,
     with no launcher, mods/_enabled.dat. Content mods load first, then cosmetic ones; later wins. */
  const MOD_COLLECTIONS = [["skins", "skin"], ["themes", "theme"], ["avatars", "avatar"], ["story", "story"]];
  const MOD_PATH = /^(?:(content|cosmetic)\/)?([A-Za-z0-9][A-Za-z0-9 ._-]{0,63})$/;
  const modKind = (path, info) => {
    const m = MOD_PATH.exec(path);
    if (m && m[1]) return m[1];
    return String(info.type || "").toLowerCase() === "cosmetic" ? "cosmetic" : "content";
  };

  /* JSON from a mod, with the names that reach into the game's own objects taken out */
  function cleanJson(v) {
    if (Array.isArray(v)) return v.map(cleanJson);
    if (v && typeof v === "object") {
      const out = {};
      Object.keys(v).forEach(k => { if (k !== "__proto__" && k !== "constructor" && k !== "prototype") out[k] = cleanJson(v[k]); });
      return out;
    }
    return v;
  }

  /* campaign/items.json in a content mod: new weapons, armor and other merchants' things ("items"),
     and new armor sets ("armorSets"). A new id adds; an existing id changes only the fields given. */
  const MOD_ITEM_ID = /^[a-z][a-z0-9_]{1,31}$/;
  function mergeCampaignItems(C, mod, name) {
    const I = C.campaign.items;
    const at = `mods/${name}/campaign/items.json`;
    const families = I.families || {};
    (Array.isArray(mod.armorSets) ? mod.armorSets : []).forEach(set => {
      if (!set || !MOD_ITEM_ID.test(set.id || "")) { warn(at, 0, `an armor set needs an id of small letters (got "${set && set.id}")`); return; }
      const i = I.armorSets.findIndex(x => x.id === set.id);
      const tier = Number(set.tier);
      if (i < 0 && !(I.armorTiers || []).some(t => t.tier === tier)) { warn(at, 0, `armor set "${set.id}": tier ${set.tier} isn't one of armorTiers`); return; }
      set._mod = name;
      if (i >= 0) I.armorSets[i] = Object.assign({}, I.armorSets[i], set); else I.armorSets.push(Object.assign({ bonus: [], bad: [] }, set));
    });
    (Array.isArray(mod.items) ? mod.items : []).forEach(it => {
      if (!it || !MOD_ITEM_ID.test(it.id || "")) { warn(at, 0, `an item needs an id of small letters (got "${it && it.id}")`); return; }
      const i = I.items.findIndex(x => x.id === it.id);
      it._mod = name;
      if (i >= 0) { I.items[i] = Object.assign({}, I.items[i], it); return; }
      if (!families[it.family]) { warn(at, 0, `item "${it.id}": there's no family "${it.family}"`); return; }
      if (it.piece && !["weapon", "helmet", "body"].includes(it.piece)) { warn(at, 0, `item "${it.id}": piece is weapon, helmet or body`); return; }
      if (it.set && !I.armorSets.some(x => x.id === it.set)) { warn(at, 0, `item "${it.id}": there's no armor set "${it.set}"`); return; }
      if (it.acts && !I.items.some(x => x.id === it.acts)) { warn(at, 0, `item "${it.id}": acts like "${it.acts}", which isn't an item`); return; }
      if (!it.name) { warn(at, 0, `item "${it.id}" has no name`); return; }
      I.items.push(it);
    });
  }

  /* textures/index.json in a mod: pictures, like the game's own (textures/index.json); a file is
     found in the mod's textures/ folder. An id the game has already is drawn with the mod's picture. */
  function mergeTextures(C, index, root, name) {
    const list = (index && index.textures) || {};
    Object.entries(list).forEach(([id, e]) => {
      const entry = typeof e === "string" ? { file: e } : Object.assign({}, e);
      if (!entry.file || /^[a-z]+:|^\/|\.\./i.test(entry.file) || (entry.menu && /^[a-z]+:|^\/|\.\./i.test(entry.menu))) {
        warn(`mods/${name}/textures/index.json`, 0, `"${id}": a file is a path inside the mod's textures folder`);
        return;
      }
      entry.file = root + "textures/" + entry.file;
      if (entry.menu) entry.menu = root + "textures/" + entry.menu;
      entry.mod = name;
      C.modTextures[id] = entry;
    });
  }

  /* The mods this game loads, in order: the save's list (launcher), or, in a browser, _enabled.dat */
  async function modList(base) {
    const world = window.SNAKE_WORLD;
    let names;
    // a save from the launcher has its own list (none, for a save made before saves had mods)
    if (world) names = Array.isArray(world.mods) ? world.mods.map(String) : [];
    else {
      const enabled = await read("_enabled.dat", base);
      if (enabled === null) return [];
      names = Formats.list(enabled).map(String);
    }
    const seen = new Set();
    return names.filter(n => {
      if (!MOD_PATH.test(n) || seen.has(n)) { if (!MOD_PATH.test(n)) warn("mods", 0, `"${n}" isn't a mod folder name`); return false; }
      seen.add(n);
      return true;
    });
  }

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
    C.cosmetics = { filter: null, overlay: null };
    C.modTextures = {};
    if (state.mode !== "live") return;
    const base = (window.SNAKE_LAUNCHER && window.SNAKE_LAUNCHER.modsUrl) || "mods/";
    const found = [];
    for (const name of await modList(base)) {
      const root = base + name + "/";
      const text = await read("mod.txt", root);
      if (text === null) { warn(`mods/${name}/mod.txt`, 0, "this mod isn't installed (no mod.txt), so it's skipped"); C.modsMissing = (C.modsMissing || []).concat(name); continue; }
      const info = Formats.values(text, warnIn(`mods/${name}/mod.txt`));
      found.push({ name, root, info, kind: modKind(name, info) });
    }
    // content first, then cosmetic: a cosmetic mod's pictures win over a content mod's
    found.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "content" ? -1 : 1));
    for (const { name, root, info, kind } of found) {
      const pics = await read("textures/index.json", root);
      if (pics !== null) {
        try { mergeTextures(C, cleanJson(JSON.parse(pics)), root, name); }
        catch (e) { warn(`mods/${name}/textures/index.json`, 0, "isn't valid JSON: " + e.message); }
      }
      const music = await read("music/music.dat", root);
      if (music !== null) {
        Formats.table(music).forEach(row => {
          const at = C.music.findIndex(r => r[0] === row[0]);
          row._base = root + "music/";
          if (at >= 0) C.music[at] = row; else C.music.push(row);
        });
      }
      if (kind === "cosmetic") {
        // how the game looks: the screen filter and the stats overlay (src/ui/mod-filter.js, mod-overlay.js)
        for (const what of ["filter", "overlay"]) {
          const t = await read(what + ".txt", root);
          if (t !== null) C.cosmetics[what] = Object.assign(C.cosmetics[what] || {}, Formats.values(t, warnIn(`mods/${name}/${what}.txt`)), { _mod: name });
        }
        C.mods.push({ id: name, kind, name: info.name || name, version: info.version || "", author: info.author || "" });
        continue;
      }
      for (const [dir, ext] of MOD_COLLECTIONS) mergeById(C[dir], await records(dir + "/", ext, root, true), name);
      const items = await read("campaign/items.json", root);
      if (items !== null) {
        try { mergeCampaignItems(C, cleanJson(JSON.parse(items)), name); }
        catch (e) { warn(`mods/${name}/campaign/items.json`, 0, "isn't valid JSON: " + e.message); }
      }
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
      C.mods.push({ id: name, kind, name: info.name || name, version: info.version || "", author: info.author || "" });
    }
  }

  /* ----- The campaign (content/campaign/): JSON files, kept as text too so they can be signed ----- */
  async function json(path) {
    const text = await need(path);
    try { return { text, data: JSON.parse(text || "{}") }; } catch (e) { warn(path, 0, "isn't valid JSON: " + e.message); return { text, data: {} }; }
  }
  async function campaign() {
    const ids = Formats.list(await need("content/campaign/islands/_index.dat"));
    const [islands, items, upgrades, rules, crafting, foes, nightmare, manifest] = await Promise.all([
      Promise.all(ids.map(id => json(`content/campaign/islands/${id}.json`))),
      json("content/campaign/items.json"),
      json("content/campaign/upgrades.json"),
      json("content/campaign/rules.json"),
      json("content/campaign/crafting.json"),
      json("content/campaign/foes.json"),
      json("content/campaign/nightmare.json"),          // build 53: nightmare mode
      read("content/campaign/manifest.dat")
    ]);
    const texts = { "items.json": items.text, "upgrades.json": upgrades.text, "rules.json": rules.text, "crafting.json": crafting.text, "foes.json": foes.text, "nightmare.json": nightmare.text };
    ids.forEach((id, i) => { texts[`islands/${id}.json`] = islands[i].text; });
    return { islands: islands.map(x => x.data), items: items.data, upgrades: upgrades.data, rules: rules.data, crafting: crafting.data, foes: foes.data, nightmare: nightmare.data, texts, manifest: manifest || "" };
  }

  async function load() {
    const C = await loadBase();
    C.campaign = await campaign();
    await loadMods(C);
    C.source = state.mode;
    C.filesRead = state.files;
    C.warnings = state.warnings;
    return C;
  }

  return { load, read, state };
})();
