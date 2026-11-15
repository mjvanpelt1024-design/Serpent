/* =========================================================
   src/ui/tour.js
   The tutorial engine (back in build 57).

   The screen darkens except for the one thing to press, and a teal box at
   the bottom says what it is. A tutorial is made of CHAPTERS, each a short
   list of steps for one part of the game (the map, home, the merchant, the
   upgrade tree, the daily gift...). The chapters themselves are written in
   src/campaign/camp-tutorial.js and pushed onto TUT_CHAPTERS; this file only
   runs them:

     chapter  { id, title, when(), steps[], after(), skipIf() }
              when()   true while the chapter should start (checked twice in a row, half a second apart)
              skipIf() true if there is nothing left to teach (marks it done without showing it)
     step     { text, target, until, next, enter, pass, skip, arrow }
              text     a string, or a function that returns one ({name} is the snake's name)
              target   what to light up: an element, a list of them (one hole around all), or a function that returns either
              until    a function: the step is over when it returns true
              next     show a Next button as well
              enter    runs when the step starts
              pass     the board behind stays clickable and keys go through
              skip     a function: leave this step out when it returns true
              arrow    a bouncing arrow beside the target, for the one thing you must not miss

   Which chapters are done is kept in the save (camp.tut). "Skip" leaves the
   chapter being shown; "Skip all" turns the tips off (camp.tutOff); Settings
   can replay them.
   ========================================================= */
"use strict";

let tutorial = null;            // the old in-run tutorial is gone; the engine still checks this
function tutorialEvent() {}
function tutorialFail() {}
let guide = null;               // { ch, i, step } while a chapter runs
let guideRun = false;           // the first level, played right after the welcome chapter
let guideRaf = 0;
const TUT_CHAPTERS = [];
const guideEl = document.getElementById("guide");
const guideShadeEl = document.getElementById("guide-shade");
const guideRingEl = document.getElementById("guide-ring");
const guideArrowEl = document.getElementById("guide-arrow");
const guideBoxEl = document.getElementById("guide-box");

const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const visible = el => !!(el && el.isConnected && el.getClientRects().length && !el.closest("[hidden]") && getComputedStyle(el).visibility !== "hidden");

/* ----- Which chapters are done ----- */
const tutSeen = id => !!(camp && camp.tut && camp.tut.includes(id));
function tutMark(id) {
  if (!camp || tutSeen(id)) return;
  camp.tut.push(id);
  saveCamp();
}

/* A target can be an element, a list of them, or a function that returns either: the ones on screen */
function tutTargets(st) {
  let t = typeof st.target === "function" ? st.target() : st.target;
  if (!t) return [];
  if (!Array.isArray(t) && !(t instanceof NodeList)) t = [t];
  return Array.from(t).filter(visible);
}

/* ----- Running a chapter ----- */
function tutStart(id) {
  const ch = TUT_CHAPTERS.find(c => c.id === id);
  if (!ch || guide) return false;
  clearPauseState();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  guide = { ch, i: -1, step: null, since: 0 };
  guideEl.hidden = false;
  document.body.classList.add("guiding");
  guideStep(0);
  if (!guideRaf) guideRaf = requestAnimationFrame(guideLoop);
  return true;
}

function guideStep(i) {
  if (!guide) return;
  const steps = guide.ch.steps;
  if (i >= steps.length) { guideEnd(true); return; }
  if (steps[i].skip && steps[i].skip()) { guideStep(i + 1); return; }
  guide.i = i;
  const st = steps[i];
  guide.step = st;
  guide.since = performance.now();
  if (st.enter) st.enter();
  renderGuideBox();
}

function renderGuideBox() {
  const st = guide.step, ch = guide.ch;
  const text = typeof st.text === "function" ? st.text() : st.text;
  guideBoxEl.innerHTML = `<div class="gb-top"><span class="gb-who">${escapeAttr(ch.title)} · ${guide.i + 1} of ${ch.steps.length}</span>
      <span class="gb-skips"><button class="gb-skip" data-gskip>Skip</button><button class="gb-skip" data-gskipall title="Turn the tutorial tips off. Settings can bring them back.">Skip all tips</button></span></div>
    <p class="gb-text">${escapeAttr(withName(text))}</p>
    ${st.next ? `<div class="gb-act"><button class="btn btn-small gb-next" data-gnext>${guide.i === ch.steps.length - 1 ? "Got it" : "Next"}</button></div>` : ""}`;
  guideBoxEl.querySelector("[data-gskip]").addEventListener("click", () => guideEnd(true));
  guideBoxEl.querySelector("[data-gskipall]").addEventListener("click", skipTutorial);
  const nx = guideBoxEl.querySelector("[data-gnext]");
  if (nx) { nx.addEventListener("click", () => guideStep(guide.i + 1)); setTimeout(() => nx.focus({ preventScroll: true }), 30); }
  guideBoxEl.classList.remove("pop");
  void guideBoxEl.offsetWidth;
  guideBoxEl.classList.add("pop");
}

/* Follows the thing to press every frame (the map zooms, the trees sway, the shop pans) */
function guideLoop() {
  guideRaf = 0;
  if (!guide) return;
  guideRaf = requestAnimationFrame(guideLoop);
  const st = guide.step;
  if (!st) return;
  // a level started under it: the chapter is over (the welcome chapter ends on exactly that)
  if (typeof campRun !== "undefined" && campRun && gameState === "PLAYING" && !guide.ch.inRun) { guideEnd(false); return; }
  if (st.until && performance.now() - guide.since > 250 && st.until()) { guideStep(guide.i + 1); return; }
  const els = !sceneOpen && !confirmOpen ? tutTargets(st) : [];
  const vw = window.innerWidth, vh = window.innerHeight;
  // a button below the fold of a scrolling shop page: bring it up (once per step)
  if (els.length && guide.scrolled !== guide.i) {
    const r0 = els[0].getBoundingClientRect();
    if ((r0.bottom > vh || r0.top < 0) && els[0].closest("#screen-campshop, #gemshop")) {
      guide.scrolled = guide.i;
      els[0].scrollIntoView({ block: "center", inline: "nearest" });
    }
  }
  if (els.length) {
    const rects = els.map(e => e.getBoundingClientRect());
    const l = Math.min(...rects.map(r => r.left)), t = Math.min(...rects.map(r => r.top));
    const r = Math.max(...rects.map(r => r.right)), b = Math.max(...rects.map(r => r.bottom));
    const pad = 8;
    const x = Math.max(0, l - pad), y = Math.max(0, t - pad), w = Math.min(vw - x, r - l + pad * 2), h = Math.min(vh - y, b - t + pad * 2);
    guideShadeEl.style.clipPath = `path(evenodd, "M0 0H${vw}V${vh}H0Z M${x} ${y}h${w}v${h}h${-w}Z")`;
    guideRingEl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    guideRingEl.hidden = false;
    guideShadeEl.classList.toggle("pass", !!st.pass);
    // keep the box out of the way of the thing it points at
    const mid = y + h / 2;
    guideBoxEl.classList.toggle("top", mid > vh * 0.58);
    if (st.arrow) {
      const below = mid < vh * 0.5;
      guideArrowEl.hidden = false;
      guideArrowEl.classList.toggle("up", below);
      guideArrowEl.style.left = (x + w / 2) + "px";
      guideArrowEl.style.top = (below ? y + h + 4 : y - 4) + "px";
    } else guideArrowEl.hidden = true;
  } else {
    guideShadeEl.style.clipPath = "none";
    guideShadeEl.classList.remove("pass");
    guideRingEl.hidden = true;
    guideArrowEl.hidden = true;
    guideBoxEl.classList.remove("top");
  }
}

/* The chapter is over: done = it counts as seen (finished or skipped), else it will come back */
function guideEnd(done) {
  if (!guide) return;
  const ch = guide.ch;
  guide = null;
  guideEl.hidden = true;
  guideRingEl.hidden = true;
  guideArrowEl.hidden = true;
  document.body.classList.remove("guiding");
  if (done) tutMark(ch.id);
  if (ch.after) ch.after(done);
}

/* "Skip all tips": the whole tutorial is off until Settings turns it back on */
function skipTutorial() {
  if (!guide) return;
  const ch = guide.ch;
  if (camp) { camp.tutOff = true; TUT_CHAPTERS.forEach(c => tutMark(c.id)); saveCamp(); }
  guideEnd(true);
  if (typeof showToast === "function") showToast("Tutorial tips are off. Settings can turn them back on.");
  void ch;
}

/* ----- The watcher: starts a chapter when its moment comes ----- */
let tutReady = "";               // the chapter that was ready at the last look
function tutWatch() {
  if (guide || !camp || !camp.named || camp.tutOff) { tutReady = ""; return; }
  // never over a story page, a scene, a dialog, or a level in play
  const busy = sceneOpen || confirmOpen || loadoutOpen || introOpen || (typeof campRun !== "undefined" && campRun) || gameState === "PLAYING"
    || (typeof storyEl !== "undefined" && storyEl.classList.contains("open")) || (typeof coinCard !== "undefined" && coinCard);
  if (busy) { tutReady = ""; return; }
  for (const ch of TUT_CHAPTERS) {
    if (tutSeen(ch.id)) continue;
    if (ch.skipIf && ch.skipIf()) { tutMark(ch.id); continue; }
    if (!ch.when()) continue;
    if (tutReady === ch.id) { tutReady = ""; tutStart(ch.id); } else tutReady = ch.id;
    return;
  }
  tutReady = "";
}
setInterval(tutWatch, 500);

/* Playing the tutorial again (Settings): every chapter comes round once more */
function startTutorial() {
  if (!camp) return;
  if (guide) guideEnd(false);
  camp.tut = [];
  camp.tutOff = false;
  saveCamp();
  clearPauseState();
  if (currentScreen !== "modes") openScreen("modes");
}

/* While a chapter runs, keys only do what it is asking */
document.addEventListener("keydown", e => {
  if (!guide || !guide.step) return;
  const st = guide.step;
  if (e.target && e.target.tagName === "INPUT") return;
  if (st.pass) return;
  const go = e.key === "Enter" || e.code === "Space";
  e.preventDefault();
  e.stopImmediatePropagation();
  if (!go) return;
  if (st.next) { guideStep(guide.i + 1); return; }
  const el = tutTargets(st)[0];
  if (el) el.click();
}, true);

/* Used by automated tests to jump straight to the menu on a fresh save */
function skipFirstRun() {
  if (!activeSlot) { activeSlot = 1; store.setItem(ACTIVE_KEY, "1"); save.created = Date.now(); }
  save.named = true;
  save.tutorialDone = true;
  if (sceneOpen) { sceneDone = null; closeScene(); }
  if (guide) guideEnd(false);
  persist();
  openScreen("main");
}
