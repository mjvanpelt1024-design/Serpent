/* =========================================================
   src/game/cosmetics/skins.js
   Builds skins from content/skins and works out their colors
   ========================================================= */
"use strict";

/* =========================================================
   Skins (25 total). seq = the repeating colour order, 1-based
   ========================================================= */
/* Every skin is a file in content/skins/ (listed in content/skins/_index.dat) */
const skins = CONTENT.skins.map(s => {
  const skin = { id: s.id, group: String(s.group || "Solids"), name: s.name || s.id };
  if (Array.isArray(s.palette)) skin.palette = s.palette.map(String);
  if (s.seq !== undefined) skin.seq = String(s.seq);
  if (Array.isArray(s.gradient)) skin.gradient = s.gradient.map(String);
  if (typeof s.steps === "number") skin.steps = s.steps;
  if (s.fade) skin.fade = true;
  if (s.head) skin.head = String(s.head);
  if (typeof s.animated === "number") skin.animated = s.animated;
  if (!skin.palette && !skin.gradient) { console.warn(`${s._file}: needs a palette or a gradient`); skin.palette = ["#3ddc3d"]; }
  return skin;
});

/* Turns every skin into a flat color list plus the order to walk it in */
function gradientColors(stops, steps, loop) {
  const rgb = stops.map(hexToRgb);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * (rgb.length - 1);
    const k = Math.min(Math.floor(t), rgb.length - 2);
    const f = t - k;
    const mix = [0, 1, 2].map(c => Math.round(rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f));
    out.push("#" + mix.map(v => v.toString(16).padStart(2, "0")).join(""));
  }
  if (loop) for (let i = steps - 2; i >= 1; i--) out.push(out[i]); // fade back so it loops smoothly
  return out;
}

skins.forEach(skin => {
  skin.colors = skin.gradient ? gradientColors(skin.gradient, skin.steps || 10, !skin.fade) : skin.palette;
  skin.order = skin.seq ? skin.seq.split("").map(ch => Number(ch) - 1) : skin.colors.map((_, i) => i);
});

const skinById = Object.fromEntries(skins.map(s => [s.id, s]));

function skinColorAt(skin, index, ts = 0) {
  if (skin.head && index === 0) return skin.head;
  const len = skin.order.length;
  let i = skin.fade ? Math.min(index, len - 1) : index;
  if (skin.animated) i -= Math.floor(ts / skin.animated);
  return skin.colors[skin.order[((i % len) + len) % len]];
}
