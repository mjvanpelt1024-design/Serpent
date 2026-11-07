/* =========================================================
   src/campaign/camp-art.js
   Pictures for the campaign's items, loot and upgrades: 12 x 12 PNGs in
   textures/ (items/, junk/, crafted/, upgrades/), drawn the way every
   other icon in the game is (src/engine/render/pixel-icons.js).
   Also the familiars as they trot along the board.
   ========================================================= */
"use strict";

const RUNE_COLORS = { plenty: "#3ddc84", stillness: "#7fe3ff", fortune: "#ffd23f", fury: "#ff3b3b", echo: "#b36bff" };

/* An item's picture in a little rarity-colored tile. A rune shows its condition: chipped,
   cracked, as carved, or polished and shining (src/campaign/camp-runes.js). */
function campItemIconHtml(it, cls = "") {
  const color = CAMP.itemById[it.id] ? rarityColor(it.rarity) : "#8a8070";
  const rune = CAMP.itemById[it.id] && CAMP.itemById[it.id].family === "rune";
  const src = rune ? runeIconUrl(it, 3) : iconUrl("ci:" + it.id, 3);
  return `<span class="ci-icon ${cls}${rune ? " rune-" + runeGradeId(it) : ""}" style="--rc:${color}"><img src="${src}" alt="" draggable="false"></span>`;
}
const campIconUrl = (id, scale = 3) => iconUrl("ci:" + id, scale);
const campUpIconUrl = (icon, scale = 2) => iconUrl("cu:" + icon, scale);

/* ----- The familiars: pet:<id>:<size> pictures in textures/familiars/, one for each size the game shows
   them at (16 on the board, 12 at home and in the shop, 20 and 32 in the den: pixel art is drawn for its
   size), scaled from the board's 16 when the squares are smaller. Their frames: the crab's claw up and
   down, the firefly's wings up and down, the turtle with its shells ready and spent. The firefly's
   glowing body is drawn here, its glow and all. ----- */
const PET_SIZES = [12, 16, 20, 32];
const PET_FRAME = {
  firefly: ts => Math.sin(ts / 40) > 0 ? 0 : 1,
  crab: ts => Math.sin(ts / 150) > 0 ? 0 : 1,
  turtle: (ts, P) => P && P.shells > 0 ? 0 : 1
};
function drawPetSprite(g, id, x, y, w, ts, P) {
  const size = PET_SIZES.includes(w) ? w : 16;
  g.save();
  if (id === "firefly") {
    g.shadowColor = "#ffe86a"; g.shadowBlur = w * (0.6 + 0.4 * Math.sin(ts / 120));
    g.fillStyle = "#ffe86a"; g.fillRect(x + w * 0.35, y + w * 0.45, w * 0.3, w * 0.3);
    g.shadowBlur = 0;
  }
  if (TextureLoader.has(`pet:${id}:${size}`)) texBoard(g, `pet:${id}:${size}`, x, y, w / size, PET_FRAME[id] ? PET_FRAME[id](ts, P) : 0);
  // a familiar with no board sprite sheet yet (build 52's) is drawn from its 12 x 12 picture, bobbing
  else if (TextureLoader.has(`ci:${id}`)) { g.imageSmoothingEnabled = false; g.drawImage(texCanvas(`ci:${id}`), Math.round(x), Math.round(y + (Math.sin(ts / 200) > 0 ? -1 : 0)), Math.round(w), Math.round(w)); }
  g.restore();
}

function campShade(hex, amt) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  if (!Number.isFinite(n)) return hex;
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
