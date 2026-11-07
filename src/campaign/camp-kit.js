/* =========================================================
   src/campaign/camp-kit.js
   Choosing what to carry, between levels. The old "Bring anything?"
   box asks before every level once you own something to carry:
     your kit     one gear (a weapon, or a tool), a helmet and body
                  armor (build 52), and one spell, picked with arrows
     a familiar   to come along beside you
     your rune    the one that's active (yours for good), and a
                  canister of extra hearts: both sit with your hearts
     the pocket   four snacks, eaten with keys 1 to 4 in the level;
                  click a slot to change what's in it
   Nothing can be swapped in the middle of a level.
   ========================================================= */
"use strict";

let kitFor = null;            // { isl, n, challenge } while the box is open
const KIT_SLOTS = ["gear", "helmet", "body", "spell"];
const KIT_EXTRAS = ["pet", "rune", "canister"];
const CARRIED = KIT_SLOTS.concat(KIT_EXTRAS, ["food"]);

/* Opens the box if there's anything to choose; false means just play */
function openCampKit(isl, n, challengeIdx) {
  const owned = camp.satchel.filter(it => CARRIED.includes(campItemSlot(it.id)));
  if (!owned.length) return false;
  kitFor = { isl, n, challenge: challengeIdx };
  loadoutOpen = true;
  const def = campLevelDef(isl, n);
  document.getElementById("loadout-title").textContent = "What will you carry?";
  document.querySelector("#loadout .loadout-sub").textContent = `${n}. ${def.name}: ${goalText(def.goal)}. Nothing can be swapped once the level starts.`;
  document.getElementById("loadout-none").textContent = "Back";
  document.getElementById("loadout-go").textContent = "Start";
  renderCampKit();
  document.getElementById("loadout").classList.add("active");
  document.getElementById("loadout-go").focus({ preventScroll: true });
  updatePauseButton();
  return true;
}

function kitChoices(slot) {
  return [null].concat(camp.satchel.filter(it => campItemSlot(it.id) === slot));
}

/* The snacks that could go in pocket slot i: whatever isn't already in another slot */
function pocketChoices(i) {
  return [null].concat(camp.satchel.filter(it => campItemSlot(it.id) === "food" && !camp.pocket.some((u, j) => j !== i && u === it.uid)));
}

function renderCampKit() {
  const list = document.getElementById("loadout-list");
  list.innerHTML = "";
  const head = text => { const h = document.createElement("p"); h.className = "kit-head"; h.textContent = text; list.appendChild(h); };
  let headed = false;
  KIT_SLOTS.concat(KIT_EXTRAS).forEach(slot => {
    const choices = kitChoices(slot);
    if (choices.length < 2) return;
    if (!headed && KIT_SLOTS.includes(slot)) { head("Your kit"); headed = true; }
    if (slot === "pet") head("Beside you");
    if ((slot === "rune" || slot === "canister") && !list.querySelector(".kit-hearts")) { head("With your hearts"); list.lastChild.classList.add("kit-hearts"); }
    const it = campEquipped(slot);
    const s = CAMP.slots.find(x => x.id === slot);
    const row = document.createElement("div");
    row.className = "loadout-row kit-row";
    let sub = slot === "rune" ? "No rune selected" : "Nothing";
    if (it) {
      const d = campItemDef(it.id);
      if (slot === "rune") sub = `<span class="kit-good">${escapeAttr(campItemDoes(it))}</span> <span class="kit-weak">${escapeAttr(campItemWeak(it))}</span>`;
      else sub = campItemLeft(it);
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
  // the pocket: four slots, click one to change what's in it
  if (camp.satchel.some(it => campItemSlot(it.id) === "food")) {
    head("Pocket: keys 1 to 4 in the level");
    const row = document.createElement("div");
    row.className = "loadout-row kit-pocket";
    [0, 1, 2, 3].forEach(i => {
      const it = pocketItem(i);
      const b = document.createElement("button");
      b.className = "kit-snack" + (it ? "" : " empty");
      b.dataset.key = "kit-pocket-" + i;
      b.title = it ? `${campItemName(it)}: ${campItemDef(it.id).does}` : "Empty: click to put a snack here";
      b.setAttribute("aria-label", `Pocket slot ${i + 1}: ${it ? campItemName(it) : "empty"}`);
      b.innerHTML = `<kbd>${i + 1}</kbd>${it ? campItemIconHtml(it, "small") : `<span class="ci-icon small"></span>`}<span class="ks-name">${it ? escapeAttr(campItemDef(it.id).name) : "Empty"}</span>${it ? `<span class="ks-left">${it.uses} left</span>` : ""}`;
      b.addEventListener("click", () => {
        const choices = pocketChoices(i);
        const at = choices.findIndex(c => (c ? c.uid : 0) === camp.pocket[i]);
        const next = choices[(at + 1) % choices.length];
        camp.pocket[i] = next ? next.uid : 0;
        saveCamp();
        sfx("click");
        renderCampKit();
        const again = list.querySelector(`[data-key="kit-pocket-${i}"]`);
        if (again) again.focus({ preventScroll: true });
      });
      row.appendChild(b);
    });
    list.appendChild(row);
  }
}

function closeCampKit() {
  kitFor = null;
  loadoutOpen = false;
  document.getElementById("loadout").classList.remove("active");
  document.getElementById("loadout-title").textContent = "Bring anything?";
  document.getElementById("loadout-none").textContent = "Just play";
  updatePauseButton();
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
