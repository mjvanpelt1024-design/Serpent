/* =========================================================
   src/campaign/camp-shops.js
   The three snakes along every island's path:
     merchant    three offers at a time, one of each kind, random rarity,
                 one on sale. New stock every two hours, or now for gems.
                 Buys anything back.
     challenger  three of the island's levels with nightmare-style twists.
                 Once accepted it runs until it's done or the week is up.
                 Finishing all three rolls the reward pool.
     banker      trades this island's currency down to the island before
                 it, or into gems. A flat fee per trade, so trade big.
   ========================================================= */
"use strict";

let shopIsl = "keep";
let shopKind = "merchant";
let shopTab = "buy";
let shopRaf = 0;

function openCampShop(isl, kind) {
  shopIsl = isl;
  shopKind = kind;
  shopTab = "buy";
  openScreen("campshop");
  if (!document.getElementById("cs-back").dataset.bound) {
    document.getElementById("cs-back").dataset.bound = "1";
    document.getElementById("cs-back").addEventListener("click", () => openCampMap({ isl: shopIsl, node: shopKind }));
  }
  const I = CAMP.islandById[isl];
  const who = I.npcs[kind];
  document.getElementById("cs-title").textContent = who.shop;
  document.getElementById("cs-name").textContent = who.name;
  document.getElementById("cs-line").textContent = `“${who.line}”`;
  document.getElementById("screen-campshop").style.setProperty("--isl", I.colors.accent);
  renderShop();
  cancelAnimationFrame(shopRaf);
  const loop = ts => {
    if (currentScreen !== "campshop") return;
    shopRaf = requestAnimationFrame(loop);
    const c = document.getElementById("cs-portrait");
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    drawShopBackdrop(g, c.width, c.height, I, kind, ts);
    drawPortrait(g, who.look, c.width * 0.18, c.height * 0.3, c.width * 0.64, ts);
    if (Math.floor(ts / 1000) % 4 === 0) { const t = document.getElementById("cs-timer"); if (t) t.textContent = shopTimerText(); }
  };
  shopRaf = requestAnimationFrame(loop);
}

function drawShopBackdrop(g, w, h, I, kind, ts) {
  const C = I.colors;
  g.fillStyle = campShade(C.accent, -0.55);
  g.fillRect(0, 0, w, h);
  const u = w / 32;
  const R = (a, b, ww, hh, col) => { g.fillStyle = col; g.fillRect(a * u, b * u, ww * u, hh * u); };
  if (kind === "merchant") {
    for (let i = 0; i < 8; i++) R(i * 4, 0, 4, 5 + (i % 2), i % 2 ? "#ffffff" : C.accent);
    R(0, 26, 32, 6, "#7a5a3a"); R(0, 25, 32, 1, "#a87a4a");
    R(2, 22, 4, 4, "#9aa3ad"); R(26, 21, 4, 5, "#c8a04a");
  } else if (kind === "challenger") {
    R(0, 0, 32, 32, campShade(C.accent, -0.4));
    for (let i = 0; i < 5; i++) R(2 + i * 6, 2, 4, 8, i % 2 ? C.accent : "#ffd23f");
    R(0, 27, 32, 5, "#3a2a20");
  } else {
    R(0, 0, 32, 32, "#2a2a30");
    for (let i = 0; i < 4; i++) R(2 + i * 8, 4, 3, 22, "#4a4a52");
    R(0, 26, 32, 6, "#3a3a42");
    const shine = (ts / 900) % 1;
    for (let i = 0; i < 5; i++) R(3 + i * 6, 24 - (i % 2), 3, 2, "#ffd23f");
    R(3 + shine * 26, 24, 1, 1, "#ffffff");
  }
}

function renderShop() {
  const body = document.getElementById("cs-body");
  if (shopKind === "merchant") body.innerHTML = merchantHtml();
  else if (shopKind === "challenger") body.innerHTML = challengerHtml();
  else body.innerHTML = bankHtml();
  body.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => shopAct(b.dataset.act, b.dataset)));
  body.querySelectorAll("input[data-amt]").forEach(inp => inp.addEventListener("input", () => bankPreview(inp.dataset.amt)));
  const w = document.getElementById("cs-wallet");
  const prev = CAMP.islands[campIslandIdx(shopIsl) - 1];
  w.innerHTML = `<span class="cm-coin here">${coinIconHtml(shopIsl)}${fmtInt(campWallet(shopIsl))}<small>${campCurrency(shopIsl).short}</small></span>` +
    (prev ? `<span class="cm-coin">${coinIconHtml(prev.id)}${fmtInt(campWallet(prev.id))}<small>${prev.currency.short}</small></span>` : "") +
    `<span class="cm-coin gems">${gemIconHtml()}${fmtInt(camp.gems)}</span>`;
}

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
    if (C && C.claimed) return `New challenge in ${fmtLeft(C.endsAt - Date.now())}`;
    return C && C.active ? `Ends in ${fmtLeft(C.endsAt - Date.now())}` : "";
  }
  return "";
}

function fmtLeft(ms) {
  ms = Math.max(0, ms);
  const m = Math.ceil(ms / 60000);
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function merchantHtml() {
  const m = merchantStock(shopIsl);
  const tabs = `<div class="tabs cb-tabs"><button class="tab" data-act="tab" data-t="buy" aria-selected="${shopTab === "buy"}">Buy</button><button class="tab" data-act="tab" data-t="sell" aria-selected="${shopTab === "sell"}">Sell</button></div>`;
  if (shopTab === "sell") {
    const items = camp.satchel.slice().sort((a, b) => (campItemSlot(a.id) === "loot") - (campItemSlot(b.id) === "loot"));
    const rows = items.map(it => {
      const isl = campItemIsland(it.id);
      const on = Object.values(camp.equip).includes(it.uid);
      return `<div class="cs-sell">${campItemIconHtml(it)}<div class="cs-sn"><strong style="color:${CAMP.itemById[it.id] ? rarityColor(it.rarity) : "#e8e0c8"}">${campItemName(it)}</strong>${it.qty > 1 ? ` ×${it.qty}` : ""}${on ? ` <small>(equipped)</small>` : ""}</div>
        <button class="btn btn-small" data-act="sell" data-uid="${it.uid}">${coinIconHtml(isl)} ${fmtInt(campSellPrice(it))}</button></div>`;
    }).join("");
    return tabs + `<p class="cb-note">Anything sells here. You're paid in the currency of the island it came from.</p><div class="cs-sells">${rows || `<p class="cb-empty">Your satchel is empty.</p>`}</div>`;
  }
  const cards = m.stock.map((o, i) => {
    const d = campItemDef(o.id);
    const price = offerPrice(shopIsl, o);
    const can = !o.sold && campWallet(shopIsl) >= price;
    const it = { id: o.id, rarity: o.rarity };
    const r = rarityIdx(o.rarity);
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const stat = d.uses ? plural(d.uses[r] + upVal("sturdy"), "use") : d.charges ? plural(d.charges[r] + (d.family === "spell" ? upVal("potent") : upVal("hearty")), "charge") : d.power ? `${d.power[r]} ${d.unit}` : "";
    return `<div class="cs-offer ${o.sold ? "sold" : ""}" style="--rc:${rarityColor(o.rarity)}">
      ${o.deal && !o.sold ? `<span class="cs-deal">${CAMP.rules.merchant.dealDiscount}% off</span>` : ""}
      ${campItemIconHtml(it, "big")}
      <div class="cs-r">${rarityName(o.rarity)}</div><h4>${d.name}</h4>
      <div class="cs-stat">${stat}</div>
      <p>${d.does}</p>
      <p class="sat-good"><strong>Good:</strong> ${d.strong}</p>
      <p class="sat-bad"><strong>Weak:</strong> ${d.weak}</p>
      ${o.rarity === "legendary" ? `<p class="sat-leg">${d.legend}</p>` : ""}
      ${o.sold ? `<div class="cs-soldtag">Sold</div>` : `<button class="btn ${can ? "btn-primary" : ""}" data-act="buy" data-i="${i}" ${can ? "" : "disabled"}>${coinIconHtml(shopIsl)} ${fmtInt(price)}</button>`}
    </div>`;
  }).join("");
  return tabs + `<div class="cs-offers">${cards}</div>
    <div class="cs-foot"><span id="cs-timer">${shopTimerText()}</span>
    <button class="btn btn-small" data-act="reroll" ${camp.gems >= CAMP.rules.merchant.rerollGems ? "" : "disabled"}>New stock now: ${gemIconHtml()} ${CAMP.rules.merchant.rerollGems}</button></div>`;
}

/* ----- The challenger ----- */
function challengeState(isl) {
  let C = camp.challenges[isl];
  const now = Date.now();
  if (C && C.active && now >= C.endsAt) { C = null; showToast("Your challenge ran out of time. Here's a fresh one."); }
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
  const mods = levels.map(n => {
    const d = campLevelDef(isl, n);
    const ok = modIds.filter(m => !(m === "dark" && d.layout === "tunnel") && !(m === "rocky" && ["maze", "field"].includes(d.layout)) && !(m === "clock" && d.goal.type === "survive" && d.goal.need > 70));
    return ok.sort(() => Math.random() - 0.5).slice(0, CAMP.rules.challenge.modsPerLevel);
  });
  return { levels, mods, done: levels.map(() => false), startedAt: 0, endsAt: 0, claimed: false, active: false };
}

const challengeCurrency = () => Math.round(CAMP.rules.challenge.rewardBase * (1 + upPct("treasure")) * (1 + upPct("mastery")));

function challengerHtml() {
  const C = challengeState(shopIsl);
  saveCamp();
  const modName = id => CAMP.rules.challenge.mods.find(m => m.id === id) || { name: id, text: "" };
  const trials = C.levels.map((n, i) => {
    const d = campLevelDef(shopIsl, n);
    return `<div class="cs-trial ${C.done[i] ? "done" : ""}">
      <div class="cs-tn">${C.done[i] ? "✓" : i + 1}</div>
      <div class="cs-tb"><strong>${n}. ${d.name}</strong><div class="cs-tg">${goalText(d.goal)}${C.mods[i].includes("greedy") ? " (+50%)" : ""}</div>
      <div class="cs-mods">${C.mods[i].map(m => `<span title="${modName(m).text}">${modName(m).name}</span>`).join("")}</div>
      <div class="cs-mt">${C.mods[i].map(m => modName(m).text).join(" ")}</div></div>
      ${C.active && !C.done[i] ? `<button class="btn btn-primary btn-small" data-act="trial" data-i="${i}">Play</button>` : ""}
    </div>`;
  }).join("");
  const pool = CAMP.rules.challenge.pool;
  const total = pool.reduce((a, p) => a + p.weight, 0);
  const odds = pool.map(p => `<span>${p.kind === "gems" ? `${p.min}-${p.max} gems` : p.kind === "item" ? `${rarityName(p.rarity)} item` : p.kind === "skin" ? "Exclusive skin" : "Exclusive theme"}: ${Math.round(p.weight / total * 100)}%</span>`).join("");
  if (C.claimed) return `<p class="cb-note">Challenge done. ${CAMP.islandById[shopIsl].npcs.challenger.name} is planning the next one.</p>
    <div class="cs-trials">${trials}</div><div class="cs-foot"><span id="cs-timer">${shopTimerText()}</span></div>`;
  let foot;
  if (!C.levels.length) foot = `<p class="cb-empty">Win more of this island's levels first.</p>`;
  else if (!C.active) foot = `<button class="btn btn-primary" data-act="accept">Accept the challenge</button>
    <button class="btn btn-small" data-act="newch" ${camp.gems >= CAMP.rules.challenge.rerollGems ? "" : "disabled"}>Different trials: ${gemIconHtml()} ${CAMP.rules.challenge.rerollGems}</button>`;
  else if (C.done.every(Boolean)) foot = `<button class="btn btn-gold" data-act="claim">Claim your reward</button>`;
  else foot = `<span id="cs-timer">${shopTimerText()}</span>`;
  return `<p class="cb-note">${C.active ? "Your challenge is on. Finish all three before time runs out." : `Three trials on this island. Once you accept, you have ${CAMP.rules.challenge.days} days.`}</p>
    <div class="cs-trials">${trials}</div>
    <div class="cs-reward"><div><span class="ch-k">Reward</span> ${coinIconHtml(shopIsl)} <strong>${campMoney(shopIsl, challengeCurrency())}</strong>, plus one roll:</div><div class="cs-odds">${odds}</div></div>
    <div class="cs-foot">${foot}</div>`;
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
    return `${rarityName(pick.rarity)} ${it.name}`;
  }
  const isSkin = pick.kind === "skin";
  const list = CAMP.rules.cosmetics[isSkin ? "exclusiveSkins" : "exclusiveThemes"].filter(id => !(isSkin ? camp.skins : camp.themes).includes(id));
  if (!list.length) { pick = { min: 25, max: 40 }; return gems() + " (you own every exclusive already)"; }
  const id = list[Math.floor(Math.random() * list.length)];
  (isSkin ? camp.skins : camp.themes).push(id);
  const name = isSkin ? (skinById[id] || { name: id }).name : (backdropById[id] || { name: id }).name;
  return `the exclusive ${isSkin ? "skin" : "theme"} ${name || id}`;
}

/* ----- The bank ----- */
const gemUnitCost = isl => CAMP.rules.bank.snaycoinPerGem / Math.pow(CAMP.rules.bank.rateToPrev, campIslandIdx(isl));

function bankHtml() {
  const i = campIslandIdx(shopIsl);
  const B = CAMP.rules.bank;
  const prev = CAMP.islands[i - 1];
  const cur = campCurrency(shopIsl);
  const have = campWallet(shopIsl);
  const per = gemUnitCost(shopIsl);
  const maxGems = Math.max(0, Math.floor(have / per) - B.gemFee);
  let html = `<p class="cb-note">Trades go one way: down the islands, or into gems. Every trade costs a flat fee, so one big trade beats lots of small ones.</p>`;
  if (prev) {
    html += `<div class="bk-card"><h4>${cur.plural} to ${prev.currency.plural}</h4>
      <p>1 ${cur.name} = ${B.rateToPrev} ${prev.currency.plural}, minus ${B.feePrev} ${prev.currency.plural} per trade.</p>
      <div class="bk-row"><input class="text-input bk-in" type="number" min="0" max="${have}" value="${Math.min(have, 10)}" data-amt="prev" id="bk-prev">
      <button class="btn btn-small" data-act="bkset" data-k="prev" data-v="10">10</button><button class="btn btn-small" data-act="bkset" data-k="prev" data-v="100">100</button><button class="btn btn-small" data-act="bkset" data-k="prev" data-v="all">All</button></div>
      <div class="bk-out" id="bk-prev-out"></div>
      <button class="btn btn-primary" data-act="toprev">Trade</button></div>`;
  }
  html += `<div class="bk-card"><h4>${cur.plural} to gems</h4>
    <p>${per >= 1 ? `${fmtInt(per)} ${cur.plural} per gem` : `1 ${cur.name} = ${fmtInt(1 / per)} gems`}, plus ${B.gemFee} gem's worth per trade.</p>
    <div class="bk-row"><input class="text-input bk-in" type="number" min="0" max="${maxGems}" value="${Math.min(maxGems, 1)}" data-amt="gems" id="bk-gems"><span class="bk-unit">gems</span>
    <button class="btn btn-small" data-act="bkset" data-k="gems" data-v="all">Max</button></div>
    <div class="bk-out" id="bk-gems-out"></div>
    <button class="btn btn-primary" data-act="togems">Trade</button></div>`;
  const cash = cashOutPlan();
  html += `<div class="bk-card"><h4>Cash out to gems</h4>
    <p>Everything you hold on this island and every island before it, walked down to Snaycoins one bank at a time (a fee at every step), then into gems.</p>
    <div class="bk-out">${cash.gems > 0 ? `You'd get ${gemIconHtml()} <strong>${fmtInt(cash.gems)}</strong> gems, paying ${cash.fees.join(", ")} in fees.` : "Not enough money to cash out."}</div>
    <button class="btn" data-act="cashout" ${cash.gems > 0 ? "" : "disabled"}>Cash out</button></div>`;
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
    out.innerHTML = n > campWallet(shopIsl) ? "You don't have that many." : got > 0 ? `You get ${coinIconHtml(prev.id)} <strong>${campMoney(prev.id, got)}</strong>` : "Too small to cover the fee.";
  } else {
    const el = document.getElementById("bk-gems"), out = document.getElementById("bk-gems-out");
    if (!el || !out) return;
    const g = Math.max(0, Math.floor(+el.value || 0));
    const cost = Math.ceil((g + B.gemFee) * gemUnitCost(shopIsl) - 1e-9);
    out.innerHTML = g <= 0 ? "Pick how many gems." : cost > campWallet(shopIsl) ? `That needs ${campMoney(shopIsl, cost)}.` : `Costs ${coinIconHtml(shopIsl)} <strong>${campMoney(shopIsl, cost)}</strong> for ${gemIconHtml()} ${g}`;
  }
}

/* Everything from this island down, cascaded to Snaycoins, then to gems */
function cashOutPlan() {
  const B = CAMP.rules.bank;
  const i = campIslandIdx(shopIsl);
  const fees = [];
  let carry = 0;
  const take = {};
  for (let j = i; j >= 1; j--) {
    const id = CAMP.islands[j].id;
    const amt = campWallet(id) + carry;
    take[id] = campWallet(id);
    if (amt <= 0) { carry = 0; continue; }
    carry = Math.max(0, amt * B.rateToPrev - B.feePrev);
    fees.push(`${B.feePrev} ${CAMP.islands[j - 1].currency.plural}`);
  }
  const first = CAMP.islands[0].id;
  take[first] = campWallet(first);
  const snay = campWallet(first) + carry;
  const gems = Math.max(0, Math.floor(snay / B.snaycoinPerGem) - B.gemFee);
  fees.push(`${B.gemFee} gem`);
  const left = gems > 0 ? snay - (gems + B.gemFee) * B.snaycoinPerGem : snay;
  return { gems, fees, take, left };
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
    showToast(`Bought: ${campItemName(it)}${Object.values(camp.equip).includes(it.uid) ? " (equipped)" : ". Equip it from your satchel."}`);
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
    showToast("Challenge accepted. Play the trials from here.");
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
    campStart(shopIsl, C.levels[+d.i], +d.i);
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
    openCampModal(`<h3>Challenge complete!</h3><p>${CAMP.islandById[shopIsl].npcs.challenger.name} hands over ${coinIconHtml(shopIsl)} <strong>${campMoney(shopIsl, money)}</strong>.</p><p class="cs-prize">And the roll: <strong>${prize}</strong>!</p><div class="row-buttons"><button class="btn btn-primary" data-close2>Nice</button></div>`);
    document.querySelector("[data-close2]").addEventListener("click", closeCampModal);
    renderShop();
    return;
  }
  if (a === "bkset") {
    const el = document.getElementById(d.k === "prev" ? "bk-prev" : "bk-gems");
    if (d.v === "all") el.value = d.k === "prev" ? campWallet(shopIsl) : Math.max(0, Math.floor(campWallet(shopIsl) / gemUnitCost(shopIsl)) - B.gemFee);
    else el.value = Math.min(campWallet(shopIsl), +d.v);
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
    showToast(`Traded ${campMoney(shopIsl, n)} for ${campMoney(prev.id, got)}.`);
    renderShop();
    return;
  }
  if (a === "togems") {
    const g = Math.max(0, Math.floor(+document.getElementById("bk-gems").value || 0));
    const cost = Math.ceil((g + B.gemFee) * gemUnitCost(shopIsl) - 1e-9);
    if (g <= 0 || !campSpend(shopIsl, cost)) { sfx("bad"); return; }
    addGems(g);
    campBump("trades"); campCheckAch(); saveCamp(); sfx("buy");
    showToast(`Traded ${campMoney(shopIsl, cost)} for ${g} gems.`);
    renderShop();
    return;
  }
  if (a === "cashout") {
    const plan = cashOutPlan();
    if (plan.gems <= 0) return;
    Object.entries(plan.take).forEach(([id, n]) => { camp.wallet[campCurrency(id).id] -= n; });
    camp.wallet[campCurrency(CAMP.islands[0].id).id] += Math.max(0, Math.round(plan.left));
    addGems(plan.gems);
    campBump("trades"); campCheckAch(); saveCamp(); sfx("medal");
    showToast(`Cashed out for ${plan.gems} gems.`);
    renderShop();
  }
}
