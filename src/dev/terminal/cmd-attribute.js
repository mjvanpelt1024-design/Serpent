/* =========================================================
   src/dev/terminal/cmd-attribute.js
   Group: attribute
   ========================================================= */
"use strict";

/* =========================================================
   Group: attribute (numbers you can read and change)
   ========================================================= */
/* One numeric attribute: builds its .get, .set, .add and .sub */
function attr(subject, spec) {
  const { label, get, put, min = 0, max = Infinity, step = 0, run = false, fmt = fmtInt, actions = ["get", "set", "add", "sub"], desc, examples = [] } = spec;
  const clamp = v => {
    let x = Math.max(min, Math.min(max, v));
    if (step) x = Math.round(x / step) * step;
    return x;
  };
  const done = (ctx) => say(`[ok] ${typeof subject === "string" ? subject : ctx.subject} = ${fmt(get(ctx))}`);
  const lbl = ctx => (typeof label === "function" ? label(ctx) : label);
  const tag = run ? " (the run in progress)" : "";
  if (actions.includes("get")) cmd("attribute", subject, "get", "", `Read ${desc}${tag}.`, (a, ctx) => { if (run) needRun(); say(`${lbl(ctx)} = ${fmt(get(ctx))}`); return "quiet"; });
  if (actions.includes("set")) cmd("attribute", subject, "set", "<n>", `Set ${desc}${tag}.`, (a, ctx) => { if (run) needRun(); put(clamp(needNum(a[0], lbl(ctx))), ctx); done(ctx); }, { examples: examples.filter(e => e.includes(".set")) });
  if (actions.includes("add")) cmd("attribute", subject, "add", "<n>", `Add to ${desc}${tag}.`, (a, ctx) => { if (run) needRun(); put(clamp(get(ctx) + needNum(a[0], lbl(ctx))), ctx); done(ctx); }, { examples: examples.filter(e => e.includes(".add")) });
  if (actions.includes("sub")) cmd("attribute", subject, "sub", "<n>", `Take away from ${desc}${tag}. It stops at ${min}.`, (a, ctx) => { if (run) needRun(); put(clamp(get(ctx) - needNum(a[0], lbl(ctx))), ctx); done(ctx); }, { aliases: ["subtract", "remove", "minus"] });
}

attr("xp", { label: "xp", desc: "your XP (2.5k, 3m, 5b and 1e12 all work)", get: () => save.xp, put: v => { save.xp = Math.floor(v); }, examples: ["attribute xp.set 150", "attribute xp.add 1m"] });
attr("lifetime", { label: "lifetime score", desc: "the lifetime score on the Stats screen (no XP is paid)", get: () => save.lifetimeScore, put: v => { save.lifetimeScore = round2(v); }, actions: ["get", "set"] });
cmd("attribute", "lifetime", "earn", "<n>", "Add lifetime score as if you earned it: it turns into XP at your current rate.", a => {
  const n = needNum(a[0], "score");
  if (n <= 0) fail("score to earn must be above 0");
  save.lifetimeScore = round2(save.lifetimeScore + n);
  gainXpProgress(n);
  say(`[ok] earned ${fmtInt(n)} lifetime score, xp is now ${fmtInt(save.xp)}`);
}, { examples: ["attribute lifetime.earn 50k"] });
cmd("attribute", "prestige", "get", "", "Read your core stats rank.", () => { say(`prestige = ${save.prestige} (${PRESTIGE_RANKS[save.prestige] || "none"})`); return "quiet"; });
cmd("attribute", "prestige", "set", "<rank>", `Set the core stats rank: 0 none, 1 Copper, 2 Silver, 3 Gold.`, a => {
  const p = Math.floor(needNum(a[0], "rank"));
  if (p < 0 || p > MAX_PRESTIGE) fail(`rank goes from 0 to ${MAX_PRESTIGE}`);
  const oldPer = getPointsPerXp();
  save.prestige = p;
  save.xpProgress = Math.min(getPointsPerXp() * 0.9999, (save.xpProgress / oldPer) * getPointsPerXp());
  say(`[ok] prestige = ${PRESTIGE_RANKS[p] || "none"}`);
}, { examples: ["attribute prestige.set 3"] });
attr("avgRunXp", { label: "average run xp", desc: "the typical XP per run the game remembers (Shop item prices follow it)", get: () => save.avgRunXp, put: v => { save.avgRunXp = v; }, actions: ["get", "set"] });
cmd("attribute", "name", "get", "", "Read the snake's name.", () => { say(`name = ${snakeName()}`); return "quiet"; });
cmd("attribute", "name", "set", "<text>", "Rename the snake for free (up to 16 letters).", a => {
  if (!a.length) fail("what name?");
  save.settings.snakeName = a.join(" ").slice(0, 16);
  say(`[ok] name = ${save.settings.snakeName}`);
}, { examples: ["attribute name.set Hiss"] });

attr("score", { label: "run score", desc: "the score", run: true, get: () => score, put: v => { score = v; }, examples: ["attribute score.set 1m"] });
attr("hearts", { label: "hearts", desc: "your hearts (halves are fine, up to 99)", run: true, max: 99, step: 0.5, fmt: v => String(v), get: () => currentHearts, put: v => { currentHearts = v; lastHeartsKey = ""; }, examples: ["attribute hearts.add 1"] });
attr("gold", { label: "golden hearts", desc: "your golden hearts", run: true, max: 99, step: 1, fmt: v => String(v), get: () => goldHearts, put: v => { goldHearts = v; lastHeartsKey = ""; } });
attr("length", { label: "snake length", desc: "how long the snake is", run: true, min: 1, max: 2000, step: 1, fmt: v => String(v), get: () => snake.maxCells, put: v => { snake.maxCells = v; }, examples: ["attribute length.add 10"] });

cmd("attribute", "best", "get", "<island> [nm]", "Read a high score. Add nm for the Nightmare.", a => {
  const m = resolveMode(a[0]);
  if (!m) fail("which island? try: data list.islands");
  const nm = (a[1] || "").toLowerCase() === "nm";
  say(`${modes[m].label}${nm ? " nightmare" : ""} best = ${fmtInt((nm ? save.highScoresNightmare : save.highScores)[m] || 0)}`);
  return "quiet";
});
cmd("attribute", "best", "set", "<island> [nm] <n>", "Set a high score. Add nm before the number for the Nightmare.", a => {
  const m = resolveMode(a[0]);
  if (!m) fail("which island? try: data list.islands");
  const nm = (a[1] || "").toLowerCase() === "nm";
  const n = Math.max(0, needNum(nm ? a[2] : a[1], "score"));
  (nm ? save.highScoresNightmare : save.highScores)[m] = n;
  say(`[ok] ${modes[m].label}${nm ? " nightmare" : ""} best = ${fmtInt(n)}`);
}, { examples: ["attribute best.set quarry 5000", "attribute best.set mirror nm 1m"] });

/* Every number on the Stats screen, and every one-time item, is its own subject */
const statIds = () => Object.keys(save.stats).filter(k => typeof save.stats[k] === "number");
const STAT_SLOT = slot("<stat>", statIds);
attr(STAT_SLOT, { label: ctx => ctx.subject, desc: "a number from the Stats screen (data list.stats)", get: ctx => save.stats[ctx.subject], put: (v, ctx) => { save.stats[ctx.subject] = v; }, examples: ["attribute applesEaten.set 1m"] });
const ITEM_SLOT = slot("<item>", () => CONSUMABLE_KEYS.map(k => camel(CONSUMABLES[k].name)), tok => {
  const k = CONSUMABLE_KEYS.find(x => squash(x) === squash(tok) || squash(CONSUMABLES[x].name) === squash(tok));
  return k ? camel(CONSUMABLES[k].name) : null;
});
const itemKeyOf = name => CONSUMABLE_KEYS.find(x => camel(CONSUMABLES[x].name) === name);
attr(ITEM_SLOT, { label: ctx => ctx.subject, desc: "how many of a one-time item you hold (0 to 999, data list.items)", max: 999, step: 1, fmt: v => String(v), get: ctx => save.consumables[itemKeyOf(ctx.subject)], put: (v, ctx) => { save.consumables[itemKeyOf(ctx.subject)] = v; }, examples: ["attribute revive.set 50"] });
