/* =========================================================
   src/campaign/camp-nightmare.js
   Nightmare mode (build 53). All numbers: content/campaign/nightmare.json.

   Win the last island's last level and the Maw's body (the Coil the islands
   sit on) opens up. Under each island, from the top down, a tunnel:
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
  closeNmTunnels(true);
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
    openNmTunnels(isl, report);
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
   The tunnel screen: the scroll with the tunnel's name, the tunnels down
   the left (a skull each), and the shaft: the roots at the top, ten levels
   winding down, the shop off to the side after level 5, the Maw at the
   bottom. No words but the scroll; point at anything for its name.
   ========================================================= */
let nmEl = null, nmIsl = null, nmPanel = null, nmReport = null;

function openNmTunnels(isl = null, report = null) {
  if (!camp || !nmUnlocked()) return;
  camp.nm.open = true;
  nmIsl = isl && nmTunnelOpen(isl) ? isl : nmCurrentTunnel();
  nmReport = report;
  nmPanel = null;
  if (!nmEl) {
    nmEl = document.createElement("div");
    nmEl.id = "nightmare";
    nmEl.setAttribute("role", "dialog");
    nmEl.setAttribute("aria-modal", "true");
    nmEl.setAttribute("aria-label", "Nightmare");
    document.body.appendChild(nmEl);
    nmEl.addEventListener("click", nmClick);
    document.addEventListener("keydown", e => {
      if (!nmEl || !nmEl.classList.contains("active") || e.key !== "Escape") return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (nmReport || nmPanel) { nmReport = null; nmPanel = null; renderNightmare(); } else closeNmTunnels();
    }, true);
  }
  nmEl.classList.add("active");
  document.body.classList.add("nm-open");
  renderNightmare();
  campWalletUpdate();
}

function closeNmTunnels(toLevel = false) {
  if (!nmEl) return;
  nmEl.classList.remove("active");
  document.body.classList.remove("nm-open");
  if (!toLevel && currentScreen !== "modes") openScreen("modes");
}

const nmIco = (id, s = 3) => `<img class="nm-ico" src="${iconUrl(id, s)}" alt="">`;
function renderNightmare() {
  const isl = nmIsl, T = NM_DATA.tunnels[isl], I = CAMP.islandById[isl];
  const rail = NM_ORDER.map(id => {
    const open = nmTunnelOpen(id), slain = nmMawSlain(id);
    return `<button class="nm-tun${id === isl ? " here" : ""}${slain ? " slain" : ""}" data-nm="tunnel" data-isl="${id}" ${open ? "" : "disabled"} title="${escapeAttr(open ? `${NM_DATA.tunnels[id].name}, under ${CAMP.islandById[id].name}${slain ? " (the Maw beaten)" : ""}` : "Sealed")}">${nmIco("skull", 2)}</button>`;
  }).join("");
  // the shaft: winding left and right, top to bottom
  const node = (k, x, y) => {
    const open = nmTunLevelOpen(isl, k), won = nmLevelWon(isl, k), maw = k === NM_MAW;
    const name = maw ? (nmMawSlain(isl) ? "The Maw (beaten)" : "The Maw") : T.names[k - 1];
    return `<button class="nm-node${maw ? " maw" : ""}${won ? " won" : ""}${open ? "" : " locked"}" style="--x:${x}%;--y:${y}%" data-nm="play" data-k="${k}" ${open ? "" : "disabled"} title="${escapeAttr(open ? name : "Not yet")}">${maw ? nmIco("skull", 3) : `<b>${k}</b>`}</button>`;
  };
  let nodes = `<button class="nm-node roots" style="--x:50%;--y:4%" data-nm="roots" title="${escapeAttr(NM_DATA.roots[isl].name)}">${nmIco("tree", 2)}</button>`;
  for (let k = 1; k <= NM_LEVELS; k++) nodes += node(k, k % 2 ? 30 + (k % 4 === 1 ? 0 : 8) : 70 - (k % 4 === 0 ? 8 : 0), 4 + k * 8.2);
  nodes += node(NM_MAW, 50, 96);
  const shop = nmShopOpen(isl);
  nodes += `<button class="nm-node shop${shop ? "" : " locked"}" style="--x:88%;--y:${4 + 5.5 * 8.2}%" data-nm="shop" ${shop ? "" : "disabled"} title="${escapeAttr(shop ? "A shop of the deep" : "Opens after level " + (NM_DATA.shopAfter || 5))}">${nmIco("chest", 2)}</button>`;
  const path = Array.from({ length: NM_LEVELS + 1 }, (_, i) => i).map(i => {
    const k = i + 1;
    const x = k === NM_MAW ? 50 : (k % 2 ? 30 + (k % 4 === 1 ? 0 : 8) : 70 - (k % 4 === 0 ? 8 : 0)), y = k === NM_MAW ? 96 : 4 + k * 8.2;
    return `${x},${y}`;
  });
  const lit = Array.from({ length: NM_MAW }, (_, i) => i + 1).filter(k => nmLevelWon(isl, k)).length;
  nmEl.innerHTML = `<div class="nm-scroll" title="${escapeAttr(`Under ${I.name}`)}">${escapeAttr(T.name)}</div>
    <button class="nm-x btn btn-small" data-nm="close" aria-label="Back to the map" title="Back to the map">✕</button>
    <div class="nm-rail">${rail}</div>
    <div class="nm-shaft${nmMawSlain(isl) ? " slain" : ""}">
      <svg class="nm-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="50,4 ${path.join(" ")}" class="nm-line"/>
        <polyline points="50,4 ${path.slice(0, lit + 1).join(" ")}" class="nm-line lit"/>
      </svg>
      ${nodes}
    </div>
    ${nmPanel ? `<div class="nm-panel plate">${nmPanel === "roots" ? nmRootsHtml(isl) : nmShopHtml(isl)}</div>` : ""}
    ${nmReport ? nmReportHtml(nmReport) : ""}`;
}

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

function nmReportHtml(r) {
  const nextOpen = r.won && r.k < NM_MAW && nmTunLevelOpen(r.isl, r.k + 1);
  return `<div class="nm-report plate${r.won ? " won" : ""}">
    <h3>${escapeAttr(r.title)}</h3>
    <p class="nm-rk">${escapeAttr(r.name)} · ${fmtInt(r.score)}</p>
    ${r.line ? `<p class="nm-rline">${escapeAttr(r.line)}</p>` : ""}
    ${r.lines.map(l => `<p class="nm-rl">${l}</p>`).join("")}${r.notes.map(l => `<p class="nm-rl new">${escapeAttr(l)}</p>`).join("")}
    <div class="row-buttons"><button class="btn" data-nm="again">${r.won ? "Again" : "Try again"}</button>${nextOpen ? `<button class="btn btn-primary" data-nm="next">Next</button>` : ""}<button class="btn" data-nm="report-x">OK</button></div>
  </div>`;
}

function nmClick(e) {
  const b = e.target.closest("[data-nm]");
  if (!b || b.disabled) return;
  const a = b.dataset.nm;
  if (a === "close") { closeNmTunnels(); return; }
  if (a === "tunnel") { nmIsl = b.dataset.isl; nmPanel = null; nmReport = null; sfx("click"); }
  else if (a === "play") { nmStart(nmIsl, +b.dataset.k); return; }
  else if (a === "roots" || a === "shop") { nmPanel = nmPanel === a ? null : a; sfx("click"); }
  else if (a === "panel-x") nmPanel = null;
  else if (a === "root") nmRootBuy(b.dataset.id);
  else if (a === "buy") nmBuy(b.dataset.id, b.dataset.r);
  else if (a === "again") { const r = nmReport; nmReport = null; nmStart(r.isl, r.k); return; }
  else if (a === "next") { const r = nmReport; nmReport = null; nmStart(r.isl, r.k + 1); return; }
  else if (a === "report-x") nmReport = null;
  renderNightmare();
  campWalletUpdate();
}
