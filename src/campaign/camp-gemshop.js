/* =========================================================
   src/campaign/camp-gemshop.js
   The gem shop (build 53): click your gems in the top bar.
   Gem packs, a power-up bundle, two boosters kept in the save, and a free
   daily gift. The offers are data: content/campaign/rules.json "gems.store".

   PLACEHOLDER for real-money purchases. In development every offer is free:
   buying one only adds its gems or boosters to the save. Everything goes
   through gemStorePay(offer), the ONE place a real payment provider gets
   wired in later (it must resolve true only once the payment has cleared).

   Boosters (camp.boosts), counted in levels started:
     surge  power-ups turn up more often   (rules gems.surgeRate)
     lucky  loot drops more often          (rules gems.luckyRate)
   ========================================================= */
"use strict";

CAMP_REPAIRS.push(c => {
  if (!c.boosts) c.boosts = { surge: 0, lucky: 0 };
  if (!c.gemBought) c.gemBought = {};
  if (!c.gemDaily) c.gemDaily = 0;
});

const gemOffers = () => (CAMP.rules.gems.store || []);
const gemDailyReady = () => !!camp && (camp.gemDaily || 0) < dayNumber();

/* The one payment door. Development: always approved, nothing is charged.
   Later: call the store here with offer.id and offer.price, and resolve true only on a cleared payment. */
function gemStorePay(offer) {
  return Promise.resolve(true);
}

/* Buys an offer: pays (see above), then adds what it holds to the save */
function gemStoreBuy(id) {
  const o = gemOffers().find(x => x.id === id);
  if (!o || !camp) return Promise.resolve(false);
  if (o.daily && !gemDailyReady()) { sfx("bad"); return Promise.resolve(false); }
  return gemStorePay(o).then(ok => {
    if (!ok) return false;
    if (o.daily) camp.gemDaily = dayNumber();
    if (o.gems) addGems(o.gems);
    Object.entries(o.boosts || {}).forEach(([k, n]) => { camp.boosts[k] = Math.min(9999, (camp.boosts[k] || 0) + n); });
    camp.gemBought[o.id] = (camp.gemBought[o.id] || 0) + 1;
    campChanged();
    sfx("shimmer");
    showToast(`${o.name}: ${gemOfferWhat(o)}`);
    return true;
  });
}

function gemOfferWhat(o) {
  const bits = [];
  if (o.gems) bits.push(`+${fmtInt(o.gems)} gems`);
  if (o.boosts && o.boosts.surge) bits.push(`${o.boosts.surge} levels of power-up surge`);
  if (o.boosts && o.boosts.lucky) bits.push(`${o.boosts.lucky} levels of lucky finds`);
  return bits.join(", ");
}

/* Called as a campaign level starts: uses up one level of each booster that's running.
   Returns the multipliers for this level. */
function gemBoostsForLevel() {
  const G = CAMP.rules.gems, b = camp && camp.boosts;
  if (!b) return { surge: 1, lucky: 1 };
  const out = { surge: b.surge > 0 ? (G.surgeRate || 2) : 1, lucky: b.lucky > 0 ? (G.luckyRate || 1.5) : 1 };
  if (b.surge > 0) b.surge--;
  if (b.lucky > 0) b.lucky--;
  return out;
}

/* ----- The screen ----- */
let gemShopEl = null;

function openGemShop() {
  if (!camp) return;
  if (!gemShopEl) {
    gemShopEl = document.createElement("div");
    gemShopEl.id = "gemshop";
    gemShopEl.className = "modal";
    gemShopEl.setAttribute("role", "dialog");
    gemShopEl.setAttribute("aria-modal", "true");
    gemShopEl.setAttribute("aria-label", "Gem shop");
    document.body.appendChild(gemShopEl);
    gemShopEl.addEventListener("click", e => {
      if (e.target === gemShopEl || e.target.closest("[data-gs-close]")) { closeGemShop(); return; }
      const b = e.target.closest("[data-gs-buy]");
      if (b && !b.disabled) { b.disabled = true; gemStoreBuy(b.dataset.gsBuy).then(() => renderGemShop()); }
    });
    document.addEventListener("keydown", e => {
      if (gemShopEl && gemShopEl.classList.contains("active") && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeGemShop(); }
    }, true);
  }
  renderGemShop();
  gemShopEl.classList.add("active");
  sfx("click");
}

function closeGemShop() {
  if (gemShopEl) gemShopEl.classList.remove("active");
  campWalletUpdate();
}

function renderGemShop() {
  const gem = (n = 3) => `<img class="gem-ico" src="${iconUrl("gem", n)}" alt="">`;
  const b = camp.boosts || {};
  const card = o => {
    const ready = !o.daily || gemDailyReady();
    const price = o.daily ? (ready ? "Free" : "Tomorrow") : "Free (dev)";
    return `<div class="gs-offer${o.daily ? " daily" : ""}${ready ? "" : " spent"}">
      ${o.tag ? `<span class="gs-tag">${escapeAttr(ready ? o.tag : "Taken")}</span>` : ""}
      <div class="gs-pic">${o.gems && !o.daily ? gem(o.gems >= 500 ? 4 : 3) : ""}${o.daily ? `<img class="gs-ico" src="${iconUrl("gift", 3)}" alt="">` : ""}${o.boosts && o.boosts.surge ? `<img class="gs-ico" src="${iconUrl("bolt", 3)}" alt="">` : ""}${o.boosts && o.boosts.lucky ? `<img class="gs-ico" src="${iconUrl("clover", 3)}" alt="">` : ""}</div>
      <div class="gs-name">${escapeAttr(o.name)}</div>
      <div class="gs-what">${escapeAttr(o.text || gemOfferWhat(o))}</div>
      <button class="btn btn-small ${ready ? "btn-gold" : ""}" data-gs-buy="${o.id}" ${ready ? "" : "disabled"} title="${o.daily ? "Once a day" : "In development every offer is free"}">${price}</button>
    </div>`;
  };
  gemShopEl.innerHTML = `<div class="modal-box gs-box">
    <div class="gs-head">${gem(4)}<b class="gs-count">${fmtInt(camp.gems)}</b>
      <span class="gs-boosts">${b.surge ? `<span title="Power-up surge: levels left"><img class="gs-ico" src="${iconUrl("bolt", 2)}" alt="">${b.surge}</span>` : ""}${b.lucky ? `<span title="Lucky finds: levels left"><img class="gs-ico" src="${iconUrl("clover", 2)}" alt="">${b.lucky}</span>` : ""}</span>
      <button class="btn btn-small gs-x" data-gs-close aria-label="Close">✕</button></div>
    <div class="gs-grid">${gemOffers().map(card).join("")}</div>
    <p class="gs-note">Development build: every offer is free and only adds to this save.</p>
  </div>`;
}

/* The gems in the top bar open the shop */
document.addEventListener("click", e => {
  const chip = e.target.closest && e.target.closest("#camp-wallet .cw-chip.gems");
  if (chip) { e.stopPropagation(); openGemShop(); }
}, true);
