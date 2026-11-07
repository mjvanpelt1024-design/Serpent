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
          if (ch === "#" || ch === "P" || ch === "1" || ch === "3") want.add(cellKey(x * cell, y * cell));
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
    openNmTunnels();
    check(!!(nmEl && nmEl.classList.contains("active")) && nmEl.querySelectorAll(".nm-node").length === N.levels + 3, "nightmare: the tunnel screen shows the roots, 10 levels, the shop and the Maw");
    check(nmEl.querySelector(".nm-scroll").textContent === N.tunnels[top].name, "nightmare: the scroll says the tunnel's name");
    check(!!nmEl.querySelector('.nm-node[data-k="2"]:disabled') && !!nmEl.querySelector(".nm-node.shop:disabled"), "nightmare: level 2 and the shop start locked");
    const money0 = camp.wallet[cur];
    // level 1, clicked on the screen
    nmEl.querySelector('.nm-node[data-k="1"]').click();
    check(!!campRun && campRun.nmRun && campRun.board === `nm-${top}-1`, "nightmare: clicking level 1 starts it on its own board");
    check(!!nm[N.tunnels[top].twist], `nightmare: the tunnel's twist (${N.tunnels[top].twist}) is on`);
    check(campRun.def.speed > campLevelDef(top, N.base[0]).speed, "nightmare: faster than the level it's built on");
    {
      const F = CONTENT.gameLevels[`nm-${top}-1`];
      let want = 0; F.board.forEach(r => { want += (r.match(/[#P13]/g) || []).length; });
      check(walls.size <= want && walls.size >= want - 4, `nightmare: the board's walls come from its file (${walls.size} of ${want})`);
    }
    campWinLevel();
    check(camp.nm.levels[`${top}:1`] === 1 && camp.wallet[cur] > money0, "nightmare: a win is recorded and paid in the island's money");
    check(!campRun && nmEl.classList.contains("active") && !!nmEl.querySelector(".nm-report.won"), "nightmare: after a win, back in the tunnel with the report");
    check(!!nmEl.querySelector('.nm-report [data-k], .nm-report [data-nm="next"]'), "nightmare: the report offers the next level");
    // levels 2-10 through the report's Next button
    for (let k = 2; k <= N.levels; k++) {
      nmEl.querySelector('.nm-report [data-nm="next"]').click();
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
    }
    check(nmShopOpen(top), "nightmare: the shop opens after level 5");
    // the Maw
    nmEl.querySelector('.nm-report [data-nm="next"]').click();
    check(!!campRun && campRun.n === N.levels + 1 && !!boss && boss.maw && boss.name === "The Maw", "nightmare: level 11 is the Maw");
    check(boss.hearts === N.maw.hearts && boss.armor === 0, "nightmare: the Maw's last stand (no armor, its hearts)");
    campWinLevel();
    check(camp.nm.maw.includes(top) && nmTunnelOpen(N.order[1]), "nightmare: beating the Maw opens the next tunnel down");
    try { coilCache = null; coilArt(); check(coilCache.tag.includes(top), "nightmare: the Coil redraws with the beaten Maw's stretch in bone"); } catch (e) { problems.push("nightmare: the Coil: " + e.message); }
    // the roots
    camp.wallet[cur] = 1e6;
    nmIsl = top;
    check(nmRootBuy("nr_heart") && camp.nm.roots.nr_heart === 1, "nightmare: a root upgrade can be bought");
    check(camp.wallet[cur] === 1e6 - N.roots[top].upgrades[1].cost[0], "nightmare: it costs its first tier (times the tunnel's depth, 1)");
    nmStart(top, 1);
    check(campRun.extra.hearts >= 1 && currentHearts >= CAMP.rules.snake.hearts + 1, "nightmare: the roots' Heartwood adds a heart in the deep");
    stop();
    campStart("keep", 1);
    check(!(campRun.extra && campRun.extra.hearts), "nightmare: the roots do nothing above ground");
    stop();
    // the shop
    const n0 = camp.satchel.length;
    check(nmBuy("nm_mawfang", "rare") && camp.satchel.length === n0 + 1 && camp.satchel.some(it => it.id === "nm_mawfang"), "nightmare: the deep's shop sells into your satchel");
    check(!nmBuy("nm_mawfang", "common"), "nightmare: only the rarities the deep sells");
    check(!merchantStock("keep", true).stock.some(o => o.id.startsWith("nm_")), "nightmare: the normal merchants never stock the deep's things");
    // the save
    saveCamp();
    const back = validateSave(readSigned(CAMP_KEY).data);
    check(back.data.nm.maw.includes(top) && back.data.nm.levels[`${top}:11`] === 1 && back.data.nm.roots.nr_heart === 1 && back.data.satchel.some(it => it.id === "nm_mawfang"), "nightmare: tunnels, the Maw, roots and the deep's things are in the saved file");
    check(!back.issues.length, "nightmare: the saved file passes the save check" + (back.issues.length ? ": " + back.issues.slice(0, 3).join("; ") : ""));
    // the title screen: the Maw's poster
    renderTitleDeco();
    check(/td-poster maw/.test(titleDeco.innerHTML + titleWall.innerHTML), "nightmare: the Maw's wanted poster is on the title screen");
    closeNmTunnels(true);
    await log("nightmare: first tunnel played end to end");

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

    check(errors.length === 0, "no errors in the console" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
  } catch (e) {
    problems.push("the check stopped: " + (e.stack || e.message));
  }
  await post("/__tool/result", { ok: problems.length === 0, passed, problems });
})();
