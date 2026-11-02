/* =========================================================
   src/ui/settings.js
   The settings screen
   ========================================================= */
"use strict";

/* =========================================================
   Settings screen
   ========================================================= */
/* Settings are described as data, one list per tab */
const SETTINGS_TABS = [
  {
    id: "gameplay",
    label: "Gameplay",
    rows: [
      { type: "switch", key: "showScore", label: "Show score while playing", help: "Turn it off if the pressure gets to you." },
      { type: "switch", key: "showBest", label: "Show your best score too", help: "A little extra motivation, right under your score." },
      { type: "switch", key: "keysArrows", label: "Steer with arrow keys", help: "Menus always work with the arrow keys either way." },
      { type: "switch", key: "keysWasd", label: "Steer with WASD", help: "Turn off if you keep bumping the keys." },
      { type: "switch", key: "intros", label: "Explain new items", help: "Pauses the game the first time something new shows up." },
      { type: "cycle", key: "buffer", id: "set-buffer", label: "Turn buffer", help: "How many quick turns the snake remembers when you tap fast.", options: [[1, "1 turn"], [2, "2 turns"], [3, "3 turns"]] },
      { type: "cycle", key: "swipe", id: "set-swipe", label: "Swipe sensitivity", help: "How far a swipe on the board has to travel on touch screens.", options: SWIPE_OPTIONS },
      { type: "link", go: "controls", label: "Controls", help: "Keys, swipes and buttons." },
      { type: "link", go: "howto", label: "How to play", help: "A short guide to hazards, XP and prestige, plus credits." }
    ]
  },
  {
    id: "display",
    label: "Audio & display",
    rows: [
      { type: "switch", key: "sound", label: "Sound effects", help: "Bleeps, bloops and one sad trombone." },
      { type: "range", key: "sfxVolume", label: "Effects volume", min: 0, max: 100, step: 5, unit: "%" },
      { type: "switch", key: "vibration", label: "Vibration", help: "Short buzzes when you get hurt, on phones that can do it." },
      { type: "switch", key: "awake", label: "Keep the screen on", help: "Stops your phone from dimming in the middle of a run." },
      { type: "switch", key: "music", label: "Music", help: "An original chiptune soundtrack, with a theme for every mood." },
      { type: "range", key: "musicVolume", label: "Music volume", min: 0, max: 100, step: 5, unit: "%" },
      { type: "range", key: "brightness", label: "Brightness", help: "For the board.", min: 70, max: 130, step: 5, unit: "%" },
      { type: "range", key: "contrast", label: "Contrast", help: "For the board.", min: 70, max: 130, step: 5, unit: "%" },
      { type: "switch", key: "details", label: "Item details", help: "Shading on items and the snake. Off is plain colors." },
      { type: "switch", key: "extras", label: "Item extras", help: "Stems, sticks, glows and rounded snake segments." },
      { type: "switch", key: "themedPage", label: "Theme colors", help: "Menus, panels and the background take on your theme's colors. Off keeps the Garden look." },
      { type: "switch", key: "bgMotion", label: "Moving background", help: "The swirl and your theme's flair drift slowly behind the board." },
      { type: "switch", key: "particles", label: "Theme flair", help: "Petals, embers, snow and the rest, depending on your theme." },
      { type: "action", action: "fullscreen", id: "set-fullscreen", label: "Full screen", help: "Fill the whole screen with the game. The F key does this too.", button: () => document.fullscreenElement ? "Exit" : "Go full" },
      { type: "switch", key: "crt", label: "Retro screen", help: "Faint scanlines and darker corners, like an old monitor." },
      { type: "switch", key: "menuDemo", label: "Title screen snake", help: "Your snake plays by itself behind the main menu." },
      { type: "cycle", key: "shake", id: "set-shake", label: "Screen shake on crash", help: "From barely-there to seismic.", options: SHAKE_OPTIONS }
    ]
  },
  {
    id: "fun",
    label: "Just for fun",
    rows: [
      { type: "action", action: "rename", id: "set-name", label: "Snake name", help: () => `Currently ${escapeAttr(snakeName())}. Renaming costs ${fmtInt(renameCost())} XP.`, button: "Rename" },
      { type: "cycle", key: "commentary", id: "set-commentary", label: "Death commentary", help: "What the narrator says when you lose.", options: COMMENTARY_OPTIONS },
      { type: "cycle", key: "scoreUnit", id: "set-unit", label: "Score units", help: "Scientists still argue about what the snake is actually scoring.", options: SCORE_UNITS },
      { type: "switch", key: "confetti", label: "Confetti on a new high score", help: "You earned it. Probably." },
      { type: "action", action: "backup", label: "Back up your progress", help: "Copy a save code you can keep, or move to another device.", button: "Back up" },
      { type: "action", action: "restore", label: "Restore a backup", help: "Paste a save code to bring your progress back.", button: "Restore" },
      { type: "action", action: "erase", label: "Erase all progress", help: "Start over from scratch. This cannot be undone.", button: "Erase" },
      { type: "action", action: "tutorial", label: "Play the tutorial", help: "A quick refresher. The free Revive only comes the first time.", button: "Play" },
      { type: "switch", key: "chatter", label: "Chatter bubbles", help: "Now and then the narrator (purple) or your snake (green) pipes up." },
      { type: "switch", key: "scenes", label: "Play scenes on unlock", help: "Shows a short story scene when you unlock a new mode." }
    ]
  }
];

let settingsTab = "gameplay";

function renderSettings() {
  settingsTabsEl.innerHTML = SETTINGS_TABS.map(t =>
    `<button class="tab" role="tab" data-settab="${t.id}" aria-selected="${t.id === settingsTab}">${t.label}</button>`
  ).join("");

  const tab = SETTINGS_TABS.find(t => t.id === settingsTab);
  settingsBodyEl.innerHTML = tab.rows.map(row => {
    const help = typeof row.help === "function" ? row.help() : row.help;
    const text = `<div><div class="set-label">${row.label}</div>${help ? `<div class="set-help">${help}</div>` : ""}</div>`;
    if (row.type === "action") {
      return `<div class="set-row">${text}<button class="btn btn-small" ${row.id ? `id="${row.id}"` : ""} data-action="${row.action}">${typeof row.button === "function" ? row.button() : row.button}</button></div>`;
    }
    const v = save.settings[row.key];
    if (row.type === "switch") {
      return `<div class="set-row">${text}<button class="switch" role="switch" data-setting="${row.key}" aria-checked="${!!v}" aria-label="${row.label}"></button></div>`;
    }
    if (row.type === "cycle") {
      const opt = row.options.find(o => o[0] === v) || row.options[0];
      return `<div class="set-row">${text}<button class="btn btn-small set-cycle" id="${row.id}" data-cycle="${row.key}">${opt[1]}</button></div>`;
    }
    if (row.type === "range") {
      return `<div class="set-row">${text}<span class="range-wrap"><input type="range" data-range="${row.key}" min="${row.min}" max="${row.max}" step="${row.step}" value="${v}" aria-label="${row.label}"><output>${v}${row.unit}</output></span></div>`;
    }
    if (row.type === "text") {
      return `<div class="set-row">${text}<input id="${row.id}" class="text-input" type="text" maxlength="16" autocomplete="off" spellcheck="false" aria-label="${row.label}" data-text="${row.key}" value="${escapeAttr(v)}"></div>`;
    }
    if (row.type === "link") {
      return `<div class="set-row">${text}<button class="btn btn-small" data-go="${row.go}">View</button></div>`;
    }
    return `<div class="set-row disabled">${text}<span class="soon-tag">Coming soon</span></div>`;
  }).join("") + `<button class="btn btn-small btn-quiet tab-reset" data-settings-reset="${tab.id}">Restore ${tab.label.toLowerCase()} defaults</button>`;
}

function escapeAttr(v) {
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function syncSettings() {
  if (currentScreen === "settings") renderSettings();
  applySettingsEffects();
}

/* Visual settings that change the page itself */
function applySettingsEffects() {
  const root = document.documentElement.style;
  root.setProperty("--bright", save.settings.brightness / 100);
  root.setProperty("--contrast", save.settings.contrast / 100);
  applyTheme();
  updateHud();
}

function toggleSetting(key) {
  const next = !save.settings[key];
  if (!next && (key === "keysArrows" || key === "keysWasd")) {
    const other = key === "keysArrows" ? "keysWasd" : "keysArrows";
    if (!save.settings[other]) {
      showToast("Keep one keyboard option on so the keys can still steer.");
      return;
    }
  }
  save.settings[key] = next;
  persist();
  syncSettings();
  if (key === "sound" && save.settings.sound) sfx("click");
  else sfx("toggle");
  updateMusic();
}

function cycleSetting(key) {
  const row = SETTINGS_TABS.flatMap(t => t.rows).find(r => r.key === key);
  const i = row.options.findIndex(o => o[0] === save.settings[key]);
  save.settings[key] = row.options[(i + 1) % row.options.length][0];
  persist();
  syncSettings();
}

function resetSettingsTab(tabId) {
  const defaults = defaultSettings();
  const tab = SETTINGS_TABS.find(t => t.id === tabId);
  tab.rows.forEach(row => { if (row.key) save.settings[row.key] = defaults[row.key]; });
  persist();
  syncSettings();
  showToast(`${tab.label} settings restored.`);
}

function scoreUnitLabel() {
  const u = SCORE_UNITS.find(o => o[0] === save.settings.scoreUnit) || SCORE_UNITS[0];
  return u[2];
}
