/* =========================================================
   src/ui/mod-overlay.js
   The stats overlay a cosmetic mod can switch on with an overlay.txt
   (docs/MODDING.md; mods/cosmetic/dev-stats is the one that comes
   with the game). Mods never run code: this file is the game's own,
   and the mod picks the panels, the corner, the size and the colors.

   F3 (or the mod's toggleKey) shows and hides it, Shift+F3 steps its
   size, Ctrl+F3 moves it to the next corner. It never takes a click.
   Every reading is guarded: one that can't be read shows a dash.
   ========================================================= */
"use strict";

const MOD_OVERLAY = (() => {
  const O = (typeof CONTENT !== "undefined" && CONTENT.cosmetics && CONTENT.cosmetics.overlay) || null;
  if (!O) return null;
  const color = (k, d) => (/^#[0-9a-f]{3,8}$/i.test(String(O[k] || "")) ? String(O[k]) : d);
  const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"];
  const SIZES = [1, 1.25, 1.5];
  const ALL = ["frame", "game", "campaign", "save", "mods", "content", "screen", "gpu", "system", "memory", "audio", "input", "storage", "network", "power", "page", "warnings"];
  const cfg = {
    corner: CORNERS.includes(O.corner) ? O.corner : "top-left",
    size: Math.max(0.6, Math.min(2.5, Number(O.size) || 1)),
    opacity: Math.max(0.3, Math.min(1, Number(O.opacity) || 0.9)),
    every: Math.max(100, Math.min(5000, Number(O.every) || 250)),
    graph: O.graph !== false,
    shown: O.shown !== false,
    key: String(O.toggleKey || "F3"),
    accent: color("accent", "#3ddc84"), warn: color("warn", "#ffd23f"), bad: color("bad", "#ff5a4a"),
    panels: (Array.isArray(O.panels) ? O.panels.map(String) : ALL).filter(p => ALL.includes(p))
  };

  /* ----- Safe reading ----- */
  const DASH = "—";
  const get = fn => { try { const v = fn(); return v === undefined || v === null || Number.isNaN(v) ? DASH : v; } catch (e) { return DASH; } };
  // the game's own top-level names, each read only if this build has it
  const READ = {
    RS: () => (typeof RS !== "undefined" ? RS : undefined), WORLD: () => (typeof WORLD !== "undefined" ? WORLD : undefined),
    audioCtx: () => (typeof audioCtx !== "undefined" ? audioCtx : undefined), boss: () => (typeof boss !== "undefined" ? boss : undefined),
    camp: () => (typeof camp !== "undefined" ? camp : undefined), campObjs: () => (typeof campObjs !== "undefined" ? campObjs : undefined),
    campRun: () => (typeof campRun !== "undefined" ? campRun : undefined), canvas: () => (typeof canvas !== "undefined" ? canvas : undefined),
    currentHearts: () => (typeof currentHearts !== "undefined" ? currentHearts : undefined),
    currentModeKey: () => (typeof currentModeKey !== "undefined" ? currentModeKey : undefined),
    currentScreen: () => (typeof currentScreen !== "undefined" ? currentScreen : undefined),
    gameState: () => (typeof gameState !== "undefined" ? gameState : undefined), grid: () => (typeof grid !== "undefined" ? grid : undefined),
    moveInterval: () => (typeof moveInterval !== "undefined" ? moveInterval : undefined), music: () => (typeof music !== "undefined" ? music : undefined),
    orbs: () => (typeof orbs !== "undefined" ? orbs : undefined), paused: () => (typeof paused !== "undefined" ? paused : undefined),
    popsicles: () => (typeof popsicles !== "undefined" ? popsicles : undefined), runMs: () => (typeof runMs !== "undefined" ? runMs : undefined),
    save: () => (typeof save !== "undefined" ? save : undefined), score: () => (typeof score !== "undefined" ? score : undefined),
    snake: () => (typeof snake !== "undefined" ? snake : undefined), turnQueue: () => (typeof turnQueue !== "undefined" ? turnQueue : undefined),
    worldDirty: () => (typeof worldDirty !== "undefined" ? worldDirty : undefined)
  };
  const G = name => { try { return READ[name] ? READ[name]() : undefined; } catch (e) { return undefined; } };
  const n0 = v => (typeof v === "number" ? Math.round(v).toLocaleString() : v);
  const n1 = v => (typeof v === "number" ? v.toFixed(1) : v);
  const n2 = v => (typeof v === "number" ? v.toFixed(2) : v);
  const bytes = b => (typeof b !== "number" ? b : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : b < 1073741824 ? (b / 1048576).toFixed(1) + " MB" : (b / 1073741824).toFixed(2) + " GB");
  const dur = ms => { if (typeof ms !== "number") return ms; const s = Math.floor(ms / 1000); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : Math.floor(s / 3600) + "h " + Math.floor(s / 60) % 60 + "m"; };
  const ago = t => (typeof t === "number" && t ? dur(Date.now() - t) + " ago" : DASH);
  const yes = v => (v === DASH ? v : v ? "yes" : "no");
  const media = q => window.matchMedia(q).matches;

  /* ----- Frames: every one is timed, whether or not the overlay is shown ----- */
  const FR = { times: new Float32Array(600), i: 0, count: 0, last: performance.now(), total: 0, slow: 0, hitch: 0, longTasks: 0, longMs: 0 };
  function frame(now) {
    const dt = now - FR.last;
    FR.last = now;
    if (dt > 0 && dt < 2000) {
      FR.times[FR.i] = dt; FR.i = (FR.i + 1) % FR.times.length; FR.count = Math.min(FR.count + 1, FR.times.length);
      FR.total++;
      if (dt > 33.4) FR.slow++;
      if (dt > 100) FR.hitch++;
    }
    if (shown && cfg.graph) drawGraph();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  try {
    new PerformanceObserver(list => list.getEntries().forEach(e => { FR.longTasks++; FR.longMs += e.duration; })).observe({ type: "longtask", buffered: true });
  } catch (e) { /* not in this browser */ }
  function frameStats() {
    const n = FR.count;
    if (!n) return null;
    const arr = [];
    for (let k = 0; k < n; k++) arr.push(FR.times[(FR.i - 1 - k + FR.times.length) % FR.times.length]);
    const recent = arr.slice(0, 120);
    let sum = 0, oneSec = 0, frames = 0;
    for (const t of arr) { if (oneSec >= 1000) break; oneSec += t; frames++; }
    recent.forEach(t => { sum += t; });
    const sorted = arr.slice().sort((a, b) => b - a);
    const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const median = arr.slice().sort((a, b) => a - b)[Math.floor(n / 2)];
    const avg = sum / recent.length;
    const jitter = Math.sqrt(recent.reduce((s, t) => s + (t - avg) * (t - avg), 0) / recent.length);
    return { fps: frames * 1000 / Math.max(1, oneSec), avg, min: Math.min(...recent), max: Math.max(...recent), low1: 1000 / pct(0.01), low01: 1000 / pct(0.001), median, hz: 1000 / median, jitter };
  }

  /* ----- Input, warnings and things that are read now and then ----- */
  const IN = { key: DASH, keyAt: 0, keys: new Set(), presses: 0, x: DASH, y: DASH, buttons: 0, clicks: 0, wheel: 0, lastAt: 0, type: DASH };
  window.addEventListener("keydown", e => { IN.key = e.code || e.key; IN.keyAt = Date.now(); IN.keys.add(e.code); IN.presses++; IN.lastAt = Date.now(); IN.type = "keyboard"; }, true);
  window.addEventListener("keyup", e => IN.keys.delete(e.code), true);
  window.addEventListener("blur", () => IN.keys.clear());
  window.addEventListener("pointermove", e => { IN.x = e.clientX; IN.y = e.clientY; IN.buttons = e.buttons; IN.lastAt = Date.now(); IN.type = e.pointerType || "mouse"; }, { capture: true, passive: true });
  window.addEventListener("pointerdown", e => { IN.clicks++; IN.buttons = e.buttons; IN.type = e.pointerType || "mouse"; }, { capture: true, passive: true });
  window.addEventListener("pointerup", e => { IN.buttons = e.buttons; }, { capture: true, passive: true });
  window.addEventListener("wheel", () => { IN.wheel++; }, { capture: true, passive: true });

  const WARN = [];
  const note = (kind, text) => { WARN.push({ kind, text: String(text).slice(0, 140), at: Date.now() }); if (WARN.length > 6) WARN.shift(); };
  ["warn", "error"].forEach(kind => {
    const orig = console[kind];
    console[kind] = function () { note(kind, Array.from(arguments).map(a => (a && a.message) || (typeof a === "object" ? (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })() : String(a))).join(" ")); return orig.apply(this, arguments); };
  });
  window.addEventListener("error", e => note("error", e.message || "error"));
  window.addEventListener("unhandledrejection", e => note("error", "promise: " + ((e.reason && e.reason.message) || e.reason)));

  const SLOW = { storage: null, persisted: DASH, battery: null, saveSize: DASH, saveAt: 0, local: DASH };
  function readSlow() {
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(s => { SLOW.storage = s; }).catch(() => {});
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { SLOW.persisted = p; }).catch(() => {});
    if (navigator.getBattery && !SLOW.battery) navigator.getBattery().then(b => { SLOW.battery = b; }).catch(() => {});
    SLOW.saveSize = get(() => (typeof store !== "undefined" && store.snapshot ? JSON.stringify(store.snapshot()).length : DASH));
    SLOW.local = get(() => { let n = 0, c = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n++; c += k.length + (localStorage.getItem(k) || "").length; } return n + " keys, " + bytes(c * 2); });
  }

  const GPU = (() => {
    const out = { renderer: DASH, vendor: DASH, version: DASH, glsl: DASH, maxTex: DASH, maxView: DASH, maxRb: DASH, aniso: DASH, webgl2: DASH, exts: DASH, msaa: DASH };
    try {
      const c = document.createElement("canvas");
      const gl2 = c.getContext("webgl2");
      out.webgl2 = !!gl2;
      const gl = gl2 || c.getContext("webgl");
      if (!gl) return out;
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      out.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      out.vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      out.version = gl.getParameter(gl.VERSION);
      out.glsl = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
      out.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const v = gl.getParameter(gl.MAX_VIEWPORT_DIMS); out.maxView = v[0] + "×" + v[1];
      out.maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      const an = gl.getExtension("EXT_texture_filter_anisotropic"); out.aniso = an ? gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : "none";
      out.exts = (gl.getSupportedExtensions() || []).length;
      out.msaa = gl2 ? gl2.getParameter(gl2.MAX_SAMPLES) : DASH;
      const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
    } catch (e) { /* no WebGL */ }
    return out;
  })();
  const UA = navigator.userAgentData;
  let uaHigh = null;
  if (UA && UA.getHighEntropyValues) UA.getHighEntropyValues(["platformVersion", "architecture", "bitness", "model", "fullVersionList"]).then(v => { uaHigh = v; }).catch(() => {});
  const started = Date.now();

  /* ----- The panels: each a list of [label, value, how good] (how good: "", "warn" or "bad") ----- */
  const grade = (v, warnAt, badAt, lowIsBad) => (typeof v !== "number" ? "" : lowIsBad ? (v <= badAt ? "bad" : v <= warnAt ? "warn" : "") : (v >= badAt ? "bad" : v >= warnAt ? "warn" : ""));
  const PANELS = {
    frame() {
      const f = frameStats();
      if (!f) return [["fps", DASH]];
      return [
        ["fps", n1(f.fps), grade(f.fps, 50, 30, true)],
        ["frame ms", `${n2(f.avg)} avg  ${n1(f.min)}–${n1(f.max)}`, grade(f.max, 34, 70)],
        ["1% low", n1(f.low1) + " fps", grade(f.low1, 45, 25, true)],
        ["0.1% low", n1(f.low01) + " fps", grade(f.low01, 30, 15, true)],
        ["jitter", n2(f.jitter) + " ms", grade(f.jitter, 3, 8)],
        ["refresh", "~" + Math.round(f.hz) + " Hz"],
        ["frames", n0(FR.total)],
        ["slow (>33ms)", n0(FR.slow), FR.slow ? "warn" : ""],
        ["hitches (>100ms)", n0(FR.hitch), FR.hitch ? "bad" : ""],
        ["long tasks", `${n0(FR.longTasks)} (${n0(FR.longMs)} ms)`, FR.longTasks ? "warn" : ""]
      ];
    },
    game() {
      const snakeObj = G("snake"), cr = G("campRun");
      const head = get(() => (snakeObj.cells[0] ? `${snakeObj.cells[0].x / G("grid")},${snakeObj.cells[0].y / G("grid")}` : DASH));
      const dir = get(() => ({ "1,0": "right", "-1,0": "left", "0,1": "down", "0,-1": "up" })[`${Math.sign(snakeObj.dx)},${Math.sign(snakeObj.dy)}`] || DASH);
      return [
        ["screen", get(() => G("currentScreen"))],
        ["state", get(() => G("gameState") + (G("paused") ? " (paused)" : ""))],
        ["mode", get(() => (cr ? `campaign ${cr.isl} ${cr.n}${cr.nmRun ? " (nightmare)" : ""}${cr.sandbox ? " (sandbox)" : ""}` : G("currentModeKey")))],
        ["board", get(() => (cr ? cr.board : DASH))],
        ["score", get(() => n0(G("score")))],
        ["run time", get(() => dur(G("runMs")))],
        ["speed", get(() => n1(1000 / G("moveInterval")) + " moves/s")],
        ["snake", get(() => `${snakeObj.cells.length} long (max ${snakeObj.maxCells})`)],
        ["head", head + "  " + dir],
        ["turns queued", get(() => G("turnQueue").length)],
        ["hearts", get(() => n1(G("currentHearts")))],
        ["orbs / ice", get(() => G("orbs").length + " / " + G("popsicles").length)],
        ["campaign things", get(() => (G("campObjs") || []).length)],
        ["boss", get(() => { const b = G("boss"); return b ? (b.name || b.id || "yes") + (b.hp !== undefined ? " hp " + b.hp : "") : "none"; })],
        ["apples this level", get(() => (cr ? cr.apples : DASH))]
      ];
    },
    campaign() {
      const c = G("camp");
      if (!c) return [["campaign", "not started"]];
      return [
        ["save name", get(() => c.name)],
        ["island", get(() => c.at + (c.nm && c.nm.under ? " (underground)" : ""))],
        ["gems", get(() => n0(c.gems))],
        ["money", get(() => Object.entries(c.money || c.currency || {}).map(([k, v]) => `${k} ${n0(v)}`).join(", ") || DASH)],
        ["satchel", get(() => c.satchel.length + " things")],
        ["worn", get(() => Object.entries(c.equip).map(([s, uid]) => { const it = c.satchel.find(x => x.uid === uid); return it ? `${s}: ${it.id}` : null; }).filter(Boolean).join(", ") || "nothing")],
        ["levels cleared", get(() => Object.keys(c.levels || {}).length)],
        ["spell points", get(() => c.spellPts)],
        ["flags", get(() => [c.flags.modded && "modded", c.flags.cheats && "cheated", c.flags.restored && "restored×" + c.flags.restored].filter(Boolean).join(", ") || "clean")]
      ];
    },
    save() {
      const W = G("WORLD");
      return [
        ["save", get(() => (W ? W.title : "browser storage (no launcher)"))],
        ["id", get(() => (W ? W.id : DASH))],
        ["created", get(() => (W && W.created ? new Date(W.created).toLocaleString() : DASH))],
        ["last written", get(() => (W && W.saved ? ago(W.saved) : DASH))],
        ["unsaved changes", get(() => yes(G("worldDirty")))],
        ["size", get(() => bytes(SLOW.saveSize))],
        ["profile", get(() => { const s = G("save"); return s ? (s.name || DASH) : DASH; })],
        ["icon", get(() => (W && W.icon) || DASH)]
      ];
    },
    mods() {
      const list = get(() => CONTENT.mods);
      const rows = Array.isArray(list) && list.length ? list.map(m => [m.kind || "mod", `${m.name}${m.version ? " " + m.version : ""}`]) : [["mods", "none"]];
      (CONTENT.modsMissing || []).forEach(m => rows.push(["missing", m, "bad"]));
      rows.push(["mod pictures", get(() => Object.keys(CONTENT.modTextures || {}).length)]);
      return rows;
    },
    content() {
      return [
        ["game version", get(() => CONTENT.version)],
        ["read from", get(() => CONTENT.source)],
        ["files read", get(() => n0(CONTENT.filesRead))],
        ["content warnings", get(() => CONTENT.warnings.length), get(() => (CONTENT.warnings.length ? "warn" : ""))],
        ["pictures", get(() => `${n0(TextureLoader.ids().length)} ids, ${n0(TEXTURES.files)} files`)],
        ["picture warnings", get(() => TEXTURES.warnings.length), get(() => (TEXTURES.warnings.length ? "warn" : ""))],
        ["campaign items", get(() => CAMP.items.length)],
        ["islands", get(() => CAMP.islands.length)],
        ["skins / themes", get(() => CONTENT.skins.length + " / " + CONTENT.themes.length)]
      ];
    },
    screen() {
      const cv = G("canvas");
      return [
        ["window", `${innerWidth}×${innerHeight}`],
        ["screen", `${screen.width}×${screen.height} (${screen.availWidth}×${screen.availHeight} free)`],
        ["pixel ratio", n2(devicePixelRatio)],
        ["real pixels", `${Math.round(innerWidth * devicePixelRatio)}×${Math.round(innerHeight * devicePixelRatio)}`],
        ["board canvas", get(() => `${cv.width}×${cv.height} @${n2(G("RS"))}`)],
        ["color", get(() => screen.colorDepth + "-bit" + (media("(dynamic-range: high)") ? ", HDR" : "") + (media("(color-gamut: p3)") ? ", P3" : ""))],
        ["orientation", get(() => screen.orientation.type)],
        ["full screen", yes(!!document.fullscreenElement || (innerWidth === screen.width && innerHeight === screen.height))]
      ];
    },
    gpu() {
      return [
        ["renderer", GPU.renderer], ["vendor", GPU.vendor], ["version", GPU.version], ["GLSL", GPU.glsl],
        ["WebGL 2", yes(GPU.webgl2)], ["WebGPU", yes(!!navigator.gpu)],
        ["max texture", GPU.maxTex], ["max viewport", GPU.maxView], ["max renderbuffer", GPU.maxRb],
        ["anisotropy", GPU.aniso], ["MSAA samples", GPU.msaa], ["extensions", GPU.exts],
        ["3D title", get(() => (typeof A3D !== "undefined" && A3D.renderer ? "on" : "off"))]
      ];
    },
    system() {
      return [
        ["cores", get(() => navigator.hardwareConcurrency)],
        ["memory", get(() => (navigator.deviceMemory ? "≥" + navigator.deviceMemory + " GB" : DASH))],
        ["platform", get(() => (UA ? UA.platform : navigator.platform) + (uaHigh ? ` ${uaHigh.platformVersion} ${uaHigh.architecture}${uaHigh.bitness ? "-" + uaHigh.bitness : ""}` : ""))],
        ["engine", get(() => (UA ? UA.brands.filter(b => !/Not.?A.?Brand/i.test(b.brand)).map(b => b.brand + " " + b.version).join(", ") : navigator.userAgent.slice(0, 60)))],
        ["full version", get(() => (uaHigh && uaHigh.fullVersionList ? (uaHigh.fullVersionList.find(b => /Edge|Chrom/.test(b.brand)) || {}).version : DASH))],
        ["language", get(() => navigator.languages.slice(0, 3).join(", "))],
        ["time zone", get(() => Intl.DateTimeFormat().resolvedOptions().timeZone)],
        ["local time", new Date().toLocaleTimeString()],
        ["launcher", get(() => (window.SNAKE_LAUNCHER ? `${SNAKE_LAUNCHER.launcher} (${SNAKE_LAUNCHER.mode})` : "none (browser)"))],
        ["touch points", get(() => navigator.maxTouchPoints)]
      ];
    },
    memory() {
      const m = performance.memory;
      return [
        ["heap used", get(() => bytes(m.usedJSHeapSize)), get(() => grade(m.usedJSHeapSize / m.jsHeapSizeLimit, 0.6, 0.85))],
        ["heap total", get(() => bytes(m.totalJSHeapSize))],
        ["heap limit", get(() => bytes(m.jsHeapSizeLimit))],
        ["page elements", n0(document.getElementsByTagName("*").length)],
        ["canvases", document.getElementsByTagName("canvas").length],
        ["images", document.images.length],
        ["animations", get(() => document.getAnimations().length)],
        ["style sheets", document.styleSheets.length],
        ["scripts", document.scripts.length]
      ];
    },
    audio() {
      const ac = G("audioCtx"), mu = G("music");
      return [
        ["sound engine", get(() => (ac ? ac.state : "not started"))],
        ["sample rate", get(() => (ac ? ac.sampleRate + " Hz" : DASH))],
        ["latency", get(() => (ac ? `${n1(ac.baseLatency * 1000)} + ${n1((ac.outputLatency || 0) * 1000)} ms` : DASH))],
        ["clock", get(() => (ac ? n1(ac.currentTime) + " s" : DASH))],
        ["music", get(() => (mu && mu.track ? (mu.track.name || mu.track.id || "playing") : "off"))],
        ["sound / music", get(() => { const s = G("save").settings; return (s.sound ? "on" : "off") + " / " + (s.music ? "on" : "off"); })]
      ];
    },
    input() {
      const pads = get(() => Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean).map(p => p.id.slice(0, 28)).join(", ") || "none");
      return [
        ["last key", IN.key + (IN.keyAt ? "  " + ago(IN.keyAt) : "")],
        ["keys held", IN.keys.size ? Array.from(IN.keys).join(" ") : "none"],
        ["key presses", n0(IN.presses)],
        ["pointer", `${IN.x}, ${IN.y}  (${IN.type})`],
        ["buttons", IN.buttons ? IN.buttons : "none"],
        ["clicks / wheel", `${n0(IN.clicks)} / ${n0(IN.wheel)}`],
        ["gamepads", pads],
        ["fine pointer", yes(media("(pointer: fine)"))],
        ["idle", IN.lastAt ? dur(Date.now() - IN.lastAt) : DASH]
      ];
    },
    storage() {
      const s = SLOW.storage;
      return [
        ["used", s ? bytes(s.usage) : DASH],
        ["quota", s ? bytes(s.quota) : DASH],
        ["kept for good", yes(SLOW.persisted)],
        ["local data", SLOW.local],
        ["save folder", get(() => (window.SNAKE_LAUNCHER ? SNAKE_LAUNCHER.dataFolder.replace(/\\\\/g, "\\") : "this browser"))],
        ["mods folder", get(() => (window.SNAKE_LAUNCHER && SNAKE_LAUNCHER.modsFolder) || "mods/")]
      ];
    },
    network() {
      const c = navigator.connection;
      return [
        ["online", yes(navigator.onLine)],
        ["connection", get(() => (c ? c.effectiveType + (c.type ? " (" + c.type + ")" : "") : DASH))],
        ["downlink", get(() => (c ? c.downlink + " Mb/s" : DASH))],
        ["round trip", get(() => (c ? c.rtt + " ms" : DASH))],
        ["data saver", get(() => (c ? yes(c.saveData) : DASH))],
        ["served from", location.protocol === "file:" ? "disk" : location.host]
      ];
    },
    power() {
      const b = SLOW.battery;
      if (!b) return [["battery", DASH]];
      return [
        ["battery", Math.round(b.level * 100) + "%", grade(b.level, 0.25, 0.1, true)],
        ["charging", yes(b.charging)],
        [b.charging ? "full in" : "empty in", Number.isFinite(b.charging ? b.chargingTime : b.dischargingTime) && (b.charging ? b.chargingTime : b.dischargingTime) > 0 ? dur((b.charging ? b.chargingTime : b.dischargingTime) * 1000) : DASH]
      ];
    },
    page() {
      return [
        ["up for", dur(performance.now())],
        ["overlay up for", dur(Date.now() - started)],
        ["focused", yes(document.hasFocus())],
        ["visible", document.visibilityState],
        ["less motion", yes(media("(prefers-reduced-motion: reduce)"))],
        ["dark mode", yes(media("(prefers-color-scheme: dark)"))],
        ["more contrast", yes(media("(prefers-contrast: more)"))],
        ["secure", yes(window.isSecureContext)],
        ["screen filter", get(() => (typeof MOD_FILTER !== "undefined" && MOD_FILTER ? (MOD_FILTER.on ? "on" : "off") : "none"))],
        ["retro screen", get(() => yes(G("save").settings.crt))]
      ];
    },
    warnings() {
      const rows = WARN.slice(-5).reverse().map(w => [ago(w.at), w.text, w.kind === "error" ? "bad" : "warn"]);
      return rows.length ? rows : [["warnings", "none since start"]];
    }
  };
  const TITLES = { frame: "Frames", game: "Game", campaign: "Campaign", save: "Save", mods: "Mods", content: "Content", screen: "Screen", gpu: "Graphics", system: "System", memory: "Memory", audio: "Sound", input: "Input", storage: "Storage", network: "Network", power: "Power", page: "Page", warnings: "Warnings" };

  /* ----- Drawing ----- */
  const css = document.createElement("style");
  css.textContent = `
#mod-overlay { position: fixed; z-index: 2147483100; pointer-events: none; font: 11px/1.32 Consolas, "Cascadia Mono", ui-monospace, monospace; color: #e8f5ee;
  background: rgba(6, 12, 10, var(--ov-a)); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 6px 8px 7px; box-shadow: 0 6px 24px rgba(0,0,0,0.45);
  transform-origin: var(--ov-origin); transform: scale(var(--ov-s)); max-height: calc((100vh - 16px) / var(--ov-s)); display: flex; flex-direction: column; gap: 4px; }
#mod-overlay[hidden] { display: none; }
#mod-overlay.top-left { left: 8px; top: 8px; --ov-origin: 0 0; } #mod-overlay.top-right { right: 8px; top: 8px; --ov-origin: 100% 0; }
#mod-overlay.bottom-left { left: 8px; bottom: 8px; --ov-origin: 0 100%; } #mod-overlay.bottom-right { right: 8px; bottom: 8px; --ov-origin: 100% 100%; }
#mod-overlay .ov-head { display: flex; justify-content: space-between; gap: 12px; color: var(--ov-accent); font-weight: 700; }
#mod-overlay .ov-head span:last-child { color: #8fb8a4; font-weight: 400; }
#mod-overlay canvas { display: block; width: 100%; height: 46px; image-rendering: pixelated; }
#mod-overlay .ov-body { columns: 228px auto; column-gap: 14px; column-fill: auto; min-height: 0; overflow: hidden; }
#mod-overlay section { break-inside: avoid; margin: 0 0 6px; }
#mod-overlay h4 { margin: 0 0 1px; font: inherit; font-weight: 700; color: var(--ov-accent); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
#mod-overlay .ov-row { display: flex; gap: 8px; justify-content: space-between; white-space: nowrap; }
#mod-overlay .ov-row b { font-weight: 400; color: #8fb8a4; flex: none; }
#mod-overlay .ov-row i { font-style: normal; overflow: hidden; text-overflow: ellipsis; text-align: right; min-width: 0; max-width: 168px; }
#mod-overlay .ov-row.warn i { color: var(--ov-warn); } #mod-overlay .ov-row.bad i { color: var(--ov-bad); }
`;
  document.head.appendChild(css);
  const box = document.createElement("div");
  box.id = "mod-overlay";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `<div class="ov-head"><span>STATS</span><span>${cfg.key} hide · Shift+${cfg.key} size · Ctrl+${cfg.key} move</span></div>` +
    (cfg.graph ? `<canvas width="228" height="46"></canvas>` : "") + `<div class="ov-body"></div>`;
  document.body.appendChild(box);
  const body = box.querySelector(".ov-body"), graph = box.querySelector("canvas"), gg = graph && graph.getContext("2d");
  let shown = cfg.shown, sizeAt = Math.max(0, SIZES.indexOf(cfg.size));
  function place() {
    box.className = cfg.corner;
    box.style.setProperty("--ov-s", cfg.size);
    box.style.setProperty("--ov-a", cfg.opacity);
    box.style.setProperty("--ov-accent", cfg.accent);
    box.style.setProperty("--ov-warn", cfg.warn);
    box.style.setProperty("--ov-bad", cfg.bad);
    box.hidden = !shown;
  }
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  function render() {
    if (!shown) return;
    body.innerHTML = cfg.panels.map(p => {
      let rows;
      try { rows = PANELS[p](); } catch (e) { rows = [["(can't read)", DASH]]; }
      return `<section><h4>${TITLES[p]}</h4>${rows.map(([k, v, g]) => `<div class="ov-row ${g || ""}"><b>${esc(k)}</b><i title="${esc(v)}">${esc(v)}</i></div>`).join("")}</section>`;
    }).join("");
  }
  // the last 228 frames, one pixel each: green under 60 fps, yellow under 30, red worse; lines at 60 and 30
  function drawGraph() {
    if (!gg) return;
    const w = graph.width, h = graph.height;
    gg.clearRect(0, 0, w, h);
    gg.fillStyle = "rgba(255,255,255,0.06)";
    gg.fillRect(0, 0, w, h);
    const yOf = ms => h - Math.min(h, (ms / 50) * h);
    gg.fillStyle = "rgba(255,255,255,0.18)";
    gg.fillRect(0, Math.round(yOf(16.7)), w, 1);
    gg.fillRect(0, Math.round(yOf(33.3)), w, 1);
    for (let x = 0; x < w && x < FR.count; x++) {
      const t = FR.times[(FR.i - 1 - x + FR.times.length * 2) % FR.times.length];
      gg.fillStyle = t > 33.4 ? cfg.bad : t > 17.5 ? cfg.warn : cfg.accent;
      const y = Math.round(yOf(t));
      gg.fillRect(w - 1 - x, y, 1, h - y);
    }
  }
  place();
  readSlow();
  render();
  setInterval(render, cfg.every);
  setInterval(readSlow, 4000);

  window.addEventListener("keydown", e => {
    if (e.key !== cfg.key || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    if (e.shiftKey) { sizeAt = (sizeAt + 1) % SIZES.length; cfg.size = SIZES[sizeAt]; shown = true; }
    else if (e.ctrlKey) { cfg.corner = CORNERS[(CORNERS.indexOf(cfg.corner) + 1) % CORNERS.length]; shown = true; }
    else shown = !shown;
    place();
    render();
  });
  return { cfg, frameStats, get shown() { return shown; } };
})();
