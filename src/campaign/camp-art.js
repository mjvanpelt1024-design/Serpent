/* =========================================================
   src/campaign/camp-art.js
   Pixel art for the campaign: item icons, the shopkeepers' portraits
   and the little icons the upgrade trees use. Everything is drawn on a
   16 x 16 grid and scaled, so it stays crisp at any size.
   ========================================================= */
"use strict";

function px16(g, x, y, w) {
  const u = w / 16;
  return (a, b, c, d, color) => { g.fillStyle = color; g.fillRect(x + a * u, y + b * u, c * u, d * u); };
}

const RUNE_COLORS = { plenty: "#3ddc84", stillness: "#7fe3ff", fortune: "#ffd23f", fury: "#ff3b3b", echo: "#b36bff" };

/* One item's picture */
function drawItemArt(g, id, x, y, w, ts = 0) {
  const R = px16(g, x, y, w);
  switch (id) {
    case "shield": R(3, 2, 10, 8, "#9aa3ad"); R(4, 10, 8, 2, "#9aa3ad"); R(5, 12, 6, 1, "#9aa3ad"); R(6, 13, 4, 1, "#9aa3ad"); R(4, 3, 8, 7, "#3a6ab8"); R(7, 3, 2, 10, "#ffd23f"); R(4, 6, 8, 2, "#ffd23f"); break;
    case "sword": R(7, 1, 2, 9, "#dfe6ee"); R(8, 1, 1, 9, "#9aa3ad"); R(4, 10, 8, 2, "#c8a04a"); R(7, 12, 2, 3, "#6a4a2a"); R(6, 15, 4, 1, "#c8a04a"); break;
    case "helm": R(3, 3, 10, 9, "#9aa3ad"); R(4, 2, 8, 1, "#9aa3ad"); R(3, 7, 10, 2, "#2a2e36"); R(7, 9, 2, 4, "#9aa3ad"); R(7, 0, 2, 3, "#c8323a"); R(4, 4, 2, 2, "#dfe6ee"); break;
    case "cloak": R(5, 2, 6, 2, "#c8401a"); R(4, 4, 8, 10, "#e85a2a"); R(3, 8, 10, 6, "#e85a2a"); R(7, 4, 2, 10, "#ff9a3a"); R(5, 2, 1, 1, "#ffd23f"); R(10, 2, 1, 1, "#ffd23f"); break;
    case "thorns": R(4, 3, 8, 10, "#5a6a4a"); R(3, 5, 10, 6, "#5a6a4a"); [[2, 4], [13, 6], [2, 9], [13, 11], [6, 1], [9, 14]].forEach(([a, b]) => R(a, b, 1, 1, "#e8e0c8")); R(6, 6, 4, 4, "#3f7a2a"); break;
    case "forcefield": g.save(); g.strokeStyle = "#7fe3ff"; g.lineWidth = w / 10; g.globalAlpha = 0.9; g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.36, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.25; g.fillStyle = "#7fe3ff"; g.fill(); g.restore(); R(6, 6, 4, 4, "#ffffff"); break;
    case "fireball": R(5, 6, 7, 7, "#ff6a1a"); R(6, 7, 5, 5, "#ffd23f"); R(3, 4, 3, 3, "#ff6a1a"); R(2, 2, 2, 2, "#ff9a3a"); R(8, 8, 2, 2, "#ffffff"); break;
    case "blink": R(3, 7, 3, 2, "#b36bff"); R(7, 5, 2, 6, "#b36bff"); R(10, 3, 3, 10, "#d8b0ff"); R(11, 6, 1, 4, "#ffffff"); break;
    case "frost": R(7, 1, 2, 14, "#bfe8ff"); R(1, 7, 14, 2, "#bfe8ff"); R(4, 4, 2, 2, "#bfe8ff"); R(10, 4, 2, 2, "#bfe8ff"); R(4, 10, 2, 2, "#bfe8ff"); R(10, 10, 2, 2, "#bfe8ff"); R(7, 7, 2, 2, "#ffffff"); break;
    case "magnet": R(3, 3, 3, 8, "#ff3b3b"); R(10, 3, 3, 8, "#ff3b3b"); R(3, 11, 10, 3, "#ff3b3b"); R(3, 3, 3, 2, "#dfe6ee"); R(10, 3, 3, 2, "#dfe6ee"); R(7, 1, 2, 2, "#ff2b2b"); break;
    case "stew": R(2, 8, 12, 5, "#8a5a3a"); R(3, 13, 10, 1, "#6a4a2a"); R(3, 7, 10, 2, "#c86a2a"); R(5, 7, 2, 1, "#3ddc84"); R(9, 7, 2, 1, "#ff9a3a"); R(5, 3, 1, 3, "rgba(255,255,255,0.5)"); R(9, 2, 1, 4, "rgba(255,255,255,0.5)"); break;
    case "bread": R(2, 6, 12, 7, "#d8a050"); R(3, 5, 10, 2, "#e8b868"); R(4, 7, 2, 1, "#a8703a"); R(8, 7, 2, 1, "#a8703a"); R(10, 3, 4, 3, "#ffcf3f"); break;
    case "pie": R(2, 8, 12, 5, "#c8883a"); R(3, 6, 10, 3, "#e8a850"); R(5, 7, 1, 1, "#8a3a5a"); R(8, 7, 1, 1, "#8a3a5a"); R(11, 7, 1, 1, "#8a3a5a"); R(11, 2, 3, 4, "#9aa3ad"); R(12, 1, 1, 6, "#6a6e76"); break;
    case "jerky": R(3, 4, 10, 3, "#8a3a1a"); R(4, 8, 9, 3, "#a84a2a"); R(2, 12, 10, 2, "#8a3a1a"); R(6, 5, 1, 1, "#ff6a1a"); R(9, 9, 1, 1, "#ff6a1a"); break;
    case "tart": R(2, 9, 12, 4, "#d8a050"); R(3, 7, 10, 3, "#ff6a1a"); R(5, 5, 6, 3, "#ffb020"); R(7, 2, 2, 4, "#ffd23f"); R(6, 3, 1, 2, "#ff6a1a"); R(9, 3, 1, 2, "#ff6a1a"); break;
    case "firefly": case "crab": case "turtle": case "puffer": case "seahorse": drawPetSprite(g, id, x + w * 0.05, y + w * 0.05, w * 0.9, ts, { shells: 1 }); break;
    case "plenty": case "stillness": case "fortune": case "fury": case "echo": {
      R(3, 2, 10, 12, "#4a4450"); R(4, 1, 8, 1, "#4a4450"); R(4, 3, 8, 10, "#5a5460");
      const c = RUNE_COLORS[id];
      if (id === "plenty") { R(7, 4, 2, 8, c); R(5, 6, 6, 2, c); }
      else if (id === "stillness") { R(5, 5, 6, 1, c); R(5, 8, 6, 1, c); R(5, 11, 6, 1, c); }
      else if (id === "fortune") { R(6, 4, 4, 2, c); R(5, 6, 6, 4, c); R(7, 10, 2, 2, c); }
      else if (id === "fury") { R(5, 4, 2, 4, c); R(7, 6, 2, 4, c); R(9, 8, 2, 4, c); }
      else { R(5, 4, 6, 1, c); R(5, 4, 1, 8, c); R(5, 11, 6, 1, c); R(8, 7, 3, 1, c); }
      break;
    }
    default: drawLootArt(g, id, x, y, w);
  }
}

function drawLootArt(g, id, x, y, w) {
  const R = px16(g, x, y, w);
  const looks = {
    buckle: () => { R(3, 4, 10, 8, "#8a6a4a"); R(5, 6, 6, 4, "#2a2e36"); R(7, 4, 2, 8, "#a8885a"); },
    horseshoe: () => { R(3, 3, 3, 10, "#9aa3ad"); R(10, 3, 3, 10, "#9aa3ad"); R(3, 11, 10, 2, "#9aa3ad"); R(4, 5, 1, 1, "#2a2e36"); R(11, 5, 1, 1, "#2a2e36"); },
    goblet: () => { R(4, 2, 8, 6, "#c8a04a"); R(7, 8, 2, 4, "#c8a04a"); R(5, 12, 6, 2, "#c8a04a"); R(9, 3, 2, 2, "#8a6a2a"); },
    quill: () => { R(9, 1, 4, 8, "#f0f0f0"); R(7, 7, 3, 3, "#d8d8d8"); R(4, 10, 3, 4, "#2a2a4a"); },
    crystal: () => { R(6, 2, 4, 12, "#b8d8f0"); R(5, 5, 6, 6, "#d8ecff"); R(7, 4, 1, 4, "#ffffff"); },
    wand: () => { R(3, 11, 6, 2, "#6a4a2a"); R(9, 5, 2, 6, "#6a4a2a"); R(10, 3, 3, 3, "#ffd23f"); },
    acorn: () => { R(4, 3, 8, 4, "#8a5a2a"); R(5, 7, 6, 6, "#ffd23f"); R(7, 1, 2, 2, "#6a4a2a"); },
    jar: () => { R(4, 4, 8, 10, "#c83a5a"); R(4, 2, 8, 2, "#c8a04a"); R(5, 6, 2, 4, "#ff8aa0"); },
    spoon: () => { R(6, 2, 4, 5, "#dfe6ee"); R(7, 7, 2, 7, "#dfe6ee"); },
    shell: () => { R(3, 6, 10, 7, "#ffb0a0"); R(5, 4, 6, 3, "#ffc8b8"); R(7, 6, 1, 7, "#c87a6a"); R(10, 7, 1, 5, "#c87a6a"); },
    doubloon: () => { R(4, 4, 8, 8, "#d8a020"); R(5, 5, 6, 6, "#ffd23f"); R(7, 6, 2, 4, "#a87a10"); },
    compass: () => { R(3, 3, 10, 10, "#6a5a3a"); R(4, 4, 8, 8, "#e8e0c8"); R(7, 5, 2, 3, "#c8323a"); R(7, 8, 2, 3, "#2a2e36"); },
    ember: () => { R(5, 5, 6, 7, "#ff6a1a"); R(6, 6, 4, 4, "#ffd23f"); R(7, 3, 2, 2, "#ff9a3a"); },
    obsidian: () => { R(5, 2, 6, 12, "#2a2030"); R(4, 5, 8, 6, "#3a3040"); R(6, 4, 1, 5, "#8a7aa0"); },
    scale: () => { R(3, 4, 10, 8, "#c8401a"); R(5, 3, 6, 2, "#e85a2a"); R(5, 12, 6, 1, "#8a2a0a"); R(6, 6, 4, 3, "#ff9a3a"); }
  };
  (looks[id] || (() => { R(4, 4, 8, 8, "#c8ced6"); }))();
}

/* Cached icon images for the menus */
const campIconCache = new Map();
function campIconUrl(id, size = 48) {
  const k = id + ":" + size;
  if (campIconCache.has(k)) return campIconCache.get(k);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  drawItemArt(g, id, 0, 0, size);
  const url = c.toDataURL();
  campIconCache.set(k, url);
  return url;
}

function campItemIconHtml(it, cls = "") {
  const color = CAMP.itemById[it.id] ? rarityColor(it.rarity) : "#8a8070";
  return `<span class="ci-icon ${cls}" style="--rc:${color}"><img src="${campIconUrl(it.id)}" alt="" draggable="false"></span>`;
}

/* ----- Upgrade icons ----- */
function drawUpgradeArt(g, icon, x, y, w) {
  const R = px16(g, x, y, w);
  const map = {
    apple: () => { R(4, 5, 8, 8, "#ff2b2b"); R(5, 4, 6, 1, "#ff2b2b"); R(8, 2, 1, 3, "#6a4a2a"); R(9, 2, 3, 2, "#3ddc3d"); R(5, 6, 2, 2, "#ff8a8a"); },
    tree: () => { R(3, 2, 10, 8, "#3f8a3a"); R(7, 10, 2, 5, "#6a4a2a"); R(5, 4, 2, 2, "#ff2b2b"); R(9, 6, 2, 2, "#ff2b2b"); },
    star: () => { R(7, 1, 2, 14, "#ffd23f"); R(1, 6, 14, 3, "#ffd23f"); R(4, 4, 8, 8, "#ffd23f"); },
    heart: () => { R(2, 4, 5, 5, "#ff4d5a"); R(9, 4, 5, 5, "#ff4d5a"); R(3, 9, 10, 2, "#ff4d5a"); R(5, 11, 6, 2, "#ff4d5a"); R(7, 13, 2, 1, "#ff4d5a"); R(3, 5, 2, 2, "#ff9aa0"); },
    coin: () => { R(4, 3, 8, 10, "#d8a020"); R(3, 5, 10, 6, "#d8a020"); R(5, 4, 6, 8, "#ffd23f"); R(7, 5, 2, 6, "#a87a10"); },
    golden: () => { R(4, 5, 8, 8, "#ffd23f"); R(5, 4, 6, 1, "#ffd23f"); R(8, 2, 1, 3, "#6a4a2a"); R(5, 6, 2, 2, "#fff4b0"); },
    armor: () => { R(3, 2, 10, 7, "#9aa3ad"); R(4, 9, 8, 3, "#9aa3ad"); R(6, 12, 4, 2, "#9aa3ad"); R(5, 3, 3, 3, "#dfe6ee"); },
    clock: () => { R(3, 3, 10, 10, "#e8e0c8"); R(4, 2, 8, 1, "#8a7a5a"); R(7, 5, 2, 4, "#2a2e36"); R(8, 8, 3, 1, "#2a2e36"); },
    rock: () => { R(3, 6, 10, 7, "#9a9a9a"); R(5, 4, 6, 2, "#b9b9b9"); R(5, 7, 2, 2, "#d0d0d0"); },
    wasp: () => { R(4, 6, 8, 5, "#ffcf33"); R(6, 6, 2, 5, "#1a1410"); R(9, 6, 1, 5, "#1a1410"); R(5, 3, 3, 3, "rgba(220,240,255,0.9)"); R(9, 3, 3, 3, "rgba(220,240,255,0.9)"); },
    molasses: () => { R(3, 8, 10, 5, "#a8661e"); R(5, 5, 6, 3, "#c8862e"); R(7, 3, 2, 2, "#c8862e"); },
    spell: () => drawItemArt(g, "fireball", x, y, w),
    shield: () => drawItemArt(g, "shield", x, y, w),
    food: () => drawItemArt(g, "stew", x, y, w),
    loot: () => drawLootArt(g, "goblet", x, y, w),
    stamina: () => { R(2, 6, 12, 5, "#2a2e36"); R(3, 7, 7, 3, "#3ddc84"); R(14, 7, 1, 3, "#2a2e36"); },
    fang: () => { R(4, 2, 3, 9, "#f0f0f0"); R(5, 11, 1, 3, "#f0f0f0"); R(9, 2, 3, 9, "#f0f0f0"); R(10, 11, 1, 3, "#f0f0f0"); },
    pet: () => drawPetSprite(g, "turtle", x, y, w, 0, { shells: 1 }),
    chest: () => { R(2, 6, 12, 8, "#8a5a2a"); R(2, 4, 12, 3, "#a87a3a"); R(7, 7, 2, 3, "#ffd23f"); R(2, 9, 12, 1, "#6a4a1a"); },
    gem: () => { R(4, 3, 8, 3, "#5ad8ff"); R(3, 6, 10, 2, "#38bdf8"); R(5, 8, 6, 3, "#2a9ad8"); R(7, 11, 2, 2, "#1a7ab8"); R(5, 4, 2, 1, "#ffffff"); },
    rune: () => drawItemArt(g, "fortune", x, y, w),
    crown: () => { R(2, 6, 12, 7, "#ffd23f"); R(2, 3, 2, 3, "#ffd23f"); R(7, 2, 2, 4, "#ffd23f"); R(12, 3, 2, 3, "#ffd23f"); R(7, 8, 2, 2, "#ff3b3b"); }
  };
  (map[icon] || map.star)();
}

const campUpIconCache = new Map();
function campUpIconUrl(icon, size = 40) {
  const k = icon + ":" + size;
  if (campUpIconCache.has(k)) return campUpIconCache.get(k);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  drawUpgradeArt(c.getContext("2d"), icon, 0, 0, size);
  const url = c.toDataURL();
  campUpIconCache.set(k, url);
  return url;
}

/* A gem, for prices */
function gemIconHtml() { return `<img class="gem-ico" src="${campUpIconUrl("gem", 32)}" alt="gems">`; }
/* An island's coin, tinted its currency color */
function coinIconHtml(isl) { return `<span class="coin-ico" style="--cc:${campCurrency(isl).color}"></span>`; }

/* ----- Shopkeepers: a snake bust with a hat that says what they do ----- */
function drawPortrait(g, look, x, y, w, ts = 0) {
  const R = px16(g, x, y, w);
  const body = look.body, belly = look.belly;
  const blink = Math.floor(ts / 2600) % 7 === 0 && (ts % 2600) < 140;
  const sway = Math.round(Math.sin(ts / 700) * 0.6);
  // coiled body
  R(2, 12, 12, 4, body); R(1, 13, 14, 3, body); R(4, 12, 8, 2, campShade(body, -0.15));
  // neck and head
  R(6 + sway, 7, 4, 6, body); R(7 + sway, 8, 2, 5, belly);
  R(4 + sway, 3, 8, 5, body); R(5 + sway, 2, 6, 1, body); R(5 + sway, 7, 6, 1, belly);
  // eyes
  if (blink) { R(5 + sway, 5, 2, 1, "#1a1410"); R(9 + sway, 5, 2, 1, "#1a1410"); }
  else { R(5 + sway, 4, 2, 2, look.eye || "#ffd23f"); R(9 + sway, 4, 2, 2, look.eye || "#ffd23f"); R(6 + sway, 4, 1, 2, "#1a1410"); R(10 + sway, 4, 1, 2, "#1a1410"); }
  // tongue, now and then
  if ((ts / 1000) % 4 < 0.35) { R(7 + sway, 8, 2, 1, "#ff3b5a"); R(7 + sway, 9, 1, 1, "#ff3b5a"); R(9 + sway, 9, 1, 1, "#ff3b5a"); }
  const s = sway;
  const hats = {
    helm: () => { R(3 + s, 1, 10, 3, "#9aa3ad"); R(4 + s, 0, 8, 1, "#9aa3ad"); R(7 + s, -1, 2, 2, "#c8323a"); R(3 + s, 3, 1, 3, "#9aa3ad"); R(12 + s, 3, 1, 3, "#9aa3ad"); },
    hennin: () => { R(5 + s, 0, 6, 2, "#ffd23f"); R(6 + s, -3, 4, 3, "#c8508a"); R(7 + s, -5, 2, 2, "#c8508a"); R(9 + s, -4, 4, 1, "rgba(255,255,255,0.7)"); },
    tophat: () => { R(4 + s, 1, 8, 1, "#1a1a20"); R(5 + s, -3, 6, 4, "#1a1a20"); R(5 + s, 0, 6, 1, "#c8323a"); },
    wizard: () => { R(3 + s, 1, 10, 1, "#3a3aa8"); R(5 + s, -1, 6, 2, "#3a3aa8"); R(6 + s, -3, 4, 2, "#3a3aa8"); R(7 + s, -5, 2, 2, "#3a3aa8"); R(6 + s, 0, 1, 1, "#ffd23f"); R(9 + s, -2, 1, 1, "#ffd23f"); },
    hood: () => { R(3 + s, 1, 10, 3, campShade(body, -0.35)); R(2 + s, 3, 1, 5, campShade(body, -0.35)); R(13 + s, 3, 1, 5, campShade(body, -0.35)); R(5 + s, 0, 6, 1, campShade(body, -0.35)); },
    fez: () => { R(5 + s, -1, 6, 3, "#c8323a"); R(10 + s, 0, 2, 1, "#ffd23f"); R(11 + s, 1, 1, 2, "#ffd23f"); },
    chef: () => { R(4 + s, 1, 8, 2, "#ffffff"); R(4 + s, -2, 8, 3, "#f0f0f0"); R(3 + s, -1, 3, 2, "#f0f0f0"); R(10 + s, -1, 3, 2, "#f0f0f0"); },
    beret: () => { R(3 + s, 1, 9, 2, "#3a5a2a"); R(4 + s, 0, 7, 1, "#3a5a2a"); R(10 + s, 0, 2, 1, "#ffd23f"); },
    straw: () => { R(2 + s, 2, 12, 1, "#e8c870"); R(5 + s, 0, 6, 2, "#e8c870"); R(5 + s, 1, 6, 1, "#c8323a"); },
    shell: () => { R(5 + s, -1, 6, 3, "#ffc8b8"); R(6 + s, 0, 1, 2, "#c87a6a"); R(9 + s, 0, 1, 2, "#c87a6a"); R(4 + s, 1, 1, 1, "#ffc8b8"); },
    tricorn: () => { R(3 + s, 1, 10, 2, "#1a1a20"); R(5 + s, -1, 6, 2, "#1a1a20"); R(2 + s, 2, 2, 1, "#1a1a20"); R(12 + s, 2, 2, 1, "#1a1a20"); R(7 + s, 0, 2, 1, "#ffd23f"); },
    horns: () => { R(3 + s, 0, 2, 3, "#2a2028"); R(2 + s, -2, 2, 2, "#2a2028"); R(11 + s, 0, 2, 3, "#2a2028"); R(12 + s, -2, 2, 2, "#2a2028"); },
    crown: () => { R(4 + s, 0, 8, 2, "#ffd23f"); R(4 + s, -2, 2, 2, "#ffd23f"); R(7 + s, -3, 2, 3, "#ffd23f"); R(10 + s, -2, 2, 2, "#ffd23f"); R(7 + s, 0, 2, 1, "#ff3b3b"); }
  };
  (hats[look.hat] || (() => {}))();
  const extras = {
    beard: () => { R(5 + s, 8, 6, 2, "#e8e0d0"); R(6 + s, 10, 4, 1, "#e8e0d0"); },
    monocle: () => { g.save(); g.strokeStyle = "#ffd23f"; g.lineWidth = w / 32; g.beginPath(); g.arc(x + (10 + s) * w / 16, y + 5 * w / 16, w * 0.09, 0, Math.PI * 2); g.stroke(); g.restore(); R(11 + s, 6, 1, 4, "#ffd23f"); },
    mustache: () => { R(4 + s, 7, 3, 1, "#3a2a1a"); R(9 + s, 7, 3, 1, "#3a2a1a"); R(6 + s, 6, 4, 1, "#3a2a1a"); },
    eyepatch: () => { R(5 + s, 4, 2, 2, "#1a1a20"); R(4 + s, 3, 8, 1, "#1a1a20"); }
  };
  (extras[look.extra] || (() => {}))();
}

function campShade(hex, amt) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  if (!Number.isFinite(n)) return hex;
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
