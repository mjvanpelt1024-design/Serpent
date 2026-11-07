/* =========================================================
   src/art/flair-drawing.js
   Drawing Flair on the snake
   ========================================================= */
"use strict";

/* =========================================================
   Flair is pictures: flair:<id> in textures/board/flair/, 20 pixels to a square, each anchored on the
   top left corner of the square it sits on: the head for hats, faces and the bow tie, the neck for the
   scarf and a badge's medal, each body square for a pattern, the tail's last two squares. Their frames:
   a face, the scarf and the bow tie turned each way the head can face (right, down, left, up); the
   googly eyes' pupils at three places for each; the rattle's rings across a tail going sideways, then
   up or down; the maraca by which way the tip points; the bow
   and the flame by which way the head faces (across, or up and down) and the tip points, the flame at
   five flickers; the propeller at eight turns; a cape's square, then its wider last square; the zigzag
   on odd squares, then even ones. The ancient pattern is painted with its pulse, a medal's disc in its
   family's color, the halo glows and the gear's hole is cut through to the page; the gold tail is a
   gradient, drawn here.
   ========================================================= */
const flairDir = d => d.x > 0 ? 0 : d.y > 0 ? 1 : d.x < 0 ? 2 : 3;
function drawFlairSet(g, set, segs, c, alpha = 1, ts = 0) {
  if (!segs.length || !set) return;
  const k = c / 20;
  const dirOf = (a, b) => {
    const dx = segs[a].x - segs[b].x;
    const dy = segs[a].y - segs[b].y;
    if (Math.abs(dx) > c * 2 || Math.abs(dy) > c * 2) return null;   // wrapped: ignore
    return { x: Math.sign(dx), y: Math.sign(dy) };
  };
  const f = (segs.length > 1 && dirOf(0, 1)) || (gameState === "PLAYING" || gameState === "GAMEOVER"
    ? { x: Math.sign(snake.dx), y: Math.sign(snake.dy) } : { x: 1, y: 0 });
  const n = segs.length;
  const has = id => TextureLoader.has("flair:" + id);
  const put = (id, i, frame = 0, dy = 0) => { if (has(id)) texBoard(g, "flair:" + id, segs[i].x, segs[i].y + dy, k, frame); };
  const paint = (id, i, opts) => { if (has(id)) texBoardPaint(g, "flair:" + id, segs[i].x, segs[i].y, k, opts); };
  g.save();
  g.globalAlpha = alpha;

  // Body pattern (under everything else): on every body square, or every other one
  const body = set.body;
  if (body) {
    for (let i = 1; i < n; i++) {
      if ((body === "hearts" || body === "stars" || body === "gears") && !(i % 2)) continue;
      if (body === "ancient") {
        const sh = 0.55 + 0.45 * Math.sin(ts / 400 + i * 0.6);
        paint("ancient", i, { alpha: 0.35 + sh * 0.35 });
        put("ancient-edge", i);
      } else if (body === "gears") {
        // its hole goes right through, to whatever is behind the board
        put("gears", i);
        g.save();
        g.globalCompositeOperation = "destination-out";
        put("gears-hole", i);
        g.restore();
      } else put(body, i, body === "zigzag" && !(i % 2) ? 1 : 0);
    }
  }

  // Tail: the last two squares
  const tail = set.tail;
  if (tail && n >= 3) {
    const tip = n - 1;
    const t = dirOf(tip, tip - 1) || { x: -f.x, y: -f.y };
    for (const i of [tip - 1, tip]) {
      if (tail === "rattle") put("rattle", i, t.x ? 0 : 1);
      else if (tail === "candycane" || tail === "brasstail") put(tail, i);
      else if (tail === "goldtail") {
        // a gradient, its shine sliding along: drawn here
        const s = segs[i], gr = g.createLinearGradient(s.x, s.y, s.x + c, s.y + c), sh = (Math.sin(ts / 300 + i) + 1) / 2;
        gr.addColorStop(0, "#fff2a8");
        gr.addColorStop(sh * 0.8 + 0.1, "#ffd23f");
        gr.addColorStop(1, "#b8860b");
        g.fillStyle = gr;
        g.fillRect(s.x, s.y, c - 1, c - 1);
      }
      else if (i === tip && tail === "maraca") put("maraca", i, flairDir(t));
      else if (i === tip && tail === "bow") put("bow", i, (flairDir(f) % 2) * 4 + flairDir(t));
      else if (i === tip && tail === "flametail") put("flametail", i, (flairDir(f) % 2) * 20 + flairDir(t) * 5 + Math.round((Math.sin(ts / 70) + 1) * 2));
    }
  }

  // Clothes: capes over squares 2-4, bow tie and scarf at the neck, or a medal
  const cape = set.cape;
  if (cape && n >= 2) {
    const upto = Math.min(n - 1, 3);
    if (cape === "redcape" || cape === "herocape" || cape === "royalcape") {
      for (let i = 1; i <= upto; i++) put(cape, i, i === upto ? 1 : 0);
      if (cape === "herocape" && upto >= 2) put("herocape-emblem", 2);
    } else if (cape === "scarf") put("scarf", 1, flairDir(f));
    else if (cape === "bowtie") put("bowtie", 0, flairDir(f));
    else if (cape.startsWith("medal:")) {
      const fam = BADGE_FAMILIES.find(x => x.id === cape.slice(6));
      put("medal-ribbon", 1);
      paint("medal", 1, { colors: { medal: fam ? medalColor(fam) : "#ffd23f" } });
      put("medal-shine", 1);
    }
  }

  // Face items sit where the eyes are
  const face = set.face;
  if (face === "googly") put("googly", 0, flairDir(f) * 3 + Math.round(Math.sin(ts / 90)) + 1);
  else if (face) put(face, 0, flairDir(f));

  // Hats sit upright on top of the head
  const hat = set.head;
  if (hat === "propeller") {
    const turn = ((ts / 60) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    put("propeller", 0, Math.round(turn / (Math.PI * 2) * 8) % 8);
  } else if (hat === "halo") {
    g.shadowColor = "#ffe066";
    g.shadowBlur = 6 * k;
    put("halo", 0, 0, Math.sin(ts / 400) * 1.5 * k);
    g.shadowBlur = 0;
  } else if (hat) put(hat, 0);
  g.restore();
}
