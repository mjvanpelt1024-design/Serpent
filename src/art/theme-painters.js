/* =========================================================
   src/art/theme-painters.js
   How each patterned theme paints the board
   ========================================================= */
"use strict";

/* A theme file (content/themes/*.theme) with "painter = name" uses the painter
   of that name. Inside a painter, `this` is the theme, so this.base, this.accent
   and this.lines are the colors from its file, and `grid` is the board's square
   size. A new pattern is a new painter here plus a theme file that names it. */
const THEME_PAINTERS = {
  sunsetsky(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, Math.max(h, 400));
  grd.addColorStop(0, this.base);
  grd.addColorStop(1, this.accent);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  },
  oceandeep(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, Math.max(h, 400));
  grd.addColorStop(0, this.base);
  grd.addColorStop(1, this.accent);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  },
  twilight(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, Math.max(h, 400));
  grd.addColorStop(0, this.base);
  grd.addColorStop(1, this.accent);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(99);
  g.fillStyle = "#ffffff";
  for (let i = 0; i < (w * h) / 3000; i++) {
    g.globalAlpha = 0.3 + rand() * 0.5;
    g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h * 0.6), 1, 1);
  }
  g.globalAlpha = 1;
  },
  lawn(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.accent;
  for (let y = 0; y < h; y += grid) {
    for (let x = 0; x < w; x += grid) {
      if (((x + y) / grid) % 2 === 0) g.fillRect(x, y, grid, grid);
    }
  }
  },
  blueprint(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.lines;
  for (let x = grid - 1; x < w; x += grid) g.fillRect(x, 0, 1, h);
  for (let y = grid - 1; y < h; y += grid) g.fillRect(0, y, w, 1);
  g.fillStyle = "#2b5494";
  for (let x = 99; x < w; x += 100) g.fillRect(x, 0, 1, h);
  for (let y = 99; y < h; y += 100) g.fillRect(0, y, w, 1);
  },
  notebook(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.lines;
  for (let y = grid - 1; y < h; y += grid) g.fillRect(0, y, w, 1);
  g.fillStyle = "#e59a9a";
  g.fillRect(58, 0, 1, h);
  g.fillRect(61, 0, 1, h);
  },
  polka(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.lines;
  for (let y = 0; y < h; y += grid) {
    for (let x = 0; x < w; x += grid) {
      if (((x + y) / grid) % 2 !== 0) continue;
      g.beginPath();
      g.arc(x + 10, y + 10, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  },
  stars(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(1337);
  const count = Math.round((w * h) / 1450);
  const tints = ["#ffffff", "#a8c8ff", "#ffe8a8"];
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const size = rand() < 0.2 ? 2 : 1;
    g.globalAlpha = 0.35 + rand() * 0.65;
    g.fillStyle = tints[Math.floor(rand() * tints.length)];
    g.fillRect(Math.floor(x), Math.floor(y), size, size);
  }
  g.globalAlpha = 1;
  },
  brick(g, w, h) {
  g.fillStyle = this.lines;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.base;
  for (let row = 0; row * grid < h; row++) {
    const offset = row % 2 ? -grid : 0;
    for (let x = offset; x < w; x += grid * 2) {
      g.fillRect(x + 1, row * grid + 1, grid * 2 - 2, grid - 2);
    }
  }
  },
  waves(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = this.lines;
  g.lineWidth = 2;
  for (let y = 10; y < h + grid; y += grid) {
    g.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const yy = y + Math.sin((x / 40) * Math.PI * 2) * 4;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  },
  tartan(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const band = (color, offset, width, period) => {
    g.fillStyle = color;
    for (let p = offset; p < w; p += period) g.fillRect(p, 0, width, h);
    for (let p = offset; p < h; p += period) g.fillRect(0, p, w, width);
  };
  band("rgba(8, 50, 28, 0.55)", 0, 30, 80);
  band("rgba(160, 28, 44, 0.42)", 44, 12, 80);
  band("rgba(235, 195, 90, 0.28)", 64, 2, 80);
  },
  argyle(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.accent;
  for (let y = 0; y < h; y += 40) {
    for (let x = 0; x < w; x += 40) {
      g.beginPath();
      g.moveTo(x + 20, y);
      g.lineTo(x + 40, y + 20);
      g.lineTo(x + 20, y + 40);
      g.lineTo(x, y + 20);
      g.closePath();
      g.fill();
    }
  }
  g.strokeStyle = "#48487a";
  g.lineWidth = 1;
  g.setLineDash([3, 4]);
  for (let c = -Math.ceil(h / 40) * 40; c <= w; c += 40) {
    g.beginPath(); g.moveTo(c, 0); g.lineTo(c + h, h); g.stroke();
  }
  for (let c = 0; c <= w + h; c += 40) {
    g.beginPath(); g.moveTo(c, 0); g.lineTo(c - h, h); g.stroke();
  }
  g.setLineDash([]);
  },
  honeycomb(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = this.lines;
  g.lineWidth = 2;
  const r = 12;
  const hexW = Math.sqrt(3) * r;
  for (let row = -1; row * 1.5 * r < h + r; row++) {
    for (let col = -1; col * hexW < w + hexW; col++) {
      const cx = col * hexW + (row % 2 ? hexW / 2 : 0);
      const cy = row * 1.5 * r;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 90);
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    }
  }
  },
  synthwave(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#1a0b2e");
  grd.addColorStop(1, "#2d0b4e");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const horizon = h * 0.35;
  g.fillStyle = "rgba(255, 120, 60, 0.18)";
  g.beginPath();
  g.arc(w / 2, horizon, w * 0.2, Math.PI, 0);
  g.fill();
  g.strokeStyle = "rgba(255, 42, 109, 0.35)";
  g.lineWidth = 1;
  for (let i = 1; i < 14; i++) {
    const y = horizon + (h - horizon) * Math.pow(i / 13, 2);
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    g.beginPath();
    g.moveTo(w / 2 + i * (w / 20) * 0.3, horizon);
    g.lineTo(w / 2 + i * (w / 10), h);
    g.stroke();
  }
  },
  circuit(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(7);
  g.lineWidth = 2;
  for (let i = 0; i < (w * h) / 2500; i++) {
    let x = Math.floor(rand() * (w / grid)) * grid + 10;
    let y = Math.floor(rand() * (h / grid)) * grid + 10;
    g.strokeStyle = this.accent;
    g.beginPath();
    g.moveTo(x, y);
    const len = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < len; k++) {
      if (rand() < 0.5) x += rand() < 0.5 ? -grid : grid;
      else y += rand() < 0.5 ? -grid : grid;
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = "#2f9e72";
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  }
  },
  matrix(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(3);
  g.fillStyle = "#22c55e";
  for (let x = 4; x < w; x += 12) {
    const start = rand() * h;
    const len = 40 + rand() * 120;
    for (let k = 0; k < len; k += 8) {
      g.globalAlpha = 0.06 + 0.3 * (k / len);
      g.fillRect(x, (start + k) % h, 5, 6);
    }
  }
  g.globalAlpha = 1;
  },
  chess(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.accent;
  for (let y = 0; y < h; y += 40) {
    for (let x = 0; x < w; x += 40) {
      if (((x + y) / 40) % 2 === 0) g.fillRect(x, y, 40, 40);
    }
  }
  },
  topo(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = this.accent;
  g.lineWidth = 1.5;
  [[90, 110], [300, 290], [330, 60], [60, 340]].forEach(([cx, cy], n) => {
    for (let r = 10; r < 220; r += 14) {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.15) {
        const rr = r * (1 + 0.08 * Math.sin(a * 3 + r / 20 + n));
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.8;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  },
  clouds(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(21);
  g.fillStyle = "rgba(255, 255, 255, 0.85)";
  for (let c = 0; c < (w * h) / 16000 + 1; c++) {
    const cx = Math.floor(rand() * w / 10) * 10;
    const cy = Math.floor(rand() * h / 10) * 10;
    const width = 4 + Math.floor(rand() * 5);
    for (let row = 0; row < 3; row++) {
      const inset = row === 0 ? 1 + Math.floor(rand() * 2) : 0;
      const rw = row === 0 ? width - inset * 2 : width + (row === 1 ? 1 : 0);
      g.fillRect(cx + inset * 10 - (row === 1 ? 10 : 0), cy + row * 10, rw * 10, 10);
    }
  }
  },
  sakura(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(12);
  for (let i = 0; i < (w * h) / 1800; i++) {
    g.save();
    g.translate(rand() * w, rand() * h);
    g.rotate(rand() * Math.PI);
    g.fillStyle = rand() < 0.5 ? "#ffb7c9" : "#ffc9d6";
    g.beginPath();
    g.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  },
  icerink(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(5);
  g.strokeStyle = "#a9d3ee";
  g.lineWidth = 1;
  for (let i = 0; i < (w * h) / 9000 + 2; i++) {
    let x = rand() * w;
    let y = rand() * h;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 60;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  },
  lavarock(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(66);
  g.lineCap = "round";
  for (let i = 0; i < (w * h) / 7000 + 2; i++) {
    let x = rand() * w;
    let y = rand() * h;
    g.strokeStyle = rand() < 0.5 ? "rgba(255, 106, 26, 0.55)" : "rgba(255, 190, 60, 0.4)";
    g.lineWidth = 1 + rand() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rand() - 0.5) * 50;
      y += (rand() - 0.5) * 50;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  },
  nebula(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  [[80, 90, "rgba(157, 78, 221, 0.28)"], [300, 260, "rgba(0, 180, 216, 0.22)"], [240, 70, "rgba(247, 37, 133, 0.18)"], [70, 330, "rgba(0, 180, 216, 0.16)"]]
    .forEach(([cx, cy, color]) => {
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 140);
      grd.addColorStop(0, color);
      grd.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
  const rand = seededRandom(44);
  g.fillStyle = "#ffffff";
  for (let i = 0; i < (w * h) / 2200; i++) {
    g.globalAlpha = 0.3 + rand() * 0.6;
    g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1);
  }
  g.globalAlpha = 1;
  },
  diamondplate(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h + 20; y += 20) {
    for (let x = 0; x < w + 20; x += 20) {
      const flip = ((x + y) / 20) % 2 === 0;
      g.save();
      g.translate(x + 10, y + 10);
      g.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
      g.fillStyle = this.accent;
      g.fillRect(-6, -1.5, 12, 3);
      g.fillStyle = "rgba(255, 255, 255, 0.18)";
      g.fillRect(-6, -1.5, 12, 1);
      g.restore();
    }
  }
  },
  arcade(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(80);
  const neon = ["rgba(0, 229, 255, 0.35)", "rgba(255, 0, 170, 0.35)", "rgba(255, 221, 0, 0.3)"];
  g.lineWidth = 2;
  for (let i = 0; i < (w * h) / 2600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const kind = Math.floor(rand() * 3);
    g.strokeStyle = neon[Math.floor(rand() * neon.length)];
    g.beginPath();
    if (kind === 0) g.arc(x, y, 4 + rand() * 4, 0, Math.PI * 2);
    else if (kind === 1) { g.moveTo(x, y - 6); g.lineTo(x + 6, y + 5); g.lineTo(x - 6, y + 5); g.closePath(); }
    else { g.moveTo(x - 8, y); g.lineTo(x - 4, y - 4); g.lineTo(x, y); g.lineTo(x + 4, y - 4); g.lineTo(x + 8, y); }
    g.stroke();
  }
  },
  auroranight(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  [["rgba(0, 255, 163, 0.16)", 90, 0], ["rgba(180, 0, 255, 0.12)", 150, 1.7], ["rgba(0, 179, 255, 0.12)", 210, 3.1]].forEach(([color, base, phase]) => {
    g.strokeStyle = color;
    g.lineWidth = 26;
    g.beginPath();
    for (let x = -20; x <= Math.max(w, 400) + 20; x += 8) {
      const y = base + Math.sin(x / 70 + phase) * 30;
      if (x === -20) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
  const rand = seededRandom(17);
  g.fillStyle = "#ffffff";
  for (let i = 0; i < (w * h) / 2600; i++) {
    g.globalAlpha = 0.3 + rand() * 0.5;
    g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1);
  }
  g.globalAlpha = 1;
  },
  chevron(g, w, h) {
  g.fillStyle = this.base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = this.accent;
  for (let y = -20; y < h + 20; y += 40) {
    g.beginPath();
    for (let x = 0; x <= w + 40; x += 40) {
      g.lineTo(x, y);
      g.lineTo(x + 20, y + 20);
    }
    for (let x = w + 40; x >= 0; x -= 40) {
      g.lineTo(x + 20, y + 40);
      g.lineTo(x, y + 20);
    }
    g.closePath();
    g.fill();
  }
  }
};
