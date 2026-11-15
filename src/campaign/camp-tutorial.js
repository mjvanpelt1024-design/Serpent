/* =========================================================
   src/campaign/camp-tutorial.js
   The tutorial's chapters (build 57). The engine is src/ui/tour.js; this
   file says what to teach and when:

     welcome     a brand-new game, on the map: the top bar, the island, the path,
                 the shopkeepers, then Home (everything in it), then level 1
     merchant    the first time you walk into a merchant's shop
     workshop    the first time you step through to the workshop next door
     challenger  the first time you meet a challenger
     banker      the first time you meet a banker
     tree        once level 1 is won: the upgrade tree, and your first upgrade
     gift        once level 3 is won: the gem at the top and its free daily gift

   Every clock in the game (new stock, quests, orders, the daily gift) shows
   hours and minutes: fmtLeft in camp-shops.js. The chapters point them out.
   Which chapters are done lives in camp.tut; a save from before build 57
   counts what it has already done as seen.
   ========================================================= */
"use strict";

CAMP_REPAIRS.push(c => {
  if (!Array.isArray(c.tut)) c.tut = [];
  if (!c.tutInit) {
    c.tutInit = true;
    // a save that is already well along has seen all this; one that has only just begun hasn't
    const first = CAMP.islands[0].id;
    const won = n => campWon(first, n, c);
    const done = id => { if (!c.tut.includes(id)) c.tut.push(id); };
    if (Object.keys(c.levels).length) done("welcome");
    if (won(2)) done("tree");
    if (won(4) || c.gemDaily > 0) done("gift");
    if (c.merchants && Object.keys(c.merchants).length) { done("merchant"); done("workshop"); }
    if (c.challenges && Object.keys(c.challenges).length) done("challenger");
    if (won(15)) done("banker");
  }
});

const tutFirst = () => CAMP.islands[0].id;
const tutIsl = () => CAMP.islandById[tutFirst()];
/* "2 hours", "1 hour 30 minutes" */
function tutSpan(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} hour${h === 1 ? "" : "s"}` : "", m ? `${m} minute${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
}
const tutPin = (isl, id) => qs(`[data-key="${nodeKey(isl, id)}"]`);
const tutHomeSpot = id => qs(`[data-key="home-${id}"]`);
const tutInRun = () => typeof campRun !== "undefined" && !!campRun && gameState === "PLAYING";

/* ----- Welcome: the map, then Home, then level 1 ----- */
TUT_CHAPTERS.push({
  id: "welcome", title: "Welcome", inRun: true,
  when: () => currentScreen === "modes",
  steps: [
    { text: () => `Welcome, {name}. This is the map of the Coil: islands stacked up into the sky. Up here is your money: every island pays in its own coin, and the blue gem is the rare one.`,
      target: () => qs("#camp-wallet"), next: true },
    { text: () => `Everything starts on ${tutIsl().name}. Tap it to fly in close.`,
      target: () => qs(`[data-key="place-${tutFirst()}"]`), skip: () => mapSel === tutFirst(), until: () => mapSel === tutFirst() },
    { text: () => `Levels run along this path; win one to open the next. Every fifth is a boss, and beating ${tutIsl().boss.name} opens the way up. After level ${SHOP_AFTER.merchant} waits a merchant, after ${SHOP_AFTER.challenger} a challenger with quests, after ${SHOP_AFTER.banker} a banker.`,
      target: () => qsa(`[data-key^="lv-${tutFirst()}-"]`).concat(NPC_KINDS.map(k => tutPin(tutFirst(), k))), next: true },
    { text: "And this is Home. Tap it.",
      target: () => tutPin(tutFirst(), "home"), arrow: true, until: () => currentScreen === "camphome" },
    { text: "Home is where you keep your things, and everything here is a button. The trunk carving opens the upgrade tree, the satchel holds your gear, spells and snacks, the trophy shelf your achievements, the mirror and easel your looks.",
      target: () => ["tree", "satchel", "trophy", "mirror", "easel"].map(tutHomeSpot), next: true },
    { text: "That is Home. The arrow on the right edge walks on to level 1. Tap it, then tap level 1's pin.",
      target: () => (mapPop && mapPop.key === tutFirst() && mapPop.j === 1 ? tutPin(tutFirst(), 1) : qs(".node-arrow.next.open")), arrow: true, until: () => !!mapGoalFor || tutInRun() },
    { text: "This card says what you must do, the level's extra challenge, and what it pays. Press Start when you are ready. Steer with the arrow keys, WASD, or a swipe.",
      target: () => qs("#map-goal .mg-card"), until: () => tutInRun() }
  ],
  after() {
    // the level has begun: point out the snake once it has slithered a few squares
    // (after the 3, 2, 1 of the level's start)
    guideRun = tutInRun();
    let tries = 0;
    const point = () => {
      if (!guideRun || gameState !== "PLAYING" || introOpen || ++tries > 40) return;
      if (paused || reviveCountdown) { setTimeout(point, 400); return; }
      setTimeout(() => { if (gameState === "PLAYING" && !introOpen && !paused) openIntroCard("controls", { x: snake.x, y: snake.y, size: 1 }, makeView(performance.now())); }, 700);
    };
    point();
  }
});

/* ----- The merchant ----- */
const shelfSpots = () => qsa("#ss-spots .ss-spot").filter(b => !b.classList.contains("ws") && !b.classList.contains("bell") && !b.classList.contains("crate"));
TUT_CHAPTERS.push({
  id: "merchant", title: "The merchant",
  when: () => currentScreen === "campshop" && shopKind === "merchant" && ssSide === "shop",
  steps: [
    { text: () => `${CAMP.islandById[shopIsl].npcs.merchant.name}'s shelf. Three things are for sale at a time, each of a random rarity, and one of them is on sale. Tap a thing to read what it does, then buy it with ${CAMP.islandById[shopIsl].currency.plural}.`,
      target: shelfSpots, next: true },
    { text: () => `New stock arrives every ${tutSpan(Math.max(10, CAMP.rules.merchant.restockMinutes))}; the sign counts it down in hours and minutes. Too impatient? Ring the bell for new stock now, for ${CAMP.rules.merchant.rerollGems} gems.`,
      target: () => [qs("#ss-spots .ss-sign"), qs("#ss-spots .ss-spot.bell")], next: true },
    { text: () => `Sell what you do not need in the crate, paid in the coin it came from. And this arrow leads next door to the workshop, where ${WORKSHOP_NAME[workshopOf(shopIsl)].toLowerCase()} turns loot and coins into better things.`,
      target: () => [qs("#ss-spots .ss-spot.crate"), qs("#ss-go")], arrow: true, next: true, until: () => ssSide === "work" }
  ]
});

/* ----- The workshop next door ----- */
const WORKSHOP_TEXT = {
  armory: "The workbench turns junk from your travels into trinkets and parts, and the fitting stand fits them to your gear.",
  arcana: "The lectern raises your spells to higher levels, and the seal press puts a wax seal on one for an extra edge.",
  kitchen: "The recipe book cooks fresh snacks, which hold more charges than ordinary ones. The pantry holds the ingredients.",
  kennel: "The lagoon trains your familiars. A trained one is stronger, but it is away while it learns.",
  forge: "The anvil melts five runes into one better one."
};
TUT_CHAPTERS.push({
  id: "workshop", title: "The workshop",
  when: () => currentScreen === "campshop" && shopKind === "merchant" && ssSide === "work",
  steps: [
    { text: () => `${WORKSHOP_NAME[workshopOf(shopIsl)]}. ${WORKSHOP_TEXT[workshopOf(shopIsl)]}`,
      target: () => qsa("#ss-spots .ss-spot.ws:not(.orders)"), next: true },
    { text: () => `Making things takes real time, hours of it. Each order here shows its own countdown in hours and minutes, and the keeper holds up to ${ORDER_SLOTS} at once until you come to collect.`,
      enter: () => openSsPanel("orders"), target: () => qs("#ss-panel"), next: true }
  ],
  after: () => { if (typeof closeSsPanel === "function") closeSsPanel(); }
});

/* ----- The challenger ----- */
TUT_CHAPTERS.push({
  id: "challenger", title: "The challenger",
  when: () => currentScreen === "campshop" && shopKind === "challenger",
  steps: [
    { text: () => `${CAMP.islandById[shopIsl].npcs.challenger.name} sets quests. A quest is ${CAMP.rules.challenge.levels} to ${CAMP.rules.challenge.levelsMax} of this island's levels, played in order, each with its own twist. Point at a stone to see which level and what the twist is.`,
      target: () => qs(".cs-stones") || qs(".cs-plot"), next: true },
    { text: () => `Finish every trial for a pile of coins, plus a roll on the prize pool. You have ${CAMP.rules.challenge.days} days once you accept; the time left shows here and while you play, in days, hours and minutes. Press Start when you want to take it on.`,
      target: () => [qs(".cs-prize") || qs(".cs-quest"), qs(".cs-btns")], next: true }
  ]
});

/* ----- The banker ----- */
TUT_CHAPTERS.push({
  id: "banker", title: "The banker",
  when: () => currentScreen === "campshop" && shopKind === "banker",
  steps: [
    { text: () => `${CAMP.islandById[shopIsl].npcs.banker.name} trades money. ${campIslandIdx(shopIsl) > 0 ? "Coins can be swapped down to the island before this one, or into gems." : "Coins can be swapped into gems, the one thing the levels hardly ever pay."} Every trade has a flat fee, so one big trade beats lots of small ones. Cash out turns everything you hold into gems at once.`,
      target: () => qsa("#cs-body .cs-bank"), next: true }
  ]
});

/* ----- Level 1 is won: the upgrade tree ----- */
const tutUps = () => CAMP.islandById[tutFirst()].tree.upgrades;
const tutBuyable = () => tutUps().filter(u => upNextPrice(u.id) !== null && campWallet(tutFirst()) >= upNextPrice(u.id));
const tutTiers = () => tutUps().reduce((a, u) => a + upTier(u.id), 0);
TUT_CHAPTERS.push({
  id: "tree", title: "Upgrades",
  when: () => currentScreen === "modes" && campWon(tutFirst(), 1),
  steps: [
    { text: "Level 1 is yours, and it paid you in coins. Coins buy upgrades, which grow on your island's tree. Tap Home.",
      target: () => tutPin(tutFirst(), "home"), arrow: true, skip: () => currentScreen !== "modes", until: () => currentScreen === "camphome" },
    { text: "Tap the carving in the trunk to open the tree.",
      target: () => tutHomeSpot("tree"), skip: () => currentScreen === "tree", until: () => currentScreen === "tree" },
    { text: "Every fruit is an upgrade, and an upgrade works on every island. Tap one to see what it does now, what the next tier does, and its price.",
      enter: () => { const u = tutBuyable()[0]; if (u) { campTreeSel = u.id; renderCampTree(); } },
      target: () => qsa("#tree-pins .tree-pin").concat([qs("#tree-card")]), next: true },
    { text: () => tutBuyable().length ? "You can afford one already. Press Grow to buy this upgrade." : "You cannot afford one just yet. Win a few more levels and the coins will come, then press Grow on any fruit. Press back when you are done.",
      enter: () => { guide.tiers = tutTiers(); },
      target: () => (tutBuyable().length ? qs("#tree-card [data-buy]") : qs("#tree-card")),
      next: true, until: () => tutBuyable().length && tutTiers() > guide.tiers }
  ]
});

/* ----- Level 3 is won: the free gift ----- */
TUT_CHAPTERS.push({
  id: "gift", title: "A free gift",
  skipIf: () => !gemDailyReady() && campWon(tutFirst(), 3),
  when: () => currentScreen === "modes" && campWon(tutFirst(), 3) && gemDailyReady(),
  steps: [
    { text: "See the blue gem at the top, glinting? That means a free gift is waiting for you in the gem shop. Tap it.",
      target: () => qs("#camp-wallet .cw-chip.gems"), arrow: true, until: () => !!gemShopEl && gemShopEl.classList.contains("active") },
    { text: "This one is free, and it comes round every day. Press it to collect your gems.",
      target: () => qs(".gs-offer.daily [data-gs-buy]:not([disabled])") || qs(".gs-offer.daily"), arrow: true, until: () => !gemDailyReady() },
    { text: () => `Collected. The next gift is ready in ${fmtLeft(gemDailyLeft())}; the clock counts down in hours and minutes, here and beside the gem at the top. Close the shop when you are done.`,
      target: () => qs(".gs-offer.daily"), next: true }
  ]
});

/* ----- Settings: bring the tips back ----- */
(() => {
  const fun = SETTINGS_TABS.find(tab => tab.id === "fun");
  if (!fun) return;
  fun.rows.unshift(
    { type: "action", action: "tut-toggle", label: "Tutorial tips", help: "The little guides that explain each part of the game the first time you meet it.", button: () => (camp && camp.tutOff ? "Off" : "On") },
    { type: "action", action: "tut-replay", label: "Play the tutorial again", help: "Every tip comes round once more, starting on the map.", button: "Replay" }
  );
  settingsBodyEl.addEventListener("click", e => {
    const el = e.target.closest("button[data-action]");
    if (!el || !el.dataset.action.startsWith("tut-")) return;
    e.stopImmediatePropagation();
    if (el.dataset.action === "tut-toggle") {
      camp.tutOff = !camp.tutOff;
      saveCamp();
      sfx("click");
      renderSettings();
    } else {
      sfx("tab");
      startTutorial();
      showToast("The tips will start on the map.");
    }
  }, true);
})();
