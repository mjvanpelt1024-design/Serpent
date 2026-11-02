/* =========================================================
   src/ui/shop-groups.js
   Collapsible shop groups
   ========================================================= */
"use strict";

/* =========================================================
   Shop: collapsible groups
   ========================================================= */
const shopOpen = {};

function groupMode(label) {
  return MODE_KEYS.find(m => modes[m].label === label);
}

/* Wraps each group header and its rows into a section you tap to open */
function collapseShopGroups(root) {
  const heads = Array.from(root.querySelectorAll(".group-head"));
  heads.forEach(head => {
    const label = head.textContent.trim();
    const parent = head.parentElement;
    const body = document.createElement("div");
    body.className = "group-body";
    let n = head.nextElementSibling;
    while (n && !n.classList.contains("group-head")) {
      const next = n.nextElementSibling;
      if (n.classList.contains("btn-prestige") && parent.classList.contains("core-box")) { n = next; continue; }
      body.appendChild(n);
      n = next;
    }
    parent.insertBefore(body, head.nextSibling);
    const keys = Array.from(body.querySelectorAll('[data-key^="up-"]')).map(b => b.dataset.key.slice(3)).filter(k => upgradeTracks[k]);
    const have = keys.reduce((a, k) => a + (save.tiers[k] || 0), 0);
    const total = keys.reduce((a, k) => a + upgradeTracks[k].values.length, 0);
    const open = window.__SHOP_OPEN || shopOpen[label] === true;
    const btn = document.createElement("button");
    btn.className = "group-toggle" + (open ? " open" : "");
    btn.setAttribute("aria-expanded", String(open));
    btn.dataset.key = "group-" + label;
    btn.innerHTML = `<span class="gt-name">${head.innerHTML}</span><span class="gt-prog">${total ? `${have}/${total}` : ""}</span><span class="gt-chev" aria-hidden="true">&#9662;</span>`;
    // Outline colors: Core follows prestige, a mode turns purple once its red Nightmare track is open,
    // Master and Nightmare turn red when fully maxed
    const mode = groupMode(label);
    if (label === "Core stats" && save.prestige) btn.classList.add("rank-" + save.prestige);
    else if (mode && save.nmUpgrades.includes(mode)) btn.classList.add("gt-purple");
    else if ((label.startsWith("Master") || label === "Nightmare") && total && have === total) btn.classList.add("gt-red");
    else if (total && have === total) btn.classList.add("gt-gold");
    body.hidden = !open;
    btn.addEventListener("click", () => {
      shopOpen[label] = !(shopOpen[label] === true);
      const nowOpen = shopOpen[label];
      btn.classList.toggle("open", nowOpen);
      btn.setAttribute("aria-expanded", String(nowOpen));
      body.hidden = !nowOpen;
      sfx("tab");
    });
    head.replaceWith(btn);
  });
}
