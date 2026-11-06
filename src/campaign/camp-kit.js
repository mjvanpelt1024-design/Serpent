/* =========================================================
   src/campaign/camp-kit.js
   Choosing what to carry, between levels. The old "Bring anything?"
   box asks before every level once you own something to carry: one
   gear, one spell, one snack, one familiar and one rune, each picked
   with arrows from what's in your satchel (or nothing). Items can't be
   swapped in the middle of a level.
   ========================================================= */
"use strict";

let kitFor = null;            // { isl, n, challenge } while the box is open
const KIT_SLOTS = ["gear", "spell", "food", "pet", "rune", "canister"];

/* Opens the box if there's anything to choose; false means just play */
function openCampKit(isl, n, challengeIdx) {
  const owned = camp.satchel.filter(it => KIT_SLOTS.includes(campItemSlot(it.id)));
  if (!owned.length) return false;
  kitFor = { isl, n, challenge: challengeIdx };
  loadoutOpen = true;
  const def = campLevelDef(isl, n);
  document.getElementById("loadout-title").textContent = "What will you carry?";
  document.querySelector("#loadout .loadout-sub").textContent = `${n}. ${def.name}: ${goalText(def.goal)}. One of each kind; they can't be swapped mid-level.`;
  document.getElementById("loadout-none").textContent = "Back";
  document.getElementById("loadout-go").textContent = "Start";
  renderCampKit();
  document.getElementById("loadout").classList.add("active");
  document.getElementById("loadout-go").focus({ preventScroll: true });
  return true;
}

function kitChoices(slot) {
  return [null].concat(camp.satchel.filter(it => campItemSlot(it.id) === slot));
}

function renderCampKit() {
  const list = document.getElementById("loadout-list");
  list.innerHTML = "";
  KIT_SLOTS.forEach(slot => {
    const choices = kitChoices(slot);
    if (choices.length < 2) return;
    const it = campEquipped(slot);
    const s = CAMP.slots.find(x => x.id === slot);
    const row = document.createElement("div");
    row.className = "loadout-row kit-row";
    let sub = "Nothing";
    if (it) {
      const d = campItemDef(it.id);
      sub = slot === "rune" ? `Burns up as the level starts. You have ${it.qty}.` : campItemLeft(it);
      if (slot !== "rune" && slot !== "canister") sub += `. <span class="kit-weak">Weak: ${escapeAttr(d.weak)}</span>`;
    }
    row.innerHTML = `${it ? campItemIconHtml(it) : `<span class="ci-icon"></span>`}
      <div class="loadout-info"><div class="shop-desc kit-slot">${s.name}</div><div class="shop-name" style="color:${it ? rarityColor(it.rarity) : "var(--ink-dim)"}">${it ? escapeAttr(campItemName(it)) : "None"}</div><div class="shop-desc">${sub}</div></div>
      <div class="stepper"><button class="btn btn-small" data-key="kit-${slot}-prev" aria-label="Previous ${s.name}">&#9664;</button><button class="btn btn-small" data-key="kit-${slot}-next" aria-label="Next ${s.name}">&#9654;</button></div>`;
    const step = d => {
      const i = choices.findIndex(c => (c ? c.uid : 0) === (it ? it.uid : 0));
      const next = choices[(i + d + choices.length) % choices.length];
      if (next) camp.equip[slot] = next.uid; else delete camp.equip[slot];
      saveCamp();
      sfx("click");
      renderCampKit();
      const again = list.querySelector(`[data-key="kit-${slot}-${d > 0 ? "next" : "prev"}"]`);
      if (again) again.focus({ preventScroll: true });
    };
    row.querySelector(`[data-key="kit-${slot}-prev"]`).addEventListener("click", () => step(-1));
    row.querySelector(`[data-key="kit-${slot}-next"]`).addEventListener("click", () => step(1));
    list.appendChild(row);
  });
}

function closeCampKit() {
  kitFor = null;
  loadoutOpen = false;
  document.getElementById("loadout").classList.remove("active");
  document.getElementById("loadout-title").textContent = "Bring anything?";
  document.getElementById("loadout-none").textContent = "Just play";
}

/* The box's buttons and keys: Start plays, Back (or Esc) closes */
(() => {
  const go = loadoutGo;
  window.loadoutGo = function (useNothing) {
    if (!kitFor) return go.apply(this, arguments);
    const { isl, n, challenge } = kitFor;
    closeCampKit();
    if (useNothing) return;
    campStart(isl, n, challenge);
  };
  const close = closeLoadout;
  window.closeLoadout = function () { if (kitFor) { closeCampKit(); return; } return close.apply(this, arguments); };
})();
