/* =========================================================
   src/game/sandbox/sandbox-tools.js
   The level editor's palette: items, walls, edges, speeds and twists
   ========================================================= */
"use strict";

/* =========================================================
   Sandbox: level editor, My Levels / Community tabs and level codes
   ========================================================= */
const SB_SIZE = 20;
/* Items: normal = capital letter, small = lowercase, large (2x2) = symbol */
const SB_ITEMS = {
  apple: ["A", "a", "@"], xp: ["X", "x", "*"], rock: ["R", "r", "%"], popsicle: ["O", "o", "&"],
  flea: ["F", "f", "!"], fire: ["H", "h", "^"], molasses: ["M", "m", "~"]
};
const SB_CHAR = {};
const SB_GRADE_OF_INDEX = [1, 0, 2];   // SB_ITEMS lists letters as normal, small, large
const SB_INDEX_OF_GRADE = [1, 0, 2];
Object.entries(SB_ITEMS).forEach(([type, chars]) => chars.forEach((ch, i) => { SB_CHAR[ch] = { type, grade: SB_GRADE_OF_INDEX[i] }; }));
const SB_CATS = [
  { id: "walls", label: "Walls", tools: [
    { id: "#", label: "Red block" }, { id: "P", label: "Portal block" },
    { id: "pr", label: "Red panel", panel: "r" }, { id: "pp", label: "Portal panel", panel: "p" }] },
  { id: "food", label: "Food", sized: true, tools: [{ id: "apple", label: "Apple" }, { id: "xp", label: "XP" }] },
  { id: "hazards", label: "Hazards", sized: true, toggles: true, tools: [
    { id: "rock", label: "Rock" }, { id: "popsicle", label: "Popsicle" }, { id: "flea", label: "Flea" },
    { id: "fire", label: "Fire" }, { id: "molasses", label: "Molasses" }] },
  { id: "spawners", label: "Spawners", chips: true, tools: [
    { id: "popsicle", label: "Popsicles" }, { id: "flea", label: "Fleas" }, { id: "fire", label: "Fire" }, { id: "molasses", label: "Molasses" }] },
  // build 52: the campaign's new enemies, as spawner chips too (content/campaign/foes.json)
  { id: "foes", label: "Foes", chips: true, tools: [
    { id: "knightling", label: "Tin knightlings" }, { id: "scorpion", label: "Scorpions" }, { id: "sparkbeetle", label: "Spark beetles" }, { id: "inkwraith", label: "Ink wraiths" }, { id: "mantis", label: "Blade mantises" }, { id: "viper", label: "Marsh vipers" }, { id: "frostsprite", label: "Frost sprites" }, { id: "urchin", label: "Sea urchins" }, { id: "firebat", label: "Cinder bats" }] },
  { id: "special", label: "Special", tools: [{ id: "S", label: "Snake start" }, { id: ".", label: "Eraser" }] }
];
const SB_HAZARDS = ["rock", "popsicle", "flea", "fire", "molasses"];   // hazards a level can switch off
const SB_VANISH_STEPS = [0, 2, 3, 5, 8];   // seconds a disappearing red wall is gone (0 = off)
const SB_EDGES = [["w", "Wrap"], ["a", "Walls"], ["m", "Mirror"]];
const SB_SPEEDS = [[5, "Slow"], [7, "Normal"], [10, "Fast"]];
const SB_TWISTS = [["starve", "Starving", "You shrink over time"], ["dark", "Blackout", "Only a circle of light"], ["avalanche", "Avalanche", "Rocks keep falling"],
  ["noMercy", "No Mercy", "Popsicles end the run"], ["sugar", "Sugar High", "Apples speed you up"], ["flip", "Topsy-Turvy", "Mirror warps flip controls"]];
const SB_SPAWNS = [["popsicle", "Popsicles"], ["flea", "Fleas"], ["fire", "Fire"], ["molasses", "Molasses"],   // enemy spawners
  ["knightling", "Tin knightlings"], ["scorpion", "Scorpions"], ["sparkbeetle", "Spark beetles"], ["inkwraith", "Ink wraiths"], ["mantis", "Blade mantises"], ["viper", "Marsh vipers"], ["frostsprite", "Frost sprites"], ["urchin", "Sea urchins"], ["firebat", "Cinder bats"]];
/* A boss to fight in a sandbox level (build 52): "" none, an island id (that island's boss) or a champion's id */
const SB_BOSSES = () => (typeof CAMP === "undefined" ? [] : CAMP.islands.map(I => ({ id: I.id, name: I.boss.name })).concat(((CAMP.foes || {}).champions || []).map(c => ({ id: c.id, name: c.name + " (champion)" }))));
const defaultRules = () => ({ h: 3, ar: true, t: [] });
