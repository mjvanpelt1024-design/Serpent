/* =========================================================
   src/engine/input/fullscreen.js
   Full screen
   ========================================================= */
"use strict";

/* =========================================================
   Full screen
   ========================================================= */
function toggleFullscreen() {
  const doc = document.documentElement;
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (doc.requestFullscreen) doc.requestFullscreen().catch(() => showToast("This browser won't go full screen from here."));
    else showToast("This browser can't go full screen.");
  } catch (_) {
    showToast("This browser won't go full screen from here.");
  }
}
