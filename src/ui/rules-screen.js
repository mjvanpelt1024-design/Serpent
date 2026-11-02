/* =========================================================
   src/ui/rules-screen.js
   The island rules screen
   ========================================================= */
"use strict";

/* =========================================================
   Difficulty screen
   ========================================================= */
const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7z"/></svg>';

const SKULL_SVG = '<svg class="skull" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.9 2 3 5.7 3 10.5c0 2.7 1.3 5 3.3 6.5V20a1 1 0 0 0 1 1h2v-2h1.5v2h2.4v-2h1.5v2h2a1 1 0 0 0 1-1v-3c2-1.5 3.3-3.8 3.3-6.5C21 5.7 17.1 2 12 2zm-3.5 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';

/* Unlocking Nightmares: src/game/world/unlocks.js (the Nightmare Realm) */

/* The board's border color says what its edges do */
function applyFrameClass(boardActive = gameState === "PLAYING" || gameState === "GAMEOVER") {
  const frameClass = { wall: "walls-on", wrap: "walls-off", mirror: "walls-mirror", endless: "walls-endless", maze: "walls-off", tutorial: "walls-tutorial" }[edgeMode];
  ["walls-on", "walls-off", "walls-mirror", "walls-endless", "walls-tutorial"].forEach(c => {
    stageEl.classList.toggle(c, boardActive && c === frameClass);
  });
}


function fmtShort(n) {
  return n >= 1e3 ? fmtCompact(n) : String(n);
}

/* The rules screen facts come straight from the settings the game runs on,
   so the description can never disagree with how the mode plays. */
const EDGE_FACTS = {
  wrap: ["walls-off", "None. Leave one side and you come back on the opposite side."],
  wall: ["walls-on", "Solid on all four sides."],
  mirror: ["walls-mirror", "None. Leave the board and you pop out of a random side."],
  endless: ["walls-endless", "Solid top, bottom and back. The front is open."],
  maze: ["walls-off", "No outer edge, the maze wraps. Purple dead ends are portals."]
};

const sizeWords = (sp, normal = true) => {
  const out = [];
  if (sp && sp.s) out.push("small");
  if (normal && (!sp || sp.s !== 100)) out.push("normal");
  if (sp && sp.l) out.push("big");
  return out;
};
const listWords = arr => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1]);

function modeFacts(key) {
  const m = modes[key];
  const items = MODE_ITEMS[key] || {};
  let [frame, walls] = EDGE_FACTS[m.edge];
  if (m.innerWalls) walls = "All four sides, plus walls inside. Purple ones are portals.";

  const xpText = `${modes[key].startOrbs} to start, more as you play${items.xp && items.xp.s === 100 ? " (crumbs only)" : ""}`;

  let appleText = key === "chaos" ? `${getTrackValue("rain")} at a time` : "One at a time";
  if (m.edge === "endless") appleText = "They jump you forward";
  const appleSizes = [];
  if (items.apple && items.apple.s) appleSizes.push("bites");
  if (m.bigSpawns) appleSizes.push("big 5x ones");
  else if (getTrackValue("bigappetite") > 0) appleSizes.push("the odd big one");
  if (appleSizes.length) appleText += `, plus ${listWords(appleSizes)}`;
  appleText += ".";

  const hz = [];
  if (items.rock) hz.push("rocks take score");
  if (items.popsicle) hz.push(items.popsicle.l ? "popsicles take hearts, big ones end runs" : "popsicles take hearts");
  if (items.flea) hz.push("fleas take both");
  if (items.fire) hz.push("fire speeds you up");
  if (items.molasses) hz.push("molasses slows you");
  ENTITY_KEYS.forEach(k => { if (items[k] && ENTITY_TYPES[k].kind === "hazard") hz.push(ENTITY_TYPES[k].fact); });
  if (m.hunter) hz.push("the Hunter wants your head");
  if (m.echoes) hz.push("your Echo follows your path");
  if (m.rot) hz.push("apples rot if left too long");
  const hazards = hz.length ? hz.map(t => t[0].toUpperCase() + t.slice(1)).join(". ") + "." : "None";

  const lj = Math.max(0, Math.min(2, currentLevel));
  let speed = `${+levelSpeed(key === "chaos" ? m.speed * (1 - getTrackValue("brake") / 100) : m.speed, lj).toFixed(1)} moves a second`;
  if (key === "chaos") speed += ", the fastest area";
  if (m.edge === "endless") speed = `Starts at ${+(ENDLESS.startSpeed * LEVEL_TUNE[lj].speed).toFixed(1)} a second, speeds up`;

  const powers = ENTITY_KEYS.filter(k => items[k] && ENTITY_TYPES[k].kind === "power").map(k => ENTITY_TYPES[k].label);
  return [
    ["Walls", walls, frame],
    ["Hazards", hazards],
    ...(powers.length ? [["Power-ups", listWords(powers) + "."]] : []),
    ["Apples", appleText],
    ["XP", xpText],
    ["Speed", speed],
    ["Score", `${levelMult(key, lj, currentNightmare)}x multiplier`]
  ];
}

function chooseMode(key, nightmare = false) {
  if (!isModeUnlocked(key)) return;
  if (nightmare && !nmLevelOpen(key, 0)) return;
  currentModeKey = key;
  currentNightmare = nightmare;
  const mode = modes[key];
  rulesTitleEl.textContent = nightmare ? `${mode.label} Nightmare` : mode.label + " mode";
  rulesTextEl.textContent = nightmare ? `${NIGHTMARES[key].name}. ${NIGHTMARES[key].twist}` : mode.rules;
  screenEls.rules.classList.toggle("nightmare", nightmare);
  rulesMultEl.innerHTML = '<dl class="facts">' + modeFacts(key).map(([label, text, frame]) =>
    `<div class="fact"><dt>${label}</dt><dd>${frame ? `<span class="frame-dot ${frame}" aria-hidden="true"></span>` : ""}${text}</dd></div>`
  ).join("") + "</dl>";
  rulesHintEl.textContent = isTouchDevice()
    ? "Swipe on the board or use the buttons to steer."
    : "Space to start, Esc to go back";
  openScreen("rules");
}
