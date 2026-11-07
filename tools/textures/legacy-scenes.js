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

  window.LEGACY_SCENES = {
    sets: { rooms: { list: roomList, backdrop: roomBackdrop, times: ROOM_TIMES, rooms: () => Object.keys(PIC_ROOMS) }, shops: { list: shopList }, keepers: { list: keeperList, moments: keeperMoments, roles: KEEPER_ROLES } },
    record, split
  };
})();
