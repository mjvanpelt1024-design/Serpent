/* =========================================================
   src/game/save/backups.js
   Save codes: backing up and restoring
   ========================================================= */
"use strict";

/* =========================================================
   Backups: a save code you can keep, and restore from
   ========================================================= */
const SAVE_PREFIX = "SNKSAVE1-";

function saveCode() {
  const copy = JSON.parse(JSON.stringify(save));
  delete copy.dev;                         // cheat state stays on this device
  return SAVE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(copy))));
}

function parseSaveCode(code) {
  try {
    const raw = String(code || "").trim();
    if (!raw.startsWith(SAVE_PREFIX)) return null;
    const obj = JSON.parse(decodeURIComponent(escape(atob(raw.slice(SAVE_PREFIX.length)))));
    if (!obj || typeof obj !== "object" || typeof obj.xp !== "number" || !obj.tiers) return null;
    return sanitizeSave(obj);
  } catch (e) {
    return null;
  }
}

function restoreSave(next) {
  clearPauseState();
  const dev = save.dev;
  // A save code lands on the save you're on, or the first empty slot (savecodeGo checks there is one)
  if (!activeSlot) {
    const n = firstEmptySlot();
    if (!n) return false;
    activeSlot = n;
    store.setItem(ACTIVE_KEY, String(n));
  }
  save = next;
  save.dev = dev;
  persist();
  applyEconomy();
  applyBackdrop();
  syncSettings();
  updateLiveStats(true);
  lastHeartsKey = "";
  updateHud();
  if (currentScreen === "settings") renderSettings();
  return true;
}

function firstEmptySlot() {
  for (let n = 1; n <= PROFILE_SLOTS; n++) if (!store.getItem(profileKey(n))) return n;
  return 0;
}

let savecodeOpen = false;
let savecodeMode = "export";

function openSaveModal(mode) {
  savecodeMode = mode;
  savecodeOpen = true;
  const text = document.getElementById("savecode-text");
  const msg = document.getElementById("savecode-msg");
  msg.textContent = "";
  msg.classList.remove("ok");
  document.getElementById("savecode-title").textContent = mode === "export" ? "Back up your progress" : "Restore a backup";
  document.getElementById("savecode-help").textContent = mode === "export"
    ? "Keep this code somewhere safe. Paste it into Restore on any device to bring your progress back."
    : "Paste a save code here. It replaces your current progress, so back up first if you are unsure.";
  text.readOnly = mode === "export";
  text.value = mode === "export" ? saveCode() : "";
  text.placeholder = mode === "export" ? "" : "Paste your save code (it starts with SNKSAVE1-)";
  document.getElementById("savecode-go").textContent = mode === "export" ? "Copy code" : "Restore";
  document.getElementById("savecode").classList.add("active");
  setTimeout(() => { text.focus({ preventScroll: true }); if (mode === "export") text.select(); }, 30);
}

function closeSaveModal() {
  savecodeOpen = false;
  document.getElementById("savecode").classList.remove("active");
}

function savecodeGo() {
  const text = document.getElementById("savecode-text");
  const msg = document.getElementById("savecode-msg");
  if (savecodeMode === "export") {
    text.select();
    const done = ok => { msg.textContent = ok ? "Copied. Keep it somewhere safe." : "Select the code and copy it by hand."; msg.classList.toggle("ok", ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text.value).then(() => done(true), () => done(false));
    else { try { done(document.execCommand("copy")); } catch (e) { done(false); } }
    return;
  }
  const next = parseSaveCode(text.value);
  if (!next) {
    msg.classList.remove("ok");
    msg.textContent = "That does not look like a save code. It should start with " + SAVE_PREFIX;
    sfx("bad");
    return;
  }
  if (!activeSlot && !firstEmptySlot()) {
    msg.classList.remove("ok");
    msg.textContent = "All three saves are in use. Open the save you want to replace, then restore the backup there.";
    sfx("bad");
    return;
  }
  closeSaveModal();
  const where = activeSlot ? `the save you have open (save ${activeSlot})` : `empty save ${firstEmptySlot()}`;
  openConfirm({
    title: "Replace your progress?",
    text: `This backup has ${fmtInt(next.xp)} XP and ${next.badges.length} badges. It goes into ${where}. ` +
      "Snakebucks, the Great Tree, cosmetics, badges, stats and settings are shared by every save, so those are replaced for all three saves.",
    ok: "Restore backup",
    onOk: () => { if (restoreSave(next)) { showToast("Backup restored."); sfx("unlock"); } }
  });
}

document.getElementById("savecode-cancel").addEventListener("click", closeSaveModal);
document.getElementById("savecode-go").addEventListener("click", savecodeGo);

function openConfirm(opts) {
  document.getElementById("confirm-title").textContent = opts.title;
  document.getElementById("confirm-text").textContent = opts.text;
  const okBtn = document.getElementById("confirm-ok");
  okBtn.textContent = opts.ok;
  okBtn.className = opts.gold ? "btn btn-primary" : "btn btn-danger";
  confirmEl.classList.toggle("gold", !!opts.gold);

  confirmAction = opts.onOk;
  confirmReturnFocus = document.activeElement;
  confirmOpen = true;
  confirmEl.classList.add("active");
  document.getElementById("confirm-cancel").focus({ preventScroll: true });
}

function closeConfirm() {
  confirmOpen = false;
  confirmEl.classList.remove("active");
  clearKbdFocus();
  if (confirmReturnFocus && document.contains(confirmReturnFocus) && confirmReturnFocus.offsetParent !== null) {
    confirmReturnFocus.focus({ preventScroll: true });
  }
}

function confirmOk() {
  const action = confirmAction;
  confirmAction = null;
  closeConfirm();
  if (action) action();
}

function confirmResetAll() {
  openConfirm({
    title: "Reset the whole game?",
    text: "This deletes all experience, upgrades, prestige, skins, themes, scores, stats, achievements and settings. There is no undo.",
    ok: "Reset everything",
    onOk: resetEverything
  });
}

function resetEverything() {
  clearPauseState();
  const keys = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith("snake")) keys.push(k);
  }
  keys.forEach(k => store.removeItem(k));

  stopPopsicles();
  orbs = [];
  apples = [];
  endless = null;
  score = 0;
  activeSlot = 0;
  save = defaultSave();
  upgradeTab = "temporary";
  lastHeartsKey = "";

  applyBackdrop();
  syncSettings();
  updateLiveStats(true);

  confirmOpen = false;
  confirmEl.classList.remove("active");
  openScreen("main");
}
