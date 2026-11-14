/* =========================================================
   src/ui/map-3d.js
   The map in 3D (build 55, three.js: assets/vendor/three).

   The islands are still the game's own pictures, but they are wrapped
   around real shapes now. Each island's rock and ground (textures/map/
   <island>/under.png) is stretched over a relief worked out from the
   island's outline (isleForm, src/ui/map-isles.js): the grassy top is a
   slab that tilts away from you, the rock under it tapers to a point.
   Its trees, houses and signposts (over.png) stand up out of the grass
   as cut-outs, each at the depth of the spot it grows from. The stops,
   the shopkeepers, the home tree, the flags and smoke and the quest
   trail are drawn live, like before, onto cards standing at the depth of
   the row of the island they belong to. Behind the islands the clouds and
   the Coil sit on layers of their own, in front the mist over the islands
   you haven't reached and the sea of clouds.

   Move the mouse and the world turns a little: near things slide one
   way, far things the other (look-around.js gives the mouse; it still
   sways gently with no mouse). The camera is the same flat one as
   before (the page pans and zooms the picture with CSS, so the pins
   and every click keep working); only a shear of the depth is added,
   and the pins ride it too (m3Pins). It is the same low-resolution
   picture, shown with chunky pixels.

   Without WebGL, with the "3D map" setting off, and while the world is
   turned around for the Nightmare (map-deep.js paints that in 2D), the
   map is the flat one in map.js.
   ========================================================= */
"use strict";

const M3 = {
  ready: false, failed: false, on: false,
  renderer: null, canvas: null, cam: null, sceneBack: null, sceneFront: null, layers: {}, isl: {},
  C: 2.4,                  // depth per map pixel down the island's grassy top (its back rim is far, its front rim near)
  kx: 0.07, ky: 0.045,     // how far a unit of depth slides for a unit of looking
  sx: 0, sy: 0,            // this frame's slide (map pixels per unit of depth), x then y (down)
  frame: 0
};
const M3_PAD = [60, 40];   // the layers stretch past the map's edge so they never show an edge when they slide
const M3_DEPTH = { clouds: -150, coil: -60, fog: 120, sea: 150, isletBack: -26 };
const M3_ZR = 1000;        // depth range of the camera

/* The ground's shading: the relief catches a light from the upper left, a little different as the world turns.
   The top of the island (the flat slab) stays as painted; slopes and the underside of the rock fall off. */
const M3_SHADE = {
  look: { value: new THREE.Vector2(0, 0) },
  strength: { value: 0.3 }
};
function m3GroundMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uLook: M3_SHADE.look, uK: M3_SHADE.strength },
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN;
      void main() { vUv = uv; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec2 uLook; uniform float uK;
      varying vec2 vUv; varying vec3 vN;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.5) discard;
        vec3 n = normalize(vN);
        if (n.z < 0.0) n = -n;
        n = normalize(n + vec3(-uLook.x * 0.3, uLook.y * 0.3, 0.0));
        vec3 L = normalize(vec3(-0.35, 0.8, 0.5));
        float flat0 = dot(normalize(vec3(0.0, 2.4, 1.0)), L);
        float shade = clamp(1.0 + uK * (dot(n, L) - flat0), 0.62, 1.12);
        gl_FragColor = vec4(c.rgb * shade, 1.0);
      }`
  });
}

const m3Enabled = () => !(typeof save !== "undefined" && save && save.settings && save.settings.map3d === false);
const m3Smooth = (a, b, k) => a + (b - a) * k;

/* ----- Start-up: the canvas, the camera and the layers behind and in front of the islands ----- */
function m3Init() {
  if (M3.ready || M3.failed) return M3.ready;
  if (!A3_OK) { M3.failed = true; return false; }
  try {
    const canvas = document.createElement("canvas");
    canvas.id = "map-3d";
    canvas.setAttribute("aria-hidden", "true");
    mapCanvas.parentNode.insertBefore(canvas, mapCanvas.nextSibling);
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    r.setPixelRatio(1);
    r.setSize(MAP_W, MAP_H, false);
    r.setClearColor(0x000000, 0);
    r.autoClear = false;
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); M3.failed = true; M3.ready = false; m3Off(); });
    M3.renderer = r;
    M3.canvas = canvas;
    M3.cam = new THREE.Camera();
    M3.sceneBack = new THREE.Scene();
    M3.sceneFront = new THREE.Scene();
    // the layers across the whole map: clouds and birds far behind, the Coil, mist and the sea in front
    M3.layers.clouds = m3Layer(M3.sceneBack, M3_DEPTH.clouds, 0);
    M3.layers.coil = m3Layer(M3.sceneBack, M3_DEPTH.coil, 1);
    M3.layers.fog = m3Layer(M3.sceneFront, M3_DEPTH.fog, 0);
    M3.layers.sea = m3Layer(M3.sceneFront, M3_DEPTH.sea, 1, 90);
    MAP_ORDER.forEach(key => { M3.isl[key] = m3MakeIsland(key); });
    M3.ready = true;
  } catch (e) {
    console.warn("The 3D map could not start; the flat map is used.", e);
    M3.failed = true;
    return false;
  }
  return true;
}

function m3Tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* A card as big as the map (and a margin), at a depth: the picture on it is painted in map pixels */
function m3Layer(scene, w, order, strip = 0) {
  const c = document.createElement("canvas");
  // strip: only this many map pixels at the very bottom (the sea), so very little is sent to the graphics card
  c.width = MAP_W + M3_PAD[0] * 2; c.height = strip || MAP_H + M3_PAD[1] * 2;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  const tex = m3Tex(c);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width, c.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  mesh.position.set(MAP_W / 2, strip ? -(MAP_H + M3_PAD[1] - strip / 2) : -MAP_H / 2, w);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { c, g, tex, mesh, strip };
}
function m3Clear(L) {
  L.g.setTransform(1, 0, 0, 1, 0, 0);
  L.g.clearRect(0, 0, L.c.width, L.c.height);
  L.g.setTransform(1, 0, 0, 1, M3_PAD[0], M3_PAD[1]);
}

/* ----- How deep the island is at a spot -----
   The picture is the island seen from a slant. A point on the grassy top, dy pixels in front of the
   island's middle, is dy * C toward you (its back rim is far). Under the front rim the rock tapers in,
   so it recedes the lower it goes: each row down is a copy of the outline, smaller by the island's own
   taper (ISLE_SHAPE.taper) and leaning as it leans. xl, dy: from the island's middle. */
function m3Forms(key) {
  const form = isleForm(key);
  return { form, S: ISLE_SHAPE[key], d: ISLANDS[key].dir, reach: form.reach };
}
function m3RockW(F, xl, dy) {
  const { form, S, d, reach } = F;
  let fr = 0;
  const rmax = S.depth + 70;
  for (let r = 0; r <= rmax; r++) {
    const T = Math.max(0.03, S.taper(Math.min(1, r / S.depth)));
    const xs = Math.round((xl - S.lean * r * d) / T);
    const sp = form.main[xs + reach];
    fr = sp ? sp[1] * T : 0;
    if (fr + r >= dy) break;
  }
  return fr * M3.C;
}
function m3GroundW(F, xl, dy) {
  const { form, reach } = F;
  let s = form.top[xl + reach];
  if (!s) {
    // off the grass (a hanging root, a spike): the nearest column's rim
    for (let k = 1; k < 20 && !s; k++) s = form.top[xl + reach - k] || form.top[xl + reach + k];
    if (!s) return 0;
    return dy <= s[1] ? s[0] * M3.C * 0.5 : m3RockW(F, xl, dy);
  }
  if (dy < s[0]) return s[0] * M3.C;
  if (dy <= s[1]) return dy * M3.C;
  return m3RockW(F, xl, dy);
}

/* A grid of little squares over a picture, only where the picture has something, each corner at its
   own depth: the picture wraps over it. step: how many picture pixels a square covers. */
function m3Lattice(data, W, H, step, wOf) {
  const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
  const ids = new Map(), pos = [], uv = [], idx = [];
  const V = (i, j) => {
    const k = j * (cols + 1) + i;
    let v = ids.get(k);
    if (v === undefined) {
      v = pos.length / 3; ids.set(k, v);
      const px = Math.min(W, i * step), py = Math.min(H, j * step);
      pos.push(px, -py, wOf(px, py));
      uv.push(px / W, 1 - py / H);
    }
    return v;
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let any = false;
    for (let y = j * step; y < Math.min(H, (j + 1) * step) && !any; y++) for (let x = i * step; x < Math.min(W, (i + 1) * step); x++) if (data[(y * W + x) * 4 + 3] > 24) { any = true; break; }
    if (!any) continue;
    const a = V(i, j), b = V(i + 1, j), c = V(i, j + 1), d = V(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  return geo;
}

/* The props over the grass (trees, houses, signposts) are cut out by their outline: each separate piece
   (pieces a pixel or two apart count as one) stands at the depth of the spot it's rooted in. */
function m3Pieces(data, W, H, F, cx, cy) {
  const lab = new Int32Array(W * H);
  const wOfPix = new Float32Array(W * H);
  let n = 0;
  const stack = [];
  for (let p0 = 0; p0 < W * H; p0++) {
    if (lab[p0] || data[p0 * 4 + 3] <= 24) continue;
    n++;
    const members = [];
    stack.push(p0); lab[p0] = n;
    while (stack.length) {
      const p = stack.pop(); members.push(p);
      const x = p % W, y = (p / W) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const q = qy * W + qx;
        if (!lab[q] && data[q * 4 + 3] > 24) { lab[q] = n; stack.push(q); }
      }
    }
    let base = 0;
    members.forEach(p => { base = Math.max(base, (p / W) | 0); });
    let sx = 0, c = 0;
    members.forEach(p => { if (((p / W) | 0) >= base - 1) { sx += p % W; c++; } });
    const w = m3GroundW(F, Math.round(sx / c) - cx, base - cy) + 1.5;
    members.forEach(p => { wOfPix[p] = w; });
  }
  return wOfPix;
}

/* ----- One island ----- */
function m3MakeIsland(key) {
  const I = ISLANDS[key], F = m3Forms(key), form = F.form;
  const under = texCanvas(`map:${key}:under`), fog = texCanvas(`map:${key}:fog`);
  const W = under.width, H = under.height;
  const cx = Math.floor(W / 2), cy = ISLE_ROOM + form.back;
  const scene = new THREE.Scene();
  const grp = new THREE.Group();            // local (x, -y) in the island's own picture; the island bobs by moving this
  scene.add(grp);
  const O = { key, I, F, W, H, cx, cy, scene, grp, tag: null, order: MAP_ORDER.indexOf(key) };

  // its ground: the rock and grass, with the paths on them
  O.groundC = document.createElement("canvas"); O.groundC.width = W; O.groundC.height = H;
  O.groundTex = m3Tex(O.groundC);
  O.groundTex.colorSpace = THREE.NoColorSpace;      // the shader writes the picture's own colors, untouched
  const shape = (() => {   // the union of the island and its mist silhouette
    const a = under.getContext("2d").getImageData(0, 0, W, H).data, b = fog.width === W && fog.height === H ? fog.getContext("2d").getImageData(0, 0, W, H).data : a;
    const u = new Uint8ClampedArray(a.length);
    for (let i = 3; i < a.length; i += 4) u[i] = Math.max(a[i], b[i]);
    return u;
  })();
  const groundGeo = m3Lattice(shape, W, H, 2, (px, py) => m3GroundW(F, px - cx, py - cy));
  groundGeo.computeVertexNormals();
  O.ground = new THREE.Mesh(groundGeo, m3GroundMaterial(O.groundTex));
  O.ground.renderOrder = 10;
  O.ground.frustumCulled = false;
  grp.add(O.ground);

  // its props: cut-outs standing in the grass
  O.propsC = document.createElement("canvas"); O.propsC.width = W; O.propsC.height = H;
  O.propsTex = m3Tex(O.propsC);
  O.props = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: O.propsTex, alphaTest: 0.5, side: THREE.DoubleSide }));
  O.props.renderOrder = 11;
  O.props.frustumCulled = false;
  grp.add(O.props);

  // the islets that float about it, each at its own spot behind
  O.islets = (ISLE_SHAPE[key].islets || []).map(([f, dy], k) => {
    const art = isletArt(key, k);
    const tex = m3Tex(art.c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(art.c.width, art.c.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, depthTest: false, depthWrite: false }));
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    mesh.position.z = Math.max(-80, Math.min(80, dy * M3.C)) + M3_DEPTH.isletBack;
    scene.add(mesh);
    return { f, dy, k, art, mesh };
  });

  // what's drawn live: the living details and the trail (one card), and the stops by row (back, middle, front)
  const rx = 250, y0 = Math.round(I.y - 140), y1 = Math.round(I.y + form.front + 120);
  O.rect = { x0: Math.round(I.x - rx), y0, w: rx * 2, h: y1 - y0 };
  const card = (order, w, R = O.rect) => {
    const c = document.createElement("canvas"); c.width = R.w; c.height = R.h;
    const g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingEnabled = false;
    const tex = m3Tex(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width, c.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    mesh.position.set(R.x0 + c.width / 2, -(R.y0 + c.height / 2), w);
    scene.add(mesh);
    return { c, g, tex, mesh, w, R };
  };
  O.live = card(12, 30, O.rect);
  // the stops reach 150 to either side of the middle, a boss's banner or the home tree up to ~170 above their feet
  O.brect = { x0: Math.round(I.x - 180), y0: Math.round(I.y - 175), w: 360, h: Math.round(form.front + 175 + 40) };
  O.band = { b: card(13, -23 * M3.C, O.brect), m: card(14, -5 * M3.C, O.brect), f: card(15, 17 * M3.C, O.brect) };
  return O;
}

/* Which row of the island a stop stands in */
const m3Band = id => { const dy = NODE_SPOTS[id][1]; return dy >= 8 ? "f" : dy >= -15 ? "m" : "b"; };

/* Paint an island's ground and props again (its paths changed, or it came out of the clouds) */
function m3Rebuild(O, fogged, tag) {
  const { key, W, H, cx, cy, F } = O;
  const g = O.groundC.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  g.drawImage(texCanvas(`map:${key}:${fogged ? "fog" : "under"}`), 0, 0);
  const pg = O.propsC.getContext("2d");
  pg.imageSmoothingEnabled = false;
  pg.clearRect(0, 0, W, H);
  if (!fogged) {
    paintIslePaths(g, key, cx, cy, ISLANDS[key]);
    texLayer(pg, `map:${key}:over`, 0, 0);
    paintIsleWays(pg, key, isleAt(key, cx, cy), isleFree(key));
  }
  O.groundTex.needsUpdate = true;
  O.propsTex.needsUpdate = true;
  O.props.geometry.dispose();
  if (fogged) { O.props.geometry = new THREE.BufferGeometry(); }
  else {
    const data = pg.getImageData(0, 0, W, H).data;
    const wPix = m3Pieces(data, W, H, F, cx, cy);
    O.props.geometry = m3Lattice(data, W, H, 1, (px, py) => {
      let w = -1e9;
      for (let yy = py - 1; yy <= py; yy++) for (let xx = px - 1; xx <= px; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (data[(yy * W + xx) * 4 + 3] > 24) w = Math.max(w, wPix[yy * W + xx]);
      }
      return w < -1e8 ? 0 : w;
    });
  }
  O.tag = tag;
}

/* ----- Each frame ----- */
const m3Reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function m3Look(t) {
  const lk = typeof SCR_LOOK !== "undefined" ? SCR_LOOK : { x: 0, y: 0 };
  const sway = m3Reduce ? 0 : 1;
  const lx = lk.x + sway * 0.3 * Math.sin(t * 0.33), ly = lk.y + sway * 0.16 * Math.sin(t * 0.27 + 1.3);
  M3.sx = -lx * M3.kx;            // near things slide against the look, far things with it
  M3.sy = -ly * M3.ky;            // (down is positive)
  M3.cam.projectionMatrix.set(
    2 / MAP_W, 0, 2 * M3.sx / MAP_W, -1,
    0, 2 / MAP_H, -2 * M3.sy / MAP_H, 1,
    0, 0, -1 / M3_ZR, 0,
    0, 0, 0, 1);
  M3.cam.projectionMatrixInverse.copy(M3.cam.projectionMatrix).invert();
  M3_SHADE.look.value.set(lx, ly);
}

/* The part of the map on screen, in map pixels */
function m3View() {
  if (M3.view && M3.frame % 5) return M3.view;              // the screen's own measuring is slow: a few times a second is plenty
  const m = new DOMMatrix(getComputedStyle(mapWorldEl).transform);
  const s = (m.a || 1) * 2, vw = mapEl.clientWidth, vh = mapEl.clientHeight;
  const v = { x0: (0 - m.e) / s - 60, x1: (vw - m.e) / s + 60, y0: (0 - m.f) / s - 60, y1: (vh - m.f) / s + 60 };
  v.far = v.x1 - v.x0 > 560 || v.y1 - v.y0 > 700;          // the whole map in view
  return (M3.view = v);
}

function m3Clouds(t) {
  const L = M3.layers.clouds, g = L.g;
  m3Clear(L);
  for (let i = 0; i < 22; i++) {
    const w = 18 + mapHash(i, 7, 3) * 30;
    const x = ((mapHash(i, 7, 5) * (MAP_W + 120) + t * (1.2 + (i % 5) * 0.35)) % (MAP_W + 120)) - 60;
    const y = 20 + (i % 11) * (MAP_H / 11) + mapHash(i, 7, 9) * 24;
    const [r, gg, b] = skyAt(y);
    drawCloud(g, x, y, w, `rgba(${Math.round((r + 255 * 2) / 3)},${Math.round((gg + 255 * 2) / 3)},${Math.round((b + 255 * 2) / 3)},0.5)`);
  }
  const ph = (t / 46) % 1, fx = -40 + ph * (MAP_W + 80), fy = 640 - ph * 60 + Math.sin(t * 0.8) * 4;
  for (let i = 0; i < 6; i++) {
    const bx = fx - Math.abs(i - 2.5) * 7 + (i > 2 ? 3 : 0), by = fy + Math.abs(i - 2.5) * 4, up = Math.sin(t * 9 + i) > 0;
    mapRect(g, bx - 2, by - (up ? 1 : 0), 2, 1, "#3a3a4a"); mapRect(g, bx + 1, by - (up ? 1 : 0), 2, 1, "#3a3a4a"); mapRect(g, bx, by, 1, 1, "#3a3a4a");
  }
  L.tex.needsUpdate = true;
}
function m3Coil(t) {
  const L = M3.layers.coil;
  m3Clear(L);
  drawCoil(L.g, t);
  L.tex.needsUpdate = true;
}
function m3FogSea(t) {
  const F = M3.layers.fog, S = M3.layers.sea;
  let any = false;
  MAP_ORDER.forEach(k => {
    const target = placeFogged(k) ? 1 : 0;
    if (mapFog[k] === undefined) mapFog[k] = target;
    mapFog[k] += (target - mapFog[k]) * 0.12;
  });
  m3Clear(F);
  const g = F.g;
  MAP_ORDER.forEach(k => {
    if (mapFog[k] < 0.01) return;
    any = true;
    const p = ISLANDS[k];
    const [r, gg, bb] = skyAt(p.y);
    const tint = q => `rgb(${Math.round(r + (255 - r) * q)},${Math.round(gg + (255 - gg) * q)},${Math.round(bb + (255 - bb) * q)})`;
    g.globalAlpha = mapFog[k] * 0.85;
    for (let i = 0; i < 13; i++) {
      const w = 30 + mapHash(i, p.n, 4) * 36;
      drawCloud(g, p.x - w / 2 + Math.sin(t * 0.35 + i) * 6 + (i - 6) * 25, p.y - 2 + (i % 3) * 13 + mapHash(i, p.n, 6) * 8, w, tint(i % 2 ? 0.7 : 0.55));
    }
    g.globalAlpha = 1;
  });
  F.mesh.visible = any;
  if (any) F.tex.needsUpdate = true;
  const sg = S.g;
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.clearRect(0, 0, S.c.width, S.c.height);
  sg.setTransform(1, 0, 0, 1, M3_PAD[0], -(MAP_H + M3_PAD[1] - S.strip));          // the strip's top is this far down the map
  for (let x = -M3_PAD[0]; x < MAP_W + M3_PAD[0]; x++) {
    const h = 10 + Math.round(Math.sin((x + t * 4) * 0.13) * 2 + Math.sin((x - t * 2.5) * 0.31) * 1.5);
    mapRect(sg, x, MAP_H - h, 1, h + M3_PAD[1], "#fbe9dc");
    mapRect(sg, x, MAP_H - h, 1, 2, "#ffffff");
    if ((x + Math.floor(t * 6)) % 23 === 0) mapRect(sg, x, MAP_H - h + 3, 4, 1, "#f2cdb8");
  }
  S.tex.needsUpdate = true;
}

/* Your snake, coiled by the stop it waits at (the same as drawTraveler, without its own bobbing) */
function m3Traveler(g, t, key, id) {
  const isl = ISLANDS[key], p = nodeAt(key, id), skin = currentSkin();
  const hx = p.x - isl.dir * 8, hy = p.y + 3;
  for (let i = 6; i >= 1; i--) {
    const a = -isl.dir * (i * 0.95) + t * 0.6;
    mapRect(g, hx + Math.cos(a) * 2.6 - 1, hy + Math.sin(a) * 1.4, 2, 2, skin.colors[skin.order[i % skin.order.length]]);
  }
  const look = Math.sin(t * 0.9) > 0 ? 1 : -1, hb = Math.round(Math.sin(t * 3) * 0.6);
  mapRect(g, hx - 1, hy - 3 + hb, 2, 3, skin.colors[skin.order[0]]);
  mapRect(g, hx + (look > 0 ? 0 : -1), hy - 3 + hb, 1, 1, "#ffffff");
  if (Math.sin(t * 2.3) > 0.85) mapRect(g, hx + (look > 0 ? 1 : -2), hy - 2 + hb, 1, 1, "#ff3b6b");
}

function m3Island(O, t, view, trav) {
  const { key, I } = O;
  const fogged = placeFogged(key);
  if (O.tag === null || (M3.frame + O.order) % 6 === 0) {
    islandArt(key);                              // keeps the old cache (its drips, the deep side) up to date
    const tag = fogged ? "fog" : "on:" + pathTag(key);
    if (O.tag !== tag) m3Rebuild(O, fogged, tag);
  }
  const by = bob(I, t);
  O.grp.position.set(I.x - O.cx, -(I.y - O.cy) - by, 0);
  O.props.visible = !fogged;
  const mid = 0;
  // the islets bob on their own beat
  O.islets.forEach(s => {
    const b = Math.round(Math.sin(t * (0.8 + s.k * 0.17) + I.phase + s.k * 2.1) * 1.6);
    s.mesh.visible = !fogged;
    s.mesh.position.x = Math.round(I.x + I.dir * s.f - s.art.ox) + s.art.c.width / 2;
    s.mesh.position.y = -(Math.round(I.y + s.dy - s.art.oy + b) + s.art.c.height / 2) - mid;
  });
  const R = O.rect;
  const seen = !(view.x1 < R.x0 || view.x0 > R.x0 + R.w || view.y1 < R.y0 || view.y0 > R.y0 + R.h);
  const cards = [O.live, O.band.b, O.band.m, O.band.f];
  cards.forEach(c => { c.mesh.visible = !fogged; c.mesh.position.y = -(c.R.y0 + c.R.h / 2) - by; });
  // what moves is repainted (and sent to the graphics card) a few times a second, each island on its own beat;
  // far out, where it's tiny, even less often
  const every = view.far ? 6 : 3;
  if (fogged || !seen || ((M3.frame + O.order) % every && O.drawn)) return;
  O.drawn = true;
  // clear the cards and paint what moves
  cards.forEach(c => { c.g.setTransform(1, 0, 0, 1, 0, 0); c.g.clearRect(0, 0, c.c.width, c.c.height); c.g.setTransform(1, 0, 0, 1, -c.R.x0, -c.R.y0); });
  const lg = O.live.g;
  drawIsleLiving(lg, key, t, 0);
  try { if (typeof drawZoneCues === "function") drawZoneCues(lg, key, t); } catch (e) { /* the map can paint without them */ }
  drawQuestTrail(lg, key, t, 0);
  if (typeof drawDeepHole === "function") drawDeepHole(lg, key, t, 0);
  NODE_ORDER.forEach(id => drawNodeArt(O.band[m3Band(id)].g, key, id, nodeState(key, id), t, 0));
  if (trav && trav.key === key) m3Traveler(O.band[m3Band(trav.id === "home" ? "home" : trav.id)].g, t, key, trav.id);
  cards.forEach(c => { c.tex.needsUpdate = true; });
}

/* ----- The pins ride the slide: each stands at the depth of its stop ----- */
function m3PinW(pin) {
  if (pin._m3w !== undefined) return pin._m3w;
  let w = 0;
  const k = pin.dataset.key || "";
  const m = /^(lv|np)-(\w+)-(\w+)$/.exec(k);
  if (m && NODE_SPOTS[/^\d+$/.test(m[3]) ? +m[3] : m[3]]) w = NODE_SPOTS[/^\d+$/.test(m[3]) ? +m[3] : m[3]][1] * M3.C;
  else if (pin.classList.contains("traveler")) { const tv = travelerSpot(); w = (NODE_SPOTS[tv.id] || [0, 0])[1] * M3.C; }
  pin._m3w = w;
  return w;
}
function m3Pins(t, on) {
  if (!M3.pins || M3.pinsN !== mapPinsEl.childElementCount) { M3.pins = Array.from(mapPinsEl.querySelectorAll(".map-pin")); M3.pinsN = mapPinsEl.childElementCount; }
  M3.pins.forEach(pin => {
    if (pin.hidden && pin._m3s === "") return;
    const v = bob(ISLANDS[pin.dataset.area], t) * 2;
    if (pin._bob !== v) { pin._bob = v; pin.style.setProperty("--bob", v + "px"); }
    let ox = 0, oy = 0;
    if (on) {
      if (pin.classList.contains("traveler")) pin._m3w = undefined;      // it moves between stops
      const w = m3PinW(pin);
      ox = Math.round(M3.sx * w * 2); oy = Math.round(M3.sy * w * 2);
    }
    const s = ox || oy ? `${ox}px ${oy}px` : "";
    if (pin._m3s !== s) { pin._m3s = s; pin.style.translate = s; }
  });
}

/* ----- Switching between the 3D map and the flat one ----- */
function m3Off() {
  if (!M3.on) return;
  M3.on = false;
  mapEl.classList.remove("m3");
  m3Pins(0, false);
}
function m3Usable() {
  return m3Enabled() && !M3.failed && currentScreen === "modes" && !(typeof mapFlip !== "undefined" && mapFlip);
}

const m3FlatMap = drawMap;
window.drawMap = function (ts) {
  const t = ts / 1000;
  if (!m3Usable()) { m3Off(); return m3FlatMap(ts); }
  const turn = typeof deepWorldTurn === "function" ? deepWorldTurn(t) : null;
  if (turn && (turn.k !== 1 || turn.mirrored || turn.back)) { m3Off(); return m3FlatMap(ts); }
  if (!m3Init()) { m3Off(); return m3FlatMap(ts); }
  if (!M3.on) { M3.on = true; mapEl.classList.add("m3"); }
  M3.frame++;
  drawSky(t);
  m3Look(t);
  const view = m3View();
  // the big cards are sent to the graphics card only a few times a second: the clouds crawl, the sea rolls slowly
  if (M3.frame % 8 === 1 || !M3.cloudsDone) { m3Clouds(t); M3.cloudsDone = true; }
  if (M3.frame % 4 === 0 || !M3.coilDone) { m3Coil(t); M3.coilDone = true; }
  if (M3.frame % 4 === 0 || !M3.fogDone) { m3FogSea(t); M3.fogDone = true; }
  const trav = camp ? travelerSpot() : null;
  MAP_ORDER.forEach(k => m3Island(M3.isl[k], t, view, trav));
  const r = M3.renderer;
  r.clear();
  r.render(M3.sceneBack, M3.cam);
  MAP_ORDER.forEach(k => { r.clearDepth(); r.render(M3.isl[k].scene, M3.cam); });
  r.clearDepth();
  r.render(M3.sceneFront, M3.cam);
  m3Pins(t, true);
};
