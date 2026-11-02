/* =========================================================
   src/engine/render/table.js
   The paint swirl, theme particles and the CRT film
   ========================================================= */
"use strict";

/* =========================================================
   The table: a churning paint swirl, the theme's flair, and the CRT film.
   The swirl renders small and is stretched with chunky pixels, so it costs
   very little and looks hand-painted.
   ========================================================= */
const tableFx = (() => {
  const swirlEl = document.getElementById("bg-swirl");
  const fxEl = document.getElementById("bg-fx");
  const fctx = fxEl.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let gl = null, prog = null, uni = {}, theme = null;
  let parts = [];
  let last = 0, clock = 0, frameNo = 0, w = 0, h = 0;
  const PIX = 5;    // each swirl pixel covers this many screen pixels

  const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  const FRAG = `precision mediump float;
    uniform vec2 uRes; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
      float r = length(uv);
      float ang = atan(uv.y, uv.x) + (1.3 - r) * 1.1 + uTime * 0.03;
      vec2 p = r * vec2(cos(ang), sin(ang)) * 3.0;
      float t = uTime * 0.16;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        p += 0.55 * vec2(sin(p.y * 1.3 + t + fi * 1.7), cos(p.x * 1.1 - t * 0.8 + fi * 2.3));
      }
      float v = 0.5 + 0.5 * sin(p.x * 0.9 + p.y * 0.7);
      float w = 0.5 + 0.5 * sin(length(p) * 0.8 - t * 1.2);
      vec3 col = mix(uC, uB, smoothstep(0.02, 0.5, v));
      col = mix(col, uA, smoothstep(0.5, 0.92, v * w + 0.22));
      col = floor(col * 12.0 + 0.5) / 12.0;
      col *= 1.0 - 0.38 * smoothstep(0.4, 1.15, r);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function initGl() {
    try {
      gl = swirlEl.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) return;
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ["uRes", "uTime", "uA", "uB", "uC"].forEach(n => { uni[n] = gl.getUniformLocation(prog, n); });
    } catch (e) {
      gl = null;
    }
  }

  const rgb01 = hex => hexToRgb(hex).map(v => v / 255);

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    swirlEl.width = Math.max(1, Math.ceil(w / PIX));
    swirlEl.height = Math.max(1, Math.ceil(h / PIX));
    fxEl.width = w;
    fxEl.height = h;
    if (gl) gl.viewport(0, 0, swirlEl.width, swirlEl.height);
    seed();
    drawSwirl();
  }

  function drawSwirl() {
    if (!gl || !theme) return;
    gl.uniform2f(uni.uRes, swirlEl.width, swirlEl.height);
    gl.uniform1f(uni.uTime, clock);
    gl.uniform3fv(uni.uA, rgb01(theme.swirl[0]));
    gl.uniform3fv(uni.uB, rgb01(theme.swirl[1]));
    gl.uniform3fv(uni.uC, rgb01(theme.swirl[2]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ----- Flair particles ----- */
  const R = (a, b) => a + Math.random() * (b - a);
  const COUNT = { dust: 34, hearts: 16, sparkle: 26, stars: 60, leaves: 18, embers: 34, rain: 70, bubbles: 22, petals: 22, steam: 12, confetti: 34, snow: 60, fireflies: 22, bits: 46 };

  function spawn(type, anywhere) {
    const p = { x: R(0, w), y: anywhere ? R(0, h) : 0, a: R(0, Math.PI * 2), s: R(0.6, 1.4), ph: R(0, 6.3), spin: R(-1, 1) };
    const up = type === "embers" || type === "bubbles" || type === "steam";
    if (!anywhere) p.y = up ? h + 20 : -20;
    p.vy = { dust: R(-4, 4), hearts: R(-14, -6), sparkle: 0, stars: 0, leaves: R(22, 40), embers: R(-40, -18), rain: R(260, 380), bubbles: R(-30, -12), petals: R(18, 34), steam: R(-16, -8), confetti: R(30, 60), snow: R(18, 40), fireflies: R(-6, 6), bits: R(60, 140) }[type];
    p.vx = { dust: R(-5, 5), leaves: R(-12, 12), petals: R(10, 24), rain: -40, confetti: R(-12, 12), snow: R(-8, 8), fireflies: R(-8, 8), embers: R(-6, 6) }[type] || 0;
    if (type === "hearts" && !anywhere) p.y = h + 20;
    if (type === "confetti") p.c = ["#ff5a4d", "#ffb020", "#4bc27a", "#2f9bff", "#a46bff", "#ff77c8"][Math.floor(R(0, 6))];
    return p;
  }

  function seed() {
    if (!theme) return;
    const n = Math.round((COUNT[theme.fx] || 30) * Math.min(1.6, Math.max(0.6, (w * h) / (1280 * 800))));
    parts = Array.from({ length: n }, () => spawn(theme.fx, true));
  }

  function drawParts(dt, now) {
    fctx.clearRect(0, 0, w, h);
    if (!theme || !save.settings.particles) return;
    const type = theme.fx;
    const col = theme.accent;
    fctx.save();
    parts.forEach((p, i) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.spin * dt;
      if (type === "leaves" || type === "petals" || type === "snow") p.x += Math.sin(now / 900 + p.ph) * 12 * dt;
      if (type === "fireflies" || type === "dust") { p.vx += R(-6, 6) * dt; p.vy += R(-6, 6) * dt; p.vx *= 0.99; p.vy *= 0.99; }
      const off = p.y > h + 30 || p.y < -30 || p.x < -40 || p.x > w + 40;
      if (off) {
        if (type === "dust" || type === "fireflies") { p.x = (p.x + w) % w; p.y = (p.y + h) % h; }
        else { parts[i] = spawn(type, false); return; }
      }
      const tw = 0.5 + 0.5 * Math.sin(now / 500 + p.ph);
      const sz = Math.round(3 * p.s);
      fctx.globalAlpha = 0.55;
      fctx.fillStyle = col;
      switch (type) {
        case "stars":
        case "sparkle": {
          fctx.globalAlpha = type === "stars" ? 0.25 + 0.6 * tw : 0.8 * Math.max(0, tw * 2 - 1);
          const k = type === "stars" ? Math.max(1, sz - 1) : sz + 1;
          fctx.fillRect(p.x - k, p.y, k * 2 + 1, 1 + (k > 2));
          fctx.fillRect(p.x, p.y - k, 1 + (k > 2), k * 2 + 1);
          break;
        }
        case "hearts":
          fctx.globalAlpha = 0.5;
          fctx.save(); fctx.translate(p.x, p.y); fctx.scale(p.s * 0.6, p.s * 0.6); fctx.translate(-12, -12);
          fctx.fill(new Path2D(HEART_SVG_PATH)); fctx.restore();
          break;
        case "leaves":
        case "petals":
          fctx.globalAlpha = 0.7;
          fctx.fillStyle = type === "leaves" ? (i % 3 ? col : "#d9a03a") : (i % 2 ? col : "#ffe0ec");
          fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.a);
          fctx.beginPath(); fctx.ellipse(0, 0, 5 * p.s, 2.4 * p.s, 0, 0, Math.PI * 2); fctx.fill(); fctx.restore();
          break;
        case "embers":
          fctx.globalAlpha = 0.4 + 0.5 * tw;
          fctx.fillStyle = i % 3 ? col : "#ff5a1a";
          fctx.fillRect(p.x, p.y, sz, sz);
          break;
        case "rain":
          fctx.globalAlpha = 0.28;
          fctx.fillRect(p.x, p.y, 1, 10 * p.s);
          break;
        case "bits":
          fctx.globalAlpha = 0.18 + 0.4 * tw;
          for (let k = 0; k < 4; k++) fctx.fillRect(p.x, p.y - k * 9, 4, 6);
          break;
        case "bubbles":
          fctx.globalAlpha = 0.45;
          fctx.strokeStyle = col;
          fctx.lineWidth = 1.5;
          fctx.beginPath(); fctx.arc(p.x + Math.sin(now / 700 + p.ph) * 6, p.y, 3 + 4 * p.s, 0, Math.PI * 2); fctx.stroke();
          break;
        case "steam":
          fctx.globalAlpha = 0.12;
          fctx.fillStyle = "#ffffff";
          fctx.beginPath(); fctx.arc(p.x + Math.sin(now / 800 + p.ph) * 14, p.y, 10 * p.s, 0, Math.PI * 2); fctx.fill();
          break;
        case "confetti":
          fctx.globalAlpha = 0.75;
          fctx.fillStyle = p.c;
          fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.a * 3); fctx.fillRect(-3, -1.5, 6 * p.s, 3); fctx.restore();
          break;
        case "snow":
          fctx.globalAlpha = 0.7;
          fctx.fillStyle = "#ffffff";
          fctx.fillRect(p.x, p.y, sz - 1, sz - 1);
          break;
        case "fireflies":
          fctx.globalAlpha = 0.25 + 0.65 * tw;
          fctx.shadowColor = col; fctx.shadowBlur = 8;
          fctx.fillRect(p.x, p.y, 3, 3);
          fctx.shadowBlur = 0;
          break;
        default:
          fctx.globalAlpha = 0.18 + 0.2 * tw;
          fctx.fillRect(p.x, p.y, sz - 1, sz - 1);
      }
    });
    fctx.restore();
  }

  function moving() {
    return save.settings.bgMotion && !reduced.matches && !document.hidden;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    // 30 frames a second is plenty for a background, and halves the cost
    if (++frameNo % 2) return;
    if (!moving()) return;
    clock += dt * 2;
    drawSwirl();
    drawParts(dt * 2, now);
  }

  function setTheme(t) {
    const fxChanged = !theme || theme.fx !== t.fx;
    theme = t;
    if (fxChanged) seed();
    drawSwirl();
    if (!moving()) drawParts(0, performance.now());
  }

  initGl();
  window.addEventListener("resize", resize);
  reduced.addEventListener && reduced.addEventListener("change", () => setTheme(theme));
  resize();
  requestAnimationFrame(loop);
  return { setTheme, refresh: () => theme && setTheme(theme) };
})();
