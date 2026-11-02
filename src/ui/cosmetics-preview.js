/* =========================================================
   src/ui/cosmetics-preview.js
   Skin and theme previews and purchases
   ========================================================= */
"use strict";

/* =========================================================
   Skins and backdrops
   ========================================================= */
const nextSkinPrice = () => ECON.skinPrice(save.ownedSkins.length);
const nextBackdropPrice = () => ECON.backdropPrice(save.ownedBackdrops.length);

function currentSkin() {
  return skinById[save.selectedSkin] || skinById.classic;
}

function currentBackdrop() {
  return backdropById[save.selectedBackdrop] || backdropById.black;
}

/* ----- Cosmetic tiers ----- */
function tierState(kind, idx) {
  const tiers = COSMETIC_TIERS[kind];
  const tier = tiers[idx];
  const unlocked = save.cosmeticTiers[kind].includes(tier.group);
  if (idx === 0) return { tier, unlocked: true, met: true, need: 0, have: 0 };

  const prev = tiers[idx - 1];
  const items = kind === "skins" ? skins : backdrops;
  const owned = kind === "skins" ? save.ownedSkins : save.ownedBackdrops;
  const prevItems = items.filter(i => i.group === prev.group);
  const need = Math.ceil(prevItems.length / 2);
  const have = Math.min(need, prevItems.filter(i => owned.includes(i.id)).length);
  const prevUnlocked = save.cosmeticTiers[kind].includes(prev.group);
  return { tier, prev, unlocked, need, have, prevUnlocked, met: prevUnlocked && have >= need };
}

function itemTierUnlocked(kind, item) {
  return save.cosmeticTiers[kind].includes(item.group);
}

function unlockTier(kind, group) {
  const st = tierState(kind, tierIndex(kind, group));
  const fee = st.tier.fee;
  if (st.unlocked || !st.met || save.snakebucks < fee) return;
  openConfirm({
    title: `Unlock ${group}?`,
    text: `This spends ${fmtInt(fee)} Snakebucks and opens the ${group} ${kind === "skins" ? "skins" : "themes"}. Each one inside still has its usual price.`,
    ok: `Unlock for ${fmtInt(fee)} SB`,
    gold: true,
    onOk: () => {
      if (!spendBucks(fee)) return;
      const list = new Set([...save.cosmeticTiers[kind], group]);
      save.cosmeticTiers[kind] = COSMETIC_TIERS[kind].map(t => t.group).filter(g => list.has(g));
      persist();
      sfx("unlock");
      updateHud();
      renderUpgradeBody();
      checkBadges();
    }
  });
}

function purchaseSkin(id) {
  if (!skinById[id] || save.ownedSkins.includes(id)) return;
  if (!itemTierUnlocked("skins", skinById[id])) return;
  if (!spendBucks(nextSkinPrice())) return;
  save.ownedSkins.push(id);
  save.selectedSkin = id;
  persist();
  sfx("buy");
  updateHud();
  renderUpgradeBody();
  checkBadges();
}

function equipSkin(id) {
  if (!save.ownedSkins.includes(id)) return;
  save.selectedSkin = id;
  persist();
  sfx("click");
  renderUpgradeBody();
}

function purchaseBackdrop(id) {
  if (!backdropById[id] || save.ownedBackdrops.includes(id)) return;
  if (!itemTierUnlocked("backdrops", backdropById[id])) return;
  if (!spendBucks(nextBackdropPrice())) return;
  save.ownedBackdrops.push(id);
  save.selectedBackdrop = id;
  persist();
  applyBackdrop();
  sfx("buy");
  updateHud();
  renderUpgradeBody();
  checkBadges();
}

function equipBackdrop(id) {
  if (!save.ownedBackdrops.includes(id)) return;
  save.selectedBackdrop = id;
  persist();
  applyBackdrop();
  sfx("click");
  renderUpgradeBody();
}

function paintBackdrop(g, backdrop, w, h) {
  if (backdrop.kind === "pattern") {
    g.save();
    backdrop.draw(g, w, h);
    g.restore();
  } else {
    g.fillStyle = backdrop.base;
    g.fillRect(0, 0, w, h);
  }
}

function applyBackdrop() {
  const bd = currentBackdrop();
  bgCanvas.width = Math.round(boardSize * RS);
  bgCanvas.height = Math.round(boardSize * RS);
  bgCtx.setTransform(RS, 0, 0, RS, 0, 0);
  bgCtx.clearRect(0, 0, boardSize, boardSize);
  paintBackdrop(bgCtx, bd, boardSize, boardSize);
  finishBoard(bgCtx, bd);
  stageEl.style.background = bd.base;
  visibleColorCache.clear();
  skinColorCache.clear();
  applyTheme();
}

/* A soft vignette and a whisper of grain on every board, so it reads as a felt
   surface under a lamp rather than flat paint */
function finishBoard(g, bd) {
  const light = relativeLuminance(hexToRgb(bd.base)) > 0.45;
  const v = g.createRadialGradient(boardSize / 2, boardSize / 2, boardSize * 0.3, boardSize / 2, boardSize / 2, boardSize * 0.75);
  v.addColorStop(0, "rgba(0, 0, 0, 0)");
  v.addColorStop(1, light ? "rgba(60, 40, 20, 0.16)" : "rgba(0, 0, 0, 0.32)");
  g.fillStyle = v;
  g.fillRect(0, 0, boardSize, boardSize);
  const rand = seededRandom(909);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.5 ? "rgba(255, 255, 255, 0.035)" : "rgba(0, 0, 0, 0.05)";
    g.fillRect(Math.floor(rand() * boardSize), Math.floor(rand() * boardSize), 1, 1);
  }
}
