/* =========================================================
   src/game/world/unlocks.js
   Unlocking islands, and the Nightmare Realm
   ========================================================= */
"use strict";

/* =========================================================
   Islands unlock in order. Each one needs the island before it
   unlocked, that island's tree mostly grown, and XP
   (src/game/economy/ladder.js)
   ========================================================= */
function isModeUnlocked(key) {
  return save.unlockedModes.includes(key);
}

function previousMode(key) {
  return MODE_KEYS[MODE_KEYS.indexOf(key) - 1];
}

function modeUnlockState(key) {
  const prev = previousMode(key);
  const prevOk = !prev || isModeUnlocked(prev);
  const gate = islandUnlockGate(key);
  const cost = modes[key].unlockAt;
  return { prev, prevOk, gate, treeOk: gate.met, cost, affordable: save.xp >= cost, ready: prevOk && gate.met && save.xp >= cost };
}

/* What still stands in the way, in a few words for the map */
function unlockBlocker(key) {
  const s = modeUnlockState(key);
  if (!s.prevOk) return `Unlock ${STORY[s.prev].title} first`;
  if (!s.treeOk) {
    const pct = Math.round(s.gate.need * 100);
    const have = Math.floor(s.gate.have * 100);
    return s.gate.red
      ? `First grow ${upgradeTracks[nmTrackKey(s.prev)].label} to ${pct}% (now ${have}%)`
      : `First grow the tree on ${STORY[s.prev].title} to ${pct}% (now ${have}%)`;
  }
  if (!s.affordable) return `Need ${fmtInt(s.cost)} XP (you have ${fmtInt(save.xp)})`;
  return "";
}

function unlockMode(key) {
  const mode = modes[key];
  if (!mode || isModeUnlocked(key) || !modeUnlockState(key).ready) return;
  const opens = Object.values(upgradeTracks).filter(t => t.requires === key && !t.nightmareOf).map(t => t.label);
  openConfirm({
    title: `Unlock ${STORY[key].title}?`,
    text: `This spends ${fmtInt(mode.unlockAt)} XP. You have ${fmtInt(save.xp)}.` + (opens.length ? ` It also opens new upgrades: ${opens.join(", ")}.` : ""),
    ok: `Unlock for ${fmtInt(mode.unlockAt)} XP`,
    gold: true,
    onOk: () => {
      if (isModeUnlocked(key) || !modeUnlockState(key).ready || !spendXp(mode.unlockAt)) return;
      const realmBefore = nightmareRealmOpen();
      save.unlockedModes.push(key);
      save.unlockedModes = MODE_KEYS.filter(m => save.unlockedModes.includes(m));
      // A Nightmare-run save has no plain levels, so a new island opens straight onto its Nightmare
      if (nightmareSave()) openNightmare(key);
      checkFullRun();
      persist();
      sfx("unlock");
      updateHud();
      checkBadges();
      renderModes(key);
      const realmNow = !realmBefore && nightmareRealmOpen();
      if (realmNow) setTimeout(() => showToast("Every island is yours. The Nightmare Realm has opened beneath them."), 1200);
      sceneForUnlock(key, () => { if (allModesUnlocked()) sceneForUnlock("levelsdone"); });
    }
  });
}

/* =========================================================
   The Nightmare Realm: a second campaign under the islands.
   It opens once every island is unlocked. Nightmare islands then
   unlock in the same order, each one's red upgrade opening with it.
   ========================================================= */
function openNightmare(key) {
  save.unlockedNightmares = MODE_KEYS.filter(m => m === key || save.unlockedNightmares.includes(m));
  save.nmUpgrades = MODE_KEYS.filter(m => m === key || save.nmUpgrades.includes(m));
}

function nightmareBlocker(key) {
  const s = nightmareUnlockState(key);
  if (!s.realm) return "The Nightmare Realm opens once every island is unlocked";
  if (!s.prevOk) return `Unlock the ${NIGHTMARES[s.prev].name} Nightmare first`;
  if (!s.treeOk) return `Grow ${upgradeTracks[nmTrackKey(s.prev)].label} to ${Math.round(s.need * 100)}% (now ${Math.floor(s.share * 100)}%)`;
  if (!s.affordable) return `Need ${fmtInt(s.cost)} XP (you have ${fmtInt(save.xp)})`;
  return "";
}

function unlockNightmare(key) {
  if (save.unlockedNightmares.includes(key) || !nightmareUnlockState(key).ready) return;
  const cost = nightmareUnlockState(key).cost;
  const red = upgradeTracks[nmTrackKey(key)];
  openConfirm({
    title: `Unlock the ${NIGHTMARES[key].name} Nightmare?`,
    text: `${NIGHTMARES[key].twist} This spends ${fmtInt(cost)} XP. You have ${fmtInt(save.xp)}.` + (red ? ` It also opens the red upgrade ${red.label}.` : ""),
    ok: `Unlock for ${fmtInt(cost)} XP`,
    gold: true,
    onOk: () => {
      const s = nightmareUnlockState(key);
      if (save.unlockedNightmares.includes(key) || !s.ready || !spendXp(s.cost)) return;
      openNightmare(key);
      persist();
      sfx("unlock");
      updateHud();
      checkBadges();
      renderModes(key);
      sceneForUnlock("nm-" + key, () => { if (save.unlockedNightmares.length === MODE_KEYS.length) sceneForUnlock("nightmaresdone"); });
    }
  });
}
