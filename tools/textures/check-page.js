/* =========================================================
   tools/textures/check-page.js
   Runs inside the game, loaded by tools/textures/textures.mjs check.

   Always: every file textures/index.json lists loads, and nothing fell
   back to the checkerboard.
   With the old game (served from git under /legacy/, in a hidden frame):
   every picture the new game draws is compared with the old game's,
   pixel by pixel: flat (the board, the painted scenes) and in menus at
   1x, 2x and 3x, plus every heart slot, boss face, cursor and sticker
   through the same functions the HUD and screens call.
   ========================================================= */
"use strict";

(async () => {
  // a picture that falls back to the checkerboard or to another picture says so in the console
  const fellBack = [];
  const warn = console.warn;
  console.warn = function (msg) { if (String(msg).startsWith("Texture")) fellBack.push(String(msg)); return warn.apply(this, arguments); };
  const post = (path, data) => fetch(path, { method: "POST", body: JSON.stringify(data) });
  const log = msg => post("/__tool/log", { msg });
  const wait = async (test, what, tries = 1500) => {
    for (let i = 0; !test() && i < tries; i++) await new Promise(r => setTimeout(r, 100));
    if (!test()) throw new Error(what);
  };
  try {
    const panelText = () => { const p = document.getElementById("boot-panel"); return p ? p.innerText.replace(/\s+/g, " ").slice(0, 1500) : ""; };
    await wait(() => window.BOOTED || /couldn't|missing|wrong/i.test(panelText()), "the game didn't finish booting");
    if (!window.BOOTED) throw new Error("the game stopped while booting: " + panelText());
    const legacy = new URLSearchParams(location.search).get("legacy") === "1";
    const problems = [];
    const counts = { files: 0, flat: 0, menu: 0, html: 0 };

    // ----- the files load
    const T = window.TEXTURES || { warnings: [] };
    T.warnings.forEach(w => problems.push(`${w.path}: ${w.message}`));
    const files = new Set(TextureLoader.ids().flatMap(id => { const e = TextureLoader.entry(id); return e.menu ? [e.file, e.menu] : [e.file]; }));
    files.forEach(f => { if (TextureLoader.pic(f)) counts.files++; });
    await log(`${counts.files} of ${files.size} files loaded`);

    if (legacy) {
      // ----- the old game, in a hidden frame
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;left:-2000px;top:0;width:1280px;height:800px;border:0";
      frame.src = "/legacy/index.html";
      document.body.appendChild(frame);
      await wait(() => frame.contentWindow && frame.contentWindow.BOOTED, "the old game didn't finish booting in its frame");
      const W = frame.contentWindow;
      await new Promise((resolve, reject) => {
        const s = W.document.createElement("script");
        s.src = "/tools/textures/legacy-ref.js";
        s.onload = resolve; s.onerror = () => reject(new Error("legacy-ref.js didn't load"));
        W.document.body.appendChild(s);
      });
      await log("old game booted in its frame, comparing");
      const R = W.LEGACY_REF;
      const pixels = c => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      // decoded here, so the new game's relative file addresses resolve against this page, not the frame's /legacy/
      const decode = url => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); resolve(c); };
        img.onerror = () => reject(new Error("can't decode " + String(url).slice(0, 80)));
        img.src = url;
      });
      /* How many pixels differ ("" when they match) */
      const diff = (a, b) => {
        if (a.width !== b.width || a.height !== b.height) return `size ${b.width}x${b.height}, was ${a.width}x${a.height}`;
        const pa = pixels(a), pb = pixels(b);
        let n = 0;
        for (let i = 0; i < pa.length; i += 4) if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2] || pa[i + 3] !== pb[i + 3]) n++;
        return n ? `${n} pixel${n === 1 ? "" : "s"} differ` : "";
      };
      const compareUrls = async (what, oldUrl, newUrl) => {
        if (oldUrl === newUrl) return;
        const d = diff(await decode(oldUrl), await decode(newUrl));
        if (d) problems.push(`${what}: ${d}`);
      };
      const urlIn = css => /url\("([^"]+)"\)/.exec(css)[1];

      for (const e of R.list()) {
        if (!TextureLoader.has(e.id)) { problems.push(`${e.id}: not in textures/index.json`); continue; }
        // flat: what the board and the painted scenes draw
        const d = diff(await e.flat(), texCanvas(e.id));
        if (d) problems.push(`${e.id} (flat, ${TextureLoader.entry(e.id).file}): ${d}`);
        counts.flat++;
        // in menus, lit, at the sizes the game uses
        if (e.lit) for (const s of [1, 2, 3]) { await compareUrls(`${e.id} (menu, ${s}x)`, W.iconUrl(e.lit, s), iconUrl(e.id, s)); counts.menu++; }
      }
      // the old-style upgrades and items, by their own ids (their content files name the picture and corner mark)
      for (const { id } of R.contentIds()) for (const s of [1, 2, 3]) { await compareUrls(`${id} (menu, ${s}x)`, W.iconUrl(id, s), iconUrl(id, s)); counts.menu++; }
      // the map's pins, by the stop
      for (const stop of ["home", "merchant", "challenger", "banker", "bridge"]) for (const s of [1, 2, 3]) {
        await compareUrls(`pin:${stop} (menu, ${s}x)`, W.iconUrl(W.eval("NODE_ICON")[stop], s), iconUrl("pin:" + stop, s));
        counts.menu++;
      }
      // the HUD's heart slots, through heartSlotHtml(): the picture and the classes
      // ...and the odd numbers the HUD can pass while a level sets up
      const P = CAMP.rules.snake.armorPieces || 4;
      const odd = [{ heart: 2, armor: NaN }, { heart: NaN, armor: P }, { heart: 1 }, { heart: 2, armor: P * 9 }, { heart: 2, armor: -3 }, { heart: 1.5, armor: P / 2 }, { heart: 3, armor: P }, { armor: P * 0.75 }]
        .map((state, i) => ({ name: "odd-" + i, state }));
      for (const h of R.heartStates().concat(odd)) {
        const [a, b] = [W.heartSlotHtml(h.state), heartSlotHtml(h.state)];
        const cls = html => /class="([^"]*)"/.exec(html)[1];
        if (cls(a) !== cls(b)) problems.push(`heart ${h.name}: classes "${cls(b)}", were "${cls(a)}"`);
        await compareUrls(`heart ${h.name}`, R.srcOf(a), R.srcOf(b));
        for (const extra of ["canister", "dim"]) if (cls(W.heartSlotHtml(h.state, extra)) !== cls(heartSlotHtml(h.state, extra))) problems.push(`heart ${h.name} (${extra}): classes differ`);
        counts.html++;
      }
      // boss faces, the empty rune slot, the cursors, the title screen's stickers, the rune stones in the HUD
      for (const I of CAMP.islands) { await compareUrls(`boss face ${I.id}`, W.bossFaceUrl(I.id), bossFaceUrl(I.id)); await compareUrls(`sticker ${I.id}`, W.stickerUrl(I.id), stickerUrl(I.id)); counts.html += 2; }
      await compareUrls("empty rune slot", W.runeShadowUrl(), runeShadowUrl()); counts.html++;
      for (const name of ["arrow", "hand"]) { await compareUrls(`cursor ${name}`, urlIn(W.cursorUrl(name)), urlIn(cursorUrl(name))); counts.html++; }
      for (const r of CAMP.items.filter(i => i.family === "rune")) for (const rarity of CAMP.rarities.map(x => x.id)) {
        const it = { id: r.id, rarity, grade: -1 };
        await compareUrls(`rune ${r.id} ${rarity} (HUD)`, W.eval("runeIconUrl")(it, 2), runeIconUrl(it, 2));
        counts.html++;
      }
    }
    // ----- nothing fell back to the checkerboard while all that was drawn
    fellBack.forEach(m => { if (!problems.includes(m)) problems.push(m); });
    await post("/__tool/result", { ok: !problems.length, legacy, counts, problems });
  } catch (err) {
    await post("/__tool/result", { ok: false, error: String(err && err.stack || err) });
  }
})();
