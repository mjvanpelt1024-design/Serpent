/* =========================================================
   src/ui/tour.js
   The hands-on tutorial
   ========================================================= */
"use strict";

/* =========================================================
   The tour: a hands-on tutorial. The screen darkens except for the one thing
   to press, and the narrator explains it in the teal tutorial box at the bottom.
   It walks through the map, both kinds of tree, the Tailor (where the first of
   each cosmetic is free), the Satchel, the Trophy Hall, the loadout, and then
   the first level, where every new thing is pointed out as it appears.
   ========================================================= */
let tutorial = null;            // the old in-run tutorial is gone; the engine still checks this
function tutorialEvent() {}
function tutorialFail() {}
let guide = null;               // { i, step } while the tour runs
let guideRun = false;           // the first level, played as the tour's last step
let guideRaf = 0;
const guideEl = document.getElementById("guide");
const guideShadeEl = document.getElementById("guide-shade");
const guideRingEl = document.getElementById("guide-ring");
const guideBoxEl = document.getElementById("guide-box");

const qs = sel => document.querySelector(sel);
const visible = el => el && el.isConnected && el.offsetParent !== null && !el.closest("[hidden]");

/* A little XP from the narrator, so the first upgrades are free */
function guideGift(n, why) {
  if (n <= 0 || !guide || guide.replay) return;
  save.xp += n;
  persist();
  updateHud();
  showToast(`The narrator slipped you ${fmtInt(n)} XP ${why}.`);
}

const GUIDE_SKINS = ["zest", "glacier", "sunset", "royal", "tropical", "rainbow"];
const GUIDE_THEME = "auroranight";

const nmRun = () => save.kind === "nightmare";
const tourGifted = () => save.freebies.includes("tour");

const GUIDE_STEPS = [
  { text: () => nmRun()
      ? "This is the map, and this save is a Nightmare run: no gentle levels, only the ones underneath. Tap the Garden, which is gentle only by comparison."
      : "This is the map. Every floating island is somewhere {name} can play. Tap the Garden, the gentlest place in the sky.",
    target: () => qs('[data-key="place-easy"]'), until: () => mapSel === "easy" },
  { text: () => nmRun()
      ? "Here are the Garden's three Nightmares. Finish one and the next opens. New islands still cost XP, and open straight onto their first Nightmare."
      : "Up close you can see the Garden's three levels on top. Nightmares hang underneath, later, when you are ready. You will not be ready.",
    target: () => qs(nmRun() ? '[data-key="nm-easy-0"]' : '[data-key="lv-easy-0"]'), next: true },
  { text: "Every island grows its own tree of upgrades, paid for in XP. Tap the Garden's tree.",
    enter: () => guideGift(nextTierCost(TREES.easy[0]), "for a seedling"),
    target: () => qs('[data-key="tree-easy"]'), until: () => currentScreen === "tree" && treeArea === "easy" },
  { text: "Each fruit is an upgrade, with a picture of what it does. Branches only grow once the fruit below them does. This one is the trunk, Snack Time.",
    target: () => qs('[data-key="node-snack"]'), next: true, enter: () => { treeSel = "snack"; if (currentScreen === "tree") renderTree(); } },
  { text: "Now grow it. Snack Time makes Garden apples worth more. I have paid, this once. Do not get used to it.",
    target: () => qs("#tree-card [data-buy]"), until: () => (save.tiers.snack || 0) > 0 || nextTierCost("snack") === null },
  { text: "The fruit lying in the grass is a one-time item. This is a Golden Heart, which soaks up one hit. Have one, on the house.",
    enter: () => { if (!guide.replay) { save.consumables.goldheart = Math.min(999, save.consumables.goldheart + 1); persist(); } },
    target: () => qs('[data-key="node-item:goldheart"]'), next: true },
  { text: "Back to the map.",
    target: () => qs("#screen-tree [data-back]"), until: () => currentScreen === "modes" },
  { text: "Tap here to see the whole map again. You can also pinch, scroll out, or swipe between islands.",
    target: () => qs("#map-out"), until: () => currentScreen === "modes" && !mapSel },
  { text: "Down below is the Commons. The Satchel holds everything this save owns. Tap it.",
    target: () => qs('[data-key="prop-inventory"]'), until: () => currentScreen === "inventory" },
  { text: "There is your Golden Heart. Before each run, you choose which items to bring.",
    target: () => qs('[data-key="inv-item-goldheart"]'), next: true },
  { text: "Back to the map.",
    target: () => qs("#screen-inventory [data-back]"), until: () => currentScreen === "modes" },
  { text: "XP is paid at the end of every run, from your final score. At the Exchange, XP becomes Snakebucks, which every save shares. Here is some XP to trade. Tap the booth.",
    enter: () => guideGift(Math.max(0, nextTierCost("xp") * xpPerBuck() - save.snakebucks * xpPerBuck()), "for the Exchange"),
    target: () => qs('[data-key="prop-exchange"]'), until: () => exchangeOpen },
  { text: "Slide to choose how much to trade, then press Trade.",
    target: () => qs("#ex-go"), until: () => save.snakebucks >= (nextTierCost("xp") || 0) },
  { text: "Done here.",
    target: () => qs("#ex-close"), until: () => !exchangeOpen },
  { text: "The shared things live with your saves. Back you go.",
    target: () => qs("#screen-modes [data-back]"), until: () => currentScreen === "profiles" },
  { text: "Every save shares the Great Tree, whose upgrades work on every island. It is paid for in Snakebucks. Tap it.",
    target: () => qs('[data-key="land-global"]'), until: () => currentScreen === "tree" && treeArea === "global" },
  { text: "Its trunk is the Experience Booster: fewer points for every XP. Tap it, then grow it with your Snakebucks.",
    enter: () => { guide.xpAt = save.tiers.xp || 0; },
    target: () => (treeSel === "xp" ? qs("#tree-card [data-buy]") : qs('[data-key="node-xp"]')), until: () => (save.tiers.xp || 0) > guide.xpAt || nextTierCost("xp") === null },
  { text: "Splendid. Everything else on this tree grows from that trunk. Back to your saves.",
    target: () => qs("#screen-tree [data-back]"), until: () => currentScreen === "profiles" },
  { text: "The Tailor sells skins, themes, things to wear, and faces for your saves. Tap the Tailor.",
    target: () => qs('[data-key="land-cosmetics"]'), until: () => currentScreen === "upgrades" },
  { text: "First, a skin. Pick the one you like. The others will wait, in the way that unsold things always wait.", pick: "skin", skip: tourGifted },
  { text: "And a theme, which repaints the board and the menus. This one is yours: Aurora Night. Tap it to wear it.", pick: "theme", skip: tourGifted },
  { text: "Something to wear. Googly eyes. They suit {name}, which is the first unkind thing I have said about it.", pick: "flair", skip: tourGifted },
  { text: "And a face for this save, so you can tell your saves apart. Pick one.", pick: "avatar" },
  { text: "Back to your saves.",
    target: () => qs("#screen-upgrades [data-back]"), until: () => currentScreen === "profiles" },
  { text: "The Trophy Hall is where a tortoise records every badge you earn, on every save. Some of them are flattering. Most are not.",
    target: () => qs('[data-key="land-achievements"]'), next: true },
  { text: "That is everything. Continue this save.",
    target: () => qs(`[data-play-slot="${activeSlot}"]`), until: () => currentScreen === "modes" },
  { text: () => `Tap the Garden, then its first ${nmRun() ? "Nightmare" : "level"}, and press Play.`,
    target: () => {
      const lv = nmRun() ? '[data-key="nm-easy-0"]' : '[data-key="lv-easy-0"]';
      return mapSel !== "easy" ? qs('[data-key="place-easy"]') : mapPop ? qs("#map-pop [data-play]") : qs(lv);
    },
    until: () => loadoutOpen || gameState === "PLAYING" },
  { text: "Before each run you can bring one-time items. Bring the Golden Heart, then start.",
    target: () => qs("#loadout .modal-box"), until: () => gameState === "PLAYING", pass: true }
];

function startTutorial() {
  clearPauseState();
  if (sceneOpen) { sceneDone = null; closeScene(); }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  save.named = true;
  persist();
  guide = { i: -1, replay: !!save.tutorialDone };
  openScreen("modes");
  guideEl.hidden = false;
  document.body.classList.add("guiding");
  guideStep(0);
  if (!guideRaf) guideRaf = requestAnimationFrame(guideLoop);
}

function guideStep(i) {
  if (!guide) return;
  if (i >= GUIDE_STEPS.length) { guideIntoRun(); return; }
  if (GUIDE_STEPS[i].skip && GUIDE_STEPS[i].skip()) { guideStep(i + 1); return; }
  guide.i = i;
  const st = GUIDE_STEPS[i];
  guide.step = st;
  guide.since = performance.now();
  if (st.enter) st.enter();
  renderGuideBox();
}

function renderGuideBox() {
  const st = guide.step;
  let extra = "";
  if (st.pick === "skin") {
    extra = `<div class="gb-picks">${GUIDE_SKINS.map(id => `<button class="gb-pick" data-gpick="${id}" aria-label="${escapeAttr(skinById[id].name)}"></button>`).join("")}</div>`;
  } else if (st.pick === "theme") {
    extra = `<div class="gb-picks"><button class="gb-pick wide" data-gpick="${GUIDE_THEME}" aria-label="Aurora Night"></button></div>`;
  } else if (st.pick === "flair") {
    extra = `<div class="gb-picks"><button class="gb-pick wide" data-gpick="googly" aria-label="Googly Eyes"></button></div>`;
  } else if (st.pick === "avatar") {
    extra = `<div class="gb-picks">${FREE_AVATARS.map(id => `<button class="gb-pick av" data-gpick="${id}" aria-label="${escapeAttr(AVATAR_BY_ID[id].name)}">${avatarHtml(id)}<span class="gb-name">${escapeAttr(AVATAR_BY_ID[id].name)}</span></button>`).join("")}</div>`;
  }
  guideBoxEl.innerHTML = `<div class="gb-top"><span class="gb-who">Tutorial · ${guide.i + 1} of ${GUIDE_STEPS.length}</span><button class="gb-skip" data-gskip>Skip tutorial</button></div>
    <p class="gb-text">${escapeAttr(withName(typeof st.text === "function" ? st.text() : st.text))}</p>${extra}
    ${st.next ? `<div class="gb-act"><button class="btn btn-small gb-next" data-gnext>Next</button></div>` : ""}`;
  guideBoxEl.querySelector("[data-gskip]").addEventListener("click", skipTutorial);
  const nx = guideBoxEl.querySelector("[data-gnext]");
  if (nx) { nx.addEventListener("click", () => guideStep(guide.i + 1)); setTimeout(() => nx.focus({ preventScroll: true }), 30); }
  guideBoxEl.querySelectorAll("[data-gpick]").forEach(b => {
    const id = b.dataset.gpick;
    let art;
    if (st.pick === "avatar") { b.addEventListener("click", () => guidePick("avatar", id)); return; }
    if (st.pick === "skin") art = skinBubbleArt(skinById[id], 56);
    else if (st.pick === "theme") art = themePreview(backdropById[id]);
    else art = flairPreview({ face: "googly" }, 120, 52);
    art.classList.add("gb-art");
    b.appendChild(art);
    if (st.pick === "skin") b.insertAdjacentHTML("beforeend", `<span class="gb-name">${escapeAttr(skinById[id].name)}</span>`);
    b.addEventListener("click", () => guidePick(st.pick, id));
  });
  guideBoxEl.classList.remove("pop");
  void guideBoxEl.offsetWidth;
  guideBoxEl.classList.add("pop");
}

/* The free cosmetics: given and worn on the spot */
function guidePick(kind, id) {
  if (kind === "skin") {
    if (!save.ownedSkins.includes(id)) save.ownedSkins.push(id);
    save.selectedSkin = id;
    upgradeTab = "skins";
  } else if (kind === "theme") {
    if (!save.ownedBackdrops.includes(id)) save.ownedBackdrops.push(id);
    save.selectedBackdrop = id;
    applyBackdrop();
    upgradeTab = "backdrops";
  } else if (kind === "avatar") {
    if (!save.ownedAvatars.includes(id)) save.ownedAvatars.push(id);
    save.avatar = id;
    upgradeTab = "avatars";
  } else {
    if (!save.ownedFlair.includes("googly")) save.ownedFlair.push("googly");
    save.flair.face = "googly";
    if (!save.freebies.includes("tour")) save.freebies.push("tour");
    upgradeTab = "flair";
  }
  persist();
  sfx("buy");
  confetti();
  if (currentScreen === "upgrades") renderUpgradeBody();
  guideStep(guide.i + 1);
}

/* Follows the thing to press every frame (the map zooms, the trees sway) */
function guideLoop() {
  guideRaf = 0;
  if (!guide) return;
  guideRaf = requestAnimationFrame(guideLoop);
  const st = guide.step;
  if (!st) return;
  if (st.until && performance.now() - guide.since > 250 && st.until()) { guideStep(guide.i + 1); return; }
  const el = st.target ? st.target() : null;
  const vw = window.innerWidth, vh = window.innerHeight;
  if (visible(el) && !sceneOpen && !confirmOpen) {
    const r = el.getBoundingClientRect();
    const pad = 8;
    const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad), w = Math.min(vw, r.width + pad * 2), h = Math.min(vh, r.height + pad * 2);
    guideShadeEl.style.clipPath = `path(evenodd, "M0 0H${vw}V${vh}H0Z M${x} ${y}h${w}v${h}h${-w}Z")`;
    guideRingEl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    guideRingEl.hidden = false;
    guideShadeEl.classList.toggle("pass", !!st.pass);
    // keep the box out of the way of the thing it points at
    guideBoxEl.classList.toggle("top", r.top + r.height / 2 > vh * 0.58);
  } else {
    guideShadeEl.style.clipPath = st.pick ? `path(evenodd, "M0 0H${vw}V${vh}H0Z")` : "none";
    guideRingEl.hidden = true;
    guideBoxEl.classList.remove("top");
  }
}

/* The tour ends by playing the Garden's first level, where each new thing is pointed out */
function guideIntoRun() {
  const first = !save.tutorialDone;
  guide = null;
  guideEl.hidden = true;
  document.body.classList.remove("guiding");
  save.tutorialDone = true;
  if (first) save.consumables.revive = Math.min(999, save.consumables.revive + 1);
  ["shop", "inventory", "achievements", "easy"].forEach(id => { if (!save.seenScenes.includes(id)) save.seenScenes.push(id); });
  persist();
  if (first) showToast("Tutorial complete! A free Revive is in your Satchel.");
  guideRun = gameState === "PLAYING";
  // point out the snake itself, before anything else
  // once the snake has slithered a few squares, so there's something to look at
  if (guideRun) setTimeout(() => {
    if (gameState === "PLAYING" && !introOpen && !paused) openIntroCard("controls", { x: snake.x, y: snake.y, size: 1 }, makeView(performance.now()));
  }, 900);
}

function skipTutorial() {
  if (!guide) return;
  guide = null;
  guideEl.hidden = true;
  document.body.classList.remove("guiding");
  save.tutorialDone = true;
  persist();
  if (loadoutOpen) return;
  if (gameState !== "PLAYING") openScreen("modes");
}

/* While the tour runs, keys only do what the tour is asking */
document.addEventListener("keydown", e => {
  if (!guide || !guide.step) return;
  const st = guide.step;
  if (e.target && e.target.tagName === "INPUT") return;
  if (st.pass) return;
  const go = e.key === "Enter" || e.code === "Space";
  e.preventDefault();
  e.stopImmediatePropagation();
  if (!go) return;
  if (st.next) { guideStep(guide.i + 1); return; }
  const el = st.target && st.target();
  if (visible(el)) el.click();
}, true);

/* Used by automated tests to jump straight to the menu on a fresh save */
function skipFirstRun() {
  if (!activeSlot) { activeSlot = 1; store.setItem(ACTIVE_KEY, "1"); save.created = Date.now(); }
  save.named = true;
  save.tutorialDone = true;
  if (sceneOpen) { sceneDone = null; closeScene(); }
  if (guide) { guide = null; guideEl.hidden = true; document.body.classList.remove("guiding"); }
  persist();
  openScreen("main");
}
