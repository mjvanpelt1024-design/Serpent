/* =========================================================
   src/campaign/camp-save.js
   The one save. There is a single, linear campaign save: Play loads it,
   and there is nothing to choose. It is signed and schema-checked on
   every load (src/campaign/integrity.js).

   The old profile save (snakeSave/snakeProfile_*) still exists underneath
   for settings and engine stats, but nothing of the campaign lives in it.
   ========================================================= */
"use strict";

const CAMP_KEY = "snakeCampaign_v1";
let camp = null;
let campLoadNote = "";

function freshCamp() {
  const now = Date.now();
  return {
    v: 1, name: "Noodle", named: false, created: now, played: now,
    gems: CAMP.rules.gems.startGems || 0,
    wallet: Object.fromEntries(CAMP.islands.map(i => [i.currency.id, 0])),
    levels: {}, shops: {}, upgrades: {}, satchel: [], equip: {}, nextUid: 1,
    merchants: {}, challenges: {}, stats: {}, achievements: {},
    skins: CAMP.rules.cosmetics.freeSkins.slice(), themes: CAMP.rules.cosmetics.freeThemes.slice(),
    skin: CAMP.rules.cosmetics.freeSkins[0] || "classic", theme: CAMP.rules.cosmetics.freeThemes[0] || "black",
    at: CAMP.islands[0].id,
    flags: { modded: false, cheats: false, restored: 0 }
  };
}

/* Fills in anything the schema left empty and fixes links between parts */
function repairCamp(c) {
  CAMP.islands.forEach(i => { if (!(i.currency.id in c.wallet)) c.wallet[i.currency.id] = 0; });
  CAMP.rules.cosmetics.freeSkins.forEach(id => { if (!c.skins.includes(id)) c.skins.push(id); });
  CAMP.rules.cosmetics.freeThemes.forEach(id => { if (!c.themes.includes(id)) c.themes.push(id); });
  if (!c.skins.includes(c.skin)) c.skin = c.skins[0];
  if (!c.themes.includes(c.theme)) c.theme = c.themes[0];
  // uids are unique, and equipped items must be in the satchel and fit the slot
  const seen = new Set();
  c.satchel = c.satchel.filter(it => { if (seen.has(it.uid)) return false; seen.add(it.uid); return true; });
  c.nextUid = Math.max(c.nextUid, ...c.satchel.map(it => it.uid + 1), 1);
  Object.keys(c.equip).forEach(slot => {
    const it = c.satchel.find(x => x.uid === c.equip[slot]);
    if (!it || !CAMP.itemById[it.id] || CAMP.families[CAMP.itemById[it.id].family].slot !== slot) delete c.equip[slot];
  });
  if (!campIslandOpen(c.at, c)) c.at = CAMP.islands[0].id;
  return c;
}

function loadCamp() {
  const got = readSigned(CAMP_KEY);
  let c;
  if (got.status === "none") c = freshCamp();
  else if (!got.data) { c = freshCamp(); campLoadNote = "Your save couldn't be read, so a new one was started. The old one was kept aside."; }
  else {
    const { data, issues } = validateSave(got.data);
    c = data;
    if (got.status === "tampered") { c.flags.restored++; campLoadNote = "Your save was changed outside the game, so the last copy the game saved was loaded instead."; }
    else if (issues.length) campLoadNote = "Some save values were out of range and have been fixed.";
    if (issues.length) console.warn("Save fixes:", issues);
  }
  camp = repairCamp(c);
  const files = checkCampaignFiles();
  if (!files.ok) {
    console.warn("Campaign data check:", files.why);
    if (!camp.flags.modded) campLoadNote = (campLoadNote ? campLoadNote + " " : "") + "The game's data files have been edited, so this save is now marked as modded.";
    camp.flags.modded = true;
  }
  saveCamp();
}

function saveCamp() {
  if (!camp) return;
  camp.played = Date.now();
  if (!writeSigned(CAMP_KEY, camp) && !campSaveWarned) {
    campSaveWarned = true;
    showToast("Could not save your progress. Storage may be full or blocked.");
  }
}
let campSaveWarned = false;

/* Starting over: the old save is kept aside, not deleted */
function resetCamp() {
  try { const old = store.getItem(CAMP_KEY); if (old) store.setItem(CAMP_KEY + "_reset_" + Date.now(), old); } catch (e) { /* full */ }
  camp = freshCamp();
  saveCamp();
}

/* A text copy of the save, for backing up by hand */
function exportCamp() {
  const text = JSON.stringify(camp);
  return "COIL1-" + btoa(unescape(encodeURIComponent(JSON.stringify({ d: text, s: signText(text) }))));
}
function importCamp(code) {
  try {
    const box = JSON.parse(decodeURIComponent(escape(atob(String(code).trim().replace(/^COIL1-/, "")))));
    if (signText(box.d) !== box.s) return "That code was edited, so it can't be loaded.";
    const { data } = validateSave(JSON.parse(box.d));
    camp = repairCamp(data);
    saveCamp();
    return "";
  } catch (e) { return "That isn't a save code."; }
}

/* ----- Progress ----- */
const campWon = (isl, n, c = camp) => !!(c.levels[campLevelId(isl, n)] && c.levels[campLevelId(isl, n)].wins > 0);

function campIslandOpen(isl, c = camp) {
  const i = campIslandIdx(isl);
  if (i <= 0) return i === 0;
  return campWon(CAMP.islands[i - 1].id, LEVEL_COUNT, c);
}

function campLevelOpen(isl, n, c = camp) {
  if (!campIslandOpen(isl, c)) return false;
  return n === 1 || campWon(isl, n - 1, c);
}

function campShopOpen(isl, kind, c = camp) {
  return campIslandOpen(isl, c) && campWon(isl, SHOP_AFTER[kind], c);
}

/* The next thing to do on an island: the first level not yet won */
function campNextLevel(isl) {
  for (let n = 1; n <= LEVEL_COUNT; n++) if (!campWon(isl, n)) return n;
  return 0;
}

const islandsOpenCount = () => CAMP.islands.filter(i => campIslandOpen(i.id)).length;

/* ----- Stats and achievements ----- */
function campBump(stat, n = 1) {
  camp.stats[stat] = Math.min(1e12, (camp.stats[stat] || 0) + n);
}
function campStatValue(stat) {
  if (stat === "islandsOpen") return islandsOpenCount();
  if (stat === "uniqueWins") return Object.values(camp.levels).filter(l => l.wins > 0).length;
  return camp.stats[stat] || 0;
}
function campCheckAch() {
  CAMP.rules.achievements.forEach(a => {
    if (camp.achievements[a.id] || campStatValue(a.stat) < a.need) return;
    camp.achievements[a.id] = true;
    addGems(a.gems);
    showToast(`Achievement: ${a.name}  +${a.gems} gems`);
    sfx("badge");
  });
}

/* ----- Money ----- */
const campWallet = isl => camp.wallet[campCurrency(isl).id] || 0;
function campPay(isl, n) {
  const id = campCurrency(isl).id;
  camp.wallet[id] = Math.min(1e12, Math.max(0, (camp.wallet[id] || 0) + Math.round(n)));
  if (n > 0) campBump("earned_" + isl.replace(/[^a-z]/g, ""), Math.round(n));
}
function campSpend(isl, n) {
  if (campWallet(isl) < n) return false;
  camp.wallet[campCurrency(isl).id] -= n;
  return true;
}
function addGems(n) {
  camp.gems = Math.min(1e9, Math.max(0, camp.gems + Math.round(n)));
  if (n > 0) campBump("gemsEarned", Math.round(n));
}
const campMoney = (isl, n) => `${fmtInt(n)} ${n === 1 ? campCurrency(isl).name : campCurrency(isl).plural}`;

/* ----- Upgrades (every one works everywhere) ----- */
const upTier = id => camp.upgrades[id] || 0;
const upVal = id => (CAMP.upgradeById[id] ? CAMP.upgradeById[id].values[Math.min(upTier(id), CAMP.upgradeById[id].values.length - 1)] : 0);
const upPct = id => upVal(id) / 100;
function upNextPrice(id) {
  const u = CAMP.upgradeById[id];
  const t = upTier(id);
  return t < u.prices.length ? u.prices[t] : null;
}
function campBuyUpgrade(id) {
  const price = upNextPrice(id);
  const isl = CAMP.treeOf[id];
  if (price === null || !campSpend(isl, price)) return false;
  camp.upgrades[id] = upTier(id) + 1;
  campBump("upgradesBought");
  campCheckAch();
  saveCamp();
  return true;
}

/* ----- The satchel ----- */
const campItemDef = id => CAMP.itemById[id] || null;
const campItemSlot = id => (campItemDef(id) ? CAMP.families[campItemDef(id).family].slot : "loot");
const satchelItem = uid => camp.satchel.find(it => it.uid === uid) || null;
const campEquipped = slot => satchelItem(camp.equip[slot]);

/* How many uses or charges a fresh item starts with, after upgrades */
function freshUses(id, rarity) {
  const d = campItemDef(id);
  const r = rarityIdx(rarity);
  const slot = campItemSlot(id);
  if (slot === "gear") return d.uses[r] + upVal("sturdy");
  if (slot === "spell") return d.charges[r] + upVal("potent");
  if (slot === "food") return d.charges[r] + upVal("hearty");
  return 0;
}

function campGive(id, rarity = "common") {
  const slot = campItemSlot(id);
  // runes and loot stack; everything else is its own piece
  if (slot === "rune" || slot === "loot") {
    const have = camp.satchel.find(it => it.id === id && it.rarity === rarity);
    if (have) { have.qty = Math.min(999, have.qty + 1); return have; }
  }
  const it = { uid: camp.nextUid++, id, rarity, uses: slot === "loot" || slot === "rune" || slot === "pet" ? 0 : freshUses(id, rarity), qty: 1 };
  camp.satchel.push(it);
  // the first piece of a kind goes straight on
  if (slot !== "loot" && !camp.equip[slot]) camp.equip[slot] = it.uid;
  return it;
}

function campDrop(uid) {
  camp.satchel = camp.satchel.filter(it => it.uid !== uid);
  Object.keys(camp.equip).forEach(s => { if (camp.equip[s] === uid) delete camp.equip[s]; });
}

function campItemName(it) {
  const d = campItemDef(it.id);
  if (!d) return (CAMP.lootById[it.id] || { name: it.id }).name;
  return `${rarityName(it.rarity)} ${d.name}`;
}

/* What an item sells for: a share of its shop price, or a loot trinket's value */
function campSellPrice(it) {
  const bonus = 1 + upPct("salvage");
  const d = campItemDef(it.id);
  if (!d) return Math.round((CAMP.lootById[it.id] || { value: 1 }).value * bonus);
  const base = CAMP.families[d.family].price[rarityIdx(it.rarity)];
  // worn gear and spent spells are worth less
  const full = freshUses(it.id, it.rarity);
  const wear = full > 0 ? Math.max(0.25, it.uses / full) : 1;
  return Math.max(1, Math.round(base * CAMP.rules.merchant.sellShare * wear * bonus));
}

/* Which island's currency an item is bought and sold in */
function campItemIsland(id) {
  const d = campItemDef(id);
  if (!d) {
    const l = CAMP.lootById[id];
    return l ? CAMP.islands[Math.max(0, Math.min(CAMP.islands.length - 1, l.island - 1))].id : CAMP.islands[0].id;
  }
  const isl = CAMP.islands.find(i => i.merchantFamily === d.family);
  return isl ? isl.id : CAMP.islands[0].id;
}

/* ----- Cosmetics: the old engine save draws them, so mirror the choice into it ----- */
function applyCampCosmetics() {
  save.name = camp.name;
  save.selectedSkin = camp.skin;
  save.selectedBackdrop = camp.theme;
  if (!save.ownedSkins.includes(camp.skin)) save.ownedSkins.push(camp.skin);
  if (!save.ownedBackdrops.includes(camp.theme)) save.ownedBackdrops.push(camp.theme);
  applyBackdrop();
}
