/* =========================================================
   src/dev/terminal/cmd-help.js
   help, clear, exit, version, status
   ========================================================= */
"use strict";

/* =========================================================
   Help, and the commands that need no group
   ========================================================= */
function helpGroup(g) {
  say(`${g}: ${TERM_GROUPS.find(x => x[0] === g)[1]}`);
  COMMANDS.filter(c => c.group === g && !c.hidden).forEach(c => consolePrint(`  ${usageOf(c)}`, "dim"));
}

function helpCommand(c) {
  say(usageOf(c));
  note("  " + c.desc);
  c.examples.forEach(e => note("  e.g. " + e));
}

const META_RUN = {
  help(a) {
    if (!a.length) {
      say("every command reads:  group subject.action value");
      TERM_GROUPS.forEach(([g, d]) => consolePrint(`${g.padEnd(10)} ${d}`, "dim"));
      say("also:  help <group>   help <group> <subject>   clear   status   version   exit");
      note("numbers take shortcuts: 2.5k 3m 5b 1e12.  true/false also take on/off.");
      note("tab completes, up and down browse history.  tap a group chip to start typing in it.");
      return "quiet";
    }
    const g = resolveGroup(a[0]);
    if (g && a.length === 1) { helpGroup(g); return "quiet"; }
    if (g) {
      const [s, act] = a[1].split(".");
      const hits = subjectHits(g, s);
      if (!hits.length) {
        // help upgrade advance: the word can be an action too
        const byAction = COMMANDS.filter(c => c.group === g && !c.hidden && matchPart(c.action, s, c.aliases) !== undefined);
        if (!byAction.length) fail(`${g} has no '${s}'. try: help ${g}`);
        byAction.forEach(helpCommand);
        return "quiet";
      }
      hits.filter(h => !h.c.hidden && (!act || matchPart(h.c.action, act, h.c.aliases) !== undefined)).forEach(h => helpCommand(h.c));
      return "quiet";
    }
    if (a[0].includes(".")) {
      const [s, act] = a[0].split(".");
      let any = false;
      GROUP_IDS.forEach(grp => subjectHits(grp, s).forEach(h => {
        if (!h.c.hidden && (!act || matchPart(h.c.action, act, h.c.aliases) !== undefined)) { helpCommand(h.c); any = true; }
      }));
      if (any) return "quiet";
    }
    fail(`nothing called '${a.join(" ")}'. try: help`);
  },
  clear() { consoleLogEl.innerHTML = ""; return "quiet"; },
  version() { say(BUILD_NUMBER); return "quiet"; },
  exit() { goBack(); return "quiet"; },
  status() { statusReport(); return "quiet"; }
};

const paramSummary = () => {
  const d = save.dev;
  const bits = [];
  if (d.speedMult !== 1) bits.push(`speed x${d.speedMult}`);
  if (d.scoreMult !== 1) bits.push(`score x${d.scoreMult}`);
  if (d.xpMult !== 1) bits.push(`xp x${d.xpMult}`);
  if (d.scrollMult !== 1) bits.push(`scroll x${d.scrollMult}`);
  if (d.hazardMult !== 1) bits.push(`hazards x${d.hazardMult}`);
  if (d.invincible) bits.push("godmode");
  if (d.reverse) bits.push("reverse");
  if (d.grid) bits.push("grid");
  LIVE_STATS.forEach(([k]) => { if (d[k]) bits.push("stat." + k.replace("stat", "").toLowerCase()); });
  return bits.join(", ");
};

function statusReport() {
  say(`build    ${BUILD_NUMBER}`);
  say(`xp       ${fmtInt(save.xp)}   rank ${PRESTIGE_RANKS[save.prestige] || "none"}`);
  say(`progress islands ${save.unlockedModes.length}/${MODE_KEYS.length}  nightmares ${save.unlockedNightmares.length}/${MODE_KEYS.length}  red ${save.nmUpgrades.length}/${MODE_KEYS.length}`);
  say(`         badges ${save.badges.length}/${BADGE_TOTAL}  relics ${save.relics.length}/${RELICS.length}  skins ${save.ownedSkins.length}/${skins.length}  themes ${save.ownedBackdrops.length}/${backdrops.length}  flair ${save.ownedFlair.length}/${FLAIR.length}`);
  say(inRun() ? `run      ${modes[currentModeKey].label}${currentNightmare ? " nightmare" : ""}  score ${fmtInt(score)}  hearts ${currentHearts}  length ${snake.cells.length}${pauseDetour ? "  [held]" : ""}` : "run      none");
  say("rules    " + (paramSummary() || "all normal"));
}
