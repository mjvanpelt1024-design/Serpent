/* =========================================================
   tools/play-check-page.js
   Runs inside the game, loaded by tools/play-check.mjs (a throwaway browser profile).
   A classic script, so it sees the game's top-level names (camp, campStart, walls...).
   ========================================================= */
"use strict";

(async () => {
  const post = (p, data) => fetch(p, { method: "POST", body: JSON.stringify(data) });
  const log = msg => post("/__tool/log", { msg });
  const passed = [], problems = [];
  const errors = [];
  window.addEventListener("error", e => errors.push(String(e.message)));
  const cerr = console.error;
  console.error = function (...a) { errors.push(a.map(String).join(" ")); return cerr.apply(this, a); };
  const cwarn = console.warn;
  const warnings = [];
  console.warn = function (...a) { warnings.push(a.map(String).join(" ")); return cwarn.apply(this, a); };
  const check = (ok, what) => { (ok ? passed : problems).push(what); return ok; };
  const wait = async (test, tries = 1500) => { for (let i = 0; !test() && i < tries; i++) await new Promise(r => setTimeout(r, 100)); return test(); };

  try {
    if (!await wait(() => window.BOOTED)) throw new Error("the game didn't finish booting");
    await log("booted");
    // a save where every campaign level is won, so every level can be started
    if (!camp) loadCamp();
    CAMP.islands.forEach(I => { for (let n = 1; n <= LEVEL_COUNT; n++) camp.levels[campLevelId(I.id, n)] = { wins: 1, best: 0, flawless: false, bonus: false }; });

    const stop = () => { try { if (campRun) { campRun.over = true; campLeaveRun(); } } catch (e) { errors.push("leaving a run: " + e.message); } };

    // ----- 1. every campaign board comes from its .level file
    let boards = 0;
    for (const I of CAMP.islands) {
      for (let n = 1; n <= LEVEL_COUNT; n++) {
        const def = campLevelDef(I.id, n), id = `${I.id}-${n}`, F = CONTENT.gameLevels[id];
        if (def.layout === "tunnel") continue;
        if (!check(!!F, `${id}: has a .level file`)) continue;
        const before = warnings.length;
        campStart(I.id, n);
        if (!campRun) { problems.push(`${id}: campStart didn't start a run`); continue; }
        const got = new Set([...walls.keys()]);
        const want = new Set();
        let start = null;
        F.board.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === "#" || ch === "P" || ch === "1" || ch === "3" || ">v<^abcd".includes(ch)) want.add(cellKey(x * cell, y * cell));
          if (ch === "S") start = [x, y];
        }));
        // a pressure plate is placed at random and clears the wall under it (placePlates)
        campObjs.forEach(o => want.delete(cellKey(o.x, o.y)));
        if (def.layout !== "maze" && def.layout !== "field") {
          // the start and three squares in front of it are always open
          for (let k = 0; k <= 3; k++) want.delete(cellKey((start[0] + k) * cell, start[1] * cell));
        }
        const same = got.size === want.size && [...want].every(k => got.has(k));
        check(same, `${id} (${def.layout}): ${got.size} walls, the file says ${want.size}`);
        if (def.layout === "maze") check(maze && maze.T === 80 && maze.groups.length === F.portals.length, `${id}: an 80-square maze with ${F.portals.length} portals`);
        if (def.layout === "field") check(maze && maze.T === 48 && maze.field, `${id}: a 48-square field`);
        if (def.layout === "pulse") check(!!pulse && pulse.sets[0].length > 0 && pulse.sets[1].length > 0, `${id}: pulse walls`);
        check(!warnings.slice(before).some(w => /No \.level file/.test(w)), `${id}: no missing-file warning`);
        boards++;
        stop();
      }
    }
    await log(`${boards} campaign boards built from files`);

    // ----- 2. the gem shop
    const g0 = camp.gems;
    camp.gemDaily = 0;
    check(gemDailyReady(), "gem shop: the daily gift is ready on a new save");
    campWalletUpdate();
    check(!!document.querySelector("#camp-wallet .cw-chip.gems"), "gem shop: the gems show in the top bar while the gift waits, even at 0 gems");
    document.querySelector("#camp-wallet .cw-chip.gems").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check(!!(gemShopEl && gemShopEl.classList.contains("active")), "gem shop: clicking the gems opens it");
    check(gemShopEl.querySelectorAll(".gs-offer").length === CAMP.rules.gems.store.length, `gem shop: shows all ${CAMP.rules.gems.store.length} offers`);
    await gemStoreBuy("daily");
    check(camp.gems === g0 + 5, "gem shop: the daily gift adds 5 gems");
    check(!(await gemStoreBuy("daily")) && camp.gems === g0 + 5, "gem shop: the daily gift can't be taken twice in a day");
    for (const id of ["g10", "g50", "g100", "g500", "g1000", "g2500"]) await gemStoreBuy(id);
    check(camp.gems === g0 + 5 + 10 + 50 + 100 + 500 + 1000 + 2500, "gem shop: every gem pack adds its gems");
    await gemStoreBuy("bundle");
    check(camp.boosts.surge === 10 && camp.boosts.lucky === 10, "gem shop: the bundle adds 10 levels of each booster");
    campStart("keep", 1);
    check(camp.boosts.surge === 9 && camp.boosts.lucky === 9 && campRun && campRun.lucky > 1, "gem shop: starting a level uses one level of each booster");
    stop();
    saveCamp();
    const reread = validateSave(readSigned(CAMP_KEY).data).data;
    check(reread.boosts.surge === 9 && reread.gems === camp.gems && reread.gemDaily === dayNumber() && reread.gemBought.g10 === 1, "gem shop: gems, boosters and the gift's day are in the saved file");
    closeGemShop();

    // ----- 3. nightmare mode: unlock, the first tunnel end to end, the roots, the shop, the save
    const N = CAMP.nightmare, top = N.order[0], cur = campCurrency(top).id;
    check(nmUnlocked(), "nightmare: open once the last island's last level is won");
    check(nmTunnelOpen(top) && !nmTunnelOpen(N.order[1]), "nightmare: only the first tunnel is open at first");
    // on the map: the first time it shows, the ground gives way under the top island
    camp.nm.open = false;
    openScreen("modes");
    await wait(() => mapSel === top && deepReveal[top] !== undefined, 40);
    check(camp.nm.open && mapSel === top && deepReveal[top] !== undefined, "nightmare: the map flies to the top island and digs it open");
    const pin = id => mapPinsEl.querySelector(`[data-key="nm-${top}-${id}"]`);
    await wait(() => mapFlip && mapSel === top && !deepFlipping(), 40);
    check(mapFlip && mapSel === top && !deepFlipping(), "nightmare: then the world turns around, to the islands' back sides");
    check(mapMirrored() && pin(1).style.left === (MAP_W - deepStop(top, 1).x) * 2 + "px", "nightmare: from behind the world is mirrored, the pins with it");
    check(["roots", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "shop", 11, "up"].every(id => !!pin(id) && !pin(id).hidden) && !mapPinsEl.querySelector(`[data-key^="nm-${N.order[1]}-"]`), "nightmare: the tunnel's stops are pins on the underside (and none on the next island yet)");
    check(!!pin("hole") && pin("hole").hidden && [...mapPinsEl.querySelectorAll(`.map-pin.level:not(.nm)[data-area="${top}"]`)].every(p => p.hidden), "nightmare: turned over, the surface's pins are hidden");
    check(mapBannerEl.textContent.includes(N.tunnels[top].name), "nightmare: the scroll says the tunnel's name");
    check(!pin(1).hidden && pin(2).classList.contains("locked") && pin("shop").classList.contains("locked"), "nightmare: level 1 is open; level 2 and the shop start locked");
    {
      const onFace = id => { const p = deepStop(top, id); return deepOnFace(top, p.x, p.y); };
      const off = ["roots", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "shop", 11, "up"].filter(id => !onFace(id));
      check(!off.length, "nightmare: every stop sits on the island's back face" + (off.length ? " (off: " + off.join(", ") + ")" : ""));
      check(deepBackArt(top).art.width > 0 && deepBackArt(N.order[2]).tag === "sealed", "nightmare: the underside is painted, and a sealed one for an island not dug yet");
    }
    const money0 = camp.wallet[cur];
    // level 1, just like a level up top: its pin brings it up close, a second click opens its card, Start plays it
    pin(1).click();
    check(!!mapPop && mapPop.focus && mapPop.key === top && mapPop.j === "n1" && nodeScrollEl.textContent.includes(N.tunnels[top].names[0]), "nightmare: level 1's pin brings it up close, its name on the scroll");
    check(nodeLinksNow.some(l => l.to.id === "nup" && l.role === "back") && nodeLinksNow.some(l => l.to.id === "n2"), "nightmare: up close, the screen's edges walk back to the hole and on to level 2");
    pin(1).click();
    check(mapGoalEl.classList.contains("open") && !!mapGoalEl.querySelector(".nm-card") && mapGoalEl.textContent.includes(N.tunnels[top].names[0]), "nightmare: a second click opens its card");
    mapGoalEl.querySelector('[data-mg="go"]').click();
    check(!!campRun && campRun.nmRun && campRun.board === `nm-${top}-1`, "nightmare: Start plays level 1 on its own board");
    check(!!nm[N.tunnels[top].twist], `nightmare: the tunnel's twist (${N.tunnels[top].twist}) is on`);
    check(campRun.def.speed > campLevelDef(top, N.base[0]).speed, "nightmare: faster than the level it's built on");
    {
      const F = CONTENT.gameLevels[`nm-${top}-1`];
      let want = 0; F.board.forEach(r => { want += (r.match(/[#P13]/g) || []).length; });
      check(walls.size <= want && walls.size >= want - 4, `nightmare: the board's walls come from its file (${walls.size} of ${want})`);
    }
    // after a run: like the 75, back on the map up close on the next stop, the run at the side
    const report = async k => { await wait(() => currentScreen === "modes" && !!mapPop && mapPop.j === "n" + k && mapFlip, 30); };
    const playStop = k => { actOnNode(top, "n" + k); const go = mapGoalEl.querySelector('[data-mg="go"]'); if (go) go.click(); };
    campWinLevel();
    await report(2);
    check(camp.nm.levels[`${top}:1`] === 1 && camp.wallet[cur] > money0, "nightmare: a win is recorded and paid in the island's money");
    check(!campRun && currentScreen === "modes" && mapSel === top && mapFlip && mapPop.j === "n2", "nightmare: after a win, back around the back of the island, up close on level 2");
    check(nodeSideEl.classList.contains("open") && nodeSideEl.textContent.includes(N.tunnels[top].names[0]), "nightmare: with the run at the side, like the 75");
    // levels 2-10, each from its stop up close
    for (let k = 2; k <= N.levels; k++) {
      playStop(k);
      if (!check(!!campRun && campRun.n === k, `nightmare: Next starts level ${k}`)) break;
      if (k === 6) {
        // the deep's snakes: level 6 of the first tunnel brings the cutter, the thief and the viper
        const kinds = campRun.nmKinds.map(s => s.id).sort().join(",");
        check(kinds === "nm_cutter,nm_thief,nm_viper", `nightmare: level 6's snakes are ${kinds}`);
        paused = false;
        currentHearts = 50;                 // a snake may reach your head while they move: don't let it end the run
        const t0 = performance.now();
        nmSpawnSnake(t0);
        check(nmSnakes.length > 0, "nightmare: a snake slithers in");
        for (let i = 0; i < 40; i++) nmTickSnakes(t0 + 1000 + i * 400);
        check(errors.length === 0, "nightmare: snakes move without errors");
        // one bites your head
        const s = nmSnakes[0] || (nmSpawnSnake(t0), nmSnakes[0]);
        if (s) {
          currentHearts = 3; campRun.armor = 0; graceUntil = 0;
          s.cells[0] = { x: snake.x + snake.dx * 2, y: snake.y };
          nmBite(s, performance.now());
          check(!nmSnakes.includes(s), "nightmare: a snake that bites is gone");
          check(currentHearts < 3 && !campRun.over, `nightmare: its bite hurts (${currentHearts} of 3 hearts left)`);
        }
      }
      campWinLevel();
      await report(k + 1);
    }
    check(nmShopOpen(top) && !pin("shop").classList.contains("locked"), "nightmare: the shop opens after level 5, on the map too");
    // the Maw
    playStop(11);
    check(!!campRun && campRun.n === N.levels + 1 && !!boss && boss.maw && boss.name === "The Maw", "nightmare: level 11 is the Maw");
    check(boss.hearts === N.maw.hearts && boss.armor === 0, "nightmare: the Maw's last stand (no armor, its hearts)");
    campWinLevel();
    await report(11);
    check(camp.nm.maw.includes(top) && nmTunnelOpen(N.order[1]), "nightmare: beating the Maw opens the next tunnel down");
    check(pin(11).classList.contains("slain"), "nightmare: the Maw's pin shows it beaten");
    // a moment later the next island down is dug
    await wait(() => mapSel === N.order[1] && deepReveal[N.order[1]] !== undefined, 50);
    await wait(() => mapFlip && mapSel === N.order[1] && !deepFlipping(), 40);
    check(mapSel === N.order[1] && mapFlip && !!mapPinsEl.querySelector(`[data-key="nm-${N.order[1]}-1"]`) && !mapPinsEl.querySelector(`[data-key="nm-${N.order[1]}-1"]`).hidden, "nightmare: then the map flies down, digs the next island and turns over again");
    // back up, and down again by the hole
    goBack();
    check(!mapFlip && mapSel === N.order[1], "nightmare: Back turns the islands right way up");
    await wait(() => !deepFlipping(), 30);
    selectPlace(top); pin("hole").click();
    check(mapFlip, "nightmare: the hole in the grass turns them over again");
    await wait(() => !deepFlipping(), 30);
    try { coilCache = null; coilArt(); check(coilCache.tag.includes(top), "nightmare: the Coil redraws with the beaten Maw's stretch in bone"); } catch (e) { problems.push("nightmare: the Coil: " + e.message); }
    // the roots: their stop branches off between the hole and level 1, and opens their tree, hung upside down
    check(deepNodeLinks(top, "nup").some(l => l.to.id === "nroots") && deepNodeLinks(top, "nroots").some(l => l.to.id === "nup"), "nightmare: the roots branch off the way from the hole to level 1");
    camp.wallet[cur] = 1e6;
    pin("roots").click();
    check(currentScreen === "tree" && treeArea === "roots" && treePinsEl.querySelectorAll(".tree-pin").length === 6 && document.getElementById("tree-title").textContent === N.roots[top].name, "nightmare: the roots' stop opens their tree screen, six roots like the six branches");
    treePinsEl.querySelectorAll(".tree-pin")[1].click();
    treeCardEl.querySelector("[data-buy]").click();
    check(camp.nm.roots.nr_heart === 1, "nightmare: a root grows like a branch does");
    check(camp.wallet[cur] === 1e6 - N.roots[top].upgrades[1].cost[0], "nightmare: it costs its first tier (times the tunnel's depth, 1)");
    goBack();
    await wait(() => currentScreen === "modes" && mapFlip, 30);
    check(currentScreen === "modes" && mapFlip, `nightmare: back from the roots, still around the back (screen ${currentScreen}, flip ${mapFlip}, ret ${nmShopReturn})`);
    nmStart(top, 1);
    check(campRun.extra.hearts >= 1 && currentHearts >= CAMP.rules.snake.hearts + 1, "nightmare: the roots' Heartwood adds a heart in the deep");
    stop();
    campStart("keep", 1);
    check(!(campRun.extra && campRun.extra.hearts), "nightmare: the roots do nothing above ground");
    stop();
    // the console: play a tunnel level, and unlock all takes in nightmare
    runConsole("dev nightmare.play spire 4");
    check(!!campRun && campRun.nmRun && campRun.isl === "spire" && campRun.n === 4, "console: dev nightmare.play plays any tunnel level");
    runConsole("dev run.win");
    await wait(() => currentScreen === "modes" && !campRun, 30);
    check(camp.nm.levels["spire:4"] >= 1, "console: dev run.win wins a tunnel level too");
    const nmSaved = JSON.stringify(camp.nm);
    runConsole("dev everything.unlock");
    check(N.order.every(k => camp.nm.maw.includes(k) && camp.nm.levels[`${k}:11`] >= 1) && Object.values(N.roots).every(R => R.upgrades.every(u => camp.nm.roots[u.id] === u.v.length)), "console: dev everything.unlock includes nightmare (every tunnel, Maw and root)");
    camp.nm = JSON.parse(nmSaved);
    if (currentScreen === "console" && typeof leaveConsole === "function") leaveConsole();
    // the shops: every merchant's five spots, three of the usual and two of the deep's
    for (const I of CAMP.islands) {
      const m = merchantStock(I.id, true), nmo = m.stock.filter(nmOffer), plain = m.stock.filter(o => !nmOffer(o));
      const spots = new Set(m.stock.map(o => o.spot));
      check(nmo.length === 2 && plain.length === CAMP.rules.merchant.stockSize && spots.size === m.stock.length && [...spots].every(s => s >= 0 && s <= 4),
        `nightmare: ${I.id}'s merchant has 2 of the deep's things beside its ${plain.length} usual, each in its own spot`);
      check(nmo.every(o => campItemDef(o.id).family === I.merchantFamily && CAMP.nightmare.sold.includes(o.rarity)), `nightmare: ${I.id}'s are of its own kind, in the deep's rarities`);
      check(nmo.every(o => offerPrice(I.id, o) === Math.round(nmPrice(I.id, o.id, o.rarity) * (1 - upPct("haggle")))), `nightmare: ${I.id}'s are at nightmare prices`);
    }
    // buy one from the tunnel's shop stop: the island's merchant
    camp.wallet[cur] = 1e7;
    pin("shop").click();
    check(currentScreen === "campshop" && shopIsl === top && shopKind === "merchant", "nightmare: the tunnel's shop stop opens its island's merchant");
    const ks = merchantStock(top), ki = ks.stock.findIndex(nmOffer), kid = ks.stock[ki].id;
    const n0 = camp.satchel.length;
    ssAct("buy", { i: ki });
    check(camp.satchel.length === n0 + 1 && camp.satchel.some(it => it.id === kid) && ks.stock[ki].sold, "nightmare: the deep's thing sells into your satchel");
    goBack();
    await wait(() => currentScreen === "modes" && mapFlip, 30);
    check(currentScreen === "modes" && mapFlip, "nightmare: back from the shop, the islands are still turned over");
    // the save
    saveCamp();
    const back = validateSave(readSigned(CAMP_KEY).data);
    check(back.data.nm.maw.includes(top) && back.data.nm.levels[`${top}:11`] === 1 && back.data.nm.roots.nr_heart === 1 && back.data.satchel.some(it => it.id === kid), "nightmare: tunnels, the Maw, roots and the deep's things are in the saved file");
    check(!back.issues.length, "nightmare: the saved file passes the save check" + (back.issues.length ? ": " + back.issues.slice(0, 3).join("; ") : ""));
    // the title screen: the Maw's poster
    renderTitleDeco();
    // (on the flat arcade a poster on the wall; on the 3D machine, src/art/arcade-3d.js, one of its wall's posters)
    check(/td-poster maw/.test(titleDeco.innerHTML + titleWall.innerHTML) || !!(typeof A3D !== "undefined" && A3D.data && A3D.data.posters.some(p => p.name === "The Maw")), "nightmare: the Maw's wanted poster is on the title screen");
    await log("nightmare: first tunnel played end to end");

    // ----- 3a. the top bar: every island's money, always; the legend: the island in the middle of the map
    openScreen("modes");
    campWalletUpdate();
    check(document.querySelectorAll("#camp-wallet .cw-chip").length === CAMP.islands.length + 1, "top bar: all five coins and the gems, always");
    for (const k of ["reef", "spire"]) {
      stopGlide(); mapSel = null;
      mapCam = camOn(ISLANDS[k].x, ISLANDS[k].y, mapNear()); applyCam(mapCam);
      check(mapLegendEl.classList.contains("open") && mapLegendEl.dataset.key === k, `map legend: follows the island in view (${k}, got ${mapLegendEl.dataset.key})`);
    }
    selectPlace("hollow");
    check(mapLegendEl.dataset.key === "hollow", "map legend: the picked island's when one is picked");

    // ----- 3b. the sandbox is on the title screen, under Play
    openScreen("main");
    const sbBtn = document.getElementById("menu-sandbox");
    check(!!sbBtn && sbBtn.offsetParent !== null, "sandbox: a Sandbox button on the title screen");
    if (sbBtn) sbBtn.click();
    check(currentScreen === "shelf", `sandbox: it opens the level select (got ${currentScreen})`);
    const backBtn = document.querySelector("#screen-shelf [data-back]");
    if (backBtn) backBtn.click();
    check(currentScreen === "main", `sandbox: Back returns to the title screen (got ${currentScreen})`);
    document.getElementById("menu-sandbox").click();
    document.getElementById("shelf-new").click();
    check(currentScreen === "sandbox", `sandbox: New level opens the editor (got ${currentScreen})`);
    openRules();
    check(document.querySelectorAll("#rules-list select[data-kit][data-part=id]").length === 6, "sandbox: the editor's Loadout panel has the kit");
    closeRules();

    // ----- 4. a sandbox level with a kit: plays as a campaign level wearing it, and leaves the save alone
    {
      const L = normalizeLevel(newLevel("Kit test"));
      L.g = "..S" + ".".repeat(47) + "A" + ".".repeat(49) + "#".repeat(8) + "...." + "#".repeat(8) + ".".repeat(280);
      L.kit = { gear: { id: "nm_mawfang", r: "legendary" }, helmet: { id: "wyrmhelm", r: "legendary" }, body: { id: "wyrmmail", r: "legendary" },
        spell: { id: "fireball", r: "rare" }, pet: { id: "turtle", r: "common" }, rune: { id: "fury", r: "fine" }, food: { id: "stew", r: "rare" } };
      L.sc = { knightling: [[0, 3], [0, 5]] };
      L.r.h = 2; L.r.t = ["dark"]; L.e = "a";
      const clean = normalizeLevel(L);
      check(Object.keys(clean.kit).length === 6 && !clean.kit.food, "sandbox kit: six slots kept, a snack isn't a kit slot");
      check(JSON.stringify(parseLevelText(levelFileText(clean)).kit) === JSON.stringify(clean.kit), "sandbox kit: survives the .level file");
      check(JSON.stringify(parseLevelCode(levelCode(clean)).kit) === JSON.stringify(clean.kit), "sandbox kit: survives a share code");
      sbLevel = JSON.parse(JSON.stringify(clean)); renderRules();
      check(document.querySelectorAll("#rules-list select[data-kit][data-part=id]").length === 6 && document.querySelectorAll("#rules-list select[data-part=r]").length === 6, "sandbox kit: the Loadout panel has a pick and a rarity for each slot");
      const strip = c => { const o = JSON.parse(JSON.stringify(c)); delete o.played; return JSON.stringify(o); };
      const before = strip(camp), satchel0 = camp.satchel.length;
      check(levelProblems(clean).length === 0, "sandbox kit: the test level is playable" + (levelProblems(clean).length ? ": needs " + levelProblems(clean).join(", ") : ""));
      playCustom(clean, true);
      check(!!campRun && campRun.sandbox && !campRun.nmRun, "sandbox kit: plays as a campaign level" + (errors.length ? " (" + errors.slice(-2).join(" | ") + ")" : ""));
      if (!campRun) throw new Error("no kit run");
      check(campEquipped("gear") && campEquipped("gear").id === "nm_mawfang" && campEquipped("gear").uses > 0 && campEquipped("helmet").id === "wyrmhelm", "sandbox kit: wears the level's kit, not yours");
      check(!!campRun.rune && campRun.rune.id === "fury" && campEquippedId("pet") === "turtle", "sandbox kit: its rune and familiar work");
      check(currentHearts === Math.max(0, 2 + runeVal("hearts")) && !!nm.dark && campRun.rivalAt === Infinity, "sandbox kit: the level's hearts and twist, no rival snake");
      check(MODE_ITEMS.campaign.knightling && MODE_ITEMS.campaign.knightling.max === 2 && !MODE_ITEMS.campaign.sinkhole, "sandbox kit: its spawner chips, and none of an island's own");
      check(walls.size === 16 - [0, 1, 2, 3].filter(k => walls.has(cellKey((2 + k) * cell, 0))).length && snake.x === 2 * cell && snake.y === 0, "sandbox kit: its walls and start");
      campFail("wall");
      // (with no profile picked, as here, the sandbox screens send you to pick one first: openScreen)
      const back = want => currentScreen === want || (!activeSlot && currentScreen === "profiles");
      check(!campRun && sbKitNow === null && back("sandbox"), "sandbox kit: a loss goes back to the editor" + ` [screen ${currentScreen}, run ${!!campRun}, kit ${!!sbKitNow}]`);
      { const a = JSON.parse(strip(camp)), b = JSON.parse(before); const diff = Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); check(!diff.length && camp.satchel.length === satchel0, "sandbox kit: the save is exactly as it was" + (diff.length ? " [differs: " + diff.join(", ") + "]" : "")); }
      // a kit with a boss
      clean.b = "reef"; clean.bf = 2;
      playCustom(clean, false);
      check(!!boss && boss.fight === 2 && campRun.def.goal.type === "boss", "sandbox kit: an island boss fight");
      campWinLevel();
      check(!campRun && back("shelf") && strip(camp) === before, "sandbox kit: a win goes back to the level list, nothing paid");
      // a level with no kit plays the old way
      clean.kit = {}; clean.b = "";
      playCustom(clean, true);
      check(!campRun && currentModeKey === "custom", "sandbox: a level with no kit plays as before");
    }

    // ----- build 53 review: the editor is laid out like the play screen
    {
      openScreen("main");
      document.getElementById("menu-sandbox").click();
      document.getElementById("shelf-new").click();
      const box = id => document.getElementById(id).getBoundingClientRect();
      const L = box("sb-palette"), M = box("sb-board"), R = box("sb-rules");
      check(currentScreen === "sandbox" && L.right <= M.left && M.right <= R.left, "sandbox: tools on the left, the board in the middle, the loadout on the right");
      check(document.querySelectorAll("#rules-list select[data-kit][data-part=id]").length === 6, "sandbox: the loadout is open beside the board, no pop-up");
      check(SB_CATS[0].tools.map(t => t.label).join(",") === "Barrier block,Mirror block,Barrier,Mirror", "sandbox: the walls are barriers and mirrors");
      openScreen("main");
    }

    // ----- build 53 review: nightmare on the map: one hole, it remembers where you were, the side button turns it
    {
      const N = CAMP.nightmare, order = N.order;
      check(order.join(",") === CAMP.islands.map(I => I.id).reverse().join(","), `nightmare: the tunnels go backwards through the islands (${order.join(", ")})`);
      runConsole("dev nightmare.open " + order[order.length - 1]);
      document.querySelectorAll(".modal.active").forEach(m => m.classList.remove("active"));
      openScreen("modes");
      const holes = [...mapPinsEl.querySelectorAll(".map-pin.nmhole")].map(p => p.dataset.area);
      check(holes.length === 1 && holes[0] === order[0], `nightmare: only the top island has a hole (${holes.join(", ")})`);
      selectPlace(order[2]);
      legendGo(order[2], "nightmare");
      await wait(() => !deepFlipping(), 40);
      check(mapFlip && camp.nm.under && camp.at === order[2], "nightmare: the side button turns the world around where you are");
      openScreen("main");
      openScreen("modes");
      await wait(() => mapSel === order[2] && mapFlip, 30);
      check(mapSel === order[2] && mapFlip, `nightmare: the map opens again around the back, on the island you left (${mapSel}, ${mapFlip})`);
      const up = nodeLinks(order[2], "nup").find(l => l.to.key === order[1]);
      check(!!up && up.to.id === "n11", "nightmare: further down, the tunnel's start leads back up the Maw's body to the lair above");
      legendGo(order[2], "nightmare");
      await wait(() => !deepFlipping(), 40);
      openScreen("main");
      openScreen("modes");
      await wait(() => mapSel === order[2], 30);
      check(!mapFlip && !camp.nm.under && mapSel === order[2], "nightmare: turned back, it opens on the front, still on that island");
      const tips = rootTips([0, 0, 0, 0, 0, 0], [5, 5, 5, 5, 5, 5]), full = rootTips([5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5]);
      check([1, 2, 3, 4, 5].every(i => Math.hypot(full[i][0] - ROOT_TRUNK.x, full[i][1] - ROOT_TRUNK.y) > Math.hypot(tips[i][0] - ROOT_TRUNK.x, tips[i][1] - ROOT_TRUNK.y) + 10),
        "roots: each root reaches further as it grows");
      openScreen("main");
    }

    // ----- mods: none on, so the game is untouched (the mods themselves: tools/mods/, docs/MODDING.md)
    check(CONTENT.cosmetics && CONTENT.cosmetics.filter === null && CONTENT.cosmetics.overlay === null && MOD_FILTER === null && MOD_OVERLAY === null &&
      !document.getElementById("mod-crt") && !document.getElementById("mod-overlay") && !document.documentElement.classList.contains("mod-crt"),
      "mods: with none on, no screen filter and no stats overlay");
    check(Object.keys(CONTENT.modTextures).length === 0 && !CAMP.itemById.rapier, "mods: with none on, no mod pictures or things");

    // ----- build 54: the title's arcade machine in 3D, its controls on the snake, and looking around
    if (typeof A3_OK !== "undefined" && A3_OK && arcadeFits()) {
      openScreen("main");
      await wait(() => A3D.on && A3D.base, 30);
      check(A3D.on && document.body.classList.contains("arcade3d") && /matrix3d/.test(stageEl.style.transform), "title: the machine is 3D and the board sits in its screen");
      const at = (m, dx, dy, dz) => { const v = new THREE.Vector3(dx, dy, dz); m.localToWorld(v); v.project(A3D.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const click = ([x, y]) => { window.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y, button: 0 })); window.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: y })); };
      demo.dir = { x: 0, y: 1 };
      click(at(A3D.joy.group, -12, 2, 0));
      check(demo.want && demo.want.x === -1 && demo.handsOn > performance.now(), "title: pushing the joystick left turns the snake left");
      const apples = demo.apples.length;
      click(at(A3D.buttons.find(b => b.kind === "feed").cap, 0, 1.5, 0));
      check(demo.apples.length > apples, "title: the yellow button drops apples");
      demo.body = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]; demo.dir = { x: 0, y: -1 }; demo.want = { x: 0, y: 1 }; demo.handsOn = performance.now() + 5000;
      demoStep();
      check(demo.body.length === 4 && !(demo.handsOn > performance.now()), "title: steered into itself, the snake starts over and plays by itself");
      storyQueue = []; storyThen = null; storyEl.classList.remove("open");          // (a story page left open by the checks above)
      document.querySelectorAll(".modal.active").forEach(m => m.classList.remove("active"));
      const play = document.querySelector("#screen-main button"), r = play.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      check(!!hit && (hit === play || play.contains(hit)), `title: the menu in the machine's screen still takes clicks (${play.id || play.textContent.trim()} -> ${hit ? (hit.id || hit.className || hit.tagName) : "nothing"})`);
    }
    {
      openScreen("modes");
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));
      await wait(() => Math.abs(parseFloat(document.documentElement.style.getPropertyValue("--mx")) || 0) > 0.3, 40);
      const mx = parseFloat(document.documentElement.style.getPropertyValue("--mx")) || 0, my = parseFloat(document.documentElement.style.getPropertyValue("--my")) || 0;
      check(mx < -0.3 && Math.abs(mx - my) < 0.05, `look-around: the map drifts toward the mouse, as far up as across (${mx}, ${my})`);
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: innerWidth / 2, clientY: innerHeight / 2 }));
      openScreen("main");
    }

    // ----- build 53 review: a trinket is named by its two stats, its rarity sets its numbers
    {
      const cool = CAMP.craftById.t_cooling;
      check(trinketTitle(cool, "rare") === "Rare Cooling Body Fan" && trinketSummary(cool, "rare") === "Ember Immunity - Fire Resistance 20%",
        `trinkets: the brief's example, "Rare Cooling Body Fan: Ember Immunity - Fire Resistance 20%" (got ${trinketTitle(cool, "rare")}: ${trinketSummary(cool, "rare")})`);
      const fe = CAMP.craftById.t_fire_ember, ef = CAMP.craftById.t_ember_fire;
      check(fe.name !== ef.name, `trinkets: Fire then Ember isn't Ember then Fire (${fe.name} / ${ef.name})`);
      const o = campOrder("armory", "t_cooling", 0.001);
      o.readyAt = 0;
      campCollect(o.n);
      const it = camp.satchel.find(x => x.id === "t_cooling");
      const g = campGive("sword", "common");
      campFit(g.uid, it.uid);
      camp.equip.gear = g.uid;
      const ks = kitStats();
      check(g.trinketR === it.rarity && ks["ember.immunity"] === 1 && ks["fire.resistance"] === trinketVal("fire.resistance", 10, it.rarity),
        `trinkets: a made one keeps its rarity when fitted and its numbers count (${it.rarity}, ${JSON.stringify(ks)})`);
      const v = validateSave(JSON.parse(JSON.stringify(camp)));
      const g2 = v.data.satchel.find(x => x.uid === g.uid);
      check(g2 && g2.trinketR === it.rarity, "trinkets: the save check keeps a fitted trinket's rarity");
    }

    // ----- build 55: the new things, and the 3D map's and rooms' fallbacks (this browser has no graphics card)
    {
      const newIds = ["scimitar", "cinderwhip", "glacierpick", "hornetlance", "mosscap", "mosscloak", "glasshood", "glassvest", "pilgrimhat", "pilgrimcoat",
        "frostward", "thornring", "razorgust", "skipstep", "honeycake", "chili", "minttea", "hermit", "gecko", "moth"];
      check(newIds.every(id => CAMP.itemById[id]), "items: all twenty of build 55's things exist");
      check(newIds.every(id => !!texResolve("ci:" + id)), "items: each has its own picture");
      check(["moss", "glass", "pilgrim"].every(sid => CAMP.items.filter(i => i.set === sid).map(i => i.piece).sort().join() === "body,helmet"), "items: each new armor set is a helmet and a body piece");
      check(CAMP.items.filter(i => i.acts).every(i => CAMP.itemById[i.acts]), "items: everything that borrows a behavior borrows a real one");
      check(typeof M3 !== "undefined" && typeof R3 !== "undefined", "3D: the map's and the rooms' modules are loaded");
      const dressed = CAMP.islands.every(I => ["decor", "front"].every(n => !!texResolve(`shop:${I.id}:${n}`)) && ["challenger-decor", "challenger-front", "banker-decor"].every(n => !!texResolve(`npc:${I.id}:${n}`)));
      check(dressed, "shops: every island's shop, tent and vault has its dressing pictures");
      const sword = campItemActs("scimitar") === "sword" && campItemActs("frostward") === "forcefield" && campItemActs("moth") === "firefly";
      check(sword, "items: new weapons, spells and familiars act like the ones they borrow from");
    }

    // ----- build 56: edges, tiles, enemy brains, hazards, boss objectives, new goals (docs/BUILD-56.md)
    {
      const here = (isl, n, goal) => { stop(); campStart(isl, n); entities = []; apples = []; rocks = []; popsicles = []; hazards = []; if (!goal) campObjs = []; currentHearts = 3; paused = false; reviveCountdown = 0; graceUntil = 0; Object.assign(campRun, { secondWind: false, echoReady: false, phoenix: false, pet: null, wards: {}, jellyUntil: 0 }); };
      const put = (cx, cy, dx, dy, len = 1) => { snake.x = cx * cell; snake.y = cy * cell; snake.dx = dx * cell; snake.dy = dy * cell; snake.cells = [{ x: snake.x, y: snake.y }]; snake.maxCells = len; turnQueue = []; };
      const hp = () => currentHearts * 8 + (campRun ? campRun.armor || 0 : 0);
      const hd = () => [snake.x / cell, snake.y / cell];
      const alive = () => !!campRun && !campRun.over && gameState === "PLAYING";
      const dbg = () => `[state ${gameState}, run ${!!campRun}, over ${campRun && campRun.over}, hp ${hp()}, pos ${hd()}, dir ${snake.dx / cell},${snake.dy / cell}]`;
      // edges
      here("spire", 1); put(19, 5, 1, 0); stepSnake();
      check(alive() && hd().join() === "0,6" && snake.dx > 0, "edges: a stair comes out the other side one row lower " + hd());
      here("spire", 1); put(5, 0, 0, -1); stepSnake();
      check(!alive(), "edges: a side left as a wall is still deadly");
      here("spire", 4); put(0, 5, -1, 0); stepSnake();
      check(alive() && hd().join() === "19,14" && snake.dx < 0, "edges: a flipped link comes out the far side, flipped " + hd());
      here("spire", 9); put(5, 0, 0, -1); stepSnake();
      check(alive() && hd().join() === "19,5" && snake.dx < 0, "edges: a link can lead to a chosen side (top to the right, heading in) " + hd());
      here("hollow", 1); put(5, 0, 0, -1); stepSnake();
      check(alive() && snake.dy === 0 && snake.dx !== 0 && snake.y === 0, "edges: a bumper turns you along the edge");
      here("hollow", 2); const h0 = hp(); let turned = true;
      for (let k = 0; k < 12 && hp() >= h0 && alive(); k++) { put(19, 5, 1, 0); stepSnake(); turned = turned && snake.dx === 0; }      // (a hazard ward in the test save can turn a prick aside)
      check(alive() && hp() < h0 && turned, "edges: a briar pricks, then turns you " + dbg());
      here("hollow", 4); put(19, 5, 1, 0); score = 100; stepSnake();
      check(alive() && hd().join() === "0,5" && score === 60, "edges: a toll lets you through for its price (" + score + ")");
      here("reef", 1); runMs = 0; put(0, 5, -1, 0); stepSnake();
      check(alive() && hd().join() === "19,5", "edges: the tide is out and the side is open " + hd());
      here("reef", 1); runMs = 6000; put(0, 5, -1, 0); stepSnake();
      check(!alive(), "edges: the tide is in and the side is a wall");
      here("crown", 1); put(19, 5, 1, 0); stepSnake();
      check(!alive(), "edges: a lock holds until its condition is met");
      here("crown", 1); campRun.apples = 8; put(19, 5, 1, 0); stepSnake();
      check(alive() && hd().join() === "0,5", "edges: ...and then it's open " + hd());
      // tiles inside the board
      here("keep", 7); put(7, 4, -1, 0); stepSnake();
      check(!alive(), "tiles: a one-way gate is a wall the wrong way");
      here("keep", 7); put(5, 4, 1, 0); stepSnake();
      check(alive() && hd().join() === "6,4", "tiles: ...and open the right way " + hd());
      here("spire", 7); put(4, 9, 0, 1); stepSnake();
      check(alive() && hd().join() === "15,11" && snake.dy > 0, "tiles: a linked door comes out past its partner " + hd());
      // hazards
      here("keep", 1); entities.push({ type: "conveyor", x: 5 * cell, y: 5 * cell, size: 1, small: false, spawnAt: 0, dir: 0 }); put(4, 5, 1, 0); stepSnake();
      check(alive() && hd().join() === "6,5", "hazards: a belt shoves you an extra square " + hd());
      here("keep", 1); put(8, 10, 1, 0);
      { const t = { type: "turret", x: 0, y: 10 * cell, size: 1, small: false, spawnAt: 0, dir: 0, dir0: 0, nextAt: 1, fireAt: 1 }; entities.push(t); const hh = hp();
        for (let k = 0; k < 12 && hp() >= hh; k++) { t.fireAt = 1; ENTITY_TYPES.turret.tick(t, performance.now() + 50); }      // (a hazard ward in the test save can turn a shot aside)
        check(hp() < hh, "hazards: a turret's shot hits what's in its line " + dbg()); }
      here("keep", 1); put(8, 3, 1, 0);
      { const t = { type: "turret", x: 0, y: 10 * cell, size: 1, small: false, spawnAt: 0, dir: 0, dir0: 0, nextAt: 1, fireAt: 1 }; entities.push(t); const hh = hp(); ENTITY_TYPES.turret.tick(t, performance.now() + 50);
        check(hp() === hh, "hazards: ...and misses what isn't"); }
      here("keep", 1); put(6, 6, 1, 0);
      { const m = { type: "mine", x: 6 * cell, y: 6 * cell, size: 1, small: false, spawnAt: 0 }; entities.push(m); ENTITY_TYPES.mine.touch(m, performance.now()); const hh = hp(); ENTITY_TYPES.mine.tick(m, performance.now() + 5000);
        check(m.armed && hp() < hh, "hazards: a mine blows a moment after it's stepped on " + dbg()); }
      here("keep", 1);
      { const c = { type: "crumble", x: 6 * cell, y: 6 * cell, size: 1, small: false, spawnAt: 0 }; entities.push(c); const T = ENTITY_TYPES.crumble, t0 = performance.now(); T.touch(c, t0); T.tick(c, t0 + 2000);
        check(c.pit === true, "hazards: a cracked flagstone falls a moment after it's stepped on"); put(6, 5, 0, 1); stepSnake(); check(!alive(), "hazards: ...and a pit is deadly"); }
      here("keep", 1);
      { const g = { type: "geyser", x: 8 * cell, y: 8 * cell, size: 1, small: false, spawnAt: 0 }; entities.push(g); put(8, 9, 0, 1, 1); const T = ENTITY_TYPES.geyser, t0 = performance.now(); g.nextAt = t0 - 1; T.tick(g, t0); const hh = hp(); T.tick(g, t0 + 2000);
        check(g.state === "erupt" && g.plus && g.plus.length === 5, "hazards: a geyser bubbles, then erupts in a plus (a fire-immune test save may not feel it: " + (hh - hp()) + ")"); }
      here("keep", 1);
      { const b = { type: "blade", x: 10 * cell, y: 10 * cell, size: 1, small: false, spawnAt: 0 }; entities.push(b); put(2, 2, 1, 0); const T = ENTITY_TYPES.blade; let t0 = performance.now(); const xs = new Set(); for (let i = 0; i < 40; i++) { T.tick(b, t0 += 400); xs.add(b.x + "," + b.y); }
        check(xs.size >= 3 && b.rail, "hazards: a saw blade rides back and forth along its rail"); }
      // enemies: every new one thinks, moves where it should and never leaves the board
      {
        const ids = ["hound", "crow", "warden", "reflection", "gargoyle", "orb", "galesprite", "gnasher", "locust", "boar", "angler", "squid", "flyingfish", "shark", "golem", "cinderknight", "blastimp", "emberhound"];
        const bad = [];
        for (const id of ids) {
          here("keep", 1);
          for (let k = 0; k < 6; k++) apples.push({ x: (3 + k * 2) * cell, y: (4 + (k % 3) * 4) * cell, size: 1, small: false });
          put(10, 10, 1, 0, 6);
          for (let k = 0; k < 12; k++) brainTrail.push({ x: (4 + k) * cell, y: 10 * cell });
          const T = ENTITY_TYPES[id], ts0 = performance.now();
          if (!T) { bad.push(id + " missing"); continue; }
          const e = { type: id, x: 3 * cell, y: 3 * cell, size: 1, small: false, spawnAt: ts0, expiresAt: ts0 + 1e9 };
          if (T.spawn) T.spawn(e, ts0);
          entities.push(e);
          let moved = false, t = ts0;
          const startPos = e.x + "," + e.y;
          try {
            for (let i = 0; i < 400; i++) {
              t += 90;
              if (i % 7 === 0) { snake.x = Math.max(0, Math.min(19, Math.round(snake.x / cell) + (i % 14 === 0 ? 1 : -1))) * cell; snake.cells[0] = { x: snake.x, y: snake.y }; }
              if (i % 40 === 20) snake.dx = -snake.dx || cell;
              currentHearts = 3; graceUntil = 0;
              T.tick(e, t);
              if (e.x + "," + e.y !== startPos) moved = true;
              if (e.x < 0 || e.y < 0 || e.x >= boardSize || e.y >= boardSize) bad.push(`${id} left the board (${e.x},${e.y})`);
              if (!alive()) break;
            }
          } catch (err) { bad.push(`${id} threw: ${err.message}`); }
          if (!moved && !["gale", "sleeper"].includes((FOES[id] || {}).kind)) bad.push(`${id} never moved`);
        }
        check(!bad.length, "enemies: every new one thinks, moves and stays on the board" + (bad.length ? ": " + bad.join("; ") : ""));
      }
      // enemies that need a particular thing to happen
      here("keep", 1); put(10, 10, 1, 0, 3);
      { const e = { type: "reflection", x: 3 * cell, y: 3 * cell, size: 1, small: false, spawnAt: 0, expiresAt: 1e12 }; entities.push(e); let t = performance.now(); for (let i = 0; i < 60; i++) { t += 200; ENTITY_TYPES.reflection.tick(e, t); }
        check(e.x === boardSize - cell - snake.x && e.y === snake.y, "enemies: a mirror shade ends up exactly across the board from you " + [e.x / cell, e.y / cell]); }
      here("keep", 1); put(10, 10, 1, 0, 3);
      { const e = { type: "gargoyle", x: 14 * cell, y: 10 * cell, size: 1, small: false, spawnAt: 0, expiresAt: 1e12 }; entities.push(e); const t0 = performance.now(); ENTITY_TYPES.gargoyle.tick(e, t0 + 2000); ENTITY_TYPES.gargoyle.tick(e, t0 + 3000);
        check(e.x === 14 * cell && e.watched, "enemies: a gargoyle holds still while you face it");
        snake.dx = -cell; ENTITY_TYPES.gargoyle.tick(e, t0 + 4000); ENTITY_TYPES.gargoyle.tick(e, t0 + 5000);
        check(e.x < 14 * cell || e.y !== 10 * cell, "enemies: ...and creeps when you look away " + [e.x / cell, e.y / cell, e.watched, e.moveAt]); }
      here("keep", 1); put(10, 10, 1, 0, 3);
      { const e = { type: "boar", x: 4 * cell, y: 4 * cell, size: 1, small: false, spawnAt: 0, expiresAt: 1e12, asleep: true, sleeper: true }; entities.push(e); const t0 = performance.now(); ENTITY_TYPES.boar.tick(e, t0 + 1000); const was = e.asleep;
        snake.x = 5 * cell; snake.y = 4 * cell; apples.push({ x: 6 * cell, y: 4 * cell, size: 1, small: false }); eatApple(1, false);
        check(was === true && e.asleep === false, "enemies: a sleeper stays asleep until an apple is eaten near it"); }
      here("keep", 1); put(10, 10, 1, 0, 3); apples.push({ x: 5 * cell, y: 5 * cell, size: 1, small: false });
      { const e = { type: "crow", x: 5 * cell, y: 6 * cell, size: 1, small: false, spawnAt: 0, expiresAt: 1e12 }; entities.push(e); let t = performance.now(); for (let i = 0; i < 6 && !e.loaded; i++) { t += 600; ENTITY_TYPES.crow.tick(e, t); }
        check(e.loaded && !apples.some(a => a.x === 5 * cell && a.y === 5 * cell), "enemies: a crow takes an apple off the board"); }
      // boss objectives
      {
        const results = [];
        for (const I of CAMP.islands) {
          for (const fight of [1, 2, 3]) {
            here(I.id, fight * 5);
            if (!boss || !boss.obj) { results.push(`${I.id} ${fight}: no objective`); continue; }
            const B = boss, O = boss.obj, t0 = performance.now() + 5000;
            boss.objAt = 0; boss.retreatUntil = 0; tickBossObjective(t0);
            const spawned = boss.objState === "active" && (O.kind === "bait" ? apples.some(a => a.bait) : campObjs.length > 0);
            if (!spawned) results.push(`${I.id} ${fight}: nothing spawned`);
            if (O.kind === "pylons") campObjs.filter(o => o.kind === "pylon").forEach(o => { o.on = true; });
            if (O.kind === "beacons") campObjs.filter(o => o.kind === "beacon").forEach(o => { o.litUntil = t0 + 5000; });
            if (O.kind === "lure") { for (let i = 0; i < O.n; i++) { const m = campObjs.find(o => o.kind === "mark"); if (!m) break; boss.cells[0] = { x: m.x, y: m.y }; tickBossObjective(t0 + 100 * i); } }
            if (O.kind === "bait") { for (let i = 0; i < O.n; i++) { const b = apples.find(a => a.bait); if (!b) break; boss.cells[0] = { x: b.x, y: b.y }; tickBossObjective(t0 + 100 * i); } }
            tickBossObjective(t0 + 500);
            if (fight === 1) { if (!(boss.stamina < 1 || boss.beaten)) results.push(`${I.id} ${fight}: no wind knocked out`); }
            else {
              if (!(boss.openUntil > t0)) results.push(`${I.id} ${fight}: shield didn't drop`);
              const before = fight === 2 ? B.armor : B.hearts;
              boss.openUntil = 0; boss.exhaustedUntil = 0;
              damageBoss(1, "bite");
              const held = (fight === 2 ? B.armor : B.hearts) === before;
              boss.openUntil = performance.now() + 5000;
              damageBoss(1, "bite"); damageBoss(1, "bite");          // (Grimscale's last rally shrugs the first one off)
              const landed = (fight === 2 ? B.armor : B.hearts) < before || B.beaten;
              if (!held || !landed) results.push(`${I.id} ${fight}: shield held ${held}, then the blow landed ${landed}`);
            }
          }
        }
        check(!results.length, "bosses: every island's three fights run their objective, shield and window" + (results.length ? ": " + results.join("; ") : ""));
      }
      // new goals
      here("reef", 8, true);
      { const lamps = campObjs.filter(o => o.kind === "beacon"); lamps.forEach(l => touchCampObjs(l.x, l.y));
        check(lamps.length === 3 && goalMet(), "goals: lighting every lamp at once wins the lamp level (" + lamps.length + ") " + JSON.stringify(campGoal)); }
      here("reef", 3, true);
      { const z = campObjs.find(o => o.kind === "zone"); snake.x = z.x; snake.y = z.y; const g = campGoal; tickHold(performance.now(), 1000); const a = g.have; snake.x = 0; snake.y = 0; tickHold(performance.now(), 1000);
        check(!!z && a >= 0.99 && g.have < a, "goals: time in the ring counts, and time out of it drains"); }
      here("hollow", 3, true);
      { const g = campGoal; const pouch = campObjs.find(o => o.kind === "pouch"); touchCampObjs(pouch.x, pouch.y); const carried = g.carry; const d = campObjs.find(o => o.kind === "dropoff"); touchCampObjs(d.x, d.y);
        check(carried && !g.carry && g.have === 1, "goals: carry a pouch to the drop-off"); }
      stop();
    }

    check(errors.length === 0, "no errors in the console" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
  } catch (e) {
    problems.push("the check stopped: " + (e.stack || e.message));
  }
  await post("/__tool/result", { ok: problems.length === 0, passed, problems });
})();
