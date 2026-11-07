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
    levels: {}, shops: {}, upgrades: {}, satchel: [], equip: {}, pocket: [0, 0, 0, 0], nextUid: 1,
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
  // runes used to stack and burn up: now every one is its own stone, kept for good
  campSplitRunes(c);
  Object.keys(c.equip).forEach(slot => {
    const it = c.satchel.find(x => x.uid === c.equip[slot]);
    if (!it || !CAMP.itemById[it.id] || campItemSlot(it.id) !== slot) delete c.equip[slot];
  });
  // snacks live in the pocket now: four slots, each a snack in the satchel, none twice
  const isSnack = uid => { const it = c.satchel.find(x => x.uid === uid); return !!(it && CAMP.itemById[it.id] && CAMP.itemById[it.id].family === "food"); };
  const pocket = (c.pocket || []).slice(0, 4);
  while (pocket.length < 4) pocket.push(0);
  if (c.equip.food) { if (!pocket.includes(c.equip.food)) { const i = pocket.indexOf(0); if (i >= 0) pocket[i] = c.equip.food; } delete c.equip.food; }
  c.pocket = pocket.map((uid, i) => (uid && isSnack(uid) && pocket.indexOf(uid) === i ? uid : 0));
  if (!campIslandOpen(c.at, c)) c.at = CAMP.islands[0].id;
  // later files fill in their own parts of the save (the story, workshops, orders...)
  CAMP_REPAIRS.forEach(fn => fn(c));
  return c;
}
/* Each part of the game that keeps something in the save can add a repair here: fn(save) */
const CAMP_REPAIRS = [];

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
  camp = c;                 // repairs may read upgrades through camp
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

/* The one sanctioned way to change the save from outside play: the console (coming later).
   The change runs through the schema, is signed like any other, and marks the save as cheated for good. */
function campCheatEdit(change) {
  change(camp);
  camp.flags.cheats = true;
  camp = repairCamp(validateSave(camp).data);
  saveCamp();
}

/* Starting over: the old save is kept aside, not deleted */
function resetCamp() {
  try { const old = store.getItem(CAMP_KEY); if (old) store.setItem(CAMP_KEY + "_reset_" + Date.now(), old); } catch (e) { /* full */ }
  camp = repairCamp(freshCamp());
  saveCamp();
}

/* A text copy of the save, for backing up by hand */
function exportCamp() {
  const text = JSON.stringify(camp);
  return "COIL1-" + btoa(unescape(encodeURIComponent(JSON.stringify({ d: text, s: signText(text) }))));
}
/* Reads a backup code without touching the save: { data } or { err } */
function parseCampCode(code) {
  try {
    const box = JSON.parse(decodeURIComponent(escape(atob(String(code).trim().replace(/^COIL1-/, "")))));
    if (signText(box.d) !== box.s) return { err: "That code was edited, so it can't be loaded." };
    return { data: repairCamp(validateSave(JSON.parse(box.d)).data) };
  } catch (e) { return { err: "That isn't a save code. It should start with COIL1-" }; }
}
function importCamp(code) {
  const got = parseCampCode(code);
  if (got.err) return got.err;
  camp = got.data;
  saveCamp();
  return "";
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
/* Which slot a thing goes in: its family's, except armor pieces (build 52), which go on your head or body */
const campItemSlot = id => { const d = campItemDef(id); if (d) return d.piece === "helmet" || d.piece === "body" ? d.piece : CAMP.families[d.family].slot; return CAMP.craftById && CAMP.craftById[id] ? "craft" : "loot"; };
const satchelItem = uid => camp.satchel.find(it => it.uid === uid) || null;
/* What's worn in a slot. While a sandbox level runs with a kit of its own (camp-sandbox.js), that kit
   stands in for yours: sbKitNow = { slot: item }, made up for the run and never in your satchel. */
let sbKitNow = null;
const campEquipped = slot => (sbKitNow ? sbKitNow[slot] || null : satchelItem(camp.equip[slot]));

/* How many uses or charges an item has, after upgrades. Gear and spells last for good now
   (build 51): this is what they have at the start of every level. Pass the item itself to count
   its fitted parts and trinket, its spell level and seal, or a fresh snack's extra charge. */
function freshUses(id, rarity, it = null) {
  const d = campItemDef(id);
  const r = rarityIdx(rarity);
  const slot = campItemSlot(id);
  if (slot === "gear") return it ? gearUses(it) : gearUses({ parts: builtInParts(id, rarity), trinket: "" });
  if (slot === "spell") return d.charges[r] + upVal("potent") + (it ? spellCharges(it) : 0);
  if (slot === "food") return d.charges[r] + upVal("hearty") + (it && it.fresh ? (CAMP.craft.kitchen || {}).freshCharges || 1 : 0);
  // a canister counts what's left of it in pieces: two to a heart, four to an armor plate
  if (slot === "canister") return d.armor[r] > 0 ? d.armor[r] * (CAMP.rules.snake.armorPieces || 4) : d.hearts[r] * 2;
  return 0;
}

/* "3 of 5 uses left", "You have 2", "2½ purple hearts left"... */
const fmtHalf = v => (Math.floor(v + 1e-9) || (v % 1 ? "" : "0")) + (v % 1 > 0.25 ? "½" : "");
function campItemLeft(it) {
  const slot = campItemSlot(it.id);
  if (slot === "pet") return it.train ? `Trained ${"★".repeat(it.train)}` : "Never wears out";
  if (slot === "rune") return "Yours for good";
  if (slot === "helmet" || slot === "body") { const s = typeof armorSetOf === "function" && armorSetOf(it.id); return s ? `${s.name} set · never wears out` : "Never wears out"; }
  if (slot === "gear") { const n = freshUses(it.id, it.rarity, it); return `Absorbs ${n} hit${n === 1 ? "" : "s"} a level`; }
  if (slot === "spell") { const n = freshUses(it.id, it.rarity, it); return `${n} charge${n === 1 ? "" : "s"} a level`; }
  if (slot === "loot" || slot === "craft") return it.qty > 1 ? `You have ${it.qty}` : "You have one";
  if (slot === "canister") {
    const d = campItemDef(it.id), armor = d.armor[rarityIdx(it.rarity)] > 0;
    const n = armor ? it.uses / (CAMP.rules.snake.armorPieces || 4) : it.uses / 2;
    const whole = Math.ceil(n - 1e-9);
    return armor ? `${whole} purple plate${whole === 1 ? "" : "s"} left${n % 1 ? " (one damaged)" : ""}` : `${fmtHalf(n)} purple heart${n <= 1 ? "" : "s"} left`;
  }
  const full = freshUses(it.id, it.rarity, it);
  return `${it.uses} of ${Math.max(full, it.uses)} charges left`;
}

function campGive(id, rarity = "common", extra = null) {
  const slot = campItemSlot(id);
  // junk and crafted pieces stack; everything else is its own piece
  if (slot === "loot" || slot === "craft") {
    const have = camp.satchel.find(it => it.id === id);
    if (have) { have.qty = Math.min(999, have.qty + 1); return have; }
  }
  const it = { uid: camp.nextUid++, id, rarity, uses: 0, qty: 1, parts: slot === "gear" ? builtInParts(id, rarity) : [], trinket: "", lv: 0, seal: false, train: 0, grade: -1, fresh: false };
  if (extra) Object.assign(it, extra);
  if (!["loot", "craft", "rune", "pet"].includes(slot)) it.uses = freshUses(id, rarity, it);
  camp.satchel.push(it);
  // the first piece of a kind goes straight on; a snack goes into a free pocket slot
  if (slot === "food") { const i = camp.pocket.indexOf(0); if (i >= 0) camp.pocket[i] = it.uid; }
  else if (slot !== "loot" && slot !== "craft" && !camp.equip[slot]) camp.equip[slot] = it.uid;
  return it;
}

function campDrop(uid) {
  camp.satchel = camp.satchel.filter(it => it.uid !== uid);
  Object.keys(camp.equip).forEach(s => { if (camp.equip[s] === uid) delete camp.equip[s]; });
  camp.pocket = camp.pocket.map(u => (u === uid ? 0 : u));
}

function campItemName(it) {
  const d = campItemDef(it.id);
  if (!d) return (CAMP.lootById[it.id] || CAMP.craftById[it.id] || { name: it.id }).name;
  if (d.family === "rune") return `${(CAMP.craft.forge || {}).grades ? CAMP.craft.forge.grades[runeGrade(it)] : campGradeName(it.id, it.rarity)} ${d.name}`;
  const lv = d.family === "spell" && it.lv ? ` +${it.lv}` : "";
  return `${it.fresh ? "Fresh " : ""}${campGradeName(it.id, it.rarity)} ${d.name}${lv}`;
}
/* "Rare", or for a rune its condition: "Pristine" */
function campGradeName(id, rarity) {
  const d = campItemDef(id), fam = d && CAMP.families[d.family];
  return fam && fam.grades ? fam.grades[rarityIdx(rarity)] : rarityName(rarity);
}

/* What an item sells for: a share of its shop price, or a loot trinket's value */
function campSellPrice(it) {
  const bonus = 1 + upPct("salvage");
  const d = campItemDef(it.id);
  if (!d) {
    // a crafted piece is worth what went into it
    const c = CAMP.craftById[it.id];
    if (c) return Math.max(1, Math.round(c.needs.reduce((a, id) => a + (CAMP.lootById[id] || { value: 1 }).value, 0) * 0.8 * bonus));
    return Math.round((CAMP.lootById[it.id] || { value: 1 }).value * bonus);
  }
  const P = CAMP.families[d.family].price;
  let base = P[rarityIdx(it.rarity)] * (d.priceMult || 1);   // an armor set's tier (build 52)
  // a rune is priced by its exact condition; snacks by what's left of them
  if (d.family === "rune") base = P[0] * ((CAMP.craft.forge || {}).sell || [0.35, 0.7, 1, 1.6, 2.4, 3.2, 3.8, 6])[runeGrade(it)] / 0.35;
  let wear = 1;
  if (d.family === "food" || d.family === "vessel") { const full = freshUses(it.id, it.rarity, it); wear = full > 0 ? Math.max(0.25, it.uses / full) : 1; }
  // fitted parts and trinkets, spell levels and seals, training: all worth a little more
  let extra = 1;
  if (d.family === "gear") extra += (it.parts || []).length * 0.15 + (it.trinket ? 0.3 : 0);
  if (d.family === "spell") extra += (it.lv || 0) * ((CAMP.craft.spells || {}).sellPerLevel || 8) / 100 + (it.seal ? 0.25 : 0);
  if (d.family === "pet") extra += (it.train || 0) * 0.2;
  if (it.fresh) extra += 0.2;
  return Math.max(1, Math.round(base * CAMP.rules.merchant.sellShare * wear * extra * bonus));
}

/* Which island's currency an item is bought and sold in */
function campItemIsland(id) {
  const d = campItemDef(id);
  if (!d) {
    if (CAMP.craftById[id]) return CAMP.islands[0].id;
    const l = CAMP.lootById[id];
    return l ? CAMP.islands[Math.max(0, Math.min(CAMP.islands.length - 1, l.island - 1))].id : CAMP.islands[0].id;
  }
  const isl = CAMP.islands.find(i => i.merchantFamily === d.family);
  return isl ? isl.id : CAMP.islands[0].id;
}

/* ----- Cosmetics: the old engine save draws them, so mirror the choice into it ----- */
function applyCampCosmetics() {
  save.settings.snakeName = camp.name;
  save.selectedSkin = camp.skin;
  save.selectedBackdrop = camp.theme;
  if (!save.ownedSkins.includes(camp.skin)) save.ownedSkins.push(camp.skin);
  if (!save.ownedBackdrops.includes(camp.theme)) save.ownedBackdrops.push(camp.theme);
  applyBackdrop();
}
