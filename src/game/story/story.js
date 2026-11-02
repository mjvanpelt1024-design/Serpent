/* =========================================================
   src/game/story/story.js
   Story pages (from content/story), relics, shimmers and naming
   ========================================================= */
"use strict";

/* =========================================================
   Story: cutscenes, the cryptic lights, the tutorial and naming
   ========================================================= */

/* One short scene per unlock. Every place is a mode, and the shimmering lights run through all of them. */
/* Every page of the story book, in reading order.
   kind: intro | tutorial | visit (first time a screen opens) | level | collect | done | nightmare | end */
/* Every page of the story book: content/story/*.story, in the order of content/story/_index.dat */
const STORY = Object.fromEntries(CONTENT.story.map(s => [s.id, { title: String(s.title || s.id), lines: s.lines }]));
const STORY_ORDER = CONTENT.story.map(s => s.id);
const VISIT_PAGES = { upgrades: "shop", inventory: "inventory", achievements: "achievements", stats: "stats", settings: "settings" };

/* The cryptic lines from the Coil badge path, tucked at the bottom of these pages */
const CRYPTIC_TIERS = [1, 5, 25, 100, 250, 500, 1000, 2500];
const CRYPTIC_LINES = [
  "Before the garden there was a coil with no beginning, and it was hungry, which is how most of the trouble in the world begins.",
  "It shed one scale for every world it circled, and each scale remembered a meal, and each meal, I regret to say, remembered it back.",
  "The scales fell like sparks, and a small snake followed them, partly for the snacks and partly for reasons it could not have explained to anyone.",
  "The small snake did not know it had a name until someone gave it one: {name}. It has been trying, ever since, to deserve it.",
  "Every apple was a year. Every wall was a lesson. Every popsicle was a mistake it swore never to repeat, and then repeated, as we all do.",
  "At the heart of the maze the scales hummed a song, and {name} knew every word, and did not know how, and sang along anyway.",
  "{name} turned, and there was its own tail, as patient as a tortoise and twice as pleased with itself.",
  "{name} closed the circle, and the coil began again, hungry as ever. I should like to be excused now. I have asked before. It never takes."
];
const COIL_PAGES = ["classic", "insane", "mirror", "endless", "labyrinth", "nm-classic", "nm-mirror", "nm-labyrinth"];

/* Ten collectibles. Each is found in the level just before its page; the last one waits in the sandbox.
   apples: how far into a run it can turn up, in apples' worth of score on that island */
const RELICS = [
  { id: "brick", mode: "classic", apples: 9 },
  { id: "pebble", mode: "challenge", apples: 10 },
  { id: "stick", mode: "insane", apples: 11 },
  { id: "shard", mode: "mirror", apples: 15 },
  { id: "map", mode: "endless", apples: 15 },
  { id: "ember", mode: "inferno", apples: 30 },
  { id: "core", mode: "easy", nightmare: true, apples: 10 },
  { id: "scale", mode: "challenge", nightmare: true, apples: 15 },
  { id: "tip", mode: "mirror", nightmare: true, apples: 15 },
  { id: "blank", sandbox: true }
];
RELICS.forEach(r => {
  r.name = STORY[r.id].title;
  if (r.mode) Object.defineProperty(r, "at", { get: () => r.apples * 100 * (r.nightmare ? modes[r.mode].nmMultiplier : modes[r.mode].multiplier) });
});

const RELIC_CHANCE = 35;      // percent chance per run, once past the score
const RELIC_LIFE = 8000;
let relicItems = [];
let relicRolled = false;

function relicFor(mode) {
  return RELICS.find(r => !r.sandbox && r.mode === mode && !!r.nightmare === !!currentNightmare);
}

function tickRelic(ts) {
  relicItems = relicItems.filter(r => ts < r.expiresAt);
  if (tutorial || relicRolled) return;
  const relic = relicFor(currentModeKey);
  if (!relic || save.relics.includes(relic.id) || score < relic.at) return;
  relicRolled = true;                       // one chance per run
  if (!roll(RELIC_CHANCE) && !save.dev.relics) return;
  const x = edgeMode === "endless" ? endlessSpawnX() - cell * 3 : undefined;
  const spot = spotFor(1, x);
  if (!spot) return;
  relicItems.push(Object.assign(spot, { relic: relic.id, spawnAt: ts, expiresAt: ts + RELIC_LIFE }));
  showToast("Something glints. I would like it noted that I saw it first, and that I did not trust it.");
  sfx("shimmer");
}

function collectRelic(item) {
  const relic = RELICS.find(r => r.id === item.relic);
  if (!relic || save.relics.includes(relic.id)) return;
  save.relics.push(relic.id);
  persist();
  sfx("unlock");
  showToast(`Found: ${relic.name}. A new page is in your story book.`);
  checkBadges();
  if (save.relics.length === RELICS.length) completeRelics();
}

/* All ten: the secret finale and a Flair item you can't buy */
function completeRelics() {
  if (!save.ownedFlair.includes("ancient")) save.ownedFlair.push("ancient");
  persist();
  const finale = () => showToast("New Flair: Ancient Scales. Find it in your Inventory.");
  if (gameState === "PLAYING") {
    save.pendingScene = "end";      // don't interrupt the run; it plays at the game over screen
    persist();
  } else {
    playScene("end", finale);
  }
}

function drawRelic(g, x, y, ts, cellSize) {
  const cell = cellSize || 20;
  const bob = Math.sin(ts / 200) * cell * 0.08;
  const glow = 0.6 + 0.4 * Math.sin(ts / 130);
  g.save();
  g.shadowColor = "#ffd23f";
  g.shadowBlur = cell * (0.6 + glow * 0.8);
  g.fillStyle = "#ffe98a";
  g.translate(x + cell / 2, y + cell / 2 + bob);
  g.rotate(Math.PI / 4);
  const s = cell * 0.38;
  g.fillRect(-s, -s, s * 2, s * 2);
  g.restore();
  g.save();
  g.fillStyle = "#b8860b";
  g.font = `700 ${Math.round(cell * 0.55)}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("?", x + cell / 2, y + cell / 2 + bob + 1);
  g.restore();
}
const snakeName = () => save.settings.snakeName || "Noodle";
const withName = t => t.split("{name}").join(snakeName());

/* How often a shimmer shows up (per second). One of the harder modes, picked per save, gets triple. */
const SHIMMER_RATE = { easy: 0.004, classic: 0.005, challenge: 0.007, insane: 0.006, chaos: 0.008, mirror: 0.007, treasure: 0.009, endless: 0.006, inferno: 0.008, labyrinth: 0.007 };
const SHIMMER_BEST_POOL = ["insane", "chaos", "mirror", "treasure", "endless", "inferno", "labyrinth"];
/* Islands from build 46 shimmer like the harder old ones */
const shimmerRate = () => SHIMMER_RATE[currentModeKey] || (MODE_KEYS.includes(currentModeKey) ? 0.007 : 0);
const SHIMMER_LIFE = 2500;
let shimmers = [];
let shimmerAccumulator = 0;

function tickShimmers(ts, delta) {
  shimmers = shimmers.filter(s => ts < s.expiresAt);
  if (tutorial || !shimmerRate()) return;
  shimmerAccumulator += delta;
  while (shimmerAccumulator >= 1000) {
    shimmerAccumulator -= 1000;
    const rate = shimmerRate() * (save.shimmerBest === currentModeKey ? 3 : 1);
    if (shimmers.length || Math.random() >= rate) continue;
    const x = edgeMode === "endless" ? endlessSpawnX() - cell * 4 : undefined;
    const spot = spotFor(1, x);
    if (spot) shimmers.push(Object.assign(spot, { spawnAt: ts, expiresAt: ts + SHIMMER_LIFE }));
  }
}

function collectShimmer() {
  save.stats.shimmers++;
  sfx("shimmer");
  persist();
  checkBadges();
}

function drawShimmer(g, x, y, ts, s) {
  const hue = (ts / 6) % 360;
  const pulse = 0.75 + 0.25 * Math.sin(ts / 90);
  g.save();
  g.shadowColor = `hsl(${hue}, 100%, 70%)`;
  g.shadowBlur = cell * 0.9 * pulse;
  const gr = g.createLinearGradient(x, y, x + cell, y + cell);
  gr.addColorStop(0, `hsl(${hue}, 100%, 80%)`);
  gr.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 100%, 72%)`);
  gr.addColorStop(1, `hsl(${(hue + 140) % 360}, 100%, 68%)`);
  g.fillStyle = gr;
  const inset = cell * (1 - pulse) * 0.3;
  g.fillRect(x + inset, y + inset, cell - 1 - inset * 2, cell - 1 - inset * 2);
  g.restore();
}

/* ----- Cutscenes ----- */
let sceneOpen = null;
let sceneLine = 0;
let sceneDone = null;

function playScene(id, onDone) {
  const scene = STORY[id];
  if (!scene) { if (onDone) onDone(); return; }
  sceneOpen = id;
  sceneLine = 0;
  sceneDone = onDone || null;
  if (!save.seenScenes.includes(id)) {
    save.seenScenes.push(id);
    persist();
  }
  document.getElementById("scene-title").textContent = scene.title;
  watchArt(document.getElementById("scene-art"), id);
  setTimeout(updateMusic, 0);
  renderSceneLine();
  sceneEl.classList.add("active");
  document.getElementById("scene-next").focus({ preventScroll: true });
}

function renderSceneLine() {
  const scene = STORY[sceneOpen];
  const box = document.getElementById("scene-text");
  // Only the last three lines stay on screen, so long scenes never outgrow the board
  const first = Math.max(0, sceneLine - 2);
  box.innerHTML = scene.lines.slice(first, sceneLine + 1).map((l, i) =>
    `<p class="${first + i === sceneLine ? "fresh" : ""}">${escapeAttr(withName(l))}</p>`).join("");
  const last = sceneLine >= scene.lines.length - 1;
  document.getElementById("scene-next").textContent = last ? "Continue" : "Next";
  document.getElementById("scene-count").textContent = `${sceneLine + 1} / ${scene.lines.length}`;
}

function advanceScene() {
  if (!sceneOpen) return;
  if (sceneLine < STORY[sceneOpen].lines.length - 1) {
    sceneLine++;
    sfx("click");
    renderSceneLine();
  } else {
    closeScene();
  }
}

function closeScene() {
  if (!sceneOpen) return;
  sceneOpen = null;
  sceneEl.classList.remove("active");
  setTimeout(updateMusic, 0);
  const done = sceneDone;
  sceneDone = null;
  if (done) done();
}

/* Plays a mode's scene the first time it unlocks (unless story scenes are turned off) */
function sceneForUnlock(id, then) {
  if (save.settings.scenes && STORY[id] && !save.seenScenes.includes(id)) playScene(id, then);
  else {
    if (STORY[id] && !save.seenScenes.includes(id)) { save.seenScenes.push(id); persist(); }
    if (then) then();
  }
}

/* A page is open once the thing it's about has happened */
function pageOpen(id) {
  if (save.dev.storyAll || save.dev.pages.includes(id)) return true;
  if (id === "intro") return save.named;
  if (id === "tutorial") return save.tutorialDone;
  if (Object.values(VISIT_PAGES).includes(id)) return save.seenScenes.includes(id);
  if (id === "easy") return save.named;
  if (MODE_KEYS.includes(id)) return isModeUnlocked(id);
  if (RELICS.some(r => r.id === id)) return save.relics.includes(id);
  if (id === "levelsdone") return allModesUnlocked();
  if (id.startsWith("nm-")) return save.unlockedNightmares.includes(id.slice(3));
  if (id === "nightmaresdone") return save.unlockedNightmares.length === MODE_KEYS.length;
  if (id === "end") return save.relics.length === RELICS.length;
  return false;
}
const sceneAvailable = pageOpen;

function coilLinesEarned() {
  const have = earnedSet();
  return CRYPTIC_TIERS.filter(t => have.has("cryptic:" + t)).length;
}

/* The story book: one book, no tabs, one page at a time */
function renderStoryList() {
  const body = document.getElementById("story-body");
  const idx = Math.max(0, Math.min(STORY_ORDER.length - 1, save.bookPage || 0));
  save.bookPage = idx;
  const id = STORY_ORDER[idx];
  const open = pageOpen(id);
  const relic = RELICS.find(r => r.id === id);
  // Left page: the picture and the title. Right page: the words. (They stack on narrow screens.)
  let html = `<div class="book-page${open ? "" : " locked"}${relic ? " collect" : ""}"><div class="bp-l">`;
  html += `<div class="book-num">Page ${idx + 1} of ${STORY_ORDER.length}${relic && open ? " · Collectible" : ""}</div>`;
  if (open) {
    html += `<canvas class="book-art" width="160" height="60" aria-hidden="true"></canvas>`;
    html += `<h3 class="book-title">${escapeAttr(STORY[id].title)}</h3></div><div class="bp-r">`;
    html += STORY[id].lines.map(l => `<p>${escapeAttr(withName(l))}</p>`).join("");
  } else if (relic) {
    html += `<div class="book-blank" aria-hidden="true"></div><h3 class="book-title">A page is missing here</h3></div><div class="bp-r"><p>Something should be on this page. You must have slithered right past it.</p>`;
  } else {
    html += `<div class="book-blank" aria-hidden="true"></div><h3 class="book-title">? ? ?</h3></div><div class="bp-r"><p>This part of the story hasn't happened yet.</p>`;
  }
  const coilAt = COIL_PAGES.indexOf(id);
  if (coilAt !== -1 && open) {
    const got = coilLinesEarned() > coilAt;
    html += `<div class="coil-box${got ? "" : " locked"}">${got ? escapeAttr(withName(CRYPTIC_LINES[coilAt])) : "? ? ?"}</div>`;
  }
  html += `</div></div>`;
  body.innerHTML = html;
  const art = body.querySelector(".book-art");
  if (art) watchArt(art, id);
  if (bookTurn) {
    const page = body.querySelector(".book-page");
    page.classList.add(bookTurn > 0 ? "turn-next" : "turn-prev");
    bookTurn = 0;
  }
  const prev = document.getElementById("book-prev");
  const next = document.getElementById("book-next");
  prev.disabled = idx === 0;
  next.disabled = idx === STORY_ORDER.length - 1;
  document.getElementById("book-count").textContent = `${STORY_ORDER.filter(pageOpen).length} of ${STORY_ORDER.length} pages found`;
}

let bookTurn = 0;
function turnPage(d) {
  const next = Math.max(0, Math.min(STORY_ORDER.length - 1, (save.bookPage || 0) + d));
  if (next === save.bookPage) return;
  save.bookPage = next;
  bookTurn = d;
  persist();
  sfx("page");
  renderStoryList();
}

/* Opening the book jumps to the newest page you've found */
function openBook() {
  const newest = STORY_ORDER.reduce((n, id, i) => (pageOpen(id) ? i : n), 0);
  // The first time, start at page 1. After that, jump to anything new you've found since.
  if (save.bookOpened && newest > save.bookSeenUpTo) save.bookPage = newest;
  save.bookSeenUpTo = Math.max(save.bookSeenUpTo, newest);
  save.bookOpened = true;
  persist();
  openScreen("story");
}

/* ----- Naming ----- */
let namingFor = null;   // "first" or "rename"

function openNaming(mode) {
  namingFor = mode;
  const input = document.getElementById("name-input");
  input.value = mode === "first" ? "Noodle" : snakeName();
  document.getElementById("name-title").textContent = mode === "first" ? "Name your snake" : "Rename your snake";
  document.getElementById("name-note").textContent = mode === "first"
    ? "You can change it later, but it'll cost you."
    : `Renaming costs ${fmtInt(renameCost())} XP. You have ${fmtInt(save.xp)}.`;
  document.getElementById("name-back").hidden = false;
  openScreen("name");
  setTimeout(() => { input.focus(); input.select(); }, 30);
}

function confirmName() {
  const input = document.getElementById("name-input");
  const name = input.value.trim().slice(0, 16) || "Noodle";
  if (namingFor === "rename") {
    if (name === snakeName()) { openScreen("settings"); return; }
    if (!spendXp(renameCost())) {
      showToast(`Renaming costs ${fmtInt(renameCost())} XP.`);
      return;
    }
    save.settings.snakeName = name;
    persist();
    updateHud();
    sfx("buy");
    showToast(`Say hello to ${name}.`);
    openScreen("settings");
    return;
  }
  save.settings.snakeName = name;
  save.named = true;
  persist();
  playScene("intro", () => startTutorial());
}
