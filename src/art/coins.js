/* =========================================================
   src/art/coins.js
   Every island's coin, struck in pixels: a beaded rim, a face in the
   currency's color lit from the top left, and a carving raised out of it.
   Tails carries the island's mark (a castle tower, a star, a sheaf of
   wheat, a shell, a flame); heads carries a snake in the island's own
   hat. The money everywhere in the game shows tails.

   A little secret: click the coin in the top bar and it flips to heads,
   and a card says what the coin is and where it comes from (the
   currency's "tale" in content/campaign/islands). Esc or a click outside
   puts it away, and the coin flips back to tails.
   ========================================================= */
"use strict";

/* The marks, one letter per pixel: x raised, . flat */
const COIN_MARK = {
  keep: ["x.x.x", "xxxxx", "x.x.x", "xxxxx", "xx.xx"],
  spire: ["..x..", ".xxx.", "xxxxx", ".xxx.", ".x.x."],
  hollow: ["x.x.x", ".xxx.", "..x..", "..x..", ".x.x."],
  reef: ["x.x.x", "xxxxx", ".xxx.", ".xxx.", "..x.."],
  crown: ["..x..", ".xx..", ".xxx.", "xxxxx", ".xxx."]
};
/* The heads: a snake looking left in the island's hat. h hat, H hat's dark side, s scales, e eye, t tongue */
const COIN_HEAD = {
  keep: ["..hhhh..", ".hHHHHh.", ".hhhhhh.", "sssss...", "ssessss.", "sssssss.", "tsssss..", ".ssss..."],
  spire: ["....h...", "...hH...", "..hhHh..", ".hhhhhh.", "sssss...", "ssessss.", "tssssss.", ".ssss..."],
  hollow: [".hhhhh..", "hhhhhhh.", ".hHHHh..", "sssss...", "ssessss.", "sssssss.", "tsssss..", ".ssss..."],
  reef: ["h.h.h.h.", "hhhhhhh.", ".HHHHH..", "sssss...", "ssessss.", "sssssss.", "tsssss..", ".ssss..."],
  crown: ["h.....h.", "hh...hh.", ".hHHHh..", "sssss...", "ssessss.", "sssssss.", "tsssss..", ".ssss..."]
};
const COIN_HAT = { keep: ["#c9ced6", "#6e7886"], spire: ["#5a4ad8", "#2a1a8a"], hollow: ["#ffffff", "#c8c8c8"], reef: ["#ffc8b8", "#c87a6a"], crown: ["#2a2028", "#ff6a1a"] };

const coinCache = {};
/* A coin of `size` pixels (12 for money, 20 in the top bar, 32 for the card), "tails" or "heads" */
function coinCanvas(isl, side = "tails", size = 12) {
  const key = [isl, side, size].join(":");
  if (coinCache[key]) return coinCache[key];
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const face = CAMP.islandById[isl].currency.color;
  const pal = { k: "#1a1410", rim: shadeHex(face, -0.42), rimLit: shadeHex(face, 0.1), face, lit: shadeHex(face, 0.45), dark: shadeHex(face, -0.28), deep: shadeHex(face, -0.5) };
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
      // a beaded rim on the big coin
      const bead = big && Math.round(Math.atan2(y - cy, x - cx) / (Math.PI / 14)) % 2 === 0;
      px(x, y, bead ? (lit ? pal.lit : pal.face) : lit ? pal.rimLit : pal.rim);
    } else px(x, y, d < r * 0.45 && lit ? shadeHex(face, 0.12) : (x - cx) + (y - cy) > r * 0.9 ? pal.dark : face);
  }
  // the carving: raised pixels, a shine on their top-left edge and a shadow below-right
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
  // the shine across the face
  if (big) { px(Math.round(cx - r * 0.5), Math.round(cy - r * 0.55), "#ffffff"); px(Math.round(cx - r * 0.55) + 1, Math.round(cy - r * 0.55), pal.lit); }
  else px(Math.round(cx - r * 0.45), Math.round(cy - r * 0.45), "#ffffff");
  return (coinCache[key] = c);
}
const coinUrlCache = {};
function coinUrl(isl, side = "tails", size = 12) {
  const key = [isl, side, size].join(":");
  return coinUrlCache[key] || (coinUrlCache[key] = coinCanvas(isl, side, size).toDataURL());
}

/* Money everywhere is a struck coin, tails up */
window.coinHtml = function (key, size = 12) {
  return `<img class="coin" src="${coinUrl(key, "tails", size)}" alt="" aria-hidden="true" data-coin="${key}" data-size="${size}" draggable="false">`;
};

/* ----- The flip, and the card about the coin ----- */
let coinCard = null;          // { el, img, isl } while the card is open
function flipCoin(img, side) {
  img.classList.remove("flip");
  void img.offsetWidth;
  img.classList.add("flip");
  sfx("tick");
  // halfway through the turn the face changes: always to the side asked for last
  img.dataset.side = side;
  clearTimeout(img._flipT);
  img._flipT = setTimeout(() => { img.src = coinUrl(img.dataset.coin, img.dataset.side, +img.dataset.size || 12); }, 130);
}

function openCoinCard(img) {
  if (coinCard) closeCoinCard();
  const isl = img.dataset.coin, I = CAMP.islandById[isl], cur = I.currency;
  flipCoin(img, "heads");
  const el = document.createElement("div");
  el.className = "coin-card";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", cur.name);
  el.innerHTML = `<canvas class="cc-coin" width="32" height="32" aria-hidden="true"></canvas>
    <p class="cc-name">${escapeAttr(cur.name)}</p>
    <p class="cc-where">The money of ${escapeAttr(I.name)}</p>
    <p class="cc-tale">${escapeAttr(cur.tale || "")}</p>`;
  document.body.appendChild(el);
  el.querySelector(".cc-coin").getContext("2d").drawImage(coinCanvas(isl, "heads", 32), 0, 0);
  const r = img.getBoundingClientRect();
  const w = el.offsetWidth;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  el.style.top = (r.bottom + 10) + "px";
  coinCard = { el, img, isl };
}

function closeCoinCard() {
  if (!coinCard) return false;
  const { el, img } = coinCard;
  coinCard = null;
  el.remove();
  if (img.isConnected) flipCoin(img, "tails");
  return true;
}

document.addEventListener("click", e => {
  const img = e.target.closest && e.target.closest("#camp-wallet img.coin");
  if (img) { e.stopPropagation(); if (coinCard && coinCard.img === img) closeCoinCard(); else openCoinCard(img); return; }
  if (coinCard && !coinCard.el.contains(e.target)) closeCoinCard();
}, true);
document.addEventListener("keydown", e => {
  if (coinCard && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeCoinCard(); }
}, true);
