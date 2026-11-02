/* =========================================================
   src/ui/trees.js
   Island trees and the Great Tree: layout, drawing and the tree screen
   ========================================================= */
"use strict";

/* =========================================================
   Island upgrade trees. Each island's four upgrades grow as a tree:
   the trunk first, two branches once the trunk reaches tier 4, and
   the crown once both branches do. The red Nightmare upgrade hangs
   underneath, unlocked as before. Prices follow the XP a good run
   on that island earns, so roughly one tier per node per good run.
   Medals: silver for one upgrade fully grown, gold for all four,
   purple for the Nightmare one. Medals are kept forever.
   ========================================================= */
/* Each island's tree, from the slot in each of its upgrade files */
const TREE_SLOTS = ["trunk", "left", "right", "crown"];
const TREES = {};
MODE_KEYS.forEach(area => {
  const ups = CONTENT.worlds[area].upgrades;
  TREES[area] = TREE_SLOTS.map(slot => (ups.find(u => u.slot === slot) || {}).id).filter(Boolean);
});
const TREE_GATE = ECON.trees.treeGate;        // tiers on the parent before the next part grows
const TREE_PART = ["Trunk", "Left branch", "Right branch", "Crown"];
const TREE_LEAVES = Object.fromEntries(MODE_KEYS.map(area => [area, (CONTENT.worlds[area].info.tree || {}).leaves || ["#3f9a3a", "#5ab046", "#7cc95a", "#ff3b3b"]]));

const treeAreaOf = key => Object.keys(TREES).find(a => TREES[a].includes(key));
const treeTier = k => save.tiers[k] || 0;

/* The Great Tree: the core stats grow up its trunk, and Extra Hearts crowns it */
/* What each part grows from. A part grows once every part it hangs from reaches tier 4. */
const GLOBAL_GATES = {};
CONTENT.greatTree.forEach(u => { if (u.growsFrom) GLOBAL_GATES[u.id] = [].concat(u.growsFrom).map(String); });
const GLOBAL_MAIN = CONTENT.greatTree.filter(u => u.part !== "dream").map(u => u.id);
const GLOBAL_DREAMS = CONTENT.greatTree.filter(u => u.part === "dream").map(u => u.id);
const GLOBAL_KEYS = GLOBAL_MAIN.concat(GLOBAL_DREAMS);
/* Each one-time item grows on one island's tree, and turns up under the Great Tree once that island is yours */
const ITEM_ISLAND = Object.fromEntries(CONTENT.items.map(it => [it.id, String(it.island)]));
const itemOpen = k => isModeUnlocked(ITEM_ISLAND[k]);
const treeTitle = area => (area === "global" ? "The Great Tree" : STORY[area].title);

/* Whether a part of the tree has grown far enough to be bought */
function treeNodeOpen(key) {
  if (GLOBAL_GATES[key]) {
    if ((save.tiers[key] || 0) > 0) return true;
    return GLOBAL_GATES[key].every(k => (save.tiers[k] || 0) >= TREE_GATE);
  }
  const area = treeAreaOf(key);
  if (!area || treeTier(key) > 0) return true;
  const [a, b, c] = TREES[area];
  const i = TREES[area].indexOf(key);
  if (i === 0) return true;
  if (i < 3) return treeTier(a) >= TREE_GATE;
  return treeTier(b) >= TREE_GATE && treeTier(c) >= TREE_GATE;
}

function treeGateText(key) {
  if (GLOBAL_GATES[key]) return `Grows once ${GLOBAL_GATES[key].map(k => upgradeTracks[k].label).join(" and ")} reach${GLOBAL_GATES[key].length === 1 ? "es" : ""} tier ${TREE_GATE}`;
  const area = treeAreaOf(key);
  const [a, b, c] = TREES[area];
  const i = TREES[area].indexOf(key);
  if (i < 3) return `Grows once ${upgradeTracks[a].label} reaches tier ${TREE_GATE}`;
  return `Grows once ${upgradeTracks[b].label} and ${upgradeTracks[c].label} reach tier ${TREE_GATE}`;
}


function treeMedalsNow(area) {
  if (area === "global") {
    const got = [];
    if (["xp", "time", "apple", "hearts"].some(trackMaxed)) got.push("silver");
    if (GLOBAL_MAIN.every(trackMaxed)) got.push("gold");
    if (GLOBAL_DREAMS.every(trackMaxed)) got.push("purple");
    return got;
  }
  const keys = TREES[area];
  const got = [];
  if (keys.some(trackMaxed)) got.push("silver");
  if (keys.every(trackMaxed)) got.push("gold");
  const nk = nmTrackKey(area);
  if (save.nmUpgrades.includes(area) && nk && trackMaxed(nk)) got.push("purple");
  return got;
}

/* Medals are earned once and kept, whatever happens to the tiers later */
function checkTreeMedals(silent = false) {
  let fresh = null;
  Object.keys(TREES).concat("global").forEach(area => {
    const have = save.treeMedals[area] || [];
    treeMedalsNow(area).forEach(m => {
      if (!have.includes(m)) { have.push(m); fresh = { area, m }; }
    });
    if (have.length) save.treeMedals[area] = ["silver", "gold", "purple"].filter(m => have.includes(m));
  });
  if (fresh) persist();
  if (fresh && !silent) {
    const names = { silver: "Silver", gold: "Gold", purple: "Nightmare" };
    setTimeout(() => { showToast(`${names[fresh.m]} medal: ${treeTitle(fresh.area)}${fresh.area === "global" ? "" : " tree"}!`); sfx("medal"); }, 200);
  }
}

const STAR_SVG = '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>';
/* A little medal on a ribbon. Empty slots show only its shadow. */
const MEDAL_LOOK = {
  silver: { rib: ["#3a6ad0", "#c8d6ff"], face: ["#ffffff", "#c9ced6", "#7d828a"], mark: "#8a9098" },
  gold: { rib: ["#c0282e", "#ffd0d0"], face: ["#fff6c4", "#ffd23f", "#a8860b"], mark: "#b8860b" },
  purple: { rib: ["#1a1a1a", "#b36bff"], face: ["#f3d8ff", "#b36bff", "#5a2a9a"], mark: "#6a3ab0" }
};
function medalSvg(kind, on) {
  const L = MEDAL_LOOK[kind];
  const id = "mg" + kind + (on ? 1 : 0) + Math.random().toString(36).slice(2, 7);
  if (!on) {
    return `<svg class="tmedal" viewBox="0 0 20 28" aria-hidden="true"><path d="M5 0h4l2 9-3 3zM11 0h4l-3 12-3-3z" fill="rgba(0,0,0,0.35)"/><circle cx="10" cy="18" r="8" fill="rgba(0,0,0,0.4)"/><circle cx="10" cy="18" r="5.5" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/></svg>`;
  }
  return `<svg class="tmedal on ${kind}" viewBox="0 0 20 28" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${L.face[0]}"/><stop offset="0.5" stop-color="${L.face[1]}"/><stop offset="1" stop-color="${L.face[2]}"/></radialGradient></defs>
    <path d="M5 0h4l2 9-3 3z" fill="${L.rib[0]}"/><path d="M11 0h4l-3 12-3-3z" fill="${L.rib[0]}"/><path d="M6.5 0h1.2l1.8 8.5-.8.8z" fill="${L.rib[1]}"/><path d="M12.3 0h1.2l-2.7 10.4-.6-.6z" fill="${L.rib[1]}"/>
    <circle cx="10" cy="18.6" r="8" fill="rgba(0,0,0,0.35)"/><circle cx="10" cy="18" r="8" fill="url(#${id})"/>
    <circle cx="10" cy="18" r="5.6" fill="none" stroke="${L.mark}" stroke-width="0.9" opacity="0.7"/>
    <path d="M10 13.6l1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill="${L.mark}" opacity="0.85"/>
    <ellipse cx="7.5" cy="14.5" rx="2.2" ry="1.2" fill="#fff" opacity="0.55"/></svg>`;
}
function medalSlots(area, size = "") {
  const have = save.treeMedals[area] || [];
  const tips = area === "global"
    ? { silver: "Silver: the trunk or one of its three boughs fully grown", gold: "Gold: everything but the dream roots fully grown", purple: "Nightmare: all three dream roots maxed" }
    : { silver: "Silver: one upgrade fully grown", gold: "Gold: every upgrade fully grown", purple: "Nightmare: the red upgrade maxed" };
  return `<span class="tmedals ${size}" aria-label="${have.length} of 3 tree medals">` +
    ["silver", "gold", "purple"].map(m => `<span class="tm-slot" title="${tips[m]}${have.includes(m) ? "" : " (not yet earned)"}">${medalSvg(m, have.includes(m))}</span>`).join("") +
    "</span>";
}

const treeAffordable = area => (area === "global" ? GLOBAL_KEYS : TREES[area].concat(save.nmUpgrades.includes(area) ? [nmTrackKey(area)] : []))
  .some(k => !isTrackLocked(k) && !atGreatCap(k) && nextTierCost(k) !== null && walletFor(k) >= nextTierCost(k));

/* ----- Drawing a tree: the island, the trunk and branches, the leaves ----- */
const TREE_W = 200, TREE_H = 150;
const TREE_NODES = [{ x: 100, y: 96 }, { x: 56, y: 56 }, { x: 144, y: 58 }, { x: 100, y: 26 }];
const TREE_NM = { x: 100, y: 142 };
const treeSkyCache = {};

function treeSky(area) {
  if (treeSkyCache[area]) return treeSkyCache[area];
  const c = document.createElement("canvas");
  c.width = TREE_W;
  c.height = TREE_H;
  const g = c.getContext("2d");
  const accent = hexToRgb(MEDAL_COLORS[area]);
  const top = accent.map(v => Math.round(v * 0.32 + 26 * 0.68));
  const bottom = accent.map(v => Math.round(v * 0.25 + 250 * 0.75));
  for (let y = 0; y < TREE_H; y++) for (let x = 0; x < TREE_W; x++) {
    const k = Math.min(1, Math.max(0, y / TREE_H + (BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.1));
    const q = Math.round(k * 7) / 7;
    g.fillStyle = `rgb(${top.map((v, i) => Math.round(v + (bottom[i] - v) * q)).join(",")})`;
    g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 30; i++) {
    const x = mapHash(i, 3, 61) * TREE_W, y = mapHash(i, 4, 61) * TREE_H * 0.5;
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  return (treeSkyCache[area] = c);
}

function drawTree(c, area, t) {
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(treeSky(area), 0, 0);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const keys = TREES[area];
  const tiers = keys.map(treeTier);
  const maxes = keys.map(k => trackInfo(k, save.prestige).values.length);
  const open = keys.map(treeNodeOpen);
  const leaves = TREE_LEAVES[area];
  const sway = i => Math.sin(t * 1.1 + i * 1.7) * (i ? 1.2 : 0.4);

  // drifting clouds
  for (let i = 0; i < 3; i++) {
    const w = 26 + i * 8, x = ((i * 90 + t * (2 + i)) % 260) - 40, y = 12 + i * 22;
    R(x, y, w, 4, "rgba(255,255,255,0.45)"); R(x + 6, y - 3, w * 0.45, 3, "rgba(255,255,255,0.45)");
  }

  // the island
  const iy = 118, iw = 150;
  const [ga, gb, ge] = MAP_BIOME[area];
  for (let r = 0; r < 40; r++) {
    const half = (iw / 2) * Math.pow(1 - r / 40, 0.8) + (mapHash(r, 5, 9) - 0.5) * 3;
    if (half < 1) break;
    for (let x = -Math.round(half); x <= Math.round(half); x += 1) {
      const col = r < 10 ? (((x + r) & 1) && mapHash(x, r, 3) > 0.5 ? "#6c482b" : "#7a5232") : r < 24 ? (mapHash(x, r, 4) > 0.7 ? "#4e4038" : "#5e4a3a") : (mapHash(x, r, 5) > 0.6 ? "#57545c" : "#4c4a50");
      R(100 + x, iy + 6 + r, 1, 1, x === Math.round(half) ? "#2e2420" : col);
    }
  }
  for (let dy = -7; dy <= 7; dy++) {
    const half = (iw / 2) * Math.sqrt(1 - Math.pow(dy / 7.5, 2));
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      let col = ((x + dy) & 1) && mapHash(x, dy, 8) > 0.45 ? gb : ga;
      if (dy >= 6) col = ge;
      R(100 + x, iy + dy, 1, 1, col);
    }
  }

  // the Nightmare upgrade, hanging below on a chain
  if (save.nmUpgrades.includes(area) || nightmareRealmOpen()) {
    const on = save.nmUpgrades.includes(area);
    for (let y = iy + 30; y < TREE_NM.y - 4; y += 2) R(TREE_NM.x, y, 1, 1, on ? "#c48ad8" : "#7a7480");
    if (on) { g.fillStyle = `rgba(200,120,255,${0.25 + 0.15 * Math.sin(t * 2)})`; g.fillRect(TREE_NM.x - 8, TREE_NM.y - 6, 17, 12); }
  }

  // limbs: thicker as their part of the tree grows
  const limb = (x0, y0, x1, y1, w, col) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const ww = Math.max(1, Math.round(w * (1 - f * 0.35)));
      R(x - ww / 2, y, ww, 1, col);
      R(x - ww / 2, y, 1, 1, "#7a5232");
    }
  };
  const bark = "#5a3a20";
  const tw = 4 + Math.floor(tiers[0] / 4);
  const fork = { x: 100, y: 74 };
  const nodes = TREE_NODES.map((n, i) => ({ x: n.x + sway(i), y: n.y }));
  limb(100, iy, fork.x, fork.y, tw, bark);
  // roots
  R(100 - tw / 2 - 3, iy - 1, 3, 2, bark); R(100 + tw / 2, iy - 1, 3, 2, bark);
  [[1, 2 + Math.floor(tiers[1] / 5)], [2, 2 + Math.floor(tiers[2] / 5)], [3, 2 + Math.floor(tiers[3] / 6)]].forEach(([i, w]) => {
    if (open[i]) limb(fork.x, fork.y, nodes[i].x, nodes[i].y + 4, w, bark);
    else for (let s = 0; s < 6; s++) { const f = s / 10; R(fork.x + (nodes[i].x - fork.x) * f, fork.y + (nodes[i].y - fork.y) * f, 1, 1, "rgba(90,58,32,0.45)"); }
  });

  // leaves: a cluster per grown part, fuller with every tier
  nodes.forEach((n, i) => {
    if (!open[i]) {
      R(n.x - 1, n.y + 2, 3, 3, "rgba(120,150,90,0.5)");          // a bud, waiting
      return;
    }
    const frac = tiers[i] / maxes[i];
    const count = 22 + Math.round(frac * 120);
    const rad = 8 + frac * 12;
    for (let k = 0; k < count; k++) {
      const a = mapHash(k, i, 21) * Math.PI * 2, d = Math.sqrt(mapHash(k, i, 23)) * rad;
      const x = n.x + Math.cos(a) * d * 1.25 + Math.sin(t * 1.5 + k) * 0.4;
      const y = n.y + Math.sin(a) * d * 0.8;
      R(x, y, 2, 2, leaves[k % 3]);
    }
    if (tiers[i] >= maxes[i]) {
      // fully grown: fruit, glinting
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3 + 0.4, x = n.x + Math.cos(a) * rad * 0.9, y = n.y + Math.sin(a) * rad * 0.55;
        R(x, y, 2, 2, leaves[3]);
        if (Math.sin(t * 3 + k * 2 + i) > 0.85) R(x, y, 1, 1, "#ffffff");
      }
    }
  });

  // a leaf or two drifting down
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.12 + k / 4) % 1;
    R(60 + k * 25 + Math.sin(t + k * 2) * 6, 30 + ph * 85, 1, 1, leaves[k % 3]);
  }
}

/* ----- The Great Tree: every upgrade that works everywhere, in one tree ----- */
const GLOBAL_TREE = {
  W: 240, H: 184, iy: 130, iw: 214,
  nodes: Object.fromEntries(CONTENT.greatTree.map(u => [u.id, { x: (u.position || [120, 100])[0], y: (u.position || [120, 100])[1] }])),
  fork: { x: 120, y: 90 },
  prestige: { x: 120, y: 146 },
  items: [{ x: 20, y: 128 }, { x: 42, y: 133 }, { x: 64, y: 130 }, { x: 176, y: 130 }, { x: 198, y: 133 }, { x: 220, y: 128 }, { x: 86, y: 135 }, { x: 154, y: 135 }]
};
const GLOBAL_PART = {
  xp: "Trunk", time: "Left bough", hearts: "Middle bough", apple: "Right bough",
  bloomer: "Off Score Boost", allowance: "Off Score Boost", parting: "Off Score Boost",
  popcontrol: "Off Extra Hearts, Master", ironstomach: "Off Extra Hearts, Master", halfheart: "Off Extra Hearts, Master",
  welcome: "Off Apple-er Apples", bigappetite: "Off Apple-er Apples, Master",
  baddreams: "Dream root", dreamcatcher: "Dream root", lucid: "Dream root",
  scalearmor: "Off Extra Hearts, special", lucky: "Off Extra Hearts, special", feverpitch: "Off Apple-er Apples, special",
  bounty: "Off Apple-er Apples, special", molting: "Off Score Boost, special"
};
const GLOBAL_COLOR = {
  xp: "#9be870", time: "#ffd23f", apple: "#ff5a5a", hearts: "#ff5d8f",
  welcome: "#ff9ad5", bloomer: "#ffb0e0", allowance: "#ffcf4d", parting: "#d0a070",
  popcontrol: "#7fe3ff", ironstomach: "#b8c0cc", halfheart: "#ff7a8a", bigappetite: "#ff8c1a",
  scalearmor: "#c9ced6", feverpitch: "#ff8c1a", molting: "#d8c8a0", bounty: "#ffd23f", lucky: "#3ddc3d"
};
const TREE_ITEM_SPOT = { x: 154, y: 113 };
const globalSkyCache = {};

function drawGlobalTree(c, t) {
  const G = GLOBAL_TREE;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (!globalSkyCache.sky) {
    const sky = document.createElement("canvas");
    sky.width = G.W;
    sky.height = G.H;
    const sg = sky.getContext("2d");
    const top = hexToRgb("#2a3a6a"), bottom = hexToRgb("#ffd9a8");
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const k = Math.min(1, Math.max(0, y / G.H + (BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.1));
      const q = Math.round(k * 8) / 8;
      sg.fillStyle = `rgb(${top.map((v, i) => Math.round(v + (bottom[i] - v) * q)).join(",")})`;
      sg.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 46; i++) {
      sg.fillStyle = `rgba(255,255,255,${0.3 + mapHash(i, 9, 3) * 0.5})`;
      sg.fillRect(Math.round(mapHash(i, 1, 77) * G.W), Math.round(mapHash(i, 2, 77) * G.H * 0.45), 1, 1);
    }
    globalSkyCache.sky = sky;
  }
  g.drawImage(globalSkyCache.sky, 0, 0);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const tier = k => save.tiers[k] || 0;
  const frac = k => tier(k) / trackInfo(k, save.prestige).values.length;

  // drifting clouds and a few fireflies
  for (let i = 0; i < 4; i++) {
    const w = 24 + i * 8, x = ((i * 80 + t * (2 + i * 0.7)) % (G.W + 60)) - 40, y = 10 + i * 18;
    R(x, y, w, 3, "rgba(255,255,255,0.35)"); R(x + 6, y - 2, w * 0.45, 2, "rgba(255,255,255,0.35)");
  }

  // the island
  const iy = G.iy, cx = G.W / 2, half = G.iw / 2;
  for (let r = 0; r < 34; r++) {
    const hw = half * Math.pow(1 - r / 34, 0.75) + (mapHash(r, 5, 19) - 0.5) * 3;
    if (hw < 1) break;
    for (let x = -Math.round(hw); x <= Math.round(hw); x++) {
      const col = r < 9 ? (((x + r) & 1) && mapHash(x, r, 3) > 0.5 ? "#6c482b" : "#7a5232") : r < 22 ? (mapHash(x, r, 4) > 0.7 ? "#4e4038" : "#5e4a3a") : (mapHash(x, r, 5) > 0.6 ? "#57545c" : "#4c4a50");
      R(cx + x, iy + 6 + r, 1, 1, x === Math.round(hw) ? "#2e2420" : col);
    }
  }
  for (let dy = -7; dy <= 7; dy++) {
    const hw = half * Math.sqrt(1 - Math.pow(dy / 7.5, 2));
    for (let x = -Math.round(hw); x <= Math.round(hw); x++) {
      let col = ((x + dy) & 1) && mapHash(x, dy, 8) > 0.45 ? "#4f9a3a" : "#5aab45";
      if (dy >= 6) col = "#2f6a24";
      if (dy === -7) col = "#7cc95a";
      R(cx + x, iy + dy, 1, 1, col);
    }
  }
  // flowers in the grass
  for (let i = 0; i < 26; i++) {
    const x = cx + (mapHash(i, 3, 91) - 0.5) * G.iw * 0.9, y = iy - 5 + mapHash(i, 4, 91) * 9;
    R(x, y, 1, 1, ["#ff6b6b", "#ffe066", "#ffffff", "#ff9ad5"][i % 4]);
  }

  // dream roots: chains down to the three dream upgrades
  const dreamsOn = save.unlockedNightmares.length > 0;
  GLOBAL_DREAMS.forEach((k, i) => {
    const n = G.nodes[k];
    for (let y = iy + 18; y < n.y - 5; y += 2) R(n.x + Math.sin(y * 0.3 + i) * 0.6, y, 1, 1, dreamsOn ? "#c48ad8" : "#6a6470");
    if (dreamsOn) { g.fillStyle = `rgba(200,120,255,${0.18 + 0.12 * Math.sin(t * 2 + i)})`; g.fillRect(n.x - 9, n.y - 7, 19, 14); }
  });

  // limbs
  const limb = (x0, y0, x1, y1, w, col = "#5a3a20") => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const ww = Math.max(1, Math.round(w * (1 - f * 0.4)));
      R(x - ww / 2, y, ww, 1, col);
      R(x - ww / 2, y, 1, 1, "#7a5232");
    }
  };
  const sway = (i, amp = 1) => Math.sin(t * 1.1 + i * 1.7) * amp;
  const N = {};
  Object.entries(G.nodes).forEach(([k, n], i) => { N[k] = { x: n.x + (GLOBAL_DREAMS.includes(k) ? 0 : sway(i, k === "xp" ? 0.3 : 1)), y: n.y }; });
  const open = k => !isTrackLocked(k);
  const tw = 7 + Math.floor(tier("xp") / 3);
  limb(cx, iy + 2, N.xp.x, N.xp.y + 4, tw);
  R(cx - tw / 2 - 4, iy - 1, 4, 2, "#5a3a20"); R(cx + tw / 2, iy - 1, 4, 2, "#5a3a20");
  const bud = (a, b) => { for (let s = 0; s < 8; s++) { const f = s / 13; R(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 1, 1, "rgba(90,58,32,0.5)"); } };
  // every part grows out of each part it hangs from, so a part fed by two grows from both
  const depth = { time: 4, apple: 4, hearts: 4 };
  Object.entries(GLOBAL_GATES).forEach(([k, parents]) => parents.forEach(pk => {
    const a = N[pk], b = N[k];
    if (open(k) || tier(k) > 0) limb(a.x, a.y + 2, b.x, b.y + 3, (depth[k] || 2) + Math.floor(tier(k) / 6));
    else bud(a, b);
  }));

  // leaves: a cluster on every grown part, fuller with every tier
  const palettes = { main: ["#2f7d2a", "#3f9a3a", "#5ab046", "#ffd23f"], west: ["#4a8a3a", "#6aa848", "#ff9ad5", "#ffffff"], east: ["#3a7a5a", "#4f9a6a", "#7fd0b0", "#ffb347"] };
  GLOBAL_MAIN.forEach((k, i) => {
    const n = N[k];
    if (!open(k) && tier(k) === 0) { R(n.x - 1, n.y + 2, 3, 3, "rgba(120,150,90,0.5)"); return; }
    const pal = i < 4 ? palettes.main : i < 8 ? palettes.west : palettes.east;
    const f = frac(k);
    const count = (i < 4 ? 30 : 16) + Math.round(f * (i < 4 ? 130 : 60));
    const rad = (i < 4 ? 9 : 5) + f * (i < 4 ? 12 : 7);
    for (let q = 0; q < count; q++) {
      const a = mapHash(q, i, 21) * Math.PI * 2, d = Math.sqrt(mapHash(q, i, 23)) * rad;
      R(n.x + Math.cos(a) * d * 1.25 + Math.sin(t * 1.5 + q) * 0.4, n.y + Math.sin(a) * d * 0.8, 2, 2, pal[q % 3]);
    }
    if (tier(k) >= trackInfo(k, save.prestige).values.length) {
      for (let q = 0; q < 5; q++) {
        const a = q * 1.3 + 0.4, x = n.x + Math.cos(a) * rad * 0.9, y = n.y + Math.sin(a) * rad * 0.55;
        R(x, y, 2, 2, pal[3]);
        if (Math.sin(t * 3 + q * 2 + i) > 0.85) R(x, y, 1, 1, "#ffffff");
      }
    }
  });
  // the rank plaque on the trunk
  if (save.prestige) { const col = ["", "#c87533", "#d8dde6", "#ffd23f"][save.prestige]; R(cx - 3, iy - 10, 7, 5, col); R(cx - 2, iy - 9, 5, 1, "#ffffff"); }
  // petals drifting
  for (let q = 0; q < 6; q++) {
    const ph = (t * 0.1 + q / 6) % 1;
    R(40 + q * 30 + Math.sin(t + q * 2) * 6, 20 + ph * 100, 1, 1, ["#ff9ad5", "#ffe066", "#ffffff"][q % 3]);
  }
}

/* ----- The tree screen ----- */
let treeArea = null;
let treeSel = null;          // a track key, "item:<key>", or "prestige"
let treeRaf = 0;
const treeCanvas = document.getElementById("tree-canvas");
const treePinsEl = document.getElementById("tree-pins");
const treeCardEl = document.getElementById("tree-card");

/* Everything that hangs on a tree: its upgrades, the red one, its fruit, and on the Great Tree the rank plaque */
function treeEntries(area) {
  const out = [];
  if (area === "global") {
    GLOBAL_KEYS.forEach(k => out.push({ id: k, kind: "track", k, at: GLOBAL_TREE.nodes[k] }));
    out.push({ id: "prestige", kind: "prestige", at: GLOBAL_TREE.prestige });
    CONSUMABLE_KEYS.forEach((k, i) => out.push({ id: "item:" + k, kind: "item", k, at: GLOBAL_TREE.items[i % GLOBAL_TREE.items.length] }));
    return out;
  }
  TREES[area].forEach((k, i) => out.push({ id: k, kind: "track", k, at: TREE_NODES[i] }));
  const nk = nmTrackKey(area);
  if (save.nmUpgrades.includes(area) || nightmareRealmOpen()) out.push({ id: nk, kind: "track", k: nk, at: TREE_NM });
  CONSUMABLE_KEYS.filter(k => ITEM_ISLAND[k] === area).forEach((k, i) => out.push({ id: "item:" + k, kind: "item", k, at: { x: TREE_ITEM_SPOT.x + i * 18, y: TREE_ITEM_SPOT.y } }));
  return out;
}

function trackColor(k, area) {
  const tr = upgradeTracks[k];
  if (tr.nightmareOf) return "#b0285e";
  return GLOBAL_COLOR[k] || tr.color || MEDAL_COLORS[area] || "#9be870";
}

function openTree(area) {
  treeArea = area;
  const ids = treeEntries(area).map(e => e.id);
  if (!treeSel || !ids.includes(treeSel)) {
    const keys = area === "global" ? GLOBAL_KEYS : TREES[area];
    treeSel = keys.find(k => !isTrackLocked(k) && nextTierCost(k) !== null && walletFor(k) >= nextTierCost(k)) || keys[0];
  }
  openScreen("tree");
}

function renderTree() {
  const area = treeArea;
  if (!area) return;
  const [W, H] = area === "global" ? [GLOBAL_TREE.W, GLOBAL_TREE.H] : [TREE_W, TREE_H];
  if (treeCanvas.width !== W || treeCanvas.height !== H) { treeCanvas.width = W; treeCanvas.height = H; }
  document.getElementById("screen-tree").style.setProperty("--tree-ar", (W / H).toFixed(4));
  document.getElementById("tree-title").textContent = treeTitle(area);
  document.getElementById("tree-medals").innerHTML = medalSlots(area, "big");
  treePinsEl.innerHTML = "";
  treeEntries(area).forEach(e => {
    const pin = document.createElement("button");
    pin.dataset.key = "node-" + e.id;
    pin.style.left = (e.at.x / W * 100) + "%";
    pin.style.top = (e.at.y / H * 100) + "%";
    let cls = "tree-pin fruit", label = "", shape = "apple", icon = e.k, color = "#9be870", aria = "";
    if (e.kind === "track") {
      const k = e.k, tr = upgradeTracks[k];
      const tier = treeTier(k);
      const max = trackInfo(k, save.prestige).values.length;
      const nm = !!tr.nightmareOf;
      const open = nm ? save.nmUpgrades.includes(area) : !isTrackLocked(k);
      const cost = nextTierCost(k);
      const ready = open && !atGreatCap(k) && cost !== null && walletFor(k) >= cost;
      cls += (open ? "" : " locked") + (ready ? " ready" : "") + (cost === null ? " maxed" : "") + (nm ? " nmn" : "") + (GLOBAL_DREAMS.includes(k) ? " dream" : "");
      label = cost === null ? "MAX" : `${tier}/${max}`;
      color = trackColor(k, area);
      aria = `${tr.label}, tier ${tier} of ${max}${open ? "" : ", locked"}`;
    } else if (e.kind === "item") {
      const k = e.k;
      const ok = itemOpen(k);
      const price = consumablePrice(k);
      shape = ITEM_FRUIT[k];
      icon = "item:" + k;
      color = ITEM_COLOR[k];
      cls += " item" + (ok ? "" : " locked") + (ok && save.xp >= price ? " ready" : "");
      label = save.consumables[k] ? "x" + fmtInt(save.consumables[k]) : fmtShort(price);
      aria = `${CONSUMABLES[k].name}, one-time item, you have ${save.consumables[k]}${ok ? "" : ", locked"}`;
    } else {
      shape = "orange";
      icon = "prestige";
      color = ["#9a8a70", "#c87533", "#d8dde6", "#ffd23f"][save.prestige];
      cls += " rank" + (canPrestige() ? " ready" : "") + (save.prestige >= MAX_PRESTIGE ? " maxed" : "");
      label = save.prestige ? PRESTIGE_RANKS[save.prestige] : "Rank";
      aria = "Prestige rank";
    }
    if (e.id === treeSel) cls += " selected";
    pin.className = cls;
    pin.style.setProperty("--c", color);
    pin.innerHTML = fruitInner(shape, icon) + `<span class="fr-tier">${label}</span>` +
      (cls.includes(" locked") ? `<span class="fr-lock">${LOCK_SVG}</span>` : "") +
      (cls.includes(" maxed") ? `<span class="fr-star">${STAR_SVG}</span>` : "");
    pin.setAttribute("aria-label", aria);
    pin.addEventListener("click", () => { treeSel = e.id; sfx("click"); renderTree(); });
    treePinsEl.appendChild(pin);
  });
  renderTreeCard();
  paintTree(performance.now() / 1000);
  if (!treeRaf) treeRaf = requestAnimationFrame(treeLoop);
}

function paintTree(t) {
  if (treeArea === "global") drawGlobalTree(treeCanvas, t);
  else drawTree(treeCanvas, treeArea, t);
}

function renderTreeCard() {
  const area = treeArea, sel = treeSel;
  const title = `<p class="tc-kicker">`;
  // A one-time item
  if (sel && sel.startsWith("item:")) {
    const k = sel.slice(5), c = CONSUMABLES[k];
    const ok = itemOpen(k), price = consumablePrice(k), can = ok && save.xp >= price;
    treeCardEl.style.setProperty("--c", ITEM_COLOR[k]);
    treeCardEl.innerHTML = `${title}One-time item, from the ${escapeAttr(STORY[ITEM_ISLAND[k]].title)}</p>
      <div class="tc-pic fruit item" style="--c:${ITEM_COLOR[k]}">${fruitInner(ITEM_FRUIT[k], "item:" + k)}</div>
      <h3 class="tc-name">${c.name}</h3>
      <p class="tc-desc">${c.desc}</p>
      <p class="tc-tier">${activeSlot ? `${escapeAttr(snakeName())} has <b>${fmtInt(save.consumables[k])}</b>. Items are paid in this save's XP and go in its Satchel.` : "Items belong to one save. Pick a save first."}</p>
      <div class="tc-actions">${!activeSlot ? `<button class="btn tc-buy" disabled>Pick a save first</button>` : ok
        ? `<button class="btn ${can ? "btn-gold" : ""} tc-buy" data-buy-item ${can ? "" : "disabled"}>${can ? "Pick one" : "Need"} <b>${fmtInt(price)}</b> XP</button>`
        : `<button class="btn tc-buy" disabled>${LOCK_SVG} Unlock ${escapeAttr(STORY[ITEM_ISLAND[k]].title)} first</button>`}</div>`;
    const b = treeCardEl.querySelector("[data-buy-item]");
    if (b) b.addEventListener("click", () => {
      if (!itemOpen(k) || save.xp < consumablePrice(k)) return;
      buyConsumable(k);
      showToast(`${c.name} is in your Satchel. You have ${fmtInt(save.consumables[k])}.`);
      renderTree();
      const again = treeCardEl.querySelector("[data-buy-item]");
      if (again && !again.disabled) again.focus({ preventScroll: true });
    });
    return;
  }
  // The rank plaque: prestige
  if (sel === "prestige") {
    const rank = save.prestige;
    treeCardEl.style.setProperty("--c", ["#c9b48a", "#c87533", "#d8dde6", "#ffd23f"][rank]);
    const needs = rank < MAX_PRESTIGE ? prestigeNeeds() : null;
    const rows = needs ? needs.reqs.concat([{ label: `${fmtShort(needs.fee)} Snakebucks`, met: save.snakebucks >= needs.fee, xp: true }]) : [];
    treeCardEl.innerHTML = `${title}The rank plaque</p>
      <h3 class="tc-name">${rank ? PRESTIGE_RANKS[rank] + " rank" : "No rank yet"}</h3>
      <p class="tc-desc">${rank >= MAX_PRESTIGE ? "The Great Tree is Gold ranked, the highest rank there is." : "Prestiging cuts the whole Great Tree back to tier 0, everything but the dream roots. It grows back stronger: the trunk and boughs 10x per tier, keeping what you've earned as their new start, and every other part 50% stronger. Climbing it again costs far more."}</p>
      ${needs ? `<ul class="prestige-needs">${rows.map(r => `<li class="${r.met ? "met" : ""}"><span class="tick" aria-hidden="true">${r.met ? "&#10003;" : "&#9675;"}</span><span class="pn-label">${r.label}</span><span class="pn-count">${r.xp ? "" : r.have + "/" + r.need}</span></li>`).join("")}</ul>` : ""}
      <div class="tc-actions">${rank >= MAX_PRESTIGE
        ? `<button class="btn tc-buy tc-max" disabled>Fully prestiged</button>`
        : `<button class="btn ${canPrestige() ? "btn-gold" : ""} tc-buy" data-prestige ${canPrestige() ? "" : "disabled"}>${canPrestige() ? "" : LOCK_SVG + " "}Prestige to ${PRESTIGE_RANKS[rank + 1]}</button>`}</div>`;
    const b = treeCardEl.querySelector("[data-prestige]");
    if (b) b.addEventListener("click", confirmPrestige);
    return;
  }
  // An upgrade
  const k = sel;
  const tr = upgradeTracks[k];
  const nm = !!tr.nightmareOf;
  const tier = treeTier(k);
  const info = trackInfo(k, save.prestige);
  const max = info.values.length;
  const cost = nextTierCost(k);
  const open = nm ? save.nmUpgrades.includes(area) : !isTrackLocked(k);
  const part = nm ? "Nightmare upgrade" : area === "global" ? GLOBAL_PART[k] : TREE_PART[TREES[area].indexOf(k)];
  let action = "";
  if (nm && !open) {
    action = `<button class="btn tc-buy" disabled>${LOCK_SVG} Opens with the ${escapeAttr(NIGHTMARES[area].name)} Nightmare</button>`;
  } else if (!open) {
    const why = !treeNodeOpen(k) ? treeGateText(k)
      : tr.requires === "all" ? "Unlock every island first"
      : tr.requires === "nightmare" ? "Unlock a Nightmare first"
      : tr.requires ? `Unlock ${STORY[tr.requires].title} first` : "Locked";
    action = `<button class="btn tc-buy" disabled>${LOCK_SVG} ${why}</button>`;
  } else if (cost === null) {
    action = `<button class="btn tc-buy tc-max" disabled>Fully grown</button>`;
  } else if (atGreatCap(k)) {
    action = `<button class="btn tc-buy" disabled>${LOCK_SVG} ${tr.requires === "nightmare" ? "Unlock more Nightmares" : "Unlock more islands"} to grow past tier ${greatTierCap(k)}</button>`;
  } else {
    const can = walletFor(k) >= cost;
    action = `<button class="btn ${can ? (nm ? "btn-purple" : "btn-gold") : ""} tc-buy" data-buy ${can ? "" : "disabled"}>${can ? "Grow" : "Need"} <b>${fmtInt(cost)}</b> ${curFor(k)}</button>` +
      `<button class="btn btn-small tc-all" data-buy-all ${can ? "" : "disabled"}>Grow as far as I can</button>`;
  }
  const now = tr.format(getTrackValue(k));
  const next = cost === null ? "" : ` <span class="tc-arrow">&#9654;</span> <b>${tr.format(trackValueAt(k, tier + 1))}</b>`;
  const col = trackColor(k, area);
  treeCardEl.style.setProperty("--c", col);
  treeCardEl.innerHTML = `${title}${part}</p>
    <div class="tc-pic fruit${nm ? " nmn" : ""}" style="--c:${col}">${fruitInner("apple", k)}</div>
    <h3 class="tc-name">${tr.label}</h3>
    <p class="tc-desc">${tr.desc}</p>
    <div class="tc-val"><span>${tier ? now : tr.format(info.base)}</span>${next}</div>
    <div class="tc-seg">${Array.from({ length: max }, (_, i) => `<span${i < tier ? ' class="on"' : ""}></span>`).join("")}</div>
    <p class="tc-tier">Tier ${tier} of ${max}</p>
    <div class="tc-actions">${action}</div>`;
  const buy = treeCardEl.querySelector("[data-buy]");
  if (buy) buy.addEventListener("click", () => { if (purchaseUpgrade(k)) afterTreeBuy(); });
  const all = treeCardEl.querySelector("[data-buy-all]");
  if (all) all.addEventListener("click", () => {
    let n = 0;
    while (nextTierCost(k) !== null && !atGreatCap(k) && walletFor(k) >= nextTierCost(k) && n < 50) { if (!purchaseUpgrade(k)) break; n++; }
    if (n) { showToast(`${tr.label} grew ${n} tier${n === 1 ? "" : "s"}.`); afterTreeBuy(); }
  });
}

function afterTreeBuy() {
  checkTreeMedals();
  renderTree();
  const b = treeCardEl.querySelector("[data-buy]") || treeCardEl.querySelector(".tc-buy");
  if (b && !b.disabled) b.focus({ preventScroll: true });
}

function treeLoop(ts) {
  treeRaf = 0;
  if (currentScreen !== "tree" || !treeArea) return;
  treeRaf = requestAnimationFrame(treeLoop);
  if (Math.floor(ts / 50) === Math.floor((ts - 17) / 50)) return;
  paintTree(ts / 1000);
}

/* ----- The island cards on the Shop's Permanent tab ----- */
function islandCards() {
  const wrap = document.createElement("div");
  wrap.className = "isle-grid";
  MODE_KEYS.forEach(area => {
    const owned = isModeUnlocked(area);
    const keys = TREES[area];
    const have = keys.reduce((a, k) => a + treeTier(k), 0);
    const total = keys.reduce((a, k) => a + trackInfo(k, save.prestige).values.length, 0);
    const card = document.createElement("button");
    card.className = "isle-card" + (owned ? "" : " locked") + (owned && treeAffordable(area) ? " ready" : "");
    card.dataset.key = "isle-" + area;
    card.style.setProperty("--m", MEDAL_COLORS[area]);
    const thumb = document.createElement("canvas");
    thumb.width = TREE_W;
    thumb.height = TREE_H;
    thumb.className = "isle-thumb";
    if (owned) drawTree(thumb, area, 1.5);
    card.innerHTML = `<span class="isle-name">${owned ? STORY[area].title : "Locked island"}</span>
      <span class="isle-prog"><span style="width:${(have / total * 100).toFixed(1)}%"></span></span>
      <span class="isle-foot"><span class="isle-count">${owned ? `${have}/${total}` : "Unlock it on the map"}</span>${medalSlots(area)}</span>
      ${owned && treeAffordable(area) ? '<span class="isle-dot" title="Something here can grow">+</span>' : ""}`;
    card.prepend(thumb);
    if (!owned) { card.disabled = true; card.innerHTML += LOCK_SVG; }
    card.addEventListener("click", () => { sfx("tab"); openTree(area); });
    wrap.appendChild(card);
  });
  return wrap;
}
