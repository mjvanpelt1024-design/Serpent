/* =========================================================
   src/dev/terminal/cmd-debug.js
   Group: debug
   ========================================================= */
"use strict";

/* =========================================================
   Group: debug (looking under the hood)
   ========================================================= */
const STAT_NAMES = { fps: "statFps", speed: "statSpeed", rate: "statRate", xp: "statRunXp", items: "statItems", length: "statLength", distance: "statDistance" };
cmd("debug", "stat", slot("<name>", () => Object.keys(STAT_NAMES).concat("all")), "[true|false]", "Show a live readout under the board: " + Object.keys(STAT_NAMES).join(", ") + ", or all. No value flips it.", (a, ctx) => {
  const n = ctx.action;
  const keys = n === "all" ? Object.values(STAT_NAMES) : [STAT_NAMES[n]];
  const on = needBool(a[0], !keys.every(k => save.dev[k]));
  keys.forEach(k => { save.dev[k] = on; });
  say(`[ok] stat.${n} = ${on}`);
}, { examples: ["debug stat.fps true", "debug stat.all off"] });

cmd("debug", "grid", "show", "[true|false]", "Draw the movement grid over the board. No value flips it.", a => {
  save.dev.grid = needBool(a[0], !save.dev.grid);
  say(`[ok] grid.show = ${save.dev.grid}`);
}, { examples: ["debug grid.show true"] });

cmd("debug", "sfx", "play", "<sound>", "Play a sound effect, even with sound off (data list.sfx lists them).", a => {
  const n = (a[0] || "").toLowerCase();
  if (!SFX[n]) fail("unknown sound. try: data list.sfx");
  const was = save.settings.sound;
  save.settings.sound = true;
  sfx(n);
  save.settings.sound = was;
  say(`[ok] played ${n}`);
  return "quiet";
}, { examples: ["debug sfx.play medal"] });

cmd("debug", "music", "play", "<track>", "Force a music theme (data list.music lists them).", a => {
  const n = (a[0] || "").toLowerCase();
  if (!TRACKS[n]) fail("unknown track. try: data list.music");
  debugTrack = n;
  updateMusic();
  say(`[ok] music = ${n}`);
}, { examples: ["debug music.play tense"] });
cmd("debug", "music", "off", "", "Silence the music until you hand it back.", () => { debugTrack = "off"; updateMusic(); say("[ok] music off"); });
cmd("debug", "music", "auto", "", "Let the game pick the music again.", () => { debugTrack = null; updateMusic(); say("[ok] music is back to normal"); });

cmd("debug", "setting", slot("<key>", () => Object.keys(save.settings)), "[value]", "Read or change any setting by its key (data list.settings). The value is checked and clamped like the Settings screen.", (a, ctx) => {
  const k = ctx.action;
  if (!a.length) { say(`${k} = ${JSON.stringify(save.settings[k])}`); return "quiet"; }
  const cur = save.settings[k];
  let v;
  if (typeof cur === "boolean") v = needBool(a[0]);
  else if (typeof cur === "number") v = needNum(a[0], k);
  else v = a.join(" ");
  const probe = JSON.parse(JSON.stringify(save));
  probe.settings[k] = v;
  const clean = sanitizeSave(probe).settings;
  save.settings[k] = clean[k];
  syncSettings();
  updateMusic();
  say(`[ok] ${k} = ${JSON.stringify(save.settings[k])}${clean[k] !== v ? "  (adjusted to a valid value)" : ""}`);
}, { examples: ["debug setting.musicVolume 80", "debug setting.crt false", "debug setting.commentary"] });

const OPEN_TARGETS = { main: "main", profiles: "profiles", saves: "profiles", map: "modes", play: "modes", shop: "upgrades", tailor: "upgrades", cosmetics: "upgrades", tree: "global", upgrades: "global", inventory: "inventory", achievements: "achievements", stats: "stats", settings: "settings", story: "story", book: "story", sandbox: "shelf", editor: "sandbox", terminal: "console" };
cmd("debug", "screen", "open", "<screen>", "Jump to a screen: " + Object.keys(OPEN_TARGETS).join(", ") + ". Leaving a held run behind abandons it.", a => {
  const t = OPEN_TARGETS[(a[0] || "").toLowerCase()];
  if (!t) fail("open what? " + Object.keys(OPEN_TARGETS).join(", "));
  if (t === "main" || t === "modes") clearPauseState();
  openScreen(t);
  return "quiet";
}, { examples: ["debug screen.open shop"] });
cmd("debug", "scene", "play", "<id>", "Play a story scene (data list.scenes lists the ids).", a => {
  const id = (a[0] || "").toLowerCase();
  if (!STORY[id]) fail("unknown scene. try: data list.scenes");
  openScreen("settings");
  playScene(id);
  return "quiet";
});
cmd("debug", "page", "open", "<n|id>", "Open the story book at a page, by number or id.", a => {
  const t = (a[0] || "").toLowerCase();
  const i = /^\d+$/.test(t) ? Number(t) - 1 : STORY_ORDER.indexOf(t);
  if (i < 0 || i >= STORY_ORDER.length) fail("unknown page. try: data list.scenes");
  save.bookPage = i;
  openScreen("story");
  return "quiet";
}, { examples: ["debug page.open 1"] });
cmd("debug", "say", slot("<narrator|snake>", () => ["narrator", "snake"]), "[mood]", "Make the narrator or the snake pipe up. Moods: " + Object.keys(CHATTER.narrator).join(", ") + ".", (a, ctx) => {
  const who = ctx.action;
  const mood = (a[0] || "calm").toLowerCase();
  if (!CHATTER[who][mood]) fail("unknown mood: " + Object.keys(CHATTER[who]).join(", "));
  saySomething(who, mood);
  say(`[ok] ${who} says something ${mood}`);
}, { examples: ["debug say.narrator calm", "debug say.snake hurt"] });
cmd("debug", "toast", "show", "<text>", "Show a gold toast bubble with your text.", a => { if (!a.length) fail("what text?"); showToast(escapeAttr(a.join(" "))); }, { examples: ["debug toast.show hello there"] });
cmd("debug", "confetti", "fire", "", "A burst of confetti.", () => { confetti(); });
cmd("debug", "tutorial", "play", "", "Play the tutorial again.", () => { clearPauseState(); startTutorial(); return "quiet"; });
cmd("debug", "fullscreen", "toggle", "", "Go full screen, or come back out.", () => { toggleFullscreen(); });
cmd("debug", "layout", "show", "", "How big the board is drawn right now, and which layout is in use.", () => {
  const r = stageEl.getBoundingClientRect();
  say(`board ${Math.round(r.width)}x${Math.round(r.height)} px  window ${window.innerWidth}x${window.innerHeight}  ui x${getComputedStyle(document.documentElement).getPropertyValue("--ui").trim()}  ${document.body.classList.contains("wide") ? "side rails" : "stacked"}  sharpness x${RS}`);
  return "quiet";
});
