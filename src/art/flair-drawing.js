/* =========================================================
   src/art/flair-drawing.js
   Drawing Flair on the snake
   ========================================================= */
"use strict";

/* ----- Drawing flair on the snake ----- */
function star(g, cx, cy, r, points = 5) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (Math.PI * i) / points - Math.PI / 2;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function tinyHeart(g, cx, cy, s) {
  g.save();
  g.translate(cx - s / 2, cy - s / 2);
  g.scale(s / 24, s / 24);
  g.fill(new Path2D(HEART_SVG_PATH));
  g.restore();
}

function gear(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 ? r * 0.72 : r;
    const a = (Math.PI * 2 * i) / 16;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/* segs: top-left screen positions, head first. c: square size. */
function drawFlairSet(g, set, segs, c, alpha = 1, ts = 0) {
  if (!segs.length || !set) return;
  const k = c / 20;
  const mid = i => ({ x: segs[i].x + (c - 1) / 2, y: segs[i].y + (c - 1) / 2 });
  const dirOf = (a, b) => {
    const dx = segs[a].x - segs[b].x;
    const dy = segs[a].y - segs[b].y;
    if (Math.abs(dx) > c * 2 || Math.abs(dy) > c * 2) return null;   // wrapped: ignore
    return { x: Math.sign(dx), y: Math.sign(dy) };
  };
  const head = mid(0);
  const f = (segs.length > 1 && dirOf(0, 1)) || (gameState === "PLAYING" || gameState === "GAMEOVER"
    ? { x: Math.sign(snake.dx), y: Math.sign(snake.dy) } : { x: 1, y: 0 });
  const p = { x: -f.y, y: f.x };
  const n = segs.length;
  g.save();
  g.globalAlpha = alpha;

  // Body pattern (under everything else)
  const body = set.body;
  if (body) {
    for (let i = 1; i < n; i++) {
      const m = mid(i);
      if (body === "purpledots") {
        g.fillStyle = "#8f4dff";
        g.beginPath();
        g.arc(m.x - 3.5 * k, m.y - 3 * k, 2.6 * k, 0, Math.PI * 2);
        g.arc(m.x + 3.5 * k, m.y + 3 * k, 2.6 * k, 0, Math.PI * 2);
        g.fill();
      } else if (body === "hearts" && i % 2) {
        g.fillStyle = "#ff5d8f";
        tinyHeart(g, m.x, m.y, 11 * k);
      } else if (body === "stars" && i % 2) {
        g.fillStyle = "#ffd23f";
        star(g, m.x, m.y, 5.5 * k);
      } else if (body === "zigzag") {
        g.strokeStyle = "rgba(0, 0, 0, 0.55)";
        g.lineWidth = 2 * k;
        g.beginPath();
        g.moveTo(segs[i].x, m.y + (i % 2 ? 4 : -4) * k);
        g.lineTo(m.x, m.y + (i % 2 ? -4 : 4) * k);
        g.lineTo(segs[i].x + c - 1, m.y + (i % 2 ? 4 : -4) * k);
        g.stroke();
      } else if (body === "spots") {
        g.fillStyle = "#3a2410";
        g.beginPath();
        g.ellipse(m.x - 3 * k, m.y - 2 * k, 3.2 * k, 2.4 * k, 0.4, 0, Math.PI * 2);
        g.ellipse(m.x + 4 * k, m.y + 3.5 * k, 2.4 * k, 1.8 * k, -0.3, 0, Math.PI * 2);
        g.fill();
      } else if (body === "ancient") {
        const sh = 0.55 + 0.45 * Math.sin(ts / 400 + i * 0.6);
        g.fillStyle = `rgba(255, 210, 63, ${0.35 + sh * 0.35})`;
        g.beginPath();
        g.moveTo(m.x, m.y - 6 * k);
        g.lineTo(m.x + 5 * k, m.y - 1 * k);
        g.lineTo(m.x, m.y + 6 * k);
        g.lineTo(m.x - 5 * k, m.y - 1 * k);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(120, 80, 10, 0.7)";
        g.lineWidth = Math.max(1, k);
        g.stroke();
      } else if (body === "gears" && i % 2) {
        g.fillStyle = "#b08840";
        gear(g, m.x, m.y, 6 * k);
      }
    }
  }

  // Tail: the last two squares
  const tail = set.tail;
  if (tail && n >= 3) {
    const tip = n - 1;
    const t = dirOf(tip, tip - 1) || { x: -f.x, y: -f.y };
    for (const i of [tip - 1, tip]) {
      const s = segs[i];
      const m = mid(i);
      if (tail === "rattle") {
        g.fillStyle = "#e8d5a8";
        g.fillRect(s.x, s.y, c - 1, c - 1);
        g.fillStyle = "#8a6a3a";
        for (let r = 1; r <= 3; r++) {
          if (t.x) g.fillRect(s.x + (r * c) / 4 - k, s.y, 2 * k, c - 1);
          else g.fillRect(s.x, s.y + (r * c) / 4 - k, c - 1, 2 * k);
        }
      } else if (tail === "candycane") {
        g.save();
        g.beginPath();
        g.rect(s.x, s.y, c - 1, c - 1);
        g.clip();
        g.fillStyle = "#ffffff";
        g.fillRect(s.x, s.y, c, c);
        g.fillStyle = "#e0262e";
        for (let o = -c; o < c * 2; o += 7 * k) {
          g.beginPath();
          g.moveTo(s.x + o, s.y);
          g.lineTo(s.x + o + 3.5 * k, s.y);
          g.lineTo(s.x + o + 3.5 * k - c, s.y + c);
          g.lineTo(s.x + o - c, s.y + c);
          g.fill();
        }
        g.restore();
      } else if (tail === "brasstail") {
        g.fillStyle = "#c9a04a";
        g.fillRect(s.x, s.y, c - 1, c - 1);
        g.fillStyle = "#7a5a20";
        [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(([a, b]) => {
          g.beginPath();
          g.arc(s.x + a * c, s.y + b * c, 1.4 * k, 0, Math.PI * 2);
          g.fill();
        });
      } else if (tail === "goldtail") {
        const gr = g.createLinearGradient(s.x, s.y, s.x + c, s.y + c);
        const sh = (Math.sin(ts / 300 + i) + 1) / 2;
        gr.addColorStop(0, "#fff2a8");
        gr.addColorStop(sh * 0.8 + 0.1, "#ffd23f");
        gr.addColorStop(1, "#b8860b");
        g.fillStyle = gr;
        g.fillRect(s.x, s.y, c - 1, c - 1);
      } else if (i === tip && tail === "maraca") {
        const cx = m.x + t.x * c * 0.45;
        const cy = m.y + t.y * c * 0.45;
        g.fillStyle = "#ff8c1a";
        g.beginPath();
        g.arc(cx, cy, c * 0.55, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#3ddc3d";
        g.fillRect(cx - c * 0.55, cy - 1.5 * k, c * 1.1, 3 * k);
        g.fillStyle = "#ffd23f";
        g.beginPath();
        g.arc(cx - 3 * k, cy - 4 * k, 1.8 * k, 0, Math.PI * 2);
        g.arc(cx + 4 * k, cy + 4 * k, 1.8 * k, 0, Math.PI * 2);
        g.fill();
      } else if (i === tip && tail === "bow") {
        g.fillStyle = "#ff5d8f";
        g.beginPath();
        g.moveTo(m.x, m.y);
        g.lineTo(m.x - p.x * 7 * k - t.x * 3 * k, m.y - p.y * 7 * k - t.y * 3 * k);
        g.lineTo(m.x - p.x * 7 * k + t.x * 5 * k, m.y - p.y * 7 * k + t.y * 5 * k);
        g.closePath();
        g.moveTo(m.x, m.y);
        g.lineTo(m.x + p.x * 7 * k - t.x * 3 * k, m.y + p.y * 7 * k - t.y * 3 * k);
        g.lineTo(m.x + p.x * 7 * k + t.x * 5 * k, m.y + p.y * 7 * k + t.y * 5 * k);
        g.closePath();
        g.fill();
        g.fillStyle = "#c2185b";
        g.beginPath();
        g.arc(m.x, m.y, 2.4 * k, 0, Math.PI * 2);
        g.fill();
      } else if (i === tip && tail === "flametail") {
        const flick = 1 + Math.sin(ts / 70) * 0.18;
        [["#ff4a1a", 1], ["#ffb020", 0.6]].forEach(([col, sc]) => {
          g.fillStyle = col;
          g.beginPath();
          g.moveTo(m.x + p.x * 7 * k * sc, m.y + p.y * 7 * k * sc);
          g.lineTo(m.x + t.x * 17 * k * sc * flick, m.y + t.y * 17 * k * sc * flick);
          g.lineTo(m.x - p.x * 7 * k * sc, m.y - p.y * 7 * k * sc);
          g.closePath();
          g.fill();
        });
      }
    }
  }

  // Clothes: capes over squares 2-4, bow tie and scarf at the neck, or a medal
  const cape = set.cape;
  if (cape && n >= 2) {
    const upto = Math.min(n - 1, 3);
    if (cape === "redcape" || cape === "herocape" || cape === "royalcape") {
      const col = { redcape: "#d1202a", herocape: "#2552d6", royalcape: "#6b1fa8" }[cape];
      const trim = { redcape: "#8a0f16", herocape: "#ffd23f", royalcape: "#ffffff" }[cape];
      for (let i = 1; i <= upto; i++) {
        const s = segs[i];
        const grow = (i === upto ? 3.5 : 2) * k;
        g.fillStyle = col;
        g.fillRect(s.x - grow, s.y - grow, c - 1 + grow * 2, c - 1 + grow * 2);
        g.fillStyle = trim;
        if (cape === "royalcape") {
          g.beginPath();
          g.arc(s.x + c * 0.3, s.y + c * 0.3, 1.5 * k, 0, Math.PI * 2);
          g.arc(s.x + c * 0.7, s.y + c * 0.65, 1.5 * k, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(s.x - grow, s.y - grow, c - 1 + grow * 2, 1.6 * k);
        }
      }
      if (cape === "herocape" && upto >= 2) {
        const m = mid(2);
        g.fillStyle = "#ffd23f";
        g.beginPath();
        g.arc(m.x, m.y, 4.5 * k, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#d1202a";
        star(g, m.x, m.y, 3.4 * k);
      }
    } else if (cape === "scarf") {
      const s = segs[1];
      g.fillStyle = "#e0262e";
      g.fillRect(s.x - k, s.y - k, c + k, c + k);
      g.fillStyle = "#ffffff";
      for (let o = 3; o < c; o += 6) {
        if (f.x) g.fillRect(s.x + o * k, s.y - k, 2 * k, c + k);
        else g.fillRect(s.x - k, s.y + o * k, c + k, 2 * k);
      }
      const m = mid(1);
      g.fillStyle = "#e0262e";
      g.fillRect(m.x + p.x * c * 0.5 - 2.5 * k, m.y + p.y * c * 0.5 - 2.5 * k, 5 * k + Math.abs(f.x) * 6 * k, 5 * k + Math.abs(f.y) * 6 * k);
    } else if (cape === "bowtie") {
      const a = mid(0);
      const b = mid(1);
      const jx = (a.x + b.x) / 2;
      const jy = (a.y + b.y) / 2;
      g.fillStyle = "#1a1a1a";
      [[1], [-1]].forEach(([side]) => {
        g.beginPath();
        g.moveTo(jx, jy);
        g.lineTo(jx + p.x * 7 * k * side - f.x * 4 * k, jy + p.y * 7 * k * side - f.y * 4 * k);
        g.lineTo(jx + p.x * 7 * k * side + f.x * 4 * k, jy + p.y * 7 * k * side + f.y * 4 * k);
        g.closePath();
        g.fill();
      });
      g.fillStyle = "#ff5d8f";
      g.beginPath();
      g.arc(jx, jy, 2.2 * k, 0, Math.PI * 2);
      g.fill();
    } else if (cape.startsWith("medal:")) {
      const fam = BADGE_FAMILIES.find(x => x.id === cape.slice(6));
      const m = mid(1);
      g.fillStyle = "#2552d6";
      g.beginPath();
      g.moveTo(m.x - 5 * k, m.y - 8 * k);
      g.lineTo(m.x, m.y);
      g.lineTo(m.x + 5 * k, m.y - 8 * k);
      g.closePath();
      g.fill();
      g.fillStyle = fam ? medalColor(fam) : "#ffd23f";
      g.beginPath();
      g.arc(m.x, m.y + 1.5 * k, 5.5 * k, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(0, 0, 0, 0.45)";
      g.lineWidth = 1.2 * k;
      g.stroke();
      g.fillStyle = "rgba(255, 255, 255, 0.85)";
      star(g, m.x, m.y + 1.5 * k, 2.8 * k);
    }
  }

  // Face items sit where the eyes are
  const face = set.face;
  const eye = side => ({ x: head.x + (p.x * 4.5 * side + f.x * 2) * k, y: head.y + (p.y * 4.5 * side + f.y * 2) * k });
  if (face === "googly") {
    [1, -1].forEach(side => {
      const e = eye(side);
      const wob = Math.sin(ts / 90) * 0.7 * k;
      g.fillStyle = "#ffffff";
      g.strokeStyle = "#000000";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(e.x, e.y, 4 * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = "#000000";
      g.beginPath();
      g.arc(e.x + f.x * 1.6 * k + p.x * wob, e.y + f.y * 1.6 * k + p.y * wob, 1.9 * k, 0, Math.PI * 2);
      g.fill();
    });
  } else if (face === "shades" || face === "nerd" || face === "goggles") {
    const a = eye(1);
    const b = eye(-1);
    g.strokeStyle = face === "goggles" ? "#6b4420" : "#111111";
    g.lineWidth = (face === "goggles" ? 2.4 : 1.6) * k;
    if (face === "goggles") {
      g.beginPath();
      g.moveTo(head.x - f.x * 9 * k + p.x * 8 * k, head.y - f.y * 9 * k + p.y * 8 * k);
      g.lineTo(a.x, a.y);
      g.moveTo(head.x - f.x * 9 * k - p.x * 8 * k, head.y - f.y * 9 * k - p.y * 8 * k);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
    [a, b].forEach(e => {
      g.beginPath();
      g.arc(e.x, e.y, (face === "nerd" ? 4.2 : 4) * k, 0, Math.PI * 2);
      g.fillStyle = face === "shades" ? "#111111" : face === "goggles" ? "rgba(120, 200, 255, 0.75)" : "rgba(255, 255, 255, 0.9)";
      g.fill();
      if (face !== "shades") g.stroke();
      if (face === "nerd") {
        g.fillStyle = "#000000";
        g.beginPath();
        g.arc(e.x + f.x * 1.2 * k, e.y + f.y * 1.2 * k, 1.5 * k, 0, Math.PI * 2);
        g.fill();
      }
    });
  } else if (face === "mustache") {
    const mx = head.x + f.x * 7 * k;
    const my = head.y + f.y * 7 * k;
    g.fillStyle = "#3a2410";
    [1, -1].forEach(side => {
      g.beginPath();
      g.ellipse(mx + p.x * 3.2 * k * side, my + p.y * 3.2 * k * side, 3.6 * k, 1.9 * k, Math.atan2(p.y, p.x), 0, Math.PI * 2);
      g.fill();
    });
  } else if (face === "eyepatch") {
    const e = eye(1);
    const o = eye(-1);
    g.strokeStyle = "#111111";
    g.lineWidth = 1.4 * k;
    g.beginPath();
    g.moveTo(e.x - f.x * 6 * k - p.x * 4 * k, e.y - f.y * 6 * k - p.y * 4 * k);
    g.lineTo(e.x + f.x * 5 * k + p.x * 2 * k, e.y + f.y * 5 * k + p.y * 2 * k);
    g.stroke();
    g.fillStyle = "#111111";
    g.beginPath();
    g.arc(e.x, e.y, 4.2 * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(o.x, o.y, 3 * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(o.x + f.x * k, o.y + f.y * k, 1.5 * k, 0, Math.PI * 2);
    g.fill();
  } else if (face === "monocle") {
    const e = eye(1);
    g.strokeStyle = "#d4a73a";
    g.lineWidth = 1.6 * k;
    g.beginPath();
    g.arc(e.x, e.y, 4.2 * k, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(200, 235, 255, 0.45)";
    g.fill();
    g.beginPath();
    g.moveTo(e.x - p.x * 4 * k, e.y - p.y * 4 * k);
    g.quadraticCurveTo(head.x - f.x * 8 * k, head.y - f.y * 8 * k + 4 * k, head.x - f.x * 10 * k - p.x * 3 * k, head.y - f.y * 10 * k - p.y * 3 * k);
    g.stroke();
  }

  // Hats sit upright on top of the head
  const hat = set.head;
  if (hat) {
    const hx = segs[0].x;
    const hy = segs[0].y;
    const cx = hx + (c - 1) / 2;
    if (hat === "partyhat") {
      g.fillStyle = "#ff5d8f";
      g.beginPath();
      g.moveTo(cx - 6 * k, hy + 3 * k);
      g.lineTo(cx, hy - 13 * k);
      g.lineTo(cx + 6 * k, hy + 3 * k);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffd23f";
      g.fillRect(cx - 4 * k, hy - 4 * k, 8 * k, 2 * k);
      g.beginPath();
      g.arc(cx, hy - 13 * k, 2.4 * k, 0, Math.PI * 2);
      g.fill();
    } else if (hat === "propeller") {
      g.fillStyle = "#2552d6";
      g.beginPath();
      g.arc(cx, hy + 3 * k, 7 * k, Math.PI, 0);
      g.fill();
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.arc(cx, hy + 3 * k, 7 * k, Math.PI, Math.PI * 1.5);
      g.lineTo(cx, hy + 3 * k);
      g.fill();
      g.strokeStyle = "#e0262e";
      g.lineWidth = 2 * k;
      const w = 8 * k * Math.cos(ts / 60);
      g.beginPath();
      g.moveTo(cx - w, hy - 5 * k);
      g.lineTo(cx + w, hy - 5 * k);
      g.stroke();
      g.fillRect(cx - 0.8 * k, hy - 5 * k, 1.6 * k, 2 * k);
    } else if (hat === "cowboy") {
      g.fillStyle = "#8a5526";
      g.beginPath();
      g.ellipse(cx, hy + 2 * k, 11 * k, 3 * k, 0, 0, Math.PI * 2);
      g.fill();
      roundedPath(g, cx - 5.5 * k, hy - 7 * k, 11 * k, 9 * k, [4 * k, 4 * k, 0, 0]);
      g.fill();
      g.fillStyle = "#4a2a10";
      g.fillRect(cx - 5.5 * k, hy - 1 * k, 11 * k, 2 * k);
    } else if (hat === "santa") {
      g.fillStyle = "#e0262e";
      g.beginPath();
      g.moveTo(cx - 7 * k, hy + 2 * k);
      g.quadraticCurveTo(cx - 2 * k, hy - 14 * k, cx + 11 * k, hy - 7 * k);
      g.lineTo(cx + 7 * k, hy + 2 * k);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffffff";
      roundedPath(g, cx - 8 * k, hy, 16 * k, 4 * k, 2 * k);
      g.fill();
      g.beginPath();
      g.arc(cx + 11 * k, hy - 7 * k, 2.8 * k, 0, Math.PI * 2);
      g.fill();
    } else if (hat === "tophat" || hat === "steamhat") {
      g.fillStyle = hat === "tophat" ? "#111111" : "#5a3a1e";
      g.strokeStyle = "rgba(255, 255, 255, 0.45)";
      g.lineWidth = Math.max(1, k);
      g.strokeRect(cx - 9 * k, hy + 1 * k, 18 * k, 2.5 * k);
      g.strokeRect(cx - 5.5 * k, hy - 12 * k, 11 * k, 13 * k);
      g.fillRect(cx - 9 * k, hy + 1 * k, 18 * k, 2.5 * k);
      g.fillRect(cx - 5.5 * k, hy - 12 * k, 11 * k, 13 * k);
      g.fillStyle = hat === "tophat" ? "#d1202a" : "#c9a04a";
      g.fillRect(cx - 5.5 * k, hy - 3 * k, 11 * k, 2.2 * k);
      if (hat === "steamhat") {
        g.fillStyle = "#c9a04a";
        g.beginPath();
        g.arc(cx - 2.5 * k, hy - 2 * k, 2.6 * k, 0, Math.PI * 2);
        g.arc(cx + 2.5 * k, hy - 2 * k, 2.6 * k, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(140, 220, 255, 0.85)";
        g.beginPath();
        g.arc(cx - 2.5 * k, hy - 2 * k, 1.5 * k, 0, Math.PI * 2);
        g.arc(cx + 2.5 * k, hy - 2 * k, 1.5 * k, 0, Math.PI * 2);
        g.fill();
      }
    } else if (hat === "wizard") {
      g.fillStyle = "#2a2a8a";
      g.beginPath();
      g.moveTo(cx - 8 * k, hy + 3 * k);
      g.lineTo(cx + 2 * k, hy - 16 * k);
      g.lineTo(cx + 8 * k, hy + 3 * k);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffd23f";
      star(g, cx, hy - 5 * k, 2.6 * k);
      star(g, cx + 3 * k, hy - 11 * k, 1.6 * k);
    } else if (hat === "pirate") {
      g.fillStyle = "#111111";
      g.beginPath();
      g.moveTo(cx - 11 * k, hy + 2 * k);
      g.quadraticCurveTo(cx, hy - 14 * k, cx + 11 * k, hy + 2 * k);
      g.quadraticCurveTo(cx, hy - 2 * k, cx - 11 * k, hy + 2 * k);
      g.fill();
      g.strokeStyle = "rgba(255, 255, 255, 0.45)";
      g.lineWidth = Math.max(1, k);
      g.stroke();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(cx, hy - 5 * k, 2.2 * k, 0, Math.PI * 2);
      g.fill();
    } else if (hat === "halo") {
      const bob = Math.sin(ts / 400) * 1.5 * k;
      g.strokeStyle = "#ffe066";
      g.lineWidth = 2.2 * k;
      g.shadowColor = "#ffe066";
      g.shadowBlur = 6 * k;
      g.beginPath();
      g.ellipse(cx, hy - 5 * k + bob, 7 * k, 2.4 * k, 0, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
    } else if (hat === "crown") {
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.moveTo(cx - 8 * k, hy + 2 * k);
      g.lineTo(cx - 8 * k, hy - 8 * k);
      g.lineTo(cx - 4 * k, hy - 3 * k);
      g.lineTo(cx, hy - 10 * k);
      g.lineTo(cx + 4 * k, hy - 3 * k);
      g.lineTo(cx + 8 * k, hy - 8 * k);
      g.lineTo(cx + 8 * k, hy + 2 * k);
      g.closePath();
      g.fill();
      g.fillStyle = "#e0262e";
      g.beginPath();
      g.arc(cx, hy - 2 * k, 1.8 * k, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#38bdf8";
      g.beginPath();
      g.arc(cx - 5 * k, hy - 1 * k, 1.4 * k, 0, Math.PI * 2);
      g.arc(cx + 5 * k, hy - 1 * k, 1.4 * k, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}
