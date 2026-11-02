/* =========================================================
   src/ui/tailor.js
   The Tailor and the Satchel's cosmetic cards
   ========================================================= */
"use strict";

/* =========================================================
   The Tailor (cosmetics) and the Satchel (inventory): everything is a bubble or a fruit.
   Tap one and it pops up with its name, a bigger picture, and its price.
   ========================================================= */
let bubbleSel = null;          // { kind, id, where } while a bubble's card is open

/* A little curled-up snake in a skin's colors */
function skinBubbleArt(skin, size = 56) {
  const c = document.createElement("canvas");
  c.width = size * 2;
  c.height = size * 2;
  c.className = "bb-art";
  const g = c.getContext("2d");
  g.scale(2, 2);
  const u = Math.floor(size / 5);
  const path = [[1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [3, 2], [2, 2], [2, 3]];
  const ox = Math.round((size - u * 4) / 2) - u, oy = Math.round((size - u * 3) / 2) - u * 2;
  for (let i = path.length - 1; i >= 0; i--) {
    const [x, y] = path[i];
    g.fillStyle = skinVisibleColor(skin, skinColorAt(skin, path.length - 1 - i));
    g.fillRect(ox + x * u, oy + y * u, u - 1, u - 1);
  }
  const [hx, hy] = path[path.length - 1];
  g.fillStyle = "#fff";
  g.fillRect(ox + hx * u + u * 0.55, oy + hy * u + u * 0.2, Math.max(2, u * 0.3), Math.max(2, u * 0.3));
  g.fillStyle = "#111";
  g.fillRect(ox + hx * u + u * 0.65, oy + hy * u + u * 0.3, Math.max(1, u * 0.15), Math.max(1, u * 0.15));
  return c;
}

/* ----- Theme emblems: a little pixel symbol for each theme, in its own colors ----- */
const EMBLEMS = {
  sprout: ["...........", ".kkk...kkk.", "kaaak.kaaak", ".kaaakaaak.", "..kkkakkk..", ".....k.....", ".....k.....", "...kkkkk...", "..kccccck..", "..kbbbbbk..", "...kkkkk..."],
  cloud: ["...........", "....kkk....", "...kwwwk...", ".kkwwwwwkk.", "kwwwwwwwwwk", "kwwwwwwwwwk", "kbwwwwwwwbk", ".kkkkkkkkk."],
  heart: [".kkk...kkk.", "kaaak.kaaak", "kawaakaaaak", "kaaaaaaaaak", "kaaaaaaaaak", ".kaaaaaaak.", "..kaaaaak..", "...kaaak...", "....kak....", ".....k....."],
  sparkle: [".....a.....", ".....a.....", "....awa....", "....awa....", "..aawwwaa..", "aawwwwwwwaa", "..aawwwaa..", "....awa....", "....awa....", ".....a.....", ".....a....."],
  star: [".....k.....", "....kak....", "....kak....", "kkkkaaakkkk", ".kaaawaaak.", "..kaaaaak..", "..kaaaaak..", ".kaaakaaak.", ".kaak.kaak.", "kak.....kak", "kk.......kk"],
  leaf: [".......kkkk", ".....kkaaak", "....kaaaaak", "...kaaaawak", "..kaaaawaak", "..kaaawaaak", ".kaaawaaak.", ".kaawaaak..", ".kawaakk...", "kwkkkk.....", "kk........."],
  flame: [".....k.....", "....kak....", "....kaak...", "...kaaak...", "..kaabaak..", ".kaabbbaak.", ".kabbwbbak.", "kaabbwwbaak", "kabbwwwbbak", ".kabbbbbak.", "..kkkkkkk.."],
  drop: [".....k.....", ".....k.....", "....kak....", "....kak....", "...kaaak...", "..kaaaaak..", ".kawaaaaak.", ".kawaaaaak.", ".kaaaaaaak.", "..kaaaaak..", "...kkkkk..."],
  bubbles: [".......kkk.", "......kawak", "......kaaak", ".kkk...kkk.", "kawwk......", "kwaaak..kk.", "kaaaak.kwak", "kaaaak.kaak", ".kkkk...kk."],
  sun: [".....a.....", ".a...a...a.", "..a.kkk.a..", "...kaaak...", ".akawwaaka.", "aakaaaaakaa", ".akaaaaaka.", "...kaaak...", "..a.kkk.a..", ".a...a...a.", ".....a....."],
  flower: ["....kkk....", "...kaaak...", ".kk.kak.kk.", "kaak.k.kaak", "kaaakwkaaak", ".kkkwbwkkk.", "..kaakaak..", ".kaak.kaak.", ".kaak.kaak.", "..kk...kk.."],
  moon: ["....kkkk...", "..kkaaak...", ".kaaak.....", ".kaak......", "kaaak......", "kaaak......", "kaaak....k.", ".kaaak..kak", ".kaaaakkaak", "..kkaaaaak.", "....kkkkk.."],
  cup: ["..a..a.....", "...a..a....", "..a..a.....", "kkkkkkkkk..", "kwaaaaaakkk", "kaaaaaaak.k", "kaaaaaaakkk", ".kaaaaak...", "..kkkkk....", "kkkkkkkkkk."],
  grass: ["...........", ".a...a...a.", ".a..aa..aa.", "aa.a.a.a.a.", "a.aa.aaa.aa", "aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"],
  house: [".....a.....", "....a.a....", "...a...a...", "..a.....a..", ".aaaaaaaaa.", "..a.....a..", "..a.aa..a..", "..a.aa..a..", "..a.aa..a..", "..aaaaaaa.."],
  notebook: ["kkkkkkkkk", "kwwawwwwk", "kwcacccwk", "kwwawwwwk", "kwcacccwk", "kwwawwwwk", "kwcaccwwk", "kwwawwwwk", "kkkkkkkkk"],
  dots: ["...........", ".aa...bb...", ".aa...bb...", "....aa...bb", "....aa...bb", ".bb...aa...", ".bb...aa...", "....bb...aa", "....bb...aa"],
  brick: ["kkkkkkkkkkk", "kaaakaaaaak", "kcccakccccak", "kkkkkkkkkkk", "kaaaaakaaak", "kcccccakcck", "kkkkkkkkkkk", "kaaakaaaaak", "kcccakccccak", "kkkkkkkkkkk"],
  wave: ["...........", "...kkkk....", "..kawwak...", ".kaakkwak..", "kaak..kaak.", "kak..kaaak.", "....kaaak..", "kkkkaaaakkk", "aaaaaaaaaaa", "bbbbbbbbbbb"],
  tartan: ["cbacbbcbacb", "bbabbbbbabb", "aaaaaaaaaaa", "cbacbbcbacb", "bbabbbbbabb", "cbacbbcbacb", "bbabbbbbabb", "aaaaaaaaaaa", "cbacbbcbacb", "bbabbbbbabb"],
  diamond: ["...kkkkk...", "..kwaaaak..", ".kwaaaaaak.", "kkkkkkkkkkk", ".kaaawaaak.", "..kaaaaak..", "...kaaak...", "....kak....", ".....k....."],
  hex: ["...kkkkk...", "..kaaaaak..", ".kaawaaaak.", "kaawaaaaaak", "kaaaaaaaaak", ".kaaaaaaak.", "..kaaaaak..", "...kkkkk..."],
  synth: ["...kkkkk...", "..kaaaaak..", ".kaaaaaaak.", ".kkkkkkkkk.", ".kbbbbbbbk.", ".kkkkkkkkk.", "...........", "bbbbbbbbbbb", "b.b..b..b.b", "bbbbbbbbbbb"],
  chip: ["..a.a.a.a..", ".kkkkkkkkk.", "akbbbbbbbka", ".kbaaaaabk.", "akbawwwabka", ".kbawwwabk.", "akbaaaaabka", ".kbbbbbbbk.", ".kkkkkkkkk.", "..a.a.a.a.."],
  pawn: ["....kkk....", "...kaaak...", "...kawak...", "....kak....", "...kaaak...", "....kak....", "...kaaak...", "..kaaaaak..", ".kaaaaaaak.", ".kkkkkkkkk."],
  peak: ["...........", ".....k.....", "....kwk....", "...kaaak...", "..kaabaak..", "..kabbbak..", ".kaabbbaak.", ".kabbcbbak.", "kaabccbbaak", "kkkkkkkkkkk"],
  snow: [".....a.....", "...a.a.a...", "....aaa....", ".a...a...a.", "..a..a..a..", "aaaaawaaaaa", "..a..a..a..", ".a...a...a.", "....aaa....", "...a.a.a...", ".....a....."],
  galaxy: ["...aaaa....", ".aa....a...", "a..bbb..a..", "a.b...b.a..", "a.b.w.b.a..", ".a.b..b.a..", "..a.bb..a..", "...a...a...", "....aaa...."],
  joystick: ["....kkk....", "...kaaak...", "...kawak...", "...kaaak...", "....kkk....", ".....k.....", ".....k.....", ".kkkkkkkkk.", "kbbbbbbbbbk", "kbccbbbbbbk", ".kkkkkkkkk."],
  aurora: [".w.........", "...........", "aa.....aa..", "..aa..a..aa", "....aa.....", "bb.....bb..", "..bb..b..bb", "....bb.....", "...........", "ccccccccccc"],
  chevron: [".....a.....", "....aaa....", "...aa.aa...", "..aa...aa..", ".aa..a..aa.", "aa..aaa..aa", "...aa.aa...", "..aa...aa..", ".aa.....aa.", "aa.......aa"],
  fish: ["...........", "....kkk..k.", "..kkaaakkak", ".kawaaaaaak", "kaakaaaaak.", ".kaaaaaaaak", "..kkaaakkak", "....kkk..k."],
  peach: ["....kk.....", "...k.kk....", "..kkkakk...", ".kaaakaaak.", "kawaakaaaak", "kaaaakaaaak", "kaaaaaaaaak", ".kaaaaaaak.", "..kkkkkkk.."]
};
/* Which symbol each theme shows: the emblem in its file */
const THEME_EMBLEM = Object.fromEntries(CONTENT.themes.filter(t => t.emblem).map(t => [t.id, String(t.emblem)]));
function themeEmblem(bd, size = 56) {
  const t = themeFor(bd);
  const rows = EMBLEMS[THEME_EMBLEM[bd.id] || "sparkle"];
  const pal = { a: t.accent, b: t.swirl[0], c: t.swirl[1], d: t.swirl[2], w: "#ffffff", k: "#120e16" };
  const cols = Math.max(...rows.map(r => r.length)), n = Math.max(cols, rows.length);
  const c = document.createElement("canvas");
  c.width = c.height = size * 2;
  c.className = "bb-art emblem";
  const g = c.getContext("2d");
  const u = Math.floor((size * 2 * 0.86) / n);
  const ox = Math.floor((size * 2 - cols * u) / 2), oy = Math.floor((size * 2 - rows.length * u) / 2);
  // a soft shadow first, then the symbol
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!pal[ch]) return;
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    g.fillRect(ox + x * u + Math.max(1, u / 4), oy + y * u + Math.max(1, u / 3), u, u);
  }));
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!pal[ch]) return;
    g.fillStyle = pal[ch];
    g.fillRect(ox + x * u, oy + y * u, u, u);
  }));
  return c;
}

function cosmeticInfo(kind, id) {
  if (kind === "item") {
    const c = CONSUMABLES[id];
    return {
      name: c.name, sub: `One-time item, you have ${fmtInt(save.consumables[id])}`, desc: c.desc + ` More grow on the ${STORY[ITEM_ISLAND[id]].title} tree.`,
      owned: false, on: false, open: true, price: consumablePrice(id), color: ITEM_COLOR[id],
      art: () => { const d = document.createElement("div"); d.className = "tc-pic fruit item"; d.style.setProperty("--c", ITEM_COLOR[id]); d.innerHTML = fruitInner(ITEM_FRUIT[id], "item:" + id); return d; },
      buy: () => {}, equip: () => {}
    };
  }
  if (kind === "skins") {
    const it = skinById[id];
    const owned = save.ownedSkins.includes(id);
    return {
      name: it.name, sub: it.group + " skin", desc: "A new coat for the snake. It changes nothing about its luck, which remains poor.",
      owned, on: save.selectedSkin === id, open: itemTierUnlocked("skins", it), price: nextSkinPrice(),
      art: s => skinBubbleArt(it, s), buy: () => purchaseSkin(id), equip: () => equipSkin(id), color: skinVisibleColor(it, skinColorAt(it, 0))
    };
  }
  if (kind === "backdrops") {
    const it = backdropById[id];
    const owned = save.ownedBackdrops.includes(id);
    return {
      name: themeName(it), sub: it.group + " theme", desc: themeDesc(it),
      owned, on: save.selectedBackdrop === id, open: itemTierUnlocked("backdrops", it), price: nextBackdropPrice(),
      art: s => (s > 60 ? themePreview(it) : themeEmblem(it, s)), buy: () => purchaseBackdrop(id), equip: () => equipBackdrop(id), color: themeFor(it).accent || "#ffd23f"
    };
  }
  if (kind === "avatars") {
    const av = AVATAR_BY_ID[id];
    const owned = save.ownedAvatars.includes(id);
    return {
      name: av.name, sub: av.free ? "Avatar, free" : "Avatar", desc: "A face for a save, shown on the profile screen. Buy it once, use it on any save.",
      owned, on: !!activeSlot && save.avatar === id, open: true, price: av.price || 0,
      art: s => { const d = document.createElement("div"); d.innerHTML = avatarHtml(id, s > 60 ? "big" : ""); return d.firstElementChild; },
      buy: () => purchaseAvatar(id), equip: () => equipAvatar(id), color: av.bg
    };
  }
  const f = FLAIR_BY_ID[id];
  const slotName = (FLAIR_SLOTS.find(sl => sl[0] === f.slot) || [0, "Flair"])[1];
  const owned = save.ownedFlair.includes(id);
  return {
    name: f.name, sub: `${slotName}${f.set ? ", " + f.set + (f.reward ? "" : " set") : ""}`,
    desc: f.reward ? "Not for sale. It belongs to whoever finds all ten collectibles." : "One item per slot. Wear it, swap it, or take it off in the Satchel.",
    owned, on: save.flair[f.slot] === id, open: !f.reward || owned, price: f.price, reward: f.reward,
    art: s => flairPreview({ [f.slot]: id }, s > 60 ? 150 : 50, s > 60 ? 64 : 50, s <= 60), buy: () => buyFlair(id), equip: () => toggleFlair(f.slot, id), color: "#b36bff"
  };
}

/* One bubble */
function cosmeticBubble(kind, id, where) {
  const info = cosmeticInfo(kind, id);
  const b = document.createElement("button");
  b.className = "bubble" + (info.owned ? " owned" : "") + (info.on ? " on" : "") + (!info.open ? " locked" : "") + (!info.owned && info.open && save.snakebucks >= info.price ? " affordable" : "");
  b.dataset.key = `bb-${kind}-${id}`;
  b.style.setProperty("--bc", info.color);
  b.style.setProperty("--d", (mapHash(id.length, id.charCodeAt(0), 5) * -6).toFixed(2) + "s");
  const art = info.art(56);
  const ring = document.createElement("span");
  ring.className = "bb-ring";
  ring.appendChild(art);
  b.appendChild(ring);
  const tag = document.createElement("span");
  tag.className = "bb-tag";
  tag.innerHTML = info.on ? "Wearing" : info.owned ? "Owned" : !info.open ? LOCK_SVG : info.reward ? "Reward" : `${fmtShort(info.price)}`;
  b.appendChild(tag);
  b.setAttribute("aria-label", `${info.name}, ${info.on ? "wearing" : info.owned ? "owned" : info.open ? fmtInt(info.price) + " Snakebucks" : "locked"}`);
  b.addEventListener("click", e => { e.stopPropagation(); openBubble(kind, id, where, b); });
  return b;
}

/* A cluster of bubbles, floating */
function bubbleCluster(kind, ids, where) {
  const wrap = document.createElement("div");
  wrap.className = "bubbles";
  ids.forEach(id => wrap.appendChild(cosmeticBubble(kind, id, where)));
  return wrap;
}

const bubbleCardEl = document.getElementById("bubble-card");

function openBubble(kind, id, where, anchor) {
  bubbleSel = { kind, id, where };
  sfx("pop" in SFX ? "pop" : "click");
  renderBubbleCard(anchor);
}

function closeBubble() {
  if (!bubbleSel) return false;
  bubbleSel = null;
  bubbleCardEl.className = "bubble-card";
  bubbleCardEl.innerHTML = "";
  return true;
}

function renderBubbleCard(anchor) {
  if (!bubbleSel) return;
  const { kind, id, where } = bubbleSel;
  const info = cosmeticInfo(kind, id);
  let action;
  if (info.owned) {
    action = kind === "flair"
      ? `<button class="btn ${info.on ? "" : "btn-green"}" data-bb-equip>${info.on ? "Take off" : "Wear it"}</button>`
      : `<button class="btn ${info.on ? "" : "btn-green"}" data-bb-equip ${info.on ? "disabled" : ""}>${info.on ? "Wearing it" : "Wear it"}</button>`;
  } else if (where === "inv") {
    action = "";
  } else if (info.reward) {
    action = `<button class="btn" disabled>${LOCK_SVG} Find all ten collectibles</button>`;
  } else if (!info.open) {
    action = `<button class="btn" disabled>${LOCK_SVG} Unlock its tier first</button>`;
  } else {
    const can = save.snakebucks >= info.price;
    action = `<button class="btn ${can ? "btn-gold" : ""}" data-bb-buy ${can ? "" : "disabled"}>${can ? "Buy" : "Need"} <b>${fmtInt(info.price)}</b> SB</button>`;
  }
  bubbleCardEl.style.setProperty("--bc", info.color);
  bubbleCardEl.innerHTML = `<button class="bc-x" data-bb-close aria-label="Close">&times;</button>
    <div class="bc-pic"></div>
    <p class="bc-sub">${escapeAttr(info.sub)}</p>
    <h3 class="bc-name">${escapeAttr(info.name)}</h3>
    <p class="bc-desc">${info.desc}</p>
    ${info.owned ? "" : info.open && !info.reward && where !== "inv" ? `<p class="bc-price">${fmtInt(info.price)} SB</p>` : ""}
    <div class="bc-act">${action}</div>`;
  bubbleCardEl.querySelector(".bc-pic").appendChild(info.art(120));
  bubbleCardEl.className = "bubble-card open";
  const buy = bubbleCardEl.querySelector("[data-bb-buy]");
  if (buy) buy.addEventListener("click", () => { info.buy(); afterBubble(); });
  const eq = bubbleCardEl.querySelector("[data-bb-equip]");
  if (eq) eq.addEventListener("click", () => { info.equip(); afterBubble(); });
  bubbleCardEl.querySelector("[data-bb-close]").addEventListener("click", () => closeBubble());
  placeBubbleCard(anchor);
  setTimeout(() => { const b = bubbleCardEl.querySelector(".bc-act .btn:not(:disabled)") || bubbleCardEl.querySelector("[data-bb-close]"); if (b) b.focus({ preventScroll: true }); }, 30);
}

/* Sits next to its bubble, or in the middle of the screen if there's no bubble to point at */
function placeBubbleCard(anchor) {
  const card = bubbleCardEl;
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = card.offsetWidth, h = card.offsetHeight;
  let x = (vw - w) / 2, y = (vh - h) / 2;
  if (anchor && anchor.isConnected) {
    const r = anchor.getBoundingClientRect();
    x = r.left + r.width / 2 - w / 2;
    y = r.bottom + 10;
    if (y + h > vh - 10) y = r.top - h - 10;
    if (y < 10) y = Math.max(10, (vh - h) / 2);
  }
  card.style.left = Math.max(10, Math.min(vw - w - 10, x)) + "px";
  card.style.top = Math.max(10, Math.min(vh - h - 10, y)) + "px";
}

/* After buying or wearing: redraw the screen behind, keep the card up */
function afterBubble() {
  const keep = bubbleSel;
  if (currentScreen === "inventory") renderInventory();
  else renderUpgradeBody();
  if (!keep) return;
  bubbleSel = keep;
  const anchor = document.querySelector(`[data-key="bb-${keep.kind}-${keep.id}"]`);
  renderBubbleCard(anchor);
}

document.addEventListener("click", e => {
  if (bubbleSel && !bubbleCardEl.contains(e.target) && !e.target.closest(".bubble")) closeBubble();
});
document.querySelectorAll("#screen-upgrades, #screen-inventory").forEach(el => el.addEventListener("scroll", () => { if (bubbleSel) closeBubble(); }, { passive: true }));

/* ----- The Tailor's tabs: skins and themes by tier, Flair by slot ----- */
function renderTailor(kind) {
  const body = upgradeBodyEl;
  const note = document.createElement("p");
  note.className = "shop-note tailor-note";
  if (kind === "skins") note.innerHTML = save.ownedSkins.length >= skins.length ? "You own every skin." : `Every skin costs <strong>${fmtInt(nextSkinPrice())} Snakebucks</strong> right now, and each one you buy makes the next a little more.`;
  else if (kind === "backdrops") note.innerHTML = save.ownedBackdrops.length >= backdrops.length ? "You own every theme." : `Every theme costs <strong>${fmtInt(nextBackdropPrice())} Snakebucks</strong> right now. A theme paints the board, recolors the menus and brings its own flair.`;
  else if (kind === "avatars") note.innerHTML = activeSlot ? `Avatars are faces for your saves. Wearing one puts it on <strong>${escapeAttr(snakeName())}</strong>'s save.` : "Avatars are faces for your saves. Pick a save first to put one on it.";
  else note.textContent = "One item per slot. Tap one to see it up close.";
  body.appendChild(note);

  if (kind === "avatars") {
    body.appendChild(groupHead("Free", false));
    body.appendChild(bubbleCluster("avatars", AVATARS.filter(a => a.free).map(a => a.id), "shop"));
    body.appendChild(groupHead("For sale", false));
    body.appendChild(bubbleCluster("avatars", AVATARS.filter(a => !a.free).map(a => a.id), "shop"));
    return;
  }

  if (kind === "flair") {
    FLAIR_SLOTS.forEach(([slot, label]) => {
      const ids = FLAIR.filter(f => f.slot === slot).map(f => f.id);
      body.appendChild(groupHead(label, false));
      body.appendChild(bubbleCluster("flair", ids, "shop"));
    });
    return;
  }
  const items = kind === "skins" ? skins : backdrops;
  COSMETIC_TIERS[kind].forEach((tier, idx) => {
    const st = tierState(kind, idx);
    const head = groupHead(tier.group, !st.unlocked);
    head.classList.add("tier-head");
    if (!st.unlocked) {
      const affordable = save.snakebucks >= tier.fee;
      const btn = document.createElement("button");
      btn.className = "btn btn-small btn-tier" + (st.met && affordable ? " ready btn-gold" : "");
      btn.dataset.key = `tier-${kind}-${tier.group}`;
      btn.innerHTML = st.met ? `Unlock for ${fmtShort(tier.fee)} SB` : `Own ${st.need - st.have} more ${st.prev.group}`;
      btn.disabled = !(st.met && affordable);
      if (!btn.disabled) btn.addEventListener("click", () => unlockTier(kind, tier.group));
      head.appendChild(btn);
    }
    body.appendChild(head);
    body.appendChild(bubbleCluster(kind, items.filter(it => it.group === tier.group).map(it => it.id), "shop"));
  });
}
