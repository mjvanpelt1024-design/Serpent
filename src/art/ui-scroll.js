/* =========================================================
   src/art/ui-scroll.js
   Two more pieces of the retro fantasy dress (see src/art/ui-frames.js):
     the scroll   a strip of parchment between two rolled ends with wooden
                  knobs, for the names that sit over the map and home base
                  (a 9-slice: --fx-scroll, used by styles/17-hub-nodes.css)
     the cursor   a brass pointer, and a gloved hand over anything you can
                  click (--cur-arrow, --cur-hand). It's hidden while a level
                  is being played, and comes back for the pause menu.
   ========================================================= */
"use strict";

/* The scroll: 8 pixels of roll on each side, 4 above and below, parchment between */
function fxScroll() {
  const W = 23, H = 16;
  const [c, g] = fxCanvasOf(W, H);
  const put = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const paper = "#ecd8a8", edge = "#c9a96a", line = "#3a2410";
  // the strip of parchment
  for (let x = 4; x < W - 4; x++) for (let y = 2; y < H - 2; y++) {
    let col = paper;
    if (y === 2 || y === H - 3) col = line;
    else if (y === 3 || y === H - 4) col = edge;
    put(x, y, col);
  }
  // a roll at each end: a paper cylinder, lit from the left, with a wooden knob above and below
  const roll = ["#3a2410", "#b8955a", "#f6e6be", "#e4cc94", "#cdae72", "#a07c42", "#7a5a2a", "#3a2410"];
  const knob = ["#2a1608", "#8a5a2a", "#c8884a", "#6a3e18", "#2a1608"];
  [0, W - 8].forEach(x0 => {
    for (let y = 1; y < H - 1; y++) roll.forEach((col, i) => put(x0 + i, y, y === 1 || y === H - 2 ? line : col));
    [0, H - 1].forEach(y => knob.forEach((col, i) => put(x0 + 1 + i + 1, y, col)));
  });
  return c;
}

/* The cursors: 12 x 12, shown at twice the size */
const CURSOR_ROWS = {
  arrow: ["k...........", "kk..........", "kyk.........", "kwyk........", "kwyyk.......", "kwyyyk......", "kwyyyyk.....", "kwyyykkk....", "kykyyk......", "kk.kyyk.....", "k...kyk.....", ".....kk....."],
  hand: ["....kk......", "...kwtk.....", "...ktnk.....", "...ktnkkk...", "...ktnktnkk.", ".kkktnktnktk", "ktnktnnnnntk", "ktnnnnnnnntk", ".ktnnnnnnnk.", "..ktnnnnnnk.", "...ktnnnnk..", "...kkkkkkk.."]
};
const CURSOR_PAL = { k: "#0b0907", y: "#f2c45a", w: "#fff0b0", t: "#f6e0b8", n: "#c89a5a" };
function cursorUrl(name) {
  const S = 2;
  const [c, g] = fxCanvasOf(12 * S, 12 * S);
  CURSOR_ROWS[name].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") { g.fillStyle = CURSOR_PAL[ch]; g.fillRect(x * S, y * S, S, S); } }));
  return `url("${c.toDataURL()}")`;
}

(() => {
  const root = document.documentElement.style;
  root.setProperty("--fx-scroll", fxUrl(fxScroll()));
  root.setProperty("--cur-arrow", `${cursorUrl("arrow")} 1 1`);
  root.setProperty("--cur-hand", `${cursorUrl("hand")} 9 2`);
})();

/* No cursor over a level in play; back for the pause menu and everything else */
(() => {
  const orig = updatePauseButton;
  window.updatePauseButton = function () {
    orig.apply(this, arguments);
    document.body.classList.toggle("cursor-off", gameState === "PLAYING" && !pauseOpen && !loadoutOpen);
  };
})();
