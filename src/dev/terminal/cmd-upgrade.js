/* =========================================================
   src/dev/terminal/cmd-upgrade.js
   Group: upgrade
   ========================================================= */
"use strict";

/* =========================================================
   Group: upgrade (tracks and whole island trees)
   ========================================================= */
/* A subject here is one track (by its name, like appleErApples, or its short id),
   or a set of them: all, core, red, master, dreams, or an island like garden */
function upgradeSelection(tok) {
  const t = squash(tok);
  const one = resolveTrack(tok);
  if (one) return { label: trackName(one), keys: [one] };
  if (t === "all") return { label: "all", keys: Object.keys(upgradeTracks) };
  if (t === "core") return { label: "core", keys: CORE_TRACKS.slice() };
  if (t === "red") return { label: "red", keys: MODE_KEYS.map(nmTrackKey).filter(Boolean) };
  if (t === "master") return { label: "master", keys: Object.keys(upgradeTracks).filter(k => upgradeTracks[k].requires === "all") };
  if (t === "dreams" || t === "nightmare") return { label: "dreams", keys: Object.keys(upgradeTracks).filter(k => upgradeTracks[k].requires === "nightmare") };
  if (t === "everyisland" || t === "global") return { label: "global", keys: Object.keys(upgradeTracks).filter(k => !CORE_TRACKS.includes(k) && !upgradeTracks[k].requires) };
  const m = resolveMode(tok);
  if (m && TREES[m]) return { label: islandName(m), keys: TREES[m].concat(nmTrackKey(m) || []), island: m };
  return null;
}
const UPG_SLOT = slot("<track|island|all>",
  () => Object.keys(upgradeTracks).map(trackName).concat(MODE_KEYS.map(islandName), ["all", "core", "red", "master", "dreams", "global"]),
  tok => upgradeSelection(tok));

function moveTiers(sel, fn, verb) {
  const lines = [];
  sel.keys.forEach(k => {
    const max = upgradeTracks[k].values.length;
    const now = save.tiers[k] || 0;
    const next = Math.max(0, Math.min(max, Math.floor(fn(now, max))));
    setTierSafe(k, next);
    if (next > 0 && upgradeTracks[k].nightmareOf && !save.nmUpgrades.includes(upgradeTracks[k].nightmareOf)) save.nmUpgrades = ordered(save.nmUpgrades.concat(upgradeTracks[k].nightmareOf), MODE_KEYS);
    lines.push(`${trackName(k).padEnd(18)} ${next}/${max}  (${upgradeTracks[k].format(getTrackValue(k))})`);
  });
  if (sel.keys.length === 1) say(`[ok] ${verb} ${lines[0]}`);
  else { say(`[ok] ${verb} ${sel.keys.length} tracks in ${sel.label}`); if (sel.keys.length <= 8) lines.forEach(l => note("  " + l)); }
  checkTreeMedals(false);
}

cmd("upgrade", UPG_SLOT, "advance", "[n]", "Move up n tiers (default 1), free. Stops at the top.", (a, ctx) => moveTiers(ctx.subject, now => now + (a[0] === undefined ? 1 : needNum(a[0], "tiers")), "advanced"), { examples: ["upgrade appleErApples.advance 4", "upgrade garden.advance 2"], aliases: ["up", "buy"] });
cmd("upgrade", UPG_SLOT, "reduce", "[n]", "Move down n tiers (default 1). Stops at 0.", (a, ctx) => moveTiers(ctx.subject, now => now - (a[0] === undefined ? 1 : needNum(a[0], "tiers")), "reduced"), { examples: ["upgrade snackTime.reduce 3"], aliases: ["down", "back", "downgrade"] });
cmd("upgrade", UPG_SLOT, "set", "<n|max>", "Put it at an exact tier (0 to its top, or max).", (a, ctx) => {
  const v = (a[0] || "").toLowerCase();
  moveTiers(ctx.subject, (now, max) => (v === "max" ? max : needNum(a[0], "tier")), "set");
}, { examples: ["upgrade experienceBooster.set 10", "upgrade core.set max"] });
cmd("upgrade", UPG_SLOT, "max", "", "Max it out.", (a, ctx) => moveTiers(ctx.subject, (now, max) => max, "maxed"), { examples: ["upgrade all.max", "upgrade quarry.max"] });
cmd("upgrade", UPG_SLOT, "reset", "", "Back to tier 0. Medals you already earned stay.", (a, ctx) => moveTiers(ctx.subject, () => 0, "reset"), { examples: ["upgrade all.reset"] });
cmd("upgrade", UPG_SLOT, "get", "", "Show the tier and what it does now.", (a, ctx) => {
  ctx.subject.keys.forEach(k => consolePrint(`${trackName(k).padEnd(18)} ${save.tiers[k] || 0}/${upgradeTracks[k].values.length}  ${upgradeTracks[k].format(getTrackValue(k))}  [${k}]`));
  return "quiet";
}, { examples: ["upgrade garden.get"] });

const MEDAL_KINDS = ["silver", "gold", "purple"];
const islandSlot = slot("<island|all>", () => MODE_KEYS.map(islandName).concat("all"), tok => (squash(tok) === "all" ? MODE_KEYS.slice() : resolveMode(tok) ? [resolveMode(tok)] : null));
cmd("upgrade", "medals", "grant", "<island|all> [silver|gold|purple]", "Hand out tree medals without maxing the tree (all three if no kind is given).", a => {
  const isl = islandSlot.resolve(a[0] || "");
  if (!isl) fail("which island? try: data list.islands");
  const kinds = a[1] ? [a[1].toLowerCase()] : MEDAL_KINDS;
  if (!kinds.every(k => MEDAL_KINDS.includes(k))) fail("medal kinds: silver, gold, purple");
  isl.forEach(m => { const have = save.treeMedals[m] || []; save.treeMedals[m] = MEDAL_KINDS.filter(k => have.includes(k) || kinds.includes(k)); });
  say(`[ok] medals granted on ${isl.length === MODE_KEYS.length ? "every island" : isl.map(islandName).join(", ")}`);
}, { examples: ["upgrade medals.grant all", "upgrade medals.grant garden gold"] });
cmd("upgrade", "medals", "reset", "<island|all>", "Take tree medals away (they come back if the tree still qualifies).", a => {
  const isl = islandSlot.resolve(a[0] || "");
  if (!isl) fail("which island? try: data list.islands");
  isl.forEach(m => { delete save.treeMedals[m]; });
  say(`[ok] medals cleared on ${isl.length === MODE_KEYS.length ? "every island" : isl.map(islandName).join(", ")}`);
}, { examples: ["upgrade medals.reset all"] });
