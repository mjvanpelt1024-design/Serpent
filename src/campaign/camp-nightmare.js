/* =========================================================
   src/campaign/camp-nightmare.js
   Nightmare mode (build 53). All numbers: content/campaign/nightmare.json.

   Win the last island's last level and the Maw's body (the Coil the islands
   sit on) opens up. On the map (src/ui/map-deep.js), the ground gives way:
   a hole in the island's grass, and below it a cave with the tunnel's stops
   as pins. Under each island, from the top down, a tunnel:
     the roots     the Great Tree's roots hang in: upgrades that work in
                   every nightmare level (one set per island), paid in that
                   island's money at deep prices
     levels 1-10   the island's own levels, harder, on boards turned a
                   quarter turn (content/levels/nightmare/), with a twist
                   and the deep's snakes
     the shop      after level 5: things only the deep sells (they work in
                   the normal shops and workshops like anything else)
     the Maw       level 11: its last stand. Beat it and the next tunnel
                   down opens; its stretch of the Coil turns to bone.
   Five Maws in all. The fifth crosses out its wanted poster and earns its
   sticker on the title screen.

   The deep's snakes: each level brings the newest few kinds (nightmare.json
   "snakes", by "from"), and the further down, the more of them at once.
     head  chases your head and bites      cut   gets in front of you
     loot  takes keys, pouches, relics, trinkets or apples, and drops them
           again as it flees
   Their head into your body: they lose. Your head into them: you're bitten.

   Save: camp.nm = { open, levels: { "crown:3": wins }, maw: [islands], roots: { id: tier } }
   ========================================================= */
"use strict";

const NM_DATA = CAMP.nightmare || {};
const NM_ORDER = NM_DATA.order || [];
const NM_LEVELS = NM_DATA.levels || 10;
const NM_MAW = NM_LEVELS + 1;
const nmRootList = () => Object.values(NM_DATA.roots || {}).flatMap(r => r.upgrades);
const nmRootById = id => nmRootList().find(u => u.id === id);

CAMP_REPAIRS.push(c => {
  if (!c.nm) c.nm = { open: false, levels: {}, maw: [], roots: {} };
  c.nm.levels = c.nm.levels || {};
  c.nm.maw = (c.nm.maw || []).filter((x, i, a) => NM_ORDER.includes(x) && a.indexOf(x) === i);
  c.nm.roots = c.nm.roots || {};
});

// the deep's runes have colors like any other
(CAMP.nmItems || []).forEach(r => { if (r.family === "rune" && typeof RUNE_COLORS !== "undefined") RUNE_COLORS[r.id] = r.color; });
// and its snakes say what got you
if (typeof FOE_CAUSE_TEXT !== "undefined") (NM_DATA.snakes || []).forEach(s => { FOE_CAUSE_TEXT[s.id] = `The ${s.name} got you.`; });

/* ----- Where you are ----- */
const nmUnlocked = (c = camp) => !!c && campWon(NM_DATA.unlock.island, NM_DATA.unlock.level, c);
const nmDepth = isl => NM_ORDER.indexOf(isl);                  // 0 for the first tunnel (the top)
const nmLevelWon = (isl, k) => ((camp.nm.levels[`${isl}:${k}`]) || 0) > 0;
const nmMawSlain = isl => camp.nm.maw.includes(isl);
function nmTunnelOpen(isl) {
  if (!nmUnlocked()) return false;
  const d = nmDepth(isl);
  return d === 0 || (d > 0 && nmMawSlain(NM_ORDER[d - 1]));
}
const nmTunLevelOpen = (isl, k) => nmTunnelOpen(isl) && (k === 1 || nmLevelWon(isl, k - 1));
const nmShopOpen = isl => nmLevelWon(isl, NM_DATA.shopAfter || 5);
/* The tunnel to show: the deepest one open */
function nmCurrentTunnel() {
  let at = NM_ORDER[0];
  NM_ORDER.forEach(isl => { if (nmTunnelOpen(isl)) at = isl; });
  return at;
}

/* ----- The levels ----- */
/* Tunnel isl's level k as a level the campaign can run (campStart's nmDef) */
function nmLevelDef(isl, k) {
  const H = NM_DATA.harder || {}, T = NM_DATA.tunnels[isl], depth = nmDepth(isl);
  const deeper = 1 + (H.perTunnel || 0) * depth;
  if (k === NM_MAW) {
    const last = campLevelDef(isl, LEVEL_COUNT);
    return {
      n: k, name: `${T.name}: the Maw`, kind: "boss", layout: "arena", edge: "wall", speed: last.speed * (H.speed || 1) * deeper,
      goal: { type: "boss", fight: 3 }, spawns: JSON.parse(JSON.stringify(last.spawns || {})), text: "The Maw.",
      board: `nm-${isl}-${k}`, nightmare: isl, twist: T.twist
    };
  }
  const base = JSON.parse(JSON.stringify(campLevelDef(isl, NM_DATA.base[k - 1])));
  const def = Object.assign(base, { n: k, name: T.names[k - 1], board: `nm-${isl}-${k}`, nightmare: isl, twist: T.twist });
  delete def.bonus;                      // the level's bonus challenge belongs to the island above
  def.speed = base.speed * (H.speed || 1) * deeper;
  const g = def.goal;
  if (g && g.need && !["relic", "boss"].includes(g.type)) g.need = Math.ceil(g.need * (H.need || 1) * deeper);
  Object.values(def.spawns || {}).forEach(s => {
    if (s.max) s.max = Math.ceil(s.max * (H.spawns || 1));
    if (s.count) s.count = Math.ceil(s.count * (H.spawns || 1));
    if (s.delay) s.delay = s.delay.map(d => Math.round(d / (H.spawns || 1)));
  });
  if (def.layout === "maze" || def.layout === "field" || def.layout === "tunnel") def.layout = "open";
  return def;
}

/* The roots' upgrades, as stats every nightmare level reads (campStart adds them to the run's extras) */
function nmRootStats() {
  const out = {};
  Object.entries(camp.nm.roots).forEach(([id, tier]) => {
    const u = nmRootById(id);
    if (!u || tier <= 0) return;
    out[u.stat] = (out[u.stat] || 0) + u.v[Math.min(tier, u.v.length) - 1];
  });
  return out;
}

function nmStart(isl, k) {
  if (!nmTunLevelOpen(isl, k)) return false;
  closeNmPanel();
  closeMapGoal();
  campStart(isl, k, -1, nmLevelDef(isl, k));
  if (!campRun) return false;
  // the tunnel's twist, on top of whatever the level brings
  const tw = NM_DATA.tunnels[isl].twist;
  if (tw) nm[tw] = true;
  nmSnakesSetup();
  return true;
}

/* A nightmare win pays like a level 15 + k, times payMult */
function nmReward(k, first) {
  const R = CAMP.rules.rewards;
  let r = (R.winBase + R.perLevel * (LEVEL_COUNT + k)) * (k === NM_MAW ? R.bossMult : 1) * (NM_DATA.payMult || 1);
  if (!first) r *= R.replayShare;
  if (!campRun.lostHeart) r *= 1 + R.flawlessBonus;
  r *= (1 + upPct("bounty")) * Math.max(0, 1 + runeVal("money") / 100);
  return Math.max(1, Math.round(r));
}

function nmWinLevel() {
  if (!campRun || campRun.over || gameState !== "PLAYING") return;
  campStopBoard();
  const { isl, n: k } = campRun;
  const key = `${isl}:${k}`;
  const first = !nmLevelWon(isl, k);
  camp.nm.levels[key] = (camp.nm.levels[key] || 0) + 1;
  const pay = nmReward(k, first);
  campPay(isl, pay);
  const lines = [`+${campMoney(isl, pay)} for the win${first ? " (first win)" : ""}`];
  campPayPoints(lines);
  campBump("levelsWon");
  campBump("nmWins");
  if (!campRun.lostHeart) { campBump("flawless"); lines.push("Flawless: not a heart lost"); }
  campGiveFinds(lines, "Found");
  const notes = [];
  if (k === NM_MAW && !nmMawSlain(isl)) {
    camp.nm.maw.push(isl);
    campBump("mawSlain");
    if (typeof coilCache !== "undefined") coilCache = null;
    const next = NM_ORDER[nmDepth(isl) + 1];
    notes.push(next ? `The Maw falls back into the dark. The tunnel under ${CAMP.islandById[next].name} is open.` : "The Maw is beaten for good.");
  } else if (first && k < NM_MAW) notes.push(k === NM_LEVELS ? "The Maw's lair is open." : `Level ${k + 1} is open: ${NM_DATA.tunnels[isl].names[k]}`);
  if (first && k === (NM_DATA.shopAfter || 5)) notes.push("A shop of the deep opened in the tunnel.");
  campCheckAch();
  saveCamp();
  sfx("medal");
  if (save.settings.confetti) confetti();
  showCampResult(true, lines, notes);
}

/* ----- The deep's snakes ----- */
let nmSnakes = [];            // { def, cells, grow, moveAt, stunUntil, carry }
function nmSnakeKinds(isl, k) {
  const d = nmDepth(isl) * NM_LEVELS + k;      // 1 .. 50, counting every tunnel's levels in a row
  const kinds = (NM_DATA.snakes || []).filter(s => s.from <= d).sort((a, b) => b.from - a.from).slice(0, 3);
  return { kinds, most: 1 + Math.floor(d / 12) };
}
function nmSnakesSetup() {
  nmSnakes = [];
  if (!campRun || !campRun.nmRun) return;
  const { kinds, most } = nmSnakeKinds(campRun.isl, campRun.n);
  campRun.nmKinds = kinds;
  campRun.nmMost = campRun.def.kind === "boss" ? Math.max(1, most - 2) : most;
  campRun.nmNextAt = performance.now() + 6000;
}
function nmSpawnSnake(ts) {
  const kinds = campRun.nmKinds || [];
  if (!kinds.length) return;
  const def = kinds[Math.floor(Math.random() * kinds.length)];
  for (let i = 0; i < (def.count || 1); i++) {
    const spot = edgeSpot();
    if (!spot) return;
    nmSnakes.push({ def, cells: [{ x: spot.x, y: spot.y }], grow: def.len - 1, moveAt: ts + 500 + i * 200, stunUntil: 0, carry: null });
  }
  showToast(`A ${def.name}${def.count ? " hatches" : " slithers in"}!`);
  sfx("portal");
}
const nmPace = s => moveInterval * s.def.pace * (1 + Math.max(0, runeVal("nmSnakeSlow")) / 100) * (wardOn("sting") || (campRun && performance.now() < (campRun.jellyUntil || 0)) ? 1.8 : 1);
/* Where it's going */
function nmSnakeTarget(s) {
  const head = s.cells[0];
  if (s.def.go === "cut") return { x: snake.x + snake.dx * 4, y: snake.y + snake.dy * 4 };
  if (s.def.go === "loot" && !s.carry) {
    const goods = campObjs.filter(o => ["key", "shard", "relic", "loot"].includes(o.kind)).concat(apples.filter(a => !a.rotten));
    if (goods.length) {
      const d = o => Math.abs(o.x - head.x) + Math.abs(o.y - head.y);
      return goods.sort((a, b) => d(a) - d(b))[0];
    }
  }
  if (s.def.go === "loot" && s.carry) {
    // running off with it: away from your head
    return { x: head.x + (head.x - snake.x), y: head.y + (head.y - snake.y) };
  }
  return { x: snake.x, y: snake.y };
}
function nmTickSnakes(ts) {
  if (!campRun || !campRun.nmRun || campRun.over) return;
  if (nmSnakes.length < (campRun.nmMost || 1) && ts >= (campRun.nmNextAt || Infinity)) {
    nmSpawnSnake(ts);
    campRun.nmNextAt = ts + 9000 + Math.random() * 7000;
  }
  for (const s of nmSnakes.slice()) {
    if (ts < s.moveAt || ts < s.stunUntil) continue;
    s.moveAt = ts + nmPace(s);
    const head = s.cells[0], t = nmSnakeTarget(s);
    const opts = [];
    const sx = stepToward(head.x, t.x), sy = stepToward(head.y, t.y);
    if (sx) opts.push([sx, 0]);
    if (sy) opts.push([0, sy]);
    if (opts.length === 2 && Math.random() < 0.5) opts.reverse();
    if (Math.random() < 0.2 || !opts.length) opts.push(...[[cell, 0], [-cell, 0], [0, cell], [0, -cell]].sort(() => Math.random() - 0.5));
    let moved = false;
    for (const [dx, dy] of opts) {
      const x = head.x + dx, y = head.y + dy;
      if (!inBoard(x, y) || walls.has(cellKey(x, y)) || s.cells.some(c => c.x === x && c.y === y)) continue;
      if (nmSnakes.some(o => o !== s && o.cells.some(c => c.x === x && c.y === y))) continue;
      // your head: a bite
      if (x === snake.x && y === snake.y) { nmBite(s, ts); moved = true; break; }
      // your body: it's the one that loses
      if (snake.cells.some(c => c.x === x && c.y === y)) { nmSnakeDies(s, true); moved = true; break; }
      s.cells.unshift({ x, y });
      if (s.grow > 0) s.grow--; else s.cells.pop();
      moved = true;
      break;
    }
    if (!moved || !nmSnakes.includes(s)) continue;
    // a thief at its prize
    const h = s.cells[0];
    if (s.def.go === "loot" && !s.carry) {
      const o = campObjs.find(o => o.x === h.x && o.y === h.y && ["key", "shard", "relic", "loot"].includes(o.kind));
      const a = apples.find(a => a.x === h.x && a.y === h.y);
      if (o) { campObjs.splice(campObjs.indexOf(o), 1); s.carry = { obj: o, dropAt: ts + 6000 }; showToast(`The ${s.def.name} grabbed your ${o.kind === "loot" ? "trinket" : o.kind}!`); sfx("flea"); }
      else if (a) { apples.splice(apples.indexOf(a), 1); maintainApples(); sfx("pop"); }
    }
    if (s.carry && ts >= s.carry.dropAt) nmDrop(s);
  }
}
/* A thief lets go of what it took: where it is, or far off if that square isn't free */
function nmDrop(s) {
  if (!s.carry) return;
  const o = s.carry.obj, h = s.cells[0];
  const spot = campSpot(0) || h;
  o.x = spot.x; o.y = spot.y;
  campObjs.push(o);
  s.carry = null;
}
function nmSnakeDies(s, byYou) {
  nmDrop(s);
  nmSnakes = nmSnakes.filter(x => x !== s);
  if (byYou) { showToast(`The ${s.def.name} ran into you and fell apart!`); addScore(80 * scoreMultiplier); campBump("nmSnakes"); }
  sfx("pop");
}
function nmBite(s, ts) {
  nmSnakeDies(s, false);
  if (starOn() || feverOn() || fieldOn()) { addScore(80 * scoreMultiplier); return; }
  graceUntil = Math.max(graceUntil, ts + 700);
  sfx("flea");
  takeHit(s.def.bite, s.def.id);
  if (s.def.chill) { fx.slowFactor = 1.5; fx.slowUntil = Math.max(fx.slowUntil, ts) + s.def.chill * 1000; showToast("A chill bite: you slow down."); }
  if (s.def.venom && campRun) setTimeout(() => { if (campRun && !campRun.over && gameState === "PLAYING") { showToast("The venom bites again."); takeHit(s.def.venom, s.def.id); } }, 2500);
}
/* Your head into one of them */
function nmHeadInto(ts) {
  const s = nmSnakes.find(s => s.cells.some(c => c.x === snake.x && c.y === snake.y));
  if (s) nmBite(s, ts);
}
function nmDrawSnakes(view) {
  nmSnakes.forEach(s => s.cells.forEach((c, i) => {
    const [x, y] = view.toScreen(c.x, c.y);
    const w = cell - 1;
    ctx.fillStyle = i === 0 ? s.def.color : i % 2 ? s.def.color : s.def.belly;
    ctx.fillRect(x, y, w, w);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x, y + w * 0.8, w, Math.max(1, w * 0.2));
    if (i === 0) {
      ctx.fillStyle = "#ffe04a"; ctx.fillRect(x + w * 0.2, y + w * 0.2, w * 0.22, w * 0.22); ctx.fillRect(x + w * 0.58, y + w * 0.2, w * 0.22, w * 0.22);
      ctx.fillStyle = "#1a0a0a"; ctx.fillRect(x + w * 0.27, y + w * 0.2, w * 0.08, w * 0.22); ctx.fillRect(x + w * 0.65, y + w * 0.2, w * 0.08, w * 0.22);
      if (s.carry) { ctx.fillStyle = "#ffd23f"; ctx.fillRect(x + w * 0.35, y + w * 0.65, w * 0.3, w * 0.3); }
    }
  }));
}

/* ----- The Maw ----- */
function nmMawNumbers(isl) {
  const M = NM_DATA.maw, P = M.perTunnel || {}, d = nmDepth(isl);
  const B = Object.assign({}, M);
  ["hearts", "armor", "length"].forEach(k => { B[k] = M[k] + (P[k] || 0) * d; });
  B.speed = M.speed + (P.speed || 0) * d;
  return B;
}

/* ----- Hooks: only ever do anything in a nightmare level ----- */
(() => {
  const wrap = (name, fn) => { const orig = window[name]; if (typeof orig !== "function") { console.warn("nightmare hook: no " + name); return; } window[name] = fn(orig); };
  wrap("campWinLevel", orig => function () { return campRun && campRun.nmRun ? nmWinLevel() : orig.apply(this, arguments); });
  wrap("spawnBoss", orig => function (def, fight) {
    if (!(campRun && campRun.nmRun)) return orig.apply(this, arguments);
    const M = NM_DATA.maw;
    return spawnBossFrom(nmMawNumbers(campRun.isl), 3, CAMP.islands.length, campRun.isl, { rules: M.rules || {}, traits: M.traits || [] }, { maw: true });
  });
  wrap("showCampResult", orig => function (won, lines, notes, line = "") {
    if (!(campRun && campRun.nmRun)) return orig.apply(this, arguments);
    const { isl, n: k, def } = campRun;
    campLast = { isl, n: k, challenge: -1, nm: true };
    const report = { won, isl, k, name: def.name, score: Math.floor(score), lines, notes, line,
      title: won ? (k === NM_MAW ? "The Maw is beaten!" : "Level complete!") : line === "You left the level." ? "Left the level" : "Defeated" };
    campLeaveRun();
    clearPauseState();
    nmBackToMap(isl, report);
  });
  wrap("campRestart", orig => function () {
    if (campLast && campLast.nm) { nmStart(campLast.isl, campLast.n); return; }
    return orig.apply(this, arguments);
  });
  wrap("tickMechanics", orig => function (ts) { orig.apply(this, arguments); if (campRun && campRun.nmRun && gameState === "PLAYING" && !campRun.over) nmTickSnakes(ts); });
  wrap("drawHunter", orig => function (view) { orig.apply(this, arguments); if (campRun && campRun.nmRun) nmDrawSnakes(view); });
  wrap("stepSnake", orig => function (ts) { orig.apply(this, arguments); if (campRun && campRun.nmRun && gameState === "PLAYING" && !campRun.over && nmSnakes.length) nmHeadInto(ts || performance.now()); });
  wrap("occupiedSet", orig => function () { const set = orig.apply(this, arguments); if (campRun && campRun.nmRun) nmSnakes.forEach(s => s.cells.forEach(c => set.add(cellKey(c.x, c.y)))); return set; });
  wrap("campShiftTimers", orig => function (d) {
    orig.apply(this, arguments);
    if (!campRun || !campRun.nmRun) return;
    if (campRun.nmNextAt) campRun.nmNextAt += d;
    nmSnakes.forEach(s => { s.moveAt += d; if (s.stunUntil) s.stunUntil += d; if (s.carry) s.carry.dropAt += d; });
  });
  wrap("campLeaveRun", orig => function () { nmSnakes = []; return orig.apply(this, arguments); });
})();

/* =========================================================
   On the map (build 53). A tunnel is a cave cut into its island's rock
   (src/ui/map-deep.js) and its stops are map pins: a level's pin opens its
   card with Start (openNmGoal), the roots and the shop open a panel over the
   map (openNmPanel), and after a run the map comes back on the island with
   the run in the same card. When the last island's last boss falls, the map
   flies there and the ground gives way (deepDig); every Maw beaten digs the
   next island down.
   ========================================================= */
let nmEl = null, nmIsl = null, nmPanel = null, nmPendingDig = null;
const nmIco = (id, s = 3) => `<img class="nm-ico" src="${iconUrl(id, s)}" alt="">`;

/* The roots or the shop, over the map */
function openNmPanel(isl, kind) {
  if (!camp || !nmTunnelOpen(isl)) return;
  nmIsl = isl;
  nmPanel = kind;
  if (!nmEl) {
    nmEl = document.createElement("div");
    nmEl.id = "nightmare";
    nmEl.className = "nm-modal";
    nmEl.setAttribute("role", "dialog");
    nmEl.setAttribute("aria-modal", "true");
    document.body.appendChild(nmEl);
    nmEl.addEventListener("click", nmClick);
    document.addEventListener("keydown", e => {
      if (!nmEl || !nmEl.classList.contains("active") || e.key !== "Escape") return;
      e.preventDefault(); e.stopImmediatePropagation();
      closeNmPanel();
    }, true);
  }
  nmEl.setAttribute("aria-label", kind === "roots" ? NM_DATA.roots[isl].name : "The shop of the deep");
  nmEl.classList.add("active");
  renderNmPanel();
  sfx("tab");
}
function closeNmPanel() {
  if (!nmEl) return;
  nmEl.classList.remove("active");
  nmPanel = null;
  campWalletUpdate();
}
function renderNmPanel() {
  if (!nmEl || !nmPanel) return;
  nmEl.innerHTML = `<div class="nm-panel plate">${nmPanel === "roots" ? nmRootsHtml(nmIsl) : nmShopHtml(nmIsl)}</div>`;
  campWalletUpdate();
}

/* What a win pays, before the run's own bonuses: on the level's card */
function nmRewardPreview(k, first) {
  const R = CAMP.rules.rewards;
  let r = (R.winBase + R.perLevel * (LEVEL_COUNT + k)) * (k === NM_MAW ? R.bossMult : 1) * (NM_DATA.payMult || 1);
  if (!first) r *= R.replayShare;
  return Math.max(1, Math.round(r * (1 + upPct("bounty"))));
}

/* A tunnel level's card on the map: what it wants, its twist, its snakes, its pay, and Start.
   With a report: how the run went, and Again / Next. */
function openNmGoal(key, k, report = null) {
  if (!nmTunLevelOpen(key, k) && !report) return;
  const def = nmLevelDef(key, k), T = NM_DATA.tunnels[key], I = CAMP.islandById[key];
  const twist = (typeof SB_TWISTS !== "undefined" ? SB_TWISTS.find(x => x[0] === T.twist) : null) || [T.twist, T.twist, ""];
  const snakes = nmSnakeKinds(key, k).kinds.map(s => s.name).join(", ");
  const R = report, first = !nmLevelWon(key, k);
  const next = R && R.won && k < NM_MAW && nmTunLevelOpen(key, k + 1);
  mapGoalFor = { key, j: "nm" + k };
  const body = R
    ? `<p class="mg-goal">${escapeAttr(R.title)} · ${fmtInt(R.score)} points</p>` +
      (R.line ? `<p class="mg-text">${escapeAttr(R.line)}</p>` : "") +
      R.lines.map(l => `<p class="mg-text">${l}</p>`).join("") + R.notes.map(l => `<p class="mg-text nm-new">${escapeAttr(l)}</p>`).join("")
    : `<p class="mg-label">Objective</p><p class="mg-goal">${escapeAttr(goalText(def.goal))}</p>
       <div class="mg-row"><span class="mg-k">Twist</span><span>${escapeAttr(twist[1])}${twist[2] ? ` <em>(${escapeAttr(twist[2])})</em>` : ""}</span></div>
       ${snakes ? `<div class="mg-row"><span class="mg-k">Snakes</span><span>${escapeAttr(snakes)}</span></div>` : ""}
       <div class="mg-row"><span class="mg-k">Reward</span><span>${coinHtml(key)} ${fmtInt(nmRewardPreview(k, first))}${first ? " (first win)" : ""}, plus your points</span></div>`;
  const acts = R
    ? `<button class="btn" data-mg="back">OK</button><button class="btn btn-small" data-mg="again">${R.won ? "Again" : "Try again"}</button>${next ? `<button class="btn btn-primary" data-mg="next">Next</button>` : ""}`
    : `<button class="btn" data-mg="back">Back</button><button class="btn btn-primary" data-mg="go">Start</button>`;
  mapGoalEl.innerHTML = `<div class="mg-card nm-card${R ? (R.won ? " won" : " lost") : ""}">
      <p class="mg-kicker">${escapeAttr(T.name)} · under ${escapeAttr(I.name)} · ${k === NM_MAW ? "the Maw's lair" : "level " + k}</p>
      <h3 class="mg-title">${k === NM_MAW ? SKULL_SVG : ""}${escapeAttr(def.name)}</h3>
      ${body}
      <div class="mg-acts">${acts}</div>
    </div>`;
  mapGoalEl.classList.add("open");
  mapGoalEl.classList.remove("quest");
  sfx("tab");
  const on = (id, fn) => { const b = mapGoalEl.querySelector(`[data-mg="${id}"]`); if (b) b.addEventListener("click", e => { e.stopPropagation(); fn(); }); };
  on("go", () => nmStart(key, k));
  on("again", () => nmStart(key, k));
  on("next", () => nmStart(key, k + 1));
  on("back", () => { closeMapGoal(); nmDigPending(); });
  mapGoalEl.onclick = e => { if (e.target === mapGoalEl) { closeMapGoal(); nmDigPending(); } };
  setTimeout(() => { const b = mapGoalEl.querySelector('[data-mg="next"], [data-mg="go"]'); if (b) b.focus({ preventScroll: true }); }, 40);
}

/* After a run: back to the map on its island, with the run in the level's card */
function nmBackToMap(isl, report) {
  mapReturnTo = isl;
  lastPlayed = { key: isl, j: report.k, nm: true };
  if (report.won && report.k === NM_MAW) { const next = NM_ORDER[nmDepth(isl) + 1]; if (next && nmTunnelOpen(next)) nmPendingDig = next; }
  openScreen("modes");
  setTimeout(() => {
    if (currentScreen !== "modes") return;
    enterUnder(isl);
    openNmGoal(isl, report.k, report);
  }, 90);
}
/* A Maw beaten: once its report is closed, the next island down is dug open */
function nmDigPending() {
  const k = nmPendingDig;
  nmPendingDig = null;
  if (k && typeof deepDig === "function") setTimeout(() => deepDig(k), 250);
}

/* The first time the map shows after the last island's last boss: the ground gives way there */
(() => {
  const orig = window.renderModes;
  if (typeof orig !== "function") return;
  window.renderModes = function () {
    const r = orig.apply(this, arguments);
    if (camp && camp.nm && !camp.nm.open && nmUnlocked()) {
      camp.nm.open = true;
      saveCamp();
      setTimeout(() => { if (typeof deepDig === "function") deepDig(NM_ORDER[0]); }, 1200);
    }
    return r;
  };
})();

function nmRootsHtml(isl) {
  const R = NM_DATA.roots[isl], depth = nmDepth(isl) + 1;
  const rows = R.upgrades.map(u => {
    const tier = camp.nm.roots[u.id] || 0, max = u.v.length;
    const cost = tier < max ? u.cost[tier] * depth : 0;
    const can = tier < max && campWallet(isl) >= cost;
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < tier ? "on" : ""}"></i>`).join("");
    return `<div class="nm-row" title="${escapeAttr(u.text)}"><span class="nm-rname">${escapeAttr(u.name)}</span><span class="nm-pips">${pips}</span>
      ${tier < max ? `<button class="btn btn-small ${can ? "btn-gold" : ""}" data-nm="root" data-id="${u.id}" ${can ? "" : "disabled"}>${coinTag(isl, cost)}</button>` : `<span class="nm-max">${nmIco("crown", 2)}</span>`}</div>`;
  }).join("");
  return `<div class="nm-ph">${nmIco("tree", 3)}<b>${escapeAttr(R.name)}</b><button class="btn btn-small" data-nm="panel-x" aria-label="Close">✕</button></div>${rows}`;
}
function nmRootBuy(id) {
  const u = nmRootById(id), isl = nmIsl;
  if (!u || !NM_DATA.roots[isl].upgrades.includes(u)) return false;
  const tier = camp.nm.roots[id] || 0;
  if (tier >= u.v.length) return false;
  const cost = u.cost[tier] * (nmDepth(isl) + 1);
  if (campWallet(isl) < cost) { sfx("bad"); return false; }
  if (!campSpend(isl, cost)) return false;
  camp.nm.roots[id] = tier + 1;
  campBump("upgradesBought");
  saveCamp();
  sfx("shimmer");
  return true;
}

/* The deep's shop: every nightmare thing, in the rarities it's sold in, at nightmare prices */
const nmPrice = (isl, id, rarity) => Math.round(CAMP.families[campItemDef(id).family].price[rarityIdx(rarity)] * (NM_DATA.priceMult || 1) * (1 + 0.15 * nmDepth(isl)));
function nmShopHtml(isl) {
  const rows = (CAMP.nmItems || []).flatMap(d => (NM_DATA.sold || ["rare"]).map(r => {
    const p = nmPrice(isl, d.id, r), can = campWallet(isl) >= p;
    return `<div class="nm-row" title="${escapeAttr(d.does || "")}">${campItemIconHtml({ id: d.id, rarity: r, grade: -1 })}<span class="nm-rname" style="color:${rarityColor(r)}">${escapeAttr(d.name)}</span>
      <button class="btn btn-small ${can ? "btn-gold" : ""}" data-nm="buy" data-id="${d.id}" data-r="${r}" ${can ? "" : "disabled"}>${coinTag(isl, p)}</button></div>`;
  })).join("");
  return `<div class="nm-ph">${nmIco("chest", 3)}<b>${escapeAttr(NM_DATA.tunnels[isl].name)}</b><button class="btn btn-small" data-nm="panel-x" aria-label="Close">✕</button></div><div class="nm-list">${rows}</div>`;
}
function nmBuy(id, rarity) {
  const isl = nmIsl, d = campItemDef(id);
  if (!d || !d.nightmare || !nmShopOpen(isl) || !(NM_DATA.sold || []).includes(rarity)) return false;
  const p = nmPrice(isl, id, rarity);
  if (campWallet(isl) < p) { sfx("bad"); return false; }
  if (!campSpend(isl, p)) return false;
  campGive(id, rarity);
  campBump("itemsBought");
  campCheckAch();
  saveCamp();
  sfx("buy");
  showToast(`${rarityName(rarity)} ${d.name}: in your satchel.`);
  return true;
}

function nmClick(e) {
  if (e.target === nmEl) { closeNmPanel(); return; }
  const b = e.target.closest("[data-nm]");
  if (!b || b.disabled) return;
  const a = b.dataset.nm;
  if (a === "panel-x") { closeNmPanel(); return; }
  if (a === "root") nmRootBuy(b.dataset.id);
  else if (a === "buy") nmBuy(b.dataset.id, b.dataset.r);
  renderNmPanel();
}
