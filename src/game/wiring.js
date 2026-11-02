/* =========================================================
   src/game/wiring.js
   Connecting buttons to actions
   ========================================================= */
"use strict";

/* =========================================================
   Wiring
   ========================================================= */
document.addEventListener("keydown", handleKeyDown);
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (!music.track) updateMusic(); }, { passive: true }));
document.addEventListener("pointerdown", clearKbdFocus, true);

document.querySelectorAll("[data-go]").forEach(btn => {
  btn.addEventListener("click", () => openScreen(btn.dataset.go));
});

document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", goBack);
});

document.getElementById("rules-start").addEventListener("click", beginRun);
document.getElementById("gameover-again").addEventListener("click", beginRun);
document.getElementById("gameover-revive").addEventListener("click", reviveRun);
document.getElementById("loadout-go").addEventListener("click", () => loadoutGo(false));
document.getElementById("loadout-none").addEventListener("click", () => loadoutGo(true));
document.querySelectorAll("#screen-inventory .tab[data-inv]").forEach(tab => tab.addEventListener("click", () => { invTab = tab.dataset.inv; sfx("tab"); renderInventory(); }));
document.querySelectorAll("#screen-inventory .subtab[data-invsub]").forEach(tab => tab.addEventListener("click", () => { invSub = tab.dataset.invsub; renderInventory(); }));
document.getElementById("ach-stats").addEventListener("click", () => openScreen("stats"));

document.getElementById("menu-quit").addEventListener("click", () => {
  openConfirm({
    title: "Leave the story?",
    text: "Your progress is saved. I will be here when you return. I am always here. It is rather the problem.",
    ok: "Quit",
    onOk: () => {
      try { window.close(); } catch (e) { /* a browser tab may refuse */ }
      setTimeout(() => showToast("You may close this window now. I shall wait. I am very good at waiting."), 250);
    }
  });
});

/* After a run, go back to the island it was played on, with that level marked */
function leaveGameover() {
  if (currentModeKey === "custom") { currentModeKey = "easy"; openScreen(sbReturn ? "sandbox" : "shelf"); return; }
  if (MODE_KEYS.includes(currentModeKey)) {
    lastPlayed = { key: currentModeKey, j: currentLevel, nm: currentNightmare };
    mapReturnTo = currentModeKey;
    openScreen("modes");
  } else openScreen("main");
}
document.getElementById("gameover-menu").addEventListener("click", leaveGameover);

document.querySelectorAll("#screen-upgrades .tab[data-ctab]").forEach(tab => {
  tab.addEventListener("click", () => {
    upgradeTab = tab.dataset.ctab;
    sfx("tab");
    renderUpgradeBody();
    screenEls.upgrades.scrollTop = 0;
  });
});
document.querySelectorAll("#screen-upgrades .tab[data-main]").forEach(tab => {
  tab.addEventListener("click", () => {
    lastShopTab[shopMainOf(upgradeTab)] = upgradeTab;
    upgradeTab = lastShopTab[tab.dataset.main];
    renderUpgradeBody();
    screenEls.upgrades.scrollTop = 0;
  });
});
document.querySelectorAll("#screen-upgrades .subtab").forEach(tab => {
  tab.addEventListener("click", () => {
    upgradeTab = tab.dataset.tab;
    lastShopTab[shopMainOf(upgradeTab)] = upgradeTab;
    renderUpgradeBody();
    screenEls.upgrades.scrollTop = 0;
  });
});

settingsTabsEl.addEventListener("click", e => {
  const tab = e.target.closest("[data-settab]");
  if (!tab) return;
  settingsTab = tab.dataset.settab;
  renderSettings();
  screenEls.settings.scrollTop = 0;
  const again = settingsTabsEl.querySelector(`[data-settab="${settingsTab}"]`);
  if (again) again.focus({ preventScroll: true });
});

settingsBodyEl.addEventListener("click", e => {
  const el = e.target.closest("button");
  if (!el) return;
  const refocus = sel => { const again = settingsBodyEl.querySelector(sel); if (again) again.focus({ preventScroll: true }); };
  if (el.dataset.setting) { toggleSetting(el.dataset.setting); refocus(`[data-setting="${el.dataset.setting}"]`); }
  else if (el.dataset.cycle) { cycleSetting(el.dataset.cycle); refocus(`[data-cycle="${el.dataset.cycle}"]`); }
  else if (el.dataset.settingsReset) resetSettingsTab(el.dataset.settingsReset);
  else if (el.dataset.action === "rename") openNaming("rename");
  else if (el.dataset.action === "fullscreen") toggleFullscreen();
  else if (el.dataset.action === "backup") openSaveModal("export");
  else if (el.dataset.action === "restore") openSaveModal("import");
  else if (el.dataset.action === "erase") confirmResetAll();
  else if (el.dataset.action === "tutorial") startTutorial();
  else if (el.dataset.action === "story") openBook();
  else if (el.dataset.go) openScreen(el.dataset.go);
});

settingsBodyEl.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.range) {
    const row = SETTINGS_TABS.flatMap(t => t.rows).find(r => r.key === el.dataset.range);
    save.settings[el.dataset.range] = Number(el.value);
    el.nextElementSibling.textContent = el.value + row.unit;
    applySettingsEffects();
  } else if (el.dataset.text === "snakeName") {
    save.settings.snakeName = el.value.trim().slice(0, 16) || "Noodle";
  }
});

settingsBodyEl.addEventListener("change", e => {
  if (e.target.dataset.range || e.target.dataset.text) persist();
  if (e.target.dataset.range === "sfxVolume") sfx("click");
});

settingsBodyEl.addEventListener("focusout", e => {
  if (e.target.dataset.text === "snakeName") e.target.value = save.settings.snakeName;
});

/* Secret terminal: tap the version number 5 times within 2 seconds */
let buildClicks = [];
buildEl.textContent = BUILD_NUMBER;
document.getElementById("about-build").textContent = "Build " + BUILD_NUMBER;
buildEl.addEventListener("click", () => {
  if (currentScreen !== "settings") return;
  const now = performance.now();
  buildClicks = buildClicks.filter(t => now - t < 2000);
  buildClicks.push(now);
  if (buildClicks.length === 3) showToast("The narrator has noticed you tapping the version number.", "narrator");
  if (buildClicks.length === 4) showToast("The narrator is now mildly concerned.", "narrator");
  if (buildClicks.length >= 5) {
    buildClicks = [];
    openScreen("console");
  }
});

consoleInputEl.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    runConsole(consoleInputEl.value);
    consoleInputEl.value = "";
  } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    e.stopPropagation();
    stepHistory(e.key === "ArrowUp" ? -1 : 1);
  } else if (e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    consoleInputEl.value = completeLine(consoleInputEl.value);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (consoleInputEl.value) consoleInputEl.value = "";
    else goBack();
  }
});

function stepHistory(d) {
  consoleHistoryAt = Math.max(0, Math.min(consoleHistory.length, consoleHistoryAt + d));
  consoleInputEl.value = consoleHistory[consoleHistoryAt] || "";
}

document.getElementById("term-gates").addEventListener("click", e => {
  const b = e.target.closest("[data-group]");
  if (!b) return;
  consoleInputEl.value = b.dataset.group + " ";
  helpGroup(b.dataset.group);
  consoleInputEl.focus({ preventScroll: true });
});
document.querySelector("#screen-console .term-keys").addEventListener("click", e => {
  const b = e.target.closest("[data-term]");
  if (!b) return;
  const t = b.dataset.term;
  if (t === "up") stepHistory(-1);
  else if (t === "down") stepHistory(1);
  else if (t === "tab") consoleInputEl.value = completeLine(consoleInputEl.value);
  else if (t === "clear") consoleLogEl.innerHTML = "";
  consoleInputEl.focus({ preventScroll: true });
});
document.getElementById("confirm-cancel").addEventListener("click", closeConfirm);
document.getElementById("confirm-ok").addEventListener("click", confirmOk);
document.getElementById("intro-ok").addEventListener("click", closeIntroCard);
document.getElementById("scene-next").addEventListener("click", advanceScene);
document.getElementById("pause-btn").addEventListener("click", pauseGame);
document.getElementById("pause-continue").addEventListener("click", continueGame);
document.getElementById("pause-quit").addEventListener("click", quitRun);
document.getElementById("pause-shop").addEventListener("click", () => openFromPause("upgrades"));
document.getElementById("pause-settings").addEventListener("click", () => openFromPause("settings"));
// Switching apps or tabs pauses the run. In the launcher, switching to another window
// doesn't hide the page, so losing focus pauses it too.
window.addEventListener("blur", () => { if (gameState === "PLAYING") pauseGame(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
  else setWakeLock(gameState === "PLAYING" && !pauseOpen && !paused);
  if (audioCtx) {
    if (document.hidden) audioCtx.suspend().catch(() => {});
    else if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }
});
document.getElementById("scene-skip").addEventListener("click", closeScene);
document.getElementById("name-ok").addEventListener("click", confirmName);
document.getElementById("book-prev").addEventListener("click", () => turnPage(-1));
document.getElementById("ach-book").addEventListener("click", openBook);
(() => {
  const board = document.getElementById("sb-board");
  const paintAt = e => { const at = sbPointFrom(e); if (at) sbPaint(at[0], at[1]); };
  board.addEventListener("pointerdown", e => { sbPainting = true; board.setPointerCapture(e.pointerId); paintAt(e); });
  board.addEventListener("pointermove", e => { if (sbPainting) paintAt(e); });
  board.addEventListener("pointerup", () => { sbPainting = false; });
  board.addEventListener("pointercancel", () => { sbPainting = false; });
  document.getElementById("sb-name").addEventListener("input", e => { sbLevel.n = e.target.value.slice(0, 24); });
  document.getElementById("sb-rules-btn").addEventListener("click", openRules);
  document.getElementById("rules-done").addEventListener("click", closeRules);
  document.getElementById("sb-new").addEventListener("click", () => openConfirm({ title: "Start a new level?", text: "Anything you haven't saved will be lost.", ok: "New level", onOk: () => { openSandbox(null); } }));
  document.getElementById("sb-save").addEventListener("click", saveCurrentLevel);
  document.getElementById("sb-play").addEventListener("click", () => playCustom(sbLevel, true));
  document.getElementById("shelf-add").addEventListener("click", importCode);
  document.getElementById("shelf-new").addEventListener("click", () => openSandbox(null));
  document.querySelectorAll("#screen-shelf .tab[data-shelf]").forEach(t => t.addEventListener("click", () => { sbShelfTab = t.dataset.shelf; sfx("tab"); renderShelf(); }));
})();
document.getElementById("book-next").addEventListener("click", () => turnPage(1));

/* Touch pad */
const touchDirections = {
  "touch-up": "up",
  "touch-left": "left",
  "touch-down": "down",
  "touch-right": "right"
};

Object.entries(touchDirections).forEach(([id, direction]) => {
  document.getElementById(id).addEventListener("pointerdown", e => {
    e.preventDefault();
    if (gameState === "PLAYING") handleDirectionInput(direction);
    else if (gameState === "MAIN" || gameState === "MODES") {
      moveFocus(direction === "left" || direction === "up" ? -1 : 1);
    }
  });
});

touchSelectBtn.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (gameState === "PLAYING") shedSkin();
  else if (gameState === "RULES" || gameState === "GAMEOVER") beginRun();
  else if (gameState === "MAIN" || gameState === "MODES") activateFocused();
});

touchBackBtn.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (gameState === "GAMEOVER") leaveGameover();
  else if (gameState === "RULES" || gameState === "MODES") goBack();
});

/* Swipe on the board (touch screens). The turn fires as soon as the finger
   has travelled far enough, and a single drag can chain several turns. */
function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

let swipeAnchor = null;

function swipeThreshold() {
  const opt = SWIPE_OPTIONS.find(o => o[0] === save.settings.swipe) || SWIPE_OPTIONS[1];
  return opt[2];
}

// Chrome on phones: stop swipes from scrolling or refreshing the page mid-game
stageEl.addEventListener("touchmove", e => {
  if (gameState === "PLAYING") e.preventDefault();
}, { passive: false });

canvas.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse") return;
  swipeAnchor = { x: e.clientX, y: e.clientY, id: e.pointerId };
});

canvas.addEventListener("pointermove", e => {
  if (!swipeAnchor || e.pointerId !== swipeAnchor.id) return;
  const dx = e.clientX - swipeAnchor.x;
  const dy = e.clientY - swipeAnchor.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold()) return;

  if (Math.abs(dx) > Math.abs(dy)) handleDirectionInput(dx > 0 ? "right" : "left");
  else handleDirectionInput(dy > 0 ? "down" : "up");
  swipeAnchor = { x: e.clientX, y: e.clientY, id: e.pointerId };
});

["pointerup", "pointercancel", "pointerleave"].forEach(type => {
  canvas.addEventListener(type, e => {
    if (swipeAnchor && e.pointerId === swipeAnchor.id) swipeAnchor = null;
  });
});

/* Save playtime if the tab is closed mid-game */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
window.addEventListener("pagehide", persist);

/* A friendly net under everything: say so once in a while instead of failing silently */
let lastErrorToast = 0;
function friendlyError(e) {
  console.error(e);
  const now = Date.now();
  if (now - lastErrorToast < 20000) return;
  lastErrorToast = now;
  try { showToast("Something went wrong. If it keeps happening, back up your save in Settings."); } catch (_) { /* nothing more to do */ }
}
window.addEventListener("error", ev => friendlyError(ev.error || ev.message));
window.addEventListener("unhandledrejection", ev => friendlyError(ev.reason));
