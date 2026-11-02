/* =========================================================
   src/ui/elements.js
   References to the page's elements
   ========================================================= */
"use strict";

/* =========================================================
   Elements
   ========================================================= */
const stageEl = document.getElementById("stage");
const heartsEl = document.getElementById("hearts");
const hudScoreEl = document.getElementById("hud-score");
const xpEl = document.getElementById("xp");
const xpAmountEl = document.getElementById("xp-amount");
const xpFillEl = document.getElementById("xp-fill");
const xpPendingEl = document.getElementById("xp-pending");
const bucksAmountEl = document.getElementById("bucks-amount");

const screenEls = {
  main: document.getElementById("screen-main"),
  profiles: document.getElementById("screen-profiles"),
  modes: document.getElementById("screen-modes"),
  rules: document.getElementById("screen-rules"),
  gameover: document.getElementById("screen-gameover"),
  upgrades: document.getElementById("screen-upgrades"),
  tree: document.getElementById("screen-tree"),
  global: document.getElementById("screen-global"),
  inventory: document.getElementById("screen-inventory"),
  name: document.getElementById("screen-name"),
  sandbox: document.getElementById("screen-sandbox"),
  shelf: document.getElementById("screen-shelf"),
  story: document.getElementById("screen-story"),
  achievements: document.getElementById("screen-achievements"),
  stats: document.getElementById("screen-stats"),
  settings: document.getElementById("screen-settings"),
  controls: document.getElementById("screen-controls"),
  howto: document.getElementById("screen-howto"),
  console: document.getElementById("screen-console")
};

const BACK_TARGET = {
  profiles: "main",
  modes: "profiles",
  rules: "modes",
  gameover: "main",
  upgrades: "profiles",
  tree: "modes",
  global: "profiles",
  inventory: "modes",
  story: "achievements",
  name: "settings",
  sandbox: "shelf",
  shelf: "modes",
  achievements: "profiles",
  stats: "achievements",
  settings: "main",
  controls: "settings",
  howto: "settings",
  console: "settings"
};

const rulesTitleEl = document.getElementById("rules-title");
const rulesTextEl = document.getElementById("rules-text");
const rulesMultEl = document.getElementById("rules-mult");
const finalScoreEl = document.getElementById("final-score");
const finalExtraEl = document.getElementById("final-extra");
const achBodyEl = document.getElementById("ach-body");
const achCountEl = document.getElementById("ach-count");
const achBarEl = document.getElementById("ach-bar");
const achBarWrapEl = document.getElementById("ach-bar-wrap");
const toastEl = document.getElementById("toast");
const rulesHintEl = document.getElementById("rules-hint");
const newBestEl = document.getElementById("new-best");
const commentaryEl = document.getElementById("commentary");
const upgradeBodyEl = document.getElementById("upgrade-body");
const statsBodyEl = document.getElementById("stats-body");
const settingsTabsEl = document.getElementById("settings-tabs");
const settingsBodyEl = document.getElementById("settings-body");
const buildEl = document.getElementById("build-number");
const confirmEl = document.getElementById("confirm");
const introEl = document.getElementById("intro");
const sceneEl = document.getElementById("scene");

const touchControlsEl = document.getElementById("touch-controls");
const touchSelectBtn = document.getElementById("touch-select");
const touchBackBtn = document.getElementById("touch-back");
const touchArrowIds = ["touch-up", "touch-left", "touch-down", "touch-right"];
