/* =========================================================
   src/ui/navigation.js
   Screens, the back button and keyboard focus
   ========================================================= */
"use strict";

/* =========================================================
   Screens and navigation
   ========================================================= */
/* Screens that live on the board itself; every other screen fills the window */
const BOARD_SCREENS = ["gameover", "rules"];   // (the sandbox editor fills the window, build 53)
function showScreen(name) {
  if (typeof closeBubble === "function") closeBubble();
  Object.entries(screenEls).forEach(([key, el]) => el.classList.toggle("active", key === name));
  currentScreen = name;
  gameState = name ? name.toUpperCase() : "PLAYING";

  const boardActive = gameState === "PLAYING" || gameState === "GAMEOVER";
  applyFrameClass(boardActive);

  document.body.classList.toggle("playing", gameState === "PLAYING");
  const boardScreen = !name || BOARD_SCREENS.includes(name);
  document.body.classList.toggle("menu-full", !boardScreen);
  document.body.classList.toggle("menu-main", name === "main");
  updatePauseButton();
  setTimeout(updateMusic, 0);
  if (gameState === "PLAYING") fitStage(true);
  else requestAnimationFrame(() => fitStage());
  clearKbdFocus();
  updateTouchControls();
  updateHud();

  if (name) {
    const el = screenEls[name];
    const target = el.querySelector("[data-autofocus]") || focusablesIn(el)[0];
    if (target) target.focus({ preventScroll: true });
  }
}

function openScreen(name) {
  // A save's own places need a save: with no profile picked, choose one first
  if (!activeSlot && ["modes", "inventory", "story", "shelf", "sandbox"].includes(name)) name = "profiles";
  // The terminal turns off achievements for the save, so it asks the first time
  if (name === "console" && !save.cheats) { askConsole(); return; }
  // The old Upgrades list is now the Great Tree
  if (name === "global") { treeArea = "global"; if (!treeSel || !GLOBAL_KEYS.concat("prestige").includes(treeSel) && !String(treeSel).startsWith("item:")) treeSel = "xp"; name = "tree"; }
  if (name === "modes") {
    mapSel = null; mapNight = false; mapCam = null; mapPop = null; mapRules = false;
    if (typeof mapFlip !== "undefined") { mapFlip = false; deepFlipAnim = null; mapEl.classList.remove("flipped"); }
    mapBriefEl.classList.remove("open"); mapBriefEl.innerHTML = ""; mapPopEl.className = "map-pop"; mapBannerEl.classList.remove("open");
    if (typeof resetNodeFocus === "function") resetNodeFocus();
    mapEl.classList.remove("zoomed", "night");
    renderModes();
    updateDock();
    if (mapReturnTo) {
      const k = mapReturnTo;
      mapReturnTo = null;
      setTimeout(() => {
        if (currentScreen !== "modes") return;
        selectPlace(k);
        if (typeof deepResume === "function") deepResume(k);
        // Coming back from a run: the level just played is ready to go again
        if (lastPlayed && lastPlayed.key === k) setTimeout(() => {
          const pin = mapPinsEl.querySelector(`[data-key="${lastPlayed.nm ? "nm" : "lv"}-${k}-${lastPlayed.j}"]`);
          if (pin && currentScreen === "modes" && mapSel === k) setKbdFocus(pin);
        }, 120);
      }, 0);
    } else if (camp && campIslandOpen(camp.at)) {
      // Opening the map: back on the last island you were at, underground if that's where you left it
      const k = camp.at;
      setTimeout(() => {
        if (currentScreen !== "modes" || mapSel) return;
        selectPlace(k);
        if (typeof deepResume === "function") deepResume(k);
      }, 0);
    }
  }
  if (name === "global") renderGlobal();
  if (name === "profiles") { profileChoosing = 0; renderProfiles(); }
  if (name === "upgrades") renderUpgradeBody();
  if (name === "tree") renderTree();
  if (name === "inventory") renderInventory();
  if (name === "story") renderStoryList();
  if (name === "sandbox") { if (!sbLevel) sbLevel = newLevel(); renderSandbox(); renderRules(); }
  if (name === "shelf") renderShelf();
  if (save.named && !tutorial && !guide && !sceneOpen) {
    if (VISIT_PAGES[name]) sceneForUnlock(VISIT_PAGES[name]);
    if (name === "modes") sceneForUnlock("easy");
  }
  if (name === "stats") { renderStats(); watchArt(document.getElementById("stats-banner"), "stats"); }
  if (name === "achievements") watchArt(document.getElementById("ach-banner"), "achievements");
  if (name === "achievements") { document.getElementById("ach-book").hidden = !activeSlot; renderAchievements(); }
  if (name === "settings") renderSettings();
  if (name === "console") {
    bootTerminal();
    // Swallow the rest of a tap burst on the version number so it can't hit a key
    screenEls.console.classList.add("cooldown");
    setTimeout(() => { screenEls.console.classList.remove("cooldown"); if (currentScreen === "console") consoleInputEl.focus({ preventScroll: true }); }, 600);
  }

  showScreen(name);
  if (screenEls[name]) screenEls[name].scrollTop = 0;
}

function goBack() {
  if (closeBubble()) return;
  if (confirmOpen) {
    closeConfirm();
    return;
  }
  if (pauseDetour && (currentScreen === "upgrades" || currentScreen === "settings")) {
    returnToPause();
    return;
  }
  if (currentScreen === "modes" && (mapPop || mapRules)) {
    if (mapRules && mapPop) { const p = mapPop; const pin = mapPinsEl.querySelector(`[data-key="${p.nm ? "nm" : "lv"}-${p.key}-${p.j}"]`); mapRules = false; mapBriefEl.classList.remove("open"); openLevelPop(p.key, p.j, p.nm, pin); }
    else closeLevelPop();
    return;
  }
  if (currentScreen === "modes" && typeof mapFlip !== "undefined" && mapFlip) { leaveUnder(); return; }   // seen from behind: turn back first
  if (currentScreen === "modes" && mapSel) {
    closePlace();
    return;
  }
  if (currentScreen === "gameover") { leaveGameover(); return; }
  if (delOpen) { closeDeleteSave(); return; }
  if (exchangeOpen) { closeExchange(); return; }
  if (currentScreen === "tree" && treeArea === "global") { openScreen("profiles"); return; }
  if (currentScreen === "story" && !activeSlot) { openScreen("achievements"); return; }
  if (currentScreen === "name" && namingFor === "first") { openScreen("profiles"); return; }
  const target = BACK_TARGET[currentScreen];
  if (target) openScreen(target);
}

/* Keyboard focus that works across every menu screen */
function focusablesIn(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll("button, input, select")).filter(el => {
    return !el.disabled && el.offsetParent !== null;
  });
}

function activeRoot() {
  if (confirmOpen) return confirmEl;
  if (delOpen) return delEl;
  if (exchangeOpen) return exEl;
  return currentScreen ? screenEls[currentScreen] : null;
}

function clearKbdFocus() {
  document.querySelectorAll(".focused").forEach(el => el.classList.remove("focused"));
}

function setKbdFocus(el) {
  clearKbdFocus();
  el.classList.add("focused");
  el.focus();
}

function moveFocus(step) {
  const list = focusablesIn(activeRoot());
  if (!list.length) return;
  let i = list.indexOf(document.activeElement);
  i = i === -1 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
  setKbdFocus(list[i]);
}

function activateFocused() {
  const list = focusablesIn(activeRoot());
  const active = document.activeElement;
  if (list.includes(active)) {
    if (active.tagName === "INPUT") active.focus();
    else active.click();
  } else if (list.length) {
    setKbdFocus(list[0]);
  }
}
