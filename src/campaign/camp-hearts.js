/* =========================================================
   src/campaign/camp-hearts.js
   Your hearts and armor in the HUD, as 12 x 12 pixel pictures in the
   style of every other icon (src/engine/render/pixel-icons.js).

   Every slot is one heart, and each half of it is colored on its own:
     red     a heart of yours
     gold    a heart of yours with an armor plate over it
     silver  an armor plate where you have no heart
     purple  a heart from a heart canister
     violet  a plate of a canister's shiny purple armor
     empty   a shadow: a heart you've lost, or one you could still grow
   The row always shows as many slots as anyone can have (the shadows
   are the ones you don't have), and your rune sits under it, with what
   it does beside it (src/campaign/camp-runes.js).
   A plate has four pieces: it shows a dent, then a crack, then only
   its left half, then it's gone. Bosses use the same pictures.
   ========================================================= */
"use strict";

/* The heart, one letter per pixel: k outline, r body, w shine, R shadow */
const HEART_ROWS = [
  "............",
  ".kkk....kkk.",
  "krrrk..krrrk",
  "krwrrkkrrrrk",
  "krwrrrrrrrRk",
  "krrrrrrrrrRk",
  ".krrrrrrrRk.",
  "..krrrrrRk..",
  "...krrrRk...",
  "....krRk....",
  ".....kk.....",
  "............"
];
const HEART_PALS = {
  red: { k: "#1a1410", r: "#ff3b3b", w: "#ffd0d0", R: "#a8202a" },
  gold: { k: "#3a2408", r: "#ffd23f", w: "#fff8d0", R: "#c08a10", m: "#fff0a0" },
  silver: { k: "#262a32", r: "#c9ced6", w: "#ffffff", R: "#6e7886", m: "#eef2f8" },
  purple: { k: "#1e0a30", r: "#b36bff", w: "#f0d8ff", R: "#6a2aa8" },
  violet: { k: "#24083a", r: "#e2b4ff", w: "#ffffff", R: "#9450e0", m: "#ffffff" },
  empty: { k: "rgba(8,6,4,0.62)", r: "rgba(8,6,4,0.3)", w: "rgba(8,6,4,0.3)", R: "rgba(8,6,4,0.36)" }
};
const heartArtCache = {};

/* A data URL for one slot. left/right: which palette each half uses. mark: "dent" | "crack" | "". */
function heartSlotUrl(left, right, mark = "", plated = [false, false]) {
  const key = [left, right, mark, plated.join("")].join(":");
  if (heartArtCache[key]) return heartArtCache[key];
  const c = document.createElement("canvas");
  c.width = 12; c.height = 12;
  const g = c.getContext("2d");
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  HEART_ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    const P = HEART_PALS[x < 6 ? left : right];
    px(x, y, P[ch] || P.r);
  }));
  // a plate: a seam across it and a rivet on each lobe, catching the light
  [0, 1].forEach(side => {
    if (!plated[side]) return;
    const P = HEART_PALS[side ? right : left];
    const x0 = side ? 6 : 1, x1 = side ? 11 : 6;
    for (let x = x0; x < x1; x++) if (HEART_ROWS[6][x] !== "." && HEART_ROWS[6][x] !== "k") px(x, 6, P.R);
    px(side ? 8 : 3, 4, P.m || P.w);
  });
  if (mark === "dent") {
    // a crater knocked into the right lobe, its lower lip catching the light
    const P = HEART_PALS[right];
    px(8, 3, P.R); px(9, 3, P.k); px(10, 3, P.R); px(8, 4, P.R); px(9, 4, P.R); px(9, 5, P.m || P.w); px(10, 5, P.m || P.w);
  } else if (mark === "crack") {
    // a split from the notch down through the plate, with a chip off its edge
    const P = HEART_PALS[right];
    [[7, 2], [7, 3], [6, 4], [7, 5], [8, 6], [7, 7], [9, 4], [10, 4]].forEach(([x, y]) => px(x, y, P.k));
    px(8, 3, P.m || P.w); px(8, 5, P.R); px(10, 2, P.R);
  }
  return (heartArtCache[key] = c.toDataURL());
}

/* One slot from what's in it: heart halves (0-2), armor pieces (0-4), and whose they are */
function heartSlotHtml({ heart = 0, armor = 0, purple = false, violet = false }, extra = "") {
  const P = CAMP.rules.snake.armorPieces || 4;
  const a = Math.round(armor * 4 / P);                     // as if a plate had four pieces
  const armL = a >= 1, armR = a >= 2;
  const plate = violet ? "violet" : heart > 0 ? "gold" : "silver";
  const own = purple ? "purple" : "red";
  const half = (has, arm) => has ? (arm ? (violet ? "violet" : "gold") : own) : (arm ? (violet ? "violet" : "silver") : "empty");
  const left = half(heart >= 1, armL), right = half(heart >= 2, armR);
  const mark = a === 3 ? "dent" : a === 2 ? "crack" : "";
  const cls = ["pheart", left === "empty" && right === "empty" ? "empty" : "", violet && (armL || armR) ? "shiny" : "", plate === "gold" && armL ? "golden" : "", extra].filter(Boolean).join(" ");
  return `<img class="${cls}" src="${heartSlotUrl(left, right, mark, [armL, armR])}" alt="" draggable="false">`;
}

/* The whole chip: your slots (hearts with your armor over them, from the left; shadows up to the
   most hearts anyone can have), then the canister's, and your rune under them */
function campHeartsHtml() {
  const P = CAMP.rules.snake.armorPieces || 4;
  const halves = Math.round(currentHearts * 2);
  const heartSlots = Math.max(campHeartCap(), campRun.startHearts || 0, Math.ceil(currentHearts - 1e-9));
  const plates = Math.ceil((campRun.armorMax || 0) / P);
  const slots = Math.max(heartSlots, plates);
  let html = "";
  for (let i = 0; i < slots; i++) {
    const heart = Math.max(0, Math.min(2, halves - i * 2));
    const armor = Math.max(0, Math.min(P, campRun.armor - i * P));
    html += heartSlotHtml({ heart, armor });
  }
  const v = campVessel();
  if (v) {
    if (vesselHoldsArmor(v)) for (let i = 0; i < Math.ceil(v.uses / P); i++) html += heartSlotHtml({ armor: Math.min(P, v.uses - i * P), violet: true }, "canister");
    else for (let i = 0; i < Math.ceil(v.uses / 2); i++) html += heartSlotHtml({ heart: Math.min(2, v.uses - i * 2), purple: true }, "canister");
  }
  return `<div class="ph-row">${html}</div>` + campRuneRowHtml();
}

/* The rune slot under the hearts: the stone (or its shadow) and what it does */
function campRuneRowHtml() {
  const it = campRun.rune;
  const owned = campEquipped("rune");
  if (!it) {
    const why = owned && campBare() ? `<span class="rb-none">Bare scales: no rune</span>` : runeBlurbHtml(null);
    return `<div class="ph-rune empty"><span class="ph-stone"><img src="${runeShadowUrl()}" alt="" draggable="false"></span><span class="ph-blurb">${why}</span></div>`;
  }
  const grade = runeGradeId(it);
  return `<div class="ph-rune" title="${escapeAttr(campItemName(it))}"><span class="ph-stone ${grade}"><img src="${runeIconUrl(it, 2)}" alt="" draggable="false"></span>` +
    `<span class="ph-blurb">${runeBlurbHtml(it)}</span></div>`;
}

function campHeartsLabel() {
  const P = CAMP.rules.snake.armorPieces || 4;
  const v = campVessel();
  const parts = [`${fmtHalf(currentHearts)} heart${currentHearts === 1 ? "" : "s"}`];
  if (campRun.armor > 0) parts.push(`${fmtHalf(Math.round(campRun.armor / P * 2) / 2)} armor plates`);
  if (v) parts.push(vesselHoldsArmor(v) ? `${fmtHalf(Math.round(v.uses / P * 2) / 2)} purple plates` : `${fmtHalf(v.uses / 2)} purple hearts`);
  if (campRun.rune) { const w = runeWords(campRun.rune, "short"); parts.push(`rune: ${campItemName(campRun.rune)} (${w.good.concat(w.bad).join(", ")})`); }
  else parts.push("no rune selected");
  return parts.join(", ");
}
