/* =========================================================
   src/campaign/camp-shop-stage.js
   The merchants' shops as pictures (build 51). No list under the
   picture: what's for sale sits in the shop itself, on a shelf with a
   spot for each of five things, three of them stocked (one with a sale
   tag). Click a thing for its card, the bell on the counter for new
   stock, the crate to sell. The sign on the left pans the shop over to
   its workshop, and the keeper slithers across to meet you there:
     Brightscale Keep  the workbench: junk into trinkets and parts, fitted to gear
     Arcanum Spire     the lectern (spell levels) and the seal press
     Feastwood Hollow  the recipe book and the oven: fresh snacks
     Tidecoil Reef     the training lagoon
     Cinder Crown      the rune anvil: five into one
   Pictures are 320 x 100: the workshop on the left, the shop on the right.
   The challenger and the banker keep their own screens (camp-shops.js).
   ========================================================= */
"use strict";

const SS_W = 320, SS_H = 100, SS_ROOM = 160;
const ssEl = document.createElement("div");
ssEl.id = "ss";
ssEl.className = "shop-stage";
ssEl.innerHTML = `<div class="ss-view" id="ss-view">
    <div class="ss-track" id="ss-track"><canvas id="ss-canvas" width="${SS_W}" height="${SS_H}" aria-hidden="true"></canvas><div class="ss-spots" id="ss-spots"></div></div>
    <button class="btn ss-go" id="ss-go"></button>
    <div class="ss-panel" id="ss-panel" role="dialog" aria-live="polite"></div>
  </div>`;
document.getElementById("cs-quote").after(ssEl);
const ssCanvas = document.getElementById("ss-canvas");
const ssSpots = document.getElementById("ss-spots");
const ssPanel = document.getElementById("ss-panel");
const ssGo = document.getElementById("ss-go");
let ssSide = "shop";            // which room is in view: shop or work
let ssKeeper = { x: 288, from: 288, to: 288, at: 0 };
let ssPanelKind = null;         // what the open panel is about
let ssPick = {};                // the panel's choices so far
let ssRaf = 0;
const SPOT_X = i => SS_ROOM + 22 + i * 29;
const SPOT_Y = 29;

ssGo.addEventListener("click", () => ssSwitch(ssSide === "shop" ? "work" : "shop"));

function ssSwitch(side) {
  ssSide = side;
  closeSsPanel();
  ssKeeper = { x: ssKeeper.x, from: ssKeeper.x, to: side === "shop" ? 288 : 92, at: performance.now() };
  sfx("whoosh");
  renderStage();
}

/* ----- Stock: five spots, three stocked; the kitchen keeps one for a recipe ----- */
(() => {
  const orig = merchantStock;
  window.merchantStock = function (isl, force = false) {
    const before = camp.merchants[isl];
    const m = orig.apply(this, arguments);
    // already laid out (every thing in its own spot)? leave it be
    if (m === before && new Set(m.stock.map(o => o.spot)).size === m.stock.length) return m;
    const fam = CAMP.islandById[isl].merchantFamily;
    const all = CAMP.items.filter(i => i.family === fam).map(i => i.id);
    // five things: each has its own spot; bigger families take three spots at random
    const free = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    m.stock.forEach(o => { o.spot = all.length === 5 ? all.indexOf(o.id) : free.pop(); });
    if (fam === "food") {
      const left = Object.values(CAMP.recipeById).filter(r => r.source === "shop" && !camp.recipes.includes(r.id));
      if (left.length) {
        const r = left[Math.floor(Math.random() * left.length)];
        const o = m.stock[m.stock.length - 1];
        Object.assign(o, { id: r.makes, rarity: r.rarity, recipe: r.id, deal: false });
        if (!m.stock.some(x => x.deal)) m.stock[0].deal = true;
      }
    }
    saveCamp();
    return m;
  };
  const price = offerPrice;
  window.offerPrice = function (isl, o) {
    if (o.recipe && CAMP.recipeById[o.recipe]) return Math.max(1, Math.round(recipePrice(CAMP.recipeById[o.recipe]) * (1 - upPct("haggle"))));
    return price.apply(this, arguments);
  };
})();

/* ----- The shop screen: merchants get the picture, the others their lists ----- */
(() => {
  const open = openCampShop;
  window.openCampShop = function (isl, kind) {
    const merchant = kind === "merchant";
    if (merchant && (shopIsl !== isl || currentScreen !== "campshop")) { ssSide = "shop"; ssKeeper = { x: 288, from: 288, to: 288, at: 0 }; closeSsPanel(); }
    open.apply(this, arguments);
    screenEls.campshop.classList.toggle("ss-on", merchant);
    if (merchant && !ssRaf) ssRaf = requestAnimationFrame(ssLoop);
  };
  const render = renderShop;
  window.renderShop = function () {
    if (shopKind !== "merchant") { screenEls.campshop.classList.remove("ss-on"); return render.apply(this, arguments); }
    shopBodyEl.innerHTML = "";
    document.getElementById("cs-wallet").innerHTML = "";
    renderStage();
    campWalletUpdate();
  };
})();

function ssLoop(ts) {
  ssRaf = 0;
  if (currentScreen !== "campshop" || shopKind !== "merchant") return;
  ssRaf = requestAnimationFrame(ssLoop);
  if (Math.floor(ts / 45) === Math.floor((ts - 17) / 45)) return;
  drawStage(ts / 1000, ts);
  const tm = document.getElementById("ss-timer");
  if (tm) tm.textContent = shopTimerText();
  // order timers tick on the panel and the spots
  if (ssPanelKind === "orders" && Math.floor(ts / 1000) !== Math.floor((ts - 45) / 1000)) renderSsPanel();
  if (Math.floor(ts / 1000) !== Math.floor((ts - 45) / 1000)) updateSsBlurbs();
}

/* ----- The hotspots and labels over the picture ----- */
const WS_THINGS = {
  armory: [{ id: "craft", x: 6, y: 34, w: 56, h: 60, label: "Workbench: make trinkets and parts" }, { id: "orders", x: 64, y: 14, w: 40, h: 40, label: "Orders" }, { id: "fit", x: 112, y: 30, w: 40, h: 64, label: "Fitting stand: fit them to your gear" }],
  arcana: [{ id: "upgrade", x: 6, y: 34, w: 52, h: 60, label: "Lectern: spell upgrades" }, { id: "orders", x: 64, y: 14, w: 40, h: 40, label: "Sealed scrolls" }, { id: "seal", x: 112, y: 40, w: 42, h: 54, label: "Seal press: wax seals" }],
  kitchen: [{ id: "cook", x: 6, y: 40, w: 50, h: 54, label: "Recipe book: cook fresh snacks" }, { id: "orders", x: 108, y: 30, w: 46, h: 64, label: "The oven" }, { id: "pantry", x: 62, y: 12, w: 42, h: 40, label: "Pantry: ingredients" }],
  kennel: [{ id: "train", x: 4, y: 46, w: 70, h: 48, label: "Training lagoon" }, { id: "orders", x: 112, y: 16, w: 42, h: 44, label: "Who's away" }],
  forge: [{ id: "forge", x: 6, y: 36, w: 60, h: 58, label: "Rune anvil: five into one" }, { id: "orders", x: 108, y: 18, w: 46, h: 44, label: "Cooling rack" }]
};
function renderStage() {
  const I = CAMP.islandById[shopIsl];
  const ws = workshopOf(shopIsl);
  document.getElementById("ss-track").style.transform = ssSide === "shop" ? "translateX(-50%)" : "translateX(0)";
  ssGo.innerHTML = ssSide === "shop" ? `&#9664; ${escapeAttr(WORKSHOP_NAME[ws])}` : `${escapeAttr(I.npcs.merchant.shop)} &#9654;`;
  ssGo.classList.toggle("right", ssSide === "work");
  ssEl.style.setProperty("--isl", I.colors.accent);
  const pct = (v, of) => (v / of * 100) + "%";
  const spot = (x, y, w, h, label, fn, cls = "", inner = "") => {
    const b = document.createElement("button");
    b.className = "ss-spot " + cls;
    Object.assign(b.style, { left: pct(x, SS_W), top: pct(y, SS_H), width: pct(w, SS_W), height: pct(h, SS_H) });
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = inner;
    b.addEventListener("click", e => { e.stopPropagation(); fn(); });
    ssSpots.appendChild(b);
    return b;
  };
  ssSpots.innerHTML = "";
  // the shop: five spots on the shelf
  const m = merchantStock(shopIsl);
  for (let i = 0; i < 5; i++) {
    const o = m.stock.find(x => x.spot === i);
    const x = SPOT_X(i) - 13, y = SPOT_Y - 14;
    if (!o) { spot(x, y, 26, 30, "An empty spot: out of stock", () => openSsPanel("empty"), "empty", `<span class="ss-tag empty">Out of stock</span>`); continue; }
    const name = o.recipe ? `Recipe: ${CAMP.recipeById[o.recipe].name}` : campItemName({ id: o.id, rarity: o.rarity, grade: -1 });
    const price = offerPrice(shopIsl, o);
    const tag = o.sold ? `<span class="ss-tag sold">Sold</span>` : `<span class="ss-tag price${campWallet(shopIsl) >= price ? " can" : ""}">${coinHtml(shopIsl)}${fmtInt(price)}</span>`;
    const sale = o.deal && !o.sold ? `<span class="ss-sale">-${CAMP.rules.merchant.dealDiscount}%</span>` : "";
    spot(x, y, 26, 30, name + (o.sold ? ", sold" : `, ${fmtInt(price)}`), () => openSsPanel("buy", { i: m.stock.indexOf(o) }), o.sold ? "sold" : "", tag + sale);
  }
  spot(SS_ROOM + 30, 60, 18, 14, "The bell: new stock for gems", () => openSsPanel("bell"), "bell", `<span class="ss-tag gems">New stock</span>`);
  spot(SS_ROOM + 58, 58, 30, 16, "The crate: sell things", () => openSsPanel("sell"), "crate", `<span class="ss-tag sell">Sell</span>`);
  const sign = document.createElement("div");
  sign.className = "ss-sign";
  sign.style.left = pct(SS_ROOM + 96, SS_W);
  sign.innerHTML = `<span id="ss-timer">${escapeAttr(shopTimerText())}</span>`;
  ssSpots.appendChild(sign);
  // the workshop's things
  (WS_THINGS[ws] || []).forEach(th => spot(th.x, th.y, th.w, th.h, th.label, () => openSsPanel(th.id), "ws " + th.id, `<span class="ss-tag ws">${escapeAttr(th.label.split(":")[0])}</span>`));
  updateSsBlurbs();
  if (ssPanelKind) renderSsPanel();
}
/* "Ready!" over the orders, and over the sign that leads to the workshop */
function updateSsBlurbs() {
  if (currentScreen !== "campshop" || shopKind !== "merchant") return;
  const ws = workshopOf(shopIsl);
  const ready = ordersAt(ws).filter(orderReady).length;
  ssGo.classList.toggle("ready", ready > 0 && ssSide === "shop");
  ssGo.dataset.ready = ready ? `${ready} ready!` : "";
  const ord = ssSpots.querySelector(".ss-spot.orders");
  if (ord) ord.classList.toggle("ready", ready > 0);
}

/* ----- The picture -----
   Each island's shop and workshop is three pictures in textures/scenes/shops/<island>/:
     back.png    the walls, under everything that moves on them
     middle.png  the workshop's things and the shop's shelf and awning, over the walls' stars,
                 bubbles or glow (its see-through pixels, like the shadows, shade what's under them;
                 the awning's shadow line is shared/awning-shadow.png, drawn just after it)
     front.png   the counter, bell and crate, in front of the keeper
   and the things that move or change: each a picture of its own, placed and timed here. */
const SS_WALL_FX = {
  // stars twinkling on the Spire's walls, bubbles rising on the Reef's, the Crown's lava light
  spire(g, t) { [0, SS_ROOM].forEach(ox => { for (let i = 0; i < 26; i++) if (Math.sin(t * 2 + i) > 0.2) texDraw(g, "shop:spire:star", ox + (i * 37) % SS_ROOM, (i * 23) % 70); }); },
  reef(g, t) { [0, SS_ROOM].forEach(ox => { for (let i = 0; i < 6; i++) { const ph = (t * 0.3 + i / 6) % 1; texPaint(g, "shop:reef:bubble", Math.round(ox + 10 + i * 26 + Math.sin(t + i) * 2), Math.round(70 - ph * 64), { alpha: 0.7 }); } }); },
  crown(g, t) { [0, SS_ROOM].forEach(ox => texPaint(g, "shop:crown:wall-glow", ox, 50, { alpha: 0.12 + Math.sin(t * 1.3) * 0.04 })); }
};
/* The order shelf's parcels: busy or ready (a glint blinking over a ready one) */
function ssParcels(g, ws, x, y, w, t) {
  const orders = ordersAt(ws);
  for (let i = 0; i < ORDER_SLOTS; i++) {
    const o = orders[i], sx = x + 4 + i * Math.floor((w - 8) / 3);
    if (!o) continue;
    const done = orderReady(o);
    texDraw(g, "shop:parcel", sx, y + 8, done ? 1 : 0);
    if (done && Math.sin(t * 4 + i) > 0) texDraw(g, "shop:glint", sx + 3, y + 4);
  }
}
const SS_WORK_FX = {
  // the forge's mouth flickers; the gear you wear stands on the dummy
  armory(g, t, fl) {
    texDraw(g, "shop:keep:forge", 16, 62, fl(1) + 1);
    ssParcels(g, "armory", 64, 18, 40, t);
    const it = campEquipped("gear");
    if (it) g.drawImage(texCanvas("ci:" + it.id, "ci:shield"), 128, 56, 18, 18);
  },
  // motes drift up off the book, the candles by the press flicker
  arcana(g, t, fl) {
    for (let i = 0; i < 6; i++) { const ph = (t * 0.5 + i / 6) % 1; texPaint(g, "shop:spire:mote", 18 + i * 5, Math.round(52 - ph * 20), { alpha: 1 - ph }); }
    ssParcels(g, "arcana", 64, 18, 40, t);
    [118, 148].forEach((x, i) => texDraw(g, "shop:spire:flame", x, 37 + fl(i)));
  },
  // the oven's fire flickers, steam rises from the chimney, a dot per batch in the oven
  kitchen(g, t, fl) {
    texDraw(g, "shop:hollow:oven", 118, 64, fl(2) + 1);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3) % 1; texPaint(g, "shop:hollow:steam", Math.round(126 + Math.sin(t + i) * 2), Math.round(20 - ph * 18), { alpha: 0.6 - ph * 0.6 }); }
    ordersAt("kitchen").forEach((o, i) => texDraw(g, "shop:hollow:batch", 120 + i * 8, 58, orderReady(o) ? 1 : 0));
  },
  // ripples on the lagoon, hoops bobbing, the familiars away training, and the board of who's away
  kennel(g, t) {
    for (let x = 6; x < 74; x += 6) texDraw(g, "shop:reef:wave", x + Math.round(Math.sin(t * 2 + x) * 1), 70);
    [[18, 60], [40, 56], [62, 62]].forEach(([x, y], i) => texDraw(g, "shop:reef:hoop", x - 6, y + Math.round(Math.sin(t * 2 + i) * 1), i));
    const away = ordersAt("kennel");
    away.forEach((o, i) => { const it = satchelItem(o.uid); if (it && !orderReady(o)) drawPetSprite(g, it.id, 10 + i * 22, 70 + Math.round(Math.sin(t * 3 + i) * 2), 12, t * 1000, { shells: 1 }); });
    away.forEach((o, i) => texDraw(g, "shop:reef:board-row", 119, 24 + i * 10, orderReady(o) ? 1 : 0));
  },
  // the lava river ripples, the anvil glows, the rune on it sits in the glow
  forge(g, t) {
    for (let x = 4; x < 74; x += 5) texDraw(g, "shop:crown:ripple", x, 84 + (Math.sin(t * 3 + x) > 0 ? 0 : 1));
    texPaint(g, "shop:crown:anvil-glow", 12, 40, { alpha: 0.25 + Math.sin(t * 2) * 0.1 });
    texDraw(g, "shop:crown:anvil-rune", 30, 52);
    ssParcels(g, "forge", 110, 22, 42, t);
  }
};
function drawStage(t, ts) {
  const g = ssCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const ws = workshopOf(shopIsl);
  const fl = n => Math.round(Math.sin(t * 9 + n) * 1);
  texDraw(g, `shop:${shopIsl}:back`, 0, 0);
  if (SS_WALL_FX[shopIsl]) SS_WALL_FX[shopIsl](g, t);
  texLayer(g, `shop:${shopIsl}:middle`, 0, 0);
  texPaint(g, "shop:awning-shadow", SS_ROOM, 10);
  SS_WORK_FX[ws](g, t, fl);
  // the shop's five spots: a thing on each stocked one (a shadow, a rarity ribbon, maybe a sale
  // tag), an "out of stock" box on the rest
  const m = camp.merchants[shopIsl];
  for (let i = 0; i < 5; i++) {
    const x = SPOT_X(i), o = m && m.stock.find(s => s.spot === i);
    if (!o) { texDraw(g, "shop:sold-out", x - 8, 21); continue; }
    const bob = o.sold ? 0 : Math.round(Math.sin(t * 2 + i) * 0.7);
    g.globalAlpha = o.sold ? 0.3 : 1;
    const id = o.recipe ? "scroll" : CAMP.itemById[o.id].family === "rune" ? `ci:${o.id}:${RUNE_GRADES8[rarityIdx(o.rarity) * 2]}` : "ci:" + o.id;
    g.drawImage(texCanvas(id, "gift"), x - 12, 16 + bob, 24, 24);
    g.globalAlpha = 1;
    texPaint(g, "shop:item-shadow", x - 10, 40, { alpha: 0.25 });
    texPaint(g, "shop:ribbon", x - 11, 43, { colors: { ribbon: rarityColor(o.rarity) } });
    if (o.deal && !o.sold) texDraw(g, "shop:sale-tag", x + 6, 13);
  }
  // the keeper: slithers between the rooms, a wiggle as it goes
  const k = ssKeeper;
  const p = Math.min(1, (ts - k.at) / 1400);
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  k.x = k.from + (k.to - k.from) * e;
  const moving = p < 1 && k.from !== k.to;
  // behind the counter in the shop, standing on the floor in the workshop
  const kx = Math.round(k.x), ky = Math.round(98 - 16 * Math.max(0, Math.min(1, (k.x - 92) / 196))) + (moving ? Math.round(Math.sin(t * 22) * 1) : 0);
  g.save();
  if (moving && k.to < k.from) { g.translate(kx * 2, 0); g.scale(-1, 1); }
  // the keeper, four times the size of the one on the map
  g.scale(4, 4);
  drawKeeper(g, shopIsl, "merchant", Math.round(kx / 4), Math.round(ky / 4), t);
  g.restore();
  // the counter in front of the keeper, and a lantern swinging over it
  texDraw(g, `shop:${shopIsl}:front`, 0, 0);
  texDraw(g, "shop:lantern", SS_ROOM + 148 + Math.round(Math.sin(t * 1.4) * 2), 11);
}

/* ----- The panels: a card or a workshop page laid over the picture ----- */
function openSsPanel(kind, pick = {}) {
  ssPanelKind = kind;
  ssPick = pick;
  sfx("tab");
  renderSsPanel();
}
function closeSsPanel() { ssPanelKind = null; ssPick = {}; ssPanel.classList.remove("open"); ssPanel.innerHTML = ""; }
const ssTile = (it, opts = {}) => {
  const icon = it.kind === "recipe" ? `<img src="${iconUrl("scroll", 3)}" alt="">` : `<img src="${CAMP.itemById[it.id] && CAMP.itemById[it.id].family === "rune" ? runeIconUrl(it, 3) : iconUrl("ci:" + it.id, 3)}" alt="">`;
  const color = opts.color || (CAMP.itemById[it.id] ? rarityColor(it.rarity) : CAMP.lootById[it.id] ? LOOT_GRADE_COLOR()[lootGrade(it.id)] : "#ffd23f");
  return `<button class="ss-tile${opts.on ? " on" : ""}${opts.off ? " off" : ""}" style="--rc:${color}" ${opts.data || ""} title="${escapeAttr(opts.title || "")}">${icon}${opts.badge ? `<span class="ss-tb">${opts.badge}</span>` : ""}</button>`;
};
function renderSsPanel() {
  if (!ssPanelKind) return;
  const fn = SS_PANELS[ssPanelKind];
  if (!fn) { closeSsPanel(); return; }
  const out = fn();
  ssPanel.innerHTML = `<button class="ss-x" aria-label="Close">&times;</button>${out}`;
  ssPanel.classList.add("open");
  ssPanel.querySelector(".ss-x").addEventListener("click", closeSsPanel);
  ssPanel.querySelectorAll("[data-ss]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); ssAct(b.dataset.ss, b.dataset); }));
}
const ssHead = (title, sub) => `<h3 class="ss-h">${escapeAttr(title)}</h3>${sub ? `<p class="ss-sub">${sub}</p>` : ""}`;
const ssWho = () => CAMP.islandById[shopIsl].npcs.merchant;
const hrs = h => (h >= 24 ? `${Math.round(h / 24 * 10) / 10} day${h === 24 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"}`);

const SS_PANELS = {
  /* --- the shop --- */
  buy() {
    const m = merchantStock(shopIsl), o = m.stock[ssPick.i];
    if (!o) return "";
    const price = offerPrice(shopIsl, o), can = !o.sold && campWallet(shopIsl) >= price;
    if (o.recipe) {
      const r = CAMP.recipeById[o.recipe], bill = recipeBill(r);
      return ssHead(r.name, `Recipe · makes a fresh ${rarityName(r.rarity).toLowerCase()} ${escapeAttr(campItemDef(r.makes).name)}`) +
        `<p class="ss-p">Learn it once, cook it in the workshop as often as you like. Ingredients: ${r.needs.map(id => escapeAttr(CAMP.ingredientById[id].name)).join(", ")} (${Object.entries(bill).map(([isl, n]) => `${coinHtml(isl)}${fmtInt(n)}`).join(" ")} a batch).</p>` +
        `<div class="ss-acts">${o.sold ? `<button class="btn" disabled>Learned</button>` : `<button class="btn ${can ? "btn-gold" : ""}" data-ss="buy" data-i="${ssPick.i}" ${can ? "" : "disabled"}>${can ? "Buy" : "Need"} ${coinHtml(shopIsl)} ${fmtInt(price)}</button>`}</div>`;
    }
    const d = campItemDef(o.id);
    return `<div class="ss-card">${campItemIconHtml({ id: o.id, rarity: o.rarity, grade: -1 }, "big")}<div>` +
      ssHead(campItemName({ id: o.id, rarity: o.rarity, grade: -1 }), `${escapeAttr(CAMP.slots.find(s => s.id === CAMP.families[d.family].slot).name)}${o.deal && !o.sold ? ` · <span class="cs-deal">${CAMP.rules.merchant.dealDiscount}% off</span>` : ""}`) + `</div></div>` +
      itemFacts(o.id, o.rarity) +
      `<div class="ss-acts">${o.sold ? `<button class="btn" disabled>Sold</button>` : `<button class="btn ${can ? "btn-gold" : ""}" data-ss="buy" data-i="${ssPick.i}" ${can ? "" : "disabled"}>${can ? "Buy for" : "Need"} ${coinHtml(shopIsl)} ${fmtInt(price)}</button>`}</div>`;
  },
  empty() { return ssHead("Out of stock", `"${escapeAttr(ssWho().name)} shrugs. Something new comes in with the next delivery."`) + `<p class="ss-p">${escapeAttr(shopTimerText())}.</p>`; },
  bell() {
    const g = CAMP.rules.merchant.rerollGems, can = camp.gems >= g;
    return ssHead("Ring for new stock?", "Everything on the shelf goes back, and three new things come out.") +
      `<div class="ss-acts"><button class="btn ${can ? "btn-gold" : ""}" data-ss="reroll" ${can ? "" : "disabled"}>Ring it: ${gemTag(g)}</button></div>`;
  },
  sell() {
    const list = camp.satchel.filter(it => !itemAway(it.uid)).sort((a, b) => (campItemSlot(a.id) === "loot") - (campItemSlot(b.id) === "loot") || a.uid - b.uid);
    const sel = list.find(it => it.uid === ssPick.uid) || null;
    const tiles = list.map(it => ssTile(it, { on: sel === it, data: `data-ss="pick" data-uid="${it.uid}"`, badge: it.qty > 1 ? "x" + it.qty : Object.values(camp.equip).includes(it.uid) ? "on" : "", title: campItemName(it) })).join("");
    const detail = sel ? `<div class="ss-sel"><b style="color:${CAMP.itemById[sel.id] ? rarityColor(sel.rarity) : "#e8e0c8"}">${escapeAttr(campItemName(sel))}</b>${Object.values(camp.equip).includes(sel.uid) ? " (you're using it: selling takes it off)" : ""}${CAMP.itemById[sel.id] && ["gear", "spell"].includes(campItemSlot(sel.id)) && (sel.parts.length > builtInParts(sel.id, sel.rarity).length || sel.trinket || sel.lv) ? ` <span class="cs-weak">Its upgrades go with it.</span>` : ""}
      <button class="btn btn-gold" data-ss="sell" data-uid="${sel.uid}">Sell for ${coinTag(campItemIsland(sel.id), campSellPrice(sel))}</button></div>` : `<p class="ss-p">Pick something to sell. You're paid in the money of the island it came from.</p>`;
    return ssHead("The crate", "Anything sells here.") + (list.length ? `<div class="ss-tiles">${tiles}</div>${detail}` : `<p class="ss-p">You have nothing to sell.</p>`);
  },

  /* --- every workshop's orders --- */
  orders() {
    const ws = workshopOf(shopIsl);
    const rows = [];
    for (let i = 0; i < ORDER_SLOTS; i++) {
      const o = ordersAt(ws)[i];
      if (!o) { rows.push(`<div class="ss-order empty"><span class="ss-oslot">${i + 1}</span><span>Free</span></div>`); continue; }
      const done = orderReady(o), pct = Math.min(100, (Date.now() - o.at) / Math.max(1, o.readyAt - o.at) * 100);
      const icon = o.kind === "craft" ? iconUrl("ci:" + o.what, 3) : o.kind === "cook" ? iconUrl("ci:" + CAMP.recipeById[o.what].makes, 3) : o.kind === "forge" ? iconUrl(`ci:${o.what}:${RUNE_GRADES8[o.grade]}`, 3) : satchelItem(o.uid) ? iconUrl("ci:" + satchelItem(o.uid).id, 3) : iconUrl("gift", 3);
      rows.push(`<div class="ss-order${done ? " done" : ""}"><img src="${icon}" alt=""><div class="ss-oinfo"><b>${escapeAttr(orderLabel(o))}</b><span class="ss-bar"><i style="width:${pct.toFixed(1)}%"></i></span><small>${done ? "Ready to pick up!" : `Ready in ${fmtLeft(o.readyAt - Date.now())}`}</small></div>${done ? `<button class="btn btn-gold" data-ss="collect" data-n="${o.n}">Collect</button>` : ["seal", "train"].includes(o.kind) ? `<button class="btn btn-small" data-ss="cancel" data-n="${o.n}">Call back</button>` : ""}</div>`);
    }
    return ssHead(WORKSHOP_NAME[ws], `Three orders at a time. ${escapeAttr(ssWho().name)} keeps them safe until you pick them up.`) + rows.join("");
  },

  /* --- the armory --- */
  craft() {
    const all = (CRAFT.trinkets || []).concat(CRAFT.parts || []);
    const sel = CAMP.craftById[ssPick.id] || all[0];
    const tiles = all.map(c => ssTile({ id: c.id, rarity: "common" }, { on: c === sel, color: c.stat ? "#ffd23f" : "#9aa3ad", data: `data-ss="pickc" data-id="${c.id}"`, title: c.name, off: !canCraft(c), badge: c.stat ? "" : c.fits === "weapon" ? "W" : "A" })).join("");
    const needs = sel.needs.map(id => { const l = CAMP.lootById[id], have = haveLoot(id); return `<span class="ss-need${have ? " ok" : ""}" title="${escapeAttr(l.name)}"><img src="${iconUrl("ci:" + id, 2)}" alt=""><span>${escapeAttr(l.name)}</span><b>${have}/1</b></span>`; }).join("");
    const full = ordersAt("armory").length >= ORDER_SLOTS;
    return ssHead("The workbench", "Junk from your travels, made into trinkets and parts. The recipes never change.") +
      `<div class="ss-tiles">${tiles}</div><div class="ss-sel"><b>${escapeAttr(sel.name)}</b> <small>${sel.stat ? "Trinket" : `Part for ${sel.fits === "weapon" ? "weapons" : "armor"}`} · ${hrs(craftHours(sel))}</small><p class="ss-p">${escapeAttr(craftFacts(sel))}</p><div class="ss-needs">${needs}</div>
      <button class="btn ${canCraft(sel) && !full ? "btn-gold" : ""}" data-ss="craft" data-id="${sel.id}" ${canCraft(sel) && !full ? "" : "disabled"}>${full ? "All three order slots are busy" : canCraft(sel) ? `Make it (${hrs(craftHours(sel))})` : "Missing materials"}</button></div>`;
  },
  fit() {
    const gear = camp.satchel.filter(it => campItemSlot(it.id) === "gear");
    const g = gear.find(x => x.uid === ssPick.gear) || null;
    const pieces = camp.satchel.filter(it => campItemSlot(it.id) === "craft");
    if (!gear.length) return ssHead("The fitting stand", "You have no gear to fit anything to yet.");
    let html = ssHead("The fitting stand", "Fit a trinket or a part to a piece of gear, for good. One trinket per piece; each part once.") +
      `<p class="ss-step">1. The gear</p><div class="ss-tiles">${gear.map(it => ssTile(it, { on: it === g, data: `data-ss="pickg" data-uid="${it.uid}"`, title: campItemName(it), badge: it.trinket ? "★" : "" })).join("")}</div>`;
    if (g) {
      html += `<p class="ss-p"><b>${escapeAttr(campItemName(g))}</b>: ${escapeAttr(campItemLeft(g))}. Parts: ${partsFor(g.id).map(p => `<span class="pi-tag${g.parts.includes(p.id) ? " on" : ""}">${escapeAttr(p.name)}</span>`).join(" ")} · Trinket: ${g.trinket ? `<span class="pi-tag on">${escapeAttr(CAMP.craftById[g.trinket].name)}</span>` : "none"}</p>`;
      const fits = pieces.filter(p => { const c = CAMP.craftById[p.id]; return c.stat ? !g.trinket : c.fits === gearClass(g.id) && !g.parts.includes(p.id); });
      html += `<p class="ss-step">2. What to fit</p>` + (fits.length ? `<div class="ss-tiles">${fits.map(p => ssTile(p, { on: p.uid === ssPick.piece, data: `data-ss="pickp" data-uid="${p.uid}"`, title: CAMP.craftById[p.id].name, badge: p.qty > 1 ? "x" + p.qty : "" })).join("")}</div>` : `<p class="ss-p">Nothing you've made fits this piece. Make trinkets and parts at the workbench.</p>`);
      const p = satchelItem(ssPick.piece);
      if (p && fits.includes(p)) html += `<div class="ss-sel"><p class="ss-p">${escapeAttr(CAMP.craftById[p.id].name)}: ${escapeAttr(craftFacts(CAMP.craftById[p.id]))} It can never come off.</p><button class="btn btn-gold" data-ss="fit">Fit it for good</button></div>`;
    }
    return html;
  },

  /* --- the arcana --- */
  upgrade() {
    const spells = camp.satchel.filter(it => campItemSlot(it.id) === "spell");
    const s = spells.find(x => x.uid === ssPick.uid) || spells[0];
    let html = ssHead("The lectern", `Spell upgrade points: <b class="ss-pts">${fmtInt(camp.spellPts)}</b>. They come from a daily gift, quests, level challenges, casting, or gems.`);
    html += `<div class="ss-acts"><button class="btn btn-small ${camp.gems >= SP.gemsPerPoint ? "btn-gold" : ""}" data-ss="buypt" ${camp.gems >= SP.gemsPerPoint ? "" : "disabled"}>+1 point: ${gemTag(SP.gemsPerPoint)}</button></div>`;
    if (!spells.length) return html + `<p class="ss-p">You have no spells yet.</p>`;
    html += `<div class="ss-tiles">${spells.map(it => ssTile(it, { on: it === s, data: `data-ss="picks" data-uid="${it.uid}"`, title: campItemName(it), badge: it.seal ? "seal" : it.lv ? "+" + it.lv : "", off: itemAway(it.uid) })).join("")}</div>`;
    let pips = "";
    for (let i = 0; i < SP.maxLevel; i++) pips += `<i class="${i < s.lv ? "on" : ""}"></i>`;
    const cost = s.lv < SP.maxLevel ? spellLevelCost(s.lv) : 0;
    const why = s.seal ? "Sealed: its points are locked in." : itemAway(s.uid) ? "Away being sealed." : "";
    html += `<div class="ss-sel"><b>${escapeAttr(campItemName(s))}</b><p class="ss-p"><span class="pi-pips">${pips}</span> Level ${s.lv}/${SP.maxLevel} · ${escapeAttr(campItemLeft(s))}${campItemDef(s.id).power ? ` · ${campItemPower(s)} ${campItemDef(s.id).unit}` : ""}</p>
      <p class="ss-p">Each level: +${SP.powerPerLevel}% power; an extra charge at levels ${SP.chargeAt.join(", ")}. ${s.lv < SP.maxLevel ? `Next level: ${cost} point${cost === 1 ? "" : "s"}.` : "It's at its best."}</p>
      ${why ? `<p class="ss-p cs-weak">${why}</p>` : `<div class="ss-acts"><button class="btn" data-ss="spdown" data-uid="${s.uid}" ${s.lv ? "" : "disabled"}>Take a level back</button><button class="btn ${s.lv < SP.maxLevel && camp.spellPts >= cost ? "btn-gold" : ""}" data-ss="spup" data-uid="${s.uid}" ${s.lv < SP.maxLevel && camp.spellPts >= cost ? "" : "disabled"}>Level up (${cost})</button></div>`}
      <p class="ss-p"><small>Sell a spell and its points go with it, though a higher level sells for a little more.</small></p></div>`;
    return html;
  },
  seal() {
    const spells = camp.satchel.filter(it => campItemSlot(it.id) === "spell" && !it.seal && !itemAway(it.uid));
    const s = spells.find(x => x.uid === ssPick.uid) || null;
    const S = SP.seal || {};
    let html = ssHead("The seal press", `A wax seal locks a spell's level for good (no points in or out) and adds +${S.power}% power and ${S.charges} charge. It takes ${hrs(S.hours || 8)}, and an uncommon or rare piece of junk for the wax.`);
    if (!spells.length) return html + `<p class="ss-p">No spell to seal: sealed ones can't be sealed again.</p>`;
    html += `<p class="ss-step">1. The spell</p><div class="ss-tiles">${spells.map(it => ssTile(it, { on: it === s, data: `data-ss="pickseal" data-uid="${it.uid}"`, title: campItemName(it), badge: it.lv ? "+" + it.lv : "" })).join("")}</div>`;
    if (s) {
      const junk = camp.satchel.filter(it => CAMP.lootById[it.id] && (S.grades || []).includes(lootGrade(it.id)));
      html += `<p class="ss-step">2. The offering</p>` + (junk.length ? `<div class="ss-tiles">${junk.map(it => ssTile(it, { on: it.uid === ssPick.junk, data: `data-ss="pickjunk" data-uid="${it.uid}"`, title: CAMP.lootById[it.id].name, badge: it.qty > 1 ? "x" + it.qty : "" })).join("")}</div>` : `<p class="ss-p">You need an uncommon or rare piece of junk.</p>`);
      const full = ordersAt("arcana").length >= ORDER_SLOTS;
      if (satchelItem(ssPick.junk)) html += `<div class="ss-sel"><p class="ss-p">Seal your ${escapeAttr(campItemName(s))} at level ${s.lv}? You can't change its level after. It's away for ${hrs(S.hours || 8)}.</p><button class="btn ${full ? "" : "btn-gold"}" data-ss="seal" ${full ? "disabled" : ""}>${full ? "All three slots are busy" : "Seal it"}</button></div>`;
    }
    return html;
  },

  /* --- the kitchen --- */
  cook() {
    const known = camp.recipes.map(id => CAMP.recipeById[id]).filter(Boolean);
    if (!known.length) return ssHead("The recipe book", "You don't know any recipes yet. One is always for sale on the shelf; others turn up in levels or come from quests.");
    const r = CAMP.recipeById[ssPick.id] || known[0];
    const bill = recipeBill(r), can = canPayBill(bill), full = ordersAt("kitchen").length >= ORDER_SLOTS, h = KT.hours[rarityIdx(r.rarity)];
    return ssHead("The recipe book", "Pick a recipe, buy its ingredients, and it comes out of the oven fresh: one charge better than the shop's.") +
      `<div class="ss-tiles">${known.map(x => ssTile({ id: x.makes, rarity: x.rarity }, { on: x === r, data: `data-ss="pickr" data-id="${x.id}"`, title: x.name, off: !canPayBill(recipeBill(x)) })).join("")}</div>` +
      `<div class="ss-sel"><b style="color:${rarityColor(r.rarity)}">${escapeAttr(r.name)}</b> <small>makes a fresh ${rarityName(r.rarity).toLowerCase()} ${escapeAttr(campItemDef(r.makes).name)} · ${hrs(h)}</small>
      <div class="ss-needs">${r.needs.map(id => { const i = CAMP.ingredientById[id]; return `<span class="ss-need ok">${coinHtml(i.island)}<span>${escapeAttr(i.name)}</span><b>${fmtInt(Math.round(i.price * (1 + rarityIdx(r.rarity) * 0.5)))}</b></span>`; }).join("")}</div>
      <p class="ss-p">Total: ${Object.entries(bill).map(([isl, n]) => `<span class="${campWallet(isl) >= n ? "" : "cs-weak"}">${coinHtml(isl)}${fmtInt(n)}</span>`).join(" ")}</p>
      <button class="btn ${can && !full ? "btn-gold" : ""}" data-ss="cook" data-id="${r.id}" ${can && !full ? "" : "disabled"}>${full ? "The oven is full" : can ? `Buy the ingredients and bake (${hrs(h)})` : "Not enough money"}</button></div>`;
  },
  pantry() {
    const by = {};
    (CRAFT.ingredients || []).forEach(i => (by[i.island] = by[i.island] || []).push(i));
    return ssHead("The pantry", "Ingredients come from every island and cost each island's money. Most recipes use this island's and the two below it; the best ones need the islands above.") +
      Object.entries(by).map(([isl, list]) => `<p class="ss-p"><b>${escapeAttr(CAMP.islandById[isl].name)}</b>: ${list.map(i => `${escapeAttr(i.name)} ${coinHtml(isl)}${i.price}`).join(", ")}</p>`).join("");
  },

  /* --- the kennel --- */
  train() {
    const pets = camp.satchel.filter(it => campItemSlot(it.id) === "pet");
    if (!pets.length) return ssHead("The training lagoon", "You have no familiars yet.");
    const p = pets.find(x => x.uid === ssPick.uid) || pets[0];
    const lv = p.train || 0, away = itemAway(p.uid), full = ordersAt("kennel").length >= ORDER_SLOTS;
    const price = TR.price[lv], h = TR.hours[lv], can = lv < TR.maxLevel && !away && !full && campWallet(shopIsl) >= price;
    return ssHead("The training lagoon", `A familiar goes away to train for a while and comes back ${TR.better}% better. Swap in another while it's gone.`) +
      `<div class="ss-tiles">${pets.map(it => ssTile(it, { on: it === p, data: `data-ss="pickpet" data-uid="${it.uid}"`, title: campItemName(it), badge: "★".repeat(it.train || 0), off: itemAway(it.uid) })).join("")}</div>` +
      `<div class="ss-sel"><b>${escapeAttr(campItemName(p))}</b> <small>${"★".repeat(lv)}${"☆".repeat(TR.maxLevel - lv)} · ${escapeAttr(campItemDef(p.id).does)}</small>
      <p class="ss-p">${lv >= TR.maxLevel ? "Fully trained." : away ? "Away training right now." : `Next: ${hrs(h)} away, ${coinHtml(shopIsl)}${fmtInt(price)}. Power ${campItemPower(p)} → ${petPower(Object.assign({}, p, { train: lv + 1 }), campItemDef(p.id).power[rarityIdx(p.rarity)])} ${escapeAttr(campItemDef(p.id).unit)}.`}</p>
      ${lv < TR.maxLevel && !away ? `<button class="btn ${can ? "btn-gold" : ""}" data-ss="train" data-uid="${p.uid}" ${can ? "" : "disabled"}>${full ? "Three are away already" : can ? "Send it to train" : "Not enough money"}</button>` : ""}</div>`;
  },

  /* --- the rune forge --- */
  forge() {
    const stacks = forgeStacks().sort((a, b) => b.list.length - a.list.length || a.id.localeCompare(b.id));
    if (!stacks.length) return ssHead("The rune anvil", "Five runes of the same kind and condition forge into one of the next: broken into refurbished, cracked into repaired, fine into polished, pristine into legendary.") + `<p class="ss-p">You have no runes to forge.</p>`;
    const sel = stacks.find(s => s.id + ":" + s.grade === ssPick.k) || stacks[0];
    const enough = sel.list.length >= FG.need, full = ordersAt("forge").length >= ORDER_SLOTS, h = FG.hours[sel.grade / 2];
    return ssHead("The rune anvil", "Five of a kind, same condition, become one of the next condition: a little under the condition it copies, but legendary is past pristine.") +
      `<div class="ss-tiles">${stacks.map(s => ssTile(s.list[0], { on: s === sel, data: `data-ss="pickst" data-k="${s.id}:${s.grade}"`, title: `${FG.grades[s.grade]} ${campItemDef(s.id).name}`, badge: `${s.list.length}/${FG.need}`, off: s.list.length < FG.need })).join("")}</div>` +
      `<div class="ss-sel"><b>${FG.grades[sel.grade]} ${escapeAttr(campItemDef(sel.id).name)}</b> → <b>${FG.grades[sel.grade + 1]}</b> <small>${hrs(h)}</small>
      <p class="ss-p">${escapeAttr(runeSentence(runeWords({ id: sel.id, rarity: gradeRarity(sel.grade + 1), grade: sel.grade + 1 }, "long").good))} <span class="cs-weak">${escapeAttr(runeSentence(runeWords({ id: sel.id, rarity: gradeRarity(sel.grade + 1), grade: sel.grade + 1 }, "long").bad))}</span></p>
      <button class="btn ${enough && !full ? "btn-gold" : ""}" data-ss="forge" data-k="${sel.id}:${sel.grade}" ${enough && !full ? "" : "disabled"}>${full ? "The rack is full" : enough ? `Forge ${FG.need} into 1` : `Need ${FG.need - sel.list.length} more`}</button></div>`;
  }
};

/* ----- Clicks on the panels ----- */
function ssAct(a, d) {
  const toast = s => { if (s) showToast(s); };
  const done = () => { saveCamp(); campWalletUpdate(); renderStage(); };
  if (a === "pick") { ssPick.uid = +d.uid; renderSsPanel(); return; }
  if (a === "pickc") { ssPick.id = d.id; renderSsPanel(); return; }
  if (a === "pickg") { ssPick = { gear: +d.uid }; renderSsPanel(); return; }
  if (a === "pickp") { ssPick.piece = +d.uid; renderSsPanel(); return; }
  if (a === "picks" || a === "pickpet") { ssPick.uid = +d.uid; renderSsPanel(); return; }
  if (a === "pickseal") { ssPick = { uid: +d.uid }; renderSsPanel(); return; }
  if (a === "pickjunk") { ssPick.junk = +d.uid; renderSsPanel(); return; }
  if (a === "pickr") { ssPick.id = d.id; renderSsPanel(); return; }
  if (a === "pickst") { ssPick.k = d.k; renderSsPanel(); return; }
  if (a === "buy") {
    const m = merchantStock(shopIsl), o = m.stock[+d.i];
    const price = offerPrice(shopIsl, o);
    if (!o || o.sold || !campSpend(shopIsl, price)) { sfx("bad"); return; }
    o.sold = true;
    if (o.recipe) { if (!camp.recipes.includes(o.recipe)) camp.recipes.push(o.recipe); toast(`Learned: ${CAMP.recipeById[o.recipe].name}. Cook it in the kitchen.`); }
    else { const it = campGive(o.id, o.rarity); campBump("itemsBought"); campCheckAch(); toast(`Bought: ${campItemName(it)}.`); }
    sfx("buy"); closeSsPanel(); done(); return;
  }
  if (a === "reroll") {
    if (camp.gems < CAMP.rules.merchant.rerollGems) return;
    camp.gems -= CAMP.rules.merchant.rerollGems;
    merchantStock(shopIsl, true);
    sfx("shimmer"); closeSsPanel(); done(); return;
  }
  if (a === "sell") {
    const it = satchelItem(+d.uid);
    if (!it) return;
    campPay(campItemIsland(it.id), campSellPrice(it));
    if (it.qty > 1) it.qty--; else { campDrop(it.uid); ssPick.uid = null; }
    sfx("buy"); done(); return;
  }
  if (a === "collect") { toast(campCollect(+d.n)); sfx("medal"); done(); return; }
  if (a === "cancel") { campCancelOrder(+d.n); toast("Called back. It's home again, nothing changed."); done(); return; }
  if (a === "craft") {
    const c = CAMP.craftById[d.id];
    if (!c || !canCraft(c) || ordersAt("armory").length >= ORDER_SLOTS) { sfx("bad"); return; }
    c.needs.forEach(id => takeLoot(id, 1));
    campOrder("armory", c.id, craftHours(c));
    sfx("rock"); toast(`${ssWho().name} starts on your ${c.name}. Back in ${hrs(craftHours(c))}.`); done(); return;
  }
  if (a === "fit") {
    const why = campFit(ssPick.gear, ssPick.piece);
    if (why) { showToast(why); sfx("bad"); return; }
    sfx("medal"); toast("Fitted, for good."); ssPick = { gear: ssPick.gear }; done(); return;
  }
  if (a === "buypt") { if (camp.gems < SP.gemsPerPoint) return; camp.gems -= SP.gemsPerPoint; camp.spellPts++; sfx("shimmer"); done(); return; }
  if (a === "spup" || a === "spdown") { const why = campSpellUp(+d.uid, a === "spup" ? 1 : -1); if (why) { showToast(why); sfx("bad"); return; } sfx(a === "spup" ? "shimmer" : "tab"); done(); return; }
  if (a === "seal") {
    const s = satchelItem(ssPick.uid), j = satchelItem(ssPick.junk);
    if (!s || !j || s.seal || ordersAt("arcana").length >= ORDER_SLOTS) { sfx("bad"); return; }
    takeLoot(j.id, 1);
    campOrder("arcana", s.id, (SP.seal || {}).hours || 8, { uid: s.uid });
    sfx("rock"); toast(`Your ${campItemDef(s.id).name} goes under the press. Back in ${hrs((SP.seal || {}).hours || 8)}.`); ssPick = {}; done(); return;
  }
  if (a === "cook") {
    const r = CAMP.recipeById[d.id], bill = recipeBill(r);
    if (!canPayBill(bill) || ordersAt("kitchen").length >= ORDER_SLOTS) { sfx("bad"); return; }
    Object.entries(bill).forEach(([isl, n]) => campSpend(isl, n));
    campOrder("kitchen", r.id, KT.hours[rarityIdx(r.rarity)], { rarity: r.rarity });
    sfx("buy"); toast(`Into the oven: ${r.name}. Ready in ${hrs(KT.hours[rarityIdx(r.rarity)])}.`); done(); return;
  }
  if (a === "train") {
    const p = satchelItem(+d.uid), lv = p ? p.train || 0 : 9;
    if (!p || lv >= TR.maxLevel || itemAway(p.uid) || ordersAt("kennel").length >= ORDER_SLOTS || !campSpend(shopIsl, TR.price[lv])) { sfx("bad"); return; }
    campOrder("kennel", p.id, TR.hours[lv], { uid: p.uid });
    sfx("portal"); toast(`${campItemDef(p.id).name} swims off to train. Back in ${hrs(TR.hours[lv])}.`); done(); return;
  }
  if (a === "forge") {
    const [id, gs] = d.k.split(":"), gr = +gs;
    const st = forgeStacks().find(s => s.id === id && s.grade === gr);
    if (!st || st.list.length < FG.need || ordersAt("forge").length >= ORDER_SLOTS) { sfx("bad"); return; }
    // the active rune goes last
    const use = st.list.sort((x, y) => (camp.equip.rune === x.uid) - (camp.equip.rune === y.uid)).slice(0, FG.need);
    use.forEach(it => campDrop(it.uid));
    campOrder("forge", id, FG.hours[gr / 2], { grade: gr + 1, rarity: gradeRarity(gr + 1) });
    sfx("rock"); toast(`Five go into the fire. A ${FG.grades[gr + 1]} ${campItemDef(id).name} in ${hrs(FG.hours[gr / 2])}.`); done(); return;
  }
}

/* ----- Ready orders on the map: a blurb over the merchant's stall, and a note in the corner ----- */
const orderNotesEl = document.createElement("div");
orderNotesEl.id = "order-notes";
orderNotesEl.className = "order-notes";
document.getElementById("screen-modes").appendChild(orderNotesEl);
function renderOrderNotices() {
  if (!camp) return;
  const ready = readyOrders();
  const byIsl = {};
  ready.forEach(o => { byIsl[o.isl] = (byIsl[o.isl] || 0) + 1; });
  document.querySelectorAll("#map-pins .map-pin.node.merchant").forEach(pin => {
    const isl = pin.dataset.area, n = byIsl[isl] || 0;
    let b = pin.querySelector(".order-blurb");
    if (n && !b) { b = document.createElement("span"); b.className = "order-blurb"; pin.appendChild(b); }
    if (b) { if (n) b.textContent = n > 1 ? `${n} orders ready!` : "Order ready!"; else b.remove(); }
  });
  orderNotesEl.innerHTML = Object.entries(byIsl).map(([isl, n]) => {
    const I = CAMP.islandById[isl];
    return `<button class="on-note plate" data-isl="${isl}"><img src="${iconUrl("gift", 2)}" alt=""><span><b>${n > 1 ? `${n} orders` : "An order"} ready</b><small>${escapeAttr(I.npcs.merchant.shop)}, ${escapeAttr(I.name)}</small></span></button>`;
  }).join("");
  orderNotesEl.querySelectorAll("[data-isl]").forEach(b => b.addEventListener("click", () => {
    const isl = b.dataset.isl;
    if (!campShopOpen(isl, "merchant")) return;
    openCampShop(isl, "merchant");
    ssSwitch("work");
    openSsPanel("orders");
  }));
}
(() => {
  const modes = renderModes;
  window.renderModes = function () { modes.apply(this, arguments); renderOrderNotices(); };
})();
