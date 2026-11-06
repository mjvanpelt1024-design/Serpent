/* =========================================================
   src/campaign/camp-story.js
   The story lives in the book for now. Nothing tells it during play:
   no boss taunts as a fight starts, no narrator on the result card.
   In its place, a marker for every beat the book will one day fill:
   arriving on an island, and each of its three boss fights won. Each
   is a page in the story book's style; its words are the island file's
   "story" entry, and while that's empty the page says so.
   Each page shows once (camp.storySeen); a save from before build 51
   counts the beats it has already passed as seen.
   ========================================================= */
"use strict";

const STORY_BEATS = ["arrive", "boss1", "boss2", "boss3"];
const storyId = (isl, beat) => `${isl}:${beat}`;

/* Beats this save has already been through */
function storyPassed(isl, beat, c = camp) {
  if (beat === "arrive") return campIslandOpen(isl, c);
  return campWon(isl, BOSS_LEVELS[+beat.slice(4) - 1], c);
}

CAMP_REPAIRS.push(c => {
  if (!Array.isArray(c.storySeen)) c.storySeen = [];
  if (!c.storyInit) {
    // the first load of build 51: no flood of pages for what you've already done
    CAMP.islands.forEach(I => STORY_BEATS.forEach(b => {
      const id = storyId(I.id, b);
      if (storyPassed(I.id, b, c) && !c.storySeen.includes(id) && !(I.n === 1 && b === "arrive" && !Object.keys(c.levels).length)) c.storySeen.push(id);
    }));
    c.storyInit = true;
  }
});

/* The page overlay, made once */
const storyEl = document.createElement("div");
storyEl.id = "story-page";
storyEl.className = "story-page";
storyEl.setAttribute("role", "dialog");
storyEl.setAttribute("aria-modal", "true");
storyEl.setAttribute("aria-labelledby", "sp-title");
document.body.appendChild(storyEl);
let storyQueue = [];
let storyThen = null;

/* Shows a beat's page if it hasn't been shown yet. delay: ms to wait (the result card first) */
function campStoryBeat(isl, beat, delay = 0) {
  if (!camp || !CAMP.islandById[isl]) return;
  const id = storyId(isl, beat);
  if (camp.storySeen.includes(id)) return;
  camp.storySeen.push(id);
  saveCamp();
  setTimeout(() => { storyQueue.push({ isl, beat }); if (!storyEl.classList.contains("open")) nextStoryPage(); }, delay);
}

function nextStoryPage() {
  const b = storyQueue.shift();
  if (!b) { storyEl.classList.remove("open"); if (storyThen) { const f = storyThen; storyThen = null; f(); } return; }
  const I = CAMP.islandById[b.isl];
  const entry = (I.story || {})[b.beat] || {};
  const chapter = I.n;
  const kicker = b.beat === "arrive" ? `Chapter ${chapter} · ${I.name}` : `Chapter ${chapter} · Boss fight ${b.beat.slice(4)} of 3`;
  const fallback = b.beat === "arrive" ? `You reach ${I.name}` : `${I.boss.name} is beaten`;
  const text = entry.text ? escapeAttr(entry.text) : `<em>This page of the story hasn't been written yet.</em> It will be in the book. For now: ${escapeAttr(b.beat === "arrive" ? I.blurb : `${I.boss.name} won't forget this.`)}`;
  storyEl.innerHTML = `<div class="sp-book">
      <div class="sp-page sp-left"><canvas class="sp-art" width="96" height="72" aria-hidden="true"></canvas><span class="sp-num">${chapter * 4 - 3 + STORY_BEATS.indexOf(b.beat)}</span></div>
      <div class="sp-page sp-right">
        <p class="sp-kicker">${escapeAttr(kicker)}</p>
        <h3 id="sp-title" class="sp-title">${escapeAttr(entry.title || fallback)}</h3>
        <p class="sp-text">${text}</p>
        <span class="sp-soon">Story placeholder</span>
        <button class="btn btn-primary sp-go">Turn the page</button>
      </div>
    </div>`;
  drawStoryArt(storyEl.querySelector(".sp-art"), b.isl, b.beat);
  storyEl.classList.add("open");
  sfx("tab");
  const go = storyEl.querySelector(".sp-go");
  go.addEventListener("click", () => { sfx("click"); nextStoryPage(); });
  setTimeout(() => go.focus({ preventScroll: true }), 50);
}
storyEl.addEventListener("keydown", e => {
  if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); nextStoryPage(); }
});

/* The left page: a little picture of the beat in the island's colors (the boss's face, or the island) */
function drawStoryArt(c, isl, beat) {
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const I = CAMP.islandById[isl];
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // a sky in the island's own light, a floating island, a frame of ink
  const sky = skyAt(ISLANDS[isl].y - 60);
  R(0, 0, 96, 72, `rgb(${sky.join(",")})`);
  for (let y = 0; y < 72; y += 2) R(0, y, 96, 1, "rgba(255,255,255,0.04)");
  for (let x = 14; x < 82; x++) { const d = Math.round(10 * Math.sin((x - 14) / 68 * Math.PI)); R(x, 50, 1, 3, I.colors.grass); R(x, 53, 1, d, x % 3 ? I.colors.rock : shadeHex(I.colors.rock, -0.2)); }
  R(14, 50, 68, 1, shadeHex(I.colors.grass, 0.3));
  if (beat === "arrive") {
    // the Coil rising out of the clouds toward the island
    for (let i = 0; i < 40; i++) { const x = 6 + i * 1.6, y = 70 - i * 0.6 + Math.sin(i * 0.5) * 3; R(Math.round(x), Math.round(y), 3, 3, i % 4 ? "#3a8a3a" : "#ffd23f"); }
    for (let i = 0; i < 5; i++) R(20 + i * 12, 40 + (i % 2) * 3, 2, 10, I.colors.accent);
  } else {
    const face = new Image();
    face.onload = () => {
      g.drawImage(face, 32, 14, 32, 32);
      if (beat === "boss3") { g.strokeStyle = "#c0201a"; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 12); g.lineTo(66, 48); g.moveTo(66, 12); g.lineTo(30, 48); g.stroke(); }
    };
    face.src = bossFaceUrl(isl);
  }
  g.strokeStyle = "#2a1a0e"; g.lineWidth = 2; g.strokeRect(1, 1, 94, 70);
}

/* ----- Where the beats come from ----- */
(() => {
  // the boss fights: right after the first win's result card
  const win = campWinLevel;
  window.campWinLevel = function () {
    const r = campRun && !campRun.over && gameState === "PLAYING" ? { isl: campRun.isl, n: campRun.n, def: campRun.def, first: !campWon(campRun.isl, campRun.n) } : null;
    win.apply(this, arguments);
    if (r && r.first && r.def.kind === "boss") campStoryBeat(r.isl, "boss" + r.def.goal.fight, 900);
  };
  // arriving on an island: the first time you cross to it (and the first island, the first time the map opens)
  const node = openNode;
  window.openNode = function (key, id) {
    const next = id === "bridge" ? CAMP.islands[campIslandIdx(key) + 1] : null;
    node.apply(this, arguments);
    if (next && camp.at === next.id) campStoryBeat(next.id, "arrive", 700);
  };
  const open = openScreen;
  window.openScreen = function (name) {
    open.apply(this, arguments);
    if (name === "modes" && camp) campStoryBeat(CAMP.islands[0].id, "arrive", 600);
  };
})();

/* A plain word on what ended a run, in place of the narrator's line */
const CAUSE_TEXT = {
  wall: "You ran into a wall.", self: "You bit your own tail.", behind: "The road left you behind.",
  bramble: "Brambles pricked you.", wasp: "A wasp stung you.", lightning: "Lightning struck you.", bomb: "A bomb went off.",
  ghost: "A ghost passed through you.", spikes: "Spikes came up under you.", sinkhole: "The ground gave way.",
  hunter: "The rival snake got you.", echo: "Your own echo ran into you.", boss: "The boss got you.",
  flea: "A flea bit you.", fire: "Fire burned you.", popsicle: "Brain freeze.", rock: "You hit a rock.", hunger: "Time ran out."
};
function campCauseText(cause) {
  if (typeof FOE_CAUSE_TEXT !== "undefined" && FOE_CAUSE_TEXT[cause]) return FOE_CAUSE_TEXT[cause];
  return CAUSE_TEXT[cause] || "";
}
