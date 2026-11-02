/* =========================================================
   src/dev/terminal/cmd-data.js
   Group: data
   ========================================================= */
"use strict";

/* =========================================================
   Group: data (save codes, lists, wiping)
   ========================================================= */
cmd("data", "saveCode", "generate", "", "Print a save code you can keep as a backup (and copy it, where the browser allows).", () => {
  const code = saveCode();
  say(code);
  note(`(${fmtInt(code.length)} characters. bring it back with: data saveCode.load <code> yes)`);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => note("copied to the clipboard"), () => {});
  return "quiet";
}, { examples: ["data saveCode.generate"], aliases: ["export", "make"] });
cmd("data", "saveCode", "load", "<code> [yes]", "Replace this save with a save code. It checks the code first, then asks for yes on the end.", a => {
  const next = parseSaveCode(a[0]);
  if (!next) fail("that is not a valid save code (they start with " + SAVE_PREFIX + ")");
  if ((a[1] || "").toLowerCase() !== "yes") { say("the code is good. this replaces your whole save: run it again with yes on the end."); return "quiet"; }
  restoreSave(next);
  say("[ok] save restored.");
}, { examples: ["data saveCode.load SNKSAVE1-... yes"], aliases: ["import", "restore"] });
cmd("data", "save", "size", "", "How big the save data is.", () => { say(`${fmtInt(JSON.stringify(save).length)} characters`); return "quiet"; });
cmd("data", "status", "show", "", "A summary of the save, the current run and any bent rules.", () => { statusReport(); return "quiet"; });
cmd("data", "build", "version", "", "The build number of this game.", () => { say(BUILD_NUMBER); return "quiet"; });

const rows = (items, fmt) => items.forEach((x, i) => consolePrint(`${String(i + 1).padStart(3)}  ${fmt(x)}`, "dim"));
const LISTS = {
  islands: () => rows(MODE_KEYS, m => `${islandName(m).padEnd(12)} ${m.padEnd(10)} ${modes[m].label}  (Nightmare: ${NIGHTMARES[m].name})`),
  tracks: () => {
    const groups = [["core", CORE_TRACKS], ["every island", Object.keys(upgradeTracks).filter(k => !CORE_TRACKS.includes(k) && !upgradeTracks[k].requires)], ...MODE_KEYS.map(m => [islandName(m), TREES[m].concat(nmTrackKey(m) || [])]), ["master", Object.keys(upgradeTracks).filter(k => upgradeTracks[k].requires === "all")], ["dreams", Object.keys(upgradeTracks).filter(k => upgradeTracks[k].requires === "nightmare")]];
    groups.forEach(([g, keys]) => { say(g); keys.forEach(k => consolePrint(`  ${trackName(k).padEnd(20)} ${upgradeTracks[k].label} (${upgradeTracks[k].values.length} tiers, id ${k})`, "dim")); });
  },
  badges: () => rows(BADGE_FAMILIES, f => `${f.id.padEnd(12)} ${f.name} (${f.tiers.length} tiers)`),
  skins: () => rows(skins, s => `${s.id.padEnd(14)} ${s.name}  [${s.group}]`),
  themes: () => rows(backdrops, s => `${s.id.padEnd(14)} ${s.name}  [${s.group}]`),
  flair: () => rows(FLAIR, f => `${f.id.padEnd(12)} ${f.name}  [${f.slot}]`),
  items: () => rows(CONSUMABLE_KEYS, k => `${camel(CONSUMABLES[k].name).padEnd(18)} ${CONSUMABLES[k].name}`),
  stats: () => rows(statIds(), k => `${k.padEnd(18)} ${fmtInt(save.stats[k])}`),
  settings: () => rows(Object.keys(save.settings), k => `${k.padEnd(14)} ${JSON.stringify(save.settings[k])}`),
  screens: () => rows(Object.keys(OPEN_TARGETS), k => k),
  scenes: () => rows(STORY_ORDER, id => `${id.padEnd(16)} ${STORY[id].title}`),
  relics: () => rows(RELICS, r => `${r.id.padEnd(10)} ${r.name}`),
  sfx: () => say(Object.keys(SFX).join(" ")),
  music: () => say(Object.keys(TRACKS).join(" ")),
  spawns: () => say(SPAWN_KINDS.join(" "))
};
cmd("data", "list", slot("<kind>", () => Object.keys(LISTS)), "", "List the names other commands take: " + Object.keys(LISTS).join(", ") + ".", (a, ctx) => { LISTS[ctx.action](); return "quiet"; }, { examples: ["data list.tracks", "data list.islands", "data list.stats"] });

const RESET_TARGETS = { upgrades: "upgrades", highscores: "highscores", stats: "stats", cosmetics: "cosmetics", unlocks: "unlocks", settings: "settings", badges: "badges", prestige: "prestige", story: "story-reset", firstrun: "firstrun" };
cmd("data", "reset", slot("<part>", () => Object.keys(RESET_TARGETS).concat("medals", "all")), "yes", "Wipe part of the save: " + Object.keys(RESET_TARGETS).join(", ") + ", medals, or all. The word yes on the end is required.", (a, ctx) => {
  const w = ctx.action;
  if ((a[0] || "").toLowerCase() !== "yes") { say(`this wipes ${w}. run it again with yes on the end to confirm.`); return "quiet"; }
  if (w === "all") { resetEverything(); return "quiet"; }
  if (w === "medals") { save.treeMedals = {}; say("[ok] tree medals cleared"); return; }
  devWipe(RESET_TARGETS[w]);
}, { examples: ["data reset.stats yes", "data reset.all yes"] });

/* ----- The Easter egg ----- */
function easterEgg() {
  const el = document.createElement("div");
  el.className = "egg";
  consoleLogEl.appendChild(el);
  let i = 0;
  const slither = () => {
    el.textContent = " ".repeat(Math.max(0, i - 12)) + "~".repeat(Math.min(i, 12)) + "@>";
    consoleLogEl.scrollTop = consoleLogEl.scrollHeight;
    if (++i < 34) { setTimeout(slither, 40); return; }
    const lines = [
      "narrator> That command was not in the script. I want that on the record.",
      "narrator> I would be angrier, but I am secretly delighted. Do not tell the snake.",
      "narrator> Please accept this apple. It is complimentary, and only slightly cursed."
    ];
    let li = 0;
    const type = () => {
      if (li >= lines.length) { confetti(); sfx("medal"); return; }
      const row = document.createElement("div");
      row.className = "egg-line";
      consoleLogEl.appendChild(row);
      let ci = 0;
      const step = () => {
        row.textContent = lines[li].slice(0, ++ci);
        consoleLogEl.scrollTop = consoleLogEl.scrollHeight;
        if (ci < lines[li].length) setTimeout(step, 16);
        else { li++; setTimeout(type, 250); }
      };
      step();
    };
    type();
  };
  slither();
}

/* ----- Typing helpers: tab completion ----- */
function commonPrefix(list) {
  let p = list[0] || "";
  list.forEach(h => { while (!h.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1); });
  return p;
}
function completeFrom(pool, word, rebuild, after = " ") {
  const hits = Array.from(new Set(pool)).filter(p => p.toLowerCase().startsWith(word.toLowerCase()));
  if (hits.length === 1) return rebuild(hits[0]) + after;
  if (hits.length > 1) {
    consolePrint(hits.slice(0, 60).join("  ") + (hits.length > 60 ? `  ...and ${hits.length - 60} more` : ""), "dim");
    return rebuild(commonPrefix(hits) || word);
  }
  return null;
}
function completeLine(value) {
  const parts = value.replace(/^\s+/, "").split(/\s+/);
  if (parts.length <= 1) return completeFrom(GROUP_IDS.concat(META), parts[0] || "", h => h) || value;
  const group = resolveGroup(parts[0]);
  if (!group || parts.length > 2) return value;
  const word = parts[1];
  const head = parts[0] + " ";
  if (!word.includes(".")) return completeFrom(subjectNames(group), word, h => head + h, ".") || value;
  const [s, act] = [word.slice(0, word.indexOf(".")), word.slice(word.indexOf(".") + 1)];
  const hits = subjectHits(group, s);
  if (!hits.length) return value;
  return completeFrom(actionNames(hits), act, h => head + s + "." + h) || value;
}

/* The manual: everything the PDF needs, straight from the registry */
function consoleManual() {
  return {
    build: BUILD_NUMBER,
    groups: TERM_GROUPS,
    meta: [["help", "List the groups, or every command in a group: help dev, help upgrade advance"], ["clear", "Clear the screen"], ["status", "A summary of the save, the run and any bent rules"], ["version", "The build number"], ["exit", "Close the terminal"]],
    commands: COMMANDS.filter(c => !c.hidden).map(c => ({ group: c.group, usage: usageOf(c), subject: partName(c.subject), action: partName(c.action), args: c.args, desc: c.desc, examples: c.examples, aliases: c.aliases })),
    lists: {
      islands: MODE_KEYS.map((m, i) => [i + 1, islandName(m), m, modes[m].label, NIGHTMARES[m].name]),
      tracks: Object.keys(upgradeTracks).map(k => [trackName(k), k, upgradeTracks[k].label, upgradeTracks[k].nightmareOf ? islandName(upgradeTracks[k].nightmareOf) + " (red)" : CORE_TRACKS.includes(k) || k === "hearts" ? "core" : upgradeTracks[k].requires === "all" ? "master" : upgradeTracks[k].requires === "nightmare" ? "dreams" : upgradeTracks[k].requires ? islandName(upgradeTracks[k].requires) : "every island", upgradeTracks[k].values.length]),
      stats: statIds(),
      items: CONSUMABLE_KEYS.map(k => [camel(CONSUMABLES[k].name), CONSUMABLES[k].name]),
      settings: Object.keys(save.settings),
      screens: Object.keys(OPEN_TARGETS),
      sfx: Object.keys(SFX),
      music: Object.keys(TRACKS),
      spawns: SPAWN_KINDS,
      moods: Object.keys(CHATTER.narrator),
      badges: BADGE_FAMILIES.map(f => [f.id, f.name, f.tiers.length]),
      skins: skins.map(s => [s.id, s.name, s.group]),
      themes: backdrops.map(s => [s.id, s.name, s.group]),
      flair: FLAIR.map(f => [f.id, f.name, f.slot]),
      scenes: STORY_ORDER.map(id => [id, STORY[id].title]),
      relics: RELICS.map(r => [r.id, r.name])
    }
  };
}
