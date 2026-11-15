/* =========================================================
   src/campaign/camp-shops.js
   The three snakes off every island's path, on one screen made of the
   game's own parts (a scene at the top, tabs, shop rows, gold buttons):
     merchant    three offers at a time: three different items of the
                 island's kind, each a random rarity, one on sale. New
                 stock every two hours, or now for gems. Buys anything.
     challenger  three of the island's levels with nightmare-style twists.
                 Once accepted it stays until it's done or its week runs
                 out. Finishing rolls the weighted reward pool.
     banker      trades this island's money down to the island before,
                 or into gems, for a flat fee per trade. Trade big.
   ========================================================= */
"use strict";

screenEls.campshop = document.getElementById("screen-campshop");
BACK_TARGET.campshop = "modes";

let shopIsl = "keep";
let shopKind = "merchant";
let shopTab = "buy";
let shopTimer = 0;
const shopBodyEl = document.getElementById("cs-body");

function openCampShop(isl, kind) {
  shopIsl = isl;
  shopKind = kind;
  shopTab = "buy";
  mapReturnTo = isl;
  openScreen("campshop");
  const I = CAMP.islandById[isl];
  const who = I.npcs[kind];
  document.getElementById("cs-title").textContent = who.shop;
  // fewer words: the shopkeeper's line is a hover away, on the shop's name
  document.getElementById("cs-title").title = `${who.name}: "${who.line}"`;
  document.getElementById("cs-quote").innerHTML = `<b>${escapeAttr(who.name)}</b> "${escapeAttr(who.line)}"`;
  screenEls.campshop.style.setProperty("--isl", I.colors.accent);
  watchArt(document.getElementById("cs-art"), `npc:${isl}:${kind}`);
  renderShop();
  clearInterval(shopTimer);
  shopTimer = setInterval(() => {
    if (currentScreen !== "campshop") { clearInterval(shopTimer); return; }
    const el = document.getElementById("cs-timer");
    if (el) el.textContent = shopTimerText();
    if (shopKind === "merchant" && camp.merchants[shopIsl] && Date.now() >= camp.merchants[shopIsl].restockAt) renderShop();
  }, 1000);
}

function renderShop() {
  if (shopKind === "merchant") shopBodyEl.innerHTML = merchantHtml();
  else if (shopKind === "challenger") shopBodyEl.innerHTML = challengerHtml();
  else shopBodyEl.innerHTML = bankHtml();
  shopBodyEl.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => shopAct(b.dataset.act, b.dataset)));
  shopBodyEl.querySelectorAll("input[data-amt]").forEach(inp => inp.addEventListener("input", () => bankPreview(inp.dataset.amt)));
  // the top bar shows every money you hold (camp-hud.js), so the bank needs no purse of its own
  document.getElementById("cs-wallet").innerHTML = "";
  campWalletUpdate();
}

const gemTag = n => `<img class="gem-ico" src="${iconUrl("gem", 2)}" alt="gems"> <b>${fmtInt(n)}</b>`;
const coinTag = (isl, n) => `${coinHtml(isl)} <b>${fmtInt(n)}</b>`;

/* ----- The merchant ----- */
function rollRarity(min = 0) {
  const pool = CAMP.rarities.slice(min);
  let r = Math.random() * pool.reduce((a, x) => a + x.weight, 0);
  for (const x of pool) { r -= x.weight; if (r <= 0) return x.id; }
  return pool[0].id;
}

function merchantStock(isl, force = false) {
  const I = CAMP.islandById[isl];
  let m = camp.merchants[isl];
  const now = Date.now();
  if (!m || force || now >= m.restockAt) {
    const ids = CAMP.items.filter(i => i.family === I.merchantFamily).map(i => i.id).sort(() => Math.random() - 0.5).slice(0, CAMP.rules.merchant.stockSize);
    const deal = Math.floor(Math.random() * ids.length);
    m = { stock: ids.map((id, i) => ({ id, rarity: rollRarity(), sold: false, deal: i === deal })), restockAt: now + Math.max(10, CAMP.rules.merchant.restockMinutes - upVal("restock")) * 60000 };
    camp.merchants[isl] = m;
    saveCamp();
  }
  return m;
}

function offerPrice(isl, o) {
  const d = campItemDef(o.id);
  let p = CAMP.families[d.family].price[rarityIdx(o.rarity)] * (1 - upPct("haggle"));
  if (o.deal) p *= 1 - CAMP.rules.merchant.dealDiscount / 100;
  return Math.max(1, Math.round(p));
}

function shopTimerText() {
  if (shopKind === "merchant") {
    const m = camp.merchants[shopIsl];
    return m ? `New stock in ${fmtLeft(m.restockAt - Date.now())}` : "";
  }
  if (shopKind === "challenger") {
    const C = camp.challenges[shopIsl];
    if (C && C.claimed) return `A new quest in ${fmtLeft(C.endsAt - Date.now())}`;
    return C && C.active ? `Ends in ${fmtLeft(C.endsAt - Date.now())}` : "";
  }
  return "";
}

/* A countdown in hours and minutes, always: "1h 59m", "0h 07m"; a week-long one adds its days: "6d 23h 59m" */
function fmtLeft(ms) {
  const m = Math.ceil(Math.max(0, ms) / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h ${String(mm).padStart(2, "0")}m` : `${h}h ${String(mm).padStart(2, "0")}m`;
}

/* What an item does, as shop-row text */
function itemFacts(id, rarity, own = null) {
  const d = campItemDef(id), r = rarityIdx(rarity);
  if (d.family === "rune") {
    // a rune: its two sides, with this condition's numbers
    const it = own || { id, rarity, grade: -1 };
    return `<div class="shop-desc">${escapeAttr(d.does)} Yours for good.</div>
    <div class="shop-meta"><span class="cs-good">Good: ${escapeAttr(campItemDoes(it))}</span></div>
    <div class="shop-meta"><span class="cs-weak">Bad: ${escapeAttr(campItemWeak(it))}</span></div>`;
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  // gear absorbs hits and spells hold charges every level now (build 51); your own piece counts its upgrades
  const it = own || { id, rarity, parts: d.family === "gear" ? builtInParts(id, rarity) : [], trinket: "", lv: 0, train: 0 };
  const n = freshUses(id, rarity, it);
  const stat = d.piece === "helmet" || d.piece === "body" ? "Never wears out" : d.family === "gear" ? `${plural(n, "hit")} a level` : d.family === "spell" ? `${plural(n, "charge")} a level${d.power ? `, ${campItemPower(it)} ${d.unit}` : ""}` : d.charges ? `${plural(n, "charge")}${d.power ? `, ${campItemPower(it)} ${d.unit}` : ""}` : d.power ? `${campItemPower(it)} ${d.unit}` : "";
  return `<div class="shop-desc">${escapeAttr(d.does)}</div>
    <div class="shop-meta"><span class="cs-stat">${stat}</span><span class="cs-good">Good: ${escapeAttr(d.strong)}</span></div>
    <div class="shop-meta"><span class="cs-weak">Weak: ${escapeAttr(d.weak)}</span></div>
    ${rarity === "legendary" ? `<div class="shop-meta"><span class="cs-leg">Legendary: ${escapeAttr(d.legend)}</span></div>` : ""}`;
}

function merchantHtml() {
  const m = merchantStock(shopIsl);
  const fam = CAMP.families[CAMP.islandById[shopIsl].merchantFamily];
  const slot = CAMP.slots.find(s => s.id === fam.slot);
  const tabs = `<div class="tabs cs-tabs" role="tablist"><button class="tab" role="tab" data-act="tab" data-t="buy" aria-selected="${shopTab === "buy"}">Buy</button><button class="tab" role="tab" data-act="tab" data-t="sell" aria-selected="${shopTab === "sell"}">Sell</button></div>`;
  if (shopTab === "sell") {
    const items = camp.satchel.slice().sort((a, b) => (campItemSlot(a.id) === "loot") - (campItemSlot(b.id) === "loot"));
    const rows = items.map(it => {
      const isl = campItemIsland(it.id);
      const on = Object.values(camp.equip).includes(it.uid);
      const color = CAMP.itemById[it.id] ? rarityColor(it.rarity) : "#e8e0c8";
      return `<div class="shop-row">${campItemIconHtml(it)}<div><div class="shop-name" style="color:${color}">${escapeAttr(campItemName(it))}${it.qty > 1 ? ` x${it.qty}` : ""}</div>
        <div class="shop-desc">${on ? "Equipped. Selling it takes it off." : CAMP.itemById[it.id] ? escapeAttr(slotName(campItemSlot(it.id))) : "A trinket from your travels"}</div></div>
        <button class="btn btn-buy affordable" data-act="sell" data-uid="${it.uid}">${coinTag(isl, campSellPrice(it))}</button></div>`;
    }).join("");
    // build 53: fewer words; the note is the tab's hover
    return tabs.replace('data-t="sell"', `data-t="sell" title="Anything sells here. You're paid in the money of the island it came from."`) + `${rows || `<div class="soon"><strong>Nothing to sell</strong>Loot turns up during levels. Your gear, spells and the rest show here too.</div>`}`;
  }
  const cards = m.stock.map((o, i) => {
    const d = campItemDef(o.id);
    const price = offerPrice(shopIsl, o);
    const can = !o.sold && campWallet(shopIsl) >= price;
    return `<div class="shop-row cs-offer${o.sold ? " locked" : ""}" style="--rc:${rarityColor(o.rarity)}">
      ${campItemIconHtml({ id: o.id, rarity: o.rarity }, "big")}
      <div><div class="shop-name"><span class="cs-rar" style="color:${rarityColor(o.rarity)}">${campGradeName(o.id, o.rarity)}</span> ${escapeAttr(d.name)}${o.deal && !o.sold ? ` <span class="cs-deal">${CAMP.rules.merchant.dealDiscount}% off</span>` : ""}</div><div class="cs-facts">${itemFacts(o.id, o.rarity)}</div></div>
      ${o.sold ? `<button class="btn btn-buy equipped" disabled>Sold</button>` : `<button class="btn btn-buy${can ? " affordable" : ""}" data-act="buy" data-i="${i}" ${can ? "" : "disabled"}>${coinTag(shopIsl, price)}</button>`}
    </div>`;
  }).join("");
  // build 53: fewer words: what the family is, on the Buy tab's hover; each offer's facts on the offer's hover
  return tabs.replace('data-t="buy"', `data-t="buy" title="${escapeAttr(fam.name)}: ${escapeAttr(slot.help)}"`) + `${cards}
    <div class="shop-row cs-foot"><span class="swatch cs-clock" aria-hidden="true"></span><div title="Or bring in fresh stock right now"><div class="shop-name" id="cs-timer">${shopTimerText()}</div></div>
    <button class="btn btn-buy${camp.gems >= CAMP.rules.merchant.rerollGems ? " affordable" : ""}" data-act="reroll" ${camp.gems >= CAMP.rules.merchant.rerollGems ? "" : "disabled"}>${gemTag(CAMP.rules.merchant.rerollGems)}</button></div>`;
}
const slotName = id => (CAMP.slots.find(s => s.id === id) || { name: id }).name;

/* ----- The challenger ----- */
function challengeState(isl) {
  let C = camp.challenges[isl];
  const now = Date.now();
  if (C && C.active && now >= C.endsAt) { C = null; showToast("Your quest ran out of time. Here's a fresh one."); }
  // a finished challenge waits out its week before the next one
  if (C && C.claimed && now < C.endsAt) return C;
  if (!C || C.claimed || (!C.active && !C.levels.length)) C = newChallenge(isl);
  camp.challenges[isl] = C;
  return C;
}

function newChallenge(isl) {
  const pool = [];
  for (let n = 1; n <= LEVEL_COUNT; n++) if (!BOSS_LEVELS.includes(n) && campWon(isl, n)) pool.push(n);
  pool.sort(() => Math.random() - 0.5);
  // 3 to 5 trials (challenge.levels to challenge.levelsMax), walked in order along the path
  const R = CAMP.rules.challenge, lo = R.levels, hi = Math.max(lo, R.levelsMax || lo);
  const levels = pool.slice(0, lo + Math.floor(Math.random() * (hi - lo + 1))).sort((a, b) => a - b);
  const modIds = CAMP.rules.challenge.mods.map(m => m.id);
  const used = new Set();
  const mods = levels.map(n => {
    const d = campLevelDef(isl, n);
    const ok = modIds.filter(m => !(m === "dark" && d.layout === "tunnel") && !(m === "rocky" && ["maze", "field"].includes(d.layout)) && !(m === "clock" && d.goal.type === "survive" && d.goal.need > 70));
    // fresh twists first, so the trials don't all feel the same
    const pick = ok.sort(() => Math.random() - 0.5).sort((a, b) => used.has(a) - used.has(b)).slice(0, CAMP.rules.challenge.modsPerLevel);
    pick.forEach(m => used.add(m));
    return pick;
  });
  return { levels, mods, done: levels.map(() => false), startedAt: 0, endsAt: 0, claimed: false, active: false };
}

/* The quest's pay: the base, a little more for every trial past three, and the upgrades on top */
const challengeCurrency = C => Math.round(CAMP.rules.challenge.rewardBase * (C && C.levels.length ? C.levels.length / 3 : 1) * (1 + upPct("treasure")) * (1 + upPct("mastery")));

/* A bit of plot: one of rules.challenge.plots, the same one for the same quest */
function questPlot(isl, C) {
  const plots = CAMP.rules.challenge.plots || [];
  const I = CAMP.islandById[isl];
  if (!plots.length) return I.npcs.challenger.line;
  const pick = plots[C.levels.reduce((a, n) => a * 31 + n, C.levels.length) % plots.length];
  return pick.replace(/\{npc\}/g, I.npcs.challenger.name).replace(/\{island\}/g, I.name).replace(/\{n\}/g, String(C.levels.length));
}

/* The challenger: a bit of plot, the trials as numbered stones (hover for the level and its
   twists), what it pays, and one button. Start flies to the first trial; each win draws the
   trail on to the next; after the last you come back here to collect. */
function challengerHtml() {
  const C = challengeState(shopIsl);
  saveCamp();
  const I = CAMP.islandById[shopIsl];
  const modOf = id => CAMP.rules.challenge.mods.find(m => m.id === id) || { name: id, text: "" };
  const nextI = C.done.findIndex(d => !d);
  const trials = `<div class="cs-stones">` + C.levels.map((n, i) => {
    const d = campLevelDef(shopIsl, n);
    const tip = `${n}. ${d.name}: ${goalText(d.goal)}${C.mods[i].includes("greedy") ? " (and half again)" : ""}\n` + C.mods[i].map(m => `${modOf(m).name}: ${modOf(m).text}`).join("\n");
    return `${i ? `<span class="cs-link${C.done[i - 1] ? " walked" : ""}" aria-hidden="true"></span>` : ""}<span class="cs-stone${C.done[i] ? " done" : C.active && i === nextI ? " now" : ""}" title="${escapeAttr(tip)}" aria-label="${escapeAttr(tip)}">${C.done[i] ? "&#10003;" : i + 1}</span>`;
  }).join("") + `</div>`;
  const pool = CAMP.rules.challenge.pool;
  const total = pool.reduce((a, p) => a + p.weight, 0);
  const odds = pool.map(p => `<li><span class="pn-label">${p.kind === "gems" ? `${p.min} to ${p.max} gems` : p.kind === "item" ? (CAMP.families[I.merchantFamily].grades ? `A ${CAMP.families[I.merchantFamily].grades[rarityIdx(p.rarity)].toLowerCase()} rune` : `A ${rarityName(p.rarity).toLowerCase()} ${escapeAttr(CAMP.families[I.merchantFamily].name.toLowerCase())} item`) : p.kind === "canister" ? "A Heart Canister (any rarity)" : p.kind === "spellpts" ? `${p.min} to ${p.max} spell upgrade points` : p.kind === "recipe" ? "A rare recipe for the kitchen" : p.kind === "skin" ? "An exclusive skin" : "An exclusive theme"}</span><span class="pn-count">${Math.round(p.weight / total * 100)}%</span></li>`).join("");
  // the prize pool's odds show when the mouse is on the prize
  const reward = `<div class="cs-prize" title="One roll of the prize pool on top">${coinTag(shopIsl, challengeCurrency(C))}<span class="cs-plus">+</span><img class="gem-ico" src="${iconUrl("gift", 2)}" alt="A prize roll"><ul class="cs-odds">${odds}</ul></div>`;
  let note = "", foot = "", timer = "";
  if (C.claimed) { note = `${escapeAttr(I.npcs.challenger.name)} is planning the next one.`; timer = `<span id="cs-timer">${shopTimerText()}</span>`; }
  else if (!C.levels.length) note = "Win more of this island's levels first: the trials are picked from the ones you've beaten.";
  else {
    note = escapeAttr(questPlot(shopIsl, C));
    if (!C.active) foot = `<button class="btn btn-small cs-reroll" data-act="newch" title="Other trials" aria-label="Other trials for ${CAMP.rules.challenge.rerollGems} gems" ${camp.gems >= CAMP.rules.challenge.rerollGems ? "" : "disabled"}>&#8635; ${gemTag(CAMP.rules.challenge.rerollGems)}</button><button class="btn btn-primary" data-act="accept">Start</button>`;
    else if (C.done.every(Boolean)) foot = `<button class="btn btn-gold" data-act="claim">Collect</button>`;
    else { foot = `<button class="btn btn-purple" data-act="trial" data-i="${nextI}">Trial ${nextI + 1}</button>`; timer = `<span id="cs-timer">${shopTimerText()}</span>`; }
  }
  return `<div class="core-box cs-quest"><p class="cs-plot">${note}</p>${C.levels.length && !C.claimed ? trials + reward : ""}` +
    `${timer ? `<p class="cs-when">${timer}</p>` : ""}${foot ? `<div class="row-buttons cs-btns">${foot}</div>` : ""}</div>`;
}

function rollChallengeReward(isl) {
  const pool = CAMP.rules.challenge.pool;
  let r = Math.random() * pool.reduce((a, p) => a + p.weight, 0);
  let pick = pool[0];
  for (const p of pool) { r -= p.weight; if (r <= 0) { pick = p; break; } }
  const gems = () => { const g = pick.min ? pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1)) : 20; addGems(g); return `${g} gems`; };
  if (pick.kind === "gems") return gems();
  if (pick.kind === "item") {
    const fam = CAMP.islandById[isl].merchantFamily;
    const ids = CAMP.items.filter(i => i.family === fam);
    const it = ids[Math.floor(Math.random() * ids.length)];
    campGive(it.id, pick.rarity);
    return `a ${campItemName({ id: it.id, rarity: pick.rarity })}`;
  }
  if (pick.kind === "canister") {
    const r = rollRarity();
    campGive("canister", r);
    return `a ${rarityName(r)} Heart Canister`;
  }
  // build 51: spell upgrade points, and the best recipes (only ever won from quests)
  if (pick.kind === "spellpts") {
    const n = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
    campGiveSpellPts(n);
    return `${n} spell upgrade points`;
  }
  if (pick.kind === "recipe") {
    const left = Object.values(CAMP.recipeById).filter(r => r.source === "quest" && !camp.recipes.includes(r.id));
    if (!left.length) { pick = { min: 15, max: 30 }; return gems() + " (you know every quest recipe already)"; }
    const r = left[Math.floor(Math.random() * left.length)];
    camp.recipes.push(r.id);
    return `the recipe for ${r.name}`;
  }
  const isSkin = pick.kind === "skin";
  const list = CAMP.rules.cosmetics[isSkin ? "exclusiveSkins" : "exclusiveThemes"].filter(id => !(isSkin ? camp.skins : camp.themes).includes(id));
  if (!list.length) { pick = { min: 25, max: 40 }; return gems() + " (you own every exclusive already)"; }
  const id = list[Math.floor(Math.random() * list.length)];
  (isSkin ? camp.skins : camp.themes).push(id);
  const name = isSkin ? (skinById[id] || { name: id }).name : (backdropById[id] || { name: id }).name;
  return `the exclusive ${isSkin ? "skin" : "theme"} ${name || id}`;
}

/* ----- The bank: the old Exchange's slider, one card per kind of trade ----- */
const gemUnitCost = isl => CAMP.rules.bank.snaycoinPerGem / Math.pow(CAMP.rules.bank.rateToPrev, campIslandIdx(isl));

/* Trading down any number of islands in one go: the same as walking it down one bank at a time
   (each step pays rateToPrev, less feePrev), just without the walking. */
let bankTo = null;              // the island whose money the down-trade buys
function tradeDown(fromIdx, toIdx, n) {
  const B = CAMP.rules.bank;
  let amt = n;
  for (let j = fromIdx; j > toIdx && amt > 0; j--) amt = Math.max(0, amt * B.rateToPrev - B.feePrev);
  return Math.floor(amt);
}

function bankHtml() {
  const i = campIslandIdx(shopIsl);
  const B = CAMP.rules.bank;
  const cur = campCurrency(shopIsl);
  const have = campWallet(shopIsl);
  const per = gemUnitCost(shopIsl);
  const maxGems = Math.max(0, Math.floor(have / per) - B.gemFee);
  const below = CAMP.islands.slice(0, i).reverse();
  if (!below.some(I => I.id === bankTo)) bankTo = below.length ? below[0].id : null;
  let html = "";
  if (below.length) {
    // pick any island below: each coin is a button, the trade goes straight there
    const picks = below.map(I => `<button class="bk-to${I.id === bankTo ? " on" : ""}" data-act="bkto" data-isl="${I.id}" title="${escapeAttr(I.currency.plural)} (${escapeAttr(I.name)})" aria-label="Trade into ${escapeAttr(I.currency.plural)}" aria-pressed="${I.id === bankTo}">${coinHtml(I.id, 20)}</button>`).join("");
    html += `<div class="core-box cs-bank" title="Every island down pays ${B.rateToPrev} to 1, less ${B.feePrev} as a fee: one big trade beats lots of small ones">
      <div class="bk-head">${coinHtml(shopIsl, 20)}<span class="bk-arrow" aria-hidden="true">&#10148;</span><div class="bk-picks">${picks}</div></div>
      <input class="ex-range" type="range" min="0" max="${have}" step="1" value="${Math.min(have, 10)}" data-amt="prev" id="bk-prev" aria-label="How many ${escapeAttr(cur.plural)} to trade">
      <p class="ex-preview" id="bk-prev-out"></p>
      <div class="ex-quick"><button class="btn btn-small" data-act="bkset" data-k="prev" data-v="half">&frac12;</button><button class="btn btn-small" data-act="bkset" data-k="prev" data-v="all">All</button><button class="btn btn-gold" data-act="toprev">Trade</button></div></div>`;
  }
  html += `<div class="core-box cs-bank" title="${per >= 1 ? `${fmtInt(per)} ${escapeAttr(cur.plural)} per gem` : `1 ${escapeAttr(cur.name)} is worth ${fmtInt(1 / per)} gems`}, and a gem's worth on top as the fee">
    <div class="bk-head">${coinHtml(shopIsl, 20)}<span class="bk-arrow" aria-hidden="true">&#10148;</span><img class="gem-ico bk-gem" src="${iconUrl("gem", 3)}" alt="Gems"></div>
    <input class="ex-range" type="range" min="0" max="${maxGems}" step="1" value="${Math.min(maxGems, 1)}" data-amt="gems" id="bk-gems" aria-label="How many gems">
    <p class="ex-preview" id="bk-gems-out"></p>
    <div class="ex-quick"><button class="btn btn-small" data-act="bkset" data-k="gems" data-v="all">All</button><button class="btn btn-gold" data-act="togems">Trade</button></div></div>`;
  const cash = cashOutPlan();
  html += `<div class="core-box cs-bank" title="Everything on this island and every island before it, walked down to ${escapeAttr(CAMP.islands[0].currency.plural)} (a fee at every step), then into gems${cash.gems > 0 ? `. Fees: ${escapeAttr(cash.fees.join(", "))}` : ""}">
    <div class="bk-head">${CAMP.islands.slice(0, i + 1).map(I => coinHtml(I.id, 20)).join("")}<span class="bk-arrow" aria-hidden="true">&#10148;</span><img class="gem-ico bk-gem" src="${iconUrl("gem", 3)}" alt="Gems"></div>
    <p class="ex-preview">${cash.gems > 0 ? gemTag(cash.gems) : "&mdash;"}</p>
    <div class="ex-quick"><button class="btn btn-gold" data-act="cashout" ${cash.gems > 0 ? "" : "disabled"}>Cash out</button></div></div>`;
  setTimeout(() => { bankPreview("prev"); bankPreview("gems"); }, 0);
  return html;
}

function bankPreview(k) {
  const B = CAMP.rules.bank;
  const i = campIslandIdx(shopIsl);
  if (k === "prev") {
    const el = document.getElementById("bk-prev"), out = document.getElementById("bk-prev-out");
    if (!el || !out) return;
    const n = Math.max(0, Math.floor(+el.value || 0));
    const got = tradeDown(i, campIslandIdx(bankTo), n);
    out.innerHTML = `${coinTag(shopIsl, n)} &#10148; ` + (got > 0 ? `${coinTag(bankTo, got)}` : "too small to cover the fee");
  } else {
    const el = document.getElementById("bk-gems"), out = document.getElementById("bk-gems-out");
    if (!el || !out) return;
    const g = Math.max(0, Math.floor(+el.value || 0));
    const cost = Math.ceil((g + B.gemFee) * gemUnitCost(shopIsl) - 1e-9);
    out.innerHTML = g <= 0 ? `You need ${fmtInt(Math.ceil((1 + B.gemFee) * gemUnitCost(shopIsl)))} ${escapeAttr(campCurrency(shopIsl).plural)} for the first gem` : `${coinTag(shopIsl, cost)} for ${gemTag(g)}`;
  }
}

/* Everything from this island down, cascaded to the first island's money, then to gems */
function cashOutPlan() {
  const B = CAMP.rules.bank;
  const i = campIslandIdx(shopIsl);
  const fees = [];
  let carry = 0;
  for (let j = i; j >= 1; j--) {
    const id = CAMP.islands[j].id;
    const amt = campWallet(id) + carry;
    if (amt <= 0) { carry = 0; continue; }
    carry = Math.max(0, amt * B.rateToPrev - B.feePrev);
    fees.push(`${B.feePrev} ${CAMP.islands[j - 1].currency.plural}`);
  }
  const snay = campWallet(CAMP.islands[0].id) + carry;
  const gems = Math.max(0, Math.floor(snay / B.snaycoinPerGem) - B.gemFee);
  fees.push(`${B.gemFee} gem`);
  const left = gems > 0 ? snay - (gems + B.gemFee) * B.snaycoinPerGem : snay;
  return { gems, fees, left };
}

/* ----- Clicks ----- */
function shopAct(a, d) {
  const B = CAMP.rules.bank;
  if (a === "tab") { shopTab = d.t; sfx("tab"); renderShop(); return; }
  if (a === "buy") {
    const m = merchantStock(shopIsl);
    const o = m.stock[+d.i];
    const price = offerPrice(shopIsl, o);
    if (o.sold || !campSpend(shopIsl, price)) { sfx("bad"); return; }
    o.sold = true;
    const it = campGive(o.id, o.rarity);
    campBump("itemsBought");
    campCheckAch();
    saveCamp();
    sfx("buy");
    showToast(`Bought: ${campItemName(it)}${Object.values(camp.equip).includes(it.uid) ? ". It's on you now." : ". Swap it in before any level."}`);
    renderShop();
    return;
  }
  if (a === "reroll") {
    if (camp.gems < CAMP.rules.merchant.rerollGems) return;
    camp.gems -= CAMP.rules.merchant.rerollGems;
    merchantStock(shopIsl, true);
    sfx("shimmer");
    renderShop();
    return;
  }
  if (a === "sell") {
    const it = camp.satchel.find(x => x.uid === +d.uid);
    if (!it) return;
    const isl = campItemIsland(it.id);
    campPay(isl, campSellPrice(it));
    if (it.qty > 1) it.qty--; else campDrop(it.uid);
    saveCamp();
    sfx("buy");
    renderShop();
    return;
  }
  if (a === "accept") {
    const C = challengeState(shopIsl);
    C.active = true; C.startedAt = Date.now(); C.endsAt = Date.now() + CAMP.rules.challenge.days * 86400000; C.claimed = false;
    saveCamp(); sfx("unlock");
    // straight out to the first trial: the trail draws itself from the tent to it
    mapFlyTo(shopIsl, C.levels[C.done.findIndex(d => !d)]);
    return;
  }
  if (a === "newch") {
    if (camp.gems < CAMP.rules.challenge.rerollGems) return;
    camp.gems -= CAMP.rules.challenge.rerollGems;
    camp.challenges[shopIsl] = newChallenge(shopIsl);
    saveCamp(); sfx("shimmer"); renderShop();
    return;
  }
  if (a === "trial") {
    // on to the next trial: the map flies there, and its pin opens the objective card
    const C = challengeState(shopIsl);
    mapFlyTo(shopIsl, C.levels[+d.i]);
    return;
  }
  if (a === "claim") {
    const C = challengeState(shopIsl);
    if (!C.active || !C.done.every(Boolean)) return;
    const money = challengeCurrency(C);
    campPay(shopIsl, money);
    const prize = rollChallengeReward(shopIsl);
    C.active = false; C.claimed = true;
    campBump("challengesDone");
    campCheckAch();
    saveCamp();
    sfx("medal");
    confetti();
    openConfirm({ title: "Quest complete!", text: `${CAMP.islandById[shopIsl].npcs.challenger.name} hands over ${fmtInt(money)} ${campCurrency(shopIsl).plural}. And the prize roll: ${prize}!`, ok: "Wonderful", gold: true, onOk: () => {} });
    renderShop();
    return;
  }
  if (a === "bkset") {
    const el = document.getElementById(d.k === "prev" ? "bk-prev" : "bk-gems");
    if (d.v === "all") el.value = el.max;
    else if (d.v === "half") el.value = Math.floor(+el.max / 2);
    bankPreview(d.k);
    return;
  }
  if (a === "bkto") { bankTo = d.isl; sfx("tick"); renderShop(); return; }
  if (a === "toprev") {
    const n = Math.max(0, Math.floor(+document.getElementById("bk-prev").value || 0));
    const to = CAMP.islandById[bankTo];
    const got = to ? tradeDown(campIslandIdx(shopIsl), campIslandIdx(bankTo), n) : 0;
    if (got <= 0 || !campSpend(shopIsl, n)) { sfx("bad"); return; }
    campPay(to.id, got);
    campBump("trades"); campCheckAch(); saveCamp(); sfx("buy");
    showToast(`Traded for ${fmtInt(got)} ${to.currency.plural}.`);
    renderShop();
    return;
  }
  if (a === "togems") {
    const g = Math.max(0, Math.floor(+document.getElementById("bk-gems").value || 0));
    const cost = Math.ceil((g + B.gemFee) * gemUnitCost(shopIsl) - 1e-9);
    if (g <= 0 || !campSpend(shopIsl, cost)) { sfx("bad"); return; }
    addGems(g);
    campBump("trades"); campCheckAch(); saveCamp(); sfx("buy");
    showToast(`+${g} gems.`);
    renderShop();
    return;
  }
  if (a === "cashout") {
    const plan = cashOutPlan();
    if (plan.gems <= 0) return;
    openConfirm({
      title: "Cash out to gems?",
      text: `Everything here and on the islands below is traded down, then into ${plan.gems} gems. Fees: ${plan.fees.join(", ")}.`,
      ok: "Cash out", gold: true,
      onOk: () => {
        for (let j = campIslandIdx(shopIsl); j >= 0; j--) camp.wallet[CAMP.islands[j].currency.id] = 0;
        camp.wallet[CAMP.islands[0].currency.id] = Math.max(0, Math.round(plan.left));
        addGems(plan.gems);
        campBump("trades"); campCheckAch(); saveCamp(); sfx("medal");
        showToast(`+${plan.gems} gems.`);
        renderShop();
      }
    });
  }
}
