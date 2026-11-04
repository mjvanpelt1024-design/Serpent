/* =========================================================
   src/campaign/camp-screens.js
   Fitting the campaign into the game's menus: the title screen's Play
   button, the new screens, the result card after a level, the keys
   (Space casts your spell during a level; Esc or P pauses), the pause
   menu, and the save options on the map.
   ========================================================= */
"use strict";

/* The full-window screens and the panel modal live at the top of the page, not inside the
   board's stage: the stage can be transformed (scaling, shakes), which would drag them along */
["screen-camp", "screen-campshop", "camp-modal"].forEach(id => document.body.appendChild(document.getElementById(id)));

/* The new screens join the old navigation */
screenEls.camp = document.getElementById("screen-camp");
screenEls.campshop = document.getElementById("screen-campshop");
screenEls.campresult = document.getElementById("screen-campresult");
BACK_TARGET.camp = "main";
BACK_TARGET.campshop = "camp";
BACK_TARGET.campresult = "camp";
BOARD_SCREENS.push("campresult");

/* Play loads the one save and goes straight to the map */
(() => {
  const play = document.querySelector('#screen-main [data-go="profiles"]');
  if (play) {
    const btn = play.cloneNode(true);
    btn.removeAttribute("data-go");
    btn.id = "menu-play";
    play.replaceWith(btn);
    btn.addEventListener("click", () => { sfx("click"); openCampMap(); });
  }
})();

/* Back and Escape on the new screens */
(() => {
  const orig = goBack;
  window.goBack = function () {
    if (campModalOpen) { closeCampModal(); return; }
    if (currentScreen === "camp" && (cmSel || cmHome)) { cmSel = null; cmHome = null; cmCard(); cmSpots(); return; }
    if (currentScreen === "camp") { openScreen("main"); return; }
    if (currentScreen === "campshop") { openCampMap({ isl: shopIsl, node: shopKind }); return; }
    if (currentScreen === "campresult") { campResultMap(); return; }
    return orig.apply(this, arguments);
  };
})();
document.getElementById("cm-back").addEventListener("click", () => openScreen("main"));
document.getElementById("cm-satchel").addEventListener("click", () => openSatchel());
document.getElementById("cm-menu").addEventListener("click", openSaveMenu);

/* ----- The result card after a level ----- */
function showCampResult(won, lines, notes, line = "") {
  const el = screenEls.campresult;
  const isl = campRun.isl, n = campRun.n;
  const def = campRun.def;
  const nextOpen = n < LEVEL_COUNT && campLevelOpen(isl, n + 1);
  const challenge = campRun.challenge >= 0;
  el.querySelector(".cr-kicker").textContent = `${CAMP.islandById[isl].name} · ${n}. ${def.name}`;
  el.querySelector("h2").textContent = won ? (def.kind === "boss" ? "Boss beaten!" : "Level complete!") : "Defeated";
  el.querySelector(".cr-score").textContent = `Score ${fmtInt(score)}`;
  el.querySelector(".cr-lines").innerHTML = lines.map(l => `<li>${l}</li>`).join("") + notes.map(l => `<li class="cr-new">${l}</li>`).join("");
  el.querySelector(".cr-line").textContent = line;
  el.querySelector(".cr-line").hidden = !line;
  el.classList.toggle("won", won);
  const again = el.querySelector("#cr-again"), next = el.querySelector("#cr-next");
  again.textContent = won ? "Play again" : "Try again";
  next.hidden = !won || !nextOpen || challenge;
  next.textContent = `Next: ${n + 1}`;
  showScreen("campresult");
  gameState = "GAMEOVER";              // keeps the finished board drawn behind the card
  applyFrameClass(true);
  updatePauseButton();
  campHudUpdate();
  (won && !next.hidden ? next : again).focus({ preventScroll: true });
}

function campResultMap() {
  const isl = campRun ? campRun.isl : camp.at, n = campRun ? campRun.n : 1;
  const challenge = campRun && campRun.challenge >= 0;
  campLeaveRun();
  if (challenge) openCampShop(isl, "challenger");
  else openCampMap({ isl, node: n });
}
document.getElementById("cr-map").addEventListener("click", campResultMap);
document.getElementById("cr-again").addEventListener("click", () => { campLeaveRun(); campRestart(); });
document.getElementById("cr-next").addEventListener("click", () => {
  const { isl, n } = campLast;
  campLeaveRun();
  campStart(isl, n + 1);
});

/* ----- Keys ----- */
(() => {
  const orig = handleKeyDown;
  document.removeEventListener("keydown", orig);
  const campKeys = e => {
    const key = e.key.toLowerCase();
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
      if (campModalOpen && e.key === "Escape") { e.preventDefault(); closeCampModal(); return true; }
      return false;
    }
    if (campModalOpen) {
      if (e.key === "Escape") { e.preventDefault(); closeCampModal(); }
      return true;
    }
    if (!campRun) return false;
    if (campRun.ready && gameState === "PLAYING") {
      const dirs = { arrowleft: "left", arrowup: "up", arrowright: "right", arrowdown: "down", a: "left", w: "up", d: "right", s: "down" };
      if (dirs[key]) { e.preventDefault(); campGo(dirs[key]); }
      else if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); campGo(); }
      else if (e.key === "Escape") { e.preventDefault(); campRun.ready = false; document.getElementById("camp-ready").hidden = true; paused = false; endGame("quit"); }
      return true;
    }
    if (gameState === "PLAYING" && !pauseOpen && !introOpen) {
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) campCast(); return true; }
      if (e.key === "Escape" || key === "p") { e.preventDefault(); if (!e.repeat) pauseGame(); return true; }
      if (key === "e") { e.preventDefault(); return true; }          // no shedding in the campaign
    }
    if (currentScreen === "campresult") {
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (e.repeat) return true;
        const next = document.getElementById("cr-next");
        (document.activeElement && document.activeElement.closest && document.activeElement.closest("#screen-campresult") ? document.activeElement : next.hidden ? document.getElementById("cr-again") : next).click();
        return true;
      }
      if (e.key === "Escape") { e.preventDefault(); campResultMap(); return true; }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s"].includes(e.key)) {
        e.preventDefault();
        moveFocus(["ArrowLeft", "ArrowUp", "a", "w"].includes(e.key) ? -1 : 1);
        return true;
      }
    }
    return false;
  };
  window.handleKeyDown = function (e) { if (campKeys(e)) return; return orig.call(this, e); };
  document.addEventListener("keydown", window.handleKeyDown);
})();

/* ----- The pause menu, campaign style ----- */
(() => {
  const orig = pauseGame;
  window.pauseGame = function () {
    orig.apply(this, arguments);
    const shop = document.getElementById("pause-shop");
    if (shop) shop.hidden = !!campRun;
    if (campRun && pauseOpen) document.getElementById("pause-score").textContent = `${campRun.def.n}. ${campRun.def.name} · Score ${fmtInt(score)}`;
  };
  const resize = updateScale;
  window.updateScale = function () { resize.apply(this, arguments); campHudPlace(); };
})();

/* A finished level shows the board, so the stage needs the board's frame */
(() => {
  const orig = showScreen;
  window.showScreen = function (name) {
    orig.apply(this, arguments);
    document.body.classList.toggle("camp-screen", ["camp", "campshop"].includes(name));
    if (name !== null && name !== "campresult" && !["pause"].includes(name) && campRun && name !== undefined) {
      // left a level through some other door (settings from pause comes back, so keep it)
      if (!["settings", "controls", "howto"].includes(name)) campLeaveRun();
    }
    requestAnimationFrame(campHudPlace);
  };
})();

/* ----- Settings: the old save's rows (paid renames, profile codes, the tutorial) give way to the campaign's ----- */
(() => {
  const fun = SETTINGS_TABS.find(tab => tab.id === "fun");
  if (!fun) return;
  const drop = ["rename", "backup", "restore", "erase", "tutorial", "story"];
  fun.rows = fun.rows.filter(r => !drop.includes(r.action) && r.key !== "scenes");
  fun.rows.unshift(
    { type: "action", action: "camp-rename", label: "Snake name", help: () => `Currently ${escapeHtml(camp ? camp.name : "Noodle")}. Renaming is free.`, button: "Rename" },
    { type: "action", action: "camp-save", label: "Your save", help: "There is one save. Back it up, load a backup, or start over.", button: "Open" }
  );
  settingsBodyEl.addEventListener("click", e => {
    const el = e.target.closest("button[data-action]");
    if (!el || !el.dataset.action.startsWith("camp-")) return;
    e.stopImmediatePropagation();
    if (el.dataset.action === "camp-rename") campAskName(() => renderSettings());
    else openSaveMenu();
  }, true);
})();

/* Touch screens: the on-screen Shed button becomes Spell, and the first swipe starts a level */
(() => {
  const orig = shedSkin;
  window.shedSkin = function () { if (campRun) { if (campRun.ready) campGo(); else campCast(); return; } return orig.apply(this, arguments); };
  const touch = updateTouchControls;
  window.updateTouchControls = function () {
    touch.apply(this, arguments);
    if (campRun && gameState === "PLAYING" && !pauseOpen && touchControlsEl.style.display !== "none") {
      touchSelectBtn.style.display = "block";
      touchSelectBtn.textContent = "Spell";
    }
  };
  const dir = handleDirectionInput;
  window.handleDirectionInput = function (d) { if (campRun && campRun.ready) { campGo(d); return; } return dir.apply(this, arguments); };
})();

/* ----- Save options: back up, restore, start over ----- */
function openSaveMenu() {
  openCampModal(`<h3>Your save</h3>
    <p class="cb-note">There is one save, and it is checked every time it loads: edits made outside the game are thrown out.${camp.flags.modded ? " <strong>This save is marked as modded</strong> because the game's data files were edited." : ""}</p>
    <div class="sm-row"><button class="btn" id="sm-export">Copy a backup code</button></div>
    <div class="sm-row"><input class="text-input" id="sm-code" placeholder="Paste a backup code (COIL1-...)" autocomplete="off" spellcheck="false"><button class="btn" id="sm-import">Load it</button></div>
    <div class="sm-row"><button class="btn btn-red" id="sm-reset">Start over</button></div>
    <p class="cb-note" id="sm-msg"></p>`);
  const msg = t => { document.getElementById("sm-msg").textContent = t; };
  document.getElementById("sm-export").addEventListener("click", async () => {
    const code = exportCamp();
    try { await navigator.clipboard.writeText(code); msg("Copied. Keep it somewhere safe."); }
    catch (e) { document.getElementById("sm-code").value = code; msg("Couldn't reach the clipboard; the code is in the box below."); }
  });
  document.getElementById("sm-import").addEventListener("click", () => {
    const err = importCamp(document.getElementById("sm-code").value);
    if (err) { msg(err); sfx("bad"); return; }
    sfx("unlock"); closeCampModal(); applyCampCosmetics(); openCampMap();
    showToast("Save loaded.");
  });
  let armed = false;
  document.getElementById("sm-reset").addEventListener("click", e => {
    if (!armed) { armed = true; e.target.textContent = "Really start over? Click again"; return; }
    resetCamp(); closeCampModal(); applyCampCosmetics(); openCampMap();
    showToast("A fresh start. Your old save was kept aside, just in case.");
  });
}

/* ----- Start ----- */
loadCamp();
applyCampCosmetics();
