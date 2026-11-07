/* =========================================================
   tools/textures/export-page.js
   Runs inside the old game (before textures/), loaded by
   tools/textures/textures.mjs export. Draws every letter-array picture
   the way that game did, flat, one pixel per pixel, and sends them back
   as PNGs with the textures/index.json that says which id is which file.

   Menus light every picture from the top left (src/engine/render/
   pixel-icons.js). The old game worked that out from its letters, the new
   one from the PNG's colors: outline #1a1410 and white are left alone.
   Where a recolor made the colors say something else, the entry gets
   "keep" (more colors to leave alone) or, if even that can't match it,
   "menu": a second file with the menu picture exactly as it was.
   ========================================================= */
"use strict";

(async () => {
  const post = (path, data) => fetch(path, { method: "POST", body: JSON.stringify(data) });
  const log = msg => post("/__tool/log", { msg });
  try {
    for (let i = 0; !window.BOOTED && i < 1200; i++) await new Promise(r => setTimeout(r, 100));
    if (!window.BOOTED) throw new Error("the old game didn't finish booting");
    await log("old game booted, drawing its pictures");
    const set = new URLSearchParams(location.search).get("set") || "icons";
    // ----- a scene set (rooms, ...): its pictures as the recorder cut them
    if (set !== "icons") {
      const S = window.LEGACY_SCENES.sets[set];
      if (!S) throw new Error(`no scene set called "${set}"`);
      const files = {}, index = {}, notes = [];
      for (const e of S.list()) {
        files[e.file] = e.canvas.toDataURL();
        const entry = { file: e.file };
        if (e.frames > 1) entry.frames = e.frames;
        if (e.keys) entry.keys = e.keys;
        if (e.columns) entry.columns = e.columns;
        if (e.anchor) entry.anchor = e.anchor;
        if (e.extra) Object.assign(entry, e.extra);
        index[e.id] = Object.keys(entry).length === 1 ? entry.file : entry;
        notes.push(`${e.id}: ${e.canvas.width}x${e.canvas.height}${e.frames > 1 ? ` (${e.frames} frames)` : ""}${e.at ? ` at ${e.at.join(", ")}` : ""}`);
      }
      await log(`${Object.keys(files).length} pictures`);
      await post("/__tool/result", { ok: true, set, files, index, notes, unused: [] });
      return;
    }
    const R = window.LEGACY_REF;
    const list = R.list();

    /* A copy of iconLight() from src/engine/render/pixel-icons.js: the new game's light and shade */
    const iconShade = (v, k) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    const hexKey = hex => parseInt(String(hex).replace("#", ""), 16);
    function iconLight(px, w, h, opts = {}) {
      const key = (d, i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      const ink = new Set(["#1a1410"].concat(opts.ink || []).map(hexKey)), keep = new Set(["#ffffff"].concat(opts.keep || []).map(hexKey));
      const kind = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) { const a = px[i * 4 + 3], k = key(px, i * 4); kind[i] = !a ? 0 : ink.has(k) ? 1 : keep.has(k) ? 2 : 3; }
      const edge = (x, y) => x < 0 || y < 0 || x >= w || y >= h || kind[y * w + x] < 2;
      const out = new Uint8ClampedArray(px);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (kind[i] !== 3) continue;
        const lit = edge(x, y - 1) || edge(x - 1, y), shaded = edge(x, y + 1) || edge(x + 1, y);
        if (lit === shaded) continue;
        for (let c = 0; c < 3; c++) out[i * 4 + c] = iconShade(px[i * 4 + c], lit ? 0.16 : -0.2);
      }
      return out;
    }
    const pixels = c => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const hex = n => "#" + n.toString(16).padStart(6, "0");

    const files = {}, index = {}, notes = [];
    const fileOwner = {};
    for (const e of list) {
      const flat = await e.flat();
      const url = e.url ? e.url() : flat.toDataURL();
      if (files[e.file] && files[e.file] !== url) {
        // two ids, one file: they must be the same picture
        const other = await R.decode(files[e.file]);
        if (!same(pixels(other), pixels(flat))) throw new Error(`${e.id} and ${fileOwner[e.file]} would share ${e.file} but look different`);
      }
      files[e.file] = files[e.file] || url;
      fileOwner[e.file] = fileOwner[e.file] || e.id;
      const entry = { file: e.file };
      if (e.badge) {
        entry.badge = e.badge;
        notes.push(`${e.id}: an old-style upgrade has the same id, so menus show its corner mark too ("badge": "${e.badge}")`);
      }
      /* The corner mark over a lit picture, as iconUrl() puts it */
      const withBadge = (px, w, h) => {
        if (!e.badge) return px;
        const b = R.badgeCanvas(e.badge), bp = pixels(b), bx = w - b.width, by = h - b.height;
        for (let y = by; y < h; y++) for (let x = bx; x < w; x++) {
          const i = (y * w + x) * 4, j = ((y - by) * b.width + (x - bx)) * 4;
          for (let c = 0; c < 4; c++) px[i + c] = bp[j + 3] ? bp[j + c] : 0;
        }
        return px;
      };
      if (e.lit) {
        const want = pixels(await R.decode(iconUrl(e.lit, 1)));
        const px = pixels(flat);
        if (!same(withBadge(iconLight(px, flat.width, flat.height), flat.width, flat.height), want)) {
          const swap = e.spec && e.spec[2];
          const keep = swap && swap.w && ICON_PAL[swap.w] ? [ICON_PAL[swap.w].toLowerCase()] : null;
          if (keep && same(withBadge(iconLight(px, flat.width, flat.height, { keep }), flat.width, flat.height), want)) {
            entry.keep = keep;
            notes.push(`${e.id}: its white was recolored to ${keep[0]}, so menus leave that color alone ("keep")`);
          } else {
            entry.menu = e.file.replace(/\.png$/, ".menu.png");
            files[entry.menu] = iconUrl(e.lit, 1);
            notes.push(`${e.id}: its menu look can't be worked out from its colors (recolor ${JSON.stringify(swap || {})}), so it has its own menu picture ${entry.menu}`);
          }
        }
      }
      index[e.id] = Object.keys(entry).length === 1 ? entry.file : entry;
    }
    // sprites that no picture uses (the old game kept them, nothing drew them)
    const used = new Set(list.filter(e => e.spec).map(e => e.spec[0]));
    const unused = Object.keys(SPRITES).filter(n => !used.has(n) && !/_(broken|refurbished|cracked|repaired|fine|polished|pristine|legendary)$/.test(n));
    await log(`${list.length} pictures, ${Object.keys(files).length} files`);
    await post("/__tool/result", { ok: true, set, files, index, notes, unused, contentIds: R.contentIds().map(c => c.id) });
  } catch (err) {
    await post("/__tool/result", { ok: false, error: String(err && err.stack || err) });
  }
})();
