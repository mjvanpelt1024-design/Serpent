/* =========================================================
   src/engine/render/pixel-icons.js
   12x12 pixel pictures for upgrades, items and places
   ========================================================= */
"use strict";

/* =========================================================
   Pixel icons: a little 12x12 picture for every upgrade, item and place.
   Drawn as text, one letter per pixel, so they're easy to tweak.
   ========================================================= */
const ICON_PAL = {
  k: "#1a1410", w: "#ffffff", W: "#d8dde6", s: "#9aa3ad", S: "#5b6470",
  r: "#ff3b3b", R: "#a8202a", o: "#ff8c1a", y: "#ffd23f", Y: "#c08a10",
  g: "#3ddc3d", G: "#1f8a2a", c: "#7fe3ff", b: "#3a82e0", B: "#1d4a9a",
  p: "#ff8ac4", P: "#a855f7", V: "#5a2a9a", n: "#b07a42", N: "#5a3a1e", t: "#f2d2a0"
};
const SPRITES = {
  orb: ["....kkkk....", "..kkyyyykk..", ".kyywwyyyyk.", ".kywwyyyyyk.", "kyywyyyyyyYk", "kyyyyyyyyyYk", "kyyyyyyyyyYk", "kyyyyyyyyYYk", ".kyyyyyyYYk.", ".kYyyyyYYYk.", "..kkYYYYkk..", "....kkkk...."],
  clock: ["....kkkk....", "..kkwwwwkk..", ".kwwwwkwwwk.", ".kwwwwkwwwk.", "kwwwwwkwwwwk", "kwwwwwkwwwwk", "kwwwwwkkkkwk", "kwwwwwwwwwwk", ".kwwwwwwwwk.", ".kWwwwwwwWk.", "..kkWWWWkk..", "....kkkk...."],
  apple: [".....kk.....", "......Nk.gg.", "......N.gGk.", "..kkkkNkkk..", ".krrrrrrrrk.", "krwrrrrrrrRk", "krwrrrrrrrRk", "krrrrrrrrrRk", "krrrrrrrrRRk", ".krrrrrrRRk.", ".kkrrrrRRkk.", "...kkkkkk..."],
  applebite: [".....kk.....", "......Nk.gg.", "......N.gGk.", "..kkkkNkkk..", ".krrrrrrrrk.", "krwrrrrrk...", "krwrrrrk....", "krrrrrrk....", "krrrrrrrk...", ".krrrrrrRkk.", ".kkrrrrRRkk.", "...kkkkkk..."],
  scent: ["..w...w.....", "...w...w....", "..w...w..w..", "..kkkkNkkkw.", ".krrrrrrrrk.", "krwrrrrrrrRk", "krwrrrrrrrRk", "krrrrrrrrrRk", "krrrrrrrrRRk", ".krrrrrrRRk.", ".kkrrrrRRkk.", "...kkkkkk..."],
  heart: ["............", ".kkk....kkk.", "krrrk..krrrk", "krwrrkkrrrrk", "krwrrrrrrrRk", "krrrrrrrrrRk", ".krrrrrrrRk.", "..krrrrrRk..", "...krrrRk...", "....krRk....", ".....kk.....", "............"],
  halfheart: ["............", ".kkk....kkk.", "krrrk..kSSSk", "krwrrkkSSSSk", "krwrrrkSSSSk", "krrrrrkSSSSk", ".krrrrkSSSk.", "..krrrkSSk..", "...krrkSk...", "....krkk....", ".....kk.....", "............"],
  gift: ["..kk....kk..", ".kyyk..kyyk.", "..kkykkykk..", "kkkkkyykkkkk", "kppppyyppppk", "kppppyyppppk", "kkkkkyykkkkk", ".kpppyypppk.", ".kpppyypppk.", ".kpppyypppk.", ".kPPPyyPPPk.", ".kkkkkkkkkk."],
  flower: ["....kkkk....", "..kkppppkk..", ".kppkyykppk.", ".kppyyyyppk.", ".kppkyykppk.", "..kkppppkk..", "....kgk.....", "..kk.gk.kk..", ".kggkgkkggk.", "..kkggggkk..", "....kgk.....", "...kkkkk...."],
  coins: ["............", "...kkkkkk...", "..kyyyyyyk..", "..kYYYYYYk..", "..kkkkkkkk..", ".kyyyyyyyyk.", ".kYYYYYYYYk.", ".kkkkkkkkkk.", "kyywyyyyyyyk", "kYYYYYYYYYYk", "kkkkkkkkkkkk", "............"],
  bag: ["....kkkk....", "...knnnnk...", "....kkkk....", "...knnnnk...", "..knnnnnnk..", ".knnnnnnnnk.", "knnnnyynnnNk", "knnnyyyynnNk", "knnnnyynnnNk", "knnnnnnnnNNk", ".kNNNNNNNNk.", "..kkkkkkkk.."],
  popsicle: ["...kkkkkk...", "..kcccccck..", "..kcwcccck..", "..kcwcccck..", "..kcccccck..", "..kpppppPk..", "..kpppppPk..", "..kppppPPk..", "...kkttkk...", "....kttk....", "....kttk....", ".....kk....."],
  melt: ["...kkkkkk...", "..kcccccck..", "..kcwcccck..", "..kcccccck..", "..kckcckck..", "...k.kk.k...", "....kttk.c..", "..c.kttk....", "....kttk....", ".kkkkkkkkkk.", "kcccccwccck.", ".kkkkkkkkk.."],
  anvil: ["............", "............", "kkkkkkkkkk..", "kssssssssSkk", ".kSSSSSSSSSk", "..kkSSSSkkk.", "....kSSk....", "....kSSk....", "...kSSSSk...", "..kSSSSSSk..", "..kkkkkkkk..", "............"],
  moon: ["....kkkk....", "..kkyyyk....", ".kyyyyk.....", ".kyyyk...w..", "kyyyyk......", "kyyyyk...w..", "kyyyyk......", "kyyyyyk.....", ".kyyyyykkk..", ".kYyyyyyyk..", "..kkYYYkk...", "....kkk....."],
  web: ["...kkkkkk...", "..kn....nk..", ".kn.w..w.nk.", ".kn..ww..nk.", ".kn..ww..nk.", ".kn.w..w.nk.", "..kn....nk..", "...kkkkkk...", "...k..k..k..", "..kPkkpkkPk.", "..kPkkpkkPk.", "...k..k..k.."],
  eye: ["............", "............", "....kkkk....", "..kkwwwwkk..", ".kwwwkkwwwk.", "kwwwkPPkwwwk", "kwwwkPVkwwwk", ".kwwwkkwwwk.", "..kkwwwwkk..", "....kkkk....", "............", "............"],
  sun: [".....yy.....", ".y..kkkk..y.", "..ykyyyyky..", "..kywwyyyk..", ".kywyyyyyyk.", "ykyyyyyyyyky", "ykyyyyyyyoky", ".kyyyyyyook.", "..kyyyoook..", "..ykkkkkky..", ".y........y.", ".....yy....."],
  crumbs: ["............", "..kk........", ".knnk...kk..", ".kntk..knnk.", "..kk...kntk.", "........kk..", "....kkk.....", "...knnnk....", "...kntnk..k.", "....kkk..kgk", "..k.......k.", ".kyk........"],
  tail: ["..kkkkkkk...", ".kggggwggk..", "kggkkkkkggk.", "kgk.....kk..", "kggkkkkk....", ".kgggggggk..", "..kkkkkkggk.", "........kgk.", ".kk.....kgk.", "kggkkkkkggk.", ".kggggggggk.", "..kkkkkkkk.."],
  burger: ["............", "...kkkkkk...", "..koooooook.", ".koowoowoook", ".kkkkkkkkkkk", ".kggggggggk.", ".kRRRRRRRRk.", ".kNNNNNNNNk.", ".kkkkkkkkkk.", ".koooooooook", "..kkkkkkkk..", "............"],
  hand: ["...k.k.k....", "..ktktktk...", "..ktktktk.k.", "..ktktktkktk", "..kttttktk..", ".kkttttttk..", "ktkttttttk..", "kttttttttk..", ".ktttttttk..", "..ktttttk...", "...ktttk....", "...kkkkk...."],
  joystick: ["....kkk.....", "...krrrk....", "...krwrk....", "...krrrk....", "....kSk.....", "....kSk.....", "....kSk.....", ".kkkkkkkkkk.", "kSSSSSSSrSSk", "kSSSSSSSSSSk", "kkkkkkkkkkkk", "............"],
  flag: [".kk.........", ".kSkkkkk....", ".kSkrrrrkkk.", ".kSkrrwrrrrk", ".kSkrrrrrrrk", ".kSkrrrrrkk.", ".kSkkkkkk...", ".kSk........", ".kSk........", ".kSk........", "kkSkk.......", "kkkkk......."],
  hardhat: ["............", "............", "....kkkk....", "..kkyyyykk..", ".kyywyyyyyk.", ".kywyykyyyk.", "kyyyyykyyyyk", "kyyyyykyyyyk", "kYYYYYYYYYYk", "kkkkkkkkkkkk", "............", "............"],
  wind: ["............", "......kkk...", ".....kWWWk..", "......kkWk..", "kkkkkkkkWk..", "kWWWWWWWk...", "kkkkkkkkkk..", "kWWWWWWWWWk.", ".kkkkkkkkWk.", "......kWWk..", ".......kk...", "............"],
  rock: ["............", "............", "....kkkk....", "...kssssk...", "..ksWsssskk.", ".ksWssssssk.", ".kssssssSSk.", "kssssssSSSSk", "kssssSSSSSSk", ".kkkkkkkkkk.", "............", "............"],
  spiral: ["...kkkkkk...", "..kPPPPPPk..", ".kPkkkkkkPk.", "kPk.kkkk.kPk", "kPk.kPPk.kPk", "kPk.kPkk.kPk", "kPk.kPk..kPk", "kPk..kk.kPk.", ".kPk...kPk..", "..kPkkkPk...", "...kPPPk....", "....kkk....."],
  snowflake: ["............", ".....w......", "..w..w..w...", "...w.w.w....", "....www.....", "wwwwwcwwwww.", "....www.....", "...w.w.w....", "..w..w..w...", ".....w......", "............", "............"],
  clover: ["............", "..kkk..kkk..", ".kgggkkgggk.", ".kgwggggggk.", ".kggggggggk.", "..kkggggkk..", ".kggggggggk.", ".kggggggggk.", ".kgggkkgggk.", "..kkk.kkkk..", "......kGk...", ".......kk..."],
  cross: ["............", "....kkkk....", "....krrk....", "....krrk....", ".kkkkrrkkkk.", ".krrrrrrrrk.", ".krrrrrrrrk.", ".kkkkrrkkkk.", "....krrk....", "....krrk....", "....kkkk....", "............"],
  candy: ["............", "............", "............", "kk..kkkk..kk", "kpkkppwpkkpk", "kppkpwpPkppk", "kppkppPpkppk", "kpkkpPppkkpk", "kk..kkkk..kk", "............", "............", "............"],
  cloud: ["............", "...kkk......", "..kwwwkkk...", ".kwwwwwwwk..", "kwwwwwwwwwkk", "kWWwwwwwwwwk", ".kkkkkkkkkk.", "..r...r..r..", ".rr..rr.rr..", "............", "...r....r...", "..rr...rr..."],
  stop: ["...kkkkkk...", "..krrrrrrk..", ".krrrrrrrrk.", "krrrrrrrrrrk", "krrrrrrrrrrk", "krwwwwwwwwrk", "krwwwwwwwwrk", "krrrrrrrrrrk", "krrrrrrrrrrk", ".krrrrrrrrk.", "..krrrrrrk..", "...kkkkkk..."],
  magnet: ["............", "..kkkkkkkk..", ".krrrrrrrrk.", "krrrkkkkrrrk", "krrk....krrk", "krrk....krrk", "krrk....krrk", "kwwk....kwwk", "kwwk....kwwk", "kkkk....kkkk", "............", "............"],
  potion: ["....kkkk....", "....knnk....", "....kkkk....", "....kwwk....", "...kwwwwk...", "..kgwggggk..", ".kgwgggggGk.", ".kggggggGGk.", ".kgggggGGGk.", "..kgggGGGk..", "...kkkkkk...", "............"],
  compass: ["....kkkk....", "..kkwwwwkk..", ".kwwwwrwwwk.", ".kwwwrrrwwk.", "kwwwwrrrwwwk", "kwwwwwkwwwwk", "kwwwwsssswwk", "kwwwwssswwwk", ".kwwwwswwwk.", ".kwwwwwwwwk.", "..kkwwwwkk..", "....kkkk...."],
  collar: ["............", "............", "...kkkkkk...", "..kbbbbbbk..", ".kbkkkkkkbk.", ".kbk....kbk.", ".kbk....kbk.", ".kbkkkkkkbk.", "..kbbybbbk..", "...kkykkk...", "....kyyk....", ".....kk....."],
  goldbar: ["............", "............", "............", "...kkkkkkk..", "..kywwyyyYk.", ".kywyyyyYYk.", "kyyyyyyyYYk.", "kYYYYYYYYYk.", "kkkkkkkkkkk.", "............", "............", "............"],
  crown: ["............", "............", ".k....k....k", ".kk..kyk..kk", ".kyk.kyk.kyk", ".kyykyyykyyk", ".kyyyyryyyyk", ".kyyyyyyyyyk", ".kYYYYYYYYYk", ".kkkkkkkkkkk", "............", "............"],
  chest: ["............", "............", "..kkkkkkkk..", ".knnnnnnnnk.", "knnnnnnnnnnk", "kkkkkyykkkkk", "knnnkyyknnNk", "knnnnkknnnNk", "knnnnnnnnnNk", "kNNNNNNNNNNk", "kkkkkkkkkkkk", "............"],
  shield: ["............", ".kkkkkkkkkk.", ".kWssssssSk.", ".kssssssssk.", ".kssbbbbssk.", ".kssbwbbssk.", ".kssbbbbssk.", "..kssbbssk..", "..kssssssk..", "...kssssk...", "....kssk....", ".....kk....."],
  sign: ["............", "..kkkkkkkk..", ".kggggggggk.", ".kgwwwwgggk.", ".kggggwwggk.", ".kggggggggk.", "..kkkkkkkk..", ".....kSk....", ".....kSk....", ".....kSk....", ".....kSk....", "....kkkkk..."],
  car: ["............", "............", "............", "...kkkkk....", "..kbwwbbk...", "..kbwwbbbk..", "kkkbbbbbbkkk", "kbbbbbbbbbbk", "kbbbbbbbbbyk", "kkkkkkkkkkkk", ".kSk....kSk.", "..k......k.."],
  binoc: ["............", "............", "..kk....kk..", ".kSSk..kSSk.", ".kSSkkkkSSk.", "kSSSSkkSSSSk", "kSSSSkkSSSSk", "kcccckkcccck", "kccwckkcwcck", ".kcck..kcck.", "..kk....kk..", "............"],
  rocket: [".....kk.....", "....kwwk....", "...kwwwwk...", "...kwbbwk...", "...kwbbwk...", "...kwwwwk...", "..kkwwwwkk..", ".krkwwwwkrk.", ".krkkkkkkrk.", "..k.kook.k..", ".....oo.....", ".....yy....."],
  logs: [".....o......", "....oyo.....", "...oyyyo....", "...oyyyo....", "....ooo.....", ".kkkkkkkkkk.", "knnnnnnnnktk", "kNNNNNNNNkkk", ".kkkkkkkkkk.", "knnnnnnnnktk", "kNNNNNNNNkkk", ".kkkkkkkkkk."],
  mitt: ["............", "...kkkk.....", "..krrrrk....", ".krrrrrrk...", ".krrrrrrk.kk", ".krrrrrrkkrk", ".krrrrrrrrrk", ".krrrrrrrrk.", ".krrrrrrrk..", ".kwwwwwwwk..", ".kwwwwwwwk..", ".kkkkkkkkk.."],
  extinguisher: ["...kkkk.....", "..kSSSSkkk..", "...kSSk..k..", "..krrrrk.k..", ".krwrrrrkk..", ".krwrrrrk...", ".krrrrrrk...", ".krrrrrrk...", ".krrrrrRk...", ".krrrrRRk...", ".krrrRRRk...", ".kkkkkkkk..."],
  portal: ["............", "....kkkk....", "...kPPPPk...", "..kPVVVVPk..", "..kPVppVPk..", ".kPVpwwpVPk.", ".kPVpwwpVPk.", ".kPVppppVPk.", "..kPVVVVPk..", "..kPPPPPPk..", "...kkkkkk...", "............"],
  steps: ["............", "......kk....", ".....kNNk...", ".....kNNk...", "......kNk...", "..kk..kk....", ".kNNk.......", ".kNNk.......", "..kNk...kk..", "...k...kNNk.", ".......kNNk.", "........kNk."],
  bottle: ["....kkkk....", "....kSSk....", "....kkkk....", "....knnk....", "...knnnnk...", "..knwnnnnk..", "..knwnnnnk..", "..kntttnnk..", "..knttttnk..", "..knnnnnnk..", "..knnnnnnk..", "...kkkkkk..."],
  shoe: ["............", "............", "............", "..kkkk......", ".krrrrk.....", ".krwwrk.....", ".krrrrkkkk..", ".krrrrrrrrk.", ".krrrrrrrrrk", "kwwwwwwwwwwk", "kkkkkkkkkkkk", "............"],
  fork: ["..k.k.k.k...", "..ksksksk...", "..ksksksk...", "..ksssssk...", "...kssssk...", "....kssk....", "....kssk....", "....kssk....", "....kssk....", "....kssk....", "....kssk....", ".....kk....."],
  lamp: [".....kk.....", "....k..k....", "....kkkk....", "...kSSSSk...", "..kyywyyyk..", "..kywyyyyk..", "..kyyyyyyk..", "..kyyyyyok..", "..kyyyyook..", "...kSSSSk...", "..kkkkkkkk..", "............"],
  bell: [".....kk.....", "....kyyk....", "...kyyyyk...", "..kywyyyyk..", "..kywyyyyk..", "..kyyyyyyk..", ".kyyyyyyyyk.", ".kyyyyyyyYk.", "kyyyyyyyyYYk", "kkkkkkkkkkkk", ".....kk.....", ".....kk....."],
  whiteflag: [".kk.........", ".kSkkkkkk...", ".kSkwwwwwkk.", ".kSkwwwwwwwk", ".kSkwwwwwwwk", ".kSkwwWWWkk.", ".kSkkkkkk...", ".kSk........", ".kSk........", ".kSk........", ".kSk........", "kkkkk......."],
  lollipop: ["...kkkkkk...", "..kppwwppk..", ".kpwkkkkppk.", ".kpkppppkpk.", ".kpkpkkpkpk.", ".kpkppkkppk.", "..kpkkkppk..", "...kkkkkk...", ".....kwk....", ".....kwk....", ".....kwk....", ".....kkk...."],
  anchor: ["....kkk.....", "....kSk.....", "....kkk.....", "..kkkSkkk...", "..kSSSSSk...", "..kkkSkkk...", "k...kSk...k.", "kk..kSk..kk.", "kSk.kSk.kSk.", ".kSkkSkkSk..", "..kSSSSSk...", "...kkkkk...."],
  gem: ["............", "............", "..kkkkkkkk..", ".kcwccccbbk.", "kkkkkkkkkkkk", "kcwcccccbbbk", ".kcccccbbbk.", "..kcccbbbk..", "...kccbbk...", "....kcbk....", ".....kk.....", "............"],
  boot: ["............", "...kkkkk....", "...knnnk....", "...knnnk....", "...knnnk....", "...knnnk....", "...knnnkkk..", "..knnnnnnnk.", "..knnnnnnnnk", "..kNNNNNNNNk", "..kkkkkkkkkk", "............"],
  bucket: ["............", "..kk....kk..", ".k........k.", "kkkkkkkkkkkk", "kcwcccccccck", ".krrrrrrrrk.", ".krwrrrrrrk.", ".krrrrrrrrk.", "..krrrrrrk..", "..krrrrrRk..", "..kkkkkkkk..", "............"],
  pin: ["............", "...kkkkk....", "..krrrrrk...", ".krrwwrrrk..", ".krwkkwrrk..", ".krwkkwrrk..", ".krrwwrrrk..", "..krrrrrk...", "...krrrk....", "....krk.....", ".....k......", "............"],
  feather: [".........kk.", "........kcck", ".......kcwck", "......kcwcck", ".....kcwcck.", "....kcwcck..", "...kcwcck...", "..kcwcck....", "..kwcck.....", ".kwkkk......", "kwk.........", "kk.........."],
  bolt: ["......kkkk..", ".....kyyyk..", "....kyyyk...", "...kyyyk....", "..kyyyykkkk.", ".kyyyyyyyyk.", ".kkkkyyyyk..", "....kyyyk...", "...kyyyk....", "..kyyk......", ".kyk........", ".kk........."],
  twoapples: ["............", "..N......N..", "..N......N..", ".kkkk..kkkk.", "krwrrkkrwrrk", "kwrrrkkwrrrk", "krrrrkkrrrrk", "krrrRkkrrrRk", ".krRk..krRk.", "..kk....kk..", "............", "............"],
  spray: ["....kk......", "...kSSk.s...", "...kkkk..s..", "..kggggk.s..", "..kgwggk....", "..kgwggk....", "..kggggk....", "..kggggk....", "..kggGGk....", "..kgGGGk....", "..kkkkkk....", "............"],
  trophy: ["..kkkkkkkk..", "kkyywyyyyykk", "kykywyyyykyk", "kykyyyyyykyk", ".kkyyyyyykk.", "...kyyyyk...", "....kyyk....", ".....kk.....", "....kyyk....", "...kYYYYk...", "..kkkkkkkk..", "............"],
  medal: ["..kk....kk..", "..kbk..kbk..", "...kbkkbk...", "....kbbk....", "...kkkkkk...", "..kyyyyyyk..", ".kyywkkyyyk.", ".kywkyykyyk.", ".kyykyykyYk.", ".kyyykkyyYk.", "..kYYYYYYk..", "...kkkkkk..."],
  tree: ["....kkkk....", "..kkggggkk..", ".kggwggggGk.", "kggggggggGGk", "kgggrggggGGk", "kggggggrgGGk", ".kgggggggGk.", "..kkkkkkkk..", ".....knk....", ".....knk....", "....knnnk...", "...kkkkkkk.."],
  tophat: ["............", "...kkkkkk...", "...kSSSSk...", "...kSSSSk...", "...kSSSSk...", "...krrrrk...", "...kSSSSk...", ".kkkkkkkkkk.", "kSSSSSSSSSSk", ".kkkkkkkkkk.", "............", "............"],
  satchel: ["............", "...kkkkkk...", "..kn....nk..", "..kn....nk..", ".kkkkkkkkkk.", "knnnnnnnnnnk", "kNNNNkykNNNk", "knnnnkkknnnk", "knnnnnnnnnnk", "knnnnnnnnnNk", "kNNNNNNNNNNk", "kkkkkkkkkkkk"],
  buck: ["...kkkkkk...", "..kggggggk..", ".kggwkkwggk.", "kggwkwwkggGk", "kggkwgggggGk", "kgggkkwgggGk", "kgggggkwggGk", "kggwkwwkggGk", "kgggkkwgggGk", ".kGggkgggGk.", "..kGGGGGGk..", "...kkkkkk..."],
  skull: ["............", "...kkkkkk...", "..kwwwwwwk..", ".kwwwwwwwwk.", ".kwkkwwkkwk.", ".kwkkwwkkwk.", ".kwwwkkwwwk.", "..kwwwwwwk..", "...kwkwkk...", "...kkkkk....", "............", "............"]
};
/* Small marks in the corner: more, plus, never, star */
const BADGES = {
  up: ["..k..", ".kgk.", "kgggk", ".kgk.", ".kkk."],
  plus: [".kkk.", "kkgkk", "kgggk", "kkgkk", ".kkk."],
  x: ["kk.kk", "krkrk", ".krk.", "krkrk", "kk.kk"],
  star: ["..k..", ".kyk.", "kyyyk", ".kyk.", "k.k.k"]
};

/* What picture each thing gets: [sprite, corner mark, recolor].
   Upgrades and items set theirs in their content files (icon, badge, recolor). */
const ICON_FOR = {

  "place:global": ["tree"], "place:cosmetics": ["tophat"], "place:inventory": ["satchel"], "place:achievements": ["trophy"], "place:exchange": ["buck"],
  prestige: ["medal"]
};
(function iconsFromContent() {
  const spec = rec => {
    if (!rec.icon) return null;
    const recolor = Array.isArray(rec.recolor) ? Object.fromEntries(rec.recolor.map(p => String(p).split(">"))) : null;
    const out = [String(rec.icon), rec.badge ? String(rec.badge) : null, recolor];
    while (out.length > 1 && out[out.length - 1] === null) out.pop();
    return out;
  };
  CONTENT.greatTree.concat(...MODE_KEYS.map(a => CONTENT.worlds[a].upgrades)).forEach(u => { const s = spec(u); if (s) ICON_FOR[u.id] = s; });
  CONTENT.items.forEach(it => { const s = spec(it); if (s) ICON_FOR["item:" + it.id] = s; });
})();

const iconCache = {};
/* Lighter (k > 0) or darker (k < 0), for the icons' light and shade */
function iconShade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => { const v = (n >> s) & 255; return Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
/* A data URL for a thing's picture, drawn once */
function iconUrl(id, scale = 1) {
  const key = id + "@" + scale;
  if (iconCache[key]) return iconCache[key];
  const spec = ICON_FOR[id] || [SPRITES[id] ? id : "orb"];
  const [name, badge, swap] = spec;
  const rows = SPRITES[name] || SPRITES.orb;
  const c = document.createElement("canvas");
  c.width = 12 * scale;
  c.height = 12 * scale;
  const g = c.getContext("2d");
  const put = (ch, x, y) => {
    if (ch === "." || ch === " ") return;
    const col = ICON_PAL[(swap && swap[ch]) || ch];
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x * scale, y * scale, scale, scale);
  };
  rows.forEach((row, y) => [...row].forEach((ch, x) => put(ch, x, y)));
  // light from the top left: every color brightens along its top and left edges and darkens
  // along its bottom and right ones, so flat shapes read as little solid things
  const edge = (x, y) => { const ch = (rows[y] || "")[x]; return ch === undefined || ch === "." || ch === " " || ch === "k"; };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "." || ch === " " || ch === "k" || ch === "w") return;
    const col = ICON_PAL[(swap && swap[ch]) || ch];
    if (!col || col[0] !== "#") return;
    const lit = edge(x, y - 1) || edge(x - 1, y), shaded = edge(x, y + 1) || edge(x + 1, y);
    if (lit === shaded) return;
    g.fillStyle = iconShade(col, lit ? 0.16 : -0.2);
    g.fillRect(x * scale, y * scale, scale, scale);
  }));
  if (badge && BADGES[badge]) {
    // knock out a little space, then draw the mark in the corner
    g.clearRect(7 * scale, 7 * scale, 5 * scale, 5 * scale);
    BADGES[badge].forEach((row, y) => [...row].forEach((ch, x) => put(ch, 7 + x, 7 + y)));
  }
  return (iconCache[key] = c.toDataURL());
}

/* Fruit outlines. Upgrades are apples, one-time items are other fruit. */
const FRUIT_SHAPES = {
  apple: "M16 7c-2.2-1.6-5-2.2-7.6-1.2C4.5 7.3 3 11.6 3.6 15.8c.6 4.6 3.3 9.4 7.2 11.4 1.7.9 3.5.6 5.2-.2 1.7.8 3.5 1.1 5.2.2 3.9-2 6.6-6.8 7.2-11.4.6-4.2-.9-8.5-4.8-10C26 4.8 18.2 5.4 16 7z",
  pear: "M16 4.5c-2.6 0-4.2 2.2-4.4 4.8-.2 2.4-1.2 3.6-2.8 5.4C6.6 17 5.4 19.6 6 22.6c.8 4 4.8 6.4 10 6.4s9.2-2.4 10-6.4c.6-3-.6-5.6-2.8-7.9-1.6-1.8-2.6-3-2.8-5.4-.2-2.6-1.8-4.8-4.4-4.8z",
  orange: "M16 4.5C9.4 4.5 4 9.6 4 16.3S9.4 28 16 28s12-5 12-11.7S22.6 4.5 16 4.5z",
  plum: "M16 5c-5.8 0-11 4.6-11 11.4C5 23 10 28 16 28s11-5 11-11.6C27 9.6 21.8 5 16 5zM16 6.5c-.6 4-.6 15 0 21",
  lemon: "M16 6c-5 0-9.6 3.2-11.4 7.4-.6 1.4-1.6 2.2-2.6 2.6 1 .4 2 1.2 2.6 2.6C6.4 22.8 11 26 16 26s9.6-3.2 11.4-7.4c.6-1.4 1.6-2.2 2.6-2.6-1-.4-2-1.2-2.6-2.6C25.6 9.2 21 6 16 6z",
  berry: "M16 7.5c-3.4-2-9.6-1.6-11 3-1.6 5.2 4 13.6 11 17.5 7-3.9 12.6-12.3 11-17.5-1.4-4.6-7.6-5-11-3z"
};
const ITEM_FRUIT = Object.fromEntries(CONTENT.items.map(it => [it.id, String(it.fruit || "apple")]));
const ITEM_COLOR = Object.fromEntries(CONTENT.items.map(it => [it.id, String(it.color || "#ffffff")]));

/* The inside of a fruit node: its outline (with a stem and leaf), and the picture in the middle */
function fruitSvg(shape) {
  const stem = shape === "apple" || shape === "pear"
    ? `<path class="fr-stem" d="M16 7.5c0-2 .4-3.6 1.6-5"/><path class="fr-leaf" d="M17.4 4.4c1.6-2.2 4.6-2.8 6.6-1.8-1 2.4-3.8 3.6-6.6 1.8z"/>`
    : shape === "orange" ? `<path class="fr-leaf" d="M16 5.2c1.2-2 3.8-2.8 5.8-2-1 2-3.4 3-5.8 2z"/>` : "";
  return `<svg class="fr-shape" viewBox="0 0 32 32" aria-hidden="true"><path class="fr-body" d="${FRUIT_SHAPES[shape]}"/><path class="fr-shine" d="M9 11.5c.6-2 2-3.2 3.6-3.6"/>${stem}</svg>`;
}
function fruitInner(shape, icon) {
  return fruitSvg(shape) + `<img class="fr-icon" src="${iconUrl(icon, 2)}" alt="" draggable="false">`;
}
