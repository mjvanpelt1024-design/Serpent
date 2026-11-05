/* =========================================================
   src/campaign/camp-art.js
   Pictures for the campaign's items, loot and upgrades, drawn the way
   every other icon in the game is (src/engine/render/pixel-icons.js):
   12 x 12, one letter per pixel, a dark outline and flat colors.
   Also the familiars as they trot along the board.
   ========================================================= */
"use strict";

/* A few more paint pots for the new pictures */
Object.assign(ICON_PAL, { q: "#ffc8b8", h: "#c87a6a", e: "#e8e0c8", m: "#7a4ac8", l: "#3ddc84", f: "#ff6a1a" });

Object.assign(SPRITES, {
  sword: ["..........kk", ".........kWk", "........kWsk", ".......kWsk.", "......kWsk..", "..kk.kWsk...", "..kykWsk....", "...kysk.....", "..knkyk.....", ".knk.kyk....", "kyk...kk....", ".k.........."],
  helm: [".....rr.....", "....rRrk....", "...kkkkkk...", "..kWsssssk..", ".kWssssssSk.", ".kWssssssSk.", ".kkkkkkkkkk.", ".ksskSSkssk.", ".kWssssssSk.", ".kWssSSssSk.", "..kssssssk..", "...kkkkkk..."],
  cloak: ["....kkkk....", "...kryyrk...", "..krrrrrrk..", "..krorrrrk..", ".krorrrrRrk.", ".krorrrrRrk.", ".krrrrrRRrk.", "krorrrrRRrrk", "krrrrrRRrrrk", "krrrrRRrrrRk", "kRrrRRrrrRRk", ".kkkkkkkkkk."],
  thorns: ["..w......w..", "..kk....kk..", ".kggk..kggk.", "wkgggkkgggkw", ".kgGgggggGk.", "wkggggggggkw", ".kgGgggggGk.", "wkggggggggkw", ".kgGgggggGk.", ".kggggggggk.", "..kkkkkkkk..", "............"],
  bubble: ["....kkkk....", "..kkcccckk..", ".kcwwcccccb.", ".kcwcccccbk.", "kcwcccccccbk", "kccccccccbbk", "kccccccccbbk", "kcccccccbbbk", ".kcccccbbbk.", ".kcccbbbbbk.", "..kkbbbbkk..", "....kkkk...."],
  fireball: ["....o..o....", "...oo.oo.o..", "..ooyooyoo..", ".kooyyyyook.", "kroyywwyyork", "kroywwyyyork", "kroyyyyyyork", "krrooyyoorRk", ".krrooooRRk.", ".kRrrrrrRRk.", "..kkRRRRkk..", "....kkkk...."],
  stew: ["..w...w.....", "...w...w....", "..w...w.....", "............", "kkkkkkkkkkkk", "kogogoooogok", "knnnnnnnnnNk", ".knnnnnnnNk.", ".knnnnnnNNk.", "..kNnnnNNk..", "...kkkkkk...", "............"],
  bread: ["............", "........y...", "...kkkkkky..", "..ktttttyk..", ".ktttyttttk.", "ktYtttYtttyk", "kttttttttttk", "knnnnnnnnnNk", "knnnnnnnnNNk", ".kNNNNNNNNk.", "..kkkkkkkk..", "............"],
  pie: ["............", "...kkkkkk...", "..kttttttk..", ".ktRtRtRttk.", "kttttttttttk", "ktRtRtRtRttk", "kkkkkkkkkkkk", "knnnnnnnnnNk", ".knnnnnnnNk.", "..kkkkkkkk..", "............", "............"],
  jerky: ["............", ".kkk........", "kRRRkk......", ".kRRRRkk....", "..kkRRRRkk..", "....kkRRRRk.", "......kkRRk.", "..kkk...kk..", ".kRoRkk.....", "..kkRRRkk...", "....kkRRRk..", "......kkk..."],
  tart: [".....o......", "....oyo.....", "...oyyyo....", "....oyo.....", "..kkkkkkkk..", ".kyoyoyoyok.", "kttttttttttk", "knnnnnnnnnNk", ".knnnnnnnNk.", "..kkkkkkkk..", "............", "............"],
  firefly: ["............", "..c......c..", ".cwc....cwc.", "..ckkkkkkc..", "...kNNNNk...", "...kNwNNk...", "...kNNNNk...", "...kyyyyk...", "..kyywyyyk..", "..kyyyyyyk..", "...kyyyyk...", "....kkkk...."],
  crab: ["............", ".kk......kk.", "krrk....krrk", "krk......krk", ".kk.kkkk.kk.", "..kkwkkwkk..", "..krrrrrrk..", ".krrrrrrrrk.", "krrrrrrrrRRk", ".kRrrrrrRRk.", ".k.k.kk.k.k.", "............"],
  turtle: ["............", "............", "...kkkkk....", "..kGgGgGk...", ".kGgGgGgGkk.", ".kgGgGgGgkgk", "kkkkkkkkkkwk", "kgggggggggk.", ".kgk...kgk..", ".kk....kk...", "............", "............"],
  puffer: ["..y..y..y...", "...kkkkkk...", "y.kyyyyyyk.y", ".kyyyywkyyk.", "ykyyyywkyyky", ".kyyyyyyyyk.", "ykyyyyyyyYky", ".kYyyyyyYYk.", "..kYYYYYYk..", "y..kkkkkk..y", "............", "............"],
  seahorse: ["....kkk.....", "...kppkk....", "..kpwpppkk..", "..kppkkkk...", "...kpk......", "...kppk.....", "....kppk....", "....kppk....", "...kppk.....", "...kpk..k...", "....kpkpk...", ".....kk....."],
  rune: ["...kkkkkk...", "..ksssssSk..", ".kssssgssSk.", ".ksssgggsSk.", ".kssssgssSk.", ".ksssgsgsSk.", ".kssgssgsSk.", ".kssssgssSk.", ".ksssssssSk.", ".kSSSSSSSSk.", "..kkkkkkkk..", "............"],
  wand: ["..........y.", ".........yWy", "........kyk.", ".......kNk..", "......kNk...", ".....kNk....", "....kNk.....", "...kNk......", "..kNk.......", ".kNk........", "kNk.........", "kk.........."],
  acorn: ["....kk......", "....kNk.....", "..kkkkkkk...", ".knnnnnnnk..", "kNnNnNnNnk..", "kkkkkkkkkk..", ".kyyyyyyk...", ".kywyyyyk...", ".kyyyyyYk...", "..kyyyYk....", "...kyYk.....", "....kk......"],
  shell: ["............", "....kkkk....", "..kkqpqpkk..", ".kqpqpqpqpk.", ".kpqpqpqpqk.", "kqpqpqpqpqpk", "kpqpqpqpqpqk", ".kkpqpqpqkk.", "...kkkkkk...", "....kppk....", ".....kk.....", "............"],
  bee: ["............", "...cc..cc...", "..cwc..cwc..", "...cckkcc...", "...kyykkyk..", "..kykkyykyk.", "..kykkyykykk", "..kyykkyykk.", "...kkkkkk...", "............", "............", "............"],
  bigstar: [".....kk.....", ".....kyk....", "....kyyk....", "kkkkkyyykkkk", "kyyyywyyyyyk", ".kyyywyyyyk.", "..kyyyyyyk..", "..kyyyyyyk..", ".kyyykkyyyk.", ".kyyk..kyyk.", "kyyk....kyyk", "kkk......kkk"]
});

const ITEM_SPRITE = {
  shield: ["shield"], sword: ["sword"], helm: ["helm"], cloak: ["cloak"], thorns: ["thorns"],
  forcefield: ["bubble"], fireball: ["fireball"], blink: ["portal"], frost: ["snowflake"], magnet: ["magnet"],
  stew: ["stew"], bread: ["bread"], pie: ["pie"], jerky: ["jerky"], tart: ["tart"],
  firefly: ["firefly"], crab: ["crab"], turtle: ["turtle"], puffer: ["puffer"], seahorse: ["seahorse"],
  plenty: ["rune", null, { g: "g" }], stillness: ["rune", null, { g: "c" }], fortune: ["rune", null, { g: "y" }], fury: ["rune", null, { g: "r" }], echo: ["rune", null, { g: "P" }],
  buckle: ["collar", null, { b: "n", y: "s" }], horseshoe: ["magnet", null, { r: "s", w: "W" }], goblet: ["trophy", null, { y: "s", Y: "S", w: "W" }],
  quill: ["feather"], crystal: ["gem"], wand: ["wand"], acorn: ["acorn"], jar: ["potion", null, { g: "r", G: "R" }], spoon: ["fork", null, { s: "W" }],
  shell: ["shell"], doubloon: ["coins"], compass: ["compass"], ember: ["sun", null, { y: "o", w: "y" }], obsidian: ["gem", null, { c: "V", b: "k", w: "P" }],
  scale: ["shield", null, { s: "r", S: "R", b: "o", W: "o", w: "y" }]
};
const UPGRADE_SPRITE = {
  apple: ["apple"], tree: ["tree"], star: ["bigstar"], heart: ["heart"], coin: ["coins"], golden: ["apple", null, { r: "y", R: "Y" }],
  armor: ["shield"], clock: ["clock"], rock: ["rock"], wasp: ["bee"], molasses: ["bottle"], spell: ["fireball"], shield: ["shield"],
  food: ["stew"], loot: ["chest"], stamina: ["bolt"], fang: ["skull"], pet: ["turtle"], chest: ["chest"], gem: ["gem"], rune: ["rune", null, { g: "y" }], crown: ["crown"]
};
Object.entries(ITEM_SPRITE).forEach(([id, spec]) => { ICON_FOR["ci:" + id] = spec; });
Object.entries(UPGRADE_SPRITE).forEach(([id, spec]) => { ICON_FOR["cu:" + id] = spec; });

const RUNE_COLORS = { plenty: "#3ddc84", stillness: "#7fe3ff", fortune: "#ffd23f", fury: "#ff3b3b", echo: "#b36bff" };

/* An item's picture in a little rarity-colored tile */
function campItemIconHtml(it, cls = "") {
  const color = CAMP.itemById[it.id] ? rarityColor(it.rarity) : "#8a8070";
  return `<span class="ci-icon ${cls}" style="--rc:${color}"><img src="${iconUrl("ci:" + it.id, 3)}" alt="" draggable="false"></span>`;
}
const campIconUrl = (id, scale = 3) => iconUrl("ci:" + id, scale);
const campUpIconUrl = (icon, scale = 2) => iconUrl("cu:" + icon, scale);

/* ----- The familiars, drawn on the board beside your snake ----- */
function drawPetSprite(g, id, x, y, w, ts, P) {
  g.save();
  if (id === "firefly") {
    g.shadowColor = "#ffe86a"; g.shadowBlur = w * (0.6 + 0.4 * Math.sin(ts / 120));
    g.fillStyle = "#ffe86a"; g.fillRect(x + w * 0.35, y + w * 0.45, w * 0.3, w * 0.3);
    g.shadowBlur = 0;
    g.fillStyle = "#3a3020"; g.fillRect(x + w * 0.35, y + w * 0.25, w * 0.3, w * 0.22);
    g.fillStyle = "rgba(220,240,255,0.8)"; g.fillRect(x + w * 0.1, y + w * 0.15 + (Math.sin(ts / 40) > 0 ? 0 : w * 0.08), w * 0.25, w * 0.15); g.fillRect(x + w * 0.65, y + w * 0.15 + (Math.sin(ts / 40) > 0 ? 0 : w * 0.08), w * 0.25, w * 0.15);
  } else if (id === "crab") {
    g.fillStyle = "#ff5a3a"; g.fillRect(x + w * 0.2, y + w * 0.4, w * 0.6, w * 0.35);
    g.fillRect(x, y + w * 0.2 + (Math.sin(ts / 150) > 0 ? 0 : w * 0.08), w * 0.2, w * 0.2); g.fillRect(x + w * 0.8, y + w * 0.2, w * 0.2, w * 0.2);
    g.fillStyle = "#fff"; g.fillRect(x + w * 0.32, y + w * 0.3, w * 0.1, w * 0.1); g.fillRect(x + w * 0.58, y + w * 0.3, w * 0.1, w * 0.1);
  } else if (id === "turtle") {
    const ready = P && P.shells > 0;
    g.fillStyle = "#7ac85a"; g.fillRect(x + w * 0.75, y + w * 0.45, w * 0.22, w * 0.2);
    g.fillStyle = ready ? "#3a8a3a" : "#6a6a6a"; g.fillRect(x + w * 0.1, y + w * 0.3, w * 0.65, w * 0.45);
    g.fillStyle = ready ? "#5ab05a" : "#8a8a8a"; g.fillRect(x + w * 0.22, y + w * 0.38, w * 0.4, w * 0.25);
  } else if (id === "puffer") {
    g.fillStyle = "#ffcf5a"; g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.36, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c89a2a"; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fillRect(x + w / 2 + Math.cos(a) * w * 0.42 - 1, y + w / 2 + Math.sin(a) * w * 0.42 - 1, 2, 2); }
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.58, y + w * 0.38, w * 0.1, w * 0.1);
  } else if (id === "seahorse") {
    g.fillStyle = "#ff9ac8"; g.fillRect(x + w * 0.35, y + w * 0.15, w * 0.35, w * 0.3); g.fillRect(x + w * 0.3, y + w * 0.4, w * 0.3, w * 0.35); g.fillRect(x + w * 0.42, y + w * 0.72, w * 0.18, w * 0.2);
    g.fillRect(x + w * 0.68, y + w * 0.22, w * 0.2, w * 0.1);
    g.fillStyle = "#1a1410"; g.fillRect(x + w * 0.5, y + w * 0.22, w * 0.08, w * 0.08);
    g.fillStyle = "#ffd23f"; g.fillRect(x + w * 0.36, y + w * 0.05, w * 0.2, w * 0.08);   // a tiny monocle chain, presumably
  }
  g.restore();
}

function campShade(hex, amt) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  if (!Number.isFinite(n)) return hex;
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt))));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
