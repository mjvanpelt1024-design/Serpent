/* =========================================================
   src/ui/achievement-sorting.js
   Sorting the badge list
   ========================================================= */
"use strict";

/* =========================================================
   Achievements: sorting
   ========================================================= */
let achSort = "default";
const ACH_SORTS = [["default", "Groups"], ["newest", "Newest"], ["az", "A to Z"], ["most", "Most done"], ["least", "Least done"]];

function familyProgress(f, have) {
  const got = f.tiers.filter(t => have.has(f.id + ":" + t)).length;
  const next = f.tiers.find(t => !have.has(f.id + ":" + t));
  const partial = next === undefined ? 0 : Math.min(1, f.metric() / next);
  return (got + partial) / f.tiers.length;
}

function familyNewest(f) {
  let at = -1;
  save.badges.forEach((id, i) => { if (id.startsWith(f.id + ":")) at = i; });
  return at;
}

function renderAchSorter() {
  const bar = document.getElementById("ach-sort");
  bar.innerHTML = ACH_SORTS.map(([id, label]) => `<button class="subtab" data-achsort="${id}" aria-pressed="${id === achSort}" aria-selected="${id === achSort}">${label}</button>`).join("");
  bar.querySelectorAll("[data-achsort]").forEach(b => b.addEventListener("click", () => { achSort = b.dataset.achsort; sfx("tab"); renderAchievements(); }));
}
