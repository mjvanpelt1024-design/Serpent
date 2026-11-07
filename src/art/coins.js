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

/* Each coin is a picture, textures/coins/<island>-<tails|heads>-<size>.png (coin:<island>:<side>:<size>),
   painted in key colors that stand for shades of the island's money color (its currency's "color" in
   content/campaign/islands): the game swaps them for the real thing. See textures/README.md. */
const COIN_KEYS = { face: 0, rim: -0.42, rimLit: 0.1, lit: 0.45, dark: -0.28, deep: -0.5, glow: 0.12 };
const coinColors = face => Object.fromEntries(Object.entries(COIN_KEYS).map(([k, v]) => [k, v ? shadeHex(face, v) : face]));
const coinCache = {};
/* A coin of `size` pixels (12 for money, 20 in the top bar, 32 for the card), "tails" or "heads" */
function coinCanvas(isl, side = "tails", size = 12) {
  const key = [isl, side, size].join(":");
  if (coinCache[key]) return coinCache[key];
  const c = document.createElement("canvas");
  c.width = c.height = size;
  texPaint(c.getContext("2d"), `coin:${isl}:${side}:${size}`, 0, 0, { colors: coinColors(CAMP.islandById[isl].currency.color) });
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
