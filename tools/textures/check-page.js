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
      for (const file of ["legacy-ref.js", "legacy-scenes.js"]) await new Promise((resolve, reject) => {
        const s = W.document.createElement("script");
        s.src = "/tools/textures/" + file;
        s.onload = resolve; s.onerror = () => reject(new Error(file + " didn't load"));
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
        let n = 0, first = "";
        for (let i = 0; i < pa.length; i += 4) if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2] || pa[i + 3] !== pb[i + 3]) {
          if (!n) first = ` (first at ${(i / 4) % a.width}, ${Math.floor(i / 4 / a.width)}: was ${[...pa.slice(i, i + 4)]}, now ${[...pb.slice(i, i + 4)]})`;
          n++;
        }
        return n ? `${n} pixel${n === 1 ? "" : "s"} differ${first}` : "";
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

      // ----- the picture rooms: each room at many moments (both flame frames, embers at every height)
      const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
      const RS = W.LEGACY_SCENES.sets.rooms;
      const moments = Array.from({ length: 60 }, (_, i) => i * 0.217 + (i % 7) * 0.031);
      counts.scenes = 0;
      for (const room of RS.rooms()) for (const t of moments) {
        const a = canvasOf(PIC_W, PIC_H), b = canvasOf(PIC_W, PIC_H);
        RS.backdrop(a.getContext("2d"), room, t);
        b.getContext("2d").imageSmoothingEnabled = false;
        picBackdrop(b.getContext("2d"), room, t);
        const d = diff(a, b);
        if (d) problems.push(`room ${room} at ${t.toFixed(3)} s: ${d}`);
        counts.scenes++;
      }
      // the marks on things, through picBadges() itself, and the away tag, over a room
      const lootOf = grade => CAMP.loot.find(l => l.grade === grade);
      const marked = CAMP.rarities.map(r => ({ id: "sword", rarity: r.id, seal: true, trinket: "t_star" }))
        .concat(CAMP.rarities.map(r => ({ id: "stew", rarity: r.id })))
        .concat((CAMP.lootGrades || []).map(g => lootOf(g.id)).filter(Boolean).map(l => ({ id: l.id, rarity: "common" })))
        .concat([{ kind: "recipe", id: "r_stew" }]);
      for (const it of marked) {
        const a = canvasOf(PIC_W, PIC_H), b = canvasOf(PIC_W, PIC_H);
        RS.backdrop(a.getContext("2d"), "rack", 0); picBackdrop(b.getContext("2d"), "rack", 0);
        W.picBadges(a.getContext("2d"), it, 60, 60); picBadges(b.getContext("2d"), it, 60, 60);
        const d = diff(a, b);
        if (d) problems.push(`marks on ${it.id} ${it.rarity || ""}: ${d}`);
        counts.scenes++;
      }
      {
        const a = canvasOf(PIC_W, PIC_H), b = canvasOf(PIC_W, PIC_H), s = { x: 52, y: 46 }, pR = W.eval("pR");
        RS.backdrop(a.getContext("2d"), "rack", 0); picBackdrop(b.getContext("2d"), "rack", 0);
        const g = a.getContext("2d");
        pR(g, s.x - 8, s.y - 6, 16, 12, "#e8dcc0"); pR(g, s.x - 8, s.y - 6, 16, 1, "#fff6d8"); pR(g, s.x - 1, s.y - 10, 2, 4, "#5a3a20");
        texDraw(b.getContext("2d"), "room:mark:away", s.x - 8, s.y - 10);
        const d = diff(a, b);
        if (d) problems.push(`away tag: ${d}`);
        counts.scenes++;
      }

      // ----- the shopkeepers: every keeper at every one of its looks, small (the map) and in its scene
      const KS = W.LEGACY_SCENES.sets.keepers;
      for (const I of CAMP.islands) for (const role of KS.roles) {
        const look = W.eval("CAMP").islandById[I.id].npcs[role].look;
        const moments = KS.moments(role).concat(Array.from({ length: 12 }, (_, i) => 0.37 + i * 0.611));
        for (const t of moments) {
          const a = canvasOf(40, 40), b = canvasOf(40, 40);
          [a, b].forEach(c => { const g = c.getContext("2d"); g.fillStyle = "#3a6a3a"; g.fillRect(0, 0, 40, 40); });
          W.drawKeeper(a.getContext("2d"), look, 20, 28, t, role);
          drawKeeper(b.getContext("2d"), I.id, role, 20, 28, t);
          const d = diff(a, b);
          if (d) problems.push(`keeper ${I.id} ${role} at ${t.toFixed(3)} s: ${d}`);
          counts.scenes++;
        }
        // the keeper's own scene at the top of its shop, three times the size
        for (const t of moments.slice(0, 16)) {
          const a = canvasOf(160, 60), b = canvasOf(160, 60);
          W.drawPageArt(a, `npc:${I.id}:${role}`, t);
          drawPageArt(b, `npc:${I.id}:${role}`, t);
          const d = diff(a, b);
          if (d) problems.push(`keeper scene ${I.id} ${role} at ${t.toFixed(3)} s: ${d}`);
          counts.scenes++;
        }
      }

      // ----- the story book: every page, its nightmare, every relic, old against new, at moments that catch
      // the storm's and the thunder's flashes, the mirror's wink, the fuse, the shears, the spikes, night's eye
      {
        const storyMoments = [0, 0.05, 0.13, 0.25, 0.3, 1.1, 2.6, 2.75, 2.83, 3.15, 3.3, 3.5, 4.4, 5.07, 5.25, 5.7, 6.35, 6.8, 9.9, 13.37, 27.3];
        const firstId = {};
        Object.entries(W.eval("ART_SCENE")).forEach(([id, sc]) => { if (!(sc in firstId)) firstId[sc] = id; });
        const ids = Object.values(firstId).flatMap(id => [id, "nm-" + id]).concat(W.eval("RELICS").map(r => r.id));
        for (const id of ids) for (const t of storyMoments) {
          const a = canvasOf(160, 60), b = canvasOf(160, 60);
          W.drawPageArt(a, id, t);
          drawPageArt(b, id, t);
          const d = diff(a, b);
          if (d) problems.push(`story page ${id} at ${t} s: ${d}`);
          counts.scenes++;
        }
        // the story's placeholder pages: every island's arrival and its boss fights (drawn before the face loads)
        for (const I of CAMP.islands) for (const b of ["arrive", "boss1", "boss2", "boss3"]) {
          const a = canvasOf(96, 72), b2 = canvasOf(96, 72);
          W.drawStoryArt(a, I.id, b);
          drawStoryArt(b2, I.id, b);
          const d = diff(a, b2);
          if (d) problems.push(`story beat ${I.id} ${b}: ${d}`);
          counts.scenes++;
        }
      }

      // ----- the shops and workshops: the whole stage, old drawStage() against new, with the same
      // stock, orders, gear on the dummy and keeper, every island, at many moments
      const gEval = code => (0, eval)(code);
      for (const run of [code => gEval(code), code => W.eval(code)]) {
        run(`if (!camp) runConsole("dev everything.unlock");`);
      }
      const now = Date.now();
      const kinds = ["craft", "seal", "cook", "train", "forge"];
      const item = (uid, id, rarity) => ({ uid, id, rarity, qty: 1, uses: 1, parts: [], trinket: "", lv: 0, train: 0, grade: -1 });
      const states = {
        empty: { satchel: [], equip: {}, orders: [], stock: [] },
        busy: {
          satchel: [item(101, "sword", "rare"), item(102, "crab", "common"), item(103, "turtle", "rare"), item(104, "fireball", "uncommon")],
          equip: { gear: 101 },
          orders: kinds.flatMap((kind, k) => [0, 1, 2].map(i => ({ n: k * 3 + i + 1, kind, isl: "keep", what: "", uid: kind === "train" ? [102, 103, 102][i] : kind === "seal" ? 104 : 0, rarity: "common", grade: -1, at: 0, readyAt: i === 1 ? 0 : now + 36e5 }))),
          stock: [{ spot: 0, id: "sword", rarity: "rare" }, { spot: 1, id: "fireball", rarity: "legendary", deal: true }, { spot: 2, id: "r_stew", recipe: true, rarity: "common" },
            { spot: 3, id: "plenty", rarity: "uncommon" }, { spot: 4, id: "shield", rarity: "common", sold: true, deal: true }]
        }
      };
      const keepers = [{ x: 288, from: 288, to: 288, at: 0 }, { x: 288, from: 288, to: 60, at: "MOVE" }, { x: 60, from: 60, to: 288, at: "MOVE" }];
      const stageMoments = Array.from({ length: 16 }, (_, i) => 3 + i * 0.173 + (i % 5) * 0.047);
      const ssOld = W.eval("ssCanvas"), ssNew = gEval("ssCanvas");
      for (const I of CAMP.islands) for (const [sname, st] of Object.entries(states)) for (const [ki, kp] of keepers.entries()) {
        for (const run of [gEval, code => W.eval(code)]) {
          run(`shopIsl = ${JSON.stringify(I.id)}; camp.satchel = ${JSON.stringify(st.satchel)}; camp.equip = ${JSON.stringify(st.equip)}; camp.orders = ${JSON.stringify(st.orders)}; camp.merchants[${JSON.stringify(I.id)}] = Object.assign({}, camp.merchants[${JSON.stringify(I.id)}] || {}, { stock: ${JSON.stringify(st.stock)} });`);
        }
        for (const t of stageMoments) {
          const ts = t * 1000;
          const k = JSON.stringify(Object.assign({}, kp, { at: kp.at === "MOVE" ? ts - 600 : kp.at }));
          W.eval(`ssKeeper = ${k}`); W.drawStage(t, ts);
          gEval(`ssKeeper = ${k}`); drawStage(t, ts);
          const d = diff(ssOld, ssNew);
          if (d) problems.push(`shop ${I.id} (${sname}, keeper ${ki}) at ${t.toFixed(3)} s: ${d}`);
          counts.scenes++;
        }
      }

      // ----- the menus' frames: the theme's own (every --fx-* variable), and the painters with many colors
      W.paintUiFrames(); paintUiFrames();
      const fxNames = ["plate", "plate-2", "plate-3", "plate-blue", "plate-boss", "plate-gold", "plate-violet", "chip", "window", "parch", "corner-tl", "corner-tr", "corner-bl", "corner-br", "btn-dark", "btn-dark-down", "tab", "tab-on", "scroll"]
        .concat(["green", "red", "blue", "gold", "orange", "purple"].flatMap(n => [`btn-${n}`, `btn-${n}-down`]));
      const cssVar = (doc, n) => getComputedStyle(doc.documentElement).getPropertyValue("--fx-" + n);
      for (const n of fxNames) { await compareUrls(`frame --fx-${n}`, urlIn(cssVar(W.document, n)), urlIn(cssVar(document, n))); counts.scenes++; }
      const tints = ["#1d3a2e", "#26493a", "#11241c", "#2f9bff", "#7a2a1e", "#e8e0c8", "#000000", "#ffffff", "#3ddc84", "#a46bff", "rgb(40, 60, 90)"];
      const metals = W.eval("FX_METALS");
      for (const fill of tints) {
        for (const [mn, metal] of Object.entries(metals)) for (const B of [5, 3]) { const d = diff(W.fxPlate(fill, metal, B), fxPlate(fill, metal, B)); if (d) problems.push(`fxPlate ${fill} ${mn} ${B}: ${d}`); counts.scenes++; }
        const d1 = diff(W.fxWindow(fill, "#ff5a4d"), fxWindow(fill, "#ff5a4d")); if (d1) problems.push(`fxWindow ${fill}: ${d1}`);
        for (const kind of ["up", "down", "tab"]) { const d2 = diff(W.fxButton(fill, null, kind), fxButton(fill, null, kind)); if (d2) problems.push(`fxButton ${fill} ${kind}: ${d2}`); }
        counts.scenes += 4;
      }
      await compareUrls("island plate", urlIn(W.fxIslePlate("#ffd23f")), urlIn(fxIslePlate("#ffd23f"))); counts.scenes++;

      // ----- the map's islands: in the haze, and reached, with nothing opened and with everything
      // (the same save in both games), and where their drips fall from
      const campNow = JSON.stringify(gEval("camp"));
      for (const [sname, setup] of [["everything", `camp = ${campNow}`], ["fresh", "camp = freshCamp()"]]) {
        W.eval(setup); gEval(setup);
        if (sname === "fresh") W.eval(`camp = ${JSON.stringify(gEval("camp"))}`);
        for (const key of Object.keys(gEval("ISLANDS"))) for (const fog of [true, false]) {
          if (fog && sname === "fresh") continue;
          const a = W.paintIsland(key, fog), b = paintIsland(key, fog);
          const d = diff(a.c, b.c);
          if (d) problems.push(`map island ${key} (${fog ? "in the haze" : sname}): ${d}`);
          if (JSON.stringify(a.tips) !== JSON.stringify(b.tips)) problems.push(`map island ${key} (${fog ? "haze" : sname}): drip points differ`);
          counts.scenes++;
        }
      }
      W.eval(`camp = ${campNow}`); gEval(`camp = ${campNow}`);
      // the islets beside each island, and where each is anchored
      for (const key of Object.keys(gEval("ISLANDS"))) (gEval("ISLE_SHAPE")[key].islets || []).forEach((_, k) => {
        const a = W.isletArt(key, k), b = isletArt(key, k), d = diff(a.c, b.c);
        if (d) problems.push(`islet ${key} ${k + 1}: ${d}`);
        if (a.ox !== b.ox || a.oy !== b.oy) problems.push(`islet ${key} ${k + 1}: anchored at ${b.ox}, ${b.oy}, was ${a.ox}, ${a.oy}`);
        counts.scenes++;
      });

      // ----- the map's stops: every island's every stop in every state, at many moments (the home tree at
      // a few sizes), the old drawNodeArt() against the new, each drawn around its own spot
      const stopMoments = [0.3, 1.1, 2.04, 3.7, 5.55, 8.2, 13.1];
      const tierSave = (isl, have) => { const out = {}; let left = have; for (const u of CAMP.islandById[isl].tree.upgrades) { const n = Math.min(left, u.values.length - 1); if (n) out[u.id] = n; left -= n; } return JSON.stringify(out); };
      const toBoth = code => { gEval(code); W.eval(code); };
      for (const key of Object.keys(gEval("ISLANDS"))) {
        const total = CAMP.islandById[key].tree.upgrades.reduce((s, u) => s + u.values.length - 1, 0);
        const ids = gEval("NODE_ORDER");
        for (const have of [0, Math.floor(total / 2), total]) {
          toBoth(`camp.upgrades = ${tierSave(key, have)}`);
          for (const id of ids) for (const st of ["locked", "open", "next", "done"]) {
            if (id === "home" && st !== "open") continue;
            if (have && id !== "home") continue;
            const p = gEval("nodeAt")(key, id);
            for (const t of (id === "home" ? [0, 1, 2, 3].map(k => (k + 0.5) * (2 * Math.PI / 1.3 / 4)) : stopMoments)) {
              const a = canvasOf(90, 90), b = canvasOf(90, 90);
              const ga = a.getContext("2d"), gb = b.getContext("2d");
              ga.translate(45 - Math.round(p.x), 65 - Math.round(p.y)); gb.translate(45 - Math.round(p.x), 65 - Math.round(p.y));
              W.drawNodeArt(ga, key, id, st, t, 0); drawNodeArt(gb, key, id, st, t, 0);
              const d = diff(a, b);
              if (d) problems.push(`map stop ${key} ${id} (${st}${id === "home" ? `, ${have} tiers` : ""}) at ${t.toFixed(3)} s: ${d}`);
              counts.scenes++;
            }
          }
        }
      }

      // ----- the upgrade tree screen: the whole picture, old against new, at many moments and growths
      for (const I of CAMP.islands) {
        const total = I.tree.upgrades.reduce((s, u) => s + u.values.length - 1, 0);
        for (const have of [0, Math.floor(total / 2), total]) {
          toBoth(`camp.upgrades = ${tierSave(I.id, have)}`);
          for (const t of stopMoments) {
            const a = canvasOf(gEval("TREE_W"), gEval("TREE_H")), b = canvasOf(gEval("TREE_W"), gEval("TREE_H"));
            W.drawCampTree(a, I.id, t); drawCampTree(b, I.id, t);
            const d = diff(a, b);
            if (d) problems.push(`tree screen ${I.id} (${have} tiers) at ${t.toFixed(3)} s: ${d}`);
            counts.scenes++;
          }
        }
      }

      // ----- the Tailor's theme emblems: every theme's, at the sizes the Tailor shows
      for (const bd of gEval("backdrops")) for (const size of [56, 40, 28]) {
        const old = W.eval("backdrops").find(x => x.id === bd.id);
        if (!old) continue;
        const d = diff(W.themeEmblem(old, size), themeEmblem(bd, size));
        if (d) problems.push(`emblem ${bd.id} ${size}: ${d}`);
        counts.scenes++;
      }

      // ----- coins: every island's, both sides, every size the game asks for
      for (const I of CAMP.islands) for (const side of ["tails", "heads"]) for (const size of W.LEGACY_SCENES.sets.coins.sizes) {
        const d = diff(W.coinCanvas(I.id, side, size), coinCanvas(I.id, side, size));
        if (d) problems.push(`coin ${I.id} ${side} ${size}: ${d}`);
        counts.scenes++;
      }

      // ----- home base: its paintings at full width, the sky's things, the tree at several sizes, each
      // thing around it in each of its states (the old functions against the new, same save in both)
      const HS = W.LEGACY_SCENES.sets.home;
      const both = code => { gEval(code); W.eval(code); };
      both("HOME_W = 320");
      const homeMoments = Array.from({ length: 24 }, (_, i) => 0.2 + i * 0.437 + (i % 3) * 0.061);
      const homeItems = [item(101, "sword", "rare"), item(102, "crab", "common"), item(103, "plenty", "rare"), item(104, "nail", "common")];
      const tiersFor = (isl, have) => { const out = {}; let left = have; for (const u of CAMP.islandById[isl].tree.upgrades) { const n = Math.min(left, u.values.length - 1); if (n) out[u.id] = n; left -= n; } return out; };
      const homeScene = (setup, draw, oldDraw, what) => {
        const a = canvasOf(320, 135), b = canvasOf(320, 135);
        W.eval(setup); oldDraw(a.getContext("2d"));
        gEval(setup); draw(b.getContext("2d"));
        const d = diff(a, b);
        if (d) problems.push(`home: ${what}: ${d}`);
        counts.scenes++;
      };
      for (const I of CAMP.islands) {
        const isl = I.id, total = I.tree.upgrades.reduce((s, u) => s + u.values.length - 1, 0);
        both(`homeIsl = ${JSON.stringify(isl)}`);
        // the paintings, at the width they were made for
        const d1 = diff(W.homeSky(isl), texCanvas(`home:${isl}:sky`)), d2 = diff(W.homeGround(isl), texCanvas(`home:${isl}:ground`));
        if (d1) problems.push(`home ${isl} sky: ${d1}`);
        if (d2) problems.push(`home ${isl} ground: ${d2}`);
        counts.scenes += 2;
        const back = g => { g.drawImage(W.homeSky(isl), 0, 0); g.drawImage(W.homeGround(isl), 0, 0); };
        for (const t of homeMoments) {
          homeScene("", g => { back(g); drawHomeStars(g, isl, t); }, g => { back(g); HS.stars(g, isl, t); }, `${isl} stars, sun and moon at ${t.toFixed(3)} s`);
          homeScene("", g => { back(g); drawHomeDrift(g, isl, t); }, g => { back(g); HS.drift(g, isl, t); }, `${isl} far islands and clouds at ${t.toFixed(3)} s`);
        }
        // the tree at five sizes, at each of its four moments
        for (const have of [0, 1, Math.floor(total / 2), total - 1, total]) for (let k = 0; k < 4; k++) {
          const t = (k + 0.5) * HS.step, setup = `camp.upgrades = ${JSON.stringify(tiersFor(isl, have))};`;
          homeScene(setup, g => { back(g); drawHomeTreeBig(g, isl, 160, 102, t); }, g => { back(g); W.drawHomeTreeBig(g, isl, 160, 102, t); }, `${isl} tree with ${have} tiers at moment ${k}`);
        }
        // everything around it, in each state
        const states = [
          { name: "bare", setup: `camp.satchel = []; camp.equip = {}; camp.achievements = {}; camp.wallet = {}; camp.upgrades = {};` },
          { name: "full", setup: `camp.satchel = ${JSON.stringify(homeItems)}; camp.equip = { gear: 101, pet: 102, rune: 103 }; camp.achievements = { first: 1 }; camp.wallet = ${JSON.stringify(Object.fromEntries(CAMP.islands.map(J => [campCurrency(J.id).id, 1e9])))}; camp.upgrades = ${JSON.stringify(tiersFor(isl, 5))};` }
        ];
        for (const st of states) for (const t of homeMoments) {
          const things = g => [["Trophy", 104, 104], ["Mirror", 212, 104], ["Easel", 238, 106], ["Satchel", 173, 105], ["Rack", 94, 132], ["Shelf", 117, 130], ["Den", 188, 131], ["Stones", 222, 130]];
          homeScene(st.setup, g => { back(g); things().forEach(([n, x, y]) => gEval("drawHome" + n)(g, x, y, t)); drawHomeCarving(g, t); },
            g => { back(g); things().forEach(([n, x, y]) => W["drawHome" + n](g, x, y, t)); W.drawHomeCarving(g, t); }, `${isl} things (${st.name}) at ${t.toFixed(3)} s`);
        }
      }
    }
    // ----- nothing fell back to the checkerboard while all that was drawn
    fellBack.forEach(m => { if (!problems.includes(m)) problems.push(m); });
    await post("/__tool/result", { ok: !problems.length, legacy, counts, problems });
  } catch (err) {
    await post("/__tool/result", { ok: false, error: String(err && err.stack || err) });
  }
})();
