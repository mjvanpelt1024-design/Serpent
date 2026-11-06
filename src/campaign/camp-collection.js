/* =========================================================
   src/campaign/camp-collection.js
   What you've collected, on the game's own screens:
     the Satchel     your kit (equip one of each kind between levels),
                     loot to sell, and your wardrobe
     the Tailor      skins and themes, bought with gems; some are only
                     ever won from quests
     the Trophy Hall the campaign's achievements, each paying gems
   They open from home base (src/campaign/camp-home.js), and Back
   returns there.
   ========================================================= */
"use strict";

BACK_TARGET.inventory = "camphome";
BACK_TARGET.upgrades = "camphome";
BACK_TARGET.achievements = "camphome";
BACK_TARGET.tree = "camphome";

/* ----- Cosmetics for gems ----- */
const isExclusive = (kind, id) => CAMP.rules.cosmetics[kind === "skins" ? "exclusiveSkins" : "exclusiveThemes"].includes(id);
function campCosmeticPrice(kind) {
  const [base, step, cap] = CAMP.rules.cosmetics[kind === "skins" ? "skinPrice" : "themePrice"];
  const owned = (kind === "skins" ? camp.skins : camp.themes).length;
  return Math.min(cap, base + step * Math.max(0, owned - 1));
}
function campOwns(kind, id) { return (kind === "skins" ? camp.skins : camp.themes).includes(id); }
function campBuyCosmetic(kind, id) {
  const price = campCosmeticPrice(kind);
  if (campOwns(kind, id) || isExclusive(kind, id) || camp.gems < price) { sfx("bad"); return; }
  camp.gems -= price;
  (kind === "skins" ? camp.skins : camp.themes).push(id);
  campWearCosmetic(kind, id);
  sfx("buy");
}
function campWearCosmetic(kind, id) {
  if (!campOwns(kind, id)) return;
  if (kind === "skins") camp.skin = id; else camp.theme = id;
  saveCamp();
  applyCampCosmetics();
  persist();
  sfx("tab");
}

(() => {
  const info = cosmeticInfo;
  window.cosmeticInfo = function (kind, id) {
    const out = info.apply(this, arguments);
    if (kind !== "skins" && kind !== "backdrops") return out;
    const owned = campOwns(kind, id), excl = isExclusive(kind, id);
    return Object.assign(out, {
      owned, on: (kind === "skins" ? camp.skin : camp.theme) === id, open: true, reward: excl && !owned,
      price: campCosmeticPrice(kind),
      sub: excl ? `${kind === "skins" ? "Skin" : "Theme"}, won from quests` : out.sub,
      desc: excl && !owned ? "Not for sale. The challengers hand these out to snakes who finish their trials." : out.desc,
      buy: () => campBuyCosmetic(kind, id), equip: () => campWearCosmetic(kind, id)
    });
  };
  const bubble = cosmeticBubble;
  window.cosmeticBubble = function (kind, id, where) {
    const b = bubble.apply(this, arguments);
    if (kind !== "skins" && kind !== "backdrops") return b;
    const i = window.cosmeticInfo(kind, id);
    b.classList.toggle("affordable", !i.owned && !i.reward && camp.gems >= i.price);
    const tag = b.querySelector(".bb-tag");
    if (tag && !i.owned) tag.innerHTML = i.reward ? "Prize" : `<img class="gem-ico" src="${iconUrl("gem", 2)}" alt="">${fmtInt(i.price)}`;
    return b;
  };
  const card = renderBubbleCard;
  window.renderBubbleCard = function (anchor) {
    card.apply(this, arguments);
    if (!bubbleSel || (bubbleSel.kind !== "skins" && bubbleSel.kind !== "backdrops")) return;
    const i = window.cosmeticInfo(bubbleSel.kind, bubbleSel.id);
    const gem = n => `<img class="gem-ico" src="${iconUrl("gem", 2)}" alt="gems"> <b>${fmtInt(n)}</b>`;
    const price = bubbleCardEl.querySelector(".bc-price");
    if (price) price.innerHTML = gem(i.price);
    const buy = bubbleCardEl.querySelector("[data-bb-buy]");
    if (buy) {
      const can = camp.gems >= i.price;
      buy.disabled = !can;
      buy.classList.toggle("btn-gold", can);
      buy.innerHTML = `${can ? "Buy for" : "Need"} ${gem(i.price)}`;
    }
    const act = bubbleCardEl.querySelector(".bc-act");
    if (i.reward && act) act.innerHTML = `<button class="btn" disabled>${LOCK_SVG} Won from quests</button>`;
  };
  const after = afterBubble;
  window.afterBubble = function () {
    after.apply(this, arguments);
    campWalletUpdate();
  };
})();

/* The Tailor: skins and themes only, for gems */
(() => {
  document.querySelectorAll('#screen-upgrades .tab[data-ctab="flair"], #screen-upgrades .tab[data-ctab="avatars"]').forEach(t => { t.hidden = true; });
  const orig = renderTailor;
  window.renderTailor = function (kind) {
    if (kind !== "skins" && kind !== "backdrops") { upgradeTab = "skins"; kind = "skins"; }
    const body = upgradeBodyEl;
    const all = kind === "skins" ? skins : backdrops;
    const ex = all.filter(it => isExclusive(kind, it.id));
    const sale = all.filter(it => !isExclusive(kind, it.id));
    const note = document.createElement("p");
    note.className = "shop-note tailor-note";
    note.innerHTML = sale.every(it => campOwns(kind, it.id)) ? `You own every ${kind === "skins" ? "skin" : "theme"} that's for sale.`
      : `Every ${kind === "skins" ? "skin" : "theme"} costs <strong>${fmtInt(campCosmeticPrice(kind))} gems</strong> right now, a little more for each one you own. Gems come from achievements, quests, level challenges and the banks.`;
    body.appendChild(note);
    body.appendChild(groupHead("Yours", false));
    body.appendChild(bubbleCluster(kind, all.filter(it => campOwns(kind, it.id)).map(it => it.id), "shop"));
    const groups = [...new Set(sale.filter(it => !campOwns(kind, it.id)).map(it => it.group))];
    groups.forEach(gr => {
      body.appendChild(groupHead(gr, false));
      body.appendChild(bubbleCluster(kind, sale.filter(it => it.group === gr && !campOwns(kind, it.id)).map(it => it.id), "shop"));
    });
    const prizes = ex.filter(it => !campOwns(kind, it.id));
    if (prizes.length) {
      body.appendChild(groupHead("Quest prizes", true));
      body.appendChild(bubbleCluster(kind, prizes.map(it => it.id), "shop"));
    }
  };
  document.querySelector("#screen-upgrades .screen-head h2").textContent = "The Tailor";
})();

/* ----- The Satchel: your kit, your loot, your wardrobe ----- */
(() => {
  const tabs = { items: "Kit", cosmetics: "Loot", medals: "Wardrobe" };
  document.querySelectorAll("#screen-inventory .tab[data-inv]").forEach(t => { t.textContent = tabs[t.dataset.inv]; });
  document.querySelector("#screen-inventory .screen-head h2").textContent = "Satchel";
})();

window.renderInventory = function () {
  const body = document.getElementById("inventory-body");
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
  document.querySelectorAll("#screen-inventory .tab[data-inv]").forEach(t => t.setAttribute("aria-selected", String(t.dataset.inv === invTab)));
  document.querySelector("#screen-inventory .subtabs").hidden = true;
  bubbleSel = null;
  bubbleCardEl.className = "bubble-card";
  body.innerHTML = "";
  const empty = text => { const p = document.createElement("div"); p.className = "soon"; p.innerHTML = text; body.appendChild(p); };
  if (invTab === "items") {
    const kit = camp.satchel.filter(it => CARRIED.includes(campItemSlot(it.id)));
    if (!kit.length) { empty("<strong>Nothing to carry yet</strong>Each island's merchant sells one kind of thing: gear on the first island, spells on the second, snacks, familiars, runes. The challengers hand some out too."); return; }
    const note = document.createElement("p");
    note.className = "shop-note";
    note.textContent = "Your kit is one gear, one spell and one rune. Snacks go in your pocket, four at most, eaten with keys 1 to 4 in a level. Change any of it here or just before a level starts.";
    body.appendChild(note);
    const button = (it, on, label, onLabel, fn) => {
      const btn = makeBuyButton(on ? onLabel : label, `inv-${it.uid}`);
      btn.classList.add(on ? "equipped" : "equip");
      btn.addEventListener("click", () => { fn(); saveCamp(); sfx("tab"); renderInventory(); });
      return btn;
    };
    KIT_SLOTS.concat(["food"], KIT_EXTRAS).forEach(slot => {
      const items = kit.filter(it => campItemSlot(it.id) === slot);
      if (!items.length) return;
      const s = CAMP.slots.find(x => x.id === slot);
      body.appendChild(groupHead(`${s.name}: ${s.help}`, false));
      items.sort((x, y) => rarityIdx(y.rarity) - rarityIdx(x.rarity)).forEach(it => {
        const row = document.createElement("div");
        row.className = "shop-row";
        row.innerHTML = `${campItemIconHtml(it)}<div><div class="shop-name" style="color:${rarityColor(it.rarity)}">${escapeAttr(campItemName(it))}</div>
          <div class="shop-desc">${escapeAttr(campItemDef(it.id).does)}</div><div class="shop-meta"><span class="cs-stat">${campItemLeft(it)}</span><span class="cs-weak">Weak: ${escapeAttr(campItemDef(it.id).weak)}</span></div></div>`;
        if (slot === "food") {
          const at = camp.pocket.indexOf(it.uid);
          row.appendChild(button(it, at >= 0, "Pocket it", `In slot ${at + 1}`, () => {
            if (at >= 0) { camp.pocket[at] = 0; return; }
            const free = camp.pocket.indexOf(0);
            if (free < 0) { showToast("Your pocket is full: take a snack out first."); return; }
            camp.pocket[free] = it.uid;
          }));
        } else {
          const on = camp.equip[slot] === it.uid;
          row.appendChild(button(it, on, slot === "pet" ? "Bring" : "Carry", slot === "pet" ? "With you" : "Carrying", () => { if (on) delete camp.equip[slot]; else camp.equip[slot] = it.uid; }));
        }
        body.appendChild(row);
      });
    });
  } else if (invTab === "cosmetics") {
    const loot = camp.satchel.filter(it => campItemSlot(it.id) === "loot");
    if (!loot.length) { empty("<strong>No loot yet</strong>Little treasures turn up during levels. Every merchant buys them."); return; }
    const note = document.createElement("p");
    note.className = "shop-note";
    note.textContent = "Trinkets from your travels. Any merchant buys them, in the money of the island they came from.";
    body.appendChild(note);
    loot.forEach(it => {
      const l = CAMP.lootById[it.id];
      const isl = campItemIsland(it.id);
      const row = document.createElement("div");
      row.className = "shop-row";
      row.innerHTML = `${campItemIconHtml(it)}<div><div class="shop-name">${escapeAttr(l.name)}${it.qty > 1 ? ` x${it.qty}` : ""}</div><div class="shop-desc">Found on ${escapeAttr(CAMP.islands[l.island - 1].name)}</div></div>
        <span class="cs-worth">${coinHtml(isl)} ${fmtInt(campSellPrice(it))}</span>`;
      body.appendChild(row);
    });
  } else {
    body.appendChild(groupHead("Skins", false));
    body.appendChild(bubbleCluster("skins", camp.skins, "inv"));
    body.appendChild(groupHead("Themes", false));
    body.appendChild(bubbleCluster("backdrops", camp.themes, "inv"));
  }
  if (focusKey) { const again = body.querySelector(`[data-key="${focusKey}"]`); if (again) again.focus({ preventScroll: true }); }
};

/* ----- The Trophy Hall: the campaign's achievements ----- */
(() => {
  document.getElementById("ach-book").hidden = true;
  document.getElementById("ach-sort").hidden = true;
  window.renderAchievements = function () {
    document.getElementById("ach-book").hidden = true;
    const list = CAMP.rules.achievements;
    const got = list.filter(a => camp.achievements[a.id]).length;
    achCountEl.textContent = `${fmtInt(got)} / ${fmtInt(list.length)}`;
    achBarEl.style.width = (got / list.length) * 100 + "%";
    achBarWrapEl.setAttribute("aria-valuenow", String(got));
    achBarWrapEl.setAttribute("aria-valuemax", String(list.length));
    document.querySelector("#screen-achievements .ach-count span").textContent = "Achievements";
    const rows = list.map(a => {
      const done = !!camp.achievements[a.id];
      const v = Math.min(campStatValue(a.stat), a.need);
      const pct = done ? 100 : Math.min(100, v / a.need * 100);
      return `<div class="ach-row${done ? " done" : ""}"><div class="ach-top"><span class="ach-name">${escapeAttr(a.name)}${done ? `<span class="medal" style="--m:#ffd23f" role="img" aria-label="Earned"></span>` : ""}</span>
        <span class="ach-prog">${done ? "Complete" : `${fmtInt(v)} / ${fmtInt(a.need)}`}</span></div>
        <div class="ach-desc">${escapeAttr(a.text)}</div>
        <div class="ach-reward">Reward: <img class="gem-ico" src="${iconUrl("gem", 2)}" alt=""> ${fmtInt(a.gems)} gems</div>
        <div class="progress"><span style="width:${pct}%"></span></div></div>`;
    });
    achBodyEl.innerHTML = `<div class="ach-group"><h3><span>The campaign</span><span>${got} / ${list.length}</span></h3>${rows.join("")}</div>`;
  };
})();
