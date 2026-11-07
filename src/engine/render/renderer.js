/* =========================================================
   src/engine/render/renderer.js
   Drawing the board each frame
   ========================================================= */
"use strict";

/* =========================================================
   Rendering
   ========================================================= */
const canRound = typeof ctx.roundRect === "function";

function roundedPath(g, x, y, w, h, r) {
  g.beginPath();
  if (canRound) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

function gradient(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([at, c]) => gr.addColorStop(at, c));
  return gr;
}

/* Draws one item. Plain colors by default; Details adds shading, Extras adds shapes and glow. */
function drawItem(g, type, x, y, span, small, alpha = 1, ts = 0, unit = cell) {
  let w = span * unit - 1;
  let ox = x;
  let oy = y;
  if (small) {
    w = Math.max(3, unit / 2 - 1);
    ox = x + (unit - 1 - w) / 2;
    oy = y + (unit - 1 - w) / 2;
  }
  const h = w;
  const base = ITEM_INFO[type].color;
  // Fleas stay brown on every backdrop; their light legs and outline keep them visible
  const color = type === "flea" ? base : visibleColor(base);
  const plain = color !== base || !save.settings.details;   // swapped for visibility = keep it plain
  const extras = save.settings.extras;

  // In its full look (details and extras on, its own color) on the 20-unit board, an item is a picture:
  // item:<type>:<size> in textures/board/items/ (19 a square, 39 two, 9 small), its hard drop shadow baked
  // in; the XP's and the fire's glow are drawn here. Other looks and sizes are drawn below.
  const pic = `item:${type}:${w}`;
  if (unit === 20 && extras && !plain && TextureLoader.has(pic)) {
    g.save();
    g.globalAlpha = alpha;
    if (type === "xp") { g.shadowColor = color; g.shadowBlur = Math.max(4, w * 0.7); }
    if (type === "fire") { g.shadowColor = "#ff8a00"; g.shadowBlur = Math.max(5, w * 0.9); }
    texBoard(g, pic, x, y);
    g.restore();
    return;
  }

  g.save();
  g.globalAlpha = alpha;
  if (save.settings.details) {
    // A hard drop shadow, so items sit on the board like stickers on felt
    g.shadowColor = "rgba(0, 0, 0, 0.38)";
    g.shadowOffsetX = 0;
    g.shadowOffsetY = Math.max(1, unit * 0.13);
    g.shadowBlur = 0;
  }

  if (type === "apple") {
    g.fillStyle = plain ? color : gradient(g, ox, oy, ox + w, oy + h, [[0, "#ff9a9a"], [0.45, color], [1, "#9e1010"]]);
    if (extras) {
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ox + w * 0.4, oy);
      g.lineTo(ox + w * 0.5, oy + h * 0.14);   // little dip where the stem sits
      g.lineTo(ox + w * 0.6, oy);
      g.lineTo(ox + w, oy);
      g.lineTo(ox + w, oy + h);
      g.lineTo(ox, oy + h);
      g.closePath();
      g.fill();
      g.strokeStyle = "#5a3a1a";
      g.lineWidth = Math.max(1, w * 0.1);
      g.beginPath();
      g.moveTo(ox + w * 0.5, oy + h * 0.14);
      g.lineTo(ox + w * 0.57, oy - h * 0.16);
      g.stroke();
      g.fillStyle = "#3ddc3d";
      g.beginPath();
      g.ellipse(ox + w * 0.7, oy - h * 0.08, w * 0.13, h * 0.06, -0.5, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(ox, oy, w, h);
    }
  } else if (type === "xp") {
    g.fillStyle = plain ? color : gradient(g, ox, oy, ox + w, oy + h, [[0, "#fff27a"], [0.5, color], [1, "#5f9e1e"]]);
    if (extras) {
      g.shadowColor = color;
      g.shadowBlur = Math.max(4, w * 0.7);
      g.shadowOffsetY = 0;
    }
    g.fillRect(ox, oy, w, h);
  } else if (type === "rock") {
    g.fillStyle = plain ? color : gradient(g, ox, oy, ox + w, oy + h, [[0, "#ececec"], [0.5, color], [1, "#6c6c6c"]]);
    if (extras) {
      g.beginPath();
      g.moveTo(ox, oy + h * 0.25);
      g.lineTo(ox + w * 0.18, oy + h * 0.08);
      g.lineTo(ox + w * 0.38, oy + h * 0.2);
      g.lineTo(ox + w * 0.6, oy);
      g.lineTo(ox + w * 0.82, oy + h * 0.14);
      g.lineTo(ox + w, oy + h * 0.08);
      g.lineTo(ox + w, oy + h);
      g.lineTo(ox, oy + h);
      g.closePath();
      g.fill();
    } else {
      g.fillRect(ox, oy, w, h);
    }
    if (!plain) {
      g.fillStyle = "rgba(0, 0, 0, 0.22)";
      g.fillRect(ox + w * 0.25, oy + h * 0.55, Math.max(1, w * 0.12), Math.max(1, h * 0.12));
      g.fillRect(ox + w * 0.62, oy + h * 0.4, Math.max(1, w * 0.1), Math.max(1, h * 0.1));
    }
  } else if (type === "popsicle") {
    const fill = plain ? color : gradient(g, ox, oy, ox, oy + h, [[0, "#e3eeff"], [0.35, color], [1, "#1a4fb8"]]);
    if (extras) {
      g.fillStyle = "#d9b27c";                          // the stick pokes into the square below
      g.fillRect(ox + w * 0.42, oy + h * 0.8, w * 0.16, h * 0.42);
      g.fillStyle = fill;
      roundedPath(g, ox, oy, w, h * 0.86, [w * 0.42, w * 0.42, 2, 2]);
      g.fill();
    } else {
      g.fillStyle = fill;
      g.fillRect(ox, oy, w, h);
    }
  } else if (type === "fire") {
    g.fillStyle = plain ? color : gradient(g, ox, oy, ox, oy + h, [[0, "#ff2a1a"], [0.6, "#ff7a1a"], [1, "#ffc233"]]);
    if (extras) {
      g.shadowColor = "#ff8a00";
      g.shadowBlur = Math.max(5, w * 0.9);
      g.shadowOffsetY = 0;
    }
    g.fillRect(ox, oy, w, h);
  } else if (type === "molasses") {
    g.fillStyle = plain ? color : gradient(g, ox, oy, ox + w, oy + h, [[0, "#e0a040"], [0.5, color], [1, "#5a3410"]]);
    if (extras) {
      g.beginPath();
      g.ellipse(ox + w * 0.5, oy + h * 0.56, w * 0.5, h * 0.4, 0, 0, Math.PI * 2);
      g.arc(ox + w * 0.28, oy + h * 0.34, w * 0.22, 0, Math.PI * 2);
      g.arc(ox + w * 0.7, oy + h * 0.38, w * 0.2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(ox, oy, w, h);
    }
    if (!plain) {
      g.fillStyle = "rgba(255, 236, 160, 0.7)";
      g.beginPath();
      g.ellipse(ox + w * 0.34, oy + h * 0.4, w * 0.2, h * 0.1, -0.4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (type === "flea") {
    if (extras) {
      g.strokeStyle = "#d8a86a";
      g.lineWidth = Math.max(1, w * 0.1);
      g.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const ly = oy + h * (0.35 + i * 0.2);
        g.beginPath();
        g.moveTo(ox + w * 0.25, ly); g.lineTo(ox - w * 0.18, ly + h * (0.12 - i * 0.08));
        g.moveTo(ox + w * 0.75, ly); g.lineTo(ox + w * 1.18, ly + h * (0.12 - i * 0.08));
        g.stroke();
      }
      g.beginPath();
      g.moveTo(ox + w * 0.4, oy + h * 0.1); g.lineTo(ox + w * 0.28, oy - h * 0.22);
      g.moveTo(ox + w * 0.6, oy + h * 0.1); g.lineTo(ox + w * 0.72, oy - h * 0.22);
      g.stroke();
    }
    g.fillStyle = plain ? color : gradient(g, ox, oy, ox + w, oy + h, [[0, "#8a5530"], [0.5, color], [1, "#24120a"]]);
    if (extras) {
      g.beginPath();
      g.ellipse(ox + w * 0.5, oy + h * 0.55, w * 0.34, h * 0.45, 0, 0, Math.PI * 2);   // a narrow bug body
      g.fill();
      g.strokeStyle = "rgba(216, 168, 106, 0.9)";
      g.lineWidth = Math.max(1, w * 0.07);
      g.stroke();
    } else {
      g.fillRect(ox, oy, w, h);
      g.strokeStyle = "rgba(216, 168, 106, 0.9)";
      g.lineWidth = Math.max(1, w * 0.08);
      g.strokeRect(ox, oy, w, h);
    }
  }
  g.restore();
}

/* One square of the snake (or of a boss): snake:body in its color (a color-swap picture: its #ff00ff
   becomes the skin's color at that square), then snake:shine over it (the light top, the dark bottom
   and the darker rim that keeps it crisp on busy themes); rounded with Extras on, square with it off
   ("-square"), 19 pixels or 9 on Treasure's half-size squares. Pictures in textures/board/snake/. */
const snakeLook = () => [cell === 10 ? 9 : 19, save.settings.extras ? "" : "-square"];
function drawSnakeCell(x, y, color) {
  const [size, sq] = snakeLook(), k = (cell - 1) / size;
  texBoardPaint(ctx, `snake:body${sq}:${size}`, x, y, k, { colors: { skin: color } });
  if (save.settings.details) texBoard(ctx, `snake:shine${sq}:${size}`, x, y, k);
}

function drawGooglyEyes(ts, hx, hy) {
  if (!snake.cells[0]) return;

  const k = cell / 20;
  const cx = hx + (cell - 1) / 2;
  const cy = hy + (cell - 1) / 2;
  const fx2 = Math.sign(snake.dx);
  const fy2 = Math.sign(snake.dy);
  const px = -fy2;
  const py = fx2;
  const wobble = Math.sin(ts / 90) * 0.7 * k;

  [1, -1].forEach(side => {
    const ex = cx + (px * 4.5 * side + fx2 * 2) * k;
    const ey = cy + (py * 4.5 * side + fy2 * 2) * k;

    ctx.beginPath();
    ctx.arc(ex, ey, 4 * k, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000000";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ex + fx2 * 1.6 * k + px * wobble, ey + fy2 * 1.6 * k + py * wobble, 1.9 * k, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
  });
}

function drawEndlessWalls(cam) {
  const first = Math.floor(cam / cell);
  for (let c = first; c <= first + cellsAcross; c++) {
    const t = endlessWallAt(c) * cell;
    const x = Math.floor(c * cell - cam);   // whole pixels + 1px overlap: no seams between columns
    ctx.fillStyle = "#b8323a";
    ctx.fillRect(x, 0, cell + 1, t);
    ctx.fillRect(x, boardSize - t, cell + 1, t);
    ctx.fillStyle = "#ff5a61";
    ctx.fillRect(x, t - 2, cell + 1, 2);
    ctx.fillRect(x, boardSize - t, cell + 1, 2);
  }
}

/* Walls inside the board: red ones are solid, purple ones are portals */
function drawInnerWalls(camX, camY) {
  walls.forEach((kind, key) => {
    const [wx, wy] = key.split(",").map(Number);
    const x = wx - camX;
    const y = wy - camY;
    if (x < -cell || y < -cell || x > boardSize || y > boardSize) return;
    if (kind === "purple") {
      ctx.save();
      ctx.shadowColor = "#b36bff";
      ctx.shadowBlur = cell * 0.5;
      ctx.fillStyle = "#8f4dff";
      ctx.fillRect(x, y, cell, cell);
      ctx.restore();
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(x + cell * 0.25, y + cell * 0.25, cell * 0.5, cell * 0.5);
    } else {
      ctx.fillStyle = "#b8323a";
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = "#ff5a61";
      ctx.fillRect(x, y, cell, 2);
    }
  });
}

/* Items that time out fade over their last moments; converted apples fade their whole life */
function itemAlpha(it, now) {
  if (!it.expiresAt || it.expiresAt > now + 1e8) return 1;
  if (it.isBonusApple) {
    const t = Math.min(1, Math.max(0, (now - it.spawnAt) / (it.expiresAt - it.spawnAt)));
    return 1 - t * t;
  }
  const left = it.expiresAt - now;
  return left < 1500 ? Math.max(0.2, 0.3 + 0.7 * (left / 1500)) : 1;
}

/* How world positions map onto the screen: fixed boards, the Endless scroller,
   and the Labyrinth, where the camera stays centered on the snake and wraps */
function makeView(ts) {
  const boardActive = gameState === "PLAYING" || gameState === "GAMEOVER";
  const t = gameState === "PLAYING" ? (paused ? pauseStartedAt : ts) : frozenAt;
  const moving = (endless || maze) && gameState === "PLAYING";
  const f = moving ? stepProgress(t) : 1;

  if (boardActive && maze) {
    const p = maze.prev[0] || snake.cells[0] || snake;
    const hx = p.x + wrapDelta(snake.x - p.x) * f;
    const hy = p.y + wrapDelta(snake.y - p.y) * f;
    const c = boardSize / 2 - cell / 2;
    return {
      f,
      toScreen: (x, y) => [c + wrapDelta(x - hx), c + wrapDelta(y - hy)],
      lerp: (pp, cc) => ({ x: pp.x + wrapDelta(cc.x - pp.x) * f, y: pp.y + wrapDelta(cc.y - pp.y) * f }),
      bgX: hx - c,
      bgY: hy - c
    };
  }
  const camX = boardActive && endless ? endless.camera : 0;
  return {
    f,
    toScreen: (x, y) => [x - camX, y],
    lerp: (pp, cc) => ({ x: pp.x + (cc.x - pp.x) * f, y: pp.y + (cc.y - pp.y) * f }),
    bgX: camX,
    bgY: 0
  };
}

function camera() {
  const v = makeView(performance.now());
  return { x: v.bgX, y: v.bgY };
}

function drawMazeWalls(view) {
  const hx = Math.round(snake.x / cell);
  const hy = Math.round(snake.y / cell);
  const T = maze.T;
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const wx = (((hx + dx) % T) + T) % T * cell;
      const wy = (((hy + dy) % T) + T) % T * cell;
      const kind = walls.get(cellKey(wx, wy));
      if (!kind) continue;
      const [x, y] = view.toScreen(wx, wy);
      if (x < -cell || y < -cell || x > boardSize || y > boardSize) continue;
      paintWall(x, y, kind);
    }
  }
}

function paintWall(x, y, kind) {
  if (kind === "purple") {
    ctx.save();
    ctx.shadowColor = "#b36bff";
    ctx.shadowBlur = cell * 0.5;
    ctx.fillStyle = "#8f4dff";
    ctx.fillRect(x, y, cell, cell);
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(x + cell * 0.25, y + cell * 0.25, cell * 0.5, cell * 0.5);
  } else {
    ctx.fillStyle = "#b8323a";
    ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
    ctx.fillStyle = "#ff5a61";
    ctx.fillRect(x, y, cell, 2);
  }
}

function render(ts) {
  const boardActive = gameState === "PLAYING" || gameState === "GAMEOVER";
  const view = makeView(ts);

  if (!boardActive && document.body.classList.contains("title-world")) {
    // the title screen: the board is a window onto the world behind it (src/art/title-scene.js)
    ctx.clearRect(0, 0, boardSize, viewH);
  } else if (view.bgX || view.bgY) {
    // The backdrop glides with the camera
    const offX = ((view.bgX % boardSize) + boardSize) % boardSize;
    const offY = ((view.bgY % boardSize) + boardSize) % boardSize;
    for (const dx of [0, boardSize]) {
      for (const dy of [0, boardSize]) ctx.drawImage(bgCanvas, dx - offX, dy - offY, boardSize, boardSize);
    }
  } else {
    for (let y = 0; y < viewH; y += boardSize) ctx.drawImage(bgCanvas, 0, y, boardSize, boardSize);
  }

  if (!boardActive) {
    if (currentScreen === "main" && save.settings.menuDemo) drawDemo(ts);
    return;
  }

  const now = gameState === "PLAYING" ? (paused ? pauseStartedAt : ts) : frozenAt;

  if (save.dev.grid) {
    const [ox, oy] = view.toScreen(0, 0);
    const sx = ((ox % cell) + cell) % cell;
    const sy = ((oy % cell) + cell) % cell;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = sx; x <= boardSize; x += cell) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, boardSize); }
    for (let y = sy; y <= boardSize; y += cell) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(boardSize, Math.round(y) + 0.5); }
    ctx.stroke();
  }
  if (endless) drawEndlessWalls(view.bgX);
  if (edgeMode === "tutorial") {
    const w = 4;
    ctx.fillStyle = "#9b5cff";
    ctx.fillRect(0, 0, boardSize, w);
    ctx.fillRect(0, boardSize - w, boardSize, w);
    ctx.fillRect(0, 0, w, boardSize);
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(boardSize - w, 0, w, boardSize);
  }
  if (maze) drawMazeWalls(view);
  else walls.forEach((kind, key) => {
    const [wx, wy] = key.split(",").map(Number);
    const [x, y] = view.toScreen(wx, wy);
    paintWall(x, y, kind);
  });
  drawGamePanels(view);

  const onScreen = (x, y, span) => x > -span && y > -span && x < boardSize && y < boardSize;
  const draw = (type, it) => {
    const span = (it.size || 1) * cell;
    const [x, y] = view.toScreen(it.x, it.y);
    if (onScreen(x, y, span)) drawItem(ctx, type, x, y, it.size || 1, it.small, itemAlpha(it, now), now);
  };
  rocks.forEach(r => draw("rock", r));
  apples.forEach(a => {
    draw("apple", a);
    if (a.rotten) {
      const [x, y] = view.toScreen(a.x, a.y);
      const s = (a.size || 1) * cell - 1;
      ctx.fillStyle = "rgba(70, 50, 20, 0.72)";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#9acd32";
      ctx.fillRect(x + s * 0.6, y + s * 0.55, Math.max(1, s * 0.15), Math.max(1, s * 0.15));
    }
    if (a.fake && a.dull) {
      const [x, y] = view.toScreen(a.x, a.y);
      ctx.fillStyle = "rgba(150, 150, 150, 0.6)";
      ctx.fillRect(x, y, 2 * cell - 1, 2 * cell - 1);
    }
  });
  orbs.forEach(o => draw("xp", o));
  popsicles.forEach(p => {
    if (itemAlpha(p, now) > 0) draw(p.isBonusApple ? "apple" : "popsicle", p);
  });
  relicItems.forEach(r => {
    const [x, y] = view.toScreen(r.x, r.y);
    if (onScreen(x, y, cell)) drawRelic(ctx, x, y, now, cell);
  });
  shimmers.forEach(sh => {
    const [x, y] = view.toScreen(sh.x, sh.y);
    if (onScreen(x, y, cell)) drawShimmer(ctx, x, y, now, sh);
  });
  hazards.forEach(h => {
    if (h.type === "flea" && h.hopAt && now - h.hopAt < FLEA_HOP_ANIM) {
      const t = (now - h.hopAt) / FLEA_HOP_ANIM;
      const dx = maze ? wrapDelta(h.x - h.fromX) : h.x - h.fromX;
      const dy = maze ? wrapDelta(h.y - h.fromY) : h.y - h.fromY;
      const [x, y] = view.toScreen(h.fromX + dx * t, h.fromY + dy * t);
      drawItem(ctx, "flea", x, y - Math.sin(t * Math.PI) * cell * 0.45, h.size || 1, h.small, itemAlpha(h, now), now);
    } else {
      draw(h.type, h);
    }
  });

  // build 46: hazards and power-ups, shed skins, Echoes and the Hunter
  drawEntities(view, now);
  drawHusks(view, now);
  drawEcho(view, now);
  drawHunter(view, now);

  // In Endless and the Labyrinth each segment glides from where it was to where it is
  const skin = currentSkin();
  const prev = endless ? endless.prev : maze ? maze.prev : null;
  let [headX, headY] = view.toScreen(snake.x, snake.y);   // before the first move there are no segments yet
  const segs = [];
  for (let i = snake.cells.length - 1; i >= 0; i--) {
    const c = snake.cells[i];
    let pos = c;
    if (prev) pos = view.lerp(prev[i] || prev[prev.length - 1] || c, c);
    const [x, y] = view.toScreen(pos.x, pos.y);
    if (i === 0) { headX = x; headY = y; }
    segs[i] = { x, y };
  }
  if (save.settings.details && segs.length) {
    // One shadow under the whole body (snake:shadow), drawn first so segments never shade each other
    const [size, sq] = snakeLook(), k = (cell - 1) / size;
    segs.forEach(sg => { if (onScreen(sg.x, sg.y, cell)) texBoard(ctx, `snake:shadow${sq}:${size}`, sg.x, sg.y, k); });
  }
  const ghostly = gameState === "PLAYING" && phantomOn(now);
  if (ghostly) { ctx.save(); ctx.globalAlpha = 0.5 + 0.15 * Math.sin(now / 90); }
  for (let i = segs.length - 1; i >= 0; i--) {
    if (onScreen(segs[i].x, segs[i].y, cell)) drawSnakeCell(segs[i].x, segs[i].y, skinVisibleColor(skin, skinColorAt(skin, i, now)));
  }
  if (ghostly) ctx.restore();
  if (!segs.length) segs.push({ x: headX, y: headY });

  // Golden glow while a revive's grace period protects you
  if (gameState === "PLAYING" && now < graceUntil && Math.floor(now / 150) % 2) {
    ctx.strokeStyle = "rgba(255, 210, 63, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(headX - 1, headY - 1, cell + 1, cell + 1);
  }
  drawFlairSet(ctx, save.flair, segs, cell, 1, ts);
  if (gameState === "PLAYING") drawBuffAura(headX, headY, now);

  // Blackout: only a circle around the head is lit
  if (nm.dark) {
    const cx = headX + cell / 2;
    const cy = headY + cell / 2;
    const r = (3.5 + getTrackValue("nightlight")) * cell;
    const gr = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    gr.addColorStop(0, "rgba(0, 0, 0, 0)");
    gr.addColorStop(1, "rgba(0, 0, 0, 0.96)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, boardSize, boardSize);
  }

  // Fever warms the whole board
  if (gameState === "PLAYING" && feverOn(now)) {
    ctx.fillStyle = `rgba(255, 120, 20, ${0.07 + 0.04 * Math.sin(now / 110)})`;
    ctx.fillRect(0, 0, boardSize, viewH);
  }
  drawMechanicsHud(now);
}

/* The board is always one square, sized to the window by layoutStage().
   Menus that need more room scroll inside their own overlay. */
let fitFrames = 0;
function fitStage(force = false) {
  if (force || viewH !== boardSize) {
    sizeCanvas(boardSize);
    render(performance.now());
  }
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (++fitFrames % 8 === 0) fitStage();
  tickLiveStats(ts);

  if (gameState === "PLAYING" && paused) {
    lastFrameTs = ts;
    render(ts);
    return;
  }

  if (gameState === "PLAYING") {
    const delta = Math.max(0, Math.min(ts - lastFrameTs, 250));
    lastFrameTs = ts;
    survivalAccumulator += delta;
    save.stats.timePlayedMs += delta;

    if (endless) {
      updateEndless(ts, delta);
      if (gameState !== "PLAYING") {
        render(ts);
        return;
      }
    }

    const alive = it => !it.expiresAt || ts < it.expiresAt;
    popsicles = popsicles.filter(alive);
    hazards = hazards.filter(alive);
    orbs = orbs.filter(alive);

    tickSpawns(delta);
    if (!frozenNow(ts)) hopFleas(ts);
    tickMechanics(ts, delta);
    if (gameState !== "PLAYING") { render(ts); return; }
    tickShimmers(ts, delta);
    tickRelic(ts);
    tickChatter(ts, delta);

    runMs += delta;
    orbAccumulator += delta;
    while (orbAccumulator >= ORB_ROLL_MS) {
      orbAccumulator -= ORB_ROLL_MS;
      const minutes = runMs / 60000;
      const chance = modes[currentModeKey].orbChance *
        (1 + getTrackValue("magnet") / 100) *
        (1 + (getTrackValue("bloomer") / 100) * minutes) *
        (runBoosts.magnet ? 2 : 1) *
        (1 + (inMode("easy", "breezy") + inMode("labyrinth", "runner") + worldOrbBonus()) / 100);
      if (Math.random() < chance) spawnOrb();
    }

    allowanceAccumulator += delta;
    while (allowanceAccumulator >= 60000) {
      allowanceAccumulator -= 60000;
      // Allowance is a share of a good run on this island, so it's worth the same everywhere
      const gift = Math.round(getTrackValue("allowance") / 100 * xpUnit() * LADDER.runXp);
      const got = gift > 0 ? grantXp(gift) : 0;
      if (got) {
        showToast(`Allowance: +${fmtInt(got)} XP for surviving another minute`);
        updateHud();
      }
    }

    // Passive scoring is time-based, not frame-based
    while (survivalAccumulator >= 1000 && gameState === "PLAYING") {
      let points = 10 * scoreMultiplier * getTrackValue("time");
      if (endless) points *= getTrackValue("mileage");
      if (maze) points *= getTrackValue("trail");
      points *= inMode("easy", "sunny", 1) * inMode("insane", "insanity", 1);
      if (currentModeKey === "classic") points *= 1 + (getTrackValue("longtail") / 100) * Math.floor(snake.maxCells / 10);
      points *= worldTrunkPassive();
      addScore(points);
      if (echoAfterimage()) addScore(echoAfterimage() * scoreMultiplier);
      survivalAccumulator -= 1000;
      checkBadges();
    }

    tickNightmare(delta);
    if (maze) {
      // Keep the Labyrinth's items near you; far ones drift away and new ones appear nearby
      const near = it => mazeDistance(it) <= 16;
      apples = apples.filter(near);
      orbs = orbs.filter(o => o.placed || near(o));
      popsicles = popsicles.filter(near);
      hazards = hazards.filter(near);
      entities = entities.filter(e => ENTITY_TYPES[e.type].global || ENTITY_TYPES[e.type].placed || near(e));
      maintainApples();
    }
    if (gameState === "PLAYING") checkIntros(makeView(ts));

    if (gameState === "PLAYING" && !paused) {
      if (ts < fx.pauseUntil) lastMoveTs = ts;               // stuck in molasses
      else {
        // Moves run on real time, not frames: a late frame catches up on the moves it owes,
        // so the snake is exactly as fast on a slow phone as on a fast PC
        const iv = currentInterval(ts);
        let moves = 0;
        while (gameState === "PLAYING" && !paused && ts - lastMoveTs >= iv && moves < 4) {
          lastMoveTs += iv;
          stepSnake(ts);
          moves++;
        }
        if (ts - lastMoveTs > iv * 2) lastMoveTs = ts - iv;   // after a big hitch, don't burst ahead
      }
    }
  }

  render(ts);
}
