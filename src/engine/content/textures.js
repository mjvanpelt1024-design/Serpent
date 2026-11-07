/* =========================================================
   src/engine/content/textures.js
   Loads the game's pictures (textures/) before any script draws.

   Every small picture is a PNG in textures/, one image pixel for one
   game pixel; the game scales it up when it draws. textures/index.json
   says which file each picture the game asks for is in:

     "ci:sword": "items/gear/sword.png"
     "cu:apple": { "file": "upgrades/apple.png", "keep": ["#d8dde6"] }

   so moving or renaming a file is a one-line change there. The loader
   reads the index, loads every file it lists, and keeps each picture as
   a little canvas (src/engine/render/pixel-icons.js draws from those).

   Where files come from, like the content (src/engine/content/loader.js):
   loose files when the launcher or a local server serves the folder (so
   editing a PNG and pressing F5 shows the change), or content.bundle.js,
   which holds every PNG as a data URL, when index.html is opened from disk.

   A file that's missing or can't be read becomes a pink and black
   checkerboard, with a warning in the console; the game never stops for it.
   ========================================================= */
"use strict";

const TextureLoader = (() => {
  const state = { entries: {}, pics: {}, warnings: [], files: 0 };

  /* The picture drawn for anything missing: a pink and black checkerboard, impossible to miss */
  function placeholder(w = 12, h = 12) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      g.fillStyle = (x + y) % 4 ? "#1a1410" : "#ff2bd6";
      g.fillRect(x, y, 2, 2);
    }
    return c;
  }

  function warn(path, message) {
    state.warnings.push({ path, message });
    console.warn(`Texture ${path}: ${message}`);
  }

  /* One PNG as a canvas, or null if it couldn't be read */
  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });       // tiny, and read for menu light
        g.drawImage(img, 0, 0);
        resolve(c.width && c.height ? c : null);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /* Reads textures/index.json and every file it lists */
  async function load() {
    const fromDisk = location.protocol === "file:";
    let index = null;
    try {
      const text = await ContentLoader.read("textures/index.json");
      if (text === null) warn("textures/index.json", "missing file: every picture will be a checkerboard");
      else index = JSON.parse(text);
    } catch (e) {
      warn("textures/index.json", `can't be read (${e.message}): every picture will be a checkerboard`);
    }
    const list = (index && index.textures) || {};
    Object.entries(list).forEach(([id, e]) => {
      const entry = typeof e === "string" ? { file: e } : Object.assign({}, e);
      if (!entry.file) { warn("textures/index.json", `"${id}" has no file`); return; }
      state.entries[id] = entry;
    });
    // each file once, however many pictures point at it
    const files = [...new Set(Object.values(state.entries).flatMap(e => (e.menu ? [e.file, e.menu] : [e.file])))];
    // a dozen at a time, and a second try for any that fail, so a busy local server can't drop one
    const pics = new Array(files.length);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++, path = "textures/" + files[i];
        const src = fromDisk ? await ContentLoader.read(path) : path;
        let pic = src ? await loadImage(src) : null;
        if (!pic && src && !fromDisk) pic = await loadImage(src);
        if (pic) state.files++;
        else warn(path, src ? "missing, or not a PNG it can read" : "missing file");
        pics[i] = pic;
      }
    };
    await Promise.all(Array.from({ length: Math.min(12, files.length) }, worker));
    files.forEach((file, i) => { state.pics[file] = pics[i] ? { canvas: pics[i], url: fromDisk ? null : "textures/" + file } : null; });
    return { files: state.files, warnings: state.warnings };
  }

  /* The index entry for a picture id ({ file, keep, ink, badge, menu }), or null */
  const entry = id => state.entries[id] || null;
  /* A loaded file: { canvas, url }, or null when it's missing or broken */
  const pic = file => state.pics[file] || null;
  const has = id => !!state.entries[id];
  const ids = () => Object.keys(state.entries);

  return { load, entry, pic, has, ids, placeholder, warn };
})();
