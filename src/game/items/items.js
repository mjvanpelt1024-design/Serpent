/* =========================================================
   src/game/items/items.js
   One-time items and Flair (from content/), and medals
   ========================================================= */
"use strict";

/* =========================================================
   One-time items, Inventory, Flair and medals
   ========================================================= */
/* One-time items: content/items/*.item (their prices are in content/economy.txt) */
const CONSUMABLES = Object.fromEntries(CONTENT.items.map(it => [it.id, Object.assign({ name: it.name || it.id, desc: it.description || "" }, it.boost ? { boost: true } : {})]));
const CONSUMABLE_KEYS = Object.keys(CONSUMABLES);
const BOOSTER_MULT = 1.2;
const PRICE_GROWTH = 1.1;
const MAX_GOLD_BROUGHT = 5;
let runBoosts = {};        // what the current run is using
let pendingBoosts = {};    // picked in the loadout, applied by the next startGame
let goldHearts = 0;        // gold hearts still in play this run

/* Prices follow how much XP you earn in a typical run, and creep up with each purchase */
function niceRound(n) {
  const step = n < 100 ? 5 : n < 1000 ? 10 : n < 10000 ? 50 : n < 100000 ? 500 : 5000;
  return Math.max(step, Math.round(n / step) * step);
}

/* A share of a good run on your best island (src/game/economy/ladder.js) */
function consumablePrice(key) {
  return itemPrice(key);
}

function buyConsumable(key) {
  const price = consumablePrice(key);
  if (!spendXp(price)) return;
  save.consumables[key] = Math.min(999, save.consumables[key] + 1);
  save.consumableBought[key]++;
  persist();
  sfx("buy");
  updateHud();
  renderUpgradeBody();
}

function hasBoostItems() {
  return CONSUMABLE_KEYS.some(k => (CONSUMABLES[k].boost || k === "goldheart") && save.consumables[k] > 0);
}

/* ----- Flair: fixed prices, one item per slot, everything can come off ----- */
const FLAIR_SLOTS = CONTENT.flairSlots.map(r => [String(r[0]), String(r[1])]);       // content/flair/slots.dat
/* Every piece of Flair: content/flair/*.flair. Prices: flairStep (economy.txt) x priceRank */
const FLAIR = CONTENT.flair.map(f => {
  const it = { id: f.id, slot: String(f.slot), name: f.name || f.id, price: 0 };
  if (typeof f.priceRank === "number") it.priceRank = f.priceRank;
  if (f.set) it.set = String(f.set);
  if (f.reward) it.reward = true;
  return it;
});
const FLAIR_BY_ID = Object.fromEntries(FLAIR.map(f => [f.id, f]));

function buyFlair(id) {
  const f = FLAIR_BY_ID[id];
  if (!f || save.ownedFlair.includes(id) || !spendBucks(f.price)) return;
  save.ownedFlair.push(id);
  save.flair[f.slot] = id;       // wear it right away
  persist();
  sfx("buy");
  showToast(`${f.name} is in your Inventory, and you're wearing it.`);
  updateHud();
  checkBadges();
  renderUpgradeBody();
}

function toggleFlair(slot, id) {
  save.flair[slot] = save.flair[slot] === id ? null : id;
  persist();
  sfx("click");
  renderInventory();
}

/* ----- Medals: max out a badge path to earn its medal ----- */
/* Each island's color in menus and medals: the medal line of its world.txt */
const MEDAL_COLORS = Object.assign({ general: "#ffd23f" },
  Object.fromEntries(MODE_KEYS.map(k => [k, String(CONTENT.worlds[k].info.medal || "#9be870")])));

function medalEarned(f) {
  const have = earnedSet();
  return f.tiers.every(t => have.has(f.id + ":" + t));
}

function earnedMedals() {
  return BADGE_FAMILIES.filter(medalEarned);
}

function medalColor(f) {
  return MEDAL_COLORS[f.group] || "#ffd23f";
}

function equipMedal(id) {
  const key = "medal:" + id;
  save.flair.cape = save.flair.cape === key ? null : key;
  persist();
  sfx("click");
  renderInventory();
}

/* Small icons for one-time items */
function drawConsumableIcon(g, key, s) {
  g.clearRect(0, 0, s, s);
  const k = s / 40;
  g.save();
  if (key === "goldheart") {
    g.fillStyle = "#ffcf33";
    g.translate(s / 2, s / 2);
    g.scale(k * 1.35, k * 1.35);
    g.translate(-12, -12);
    g.fill(new Path2D(HEART_SVG_PATH));
  } else if (key === "revive") {
    g.fillStyle = "#3ddc3d";
    g.fillRect(16 * k, 7 * k, 8 * k, 26 * k);
    g.fillRect(7 * k, 16 * k, 26 * k, 8 * k);
  } else if (key === "booster") {
    g.fillStyle = "#ffd23f";
    g.font = `700 ${15 * k}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("x1.2", s / 2, s / 2 + k);
  } else if (key === "doubleapple") {
    drawItem(g, "apple", 5 * k, 12 * k, 1, false, 1, 0, 16 * k);
    drawItem(g, "apple", 19 * k, 12 * k, 1, false, 1, 0, 16 * k);
  } else if (key === "repellent") {
    drawItem(g, "popsicle", 11 * k, 9 * k, 1, false, 1, 0, 18 * k);
    g.strokeStyle = "#ff5a61";
    g.lineWidth = 3.5 * k;
    g.beginPath();
    g.arc(s / 2, s / 2, 15 * k, 0, Math.PI * 2);
    g.moveTo(9 * k, 9 * k);
    g.lineTo(31 * k, 31 * k);
    g.stroke();
  } else if (key === "magnet") {
    drawItem(g, "xp", 13 * k, 13 * k, 1, false, 1, 0, 15 * k);
    g.strokeStyle = "#ff5a61";
    g.lineWidth = 4 * k;
    g.beginPath();
    g.arc(s / 2, 16 * k, 12 * k, Math.PI, 0);
    g.stroke();
  }
  g.restore();
}

function iconCanvas(key, size = 36) {
  const c = document.createElement("canvas");
  c.width = size * 2;
  c.height = size * 2;
  c.className = "item-icon";
  c.style.width = size + "px";
  c.style.height = size + "px";
  drawConsumableIcon(c.getContext("2d"), key, size * 2);
  return c;
}

/* A little snake wearing flair, for the Shop and Inventory */
function flairPreview(flairSet, w = 120, h = 50, bare = false) {
  const c = document.createElement("canvas");
  c.width = w * 2;
  c.height = h * 2;
  c.className = "flair-preview";
  c.style.width = w + "px";
  c.style.height = h + "px";
  const g = c.getContext("2d");
  g.scale(2, 2);
  if (!bare) {
    g.fillStyle = currentBackdrop().base;
    g.fillRect(0, 0, w, h);
  }
  const big = w <= 140;
  const u = big ? 18 : 16;
  const n = big ? 6 : Math.floor((w - 12) / u);
  const segs = [];
  const y = h - u - 5;
  const onlyTail = big && Object.keys(flairSet).length === 1 && flairSet.tail;
  // Tail items: show the tail end in view; everything else: the head end
  const headX = onlyTail ? w + u * 2 : w - 10 - u;
  for (let i = 0; i < n; i++) segs.push({ x: headX - i * u, y });
  const skin = currentSkin();
  for (let i = n - 1; i >= 0; i--) {
    g.fillStyle = skinVisibleColor(skin, skinColorAt(skin, i));
    g.fillRect(segs[i].x, segs[i].y, u - 1, u - 1);
  }
  drawFlairSet(g, flairSet, segs, u, 1, 0);
  return c;
}

/* ----- Shop tabs ----- */
function renderTemporaryTab() {
  const note = document.createElement("p");
  note.className = "shop-note";
  note.textContent = "One-time items. Prices grow with how much XP you earn in a run, and creep up each time you buy one.";
  upgradeBodyEl.appendChild(note);

  CONSUMABLE_KEYS.forEach(key => {
    const c = CONSUMABLES[key];
    const price = consumablePrice(key);
    const row = document.createElement("div");
    row.className = "shop-row";
    const info = document.createElement("div");
    info.innerHTML = `<div class="shop-name">${c.name}</div><div class="shop-desc">${c.desc}</div><div class="shop-desc owned-count">You have ${fmtInt(save.consumables[key])}</div>`;
    const btn = makeBuyButton(`<span class="xp-tag">${fmtInt(price)}</span> XP`, "tmp-" + key);
    btn.disabled = save.xp < price;
    if (!btn.disabled) btn.classList.add("affordable");
    btn.addEventListener("click", () => buyConsumable(key));
    row.append(iconCanvas(key), info, btn);
    upgradeBodyEl.appendChild(row);
  });
}

function renderFlairTab() {
  const note = document.createElement("p");
  note.className = "shop-note";
  note.textContent = "Mix and match one item per slot. Anything you buy moves to your Inventory, where you can swap it or take it off.";
  upgradeBodyEl.appendChild(note);

  FLAIR_SLOTS.forEach(([slot, label]) => {
    const forSale = FLAIR.filter(f => f.slot === slot && !f.reward && !save.ownedFlair.includes(f.id));
    upgradeBodyEl.appendChild(groupHead(label, false));
    if (!forSale.length) {
      const done = document.createElement("p");
      done.className = "shop-note small";
      done.textContent = `You own every ${label.toLowerCase()} item. They're in your Inventory.`;
      upgradeBodyEl.appendChild(done);
      return;
    }
    forSale.forEach(f => {
      const row = document.createElement("div");
      row.className = "shop-row";
      const info = document.createElement("div");
      info.innerHTML = `<div class="shop-name">${f.name}</div>${f.set ? `<div class="shop-desc">${f.set} set</div>` : ""}`;
      const btn = makeBuyButton(`<span class="xp-tag">${fmtInt(f.price)}</span> XP`, "flair-" + f.id);
      btn.disabled = save.xp < f.price;
      if (!btn.disabled) btn.classList.add("affordable");
      btn.addEventListener("click", () => buyFlair(f.id));
      row.append(flairPreview({ [slot]: f.id }), info, btn);
      upgradeBodyEl.appendChild(row);
    });
  });
}
