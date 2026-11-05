/* =========================================================
   src/campaign/camp-hud.js
   The campaign's heads-up display. Nothing is drawn on the board: the
   game's own HUD keeps the hearts, armor, score and pause button, and
   plates in the same style hold the rest. On a wide screen the level's
   plates (where, goal, boss) sit in the left rail under the hearts and
   your kit (gear, spell, snack, familiar, rune, effects, the pointer)
   in the right rail; on a narrow one they line up under the board.
   In the menus the top bar shows the island's money and your gems.
   ========================================================= */
"use strict";

const cpLeft = document.createElement("div");
const cpRight = document.createElement("div");
cpLeft.id = "cp-left";
cpRight.id = "cp-right";
cpLeft.className = cpRight.className = "cp-rail";
cpLeft.innerHTML = `
  <div class="plate cp-where"><span class="cp-isl"></span><strong class="cp-lvl"></strong></div>
  <div class="plate cp-goal"><span class="cp-k">Goal</span><span class="cp-goal-t"></span><div class="cp-bar"><span></span></div><span class="cp-goal-n"></span></div>
  <div class="plate cp-boss" hidden>
    <span class="cp-k cp-boss-name"></span>
    <div class="cp-boss-hearts" role="img"></div>
    <span class="cp-k">Stamina</span>
    <div class="cp-bar cp-stam"><span></span></div>
    <span class="cp-boss-state"></span>
  </div>
  <div class="plate cp-extra" hidden></div>`;
cpRight.innerHTML = `
  <div class="plate cp-kit"></div>
  <div class="plate cp-fx" hidden></div>
  <div class="plate cp-point" hidden><span class="cp-k">This way</span><svg class="cp-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 9h-4v11H9V11H5z"/></svg><span class="cp-dist"></span></div>
  <div class="plate cp-loot" hidden></div>`;
cpLeft.hidden = cpRight.hidden = true;

/* The top bar in the menus: this island's money and your gems, instead of XP and Snakebucks */
const campWalletEl = document.createElement("div");
campWalletEl.id = "camp-wallet";
document.getElementById("hud-right").insertBefore(campWalletEl, document.getElementById("hud-right").firstChild);

function campWalletUpdate() {
  if (!camp) return;
  const key = campRun ? campRun.isl : campIslandOpen(camp.at) ? camp.at : CAMP.islands[0].id;
  const cur = campCurrency(key);
  campWalletEl.innerHTML = `<span class="plate cw-chip" title="${escapeAttr(cur.plural)}, the money of ${escapeAttr(CAMP.islandById[key].name)}">${coinHtml(key)}<b>${fmtInt(campWallet(key))}</b></span>` +
    `<span class="plate cw-chip gems" title="Gems: shared by every island, for skins and themes"><img class="gem-ico" src="${iconUrl("gem", 2)}" alt=""><b>${fmtInt(camp.gems)}</b></span>`;
}

let campHudAt = 0;
function campHudBuild() {
  cpLeft.hidden = cpRight.hidden = false;
  const isl = CAMP.islandById[campRun.isl];
  cpLeft.querySelector(".cp-isl").textContent = `${isl.name}${campRun.challenge >= 0 ? " · Challenge" : ""}`;
  cpLeft.querySelector(".cp-lvl").textContent = `${campRun.def.n}. ${campRun.def.name}`;
  cpLeft.querySelector(".cp-goal-t").textContent = goalText(campGoal);
  document.documentElement.style.setProperty("--isl", isl.colors.accent);
  campHudPlace();
  campHudUpdate();
}

function campHudHide() {
  cpLeft.hidden = cpRight.hidden = true;
  campWalletUpdate();
}

/* Wide: the level beside the hearts, the kit beside the toasts. Narrow: both under the board. */
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

function heartRow(n, max, cls = "") {
  const svg = c => `<svg class="heart ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_SVG_PATH}"/></svg>`;
  const full = Math.floor(n + 1e-9), half = n - full > 0.25;
  let h = "";
  for (let i = 0; i < full; i++) h += svg("full " + cls);
  if (half) h += svg("half");
  for (let i = full + (half ? 1 : 0); i < max; i++) h += svg("empty");
  return h;
}

function pips(have, max) {
  if (max > 8) return `<span class="cp-count">${have} / ${max}</span>`;
  let s = "<span class='cp-pips'>";
  for (let i = 0; i < max; i++) s += `<i class="${i < have ? "on" : ""}"></i>`;
  return s + "</span>";
}

function campHudUpdate() {
  campWalletUpdate();
  if (!campRun || cpLeft.hidden) return;
  const $ = s => cpLeft.querySelector(s) || cpRight.querySelector(s);
  const ts = gameState === "PLAYING" ? (paused ? pauseStartedAt : performance.now()) : frozenAt;
  // the goal
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
  ex.innerHTML = extra.join("");
  ex.hidden = !extra.length;
  // the boss: hearts (silver while armored), stamina, and what it's up to
  const bp = $(".cp-boss");
  bp.hidden = !boss;
  if (boss) {
    $(".cp-boss-name").textContent = boss.def.name;
    const svg = c => `<svg class="heart ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_SVG_PATH}"/></svg>`;
    let h = "";
    if (boss.fight === 3) for (let i = 0; i < boss.maxHearts; i++) h += svg(i < boss.hearts ? "full" : "empty");
    else {
      for (let i = 0; i < boss.maxArmor; i++) h += svg(i < boss.armor ? "silver" : "empty");
      for (let i = boss.maxArmor; i < boss.maxHearts; i++) h += svg("full dim");
    }
    const hearts = $(".cp-boss-hearts");
    if (hearts.innerHTML !== h) hearts.innerHTML = h;
    hearts.setAttribute("aria-label", boss.fight === 3 ? `${boss.hearts} of ${boss.maxHearts} hearts` : `${boss.armor} of ${boss.maxArmor} armored hearts`);
    const st = $(".cp-stam");
    st.querySelector("span").style.width = (Math.max(0, boss.stamina) * 100).toFixed(1) + "%";
    const tired = bossExhausted(ts), charging = bossCharging(ts);
    st.classList.toggle("tired", tired);
    st.classList.toggle("charge", charging);
    $(".cp-boss-state").textContent = boss.beaten ? "Beaten!" : tired ? "Exhausted: bite it!" : charging ? "Charging!" : ts < boss.frozenUntil ? "Frozen" : boss.fight === 1 ? "Keep away until it tires" : "Wear it out";
  }
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
  const kitHtml = kit.join("");
  if ($(".cp-kit")._h !== kitHtml) { $(".cp-kit").innerHTML = kitHtml; $(".cp-kit")._h = kitHtml; }
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
  // the pointer to whatever the goal wants you to find
  const tgt = ["keys", "buttons", "relic", "shards", "thief"].includes(campGoal.type) ? goalTarget() : null;
  $(".cp-point").hidden = !tgt;
  if (tgt) {
    const ang = Math.atan2(tgt.dy, tgt.dx) * 180 / Math.PI + 90;
    $(".cp-arrow").style.transform = `rotate(${ang.toFixed(0)}deg)`;
    $(".cp-dist").textContent = `${tgt.dist} squares`;
  }
  const loot = $(".cp-loot");
  loot.hidden = !campRun.loot.length;
  loot.innerHTML = campRun.loot.length ? `<span class="cp-k">Found</span><span class="cp-chips">${campRun.loot.map(id => campItemIconHtml({ id, rarity: "common" }, "small")).join("")}</span>` : "";
}

/* The game's own hearts show the level's hearts; the score plate shows the level's best */
(() => {
  const hearts = renderHearts;
  window.renderHearts = function () {
    if (!campRun) return hearts.apply(this, arguments);
    const max = Math.max(campRun.startHearts || 1, Math.ceil(currentHearts - 1e-9));
    const shown = currentHearts, armor = currentArmor;
    const key = "c" + max + ":" + shown + ":" + armor;
    if (key === lastHeartsKey) return;
    lastHeartsKey = key;
    let html = heartRow(shown, max);
    for (let i = 0; i < armor; i++) html += `<svg class="heart armor" viewBox="0 0 24 24" aria-hidden="true"><path d="${ARMOR_SVG_PATH}"/></svg>`;
    heartsEl.innerHTML = html;
    heartsEl.setAttribute("aria-label", `${shown} of ${max} hearts${armor ? `, and ${armor} armor plate${armor === 1 ? "" : "s"}` : ""}`);
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
