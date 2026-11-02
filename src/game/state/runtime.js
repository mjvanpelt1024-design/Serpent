/* =========================================================
   src/game/state/runtime.js
   Live run state: the snake, items, timers
   ========================================================= */
"use strict";

/* =========================================================
   Runtime state
   ========================================================= */
let gameState = "MAIN";
let currentScreen = "main";
let currentModeKey = "easy";

let score = 0;
let wallsMode = false;
let hazardMode = false;
let scoreMultiplier = 1;
let moveInterval = 1000 / 5;
let maxPopsicle = 0;
let popsicleEffect = "none";

let lastFrameTs = 0;
let lastMoveTs = 0;
let survivalAccumulator = 0;
let frozenAt = 0;

const snake = { x: 160, y: 160, dx: grid, dy: 0, cells: [], maxCells: 4 };
let popsicles = [];
let popsicleSpawnTimeout = null;
let orbs = [];
let orbAccumulator = 0;
let runMs = 0;
let allowanceAccumulator = 0;
let currentHearts = 0;

/* Turns wait here and are applied one per move, so two fast presses
   can't reverse the snake into its own neck before it has moved. */
const MAX_QUEUED_TURNS = 3;
let turnQueue = [];

let upgradeTab = "temporary";
let confirmOpen = false;

const bgCanvas = document.createElement("canvas");
bgCanvas.width = boardSize;
bgCanvas.height = boardSize;
const bgCtx = bgCanvas.getContext("2d");

/* The board draws in 400-unit coordinates, scaled to the real pixels on screen
   so it stays sharp on big monitors and high-density screens */
let RS = 1;
let viewH = boardSize;

function sizeCanvas(h) {
  viewH = h;
  canvas.width = Math.round(boardSize * RS);
  canvas.height = Math.round(h * RS);
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
}

/* Size the board: the biggest square that fits the window with the HUD,
   toasts and touch buttons around it. Tries the stacked layout and the
   side-rail layout and keeps whichever gives the bigger board. */
const UI_MIN = 0.82, UI_MAX = 2.6;
const uiFor = s => Math.max(UI_MIN, Math.min(UI_MAX, s / 408));
let layoutKey = "";
let stageSize = 0;
function layoutStage() {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  // Stacked: HUD above, toasts below, and the d-pad under that on touch screens
  const reserveEm = 9 + (touch ? 8 : 0);
  let tall = Math.min(vw - 16, 2000);
  for (let i = 0; i < 4; i++) tall = Math.min(vw - 16, vh - 18 - reserveEm * 15 * uiFor(tall));
  // Side rails: HUD on the left, toasts and d-pad on the right
  const rail = Math.round(Math.max(130, Math.min(290, vw * 0.17)));
  const gap = Math.round(Math.max(12, Math.min(28, vw * 0.015)));
  const side = Math.min(vh - 30, vw - 2 * rail - 2 * gap - 16);
  const wide = side > tall + 8 && vw > vh;
  const size = Math.max(240, Math.floor(wide ? side : tall));
  const key = [size, wide, rail, gap].join();
  if (key === layoutKey) return;
  layoutKey = key;
  stageSize = size;
  const root = document.documentElement.style;
  document.body.classList.toggle("wide", wide);
  root.setProperty("--stage", size + "px");
  root.setProperty("--rail", rail + "px");
  root.setProperty("--rail-gap", gap + "px");
  root.setProperty("--rail-ui", Math.max(0.7, Math.min(uiFor(size), rail / 150)).toFixed(3));
}

/* Menus fill the whole window, so they get their own scale from the window size */
function layoutMenus() {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const mui = Math.max(0.85, Math.min(2, vw / 420, vh / 500));
  const root = document.documentElement.style;
  root.setProperty("--mui", mui.toFixed(3));
  root.setProperty("--bar", Math.round(46 * mui) + "px");
}

function updateScale(relayout = true) {
  if (relayout) { layoutStage(); layoutMenus(); }
  const cssW = stageEl.clientWidth || 408;
  // Scale from the board's set size (not its measured inside), so the border can't feed back into it
  const ui = uiFor(stageSize ? stageSize * 0.982 : cssW).toFixed(3);
  if (document.documentElement.style.getPropertyValue("--ui") !== ui) document.documentElement.style.setProperty("--ui", ui);
  const next = Math.max(1, Math.min(4, Math.round(((stageEl.clientWidth || cssW) / boardSize) * (window.devicePixelRatio || 1) * 4) / 4));
  if (next !== RS) {
    RS = next;
    sizeCanvas(viewH);
    applyBackdrop();
    if (typeof render === "function") render(performance.now());
  }
}
