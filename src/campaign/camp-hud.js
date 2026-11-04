/* =========================================================
   src/campaign/camp-hud.js
   The campaign's heads-up display. Nothing is drawn on the board:
   everything you need sits in two rails beside it (above and below it
   on a tall, narrow screen), so the playing field is never covered.
     left rail   where you are, the goal, score, hearts and armor, the boss
     right rail  your gear, spell, snack, familiar and rune, active effects,
                 and a pointer to whatever the goal wants you to find
   ========================================================= */
"use strict";

let campHudEl = null;
let campHudAt = 0;

function campHudBuild() {
  if (!campHudEl) {
    campHudEl = document.createElement("div");
    campHudEl.id = "camp-hud";
    campHudEl.innerHTML = `
      <aside class="ch-rail ch-left" aria-label="Level">
        <div class="ch-where"><span class="ch-isl"></span><strong class="ch-lvl"></strong></div>
        <div class="ch-card ch-goal"><div class="ch-k">Goal</div><div class="ch-goal-t"></div><div class="ch-bar"><span></span></div><div class="ch-goal-n"></div></div>
        <div class="ch-card ch-score"><div class="ch-k">Score</div><div class="ch-score-n">0</div></div>
        <div class="ch-card ch-life"><div class="ch-k">Hearts</div><div class="ch-hearts"></div><div class="ch-armor"></div></div>
        <div class="ch-card ch-extra" hidden></div>
        <div class="ch-card ch-boss" hidden>
          <div class="ch-k ch-boss-name"></div>
          <div class="ch-boss-hearts"></div>
          <div class="ch-k">Stamina</div>
          <div class="ch-bar ch-stam"><span></span></div>
          <div class="ch-boss-state"></div>
        </div>
      </aside>
      <aside class="ch-rail ch-right" aria-label="Loadout">
        <div class="ch-top"><button class="btn btn-small ch-pause" aria-label="Pause">Pause</button></div>
        <div class="ch-card ch-kit"></div>
        <div class="ch-card ch-fx" hidden></div>
        <div class="ch-card ch-point" hidden><div class="ch-k">This way</div><div class="ch-arrow"><svg viewBox="0 0 24 24"><path d="M12 2l7 9h-4v11H9V11H5z"/></svg></div><div class="ch-dist"></div></div>
        <div class="ch-card ch-loot" hidden></div>
      </aside>`;
    document.body.appendChild(campHudEl);
    campHudEl.querySelector(".ch-pause").addEventListener("click", () => { if (gameState === "PLAYING" && !paused) pauseGame(); });
    window.addEventListener("resize", campHudPlace);
  }
  campHudEl.hidden = false;
  const isl = CAMP.islandById[campRun.isl];
  campHudEl.querySelector(".ch-isl").textContent = `${isl.name}${campRun.challenge >= 0 ? " · Challenge" : ""}`;
  campHudEl.querySelector(".ch-lvl").textContent = `${campRun.def.n}. ${campRun.def.name}`;
  campHudEl.querySelector(".ch-goal-t").textContent = goalText(campGoal) + (campRun.mods.length ? "" : "");
  campHudEl.querySelector(".ch-boss").hidden = !boss;
  campHudEl.style.setProperty("--isl", isl.colors.accent);
  campHudPlace();
  campHudUpdate();
}

function campHudHide() {
  if (campHudEl) campHudEl.hidden = true;
}

/* Puts the rails beside the board, or above and below it when the sides are too narrow */
function campHudPlace() {
  if (!campHudEl || campHudEl.hidden) return;
  const r = stageEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const gap = Math.max(10, Math.min(24, vw * 0.012));
  const side = Math.min(r.left, vw - r.right) - gap * 2;
  const L = campHudEl.querySelector(".ch-left"), Rr = campHudEl.querySelector(".ch-right");
  if (side >= 150) {
    const w = Math.min(320, side);
    campHudEl.className = "ch-wide";
    Object.assign(L.style, { left: (r.left - gap - w) + "px", top: r.top + "px", width: w + "px", height: r.height + "px", right: "", bottom: "" });
    Object.assign(Rr.style, { left: (r.right + gap) + "px", top: r.top + "px", width: w + "px", height: r.height + "px", right: "", bottom: "" });
  } else {
    campHudEl.className = "ch-tall";
    const above = Math.max(0, r.top - gap), below = Math.max(0, vh - r.bottom - gap);
    Object.assign(L.style, { left: "8px", width: (vw - 16) + "px", top: "4px", height: above + "px", right: "", bottom: "" });
    Object.assign(Rr.style, { left: "8px", width: (vw - 16) + "px", top: (r.bottom + gap) + "px", height: below + "px", right: "", bottom: "" });
  }
}

function heartRow(n, max, cls = "") {
  const svg = c => `<svg class="heart ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_SVG_PATH}"/></svg>`;
  const full = Math.floor(n + 1e-9), half = n - full > 0.25;
  let h = "";
  for (let i = 0; i < full; i++) h += svg("full " + cls);
  if (half) h += svg("half");
  for (let i = full + (half ? 1 : 0); i < max; i++) h += svg("empty");
  return h;
}

function campHudTick(ts) {
  if (ts - campHudAt < 100) return;
  campHudAt = ts;
  campHudUpdate();
}

function campHudUpdate() {
  if (!campHudEl || campHudEl.hidden || !campRun) return;
  const $ = s => campHudEl.querySelector(s);
  const ts = gameState === "PLAYING" ? (paused ? pauseStartedAt : performance.now()) : frozenAt;
  // goal
  const gp = goalProgress();
  $(".ch-goal .ch-bar span").style.width = (gp.f * 100).toFixed(1) + "%";
  $(".ch-goal .ch-bar").hidden = campGoal.type === "relic";
  $(".ch-goal-n").textContent = gp.text;
  $(".ch-score-n").textContent = fmtInt(score);
  // hearts and armor
  const maxH = Math.max(campRun.startHearts || 1, Math.ceil(currentHearts));
  $(".ch-hearts").innerHTML = heartRow(currentHearts, maxH);
  $(".ch-armor").innerHTML = currentArmor > 0 ? Array.from({ length: currentArmor }, () => `<svg class="heart armor" viewBox="0 0 24 24"><path d="${ARMOR_SVG_PATH}"/></svg>`).join("") : "";
  // time, distance, the clock
  const extra = [];
  if (campGoal.type === "survive" || campRun.mods.includes("clock")) extra.push(`<div class="ch-k">Time</div><div class="ch-big">${Math.floor(runMs / 1000)}s${campRun.mods.includes("clock") ? ` <small>/ 90s</small>` : ""}</div>`);
  if (endless) extra.push(`<div class="ch-k">Distance</div><div class="ch-big">${fmtInt(endlessDistance())} m</div>`);
  if (campRun.mods.length) extra.push(`<div class="ch-k">Challenge</div><div class="ch-mods">${campRun.mods.map(m => `<span>${(CAMP.rules.challenge.mods.find(x => x.id === m) || { name: m }).name}</span>`).join("")}</div>`);
  $(".ch-extra").innerHTML = extra.join("");
  $(".ch-extra").hidden = !extra.length;
  // the boss
  if (boss) {
    $(".ch-boss").hidden = false;
    $(".ch-boss-name").textContent = boss.def.name;
    const svg = c => `<svg class="heart ${c}" viewBox="0 0 24 24"><path d="${HEART_SVG_PATH}"/></svg>`;
    let h = "";
    for (let i = 0; i < boss.maxHearts; i++) {
      if (boss.fight === 3) h += svg(i < boss.hearts ? "full" : "empty");
      else h += svg(i < boss.armor ? "silver" : i < boss.maxArmor ? "empty" : "full");
    }
    $(".ch-boss-hearts").innerHTML = h;
    const st = $(".ch-stam");
    st.querySelector("span").style.width = (Math.max(0, boss.stamina) * 100).toFixed(1) + "%";
    const tired = bossExhausted(ts), charging = bossCharging(ts);
    st.classList.toggle("tired", tired);
    st.classList.toggle("charge", charging);
    $(".ch-boss-state").textContent = boss.beaten ? "Beaten!" : tired ? "Exhausted: bite it!" : charging ? "Charging!" : ts < boss.frozenUntil ? "Frozen" : boss.fight === 1 ? "Keep away until it tires" : "Wear it down";
  }
  // loadout
  const kit = [];
  const row = (slot, it, sub, extraCls = "") => {
    const s = CAMP.slots.find(x => x.id === slot);
    if (!it) return `<div class="ch-slot empty"><span class="ci-icon"></span><div><div class="ch-k">${s.name}</div><div class="ch-sub">None</div></div></div>`;
    return `<div class="ch-slot ${extraCls}">${campItemIconHtml(it)}<div><div class="ch-k">${s.name}</div><div class="ch-name" style="color:${rarityColor(it.rarity)}">${campItemDef(it.id).name}</div><div class="ch-sub">${sub}</div></div></div>`;
  };
  const bare = campBare();
  const gear = bare ? null : campEquipped("gear");
  kit.push(row("gear", gear, gear ? pips(gear.uses, Math.max(gear.uses, freshUses(gear.id, gear.rarity))) : "", gear && ts - campRun.gearFx < 300 ? "flash" : ""));
  const spell = bare ? null : campEquipped("spell");
  const cd = spell ? Math.max(0, campRun.castReadyAt - ts) : 0;
  kit.push(row("spell", spell, spell ? `${pips(spell.uses, Math.max(spell.uses, freshUses(spell.id, spell.rarity)))} <kbd>${isTouchDevice() ? "Tap" : "Space"}</kbd>${cd > 0 ? " <span class='ch-cd'>…</span>" : ""}` : ""));
  const food = bare ? null : campEquipped("food");
  kit.push(row("food", food, food ? pips(food.uses, Math.max(food.uses, freshUses(food.id, food.rarity))) : ""));
  const pet = bare ? null : campEquipped("pet");
  let petSub = "";
  if (pet && campRun.pet) {
    if (pet.id === "turtle") petSub = campRun.pet.shells > 0 ? `Shell ready${campRun.pet.shells > 1 ? " ×" + campRun.pet.shells : ""}` : `Recovering ${Math.ceil(Math.max(0, campRun.pet.readyAt - ts) / 1000)}s`;
    else petSub = "With you";
  }
  kit.push(row("pet", pet, petSub));
  if (campRun.rune) kit.push(`<div class="ch-slot">${campItemIconHtml(campRun.rune)}<div><div class="ch-k">Rune</div><div class="ch-name" style="color:${rarityColor(campRun.rune.rarity)}">${campItemDef(campRun.rune.id).name}</div><div class="ch-sub">${campRun.echoUsed ? "Echo spent" : "Burning"}</div></div></div>`);
  $(".ch-kit").innerHTML = kit.join("");
  // effects
  const fx = [];
  const chip = (label, color, until) => { if (ts < until) fx.push(`<span class="ch-chip" style="--c:${color}">${label} ${Math.ceil((until - ts) / 1000)}</span>`); };
  chip("Force Field", "#7fe3ff", campRun.fieldUntil || 0);
  chip("Bubble", "#7fe3ff", buffs.shield ? buffs.shieldUntil || 0 : 0);
  chip("Rampage", "#ff77c8", buffs.starUntil || 0);
  chip("Phantom", "#b36bff", buffs.phantomUntil || 0);
  chip("Apple Call", "#ff5a61", buffs.lodeUntil || 0);
  chip("Frenzy 2x", "#3ddc84", buffs.frenzyUntil || 0);
  chip("Frozen", "#bfe8ff", buffs.freezeUntil || 0);
  chip("Zoom", "#ff8c1a", fx_fast());
  chip("Slow", "#c8862e", fx_slow());
  if (ts < graceUntil) fx.push(`<span class="ch-chip" style="--c:#ffd23f">Safe</span>`);
  $(".ch-fx").innerHTML = fx.length ? `<div class="ch-k">Effects</div>${fx.join("")}` : "";
  $(".ch-fx").hidden = !fx.length;
  // pointer
  const tgt = ["keys", "buttons", "relic", "shards", "thief"].includes(campGoal.type) ? goalTarget() : null;
  $(".ch-point").hidden = !tgt;
  if (tgt) {
    const ang = Math.atan2(tgt.dy, tgt.dx) * 180 / Math.PI + 90;
    $(".ch-arrow svg").style.transform = `rotate(${ang.toFixed(0)}deg)`;
    $(".ch-dist").textContent = `${tgt.dist} squares`;
  }
  $(".ch-loot").hidden = !campRun.loot.length;
  $(".ch-loot").innerHTML = campRun.loot.length ? `<div class="ch-k">Found</div>${campRun.loot.map(id => `<span class="ci-icon small" style="--rc:#8a8070"><img src="${campIconUrl(id, 32)}" alt=""></span>`).join("")}` : "";
}
const fx_fast = () => fx.fastUntil || 0;
const fx_slow = () => fx.slowUntil || 0;

function pips(have, max) {
  if (max > 8) return `${have} / ${max}`;
  let s = "<span class='ch-pips'>";
  for (let i = 0; i < max; i++) s += `<i class="${i < have ? "on" : ""}"></i>`;
  return s + "</span>";
}
