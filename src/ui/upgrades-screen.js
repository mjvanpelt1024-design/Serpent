/* =========================================================
   src/ui/upgrades-screen.js
   Upgrade lists and purchase buttons
   ========================================================= */
"use strict";

/* =========================================================
   Upgrades screen
   ========================================================= */
function makeBuyButton(label, key) {
  const btn = document.createElement("button");
  btn.className = "btn btn-buy";
  btn.dataset.key = key;
  btn.innerHTML = label;
  return btn;
}

function renderUpgradeBody() {
  const previouslyFocused = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.key
    : null;
  const hadKbdFocus = document.activeElement && document.activeElement.classList.contains("focused");

  // The shop is the Tailor now: skins, themes and Flair, as bubbles
  if (!["skins", "backdrops", "flair", "avatars"].includes(upgradeTab)) upgradeTab = "skins";
  document.querySelectorAll("#screen-upgrades .tab[data-ctab]").forEach(tab => {
    tab.setAttribute("aria-selected", String(tab.dataset.ctab === upgradeTab));
  });
  bubbleSel = null;
  bubbleCardEl.className = "bubble-card";
  upgradeBodyEl.innerHTML = "";
  renderTailor(upgradeTab);

  if (previouslyFocused) {
    const again = upgradeBodyEl.querySelector(`[data-key="${previouslyFocused}"]`);
    if (again && !again.disabled) {
      if (hadKbdFocus) setKbdFocus(again);
      else again.focus({ preventScroll: true });
    }
  }
}

const shopMainOf = tab => (tab === "gameplay" || tab === "temporary" ? "upgrades" : "cosmetics");
const lastShopTab = { upgrades: "temporary", cosmetics: "skins" };

function renderSoon(title, text) {
  const box = document.createElement("div");
  box.className = "soon";
  box.innerHTML = `<strong>${title}</strong>${text}<br><br>Coming in a future update.`;
  upgradeBodyEl.appendChild(box);
}

function upgradeRow(key) {
  const track = upgradeTracks[key];
  const info = trackInfo(key, save.prestige);
  const tier = save.tiers[key];
  const max = info.values.length;
  const cost = nextTierCost(key);
  const maxed = cost === null;
  const locked = isTrackLocked(key);

  const row = document.createElement("div");
  row.className = "shop-row" + (locked ? " locked" : "") + (track.nightmareOf ? " nm-row" : "");

  const swatch = document.createElement("span");
  swatch.className = "swatch sw-" + key;
  if (track.nightmareOf) swatch.innerHTML = SKULL_SVG;
  else if (track.color) swatch.style.background = track.color;

  const info2 = document.createElement("div");
  const nextText = maxed || locked ? "" : `<span class="next">next ${track.format(trackValueAt(key, tier + 1))}</span>`;
  const lockWhat = track.requires === "all" ? "every mode" : track.requires === "nightmare" ? "a Nightmare" : modes[track.requires] && modes[track.requires].label + " mode";
  const lockNote = locked ? `<div class="shop-lock">${LOCK_SVG}Unlock ${lockWhat} to upgrade</div>` : "";
  info2.innerHTML =
    `<div class="shop-name">${track.label}</div>` +
    `<div class="shop-desc">${track.desc}</div>` +
    `<div class="shop-meta"><span>Tier ${tier}/${max}</span><span>${track.format(getTrackValue(key))}</span>${nextText}</div>` +
    (track.nightmareOf ? `<div class="segbar red">${info.values.map((_, i) => `<span${i < tier ? ' class="on"' : ""}></span>`).join("")}</div>` : "") +
    lockNote;

  const capped = !locked && atGreatCap(key);
  let label = `<span class="xp-tag">${fmtInt(maxed ? 0 : cost)}</span> ${curFor(key)}`;
  if (maxed) label = "Max";
  else if (locked) label = "Locked";
  else if (capped) label = "Capped";

  const btn = makeBuyButton(label, "up-" + key);
  btn.disabled = locked || maxed || capped || walletFor(key) < cost;
  if (!btn.disabled) btn.classList.add("affordable");
  btn.addEventListener("click", () => purchaseUpgrade(key));

  row.append(swatch, info2, btn);
  return row;
}

/* The four normal paths of a mode */
const modeTrackKeys = mode => Object.keys(upgradeTracks).filter(k => upgradeTracks[k].requires === mode && !upgradeTracks[k].nightmareOf);
const nmTrackKey = mode => Object.keys(upgradeTracks).find(k => upgradeTracks[k].nightmareOf === mode);
const trackMaxed = k => nextTierCost(k) === null;

/* The red upgrade opens with its Nightmare island (src/game/world/unlocks.js) */
function nightmareSection(mode) {
  const key = nmTrackKey(mode);
  if (save.nmUpgrades.includes(mode)) return upgradeRow(key);
  const btn = document.createElement("button");
  btn.className = "btn btn-block btn-nm";
  btn.dataset.key = "nmup-" + mode;
  btn.disabled = true;
  btn.innerHTML = `${SKULL_SVG}${upgradeTracks[key].label}: opens with the ${escapeAttr(NIGHTMARES[mode].name)} Nightmare`;
  return btn;
}

function groupHead(text, locked) {
  const head = document.createElement("div");
  head.className = "group-head";
  head.innerHTML = (locked ? LOCK_SVG : "") + text;
  return head;
}

function renderGameplayTab(target = upgradeBodyEl) {
  const list = document.createElement("div");

  // Core stats, boxed, with the prestige button
  const rank = save.prestige;
  const box = document.createElement("div");
  box.className = "core-box" + (rank ? " rank-" + rank : "");
  if (rank) {
    box.innerHTML = `<div class="ribbon rank-${rank}" title="Prestiged ${rank} time${rank === 1 ? "" : "s"}">` +
      `<span class="ribbon-num">${rank}</span>${PRESTIGE_RANKS[rank]} Ranked Stats</div>`;
  }
  box.appendChild(groupHead("Core stats", false));
  CORE_TRACKS.forEach(k => box.appendChild(upgradeRow(k)));

  const pbtn = document.createElement("button");
  pbtn.className = "btn btn-block btn-prestige";
  pbtn.dataset.key = "prestige";
  const needs = rank < MAX_PRESTIGE ? prestigeNeeds() : null;
  pbtn.addEventListener("click", () => { if (currentScreen === "global") setTimeout(renderGlobal, 0); });
  if (rank >= MAX_PRESTIGE) {
    pbtn.disabled = true;
    pbtn.textContent = "Gold rank reached. Fully prestiged!";
  } else if (canPrestige()) {
    pbtn.classList.add("ready", "rank-" + (rank + 1));
    pbtn.textContent = `Prestige to ${PRESTIGE_RANKS[rank + 1]} (${fmtShort(needs.fee)} SB)`;
    pbtn.addEventListener("click", confirmPrestige);
  } else {
    pbtn.disabled = true;
    pbtn.innerHTML = `${LOCK_SVG}Prestige to ${PRESTIGE_RANKS[rank + 1]}`;
  }
  box.appendChild(pbtn);

  if (needs) {
    const list2 = document.createElement("ul");
    list2.className = "prestige-needs";
    const rows = needs.reqs.concat([{ label: `${fmtShort(needs.fee)} XP fee`, met: save.xp >= needs.fee, have: Math.min(save.xp, needs.fee), need: needs.fee, xp: true }]);
    list2.innerHTML = rows.map(r => `<li class="${r.met ? "met" : ""}"><span class="tick" aria-hidden="true">${r.met ? "&#10003;" : "&#9675;"}</span><span class="pn-label">${r.label}</span><span class="pn-count">${r.xp ? "" : r.have + "/" + r.need}</span></li>`).join("");
    box.appendChild(list2);
  }

  const pnote = document.createElement("p");
  pnote.className = "prestige-note";
  pnote.textContent = rank >= MAX_PRESTIGE
    ? "Your core stats are Gold ranked, the highest rank there is."
    : "Prestiging resets these 3 to tier 0 but keeps what you've earned as your new starting point. Every tier becomes 10x stronger, but climbing them costs far more.";
  box.appendChild(pnote);
  list.appendChild(box);

  // Upgrades that work everywhere
  ["every", "all", "nightmare"].forEach(group => {
    const keys = Object.keys(upgradeTracks).filter(k => !CORE_TRACKS.includes(k) && !upgradeTracks[k].nightmareOf && (upgradeTracks[k].requires || "every") === group);
    if (!keys.length) return;
    if (group === "all") list.appendChild(groupHead("Master (every island unlocked)", !allModesUnlocked()));
    else if (group === "nightmare") list.appendChild(groupHead("Nightmare", !save.unlockedNightmares.length));
    else if (group === "every") list.appendChild(groupHead("Every island", false));
    else list.appendChild(groupHead(modes[group].label, !isModeUnlocked(group)));
    keys.forEach(k => list.appendChild(upgradeRow(k)));
  });

  target.appendChild(list);
}

const globalBodyEl = document.getElementById("global-body");
function renderGlobal() {
  const was = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
  const kbd = document.activeElement && document.activeElement.classList.contains("focused");
  globalBodyEl.innerHTML = "";
  renderGameplayTab(globalBodyEl);
  collapseShopGroups(globalBodyEl);
  if (was) {
    const again = globalBodyEl.querySelector(`[data-key="${was}"]`);
    if (again && !again.disabled) { if (kbd) setKbdFocus(again); else again.focus({ preventScroll: true }); }
  }
}

/* Anything here you could buy right now */
function globalAffordable() {
  return Object.keys(upgradeTracks).some(k => {
    const t = upgradeTracks[k];
    if (t.nightmareOf || (t.requires && MODE_KEYS.includes(t.requires))) return false;
    const c = nextTierCost(k);
    return !isTrackLocked(k) && c !== null && save.xp >= c;
  });
}

function renderTieredList(kind, rowFor) {
  const items = kind === "skins" ? skins : backdrops;
  const noun = kind === "skins" ? ["skin", "skins"] : ["theme", "themes"];
  const list = document.createElement("div");

  COSMETIC_TIERS[kind].forEach((tier, idx) => {
    const st = tierState(kind, idx);
    const wrap = document.createElement("div");
    wrap.className = "tier" + (st.unlocked ? "" : " locked");
    wrap.appendChild(groupHead(tier.group, !st.unlocked));

    if (!st.unlocked) {
      const box = document.createElement("div");
      box.className = "tier-lock";
      const affordable = save.xp >= tier.fee;

      const btn = document.createElement("button");
      btn.className = "btn btn-tier";
      btn.dataset.key = `tier-${kind}-${tier.group}`;
      if (st.met && affordable) {
        btn.classList.add("ready");
        btn.innerHTML = `${LOCK_SVG}Unlock ${tier.group} for ${fmtInt(tier.fee)} XP`;
        btn.addEventListener("click", () => unlockTier(kind, tier.group));
      } else {
        btn.disabled = true;
        btn.innerHTML = `${LOCK_SVG}Unlock ${tier.group} (${fmtInt(tier.fee)} XP)`;
      }
      box.appendChild(btn);

      const bar = document.createElement("div");
      bar.className = "segbar";
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", `${st.have} of ${st.need} ${st.prev.group} ${noun[1]} owned`);
      for (let i = 0; i < st.need; i++) {
        const seg = document.createElement("span");
        if (i < st.have) seg.className = "on";
        bar.appendChild(seg);
      }
      box.appendChild(bar);

      const note = document.createElement("div");
      note.className = "seg-note";
      const left = st.need - st.have;
      if (!st.prevUnlocked) note.textContent = `Unlock ${st.prev.group} first.`;
      else if (left > 0) note.textContent = `Own ${left} more ${left === 1 ? noun[0] : noun[1]} from ${st.prev.group} to unlock this tier.`;
      else if (!affordable) note.textContent = `${fmtInt(tier.fee - save.xp)} more XP to unlock.`;
      else note.textContent = "Ready to unlock!";
      box.appendChild(note);
      wrap.appendChild(box);
    }

    const ownedList = kind === "skins" ? save.ownedSkins : save.ownedBackdrops;
    const forSale = items.filter(it => it.group === tier.group && !ownedList.includes(it.id));
    forSale.forEach(it => wrap.appendChild(rowFor(it, st.unlocked)));
    if (st.unlocked && !forSale.length) {
      const done = document.createElement("p");
      done.className = "shop-note small";
      done.textContent = `You own every ${tier.group} ${noun[0]}. They're in your Inventory.`;
      wrap.appendChild(done);
    }
    list.appendChild(wrap);
  });

  upgradeBodyEl.appendChild(list);
}

function cosmeticButton(kind, id, owned, selected, unlocked, price, buy, equip) {
  const prefix = kind === "skins" ? "skin-" : "bd-";
  let btn;
  if (owned && selected) {
    btn = makeBuyButton("Equipped", prefix + id);
    btn.classList.add("equipped");
    btn.disabled = true;
  } else if (owned) {
    btn = makeBuyButton("Equip", prefix + id);
    btn.classList.add("equip");
    btn.addEventListener("click", equip);
  } else if (!unlocked) {
    btn = makeBuyButton("Locked", prefix + id);
    btn.disabled = true;
  } else {
    btn = makeBuyButton(`<span class="xp-tag">${price}</span> XP`, prefix + id);
    btn.disabled = save.xp < price;
    if (!btn.disabled) btn.classList.add("affordable");
    btn.addEventListener("click", buy);
  }
  return btn;
}

function renderSkinsTab() {
  const price = nextSkinPrice();
  const note = document.createElement("p");
  note.className = "shop-note";
  note.innerHTML = save.ownedSkins.length >= skins.length
    ? "You own every skin."
    : `Next skin: <strong>${fmtInt(price)} XP</strong>. Every skin you buy makes the next one cost more. New tiers open as you collect.`;
  upgradeBodyEl.appendChild(note);

  const bd = currentBackdrop();
  renderTieredList("skins", (skin, unlocked) => {
    const row = document.createElement("div");
    row.className = "shop-row";
    const preview = document.createElement("span");
    preview.className = "skin-preview";
    preview.style.background = bd.base;
    for (let i = 0; i < 8; i++) {
      const seg = document.createElement("span");
      seg.style.background = skinVisibleColor(skin, skinColorAt(skin, i));
      preview.appendChild(seg);
    }
    const info = document.createElement("div");
    info.innerHTML = `<div class="shop-name">${skin.name}</div>`;
    const owned = save.ownedSkins.includes(skin.id);
    const btn = cosmeticButton("skins", skin.id, owned, save.selectedSkin === skin.id, unlocked, price,
      () => purchaseSkin(skin.id), () => equipSkin(skin.id));
    row.append(preview, info, btn);
    return row;
  });
}

function renderBackdropsTab() {
  const price = nextBackdropPrice();
  const note = document.createElement("p");
  note.className = "shop-note";
  note.innerHTML = save.ownedBackdrops.length >= backdrops.length
    ? "You own every theme."
    : `Next theme: <strong>${fmtInt(price)} XP</strong>. A theme paints the board, recolors the menus and brings its own flair. Each one you buy makes the next cost more.`;
  upgradeBodyEl.appendChild(note);

  renderTieredList("backdrops", (bd, unlocked) => {
    const row = document.createElement("div");
    row.className = "shop-row";
    const preview = themePreview(bd);
    const info = document.createElement("div");
    info.innerHTML = `<div class="shop-name">${themeName(bd)}</div><div class="shop-desc">${themeDesc(bd)}</div>`;
    const owned = save.ownedBackdrops.includes(bd.id);
    const btn = cosmeticButton("backdrops", bd.id, owned, save.selectedBackdrop === bd.id, unlocked, price,
      () => purchaseBackdrop(bd.id), () => equipBackdrop(bd.id));
    row.append(preview, info, btn);
    return row;
  });
}
