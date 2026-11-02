/* =========================================================
   src/ui/profiles.js
   The save screen, deleting saves, the Exchange and avatars
   ========================================================= */
"use strict";

/* =========================================================
   Profiles: three saves, each with its own snake, map, island trees and
   Satchel. Everything they share (Snakebucks, the Great Tree, the Tailor,
   avatars, achievements) lives on the profile screen.
   ========================================================= */
function profileSummary(n) {
  const p = readJson(profileKey(n));
  if (!p) return null;
  const isl = Array.isArray(p.unlockedModes) ? p.unlockedModes.length : 1;
  return {
    name: p.name || "Noodle", avatar: AVATAR_BY_ID[p.avatar] ? p.avatar : "apple", xp: cleanNumber(p.xp),
    islands: isl, kind: p.kind === "nightmare" ? "nightmare" : "story", cheats: p.cheats === true,
    named: p.named === true, lastPlayed: cleanNumber(p.lastPlayed)
  };
}

function avatarHtml(id, cls = "") {
  const av = AVATAR_BY_ID[id] || AVATARS[0];
  return `<span class="avatar ${cls}" style="--ab:${av.bg}"><img src="${iconUrl(av.sprite, 3)}" alt="" draggable="false"></span>`;
}

/* Puts a profile's own half into the live save, keeping the shared half */
function useProfile(n) {
  if (activeSlot === n && save.named) return;
  persist();
  activeSlot = n;
  store.setItem(ACTIVE_KEY, String(n));
  save = sanitizeSave(mergeSave(readJson(META_KEY), readJson(profileKey(n))));
  afterProfileSwitch();
}

function afterProfileSwitch() {
  applyEconomy();          // a Nightmare-run save has its own prices
  clearPauseState();
  lastHeartsKey = "";
  lastPlayed = null;
  mapReturnTo = null;
  applyBackdrop();
  syncSettings();
  checkTreeMedals(true);
  updateHud();
}

function createProfile(n, kind) {
  persist();
  activeSlot = n;
  store.setItem(ACTIVE_KEY, String(n));
  const fresh = { kind, created: Date.now(), avatar: "apple" };
  if (kind === "nightmare") fresh.unlockedNightmares = ["easy"];
  save = sanitizeSave(mergeSave(readJson(META_KEY), fresh));
  save.named = false;
  save.tutorialDone = false;
  persist();
  afterProfileSwitch();
  sfx("unlock");
  openNaming("first");
}

function deleteProfile(n) {
  store.removeItem(profileKey(n));
  if (activeSlot === n) {
    activeSlot = 0;
    store.setItem(ACTIVE_KEY, "0");
    save = sanitizeSave(mergeSave(readJson(META_KEY), {}));
    afterProfileSwitch();
  }
  persist();
  renderProfiles();
  showToast("That save is gone. I have closed the book on it, quietly.");
}

/* Pick a profile and go to its map; a brand-new one starts with naming and the tour */
function playProfile(n) {
  useProfile(n);
  sfx("tab");
  if (!save.named) { openNaming("first"); return; }
  if (!save.tutorialDone && !guide) { startTutorial(); return; }
  openScreen("modes");
}

const profilesBodyEl = document.getElementById("profiles-body");
document.querySelector("#bucks .bk-icon").src = iconUrl("buck", 3);
let profileChoosing = 0;          // a slot asking Story or Nightmare

function renderProfiles() {
  const cards = [];
  for (let n = 1; n <= PROFILE_SLOTS; n++) {
    const p = profileSummary(n);
    if (!p) {
      if (profileChoosing === n) {
        cards.push(`<div class="prof-card empty choosing" data-slot="${n}">
          <p class="pc-new">What kind of save?</p>
          <button class="btn btn-green" data-new="${n}" data-kind="story">Story</button>
          <button class="btn nm-start" data-new="${n}" data-kind="nightmare">${SKULL_SVG} Nightmare run</button>
          <p class="pc-note">A Nightmare run has only Nightmare levels. Each one opens the next.</p>
          <button class="btn btn-small btn-quiet" data-choose-cancel>Cancel</button></div>`);
      } else {
        cards.push(`<button class="prof-card empty" data-key="prof-new-${n}" data-new="${n}">
          <span class="pc-plus">+</span><span class="pc-new">New save</span><span class="pc-note">Slot ${n}</span></button>`);
      }
      continue;
    }
    const sub = p.kind === "nightmare" ? `${SKULL_SVG} Nightmare run` : "Story";
    cards.push(`<div class="prof-card${activeSlot === n ? " active" : ""}${p.kind === "nightmare" ? " nmk" : ""}" data-slot="${n}">
      <button class="pc-del" data-del="${n}" aria-label="Delete ${escapeAttr(p.name)}" title="Delete this save"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7zm4 2v8h2v-8zm4 0v8h2v-8z"/></svg></button>
      ${avatarHtml(p.avatar, "big")}
      <span class="pc-name">${escapeAttr(p.name)}</span>
      <span class="pc-sub">${sub}</span>
      <span class="pc-stats">${p.named ? `${p.islands} of ${MODE_KEYS.length} islands · ${fmtInt(p.xp)} XP` : "Not started yet"}</span>
      ${p.cheats ? `<span class="pc-tag">Terminal used: no achievements</span>` : ""}
      <button class="btn btn-primary pc-play" data-key="prof-play-${n}" data-play-slot="${n}"${activeSlot === n ? " data-autofocus" : ""}>${p.named ? "Continue" : "Start"}</button>
    </div>`);
  }
  profilesBodyEl.innerHTML = `<div class="prof-cards">${cards.join("")}</div>
    <h3 class="prof-shared-title">Shared by every save</h3>
    <div class="prof-lands">
      <button class="land" data-key="land-global" data-land="global"><img src="${iconUrl("place:global", 3)}" alt=""><span class="ln-name">The Great Tree</span><span class="ln-sub">Upgrades for every island, in Snakebucks</span>${treeAffordable("global") ? '<span class="grow">+</span>' : ""}</button>
      <button class="land" data-key="land-cosmetics" data-land="cosmetics"><img src="${iconUrl("place:cosmetics", 3)}" alt=""><span class="ln-name">The Tailor</span><span class="ln-sub">Skins, themes, Flair and avatars</span></button>
      <button class="land" data-key="land-achievements" data-land="achievements"><img src="${iconUrl("place:achievements", 3)}" alt=""><span class="ln-name">The Trophy Hall</span><span class="ln-sub">Achievements and stats</span></button>
    </div>`;
  profilesBodyEl.querySelectorAll("[data-new]").forEach(b => b.addEventListener("click", () => {
    const n = Number(b.dataset.new);
    if (b.dataset.kind) { profileChoosing = 0; createProfile(n, b.dataset.kind); return; }
    if (save.fullRun) { profileChoosing = n; sfx("click"); renderProfiles(); return; }
    createProfile(n, "story");
  }));
  const cancel = profilesBodyEl.querySelector("[data-choose-cancel]");
  if (cancel) cancel.addEventListener("click", () => { profileChoosing = 0; renderProfiles(); });
  profilesBodyEl.querySelectorAll("[data-play-slot]").forEach(b => b.addEventListener("click", () => playProfile(Number(b.dataset.playSlot))));
  profilesBodyEl.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => openDeleteSave(Number(b.dataset.del))));
  profilesBodyEl.querySelectorAll("[data-land]").forEach(b => b.addEventListener("click", () => {
    sfx("tab");
    const to = b.dataset.land;
    if (to === "global") openTree("global");
    else if (to === "cosmetics") openScreen("upgrades");
    else openScreen("achievements");
  }));
}

/* ----- Deleting a save: are you sure, then type CONFIRM ----- */
const delEl = document.getElementById("delsave");
let delSlot = 0;
let delOpen = false;
function openDeleteSave(n) {
  const p = profileSummary(n);
  if (!p) return;
  delSlot = n;
  delOpen = true;
  delEl.querySelector(".ds-name").textContent = p.name;
  delEl.classList.remove("typing");
  delEl.classList.add("active");
  document.getElementById("ds-input").value = "";
  document.getElementById("ds-confirm").disabled = true;
  sfx("bad");
  setTimeout(() => document.getElementById("ds-no").focus({ preventScroll: true }), 30);
}
function closeDeleteSave() {
  delOpen = false;
  delEl.classList.remove("active", "typing");
}
document.getElementById("ds-no").addEventListener("click", closeDeleteSave);
document.getElementById("ds-cancel").addEventListener("click", closeDeleteSave);
document.getElementById("ds-yes").addEventListener("click", () => {
  delEl.classList.add("typing");
  setTimeout(() => document.getElementById("ds-input").focus(), 30);
});
document.getElementById("ds-input").addEventListener("input", e => {
  document.getElementById("ds-confirm").disabled = e.target.value.trim() !== "CONFIRM";
});
document.getElementById("ds-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !document.getElementById("ds-confirm").disabled) { e.preventDefault(); document.getElementById("ds-confirm").click(); }
  if (e.key === "Escape") { e.preventDefault(); closeDeleteSave(); }
  e.stopPropagation();
});
document.getElementById("ds-confirm").addEventListener("click", () => {
  if (document.getElementById("ds-input").value.trim() !== "CONFIRM") return;
  const n = delSlot;
  closeDeleteSave();
  deleteProfile(n);
});

/* ----- The Exchange: XP from this profile into shared Snakebucks ----- */
const exEl = document.getElementById("exchange");
const exRange = document.getElementById("ex-range");
let exchangeOpen = false;
function openExchange() {
  exchangeOpen = true;
  document.getElementById("ex-art").innerHTML = `<img src="${iconUrl("orb", 3)}" alt=""><span>&rarr;</span><img class="spin" src="${iconUrl("buck", 3)}" alt="">`;
  exEl.querySelector(".ex-rate").textContent = `${xpPerBuck()} XP buys 1 Snakebuck. Snakebucks are shared by every save and buy the Great Tree and the Tailor's wares.`;
  const max = Math.floor(save.xp / xpPerBuck()) * xpPerBuck();
  exRange.max = String(max);
  exRange.step = String(xpPerBuck());
  exRange.value = String(max);
  updateExchange();
  exEl.classList.add("active");
  sfx("tab");
  setTimeout(() => document.getElementById("ex-go").focus({ preventScroll: true }), 30);
}
function updateExchange() {
  const xp = Number(exRange.value) || 0;
  document.getElementById("ex-have").textContent = `${fmtInt(save.xp)} XP here · ${fmtInt(save.snakebucks)} Snakebucks shared`;
  document.getElementById("ex-preview").innerHTML = `Trade <b>${fmtInt(xp)} XP</b> for <b>${fmtInt(xp / xpPerBuck())} Snakebucks</b>`;
  document.getElementById("ex-go").disabled = xp < xpPerBuck();
  exRange.disabled = Number(exRange.max) < xpPerBuck();
}
function closeExchange() {
  exchangeOpen = false;
  exEl.classList.remove("active");
}
exRange.addEventListener("input", updateExchange);
document.getElementById("ex-half").addEventListener("click", () => { exRange.value = String(Math.floor(Number(exRange.max) / 2 / xpPerBuck()) * xpPerBuck()); updateExchange(); });
document.getElementById("ex-all").addEventListener("click", () => { exRange.value = exRange.max; updateExchange(); });
document.getElementById("ex-close").addEventListener("click", closeExchange);
document.getElementById("ex-go").addEventListener("click", () => {
  const xp = Math.floor(Math.min(save.xp, Number(exRange.value) || 0) / xpPerBuck()) * xpPerBuck();
  if (xp < xpPerBuck()) return;
  save.xp -= xp;
  save.snakebucks += xp / xpPerBuck();
  persist();
  updateHud();
  sfx("buy");
  showToast(`Traded ${fmtInt(xp)} XP for ${fmtInt(xp / xpPerBuck())} Snakebucks.`);
  const max = Math.floor(save.xp / xpPerBuck()) * xpPerBuck();
  exRange.max = String(max);
  exRange.value = String(max);
  updateExchange();
});

/* ----- Avatars in the Tailor ----- */
function purchaseAvatar(id) {
  const av = AVATAR_BY_ID[id];
  if (!av || save.ownedAvatars.includes(id) || !spendBucks(av.price)) return;
  save.ownedAvatars.push(id);
  if (activeSlot) save.avatar = id;
  persist();
  sfx("buy");
  updateHud();
  renderUpgradeBody();
}
function equipAvatar(id) {
  if (!save.ownedAvatars.includes(id)) return;
  if (!activeSlot) { showToast("Pick a save first, then give it an avatar."); return; }
  save.avatar = id;
  persist();
  sfx("click");
  renderUpgradeBody();
}

/* Once any profile opens every island, Nightmare runs unlock for new saves */
function checkFullRun() {
  if (!save.fullRun && save.unlockedModes.length >= MODE_KEYS.length) {
    save.fullRun = true;
    persist();
    setTimeout(() => showToast("New kind of save unlocked: a Nightmare run. Start one from the profile screen."), 1200);
  }
}

/* ----- The terminal: the first time on a save, warn about achievements ----- */
function askConsole() {
  if (!activeSlot) { showToast("Pick a save first. The terminal works on one save at a time."); return; }
  openConfirm({
    title: "Open the terminal?",
    text: `Using the terminal turns off achievements for ${save.settings.snakeName || "this save"}, for good. Your other saves keep theirs. Snakebucks can't be made here either.`,
    ok: "Open it anyway",
    onOk: () => { save.cheats = true; persist(); openScreen("console"); }
  });
}
