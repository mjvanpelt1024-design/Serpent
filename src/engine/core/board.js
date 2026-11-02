/* =========================================================
   src/engine/core/board.js
   The board canvas and its fixed grid
   ========================================================= */
"use strict";

/* =========================================================
   Board
   ========================================================= */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const grid = 20;
const boardSize = 400;          // the board is always 400 units across, drawn crisp at any size
const cellsPerSide = boardSize / grid;

const APPLE_COLOR = "#ff0000";

/* XP orbs: every run starts with the mode's startOrbs, then every
   ORB_ROLL_MS of play there's an orbChance roll for another one. */
const ORB_ROLL_MS = 5000;
const MAX_ORBS = 8;
const POPSICLE_COLOR = "#00ffff";
const ORB_COLOR = "#ffd23f";
