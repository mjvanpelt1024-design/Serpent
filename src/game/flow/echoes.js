/* =========================================================
   src/game/flow/echoes.js
   Echoes: on islands with "echoes = true" in their [rules], the
   path you took a few seconds ago comes back as a solid Echo that
   retraces it move for move, just behind your tail. Cross your own
   recent path and you meet yourself.
   ========================================================= */
"use strict";

let trail = [];           // every square the head has been, oldest first
let echo = null;          // { nextAt, active: { idx, len, steps } }
const ECHO_FIRST = 9000;
const ECHO_EVERY = 14000;
const ECHO_GAP = 4;       // squares between your tail and the echo's head when it appears
const ECHO_LEN = 7;
const ECHO_STEPS = 80;    // how many moves an echo lasts

const echoesHere = () => !!(modes[currentModeKey] && modes[currentModeKey].echoes) || !!nm.echoes;

function resetEchoes() {
  trail = [];
  echo = echoesHere() ? { nextAt: ECHO_FIRST, active: null } : null;
}

/* Called once per move of your snake, after it has moved */
function stepEchoes(grace = false) {
  if (!echo) return false;
  trail.push({ x: snake.x, y: snake.y });
  if (trail.length > 1200) { trail.splice(0, 400); if (echo.active) echo.active.idx -= 400; }
  const a = echo.active;
  if (a) {
    a.idx++;
    a.steps--;
    if (a.steps <= 0 || a.idx < 0) {
      echo.active = null;
      echo.nextAt = runMs + ECHO_EVERY * (nm.echoes ? 0.6 : 1) * (1 + getTrackValue("dilation") / 100);
    }
  } else if (runMs >= echo.nextAt) {
    const idx = trail.length - 1 - (snake.cells.length + ECHO_GAP);
    if (idx > ECHO_LEN) {
      echo.active = { idx, len: ECHO_LEN + (nm.echoes ? 4 : 0), steps: ECHO_STEPS };
      showToast("An Echo of you is following your path. Don't cross it.");
      sfx("portal");
    } else {
      echo.nextAt = runMs + 2000;
    }
  }
  return grace ? false : echoHitsHead();
}

function echoCells() {
  const a = echo && echo.active;
  if (!a) return [];
  const out = [];
  for (let i = 0; i < a.len; i++) {
    const p = trail[a.idx - i];
    if (p) out.push(p);
  }
  return out;
}

/* Your head met the echo: it costs a heart, and the echo breaks */
function echoHitsHead() {
  const cells = echoCells();
  if (!cells.some(c => c.x === snake.x && c.y === snake.y)) return false;
  echo.active = null;
  echo.nextAt = runMs + ECHO_EVERY;
  if (starOn() || phantomOn()) { addScore(50 * scoreMultiplier); return false; }
  if (roll(getTrackValue("paradox") + getTrackValue("nm_chrono"))) { showToast("Paradox! The echo flickered out of your way."); return false; }
  sfx("bad");
  return takeHit(1, "echo");
}

function drawEcho(view, ts) {
  const cells = echoCells();
  if (!cells.length) return;
  const a = echo.active;
  ctx.save();
  cells.forEach((c, i) => {
    const [x, y] = view.toScreen(c.x, c.y);
    ctx.globalAlpha = (a.steps < 10 ? a.steps / 10 : 1) * (0.75 - i * 0.05);
    ctx.fillStyle = i === 0 ? "#9fe8ff" : "#5ab8e0";
    ctx.fillRect(x + 1, y + 1, cell - 3, cell - 3);
    if (i === 0) {
      ctx.fillStyle = "#0a2a3a";
      ctx.fillRect(x + cell * 0.25, y + cell * 0.3, cell * 0.15, cell * 0.15);
      ctx.fillRect(x + cell * 0.6, y + cell * 0.3, cell * 0.15, cell * 0.15);
    }
  });
  ctx.restore();
}

/* Crown of the Chrono Rift: points every second an echo is out */
function echoAfterimage() {
  return echo && echo.active ? getTrackValue("afterimage") : 0;
}
