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
  // the top bar shows this island's money and gems; the bank also shows what it trades down to
  const prev = CAMP.islands[campIslandIdx(shopIsl) - 1];
  document.getElementById("cs-wallet").innerHTML = prev && shopKind === "banker" ? `<span class="cw-chip plate" title="${escapeAttr(prev.currency.plural)}">${coinHtml(prev.id)}<b>${fmtInt(campWallet(prev.id))}</b></span>` : "";
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

function fmtLeft(ms) {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
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
  const stat = d.family === "gear" ? `${plural(n, "hit")} a level` : d.family === "spell" ? `${plural(n, "charge")} a level${d.power ? `, ${campItemPower(it)} ${d.unit}` : ""}` : d.charges ? `${plural(n, "charge")}${d.power ? `, ${campItemPower(it)} ${d.unit}` : ""}` : d.power ? `${campItemPower(it)} ${d.unit}` : "";
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
    return tabs + `<p class="shop-note">Anything sells here. You're paid in the money of the island it came from.</p>${rows || `<div class="soon"><strong>Nothing to sell</strong>Loot turns up during levels. Your gear, spells and the rest show here too.</div>`}`;
  }
  const cards = m.stock.map((o, i) => {
    const d = campItemDef(o.id);
    const price = offerPrice(shopIsl, o);
    const can = !o.sold && campWallet(shopIsl) >= price;
    return `<div class="shop-row cs-offer${o.sold ? " locked" : ""}" style="--rc:${rarityColor(o.rarity)}">
      ${campItemIconHtml({ id: o.id, rarity: o.rarity }, "big")}
      <div><div class="shop-name"><span class="cs-rar" style="color:${rarityColor(o.rarity)}">${campGradeName(o.id, o.rarity)}</span> ${escapeAttr(d.name)}${o.deal && !o.sold ? ` <span class="cs-deal">${CAMP.rules.merchant.dealDiscount}% off</span>` : ""}</div>${itemFacts(o.id, o.rarity)}</div>
      ${o.sold ? `<button class="btn btn-buy equipped" disabled>Sold</button>` : `<button class="btn btn-buy${can ? " affordable" : ""}" data-act="buy" data-i="${i}" ${can ? "" : "disabled"}>${coinTag(shopIsl, price)}</button>`}
    </div>`;
  }).join("");
  return tabs + `<p class="shop-note">${escapeAttr(fam.name)}: ${escapeAttr(slot.help)}</p>${cards}
    <div class="shop-row cs-foot"><span class="swatch cs-clock" aria-hidden="true"></span><div><div class="shop-name" id="cs-timer">${shopTimerText()}</div><div class="shop-desc">Or bring in fresh stock right now.</div></div>
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
  const levels = pool.slice(0, CAMP.rules.challenge.levels).sort((a, b) => a - b);
  const modIds = CAMP.rules.challenge.mods.map(m => m.id);
  const used = new Set();
  const mods = levels.map(n => {
    const d = campLevelDef(isl, n);
    const ok = modIds.filter(m => !(m === "dark" && d.layout === "tunnel") && !(m === "rocky" && ["maze", "field"].includes(d.layout)) && !(m === "clock" && d.goal.type === "survive" && d.goal.need > 70));
    // fresh twists first, so the three trials don't all feel the same
    const pick = ok.sort(() => Math.random() - 0.5).sort((a, b) => used.has(a) - used.has(b)).slice(0, CAMP.rules.challenge.modsPerLevel);
    pick.forEach(m => used.add(m));
    return pick;
  });
  return { levels, mods, done: levels.map(() => false), startedAt: 0, endsAt: 0, claimed: false, active: false };
}

const challengeCurrency = () => Math.round(CAMP.rules.challenge.rewardBase * (1 + upPct("treasure")) * (1 + upPct("mastery")));

function challengerHtml() {
  const C = challengeState(shopIsl);
  saveCamp();
  const I = CAMP.islandById[shopIsl];
  const modOf = id => CAMP.rules.challenge.mods.find(m => m.id === id) || { name: id, text: "" };
  const trials = C.levels.map((n, i) => {
    const d = campLevelDef(shopIsl, n);
    const play = C.active && !C.done[i] && !C.claimed;
    return `<div class="shop-row cs-trial${C.done[i] ? " done" : ""}">
      <span class="cs-num">${C.done[i] ? "&#10003;" : i + 1}</span>
      <div><div class="shop-name">${n}. ${escapeAttr(d.name)}</div><div class="shop-desc">${escapeAttr(goalText(d.goal))}${C.mods[i].includes("greedy") ? " (and half again)" : ""}</div>
      <div class="cp-mods cs-mods">${C.mods[i].map(m => `<span title="${escapeAttr(modOf(m).text)}">${escapeAttr(modOf(m).name)}</span>`).join("")}</div>
      <div class="shop-desc">${C.mods[i].map(m => escapeAttr(modOf(m).text)).join(" ")}</div></div>
      ${play ? `<button class="btn btn-buy affordable" data-act="trial" data-i="${i}">Play</button>` : C.done[i] ? `<button class="btn btn-buy equipped" disabled>Done</button>` : `<span></span>`}
    </div>`;
  }).join("");
  const pool = CAMP.rules.challenge.pool;
  const total = pool.reduce((a, p) => a + p.weight, 0);
  const odds = pool.map(p => `<li><span class="pn-label">${p.kind === "gems" ? `${p.min} to ${p.max} gems` : p.kind === "item" ? (CAMP.families[I.merchantFamily].grades ? `A ${CAMP.families[I.merchantFamily].grades[rarityIdx(p.rarity)].toLowerCase()} rune` : `A ${rarityName(p.rarity).toLowerCase()} ${escapeAttr(CAMP.families[I.merchantFamily].name.toLowerCase())} item`) : p.kind === "canister" ? "A Heart Canister (any rarity)" : p.kind === "spellpts" ? `${p.min} to ${p.max} spell upgrade points` : p.kind === "recipe" ? "A rare recipe for the kitchen" : p.kind === "skin" ? "An exclusive skin" : "An exclusive theme"}</span><span class="pn-count">${Math.round(p.weight / total * 100)}%</span></li>`).join("");
  const reward = `<div class="core-box cs-reward"><span class="ribbon rank-3">Reward</span>
    <p class="shop-note">${coinTag(shopIsl, challengeCurrency())} ${escapeAttr(I.currency.plural)}, and one roll of the prize pool:</p>
    <ul class="prestige-needs">${odds}</ul></div>`;
  let note, foot = "";
  if (C.claimed) note = `Quest done. ${escapeAttr(I.npcs.challenger.name)} is planning the next one. <span id="cs-timer">${shopTimerText()}</span>`;
  else if (!C.levels.length) note = "Win more of this island's levels first: the trials are picked from the ones you've beaten.";
  else if (!C.active) {
    note = `Three trials on this island, each with twists. Once you accept, you have ${CAMP.rules.challenge.days} days, and the quest stays until it's done.`;
    foot = `<div class="row-buttons cs-btns"><button class="btn btn-small${camp.gems >= CAMP.rules.challenge.rerollGems ? "" : ""}" data-act="newch" ${camp.gems >= CAMP.rules.challenge.rerollGems ? "" : "disabled"}>Other trials: ${gemTag(CAMP.rules.challenge.rerollGems)}</button><button class="btn btn-primary" data-act="accept">Accept the quest</button></div>`;
  } else if (C.done.every(Boolean)) {
    note = "Every trial is done. Your reward is waiting.";
    foot = `<div class="row-buttons cs-btns"><button class="btn btn-gold" data-act="claim">Claim the reward</button></div>`;
  } else note = `Your quest is on. <span id="cs-timer">${shopTimerText()}</span>`;
  return `<p class="shop-note">${note}</p>${trials}${C.claimed || !C.levels.length ? "" : reward}${foot}`;
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

function bankHtml() {
  const i = campIslandIdx(shopIsl);
  const B = CAMP.rules.bank;
  const prev = CAMP.islands[i - 1];
  const cur = campCurrency(shopIsl);
  const have = campWallet(shopIsl);
  const per = gemUnitCost(shopIsl);
  const maxGems = Math.max(0, Math.floor(have / per) - B.gemFee);
  let html = `<p class="shop-note">Trades only go one way: down to the island before, or into gems. Every trade costs a flat fee, so one big trade beats lots of small ones.</p>`;
  if (prev) {
    html += `<div class="core-box cs-bank"><span class="ribbon rank-2">${escapeAttr(cur.plural)} to ${escapeAttr(prev.currency.plural)}</span>
      <p class="ex-rate">1 ${escapeAttr(cur.name)} buys ${B.rateToPrev} ${escapeAttr(prev.currency.plural)}, less a fee of ${B.feePrev} ${escapeAttr(prev.currency.plural)} per trade.</p>
      <input class="ex-range" type="range" min="0" max="${have}" step="1" value="${Math.min(have, 10)}" data-amt="prev" id="bk-prev" aria-label="How many to trade">
      <p class="ex-preview" id="bk-prev-out"></p>
      <div class="ex-quick"><button class="btn btn-small" data-act="bkset" data-k="prev" data-v="half">Half</button><button class="btn btn-small" data-act="bkset" data-k="prev" data-v="all">All of it</button><button class="btn btn-gold" data-act="toprev">Trade</button></div></div>`;
  }
  html += `<div class="core-box cs-bank"><span class="ribbon rank-3">${escapeAttr(cur.plural)} to gems</span>
    <p class="ex-rate">${per >= 1 ? `${fmtInt(per)} ${escapeAttr(cur.plural)} per gem` : `1 ${escapeAttr(cur.name)} is worth ${fmtInt(1 / per)} gems`}, and a gem's worth on top as the fee.</p>
    <input class="ex-range" type="range" min="0" max="${maxGems}" step="1" value="${Math.min(maxGems, 1)}" data-amt="gems" id="bk-gems" aria-label="How many gems">
    <p class="ex-preview" id="bk-gems-out"></p>
    <div class="ex-quick"><button class="btn btn-small" data-act="bkset" data-k="gems" data-v="all">As many as I can</button><button class="btn btn-gold" data-act="togems">Trade</button></div></div>`;
  const cash = cashOutPlan();
  html += `<div class="core-box cs-bank"><span class="ribbon rank-1">Cash out</span>
    <p class="ex-rate">Everything on this island and every island before it, walked down to ${escapeAttr(CAMP.islands[0].currency.plural)} one bank at a time (a fee at every step), then into gems.</p>
    <p class="ex-preview">${cash.gems > 0 ? `You'd get ${gemTag(cash.gems)}, paying ${escapeAttr(cash.fees.join(", "))} in fees.` : "Not enough money here to cash out yet."}</p>
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
    const prev = CAMP.islands[i - 1];
    const got = n * B.rateToPrev - B.feePrev;
    out.innerHTML = `${coinTag(shopIsl, n)} for ` + (got > 0 ? `${coinTag(prev.id, got)}` : "nothing: too small to cover the fee");
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
    showToast("Quest accepted. Play the trials from here, or right from the map.");
    renderShop();
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
    const C = challengeState(shopIsl);
    campBeginLevel(shopIsl, C.levels[+d.i], +d.i);
    return;
  }
  if (a === "claim") {
    const C = challengeState(shopIsl);
    if (!C.active || !C.done.every(Boolean)) return;
    const money = challengeCurrency();
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
  if (a === "toprev") {
    const n = Math.max(0, Math.floor(+document.getElementById("bk-prev").value || 0));
    const prev = CAMP.islands[campIslandIdx(shopIsl) - 1];
    const got = n * B.rateToPrev - B.feePrev;
    if (got <= 0 || !campSpend(shopIsl, n)) { sfx("bad"); return; }
    campPay(prev.id, got);
    campBump("trades"); campCheckAch(); saveCamp(); sfx("buy");
    showToast(`Traded for ${fmtInt(got)} ${prev.currency.plural}.`);
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
