/* =========================================================
   tools/textures/legacy-ref.js
   Runs inside the game as it was before textures/ (build 51), served
   from git by tools/textures/textures.mjs. It knows where every one of
   that game's letter-array pictures lives and how that game drew it,
   so the export can write each one as a PNG and the check can compare
   the new game's pictures with the old ones, pixel by pixel.

   Defines window.LEGACY_REF:
     list()            every picture: { id, file, flat(), url(), lit, spec }
                       flat() draws it as the board did (a canvas, no light),
                       url() is the old game's own data URL for it when it
                       made one (hearts, bosses, the empty rune slot), lit is
                       the id the old iconUrl() knew it by when it was also
                       shown in menus (null if never)
     contentIds()      the old-style upgrades and items whose pictures come
                       from their content files (icon, badge)
     heartStates()     every heart slot the HUD can show, with its file name
   Not part of the game: the game never loads it.
   ========================================================= */
"use strict";

(() => {
  const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  /* A data URL as a canvas */
  const decode = url => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { const c = canvasOf(img.naturalWidth, img.naturalHeight); c.getContext("2d").drawImage(img, 0, 0); resolve(c); };
    img.onerror = () => reject(new Error("can't decode " + String(url).slice(0, 60)));
    img.src = url;
  });
  /* Letter rows in a palette, one pixel per letter */
  const rowsCanvas = (rows, pal) => {
    const c = canvasOf(rows[0].length, rows.length), g = c.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && ch !== " " && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
    return c;
  };
  const sprite = spec => () => objSprite(spec[0], spec[2]);

  const ENEMIES = ["bee", "wasp", "yellowjacket", "imp", "mole", "crab", "wisp"];
  const FAMILY_DIR = { gear: "items/gear", spell: "items/spells", food: "items/snacks", pet: "items/familiars", vessel: "items/canister" };
  /* Old-style pictures recolored by their content file get a picture of their own, named here */
  const RECOLORED_NAME = { "item:goldheart": "heart-gold", "item:magnet": "magnet-blue" };

  function list() {
    const out = [];
    const seen = new Set();
    const add = (id, file, flat, lit = null, spec = null, url = null) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, file, flat, lit, spec, url });
    };
    const fromUrl = (id, file, url) => add(id, file, () => decode(url()), null, null, url);

    // ----- the campaign's items: gear, spells, snacks, familiars, the canister, and runes in eight conditions
    CAMP.items.forEach(it => {
      if (it.family === "rune") {
        RUNE_GRADES8.forEach(g => {
          const spec = ICON_FOR[`ci:${it.id}:${g}`];
          add(`ci:${it.id}:${g}`, `items/runes/${g}/${it.id}.png`, sprite(spec), `ci:${it.id}:${g}`, spec);
        });
        // the rune with no condition named is the one as carved
        add(`ci:${it.id}`, `items/runes/fine/${it.id}.png`, sprite(ICON_FOR["ci:" + it.id]), `ci:${it.id}`, ICON_FOR["ci:" + it.id]);
        return;
      }
      const dir = FAMILY_DIR[it.family] || `items/${it.family}`;
      const spec = ICON_FOR["ci:" + it.id];
      if (spec) add("ci:" + it.id, `${dir}/${it.id}.png`, sprite(spec), "ci:" + it.id, spec);
    });
    // ----- junk, and what the workbench makes from it
    CAMP.loot.forEach(l => { const spec = ICON_FOR["ci:" + l.id]; if (spec) add("ci:" + l.id, `junk/${l.id}.png`, sprite(spec), "ci:" + l.id, spec); });
    Object.values(CAMP.craftById).forEach(c => {
      const spec = ICON_FOR["ci:" + c.id];
      if (spec) add("ci:" + c.id, `crafted/${c.stat ? "trinkets" : "parts"}/${c.id}.png`, sprite(spec), "ci:" + c.id, spec);
    });
    // anything else with a ci: picture (there shouldn't be any)
    Object.keys(ICON_FOR).filter(k => k.startsWith("ci:") && !seen.has(k)).forEach(k => {
      add(k, `items/other/${k.slice(3).replace(/:/g, "-")}.png`, sprite(ICON_FOR[k]), k, ICON_FOR[k]);
    });
    // ----- the campaign's upgrades, by their icon name
    Object.keys(ICON_FOR).filter(k => k.startsWith("cu:")).forEach(k => add(k, `upgrades/${k.slice(3)}.png`, sprite(ICON_FOR[k]), k, ICON_FOR[k]));
    // ----- enemies, hazards and power-ups
    Object.entries(FOE_SPRITE).forEach(([type, spec]) => {
      const dir = (ENTITY_TYPES[type] && ENTITY_TYPES[type].kind === "power") ? "powerups" : ENEMIES.includes(type) ? "foes" : "hazards";
      add("foe:" + type, `${dir}/${type}.png`, sprite(spec), null, spec);
    });
    // ----- the goal pieces on the board
    [["key", "key"], ["door", "gate"], ["plate", "plate"], ["plate-on", "plateon"], ["seal", "seal"], ["thief", "raccoon"], ["shard", "bag"]]
      .forEach(([piece, name]) => add("board:" + piece, `board/${piece}.png`, sprite([name]), null, [name]));
    Object.entries(RELIC_SPRITE).forEach(([item, name]) => add("relic:" + item, `board/relics/${item}.png`, sprite([name]), null, [name]));
    // ----- the map's side stops, the old hub's places, the title screen's stickers, the cursors
    Object.entries(NODE_ICON).forEach(([stop, name]) => add("pin:" + stop, `icons/map-pins/${stop}.png`, sprite([name]), name, [name]));
    Object.keys(ICON_FOR).filter(k => k.startsWith("place:")).forEach(k => add(k, `icons/places/${k.slice(6)}.png`, sprite(ICON_FOR[k]), k, ICON_FOR[k]));
    add("prestige", "icons/prestige.png", sprite(ICON_FOR.prestige), "prestige", ICON_FOR.prestige);
    Object.entries(STICKER_ART).forEach(([isl, spec]) => add("sticker:" + isl, `icons/stickers/${isl}.png`, sprite(spec), null, spec));
    Object.keys(CURSOR_ROWS).forEach(name => add("cursor:" + name, `icons/cursors/${name}.png`, () => rowsCanvas(CURSOR_ROWS[name], CURSOR_PAL)));
    Object.keys(BADGES).forEach(name => add("badge:" + name, `icons/badges/${name}.png`, () => rowsCanvas(BADGES[name], ICON_PAL)));
    // ----- pictures asked for by name: from code, the avatars, and the old-style upgrades and items
    const named = new Set(["gem", "scroll", "gift", "buck", "orb"]);
    AVATARS.forEach(a => named.add(a.sprite));
    contentIds().forEach(({ id, spec }) => { if (!RECOLORED_NAME[id]) named.add(spec[0]); });
    [...named].sort().forEach(name => {
      add(name, `icons/${name}.png`, sprite([name]), name, [name]);
      // a name that's also an old-style upgrade's id: the old iconUrl() drew that upgrade's picture for it
      const up = ICON_FOR[name];
      if (up && up[0] === name && !up[2] && up[1]) out[out.length - 1].badge = up[1];
      else if (up && (up[0] !== name || up[2])) throw new Error(`"${name}" is both a picture and an upgrade with a different picture`);
    });
    contentIds().forEach(({ id, spec }) => {
      const name = RECOLORED_NAME[id];
      if (name) add(name, `icons/${name}.png`, sprite([spec[0], null, spec[2]]), null, [spec[0], null, spec[2]]);
    });
    // ----- hearts, the empty rune slot, the bosses' faces
    heartStates().forEach(h => fromUrl("heart:" + h.name, `hearts/${h.name}.png`, () => srcOf(heartSlotHtml(h.state))));
    fromUrl("rune:empty", "items/runes/empty-slot.png", () => runeShadowUrl());
    CAMP.islands.forEach(I => fromUrl("boss:" + I.id, `bosses/${I.id}.png`, () => bossFaceUrl(I.id)));
    return out;
  }

  /* The old-style upgrades and items: their pictures come from their content files */
  function contentIds() {
    return Object.keys(ICON_FOR).filter(k => !/^(ci|cu|place):/.test(k) && k !== "prestige").map(id => ({ id, spec: ICON_FOR[id] }));
  }

  /* Every heart slot the HUD can show (camp-hearts.js): your row, a boss's row, the canister's */
  function heartStates() {
    const names = ["empty", "half", "full"];
    const out = [];
    const P = CAMP.rules.snake.armorPieces || 4;
    for (let h = 0; h <= 2; h++) for (let a = 0; a <= 4; a++) out.push({ name: `${names[h]}-armor${a}`, state: { heart: h, armor: a * P / 4 } });
    for (let a = 1; a <= 4; a++) out.push({ name: `canister-armor${a}`, state: { armor: a * P / 4, violet: true } });
    for (let h = 1; h <= 2; h++) out.push({ name: `canister-${names[h]}`, state: { heart: h, purple: true } });
    return out;
  }
  const srcOf = html => /src="([^"]+)"/.exec(html)[1];

  const badgeCanvas = name => rowsCanvas(BADGES[name], ICON_PAL);
  window.LEGACY_REF = { list, contentIds, heartStates, decode, srcOf, badgeCanvas };
})();
