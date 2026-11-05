/* =========================================================
   src/campaign/integrity.js
   Keeping the save and the campaign data honest.

   Two jobs:
     1. The save is signed. Every write stores the save's text with a
        signature made from it. If someone edits the save outside the
        game (localStorage, a text editor), the signature stops matching
        and the game falls back to the last copy it signed itself.
     2. Every value is checked against SAVE_SCHEMA on load. Anything out
        of range is clamped or dropped, so even a perfectly re-signed
        edit can't hand out a billion gems or a tier that doesn't exist.

   The campaign's data files (content/campaign/) are checked against
   content/campaign/manifest.dat, made by tools/sign-content.py. Edited
   data still loads, but the save is marked "modded" for good.

   This is tamper-evident, not tamper-proof: the key is in the game's
   own files. It stops casual editing, which is the point. Changes made
   through the console go through the game, so they are signed properly
   (and mark the save as cheated, once the console learns the campaign).

   To add a field to the save: add it to SAVE_SCHEMA below. That's all.
   ========================================================= */
"use strict";

const INTEGRITY_KEY = "coil-of-five:7f3a9c21";

/* FNV-1a over UTF-8, run twice with different seeds: a 64-bit hex digest.
   tools/sign-content.py has the same function, so the two always agree. */
function fnv32(bytes, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const utf8 = s => new TextEncoder().encode(String(s));
const normText = s => String(s).replace(/\r\n?/g, "\n");
function digest(text) {
  const b = utf8(normText(text));
  return fnv32(b, 2166136261).toString(16).padStart(8, "0") + fnv32(b, 3735928559).toString(16).padStart(8, "0");
}
const signText = text => digest(INTEGRITY_KEY + "|" + text + "|" + INTEGRITY_KEY);

/* ----- The schema: what a save may hold -----
   Each rule cleans one value and reports what it had to fix. */
const S = {
  int: (min, max, def = min) => ({ t: "int", min, max, def }),
  num: (min, max, def = min) => ({ t: "num", min, max, def }),
  str: (max, def = "") => ({ t: "str", max, def }),
  bool: (def = false) => ({ t: "bool", def }),
  oneOf: (list, def, must = false) => ({ t: "enum", list, def, must }),   // must: a bad value drops the whole record
  list: (of, max) => ({ t: "list", of, max }),
  map: (keys, of, max = 500) => ({ t: "map", keys, of, max }),      // keys: an array of allowed keys, or a regex
  obj: fields => ({ t: "obj", fields })
};

const DROP = Symbol("drop");
function checkValue(v, rule, path, issues) {
  const bad = why => { issues.push(`${path}: ${why}`); };
  switch (rule.t) {
    case "int":
    case "num": {
      let n = typeof v === "number" ? v : Number(v);
      if (v === undefined || v === null) return rule.def;
      if (!Number.isFinite(n)) { bad("not a number"); return rule.def; }
      if (rule.t === "int" && !Number.isInteger(n)) { n = Math.floor(n); bad("not a whole number"); }
      if (n < rule.min) { bad(`below ${rule.min}`); n = rule.min; }
      if (n > rule.max) { bad(`above ${rule.max}`); n = rule.max; }
      return n;
    }
    case "str":
      if (v === undefined || v === null) return rule.def;
      if (typeof v !== "string") { bad("not text"); return rule.def; }
      return v.slice(0, rule.max);
    case "bool":
      if (v === undefined) return rule.def;
      if (typeof v !== "boolean") { bad("not true/false"); return rule.def; }
      return v;
    case "enum":
      if (v === undefined) return rule.def;
      if (!rule.list().includes(v)) { bad(`"${v}" isn't allowed`); return rule.must ? DROP : rule.def; }
      return v;
    case "list": {
      if (v === undefined) return [];
      if (!Array.isArray(v)) { bad("not a list"); return []; }
      const out = [];
      v.slice(0, rule.max).forEach((x, i) => { const c = checkValue(x, rule.of, `${path}[${i}]`, issues); if (c !== undefined) out.push(c); });
      if (v.length > rule.max) bad(`more than ${rule.max} entries`);
      return out;
    }
    case "map": {
      if (v === undefined) return {};
      if (!v || typeof v !== "object" || Array.isArray(v)) { bad("not a table"); return {}; }
      const out = {};
      const allowed = typeof rule.keys === "function" ? rule.keys() : rule.keys;
      let count = 0;
      Object.keys(v).forEach(k => {
        if (k === "__proto__" || k === "constructor" || k === "prototype") { bad("reserved key"); return; }
        const ok = Array.isArray(allowed) ? allowed.includes(k) : allowed.test(k);
        if (!ok) { bad(`unknown key "${k}"`); return; }
        if (++count > rule.max) return;
        const c = checkValue(v[k], typeof rule.of === "function" ? rule.of(k) : rule.of, `${path}.${k}`, issues);
        if (c !== undefined) out[k] = c;
      });
      return out;
    }
    case "obj": {
      const src = v && typeof v === "object" && !Array.isArray(v) ? v : {};
      if (v !== undefined && src !== v) bad("not a record");
      const out = {};
      let drop = false;
      Object.entries(rule.fields).forEach(([k, r]) => { out[k] = checkValue(src[k], r, `${path}.${k}`, issues); if (out[k] === DROP) drop = true; });
      Object.keys(src).forEach(k => { if (!(k in rule.fields)) bad(`unknown field "${k}"`); });
      return drop ? undefined : out;
    }
  }
  return undefined;
}

/* Filled in lazily, so the schema can name ids from the campaign data */
const islandIds = () => CAMP.islands.map(i => i.id);
const currencyIds = () => CAMP.islands.map(i => i.currency.id);
const itemIds = () => CAMP.items.map(i => i.id);
const rarityIds = () => CAMP.rarities.map(r => r.id);
const slotIds = () => CAMP.slots.map(s => s.id);
const lootIds = () => CAMP.loot.map(l => l.id);
const upgradeMax = id => (CAMP.upgradeById[id] ? CAMP.upgradeById[id].values.length - 1 : 0);
const BIG = 1e12;

const ITEM_RULE = S.obj({
  uid: S.int(1, 1e9, 1),
  id: S.oneOf(() => itemIds().concat(lootIds()), "shield", true),
  rarity: S.oneOf(rarityIds, "common", true),
  uses: S.int(0, 99, 0),
  qty: S.int(1, 999, 1)
});

const STOCK_RULE = S.obj({
  id: S.oneOf(itemIds, "shield", true),
  rarity: S.oneOf(rarityIds, "common", true),
  sold: S.bool(false),
  deal: S.bool(false)
});

const SAVE_SCHEMA = S.obj({
  v: S.int(1, 1, 1),
  name: S.str(16, "Noodle"),
  named: S.bool(false),
  created: S.int(0, 9e15, 0),
  played: S.int(0, 9e15, 0),
  gems: S.int(0, 1e9, 0),
  wallet: S.map(currencyIds, S.int(0, BIG, 0)),
  // levels won: "keep:3" -> { wins, best, flawless }
  levels: S.map(/^[a-z]+:(1[0-5]|[1-9])$/, S.obj({ wins: S.int(0, 1e7, 0), best: S.int(0, BIG, 0), flawless: S.bool(false) })),
  shops: S.map(/^[a-z]+:(merchant|challenger|banker|bridge)$/, S.bool(false)),
  upgrades: S.map(() => Object.keys(CAMP.upgradeById), k => S.int(0, upgradeMax(k), 0)),
  satchel: S.list(ITEM_RULE, 400),
  equip: S.map(slotIds, S.int(0, 1e9, 0)),
  nextUid: S.int(1, 1e9, 1),
  merchants: S.map(islandIds, S.obj({ stock: S.list(STOCK_RULE, 6), restockAt: S.int(0, 9e15, 0) })),
  challenges: S.map(islandIds, S.obj({
    levels: S.list(S.int(1, 15, 1), 3),
    mods: S.list(S.list(S.oneOf(() => CAMP.rules.challenge.mods.map(m => m.id), "swift"), 3), 3),
    done: S.list(S.bool(false), 3),
    startedAt: S.int(0, 9e15, 0),
    endsAt: S.int(0, 9e15, 0),
    claimed: S.bool(false),
    active: S.bool(false)
  })),
  stats: S.map(/^[a-zA-Z]+$/, S.int(0, BIG, 0), 80),
  achievements: S.map(() => CAMP.rules.achievements.map(a => a.id), S.bool(false)),
  skins: S.list(S.oneOf(() => CONTENT.skins.map(s => s.id), "classic"), 200),
  themes: S.list(S.oneOf(() => CONTENT.themes.map(t => t.id), "black"), 200),
  skin: S.oneOf(() => CONTENT.skins.map(s => s.id), "classic"),
  theme: S.oneOf(() => CONTENT.themes.map(t => t.id), "black"),
  at: S.oneOf(islandIds, "keep"),
  flags: S.obj({ modded: S.bool(false), cheats: S.bool(false), restored: S.int(0, 1e6, 0) })
});

/* Cleans a raw save. Returns { data, issues }. */
function validateSave(raw) {
  const issues = [];
  const data = checkValue(raw, SAVE_SCHEMA, "save", issues);
  return { data, issues };
}

/* ----- Signed storage ----- */
function writeSigned(key, data) {
  const text = JSON.stringify(data);
  const sealed = JSON.stringify({ d: text, s: signText(text) });
  try {
    store.setItem(key, sealed);
    store.setItem(key + "_good", sealed);       // the last copy the game itself signed
    return true;
  } catch (e) { return false; }
}

/* Reads a signed save. { data, status }: status is "ok", "none", "tampered" (fell back to the
   last good copy), "lost" (nothing usable) or "unsigned". */
function readSigned(key) {
  const open = raw => {
    if (!raw) return null;
    try {
      const box = JSON.parse(raw);
      if (!box || typeof box.d !== "string" || typeof box.s !== "string") return { bad: true };
      if (signText(box.d) !== box.s) return { bad: true };
      return { data: JSON.parse(box.d) };
    } catch (e) { return { bad: true }; }
  };
  let main = null, good = null;
  try { main = store.getItem(key); good = store.getItem(key + "_good"); } catch (e) { return { data: null, status: "none" }; }
  if (!main && !good) return { data: null, status: "none" };
  const m = open(main);
  if (m && !m.bad) return { data: m.data, status: "ok" };
  // The live copy was changed outside the game: keep it aside, use the last good one
  try { if (main) store.setItem(key + "_rejected_" + Date.now(), main); } catch (e) { /* storage full */ }
  const g = open(good);
  if (g && !g.bad) return { data: g.data, status: "tampered" };
  return { data: null, status: "lost" };
}

/* ----- The campaign data files ----- */
function checkCampaignFiles() {
  const C = CONTENT.campaign;
  const lines = String(C.manifest || "").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  if (!lines.length) return { ok: false, why: "no manifest" };
  const want = {};
  let seal = "";
  lines.forEach(l => {
    const [path, hash] = l.split(/\s+/);
    if (path === "seal") seal = hash; else want[path] = hash;
  });
  const listed = Object.keys(want).sort();
  const body = listed.map(p => `${p} ${want[p]}`).join("\n");
  if (signText(body) !== seal) return { ok: false, why: "the manifest itself was edited" };
  const changed = Object.keys(C.texts).filter(p => want[p] !== digest(C.texts[p]));
  const missing = listed.filter(p => !(p in C.texts));
  if (changed.length || missing.length) return { ok: false, why: "changed: " + changed.concat(missing).join(", ") };
  return { ok: true };
}
