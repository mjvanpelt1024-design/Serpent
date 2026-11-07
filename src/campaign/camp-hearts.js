/* =========================================================
   src/campaign/camp-hearts.js
   Your hearts and armor in the HUD, as 12 x 12 pixel pictures in the
   style of every other icon (PNGs in textures/hearts/).

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

/* One slot from what's in it: heart halves (0-2), armor pieces (0-4), and whose they are.
   Each look is its own picture in textures/hearts/: full-armor4.png is a whole heart under a
   whole plate, empty-armor0.png a shadow, canister-half.png half a purple heart. */
const HEART_HALVES = ["empty", "half", "full"];
function heartSlotHtml({ heart = 0, armor = 0, purple = false, violet = false }, extra = "") {
  const P = CAMP.rules.snake.armorPieces || 4;
  // as if a plate had four pieces (no number, as while a level is still setting up, is no armor)
  const a = Math.max(0, Math.min(4, Math.round(armor * 4 / P) || 0));
  const h = heart >= 2 ? 2 : heart >= 1 ? 1 : 0;
  const armL = a >= 1, armR = a >= 2;
  const name = violet ? `canister-armor${a}` : purple ? `canister-${HEART_HALVES[h]}` : `${HEART_HALVES[h]}-armor${a}`;
  const cls = ["pheart", !h && !a ? "empty" : "", violet && (armL || armR) ? "shiny" : "", !violet && heart > 0 && armL ? "golden" : "", extra].filter(Boolean).join(" ");
  return `<img class="${cls}" src="${texUrl("heart:" + name, "heart:empty-armor0")}" alt="" draggable="false">`;
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
