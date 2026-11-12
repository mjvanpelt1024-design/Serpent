/* =========================================================
   src/ui/look-around.js
   Looking around (build 54): on the map (the islands and a stop up
   close), at home and in the shops, the scene drifts a little toward
   wherever the mouse is, the same amount every way, the far things
   (the sky) less than the near ones. The title screen's arcade has
   its own, in 3D (src/art/arcade-3d.js).

   This only sets two numbers, --mx and --my (-1 to 1, eased), on the
   page; each screen's CSS (styles/20-ui-overhaul.css, "Looking
   around") decides what drifts and how far (--look). Off with a touch
   screen, and when the system asks for less motion.
   ========================================================= */
"use strict";

const SCR_LOOK = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
const SCR_LOOK_SCREENS = ["modes", "camphome", "campshop"];
const scrLookOn = () => typeof currentScreen !== "undefined" && SCR_LOOK_SCREENS.includes(currentScreen) &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrLookStep() {
  SCR_LOOK.raf = 0;
  SCR_LOOK.x += (SCR_LOOK.tx - SCR_LOOK.x) * 0.08;
  SCR_LOOK.y += (SCR_LOOK.ty - SCR_LOOK.y) * 0.08;
  if (Math.abs(SCR_LOOK.tx - SCR_LOOK.x) < 0.002 && Math.abs(SCR_LOOK.ty - SCR_LOOK.y) < 0.002) { SCR_LOOK.x = SCR_LOOK.tx; SCR_LOOK.y = SCR_LOOK.ty; }
  else SCR_LOOK.raf = requestAnimationFrame(scrLookStep);
  const root = document.documentElement.style;
  root.setProperty("--mx", SCR_LOOK.x.toFixed(4));
  root.setProperty("--my", SCR_LOOK.y.toFixed(4));
}
const scrLookGo = () => { if (!SCR_LOOK.raf) SCR_LOOK.raf = requestAnimationFrame(scrLookStep); };
/* -1 at one edge of the window, 1 at the other, gentle in the middle */
const scrLookAxis = (p, size) => { const u = Math.max(-1, Math.min(1, (p / Math.max(1, size)) * 2 - 1)); return Math.sign(u) * Math.pow(Math.abs(u), 1.25); };

window.addEventListener("mousemove", e => {
  if (!scrLookOn()) { if (SCR_LOOK.tx || SCR_LOOK.ty) { SCR_LOOK.tx = SCR_LOOK.ty = 0; scrLookGo(); } return; }
  SCR_LOOK.tx = scrLookAxis(e.clientX, window.innerWidth);
  SCR_LOOK.ty = scrLookAxis(e.clientY, window.innerHeight);
  scrLookGo();
});
document.addEventListener("mouseleave", () => { SCR_LOOK.tx = SCR_LOOK.ty = 0; scrLookGo(); });
// a screen without it settles back to the middle
(() => {
  const show = showScreen;
  window.showScreen = function () {
    const r = show.apply(this, arguments);
    if (!scrLookOn()) { SCR_LOOK.tx = SCR_LOOK.ty = 0; scrLookGo(); }
    return r;
  };
})();
