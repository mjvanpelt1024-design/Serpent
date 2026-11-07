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
   and below the board instead. With a mouse and room enough, it's all an
   arcade instead (below).
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
    if (!(name === "main" && camp)) arcadeOff();
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

/* ----- The stickers: an island's mark (textures/icons/stickers/<island>.png) in a white die-cut border ----- */
const stickerCache = {};
function stickerUrl(isl) {
  if (stickerCache[isl]) return stickerCache[isl];
  const src = texCanvas("sticker:" + isl);
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
  if (arcadeFits()) { renderArcade(coins, gems, titleStats(), done, posters); placeTitleDeco(); return; }
  arcadeOff();
  titleDeco.innerHTML = `<div class="td-top">${coins}${gems}</div>
    <div class="td-left plate"><p class="td-head">${escapeAttr(camp.name)}'s adventure</p>${rows}</div>
    <div class="td-right">${posters}</div>`;
  placeTitleDeco();
}

/* Keeps it all clear of the board and inside the window */
function placeTitleDeco() {
  if (!titleDeco.classList.contains("open")) return;
  // the arcade, while it fits the window (and back and forth as the window changes)
  if (document.body.classList.contains("arcade") !== arcadeFits()) { renderTitleDeco(); return; }
  if (document.body.classList.contains("arcade")) { placeArcade(); return; }
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

/* =========================================================
   The arcade (build 52). On a window with a mouse and room enough, the
   title screen is a scene: the board is the screen of an arcade machine
   (arcade:cabinet, textures/scenes/arcade/cabinet.png; its screen and
   readout boxes are in its index entry), your money lights up its
   marquee, each of your numbers is a poster taped to it, the bosses'
   wanted posters hang on the wall behind it (the swirl is the wall), and
   your island stickers are slapped about, on the machine and the wall.
   Where a sticker covers a number, point at either and it peels back.
   The scene is taller than the window: move the mouse up, down or to the
   sides to look around it (over the screen it hardly moves, so the menu
   holds still under your pointer). The wall moves less than the machine.
   Everywhere is in the cabinet picture's own pixels (s = screen pixels to
   one of its pixels), from its top left corner.
   ========================================================= */
const ARCADE = {
  // your numbers' posters (30 x 40): x, y, tilt, the color of the band across the top
  stats: [[-14, 80, -5, "#d1202a"], [-20, 126, 4, "#2f7dff"], [-12, 174, -3, "#ffd23f"], [-18, 222, 5, "#3ddc84"], [214, 0, 6, "#b36bff"]],
  // the wanted posters on the wall (34 x 46): x, y, tilt
  bounties: [[-46, 4, -3], [244, 22, 4], [250, 78, -2], [242, 134, 3], [248, 192, -4]],
  // the stickers (18 x 18): x, y, tilt, on the machine or the wall, the poster whose number it covers
  stickers: [[2, 142, -12, "machine", 1], [36, 8, 10, "machine"], [-40, 58, 8, "wall"], [250, 16, 14, "machine", 4], [-34, 300, -8, "wall"]]
};
const titleWall = document.createElement("div");
titleWall.id = "title-wall";
titleWall.setAttribute("aria-hidden", "true");
const titleMachine = document.createElement("div");
titleMachine.id = "title-machine";
titleMachine.setAttribute("aria-hidden", "true");
document.body.append(titleWall, titleMachine);

const arcadeFits = () => TextureLoader.has("arcade:cabinet") && window.matchMedia("(hover: hover) and (pointer: fine)").matches && window.innerWidth >= 640 && window.innerHeight >= 420;

function renderArcade(coins, gems, stats, done, posters) {
  document.body.classList.add("arcade");
  titleDeco.classList.remove("narrow", "compact", "coins-side");
  // the readout in the marquee, the numbers' posters, and the stickers stuck on the machine
  const covers = {};
  const stickers = done.map((I, i) => {
    const [x, y, tilt, layer, cover] = ARCADE.stickers[i];
    if (cover !== undefined) covers[cover] = i;
    return { I, x, y, tilt, layer, cover, i };
  });
  const sticker = st => `<img class="ta-sticker${st.cover !== undefined ? " covers" : ""}" data-s="${st.i}" ${st.cover !== undefined ? `tabindex="0" data-covers="${st.cover}"` : ""} src="${stickerUrl(st.I.id)}" alt="${escapeAttr(st.I.name)} sticker" title="${escapeAttr(st.I.name)}: finished" style="--tilt:${st.tilt}deg">`;
  const statPosters = stats.map(([label, v], i) => `<div class="ta-stat" data-k="${i}" style="--tilt:${ARCADE.stats[i][2]}deg;--band:${ARCADE.stats[i][3]}"><span class="ta-label">${escapeAttr(label)}</span><b class="ta-val">${escapeAttr(v)}</b></div>`).join("");
  titleDeco.innerHTML = `<div class="ta-readout">${coins}${gems}</div><p class="ta-name">${escapeAttr(camp.name)}'s adventure</p>${statPosters}${stickers.filter(s => s.layer === "machine").map(sticker).join("")}`;
  titleWall.innerHTML = posters + stickers.filter(s => s.layer === "wall").map(sticker).join("");
  titleMachine.innerHTML = `<img class="tm-cabinet" src="${texUrl("arcade:cabinet")}" alt="">`;
  // pointing at a covered number peels its sticker back too
  titleDeco.querySelectorAll(".ta-stat").forEach(p => {
    const s = covers[p.dataset.k];
    if (s === undefined) return;
    const el = titleDeco.querySelector(`.ta-sticker[data-s="${s}"]`);
    p.addEventListener("mouseenter", () => el.classList.add("peel"));
    p.addEventListener("mouseleave", () => el.classList.remove("peel"));
  });
}

/* Everything in its place round the board, as it sits at rest; and how far you can look each way */
function placeArcade() {
  const e = TextureLoader.entry("arcade:cabinet"), pic = texCanvas("arcade:cabinet");
  const [sx, sy, sw] = e.screen, [rx, ry, rw, rh] = e.readout;
  const vw = window.innerWidth, vh = window.innerHeight;
  // a board that fills the window top to bottom shrinks a little, so the money in the marquee shows above it
  const k = Math.min(1, (vh - 20) / (stageEl.offsetHeight * (1 + (sy - ry) / sw)));
  document.body.style.setProperty("--arcade-k", k.toFixed(4));
  const b = stageEl.getBoundingClientRect();
  const left0 = b.left - look.x, top0 = b.top - look.y;
  const s = b.width / sw, cx = left0 - sx * s, cy = top0 - sy * s;
  const at = (el, x, y, w, h) => { el.style.left = (cx + x * s) + "px"; el.style.top = (cy + y * s) + "px"; if (w) el.style.width = w * s + "px"; if (h) el.style.height = h * s + "px"; };
  titleDeco.style.setProperty("--s", s + "px");
  titleWall.style.setProperty("--s", s + "px");
  const cab = titleMachine.querySelector(".tm-cabinet");
  if (cab) at(cab, 0, 0, pic.width, pic.height);
  const ro = titleDeco.querySelector(".ta-readout");
  if (ro) at(ro, rx, ry, rw, rh);
  const nm = titleDeco.querySelector(".ta-name");
  if (nm) at(nm, ARCADE.stats[0][0] - 8, ARCADE.stats[0][1] - 14, 46, 9);
  titleDeco.querySelectorAll(".ta-stat").forEach(p => { const [x, y] = ARCADE.stats[p.dataset.k]; at(p, x, y, 30, 40); });
  [...titleWall.querySelectorAll(".td-poster")].forEach((p, i) => { const [x, y, tilt] = ARCADE.bounties[i]; at(p, x, y, 34, 46); p.style.setProperty("--tilt", tilt + "deg"); });
  document.querySelectorAll(".ta-sticker").forEach(el => {
    const [x, y, , , cover] = ARCADE.stickers[el.dataset.s];
    // over a number: on its poster, where the number is
    if (cover !== undefined) { const [px, py] = ARCADE.stats[cover]; at(el, px + 14, py + 18, 18, 18); }
    else at(el, x, y, 18, 18);
  });
  // how far you can look: up to the marquee's top, down to the machine's feet, a little either side
  const top = cy, bottom = cy + pic.height * s, l = cx, r = cx + pic.width * s;
  look.rest = { left: left0, top: top0, right: left0 + b.width, bottom: top0 + b.height };
  look.up = Math.max(0, 18 - top);
  look.down = Math.max(0, bottom - vh + 18);
  look.side = Math.min(vw * 0.25, Math.max(36, -l + 18, r - vw + 18));
  // at rest it looks up just enough to see the money in the marquee, as long as the whole screen stays in view
  look.base = Math.max(0, Math.min(10 - (cy + ry * s), vh - 10 - (top0 + b.height), look.up));
  if (!look.mouse) { look.ty = look.base; look.tx = 0; lookGo(); }
  const reach = 0.35 * Math.max(look.up, look.down, look.side);
  document.body.style.setProperty("--wall-zoom", (1.02 + 2 * reach / Math.min(vw, vh)).toFixed(3));
}

/* ----- Looking around ----- */
const look = { x: 0, y: 0, tx: 0, ty: 0, up: 0, down: 0, side: 0, base: 0, rest: null, mouse: null, raf: 0 };
const lookStill = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function lookAt(px, py) {
  if (!document.body.classList.contains("arcade") || !look.rest || lookStill()) { look.tx = 0; look.ty = look.base; return lookGo(); }
  look.mouse = { x: px, y: py };
  const r = look.rest, vw = window.innerWidth, vh = window.innerHeight;
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  // over the screen a little (15%), past its edges the rest of the way
  const axis = (p, lo, hi, end, back, fwd) => {
    if (p < lo) return back * (0.15 + 0.85 * ease((lo - p) / Math.max(1, lo)));
    if (p > hi) return -fwd * (0.15 + 0.85 * ease((p - hi) / Math.max(1, end - hi)));
    const u = (p - (lo + hi) / 2) / ((hi - lo) / 2);
    return u < 0 ? back * 0.15 * -u : -fwd * 0.15 * u;
  };
  look.ty = look.base + axis(py, r.top, r.bottom, vh, look.up - look.base, look.down + look.base);
  look.tx = axis(px, r.left, r.right, vw, look.side, look.side);
  lookGo();
}
function lookGo() { if (!look.raf) look.raf = requestAnimationFrame(lookStep); }
function lookStep() {
  look.raf = 0;
  look.x += (look.tx - look.x) * 0.1;
  look.y += (look.ty - look.y) * 0.1;
  if (Math.abs(look.tx - look.x) < 0.25 && Math.abs(look.ty - look.y) < 0.25) { look.x = look.tx; look.y = look.ty; }
  else lookGo();
  document.body.style.setProperty("--lx", look.x.toFixed(1) + "px");
  document.body.style.setProperty("--ly", look.y.toFixed(1) + "px");
}
window.addEventListener("mousemove", e => { if (document.body.classList.contains("arcade")) lookAt(e.clientX, e.clientY); });
document.addEventListener("mouseleave", () => { if (document.body.classList.contains("arcade")) { look.mouse = null; look.tx = 0; look.ty = look.base; lookGo(); } });
function arcadeOff() {
  document.body.classList.remove("arcade");
  look.x = look.y = look.tx = look.ty = look.base = 0;
  look.mouse = null;
  document.body.style.setProperty("--lx", "0px");
  document.body.style.setProperty("--ly", "0px");
  document.body.style.setProperty("--arcade-k", "1");
  titleWall.innerHTML = "";
  titleMachine.innerHTML = "";
}
