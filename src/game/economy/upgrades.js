/* =========================================================
   src/game/economy/upgrades.js
   Builds every upgrade from its .upg file; the economy table; prestige
   ========================================================= */
"use strict";

/* =========================================================
   Upgrades are content files:
     content/worlds/builtin/<island>/upgrades/*.upg   (each island's tree)
     content/great-tree/upgrades/*.upg               (the Great Tree)
   This turns them into the tracks the game uses. Prices are filled in by
   applyEconomy() (src/game/start.js) from content/economy.txt, unless a
   file lists its own prices.
   ========================================================= */
const ECON = CONTENT.economy;

const fmtX = Formats.FORMATTERS.x;
const fmtPerXp = Formats.FORMATTERS["per-xp"];

function trackFromFile(rec, extra) {
  const t = {
    label: rec.name || rec.id,
    desc: rec.description || "",
    base: typeof rec.base === "number" ? rec.base : 0,
    values: Formats.tiers(rec),
    prices: [],
    format: Formats.formatter(rec.format),
    file: rec._file
  };
  if (rec.color) t.color = rec.color;
  if (rec.prestige) t.prestige = rec.prestige;
  if (rec.group === "special") t.special = true;
  if (rec.effect) t.effect = String(rec.effect);
  if (Array.isArray(rec.prices)) { t.prices = rec.prices.map(Number); t.fixedPrices = true; }
  if (!t.values.length) console.warn(`${rec._file}: no values (give start, step and tiers, or values = [...])`);
  return Object.assign(t, extra);
}

/* requires: the island that has to be open before a track can be bought
   ("all" and "nightmare" are Great Tree groups) */
const upgradeTracks = {};
CONTENT.greatTree.forEach(rec => { upgradeTracks[rec.id] = trackFromFile(rec, rec.requires ? { requires: rec.requires } : {}); });
CONTENT.worldOrder.forEach(area => CONTENT.worlds[area].upgrades.forEach(rec => {
  upgradeTracks[rec.id] = trackFromFile(rec, rec.slot === "nightmare" ? { requires: area, nightmareOf: area } : { requires: area });
}));

/* Prestige: the 3 core tracks can be reset up to 3 times. Each rank keeps your
   maxed value as the new starting point, makes the final value `strength` times
   stronger (content/economy.txt [prestige]), and multiplies prices by 1 + rank. */
const PRESTIGE_STRENGTH = (ECON.prestige && ECON.prestige.strength) || 2;
const CORE_TRACKS = Object.keys(upgradeTracks).filter(k => upgradeTracks[k].prestige);   // the trunk and boughs
const MAX_PRESTIGE = CONTENT.rules.prestige.maxRank;
const PRESTIGE_RANKS = [""].concat(CONTENT.rules.prestige.rankNames);
const trimNum = v => Number(v.toPrecision(6));

/* Prestige cuts the whole Great Tree back (content/rules/rules.txt). Besides the trunk and
   boughs (10x per rank), the ranked parts come back 50% stronger per rank, at higher prices. */
const RANKED_TRACKS = CONTENT.rules.prestige.rankedTracks;
const RANK_CAP = CONTENT.rules.prestige.caps || {};
const RANK_ROUND = CONTENT.rules.prestige.rounding || {};
function trackInfo(key, prestige) {
  const t = upgradeTracks[key];
  if (!t.prestige && RANKED_TRACKS.includes(key)) {
    const r = Math.max(0, Math.min(MAX_PRESTIGE, prestige || 0));
    if (!r) return { base: t.base, values: t.values, prices: t.prices };
    const k = 1 + 0.5 * r, step = RANK_ROUND[key], cap = RANK_CAP[key];
    let last = 0;
    const values = t.values.map(v => {
      let x = step ? Math.round((v * k) / step) * step : Math.round(v * k * 100) / 100;
      if (cap) x = Math.min(cap, x);
      x = Math.max(x, last);
      last = x;
      return x;
    });
    return { base: t.base, values, prices: t.prices.map(pr => Math.round(pr * (1 + r))) };
  }
  const p = t.prestige ? Math.max(0, Math.min(MAX_PRESTIGE, prestige || 0)) : 0;
  if (!p) return { base: t.base, values: t.values, prices: t.prices };

  const strength = Math.pow(PRESTIGE_STRENGTH, p);
  const kept = Math.pow(PRESTIGE_STRENGTH, p - 1);
  const last = t.values[t.values.length - 1];
  const n = t.values.length;
  const prices = t.prices.map(pr => Math.round(pr * (1 + p)));

  if (t.prestige === "div") {
    // Runs from the kept value down to `strength` times better, following the original curve's
    // shape, so every tier is an upgrade over the starting point
    const base = last / kept;
    const max = last / strength;
    const span = Math.log(last / t.base);
    return { base: trimNum(base), values: t.values.map(v => trimNum(base * Math.pow(max / base, Math.log(v / t.base) / span))), prices };
  }
  return { base: trimNum(last * kept), values: t.values.map(v => trimNum(v * strength)), prices };
}
