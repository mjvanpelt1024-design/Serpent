/* =========================================================
   src/campaign/camp-runend.js
   The end-of-run screen (build 57): after a win or a loss the board stays
   up behind a card that says how it went, with a little animation each way
   (a gold medal bursting for a win, a skull dropping with the board going
   grey for a loss). Continue goes on to the map (camp-screens.js decides
   where); Try again (or Play again) starts the same level over.
   ========================================================= */
"use strict";

let runEnd = null;               // { report, target } while the screen is up
let runEndAt = 0;
const runEndEl = document.createElement("section");
runEndEl.id = "screen-runend";
runEndEl.className = "overlay runend";
runEndEl.setAttribute("aria-label", "Level result");
screenEls.gameover.parentNode.appendChild(runEndEl);

const RE_STAR = '<svg class="re-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l3 6.9 7.5.7-5.7 5 1.7 7.4L12 17.7 5.5 21.5l1.7-7.4-5.7-5 7.5-.7z"/></svg>';

function showRunEnd(report, target) {
  const R = report, won = R.won;
  runEnd = { report, target };
  runEndAt = performance.now();
  const nextOpen = won && target && typeof target.id === "number" && target.id === R.n + 1 && campRun.challenge < 0;
  const sparks = Array.from({ length: won ? 14 : 8 }, (_, i) => `<i class="re-spark" style="--a:${Math.round(i * 360 / (won ? 14 : 8) + (i % 2) * 9)}deg;--d:${(3.2 + (i % 3) * 0.8).toFixed(1)}em;--t:${(i * 0.03).toFixed(2)}s"></i>`).join("");
  runEndEl.className = "overlay runend " + (won ? "won" : "lost");
  runEndEl.innerHTML = `<div class="re-card">
      <div class="re-medal">${won ? '<div class="re-rays"></div>' : ""}${sparks}${won ? RE_STAR : SKULL_SVG.replace('class="skull"', 'class="re-ico"')}</div>
      <p class="re-kick">${escapeAttr(CAMP.islandById[R.isl].name)} · ${R.n}. ${escapeAttr(R.name)}</p>
      <h2 class="re-title">${escapeAttr(R.title)}</h2>
      <p class="re-score"><b data-re-score>0</b> points${R.best ? ' <span class="re-best">new best!</span>' : ""}</p>
      <div class="re-lines">${R.lines.concat([]).map((l, i) => `<p class="re-line" style="--i:${i}">${l}</p>`).join("")}${R.notes.map((l, i) => `<p class="re-line re-new" style="--i:${R.lines.length + i}">${escapeAttr(l)}</p>`).join("")}</div>
      ${R.line ? `<p class="re-cause">${escapeAttr(R.line)}</p>` : ""}
      <div class="re-acts"><button class="btn" data-re="again">${won ? "Play again" : "Try again"}</button><button class="btn ${won ? "btn-gold" : "btn-primary"}" data-re="go">Continue</button></div>
      <p class="re-hint">Enter to continue · R to ${won ? "play again" : "try again"}</p>
    </div>`;
  document.body.classList.add(won ? "re-won" : "re-lost");
  runEndEl.classList.add("active");
  // the score counts up while the card settles
  const total = Math.max(0, R.score), el = runEndEl.querySelector("[data-re-score]"), t0 = performance.now() + 350;
  const tick = now => {
    if (!runEnd || runEnd.report !== report) return;
    const k = Math.min(1, Math.max(0, (now - t0) / 900));
    el.textContent = fmtInt(Math.round(total * (1 - (1 - k) * (1 - k))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  runEndEl.querySelector('[data-re="go"]').addEventListener("click", runEndGo);
  runEndEl.querySelector('[data-re="again"]').addEventListener("click", runEndAgain);
  setTimeout(() => { const b = runEndEl.querySelector('[data-re="go"]'); if (b && runEnd) b.focus({ preventScroll: true }); }, 700);
  if (nextOpen) runEndEl.querySelector('[data-re="go"]').textContent = "Next level";
}

function closeRunEnd() {
  runEnd = null;
  runEndEl.classList.remove("active", "won", "lost");
  runEndEl.innerHTML = "";
  document.body.classList.remove("re-won", "re-lost");
}
function runEndGo() {
  if (!runEnd) return;
  const { report, target } = runEnd;
  closeRunEnd();
  campResultLeave(report, target);
}
function runEndAgain() {
  if (!runEnd) return;
  closeRunEnd();
  campLeaveRun();
  clearPauseState();
  campRestart();
}

/* While it's up the keys are its own; a short lock so a death-time Space tap doesn't skip it */
document.addEventListener("keydown", e => {
  if (!runEnd) return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.repeat || performance.now() - runEndAt < 700) return;
  const k = e.key.toLowerCase();
  if (k === "enter" || k === " " || k === "escape") runEndGo();
  else if (k === "r") runEndAgain();
}, true);
