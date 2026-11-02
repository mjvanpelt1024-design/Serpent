/* =========================================================
   src/engine/input/touch.js
   Touch controls
   ========================================================= */
"use strict";

/* =========================================================
   Touch controls
   ========================================================= */
function updateTouchControls() {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (!coarsePointer) {
    touchControlsEl.style.display = "none";
    return;
  }

  const show = (arrows, utility) => {
    touchControlsEl.style.display = "grid";
    touchArrowIds.forEach(id => { document.getElementById(id).style.display = arrows ? "block" : "none"; });
    touchSelectBtn.style.display = utility ? "block" : "none";
    touchBackBtn.style.display = utility ? "block" : "none";
  };

  // Arrows only during a run (not on menus, and not while paused); Shed where you can shed
  if (gameState === "PLAYING" && !pauseOpen) {
    show(true, false);
    if (featureOn("shed")) { touchSelectBtn.style.display = "block"; touchSelectBtn.textContent = "Shed"; }
  } else {
    touchControlsEl.style.display = "none";
  }
  if (gameState !== "PLAYING") touchSelectBtn.textContent = "Confirm";
}
