/* =========================================================
   src/engine/render/pixel-icons.js
   12x12 pixel pictures for upgrades, items and places, drawn from
   the PNG files in textures/
   ========================================================= */
"use strict";

/* =========================================================
   Pixel icons: a little 12x12 picture for every upgrade, item and place.
   Each one is a PNG in textures/ (textures/index.json says which file),
   loaded before any script runs (src/engine/content/textures.js).

   A picture is drawn two ways:
     flat      exactly as the file is, on the board and in the painted
               scenes: texCanvas(id) for a canvas, texUrl(id) for an <img>
     in menus  iconUrl(id, scale): lit from the top left. Every color
               except the outline (#1a1410) and pure white brightens
               along its top and left edges and darkens along its bottom
               and right ones, so flat shapes read as little solid things.
               An index entry can change that: "keep" lists more colors to
               leave alone, "ink" more colors that count as outline,
               "menu" names a file to show as it is instead, and "badge"
               puts a corner mark (textures/icons/badges/) over it.
   ========================================================= */
const ICON_INK = "#1a1410", ICON_SPARK = "#ffffff";

/* What picture each old-style upgrade and item gets: [picture, corner mark], from its content
   file (icon, badge). Everything else has its own entry in textures/index.json. */
const ICON_FOR = {};
(function iconsFromContent() {
  const spec = rec => (rec.icon ? [String(rec.icon), rec.badge ? String(rec.badge) : null] : null);
  CONTENT.greatTree.concat(...MODE_KEYS.map(a => CONTENT.worlds[a].upgrades)).forEach(u => { const s = spec(u); if (s) ICON_FOR[u.id] = s; });
  CONTENT.items.forEach(it => { const s = spec(it); if (s) ICON_FOR["item:" + it.id] = s; });
})();

const iconCache = {};
const texWarned = {};
const texOnce = (key, message) => { if (!texWarned[key]) { texWarned[key] = true; console.warn(message); } };
/* The index entry and corner mark for a picture id, or null if there's no such picture */
function texResolve(id) {
  const e = TextureLoader.entry(id);
  if (e) return { e, badge: e.badge || null };
  const spec = ICON_FOR[id];
  const base = spec && TextureLoader.entry(spec[0]);
  return base ? { e: base, badge: spec[1] || null } : null;
}
/* A picture's file as a canvas: the checkerboard if the file is missing or broken */
const texBroken = {};
function texFileCanvas(file) {
  const p = TextureLoader.pic(file);
  if (p) return p.canvas;
  return texBroken[file] || (texBroken[file] = TextureLoader.placeholder());
}
/* What to draw for an id the index doesn't know: the fallback picture, with a warning once */
function texMissing(id, fallback) {
  texOnce("id:" + id, `Texture "${id}": not in textures/index.json, showing "${fallback}" instead`);
  return texResolve(fallback);
}
/* A picture, flat, as a canvas (draw it with imageSmoothingEnabled = false) */
function texCanvas(id, fallback = "orb") {
  const r = texResolve(id) || texMissing(id, fallback);
  return r ? texFileCanvas(r.e.file) : TextureLoader.placeholder();
}
/* A picture, flat, as a URL for an <img>: its own file when it's served, a data URL otherwise */
const texUrlCache = {};
function texUrl(id, fallback = "orb") {
  if (texUrlCache[id]) return texUrlCache[id];
  const r = texResolve(id) || texMissing(id, fallback);
  const p = r && TextureLoader.pic(r.e.file);
  return (texUrlCache[id] = p && p.url ? p.url : (r ? texFileCanvas(r.e.file) : TextureLoader.placeholder()).toDataURL());
}

/* Lighter (k > 0) or darker (k < 0), for the icons' light and shade */
const iconShade = (v, k) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
const hexRgb = hex => { const n = parseInt(String(hex).replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/* The light and shade, worked out from the picture's pixels (RGBA, w x h) */
function iconLight(px, w, h, opts = {}) {
  const key = (d, i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
  const set = list => new Set(list.map(hex => { const [r, g, b] = hexRgb(hex); return (r << 16) | (g << 8) | b; }));
  const ink = set([ICON_INK].concat(opts.ink || [])), keep = set([ICON_SPARK].concat(opts.keep || []));
  const kind = new Uint8Array(w * h);                 // 0 clear, 1 outline, 2 left alone, 3 lit or shaded
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3], k = key(px, i * 4);
    kind[i] = !a ? 0 : ink.has(k) ? 1 : keep.has(k) ? 2 : 3;
  }
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
/* A picture's pixels, read once (they never change while the game runs) */
const texPixelCache = new WeakMap();
const pixelsOf = c => texPixelCache.get(c) || (texPixelCache.set(c, c.getContext("2d").getImageData(0, 0, c.width, c.height).data), texPixelCache.get(c));

/* A data URL for a thing's picture in a menu, lit, drawn once */
function iconUrl(id, scale = 1) {
  const cacheKey = id + "@" + scale;
  if (iconCache[cacheKey]) return iconCache[cacheKey];
  const r = texResolve(id) || texMissing(id, "orb");
  const flat = r ? texFileCanvas(r.e.file) : TextureLoader.placeholder();
  const w = flat.width, h = flat.height;
  let px;
  if (r && r.e.menu) px = new Uint8ClampedArray(pixelsOf(texFileCanvas(r.e.menu)));
  else if (r && TextureLoader.pic(r.e.file) && r.e.light !== false) px = iconLight(pixelsOf(flat), w, h, r.e);
  else px = new Uint8ClampedArray(pixelsOf(flat));
  if (r && r.badge && !TextureLoader.has("badge:" + r.badge)) texOnce("badge:" + r.badge, `Texture "${id}": no corner mark called "${r.badge}" in textures/index.json`);
  else if (r && r.badge) {
    // knock out a little space in the corner, then draw the mark there
    const b = texCanvas("badge:" + r.badge), bp = pixelsOf(b), bx = w - b.width, by = h - b.height;
    for (let y = by; y < h; y++) for (let x = bx; x < w; x++) {
      const i = (y * w + x) * 4, j = ((y - by) * b.width + (x - bx)) * 4;
      for (let c = 0; c < 4; c++) px[i + c] = bp[j + 3] ? bp[j + c] : 0;
    }
  }
  // every pixel a scale x scale square
  const c = document.createElement("canvas");
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext("2d");
  const big = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4, j = ((Math.floor(y / scale)) * w + Math.floor(x / scale)) * 4;
    for (let k = 0; k < 4; k++) big.data[i + k] = px[j + k];
  }
  g.putImageData(big, 0, 0);
  return (iconCache[cacheKey] = c.toDataURL());
}

/* Fruit outlines. Upgrades are apples, one-time items are other fruit. */
const FRUIT_SHAPES = {
  apple: "M16 7c-2.2-1.6-5-2.2-7.6-1.2C4.5 7.3 3 11.6 3.6 15.8c.6 4.6 3.3 9.4 7.2 11.4 1.7.9 3.5.6 5.2-.2 1.7.8 3.5 1.1 5.2.2 3.9-2 6.6-6.8 7.2-11.4.6-4.2-.9-8.5-4.8-10C26 4.8 18.2 5.4 16 7z",
  pear: "M16 4.5c-2.6 0-4.2 2.2-4.4 4.8-.2 2.4-1.2 3.6-2.8 5.4C6.6 17 5.4 19.6 6 22.6c.8 4 4.8 6.4 10 6.4s9.2-2.4 10-6.4c.6-3-.6-5.6-2.8-7.9-1.6-1.8-2.6-3-2.8-5.4-.2-2.6-1.8-4.8-4.4-4.8z",
  orange: "M16 4.5C9.4 4.5 4 9.6 4 16.3S9.4 28 16 28s12-5 12-11.7S22.6 4.5 16 4.5z",
  plum: "M16 5c-5.8 0-11 4.6-11 11.4C5 23 10 28 16 28s11-5 11-11.6C27 9.6 21.8 5 16 5zM16 6.5c-.6 4-.6 15 0 21",
  lemon: "M16 6c-5 0-9.6 3.2-11.4 7.4-.6 1.4-1.6 2.2-2.6 2.6 1 .4 2 1.2 2.6 2.6C6.4 22.8 11 26 16 26s9.6-3.2 11.4-7.4c.6-1.4 1.6-2.2 2.6-2.6-1-.4-2-1.2-2.6-2.6C25.6 9.2 21 6 16 6z",
  berry: "M16 7.5c-3.4-2-9.6-1.6-11 3-1.6 5.2 4 13.6 11 17.5 7-3.9 12.6-12.3 11-17.5-1.4-4.6-7.6-5-11-3z",
  // a root's bulb, for the roots under the islands (camp-roots.js): round, tapering to a tail, rootlets on top
  tuber: "M16 5C9.4 5 4.6 9.6 4.6 15.2c0 5.2 4.2 9 8.8 11.8L16 31l2.6-4c4.6-2.8 8.8-6.6 8.8-11.8C27.4 9.6 22.6 5 16 5z"
};
const ITEM_FRUIT = Object.fromEntries(CONTENT.items.map(it => [it.id, String(it.fruit || "apple")]));
const ITEM_COLOR = Object.fromEntries(CONTENT.items.map(it => [it.id, String(it.color || "#ffffff")]));

/* The inside of a fruit node: its outline (with a stem and leaf), and the picture in the middle */
function fruitSvg(shape) {
  const stem = shape === "apple" || shape === "pear"
    ? `<path class="fr-stem" d="M16 7.5c0-2 .4-3.6 1.6-5"/><path class="fr-leaf" d="M17.4 4.4c1.6-2.2 4.6-2.8 6.6-1.8-1 2.4-3.8 3.6-6.6 1.8z"/>`
    : shape === "orange" ? `<path class="fr-leaf" d="M16 5.2c1.2-2 3.8-2.8 5.8-2-1 2-3.4 3-5.8 2z"/>`
    : shape === "tuber" ? `<path class="fr-stem" d="M12.5 5.6C11.8 3.8 10.4 2.6 9 2M19.5 5.6c.7-1.8 2.1-3 3.5-3.6M16 5V1.4"/>` : "";
  return `<svg class="fr-shape" viewBox="0 0 32 32" aria-hidden="true"><path class="fr-body" d="${FRUIT_SHAPES[shape]}"/><path class="fr-shine" d="M9 11.5c.6-2 2-3.2 3.6-3.6"/>${stem}</svg>`;
}
function fruitInner(shape, icon) {
  return fruitSvg(shape) + `<img class="fr-icon" src="${iconUrl(icon, 2)}" alt="" draggable="false">`;
}
