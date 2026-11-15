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
    { text: () => `Welcome, {name}. This is the map of the Coil: islands stacked up into the sky, each with ${LEVEL_COUNT} levels, three shopkeepers and a home of its own. Let's have a look around.`, next: true },
    { text: "Up here is your money. Every island pays in its own coin, and the blue gem on the end is the rare one. Tap any of them to see what it is.",
      target: () => qs("#camp-wallet"), next: true },
    { text: () => `Everything starts on ${tutIsl().name}. Tap it to fly in close.`,
      target: () => qs(`[data-key="place-${tutFirst()}"]`), skip: () => mapSel === tutFirst(), until: () => mapSel === tutFirst() },
    { text: () => `The levels run along this path. Win one to open the next. Every fifth level is a boss, and beating ${tutIsl().boss.name} is how you open the way up to the next island.`,
      target: () => qsa(`[data-key^="lv-${tutFirst()}-"]`), next: true },
    { text: () => `Each boss guards a shopkeeper. After level ${SHOP_AFTER.merchant} comes a merchant, after ${SHOP_AFTER.challenger} a challenger with quests, and after ${SHOP_AFTER.banker} a banker. They each get a few tips of their own when you meet them.`,
      target: () => NPC_KINDS.map(k => tutPin(tutFirst(), k)), next: true },
    { text: "And this is Home. Tap it.",
      target: () => tutPin(tutFirst(), "home"), arrow: true, until: () => currentScreen === "camphome" },
    { text: "Home is where you keep your things. Everything here is a button: it lights up when you point at it. This carving in the trunk opens your island's upgrade tree, where coins turn into power.",
      target: () => tutHomeSpot("tree"), next: true },
    { text: "The satchel holds everything you own: gear, spells, snacks and trinkets from your travels. Whatever you wear here goes into the level with you.",
      target: () => tutHomeSpot("satchel"), next: true },
    { text: "The trophy shelf keeps your achievements. Each one you earn pays out gems.",
      target: () => tutHomeSpot("trophy"), next: true },
    { text: "The mirror changes your skin, and the easel changes the theme of the board. Gems pay for these, so there is no hurry.",
      target: () => [tutHomeSpot("mirror"), tutHomeSpot("easel")], next: true },
    { text: () => `That is Home. The arrow on the right edge walks on to level 1, so tap it.`,
      target: () => qs(".node-arrow.next.open"), until: () => currentScreen === "modes" && !!mapPop && mapPop.key === tutFirst() && mapPop.j === 1 },
    { text: "Level 1. Tap its pin to read what it asks of you.",
      target: () => tutPin(tutFirst(), 1), arrow: true, until: () => !!mapGoalFor || tutInRun() },
    { text: "This card says what you must do, what the level's extra challenge is, and what it pays. Press Start when you are ready. Steer with the arrow keys, WASD, or a swipe.",
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
    { text: () => `New stock arrives every ${tutSpan(Math.max(10, CAMP.rules.merchant.restockMinutes))}. This sign counts it down, in hours and minutes.`,
      target: () => qs("#ss-spots .ss-sign"), next: true },
    { text: () => `Too impatient to wait? Ring the bell for new stock right now. It costs ${CAMP.rules.merchant.rerollGems} gems.`,
      target: () => qs("#ss-spots .ss-spot.bell"), next: true },
    { text: "The crate is for selling. Anything you do not need can go in, and you are paid in the coin of the island it came from.",
      target: () => qs("#ss-spots .ss-spot.crate"), next: true },
    { text: () => `This arrow leads next door to the workshop, where ${WORKSHOP_NAME[workshopOf(shopIsl)].toLowerCase()} turns loot and coins into better things. Take a look when you are ready.`,
      target: () => qs("#ss-go"), arrow: true, next: true, until: () => ssSide === "work" }
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
      enter: () => openSsPanel("orders"), target: () => qs("#ss-panel"), next: true },
    { text: "That is the workshop. This arrow leads back to the shop.",
      enter: () => closeSsPanel(), target: () => qs("#ss-go"), next: true }
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
    { text: "Finish every trial for a pile of coins, plus a roll on the prize pool: gems, rare gear, skins and more. Point at the prize to see the odds.",
      target: () => qs(".cs-prize") || qs(".cs-quest"), next: true },
    { text: () => `You have ${CAMP.rules.challenge.days} days once you accept. The time left is shown here and in the side panel while you play, in days, hours and minutes. Press Start whenever you want to take it on.`,
      target: () => qs(".cs-btns") || qs(".cs-when") || qs(".cs-quest"), next: true }
  ]
});

/* ----- The banker ----- */
TUT_CHAPTERS.push({
  id: "banker", title: "The banker",
  when: () => currentScreen === "campshop" && shopKind === "banker",
  steps: [
    { text: () => `${CAMP.islandById[shopIsl].npcs.banker.name} trades money. ${campIslandIdx(shopIsl) > 0 ? "Coins can be swapped down to the island before this one, or into gems." : "Coins can be swapped into gems, the one thing the levels hardly ever pay."} Every trade has a flat fee, so one big trade beats lots of small ones.`,
      target: () => qsa("#cs-body .cs-bank").slice(0, -1), next: true },
    { text: "Cash out walks everything you hold, on this island and the ones below, down into gems in one go.",
      target: () => qsa("#cs-body .cs-bank").slice(-1), next: true }
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
    { text: "Every fruit is an upgrade, and the number on it is how many tiers you have grown. An upgrade works on every island, not only this one.",
      target: () => qsa("#tree-pins .tree-pin"), next: true },
    { text: "Tap a fruit to see it here: what it does now, what the next tier does, and the price in this island's coin.",
      enter: () => { const u = tutBuyable()[0]; if (u) { campTreeSel = u.id; renderCampTree(); } },
      target: () => qs("#tree-card"), next: true },
    { text: () => tutBuyable().length ? "You can afford one already. Press Grow to buy this upgrade." : "You cannot afford one just yet. Win a few more levels and the coins will come, then press Grow on whichever fruit you like.",
      enter: () => { guide.tiers = tutTiers(); },
      target: () => (tutBuyable().length ? qs("#tree-card [data-buy]") : qs("#tree-card")),
      next: true, until: () => tutBuyable().length && tutTiers() > guide.tiers },
    { text: "That is the tree. Press back when you are done; the island is waiting.",
      target: () => qs("#screen-tree [data-back]"), until: () => currentScreen !== "tree" },
    { text: "Your tree will fill out as you grow it. Walk on to level 2 whenever you are ready.", next: true }
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
    { text: () => `Collected. The next gift is ready in ${fmtLeft(gemDailyLeft())}. That clock counts down in hours and minutes, here and beside the gem at the top, so you always know when to come back. Gems also buy fresh stock at the merchant, new quests, and skins.`,
      target: () => qs(".gs-offer.daily"), next: true },
    { text: "Close the shop when you are done.",
      target: () => qs("#gemshop [data-gs-close]"), until: () => !gemShopEl || !gemShopEl.classList.contains("active") }
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
