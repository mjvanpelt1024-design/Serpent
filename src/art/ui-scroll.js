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

/* The scroll: 8 pixels of roll on each side, 4 above and below, parchment between
   (textures/ui/scroll.png) */
const fxScroll = () => texCanvas("ui:scroll");

/* The cursors: 12 x 12 (textures/icons/cursors/), shown at twice the size */
function cursorUrl(name) {
  const S = 2;
  const [c, g] = fxCanvasOf(12 * S, 12 * S);
  g.imageSmoothingEnabled = false;
  g.drawImage(texCanvas("cursor:" + name), 0, 0, 12 * S, 12 * S);
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
    document.body.classList.toggle("cursor-off", gameState === "PLAYING" && !pauseOpen && !loadoutOpen && !document.body.classList.contains("re-won") && !document.body.classList.contains("re-lost"));
  };
})();
