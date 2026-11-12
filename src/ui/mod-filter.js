/* =========================================================
   src/ui/mod-filter.js
   The screen filter a cosmetic mod can switch on with a filter.txt
   (docs/MODDING.md; mods/cosmetic/crt-extreme is the one that comes
   with the game). Mods never run code: this file is the game's own,
   and the mod only says how strong each part is.

   Two halves:
     - layers over everything, which never take a click: scanlines,
       the phosphor stripes, the tint, static, the rolling bar, the
       flicker, the dark edges, the glare and the round corners. They
       are cheap: one still film, and the moving parts move only by
       transform and opacity, which the graphics card does on its own.
     - the "full glass": an SVG filter on the whole page (the <html>
       element, so nothing fixed in place moves): the glass's bulge, the
       picture's sideways wobble, the colors drifting apart and the glow.
       It redraws the whole window every frame, so it's expensive: on
       laptop graphics it can cost two thirds of the frame rate.
   glass = auto (the default) tries the full glass, watches the frame
   rate for a few seconds, and keeps the light one if the PC can't hold
   50 frames a second; "full" and "light" choose for you.
   Its key (F4 by default) switches it off and on. When Windows asks
   for less motion, nothing in it moves.
   ========================================================= */
"use strict";

const MOD_FILTER = (() => {
  const F = (typeof CONTENT !== "undefined" && CONTENT.cosmetics && CONTENT.cosmetics.filter) || null;
  if (!F) return null;
  const num = (k, lo, hi) => { const v = Number(F[k]); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
  const color = (k, d) => (/^#[0-9a-f]{3,8}$/i.test(String(F[k] || "")) ? String(F[k]) : d);
  const P = {
    curve: num("curve", 0, 0.4), corner: num("corner", 0, 200), vignette: num("vignette", 0, 1), reflection: num("reflection", 0, 1),
    scanlines: num("scanlines", 0, 1), lineGap: Math.max(2, num("lineGap", 0, 12) || 3), mask: num("mask", 0, 1),
    aberration: num("aberration", 0, 12), bloom: num("bloom", 0, 1), tint: color("tint", "#ffffff"), tintAmount: num("tintAmount", 0, 1),
    saturation: F.saturation === undefined ? 1 : num("saturation", 0, 3), contrast: F.contrast === undefined ? 1 : num("contrast", 0, 3),
    brightness: F.brightness === undefined ? 1 : num("brightness", 0, 3),
    noise: num("noise", 0, 1), flicker: num("flicker", 0, 0.08), roll: num("roll", 0, 1), rollSecs: Math.max(1, num("rollSecs", 0, 60) || 7),
    jitter: num("jitter", 0, 6), key: String(F.toggleKey || "F4"),
    glass: ["full", "light"].includes(String(F.glass)) ? String(F.glass) : "auto"
  };
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const root = document.documentElement;

  /* ----- The SVG filter ----- */
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  const filter = document.createElementNS(NS, "filter");
  filter.id = "mod-crt-filter";
  ["x", "y"].forEach(a => filter.setAttribute(a, "0"));
  ["width", "height"].forEach(a => filter.setAttribute(a, "1"));
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  svg.appendChild(filter);
  const el = (tag, attrs, parent = filter) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    parent.appendChild(n);
    return n;
  };

  let last = "SourceGraphic";
  // the picture won't sit still: a sideways twitch every so often
  if (P.jitter > 0) {
    const off = el("feOffset", { in: last, dx: 0, dy: 0, result: "jit" });
    if (!still) {
      const j = P.jitter;
      const vals = [0, 0, 0, j, 0, 0, -j * 0.6, 0, 0, 0, j * 0.4, -j, 0, 0, 0, 0, j * 0.7, 0].map(v => v.toFixed(2)).join(";");
      el("animate", { attributeName: "dx", values: vals, dur: "1.9s", calcMode: "discrete", repeatCount: "indefinite" }, off);
    }
    last = "jit";
  }
  // the glass bulges: a map of how far each pixel looks (feDisplacementMap), redrawn for the window's size
  let mapImage = null, mapScale = 0;
  if (P.curve > 0) {
    mapImage = el("feImage", { x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: "none", result: "bulgeMap" });
    const disp = el("feDisplacementMap", { in: last, in2: "bulgeMap", scale: 0, xChannelSelector: "R", yChannelSelector: "G", result: "bulge" });
    mapScale = disp;
    last = "bulge";
  }
  // the colors drift apart: red one way, blue the other
  if (P.aberration > 0) {
    const a = P.aberration;
    el("feColorMatrix", { in: last, type: "matrix", values: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", result: "chR" });
    el("feOffset", { in: "chR", dx: -a, dy: 0, result: "chR2" });
    el("feColorMatrix", { in: last, type: "matrix", values: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", result: "chG" });
    el("feColorMatrix", { in: last, type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0", result: "chB" });
    el("feOffset", { in: "chB", dx: a, dy: a * 0.25, result: "chB2" });
    el("feComposite", { in: "chR2", in2: "chG", operator: "arithmetic", k1: 0, k2: 1, k3: 1, k4: 0, result: "chRG" });
    el("feComposite", { in: "chRG", in2: "chB2", operator: "arithmetic", k1: 0, k2: 1, k3: 1, k4: 0, result: "split" });
    last = "split";
  }
  // glow around bright things
  if (P.bloom > 0) {
    el("feColorMatrix", { in: last, type: "matrix", values: "1.4 0 0 0 -0.35  0 1.4 0 0 -0.35  0 0 1.4 0 -0.35  0 0 0 1 0", result: "bright" });
    el("feGaussianBlur", { in: "bright", stdDeviation: 7, result: "glow" });
    el("feComposite", { in: last, in2: "glow", operator: "arithmetic", k1: 0, k2: 1, k3: P.bloom, k4: 0, result: "bloomed" });
    last = "bloomed";
  }
  // black glass behind it all, where the bulge pulls the picture in from the edges
  el("feFlood", { "flood-color": "#000", result: "black" });
  const merge = el("feMerge", {});
  el("feMergeNode", { in: "black" }, merge);
  el("feMergeNode", { in: last }, merge);

  /* The bulge's map: red and green say how far right and down each pixel looks (128 = not at all).
     A pixel halfway to the edge hardly moves; one at the middle of an edge looks out by curve x 5% of the
     width (a corner twice that), so the picture bows in and the corners go black. */
  function drawMap() {
    if (!mapImage) return;
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const cw = 160, ch = Math.max(2, Math.round(160 * h / w));
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    const g = c.getContext("2d");
    const img = g.createImageData(cw, ch);
    const maxPx = P.curve * 0.05 * w * 2;                       // the most any pixel looks (a corner)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const u = (x + 0.5) / cw * 2 - 1, v = (y + 0.5) / ch * 2 - 1, r2 = u * u + v * v;
      // a pixel near the edge shows what's further out, so the picture shrinks into a rounded, bulging shape
      const dx = u * r2 * P.curve * 0.05 * w, dy = v * r2 * P.curve * 0.05 * w;
      const i = (y * cw + x) * 4;
      img.data[i] = Math.round(128 + 127 * dx / maxPx);
      img.data[i + 1] = Math.round(128 + 127 * dy / maxPx);
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    mapImage.setAttribute("width", w); mapImage.setAttribute("height", h);
    mapImage.setAttribute("href", c.toDataURL());
    mapScale.setAttribute("scale", (maxPx * 2).toFixed(1));
  }

  /* ----- The layers over everything -----
     One still film holds the scanlines, the phosphor stripes, the edges' color fringe, the dark corners
     and the glare, all plain see-through color (no blend modes, which are slow over a whole window).
     The tint and the punch are CSS color filters on the page, which the graphics card does for free. */
  const css = document.createElement("style");
  const S = P.scanlines, gap = P.lineGap, M = P.mask, V = P.vignette, A = Math.min(1, P.aberration / 4);
  const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const tint = (() => { const h = P.tint.replace("#", ""); const x = h.length === 3 ? h.split("").map(c => c + c).join("") : h.slice(0, 6); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); })();
  const filmFor = fringe => [
    P.reflection ? `linear-gradient(128deg, ${rgba(255, 255, 255, P.reflection)} 0%, ${rgba(255, 255, 255, P.reflection * 0.3)} 22%, transparent 42%)` : "",
    V ? `radial-gradient(ellipse at 50% 50%, transparent 52%, ${rgba(0, 0, 0, V * 0.55)} 80%, ${rgba(0, 0, 0, V)} 100%)` : "",
    // light glass only: the colors fringe red and blue toward the sides, where a real tube's split shows most
    A && fringe ? `linear-gradient(to right, ${rgba(255, 30, 60, A * 0.16)} 0%, transparent 9%, transparent 91%, ${rgba(40, 120, 255, A * 0.16)} 100%)` : "",
    S ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${gap - 1}px, ${rgba(0, 0, 0, S)} ${gap - 1}px, ${rgba(0, 0, 0, S)} ${gap}px)` : "",
    M ? `repeating-linear-gradient(to right, ${rgba(255, 40, 40, M * 0.16)} 0 1px, ${rgba(40, 255, 60, M * 0.13)} 1px 2px, ${rgba(50, 80, 255, M * 0.2)} 2px 3px)` : "",
    P.tintAmount ? `linear-gradient(${rgba(tint[0], tint[1], tint[2], P.tintAmount * 0.35)}, ${rgba(tint[0], tint[1], tint[2], P.tintAmount * 0.35)})` : ""
  ].filter(Boolean).join(", ");
  const film = filmFor(true), filmFull = filmFor(false);   // the full glass splits the colors for real
  const fns = `saturate(${P.saturation}) contrast(${P.contrast}) brightness(${P.brightness})`;
  css.textContent = `
html.mod-crt { filter: ${fns}; min-height: 100%; }
html.mod-crt.crt-full { filter: url(#mod-crt-filter) ${fns}; }
#mod-crt { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden; contain: strict; }
html:not(.mod-crt) #mod-crt { display: none; }
#mod-crt > div { position: absolute; inset: 0; pointer-events: none; }
#mod-crt .crt-film { background: ${film || "none"}; }
html.crt-full #mod-crt .crt-film { background: ${filmFull || "none"}; }
#mod-crt .crt-noise { inset: -128px; opacity: ${(P.noise * 0.55).toFixed(3)}; will-change: transform; ${still ? "" : "animation: crt-noise 0.42s steps(6) infinite;"} }
#mod-crt .crt-roll { inset: auto 0 auto 0; top: 0; height: 22vh; will-change: transform; background: linear-gradient(to bottom, transparent, ${rgba(255, 255, 255, P.roll * 0.12)} 45%, ${rgba(0, 0, 0, P.roll * 0.18)} 55%, transparent); ${still || !P.roll ? "display:none;" : `animation: crt-roll ${P.rollSecs}s linear infinite;`} }
#mod-crt .crt-flicker { background: #000; opacity: 0; will-change: opacity; ${still || !P.flicker ? "" : "animation: crt-flicker 3.1s steps(1) infinite;"} }
#mod-crt .crt-bezel { border-radius: ${P.corner}px; box-shadow: 0 0 0 100vmax #000, inset 0 0 ${Math.round(P.corner * 1.4 + 10)}px ${rgba(0, 0, 0, Math.min(1, 0.4 + V * 0.5))}; }
@keyframes crt-noise { 0% { transform: translate(0,0) } 17% { transform: translate(-37px,21px) } 33% { transform: translate(52px,-44px) } 50% { transform: translate(-71px,63px) } 67% { transform: translate(18px,-90px) } 83% { transform: translate(-96px,-12px) } 100% { transform: translate(0,0) } }
@keyframes crt-roll { from { transform: translateY(-25vh) } to { transform: translateY(105vh) } }
@keyframes crt-flicker { 0% { opacity: 0 } 7% { opacity: ${P.flicker} } 9% { opacity: 0 } 38% { opacity: ${(P.flicker * 0.5).toFixed(3)} } 40% { opacity: 0 } 71% { opacity: ${P.flicker} } 72% { opacity: ${(P.flicker * 0.4).toFixed(3)} } 74% { opacity: 0 } }
`;
  const layers = document.createElement("div");
  layers.id = "mod-crt";
  layers.setAttribute("aria-hidden", "true");
  ["film", "noise", "roll", "flicker", "bezel"].forEach(k => {
    const on = { film: film, noise: P.noise, roll: P.roll, flicker: P.flicker, bezel: 1 }[k];
    if (!on) return;
    const d = document.createElement("div");
    d.className = "crt-" + k;
    layers.appendChild(d);
  });
  // static: a tile of light and dark specks, see-through between them, drawn once
  const noiseLayer = layers.querySelector(".crt-noise");
  if (noiseLayer) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d"), img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      const light = v > 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
      img.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 150);
    }
    g.putImageData(img, 0, 0);
    noiseLayer.style.background = `url(${c.toDataURL()}) repeat`;
  }

  document.head.appendChild(css);
  document.body.appendChild(svg);
  document.body.appendChild(layers);
  drawMap();
  let resizeT = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(drawMap, 150); });

  /* Full or light glass. Auto tries the full one and counts frames for three seconds (once the game has
     settled); under 50 a second, it keeps the light one for the rest of the session. */
  let full = P.glass !== "light", on = true;
  function set(v) { on = !!v; root.classList.toggle("mod-crt", on); root.classList.toggle("crt-full", on && full); }
  set(true);
  if (P.glass === "auto") {
    const trial = () => {
      if (document.hidden || !on) { setTimeout(trial, 2000); return; }
      let n = 0;
      const t0 = performance.now();
      const count = () => {
        n++;
        if (performance.now() - t0 < 3000) { requestAnimationFrame(count); return; }
        const fps = n * 1000 / (performance.now() - t0);
        if (fps < 50) { full = false; set(on); console.info(`Screen filter: ${fps.toFixed(0)} fps with the full glass, so it's using the light glass`); }
      };
      requestAnimationFrame(count);
    };
    setTimeout(trial, 2500);
  }
  window.addEventListener("keydown", e => {
    if (e.key !== P.key || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    set(!on);
    e.preventDefault();
    if (typeof showToast === "function") showToast(on ? "Screen filter on (" + P.key + " to switch it off)" : "Screen filter off (" + P.key + " to switch it back on)");
  });
  return { params: P, get on() { return on; }, get full() { return full; }, set, setGlass(v) { full = !!v; set(on); } };
})();
