/* =========================================================
   src/dev/terminal/cmd-dev.js
   Group: dev
   ========================================================= */
"use strict";

/* =========================================================
   Group: dev (bending the rules, runs, spawning, unlocking)
   ========================================================= */
const PARAM_RANGES = { speedMult: [0.1, 5], scoreMult: [0, 1000], xpMult: [0, 1000], scrollMult: [0.1, 5], hazardMult: [0, 10] };

cmd("dev", "damage", "godmode", "[true|false]", "Invincible: walls, tails, hazards and poison cannot hurt you or end a run. No value flips it.", a => {
  save.dev.invincible = needBool(a[0], !save.dev.invincible);
  say(`[ok] damage.godmode = ${save.dev.invincible}`);
}, { examples: ["dev damage.godmode true", "dev damage.godmode off"], aliases: ["god", "invincible"] });

cmd("dev", "controls", "reverse", "[true|false]", "Reversed steering: up is down and left is right. No value flips it.", a => {
  save.dev.reverse = needBool(a[0], !save.dev.reverse);
  say(`[ok] controls.reverse = ${save.dev.reverse}`);
}, { examples: ["dev controls.reverse true"] });

function setMult(key, label, v) {
  const [lo, hi] = PARAM_RANGES[key];
  if (v < lo || v > hi) fail(`${label} goes from ${lo} to ${hi}`);
  save.dev[key] = Math.round(v * 100) / 100;
  say(`[ok] ${label} = x${save.dev[key]}`);
}
cmd("dev", "speed", "mult", "<x>", "How fast the snake moves, from 0.1 (crawl) to 5 (panic). 1 is normal.", a => setMult("speedMult", "speed.mult", needNum(a[0], "speed")), { examples: ["dev speed.mult 2", "dev speed.mult 0.5"] });
cmd("dev", "speed", "up", "", "Speed the snake up by 0.25.", () => setMult("speedMult", "speed.mult", Math.min(5, save.dev.speedMult + 0.25)));
cmd("dev", "speed", "down", "", "Slow the snake down by 0.25.", () => setMult("speedMult", "speed.mult", Math.max(0.1, save.dev.speedMult - 0.25)));
cmd("dev", "speed", "reset", "", "Normal speed again.", () => setMult("speedMult", "speed.mult", 1));
cmd("dev", "score", "mult", "<x>", "Multiply every point you score, 0 to 1000.", a => setMult("scoreMult", "score.mult", needNum(a[0], "multiplier")), { examples: ["dev score.mult 10"] });
cmd("dev", "xp", "mult", "<x>", "Multiply the XP a run pays, 0 to 1000.", a => setMult("xpMult", "xp.mult", needNum(a[0], "multiplier")), { examples: ["dev xp.mult 5"] });
cmd("dev", "scroll", "mult", "<x>", "How fast the Tunnel (Endless) scrolls, 0.1 to 5.", a => setMult("scrollMult", "scroll.mult", needNum(a[0], "multiplier")), { examples: ["dev scroll.mult 0.5"] });
cmd("dev", "hazard", "mult", "<x>", "How often hazards appear, 0 (never) to 10.", a => setMult("hazardMult", "hazard.mult", needNum(a[0], "multiplier")), { examples: ["dev hazard.mult 0"] });
cmd("dev", "rules", "show", "", "List every rule you have bent.", () => { say(paramSummary() || "all normal"); return "quiet"; });
cmd("dev", "rules", "reset", "", "Put godmode, reverse and every multiplier back to normal.", () => {
  const fresh = defaultDev();
  ["speedMult", "scoreMult", "xpMult", "scrollMult", "hazardMult", "invincible", "reverse"].forEach(k => { save.dev[k] = fresh[k]; });
  say("[ok] every rule is back to normal");
});

/* ----- Runs ----- */
cmd("dev", "run", "play", "<island> [level] [nm] [hold]", "Start a run on any island (name, mode or number), unlocking it if needed. level is 1 to 3. nm plays the Nightmare. hold freezes the run behind the terminal so you can set it up first.", a => {
  const key = resolveMode(a[0]);
  if (!key) fail("which island? try: data list.islands");
  const flags = a.slice(1).map(x => x.toLowerCase());
  const nm = flags.includes("nm") || flags.includes("nightmare");
  const hold = flags.includes("hold");
  const lvl = flags.find(x => /^\d+$/.test(x));
  const j = lvl ? Number(lvl) - 1 : 0;
  if (j < 0 || j >= LEVELS_PER_AREA) fail(`level goes from 1 to ${LEVELS_PER_AREA}`);
  if (!isModeUnlocked(key)) save.unlockedModes = ordered(Array.from(new Set([...save.unlockedModes, key])), MODE_KEYS);
  if (nm && !save.unlockedNightmares.includes(key)) save.unlockedNightmares = ordered(Array.from(new Set([...save.unlockedNightmares, key])), MODE_KEYS);
  clearPauseState();
  currentModeKey = key;
  currentNightmare = nm;
  currentLevel = j;
  persist();
  startGame();
  if (hold) {
    paused = true;
    pauseStartedAt = performance.now();
    pauseDetour = true;
    openScreen("console");
    consolePrint(`[ok] ${modes[key].label}${nm ? " nightmare" : ""} level ${j + 1} is held. spawn and set things, then: dev run.resume`);
  }
  return "quiet";
}, { examples: ["dev run.play garden", "dev run.play quarry 3", "dev run.play mirror nm hold"] });

cmd("dev", "run", "resume", "", "Let a held run carry on.", () => {
  if (!pauseDetour) fail("no held run. start one with: dev run.play <island> hold");
  pauseDetour = false;
  pauseOpen = true;
  showScreen(null);
  continueGame();
  return "quiet";
});

const END_CAUSES = ["quit", "wall", "self", "poison", "flea", "fire", "behind"];
cmd("dev", "run", "end", "[cause]", "End the run in progress as if you died that way: " + END_CAUSES.join(", ") + " (default quit).", a => {
  needRun();
  const cause = (a[0] || "quit").toLowerCase();
  if (!END_CAUSES.includes(cause)) fail("cause: " + END_CAUSES.join(", "));
  if (pauseDetour) { pauseDetour = false; pauseOpen = false; paused = false; showScreen(null); }
  endGame(cause);
  return "quiet";
}, { examples: ["dev run.end wall"] });

/* ----- Spawning and clearing ----- */
const SPAWN_KINDS = ["apple", "xp", "rock", "popsicle", "flea", "fire", "molasses", "shimmer", "relic"];
cmd("dev", "spawn", slot("<thing>", () => SPAWN_KINDS), "[small|normal|large] [count]", "Drop things into the run in progress: " + SPAWN_KINDS.join(", ") + ". Size and count are optional.", (a, ctx) => {
  needRun();
  const what = ctx.action;
  let grade = 1;
  let count = 1;
  a.forEach(x => {
    const t = x.toLowerCase();
    if (t === "small") grade = 0;
    else if (t === "normal") grade = 1;
    else if (t === "large" || t === "big") grade = 2;
    else if (Number.isFinite(parseNum(t))) count = Math.max(1, Math.min(200, Math.floor(parseNum(t))));
    else fail(`'${x}' is not a size or a count`);
  });
  if (what === "relic" && !relicFor(currentModeKey)) fail("this island does not hide a collectible");
  const worldX = edgeMode === "endless" ? endlessSpawnX() - cell * 3 : undefined;
  const now = performance.now();
  const endlessRun = edgeMode === "endless";
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const spot = spotFor(what === "shimmer" || what === "relic" ? 1 : grade, worldX);
    if (!spot) break;
    if (what === "apple") apples.push(spot);
    else if (what === "xp") makeOrb(spot);
    else if (what === "rock") rocks.push(spot);
    else if (what === "popsicle") popsicles.push(Object.assign(spot, { isBonusApple: false, spawnAt: now, expiresAt: now + (endlessRun ? 1e9 : 15000) }));
    else if (what === "shimmer") shimmers.push(Object.assign(spot, { spawnAt: now, expiresAt: now + SHIMMER_LIFE }));
    else if (what === "relic") relicItems.push(Object.assign(spot, { relic: relicFor(currentModeKey).id, spawnAt: now, expiresAt: now + RELIC_LIFE }));
    else hazards.push(Object.assign(spot, { type: what, spawnAt: now, expiresAt: now + (endlessRun ? 1e9 : 20000) }));
    placed++;
  }
  if (!placed) fail("no room on the board");
  say(`[ok] spawned ${placed} ${what}${placed === 1 ? "" : "s"}`);
}, { examples: ["dev spawn.apple large 3", "dev spawn.flea small 5", "dev spawn.relic"] });

const PURGE_KINDS = ["hazards", "rocks", "popsicles", "apples", "xp", "all"];
cmd("dev", "purge", slot("<thing>", () => PURGE_KINDS), "", "Clear things off the board in the run in progress: " + PURGE_KINDS.join(", ") + ".", (a, ctx) => {
  needRun();
  const w = ctx.action;
  if (w === "hazards" || w === "all") hazards = [];
  if (w === "rocks" || w === "all") rocks = [];
  if (w === "popsicles" || w === "hazards" || w === "all") popsicles = popsicles.filter(p => p.isBonusApple && w !== "all" && w !== "popsicles");
  if (w === "apples" || w === "all") apples = [];
  if (w === "xp" || w === "all") orbs = [];
  say(`[ok] purged ${w}`);
}, { examples: ["dev purge.hazards", "dev purge.all"] });

/* ----- Unlocking content: every one takes all, next, a number, a range, a name or a list ----- */
const skinsLike = (items, ownedKey, tierKind, defaultId, selectedKey) => ({
  all: () => items.map(i => i.id),
  resolve: tok => {
    const t = squash(tok);
    const hit = items.find(i => squash(i.id) === t || squash(i.name) === t);
    if (hit) return hit.id;
    const group = items.filter(i => squash(i.group) === t);
    return group.length ? group.map(i => i.id) : null;
  },
  nextOn: () => (items.find(i => !save[ownedKey].includes(i.id)) || {}).id,
  nextOff: () => save[ownedKey].filter(id => id !== defaultId).slice(-1)[0],
  apply: (keys, on) => {
    keys.forEach(id => {
      const item = items.find(i => i.id === id);
      if (on) {
        if (!save[ownedKey].includes(id)) save[ownedKey].push(id);
        if (!save.cosmeticTiers[tierKind].includes(item.group)) save.cosmeticTiers[tierKind].push(item.group);
      } else if (id !== defaultId) {
        save[ownedKey] = save[ownedKey].filter(x => x !== id);
      }
    });
    if (!save[ownedKey].includes(save[selectedKey])) save[selectedKey] = defaultId;
    save[ownedKey] = items.map(i => i.id).filter(id => save[ownedKey].includes(id));
    applyBackdrop();
  },
  summary: () => `${save[ownedKey].length}/${items.length} owned`
});

const UNLOCK_TARGETS = {
  islands: {
    what: "island", list: "islands", desc: "islands, with all three of their levels (1 the Garden to 10)",
    all: () => MODE_KEYS, resolve: resolveMode,
    nextOn: () => MODE_KEYS.find(m => !save.unlockedModes.includes(m)),
    nextOff: () => MODE_KEYS.slice().reverse().find(m => m !== "easy" && save.unlockedModes.includes(m)),
    apply: (keys, on) => { save.unlockedModes = on ? ordered(Array.from(new Set([...save.unlockedModes, ...keys])), MODE_KEYS) : save.unlockedModes.filter(m => m === "easy" || !keys.includes(m)); keys.forEach(k => { save.levelReach[k] = on ? 2 : 0; }); },
    summary: () => `${save.unlockedModes.length}/${MODE_KEYS.length} unlocked`
  },
  nightmares: {
    what: "Nightmare", list: "islands", desc: "Nightmare levels (numbered like the islands)",
    all: () => MODE_KEYS, resolve: resolveMode,
    nextOn: () => MODE_KEYS.find(m => !save.unlockedNightmares.includes(m)),
    nextOff: () => MODE_KEYS.slice().reverse().find(m => save.unlockedNightmares.includes(m)),
    apply: (keys, on) => { save.unlockedNightmares = on ? ordered(Array.from(new Set([...save.unlockedNightmares, ...keys])), MODE_KEYS) : save.unlockedNightmares.filter(m => !keys.includes(m)); keys.forEach(k => { save.nmOpen[k] = on ? [1, 2] : []; }); },
    summary: () => `${save.unlockedNightmares.length}/${MODE_KEYS.length} unlocked`
  },
  red: {
    what: "red track", list: "islands", desc: "the red Nightmare upgrade on each island's tree",
    all: () => MODE_KEYS, resolve: resolveMode,
    nextOn: () => MODE_KEYS.find(m => !save.nmUpgrades.includes(m)),
    nextOff: () => MODE_KEYS.slice().reverse().find(m => save.nmUpgrades.includes(m)),
    apply: (keys, on) => { save.nmUpgrades = on ? ordered(Array.from(new Set([...save.nmUpgrades, ...keys])), MODE_KEYS) : save.nmUpgrades.filter(m => !keys.includes(m)); },
    summary: () => `${save.nmUpgrades.length}/${MODE_KEYS.length} open`
  },
  badges: {
    what: "badge path", list: "badges", desc: "achievement badge paths (earns every tier of each)",
    all: () => BADGE_FAMILIES.map(f => f.id),
    resolve: tok => (BADGE_FAMILIES.find(f => squash(f.id) === squash(tok) || squash(f.name) === squash(tok)) || {}).id,
    nextOn: () => (BADGE_FAMILIES.find(f => !f.tiers.every(t => save.badges.includes(f.id + ":" + t))) || {}).id,
    nextOff: () => (BADGE_FAMILIES.slice().reverse().find(f => f.tiers.some(t => save.badges.includes(f.id + ":" + t))) || {}).id,
    apply: (keys, on) => keys.forEach(id => {
      const f = BADGE_FAMILIES.find(x => x.id === id);
      f.tiers.forEach(t => {
        const b = id + ":" + t;
        if (on && !save.badges.includes(b)) save.badges.push(b);
        if (!on) save.badges = save.badges.filter(x => x !== b);
      });
    }),
    summary: () => `${save.badges.length}/${BADGE_TOTAL} badges`
  },
  skins: Object.assign({ what: "skin", list: "skins", desc: "snake skins (a tier name like Solids does the whole tier)" }, skinsLike(skins, "ownedSkins", "skins", "classic", "selectedSkin")),
  themes: Object.assign({ what: "theme", list: "themes", desc: "themes (a tier name like Gradients does the whole tier)" }, skinsLike(backdrops, "ownedBackdrops", "backdrops", "black", "selectedBackdrop")),
  flair: {
    what: "Flair item", list: "flair", desc: "Flair items, including the reward ones",
    all: () => FLAIR.map(f => f.id),
    resolve: tok => (FLAIR.find(f => squash(f.id) === squash(tok) || squash(f.name) === squash(tok)) || {}).id,
    nextOn: () => (FLAIR.find(f => !save.ownedFlair.includes(f.id)) || {}).id,
    nextOff: () => save.ownedFlair.filter(id => id !== "googly").slice(-1)[0],
    apply: (keys, on) => {
      keys.forEach(id => {
        if (on && !save.ownedFlair.includes(id)) save.ownedFlair.push(id);
        if (!on && id !== "googly") {
          save.ownedFlair = save.ownedFlair.filter(x => x !== id);
          Object.keys(save.flair).forEach(s => { if (save.flair[s] === id) save.flair[s] = null; });
        }
      });
    },
    summary: () => `${save.ownedFlair.length}/${FLAIR.length} owned`
  },
  story: {
    what: "story page", list: "scenes", desc: "story book pages (1 to " + STORY_ORDER.length + ", or a page id)",
    all: () => STORY_ORDER, resolve: tok => STORY_ORDER.find(id => id === String(tok).toLowerCase()),
    nextOn: () => STORY_ORDER.find(id => !pageOpen(id)),
    nextOff: () => save.dev.pages.slice(-1)[0],
    apply: (keys, on) => {
      if (on) {
        save.named = true;
        save.tutorialDone = true;
        keys.forEach(id => { if (!save.dev.pages.includes(id)) save.dev.pages.push(id); });
        if (keys.length === STORY_ORDER.length) {
          save.dev.storyAll = true;
          STORY_ORDER.forEach(id => { if (!save.seenScenes.includes(id)) save.seenScenes.push(id); });
          CRYPTIC_TIERS.forEach(t => { if (!save.badges.includes("cryptic:" + t)) save.badges.push("cryptic:" + t); });
        }
      } else {
        save.dev.pages = save.dev.pages.filter(id => !keys.includes(id));
        if (keys.length === STORY_ORDER.length) { save.dev.storyAll = false; save.dev.pages = []; }
      }
    },
    summary: () => `${STORY_ORDER.filter(pageOpen).length}/${STORY_ORDER.length} pages open`
  },
  relics: {
    what: "collectible", list: "relics", desc: "the " + RELICS.length + " collectibles",
    all: () => RELICS.map(r => r.id),
    resolve: tok => (RELICS.find(r => squash(r.id) === squash(tok) || squash(r.name) === squash(tok)) || {}).id,
    nextOn: () => (RELICS.find(r => !save.relics.includes(r.id)) || {}).id,
    nextOff: () => save.relics.slice(-1)[0],
    apply: (keys, on) => {
      keys.forEach(id => {
        if (on && !save.relics.includes(id)) save.relics.push(id);
        if (!on) save.relics = save.relics.filter(x => x !== id);
      });
      if (on && save.relics.length === RELICS.length && !save.ownedFlair.includes("ancient")) save.ownedFlair.push("ancient");
    },
    summary: () => `${save.relics.length}/${RELICS.length} found`
  }
};
const UNLOCK_ALIAS = { modes: "islands", mode: "islands", island: "islands", nightmare: "nightmares", skin: "skins", backdrops: "themes", backdrop: "themes", theme: "themes", badge: "badges", relic: "relics", collectibles: "relics", pages: "story" };

function runUnlock(target, spec, on) {
  const t = UNLOCK_TARGETS[target];
  const keys = selectFrom(spec, t.all(), t.resolve, on ? t.nextOn : t.nextOff, t.what, t.list);
  t.apply(keys, on);
  say(`[ok] ${on ? "unlocked" : "locked"} ${keys.length === t.all().length ? "all " + target : keys.join(", ")}  (${t.summary()})`);
}

Object.entries(UNLOCK_TARGETS).forEach(([name, t]) => {
  const aliasesFor = Object.keys(UNLOCK_ALIAS).filter(k => UNLOCK_ALIAS[k] === name);
  const subj = aliasesFor.length ? slot(name, () => [name], tok => (squash(tok) === name || aliasesFor.includes(squash(tok)) ? name : null)) : name;
  cmd("dev", subj, "unlock", "<which>", `Unlock ${t.desc}. which: all, next, a number, a range like 2-5, a name, or a comma list.`, a => runUnlock(name, a[0], true), { examples: [`dev ${name}.unlock all`, `dev ${name}.unlock next`] });
  cmd("dev", subj, "lock", "<which>", `Lock ${t.desc} again. Same choices as unlock.`, a => runUnlock(name, a[0], false), { examples: [`dev ${name}.lock all`] });
});
cmd("dev", "sandbox", "unlock", "", "Open the Sandbox without finishing every island and Nightmare.", () => { save.dev.sandbox = true; say("[ok] sandbox unlocked"); });
cmd("dev", "sandbox", "lock", "", "Close the Sandbox cheat (it still opens normally once you have earned it).", () => { save.dev.sandbox = false; say("[ok] sandbox cheat off"); });
const ALL_CONTENT = ["islands", "nightmares", "red", "badges", "skins", "themes", "flair", "story", "relics"];
cmd("dev", "everything", "unlock", "", "Unlock all content: islands, Nightmares, red tracks, badges, skins, themes, Flair, story, collectibles and the Sandbox. Upgrades are separate: upgrade all.max", () => {
  ALL_CONTENT.forEach(n => runUnlock(n, "all", true));
  save.dev.sandbox = true;
  say("[ok] everything is unlocked");
}, { examples: ["dev everything.unlock"] });
cmd("dev", "everything", "lock", "", "Lock all content again, back to a fresh start (upgrades, XP and stats stay).", () => {
  ALL_CONTENT.forEach(n => runUnlock(n, "all", false));
  save.dev.sandbox = false;
  say("[ok] everything is locked");
});
