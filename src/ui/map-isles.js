/* =========================================================
   src/ui/map-isles.js
   What grows on the five islands: their ground, rock and scenery,
   the little pictures at every stop, the shopkeepers, and the living
   details (flags, waterfalls, sails, beams, smoke).

   Painted the way the rest of the map is (src/ui/map.js): one map
   pixel at a time, flat colors lit from the top left, no outlines.
   Positions are written along the island's flow: P(f, dy), where f
   runs from the home end (negative) to the far end, so the same
   layout works on islands that run left and islands that run right.
   ========================================================= */
"use strict";

/* The bridge's pin: a stone arch with the Coil's light inside */
SPRITES.gate = ["...kkkkkk...", "..kWssssSk..", ".kWskkkkSSk.", ".ksk.yy.kSk.", "kssky..ykSSk", "kssk.yy.kSSk", "kssk.yy.kSSk", "kssk.yy.kSSk", "kssk....kSSk", "kssk....kSSk", "kkkk....kkkk", "nnnnnnnnnnnn"];

const ISLE_THEME = {
  keep: {
    rock: [["#7a5232", "#6c482b"], ["#5e4a3a", "#4e4038"], ["#57545c", "#4c4a50"]],
    dirt: ["#c8b07a", "#a08a5a", "#e8d8a8"],
    hang: ["#3e2a1a", "#5aab45"]
  },
  spire: {
    rock: [["#7a6a8a", "#6e5e80"], ["#5e5478", "#54486e"], ["#4a4462", "#403a58"]],
    dirt: ["#9a9ad8", "#6a6aa8", "#d8d8ff"],
    hang: ["#7fe3ff", "#b36bff"]
  },
  hollow: {
    rock: [["#8a5a2a", "#7a4e24"], ["#6a4a30", "#5c4028"], ["#4e4440", "#443c38"]],
    dirt: ["#d8b070", "#a8803e", "#f0d8a0"],
    hang: ["#5a3a1a", "#c8a040"]
  },
  reef: {
    rock: [["#e0c890", "#d4b880"], ["#c88a7a", "#b87a6a"], ["#8a6a7a", "#7a5e6e"]],
    dirt: ["#a8784a", "#6a4a2a", "#c8986a"],
    hang: ["#3a8a5a", "#ff8a9a"]
  },
  crown: {
    rock: [["#3a2a2a", "#322424"], ["#2a2028", "#241c22"], ["#1e1a20", "#18141a"]],
    dirt: ["#6a5050", "#4a3434", "#9a7a6a"],
    hang: ["#1a1418", "#ff6a1a"]
  }
};
const isleDirt = key => ISLE_THEME[key].dirt;

/* ----- The rock under each island ----- */
function isleRockColor(key, x, r, band, depth, seed) {
  const T = ISLE_THEME[key].rock;
  const layer = band < depth * 0.26 ? 0 : band < depth * 0.62 ? 1 : 2;
  const [c0, c1] = T[layer];
  let col = ((x + r) & 1) && mapHash(x, r, seed + layer) > 0.5 ? c1 : c0;
  // a darker seam where two layers meet
  if (Math.abs(band - depth * 0.26) < 0.7 || Math.abs(band - depth * 0.62) < 0.7) col = shadeHex(c1, -0.18);
  const h = mapHash(x, r, seed + 17);
  if (key === "spire" && layer > 0 && h > 0.994 && mapNoise(x, r, 7, seed) > 0.55) col = h > 0.997 ? "#d8b0ff" : "#7fe3ff";   // crystal veins
  if (key === "crown" && mapNoise(x, r, 6, seed + 3) > 0.8 && Math.abs(mapNoise(x, r * 1.6, 4, seed + 9) - 0.5) < 0.03) col = r > depth * 0.5 ? "#ff7a1a" : "#c8401a";   // lava cracks
  if (key === "reef" && layer === 1 && h > 0.982) col = "#fff0e0";                               // shells in the sandstone
  if (key === "hollow" && layer === 0 && h > 0.975) col = "#c8a040";                             // buried roots, catching light
  if (key === "keep" && layer === 1 && h > 0.988) col = "#a8a4b0";                               // a glint of flint
  return col;
}

/* Roots, crystals, kelp or lava drips hanging under the rock */
function isleHanging(g, key, x, y0, len, k) {
  const [a, b] = ISLE_THEME[key].hang;
  for (let r = 0; r < len; r++) {
    let col = a;
    if (key === "spire") { col = r < len - 2 ? "#4e4060" : (k % 2 ? a : b); if (r >= len - 3) mapRect(g, x, y0 + r, 1, 1, col); else mapRect(g, x, y0 + r, r < 2 ? 2 : 1, 1, col); continue; }
    if (key === "crown") { col = r === len - 1 ? b : a; mapRect(g, x, y0 + r, r < len / 2 ? 2 : 1, 1, col); continue; }
    if (key === "reef") col = r % 3 === 1 ? shadeHex(a, 0.2) : a;
    if (r === len - 1) col = b;
    mapRect(g, x + (r > 2 && (k % 2) ? 1 : 0) + (key === "reef" ? Math.round(Math.sin(r * 0.9 + k) * 0.6) : 0), y0 + r, 1, 1, col);
  }
}

/* ----- The ground: patches of meadow, sand, wheat or cooling ash ----- */
function isleGroundColor(key, x, dy, col, isl) {
  const n = mapNoise(x + 200, dy + 200, 14, isl.n + 3);
  const h = mapHash(x, dy, isl.n + 61);
  if (key === "keep") {
    if (n > 0.66) return ((x + dy) & 1) ? "#79b85a" : "#6aa84f";
    if (n < 0.28) return ((x + dy) & 1) ? "#5a9a44" : "#61a049";
    if (h > 0.992) return ["#ff6b6b", "#ffe066", "#ffffff", "#ff9ad5"][Math.floor(h * 1000) % 4];
  } else if (key === "spire") {
    if (n > 0.66) return ((x + dy) & 1) ? "#7470c4" : "#6c68bc";
    if (n < 0.3) return ((x + dy) & 1) ? "#3e6a9a" : "#447096";
    if (n < 0.38) return ((x + dy) & 1) ? "#4a5ea4" : "#5060a8";
    if (h > 0.99) return h > 0.996 ? "#bff4ff" : "#d8b0ff";
  } else if (key === "hollow") {
    if (n > 0.62) return ((x + dy) & 1) ? "#c8b050" : "#d0b858";
    if (n < 0.3) return ((x + dy) & 1) ? "#8a8a34" : "#94903a";
    if (h > 0.986) return h > 0.994 ? "#ff8c1a" : "#c8402a";
  } else if (key === "reef") {
    // sand toward the front, sea grass toward the back
    const sand = dy / isl.th + (n - 0.5) * 1.1 > -0.15;
    if (sand) return ((x + dy) & 1) && h > 0.4 ? "#e8d8a0" : "#f0e2ae";
    if (h > 0.985) return "#ff9aa8";
  } else if (key === "crown") {
    if (n > 0.64) return ((x + dy) & 1) ? "#5a3434" : "#543030";
    if (n < 0.3) return ((x + dy) & 1) ? "#3a2a2e" : "#42302f";
    if (mapNoise(x + 50, dy, 11, isl.n + 8) > 0.6 && Math.abs(mapNoise(x, dy * 2, 9, isl.n + 5) - 0.5) < 0.022) return "#ff6a1a";
    if (h > 0.99) return "#ffb020";
  }
  return col;
}

/* ----- Small things to put on the ground ----- */
function isleTree(g, x, y, canopy, dark, fruit, h = 4) {
  mapRect(g, x, y - h + 2, 1, h, "#5a3a22");
  mapRect(g, x - 3, y - h - 2, 7, 3, canopy);
  mapRect(g, x - 2, y - h - 3, 5, 1, canopy);
  mapRect(g, x - 2, y - h + 1, 5, 1, dark);
  mapRect(g, x - 2, y - h - 2, 2, 1, shadeHex(canopy, 0.25));
  if (fruit) { mapRect(g, x - 1, y - h - 1, 1, 1, fruit); mapRect(g, x + 2, y - h, 1, 1, fruit); }
}
function islePine(g, x, y, c, h = 8) {
  mapRect(g, x, y - 1, 1, 2, "#4a3020");
  for (let j = 0; j < h; j++) {
    const w = 1 + Math.floor((j % 3 === 0 ? j - 1 : j) / 2) * 2;
    mapRect(g, x - Math.floor(w / 2), y - h + j - 1, w, 1, j % 3 === 0 ? shadeHex(c, 0.15) : c);
  }
}
function isleRock(g, x, y, s, c = "#9a9a9a") {
  mapRect(g, x - s, y - s + 1, s * 2 + 1, s, shadeHex(c, -0.3));
  mapRect(g, x - s + 1, y - s, s * 2 - 1, s, c);
  mapRect(g, x - s + 1, y - s, 1, 1, shadeHex(c, 0.35));
}
function isleTuft(g, x, y, c) { mapRect(g, x, y - 1, 1, 1, c); mapRect(g, x - 1, y, 1, 1, c); mapRect(g, x + 1, y, 1, 1, c); }
function isleHouse(g, x, y, w, h, wall, roof, door = "#4a3020") {
  mapRect(g, x, y - h, w, h, wall);
  mapRect(g, x + w - 1, y - h, 1, h, shadeHex(wall, -0.25));
  for (let j = 0; j < Math.ceil(w / 2) + 1; j++) mapRect(g, x - 1 + j, y - h - 1 - j, w + 2 - j * 2, 1, j ? roof : shadeHex(roof, -0.25));
  mapRect(g, x + Math.floor(w / 2), y - 3, 1, 3, door);
  if (w >= 6) mapRect(g, x + 1, y - h + 2, 1, 1, "#ffe08a");
}

/* An island's flow coordinates on its own canvas */
function isleAt(key, cx, cy) {
  const d = ISLANDS[key].dir;
  return (f, dy) => [Math.round(cx + d * f), Math.round(cy + dy)];
}

/* ----- The scenery: "under" goes beneath the paths, "over" sits on top of them ----- */
function paintIsleScenery(g, key, cx, cy, isl, pass) {
  const P = isleAt(key, cx, cy);
  const d = isl.dir;
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  const rnd = seededRandom(isl.n * 97 + (pass === "over" ? 5 : 1));
  // a few spots in the gaps between the rows, away from every stop
  const free = (f, dy) => NODE_ORDER.every(id => { const [nf, ndy] = NODE_SPOTS[id]; return Math.abs(nf - f) > 9 || Math.abs(ndy - dy) > 7; }) && Math.abs(f) < isleHalf(isl, dy) - 6;
  const scatter = (n, rows, fn) => {
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const f = (rnd() - 0.5) * isl.w * 0.92, dy = rows[Math.floor(rnd() * rows.length)] + Math.round((rnd() - 0.5) * 3);
      if (!free(f, dy)) continue;
      fn(...P(f, dy), i++);
    }
  };
  if (pass === "under") {
    if (key === "keep") {
      // a pond at the front, spilling off the edge (the falls are drawn live)
      const [px, py] = P(-40, 27);
      for (let j = -2; j <= 2; j++) { const w = 13 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#5a9ad8" : "#3f7fbf"); }
      R(px - 4, py - 2, 3, 1, "#bfe0ff");
      // wheat by the farm, hives by the gate
      for (let i = 0; i < 4; i++) { const [x, y] = P(-108 + i * 7, 7); for (let k = 0; k < 5; k++) R(x + k, y - (k % 2), 1, 2, k % 2 ? "#e0c060" : "#c8a040"); }
      // the jousting lists: a long fence
      { const [x0, y0] = P(-10, -13); const [x1] = P(60, -13); const a = Math.min(x0, x1), b = Math.max(x0, x1); for (let x = a; x <= b; x++) { R(x, y0, 1, 1, "#8a5a30"); if ((x - a) % 4 === 0) R(x, y0 - 2, 1, 3, "#5a3a20"); } }
    } else if (key === "spire") {
      // arcane circles, glowing faintly in the grass
      [[-100, 7], [20, -13], [-30, 7]].forEach(([f, dy], i) => {
        const [x, y] = P(f, dy);
        for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; R(x + Math.cos(t) * 6, y + Math.sin(t) * 2.4, 1, 1, i % 2 ? "#9a8af0" : "#7fe3ff"); }
        R(x - 1, y, 3, 1, "#d8c8ff");
      });
      // a pool of starlight at the front
      const [px, py] = P(-40, 27);
      for (let j = -2; j <= 2; j++) { const w = 13 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#5a5ad8" : "#3a3aa0"); }
    } else if (key === "hollow") {
      // crop rows: furrowed soil and green shoots
      [[-110, 7, 26], [20, -13, 34], [-30, 7, 14]].forEach(([f, dy, w]) => {
        const [x0, y] = P(f, dy), x1 = P(f + w, dy)[0];
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { R(x, y - 1, 1, 1, "#7a5a2a"); R(x, y + 1, 1, 1, "#7a5a2a"); if (x % 2) R(x, y, 1, 1, "#5a8a2a"); }
      });
      // a duck pond at the front
      const [px, py] = P(-40, 27);
      for (let j = -2; j <= 2; j++) { const w = 13 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#6aaac0" : "#4a8fa0"); }
    } else if (key === "reef") {
      // tide pools
      [[-40, 27, 13], [-100, 7, 11], [26, -13, 9]].forEach(([f, dy, w0]) => {
        const [px, py] = P(f, dy);
        for (let j = -2; j <= 2; j++) { const w = w0 - Math.abs(j) * 3; R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#3a8ac0" : "#1a5a8a"); }
        R(px - 2, py - 1, 2, 1, "#9ad8ff");
      });
    } else if (key === "crown") {
      // lava pools, crusted at the edges
      [[-40, 27, 13], [24, -13, 11], [-102, 7, 9]].forEach(([f, dy, w0]) => {
        const [px, py] = P(f, dy);
        for (let j = -2; j <= 2; j++) { const w = w0 - Math.abs(j) * 3; R(px - Math.floor(w / 2) - 1, py + j, w + 2, 1, "#2a1a1a"); R(px - Math.floor(w / 2), py + j, w, 1, j < 0 ? "#ffb020" : "#ff6a1a"); }
      });
    }
    paintLandmark2(g, key, P, isl);
    return;
  }

  // "over": trees, rocks and props scattered between the rows, and a line along the back rim
  const along = (fFrom, fTo, step, dy, fn) => { for (let f = fFrom; f <= fTo; f += step) { const rf = f + (rnd() - 0.5) * 3; if (free(rf, dy)) fn(...P(rf, dy)); } };
  if (key === "keep") {
    along(-70, 100, 14, -29, (x, y) => isleTree(g, x, y, "#3f8a3a", "#2f6a24", rnd() > 0.5 ? "#ff3b3b" : null, 3));
    scatter(7, [7, -13], (x, y, i) => i % 3 ? isleTuft(g, x, y, "#4f8f3a") : isleTree(g, x, y, "#4a9a3a", "#2f6a24", "#ff3b3b", 3));
    // two beehives by the gate
    [[-22, -12], [-16, -12]].forEach(([f, dy]) => { const [x, y] = P(f, dy); R(x - 1, y - 4, 3, 1, "#c08a10"); R(x - 2, y - 3, 5, 1, "#e0a820"); R(x - 2, y - 2, 5, 1, "#c08a10"); R(x - 1, y - 1, 3, 1, "#e0a820"); R(x, y - 2, 1, 1, "#3a2a10"); });
    // a cottage or two at the far end
    { const [x, y] = P(128, 9); isleHouse(g, x - 3, y, 7, 5, "#e8dcc0", "#b23a3a"); }
  } else if (key === "spire") {
    along(-70, 100, 13, -29, (x, y) => { const c = rnd() > 0.5 ? "#7fe3ff" : "#b36bff"; R(x, y - 4, 1, 4, c); R(x - 1, y - 2, 1, 2, shadeHex(c, -0.3)); R(x + 1, y - 3, 1, 3, shadeHex(c, 0.3)); });
    scatter(8, [7, -13], (x, y, i) => {
      if (i % 2) { R(x, y - 2, 1, 3, "#e8e0c8"); R(x - 2, y - 4, 5, 2, i % 4 === 1 ? "#c84a8a" : "#7a4ac8"); R(x - 1, y - 5, 3, 1, i % 4 === 1 ? "#e86aaa" : "#9a6ae8"); R(x - 1, y - 4, 1, 1, "#ffffff"); }
      else { const c = "#7fe3ff"; R(x, y - 3, 1, 3, c); R(x + 1, y - 2, 1, 2, "#b36bff"); }
    });
  } else if (key === "hollow") {
    along(-70, 100, 14, -29, (x, y) => isleTree(g, x, y, rnd() > 0.5 ? "#d87a2a" : "#c8a030", "#8a4a1a", rnd() > 0.4 ? "#ff3b3b" : null, 3));
    scatter(8, [7, -13], (x, y, i) => {
      if (i % 3 === 0) { R(x - 2, y - 2, 5, 3, "#ff8c1a"); R(x - 1, y - 3, 3, 1, "#ffa83a"); R(x, y - 4, 1, 1, "#3a6a1a"); R(x - 2, y - 1, 1, 1, "#c86a10"); }
      else if (i % 3 === 1) { R(x - 2, y - 3, 5, 3, "#e8c860"); R(x - 2, y - 3, 5, 1, "#f8e090"); R(x - 1, y - 2, 1, 1, "#c8a040"); }
      else isleTuft(g, x, y, "#8a8a34");
    });
    // the scarecrow
    { const [x, y] = P(-6, 7); R(x, y - 7, 1, 7, "#6a4a2a"); R(x - 3, y - 6, 7, 1, "#6a4a2a"); R(x - 1, y - 9, 3, 3, "#e8c860"); R(x - 2, y - 10, 5, 1, "#5a3a1a"); R(x - 1, y - 5, 3, 3, "#3a6a8a"); }
  } else if (key === "reef") {
    along(-70, 100, 16, -29, (x, y) => {
      R(x, y - 6, 1, 6, "#8a6a3a"); R(x + 1, y - 4, 1, 2, "#8a6a3a");
      R(x - 3, y - 7, 3, 1, "#3a9a4a"); R(x + 1, y - 7, 3, 1, "#3a9a4a"); R(x - 4, y - 6, 1, 1, "#2a7a3a"); R(x + 4, y - 6, 1, 1, "#2a7a3a"); R(x - 1, y - 8, 3, 1, "#5aba5a"); R(x, y - 6, 1, 1, "#8a5a2a");
    });
    scatter(9, [7, -13], (x, y, i) => {
      if (i % 3 === 0) { const c = ["#ff7a8a", "#ff9a3a", "#c85aa8"][i % 3]; R(x, y - 3, 1, 3, c); R(x - 1, y - 2, 1, 1, c); R(x + 1, y - 4, 1, 2, c); R(x - 2, y - 4, 1, 1, c); }
      else if (i % 3 === 1) { R(x - 1, y - 1, 3, 1, "#fff0e0"); R(x, y - 2, 1, 1, "#ffc8b8"); }
      else isleRock(g, x, y, 1, "#c8b8a8");
    });
  } else if (key === "crown") {
    along(-70, 100, 15, -29, (x, y) => { const h = 4 + Math.floor(rnd() * 4); for (let j = 0; j < h; j++) R(x - (j < h / 2 ? 1 : 0), y - j, j < h / 2 ? 3 : 1, 1, j === h - 1 ? "#6a5a7a" : "#1e1a24"); R(x - 1, y - h + 2, 1, 1, "#5a4a6a"); });
    scatter(8, [7, -13], (x, y, i) => {
      if (i % 2) { R(x, y - 6, 1, 6, "#1a1418"); R(x - 2, y - 5, 2, 1, "#1a1418"); R(x + 1, y - 4, 2, 1, "#1a1418"); R(x - 3, y - 6, 1, 1, "#1a1418"); }
      else isleRock(g, x, y, 1, "#4a3a3a");
    });
  }
}

/* ----- The big landmark at the back of the home end ----- */
const LANDMARK_SPOT = [-92, -22];
function paintLandmark2(g, key, P, isl) {
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  const [x, y] = P(...LANDMARK_SPOT);
  if (key === "keep") {
    // Brightscale Keep itself: a great square tower between two round ones
    const stone = ["#d8d2c4", "#b8b2a4", "#8f8a7e", "#6e6a62"];
    const wall = (x0, y0, w, h) => {
      R(x0, y0, w, h, stone[1]);
      R(x0, y0, 1, h, stone[0]);
      R(x0 + w - 2, y0, 2, h, stone[2]);
      for (let j = 3; j < h; j += 4) for (let i = (j % 8 ? 1 : 3); i < w - 2; i += 4) R(x0 + i, y0 + j, 2, 1, stone[2]);
      for (let i = 0; i < w; i += 2) R(x0 + i, y0 - 2, 1, 2, i % 4 ? stone[2] : stone[1]);
    };
    wall(x - 14, y - 12, 28, 12);                          // the curtain wall
    R(x - 3, y - 7, 6, 7, "#2a2018"); R(x - 2, y - 8, 4, 1, "#2a2018");            // the gate
    for (let i = 0; i < 4; i++) R(x - 3 + i * 2, y - 7, 1, 7, "#5a5048");          // portcullis
    wall(x - 9, y - 33, 18, 21);                           // the keep
    R(x - 2, y - 27, 4, 5, "#2a2018"); R(x - 1, y - 28, 2, 1, "#2a2018"); R(x - 1, y - 26, 2, 2, "#ffcf5a");   // a lit window
    R(x - 6, y - 20, 2, 3, "#2a2018"); R(x + 4, y - 20, 2, 3, "#2a2018");
    // round towers with red cones
    [[-15, 24], [15, 24]].forEach(([dx, h]) => {
      const tx = x + dx;
      R(tx - 4, y - h, 8, h, stone[1]); R(tx - 4, y - h, 2, h, stone[0]); R(tx + 2, y - h, 2, h, stone[2]);
      R(tx - 1, y - h + 6, 2, 3, "#2a2018");
      for (let j = 0; j < 9; j++) R(tx - 5 + Math.floor(j / 2), y - h - 1 - j, 10 - Math.floor(j / 2) * 2, 1, j % 3 === 0 ? "#8e2b2b" : "#c0392b");
      R(tx - 1, y - h - 10, 1, 1, "#ffd23f");
    });
    // banners on the keep
    [[-7, "#c0392b"], [5, "#2f5fbf"]].forEach(([dx, c]) => { R(x + dx, y - 31, 2, 7, c); R(x + dx, y - 25, 1, 1, c); R(x + dx + 1, y - 29, 1, 1, "#ffd23f"); });
  } else if (key === "spire") {
    // the Arcanum Spire: a slender tower, tall enough to scrape the stars
    const st = ["#9a8ac8", "#7a6aa8", "#5a4a88", "#3e3268"];
    R(x - 9, y - 4, 18, 4, st[2]); R(x - 9, y - 4, 18, 1, st[1]);                  // the plinth
    for (let j = 0; j < 38; j++) {
      const w = 10 - Math.floor(j / 13) * 2, x0 = x - Math.floor(w / 2);
      R(x0, y - 4 - j, w, 1, st[1]); R(x0, y - 4 - j, 1, 1, st[0]); R(x0 + w - 2, y - 4 - j, 2, 1, st[2]);
      if (j % 6 === 3) R(x0 + 1, y - 4 - j, w - 3, 1, st[3]);
    }
    [[6, 0], [16, 1], [26, 0]].forEach(([j, k]) => { R(x - 1 + k, y - 4 - j - 3, 2, 3, "#ffd27a"); R(x - 1 + k, y - 4 - j - 4, 2, 1, st[3]); });   // lit windows
    // the roof, and a ring of stone under it
    R(x - 5, y - 43, 10, 2, st[3]);
    for (let j = 0; j < 12; j++) R(x - 5 + Math.floor(j / 2), y - 44 - j, 10 - Math.floor(j / 2) * 2, 1, j % 3 === 0 ? "#2a3a9a" : "#3a5ad8");
    R(x, y - 57, 1, 2, "#ffd23f");
    // a smaller tower leaning on it
    R(x + 7, y - 18, 6, 14, st[1]); R(x + 11, y - 18, 2, 14, st[2]); R(x + 9, y - 13, 2, 3, "#ffd27a");
    for (let j = 0; j < 6; j++) R(x + 6 + Math.floor(j / 2), y - 19 - j, 8 - Math.floor(j / 2) * 2, 1, "#3a5ad8");
  } else if (key === "hollow") {
    // the windmill (its sails turn, drawn live) and a red barn
    const bx = x + 14 * ISLANDS[key].dir;
    isleHouse(g, bx - 8, y, 16, 9, "#b83a2a", "#7a2a1a", "#3a1a10");
    R(bx - 3, y - 7, 6, 7, "#e8dcc0"); R(bx - 2, y - 6, 4, 6, "#8a2a1a"); R(bx - 2, y - 6, 4, 1, "#e8dcc0"); R(bx, y - 6, 1, 6, "#e8dcc0");
    for (let j = 0; j < 26; j++) {
      const w = 10 - Math.floor(j / 6), x0 = x - Math.floor(w / 2);
      R(x0, y - j, w, 1, "#c8b8a0"); R(x0, y - j, 1, 1, "#e8dcc8"); R(x0 + w - 2, y - j, 2, 1, "#9a8a70");
    }
    R(x - 1, y - 6, 3, 6, "#5a3a20"); R(x - 1, y - 15, 2, 3, "#3a2a1a");
    for (let j = 0; j < 5; j++) R(x - 5 + j, y - 26 - j, 10 - j * 2, 1, j % 2 ? "#6a4a2a" : "#8a5a30");
  } else if (key === "reef") {
    // the lighthouse on a heap of rocks (its beam sweeps, drawn live)
    isleRock(g, x - 6, y + 1, 3, "#9a8a7a"); isleRock(g, x + 6, y + 1, 3, "#8a7a6a"); isleRock(g, x, y + 1, 4, "#a89a8a");
    for (let j = 0; j < 34; j++) {
      const w = 9 - Math.floor(j / 12), x0 = x - Math.floor(w / 2);
      const red = Math.floor(j / 5) % 2;
      R(x0, y - 3 - j, w, 1, red ? "#d83a3a" : "#f4f0e8"); R(x0 + w - 2, y - 3 - j, 2, 1, red ? "#a82a2a" : "#c8c0b8"); R(x0, y - 3 - j, 1, 1, red ? "#ff6a6a" : "#ffffff");
    }
    R(x - 5, y - 38, 10, 2, "#3a3a44"); R(x - 3, y - 43, 6, 5, "#2a3a4a"); R(x - 2, y - 42, 4, 3, "#fff6a8");
    for (let j = 0; j < 4; j++) R(x - 4 + j, y - 44 - j, 8 - j * 2, 1, "#d83a3a");
    R(x - 1, y - 13, 2, 3, "#3a3a44");
  } else if (key === "crown") {
    // the volcano, with a red glow in its throat (the smoke and sparks are drawn live)
    for (let j = 0; j < 30; j++) {
      const w = 54 - j * 1.5, x0 = x - w / 2;
      for (let i = 0; i < w; i++) {
        const lit = i < w * 0.32;
        R(x0 + i, y - j, 1, 1, lit ? (j % 4 ? "#4a3a3e" : "#54424a") : i > w * 0.8 ? "#1a1418" : (j + i) % 5 ? "#2e2428" : "#36292e");
      }
    }
    R(x - 6, y - 30, 12, 1, "#ff6a1a"); R(x - 4, y - 31, 8, 1, "#ffb020");
    // a lava flow down the side
    for (let j = 0; j < 28; j++) R(x - 3 + Math.round(Math.sin(j * 0.4) * 2 + j * 0.3), y - 29 + j, 2, 1, j % 3 ? "#ff6a1a" : "#ffb020");
  }
}

/* Behind an island: nothing, for now; the landmarks stand on the rim */
function drawIsleBehind(g, key, t, by) { }

/* ----- What moves on each island ----- */
function drawIsleLiving(g, key, t, by) {
  const isl = ISLANDS[key];
  const d = isl.dir;
  const P = (f, dy) => [Math.round(isl.x + d * f), Math.round(isl.y + dy + by)];
  const R = (x, y, w, h, c) => mapRect(g, x, y, w, h, c);
  // falls off the front edge, from the pond
  const falls = { keep: "rgba(200,235,255,", spire: "rgba(170,240,255,", hollow: "rgba(200,235,255,", reef: "rgba(190,240,255,", crown: "rgba(255,160,60," }[key];
  {
    const [fx, fy] = P(-40, 30);
    for (let i = 0; i < 26; i++) { const ph = (t * 1.3 + i / 26) % 1; R(fx - 2 + (i % 4), fy + ph * 54, 1, 2 + (i % 2), `${falls}${(0.85 * (1 - ph)).toFixed(2)})`); }
    for (let i = 0; i < 3; i++) if (Math.sin(t * 5 + i * 2) > 0.6) R(fx - 3 + i * 3, fy + 1, 1, 1, "#ffffff");
  }
  const [lx, ly] = P(...LANDMARK_SPOT);
  if (key === "keep") {
    // flags on the towers, rippling
    [[-15, 24], [15, 24], [0, 33]].forEach(([dx, h], i) => {
      const fx = lx + dx, fy = ly - h - (dx ? 10 : 2);
      R(fx, fy - 4, 1, 5, "#5a3a20");
      for (let k = 0; k < 5; k++) R(fx + 1 + k, fy - 4 + Math.round(Math.sin(t * 6 - k * 0.9 + i) * 0.7), 1, 2, k % 2 ? "#c0392b" : "#ffd23f");
    });
    // bees about the hives
    for (let i = 0; i < 4; i++) { const [hx, hy] = P(-19, -15); const a = t * (2 + i * 0.4) + i * 1.6; R(hx + Math.cos(a) * (4 + i), hy + Math.sin(a * 1.3) * 2.5, 1, 1, i % 2 ? "#ffcf33" : "#1a1410"); }
    // a knight's pennant bobbing along the lists
    { const ph = (t * 0.12) % 1; const [ax] = P(-6, -13), [bx] = P(56, -13); const x = ax + (bx - ax) * (ph < 0.5 ? ph * 2 : 2 - ph * 2); const [, y] = P(0, -15); R(x, y - 3 + Math.round(Math.sin(t * 9)), 2, 2, "#c8ced6"); R(x, y - 1, 2, 1, "#5a3a20"); }
  } else if (key === "spire") {
    // the orb above the spire, and runestones circling it
    const ox = lx, oy = ly - 64;
    const glow = 0.5 + 0.5 * Math.sin(t * 2);
    g.fillStyle = `rgba(127,227,255,${0.18 + 0.2 * glow})`; g.fillRect(ox - 5, oy - 5, 11, 11);
    R(ox - 2, oy - 2, 5, 5, "#7fe3ff"); R(ox - 1, oy - 1, 2, 2, "#ffffff");
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + i * Math.PI / 2, rx = ox + Math.cos(a) * 12, ry = oy + 10 + Math.sin(a) * 4;
      R(rx - 1, ry - 1, 3, 3, Math.sin(a) > 0 ? "#6a5a8a" : "#4e4060"); R(rx, ry, 1, 1, i % 2 ? "#b36bff" : "#7fe3ff");
    }
    // sparkles drifting up off the crystals
    for (let i = 0; i < 10; i++) { const ph = (t * 0.3 + i / 10) % 1; const [sx, sy] = P(-80 + i * 18, -27); if (Math.sin(t * 4 + i) > 0) R(sx, sy - ph * 14, 1, 1, i % 2 ? "#d8b0ff" : "#bff4ff"); }
  } else if (key === "hollow") {
    // the windmill's sails
    const hx = lx, hy = ly - 22, a0 = t * 1.1;
    for (let k = 0; k < 4; k++) {
      const a = a0 + k * Math.PI / 2;
      for (let r = 2; r < 15; r++) { const px = hx + Math.cos(a) * r, py = hy + Math.sin(a) * r; R(px, py, 1, 1, "#5a3a20"); if (r > 4) R(px + Math.cos(a + Math.PI / 2) * 2, py + Math.sin(a + Math.PI / 2) * 2, 1, 1, r % 2 ? "#f0e8d8" : "#d8ccb0"); }
    }
    R(hx - 1, hy - 1, 2, 2, "#3a2a1a");
    // leaves tumbling off the orchard
    for (let i = 0; i < 6; i++) { const ph = (t * 0.25 + i / 6) % 1; const [sx, sy] = P(-60 + i * 28, -32); R(sx + Math.sin(t + i) * 4 + ph * 6, sy + ph * 20, 1, 1, i % 2 ? "#d87a2a" : "#c8a030"); }
  } else if (key === "reef") {
    // the lighthouse beam sweeping the sky
    const bx = lx, bby = ly - 41, a = Math.sin(t * 0.8) * 1.3 - Math.PI / 2 + (d > 0 ? 0.6 : -0.6);
    for (let r = 3; r < 60; r++) {
      const w = r * 0.18;
      g.fillStyle = `rgba(255,246,168,${0.35 * (1 - r / 60)})`;
      g.fillRect(Math.round(bx + Math.cos(a) * r - w / 2), Math.round(bby + Math.sin(a) * r - w / 2), Math.ceil(w), Math.ceil(w));
    }
    // ripples in the pools and a gull overhead
    [[-40, 27], [-100, 7], [26, -13]].forEach(([f, dy], i) => { if (Math.sin(t * 2 + i * 2) > 0.3) { const [x, y] = P(f + Math.sin(t + i) * 3, dy); R(x, y, 2, 1, "#c8f0ff"); } });
    { const gx = isl.x + Math.sin(t * 0.3) * 120, gy = isl.y - 60 + by + Math.sin(t * 0.7) * 6, f = Math.sin(t * 7) > 0; R(gx - 2, gy - (f ? 1 : 0), 2, 1, "#ffffff"); R(gx + 1, gy - (f ? 1 : 0), 2, 1, "#ffffff"); R(gx, gy, 1, 1, "#d8d8d8"); }
  } else if (key === "crown") {
    // smoke from the crater, and sparks
    for (let i = 0; i < 7; i++) {
      const ph = (t * 0.22 + i / 7) % 1;
      g.fillStyle = `rgba(70,60,66,${0.55 * (1 - ph)})`;
      const s = 3 + Math.round(ph * 7);
      g.fillRect(Math.round(lx + Math.sin(ph * 5 + i) * 3 + ph * 10 * d - s / 2), Math.round(ly - 32 - ph * 40), s, s);
    }
    for (let i = 0; i < 9; i++) { const ph = (t * 0.6 + i / 9) % 1; R(lx - 4 + mapHash(i, 3, 5) * 8 + Math.sin(t * 3 + i) * 2, ly - 31 - ph * 22, 1, 1, ph < 0.5 ? "#ffd23f" : "#ff6a1a"); }
    // the lava pools glow and bubble
    [[-40, 27], [24, -13], [-102, 7]].forEach(([f, dy], i) => { const [x, y] = P(f, dy); g.fillStyle = `rgba(255,140,30,${0.15 + 0.15 * Math.sin(t * 2 + i)})`; g.fillRect(x - 8, y - 4, 16, 8); if (Math.sin(t * 4 + i * 3) > 0.7) R(x + Math.round(Math.sin(t + i) * 3), y - 1, 1, 1, "#fff0a0"); });
    // embers rising off the whole island
    for (let i = 0; i < 8; i++) { const ph = (t * 0.18 + i / 8) % 1; const [sx, sy] = P(-130 + i * 36, 10); R(sx + Math.sin(t * 2 + i) * 3, sy - ph * 50, 1, 1, "#ff8a2a"); }
  }
  // fireflies on the islands up in the dusk and the night
  if (isl.n >= 2) for (let i = 0; i < 6; i++) {
    const glow = Math.sin(t * 2.2 + i * 1.7);
    if (glow < 0.2) continue;
    const [fx, fy] = P(-120 + mapHash(i, isl.n, 3) * 240 + Math.sin(t * 0.5 + i) * 6, -10 + mapHash(i, isl.n, 4) * 30 + Math.cos(t * 0.6 + i) * 3);
    R(fx, fy, 1, 1, glow > 0.7 ? "#fff6a8" : "#c8d060");
  }
}

/* ----- The stops: a stone for each level, a lair for each boss, and the shopkeepers' places ----- */
function drawNodeArt(g, key, id, st, t, by) {
  const I = CAMP.islandById[key];
  const p = nodeAt(key, id);
  const x = p.x, y = p.y + by;
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const accent = I.colors.accent;
  if (typeof id === "number") {
    if (isBossLevel(id)) { drawLair(g, key, id, st, x, y, t); return; }
    // a flat stepping stone; a planted pennant once it's won
    R(x - 3, y, 7, 2, st === "locked" ? "#6a6a70" : "#a8a8b0"); R(x - 2, y, 5, 1, st === "locked" ? "#8a8a90" : "#d0d0d8"); R(x - 3, y + 2, 7, 1, "rgba(0,0,0,0.25)");
    if (st === "done") { const fx = x + 4; R(fx, y - 7, 1, 8, "#5a3a20"); R(fx + 1, y - 7 + Math.round(Math.sin(t * 5 + id) * 0.6), 3, 2, accent); R(fx + 1, y - 5, 2, 1, shadeHex(accent, -0.3)); }
    if (st === "next") { const k = 0.5 + 0.5 * Math.sin(t * 3); g.fillStyle = `rgba(255,224,120,${0.25 + 0.3 * k})`; g.fillRect(x - 5, y - 1, 11, 4); }
    return;
  }
  if (id === "home") { drawHomeTree(g, key, x, y, t); return; }
  if (id === "bridge") { drawGate(g, key, x, y, st, t); return; }
  drawStall(g, key, id, x, y, st, t);
  if (st !== "locked") drawKeeper(g, I.npcs[id].look, x + ISLANDS[key].dir * (id === "banker" ? -9 : 9), y + 1, t, id);
}

/* A boss's lair: a heap of rock with a black mouth, and eyes that watch you */
function drawLair(g, key, n, st, x, y, t) {
  const B = CAMP.islandById[key].boss;
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const big = n === LEVEL_COUNT ? 2 : n === 10 ? 1 : 0;
  const w = 19 + big * 3, h = 13 + big * 2;
  const rock = { keep: "#7a7472", spire: "#5a4a7a", hollow: "#7a5a3a", reef: "#6a7a8a", crown: "#3a2a2e" }[key];
  for (let j = 0; j < h; j++) { const ww = Math.round(w * Math.sqrt(1 - Math.pow(j / h, 2))); R(x - Math.floor(ww / 2), y + 1 - j, ww, 1, j > h * 0.6 ? shadeHex(rock, 0.2) : rock); }
  R(x - Math.floor(w / 2), y + 1, w, 1, shadeHex(rock, -0.35));
  // boulders on its flanks, and the mouth of the cave
  isleRock(g, x - Math.floor(w / 2) + 2, y + 1, 2, shadeHex(rock, 0.1)); isleRock(g, x + Math.floor(w / 2) - 2, y + 1, 2, shadeHex(rock, -0.1));
  R(x - 3, y - 5, 7, 6, "#0e0a0c"); R(x - 2, y - 6, 5, 1, "#0e0a0c");
  if (st === "done") {
    // the lair is empty, and your banner flies over it
    R(x + 5, y - h - 7, 1, 9, "#5a3a20");
    for (let k = 0; k < 5; k++) R(x + 6 + k, y - h - 7 + Math.round(Math.sin(t * 5 - k) * 0.6), 1, 3, k % 2 ? "#ffd23f" : CAMP.islandById[key].colors.accent);
    return;
  }
  const blink = (t + n) % 4 < 0.15;
  if (st !== "locked" && !blink) { R(x - 2, y - 3, 1, 1, B.eye); R(x + 2, y - 3, 1, 1, B.eye); if (Math.sin(t * 2 + n) > 0.4) { g.fillStyle = "rgba(255,60,60,0.25)"; g.fillRect(x - 3, y - 4, 7, 3); } }
  if (st === "next") { const k = 0.5 + 0.5 * Math.sin(t * 3); g.fillStyle = `rgba(255,90,110,${0.12 + 0.18 * k})`; g.fillRect(x - Math.floor(w / 2) - 1, y - h, w + 2, h + 2); }
  // bones by the door
  R(x - 6, y, 2, 1, "#e8e0c8"); R(x + 5, y, 1, 1, "#e8e0c8");
  // spikes on top for the last fight
  if (big === 2) for (let k = -1; k <= 1; k++) R(x + k * 4, y - h - 1 - (k ? 0 : 1), 1, 2, shadeHex(rock, -0.3));
}

/* The home tree: as tall and full as this island's upgrades, with your satchel against it */
function drawHomeTree(g, key, x, y, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const tree = CAMP.islandById[key].tree;
  const have = tree.upgrades.reduce((a, u) => a + upTier(u.id), 0);
  const total = tree.upgrades.reduce((a, u) => a + u.values.length - 1, 0);
  const f = total ? have / total : 0;
  const leaves = { keep: ["#2f7d2a", "#3f9a3a", "#5ab046", "#ff3b3b"], spire: ["#3a3a9a", "#5a5ac8", "#8a8af0", "#7fe3ff"], hollow: ["#a8501a", "#d87a2a", "#f0a840", "#ff3b3b"], reef: ["#1a7a6a", "#2a9a8a", "#5acaba", "#ff9ab0"], crown: ["#6a1a1a", "#a82a1a", "#e85a1a", "#ffd23f"] }[key];
  const hgt = 8 + Math.round(f * 10);
  R(x - 1, y - hgt, 2 + (f > 0.5 ? 1 : 0), hgt + 1, "#5a3a20"); R(x - 1, y - hgt, 1, hgt + 1, "#7a5232");
  R(x - 3, y, 2, 1, "#5a3a20"); R(x + 2, y, 2, 1, "#5a3a20");
  const r = 4 + f * 6, n = 30 + Math.round(f * 70);
  for (let i = 0; i < n; i++) {
    const a = mapHash(i, key.length, 71) * Math.PI * 2, dd = Math.sqrt(mapHash(i, key.length, 73)) * r;
    R(x + Math.cos(a) * dd * 1.3 + Math.sin(t * 1.3 + i) * 0.3, y - hgt + Math.sin(a) * dd * 0.85, 1, 1, leaves[i % 3]);
  }
  // fruit, one for every tier bought (up to a dozen), glinting
  for (let i = 0; i < Math.min(12, have); i++) {
    const a = i * 2.39, dd = r * (0.4 + 0.5 * mapHash(i, 9, 3));
    const fx = x + Math.cos(a) * dd * 1.2, fy = y - hgt + Math.sin(a) * dd * 0.7;
    R(fx, fy, 1, 1, leaves[3]);
    if (Math.sin(t * 3 + i * 2) > 0.92) R(fx, fy - 1, 1, 1, "#ffffff");
  }
  // the satchel, leaning on the trunk
  const sx = x + 3 * ISLANDS[key].dir;
  R(sx - 1, y - 3, 4, 3, "#b07a42"); R(sx - 1, y - 3, 4, 1, "#d09a5a"); R(sx, y - 4, 2, 1, "#5a3a1e"); R(sx + 1, y - 2, 1, 1, "#ffd23f");
}

/* The bridge: a stone arch where the Coil carries you up, torches lit once it's open */
function drawGate(g, key, x, y, st, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const open = st !== "locked";
  R(x - 6, y - 10, 3, 11, "#b8b2a4"); R(x + 4, y - 10, 3, 11, "#8f8a7e"); R(x - 6, y - 10, 1, 11, "#d8d2c4");
  R(x - 5, y - 12, 11, 2, "#b8b2a4"); R(x - 4, y - 13, 9, 1, "#d8d2c4"); R(x - 1, y - 14, 3, 1, "#ffd23f");
  R(x - 3, y - 10, 7, 11, open ? "#ffe9a0" : "#1a1418");
  if (open) { g.fillStyle = `rgba(255,240,170,${0.25 + 0.15 * Math.sin(t * 3)})`; g.fillRect(x - 5, y - 12, 11, 13); }
  else for (let i = 0; i < 4; i++) R(x - 3 + i * 2, y - 10, 1, 11, "#5a5048");
  // torches
  [-8, 8].forEach((dx, i) => {
    R(x + dx, y - 6, 1, 5, "#5a3a20");
    if (open) { const fl = Math.sin(t * 11 + i * 2) > 0; R(x + dx, y - 8, 1, 2, fl ? "#ffd23f" : "#ff8a1a"); R(x + dx + (fl ? 0 : 0), y - 9, 1, 1, fl ? "#ff6a1a" : "#ffd23f"); }
  });
}

/* The shopkeepers' places: a market stall, a challenger's tent, a bank */
function drawStall(g, key, id, x, y, st, t) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const I = CAMP.islandById[key];
  const accent = I.colors.accent;
  const shut = st === "locked";
  if (id === "merchant") {
    // a stall under a striped awning, its goods on the counter
    R(x - 7, y - 4, 14, 5, "#6a4a2a"); R(x - 7, y - 4, 14, 1, "#9a6a3a");
    R(x - 6, y - 10, 1, 6, "#5a3a1e"); R(x + 5, y - 10, 1, 6, "#5a3a1e");
    for (let i = -8; i <= 7; i++) R(x + i, y - 12, 1, 2, Math.floor((i + 20) / 2) % 2 ? accent : "#f4f0e8");
    for (let i = -8; i <= 7; i += 2) R(x + i, y - 10, 1, 1, Math.floor((i + 20) / 2) % 2 ? accent : "#f4f0e8");
    if (shut) { R(x - 5, y - 9, 10, 5, "#8a6a4a"); for (let j = 0; j < 5; j += 2) R(x - 5, y - 9 + j, 10, 1, "#6a4a2a"); return; }
    const goods = { gear: ["#c8ced6", "#9aa3ad", "#3a6ab8"], spell: ["#b36bff", "#7fe3ff", "#ff6a1a"], food: ["#d8a050", "#c86a2a", "#ff3b3b"], pet: ["#ffcf5a", "#ff5a3a", "#7ac85a"], rune: ["#3ddc84", "#ffd23f", "#ff3b3b"] }[I.merchantFamily] || ["#ffd23f", "#ff3b3b", "#3ddc84"];
    goods.forEach((c, i) => { R(x - 5 + i * 4, y - 6, 2, 2, c); R(x - 5 + i * 4, y - 6, 1, 1, shadeHex(c, 0.4)); });
  } else if (id === "challenger") {
    // a tall pointed tent with a pennant
    for (let j = 0; j < 12; j++) { const w = 2 + j; R(x - Math.floor(w / 2), y - 12 + j, w, 1, j % 3 === 2 ? shadeHex(accent, -0.25) : accent); R(x - Math.floor(w / 2), y - 12 + j, 1, 1, shadeHex(accent, 0.3)); }
    for (let j = 0; j < 12; j += 2) R(x - Math.floor((2 + j) / 2) + Math.floor((2 + j) / 2), y - 12 + j, 1, 2, "#f4f0e8");
    R(x - 2, y - 5, 4, 5, shut ? "#3a2a20" : "#1a1410"); if (!shut) R(x - 1, y - 4, 2, 1, "#ffd23f");
    R(x, y - 16, 1, 4, "#5a3a20");
    for (let k = 0; k < 4; k++) R(x + 1 + k, y - 16 + Math.round(Math.sin(t * 6 - k) * 0.6), 1, 2 - (k > 2 ? 1 : 0), k % 2 ? "#ffffff" : "#c0392b");
    if (shut) { R(x - 4, y - 7, 8, 1, "#5a3a20"); R(x - 3, y - 8, 1, 3, "#5a3a20"); R(x + 2, y - 8, 1, 3, "#5a3a20"); }
  } else {
    // the bank: steps, columns, a pediment and a coin turning on its roof
    const stone = shut ? ["#8a8680", "#6a6660", "#4a4640"] : ["#e8e0d0", "#c8c0b0", "#9a9284"];
    R(x - 8, y - 1, 16, 2, stone[2]); R(x - 7, y - 2, 14, 1, stone[1]);
    for (let i = 0; i < 4; i++) { R(x - 6 + i * 4, y - 9, 2, 7, stone[0]); R(x - 5 + i * 4, y - 9, 1, 7, stone[1]); }
    R(x - 8, y - 11, 16, 2, stone[1]); R(x - 8, y - 11, 16, 1, stone[0]);
    for (let j = 0; j < 4; j++) R(x - 7 + j * 2, y - 12 - j, 14 - j * 4, 1, j % 2 ? stone[1] : stone[0]);
    R(x - 1, y - 7, 2, 5, shut ? "#3a3632" : "#2a2018");
    if (shut) return;
    const c = I.currency.color, turn = Math.abs(Math.cos(t * 1.6)), cw = Math.max(1, Math.round(5 * turn));
    R(x, y - 19, 1, 3, "#5a3a1e");
    R(x - Math.floor(cw / 2), y - 24, cw, 5, c);
    if (cw >= 3) { R(x - Math.floor(cw / 2), y - 24, cw, 1, shadeHex(c, 0.5)); R(x, y - 23, 1, 3, shadeHex(c, -0.4)); }
  }
}

/* A shopkeeper: a little snake standing tall, in its hat */
function drawKeeper(g, look, x, y, t, kind) {
  const R = (a, b, w, h, c) => mapRect(g, a, b, w, h, c);
  const sway = Math.round(Math.sin(t * 1.4 + kind.length) * 0.6);
  const body = look.body, belly = look.belly;
  // a coil on the ground, then up to the head
  R(x - 2, y - 1, 5, 2, body); R(x - 1, y - 1, 3, 1, shadeHex(body, 0.2));
  R(x + sway, y - 6, 2, 5, body); R(x + sway + 1, y - 5, 1, 4, belly);
  R(x - 1 + sway, y - 8, 4, 3, body); R(x - 1 + sway, y - 8, 1, 1, shadeHex(body, 0.3));
  const blink = (t * 0.7 + kind.length) % 5 < 0.12;
  R(x + sway + 1, y - 7, 1, 1, blink ? body : (look.eye || "#ffd23f"));
  if (Math.sin(t * 2 + kind.length) > 0.85) R(x + sway + 3, y - 6, 1, 1, "#ff3b6b");
  const s = sway;
  const hats = {
    helm: () => { R(x - 1 + s, y - 9, 4, 1, "#9aa3ad"); R(x + s, y - 10, 2, 1, "#c8ced6"); R(x + 1 + s, y - 11, 1, 1, "#c8323a"); },
    hennin: () => { R(x - 1 + s, y - 9, 4, 1, "#ffd23f"); R(x + s, y - 10, 2, 1, "#c8508a"); R(x + 1 + s, y - 12, 1, 2, "#c8508a"); },
    tophat: () => { R(x - 2 + s, y - 9, 6, 1, "#1a1a20"); R(x - 1 + s, y - 12, 4, 3, "#1a1a20"); R(x - 1 + s, y - 10, 4, 1, "#c8323a"); },
    wizard: () => { R(x - 2 + s, y - 9, 6, 1, "#3a3aa8"); R(x - 1 + s, y - 10, 4, 1, "#3a3aa8"); R(x + s, y - 11, 2, 1, "#3a3aa8"); R(x + 1 + s, y - 13, 1, 2, "#3a3aa8"); R(x + s, y - 10, 1, 1, "#ffd23f"); },
    hood: () => { R(x - 2 + s, y - 9, 6, 2, shadeHex(body, -0.4)); R(x - 1 + s, y - 10, 4, 1, shadeHex(body, -0.4)); R(x - 2 + s, y - 7, 1, 3, shadeHex(body, -0.4)); },
    fez: () => { R(x - 1 + s, y - 10, 3, 2, "#c8323a"); R(x + 2 + s, y - 10, 1, 2, "#ffd23f"); },
    chef: () => { R(x - 1 + s, y - 9, 4, 1, "#ffffff"); R(x - 2 + s, y - 11, 6, 2, "#f0f0f0"); },
    beret: () => { R(x - 2 + s, y - 9, 5, 1, "#3a5a2a"); R(x - 1 + s, y - 10, 4, 1, "#3a5a2a"); },
    straw: () => { R(x - 3 + s, y - 9, 8, 1, "#e8c870"); R(x - 1 + s, y - 10, 4, 1, "#e8c870"); R(x - 1 + s, y - 9, 4, 1, "#c8323a"); },
    shell: () => { R(x - 1 + s, y - 10, 4, 2, "#ffc8b8"); R(x + s, y - 10, 1, 2, "#c87a6a"); R(x + 2 + s, y - 10, 1, 2, "#c87a6a"); },
    tricorn: () => { R(x - 3 + s, y - 9, 8, 1, "#1a1a20"); R(x - 1 + s, y - 10, 4, 1, "#1a1a20"); R(x + 1 + s, y - 10, 1, 1, "#ffd23f"); },
    horns: () => { R(x - 2 + s, y - 10, 1, 2, "#2a2028"); R(x + 3 + s, y - 10, 1, 2, "#2a2028"); R(x - 3 + s, y - 11, 1, 1, "#2a2028"); R(x + 4 + s, y - 11, 1, 1, "#2a2028"); },
    crown: () => { R(x - 1 + s, y - 9, 4, 1, "#ffd23f"); R(x - 1 + s, y - 10, 1, 1, "#ffd23f"); R(x + 1 + s, y - 11, 1, 2, "#ffd23f"); R(x + 2 + s, y - 10, 1, 1, "#ffd23f"); R(x + s, y - 9, 1, 1, "#ff3b3b"); }
  };
  (hats[look.hat] || (() => {}))();
  if (look.extra === "beard") R(x + s, y - 5, 3, 2, "#e8e0d0");
  if (look.extra === "monocle") R(x + 2 + s, y - 7, 1, 1, "#ffd23f");
  if (look.extra === "mustache") R(x + s, y - 6, 3, 1, "#3a2a1a");
  if (look.extra === "eyepatch") R(x + 1 + s, y - 7, 1, 1, "#1a1a20");
}
