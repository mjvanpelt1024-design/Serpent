/* =========================================================
   src/engine/audio/synth.js
   The synthesizer, mixing desk and sound effects
   ========================================================= */
"use strict";

/* =========================================================
   Sound: a small synthesizer, a mixing desk and every sound effect
   ========================================================= */
let audioCtx = null;

/* A short buzz on phones that can do it, for getting hurt */
function buzz(pattern) {
  if (!save.settings.vibration || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* not allowed right now */ }
}

/* ----- The mixing desk: a master bus with a gentle compressor, a shared
   reverb (a generated room) and a tape-ish echo. Music and effects each
   have their own bus so their volumes stay separate. ----- */
let AUD = null;

function buildAudioGraph(ac) {
  const master = ac.createGain();
  master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master.connect(comp).connect(ac.destination);

  // A small, warm room: stereo noise that fades away
  const len = Math.floor(ac.sampleRate * 2.4);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45;      // a little darker than white noise
      d[i] = lp * Math.pow(1 - i / len, 2.6);
    }
  }
  const reverb = ac.createConvolver();
  reverb.buffer = ir;
  const reverbIn = ac.createGain();
  const reverbOut = ac.createGain();
  reverbOut.gain.value = 0.55;
  reverbIn.connect(reverb).connect(reverbOut).connect(master);

  // An echo whose repeats get duller each time round
  const delay = ac.createDelay(1.5);
  delay.delayTime.value = 0.3;
  const fb = ac.createGain();
  fb.gain.value = 0.3;
  const tone = ac.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2200;
  const delayIn = ac.createGain();
  const delayOut = ac.createGain();
  delayOut.gain.value = 0.5;
  delayIn.connect(delay);
  delay.connect(tone).connect(fb).connect(delay);
  tone.connect(delayOut).connect(master);
  delayOut.connect(reverbIn);

  const musicBus = ac.createGain();
  musicBus.connect(master);
  const musicVerb = ac.createGain();
  musicVerb.gain.value = 0.22;
  musicBus.connect(musicVerb).connect(reverbIn);

  const sfxBus = ac.createGain();
  sfxBus.connect(master);
  const sfxVerb = ac.createGain();
  sfxVerb.gain.value = 0.16;
  sfxBus.connect(sfxVerb).connect(reverbIn);

  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // A 25% pulse wave, the classic thin chiptune lead
  const real = new Float32Array(32), imag = new Float32Array(32);
  for (let n = 1; n < 32; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25) * 1.2;
  const pulse = ac.createPeriodicWave(real, imag);

  return { master, reverbIn, delay, delayIn, musicBus, sfxBus, noise, pulse };
}

function ensureAudio(forMusic = false) {
  if (!forMusic && !save.settings.sound) return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      AUD = buildAudioGraph(audioCtx);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/* ----- Instruments. Every one takes (where, pitch, start time, length, loudness). ----- */
const hz = (f, cents) => f * Math.pow(2, cents / 1200);

function envGain(ac, at, dur, vol, a = 0.008, d = 0.1, s = 0.7, r = 0.08) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + a);
  g.gain.setTargetAtTime(vol * s, at + a, d / 3);
  g.gain.setTargetAtTime(0.0001, at + Math.max(a, dur), r / 3);
  return g;
}

function pan(ac, dest, p) {
  if (!ac.createStereoPanner || !p) return dest;
  const sp = ac.createStereoPanner();
  sp.pan.value = p;
  sp.connect(dest);
  return sp;
}

function oscAt(ac, type, f, at, end) {
  const o = ac.createOscillator();
  if (type === "pulse") o.setPeriodicWave(AUD.pulse); else o.type = type;
  o.frequency.setValueAtTime(f, at);
  o.start(at);
  o.stop(end);
  return o;
}

const INSTRUMENTS = {
  // Bright chip lead: a pulse and a detuned square, with vibrato that arrives late
  pulse(ac, out, f, at, dur, vol) {
    const end = at + dur + 0.3;
    const g = envGain(ac, at, dur, vol * 0.5, 0.006, 0.15, 0.65, 0.09);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(5200, at);
    lp.frequency.setTargetAtTime(2400, at, 0.12);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.6;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(f * 0.006, at + Math.min(0.35, dur));
    lfo.connect(depth);
    lfo.start(at);
    lfo.stop(end);
    [["pulse", 0], ["square", 7]].forEach(([type, c], i) => {
      const o = oscAt(ac, type, hz(f, c), at, end);
      depth.connect(o.frequency);
      const v = ac.createGain();
      v.gain.value = i ? 0.35 : 1;
      o.connect(v).connect(lp);
    });
    lp.connect(g).connect(out);
  },
  // Soft and breathy, for wandering melodies
  flute(ac, out, f, at, dur, vol) {
    const end = at + dur + 0.3;
    const g = envGain(ac, at, dur, vol * 0.75, 0.05, 0.2, 0.8, 0.12);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 4.8;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(f * 0.008, at + Math.min(0.4, dur));
    lfo.connect(depth);
    lfo.start(at);
    lfo.stop(end);
    const o1 = oscAt(ac, "triangle", f, at, end);
    const o2 = oscAt(ac, "sine", f * 2, at, end);
    depth.connect(o1.frequency);
    const v2 = ac.createGain();
    v2.gain.value = 0.18;
    o1.connect(g);
    o2.connect(v2).connect(g);
    g.connect(out);
  },
  // A music box: a sine with a shimmering, slightly out-of-tune overtone
  bell(ac, out, f, at, dur, vol) {
    const len = Math.max(0.6, Math.min(2.2, dur * 2.5));
    const end = at + len + 0.1;
    [[1, 1, len], [2.756, 0.32, len * 0.45], [5.404, 0.12, len * 0.25]].forEach(([m, v, d]) => {
      const o = oscAt(ac, "sine", f * m, at, end);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol * v * 0.7, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g).connect(out);
    });
  },
  // Plucked strings for arpeggios: a filter snapping shut
  pluck(ac, out, f, at, dur, vol) {
    const end = at + 0.5;
    const o = oscAt(ac, "sawtooth", f, at, end);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), at + 0.18);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol * 0.4, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    o.connect(lp).connect(g).connect(out);
  },
  // Warm strings under everything: detuned saws, filtered, slow to arrive
  pad(ac, out, f, at, dur, vol) {
    const end = at + dur + 0.9;
    const g = envGain(ac, at, dur, vol * 0.16, 0.35, 0.4, 0.85, 0.6);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1300;
    [-9, 0, 9].forEach(c => oscAt(ac, "sawtooth", hz(f, c), at, end).connect(lp));
    lp.connect(g).connect(out);
  },
  // Round, punchy bass: a triangle with a growling square underneath
  bass(ac, out, f, at, dur, vol) {
    const end = at + dur + 0.2;
    const g = envGain(ac, at, dur, vol * 0.9, 0.004, 0.12, 0.75, 0.05);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1500, at);
    lp.frequency.setTargetAtTime(420, at, 0.06);
    oscAt(ac, "triangle", f, at, end).connect(g);
    const sq = oscAt(ac, "square", f, at, end);
    const sv = ac.createGain();
    sv.gain.value = 0.22;
    sq.connect(sv).connect(lp).connect(g);
    g.connect(out);
  }
};

function noiseHit(ac, out, at, dur, vol, type, freq, q = 1) {
  const src = ac.createBufferSource();
  src.buffer = AUD.noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

function drum(ac, out, kind, at, vol = 1) {
  if (kind === "k") {
    const o = oscAt(ac, "sine", 155, at, at + 0.3);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.13);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(1.1 * vol, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    o.connect(g).connect(out);
    noiseHit(ac, out, at, 0.015, 0.25 * vol, "highpass", 3000);
  } else if (kind === "s") {
    noiseHit(ac, out, at, 0.16, 0.55 * vol, "bandpass", 1900, 0.8);
    const o = oscAt(ac, "triangle", 196, at, at + 0.12);
    o.frequency.exponentialRampToValueAtTime(140, at + 0.08);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.45 * vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    o.connect(g).connect(out);
  } else if (kind === "c") {
    [0, 0.011, 0.023].forEach(d => noiseHit(ac, out, at + d, 0.09, 0.4 * vol, "bandpass", 1300, 1.4));
  } else if (kind === "h") {
    noiseHit(ac, pan(ac, out, 0.25), at, 0.035, 0.22 * vol, "highpass", 8200);
  } else if (kind === "o") {
    noiseHit(ac, pan(ac, out, 0.25), at, 0.2, 0.18 * vol, "highpass", 7600);
  } else if (kind === "t") {
    const o = oscAt(ac, "sine", 220, at, at + 0.25);
    o.frequency.exponentialRampToValueAtTime(110, at + 0.18);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.6 * vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    o.connect(g).connect(out);
  }
}

/* ----- Sound effects: small recipes built from the same instruments ----- */
const NOTEF = n => 440 * Math.pow(2, (n - 69) / 12);     // MIDI number to pitch
let appleRun = { at: -10, step: 0 };
const APPLE_SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];

function blip(ac, out, type, f0, f1, at, dur, vol) {
  const o = oscAt(ac, type, f0, at, at + dur + 0.05);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
}

const arpeggio = (inst, notes, gap, len, vol) => (ac, out, t) =>
  notes.forEach((n, i) => INSTRUMENTS[inst](ac, out, NOTEF(n), t + i * gap, len, vol));

const SFX = {
  // Apples climb a little scale when you eat them quickly, then start over
  apple(ac, out, t) {
    const now = performance.now();
    appleRun.step = now - appleRun.at < 2200 ? Math.min(APPLE_SCALE.length - 1, appleRun.step + 1) : 0;
    appleRun.at = now;
    const n = APPLE_SCALE[appleRun.step];
    blip(ac, out, "square", NOTEF(n - 5), NOTEF(n), t, 0.06, 0.24);
    INSTRUMENTS.bell(ac, out, NOTEF(n + 12), t + 0.035, 0.12, 0.45);
  },
  bigapple(ac, out, t) {
    [72, 76, 79, 84].forEach((n, i) => blip(ac, out, "square", NOTEF(n - 3), NOTEF(n), t + i * 0.05, 0.08, 0.16));
    INSTRUMENTS.bell(ac, out, NOTEF(96), t + 0.2, 0.3, 0.4);
    drum(ac, out, "k", t, 0.5);
  },
  xp(ac, out, t) { INSTRUMENTS.bell(ac, pan(ac, out, 0.2), NOTEF(88), t, 0.1, 0.45); INSTRUMENTS.bell(ac, pan(ac, out, -0.2), NOTEF(95), t + 0.05, 0.12, 0.35); },
  bigxp(ac, out, t) { [88, 92, 95, 100].forEach((n, i) => INSTRUMENTS.bell(ac, out, NOTEF(n), t + i * 0.045, 0.15, 0.4)); },
  bad(ac, out, t) { blip(ac, out, "sawtooth", 220, 70, t, 0.22, 0.4); blip(ac, out, "square", 160, 60, t, 0.18, 0.2); noiseHit(ac, out, t, 0.14, 0.6, "lowpass", 900); drum(ac, out, "k", t, 0.6); },
  heart(ac, out, t) { blip(ac, out, "square", 440, 196, t, 0.18, 0.18); drum(ac, out, "k", t, 0.7); drum(ac, out, "k", t + 0.14, 0.45); },
  death(ac, out, t) {
    [67, 66, 65, 64, 63].forEach((n, i) => blip(ac, out, "square", NOTEF(n), NOTEF(n - 0.5), t + i * 0.13, 0.14, 0.14));
    blip(ac, out, "sawtooth", NOTEF(52), NOTEF(28), t + 0.65, 0.7, 0.2);
    noiseHit(ac, out, t + 0.6, 0.5, 0.25, "lowpass", 600);
    INSTRUMENTS.pad(ac, out, NOTEF(45), t + 0.6, 0.6, 1.2);
  },
  buy(ac, out, t) {
    noiseHit(ac, out, t, 0.04, 0.3, "highpass", 5000);
    [84, 91].forEach((n, i) => INSTRUMENTS.bell(ac, out, NOTEF(n), t + 0.03 + i * 0.07, 0.2, 0.45));
    blip(ac, out, "triangle", NOTEF(60), NOTEF(72), t, 0.08, 0.2);
  },
  unlock(ac, out, t) {
    arpeggio("pulse", [60, 64, 67, 72], 0.07, 0.1, 0.5)(ac, out, t);
    INSTRUMENTS.bell(ac, out, NOTEF(84), t + 0.3, 0.5, 0.5);
    INSTRUMENTS.pad(ac, out, NOTEF(60), t + 0.28, 0.5, 1.6);
    INSTRUMENTS.pad(ac, out, NOTEF(67), t + 0.28, 0.5, 1.4);
  },
  pop(ac, out, t) { blip(ac, out, "sine", 480, 1250, t, 0.07, 0.32); blip(ac, out, "triangle", 900, 2200, t + 0.03, 0.05, 0.12); },
  click(ac, out, t) { blip(ac, out, "square", 1300, 900, t, 0.025, 0.08); noiseHit(ac, out, t, 0.012, 0.12, "highpass", 4000); },
  tick(ac, out, t) { blip(ac, out, "square", 1800, 1600, t, 0.015, 0.05); },
  tab(ac, out, t) { blip(ac, out, "triangle", 660, 990, t, 0.05, 0.16); },
  toggle(ac, out, t) { blip(ac, out, "square", 500, 760, t, 0.035, 0.1); noiseHit(ac, out, t, 0.015, 0.15, "bandpass", 2400, 2); },
  page(ac, out, t) { noiseHit(ac, pan(ac, out, -0.3), t, 0.22, 0.28, "bandpass", 1400, 0.6); noiseHit(ac, pan(ac, out, 0.3), t + 0.08, 0.16, 0.18, "bandpass", 2600, 0.6); },
  whoosh(ac, out, t) {
    const src = ac.createBufferSource();
    src.buffer = AUD.noise;
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.42);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.5);
  },
  badge(ac, out, t) { arpeggio("bell", [79, 83, 86, 91], 0.07, 0.2, 0.5)(ac, out, t); drum(ac, out, "o", t + 0.21, 0.6); },
  medal(ac, out, t) {
    arpeggio("pulse", [72, 76, 79, 84, 88], 0.09, 0.14, 0.5)(ac, out, t);
    [72, 76, 79].forEach(n => INSTRUMENTS.pad(ac, out, NOTEF(n), t + 0.45, 0.8, 1.4));
    INSTRUMENTS.bell(ac, out, NOTEF(96), t + 0.45, 0.8, 0.5);
    drum(ac, out, "k", t + 0.45); drum(ac, out, "o", t + 0.45, 0.8);
  },
  revive(ac, out, t) {
    blip(ac, out, "sine", 200, 1200, t, 0.45, 0.25);
    arpeggio("bell", [67, 72, 76, 79, 84], 0.08, 0.2, 0.45)(ac, out, t + 0.2);
  },
  goldheart(ac, out, t) { arpeggio("bell", [84, 88, 84], 0.06, 0.12, 0.5)(ac, out, t); drum(ac, out, "k", t, 0.6); },
  rock(ac, out, t) { drum(ac, out, "k", t, 0.9); noiseHit(ac, out, t, 0.18, 0.5, "lowpass", 500); blip(ac, out, "square", 120, 60, t, 0.14, 0.12); },
  flea(ac, out, t) { [0, 0.045, 0.09, 0.135].forEach((d, i) => blip(ac, pan(ac, out, i % 2 ? 0.4 : -0.4), "square", 1400 + i * 200, 1900 + i * 150, t + d, 0.035, 0.17)); drum(ac, out, "s", t, 0.4); },
  fire(ac, out, t) {
    noiseHit(ac, out, t, 0.4, 0.8, "bandpass", 900, 0.7);
    noiseHit(ac, out, t + 0.05, 0.3, 0.4, "highpass", 3000);
    blip(ac, out, "sawtooth", 180, 900, t, 0.25, 0.22);
  },
  molasses(ac, out, t) { blip(ac, out, "sine", 260, 90, t, 0.4, 0.3); blip(ac, out, "triangle", 300, 140, t + 0.12, 0.35, 0.18); },
  intro(ac, out, t) { arpeggio("bell", [76, 81], 0.09, 0.3, 0.45)(ac, out, t); },
  portal(ac, out, t) {
    blip(ac, out, "sine", 300, 1400, t, 0.18, 0.4);
    blip(ac, out, "triangle", 600, 2400, t + 0.04, 0.16, 0.2);
    noiseHit(ac, out, t, 0.2, 0.3, "bandpass", 3000, 2);
  },
  shimmer(ac, out, t) { [91, 95, 98, 103, 98, 103, 107].forEach((n, i) => INSTRUMENTS.bell(ac, pan(ac, out, Math.sin(i) * 0.6), NOTEF(n), t + i * 0.055, 0.2, 0.32)); }
};

function sfx(name) {
  const ac = ensureAudio();
  if (!ac || !SFX[name] || save.settings.sfxVolume <= 0) return;
  AUD.sfxBus.gain.value = 0.8 * (save.settings.sfxVolume / 100);
  try { SFX[name](ac, AUD.sfxBus, ac.currentTime + 0.005); } catch (e) { /* audio is optional */ }
}
