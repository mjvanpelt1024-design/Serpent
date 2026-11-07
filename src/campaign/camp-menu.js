/* =========================================================
   src/campaign/camp-menu.js
   One save, no profiles.

   The title screen keeps Play, Settings and Quit. Play loads the one
   campaign save (src/campaign/camp-save.js) and opens the map; the
   first time, it asks for the snake's name on the old naming screen.
   The old profile saves stay in the code, unused: the engine still
   keeps its settings and cosmetics in profile slot 1, quietly.
   Settings' save rows (backup, restore, start over, rename) now work
   on the campaign save, through the same save-code and confirm boxes.
   ========================================================= */
"use strict";

/* The engine's own half of the save lives in slot 1; nobody picks it */
function campEngineSlot() {
  if (activeSlot !== 1) {
    if (!store.getItem(profileKey(1))) writeJson(profileKey(1), { kind: "story", created: Date.now(), avatar: "apple", named: true, tutorialDone: true });
    useProfile(1);
  }
  save.named = true;
  save.tutorialDone = true;
  applyCampCosmetics();
}

function campPlay() {
  sfx("tab");
  campEngineSlot();
  if (!camp.named) { campNaming("first"); return; }
  openScreen("modes");
}

/* ----- Naming the snake: free, on the old naming screen ----- */
function campNaming(mode) {
  namingFor = mode === "first" ? "camp-first" : "camp-rename";
  const input = document.getElementById("name-input");
  input.value = camp.name;
  document.getElementById("name-title").textContent = mode === "first" ? "Name your snake" : "Rename your snake";
  document.getElementById("name-note").textContent = "You can change it whenever you like, in Settings.";
  document.getElementById("name-back").hidden = false;
  openScreen("name");
  setTimeout(() => { input.focus(); input.select(); }, 30);
}

(() => {
  const orig = confirmName;
  window.confirmName = function () {
    if (!String(namingFor).startsWith("camp-")) return orig.apply(this, arguments);
    const name = document.getElementById("name-input").value.trim().slice(0, 16) || "Noodle";
    const first = namingFor === "camp-first";
    camp.name = name;
    camp.named = true;
    saveCamp();
    applyCampCosmetics();
    persist();
    sfx(first ? "unlock" : "buy");
    if (first) { showToast(`Off you go, ${name}.`); openScreen("modes"); }
    else { showToast(`Say hello to ${name}.`); openScreen("settings"); }
  };
  // The button was bound to the old function; give it a fresh one
  const ok = document.getElementById("name-ok");
  const fresh = ok.cloneNode(true);
  ok.replaceWith(fresh);
  fresh.addEventListener("click", () => window.confirmName());
})();

/* Play: the one save, straight to the map */
(() => {
  const play = document.querySelector('#screen-main [data-go="profiles"]');
  if (!play) return;
  const btn = play.cloneNode(true);
  btn.removeAttribute("data-go");
  btn.id = "menu-play";
  play.replaceWith(btn);
  btn.addEventListener("click", campPlay);
  // Sandbox, under Play: the level select (My Levels, New level, Paste Code)
  const sb = document.getElementById("menu-sandbox");
  if (sb) sb.addEventListener("click", () => { sfx("tab"); openShelf("mine"); });
})();

/* The old story book's scenes belong to the old islands */
window.sceneForUnlock = (id, then) => { if (then) then(); };

/* Screens that used to need a profile need the campaign's engine slot instead */
(() => {
  const orig = openScreen;
  window.openScreen = function (name) {
    if (name === "profiles") name = "main";
    // the sandbox keeps its levels in the engine's slot too (build 53: it's on the title screen, under Play)
    if (["modes", "inventory", "shelf", "sandbox"].includes(name)) campEngineSlot();
    return orig.call(this, name);
  };
  // the sandbox opens from the title screen, so its level select goes back there (build 53)
  BACK_TARGET.shelf = "main";
  const back = goBack;
  window.goBack = function () {
    if (currentScreen === "name" && String(namingFor).startsWith("camp-")) { openScreen(namingFor === "camp-first" ? "main" : "settings"); return; }
    if (currentScreen === "modes" && !mapSel && !mapPop && !mapRules) { openScreen("main"); return; }
    return back.apply(this, arguments);
  };
})();

/* ----- Settings: the save rows work on the campaign save ----- */
(() => {
  const howto = SETTINGS_TABS.flatMap(tab => tab.rows).find(r => r.go === "howto");
  if (howto) howto.help = "Islands, bosses, items and money, plus credits.";
  const fun = SETTINGS_TABS.find(tab => tab.id === "fun");
  if (!fun) return;
  const drop = ["rename", "backup", "restore", "erase", "tutorial"];
  fun.rows = fun.rows.filter(r => !drop.includes(r.action) && r.key !== "scenes");
  fun.rows.unshift(
    { type: "action", action: "camp-rename", label: "Snake name", help: () => `Currently ${escapeAttr(camp ? camp.name : "Noodle")}. Renaming is free.`, button: "Rename" },
    { type: "action", action: "camp-backup", label: "Back up your progress", help: "Copy a save code you can keep, or move to another device.", button: "Back up" },
    { type: "action", action: "camp-restore", label: "Restore a backup", help: "Paste a save code to bring your progress back.", button: "Restore" },
    { type: "action", action: "camp-reset", label: "Start over", help: () => `Begin again from the first island.${camp && camp.flags.modded ? " This save is marked as modded: the game's data files were edited." : ""} The old save is kept aside, just in case.`, button: "Start over" }
  );
  settingsBodyEl.addEventListener("click", e => {
    const el = e.target.closest("button[data-action]");
    if (!el || !el.dataset.action.startsWith("camp-")) return;
    e.stopImmediatePropagation();
    const a = el.dataset.action;
    if (a === "camp-rename") campNaming("rename");
    else if (a === "camp-backup") openSaveModal("export");
    else if (a === "camp-restore") openSaveModal("import");
    else openConfirm({
      title: "Start over?",
      text: "Your snake goes back to the first island with empty pockets. The old save is kept aside in storage, not deleted.",
      ok: "Start over",
      onOk: () => { resetCamp(); applyCampCosmetics(); persist(); renderSettings(); showToast("A fresh start. The first island is waiting."); sfx("unlock"); }
    });
  }, true);
})();

/* The save-code box speaks the campaign's codes (COIL1-...) */
window.saveCode = () => exportCamp();
(() => {
  const go = document.getElementById("savecode-go");
  const fresh = go.cloneNode(true);
  go.replaceWith(fresh);
  fresh.addEventListener("click", () => {
    const text = document.getElementById("savecode-text");
    const msg = document.getElementById("savecode-msg");
    if (savecodeMode === "export") { savecodeGo(); return; }
    const got = parseCampCode(text.value);
    if (got.err) { msg.classList.remove("ok"); msg.textContent = got.err; sfx("bad"); return; }
    closeSaveModal();
    openConfirm({
      title: "Replace your progress?",
      text: "The backup takes the place of your current save. Back up first if you are unsure.",
      ok: "Restore backup",
      onOk: () => { camp = got.data; saveCamp(); applyCampCosmetics(); persist(); showToast("Backup restored."); sfx("unlock"); }
    });
  });
  const orig = openSaveModal;
  window.openSaveModal = function (mode) {
    orig.apply(this, arguments);
    document.getElementById("savecode-text").placeholder = mode === "export" ? "" : "Paste your save code (it starts with COIL1-)";
  };
})();
