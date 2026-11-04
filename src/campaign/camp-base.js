/* =========================================================
   src/campaign/camp-base.js
   The panels behind home base. Home itself is on the map: each island's
   home islet has its tree and, once you have something for them, the
   keepsakes under it (src/campaign/camp-map.js). Clicking those opens:
     the tree     the upgrade trees (every open island's, paid in its currency)
     the satchel  everything you carry, and what you take into levels
     the trophy   achievements
     the mirror   skins (gems)
     the easel    themes (gems)
   Also here: the modal every campaign panel opens in.
   ========================================================= */
"use strict";

/* ----- The modal every campaign panel uses ----- */
let campModalOpen = false;
let campModalAfter = null;
function openCampModal(html, opts = {}) {
  const el = document.getElementById("camp-modal");
  el.querySelector(".camp-modal-box").innerHTML = `<button class="cm-x" data-close aria-label="Close">×</button>` + html;
  el.querySelector(".camp-modal-box").className = "camp-modal-box " + (opts.cls || "");
  el.classList.add("active");
  campModalOpen = true;
  campModalAfter = opts.after || null;
  el.querySelector("[data-close]").addEventListener("click", closeCampModal);
}
function closeCampModal() {
  const el = document.getElementById("camp-modal");
  el.classList.remove("active");
  campModalOpen = false;
  const after = campModalAfter;
  campModalAfter = null;
  if (currentScreen === "camp") { cmTopbar(); cmCard(); cmSpots(); }
  if (after) after();
}

/* ----- Upgrades ----- */
let upTab = null;
function openUpgradesPanel(isl) {
  upTab = isl;
  renderUpgrades();
}
function renderUpgrades() {
  const open = CAMP.islands.filter(i => campIslandOpen(i.id));
  if (!open.some(i => i.id === upTab)) upTab = open[0].id;
  const I = CAMP.islandById[upTab];
  const tabs = open.map(i => `<button class="tab" data-up="${i.id}" aria-selected="${i.id === upTab}">${i.name}</button>`).join("");
  const rows = I.tree.upgrades.map(u => {
    const t = upTier(u.id), max = u.values.length - 1;
    const now = u.text.replace("{v}", fmtInt(u.values[t]));
    const next = t < max ? u.text.replace("{v}", fmtInt(u.values[t + 1])) : null;
    const price = upNextPrice(u.id);
    const can = price !== null && campWallet(upTab) >= price;
    let pips = "";
    for (let i = 0; i < max; i++) pips += `<i class="${i < t ? "on" : ""}"></i>`;
    return `<div class="up-row ${t >= max ? "maxed" : ""}">
      <img class="up-ico" src="${campUpIconUrl(u.icon)}" alt="">
      <div class="up-body"><div class="up-name">${u.name} <span class="ch-pips">${pips}</span></div>
        <div class="up-now">${t ? "Now: " + now : "Not yet grown"}</div>
        ${next ? `<div class="up-next">Next: ${next}</div>` : `<div class="up-next">Fully grown</div>`}</div>
      ${price !== null ? `<button class="btn btn-small ${can ? "btn-primary" : ""}" data-buy="${u.id}" ${can ? "" : "disabled"}>${coinIconHtml(upTab)} ${fmtInt(price)}</button>` : ""}
    </div>`;
  }).join("");
  openCampModal(`<h3>${I.tree.name}</h3>
    <p class="cb-note">Every upgrade works on every island. Each tree is paid in its own island's currency: you have ${coinIconHtml(upTab)} <strong>${campMoney(upTab, campWallet(upTab))}</strong>.</p>
    <div class="tabs cb-tabs">${tabs}</div><div class="up-list">${rows}</div>`, { cls: "wide" });
  const box = document.querySelector("#camp-modal .camp-modal-box");
  box.querySelectorAll("[data-up]").forEach(b => b.addEventListener("click", () => { upTab = b.dataset.up; sfx("tab"); renderUpgrades(); }));
  box.querySelectorAll("[data-buy]").forEach(b => b.addEventListener("click", () => {
    if (campBuyUpgrade(b.dataset.buy)) { sfx("buy"); showToast(`${CAMP.upgradeById[b.dataset.buy].name} grew!`); }
    else sfx("bad");
    renderUpgrades();
  }));
}

/* ----- The satchel: everything you carry, and the five slots ----- */
let satSel = null;
function openSatchel(after) {
  satSel = null;
  renderSatchel(after);
}
function renderSatchel(after) {
  const slots = CAMP.slots.map(s => {
    const it = campEquipped(s.id);
    return `<button class="sat-slot ${it ? "" : "empty"}" data-slot="${s.id}" title="${s.help}">
      ${it ? campItemIconHtml(it) : `<span class="ci-icon empty"></span>`}
      <span class="sat-k">${s.name}</span><span class="sat-v">${it ? `<span style="color:${rarityColor(it.rarity)}">${campItemDef(it.id).name}</span>${itUsesText(it)}` : "Empty"}</span></button>`;
  }).join("");
  const groups = CAMP.slots.map(s => ({ s, items: camp.satchel.filter(it => campItemSlot(it.id) === s.id) })).filter(x => x.items.length);
  const loot = camp.satchel.filter(it => campItemSlot(it.id) === "loot");
  const card = it => `<button class="sat-item ${satSel === it.uid ? "sel" : ""} ${Object.values(camp.equip).includes(it.uid) ? "on" : ""}" data-it="${it.uid}">${campItemIconHtml(it)}${it.qty > 1 ? `<b class="sat-q">×${it.qty}</b>` : ""}</button>`;
  const list = groups.map(x => `<div class="sat-group"><div class="sat-gh">${x.s.name}</div><div class="sat-grid">${x.items.map(card).join("")}</div></div>`).join("") +
    (loot.length ? `<div class="sat-group"><div class="sat-gh">Trinkets</div><div class="sat-grid">${loot.map(card).join("")}</div></div>` : "");
  const sel = camp.satchel.find(it => it.uid === satSel);
  openCampModal(`<h3>Satchel</h3>
    <p class="cb-note">A snake has no hands: one of each kind at a time. Swap freely between levels.</p>
    <div class="sat-slots">${slots}</div>
    <div class="sat-body"><div class="sat-list">${list || `<p class="cb-empty">Nothing yet. Merchants open after each island's first boss.</p>`}</div>
    <div class="sat-detail">${sel ? itemDetailHtml(sel) : `<p class="cb-empty">Pick something to see what it does.</p>`}</div></div>`, { cls: "wide", after });
  const box = document.querySelector("#camp-modal .camp-modal-box");
  box.querySelectorAll("[data-it]").forEach(b => b.addEventListener("click", () => { satSel = +b.dataset.it; sfx("tab"); renderSatchel(after); }));
  box.querySelectorAll("[data-slot]").forEach(b => b.addEventListener("click", () => { const it = campEquipped(b.dataset.slot); if (it) { satSel = it.uid; renderSatchel(after); } }));
  const eq = box.querySelector("[data-equip]");
  if (eq) eq.addEventListener("click", () => {
    const it = camp.satchel.find(x => x.uid === satSel);
    const slot = campItemSlot(it.id);
    if (camp.equip[slot] === it.uid) delete camp.equip[slot]; else camp.equip[slot] = it.uid;
    saveCamp(); sfx("toggle"); renderSatchel(after);
  });
}
function itUsesText(it) {
  const slot = campItemSlot(it.id);
  if (slot === "gear") return ` · ${it.uses} use${it.uses === 1 ? "" : "s"}`;
  if (slot === "spell" || slot === "food") return ` · ${it.uses} charge${it.uses === 1 ? "" : "s"}`;
  if (slot === "rune" && it.qty > 1) return ` · ×${it.qty}`;
  return "";
}
function itemDetailHtml(it) {
  const d = campItemDef(it.id);
  if (!d) {
    const l = CAMP.lootById[it.id];
    return `<div class="sat-dh">${campItemIconHtml(it, "big")}<div><h4>${l.name}</h4><div class="sat-r">Trinket ×${it.qty}</div></div></div>
      <p>Worth ${coinIconHtml(campItemIsland(it.id))} ${campMoney(campItemIsland(it.id), campSellPrice(it))} each to a merchant. Collect them, or sell them.</p>`;
  }
  const slot = campItemSlot(it.id);
  const on = camp.equip[slot] === it.uid;
  const r = rarityIdx(it.rarity);
  const stat = d.power ? `<div class="sat-stat">${d.power[r]} ${d.unit}</div>` : "";
  return `<div class="sat-dh">${campItemIconHtml(it, "big")}<div><h4 style="color:${rarityColor(it.rarity)}">${campItemName(it)}</h4><div class="sat-r">${CAMP.slots.find(s => s.id === slot).name}${itUsesText(it)}</div></div></div>
    ${stat}<p>${d.does}</p>
    <p class="sat-good"><strong>Good against:</strong> ${d.strong}</p>
    <p class="sat-bad"><strong>Weakness:</strong> ${d.weak}</p>
    ${it.rarity === "legendary" ? `<p class="sat-leg"><strong>Legendary:</strong> ${d.legend}</p>` : `<p class="sat-dim">Legendary: ${d.legend}</p>`}
    <button class="btn ${on ? "" : "btn-primary"}" data-equip>${on ? "Take off" : "Equip"}</button>`;
}

/* ----- Achievements ----- */
function openAchievementsPanel() {
  const list = CAMP.rules.achievements.map(a => {
    const have = Math.min(a.need, campStatValue(a.stat)), done = camp.achievements[a.id];
    return `<div class="ach-row2 ${done ? "done" : ""}"><div><div class="ach-n">${a.name}</div><div class="ach-t">${a.text}</div>
      <div class="ch-bar"><span style="width:${(have / a.need * 100).toFixed(1)}%"></span></div></div>
      <div class="ach-g">${done ? "✓" : `${fmtInt(have)} / ${fmtInt(a.need)}`}<br>${gemIconHtml()} ${a.gems}</div></div>`;
  }).join("");
  const n = CAMP.rules.achievements.filter(a => camp.achievements[a.id]).length;
  openCampModal(`<h3>Achievements</h3><p class="cb-note">${n} of ${CAMP.rules.achievements.length} earned. Each one pays gems.</p><div class="ach-list2">${list}</div>`, { cls: "wide" });
}

/* ----- Skins and themes, bought with gems ----- */
const cosmeticPrice = (kind, i) => { const p = CAMP.rules.cosmetics[kind === "skin" ? "skinPrice" : "themePrice"]; return Math.min(p[2], p[0] + p[1] * i); };
function skinPreviewUrl(skin) {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 24;
  const g = c.getContext("2d");
  for (let i = 0; i < 6; i++) { g.fillStyle = skinVisibleColor(skin, skinColorAt(skin, 5 - i, 0)); g.fillRect(i * 16, 4, 15, 15); }
  g.fillStyle = "#fff"; g.fillRect(84, 7, 3, 3); g.fillRect(84, 13, 3, 3);
  return c.toDataURL();
}
function themePreviewUrl(bd) {
  const c = document.createElement("canvas");
  c.width = 80; c.height = 50;
  const g = c.getContext("2d");
  try { paintBackdrop(g, bd, 80, 50); } catch (e) { g.fillStyle = "#222"; g.fillRect(0, 0, 80, 50); }
  return c.toDataURL();
}
function openSkinsPanel() { renderCosmetics("skin"); }
function openThemesPanel() { renderCosmetics("theme"); }
function renderCosmetics(kind) {
  const isSkin = kind === "skin";
  const list = isSkin ? skins : backdrops;
  const owned = isSkin ? camp.skins : camp.themes;
  const cur = isSkin ? camp.skin : camp.theme;
  const excl = CAMP.rules.cosmetics[isSkin ? "exclusiveSkins" : "exclusiveThemes"];
  const cards = list.map((it, i) => {
    const have = owned.includes(it.id), ex = excl.includes(it.id);
    const price = cosmeticPrice(kind, i);
    const img = isSkin ? skinPreviewUrl(it) : themePreviewUrl(it);
    let btn;
    if (it.id === cur) btn = `<span class="cos-on">Wearing</span>`;
    else if (have) btn = `<button class="btn btn-small" data-wear="${it.id}">Use</button>`;
    else if (ex) btn = `<span class="cos-ex">Challenge reward</span>`;
    else btn = `<button class="btn btn-small ${camp.gems >= price ? "btn-primary" : ""}" data-buyc="${it.id}" data-p="${price}" ${camp.gems >= price ? "" : "disabled"}>${gemIconHtml()} ${price}</button>`;
    return `<div class="cos-card ${have ? "own" : ""} ${ex && !have ? "excl" : ""}"><img src="${img}" alt=""><div class="cos-n">${it.name || it.id}</div>${btn}</div>`;
  }).join("");
  openCampModal(`<h3>${isSkin ? "Skins" : "Themes"}</h3><p class="cb-note">You have ${gemIconHtml()} <strong>${fmtInt(camp.gems)}</strong> gems. ${CAMP.rules.gems.storeSoon} Some are only won from challenges.</p><div class="cos-grid">${cards}</div>`, { cls: "wide" });
  const box = document.querySelector("#camp-modal .camp-modal-box");
  box.querySelectorAll("[data-wear]").forEach(b => b.addEventListener("click", () => {
    if (isSkin) camp.skin = b.dataset.wear; else camp.theme = b.dataset.wear;
    saveCamp(); applyCampCosmetics(); sfx("toggle"); renderCosmetics(kind);
  }));
  box.querySelectorAll("[data-buyc]").forEach(b => b.addEventListener("click", () => {
    const p = +b.dataset.p;
    if (camp.gems < p) { sfx("bad"); return; }
    camp.gems -= p;
    owned.push(b.dataset.buyc);
    if (isSkin) camp.skin = b.dataset.buyc; else camp.theme = b.dataset.buyc;
    saveCamp(); applyCampCosmetics(); sfx("buy"); renderCosmetics(kind);
  }));
}
