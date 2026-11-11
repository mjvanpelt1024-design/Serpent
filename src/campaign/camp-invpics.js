/* =========================================================
   src/campaign/camp-invpics.js
   Your things, in pictures (build 51). Each kind has its own place at
   home base, painted in the map's pixel style, and you click the things
   themselves:
     the armory rack   gear on hooks, what you wear on the stand
     the spell shelf   spell scrolls on shelves, the one you carry on the lectern
     the familiar den  cushions; the familiar you bring sits in the big basket
     the rune stones   sockets in a slab; the active rune on the altar
     the satchel       only special and one-use things: snacks (and your
                       pocket of four), heart canisters, junk, crafted
                       trinkets and parts, recipes
   Beside the picture, a plate tells you about what you picked and what
   you can do with it. Pictures are 240 x 135, scaled up like home base.
   ========================================================= */
"use strict";

const PIC_W = 240, PIC_H = 135;
/* The screen: made here, so index.html stays as it was */
const picScreen = document.createElement("section");
picScreen.id = "screen-campinv";
picScreen.className = "overlay list pic-screen";
picScreen.setAttribute("aria-label", "Your things");
picScreen.innerHTML = `<div class="sticky"><div class="screen-head"><button class="btn btn-small" data-back>Back</button><h2 id="pi-title">Your things</h2><span id="pi-count" class="pi-count"></span></div></div>
  <div class="pic-wrap">
    <div class="pic-room" id="pi-room"><canvas id="pi-canvas" width="${PIC_W}" height="${PIC_H}" aria-hidden="true"></canvas><div id="pi-spots" class="pi-spots"></div></div>
    <div class="pic-info plate" id="pi-info" aria-live="polite"></div>
  </div>`;
document.getElementById("stage").appendChild(picScreen);
screenEls.campinv = picScreen;
BACK_TARGET.campinv = "camphome";
picScreen.querySelector("[data-back]").addEventListener("click", goBack);
const picCanvas = document.getElementById("pi-canvas");
const picSpotsEl = document.getElementById("pi-spots");
const picInfoEl = document.getElementById("pi-info");
let picRoom = "rack";
let picSel = null;           // the uid (or "recipe:<id>") picked
let picPage = 0;
let picRaf = 0;
let picHover = null;

/* ----- Drawing kit ----- */
const pR = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function pIcon(g, it, x, y, s = 2) {
  const id = it.kind === "recipe" ? "scroll" : CAMP.itemById[it.id] && CAMP.itemById[it.id].family === "rune" ? `ci:${it.id}:${runeGradeId(it)}` : "ci:" + it.id;
  g.imageSmoothingEnabled = false;
  g.drawImage(texCanvas(id, "gift"), Math.round(x), Math.round(y), 12 * s, 12 * s);
}

/* ----- The rooms: what's in each, where each thing sits, and what moves -----
   Each room is a picture, textures/scenes/rooms/<room>/background.png (room:<room> in the index), with
   its hooks, cushions, sockets and pouches; fx(g, t) draws the few things that move over it. */
const picGrid = (cols, rows, x0, y0, dx, dy) => { const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * dx, y: y0 + r * dy }); return out; };
const PIC_ROOMS = {
  rack: {
    title: "The Armory Rack", slot: "gear", slots: ["gear", "helmet", "body"], spots: picGrid(5, 2, 22, 46, 30, 50), hero: { x: 196, y: 70, label: "On you" },
    empty: "No gear yet. Sir Hissington sells it at The Coiled Anvil, past Brightscale Keep's first boss.",
    // the window's morning light, coming and going
    fx(g, t) { texPaint(g, "room:rack:light", 160, 34, { alpha: 0.08 + 0.04 * Math.sin(t) }); }
  },
  shelf: {
    title: "The Spell Shelf", slot: "spell", spots: picGrid(5, 3, 20, 34, 26, 36), hero: { x: 196, y: 64, label: "Carrying" },
    empty: "No spells yet. The Arcanum Spire's merchant sells them, past its first boss.",
    // the candle on the lectern flickers
    fx(g, t) { texDraw(g, "room:shelf:flame", 225, 63, Math.sin(t * 9) > 0 ? 1 : 0); }
  },
  den: {
    title: "The Familiar Den", slot: "pet", spots: picGrid(3, 2, 34, 66, 48, 40), hero: { x: 196, y: 92, label: "With you" },
    empty: "No familiars yet. Tidecoil Reef's merchant has them, past its first boss.",
    // the sea light through the round window
    fx(g, t) { const w = Math.sin(t * 2) * 0.5; texPaint(g, "room:den:light", 104, 10, { alpha: 0.06 + w * 0.03 }); }
  },
  stones: {
    title: "The Rune Stones", slot: "rune", spots: picGrid(6, 3, 18, 34, 24, 34), hero: { x: 196, y: 62, label: "Active" },
    empty: "No runes yet. Cinder Crown's merchant sells them, and they turn up in levels on every island.",
    // the altar glows from inside, and embers rise from it and fade
    fx(g, t) {
      texPaint(g, "room:stones:glow", 176, 40, { alpha: 0.15 + 0.08 * Math.sin(t * 2) });
      for (let i = 0; i < 4; i++) { const ph = (t * 0.6 + i / 4) % 1; texPaint(g, "room:stones:ember", Math.round(186 + i * 6), Math.round(92 - ph * 40), { alpha: 1 - ph }); }
    }
  },
  satchel: {
    title: "The Satchel", slots: ["food", "canister", "loot", "craft"], spots: picGrid(8, 3, 24, 66, 26, 26), pocket: [44, 86, 128, 170].map(x => ({ x, y: 28 })),
    empty: "Your satchel holds snacks, heart canisters, junk you find in levels, trinkets and parts you craft, and recipes. It's empty for now."
  }
};

/* What a room holds: gear, spells... (the satchel also lists the recipes you know) */
function picItems(room) {
  const R = PIC_ROOMS[room];
  if (room === "satchel") {
    const order = { food: 0, canister: 1, craft: 2, loot: 3 };
    const items = camp.satchel.filter(it => R.slots.includes(campItemSlot(it.id)))
      .sort((a, b) => order[campItemSlot(a.id)] - order[campItemSlot(b.id)] || (campItemSlot(a.id) === "loot" ? ["rare", "uncommon", "common"].indexOf(lootGrade(a.id)) - ["rare", "uncommon", "common"].indexOf(lootGrade(b.id)) : 0) || a.uid - b.uid);
    return items.concat(camp.recipes.map(id => ({ kind: "recipe", id, uid: "recipe:" + id })));
  }
  // the rack holds your armor too (build 52): weapons and tools, then helmets, then body armor
  const ins = R.slots || [R.slot], worn = it => Object.values(camp.equip).includes(it.uid);
  return camp.satchel.filter(it => ins.includes(campItemSlot(it.id))).sort((a, b) => worn(b) - worn(a) || ins.indexOf(campItemSlot(a.id)) - ins.indexOf(campItemSlot(b.id)) || rarityIdx(b.rarity) - rarityIdx(a.rarity) || a.uid - b.uid);
}
const picFind = uid => (String(uid).startsWith("recipe:") ? { kind: "recipe", id: String(uid).slice(7), uid } : satchelItem(uid));

function openPicRoom(room) {
  picRoom = room;
  picPage = 0;
  const R = PIC_ROOMS[room];
  const items = picItems(room);
  picSel = room === "satchel" ? (items[0] ? items[0].uid : null) : camp.equip[R.slot] || (items[0] ? items[0].uid : null);
  openScreen("campinv");
}
function renderPicRoom() {
  const R = PIC_ROOMS[picRoom];
  document.getElementById("pi-title").textContent = R.title;
  picScreen.style.setProperty("--isl", CAMP.islandById[homeIsl || "keep"].colors.accent);
  const items = picItems(picRoom);
  const per = R.spots.length;
  const pages = Math.max(1, Math.ceil(items.length / per));
  picPage = Math.min(picPage, pages - 1);
  document.getElementById("pi-count").textContent = items.length ? `${items.length} ${items.length === 1 ? "thing" : "things"}` : "";
  // a button over every spot, the size of what's in it; the stand, lectern, basket or altar too
  const btn = (x, y, w, h, uid, label, cls = "", inner = "") => {
    const b = document.createElement("button");
    b.className = "pi-spot " + cls;
    b.innerHTML = inner;
    Object.assign(b.style, { left: (x / PIC_W * 100) + "%", top: (y / PIC_H * 100) + "%", width: (w / PIC_W * 100) + "%", height: (h / PIC_H * 100) + "%" });
    b.setAttribute("aria-label", label);
    if (uid !== null && uid === picSel) b.setAttribute("aria-pressed", "true");
    b.addEventListener("pointerenter", () => { picHover = uid; });
    b.addEventListener("pointerleave", () => { if (picHover === uid) picHover = null; });
    b.addEventListener("click", () => { if (uid === null) return; picSel = uid; sfx("tab"); renderPicRoom(); });
    picSpotsEl.appendChild(b);
    return b;
  };
  picSpotsEl.innerHTML = "";
  const shown = items.slice(picPage * per, picPage * per + per);
  shown.forEach((it, i) => { const s = R.spots[i]; btn(s.x - 12, s.y - 12, 24, 24, it.uid, it.kind === "recipe" ? `Recipe: ${CAMP.recipeById[it.id].name}` : campItemName(it), "", picBadgeHtml(it)); });
  if (R.hero) {
    const on = satchelItem(camp.equip[R.slot]);
    btn(R.hero.x - 20, R.hero.y - 20, 40, 40, on ? on.uid : null, on ? `${R.hero.label}: ${campItemName(on)}` : `${R.hero.label}: nothing`, "hero", `<span class="pi-cap">${escapeAttr(R.hero.label)}</span>${on ? picBadgeHtml(on) : ""}`);
  }
  if (R.pocket) R.pocket.forEach((s, i) => { const it = pocketItem(i); btn(s.x - 12, s.y - 12, 24, 24, it ? it.uid : null, it ? `Pocket ${i + 1}: ${campItemName(it)}` : `Pocket ${i + 1}: empty`, "pocket", `<span class="pi-b n">${i + 1}</span>${it ? picBadgeHtml(it) : ""}`); });
  if (!items.length) { const e = document.createElement("div"); e.className = "pi-nothing"; e.textContent = "Nothing here yet"; picSpotsEl.appendChild(e); }
  if (pages > 1) [-1, 1].forEach(d => {
    const b = document.createElement("button");
    b.className = `btn btn-small pi-page ${d < 0 ? "prev" : "next"}`;
    b.innerHTML = d < 0 ? "&#9664;" : "&#9654;";
    b.disabled = picPage + d < 0 || picPage + d >= pages;
    b.setAttribute("aria-label", d < 0 ? "Previous page" : "Next page");
    b.addEventListener("click", () => { picPage += d; sfx("tab"); renderPicRoom(); });
    picSpotsEl.appendChild(b);
  });
  renderPicInfo();
  drawPicRoom(performance.now() / 1000);
}

/* ----- The picture ----- */
/* The room itself, with whatever moves in it, at time t (seconds) */
function picBackdrop(g, room, t) {
  g.drawImage(texCanvas("room:" + room), 0, 0);
  if (PIC_ROOMS[room].fx) PIC_ROOMS[room].fx(g, t);
}
function drawPicRoom(t) {
  const g = picCanvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const R = PIC_ROOMS[picRoom];
  picBackdrop(g, picRoom, t);
  const items = picItems(picRoom);
  const per = R.spots.length;
  const shown = items.slice(picPage * per, picPage * per + per);
  const on = R.slot ? camp.equip[R.slot] : 0;
  const worn = uid => (R.slots ? R.slots.some(sl => camp.equip[sl] === uid) : uid === on);
  R.spots.forEach((s, i) => {
    const it = shown[i];
    if (!it) return;
    const bob = picRoom === "den" ? Math.round(Math.sin(t * 2 + i) * 1) : 0;
    const away = it.uid && itemAway(it.uid);
    g.globalAlpha = away || worn(it.uid) ? 0.35 : 1;
    if (picRoom === "den" && !away) drawPetSprite(g, it.id, s.x - 10, s.y - 12 + bob, 20, t * 1000, { shells: 1 });
    else if (!away) pIcon(g, it, s.x - 12, s.y - 12 + bob);
    g.globalAlpha = 1;
    if (away) texDraw(g, "room:mark:away", s.x - 8, s.y - 10);
    picBadges(g, it, s.x, s.y);
    if (it.uid === picSel || it.uid === picHover) picFrame(g, s.x - 13, s.y - 13, 26, 26, t, it.uid === picSel);
  });
  // the hero spot: big, lit, whatever you wear or carry
  if (R.hero) {
    const it = satchelItem(on), h = R.hero;
    if (it && !itemAway(it.uid)) {
      if (picRoom === "den") drawPetSprite(g, it.id, h.x - 16, h.y - 22 + Math.round(Math.sin(t * 2.4) * 1.2), 32, t * 1000, { shells: 1 });
      else pIcon(g, it, h.x - 18, h.y - 18, 3);
      picBadges(g, it, h.x + 6, h.y + 6);
    } else { g.globalAlpha = 0.3; pR(g, h.x - 12, h.y - 12, 24, 24, "#000"); g.globalAlpha = 1; }
    if (it && (it.uid === picSel || it.uid === picHover)) picFrame(g, h.x - 21, h.y - 21, 42, 42, t, it.uid === picSel);
  }
  if (R.pocket) R.pocket.forEach((s, i) => {
    const it = pocketItem(i);
    if (it) { pIcon(g, it, s.x - 12, s.y - 12); picBadges(g, it, s.x, s.y); }
    if (it && (it.uid === picSel || it.uid === picHover)) picFrame(g, s.x - 13, s.y - 13, 26, 26, t, it.uid === picSel);
  });
}
function picFrame(g, x, y, w, h, t, sel) {
  const a = sel ? 0.75 + 0.25 * Math.sin(t * 6) : 0.5;
  g.fillStyle = sel ? `rgba(255,230,120,${a})` : `rgba(255,255,255,${a})`;
  g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
}
/* Little marks on a thing (textures/scenes/rooms/marks/): a rarity pip in its rarity's color (a
   color-swap picture), a wax seal, a trinket's gold dot */
function picBadges(g, it, x, y) {
  if (it.kind === "recipe") return;
  const d = campItemDef(it.id);
  if (d) texPaint(g, "room:mark:pip", x - 12, y + 10, { colors: { pip: rarityColor(it.rarity) } });
  else if (CAMP.lootById[it.id]) texPaint(g, "room:mark:pip", x - 12, y + 10, { colors: { pip: LOOT_GRADE_COLOR()[lootGrade(it.id)] || "#ccc" } });
  if (it.seal) texDraw(g, "room:mark:seal", x + 6, y + 4);
  if (d && d.family === "gear" && it.trinket) texDraw(g, "room:mark:trinket", x + 7, y - 10);
}
/* The words on a thing, crisp over the picture: how many, its level, training, fresh, away */
function picBadgeHtml(it) {
  if (!it || it.kind === "recipe") return "";
  let h = "";
  if (it.qty > 1) h += `<span class="pi-b q">x${it.qty}</span>`;
  if (it.lv) h += `<span class="pi-b lv">+${it.lv}</span>`;
  if (it.train) h += `<span class="pi-b tr">${"★".repeat(it.train)}</span>`;
  if (it.fresh) h += `<span class="pi-b fr">Fresh</span>`;
  if (it.uid && itemAway(it.uid)) h += `<span class="pi-b away">${itemAwayWord(it)}</span>`;
  return h;
}
const itemAwayWord = it => { const o = orderFor(it.uid); return o && o.kind === "train" ? "Training" : "Sealing"; };

function picLoop(ts) {
  picRaf = 0;
  if (currentScreen !== "campinv") return;
  picRaf = requestAnimationFrame(picLoop);
  if (Math.floor(ts / 50) === Math.floor((ts - 17) / 50)) return;
  drawPicRoom(ts / 1000);
}

/* ----- The plate beside the picture: what it is, and what to do with it ----- */
function renderPicInfo() {
  const R = PIC_ROOMS[picRoom];
  const it = picSel !== null ? picFind(picSel) : null;
  if (!it || (it.kind !== "recipe" && !camp.satchel.includes(it))) {
    picInfoEl.innerHTML = `<p class="pi-empty">${escapeAttr(picItems(picRoom).length ? "Pick something to see what it does." : R.empty)}</p>`;
    return;
  }
  let html = "", acts = [];
  if (it.kind === "recipe") {
    const r = CAMP.recipeById[it.id];
    const bill = recipeBill(r);
    html = `<div class="pi-head">${`<span class="ci-icon" style="--rc:${rarityColor(r.rarity)}"><img src="${iconUrl("scroll", 3)}" alt=""></span>`}<div><div class="pi-name" style="color:${rarityColor(r.rarity)}">${escapeAttr(r.name)}</div><div class="pi-sub">Recipe: makes a fresh ${rarityName(r.rarity).toLowerCase()} ${escapeAttr(campItemDef(r.makes).name)}</div></div></div>
      <p class="pi-desc">Ingredients: ${r.needs.map(id => escapeAttr(CAMP.ingredientById[id].name)).join(", ")}.</p>
      <p class="pi-meta">Costs ${Object.entries(bill).map(([isl, n]) => `${coinHtml(isl)} ${fmtInt(n)}`).join(" ")} · ${(KT.hours || [])[rarityIdx(r.rarity)] || 4} hours in the oven</p>
      <p class="pi-desc">Cook it in the kitchen behind ${escapeAttr(CAMP.islands.find(I => I.merchantFamily === "food").npcs.merchant.shop)}.</p>`;
  } else {
    const d = campItemDef(it.id), slot = campItemSlot(it.id);
    const color = d || (CAMP.craftById[it.id] && CAMP.craftById[it.id].major) ? rarityColor(it.rarity) : CAMP.lootById[it.id] ? LOOT_GRADE_COLOR()[lootGrade(it.id)] : "#ffd23f";
    let sub = "", body = "";
    if (d) { sub = `${CAMP.slots.find(s => s.id === slot).name} · ${campItemLeft(it)}`; body = itemFacts(it.id, it.rarity, it); }
    else if (CAMP.craftById[it.id]) { const c = CAMP.craftById[it.id]; sub = c.stat ? "Trinket: fit one to a piece of gear, for good" : `Part for ${c.fits === "weapon" ? "weapons" : "armor"}: fitted for good`; body = `<p class="pi-desc">${escapeAttr(craftFacts(c, c.major ? it.rarity : undefined))}</p><p class="pi-meta">Fit it at the workbench behind ${escapeAttr(CAMP.islands[0].npcs.merchant.shop)}.</p>`; }
    else { const l = CAMP.lootById[it.id]; sub = `Junk · ${lootGrade(it.id)} · found on ${escapeAttr(CAMP.islands[l.island - 1].name)}`; body = `<p class="pi-desc">Sells for ${coinHtml(campItemIsland(it.id))} ${fmtInt(campSellPrice(it))} at any merchant, or goes into a trinket at the workbench.</p>${junkUsedIn(it.id)}`; }
    html = `<div class="pi-head">${campItemIconHtml(it)}<div><div class="pi-name" style="color:${color}">${escapeAttr(campItemName(it))}${it.qty > 1 ? ` x${it.qty}` : ""}</div><div class="pi-sub">${sub}</div></div></div>${body}${picItemState(it)}`;
    const away = itemAway(it.uid);
    if (away) html += `<p class="pi-meta pi-away">${escapeAttr(orderLabel(orderFor(it.uid)))}: back in ${fmtLeft(orderFor(it.uid).readyAt - Date.now())}.</p>`;
    if (["gear", "helmet", "body", "spell", "pet", "rune", "canister"].includes(slot) && !away) {
      const on = camp.equip[slot] === it.uid;
      const words = { gear: ["Wear it", "Take it off"], helmet: ["Wear it", "Take it off"], body: ["Wear it", "Take it off"], spell: ["Carry it", "Put it back"], pet: ["Bring it", "Leave it home"], rune: ["Make it active", "Take it off"], canister: ["Carry it", "Leave it"] }[slot];
      acts.push(`<button class="btn ${on ? "" : "btn-primary"}" data-pi="equip">${on ? words[1] : words[0]}</button>`);
    }
    if (slot === "food") {
      const at = camp.pocket.indexOf(it.uid);
      acts.push(`<button class="btn ${at >= 0 ? "" : "btn-primary"}" data-pi="pocket">${at >= 0 ? `Take out of pocket ${at + 1}` : "Put in your pocket"}</button>`);
    }
  }
  picInfoEl.innerHTML = html + (acts.length ? `<div class="pi-acts">${acts.join("")}</div>` : "");
  picInfoEl.querySelectorAll("[data-pi]").forEach(b => b.addEventListener("click", () => picAct(b.dataset.pi, it)));
}
/* Which recipes a piece of junk goes into */
function junkUsedIn(id) {
  const uses = Object.values(CAMP.craftById).filter(c => c.needs.includes(id));
  return uses.length ? `<p class="pi-meta">Goes into: ${uses.map(c => escapeAttr(c.name)).join(", ")}</p>` : `<p class="pi-meta">No recipe uses it: it's only worth selling.</p>`;
}
/* Gear's parts and trinket, a spell's level and seal, a familiar's training */
function picItemState(it) {
  const d = campItemDef(it.id);
  if (!d) return "";
  if (d.family === "gear") {
    const parts = partsFor(it.id).map(p => `<span class="pi-tag${(it.parts || []).includes(p.id) ? " on" : ""}">${escapeAttr(p.name)}</span>`).join("");
    const t = trinketDef(it);
    return `<p class="pi-meta">Parts: ${parts}</p><p class="pi-meta">Trinket: ${t ? `<span class="pi-tag on">${escapeAttr(trinketTitle(t, it.trinketR))}</span> ${escapeAttr(craftFacts(t, it.trinketR || "common"))}` : "<span class='pi-tag'>none</span>"}</p>`;
  }
  if (d.family === "spell") {
    let pips = "";
    for (let i = 0; i < SP.maxLevel; i++) pips += `<i class="${i < (it.lv || 0) ? "on" : ""}"></i>`;
    return `<p class="pi-meta">Level <span class="pi-pips">${pips}</span> ${it.lv || 0}/${SP.maxLevel}${it.seal ? ' · <span class="pi-tag seal">Sealed</span>' : ""}</p>`;
  }
  if (d.family === "pet") return `<p class="pi-meta">Training: ${"★".repeat(it.train || 0)}${"☆".repeat(TR.maxLevel - (it.train || 0))}</p>`;
  if (d.family === "rune") return `<p class="pi-meta">Condition: ${escapeAttr(FG.grades[runeGrade(it)])}</p>`;
  return "";
}
function picAct(a, it) {
  const slot = campItemSlot(it.id);
  if (a === "equip") {
    if (camp.equip[slot] === it.uid) delete camp.equip[slot]; else camp.equip[slot] = it.uid;
  } else if (a === "pocket") {
    const at = camp.pocket.indexOf(it.uid);
    if (at >= 0) camp.pocket[at] = 0;
    else { const free = camp.pocket.indexOf(0); if (free < 0) { showToast("Your pocket is full: take a snack out first."); sfx("bad"); return; } camp.pocket[free] = it.uid; }
  }
  saveCamp();
  sfx("tab");
  renderPicRoom();
}

/* Opening the screen draws it; it animates while it's up */
(() => {
  const orig = openScreen;
  window.openScreen = function (name) {
    orig.apply(this, arguments);
    if (name === "campinv") { renderPicRoom(); if (!picRaf) picRaf = requestAnimationFrame(picLoop); }
  };
})();
