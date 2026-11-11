/* =========================================================
   src/game/sandbox/level-code.js
   Sandbox levels as objects and share codes: a new level, its cleanup,
   and the SNK3- codes. Loaded early (before the save), because the save
   keeps your sandbox levels as codes and reads them back on boot.
   Uses only sandbox-tools.js, level-file.js and the content.
   ========================================================= */
"use strict";

/* The boost items a level can start with (items.js's CONSUMABLES, which loads later) */
const sbBoostIds = () => CONTENT.items.filter(it => it.boost).map(it => it.id);

const blankGrid = () => ".".repeat(SB_SIZE * SB_SIZE);
function newLevel(name = "My level") {
  const g = blankGrid().split("");
  g[10 * SB_SIZE + 5] = "S";
  g[10 * SB_SIZE + 14] = "A";
  return { v: 2, n: name, e: "w", s: 7, g: g.join(""), pv: {}, ph: {}, r: defaultRules(), k: "", th: "", vn: 0, it: [], off: [], sc: {} };
}
/* k: skin id ("" = yours), th: backdrop id ("" = yours), vn: disappearing red walls (seconds, 0 = off),
   it: boost items the run starts with, off: hazards switched off, sc: enemy spawner chips { type: [[x, y], ...] },
   b: a boss to fight ("" none; build 52), bf: which of its three fights (1-3) */
function normalizeLevel(l) {
  const out = Object.assign({ v: 2, e: "w", s: 7, pv: {}, ph: {}, k: "", th: "", vn: 0, it: [], off: [], sc: {}, b: "", bf: 3 }, l, { r: Object.assign(defaultRules(), l.r || {}) });
  out.bf = [1, 2, 3].includes(out.bf) ? out.bf : 3;
  // build 53: the kit it's played in ({ slot: { id, r } }, camp-sandbox.js); empty = the old sandbox, no kit
  out.kit = typeof sbKitClean === "function" ? sbKitClean(out.kit) : (out.kit && typeof out.kit === "object" ? out.kit : {});
  delete out.r.sp;   // spawners are chips now (sc)
  return out;
}

/* Enemy types listed in a spawn list -> one chip each, on the top edge */
function chipsFor(types) {
  const sc = {};
  types.map(String).forEach(t => { if (SB_SPAWNS.some(([id]) => id === t)) sc[t] = [...(sc[t] || []), [0, 0]]; });
  return sc;
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
  const json = JSON.stringify({ v: 3, n: L.n, e: L.e, s: L.s, g: rle(L.g), pv: panelStr(L.pv), ph: panelStr(L.ph), r: L.r, k: L.k, th: L.th, vn: L.vn, it: L.it, off: L.off, sc: L.sc, b: L.b || undefined, bf: L.b ? L.bf : undefined, kit: Object.keys(L.kit || {}).length ? L.kit : undefined });
  return "SNK3-" + btoa(unescape(encodeURIComponent(json)));
}
/* Pasted text: a .level file, or a share code (SNK1- / SNK2- / SNK3-) */
function parseLevelText(text) {
  const raw = String(text).trim();
  if (/^SNK\d-/.test(raw)) return parseLevelCode(raw);
  const L = parseLevelFile(raw);
  if (!L) return null;
  return normalizeLevel(L);
}
function parseLevelCode(code) {
  try {
    const raw = String(code).trim();
    const m = /^SNK([123])-(.+)$/.exec(raw);
    if (!m) return null;
    const o = JSON.parse(decodeURIComponent(escape(atob(m[2]))));
    const g = unrle(String(o.g || ""));
    if (g.length !== SB_SIZE * SB_SIZE || /[^.#PSAaXxRrOoFfHhMm@*%&!^~]/.test(g)) return null;
    const r = o.r || {};
    const sc = {};
    Object.entries(o.sc || {}).forEach(([t, chips]) => {
      if (SB_SPAWNS.some(([id]) => id === t)) sc[t] = (Array.isArray(chips) ? chips : []).filter(c => Array.isArray(c) && c.length === 2).map(([x, y]) => [Math.min(SB_SIZE - 1, Math.max(0, x | 0)), Math.min(SB_SIZE - 1, Math.max(0, y | 0))]);
    });
    return normalizeLevel({
      k: String(o.k || ""), th: String(o.th || ""), vn: Math.max(0, Math.min(30, Math.round(Number(o.vn)) || 0)),
      it: (Array.isArray(o.it) ? o.it : []).filter(x => sbBoostIds().includes(x)).map(String),
      off: (Array.isArray(o.off) ? o.off : []).filter(x => SB_HAZARDS.includes(x)).map(String),
      sc: Object.keys(sc).length ? sc : chipsFor(Array.isArray(r.sp) ? r.sp : []),
      b: /^[a-z]{1,24}$/.test(String(o.b || "")) ? String(o.b) : "", bf: [1, 2, 3].includes(o.bf) ? o.bf : 3,
      kit: o.kit && typeof o.kit === "object" ? o.kit : {},     // cleaned by normalizeLevel
      n: String(o.n || "Shared level").slice(0, 24),
      e: ["w", "a", "m"].includes(o.e) ? o.e : "w",
      s: [5, 7, 10].includes(o.s) ? o.s : 7,
      g,
      pv: panelParse(o.pv),
      ph: panelParse(o.ph),
      r: {
        h: Math.max(0, Math.min(5, Math.round(Number(r.h ?? 3)))),
        ar: r.ar !== false,
        t: (Array.isArray(r.t) ? r.t : []).filter(x => SB_TWISTS.some(t => t[0] === x))
      }
    });
  } catch (e) {
    return null;
  }
}
