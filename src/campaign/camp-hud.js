/* =========================================================
   src/campaign/camp-hud.js
   The campaign's heads-up display: the hub around the board. Nothing is
   drawn on the board itself.

   Left, everything about you: your hearts and armor with your rune under
   them, the score and the pause button (the game's own HUD), then your
   purse (this island's money, gems, and what this run's points will pay),
   your kit (gear, spell), the pocket of snacks on keys 1 to 4, your familiar, effects, and
   what you've found. Right, everything about the world: where you are,
   the objective (the level's goal), your quest (or none), the level's
   bonus challenge, and the bounty on the next boss. A boss's own stats
   only show while you're fighting it.
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
  <div class="plate cp-pocket"><span class="cp-k cp-head">Pocket</span><div class="cp-pocket-row"></div></div>
  <div class="plate cp-pet"></div>
  <div class="plate cp-fx" hidden></div>
  <div class="plate cp-loot" hidden></div>`;
cpRight.innerHTML = `
  <div class="plate cp-where"><span class="cp-isl"></span><strong class="cp-lvl"></strong></div>
  <div class="plate cp-goal"><span class="cp-k cp-head">Objective</span><span class="cp-goal-t"></span><div class="cp-bar"><span></span></div><span class="cp-goal-n"></span></div>
  <div class="plate cp-extra" hidden></div>
  <div class="plate cp-trials"></div>
  <div class="plate cp-bonus"></div>
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
cpLeft.addEventListener("click", e => { const b = e.target.closest("[data-pocket]"); if (b) campEatSnack(+b.dataset.pocket); });

/* The top bar in the menus: every island's money and your gems, instead of XP and Snakebucks.
   Every island's money is always there (build 53), at 0 too, in a line beside the gems. The island you're on
   (or the shop you're in) is lit. Click a coin for its card (coins.js). */
const campWalletEl = document.createElement("div");
campWalletEl.id = "camp-wallet";
document.getElementById("hud-right").insertBefore(campWalletEl, document.getElementById("hud-right").firstChild);

function campWalletUpdate() {
  if (!camp) return;
  const key = campRun ? campRun.isl : currentScreen === "campshop" ? shopIsl : currentScreen === "tree" && treeArea === "camp" ? campTreeIsl : campIslandOpen(camp.at) ? camp.at : CAMP.islands[0].id;
  if (typeof coinCard !== "undefined" && coinCard) return;
  // no plates: the coin itself, big enough to show its carving, and the gem, each with its count in the corner
  // build 53 (the user's call): every island's money is always there, in a line beside the gems, even at 0
  const html = CAMP.islands.map(I =>
    `<span class="cw-chip${I.id === key ? " here" : ""}" title="${escapeAttr(I.currency.plural)}, the money of ${escapeAttr(I.name)}">${coinHtml(I.id, 20)}<b>${fmtInt(campWallet(I.id))}</b></span>`).join("") +
    // the gems open the gem shop (camp-gemshop.js); they glint while its daily gift waits
    `<span class="cw-chip gems${typeof gemDailyReady === "function" && gemDailyReady() ? " gift" : ""}" role="button" tabindex="0" title="Gems: the gem shop${typeof gemDailyReady === "function" && !gemDailyReady() ? ` (next free gift in ${fmtLeft(gemDailyLeft())})` : ""}"><img class="gem-ico" src="${iconUrl("gem", 3)}" alt=""><b>${fmtInt(camp.gems)}</b>${typeof gemDailyReady === "function" && !gemDailyReady() ? `<small class="gift-clock">${fmtLeft(gemDailyLeft())}</small>` : ""}</span>`;
  if (campWalletEl._h !== html) { campWalletEl.innerHTML = html; campWalletEl._h = html; }
}

// whatever is bought or sold, the top bar follows within a blink (it only redraws when the numbers change)
setInterval(() => { if (camp && !campRun) campWalletUpdate(); }, 250);

let campHudAt = 0;
function campHudBuild() {
  cpLeft.hidden = cpRight.hidden = false;
  const isl = CAMP.islandById[campRun.isl];
  cpRight.querySelector(".cp-isl").textContent = `${isl.name}${campRun.challenge >= 0 ? " · Quest" : ""}`;
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

/* ----- A boss's face for its wanted poster: a pixel snake head in its colors, with a scar -----
   16 x 16 PNGs in textures/bosses/<island>.png */
const bossFaceUrl = isl => texUrl("boss:" + isl);

/* Your quest: the challenger's trials (3 to 5), wherever one is on. `here` marks the trial being played. */
function campActiveQuest() {
  const isl = CAMP.islands.map(i => i.id).find(id => { const C = camp.challenges[id]; return C && C.active && !C.claimed && C.levels.length && Date.now() < C.endsAt; });
  return isl ? { isl, C: camp.challenges[isl] } : null;
}
function campQuestHtml(here) {
  const q = campActiveQuest();
  if (!q) return `<span class="cp-k cp-head">Quest</span><span class="cp-sub cp-none">None. The challengers hand them out.</span>`;
  const { isl, C } = q;
  return `<span class="cp-k cp-head">Quest</span><span class="cp-qfrom">${escapeAttr(CAMP.islandById[isl].npcs.challenger.name)}, ${escapeAttr(CAMP.islandById[isl].name)}</span>` +
    C.levels.map((n, i) => `<div class="cp-trial${C.done[i] ? " done" : ""}${here === isl && campRun && campRun.challenge === i ? " now" : ""}"><span class="cp-tick">${C.done[i] ? "&#10003;" : i + 1}</span><span>${n}. ${escapeAttr(campLevelDef(isl, n).name)}</span></div>`).join("") +
    `<span class="cp-sub">${C.done.every(Boolean) ? "All done: claim your prize" : `Ends in ${fmtLeft(Math.max(0, C.endsAt - Date.now()))}`}</span>`;
}

/* The level's bonus challenge: what it asks, how it's going, what it pays */
function campBonusHtml() {
  const b = campRun && campRun.bonus;
  if (!b) return `<span class="cp-k cp-head">Challenge</span><span class="cp-sub cp-none">None on this level</span>`;
  const { isl } = campRun;
  let how = "";
  if (b.done) how = `<span class="cp-bdone">&#10003; Done!</span>`;
  else if (b.type === "fast") { const s = Math.floor(runMs / 1000); how = `<span class="${s > b.need ? "cp-late" : ""}">${s}s / ${b.need}s</span>`; }
  else if (b.type === "untouched") how = campRun.hitTaken ? `<span class="cp-late">You took a hit</span>` : "Not a scratch so far";
  else if (b.type === "streak") how = `${b.times.length} / ${b.need} in a row`;
  else how = `${fmtInt(Math.min(b.have, b.need))} / ${fmtInt(b.need)}`;
  const pay = b.before ? "Reward earned before" : `${b.done ? "Earned" : "Reward"}: ${escapeAttr(bonusRewardText(isl, b))}`;
  return `<span class="cp-k cp-head">Challenge</span><span class="cp-btext">${escapeAttr(bonusText(b))}</span>` +
    (b.need && !b.done && !["fast", "untouched"].includes(b.type) ? `<div class="cp-bar cp-bbar"><span style="width:${Math.min(100, (b.type === "streak" ? b.times.length : b.have) / b.need * 100).toFixed(1)}%"></span></div>` : "") +
    `<span class="cp-sub">${how}</span><span class="cp-reward">${pay}</span>`;
}

/* The wanted poster for an island's next boss, or "" once all three fights are won */
function campBountyHtml(isl) {
  const next = campNextBoss(isl);
  if (!next) return "";
  const I = CAMP.islandById[isl];
  return `<span class="cp-wanted">Bounty</span>
      <img class="cp-face" src="${bossFaceUrl(isl)}" alt="">
      <strong class="cp-bname">${escapeAttr(I.boss.name)}</strong>
      <span class="cp-sub">Waits at level ${next.n}${next.fight === 3 ? ": its last stand" : `, fight ${next.fight} of 3`}</span>
      <span class="cp-reward">${coinHtml(isl)}<b>${fmtInt(campRewardPreview(isl, next.n, true))}</b> reward</span>`;
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
  kit.push(row("gear", gear, gear ? pips(gear.uses, Math.max(gear.uses, freshUses(gear.id, gear.rarity, gear))) : "", gear && ts - campRun.gearFx < 300 ? "flash" : ""));
  // armor (build 52): only shown when worn, with its set when the whole set is on
  ["helmet", "body"].forEach(sl => { const a = bare ? null : campEquipped(sl); if (a) { const set = wornSet(); kit.push(row(sl, a, set ? `${escapeAttr(set.name)} set` : `${itemStatLines(a.id, a.rarity).length} stat${itemStatLines(a.id, a.rarity).length === 1 ? "" : "s"}`)); } });
  const spell = bare ? null : campEquipped("spell");
  const cd = spell ? Math.max(0, campRun.castReadyAt - ts) : 0;
  kit.push(row("spell", spell, spell ? `${pips(spell.uses, Math.max(spell.uses, freshUses(spell.id, spell.rarity, spell)))} <kbd>${isTouchDevice() ? "Spell" : "Space"}</kbd>${campRun.freeCasts > 0 ? ` <span class="cp-free">+${campRun.freeCasts} free</span>` : ""}${cd > 0 ? " <span class='cp-cd'>...</span>" : ""}` : ""));
  setHtml($(".cp-kit-rows"), kit.join(""));

  // the pocket: four snacks on keys 1 to 4 (tap one on a touch screen)
  const key = i => (isTouchDevice() ? "" : `<kbd>${i + 1}</kbd>`);
  setHtml($(".cp-pocket-row"), [0, 1, 2, 3].map(i => {
    const it = bare ? null : pocketItem(i);
    if (!it) return `<button class="cp-snack empty" data-pocket="${i}" aria-label="Pocket slot ${i + 1}: empty"><span class="ci-icon small"></span>${key(i)}</button>`;
    const full = Math.max(it.uses, freshUses(it.id, it.rarity, it));
    return `<button class="cp-snack" data-pocket="${i}" title="${escapeAttr(campItemName(it))}: ${escapeAttr(campItemDef(it.id).does)}" aria-label="Eat ${escapeAttr(campItemName(it))}, ${it.uses} left">${campItemIconHtml(it, "small")}${key(i)}<span class="cp-left">${it.uses}${full > 1 ? `/${full}` : ""}</span></button>`;
  }).join("") + (campRun.phoenix ? `<span class="cp-chip cp-phoenix" style="--c:#ff8a3d">Phoenix</span>` : ""));

  // the familiar, trotting along
  const pet = bare ? null : campEquipped("pet");
  let petSub = "";
  if (pet && campRun.pet) {
    if (pet.id === "turtle") petSub = campRun.pet.shells > 0 ? `Shell ready${campRun.pet.shells > 1 ? " x" + campRun.pet.shells : ""}` : `Recovering ${Math.ceil(Math.max(0, campRun.pet.readyAt - ts) / 1000)}s`;
    else petSub = "With you";
  }
  setHtml($(".cp-pet"), pet
    ? `${campItemIconHtml(pet, "small")}<span class="cp-sl"><span class="cp-k">Familiar</span><span class="cp-name" style="color:${rarityColor(pet.rarity)}">${escapeAttr(campItemDef(pet.id).name)}</span><span class="cp-sub">${petSub}</span></span>`
    : `<span class="ci-icon small"></span><span class="cp-sl"><span class="cp-k">Familiar</span><span class="cp-sub">${bare ? "Bare scales" : "No familiar"}</span></span>`);

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
  // power-ups that grant a resistance or an immunity (build 52), one chip per power-up
  const seenG = new Set();
  (campRun.grants || []).forEach(g => { if (ts < g.until && !seenG.has(g.label)) { seenG.add(g.label); chip(g.label, g.color || "#ffffff", g.until); } });
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
  $(".cp-goal-n").textContent = campGoal.type === "boss" ? (typeof bossObjLine === "function" ? bossObjLine(ts) : "") : gp.text;
  // time, distance, the challenge's twists
  const extra = [];
  if (campGoal.type === "survive" || campRun.mods.includes("clock")) extra.push(`<span class="cp-k">Time</span><span class="cp-big">${Math.floor(runMs / 1000)}s${campRun.mods.includes("clock") ? " <small>/ 90s</small>" : ""}</span>`);
  if (endless) extra.push(`<span class="cp-k">Distance</span><span class="cp-big">${fmtInt(endlessDistance())} m</span>`);
  if (campRun.mods.length) extra.push(`<span class="cp-k">Twists</span><span class="cp-mods">${campRun.mods.map(m => `<span>${escapeAttr((CAMP.rules.challenge.mods.find(x => x.id === m) || { name: m }).name)}</span>`).join("")}</span>`);
  const ex = $(".cp-extra");
  setHtml(ex, extra.join(""));
  ex.hidden = !extra.length;

  // no quest on, no challenge on this level: no plate saying so (build 53 review: fewer words)
  setHtml($(".cp-trials"), campQuestHtml(campRun.challenge >= 0 ? isl : null));
  $(".cp-trials").hidden = !campActiveQuest();
  setHtml($(".cp-bonus"), campBonusHtml());
  $(".cp-bonus").hidden = !campRun.bonus;

  // the bounty on the next boss: just its name and where it waits, until you face it
  const bounty = $(".cp-bounty");
  const bountyHtml = boss ? "" : campBountyHtml(isl);
  bounty.hidden = !bountyHtml;
  if (bountyHtml) setHtml(bounty, bountyHtml);

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
    const st2 = boss.beaten ? "Beaten!" : ts < (boss.hardenUntil || 0) ? "Stone: nothing lands" : ts < (boss.phaseUntil || 0) ? "Mist: it passes through you" : tired ? "Exhausted: bite it!" : charging ? "Charging! Let it crash into you" : ts < boss.frozenUntil ? "Frozen" : ts < (boss.poisonUntil || 0) ? "Poisoned: tiring fast" : (typeof bossObjLine === "function" && bossObjLine(ts)) || "Dodge its head, let it ram you";
    const res = boss.resist.length ? `<span class="cp-resist">Shrugs off ${boss.resist.map(id => escapeAttr((campItemDef(id) || { name: id }).name)).join(", ")}</span>` : "";
    // build 52: its traits, and how it takes damage tags
    const R = boss.rules || {}, word = l => (l || []).map(t => DAMAGE_NAMES[t].broad).join(", ");
    const tags = [R.immune && R.immune.length ? `Immune: ${word(R.immune)}` : "", R.resist && R.resist.length ? `Resists: ${word(R.resist)}` : "", R.weak && R.weak.length ? `Weak: ${word(R.weak)}` : ""].filter(Boolean).join(" · ");
    const traits = traitWords(boss.traits).join(", ");
    setHtml($(".cp-boss-state"), `${escapeAttr(st2)}${res ? "<br>" + res : ""}${tags ? `<br><span class="cp-resist">${escapeAttr(tags)}</span>` : ""}${traits ? `<br><span class="cp-traits">${escapeAttr(traits)}</span>` : ""}`);
  }

  // the pointer to whatever the quest wants you to find
  const tgt = ["keys", "buttons", "relic", "shards", "thief", "beacons", "hold", "haul"].includes(campGoal.type) ? goalTarget() : null;
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
    const key = ["c", campRun.startHearts, currentHearts, campRun.armor, campRun.armorMax, v ? v.uid + "/" + v.uses : "", campRun.rune ? campRun.rune.uid : "", campRun.echoUsed].join(":");
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

/* ----- The rails always fit (build 51) -----
   A touch smaller than they used to be, and smaller still whenever a column would run past the
   bottom of the window: never a scrollbar, never cut off. Checked as the plates change. */
const RAIL_BASE = 0.88;
let railFitAt = 0;
function campFitRails() {
  const wide = document.body.classList.contains("wide");
  [cpLeft, cpRight].forEach(el => { el.style.zoom = ""; });
  if (!campRun || !wide || cpLeft.hidden) return;
  // the rail runs from where it starts to the bottom of the window; if it's taller, it shrinks.
  // The column re-centers once it fits, so check twice.
  const fit = (rail, column) => {
    rail.style.zoom = RAIL_BASE;
    for (let pass = 0; pass < 3; pass++) {
      const r = rail.getBoundingClientRect();
      const room = window.innerHeight - 10 - r.top;
      const over = column.scrollHeight > column.clientHeight + 1;
      if ((r.bottom <= window.innerHeight - 6 && !over) || r.height <= 0) break;
      const z = parseFloat(rail.style.zoom) || RAIL_BASE;
      const want = over ? Math.min(room, r.height - (column.scrollHeight - column.clientHeight)) : room;
      rail.style.zoom = Math.max(0.5, z * want / r.height).toFixed(3);
    }
  };
  fit(cpLeft, document.getElementById("hud"));
  fit(cpRight, document.getElementById("below"));
}
(() => {
  const place = campHudPlace;
  window.campHudPlace = function () { place.apply(this, arguments); campFitRails(); };
  const upd = campHudUpdate;
  window.campHudUpdate = function () {
    upd.apply(this, arguments);
    const now = performance.now();
    if (now - railFitAt > 300) { railFitAt = now; campFitRails(); }
  };
})();
