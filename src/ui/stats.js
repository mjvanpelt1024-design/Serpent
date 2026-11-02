/* =========================================================
   src/ui/stats.js
   The stats screen
   ========================================================= */
"use strict";

/* =========================================================
   Stats screen
   ========================================================= */
function renderStats() {
  const st = save.stats;
  const groups = [
    ["High scores", MODE_KEYS.map(m => [modes[m].label, fmtInt(save.highScores[m])])],
    ["Nightmare high scores", MODE_KEYS.map(m => [modes[m].label + " Nightmare", save.unlockedNightmares.includes(m) ? fmtInt(save.highScoresNightmare[m]) : "Locked"])],
    ["Lifetime score", [
      ...MODE_KEYS.map(m => [modes[m].label, fmtInt(save.lifetimeByMode[m])]),
      ["All time", fmtInt(save.lifetimeScore)]
    ]],
    ["Experience", [
      ["Lifetime experience earned", fmtInt(st.xpEarned)],
      ["Experience spent", fmtInt(st.xpSpent)],
      ["XP orbs collected", fmtInt(st.orbsCollected)],
      ["Core stats rank", save.prestige ? `${PRESTIGE_RANKS[save.prestige]} (${save.prestige})` : "Not prestiged yet"]
    ]],
    ["Time", [
      ["Time played", fmtTime(st.timePlayedMs)],
      ["Games played", fmtInt(st.gamesPlayed)]
    ]],
    ["The fun stuff", [
      ["Deaths", fmtInt(st.deaths)],
      ["Wall crashes", fmtInt(st.wallCrashes)],
      ["Times you bit your own tail", fmtInt(st.tailBites)],
      ["Poisoned by popsicles", fmtInt(st.poisoned)],
      ["Poisonous popsicles survived", fmtInt(st.poisonsSurvived)],
      ["Screen loops", fmtInt(st.screenLoops)],
      ["Mirror warps", fmtInt(st.mirrorWarps)],
      ["Apples eaten", fmtInt(st.applesEaten)],
      ["Big apples eaten", fmtInt(st.bigApples)],
      ["Apple bites eaten", fmtInt(st.smallApples)],
      ["Rocks bonked", fmtInt(st.rocksHit)],
      ["Fleas caught", fmtInt(st.fleasHit)],
      ["Fires touched", fmtInt(st.firesHit)],
      ["Molasses puddles", fmtInt(st.molassesHit)],
      ["Portal hops", fmtInt(st.portalWarps)],
      ["Revives used", fmtInt(st.revivesUsed)],
      ["XP from badges", fmtInt(st.badgeXp)],
      ["Runs over in 5 seconds", fmtInt(st.quickDeaths)],
      ["So close to a best", fmtInt(st.soClose)],
      ["Golden hearts used", fmtInt(st.goldHeartsUsed)],
      ["Boosts used", fmtInt(st.boostsUsed)],
      ["Nightmares played", fmtInt(st.nightmareGames)],
      ["Popsicles eaten", fmtInt(st.popsiclesEaten)],
      ["Popsicles that turned into apples", fmtInt(st.popsiclesConverted)],
      ["Longest snake", fmtInt(st.longestSnake)],
      ["Best Endless distance", fmtInt(st.bestDistance) + " m"]
    ]]
  ];

  statsBodyEl.innerHTML = groups.map(([title, rows]) =>
    `<div class="stat-group"><h3>${title}</h3>` +
    rows.map(([label, val]) => `<div class="stat-row"><span>${label}</span><span class="val">${val}</span></div>`).join("") +
    `</div>`
  ).join("");
}
