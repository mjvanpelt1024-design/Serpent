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

/* ----- The familiars, drawn on the board beside your snake ----- */
function drawPetSprite(g, id, x, y, w, ts, P) {
  g.save();
  if (id === "firefly") {
    g.shadowColor = "#ffe86a"; g.shadowBlur = w * (0.6 + 0.4 * Math.sin(ts / 120));
    g.fillStyle = "#ffe86a"; g.fillRect(x + w * 0.35, y + w * 0.45, w * 0.3, w * 0.3);
    g.shadowBlur = 0;
    g.fillStyle = "#3a3020"; g.fillRect(x + w * 0.35, y + w * 0.25, w * 0.3, w * 0.22);
    g.fillStyle = "rgba(220,240,255,0.8)"; g.fillRect(x + w * 0.1, y + w * 0.15 + (Math.sin(ts / 40) > 0 ? 0 : w * 0.08), w * 0.25, w * 0.15); g.fillRect(x + w * 0.65, y + w * 0.15 + (Math.sin(ts / 40) > 0 ? 0 : w * 0.08), w * 0.25, w * 0.15);
  } else if (id === "crab") {
    g.fillStyle = "#ff5a3a"; g.fillRect(x + w * 0.2, y + w * 0.4, w * 0.6, w * 0.35);
    g.fillRect(x, y + w * 0.2 + (Math.sin(ts / 150) > 0 ? 0 : w * 0.08), w * 0.2, w * 0.2); g.fillRect(x + w * 0.8, y + w * 0.2, w * 0.2, w * 0.2);
    g.fillStyle = "#fff"; g.fillRect(x + w * 0.32, y + w * 0.3, w * 0.1, w * 0.1); g.fillRect(x + w * 0.58, y + w * 0.3, w * 0.1, w * 0.1);
  } else if (id === "turtle") {
    const ready = P && P.shells > 0;
    g.fillStyle = "#7ac85a"; g.fillRect(x + w * 0.75, y + w * 0.45, w * 0.22, w * 0.2);
    g.fillStyle = ready ? "#3a8a3a" : "#6a6a6a"; g.fillRect(x + w * 0.1, y + w * 0.3, w * 0.65, w * 0.45);
    g.fillStyle = ready ? "#5ab05a" : "#8a8a8a"; g.fillRect(x + w * 0.22, y + w * 0.38, w * 0.4, w * 0.25);
  } else if (id === "puffer") {
    g.fillStyle = "#ffcf5a"; g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.36, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c89a2a"; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fillRect(x + w / 2 + Math.cos(a) * w * 0.42 - 1, y + w / 2 + Math.sin(a) * w * 0.42 - 1, 2, 2); }
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.58, y + w * 0.38, w * 0.1, w * 0.1);
  } else if (id === "seahorse") {
    g.fillStyle = "#ff9ac8"; g.fillRect(x + w * 0.35, y + w * 0.15, w * 0.35, w * 0.3); g.fillRect(x + w * 0.3, y + w * 0.4, w * 0.3, w * 0.35); g.fillRect(x + w * 0.42, y + w * 0.72, w * 0.18, w * 0.2);
    g.fillRect(x + w * 0.68, y + w * 0.22, w * 0.2, w * 0.1);
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.5, y + w * 0.22, w * 0.08, w * 0.08);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.36, y + w * 0.05, w * 0.2, w * 0.08);   // a tiny monocle chain, presumably
  }
  g.restore();
}

function campShade(hex, amt) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  if (!Number.isFinite(n)) return hex;
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
