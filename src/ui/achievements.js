/* =========================================================
   src/ui/achievements.js
   The achievements screen and toasts
   ========================================================= */
"use strict";

/* =========================================================
   Achievements
   ========================================================= */
function shortNumber(n) {
  const units = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (n >= size) return (n / size).toLocaleString("en-US", { maximumFractionDigits: 1 }) + suffix;
  }
  return String(n);
}

function shortTime(ms) {
  const min = ms / 60000;
  return min >= 60 ? (min / 60).toLocaleString("en-US") + "h" : min + "m";
}

function badgeLabel(family, t) {
  return family.unit === "time" ? shortTime(t) : shortNumber(t);
}

function badgeDesc(family, t) {
  if (family.story) {
    const have = earnedSet();
    const k = family.tiers.filter(x => have.has(family.id + ":" + x)).length;
    return k ? `A new line appeared in your story book (${k} of ${family.tiers.length}).` : "...";
  }
  const n = family.unit === "time" ? fmtTime(t).replace(/ 00m| 00s/g, "") : fmtInt(t);
  return family.desc.replace("{n}", n);
}

function earnedSet() {
  return new Set(save.badges);
}

/* Awards any badges whose milestone has been reached.
   silent = true on load, so old progress is credited without a flood of toasts. */
function checkBadges(silent = false) {
  if (currentModeKey === "custom" && gameState === "PLAYING") return;   // sandbox levels don't earn badges
  if (save.cheats || !activeSlot) return;                               // a save that used the terminal earns none
  const have = earnedSet();
  const fresh = [];

  BADGE_FAMILIES.forEach(family => {
    const value = family.metric();
    family.tiers.forEach((t, i) => {
      const id = family.id + ":" + t;
      if (value >= t && !have.has(id)) {
        have.add(id);
        save.badges.push(id);
        fresh.push({ family, tier: i, paid: payBadge(family, i, silent) });
      }
    });
  });

  if (!fresh.length) return;
  persist();
  if (silent) return;

  fresh.forEach(({ family, tier, paid }) => {
    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
    const reward = paid && (paid.got || paid.bucks) ? ` · +${fmtInt(paid.got)} XP, +${fmtInt(paid.bucks)} SB` : "";
    queueToast(paid && paid.maxed
      ? `<span class="medal" style="background:${medalColor(family)}"></span>Path complete: ${family.name}! Medal earned${reward}`
      : `<span class="medal" style="background:${color}"></span>Badge earned: ${family.name} ${ROMAN[tier]}${reward}`);
  });
  sfx(fresh.some(f => f.paid && f.paid.maxed) ? "medal" : "badge");
  updateHud();
  if (currentScreen === "achievements") renderAchievements();
}

function renderAchievements() {
  const have = earnedSet();
  const earned = save.badges.length;
  achCountEl.textContent = `${fmtInt(earned)} / ${fmtInt(BADGE_TOTAL)} · ${earnedMedals().length} medals`;
  achBarEl.style.width = (earned / BADGE_TOTAL) * 100 + "%";
  achBarWrapEl.setAttribute("aria-valuenow", String(earned));
  achBarWrapEl.setAttribute("aria-valuemax", String(BADGE_TOTAL));

  renderAchSorter();
  if (achSort !== "default") {
    const list = BADGE_FAMILIES.slice();
    if (achSort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (achSort === "newest") list.sort((a, b) => familyNewest(b) - familyNewest(a));
    else list.sort((a, b) => (achSort === "most" ? 1 : -1) * (familyProgress(b, have) - familyProgress(a, have)));
    const label = ACH_SORTS.find(x => x[0] === achSort)[1];
    achBodyEl.innerHTML = `<div class="ach-group"><h3><span>${label}</span><span>${BADGE_FAMILIES.length} paths</span></h3>${list.map(f => achRowHtml(f, have)).join("")}</div>`;
    return;
  }
  const groups = ["general", ...MODE_KEYS];
  achBodyEl.innerHTML = groups.map(group => {
    const families = BADGE_FAMILIES.filter(f => f.group === group);
    if (!families.length) return "";
    const total = families.reduce((a, f) => a + f.tiers.length, 0);
    const got = families.reduce((a, f) => a + f.tiers.filter(t => have.has(f.id + ":" + t)).length, 0);
    const title = group === "general" ? "General" : modes[group].label;

    const rows = families.map(f => achRowHtml(f, have)).join("");

    return `<div class="ach-group" style="--m:${MEDAL_COLORS[group] || "#ffd23f"}"><h3><span>${title}</span><span>${got} / ${total}</span></h3>${rows}</div>`;
  }).join("");
}

function achRowHtml(f, have) {
      const value = f.metric();
      const next = f.tiers.find(t => !have.has(f.id + ":" + t));
      const done = next === undefined;
      const shown = f.unit === "time" ? fmtTime(value) : fmtInt(value);
      const goal = done ? "" : (f.unit === "time" ? fmtTime(next) : fmtInt(next));
      const pct = done ? 100 : Math.min(100, (value / next) * 100);

      const chips = f.tiers.map((t, i) => {
        const got = have.has(f.id + ":" + t);
        const style = got ? ` style="background:${TIER_COLORS[Math.min(i, TIER_COLORS.length - 1)]}"` : "";
        return `<span class="chip${got ? " earned" : ""}"${style} title="${badgeDesc(f, t)}">${badgeLabel(f, t)}</span>`;
      }).join("");

      return `<div class="ach-row">` +
        `<div class="ach-top"><span class="ach-name">${f.name}${done ? `<span class="medal" style="--m:${medalColor(f)}" title="${f.name} medal earned" role="img" aria-label="Medal earned"></span>` : ""}</span>` +
        `<span class="ach-prog">${done ? "Complete" : `${shown} / ${goal}`}</span></div>` +
        `<div class="ach-desc">${done ? badgeDesc(f, f.tiers[f.tiers.length - 1]) : badgeDesc(f, next)}</div>` +
        (done ? "" : achRewardHtml(f, f.tiers.indexOf(next))) +
        `<div class="progress"><span style="width:${pct}%"></span></div>` +
        `<div class="ach-chips">${chips}</div>` +
        `</div>`;
}

/* What the next badge on a path pays: Snakebucks and XP (src/game/economy/ladder.js) */
function achRewardHtml(f, i) {
  const last = i === f.tiers.length - 1;
  const pay = badgePay(i, last);
  return `<div class="ach-reward">Reward: ${fmtInt(pay.xp)} XP and ${fmtInt(pay.bucks)} SB${last ? " + medal" : ""}</div>`;
}

/* Small pop-up at the top of the board, one message at a time */
const toastQueue = [];
let toastBusy = false;

/* kind: badge (gold), narrator (purple), snake (green) */
function queueToast(html, kind = "badge") {
  toastQueue.push({ html, kind });
  if (!toastBusy) nextToast();
}

function showToast(text, kind = "badge") {
  const span = document.createElement("span");
  span.textContent = text;
  queueToast(span.innerHTML, kind);
}

function nextToast() {
  const item = toastQueue.shift();
  if (item === undefined) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  const speech = item.kind === "narrator" || item.kind === "snake";
  toastEl.className = "t-" + item.kind;
  toastEl.innerHTML = speech ? `<span class="t-who">${item.kind === "snake" ? escapeAttr(snakeName()) : "Narrator"}</span>${item.html}` : item.html;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(nextToast, 250);
  }, speech ? 3800 : 2200);
}
