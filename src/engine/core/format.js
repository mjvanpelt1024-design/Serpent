/* =========================================================
   src/engine/core/format.js
   Number formatting
   ========================================================= */
"use strict";

/* =========================================================
   Formatting
   ========================================================= */
/* Numbers show in full up to a billion, then compact: 4.5B, 12.3T, 7.8Qa */
const BIG_SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"];
function fmtCompact(n) {
  const e = Math.min(BIG_SUFFIX.length - 1, Math.floor(Math.log10(Math.max(1, Math.abs(n))) / 3));
  const v = n / Math.pow(10, e * 3);
  return (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100) + BIG_SUFFIX[e];
}
// Big numbers are condensed everywhere: 123,456 shows as 123K
const fmtInt = n => (Math.abs(n) >= 1e5 ? fmtCompact(n) : Math.round(n).toLocaleString("en-US"));
const round2 = n => Math.round(n * 100) / 100;

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
