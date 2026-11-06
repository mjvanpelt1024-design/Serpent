/* =========================================================
   src/campaign/camp-hud.js
   The campaign's heads-up display: the hub around the board. Nothing is
   drawn on the board itself.

   Left, everything about you: your hearts and armor, the score and the
   pause button (the game's own HUD), then your purse (this island's money,
   gems, and what this run's points will pay), your kit and effects, and
   what you've found. Right, everything about the world: where you are,
   the quest (the level's goal), the challenge's trials, and the bounty on
   the next boss. A boss's own stats only show while you're fighting it.
   On a narrow screen both sides line up under the board.
   In the menus the top bar shows the island's money and your gems.
   ========================================================= */
"use strict";

const cpLeft = document.createElement("div");
const cpRight = document.createElement("div");
cpLeft.id = "cp-left";
cpRight.id = "cp-right";
cpLeft.className = cpRight.className = "cp-rail";
cpLeft.innerHTML = `
  <div class="plate cp-purse"><span class="cp-k">Purse</span><div class="cp-purse-row"></div><span class="cp-earn"></span></div>
  <div class="plate cp-kit"><span class="cp-k cp-head">Your kit</span><div class="cp-kit-rows"></div></div>
  <div class="plate cp-fx" hidden></div>
  <div class="plate cp-loot" hidden></div>`;
cpRight.innerHTML = `
  <div class="plate cp-where"><span class="cp-isl"></span><strong class="cp-lvl"></strong></div>
  <div class="plate cp-goal"><span class="cp-k cp-head">Quest</span><span class="cp-goal-t"></span><div class="cp-bar"><span></span></div><span class="cp-goal-n"></span></div>
  <div class="plate cp-extra" hidden></div>
  <div class="plate cp-trials" hidden></div>
  <div class="plate cp-bounty" hidden></div>
  <div class="plate cp-boss" hidden>
    <span class="cp-k cp-head">Boss</span>
    <span class="cp-boss-name"></span>
    <div class="cp-boss-hearts" role="img"></div>
    <span class="cp-k">Stamina</span>
    <div class="cp-bar cp-stam"><span></span></div>
    <span class="cp-boss-state"></span>
  </div>
  <div class="plate cp-point" hidden><span class="cp-k">This way</span><svg class="cp-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 9h-4v11H9V11H5z"/></svg><span class="cp-dist"></span></div>`;
cpLeft.hidden = cpRight.hidden = true;

/* The top bar in the menus: this island's money and your gems, instead of XP and Snakebucks */
const campWalletEl = document.createElement("div");
campWalletEl.id = "camp-wallet";
document.getElementById("hud-right").insertBefore(campWalletEl, document.getElementById("hud-right").firstChild);

function campWalletUpdate() {
  if (!camp) return;
  const key = campRun ? campRun.isl : currentScreen === "campshop" ? shopIsl : currentScreen === "tree" && treeArea === "camp" ? campTreeIsl : campIslandOpen(camp.at) ? camp.at : CAMP.islands[0].id;
  const cur = campCurrency(key);
  campWalletEl.innerHTML = `<span class="plate cw-chip" title="${escapeAttr(cur.plural)}, the money of ${escapeAttr(CAMP.islandById[key].name)}">${coinHtml(key)}<b>${fmtInt(campWallet(key))}</b></span>` +
    `<span class="plate cw-chip gems" title="Gems: shared by every island, for skins and themes"><img class="gem-ico" src="${iconUrl("gem", 2)}" alt=""><b>${fmtInt(camp.gems)}</b></span>`;
}

let campHudAt = 0;
function campHudBuild() {
  cpLeft.hidden = cpRight.hidden = false;
  const isl = CAMP.islandById[campRun.isl];
  cpRight.querySelector(".cp-isl").textContent = `${isl.name}${campRun.challenge >= 0 ? " · Challenge" : ""}`;
  cpRight.querySelector(".cp-lvl").textContent = `${campRun.def.n}. ${campRun.def.name}`;
  cpRight.querySelector(".cp-goal-t").textContent = goalText(campGoal);
  document.documentElement.style.setProperty("--isl", isl.colors.accent);
  if (typeof fxIslePlate === "function") document.documentElement.style.setProperty("--fx-isle", fxIslePlate(isl.colors.accent));
  cpRight.querySelector(".cp-bounty")._h = "";
  cpRight.querySelector(".cp-trials")._h = "";
  campHudPlace();
  campHudUpdate();
}

function campHudHide() {
  cpLeft.hidden = cpRight.hidden = true;
  campWalletUpdate();
}

/* Wide: you beside the hearts on the left, the world beside the toasts on the right.
   Narrow: both under the board. */
function campHudPlace() {
  const hud = document.getElementById("hud"), below = document.getElementById("below");
  const wide = document.body.classList.contains("wide");
  const leftHome = wide ? hud : below, rightHome = below;
  if (cpLeft.parentNode !== leftHome) leftHome.insertBefore(cpLeft, wide ? null : below.firstChild);
  if (cpRight.parentNode !== rightHome) rightHome.insertBefore(cpRight, wide ? below.firstChild : cpLeft.nextSibling);
  document.body.classList.toggle("cp-narrow", !wide);
}

function campHudTick(ts) {
  if (ts - campHudAt < 100) return;
  campHudAt = ts;
  campHudUpdate();
}

function pips(have, max) {
  if (max > 8) return `<span class="cp-count">${have} / ${max}</span>`;
  let s = "<span class='cp-pips'>";
  for (let i = 0; i < max; i++) s += `<i class="${i < have ? "on" : ""}"></i>`;
  return s + "</span>";
}
const setHtml = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };

/* ----- A boss's face for its wanted poster: a pixel snake head in its colors ----- */
const BOSS_FACE = [
  "....kkkkkk......",
  "...kbbbbbbkk....",
  "..kbBbbbbbbbk...",
  ".kbBbbbbbbbbbk..",
  ".kbbbbbbkkbbbbk.",
  "kbbbbbbkeekbbbbk",
  "kbbbbbbkekkbbbbk",
  "kbbbbbbbkkbbbbbk",
  "kbbbbbbbbbbbbbnk",
  "kBbbbbbbbbbbbbbk",
  ".kBbbbbbbbbbbkk.",
  ".kyyyyyyyyyyk...",
  "..kyywyywyyk....",
  "...kyyyyyyk.....",
  "....kkkkkk......",
  "................"
];
const bossFaceCache = {};
function bossFaceUrl(isl) {
  if (bossFaceCache[isl]) return bossFaceCache[isl];
  const B = CAMP.islandById[isl].boss;
  const pal = { k: "#1a1410", b: B.body, B: campShade(B.body, -0.3), y: B.belly, e: B.eye, w: "#f4f0e8", n: "#0a0608" };
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  BOSS_FACE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  // a scar for the bad ones
  g.fillStyle = campShade(B.body, 0.35); g.fillRect(4, 3, 1, 1); g.fillRect(5, 4, 1, 1); g.fillRect(6, 5, 1, 1);
  return (bossFaceCache[isl] = c.toDataURL());
}

/* The next boss on this island that you haven't beaten: { n, fight } or null */
function campNextBoss(isl) {
  for (let i = 0; i < BOSS_LEVELS.length; i++) if (!campWon(isl, BOSS_LEVELS[i])) return { n: BOSS_LEVELS[i], fight: i + 1 };
  return null;
}

function campHudUpdate() {
  campWalletUpdate();
  if (!campRun || cpLeft.hidden) return;
  const $ = s => cpLeft.querySelector(s) || cpRight.querySelector(s);
  const ts = gameState === "PLAYING" ? (paused ? pauseStartedAt : performance.now()) : frozenAt;
  const isl = campRun.isl, I = CAMP.islandById[isl];

  /* ---- Left: you ---- */
  // your purse, and what this run's points will pay when it ends, win or lose
  setHtml($(".cp-purse-row"), `<span class="cp-coin" title="${escapeAttr(I.currency.plural)}">${coinHtml(isl)}<b>${fmtInt(campWallet(isl))}</b></span><span class="cp-coin gems" title="Gems"><img class="gem-ico" src="${iconUrl("gem", 2)}" alt=""><b>${fmtInt(camp.gems)}</b></span>`);
  const earn = campPointsPay();
  $(".cp-earn").innerHTML = earn > 0 ? `This run: <b>+${fmtInt(earn)}</b> ${escapeAttr(earn === 1 ? I.currency.name : I.currency.plural)}` : `1 ${escapeAttr(I.currency.name)} per ${fmtInt(CAMP.rules.rewards.pointsPerCoin || 50)} points`;

  // your kit
  const bare = campBare();
  const row = (slot, it, sub, extraCls = "") => {
    const s = CAMP.slots.find(x => x.id === slot);
    if (!it) return `<div class="cp-slot empty"><span class="ci-icon"></span><span class="cp-sl"><span class="cp-k">${s.name}</span><span class="cp-sub">${bare ? "Bare scales" : "None"}</span></span></div>`;
    return `<div class="cp-slot ${extraCls}">${campItemIconHtml(it)}<span class="cp-sl"><span class="cp-k">${s.name}</span><span class="cp-name" style="color:${rarityColor(it.rarity)}">${escapeAttr(campItemDef(it.id).name)}</span><span class="cp-sub">${sub}</span></span></div>`;
  };
  const kit = [];
  const gear = bare ? null : campEquipped("gear");
  kit.push(row("gear", gear, gear ? pips(gear.uses, Math.max(gear.uses, freshUses(gear.id, gear.rarity))) : "", gear && ts - campRun.gearFx < 300 ? "flash" : ""));
  const spell = bare ? null : campEquipped("spell");
  const cd = spell ? Math.max(0, campRun.castReadyAt - ts) : 0;
  kit.push(row("spell", spell, spell ? `${pips(spell.uses, Math.max(spell.uses, freshUses(spell.id, spell.rarity)))} <kbd>${isTouchDevice() ? "Spell" : "Space"}</kbd>${cd > 0 ? " <span class='cp-cd'>...</span>" : ""}` : ""));
  const food = bare ? null : campEquipped("food");
  kit.push(row("food", food, food ? pips(food.uses, Math.max(food.uses, freshUses(food.id, food.rarity))) : ""));
  const pet = bare ? null : campEquipped("pet");
  let petSub = "";
  if (pet && campRun.pet) {
    if (pet.id === "turtle") petSub = campRun.pet.shells > 0 ? `Shell ready${campRun.pet.shells > 1 ? " x" + campRun.pet.shells : ""}` : `Recovering ${Math.ceil(Math.max(0, campRun.pet.readyAt - ts) / 1000)}s`;
    else petSub = "With you";
  }
  kit.push(row("pet", pet, petSub));
  if (campRun.rune) kit.push(`<div class="cp-slot">${campItemIconHtml(campRun.rune)}<span class="cp-sl"><span class="cp-k">Rune</span><span class="cp-name" style="color:${rarityColor(campRun.rune.rarity)}">${escapeAttr(campItemDef(campRun.rune.id).name)}</span><span class="cp-sub">${campRun.echoUsed ? "Echo spent" : "Burning"}</span></span></div>`);
  const can = campVessel();
  if (can || campEquipped("canister")) kit.push(row("canister", can, can ? campItemLeft(can) : ""));
  setHtml($(".cp-kit-rows"), kit.join(""));

  // effects: everything that used to be a bar along the bottom of the board
  const fxs = [];
  const chip = (label, color, until) => { if (ts < until) fxs.push(`<span class="cp-chip" style="--c:${color}">${label} ${Math.ceil((until - ts) / 1000)}</span>`); };
  chip("Force Field", "#7fe3ff", campRun.fieldUntil || 0);
  chip("Bubble", "#7fe3ff", buffs.shieldUntil || 0);
  chip("Rampage", "#ff77c8", buffs.starUntil || 0);
  chip("Phantom", "#b36bff", buffs.phantomUntil || 0);
  chip("Apple Call", "#ff5a61", buffs.lodeUntil || 0);
  chip("Frenzy 2x", "#3ddc84", buffs.frenzyUntil || 0);
  chip("Frozen", "#bfe8ff", buffs.freezeUntil || 0);
  chip("Zoom", "#ff8c1a", fx.fastUntil || 0);
  chip("Slow", "#c8862e", fx.slowUntil || 0);
  if (ts < graceUntil && gameState === "PLAYING") fxs.push(`<span class="cp-chip" style="--c:#ffd23f">Safe</span>`);
  const fxEl = $(".cp-fx");
  fxEl.innerHTML = fxs.length ? `<span class="cp-k">Effects</span><span class="cp-chips">${fxs.join("")}</span>` : "";
  fxEl.hidden = !fxs.length;
  const loot = $(".cp-loot");
  const found = campRun.loot.map(id => ({ id, rarity: "common" })).concat((campRun.canisters || []).map(rarity => ({ id: "canister", rarity })));
  loot.hidden = !found.length;
  setHtml(loot, found.length ? `<span class="cp-k">Found</span><span class="cp-chips">${found.map(it => campItemIconHtml(it, "small")).join("")}</span>` : "");

  /* ---- Right: the world ---- */
  // the quest
  const gp = goalProgress();
  $(".cp-goal .cp-bar span").style.width = (gp.f * 100).toFixed(1) + "%";
  $(".cp-goal .cp-bar").hidden = campGoal.type === "relic" || campGoal.type === "boss";
  $(".cp-goal-n").textContent = campGoal.type === "boss" ? "" : gp.text;
  // time, distance, the challenge's twists
  const extra = [];
  if (campGoal.type === "survive" || campRun.mods.includes("clock")) extra.push(`<span class="cp-k">Time</span><span class="cp-big">${Math.floor(runMs / 1000)}s${campRun.mods.includes("clock") ? " <small>/ 90s</small>" : ""}</span>`);
  if (endless) extra.push(`<span class="cp-k">Distance</span><span class="cp-big">${fmtInt(endlessDistance())} m</span>`);
  if (campRun.mods.length) extra.push(`<span class="cp-k">Twists</span><span class="cp-mods">${campRun.mods.map(m => `<span>${escapeAttr((CAMP.rules.challenge.mods.find(x => x.id === m) || { name: m }).name)}</span>`).join("")}</span>`);
  const ex = $(".cp-extra");
  setHtml(ex, extra.join(""));
  ex.hidden = !extra.length;

  // the challenge's three trials, while one is on
  const C = camp.challenges[isl];
  const trialsEl = $(".cp-trials");
  const trialsOn = !!(C && C.active && !C.claimed && C.levels.length);
  trialsEl.hidden = !trialsOn;
  if (trialsOn) {
    const left = Math.max(0, C.endsAt - Date.now());
    setHtml(trialsEl, `<span class="cp-k cp-head">Challenge</span>` + C.levels.map((n, i) => `<div class="cp-trial${C.done[i] ? " done" : ""}${campRun.challenge === i ? " now" : ""}"><span class="cp-tick">${C.done[i] ? "&#10003;" : i + 1}</span><span>${n}. ${escapeAttr(campLevelDef(isl, n).name)}</span></div>`).join("") +
      `<span class="cp-sub">${C.done.every(Boolean) ? "All done: claim your prize" : `Ends in ${fmtLeft(left)}`}</span>`);
  }

  // the bounty on the next boss: just its name and where it waits, until you face it
  const next = campNextBoss(isl);
  const bounty = $(".cp-bounty");
  bounty.hidden = !!boss || !next;
  if (!boss && next) {
    const pay = campRewardPreview(isl, next.n, true);
    setHtml(bounty, `<span class="cp-wanted">Bounty</span>
      <img class="cp-face" src="${bossFaceUrl(isl)}" alt="">
      <strong class="cp-bname">${escapeAttr(I.boss.name)}</strong>
      <span class="cp-sub">Waits at level ${next.n}${next.fight === 3 ? ": its last stand" : `, fight ${next.fight} of 3`}</span>
      <span class="cp-reward">${coinHtml(isl)}<b>${fmtInt(pay)}</b> reward</span>`);
  }

  // the boss itself, only while you fight it: hearts (silver while armored), stamina, its mood
  const bp = $(".cp-boss");
  bp.hidden = !boss;
  if (boss) {
    $(".cp-boss-name").textContent = boss.def.name;
    const P = CAMP.rules.snake.armorPieces || 4;
    let h = "";
    if (boss.fight === 3) for (let i = 0; i < boss.maxHearts; i++) h += heartSlotHtml({ heart: i < boss.hearts ? 2 : 0 });
    else {
      for (let i = 0; i < boss.maxArmor; i++) h += heartSlotHtml({ armor: i < boss.armor ? P : 0 });
      for (let i = boss.maxArmor; i < boss.maxHearts; i++) h += heartSlotHtml({ heart: 2 }, "dim");
    }
    const hearts = $(".cp-boss-hearts");
    setHtml(hearts, h);
    hearts.setAttribute("aria-label", boss.fight === 3 ? `${boss.hearts} of ${boss.maxHearts} hearts` : `${boss.armor} of ${boss.maxArmor} armored hearts`);
    const st = $(".cp-stam");
    st.querySelector("span").style.width = (Math.max(0, boss.stamina) * 100).toFixed(1) + "%";
    const tired = bossExhausted(ts), charging = bossCharging(ts);
    st.classList.toggle("tired", tired);
    st.classList.toggle("charge", charging);
    $(".cp-boss-state").textContent = boss.beaten ? "Beaten!" : tired ? "Exhausted: bite it!" : charging ? "Charging!" : ts < boss.frozenUntil ? "Frozen" : boss.fight === 1 ? "Keep away until it tires" : "Wear it out";
  }

  // the pointer to whatever the quest wants you to find
  const tgt = ["keys", "buttons", "relic", "shards", "thief"].includes(campGoal.type) ? goalTarget() : null;
  $(".cp-point").hidden = !tgt;
  if (tgt) {
    const ang = Math.atan2(tgt.dy, tgt.dx) * 180 / Math.PI + 90;
    $(".cp-arrow").style.transform = `rotate(${ang.toFixed(0)}deg)`;
    $(".cp-dist").textContent = `${tgt.dist} squares`;
  }
}

/* The game's own hearts show the level's hearts and armor; the score plate shows the level's best */
(() => {
  const hearts = renderHearts;
  window.renderHearts = function () {
    if (!campRun) return hearts.apply(this, arguments);
    const v = campVessel();
    const key = ["c", campRun.startHearts, currentHearts, campRun.armor, campRun.armorMax, v ? v.uid + "/" + v.uses : ""].join(":");
    if (key === lastHeartsKey) return;
    lastHeartsKey = key;
    heartsEl.innerHTML = campHeartsHtml();
    heartsEl.setAttribute("aria-label", campHeartsLabel());
  };
  const hud = updateHud;
  window.updateHud = function () {
    hud.apply(this, arguments);
    if (campRun && hudScoreEl.innerHTML) {
      const rec = camp.levels[campLevelId(campRun.isl, campRun.n)];
      const best = hudScoreEl.querySelector(".best");
      if (best) best.textContent = rec && rec.best ? `Best ${fmtInt(rec.best)}` : "First try";
    }
    campHudUpdate();
  };
})();
window.addEventListener("resize", () => requestAnimationFrame(campHudPlace));
