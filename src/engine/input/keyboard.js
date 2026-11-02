/* =========================================================
   src/engine/input/keyboard.js
   Keyboard
   ========================================================= */
"use strict";

/* =========================================================
   Keyboard
   ========================================================= */
function handleKeyDown(e) {
  const key = e.key.toLowerCase();
  const target = e.target;

  // Typing in a field: only Esc and Enter mean something to the game
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (savecodeOpen) closeSaveModal();
      else target.blur();
    } else if (e.key === "Enter" && target.tagName === "INPUT") {
      e.preventDefault();
      if (target.id === "name-input") confirmName();
      else target.blur();
    }
    return;
  }

  if (savecodeOpen) {
    if (e.key === "Escape") { e.preventDefault(); closeSaveModal(); }
    return;
  }

  if (delOpen || exchangeOpen) {
    if (e.key === "Escape") { e.preventDefault(); if (delOpen) closeDeleteSave(); else closeExchange(); return; }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(e.key)) {
      e.preventDefault();
      const root = delOpen ? delEl : exEl;
      const list = focusablesIn(root);
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const step = e.key === "ArrowLeft" || e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 1;
      list[(i + step + list.length) % list.length].focus();
    }
    return;
  }

  if (key === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && currentScreen !== "console") {
    e.preventDefault();
    toggleFullscreen();
    return;
  }

  if (document.getElementById("sb-rules").classList.contains("active")) {
    if (e.key === "Escape") { e.preventDefault(); closeRules(); }
    return;
  }

  if (sceneOpen) {
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); advanceScene(); }
    else if (e.key === "Escape") { e.preventDefault(); closeScene(); }
    return;
  }

  if (tutorial && gameState === "PLAYING" && e.key === "Escape") {
    e.preventDefault();
    skipTutorial();
    return;
  }

  if (loadoutOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeLoadout();
    } else if (e.code === "Space" && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#loadout-list"))) {
      e.preventDefault();
      loadoutGo(false);
    }
    return;
  }

  if (introOpen) {
    if (e.code === "Space" || e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      closeIntroCard();
    }
    return;
  }

  // A held key repeats. Pause, resume and restart only act on a fresh press, so holding
  // Space can't flicker the pause screen or start a new run the moment you die.
  if (pauseOpen) {
    if (e.code === "Space" || e.key === "Escape" || key === "p") { e.preventDefault(); if (!e.repeat) continueGame(); }
    return;
  }

  if (gameState === "PLAYING" && (e.code === "Space" || e.key === "Escape" || key === "p")) {
    e.preventDefault();
    if (!e.repeat) pauseGame();
    return;
  }

  if (gameState === "PLAYING" && key === "e" && !e.repeat) {
    e.preventDefault();
    shedSkin();
    return;
  }

  if (gameState === "PLAYING") {
    const keyDirections = {};
    if (save.settings.keysArrows) Object.assign(keyDirections, { arrowleft: "left", arrowup: "up", arrowright: "right", arrowdown: "down" });
    if (save.settings.keysWasd) Object.assign(keyDirections, { a: "left", w: "up", d: "right", s: "down" });
    const direction = keyDirections[key];
    if (direction) {
      e.preventDefault();
      handleDirectionInput(direction);
    }
    return;
  }

  if (confirmOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeConfirm();
      return;
    }
  } else if (gameState === "RULES" && e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) beginRun();
    return;
  } else if (gameState === "GAMEOVER" && e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) beginRun();
    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    goBack();
    return;
  }

  if (currentScreen === "story" && (key === "arrowleft" || key === "arrowright" || key === "a" || key === "d")) {
    e.preventDefault();
    turnPage(key === "arrowleft" || key === "a" ? -1 : 1);
    return;
  }

  if (currentScreen === "modes" && mapSel && !mapPop && !mapRules && (key === "arrowleft" || key === "arrowright" || key === "a" || key === "d")) {
    e.preventDefault();
    stepPlace(key === "arrowleft" || key === "a" ? -1 : 1);
    return;
  }

  const prevKeys = ["arrowleft", "arrowup", "a", "w"];
  const nextKeys = ["arrowright", "arrowdown", "d", "s"];

  if (prevKeys.includes(key)) {
    e.preventDefault();
    moveFocus(-1);
    return;
  }

  if (nextKeys.includes(key)) {
    e.preventDefault();
    moveFocus(1);
    return;
  }

  if (e.code === "Space" || e.key === "Enter") {
    e.preventDefault();
    activateFocused();
  }
}
