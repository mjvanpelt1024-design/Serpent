/* =========================================================
   src/game/save/save-data.js
   The save file: defaults, cleaning and migration
   ========================================================= */
"use strict";

/* =========================================================
   Save data
   ========================================================= */
function zeroModes() {
  return Object.fromEntries(MODE_KEYS.map(m => [m, 0]));
}

function defaultStats() {
  return {
    deaths: 0,
    wallCrashes: 0,
    tailBites: 0,
    poisoned: 0,
    screenLoops: 0,
    applesEaten: 0,
    popsiclesEaten: 0,
    popsiclesConverted: 0,
    xpEarned: 0,
    xpSpent: 0,
    orbsCollected: 0,
    timePlayedMs: 0,
    gamesPlayed: 0,
    longestSnake: 0,
    mirrorWarps: 0,
    bigApples: 0,
    bestDistance: 0,
    totalDistance: 0,
    poisonsSurvived: 0,
    antidotes: 0,
    rocksHit: 0,
    fleasHit: 0,
    firesHit: 0,
    molassesHit: 0,
    smallApples: 0,
    portalWarps: 0,
    nightmareGames: 0,
    revivesUsed: 0,
    shimmers: 0,
    goldHeartsUsed: 0,
    badgeXp: 0,
    badgeBucks: 0,
    quickDeaths: 0,
    soClose: 0,
    sameCauseBest: 0,
    sameCauseRun: 0,
    lastCause: "",
    hungerDeaths: 0,
    boostsUsed: 0,
    goldenApples: 0,
    fevers: 0,
    sheds: 0,
    contracts: 0,
    huntersBeaten: 0
  };
}

function defaultSettings() {
  return {
    sound: false,
    sfxVolume: 60,
    music: true,
    musicVolume: 50,
    showScore: true,
    showBest: false,
    keysArrows: true,
    keysWasd: true,
    buffer: 3,
    brightness: 100,
    contrast: 100,
    themedPage: true,
    shake: "normal",
    googly: false,
    commentary: "dramatic",
    snakeName: "Noodle",
    swipe: "medium",
    scoreUnit: "pts",
    confetti: true,
    intros: true,
    details: true,
    extras: true,
    scenes: true,
    chatter: true,
    vibration: true,
    awake: true,
    crt: true,
    bgMotion: true,
    particles: true,
    menuDemo: true,
    map3d: true,
    font: "default"
  };
}

/* Dev-only knobs, kept apart from player settings */
function defaultDev() {
  return {
    statFps: false,
    statSpeed: false,
    statRate: false,
    statRunXp: false,
    statItems: false,
    statLength: false,
    statDistance: false,
    scoreMult: 1,
    xpMult: 1,
    speedMult: 1,
    scrollMult: 1,
    hazardMult: 1,
    invincible: false,
    reverse: false,
    grid: false,
    sandbox: false,
    storyAll: false,
    relics: false,
    gate: { settings: false, params: false, unlocks: false, values: false, tools: false },
    pages: []
  };
}

function defaultTiers() {
  return Object.fromEntries(Object.keys(upgradeTracks).map(k => [k, 0]));
}

function defaultSave() {
  return {
    version: 7,
    xp: 0,
    xpProgress: 0,
    lifetimeScore: 0,
    highScores: zeroModes(),
    lifetimeByMode: zeroModes(),
    tiers: defaultTiers(),
    ownedSkins: ["classic"],
    selectedSkin: "classic",
    ownedBackdrops: ["black"],
    selectedBackdrop: "black",
    unlockedModes: ["easy"],
    unlockedNightmares: [],
    nmUpgrades: [],
    highScoresNightmare: zeroModes(),
    cosmeticTiers: { skins: ["Starter"], backdrops: ["Starter"] },
    seenItems: [],
    named: false,
    tutorialDone: false,
    seenScenes: [],
    relics: [],
    levels: [],
    community: [],
    pendingScene: null,
    bookPage: 0,
    bookSeenUpTo: 0,
    mapHome: "easy",
    levelReach: {},
    nmOpen: {},
    levelBest: {},
    treeMedals: {},
    bookOpened: false,
    shimmerBest: ["insane", "chaos", "mirror", "treasure", "endless", "inferno", "labyrinth"][Math.floor(Math.random() * 7)],
    consumables: Object.fromEntries(CONSUMABLE_KEYS_LIST.map(k => [k, 0])),
    consumableBought: Object.fromEntries(CONSUMABLE_KEYS_LIST.map(k => [k, 0])),
    avgRunXp: 0,
    ownedFlair: ["googly"],
    flair: { head: null, face: null, cape: null, body: null, tail: null },
    dev: defaultDev(),
    prestige: 0,
    gamesByMode: zeroModes(),
    badges: [],
    stats: defaultStats(),
    settings: defaultSettings(),
    snakebucks: 0,
    ownedAvatars: FREE_AVATARS.slice(),
    avatar: "apple",
    cheats: false,
    kind: "story",
    fullRun: false,
    freebies: [],
    created: 0
  };
}

function cleanNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function trackValueAt(key, tier, prestige) {
  const info = trackInfo(key, prestige === undefined ? save.prestige : prestige);
  const t = Math.max(0, Math.min(tier, info.values.length));
  return t === 0 ? info.base : info.values[t - 1];
}

function sanitizeSave(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== "object") return s;

  s.xp = Math.floor(cleanNumber(raw.xp));
  s.xpProgress = cleanNumber(raw.xpProgress);
  s.lifetimeScore = cleanNumber(raw.lifetimeScore);

  MODE_KEYS.forEach(m => {
    s.highScores[m] = cleanNumber(raw.highScores && raw.highScores[m]);
    s.lifetimeByMode[m] = cleanNumber(raw.lifetimeByMode && raw.lifetimeByMode[m]);
  });

  // Build 46 halved every island upgrade from 20 tiers to 10 (keeping its final value),
  // so an older save's island tiers are halved too, rounding up, to keep the same strength
  const before7 = (Number(raw.version) || 4) < 7;
  Object.keys(s.tiers).forEach(k => {
    const max = upgradeTracks[k].values.length;
    let tier = Math.floor(cleanNumber(raw.tiers && raw.tiers[k]));
    if (before7 && upgradeTracks[k].requires && MODE_KEYS.includes(upgradeTracks[k].requires) && !upgradeTracks[k].nightmareOf) tier = Math.ceil(tier / 2);
    s.tiers[k] = Math.min(max, tier);
  });

  // Owned things that no longer exist (a mod turned off) are parked in s.parked, and come back with it
  const parked = { skins: [], backdrops: [], avatars: [] };
  const wasParked = raw.parked && typeof raw.parked === "object" ? raw.parked : {};
  const sortOwned = (kind, list, known) => {
    const all = Array.from(new Set([...(Array.isArray(list) ? list : []), ...(Array.isArray(wasParked[kind]) ? wasParked[kind] : [])]))
      .filter(id => typeof id === "string" && id.length <= 64);
    parked[kind] = all.filter(id => !known(id));
    return all.filter(id => known(id));
  };
  if (Array.isArray(raw.ownedSkins) || wasParked.skins) {
    s.ownedSkins = Array.from(new Set(["classic", ...sortOwned("skins", raw.ownedSkins, id => skinById[id])]));
  }
  s.selectedSkin = s.ownedSkins.includes(raw.selectedSkin) ? raw.selectedSkin : "classic";

  if (Array.isArray(raw.ownedBackdrops) || wasParked.backdrops) {
    s.ownedBackdrops = Array.from(new Set(["black", ...sortOwned("backdrops", raw.ownedBackdrops, id => backdropById[id])]));
  }
  s.selectedBackdrop = s.ownedBackdrops.includes(raw.selectedBackdrop) ? raw.selectedBackdrop : "black";

  if (Array.isArray(raw.nmUpgrades)) s.nmUpgrades = MODE_KEYS.filter(m => raw.nmUpgrades.includes(m));
  if (Array.isArray(raw.unlockedNightmares)) s.unlockedNightmares = MODE_KEYS.filter(m => raw.unlockedNightmares.includes(m));
  // Since build 46 a red upgrade opens with its Nightmare island
  s.nmUpgrades = MODE_KEYS.filter(m => s.nmUpgrades.includes(m) || s.unlockedNightmares.includes(m));
  MODE_KEYS.forEach(m => { s.highScoresNightmare[m] = cleanNumber(raw.highScoresNightmare && raw.highScoresNightmare[m]); });
  if (Array.isArray(raw.unlockedModes)) {
    s.unlockedModes = Array.from(new Set(["easy", ...raw.unlockedModes.filter(m => modes[m])]));
  }

  const stats = raw.stats || {};
  Object.keys(s.stats).forEach(k => { s.stats[k] = cleanNumber(stats[k]); });

  MODE_KEYS.forEach(m => { s.gamesByMode[m] = cleanNumber(raw.gamesByMode && raw.gamesByMode[m]); });
  if (raw.consumables) CONSUMABLE_KEYS_LIST.forEach(k => { s.consumables[k] = Math.min(999, cleanNumber(raw.consumables[k])); });
  if (raw.consumableBought) CONSUMABLE_KEYS_LIST.forEach(k => { s.consumableBought[k] = cleanNumber(raw.consumableBought[k]); });
  s.avgRunXp = cleanNumber(raw.avgRunXp);
  // Only real Flair can be owned, and only owned Flair can be worn
  const flairKnown = id => CONTENT.flair.some(f => f.id === id);
  if (Array.isArray(raw.ownedFlair)) s.ownedFlair = Array.from(new Set(["googly", ...raw.ownedFlair.filter(id => typeof id === "string" && id.length <= 64 && flairKnown(id))]));
  if (raw.flair && typeof raw.flair === "object") {
    ["head", "face", "cape", "body", "tail"].forEach(slot => {
      const v = raw.flair[slot];
      if (typeof v === "string" && s.ownedFlair.includes(v)) s.flair[slot] = v;
    });
  } else if (raw.settings && raw.settings.googly) {
    s.flair.face = "googly";      // googly eyes moved to Flair, still owned and worn
  }
  // Players from before the story existed are already past the first-run screens
  const veteran = cleanNumber(raw.lifetimeScore) > 0;
  s.named = typeof raw.named === "boolean" ? raw.named : veteran;
  s.tutorialDone = typeof raw.tutorialDone === "boolean" ? raw.tutorialDone : veteran;
  if (Array.isArray(raw.relics)) s.relics = raw.relics.filter(k => typeof k === "string").slice(0, 16);
  if (typeof raw.pendingScene === "string") s.pendingScene = raw.pendingScene;
  const cleanLevels = (list, max) => (Array.isArray(list) ? list : []).map(l => parseLevelCode(levelCode(Object.assign({ n: "Level", e: "w", s: 7, g: "" }, l)))).filter(Boolean).slice(0, max);
  s.levels = cleanLevels(raw.levels, 30);
  s.community = cleanLevels(raw.community, 50);
  s.bookPage = Math.min(60, cleanNumber(raw.bookPage));
  s.bookSeenUpTo = Math.min(60, cleanNumber(raw.bookSeenUpTo));
  if (MODE_KEYS.includes(raw.mapHome)) s.mapHome = raw.mapHome;
  const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  MODE_KEYS.forEach(m => {
    const r = obj(raw.levelReach)[m];
    if (Number.isFinite(r)) s.levelReach[m] = Math.max(0, Math.min(2, Math.floor(r)));
    const n = obj(raw.nmOpen)[m];
    if (Array.isArray(n)) s.nmOpen[m] = [1, 2].filter(j => n.includes(j));
  });
  MODE_KEYS.concat("global").forEach(m => {
    const tm = obj(raw.treeMedals)[m];
    if (Array.isArray(tm)) s.treeMedals[m] = ["silver", "gold", "purple"].filter(x => tm.includes(x));
  });
  Object.entries(obj(raw.levelBest)).forEach(([k, v]) => {
    if (/^[a-z]+:n?[0-2]$/.test(k) && MODE_KEYS.includes(k.split(":")[0]) && Number.isFinite(v) && v > 0) s.levelBest[k] = Math.floor(v);
  });
  s.bookOpened = !!raw.bookOpened;
  if (Array.isArray(raw.seenScenes)) s.seenScenes = raw.seenScenes.filter(k => typeof k === "string").slice(0, 32);
  if (["insane", "chaos", "mirror", "treasure", "endless", "inferno", "labyrinth"].includes(raw.shimmerBest)) s.shimmerBest = raw.shimmerBest;
  if (Array.isArray(raw.seenItems)) s.seenItems = raw.seenItems.filter(k => typeof k === "string").slice(0, 64);
  if (Array.isArray(raw.badges)) s.badges = Array.from(new Set(raw.badges.filter(id => BADGE_IDS.has(id))));

  const set = raw.settings || {};
  ["sound", "showScore", "showBest", "keysArrows", "keysWasd", "themedPage", "googly", "confetti", "intros", "details", "extras", "scenes", "music", "chatter", "vibration", "awake", "crt", "bgMotion", "particles", "menuDemo", "map3d"].forEach(k => {
    if (typeof set[k] === "boolean") s.settings[k] = set[k];
  });
  if (!s.settings.keysArrows && !s.settings.keysWasd) s.settings.keysArrows = true;
  const clampNum = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  s.settings.sfxVolume = clampNum(set.sfxVolume, 0, 100, 60);
  s.settings.musicVolume = clampNum(set.musicVolume, 0, 100, 50);
  s.settings.brightness = clampNum(set.brightness, 70, 130, 100);
  s.settings.contrast = clampNum(set.contrast, 70, 130, 100);
  s.settings.buffer = Math.round(clampNum(set.buffer, 1, 3, 3));
  if (typeof set.shake === "boolean") s.settings.shake = set.shake ? "normal" : "off";
  else if (SHAKE_OPTIONS.some(o => o[0] === set.shake)) s.settings.shake = set.shake;
  if (SCORE_UNITS.some(o => o[0] === set.scoreUnit)) s.settings.scoreUnit = set.scoreUnit;
  if (["default", "retro", "classic", "jersey", "original"].includes(set.font)) s.settings.font = set.font;

  const dev = raw.dev || {};
  const DEV_MIN = { speedMult: 0.1, scrollMult: 0.1 };
  const DEV_MAX = { scoreMult: 1000, xpMult: 1000 };
  Object.keys(s.dev).forEach(k => {
    if (typeof s.dev[k] === "boolean" && typeof dev[k] === "boolean") s.dev[k] = dev[k];
    if (typeof s.dev[k] === "number") s.dev[k] = clampNum(dev[k], DEV_MIN[k] === undefined ? 0 : DEV_MIN[k], DEV_MAX[k] || 10, s.dev[k]);
  });
  if (dev.gate && typeof dev.gate === "object") Object.keys(s.dev.gate).forEach(g => { s.dev.gate[g] = dev.gate[g] === true; });
  if (Array.isArray(dev.pages)) s.dev.pages = dev.pages.filter(x => typeof x === "string").slice(0, 80);
  if (COMMENTARY_OPTIONS.some(o => o[0] === set.commentary)) s.settings.commentary = set.commentary;
  if (typeof set.snakeName === "string" && set.snakeName.trim()) {
    s.settings.snakeName = set.snakeName.trim().slice(0, 16);
  }
  if (SWIPE_OPTIONS.some(o => o[0] === set.swipe)) s.settings.swipe = set.swipe;

  s.prestige = Math.min(MAX_PRESTIGE, Math.floor(cleanNumber(raw.prestige)));
  // Profiles and Snakebucks (build 44)
  s.snakebucks = Math.floor(cleanNumber(raw.snakebucks));
  if (Array.isArray(raw.ownedAvatars) || wasParked.avatars) s.ownedAvatars = Array.from(new Set([...FREE_AVATARS, ...sortOwned("avatars", raw.ownedAvatars, id => AVATAR_BY_ID[id])]));
  s.parked = parked;
  s.avatar = s.ownedAvatars.includes(raw.avatar) ? raw.avatar : s.avatar;
  s.cheats = raw.cheats === true;
  s.kind = raw.kind === "nightmare" ? "nightmare" : "story";
  s.fullRun = raw.fullRun === true;
  if (Array.isArray(raw.freebies)) s.freebies = raw.freebies.filter(x => typeof x === "string").slice(0, 20);
  s.created = cleanNumber(raw.created);

  if ((Number(raw.version) || 4) < 6) {
    // Hearts used to upgrade a whole heart at a time
    s.tiers.hearts = Math.min(10, s.tiers.hearts * 2);
  }

  // Cosmetic tiers: keep anything unlocked, and grandfather in tiers you already own items from
  const tiers = raw.cosmeticTiers || {};
  ["skins", "backdrops"].forEach(kind => {
    const known = new Set(COSMETIC_TIERS[kind].map(t => t.group));
    const list = new Set(["Starter", ...(Array.isArray(tiers[kind]) ? tiers[kind].filter(g => known.has(g)) : [])]);
    const owned = kind === "skins" ? s.ownedSkins.map(id => skinById[id]) : s.ownedBackdrops.map(id => backdropById[id]);
    owned.forEach(item => { if (item) list.add(item.group); });
    s.cosmeticTiers[kind] = COSMETIC_TIERS[kind].map(t => t.group).filter(g => list.has(g));
  });

  // Keep progress below one XP's worth of points
  const per = trackValueAt("xp", s.tiers.xp, s.prestige);
  if (!(per > 0)) s.xpProgress = 0;
  else if (s.xpProgress >= per) s.xpProgress = s.xpProgress % per;

  return s;
}

/* Brings saves from the previous version (separate keys) forward */
function migrateLegacySave() {
  const legacyKeys = ["snakeCurrency", "snakeLifetimeScore", "snakeHighScores", "snakeOwnedSkins", "snakeCoinBoostTier"];
  if (!legacyKeys.some(k => store.getItem(k) !== null)) return null;

  const num = key => cleanNumber(parseFloat(store.getItem(key)));
  const oldTier = t => (t <= 0 ? 0 : Math.min(20, Math.round((t - 1) * 19 / 9) + 1));

  const raw = defaultSave();
  raw.xp = Math.floor(num("snakeCurrency"));
  raw.lifetimeScore = num("snakeLifetimeScore");

  raw.tiers.xp = oldTier(num("snakeCoinBoostTier"));
  raw.tiers.time = oldTier(num("snakeTimeTier"));
  raw.tiers.apple = oldTier(num("snakeAppleTier"));
  raw.tiers.luck = oldTier(num("snakeLuckTier"));
  raw.tiers.resist = oldTier(num("snakeResistTier"));
  raw.tiers.hearts = Math.min(5, Math.floor(num("snakeHeartsTier")));
  raw.version = 4;      // whole-heart tiers: sanitizeSave turns them into half-heart tiers

  try {
    const hs = JSON.parse(store.getItem("snakeHighScores"));
    if (hs) {
      raw.highScores.easy = cleanNumber(hs.easy);
      raw.highScores.classic = cleanNumber(hs.classic);
      raw.highScores.challenge = cleanNumber(hs.hard);
      raw.highScores.insane = cleanNumber(hs.insane);
    }
  } catch (e) { /* ignore */ }

  try {
    const owned = JSON.parse(store.getItem("snakeOwnedSkins"));
    if (Array.isArray(owned)) raw.ownedSkins = owned;
  } catch (e) { /* ignore */ }

  raw.selectedSkin = store.getItem("snakeSelectedSkin") || "classic";

  // Same progress the old bar showed
  raw.xpProgress = raw.lifetimeScore % trackValueAt("xp", raw.tiers.xp, 0);

  return raw;
}
