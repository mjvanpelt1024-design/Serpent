/* =========================================================
   tools/textures/legacy-scenes.js
   Runs inside the old game (served from git by textures.mjs), beside
   legacy-ref.js. It turns that game's painted scenes into pictures:

   A scene's painter is run against a recorder at many moments. The
   draw calls that are the same every time are the still picture (the
   background); the ones that change are the things that move, and each
   becomes a picture of its own:
     a light     one color over a rectangle with an alpha that pulses:
                 the rectangle, opaque; the game paints it with the alpha
     a particle  a pixel that drifts and fades: that one pixel
     frames      something that changes shape (a flame): every look it
                 has, side by side, cut from the finished scene, so
                 whatever is painted over it later is in the frames too

   Defines window.LEGACY_SCENES = { sets: { rooms: { list(), backdrop(g, room, t), ... } } }
   Not part of the game.
   ========================================================= */
"use strict";

(() => {
  const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const pixels = c => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;

  /* A stand-in canvas context that writes down every fill */
  function record(paint) {
    const calls = [];
    const ctx = {
      fillStyle: "#000", globalAlpha: 1, imageSmoothingEnabled: false,
      fillRect(x, y, w, h) { calls.push({ fill: String(this.fillStyle), alpha: this.globalAlpha, x, y, w, h }); }
    };
    paint(ctx);
    return calls;
  }
  const replay = (g, calls) => calls.forEach(c => { g.globalAlpha = c.alpha; g.fillStyle = c.fill; g.fillRect(c.x, c.y, c.w, c.h); g.globalAlpha = 1; });
  const same = (a, b) => a.fill === b.fill && a.alpha === b.alpha && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  const rgbOf = fill => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(fill); return m ? `rgb(${m[1]},${m[2]},${m[3]})` : fill; };

  /* Splits a painter into its still calls and its moving ones, over many moments */
  function split(paintAt, times) {
    const runs = times.map(t => record(g => paintAt(g, t)));
    const n = runs[0].length;
    if (runs.some(r => r.length !== n)) throw new Error("the painter draws a different number of things at different times");
    const still = runs[0].map((c, i) => runs.every(r => same(r[i], c)));
    return { runs, still, n };
  }

  /* A picture the size of a rectangle, in one opaque color */
  function solid(w, h, fill) { const c = canvasOf(w, h), g = c.getContext("2d"); g.fillStyle = rgbOf(fill); g.fillRect(0, 0, w, h); return c; }

  /* Frames cut from the finished scene: where a frame differs from the still picture */
  function cutFrames(W, H, plate, fulls) {
    const pp = pixels(plate);
    const diffs = fulls.map(f => pixels(f));
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    diffs.forEach(d => { for (let i = 0; i < W * H; i++) if (d[i * 4] !== pp[i * 4] || d[i * 4 + 1] !== pp[i * 4 + 1] || d[i * 4 + 2] !== pp[i * 4 + 2] || d[i * 4 + 3] !== pp[i * 4 + 3]) { const x = i % W, y = Math.floor(i / W); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
    if (x1 < 0) throw new Error("the frames don't differ from the still picture");
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const sheet = canvasOf(w * fulls.length, h), sg = sheet.getContext("2d"), img = sg.createImageData(sheet.width, h);
    diffs.forEach((d, k) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = ((y0 + y) * W + x0 + x) * 4, o = (y * sheet.width + k * w + x) * 4;
        if (d[i] === pp[i] && d[i + 1] === pp[i + 1] && d[i + 2] === pp[i + 2] && d[i + 3] === pp[i + 3]) continue;
        for (let c = 0; c < 4; c++) img.data[o + c] = d[i + c];
      }
    });
    sg.putImageData(img, 0, 0);
    return { sheet, x: x0, y: y0 };
  }

  /* ----- The picture rooms (camp-invpics.js) ----- */
  const ROOM_TIMES = [0, 0.13, 0.41, 0.77, 1.3, 1.9, 2.6, 3.3, 4.1, 5.2, 6.7];
  /* What moves in each room, by the color it's painted in: a light, a particle, or frames */
  const ROOM_MOVERS = {
    rack: [{ name: "light", kind: "light", file: "window-light", match: /^rgba\(255, ?240, ?200/ }],
    shelf: [{ name: "flame", kind: "frames", file: "candle-flame", times: [0.4, 0.1] }],
    den: [{ name: "light", kind: "light", file: "sea-light", match: /^rgba\(160, ?220, ?255/ }],
    stones: [{ name: "glow", kind: "light", file: "altar-glow", match: /^rgba\(255, ?120, ?40/ }, { name: "ember", kind: "particle", file: "ember", match: /^rgba\(255, ?170, ?80/ }]
  };
  /* The still parts drawn over every room: each spot's hook, cushion or socket, and the satchel's pouches */
  function roomFixtures(g, room) {
    const R = PIC_ROOMS[room];
    R.spots.forEach(s => R.hook(g, s));
    if (R.pocket) R.pocket.forEach(s => { pR(g, s.x - 12, s.y - 10, 24, 22, "#5a3a1e"); pR(g, s.x - 11, s.y - 9, 22, 20, "#8a5a30"); pR(g, s.x - 11, s.y - 9, 22, 4, "#9a6a3a"); });
  }
  /* The old room at time t, everything but its things: what the new picBackdrop() must match */
  function roomBackdrop(g, room, t) {
    g.imageSmoothingEnabled = false;
    PIC_ROOMS[room].paint(g, t);
    roomFixtures(g, room);
  }
  const ROOM_MARKS = {
    away: { w: 16, h: 16, draw: g => { pR(g, 0, 4, 16, 12, "#e8dcc0"); pR(g, 0, 4, 16, 1, "#fff6d8"); pR(g, 7, 0, 2, 4, "#5a3a20"); } },
    seal: { w: 5, h: 5, draw: g => { pR(g, 0, 0, 5, 5, "#c0201a"); pR(g, 1, 1, 2, 2, "#ff6a5a"); } },
    trinket: { w: 4, h: 4, draw: g => pR(g, 0, 0, 4, 4, "#ffd23f") },
    pip: { w: 3, h: 3, draw: g => pR(g, 0, 0, 3, 3, "#ff00ff"), keys: { "#ff00ff": "pip" }, file: "rarity-pip" }
  };

  function roomList() {
    const out = [];
    Object.keys(PIC_ROOMS).forEach(room => {
      const movers = ROOM_MOVERS[room] || [];
      const { runs, still, n } = split((g, t) => PIC_ROOMS[room].paint(g, t), ROOM_TIMES);
      const moving = runs[0].map((c, i) => i).filter(i => !still[i]);
      // every moving call has to belong to one of the room's movers
      moving.forEach(i => { if (!movers.some(m => m.kind === "frames" || m.match.test(runs[0][i].fill))) throw new Error(`${room}: something moves that isn't listed: ${JSON.stringify(runs[0][i])}`); });
      // the still picture: the still calls, then the fixtures over them
      const plate = canvasOf(PIC_W, PIC_H), pg = plate.getContext("2d");
      replay(pg, runs[0].filter((c, i) => still[i]));
      roomFixtures(pg, room);
      out.push({ id: "room:" + room, file: `scenes/rooms/${room}/background.png`, canvas: plate });
      movers.forEach(m => {
        const mine = moving.filter(i => m.kind === "frames" || m.match.test(runs[0][i].fill));
        if (m.kind === "light") {
          const c = runs[0][mine[0]];
          if (mine.length !== 1) throw new Error(`${room} ${m.name}: expected one light, found ${mine.length}`);
          out.push({ id: `room:${room}:${m.name}`, file: `scenes/rooms/${room}/${m.file}.png`, canvas: solid(c.w, c.h, c.fill), at: [c.x, c.y] });
        } else if (m.kind === "particle") {
          const c = runs[0][mine[0]];
          out.push({ id: `room:${room}:${m.name}`, file: `scenes/rooms/${room}/${m.file}.png`, canvas: solid(Math.round(c.w), Math.round(c.h), c.fill) });
        } else {
          // frames: the whole old room at each moment, cut where it differs from the still picture
          const fulls = m.times.map(t => { const c = canvasOf(PIC_W, PIC_H); roomBackdrop(c.getContext("2d"), room, t); return c; });
          const cut = cutFrames(PIC_W, PIC_H, plate, fulls);
          out.push({ id: `room:${room}:${m.name}`, file: `scenes/rooms/${room}/${m.file}.png`, canvas: cut.sheet, frames: fulls.length, at: [cut.x, cut.y] });
        }
      });
      void n;
    });
    Object.entries(ROOM_MARKS).forEach(([name, m]) => {
      const c = canvasOf(m.w, m.h); m.draw(c.getContext("2d"));
      out.push({ id: "room:mark:" + name, file: `scenes/rooms/marks/${m.file || name}.png`, canvas: c, keys: m.keys });
    });
    return out;
  }

  /* ----- The shops and their workshops (camp-shop-stage.js) -----
     The old drawStage(), split by what's under the moving things and what's over them. Every
     line below is the old code's own, regrouped; textures.mjs check compares the whole stage. */
  const rr = g => (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  /* The walls: everything of ssWall() that's still and drawn before what moves on them */
  function shopBack(g, isl) {
    const R = rr(g);
    [0, SS_ROOM].forEach(ox => {
      if (isl === "keep") {
        R(ox, 0, SS_ROOM, SS_H, "#8a8680");
        for (let y = 0; y < 72; y += 6) for (let x = (y / 6) % 2 ? -6 : 0; x < SS_ROOM; x += 12) { R(ox + x, y, 11, 5, (x + y) % 3 ? "#9a968e" : "#8e8a82"); R(ox + x, y, 11, 1, "#aaa69e"); }
      } else if (isl === "spire") {
        R(ox, 0, SS_ROOM, SS_H, "#241a4a");
      } else if (isl === "hollow") {
        for (let x = 0; x < SS_ROOM; x += 8) { R(ox + x, 0, 7, SS_H, (x / 8) % 2 ? "#8a5a30" : "#9a6a3a"); R(ox + x + 7, 0, 1, SS_H, "#5a3a1e"); }
      } else if (isl === "reef") {
        R(ox, 0, SS_ROOM, SS_H, "#1a5a7a");
        for (let y = 0; y < 72; y += 4) R(ox, y, SS_ROOM, 1, y % 8 ? "#1e6282" : "#165272");
      } else {
        R(ox, 0, SS_ROOM, SS_H, "#2a1a1e");
        for (let i = 0; i < 6; i++) R(ox + i * 28 + 8, 0, 2, 72, "#1a1216");
      }
    });
  }
  /* The order shelf's frame (its parcels change) */
  const shelfFrame = (R, x, y, w) => { R(x, y, w, 3, "#6a4628"); R(x, y + 18, w, 3, "#6a4628"); R(x + 1, y + 3, 1, 15, "#4a2e18"); R(x + w - 2, y + 3, 1, 15, "#4a2e18"); };
  /* Everything still that's drawn after the walls: the Spire's stripes (over its stars), the line
     between the rooms, the workshop's things, the shop's awning, shelf and spots */
  function shopMiddle(g, isl) {
    const R = rr(g), ws = workshopOf(isl);
    if (isl === "spire") [0, SS_ROOM].forEach(ox => { for (let x = 0; x < SS_ROOM; x += 20) R(ox + x, 0, 1, 72, "#32245e"); });
    R(SS_ROOM - 2, 0, 4, SS_H, "rgba(0,0,0,0.35)");
    R(0, 92, SS_ROOM, 8, "#3a2a1e"); R(0, 92, SS_ROOM, 1, "#5a4a3a");
    if (ws === "armory") {
      R(8, 40, 40, 52, "#5a5250"); R(14, 54, 28, 22, "#1a0e0a");
      R(18, 66, 20, 10, "#ffd23f");
      R(30, 82, 30, 4, "#3a3a44"); R(36, 86, 16, 6, "#2a2a34"); R(26, 78, 38, 4, "#5a5a64"); R(26, 78, 38, 1, "#8a8a94");
      R(52, 24, 2, 16, "#5a3a20"); R(50, 22, 6, 4, "#9aa3ad");
      shelfFrame(R, 64, 18, 40);
      R(128, 86, 18, 6, "#4a3018"); R(136, 44, 3, 44, "#6a4628"); R(126, 54, 22, 3, "#6a4628");
      R(130, 38, 14, 10, "#8a6a4a"); R(132, 40, 10, 6, "#a8845a");
    } else if (ws === "arcana") {
      R(12, 70, 40, 5, "#5a3a20"); R(26, 75, 12, 17, "#4a2e18"); R(8, 62, 48, 9, "#6a4628");
      R(14, 54, 36, 9, "#f4ead0"); R(31, 54, 2, 9, "#b89a68");
      shelfFrame(R, 64, 18, 40);
      R(116, 78, 36, 14, "#5a3a20"); R(122, 56, 6, 22, "#7a7a84"); R(140, 56, 6, 22, "#7a7a84"); R(118, 50, 32, 7, "#9a9aa4");
      R(126, 70, 16, 6, "#c0201a"); R(130, 72, 8, 2, "#ff6a5a");
      [118, 148].forEach(x => R(x, 40, 3, 10, "#e8dcc0"));
    } else if (ws === "kitchen") {
      R(10, 78, 40, 14, "#5a3a20"); R(12, 64, 36, 14, "#f4ead0"); R(29, 64, 2, 14, "#b89a68"); R(14, 68, 12, 1, "#8a6a40"); R(33, 68, 12, 1, "#8a6a40");
      R(62, 14, 42, 3, "#6a4628"); R(62, 32, 42, 3, "#6a4628"); R(62, 50, 42, 3, "#6a4628");
      ["#ffd23f", "#ff8c1a", "#d1202a", "#3ddc84", "#e8dcc0", "#a855f7"].forEach((c, i) => { R(65 + (i % 3) * 13, 22 + Math.floor(i / 3) * 18, 8, 10, "#e8f0f0"); R(66 + (i % 3) * 13, 25 + Math.floor(i / 3) * 18, 6, 7, c); });
      R(110, 36, 42, 56, "#8a5a3a"); R(116, 50, 30, 26, "#1a0e0a");
      R(124, 22, 8, 14, "#5a4a3a");
    } else if (ws === "kennel") {
      R(4, 66, 72, 26, "#2a7aa8");
      R(114, 18, 38, 40, "#8a6a4a"); R(116, 20, 34, 36, "#c8a878");
    } else {
      R(4, 84, 70, 8, "#ff6a1a");
      R(16, 70, 40, 6, "#4a4250"); R(24, 76, 24, 8, "#3a3240"); R(12, 64, 48, 6, "#6a6270"); R(12, 64, 48, 1, "#8a8290");
      shelfFrame(R, 110, 22, 42);
    }
    const ox = SS_ROOM, acc = CAMP.islandById[isl].colors.accent;
    for (let x = 0; x < SS_ROOM; x += 8) { R(ox + x, 0, 8, 8, (x / 8) % 2 ? acc : "#f4f0e8"); R(ox + x + 2, 8, 4, 2, (x / 8) % 2 ? acc : "#f4f0e8"); }
    // (the awning's shadow line is its own picture: it crosses the line between the rooms, and two
    // see-through things on one pixel can't share a file and still shade the same)
    R(ox + 4, 44, SS_ROOM - 8, 3, "#7a5232"); R(ox + 4, 44, SS_ROOM - 8, 1, "#a8784a"); R(ox + 4, 47, SS_ROOM - 8, 1, "#3a2414");
    [10, 80, 150].forEach(x => { R(ox + x, 47, 2, 6, "#5a3a20"); });
    for (let i = 0; i < 5; i++) { const x = SPOT_X(i); R(x - 11, 41, 22, 3, "#c8b090"); R(x - 11, 41, 22, 1, "#e8d8b8"); }
  }
  /* In front of the keeper: the counter, the bell, the crate */
  function shopFront(g) {
    const R = rr(g), ox = SS_ROOM;
    R(ox, 72, SS_ROOM, 28, "#6a4a2a"); R(ox, 72, SS_ROOM, 2, "#9a6a3a"); R(ox, 74, SS_ROOM, 1, "#4a3018");
    for (let i = 0; i < 4; i++) R(ox + 10 + i * 38, 78, 30, 18, "#5a3a20");
    R(ox + 34, 70, 10, 2, "#5a3a20"); R(ox + 35, 64, 8, 6, "#ffd23f"); R(ox + 36, 64, 2, 5, "#fff6c4"); R(ox + 38, 62, 2, 2, "#c08a10");
    R(ox + 60, 62, 26, 10, "#a8784a"); R(ox + 60, 62, 26, 1, "#c8945a"); R(ox + 60, 66, 26, 1, "#7a5232"); R(ox + 72, 62, 1, 10, "#7a5232");
  }
  /* A little picture drawn by the old code's own calls, from its top left corner */
  const sprite = (w, h, draw) => { const c = canvasOf(w, h); draw(rr(c.getContext("2d"))); return c; };
  /* Frames side by side */
  const sheet = list => { const w = list[0].width, h = list[0].height, c = canvasOf(w * list.length, h), g = c.getContext("2d"); list.forEach((f, i) => g.drawImage(f, i * w, 0)); return c; };
  function shopList() {
    const out = [];
    const add = (id, file, canvas, extra = {}) => out.push(Object.assign({ id, file, canvas }, extra));
    const D = "scenes/shops/";
    CAMP.islands.forEach(I => {
      const isl = I.id, ws = workshopOf(isl);
      const back = canvasOf(SS_W, SS_H); shopBack(back.getContext("2d"), isl);
      const mid = canvasOf(SS_W, SS_H); shopMiddle(mid.getContext("2d"), isl);
      add(`shop:${isl}:back`, `${D}${isl}/back.png`, back);
      add(`shop:${isl}:middle`, `${D}${isl}/middle.png`, mid);
      const front = canvasOf(SS_W, SS_H); shopFront(front.getContext("2d"));
      add(`shop:${isl}:front`, `${D}counter.png`, front);
      // the still picture under what moves in the workshop: the walls, then the middle over them
      const plate = canvasOf(SS_W, SS_H), pg = plate.getContext("2d"); pg.drawImage(back, 0, 0); pg.drawImage(mid, 0, 0);
      const cut = (fulls, at) => { const c = cutFrames(SS_W, SS_H, plate, fulls); if (c.x !== at[0] || c.y !== at[1]) throw new Error(`${isl}: frames cut at ${c.x}, ${c.y}, but the game draws them at ${at}`); return c; };
      const over = draw => { const c = canvasOf(SS_W, SS_H), g = c.getContext("2d"); g.drawImage(plate, 0, 0); draw(g, rr(g)); return c; };
      if (isl === "spire") add("shop:spire:star", `${D}spire/star.png`, sprite(1, 1, R => R(0, 0, 1, 1, "#d8c8ff")));
      if (isl === "reef") add("shop:reef:bubble", `${D}reef/bubble.png`, sprite(1, 1, R => R(0, 0, 1, 1, "rgb(200,240,255)")));
      if (isl === "crown") add("shop:crown:wall-glow", `${D}crown/wall-glow.png`, sprite(SS_ROOM, 50, R => R(0, 0, SS_ROOM, 50, "rgb(255,110,30)")));
      if (ws === "armory") {
        // the forge's mouth at its three flickers: the glow, with the fire drawn over it again
        const fulls = [-1, 0, 1].map(f => over((g, R) => { g.fillStyle = `rgba(255,${120 + f * 20},40,0.9)`; g.fillRect(16, 62, 24, 14); R(18, 66, 20, 10, "#ffd23f"); }));
        add("shop:keep:forge", `${D}keep/forge.png`, cut(fulls, [16, 62]).sheet, { frames: 3 });
      } else if (ws === "arcana") {
        add("shop:spire:mote", `${D}spire/mote.png`, sprite(1, 1, R => R(0, 0, 1, 1, "rgb(180,240,255)")));
        add("shop:spire:flame", `${D}spire/candle-flame.png`, sprite(3, 3, R => R(0, 0, 3, 3, "#ffb020")));
      } else if (ws === "kitchen") {
        const fulls = [-1, 0, 1].map(f => over(g => { g.fillStyle = `rgba(255,150,50,${0.7 + f * 0.1})`; g.fillRect(118, 64, 26, 12); }));
        add("shop:hollow:oven", `${D}hollow/oven-fire.png`, cut(fulls, [118, 64]).sheet, { frames: 3 });
        add("shop:hollow:steam", `${D}hollow/steam.png`, sprite(2, 2, R => R(0, 0, 2, 2, "rgb(220,220,220)")));
        add("shop:hollow:batch", `${D}hollow/batch.png`, sheet(["#8a6a4a", "#e8c070"].map(c => sprite(6, 4, R => R(0, 0, 6, 4, c)))), { frames: 2 });
      } else if (ws === "kennel") {
        add("shop:reef:wave", `${D}reef/wave.png`, sprite(3, 1, R => R(0, 0, 3, 1, "#7fc8e8")));
        add("shop:reef:hoop", `${D}reef/hoops.png`, sheet([0, 1, 2].map(i => sprite(12, 8, R => { const c = i % 2 ? "#d1202a" : "#f4f0e8"; R(1, 0, 10, 2, c); R(1, 6, 10, 2, c); R(0, 2, 2, 4, c); R(10, 2, 2, 4, c); }))), { frames: 3 });
        add("shop:reef:board-row", `${D}reef/board-row.png`, sheet(["#f4ead0", "#9bf0a8"].map(c => sprite(28, 7, R => R(0, 0, 28, 7, c)))), { frames: 2 });
      } else {
        add("shop:crown:ripple", `${D}crown/ripple.png`, sprite(3, 1, R => R(0, 0, 3, 1, "#ffd23f")));
        add("shop:crown:anvil-glow", `${D}crown/anvil-glow.png`, sprite(48, 30, R => R(0, 0, 48, 30, "rgb(255,110,30)")));
        add("shop:crown:anvil-rune", `${D}crown/anvil-rune.png`, sprite(12, 12, R => { R(0, 0, 12, 12, "#8a8280"); R(2, 3, 8, 1, "#ff8a3a"); R(5, 2, 2, 6, "#ff8a3a"); }));
      }
    });
    // the same in every shop: order parcels, the glint on a ready one, the shelf's boxes and tags, the lantern
    add("shop:parcel", `${D}shared/parcel.png`, sheet(["#b08a5a", "#e8c070"].map(c => sprite(9, 10, R => { R(0, 0, 9, 10, c); R(0, 4, 9, 1, "#7a5232"); R(4, 0, 1, 10, "#7a5232"); }))), { frames: 2 });
    add("shop:glint", `${D}shared/glint.png`, sprite(3, 3, R => R(0, 0, 3, 3, "#fff6a8")));
    add("shop:awning-shadow", `${D}shared/awning-shadow.png`, sprite(SS_ROOM, 1, R => R(0, 0, SS_ROOM, 1, "rgba(0,0,0,0.25)")));
    add("shop:sold-out", `${D}shared/sold-out.png`, sprite(16, 15, R => { R(0, 6, 16, 9, "#8a6a4a"); R(1, 7, 14, 7, "#a8845a"); R(3, 10, 10, 1, "#5a3a20"); R(7, 0, 2, 6, "#5a3a20"); }));
    add("shop:sale-tag", `${D}shared/sale-tag.png`, sprite(7, 13, R => { R(2, 0, 1, 5, "#3a2410"); R(0, 5, 7, 8, "#d1202a"); R(1, 6, 5, 6, "#ff4a3a"); R(3, 7, 1, 1, "#3a2410"); }));
    add("shop:ribbon", `${D}shared/rarity-ribbon.png`, sprite(22, 1, R => R(0, 0, 22, 1, "#ff00ff")), { keys: { "#ff00ff": "ribbon" } });
    add("shop:item-shadow", `${D}shared/item-shadow.png`, sprite(20, 1, R => R(0, 0, 20, 1, "#000000")));
    add("shop:lantern", `${D}shared/lantern.png`, sprite(5, 14, R => { R(2, 0, 1, 8, "#3a2a1a"); R(0, 8, 5, 6, "#3a2a1a"); R(1, 9, 3, 4, "#ffd27a"); }));
    return out;
  }

  /* ----- The shopkeepers (drawKeeper in map-isles.js) -----
     Each keeper, in its own colors, at every one of its twelve looks: swaying left, upright or right,
     with its eyes open or blinking, its tongue in or out. The old code picks the look from the time,
     so each look is drawn at a moment when the old code shows it. */
  const KEEPER_ROLES = ["merchant", "challenger", "banker"];
  const keeperState = (role, t) => ({
    sway: Math.round(Math.sin(t * 1.4 + role.length) * 0.6),
    blink: (t * 0.7 + role.length) % 5 < 0.12,
    tongue: Math.sin(t * 2 + role.length) > 0.85
  });
  const keeperFrame = s => s.sway + 1 + 3 * ((s.blink ? 1 : 0) + (s.tongue ? 2 : 0));
  /* A moment for each of the twelve looks */
  function keeperMoments(role) {
    const found = new Array(12).fill(null);
    for (let i = 0; i < 4e6 && found.includes(null); i++) {
      const t = i * 0.001, k = keeperFrame(keeperState(role, t));
      if (found[k] === null) found[k] = t;
    }
    if (found.includes(null)) throw new Error(`${role}: some looks never happen`);
    return found;
  }
  const KEEPER_AT = [16, 20];      // where the feet go on the scratch canvas
  function keeperList() {
    const out = [];
    const all = [];
    CAMP.islands.forEach(I => KEEPER_ROLES.forEach(role => {
      const moments = keeperMoments(role);
      const frames = moments.map(t => { const c = canvasOf(32, 32), g = c.getContext("2d"); drawKeeper(g, I.npcs[role].look, KEEPER_AT[0], KEEPER_AT[1], t, role); return c; });
      all.push({ isl: I.id, role, frames });
    }));
    // one box for every keeper, so every sheet has the same layout
    let x0 = 32, y0 = 32, x1 = -1, y1 = -1;
    all.forEach(k => k.frames.forEach(f => { const p = pixels(f); for (let i = 0; i < 32 * 32; i++) if (p[i * 4 + 3]) { const x = i % 32, y = Math.floor(i / 32); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }));
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    all.forEach(k => {
      const sheet = canvasOf(w * 3, h * 4), g = sheet.getContext("2d");
      k.frames.forEach((f, i) => g.drawImage(f, x0, y0, w, h, (i % 3) * w, Math.floor(i / 3) * h, w, h));
      out.push({ id: `keeper:${k.isl}:${k.role}`, file: `scenes/keepers/${k.isl}-${k.role}.png`, canvas: sheet, frames: 12, columns: 3, anchor: [KEEPER_AT[0] - x0, KEEPER_AT[1] - y0] });
    });
    return out;
  }

  /* ----- Home base (camp-home.js) -----
     The old drawHome() and its helpers, regrouped. Sky and ground are the old homeSky() and
     homeGround() at the widest the home gets (320); the rest is the old code's own lines. */
  const HOME_STEP = 2 * Math.PI / 1.3 / 4;
  const mr = g => (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  /* The old tree without its lantern and fruit glints, for any number of tiers bought */
  function homeTreeOld(g, isl, x, y, t, have, total) {
    const R = mr(g);
    const f = total ? have / total : 0;
    const leaves = CTREE_LEAVES[isl];
    const h = 40 + Math.round(f * 26), tw = 6 + Math.round(f * 6);
    for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 8; k++) R(x + i * (tw / 2 + k), y - 2 + Math.round(k * 0.4), 2, 2, k % 3 ? "#5a3a20" : "#6a4628");
    for (let j = 0; j < h; j++) {
      const w = Math.round(tw * (1 - j / h * 0.45));
      const sway = Math.round(Math.sin(t * 0.6 + j * 0.05) * (j / h) * 1.2);
      R(x - Math.floor(w / 2) + sway, y - j, w, 1, "#5a3a20");
      R(x - Math.floor(w / 2) + sway, y - j, 1, 1, "#8a6238");
      R(x - Math.floor(w / 2) + sway + w - 1, y - j, 1, 1, "#3a2414");
      if (j % 7 === 3) R(x - 1 + sway, y - j, 2, 1, "#4a2e18");
    }
    const bough = (a, len, at) => { for (let k = 0; k < len; k++) R(x + Math.cos(a) * k, y - at + Math.sin(a) * k * 0.6, 2, 2, "#5a3a20"); };
    bough(Math.PI + 0.4, 18 + f * 10, h * 0.62); bough(-0.4, 18 + f * 10, h * 0.6); bough(Math.PI + 0.9, 12 + f * 6, h * 0.82); bough(-0.9, 12 + f * 6, h * 0.8);
    const clusters = [[0, -h - 4, 18], [-20, -h * 0.72, 14], [20, -h * 0.7, 14], [-30, -h * 0.5, 10], [30, -h * 0.48, 10], [-10, -h - 14, 12], [12, -h - 12, 12]];
    clusters.forEach(([dx, dy, r0], ci) => {
      const r = r0 * (0.7 + f * 0.6);
      const n = Math.round((60 + f * 140) * (r0 / 18));
      for (let k = 0; k < n; k++) {
        const a = mapHash(k, ci, 21) * Math.PI * 2, d = Math.sqrt(mapHash(k, ci, 23)) * r;
        const lx = x + dx + Math.cos(a) * d * 1.2 + Math.sin(t * 1.3 + k) * 0.4, ly = y + dy + Math.sin(a) * d * 0.8;
        R(lx, ly, 2, 2, leaves[(k + (Math.sin(a) < -0.3 ? 2 : Math.sin(a) > 0.4 ? 0 : 1)) % 3]);
      }
    });
    for (let i = 0; i < Math.min(30, have); i++) {
      const [dx, dy, r0] = clusters[i % clusters.length];
      const a = mapHash(i, 4, 9) * Math.PI * 2, d = r0 * 0.7 * Math.sqrt(mapHash(i, 5, 9));
      const fx = x + dx + Math.cos(a) * d * 1.2, fy = y + dy + Math.sin(a) * d * 0.8;
      R(fx, fy, 2, 2, leaves[3]);
      R(fx, fy, 1, 1, shadeHex(leaves[3], 0.5));
    }
  }
  /* A picture from the old code's own calls, drawn with its top left corner at 0, 0 (ox, oy is where the
     old code's x, y falls in it); it complains if anything lands outside */
  function spriteAt(w, h, ox, oy, draw) {
    const c = canvasOf(w + 8, h + 8);
    draw(mr(c.getContext("2d")), ox + 4, oy + 4, c.getContext("2d"));
    const p = pixels(c);
    for (let y = 0; y < h + 8; y++) for (let x = 0; x < w + 8; x++) if (p[(y * (w + 8) + x) * 4 + 3] && (x < 4 || y < 4 || x >= w + 4 || y >= h + 4)) throw new Error(`a ${w}x${h} picture spills over at ${x - 4}, ${y - 4}`);
    const out = canvasOf(w, h); out.getContext("2d").drawImage(c, 4, 4, w, h, 0, 0, w, h);
    return out;
  }
  const solidOf = (w, h, color) => { const c = canvasOf(w, h), g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, w, h); return c; };
  function homeList() {
    const out = [];
    const add = (id, file, canvas, extra = {}) => out.push(Object.assign({ id, file, canvas }, extra));
    const D = "scenes/home/";
    const keepW = W_HOME();
    window.eval("HOME_W = 320");
    CAMP.islands.forEach(I => {
      const isl = I.id, isle = ISLANDS[isl];
      add(`home:${isl}:sky`, `${D}${isl}/sky.png`, homeSky(isl));
      add(`home:${isl}:ground`, `${D}${isl}/ground.png`, homeGround(isl));
      // the far islands, each as it is when it sits on a whole pixel
      for (let i = 0; i < 5; i++) {
        const y = 20 + mapHash(i, 6, 3) * 50, w = 8 + mapHash(i, 7, 3) * 12, yl = y - Math.floor(y);
        const [r0, g0, b0] = skyAt(isle.y - 150 + y * 1.2);
        const c = canvasOf(40, 16), g = c.getContext("2d"), x = 20;
        g.fillStyle = `rgba(${Math.round(r0 * 0.75)},${Math.round(g0 * 0.78)},${Math.round(b0 * 0.85)},0.7)`;
        g.fillRect(Math.round(x - w / 2), Math.round(yl), Math.round(w), 2);
        for (let r = 1; r < w * 0.5; r++) { const ww = Math.max(1, Math.round(w * (1 - r / (w * 0.5)))); g.fillRect(Math.round(x - ww / 2), Math.round(yl + 1 + r), ww, 1); }
        add(`home:${isl}:far-${i + 1}`, `${D}${isl}/far-island-${i + 1}.png`, c);
      }
      add(`home:${isl}:leaf`, `${D}${isl}/falling-leaf.png`, sheet([0, 1, 2].map(k => sprite(1, 1, R => R(0, 0, 1, 1, CTREE_LEAVES[isl][k])))), { frames: 3 });
      // the tree: a row for every tier bought (0 to all), four moments of its leaves stirring
      const total = I.tree.upgrades.reduce((a, u) => a + u.values.length - 1, 0);
      const frames = [];
      // drawn where the game draws it (160, 102: the same sums, so the same roundings), on a canvas
      // moved down 40 pixels so nothing is cut off at the top
      for (let have = 0; have <= total; have++) for (let k = 0; k < 4; k++) {
        const c = canvasOf(320, 175), g = c.getContext("2d"); g.translate(0, 40); homeTreeOld(g, isl, 160, 102, (k + 0.5) * HOME_STEP, have, total); frames.push(c);
      }
      let x0 = 320, y0 = 175, x1 = -1, y1 = -1;
      frames.forEach(f => { const p = pixels(f); for (let i = 0; i < 320 * 175; i++) if (p[i * 4 + 3]) { const x = i % 320, y = Math.floor(i / 320); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
      if (x0 === 0 || y0 === 0 || x1 === 319 || y1 === 174) throw new Error(`${isl}: the tree doesn't fit its scratch canvas`);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, tree = canvasOf(w * 4, h * (total + 1)), tg = tree.getContext("2d");
      frames.forEach((f, i) => tg.drawImage(f, x0, y0, w, h, (i % 4) * w, Math.floor(i / 4) * h, w, h));
      add(`home:${isl}:tree`, `${D}${isl}/tree.png`, tree, { frames: (total + 1) * 4, columns: 4, anchor: [160 - x0, 142 - y0] });
    });
    window.eval(`HOME_W = ${keepW}`);
    // the sky's things
    add("home:star", `${D}star.png`, sheet([sprite(1, 1, R => R(0, 0, 1, 1, "#fffbe0")), sprite(1, 1, R => R(0, 0, 1, 1, "rgba(255,250,230,0.5)"))]), { frames: 2 });
    add("home:sun", `${D}sun.png`, (() => { const c = canvasOf(19, 19), g = c.getContext("2d"); skyDisc(g, 9, 9, 9, "rgba(255,220,150,0.3)"); skyDisc(g, 9, 9, 6, "#fff0b8"); return c; })());
    add("home:moon", `${D}moon.png`, (() => { const c = canvasOf(15, 15), g = c.getContext("2d"); skyDisc(g, 7, 7, 7, "rgba(255,250,220,0.15)"); skyDisc(g, 7, 7, 5, "#fff6d8"); return c; })());
    add("home:moon-shadow", `${D}moon-shadow.png`, (() => { const c = canvasOf(11, 11), g = c.getContext("2d"); skyDisc(g, 5, 5, 4.4, "rgba(40,30,80,0.9)"); return c; })());
    // a cloud is three puffs that overlap, each laid on separately: one puff a frame (drawCloud's own rectangles)
    for (let i = 0; i < 6; i++) {
      const w = 20 + mapHash(i, 8, 3) * 26, x = 40, y = 12, h = Math.max(2, Math.round(w * 0.22));
      const puffs = [[Math.round(x), Math.round(y), Math.round(w), h], [Math.round(x + w * 0.15), Math.round(y - h * 0.6), Math.round(w * 0.4), h], [Math.round(x + w * 0.45), Math.round(y - h), Math.round(w * 0.35), h]];
      add(`home:cloud-${i + 1}`, `${D}cloud-${i + 1}.png`, sheet(puffs.map(([px, py, pw, ph]) => { const c = canvasOf(90, 24), g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(px, py, pw, ph); return c; })), { frames: 3 });
    }
    // the things around the tree
    add("home:trophy", `${D}trophy.png`, sheet([0, 1].map(got => spriteAt(16, 22, 8, 22, (R, x, y) => {
      R(x - 7, y - 10, 14, 10, "#a8a29a"); R(x - 7, y - 10, 14, 1, "#d0cac0"); R(x - 7, y - 10, 2, 10, "#c0bab0"); R(x + 5, y - 10, 2, 10, "#7a766e");
      R(x - 8, y - 12, 16, 2, "#c0bab0"); R(x - 8, y - 1, 16, 1, "#6a665e");
      const cup = got ? ["#ffd23f", "#c08a10", "#fff6c4"] : ["#9aa3ad", "#5b6470", "#d8dde6"];
      R(x - 5, y - 22, 10, 6, cup[0]); R(x - 4, y - 16, 8, 1, cup[0]); R(x - 3, y - 15, 6, 1, cup[1]);
      R(x - 1, y - 14, 2, 2, cup[1]); R(x - 3, y - 13, 6, 1, cup[0]);
      R(x - 7, y - 21, 2, 1, cup[0]); R(x - 7, y - 20, 1, 3, cup[0]); R(x + 5, y - 21, 2, 1, cup[0]); R(x + 6, y - 20, 1, 3, cup[0]);
      R(x - 4, y - 22, 2, 5, cup[2]); R(x + 3, y - 22, 1, 6, cup[1]);
    }))), { frames: 2 });
    add("home:trophy-glint", `${D}trophy-glint.png`, spriteAt(3, 3, 4, 25, (R, x, y) => { R(x - 3, y - 25, 1, 3, "#ffffff"); R(x - 4, y - 24, 3, 1, "#ffffff"); }));
    [1, 2, 3].forEach(r => add(`home:trophy-glow-${r}`, `${D}trophy-glow-${r}.png`, solidOf(10 + r * 4, 9 + r * 4, "rgb(255,210,63)")));
    add("home:mirror", `${D}mirror.png`, spriteAt(16, 36, 8, 35, (R, x, y) => {
      R(x - 8, y - 32, 16, 30, "#8a5a30"); R(x - 8, y - 32, 16, 1, "#b07a42"); R(x - 8, y - 32, 1, 30, "#a06a38");
      R(x - 6, y - 30, 12, 26, "#9ab8c8");
      for (let j = 0; j < 26; j++) R(x - 6, y - 30 + j, 12, 1, j < 9 ? "#b8d8e8" : j < 18 ? "#a8c8d8" : "#98b8c8");
      R(x - 7, y - 2, 2, 3, "#5a3a1e"); R(x + 5, y - 2, 2, 3, "#5a3a1e");
      R(x - 1, y - 35, 2, 3, "#ffd23f");
    }));
    add("home:mirror-shine", `${D}mirror-shine.png`, solidOf(2, 1, "#ffffff"));
    add("home:easel", `${D}easel.png`, spriteAt(19, 30, 9, 30, (R, x, y) => {
      R(x - 6, y - 26, 1, 26, "#6a4628"); R(x + 6, y - 26, 1, 26, "#6a4628"); R(x, y - 30, 1, 30, "#5a3a20");
      R(x - 8, y - 10, 17, 2, "#7a5232");
      R(x - 9, y - 28, 19, 16, "#e8dcc0");
      R(x - 9, y - 28, 19, 1, "#f8f0e0"); R(x + 9, y - 28, 1, 16, "#b8ac90");
      R(x - 6, y - 11, 2, 1, "#ff3b3b"); R(x - 3, y - 11, 2, 1, "#3a82e0"); R(x, y - 11, 2, 1, "#ffd23f");
    }));
    add("home:satchel-strap", `${D}satchel-strap.png`, spriteAt(15, 7, 1, 15, (R, x, y) => { R(x - 1, y - 14, 1, 6, "#5a3a1e"); R(x + 13, y - 14, 1, 6, "#5a3a1e"); R(x, y - 15, 13, 1, "#5a3a1e"); }));
    add("home:satchel", `${D}satchel.png`, spriteAt(13, 11, 0, 10, (R, x, y) => {
      R(x, y - 10, 13, 10, "#b07a42"); R(x, y - 10, 13, 1, "#d09a5a"); R(x, y - 10, 1, 10, "#c88a50"); R(x + 12, y - 10, 1, 10, "#7a5232");
      R(x, y - 10, 13, 4, "#9a6a3a"); R(x, y - 7, 13, 1, "#5a3a1e");
      R(x + 5, y - 8, 3, 3, "#ffd23f"); R(x + 6, y - 7, 1, 1, "#a8860b");
      R(x, y, 13, 1, "rgba(0,0,0,0.3)");
    }));
    add("home:glint", `${D}glint.png`, solidOf(1, 1, "#ffffff"));
    add("home:rack", `${D}rack.png`, spriteAt(21, 31, 10, 31, (R, x, y) => {
      R(x - 10, y - 2, 21, 2, "#4a3018");
      R(x - 9, y - 30, 2, 28, "#6a4628"); R(x + 8, y - 30, 2, 28, "#6a4628"); R(x - 10, y - 31, 21, 2, "#7a5232");
      R(x - 8, y - 20, 17, 1, "#5a3a20"); R(x - 8, y - 9, 17, 1, "#5a3a20");
      R(x - 6, y - 29, 1, 27, "#9aa3ad"); R(x - 7, y - 31, 3, 3, "#c8ced6");
      R(x + 5, y - 26, 1, 22, "#d8dde6"); R(x + 3, y - 8, 5, 1, "#c08a10");
    }));
    add("home:rack-empty", `${D}rack-empty.png`, sprite(8, 9, R => { R(0, 0, 8, 9, "#8a6a4a"); R(1, 1, 6, 7, "#a8845a"); }));
    add("home:shelf", `${D}shelf.png`, spriteAt(19, 28, 9, 28, (R, x, y) => {
      R(x - 9, y - 24, 19, 24, "#4a2e18"); R(x - 8, y - 23, 17, 22, "#2a1a0e");
      R(x - 8, y - 16, 17, 1, "#6a4628"); R(x - 8, y - 8, 17, 1, "#6a4628");
      const cols = ["#b36bff", "#3a82e0", "#d1202a", "#3ddc84", "#ffd23f"];
      for (let i = 0; i < 4; i++) { R(x - 7 + i * 4, y - 22, 3, 6, cols[i]); R(x - 7 + i * 4, y - 14, 3, 6, cols[(i + 2) % 5]); R(x - 6 + i * 4, y - 6, 2, 5, cols[(i + 4) % 5]); }
      R(x + 4, y - 28, 2, 4, "#e8dcc0");
    }));
    add("home:shelf-flame", `${D}shelf-flame.png`, solidOf(2, 2, "#ffb020"));
    add("home:shelf-glow", `${D}shelf-glow.png`, solidOf(10, 10, "rgb(255,200,120)"));
    add("home:den", `${D}den.png`, spriteAt(23, 11, 11, 10, (R, x, y) => {
      R(x - 11, y - 8, 23, 8, "#b08040"); for (let k = -10; k < 12; k += 3) R(x + k, y - 7, 1, 6, "#8a6030");
      R(x - 10, y - 10, 21, 3, "#7a6aa8"); R(x - 9, y - 10, 19, 1, "#9a8ac8"); R(x - 11, y, 23, 1, "rgba(0,0,0,0.3)");
    }));
    add("home:stones", `${D}stones.png`, spriteAt(23, 20, 11, 19, (R, x, y) => {
      [[-7, 14], [0, 19], [7, 12]].forEach(([dx, h], i) => {
        R(x + dx - 3, y - h, 6, h, "#6a6260"); R(x + dx - 3, y - h, 6, 1, "#8a8280"); R(x + dx + 2, y - h, 1, h, "#4a4240");
        R(x + dx - 1, y - h + 4, 2, 1, i === 1 ? "#ff00ff" : "#3a3230"); R(x + dx, y - h + 5, 1, 3, i === 1 ? "#ff00ff" : "#3a3230");
      });
      R(x - 11, y, 23, 1, "rgba(0,0,0,0.3)");
    }), { keys: { "#ff00ff": "rune" } });
    add("home:stones-glow", `${D}stones-glow.png`, solidOf(8, 10, "#ff00ff"), { keys: { "#ff00ff": "glow" } });
    const widths = [5, 7, 9, 11, 11, 11, 11, 11, 11, 11, 9, 7, 5];
    add("home:carving", `${D}carving.png`, sheet([false, true].map(ready => sprite(11, 13, R => widths.forEach((w, j) => {
      const x0 = (11 - w) / 2;
      R(x0, j, w, 1, j === 0 || j === 12 ? "#24140a" : j < 4 ? "#c8945a" : "#a8784a");
      R(x0, j, 1, 1, ready ? "#ff00ff" : "#24140a"); R(x0 + w - 1, j, 1, 1, ready ? "#ff00ff" : "#24140a");
    })))), { frames: 2, keys: { "#ff00ff": "edge" } });
    add("home:carving-glow", `${D}carving-glow.png`, solidOf(15, 17, "rgb(255,210,90)"));
    add("home:carving-cuts", `${D}carving-cuts.png`, sheet([false, true].map(ready => sprite(12, 10, R => CARVE_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== "x") return;
      R(i, j, 1, 1, ready ? (j < 3 ? "#fff0a0" : "#ffd23f") : "#3a2414");
      if (!ready) R(i + 1, j + 1, 1, 1, "#d8a868");
    }))))), { frames: 2 });
    add("home:firefly", `${D}firefly.png`, sheet(["#fff6a8", "#c8d060"].map(c => solidOf(1, 1, c))), { frames: 2 });
    add("home:lantern", `${D}lantern.png`, sprite(5, 9, R => { R(2, 0, 1, 4, "#3a2a1a"); R(0, 4, 5, 5, "#3a2a1a"); R(1, 5, 3, 3, "#ffd27a"); }));
    [1, 2, 3].forEach(r => add(`home:lantern-glow-${r}`, `${D}lantern-glow-${r}.png`, solidOf(5 + r * 4, 5 + r * 4, "rgb(255,210,120)")));
    return out;
  }
  const W_HOME = () => window.eval("HOME_W");
  /* The old sky's stars, sun and moon (drawHome's own lines), for the check */
  function homeStarsOld(g, isl, t) {
    const R = mr(g), isle = ISLANDS[isl], HW = W_HOME();
    if (isle.n >= 2) for (let i = 0; i < 60; i++) { const tw = Math.sin(t * (1 + mapHash(i, 2, 7) * 3) + i); if (tw > -0.2) R(mapHash(i, 1, 7) * HW, mapHash(i, 3, 7) * 70, 1, 1, tw > 0.7 ? "#fffbe0" : "rgba(255,250,230,0.5)"); }
    if (isle.n === 0) { skyDisc(g, 16, 74, 9, "rgba(255,220,150,0.3)"); skyDisc(g, 16, 74, 6, "#fff0b8"); }
    if (isle.n === 4) { skyDisc(g, HW - 30, 22, 7, "rgba(255,250,220,0.15)"); skyDisc(g, HW - 30, 22, 5, "#fff6d8"); skyDisc(g, HW - 28, 21, 4.4, "rgba(40,30,80,0.9)"); }
  }
  /* The old far islands and clouds with every one put on a whole pixel x (where the new pictures match it) */
  function homeDriftOld(g, isl, t) {
    const isle = ISLANDS[isl];
    for (let i = 0; i < 5; i++) {
      const x = Math.round(((mapHash(i, 5, 3) * 300 + t * (0.6 + i * 0.2)) % 300) - 30), y = 20 + mapHash(i, 6, 3) * 50, w = 8 + mapHash(i, 7, 3) * 12;
      const [r0, g0, b0] = skyAt(isle.y - 150 + y * 1.2);
      g.fillStyle = `rgba(${Math.round(r0 * 0.75)},${Math.round(g0 * 0.78)},${Math.round(b0 * 0.85)},0.7)`;
      g.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 2);
      for (let r = 1; r < w * 0.5; r++) { const ww = Math.max(1, Math.round(w * (1 - r / (w * 0.5)))); g.fillRect(Math.round(x - ww / 2), Math.round(y + 1 + r), ww, 1); }
    }
    for (let i = 0; i < 6; i++) {
      const w = 20 + mapHash(i, 8, 3) * 26, x = Math.round(((mapHash(i, 9, 3) * 320 + t * (1.4 + i * 0.3)) % 320) - 40), y = 10 + i * 13;
      drawCloud(g, x, y, w, "rgba(255,255,255,0.55)");
    }
  }

  /* ----- Coins (coins.js): the old coinCanvas(), its shades of the money color swapped for keys ----- */
  const COIN_KEY_COLORS = { face: "#ff00ff", rim: "#c000c0", rimLit: "#ff40ff", lit: "#ff80ff", dark: "#a000a0", deep: "#600060", glow: "#ff20ff" };
  function coinTemplate(isl, side, size) {
    const c = canvasOf(size, size), g = c.getContext("2d");
    const K = COIN_KEY_COLORS;
    const pal = { k: "#1a1410", rim: K.rim, rimLit: K.rimLit, face: K.face, lit: K.lit, dark: K.dark, deep: K.deep };
    const r = size / 2, cx = r - 0.5, cy = r - 0.5;
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const big = size >= 20;
    const rimW = big ? 2 : 1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r - 0.2) continue;
      const lit = (x - cx) + (y - cy) < 0;
      if (d > r - 1.2) px(x, y, pal.k);
      else if (d > r - 1.2 - rimW) {
        const bead = big && Math.round(Math.atan2(y - cy, x - cx) / (Math.PI / 14)) % 2 === 0;
        px(x, y, bead ? (lit ? pal.lit : pal.face) : lit ? pal.rimLit : pal.rim);
      } else px(x, y, d < r * 0.45 && lit ? K.glow : (x - cx) + (y - cy) > r * 0.9 ? pal.dark : pal.face);
    }
    const art = side === "tails" ? COIN_MARK[isl] : COIN_HEAD[isl];
    const scale = size >= 24 ? (side === "tails" ? 3 : 2) : big && side === "tails" ? 2 : 1;
    const w = art[0].length * scale, h = art.length * scale;
    const ox = Math.round(cx - w / 2 + 0.5), oy = Math.round(cy - h / 2 + 0.5);
    const at = (x, y) => { const row = art[Math.floor(y / scale)]; return row ? row[Math.floor(x / scale)] || "." : "."; };
    const [hat, hatDark] = COIN_HAT[isl];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (ch === ".") continue;
      let col = ch === "x" || ch === "s" ? pal.dark : ch === "e" ? pal.deep : ch === "t" ? "#ff3b5a" : ch === "h" ? hat : ch === "H" ? hatDark : pal.dark;
      if ((ch === "x" || ch === "s") && at(x - 1, y) === "." && at(x, y - 1) === ".") col = pal.lit;
      px(ox + x, oy + y, col);
      if (ch !== "e" && at(x + 1, y + 1) === "." && x + 1 < w + 1) px(ox + x + 1, oy + y + 1, pal.deep);
    }
    if (side === "heads" && scale > 1) { px(ox + 4, oy + 8, "#ffffff"); }
    if (big) { px(Math.round(cx - r * 0.5), Math.round(cy - r * 0.55), "#ffffff"); px(Math.round(cx - r * 0.55) + 1, Math.round(cy - r * 0.55), pal.lit); }
    else px(Math.round(cx - r * 0.45), Math.round(cy - r * 0.45), "#ffffff");
    return c;
  }
  const COIN_SIZES = [12, 20, 32];
  function coinList() {
    const keys = Object.fromEntries(Object.entries(COIN_KEY_COLORS).map(([name, hex]) => [hex, name]));
    const out = [];
    CAMP.islands.forEach(I => ["tails", "heads"].forEach(side => COIN_SIZES.forEach(size =>
      out.push({ id: `coin:${I.id}:${side}:${size}`, file: `coins/${I.id}-${side}-${size}.png`, canvas: coinTemplate(I.id, side, size), keys }))));
    return out;
  }

  /* ----- The menus' frames (ui-frames.js, ui-scroll.js): the old painters, their colors as keys ----- */
  const UI_KEYS = { fill: "#ff00ff", fillLit: "#ff60ff", fillDark: "#a000a0", fillSpeck: "#e000e0", shine: "#00ffff", light: "#00c0c0", body: "#009090", shadow: "#005050", gemDark: "#808000", gemLit: "#ffff60",
    face: "#ff00ff", faceTop: "#ffa0ff", faceHi: "#ff60ff", faceDark: "#a000a0", lip: "#500050" };
  const keysOf = names => Object.fromEntries(names.map(n => [UI_KEYS[n], n]));
  function plateT(B) {
    const N = B * 2 + 5, c = canvasOf(N, N), g = c.getContext("2d"), K = UI_KEYS;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.min(x, y, N - 1 - x, N - 1 - y), lit = x + y < N - 1;
      let col = null;
      if (d === 0) col = FX_K; else if (d === 1) col = lit ? K.light : K.shadow; else if (d === 2) col = FX_K; else if (d === 3) col = lit ? K.fillLit : K.fillDark; else col = K.fill;
      const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
      if (cx + cy < 1) col = null; else if (cx + cy === 1 && cx !== cy) col = FX_K;
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = K.fillSpeck; g.fillRect(B + 2, B + 2, 1, 1);
    const stud = (x, y) => { g.fillStyle = FX_K; g.fillRect(x - 1, y - 1, 4, 4); g.fillStyle = K.body; g.fillRect(x, y, 2, 2); g.fillStyle = K.shine; g.fillRect(x, y, 1, 1); g.fillStyle = K.shadow; g.fillRect(x + 1, y + 1, 1, 1); };
    if (B >= 5) { stud(2, 2); stud(N - 4, 2); stud(2, N - 4); stud(N - 4, N - 4); } else { g.fillStyle = K.shine; g.fillRect(1, 1, 1, 1); }
    return c;
  }
  function windowT() {
    const B = 8, N = B * 2 + 5, c = canvasOf(N, N), g = c.getContext("2d"), K = UI_KEYS;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.min(x, y, N - 1 - x, N - 1 - y), lit = x + y < N - 1;
      let col;
      if (d === 0) col = FX_K; else if (d === 1) col = lit ? K.light : K.shadow; else if (d === 2) col = lit ? K.body : K.shadow; else if (d === 3) col = FX_K;
      else if (d === 4) col = lit ? K.body : K.shadow; else if (d === 5) col = FX_K; else if (d === 6) col = lit ? K.fillLit : K.fillDark; else col = K.fill;
      const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
      if (cx + cy < 2) col = null;
      if (cx + cy === 2 && cx !== cy) col = FX_K;
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
    const gemAt = (x, y) => { g.fillStyle = FX_K; g.fillRect(x - 1, y - 1, 6, 6); g.fillStyle = K.body; g.fillRect(x, y, 4, 4); g.fillStyle = K.gemDark; g.fillRect(x + 1, y + 1, 2, 2); g.fillStyle = K.gemLit; g.fillRect(x + 1, y + 1, 1, 1); g.fillStyle = K.shine; g.fillRect(x, y, 1, 1); };
    gemAt(2, 2); gemAt(N - 6, 2); gemAt(2, N - 6); gemAt(N - 6, N - 6);
    g.fillStyle = K.shine; g.fillRect(B + 2, 2, 1, 1); g.fillRect(2, B + 2, 1, 1);
    return c;
  }
  function buttonT(kind) {
    const W = 9, H = kind === "tab" ? 9 : 11, c = canvasOf(W, H), g = c.getContext("2d"), K = UI_KEYS;
    const y0 = kind === "down" ? 2 : 0, yEnd = kind === "tab" ? H : H - 1;
    for (let y = y0; y < yEnd; y++) for (let x = 0; x < W; x++) {
      const edgeX = x === 0 || x === W - 1, edgeY = y === y0 || y === yEnd - 1;
      if (edgeX && edgeY) continue;
      let col = K.face;
      if (edgeX || y === y0 || (kind !== "tab" && y === yEnd - 1)) col = FX_K;
      else if (kind === "up" && y >= yEnd - 4) col = y === yEnd - 4 ? K.faceDark : K.lip;
      else if (kind === "down") col = y === y0 + 1 ? K.faceDark : x === 1 ? K.faceDark : x === W - 2 ? K.faceHi : K.face;
      else if (y === y0 + 1) col = K.faceTop;
      else if (x === 1) col = K.faceHi;
      else if (x === W - 2) col = K.faceDark;
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return c;
  }
  function cornerOld(flip) {
    const c = canvasOf(12, 12), g = c.getContext("2d");
    const [shine, light, body, shadow] = FX_METALS.brass;
    const px = (x, y, col) => { const X = flip & 1 ? 11 - x : x, Y = flip & 2 ? 11 - y : y; g.fillStyle = col; g.fillRect(X, Y, 1, 1); };
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) { const col = j === 0 || j === 3 ? FX_K : j === 1 ? light : shadow; if (i < 12 - j) { px(i, j, col); px(j, i, col); } }
    px(1, 1, shine); px(2, 1, shine); px(1, 2, shine);
    px(4, 4, FX_K); px(5, 4, FX_K); px(4, 5, FX_K); px(5, 5, FX_K); px(5, 5, body); px(4, 4, shine);
    return c;
  }
  function frameList() {
    const plateKeys = keysOf(["fill", "fillLit", "fillDark", "fillSpeck", "shine", "light", "body", "shadow"]);
    const out = [
      { id: "ui:plate", file: "ui/plate.png", canvas: plateT(5), keys: plateKeys },
      { id: "ui:chip", file: "ui/chip.png", canvas: plateT(3), keys: plateKeys },
      { id: "ui:window", file: "ui/window.png", canvas: windowT(), keys: keysOf(["fill", "fillLit", "fillDark", "shine", "light", "body", "shadow", "gemDark", "gemLit"]) },
      { id: "ui:parchment", file: "ui/parchment.png", canvas: fxParchment() },
      { id: "ui:scroll", file: "ui/scroll.png", canvas: fxScroll() }
    ];
    const btnKeys = keysOf(["face", "faceTop", "faceHi", "faceDark", "lip"]);
    [["up", "button-up"], ["down", "button-down"], ["tab", "tab"]].forEach(([kind, name]) => out.push({ id: "ui:" + name, file: `ui/${name}.png`, canvas: buttonT(kind), keys: btnKeys }));
    ["tl", "tr", "bl", "br"].forEach((k, flip) => out.push({ id: "ui:corner-" + k, file: `ui/board-corner-${k}.png`, canvas: cornerOld(flip) }));
    return out;
  }

  /* ----- The map's islands (map.js paintIsland, map-isles.js): the old painters, layer by layer ----- */
  function mapList() {
    const out = [];
    Object.keys(ISLANDS).forEach(key => {
      const isl = ISLANDS[key], form = isleForm(key);
      const W = form.reach * 2 + 24, H = ISLE_ROOM + form.back + form.front + form.drop + 16;
      const cx = Math.floor(W / 2), cy = ISLE_ROOM + form.back;
      const haze = k => { const [r, gg, bb] = skyAt(isl.y); return "#" + [r, gg, bb].map(v => Math.round(v * k).toString(16).padStart(2, "0")).join(""); };
      const under = canvasOf(W, H), ug = under.getContext("2d");
      const body = paintIsleBody(ug, key, cx, cy, false, haze);
      paintIsleScenery(ug, key, cx, cy, isl, "under");
      // the scenery over the paths, without the signposts and lanterns (they change as you go)
      const over = canvasOf(W, H), ways = window.paintIsleWays;
      window.paintIsleWays = () => {};
      try { paintIsleScenery(over.getContext("2d"), key, cx, cy, isl, "over"); } finally { window.paintIsleWays = ways; }
      const fog = paintIsland(key, true);
      out.push({ id: `map:${key}:under`, file: `map/${key}/under.png`, canvas: under, extra: { tips: body.tips } });
      out.push({ id: `map:${key}:over`, file: `map/${key}/over.png`, canvas: over });
      out.push({ id: `map:${key}:fog`, file: `map/${key}/fog.png`, canvas: fog.c, extra: { tips: fog.tips } });
      // the islets floating near it, each anchored where it sits on its spot
      (ISLE_SHAPE[key].islets || []).forEach((_, k) => {
        const art = isletArt(key, k);
        out.push({ id: `map:${key}:islet-${k + 1}`, file: `map/${key}/islet-${k + 1}.png`, canvas: art.c, anchor: [art.ox, art.oy] });
      });
    });
    return out;
  }

  /* ----- The Tailor's theme emblems (tailor.js): the letter arrays, the theme's colors as keys ----- */
  const EMBLEM_KEYS = { a: ["#ff00ff", "accent"], b: ["#ff40ff", "swirl1"], c: ["#c000c0", "swirl2"], d: ["#800080", "swirl3"] };
  function emblemList() {
    const keys = Object.fromEntries(Object.values(EMBLEM_KEYS).map(([hex, name]) => [hex, name]));
    return Object.entries(EMBLEMS).map(([name, rows]) => {
      const c = canvasOf(Math.max(...rows.map(r => r.length)), rows.length), g = c.getContext("2d");
      const pal = { a: EMBLEM_KEYS.a[0], b: EMBLEM_KEYS.b[0], c: EMBLEM_KEYS.c[0], d: EMBLEM_KEYS.d[0], w: "#ffffff", k: "#120e16" };
      rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
      return { id: "emblem:" + name, file: `emblems/${name}.png`, canvas: c, keys };
    });
  }

  /* ----- The map's stops (map-isles.js drawNodeArt and friends): the old code's still parts ----- */
  const SK = { accent: "#ff00ff", accentDark: "#c000c0", accentLit: "#ff60ff", flag: "#ff00ff", shade: "#a000a0", eye: "#00ffff", coin: "#ffff00", coinLit: "#ffff80", coinDark: "#808000" };
  const skeys = names => Object.fromEntries(names.map(n => [SK[n], n]));
  /* Old code drawn around x, y = 40, 60 on a scratch canvas, cut to what it painted; frames share one box */
  function anchoredSheet(draws, cols = draws.length) {
    const frames = draws.map(d => { const c = canvasOf(80, 80), g = c.getContext("2d"); d(g, mr(g), 40, 60); return c; });
    let x0 = 80, y0 = 80, x1 = -1, y1 = -1;
    frames.forEach(f => { const p = pixels(f); for (let i = 0; i < 6400; i++) if (p[i * 4 + 3]) { const x = i % 80, y = Math.floor(i / 80); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
    if (x0 === 0 || y0 === 0 || x1 === 79 || y1 === 79) throw new Error("a stop doesn't fit its scratch canvas");
    const w = x1 - x0 + 1, h = y1 - y0 + 1, rows = Math.ceil(frames.length / cols), out = canvasOf(w * cols, h * rows), og = out.getContext("2d");
    frames.forEach((f, i) => og.drawImage(f, x0, y0, w, h, (i % cols) * w, Math.floor(i / cols) * h, w, h));
    return { canvas: out, anchor: [40 - x0, 60 - y0], frames: frames.length };
  }
  const ROCK = { keep: "#7a7472", spire: "#5a4a7a", hollow: "#7a5a3a", reef: "#6a7a8a", crown: "#3a2a2e" };
  const GOODS = { gear: ["#c8ced6", "#9aa3ad", "#3a6ab8"], spell: ["#b36bff", "#7fe3ff", "#ff6a1a"], food: ["#d8a050", "#c86a2a", "#ff3b3b"], pet: ["#ffcf5a", "#ff5a3a", "#7ac85a"], rune: ["#3ddc84", "#ffd23f", "#ff3b3b"] };
  function stopList() {
    const out = [];
    const add = (id, file, canvas, extra = {}) => out.push(Object.assign({ id, file, canvas }, extra));
    const A = (id, file, s, keys) => add(id, file, s.canvas, Object.assign({ anchor: s.anchor }, s.frames > 1 ? { frames: s.frames } : {}, keys ? { keys } : {}));
    const D = "map/stops/";
    // the level stone, locked and open (its shadow see-through), and the pennant planted on a won one
    add("map:stone", D + "stone.png", sheet(["locked", "open"].map(st => sprite(7, 3, R => { R(0, 0, 7, 2, st === "locked" ? "#6a6a70" : "#a8a8b0"); R(1, 0, 5, 1, st === "locked" ? "#8a8a90" : "#d0d0d8"); R(0, 2, 7, 1, "rgba(0,0,0,0.25)"); }))), { frames: 2 });
    add("map:pennant-pole", D + "pennant-pole.png", solidOf(1, 8, "#5a3a20"));
    add("map:pennant", D + "pennant.png", solidOf(3, 2, SK.flag), { keys: skeys(["flag"]) });
    add("map:pennant-shade", D + "pennant-shade.png", solidOf(2, 1, SK.shade), { keys: skeys(["shade"]) });
    add("map:stone-glow", D + "stone-glow.png", solidOf(11, 4, "rgb(255,224,120)"));
    // lairs: the rock and its mouth (three sizes, each island's rock), the bones, the last lair's spikes
    CAMP.islands.forEach(I => {
      const key = I.id, rock = ROCK[key];
      [0, 1, 2].forEach(big => {
        const w = 19 + big * 3, h = 13 + big * 2;
        A(`map:${key}:lair-${big}`, `map/${key}/lair-${big}.png`, anchoredSheet([(g, R, x, y) => {
          for (let j = 0; j < h; j++) { const ww = Math.round(w * Math.sqrt(1 - Math.pow(j / h, 2))); R(x - Math.floor(ww / 2), y + 1 - j, ww, 1, j > h * 0.6 ? shadeHex(rock, 0.2) : rock); }
          R(x - Math.floor(w / 2), y + 1, w, 1, shadeHex(rock, -0.35));
          isleRock(g, x - Math.floor(w / 2) + 2, y + 1, 2, shadeHex(rock, 0.1)); isleRock(g, x + Math.floor(w / 2) - 2, y + 1, 2, shadeHex(rock, -0.1));
          R(x - 3, y - 5, 7, 6, "#0e0a0c"); R(x - 2, y - 6, 5, 1, "#0e0a0c");
        }]));
      });
      A(`map:${key}:lair-spikes`, `map/${key}/lair-spikes.png`, anchoredSheet([(g, R, x, y) => { const h = 13 + 2 * 2; for (let k = -1; k <= 1; k++) R(x + k * 4, y - h - 1 - (k ? 0 : 1), 1, 2, shadeHex(rock, -0.3)); }]));
      // the home tree, a row for every tier bought and four moments of its leaves; the satchel against it
      const total = I.tree.upgrades.reduce((a, u) => a + u.values.length - 1, 0);
      const leaves = { keep: ["#2f7d2a", "#3f9a3a", "#5ab046", "#ff3b3b"], spire: ["#3a3a9a", "#5a5ac8", "#8a8af0", "#7fe3ff"], hollow: ["#a8501a", "#d87a2a", "#f0a840", "#ff3b3b"], reef: ["#1a7a6a", "#2a9a8a", "#5acaba", "#ff9ab0"], crown: ["#6a1a1a", "#a82a1a", "#e85a1a", "#ffd23f"] }[key];
      const p = nodeAt(key, "home"), X = Math.round(p.x), Y = Math.round(p.y);
      const draws = [];
      for (let have = 0; have <= total; have++) for (let k = 0; k < 4; k++) draws.push((g, R) => {
        // drawn at the stop's own place on the map (moved onto the scratch canvas whole pixels at a time)
        g.translate(40 - X, 60 - Y);
        const t = (k + 0.5) * (2 * Math.PI / 1.3 / 4), x = p.x, y = p.y, f = total ? have / total : 0;
        const hgt = 8 + Math.round(f * 10);
        R(x - 1, y - hgt, 2 + (f > 0.5 ? 1 : 0), hgt + 1, "#5a3a20"); R(x - 1, y - hgt, 1, hgt + 1, "#7a5232");
        R(x - 3, y, 2, 1, "#5a3a20"); R(x + 2, y, 2, 1, "#5a3a20");
        const r = 4 + f * 6, n = 30 + Math.round(f * 70);
        for (let i = 0; i < n; i++) { const a = mapHash(i, key.length, 71) * Math.PI * 2, dd = Math.sqrt(mapHash(i, key.length, 73)) * r; R(x + Math.cos(a) * dd * 1.3 + Math.sin(t * 1.3 + i) * 0.3, y - hgt + Math.sin(a) * dd * 0.85, 1, 1, leaves[i % 3]); }
        for (let i = 0; i < Math.min(12, have); i++) { const a = i * 2.39, dd = r * (0.4 + 0.5 * mapHash(i, 9, 3)); R(x + Math.cos(a) * dd * 1.2, y - hgt + Math.sin(a) * dd * 0.7, 1, 1, leaves[3]); }
        const sx = x + 3 * ISLANDS[key].dir;
        R(sx - 1, y - 3, 4, 3, "#b07a42"); R(sx - 1, y - 3, 4, 1, "#d09a5a"); R(sx, y - 4, 2, 1, "#5a3a1e"); R(sx + 1, y - 2, 1, 1, "#ffd23f");
      });
      const tree = anchoredSheet(draws, 4);
      add(`map:${key}:home-tree`, `map/${key}/home-tree.png`, tree.canvas, { frames: tree.frames, columns: 4, anchor: tree.anchor });
      // the shopkeepers' places, open and boarded up, in the island's colors
      const fam = I.merchantFamily;
      A(`map:${key}:stall-merchant`, `map/${key}/stall-merchant.png`, anchoredSheet([false, true].map(shut => (g, R, x, y) => {
        R(x - 7, y - 4, 14, 5, "#6a4a2a"); R(x - 7, y - 4, 14, 1, "#9a6a3a");
        R(x - 6, y - 10, 1, 6, "#5a3a1e"); R(x + 5, y - 10, 1, 6, "#5a3a1e");
        for (let i = -8; i <= 7; i++) R(x + i, y - 12, 1, 2, Math.floor((i + 20) / 2) % 2 ? SK.accent : "#f4f0e8");
        for (let i = -8; i <= 7; i += 2) R(x + i, y - 10, 1, 1, Math.floor((i + 20) / 2) % 2 ? SK.accent : "#f4f0e8");
        if (shut) { R(x - 5, y - 9, 10, 5, "#8a6a4a"); for (let j = 0; j < 5; j += 2) R(x - 5, y - 9 + j, 10, 1, "#6a4a2a"); return; }
        (GOODS[fam] || ["#ffd23f", "#ff3b3b", "#3ddc84"]).forEach((c, i) => { R(x - 5 + i * 4, y - 6, 2, 2, c); R(x - 5 + i * 4, y - 6, 1, 1, shadeHex(c, 0.4)); });
      })), skeys(["accent"]));
      A(`map:${key}:stall-challenger`, `map/${key}/stall-challenger.png`, anchoredSheet([false, true].map(shut => (g, R, x, y) => {
        for (let j = 0; j < 12; j++) { const w = 2 + j; R(x - Math.floor(w / 2), y - 12 + j, w, 1, j % 3 === 2 ? SK.accentDark : SK.accent); R(x - Math.floor(w / 2), y - 12 + j, 1, 1, SK.accentLit); }
        for (let j = 0; j < 12; j += 2) R(x - Math.floor((2 + j) / 2) + Math.floor((2 + j) / 2), y - 12 + j, 1, 2, "#f4f0e8");
        R(x - 2, y - 5, 4, 5, shut ? "#3a2a20" : "#1a1410"); if (!shut) R(x - 1, y - 4, 2, 1, "#ffd23f");
        R(x, y - 16, 1, 4, "#5a3a20");
      })), skeys(["accent", "accentDark", "accentLit"]));
      A(`map:${key}:stall-banker`, `map/${key}/stall-banker.png`, anchoredSheet([false, true].map(shut => (g, R, x, y) => {
        const stone = shut ? ["#8a8680", "#6a6660", "#4a4640"] : ["#e8e0d0", "#c8c0b0", "#9a9284"];
        R(x - 8, y - 1, 16, 2, stone[2]); R(x - 7, y - 2, 14, 1, stone[1]);
        for (let i = 0; i < 4; i++) { R(x - 6 + i * 4, y - 9, 2, 7, stone[0]); R(x - 5 + i * 4, y - 9, 1, 7, stone[1]); }
        R(x - 8, y - 11, 16, 2, stone[1]); R(x - 8, y - 11, 16, 1, stone[0]);
        for (let j = 0; j < 4; j++) R(x - 7 + j * 2, y - 12 - j, 14 - j * 4, 1, j % 2 ? stone[1] : stone[0]);
        R(x - 1, y - 7, 2, 5, shut ? "#3a3632" : "#2a2018");
      })));
    });
    // the lair's watching eyes and their red glow, the glow round the next lair, the bones, the banner
    add("map:lair-eyes", D + "lair-eyes.png", sprite(5, 1, R => { R(0, 0, 1, 1, SK.eye); R(4, 0, 1, 1, SK.eye); }), { keys: skeys(["eye"]) });
    add("map:lair-eye-glow", D + "lair-eye-glow.png", solidOf(7, 3, "rgb(255,60,60)"));
    [0, 1, 2].forEach(big => add(`map:lair-glow-${big}`, `${D}lair-glow-${big}.png`, solidOf(19 + big * 3 + 2, 13 + big * 2 + 2, "rgb(255,90,110)")));
    add("map:lair-bones", D + "lair-bones.png", sprite(12, 1, R => { R(0, 0, 2, 1, "#e8e0c8"); R(11, 0, 1, 1, "#e8e0c8"); }));
    add("map:lair-pole", D + "lair-pole.png", solidOf(1, 9, "#5a3a20"));
    add("map:banner-strip", D + "banner-strip.png", sheet([solidOf(1, 3, SK.flag), solidOf(1, 3, "#ffd23f")]), { frames: 2, keys: skeys(["flag"]) });
    add("map:glint", D + "glint.png", solidOf(1, 1, "#ffffff"));
    // the bridge's gate, locked and open, its glow and its torches' flames
    A("map:gate", D + "gate.png", anchoredSheet([false, true].map(open => (g, R, x, y) => {
      R(x - 6, y - 10, 3, 11, "#b8b2a4"); R(x + 4, y - 10, 3, 11, "#8f8a7e"); R(x - 6, y - 10, 1, 11, "#d8d2c4");
      R(x - 5, y - 12, 11, 2, "#b8b2a4"); R(x - 4, y - 13, 9, 1, "#d8d2c4"); R(x - 1, y - 14, 3, 1, "#ffd23f");
      R(x - 3, y - 10, 7, 11, open ? "#ffe9a0" : "#1a1418");
      if (!open) for (let i = 0; i < 4; i++) R(x - 3 + i * 2, y - 10, 1, 11, "#5a5048");
      [-8, 8].forEach(dx => R(x + dx, y - 6, 1, 5, "#5a3a20"));
    })));
    add("map:gate-glow", D + "gate-glow.png", solidOf(11, 13, "rgb(255,240,170)"));
    add("map:torch-flame", D + "torch-flame.png", sheet([true, false].map(fl => sprite(1, 3, R => { R(0, 1, 1, 2, fl ? "#ffd23f" : "#ff8a1a"); R(0, 0, 1, 1, fl ? "#ff6a1a" : "#ffd23f"); }))), { frames: 2 });
    // the tent's pennant (red, white, and its short white tip), the planks over a shut tent, the bank's coin turning
    add("map:tent-flag", D + "tent-flag.png", sheet([["#c0392b", 2], ["#ffffff", 2], ["#ffffff", 1]].map(([c, h]) => sprite(1, 2, R => R(0, 0, 1, h, c)))), { frames: 3 });
    add("map:tent-planks", D + "tent-planks.png", sprite(8, 3, R => { R(0, 1, 8, 1, "#5a3a20"); R(1, 0, 1, 3, "#5a3a20"); R(6, 0, 1, 3, "#5a3a20"); }));
    add("map:bank-coin", D + "bank-coin.png", sheet([1, 2, 3, 4, 5].map(cw => sprite(5, 8, R => {
      R(2, 5, 1, 3, "#5a3a1e");
      R(2 - Math.floor(cw / 2), 0, cw, 5, SK.coin);
      if (cw >= 3) { R(2 - Math.floor(cw / 2), 0, cw, 1, SK.coinLit); R(2, 1, 1, 3, SK.coinDark); }
    }))), { frames: 5, keys: skeys(["coin", "coinLit", "coinDark"]) });
    return out;
  }

  /* ----- The upgrade tree screen (camp-tree.js): its sky and the island under the tree ----- */
  function treeList() {
    return CAMP.islands.map(I => {
      const isl = I.id, c = canvasOf(TREE_W, TREE_H), g = c.getContext("2d");
      g.drawImage(campTreeSky(isl), 0, 0);
      const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
      const iy = 122, iw = 150, cx = 100;
      const [ga, gb, ge] = MAP_BIOME[isl];
      for (let r = 0; r < 34; r++) {
        const half = (iw / 2) * Math.pow(1 - r / 34, 0.8) + (mapHash(r, 5, 9) - 0.5) * 3;
        if (half < 1) break;
        for (let x = -Math.round(half); x <= Math.round(half); x++) R(cx + x, iy + 6 + r, 1, 1, x === Math.round(half) ? "#2e2420" : isleRockColor(isl, x, r, r, 34, 9));
      }
      for (let dy = -7; dy <= 7; dy++) {
        const half = (iw / 2) * Math.sqrt(1 - Math.pow(dy / 7.5, 2));
        for (let x = -Math.round(half); x <= Math.round(half); x++) {
          let col = ((x + dy) & 1) && mapHash(x, dy, 8) > 0.45 ? gb : ga;
          if (dy >= 6) col = ge;
          if (dy === -7) col = shadeHex(ga, 0.2);
          R(cx + x, iy + dy, 1, 1, col);
        }
      }
      return { id: "tree:" + isl, file: `scenes/tree/${isl}.png`, canvas: c };
    });
  }

  /* ----- The keepers' scenes (camp-scenes.js): the old code's still parts, layer by layer ----- */
  function npcList() {
    const out = [];
    const layer = (id, file, draw) => { const c = canvasOf(ART_W, ART_H), g = c.getContext("2d"); g.imageSmoothingEnabled = false; draw(artKit(g, 0), g); out.push({ id, file, canvas: c }); };
    CAMP.islands.forEach(I => {
      const key = I.id, D = `scenes/npc/${key}/`, accent = I.colors.accent;
      layer(`npc:${key}:back`, D + "back.png", (k) => {
        const R = k.R;
        if (key === "keep") {
          k.sky("#8a8a8a", "#6a6662", 4);
          for (let y = 0; y < 48; y += 5) for (let x = (y / 5) % 2 ? -6 : 0; x < ART_W; x += 12) { R(x, y, 11, 4, (x + y) % 3 ? "#9a968e" : "#8e8a82"); R(x, y, 11, 1, "#aaa69e"); }
          R(122, 6, 22, 20, "#5a5650"); R(124, 8, 18, 16, "#9fd4f4"); R(124, 18, 18, 6, "#8ac46a"); R(132, 8, 1, 16, "#5a5650"); R(124, 15, 18, 1, "#5a5650");
          R(14, 4, 12, 22, "#b23a3a"); R(14, 26, 6, 3, "#b23a3a"); R(20, 26, 6, 3, "#8e2b2b"); R(18, 10, 4, 8, "#ffd23f"); R(19, 9, 2, 1, "#ffd23f");
        } else if (key === "spire") k.sky("#1a1650", "#3e2c78", 6);
        else if (key === "hollow") {
          k.sky("#c87a3a", "#e8a85a", 4);
          for (let x = 0; x < ART_W; x += 8) { R(x, 0, 7, 48, (x / 8) % 2 ? "#8a5a30" : "#9a6a3a"); R(x + 7, 0, 1, 48, "#5a3a1e"); }
          R(0, 4, ART_W, 3, "#5a3a1e");
        } else if (key === "reef") k.sky("#1a5a8a", "#0a2a4a", 6);
        else { k.sky("#2a1a1e", "#4a2020", 4); for (let i = 0; i < 6; i++) { const x = i * 30 + 6; R(x, 8, 2, 40, "#1a1216"); } }
      });
      if (key === "spire") layer("npc:spire:shelves", D + "shelves.png", (k) => {
        const R = k.R;
        [[8, 0], [128, 1]].forEach(([x0, s]) => {
          R(x0, 6, 26, 42, "#3a2a1a"); R(x0 + 1, 7, 24, 40, "#2a1a10");
          for (let sh = 0; sh < 4; sh++) {
            R(x0 + 1, 16 + sh * 10, 24, 1, "#5a3a20");
            for (let b = 0; b < 7; b++) R(x0 + 2 + b * 3, 9 + sh * 10, 2, 7 - (b + sh + s) % 3, ["#b36bff", "#3a82e0", "#d1202a", "#3ddc84", "#ffd23f"][(b + sh * 2 + s) % 5]);
          }
        });
      });
      layer(`npc:${key}:merchant`, D + "merchant.png", (k) => {
        const R = k.R;
        for (let x = 0; x < ART_W; x += 8) { R(x, 0, 8, 7, (x / 8) % 2 ? accent : "#f4f0e8"); R(x + 2, 7, 4, 2, (x / 8) % 2 ? accent : "#f4f0e8"); }
        R(0, 9, ART_W, 1, "rgba(0,0,0,0.25)");
      });
      layer(`npc:${key}:merchant-front`, D + "merchant-front.png", (k) => {
        const R = k.R;
        R(0, 44, ART_W, 16, "#6a4a2a"); R(0, 44, ART_W, 2, "#9a6a3a"); R(0, 46, ART_W, 1, "#4a3018");
        for (let i = 0; i < 4; i++) R(10 + i * 40, 48, 30, 10, "#5a3a20");
        CAMP.items.filter(it => it.family === I.merchantFamily).forEach((_, i) => R(84 + i * 15, 43, 12, 1, "rgba(0,0,0,0.3)"));
      });
      layer(`npc:${key}:challenger`, D + "challenger.png", (k, g) => {
        const R = k.R;
        for (let x = 0; x < ART_W; x += 10) { R(x, 0, 5, 48, accent); R(x + 5, 0, 5, 48, "#f4f0e8"); }
        g.globalAlpha = 0.35; R(0, 0, ART_W, 48, "#000"); g.globalAlpha = 1;
        R(0, 2, ART_W, 1, "#5a3a20");
        R(0, 48, ART_W, 12, "#6a5a3a"); R(0, 48, ART_W, 1, "#8a7a5a");
        const tx = 128, ty = 30;
        [[9, "#e8d8a0"], [7, "#c0392b"], [5, "#e8d8a0"], [3, "#c0392b"], [1, "#ffd23f"]].forEach(([r, c]) => { for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); R(tx - w, ty + yy, w * 2 + 1, 1, c); } });
        R(tx - 1, ty + 9, 3, 9, "#5a3a20");
        [20, 152].forEach(x => R(x, 30, 2, 18, "#5a3a20"));
      });
      layer(`npc:${key}:banker`, D + "banker.png", (k) => {
        const R = k.R;
        R(0, 0, ART_W, 48, "rgba(0,0,0,0.25)");
        [[6, 0], [146, 1]].forEach(([x]) => { R(x, 0, 8, 48, "#d8d0c0"); R(x, 0, 2, 48, "#f0e8d8"); R(x + 6, 0, 2, 48, "#a89f8f"); R(x - 1, 0, 10, 3, "#c8c0b0"); });
        const vx = 118, vy = 24;
        for (let yy = -15; yy <= 15; yy++) { const w = Math.round(Math.sqrt(225 - yy * yy)); R(vx - w, vy + yy, w * 2 + 1, 1, yy < -8 ? "#b8b8c0" : "#9a9aa4"); }
        for (let yy = -11; yy <= 11; yy++) { const w = Math.round(Math.sqrt(121 - yy * yy)); R(vx - w, vy + yy, w * 2 + 1, 1, "#7a7a84"); }
      });
      layer(`npc:${key}:banker-front`, D + "banker-front.png", (k) => {
        const R = k.R, vx = 118, vy = 24, c = I.currency.color;
        R(vx - 2, vy - 2, 5, 5, "#ffd23f");
        R(20, 30, 70, 2, "#5a3a20");
        for (let i = 0; i < 8; i++) { const h = 2 + (i * 3) % 7; for (let j = 0; j < h; j++) R(24 + i * 8, 29 - j, 5, 1, j % 2 ? c : shadeHex(c, -0.25)); }
        R(0, 44, ART_W, 16, "#4a3a2a"); R(0, 44, ART_W, 2, "#7a6a4a");
      });
    });
    return out;
  }

  window.LEGACY_SCENES = {
    sets: { rooms: { list: roomList, backdrop: roomBackdrop, times: ROOM_TIMES, rooms: () => Object.keys(PIC_ROOMS) }, shops: { list: shopList }, keepers: { list: keeperList, moments: keeperMoments, roles: KEEPER_ROLES },
      home: { list: homeList, stars: homeStarsOld, drift: homeDriftOld, step: HOME_STEP }, coins: { list: coinList, sizes: COIN_SIZES }, frames: { list: frameList }, map: { list: mapList }, emblems: { list: emblemList }, stops: { list: stopList }, tree: { list: treeList }, npc: { list: npcList } },
    record, split
  };
})();
