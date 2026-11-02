/* =========================================================
   src/engine/core/random.js
   Random numbers: seeded generators for anything that should be repeatable
   ========================================================= */
"use strict";

/* A small, fast generator: the same seed always gives the same numbers */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Any word or number turns into a seed */
function seedFromText(text) {
  const s = String(text);
  if (/^\d+$/.test(s)) return Number(s) >>> 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* A generator for one island's procedural generation, from its seed.txt.
   "random" gives a fresh seed every time; anything else repeats exactly. */
function worldRandom(area) {
  const w = CONTENT.worlds[area];
  const seed = w && w.seed && w.seed !== "random" ? seedFromText(w.seed) : (Math.random() * 4294967296) >>> 0;
  const next = seededRandom(seed);
  next.seed = seed;
  next.int = (min, max) => min + Math.floor(next() * (max - min));
  return next;
}
