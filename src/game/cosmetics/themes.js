/* =========================================================
   src/game/cosmetics/themes.js
   Builds themes from content/themes, and the cosmetic tiers
   ========================================================= */
"use strict";

/* =========================================================
   Backdrops (10 solid + 10 patterns)
   base   = main colour, used for readability checks
   accent = secondary colour that covers a lot of the board (also checked)
   lines  = thin detail colour (not checked, too little area to matter)
   ========================================================= */
/* Every theme is a file in content/themes/ (listed in content/themes/_index.dat).
   Patterned themes name a painter from src/art/theme-painters.js. */
const backdrops = CONTENT.themes.map(t => {
  const bd = { id: t.id, name: t.name || t.id, kind: t.kind === "pattern" ? "pattern" : "solid", base: String(t.base || "#111111") };
  if (t.group) bd.group = String(t.group);
  if (t.accent) bd.accent = String(t.accent);
  if (t.lines) bd.lines = String(t.lines);
  if (t.painter) {
    if (THEME_PAINTERS[t.painter]) bd.draw = THEME_PAINTERS[t.painter];
    else { console.warn(`${t._file}: no painter called "${t.painter}" in src/art/theme-painters.js`); bd.kind = "solid"; }
  }
  return bd;
});

backdrops.forEach(b => {
  if (b.id === "black") b.group = "Starter";
  else if (!b.group) b.group = b.kind === "solid" ? "Solids" : "Patterns";
});
const backdropById = Object.fromEntries(backdrops.map(b => [b.id, b]));

/* Cosmetic tiers, simplest first. Each tier costs a one-time unlock fee and needs
   at least half of the tier before it owned. Items inside still cost the usual
   a price that grows with every purchase. */
const COSMETIC_TIERS = {
  skins: CONTENT.skinTiers.map(r => ({ group: String(r[0]), fee: 0 })),         // content/skins/tiers.dat
  backdrops: CONTENT.themeTiers.map(r => ({ group: String(r[0]), fee: 0 }))     // content/themes/tiers.dat
};   // fees: set by applyEconomy()

const tierIndex = (kind, group) => COSMETIC_TIERS[kind].findIndex(t => t.group === group);
skins.sort((a, b) => tierIndex("skins", a.group) - tierIndex("skins", b.group));
backdrops.sort((a, b) => tierIndex("backdrops", a.group) - tierIndex("backdrops", b.group));
