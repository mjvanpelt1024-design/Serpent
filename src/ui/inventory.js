/* =========================================================
   src/ui/inventory.js
   The Satchel (inventory) screen
   ========================================================= */
"use strict";

/* ----- Inventory screen ----- */
let invTab = "items";
let invSub = "skins";

function invButton(label, key, onClick, state) {
  const btn = makeBuyButton(label, key);
  btn.classList.add(state === "on" ? "equipped" : "equip");
  btn.addEventListener("click", onClick);
  return btn;
}

function renderInventory() {
  const body = document.getElementById("inventory-body");
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
  document.querySelectorAll("#screen-inventory .tab[data-inv]").forEach(t => t.setAttribute("aria-selected", String(t.dataset.inv === invTab)));
  document.querySelector("#screen-inventory .subtabs").hidden = true;
  bubbleSel = null;
  bubbleCardEl.className = "bubble-card";
  body.innerHTML = "";
  const add = el => body.appendChild(el);
  const empty = text => {
    const p = document.createElement("div");
    p.className = "soon";
    p.innerHTML = text;
    add(p);
  };

  if (invTab === "items") {
    const owned = CONSUMABLE_KEYS.filter(k => save.consumables[k] > 0);
    const note = document.createElement("p");
    note.className = "shop-note";
    note.textContent = owned.length
      ? "Boosts and golden hearts are offered before each run. Revives are offered when you die. More grow on the trees."
      : "";
    if (owned.length) add(note);
    if (!owned.length) return empty("<strong>Nothing here yet</strong>One-time items grow on the island trees, and fall under the Great Tree once their island is yours.");
    const wrap = document.createElement("div");
    wrap.className = "bubbles fruit-shelf";
    owned.forEach(k => {
      const b = document.createElement("button");
      b.className = "shelf-fruit fruit item";
      b.dataset.key = "inv-item-" + k;
      b.style.setProperty("--c", ITEM_COLOR[k]);
      b.innerHTML = `<span class="sf-fruit">${fruitInner(ITEM_FRUIT[k], "item:" + k)}</span><span class="sf-count">x${fmtInt(save.consumables[k])}</span><span class="sf-name">${CONSUMABLES[k].name}</span>`;
      b.addEventListener("click", e => { e.stopPropagation(); openBubble("item", k, "inv", b); });
      wrap.appendChild(b);
    });
    add(wrap);
  } else if (invTab === "cosmetics") {
    const sections = [
      ["Skins", "skins", skins.filter(x => save.ownedSkins.includes(x.id)).map(x => x.id)],
      ["Themes", "backdrops", backdrops.filter(x => save.ownedBackdrops.includes(x.id)).map(x => x.id)],
      ["Flair", "flair", FLAIR.filter(f => save.ownedFlair.includes(f.id)).map(f => f.id)]
    ];
    const wearing = document.createElement("div");
    wearing.className = "flair-wearing";
    wearing.append(flairPreview(save.flair, 240, 64));
    add(wearing);
    sections.forEach(([label, kind, ids]) => {
      add(groupHead(`${label} (${ids.length})`, false));
      if (!ids.length) {
        const p = document.createElement("p");
        p.className = "shop-note small";
        p.textContent = "Nothing yet. The Tailor on the Commons has plenty.";
        add(p);
        return;
      }
      add(bubbleCluster(kind, ids, "inv"));
    });
  } else {
    // Tree medals first: one row per tree, three slots each
    add(groupHead("Tree medals", false));
    const trees = document.createElement("div");
    trees.className = "tree-medal-grid";
    ["global"].concat(MODE_KEYS).forEach(area => {
      const row = document.createElement("div");
      row.className = "tm-row" + (area === "global" || isModeUnlocked(area) ? "" : " locked");
      row.style.setProperty("--m", area === "global" ? "#5ab046" : MEDAL_COLORS[area]);
      row.innerHTML = `<span class="tm-name">${escapeAttr(treeTitle(area))}</span>${medalSlots(area)}`;
      trees.appendChild(row);
    });
    add(trees);
    const medals = earnedMedals();
    add(groupHead(`Badge medals (${medals.length} of ${BADGE_FAMILIES.length})`, false));
    const note = document.createElement("p");
    note.className = "shop-note";
    note.textContent = "Max out a badge path on the Achievements board to earn its medal. Wear one in your Clothes slot.";
    add(note);
    if (!medals.length) return empty("<strong>No badge medals yet</strong>Finish every tier of any badge path to earn your first.");
    const grid = document.createElement("div");
    grid.className = "bubbles medal-shelf";
    medals.forEach(f => {
      const on = save.flair.cape === "medal:" + f.id;
      const b = document.createElement("button");
      b.className = "medal-chip" + (on ? " on" : "");
      b.dataset.key = "inv-medal-" + f.id;
      b.style.setProperty("--m", medalColor(f));
      b.innerHTML = `<span class="medal big" style="--m:${medalColor(f)}"></span><span class="mc-name">${escapeAttr(f.name)}</span><span class="mc-act">${on ? "Wearing" : "Wear"}</span>`;
      b.addEventListener("click", () => equipMedal(f.id));
      grid.appendChild(b);
    });
    add(grid);
  }

  if (focusKey) {
    const again = body.querySelector(`[data-key="${focusKey}"]`);
    if (again) again.focus({ preventScroll: true });
  }
}
