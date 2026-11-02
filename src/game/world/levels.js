/* =========================================================
   src/game/world/levels.js
   Levels: tuning and names from content/, Nightmare twins and progress
   ========================================================= */
"use strict";

/* =========================================================
   Areas and levels. Each area (one of the islands) is unlocked
   with XP. Inside, three levels share the area's rules and get
   faster, busier and better paid. Each level opens by playing the
   one before it. Each level also has a Nightmare twin, in the
   Nightmare Realm: the first opens when that Nightmare island is
   unlocked (src/game/world/unlocks.js), the others by playing.
   ========================================================= */
/* How the levels differ: content/rules/levels.dat */
const LEVEL_TUNE = CONTENT.levelRules.map(r => ({ speed: r[1], mult: r[2], hazard: r[3] }));
const LEVELS_PER_AREA = LEVEL_TUNE.length;
const LEVEL_LINES = CONTENT.levelRules.map(r => String(r[5]));
/* Level names: each island's levels.dat */
const LEVEL_NAMES = {};
const NM_LEVEL_NAMES = {};
MODE_KEYS.forEach(key => {
  const rows = CONTENT.worlds[key].levels;
  LEVEL_NAMES[key] = rows.map(r => String(r[1]));
  NM_LEVEL_NAMES[key] = rows.map(r => String(r[2]));
});
const ROMAN3 = ["I", "II", "III"];

let currentLevel = 0;                       // which level of the area is being played

const levelKey = (area, j, nm) => `${area}:${nm ? "n" : ""}${j}`;
const levelName = (area, j, nm) => ((nm ? NM_LEVEL_NAMES : LEVEL_NAMES)[area] || [])[j] || `Level ${j + 1}`;

function levelReach(area) {
  return isModeUnlocked(area) ? Math.min(LEVELS_PER_AREA - 1, save.levelReach[area] || 0) : -1;
}

function levelOpen(area, j) {
  if (save.kind === "nightmare") return false;      // a Nightmare run has only Nightmares
  return isModeUnlocked(area) && j <= levelReach(area);
}

function nmLevelOpen(area, j) {
  if (!isModeUnlocked(area) || !nightmareRealmOpen() || !save.unlockedNightmares.includes(area)) return false;
  return j === 0 || (save.nmOpen[area] || []).includes(j);
}

const levelMult = (area, j, nm) => tidy((nm ? modes[area].nmMultiplier : modes[area].multiplier) * LEVEL_TUNE[j].mult);

/* Speed for a level: faster each step, but never past the game's top speed */
function levelSpeed(baseSpeed, j) {
  return Math.min(baseSpeed * LEVEL_TUNE[j].speed, Math.max(baseSpeed, 16));
}

/* Applied after the area's rules (and any Nightmare twist) are set up */
function applyLevel() {
  if (!MODE_KEYS.includes(currentModeKey)) return;
  const j = Math.max(0, Math.min(LEVELS_PER_AREA - 1, currentLevel));
  const L = LEVEL_TUNE[j];
  scoreMultiplier *= L.mult;
  const speed = 1000 / moveInterval;
  moveInterval = 1000 / levelSpeed(speed, j);
  baseInterval = moveInterval;
  if (L.hazard !== 1) {
    spec = JSON.parse(JSON.stringify(spec));
    ["popsicle", "flea", "fire", "molasses", "rock"].concat(ENTITY_KEYS.filter(k => ENTITY_TYPES[k].kind === "hazard")).forEach(k => {
      if (spec[k] && spec[k].max) spec[k].max = Math.ceil(spec[k].max * L.hazard);
      if (spec[k] && spec[k].count && ENTITY_TYPES[k]) spec[k].count = Math.ceil(spec[k].count * L.hazard);
    });
    if (maxPopsicle > 0) maxPopsicle = Math.ceil(maxPopsicle * L.hazard);
  }
  endlessCfg.levelSpeed = L.speed;
}

/* After a run: open the next level, and any Nightmare the score earned */
function recordLevelRun(quit) {
  const area = currentModeKey;
  if (!MODE_KEYS.includes(area) || tutorial) return [];
  const j = currentLevel;
  const notes = [];
  const key = levelKey(area, j, currentNightmare);
  save.levelBest[key] = Math.max(save.levelBest[key] || 0, score);
  if (currentNightmare) {
    // Finishing one Nightmare opens the next on its island, just like ordinary levels
    if ((!quit || runMs >= 10000) && j < LEVELS_PER_AREA - 1 && !nmLevelOpen(area, j + 1)) {
      save.nmOpen[area] = [1, 2].filter(t => t === j + 1 || (save.nmOpen[area] || []).includes(t));
      notes.push({ text: `Nightmare open: ${levelName(area, j + 1, true)}` });
    }
    return notes;
  }
  if ((!quit || runMs >= 10000) && j < LEVELS_PER_AREA - 1 && levelReach(area) === j) {
    save.levelReach[area] = j + 1;
    notes.push({ text: `New level open: ${levelName(area, j + 1)}` });
  }
  return notes;
}
