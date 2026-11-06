/* =========================================================
   src/campaign/camp-title.js
   The title screen, around the board (build 51). The board and the
   window behind it wear your theme again, like a level (the drifting
   world of build 49 is switched off). Around it, out of the menu's way:
     the top      every island's money you've reached, and your gems
     the left     a plate of numbers from your adventure so far
     the right    a wanted poster for each boss; crossed out once it falls
     stickers     one for every island you've finished, slapped over the
                  numbers plate. It hides part of a number; point at the
                  number (or the sticker) and it peels back to show it
   Wanted posters can carry pins (camp.pins[island]: a list of pin ids),
   for the quests to come: campPin(island, id) / campUnpin(island, id).
   The pins only have a placeholder look for now.
   On a narrow window the numbers and posters shrink into strips above
   and below the board instead.
   ========================================================= */
"use strict";

/* The drifting world stays off: the board is the board again */
window.drawTitleScene = function () { };
(() => {
  const show = showScreen;
  window.showScreen = function (name) {
    show.apply(this, arguments);
    document.body.classList.remove("title-world");
    titleDeco.classList.toggle("open", name === "main" && !!camp);
    if (name === "main" && camp) { renderTitleDeco(); requestAnimationFrame(placeTitleDeco); setTimeout(placeTitleDeco, 120); setTimeout(placeTitleDeco, 500); }
  };
})();

const titleDeco = document.createElement("div");
titleDeco.id = "title-deco";
titleDeco.setAttribute("aria-label", "Your adventure so far");
document.body.appendChild(titleDeco);

/* ----- Pins on the wanted posters: data now, art with the quests later ----- */
function campPin(isl, id) {
  if (!camp.pins[isl]) camp.pins[isl] = [];
  if (!camp.pins[isl].includes(id) && camp.pins[isl].length < 6) camp.pins[isl].push(id);
  saveCamp();
  if (currentScreen === "main") renderTitleDeco();
}
function campUnpin(isl, id) {
  if (!camp.pins[isl]) return;
  camp.pins[isl] = camp.pins[isl].filter(x => x !== id);
  saveCamp();
  if (currentScreen === "main") renderTitleDeco();
}

/* ----- The stickers: an island's mark in a white die-cut border ----- */
const STICKER_ART = { keep: ["shield", null, { s: "y", S: "Y", b: "r" }], spire: ["bigstar", null, { y: "P", Y: "V", w: "p" }], hollow: ["pie"], reef: ["shell"], crown: ["fireball"] };
const stickerCache = {};
function stickerUrl(isl) {
  if (stickerCache[isl]) return stickerCache[isl];
  const spec = STICKER_ART[isl] || ["star"];
  const src = objSprite(spec[0], spec[2]);
  const c = document.createElement("canvas");
  c.width = c.height = 18;
  const g = c.getContext("2d");
  // the die-cut border: the picture's shape, grown by two pixels, in white with a dark rim
  const s = src.getContext("2d").getImageData(0, 0, 12, 12).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12 && s[(y * 12 + x) * 4 + 3] > 0;
  const near = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r + 1 && solid(x + dx, y + dy)) return true; return false; };
  for (let y = -3; y < 15; y++) for (let x = -3; x < 15; x++) {
    if (near(x, y, 2)) { g.fillStyle = near(x, y, 1) ? "#ffffff" : "#2a2420"; g.fillRect(x + 3, y + 3, 1, 1); }
  }
  g.drawImage(src, 3, 3);
  // a glossy streak
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(5, 4, 3, 1); g.fillRect(4, 5, 1, 2);
  return (stickerCache[isl] = c.toDataURL());
}

/* ----- What it all says ----- */
function titleStats() {
  const bests = Object.values(camp.levels).map(r => r.best || 0);
  const won = Object.values(camp.levels).filter(r => r.wins > 0).length;
  const bosses = CAMP.islands.reduce((a, I) => a + BOSS_LEVELS.filter(n => campWon(I.id, n)).length, 0);
  return [
    ["Apples eaten", fmtInt(campStatValue("applesEaten"))],
    ["Highest score", fmtInt(bests.length ? Math.max(...bests) : 0)],
    ["Levels won", `${won} / ${CAMP.islands.length * LEVEL_COUNT}`],
    ["Bosses beaten", `${bosses} / ${CAMP.islands.length * 3}`],
    ["Flawless wins", fmtInt(Object.values(camp.levels).filter(r => r.flawless).length)]
  ];
}
const islandDone = isl => campWon(isl, LEVEL_COUNT);

function renderTitleDeco() {
  if (!camp) return;
  // the top: money from every island you've reached, and gems
  const coins = CAMP.islands.filter(I => campIslandOpen(I.id)).map(I => `<span class="td-coin" title="${escapeAttr(I.currency.plural)}">${coinHtml(I.id)}<b>${fmtInt(campWallet(I.id))}</b></span>`).join("");
  const gems = `<span class="td-coin gems" title="Gems"><img class="gem-ico" src="${iconUrl("gem", 2)}" alt=""><b>${fmtInt(camp.gems)}</b></span>`;
  // the numbers, with a sticker for each finished island slapped over one of them
  const done = CAMP.islands.filter(I => islandDone(I.id));
  const rows = titleStats().map(([label, v], i) => {
    const I = done[i];
    const tilt = [-14, 9, -6, 12, -10][i];
    return `<div class="td-row${I ? " stuck" : ""}" tabindex="${I ? 0 : -1}"><span class="td-label">${escapeAttr(label)}</span><b class="td-val">${escapeAttr(v)}</b>${I ? `<img class="td-sticker" src="${stickerUrl(I.id)}" alt="${escapeAttr(I.name)} sticker" title="${escapeAttr(I.name)}: finished" style="--tilt:${tilt}deg">` : ""}</div>`;
  }).join("");
  // the wanted posters, crossed out as their bosses fall; pins for quests to come
  const posters = CAMP.islands.map(I => {
    const seen = !placeFogged(I.id) && campIslandOpen(I.id);
    const dead = islandDone(I.id);
    const pins = (camp.pins[I.id] || []).map((p, k) => `<span class="td-pin" data-pin="${escapeAttr(p)}" style="--k:${k}" title="${escapeAttr(p)}"></span>`).join("");
    const fights = BOSS_LEVELS.filter(n => campWon(I.id, n)).length;
    return `<div class="td-poster${dead ? " dead" : ""}${seen ? "" : " unknown"}" title="${escapeAttr(seen ? `${I.boss.name}: ${dead ? "defeated" : `${fights} of 3 fights won`}` : "An unknown boss")}">
      <span class="td-wanted">${dead ? "Defeated" : "Wanted"}</span>
      ${seen ? `<img class="td-face" src="${bossFaceUrl(I.id)}" alt="">` : `<span class="td-face td-q">?</span>`}
      <span class="td-bname">${escapeAttr(seen ? I.boss.name.split(" the ")[0] : "???")}</span>
      ${seen && !dead ? `<span class="td-fights">${"●".repeat(fights)}${"○".repeat(3 - fights)}</span>` : ""}
      ${dead ? `<span class="td-x" aria-hidden="true"></span>` : ""}${pins}
    </div>`;
  }).join("");
  titleDeco.innerHTML = `<div class="td-top">${coins}${gems}</div>
    <div class="td-left plate"><p class="td-head">${escapeAttr(camp.name)}'s adventure</p>${rows}</div>
    <div class="td-right">${posters}</div>`;
  placeTitleDeco();
}

/* Keeps it all clear of the board and inside the window */
function placeTitleDeco() {
  if (!titleDeco.classList.contains("open")) return;
  const r = stageEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const side = Math.min(r.left, vw - r.right);
  // roomy sides: full plates; a little room: everything shrinks to fit; hardly any: strips above and below
  const mode = side >= 240 ? "wide" : side >= 112 ? "compact" : "narrow";
  titleDeco.classList.toggle("narrow", mode === "narrow");
  titleDeco.classList.toggle("compact", mode === "compact");
  // no room above the board: the money goes to the top of the left side instead
  titleDeco.classList.toggle("coins-side", r.top < 44 && mode !== "narrow");
  titleDeco.style.setProperty("--tdfs", mode === "compact" ? Math.max(10.5, Math.min(14, side / 11)).toFixed(1) + "px" : "1em");
  titleDeco.style.setProperty("--sl", r.left + "px");
  titleDeco.style.setProperty("--sr", (vw - r.right) + "px");
  titleDeco.style.setProperty("--st", r.top + "px");
  titleDeco.style.setProperty("--sb", (vh - r.bottom) + "px");
  titleDeco.style.setProperty("--side", Math.max(0, side - 24) + "px");
}
window.addEventListener("resize", () => { if (currentScreen === "main") requestAnimationFrame(placeTitleDeco); });
