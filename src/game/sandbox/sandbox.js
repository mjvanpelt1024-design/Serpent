/* =========================================================
   src/game/sandbox/sandbox.js
   The sandbox: community levels, level codes, the editor and playing
   ========================================================= */
"use strict";

/* Starter levels live in the Community tab: content/worlds/community/*.level */
function starterLevels() {
  const panels = list => Object.fromEntries((list || []).map(p => {
    const [at, kind] = String(p).split(":");
    return [at.replace("/", ","), kind === "p" ? "p" : "r"];
  }));
  return CONTENT.communityLevels.map(l => {
    const rows = (l.rows || []).slice(0, SB_SIZE).map(r => r.padEnd(SB_SIZE, ".").slice(0, SB_SIZE));
    while (rows.length < SB_SIZE) rows.push(".".repeat(SB_SIZE));
    return normalizeLevel({
      n: String(l.name || l.id), e: ({ wrap: "w", walls: "a", wall: "a", mirror: "m" })[l.edge] || "w", s: l.speed || 7, g: rows.join(""), builtin: true,
      pv: panels(l.panelsV), ph: panels(l.panelsH),
      r: { h: l.hearts ?? 3, ar: l.respawnApples !== false, t: (l.twists || []).map(String), sp: (l.spawns || []).map(String) }
    });
  });
}

/* ----- Level codes ----- */
function rle(g) {
  let out = "";
  for (let i = 0; i < g.length;) {
    let j = i;
    while (j < g.length && g[j] === g[i] && j - i < 99) j++;
    out += (j - i > 1 ? (j - i) : "") + g[i];
    i = j;
  }
  return out;
}
function unrle(s) {
  let out = "";
  const re = /(\d*)([^\d])/g;
  let m;
  while ((m = re.exec(s))) out += m[2].repeat(m[1] ? Number(m[1]) : 1);
  return out;
}
function panelStr(o) { return Object.entries(o || {}).map(([k, v]) => k + v).join(";"); }
function panelParse(s) {
  const o = {};
  String(s || "").split(";").forEach(t => { const m = /^(\d{1,2}),(\d{1,2})([rp])$/.exec(t); if (m && +m[1] <= SB_SIZE && +m[2] <= SB_SIZE) o[`${m[1]},${m[2]}`] = m[3]; });
  return o;
}
function levelCode(level) {
  const L = normalizeLevel(level);
  const json = JSON.stringify({ v: 2, n: L.n, e: L.e, s: L.s, g: rle(L.g), pv: panelStr(L.pv), ph: panelStr(L.ph), r: L.r });
  return "SNK2-" + btoa(unescape(encodeURIComponent(json)));
}
function parseLevelCode(code) {
  try {
    const raw = String(code).trim();
    const m = /^SNK([12])-(.+)$/.exec(raw);
    if (!m) return null;
    const o = JSON.parse(decodeURIComponent(escape(atob(m[2]))));
    const g = unrle(String(o.g || ""));
    if (g.length !== SB_SIZE * SB_SIZE || /[^.#PSAaXxRrOoFfHhMm@*%&!^~]/.test(g)) return null;
    const r = o.r || {};
    return normalizeLevel({
      n: String(o.n || "Shared level").slice(0, 24),
      e: ["w", "a", "m"].includes(o.e) ? o.e : "w",
      s: [5, 7, 10].includes(o.s) ? o.s : 7,
      g,
      pv: panelParse(o.pv),
      ph: panelParse(o.ph),
      r: {
        h: Math.max(0, Math.min(5, Math.round(Number(r.h ?? 3)))),
        ar: r.ar !== false,
        t: (Array.isArray(r.t) ? r.t : []).filter(x => SB_TWISTS.some(t => t[0] === x)),
        sp: (Array.isArray(r.sp) ? r.sp : []).filter(x => SB_SPAWNS.some(t => t[0] === x))
      }
    });
  } catch (e) {
    return null;
  }
}

/* ----- The sandbox home: My Levels and Community ----- */
function openShelf(tab) {
  if (tab) sbShelfTab = tab;
  openScreen("shelf");
}

function uniqueName(list, base) {
  let name = base.slice(0, 24);
  let n = 2;
  while (list.some(l => l.n === name)) name = `${base.slice(0, 19)} (${n++})`;
  return name;
}

function renderShelf() {
  document.querySelectorAll("#screen-shelf .tab[data-shelf]").forEach(t => t.setAttribute("aria-selected", String(t.dataset.shelf === sbShelfTab)));
  document.getElementById("shelf-import").hidden = sbShelfTab !== "community";
  document.getElementById("shelf-new").hidden = sbShelfTab !== "mine";
  const body = document.getElementById("shelf-body");
  body.innerHTML = "";
  const list = sbShelfTab === "mine" ? save.levels : [...starterLevels(), ...save.community];
  if (!list.length) {
    body.innerHTML = `<div class="soon"><strong>No levels yet</strong>Tap New level to build one, or edit something from the Community tab.</div>`;
    return;
  }
  list.forEach((level, i) => {
    const row = document.createElement("div");
    row.className = "shop-row";
    const prev = document.createElement("canvas");
    prev.width = 60; prev.height = 60;
    prev.className = "shelf-thumb";
    drawLevelThumb(prev.getContext("2d"), level, 3);
    const info = document.createElement("div");
    const tag = level.builtin ? "Starter" : sbShelfTab === "mine" ? "Yours" : "Added";
    info.innerHTML = `<div class="shop-name">${escapeAttr(level.n)}</div><div class="shop-desc">${tag} · ${SB_EDGES.find(e => e[0] === level.e)[1]} · ${SB_SPEEDS.find(s => s[0] === level.s)[1]}${level.r.t.length ? " · " + level.r.t.length + " twist" + (level.r.t.length > 1 ? "s" : "") : ""}</div>`;
    const btns = document.createElement("div");
    btns.className = "shelf-btns";
    const mk = (label, key, fn) => { const b = document.createElement("button"); b.className = "btn btn-small"; b.textContent = label; b.dataset.key = key; b.addEventListener("click", fn); btns.appendChild(b); };
    const key = sbShelfTab + "-" + i;
    mk("Play", `shelf-play-${key}`, () => playCustom(level, false));
    mk("Edit", `shelf-edit-${key}`, () => {
      if (sbShelfTab === "mine") { openSandbox(level, level); return; }
      // Community levels never change: editing makes your own copy
      if (save.levels.length >= 30) { showToast("My Levels is full (30). Delete one first."); return; }
      const copy = normalizeLevel(JSON.parse(JSON.stringify(level)));
      delete copy.builtin;
      copy.n = uniqueName(save.levels, level.n + " copy");
      save.levels.push(copy);
      persist();
      showToast(`Copied to My Levels as "${copy.n}".`);
      openSandbox(copy, copy);
    });
    mk("Code", `shelf-code-${key}`, () => copyCode(level));
    if (!level.builtin) mk("Delete", `shelf-del-${key}`, () => {
      openConfirm({ title: `Delete "${level.n}"?`, text: "This can't be undone. Copy its code first if you might want it back.", ok: "Delete", onOk: () => {
        if (sbShelfTab === "mine") save.levels = save.levels.filter(l => l !== level);
        else save.community = save.community.filter(l => l !== level);
        persist(); renderShelf();
      } });
    });
    row.append(prev, info, btns);
    body.appendChild(row);
  });
}

function importCode() {
  const box = document.getElementById("shelf-code");
  const level = parseLevelCode(box.value);
  if (!level) { showToast("That doesn't look like a level code. They start with SNK2- (or SNK1-)."); sfx("bad"); return; }
  if (save.community.length >= 50) { showToast("Community is full (50). Delete one first."); return; }
  level.n = uniqueName(save.community, level.n);
  save.community.push(level);
  persist();
  box.value = "";
  sfx("unlock");
  showToast(`Added "${level.n}" to Community.`);
  renderShelf();
}

function copyCode(level) {
  const code = levelCode(level);
  const done = () => showToast("Level code copied. Paste it anywhere to share.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => promptCode(code));
  else promptCode(code);
  return code;
}
function promptCode(code) {
  sbShelfTab = "community";
  renderShelf();
  const box = document.getElementById("shelf-code");
  box.value = code;
  box.select();
  showToast("Copy the code from the box.");
}

/* ----- Editor ----- */
let sbEditing = null;   // the saved level object being edited (null for a brand-new one)
function openSandbox(level, original = null) {
  sbLevel = normalizeLevel(JSON.parse(JSON.stringify(level || newLevel(uniqueName(save.levels, "My level")))));
  delete sbLevel.builtin;
  sbEditing = original;
  openScreen("sandbox");
}

function currentToolChar() {
  const cat = SB_CATS.find(c => c.id === sbCat);
  if (cat.sized) return SB_ITEMS[sbTool][SB_INDEX_OF_GRADE[sbSize]];
  return sbTool;
}

function renderSandbox() {
  document.getElementById("sb-name").value = sbLevel.n;
  const cats = document.getElementById("sb-cats");
  cats.innerHTML = SB_CATS.map(c => `<button class="subtab" role="tab" data-sbcat="${c.id}" aria-selected="${c.id === sbCat}">${c.label}</button>`).join("");
  cats.querySelectorAll("[data-sbcat]").forEach(b => b.addEventListener("click", () => {
    sbCat = b.dataset.sbcat;
    sbTool = SB_CATS.find(c => c.id === sbCat).tools[0].id;
    sfx("tab");
    renderSandbox();
  }));
  const cat = SB_CATS.find(c => c.id === sbCat);
  const pal = document.getElementById("sb-palette");
  pal.innerHTML = "";
  cat.tools.forEach(t => {
    const b = document.createElement("button");
    b.className = "sb-tool" + (t.id === sbTool ? " on" : "");
    b.dataset.key = "sb-tool-" + t.id;
    b.setAttribute("aria-pressed", String(t.id === sbTool));
    const c = document.createElement("canvas");
    c.width = 44; c.height = 44;
    const g = c.getContext("2d");
    if (t.panel) paintPanelIcon(g, t.panel);
    else paintSbCell(g, cat.sized ? SB_ITEMS[t.id][0] : t.id, 8, 8, 28, performance.now());
    b.append(c, Object.assign(document.createElement("span"), { textContent: t.label }));
    b.addEventListener("click", () => { sbTool = t.id; sfx("click"); renderSandbox(); });
    pal.appendChild(b);
  });
  const sizes = document.getElementById("sb-sizes");
  sizes.hidden = !cat.sized;
  sizes.innerHTML = ["Small", "Normal", "Large"].map((l, i) => `<button class="subtab" data-sbsize="${i}" aria-pressed="${i === sbSize}" aria-selected="${i === sbSize}">${l}</button>`).join("");
  sizes.querySelectorAll("[data-sbsize]").forEach(b => b.addEventListener("click", () => { sbSize = Number(b.dataset.sbsize); sfx("click"); renderSandbox(); }));
  const hint = document.getElementById("sb-hint");
  hint.textContent = cat.id === "walls" && sbTool.length === 2 ? "Tap the line between two squares to place a panel." : sbTool === "." ? "Tap a square to clear it, or a line to remove a panel." : cat.sized && sbSize === 2 ? "Large items fill 2 x 2 squares." : "";
  drawSandbox();
}

function paintPanelIcon(g, kind) {
  g.fillStyle = "#222";
  g.fillRect(6, 6, 32, 32);
  g.strokeStyle = "#444";
  g.strokeRect(6.5, 6.5, 15, 31); g.strokeRect(22.5, 6.5, 15, 31);
  g.fillStyle = kind === "r" ? "#ff4a55" : "#b36bff";
  g.fillRect(20, 4, 5, 36);
}

function paintSbCell(g, ch, x, y, u, ts) {
  if (ch === ".") {
    g.strokeStyle = "#999"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + u - 4, y + u - 4); g.moveTo(x + u - 4, y + 4); g.lineTo(x + 4, y + u - 4); g.stroke();
    return;
  }
  const item = SB_CHAR[ch];
  if (item) {
    drawItem(g, item.type, x, y, item.grade === 2 ? 2 : 1, item.grade === 0, 1, ts, u);
    return;
  }
  g.fillStyle = { "#": "#b8323a", P: "#8f4dff", S: "#3ddc3d" }[ch] || "#444";
  g.fillRect(x, y, u - 1, u - 1);
  if (ch === "S") {
    g.fillStyle = "#000";
    g.beginPath(); g.moveTo(x + u * 0.35, y + u * 0.25); g.lineTo(x + u * 0.75, y + u * 0.5); g.lineTo(x + u * 0.35, y + u * 0.75); g.fill();
  }
}

function drawPanels(g, level, u, ox = 0, oy = 0) {
  const w = Math.max(2, u * 0.22);
  [["pv", true], ["ph", false]].forEach(([k, vertical]) => Object.entries(level[k] || {}).forEach(([key, kind]) => {
    const [x, y] = key.split(",").map(Number);
    g.fillStyle = kind === "r" ? "#ff4a55" : "#b36bff";
    if (vertical) g.fillRect(ox + x * u - w / 2, oy + y * u, w, u);
    else g.fillRect(ox + x * u, oy + y * u - w / 2, u, w);
  }));
}

function drawLevelThumb(g, level, u) {
  g.fillStyle = currentBackdrop().base;
  g.fillRect(0, 0, u * SB_SIZE, u * SB_SIZE);
  for (let k = 0; k < level.g.length; k++) if (level.g[k] !== ".") paintSbCell(g, level.g[k], (k % SB_SIZE) * u, Math.floor(k / SB_SIZE) * u, u, 0);
  drawPanels(g, level, u);
}

const SB_PX = 15;
function drawSandbox() {
  const c = document.getElementById("sb-board");
  const g = c.getContext("2d");
  g.fillStyle = currentBackdrop().base;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(255, 255, 255, 0.07)";
  for (let i = 0; i <= SB_SIZE; i++) {
    g.beginPath(); g.moveTo(i * SB_PX + 0.5, 0); g.lineTo(i * SB_PX + 0.5, SB_SIZE * SB_PX); g.stroke();
    g.beginPath(); g.moveTo(0, i * SB_PX + 0.5); g.lineTo(SB_SIZE * SB_PX, i * SB_PX + 0.5); g.stroke();
  }
  const ts = performance.now();
  for (let i = 0; i < sbLevel.g.length; i++) {
    const ch = sbLevel.g[i];
    if (ch !== ".") paintSbCell(g, ch, (i % SB_SIZE) * SB_PX, Math.floor(i / SB_SIZE) * SB_PX, SB_PX, ts);
  }
  drawPanels(g, sbLevel, SB_PX);
  if (blankWaiting()) drawRelic(g, BLANK_AT[0] * SB_PX - 3, BLANK_AT[1] * SB_PX - 3, ts, SB_PX + 6);
  c.style.borderColor = { w: "#3ddc3d", a: "#ff3b3b", m: "#b36bff" }[sbLevel.e];
}

const BLANK_AT = [17, 2];
function blankWaiting() {
  return save.unlockedNightmares.length === MODE_KEYS.length && !save.relics.includes("blank");
}

function sbPointFrom(e) {
  const c = document.getElementById("sb-board");
  const r = c.getBoundingClientRect();
  const fx = ((e.clientX - r.left) / r.width) * SB_SIZE;
  const fy = ((e.clientY - r.top) / r.height) * SB_SIZE;
  if (fx < -0.3 || fy < -0.3 || fx > SB_SIZE + 0.3 || fy > SB_SIZE + 0.3) return null;
  return [fx, fy];
}

/* The grid line nearest a point: v = the line left of square (x, y), h = the line above it */
function nearestEdge(fx, fy) {
  const dv = Math.abs(fx - Math.round(fx));
  const dh = Math.abs(fy - Math.round(fy));
  if (dv <= dh) return { k: "pv", key: `${Math.round(fx)},${Math.min(SB_SIZE - 1, Math.max(0, Math.floor(fy)))}`, d: dv };
  return { k: "ph", key: `${Math.min(SB_SIZE - 1, Math.max(0, Math.floor(fx)))},${Math.round(fy)}`, d: dh };
}

/* Which large item (if any) covers a square */
function largeAt(g, x, y) {
  for (const [ax, ay] of [[x, y], [x - 1, y], [x, y - 1], [x - 1, y - 1]]) {
    if (ax < 0 || ay < 0) continue;
    const ch = g[ay * SB_SIZE + ax];
    if (SB_CHAR[ch] && SB_CHAR[ch].grade === 2) return ay * SB_SIZE + ax;
  }
  return -1;
}

function sbPaint(fx, fy) {
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  if (blankWaiting() && x === BLANK_AT[0] && y === BLANK_AT[1]) { collectRelic({ relic: "blank" }); drawSandbox(); return; }
  const tool = SB_CATS.flatMap(c => c.tools).find(t => t.id === sbTool);
  if (tool && tool.panel) {
    const e = nearestEdge(fx, fy);
    if (sbLevel[e.k][e.key] === tool.panel) return;
    sbLevel[e.k][e.key] = tool.panel;
    sfx("tick");
    drawSandbox();
    return;
  }
  if (sbTool === ".") {
    const e = nearestEdge(fx, fy);
    if (e.d < 0.22 && sbLevel[e.k][e.key]) { delete sbLevel[e.k][e.key]; sfx("tick"); drawSandbox(); return; }
  }
  if (x < 0 || y < 0 || x >= SB_SIZE || y >= SB_SIZE) return;
  const g = sbLevel.g.split("");
  const ch = currentToolChar();
  const big = SB_CHAR[ch] && SB_CHAR[ch].grade === 2;
  if (big && (x >= SB_SIZE - 1 || y >= SB_SIZE - 1)) { showToast("Large items need 2 x 2 squares of room."); return; }
  const cells = big ? [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] : [[x, y]];
  cells.forEach(([cx, cy]) => { const at = largeAt(g, cx, cy); if (at >= 0) g[at] = "."; g[cy * SB_SIZE + cx] = "."; });
  if (ch === "S") for (let k = 0; k < g.length; k++) if (g[k] === "S") g[k] = ".";
  g[y * SB_SIZE + x] = ch;
  const next = g.join("");
  if (next === sbLevel.g) return;
  sbLevel.g = next;
  sfx("tick");
  drawSandbox();
}

function levelProblems(level) {
  const issues = [];
  const portals = (level.g.split("P").length - 1) + Object.values(level.pv).filter(v => v === "p").length + Object.values(level.ph).filter(v => v === "p").length;
  if (!level.g.includes("S")) issues.push("a snake start");
  if (!/[Aa@]/.test(level.g)) issues.push("at least one apple");
  if (portals === 1) issues.push("a second portal (portals need somewhere to go)");
  return issues;
}

function saveCurrentLevel() {
  sbLevel.n = (document.getElementById("sb-name").value.trim() || "My level").slice(0, 24);
  const copy = normalizeLevel(JSON.parse(JSON.stringify(sbLevel)));
  const i = sbEditing ? save.levels.indexOf(sbEditing) : -1;
  if (i >= 0) {
    if (save.levels.some((l, k) => k !== i && l.n === copy.n)) copy.n = uniqueName(save.levels.filter((l, k) => k !== i), copy.n);
    save.levels[i] = copy;
  } else {
    if (save.levels.length >= 30) { showToast("My Levels is full (30). Delete one first."); return; }
    copy.n = uniqueName(save.levels, copy.n);
    save.levels.push(copy);
  }
  sbEditing = copy;
  sbLevel.n = copy.n;
  document.getElementById("sb-name").value = copy.n;
  persist();
  sfx("buy");
  showToast(`Saved "${copy.n}" to My Levels.`);
}

/* ----- Rules panel ----- */
function openRules() {
  renderRules();
  document.getElementById("sb-rules").classList.add("active");
  document.getElementById("rules-done").focus({ preventScroll: true });
}
function closeRules() {
  document.getElementById("sb-rules").classList.remove("active");
  drawSandbox();
}
function renderRules() {
  const R = sbLevel.r;
  const box = document.getElementById("rules-list");
  const sw = (on, key, label, help) => `<div class="set-row"><div><div class="set-label">${label}</div>${help ? `<div class="set-help">${help}</div>` : ""}</div><button class="switch" role="switch" aria-checked="${on}" data-rule="${key}" aria-label="${label}"></button></div>`;
  box.innerHTML =
    `<div class="set-row"><div class="set-label">Edges</div><button class="btn btn-small" data-rule="edge">${SB_EDGES.find(e => e[0] === sbLevel.e)[1]}</button></div>` +
    `<div class="set-row"><div class="set-label">Speed</div><button class="btn btn-small" data-rule="speed">${SB_SPEEDS.find(s => s[0] === sbLevel.s)[1]}</button></div>` +
    `<div class="set-row"><div class="set-label">Hearts</div><div class="stepper"><button class="btn btn-small" data-rule="h-">-</button><span>${R.h}</span><button class="btn btn-small" data-rule="h+">+</button></div></div>` +
    sw(R.ar, "ar", "Apples respawn", "Off: once they're eaten, they're gone.") +
    `<h4 class="rules-head">Nightmare twists</h4>` +
    SB_TWISTS.map(([id, label, help]) => sw(R.t.includes(id), "t:" + id, label, help)).join("") +
    `<h4 class="rules-head">Random spawns</h4>` +
    SB_SPAWNS.map(([id, label]) => sw(R.sp.includes(id), "sp:" + id, label, "Keep appearing during the run")).join("");
  box.querySelectorAll("[data-rule]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.rule;
    if (k === "edge") sbLevel.e = SB_EDGES[(SB_EDGES.findIndex(e => e[0] === sbLevel.e) + 1) % 3][0];
    else if (k === "speed") sbLevel.s = SB_SPEEDS[(SB_SPEEDS.findIndex(s => s[0] === sbLevel.s) + 1) % 3][0];
    else if (k === "h-") R.h = Math.max(0, R.h - 1);
    else if (k === "h+") R.h = Math.min(5, R.h + 1);
    else if (k === "ar") R.ar = !R.ar;
    else {
      const [list, id] = k.split(":");
      const arr = R[list];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
    }
    sfx("toggle");
    renderRules();
    const again = box.querySelector(`[data-rule="${k}"]`);
    if (again) again.focus({ preventScroll: true });
  }));
}

/* ----- Playing a custom level: no XP, stats or badges, so the sandbox can't be farmed ----- */
function playCustom(level, fromEditor) {
  const L = normalizeLevel(level);
  const issues = levelProblems(L);
  if (issues.length) { showToast("This level needs " + issues.join(" and ") + "."); sfx("bad"); return; }
  customLevel = JSON.parse(JSON.stringify(L));
  sbReturn = fromEditor;
  modes.custom = { label: L.n, speed: L.s, edge: { w: "wrap", a: "wall", m: "mirror" }[L.e], multiplier: 1, startOrbs: 0, orbChance: 0, rules: "" };
  customBackup = JSON.stringify({ xp: save.xp, xpProgress: save.xpProgress, lifetimeScore: save.lifetimeScore, stats: save.stats, badges: save.badges });
  currentModeKey = "custom";
  currentNightmare = false;
  pendingBoosts = {};
  startGame();
}

let panels = new Map();   // wall panels on grid lines: "v:x,y" / "h:x,y" -> "red" | "purple"

function applyCustomLevel() {
  const L = customLevel;
  walls = new Map();
  panels = new Map();
  innerSegments = [];
  rocks = []; apples = []; orbs = []; hazards = [];
  let apples0 = 0;
  const now = performance.now();
  for (let i = 0; i < L.g.length; i++) {
    const ch = L.g[i];
    const x = (i % SB_SIZE) * cell;
    const y = Math.floor(i / SB_SIZE) * cell;
    const item = SB_CHAR[ch];
    if (item) {
      const it = { x, y, size: item.grade === 2 ? 2 : 1, small: item.grade === 0 };
      if (item.type === "apple") { apples.push(it); apples0++; }
      else if (item.type === "xp") orbs.push(it);
      else if (item.type === "rock") rocks.push(it);
      else if (item.type === "popsicle") popsicles.push(Object.assign(it, { isBonusApple: false, spawnAt: now, expiresAt: now + 1e12 }));
      else hazards.push(Object.assign(it, { type: item.type, spawnAt: now, expiresAt: now + 1e12 }));
    } else if (ch === "#") walls.set(cellKey(x, y), "red");
    else if (ch === "P") { walls.set(cellKey(x, y), "purple"); innerSegments.push({ kind: "purple", cells: [[x / cell, y / cell]] }); }
    else if (ch === "S") { snake.x = x; snake.y = y; }
  }
  Object.entries(L.pv).forEach(([k, v]) => panels.set("v:" + k, v === "r" ? "red" : "purple"));
  Object.entries(L.ph).forEach(([k, v]) => panels.set("h:" + k, v === "r" ? "red" : "purple"));
  snake.cells = [];
  snake.dx = cell;
  snake.dy = 0;
  targetApples = L.r.ar ? Math.max(1, apples0) : 0;
  // Rules: Nightmare twists and random spawns
  nm = { custom: true };
  L.r.t.forEach(t => { nm[t] = true; });
  spec = {};
  const SPAWN = { popsicle: { max: 4, delay: [2500, 6000], s: 25 }, flea: { max: 3, delay: [3500, 8000], s: 35 }, fire: { max: 3, delay: [3000, 7000], s: 30 }, molasses: { max: 3, delay: [4000, 9000], s: 30 } };
  L.r.sp.forEach(k => { spec[k] = SPAWN[k]; });
  hazardMode = !!spec.popsicle;
  maxPopsicle = spec.popsicle ? spec.popsicle.max : 0;
}

/* Crossing a wall panel: red ends the run, purple is a portal */
function panelCrossing(cx, cy, dx, dy) {
  const keys = [];
  if (dx > 0) { keys.push(`v:${cx + 1},${cy}`); if (cx + 1 >= SB_SIZE) keys.push(`v:0,${cy}`); }
  if (dx < 0) { keys.push(`v:${cx},${cy}`); if (cx <= 0) keys.push(`v:${SB_SIZE},${cy}`); }
  if (dy > 0) { keys.push(`h:${cx},${cy + 1}`); if (cy + 1 >= SB_SIZE) keys.push(`h:${cx},0`); }
  if (dy < 0) { keys.push(`h:${cx},${cy}`); if (cy <= 0) keys.push(`h:${cx},${SB_SIZE}`); }
  for (const k of keys) if (panels.has(k)) return { key: k, kind: panels.get(k) };
  return null;
}

function panelPortalExit(fromKey) {
  const others = [...panels.entries()].filter(([k, v]) => v === "purple" && k !== fromKey).map(([k]) => k).sort(() => Math.random() - 0.5);
  const body = new Set(snake.cells.map(c => cellKey(c.x, c.y)));
  const free = (x, y) => x >= 0 && y >= 0 && x < SB_SIZE && y < SB_SIZE && !walls.has(cellKey(x * cell, y * cell)) && !body.has(cellKey(x * cell, y * cell));
  for (const k of others) {
    const [t, rest] = k.split(":");
    const [x, y] = rest.split(",").map(Number);
    const sides = t === "v" ? [[x - 1, y, -1, 0], [x, y, 1, 0]] : [[x, y - 1, 0, -1], [x, y, 0, 1]];
    sides.sort((a, b) => (b[2] === Math.sign(snake.dx) && b[3] === Math.sign(snake.dy)) - (a[2] === Math.sign(snake.dx) && a[3] === Math.sign(snake.dy)));
    for (const [sx, sy, ddx, ddy] of sides) if (free(sx, sy)) return { x: sx * cell, y: sy * cell, dx: ddx * cell, dy: ddy * cell };
  }
  return null;
}

function drawGamePanels(view) {
  if (!panels.size) return;
  const w = Math.max(3, cell * 0.22);
  panels.forEach((kind, k) => {
    const [t, rest] = k.split(":");
    const [x, y] = rest.split(",").map(Number);
    const [sx, sy] = view.toScreen(x * cell, y * cell);
    ctx.save();
    ctx.fillStyle = kind === "red" ? "#ff4a55" : "#b36bff";
    if (kind === "purple") { ctx.shadowColor = "#b36bff"; ctx.shadowBlur = cell * 0.5; }
    if (t === "v") ctx.fillRect(sx - w / 2, sy, w, cell);
    else ctx.fillRect(sx, sy - w / 2, cell, w);
    ctx.restore();
  });
}

function restoreAfterCustom() {
  if (!customBackup) return;
  const b = JSON.parse(customBackup);
  save.xp = b.xp;
  save.xpProgress = b.xpProgress;
  save.lifetimeScore = b.lifetimeScore;
  save.stats = b.stats;
  save.badges = b.badges;
  customBackup = null;
  persist();
  updateHud();
}
