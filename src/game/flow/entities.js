/* =========================================================
   src/game/flow/entities.js
   The hazards and power-ups added in build 46: what each one is,
   how it turns up, what it does on its own, what touching it does,
   and how it's drawn. Which island has which comes from the
   [spawns.<type>] parts of each world.txt.
   ========================================================= */
"use strict";

let entities = [];        // { type, x, y, size, small, spawnAt, expiresAt, ...its own state }

const tnow = () => performance.now();
const headKey = () => cellKey(snake.x, snake.y);
const inBoard = (x, y) => x >= 0 && y >= 0 && x < boardSize && y < boardSize;
const wrapBoard = v => ((v % boardSize) + boardSize) % boardSize;
const stepToward = (from, to) => {
  // one square toward a target, the short way round on boards that wrap
  let d = to - from;
  if (edgeMode !== "wall" && Math.abs(d) > boardSize / 2) d = -Math.sign(d) * (boardSize - Math.abs(d));
  return Math.sign(d) * cell;
};
const nearHead = (e, squares) => Math.abs(e.x - snake.x) <= squares * cell && Math.abs(e.y - snake.y) <= squares * cell;
const bodyHas = (x, y) => snake.cells.some(c => c.x === x && c.y === y);
const isPower = type => !!(ENTITY_TYPES[type] && ENTITY_TYPES[type].kind === "power");

/* A soft disc for power-ups, so every power-up reads as "good" at a glance */
function powerDisc(g, x, y, w, color, ts) {
  const pulse = 0.5 + 0.5 * Math.sin(ts / 220);
  g.save();
  g.shadowColor = color;
  g.shadowBlur = Math.max(4, w * (0.5 + pulse * 0.5));
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath();
  g.arc(x + w / 2, y + w / 2, w * 0.56, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/* An entity's picture: entity:<type>:<size> in textures/board/entities/, 19 pixels (a square, less the
   gap between squares) or 9 for half-size squares, scaled for any other size; its frames are its looks */
function entityPic(g, type, x, y, w, frame = 0) {
  const size = w === 9 ? 9 : 19;
  texBoard(g, `entity:${type}:${size}`, x, y, w / size, frame);
}
/* ...the same painted pixel by pixel (texPaint), with an alpha over it or its key color in a color the game
   picks (the phantom fading, the star's cycling hue) */
function entityPaint(g, type, x, y, w, opts) {
  const size = w === 9 ? 9 : 19, id = `entity:${type}:${size}`, r = texResolve(id), a = (r && r.e.anchor) || [0, 0], k = w / size;
  g.save();
  g.translate(x - a[0] * k, y - a[1] * k);
  g.scale(k, k);
  texPaint(g, id, 0, 0, opts);
  g.restore();
}

function glyph(g, x, y, w, text, color) {
  g.save();
  g.fillStyle = color;
  g.font = `700 ${Math.max(6, Math.round(w * 0.62))}px ${GAME_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x + w / 2, y + w / 2 + 1);
  g.restore();
}

/* =========================================================
   The catalogue. kind: hazard or power.
   life: [min, max] ms on the board (none = stays until used).
   tick(e, ts, delta): what it does on its own each frame.
   touch(e, ts): the snake's head reached it. Returns true if the run ended.
   ========================================================= */
const ENTITY_TYPES = {
  /* ---------------- Hazards ---------------- */
  bramble: {
    kind: "hazard", color: "#3f7a2a", label: "Bramble", placed: true, smash: true,
    fact: "brambles grow and prick",
    tick(e, ts) {
      // Brambles creep into a free square next to them every so often
      const pace = (1 + getTrackValue("pruning") / 100) * (nm.overgrowth ? 0.4 * (1 + getTrackValue("nm_bramble") / 100) : 1);
      if (!e.growAt) e.growAt = ts + randomDelay(BRAMBLE_GROW) * pace;
      if (ts < e.growAt) return;
      e.growAt = ts + randomDelay(BRAMBLE_GROW) * pace;
      const cap = (spec.bramble && spec.bramble.max) || 30;
      if (entities.filter(o => o.type === "bramble").length >= cap) return;
      const set = occupiedSet();
      set.add(cellKey(snake.x + snake.dx, snake.y + snake.dy));
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of dirs) {
        const x = e.x + dx * cell, y = e.y + dy * cell;
        if (!inBoard(x, y) || set.has(cellKey(x, y)) || nearHead({ x, y }, 1)) continue;
        entities.push({ type: "bramble", x, y, size: 1, small: false, spawnAt: ts });
        return;
      }
    },
    touch(e) {
      removeEntity(e);
      sfx("flea");
      if (roll(getTrackValue("thickhide"))) { showToast("Thick Hide! The thorns couldn't get through."); return false; }
      return takeHit(0.5, "bramble");
    },
    draw(g, x, y, w) { entityPic(g, "bramble", x, y, w); }
  },

  wasp: {
    kind: "hazard", color: "#ffcf33", label: "Wasp", life: [7000, 10000], smash: true,
    fact: "wasps chase you",
    tick(e, ts) {
      if (!e.moveAt) e.moveAt = ts + 600;
      if (ts < e.moveAt) return;
      e.moveAt = ts + WASP_MS * (1 + getTrackValue("smoke") / 100);
      // Wasps fly over everything except walls, a square at a time, straight at the head
      const tx = snake.x, ty = snake.y;
      const options = [];
      const sx = stepToward(e.x, tx), sy = stepToward(e.y, ty);
      if (sx) options.push([sx, 0]);
      if (sy) options.push([0, sy]);
      if (options.length === 2 && Math.random() < 0.5) options.reverse();
      for (const [dx, dy] of options) {
        let x = e.x + dx, y = e.y + dy;
        if (edgeMode !== "wall") { x = wrapBoard(x); y = wrapBoard(y); }
        if (!inBoard(x, y) || walls.has(cellKey(x, y)) || huskAt(x, y)) continue;
        if (bodyHas(x, y) && !(x === snake.x && y === snake.y)) continue;   // it won't land on the body
        e.fromX = e.x; e.fromY = e.y; e.hopAt = ts;
        e.x = x; e.y = y;
        if (x === snake.x && y === snake.y) {
          removeEntity(e);
          if (feverOn() || starOn()) { smashEntity(e); return; }
          sfx("flea");
          if (roll(getTrackValue("nm_hive"))) { showToast("Netting! The sting missed."); return; }
          takeHit(0.5, "wasp");
        }
        return;
      }
    },
    touch(e) {
      removeEntity(e);
      sfx("flea");
      if (roll(getTrackValue("nm_hive"))) { showToast("Netting! The sting missed."); return false; }
      return takeHit(0.5, "wasp");
    },
    draw(g, x, y, w, ts) { entityPic(g, "wasp", x, y, w, Math.sin(ts / 30) > 0 ? 0 : 1); }
  },

  lightning: {
    kind: "hazard", color: "#9ad8ff", label: "Lightning", life: [3200, 3200],
    fact: "lightning strikes where it flashes",
    spawn(e, ts) { e.strikeAt = ts + LIGHTNING_WARN * (nm.supercell ? 0.5 : 1) * (1 + getTrackValue("forecast") / 100); e.expiresAt = e.strikeAt + 450; },
    tick(e, ts) {
      if (e.struck || ts < e.strikeAt) return;
      e.struck = true;
      sfx("fire");
      buzz(25);
      const span = (e.size || 1) * cell;
      const inside = c => c.x >= e.x && c.x < e.x + span && c.y >= e.y && c.y < e.y + span;
      rocks = rocks.filter(r => !inside(r));                    // lightning splits rocks
      if (snake.cells.some(inside) || inside(snake)) {
        if (roll(getTrackValue("rod"))) { showToast("Lightning Rod! The bolt went to ground."); return; }
        takeHit(1, "lightning");
      } else if (getTrackValue("static") > 0 && nearHead(e, 2)) {
        addScore(getTrackValue("static") / 100 * 100 * scoreMultiplier);
        showToast("Static charge! Points for a near miss.");
      }
    },
    touch() { return false; },        // only the strike hurts
    passable: true,
    draw(g, x, y, w, ts, e) {
      if (!e.struck) {
        // the warning square, blinking (two frames), and its "!"
        const on = Math.floor(ts / 120) % 2;
        entityPic(g, "lightning", x, y, w, on);
        glyph(g, x, y, w, "!", on ? "#fff7a0" : "#9ad8ff");
      } else {
        g.save();
        g.shadowColor = "#fff";
        g.shadowBlur = w;
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.fillRect(x, y, w, w);
        g.strokeStyle = "#fff7a0";
        g.lineWidth = Math.max(1, w * 0.12);
        g.beginPath();
        g.moveTo(x + w * 0.55, y - w * 0.6); g.lineTo(x + w * 0.35, y + w * 0.4); g.lineTo(x + w * 0.6, y + w * 0.45); g.lineTo(x + w * 0.4, y + w);
        g.stroke();
        g.restore();
      }
    }
  },

  ice: {
    kind: "hazard", color: "#bfe8ff", label: "Ice", placed: true, passable: true, floor: true,
    fact: "you can't turn on ice",
    touch() { return false; },
    draw(g, x, y, w) { entityPic(g, "ice", x, y, w); }
  },

  bomb: {
    kind: "hazard", color: "#2a2a30", label: "Bomb", life: [99999, 99999],
    fact: "bombs blow up whatever is near",
    spawn(e, ts) { e.blowAt = ts + BOMB_FUSE * (nm.shortfuse ? 0.5 : 1) * (1 + (getTrackValue("longfuse") + getTrackValue("nm_keg")) / 100); e.expiresAt = e.blowAt + 500; },
    tick(e, ts) {
      if (!e.blown && ts >= e.blowAt) explode(e);
    },
    touch(e) { explode(e); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts, e) {
      if (e.blown) {
        const r = (1 + (e.size || 1)) * cell * 1.5;
        g.save();
        g.globalAlpha = Math.max(0, (e.expiresAt - ts) / 500);
        g.fillStyle = "#ffb020";
        g.beginPath();
        g.arc(x + w / 2, y + w / 2, r * (1 - (e.expiresAt - ts) / 1000), 0, Math.PI * 2);
        g.fill();
        g.restore();
        return;
      }
      // the bomb, its fuse sparking (faster near the end), and the seconds it has left
      const left = Math.max(0, e.blowAt - ts);
      entityPic(g, "bomb", x, y, w, Math.floor(ts / (left < 1500 ? 80 : 200)) % 2);
      glyph(g, x, y + w * 0.08, w, String(Math.ceil(left / 1000)), "#ff5a61");
    }
  },

  ghost: {
    kind: "hazard", color: "#e8ecff", label: "Ghost", life: [9000, 13000], smash: true, passable: true,
    fact: "ghosts drift through walls",
    tick(e, ts) {
      if (!e.moveAt) e.moveAt = ts + 900;
      if (ts < e.moveAt) return;
      e.moveAt = ts + GHOST_MS * (nm.poltergeist ? 0.7 : 1) * (1 + (getTrackValue("lantern") + getTrackValue("nm_moor")) / 100);
      const dx = stepToward(e.x, snake.x), dy = stepToward(e.y, snake.y);
      const [mx, my] = dx && dy ? (Math.random() < 0.5 ? [dx, 0] : [0, dy]) : [dx, dy];
      let x = e.x + mx, y = e.y + my;
      if (edgeMode !== "wall") { x = wrapBoard(x); y = wrapBoard(y); }
      if (!inBoard(x, y) || huskAt(x, y)) return;
      e.fromX = e.x; e.fromY = e.y; e.hopAt = ts;
      e.x = x; e.y = y;
      if (x === snake.x && y === snake.y) haunt(e);
    },
    touch(e) { haunt(e); return gameState !== "PLAYING"; },
    draw(g, x, y, w, ts) { entityPic(g, "ghost", x, y + Math.sin(ts / 260) * w * 0.06, w); }   // bobbing
  },

  spikes: {
    kind: "hazard", color: "#b8c0cc", label: "Spike trap", placed: true, passable: true, floor: true,
    fact: "spikes rise and fall on a beat",
    touch(e) {
      if (!spikesUp()) return false;
      sfx("rock");
      if (roll(getTrackValue("timekeeper"))) { showToast("Timekeeper! You slipped between the spikes."); return false; }
      return takeHit(1, "spikes");
    },
    draw(g, x, y, w, ts) {
      // frames: up, down, down and flashing red just before they rise
      const up = spikesUp(), warn = !up && spikesWarn();
      entityPic(g, "spikes", x, y, w, up ? 0 : warn && Math.floor(ts / 90) % 2 ? 2 : 1);
    }
  },

  gust: {
    kind: "hazard", color: "#d8f0ff", label: "Gust", life: [2600, 2600], passable: true, global: true,
    fact: "gusts shove the whole snake",
    spawn(e, ts) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      [e.dx, e.dy] = dirs[getRandomInt(0, 4)];
      e.blowAt = ts + GUST_WARN;
      e.expiresAt = e.blowAt + 500;
      e.x = 0; e.y = 0;
    },
    tick(e, ts) {
      if (e.blown || ts < e.blowAt) return;
      e.blown = true;
      blowSnake(e.dx, e.dy);
    },
    touch() { return false; },
    draw(g, x, y, w, ts, e) {
      // arrows sweeping across the board in the wind's direction
      g.save();
      g.globalAlpha = e.blown ? 0.5 : 0.35 + 0.25 * Math.sin(ts / 90);
      g.strokeStyle = "#e6f6ff";
      g.lineWidth = 2;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const along = ((ts / 4 + i * (boardSize / n)) % boardSize);
        const across = (i + 0.5) * (boardSize / n);
        const [px, py] = e.dx ? [e.dx > 0 ? along : boardSize - along, across] : [across, e.dy > 0 ? along : boardSize - along];
        g.beginPath();
        g.moveTo(px - e.dx * 14 - e.dy * 0, py - e.dy * 14);
        g.lineTo(px, py);
        g.lineTo(px - e.dx * 5 - e.dy * 5, py - e.dy * 5 - e.dx * 5);
        g.moveTo(px, py);
        g.lineTo(px - e.dx * 5 + e.dy * 5, py - e.dy * 5 + e.dx * 5);
        g.stroke();
      }
      g.restore();
    }
  },

  sinkhole: {
    kind: "hazard", color: "#120c08", label: "Sinkhole", life: [99999, 99999], passable: true,
    fact: "sinkholes swallow the careless",
    spawn(e, ts) {
      e.openAt = ts + SINK_WARN * (nm.fastsink ? 0.6 : 1) * (1 + (getTrackValue("echolocation") + getTrackValue("nm_maw")) / 100);
      e.expiresAt = e.openAt + SINK_OPEN;
    },
    touch(e, ts) {
      if (ts < e.openAt) return false;
      if (roll(getTrackValue("rope"))) { showToast("Rope! You climbed back out."); removeEntity(e); return false; }
      if (guardCrash("sinkhole")) { removeEntity(e); return false; }
      endGame("sinkhole");
      return true;
    },
    draw(g, x, y, w, ts, e) { entityPic(g, "sinkhole", x, y, w, ts < e.openAt ? 0 : 1); }   // cracking, then open
  },

  /* ---------------- Power-ups ---------------- */
  golden: {
    kind: "power", color: "#ffd23f", label: "Golden Apple", life: [7000, 10000],
    touch(e) {
      removeEntity(e);
      const pts = 100 * scoreMultiplier * getTrackValue("apple") * 10 * (1 + getTrackValue("goldleaf") / 100);
      if (!endless) snake.maxCells += 2;
      addFever(0.4);
      runCount("golden");
      runCount("apples");
      save.stats.goldenApples = (save.stats.goldenApples || 0) + 1;
      addScore(pts);
      sfx("bigapple");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, "#ffd23f", ts); entityPic(g, "golden", x, y, w); }
  },

  shears: {
    kind: "power", color: "#d8dde6", label: "Shears", life: [8000, 11000],
    touch(e) {
      removeEntity(e);
      const keep = Math.max(3, Math.ceil(snake.cells.length / 2));
      const cut = Math.max(0, snake.cells.length - keep);
      if (cut > 0) {
        snake.cells.length = keep;
        snake.maxCells = keep;
        addScore(cut * 20 * scoreMultiplier * (1 + getTrackValue("sharper") / 100));
        showToast(`Snip! ${cut} segment${cut === 1 ? "" : "s"} trimmed for points.`);
      }
      runCount("powers");
      sfx("buy");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, "#d8dde6", ts); entityPic(g, "shears", x, y, w); }
  },

  armor: {
    kind: "power", color: "#9aa3ad", label: "Armor Plate", life: [8000, 11000],
    touch(e) {
      removeEntity(e);
      addArmor(1);
      runCount("powers");
      sfx("buy");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, "#c9ced6", ts); entityPic(g, "armor", x, y, w); }
  },

  shield: {
    kind: "power", color: "#7fe3ff", label: "Bubble Shield", life: [8000, 11000],
    touch(e) {
      removeEntity(e);
      buffs.shield = true;
      buffs.shieldUntil = tnow() + SHIELD_MS * (1 + getTrackValue("bubblewrap") / 100);
      showToast("Bubble Shield! The next hit, of any kind, bounces off.");
      runCount("powers");
      sfx("buy");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, "#7fe3ff", ts); entityPic(g, "shield", x, y, w); }
  },

  hourglass: {
    kind: "power", color: "#ffcf8a", label: "Hourglass", life: [8000, 11000],
    touch(e) {
      removeEntity(e);
      freezeHazards(FREEZE_MS * (1 + getTrackValue("stilltime") / 100));
      showToast("Hourglass! Everything that wants to hurt you has stopped.");
      runCount("powers");
      sfx("molasses");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, "#ffcf8a", ts); entityPic(g, "hourglass", x, y, w); }
  },

  star: {
    kind: "power", color: "#ff77c8", label: "Rampage Star", life: [7000, 10000],
    touch(e) {
      removeEntity(e);
      buffs.starUntil = tnow() + STAR_MS * (1 + getTrackValue("rampage") / 100);
      showToast("Rampage! Smash through everything for a few seconds.");
      runCount("powers");
      sfx("bigapple");
      return false;
    },
    draw(g, x, y, w, ts) {
      powerDisc(g, x, y, w, "#ff77c8", ts);
      entityPaint(g, "star", x, y, w, { colors: { star: `hsl(${(ts / 6) % 360},95%,65%)` } });   // its colors cycling
    }
  },

  phantom: {
    kind: "power", color: "#b36bff", label: "Phantom", life: [8000, 11000],
    touch(e) {
      removeEntity(e);
      buffs.phantomUntil = tnow() + PHANTOM_MS * (1 + getTrackValue("wraith") / 100);
      showToast("Phantom! Slide through your own tail and through rocks.");
      runCount("powers");
      sfx("portal");
      return false;
    },
    draw(g, x, y, w, ts) {
      powerDisc(g, x, y, w, "#b36bff", ts);
      // fading in and out: its body, then its eye over it, each see-through (two frames)
      const alpha = 0.6 + 0.3 * Math.sin(ts / 150);
      entityPaint(g, "phantom", x, y, w, { alpha, frame: 0 });
      entityPaint(g, "phantom", x, y, w, { alpha, frame: 1 });
    }
  },

  lodestone: {
    kind: "power", color: "#ff5a61", label: "Lodestone", life: [8000, 11000],
    touch(e) {
      removeEntity(e);
      buffs.lodeUntil = tnow() + LODE_MS * (1 + getTrackValue("polarity") / 100);
      showToast("Lodestone! Apples and XP drift toward you.");
      runCount("powers");
      sfx("buy");
      return false;
    },
    draw(g, x, y, w, ts) { powerDisc(g, x, y, w, "#ff5a61", ts); entityPic(g, "lodestone", x, y, w); }
  },

  frenzy: {
    kind: "power", color: "#3ddc84", label: "Frenzy Clock", life: [7000, 10000],
    touch(e) {
      removeEntity(e);
      buffs.frenzyUntil = tnow() + FRENZY_MS * (1 + getTrackValue("overtime") / 100);
      showToast("Frenzy! Double points for a while.");
      runCount("powers");
      sfx("bigxp");
      return false;
    },
    draw(g, x, y, w, ts) {
      powerDisc(g, x, y, w, "#3ddc84", ts);
      entityPic(g, "frenzy", x, y, w);
      // its hand going round, and its 2x
      g.strokeStyle = "#1f8a4a";
      g.lineWidth = Math.max(1, w * 0.08);
      const a = ts / 160;
      g.beginPath();
      g.moveTo(x + w / 2, y + w / 2); g.lineTo(x + w / 2 + Math.cos(a) * w * 0.3, y + w / 2 + Math.sin(a) * w * 0.3);
      g.stroke();
      glyph(g, x, y - w * 0.02, w, "2x", "#1f8a4a");
    }
  }
};
const ENTITY_KEYS = Object.keys(ENTITY_TYPES);

/* Timings, ms */
const BRAMBLE_GROW = [6000, 9500];
const WASP_MS = 420;
const LIGHTNING_WARN = 1500;
const BOMB_FUSE = 5000;
const GHOST_MS = 650;
const GUST_WARN = 1500;
const SINK_WARN = 2000;
const SINK_OPEN = 5500;
const SPIKE_UP = 1300, SPIKE_DOWN = 2200, SPIKE_WARN = 450;
const SHIELD_MS = 12000;
const FREEZE_MS = 5000;
const STAR_MS = 5000;
const PHANTOM_MS = 6000;
const LODE_MS = 8000;
const FRENZY_MS = 10000;

/* Spikes all share one beat, so you can learn it */
function spikeBeat() {
  const period = (SPIKE_UP + SPIKE_DOWN * (1 + (getTrackValue("oiled") + getTrackValue("nm_clockwork")) / 100)) * (nm.overclock ? 0.6 : 1);
  return { period, t: (runMs + (buffs.spikeShift || 0)) % period };
}
const spikeUpMs = () => SPIKE_UP * (nm.overclock ? 0.6 : 1);
const spikesUp = () => { const b = spikeBeat(); return b.t >= b.period - spikeUpMs(); };
const spikesWarn = () => { const b = spikeBeat(); return b.t >= b.period - spikeUpMs() - SPIKE_WARN; };


function removeEntity(e) {
  const i = entities.indexOf(e);
  if (i >= 0) entities.splice(i, 1);
}

/* ----- Spawning ----- */
function entityLife(type) {
  const t = ENTITY_TYPES[type];
  if (!t.life) return 1e12;
  return getRandomInt(t.life[0], t.life[1] + 1);
}

function spawnEntity(type, worldX) {
  const t = ENTITY_TYPES[type];
  const ts = tnow();
  let spot;
  if (t.global) spot = { x: 0, y: 0, size: 1, small: false };
  else if ((type === "wasp" || type === "ghost") && !endless && !maze) spot = edgeSpot();
  else spot = spotFor(rollGrade(spec[type]), worldX);
  if (!spot) return null;
  const e = Object.assign(spot, { type, spawnAt: ts, expiresAt: ts + entityLife(type) });
  if (t.spawn) t.spawn(e, ts);
  entities.push(e);
  return e;
}

/* Chasers come in from the edges, far from the head */
function edgeSpot() {
  const set = occupiedSet();
  const last = cellsAcross - 1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const side = getRandomInt(0, 4), along = getRandomInt(0, cellsAcross);
    const [cx, cy] = [[along, 0], [last, along], [along, last], [0, along]][side];
    const x = cx * cell, y = cy * cell;
    if (set.has(cellKey(x, y)) || Math.abs(x - snake.x) + Math.abs(y - snake.y) < 8 * cell) continue;
    return { x, y, size: 1, small: false };
  }
  return null;
}

/* Placed hazards (brambles, ice, spikes) go down at the start, away from the head, like rocks */
function placeEntities() {
  ENTITY_KEYS.forEach(type => {
    const t = ENTITY_TYPES[type], sp = spec[type];
    if (!t.placed || !sp || !sp.count) return;
    const hx = snake.x / cell, hy = snake.y / cell;
    const avoid = (x, y) => {
      const cx = x / cell, cy = y / cell;
      if (Math.abs(cy - hy) <= 1 && cx >= hx - 2 && cx <= hx + 7) return true;
      return Math.abs(cx - hx) + Math.abs(cy - hy) < 4;
    };
    for (let i = 0; i < sp.count; i++) {
      const g = rollGrade(sp);
      const span = g === 2 ? 2 : 1;
      const at = edgeMode === "maze" ? findMazeSpot(span, true) : findFreeSpot(span, avoid);
      if (!at) continue;
      // big placed hazards are four single squares, so each can be touched (and grow) on its own
      for (let a = 0; a < span; a++) for (let b = 0; b < span; b++) {
        entities.push({ type, x: at.x + a * cell, y: at.y + b * cell, size: 1, small: g === 0, spawnAt: tnow() });
      }
    }
  });
}

/* ----- Each frame ----- */
function tickEntities(ts, delta) {
  entities = entities.filter(e => !e.expiresAt || ts < e.expiresAt);
  if (frozenNow(ts)) return;
  entities.slice().forEach(e => {
    const t = ENTITY_TYPES[e.type];
    if (t.tick && gameState === "PLAYING") t.tick(e, ts, delta);
  });
}

/* The head reached a square: the first entity there reacts. Returns true if the run ended. */
function touchEntities(nx, ny, ts, grace) {
  const hit = entities.filter(e => !ENTITY_TYPES[e.type].global && covers(e, nx, ny));
  for (const e of hit) {
    const t = ENTITY_TYPES[e.type];
    if (t.kind === "hazard") {
      if (grace && !t.floor) continue;
      if (t.smash && (starOn() || feverOn())) { smashEntity(e); continue; }
      if (e.type === "ghost" && phantomOn()) continue;
    }
    if (t.touch(e, ts)) return true;
    if (gameState !== "PLAYING") return true;
  }
  return false;
}

/* While Fever or the Rampage Star is on, small hazards burst for points */
function smashEntity(e) {
  removeEntity(e);
  addScore(50 * scoreMultiplier);
  sfx("rock");
  runCount("smashed");
}

const onIce = () => entities.some(e => e.type === "ice" && covers(e, snake.x, snake.y));
/* Crampons (and Snow Chains in the Whiteout) let a turn bite now and then */
const iceGrips = () => roll(getTrackValue("crampons") + getTrackValue("nm_frost"));
const huskAt = (x, y) => husks.some(h => h.cells.some(c => c.x === x && c.y === y));

/* ----- What some hazards do ----- */
function explode(e) {
  if (e.blown) return;
  e.blown = true;
  e.expiresAt = tnow() + 500;
  sfx("fire");
  buzz([40, 30, 60]);
  const reach = (e.size === 2 ? 2 : 1) * cell;
  const span = (e.size || 1) * cell;
  const inBlast = (x, y) => x >= e.x - reach && x < e.x + span + reach && y >= e.y - reach && y < e.y + span + reach;
  const before = rocks.length;
  rocks = rocks.filter(r => !inBlast(r.x, r.y));
  const cleared = before - rocks.length;
  if (cleared && getTrackValue("demolition") > 0) addScore(cleared * getTrackValue("demolition") / 100 * 100 * scoreMultiplier);
  entities = entities.filter(o => o === e || ENTITY_TYPES[o.type].global || !(ENTITY_TYPES[o.type].kind === "hazard" && inBlast(o.x, o.y)) || o.type === "bomb");
  if (hunter && hunter.alive) hunter.cells.forEach(c => { if (inBlast(c.x, c.y)) stunHunter("blast"); });
  if (snake.cells.some(c => inBlast(c.x, c.y)) || inBlast(snake.x, snake.y)) {
    if (starOn()) return;
    takeHit(1, "bomb");
  }
}

function haunt(e) {
  removeEntity(e);
  if (phantomOn() || starOn() || feverOn()) { smashEntity(e); return; }
  sfx("bad");
  loseScore(1 / 3);
  takeHit(0.5, "ghost");
}

/* Pushes every segment one square, if the head has somewhere to land */
function blowSnake(dx, dy) {
  if (roll(getTrackValue("windbreak") + getTrackValue("nm_gale"))) { showToast("Windbreak! The gust passed you by."); return; }
  const mx = dx * cell, my = dy * cell;
  let hx = snake.x + mx, hy = snake.y + my;
  if (edgeMode !== "wall") { hx = wrapBoard(hx); hy = wrapBoard(hy); }
  if (!inBoard(hx, hy) || walls.has(cellKey(hx, hy)) || rocks.some(r => covers(r, hx, hy))) {
    sfx("rock");
    return;
  }
  snake.cells.forEach(c => {
    c.x += mx; c.y += my;
    if (edgeMode !== "wall") { c.x = wrapBoard(c.x); c.y = wrapBoard(c.y); }
  });
  snake.x = hx; snake.y = hy;
  sfx("molasses");
  if (getTrackValue("updraft") > 0) addScore(getTrackValue("updraft") / 100 * 100 * scoreMultiplier);
  runCount("gusts");
}

/* Hourglass: every hazard waits, and its clocks wait with it */
function freezeHazards(ms) {
  const ts = tnow();
  buffs.freezeUntil = Math.max(buffs.freezeUntil || 0, ts) + ms;
  const push = it => {
    ["expiresAt", "strikeAt", "blowAt", "openAt", "moveAt", "growAt"].forEach(k => { if (it[k]) it[k] += ms; });
  };
  entities.forEach(e => { if (ENTITY_TYPES[e.type].kind === "hazard") push(e); });
  popsicles.forEach(push);
  hazards.forEach(h => { push(h); if (h.nextHop) h.nextHop += ms; });
  buffs.spikeShift = (buffs.spikeShift || 0) - ms;
  if (hunter) hunter.moveAt += ms;
}
const frozenNow = ts => ts < (buffs.freezeUntil || 0);

/* ----- Drawing ----- */
function drawEntities(view, now2) {
  const onScreen = (x, y, span) => x > -span && y > -span && x < boardSize && y < boardSize;
  // floors first, then everything else
  const order = entities.slice().sort((a, b) => (ENTITY_TYPES[b.type].floor ? 1 : 0) - (ENTITY_TYPES[a.type].floor ? 1 : 0));
  order.forEach(e => {
    const t = ENTITY_TYPES[e.type];
    if (t.global) { t.draw(ctx, 0, 0, boardSize, now2, e); return; }
    let ex = e.x, ey = e.y;
    if (e.hopAt && now2 - e.hopAt < 160) {
      const f = (now2 - e.hopAt) / 160;
      ex = e.fromX + (e.x - e.fromX) * f;
      ey = e.fromY + (e.y - e.fromY) * f;
    }
    const span = (e.size || 1);
    const [x, y] = view.toScreen(ex, ey);
    if (!onScreen(x, y, span * cell)) return;
    let w = span * cell - 1, ox = x, oy = y;
    if (e.small) { w = Math.max(3, cell / 2 - 1); ox = x + (cell - 1 - w) / 2; oy = y + (cell - 1 - w) / 2; }
    ctx.save();
    ctx.globalAlpha = itemAlpha(e, now2);
    t.draw(ctx, ox, oy, w, now2, e);
    ctx.restore();
  });
}
