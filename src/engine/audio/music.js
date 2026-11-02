/* =========================================================
   src/engine/audio/music.js
   Music: audio files from content/music, with the synth as a fallback
   ========================================================= */
"use strict";

/* =========================================================
   Music: original themes, written as melodies over chords and
   played live by the little synth above. Each theme has a melody,
   a chord per bar, and patterns for the bass, arpeggio and drums.
     melody:  one token per 16th note, "-" holds the note, "." rests
     bass:    R root, F fifth, T third, O octave, "-" hold, "." rest
     arp:     1 3 5 7 8 are notes of the bar's chord, "." rests
     drums:   k kick, s snare, c clap, h hat, o open hat, t tom
   ========================================================= */
const NOTE = n => {
  if (!n || n === "." || n === "-") return null;
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  return base + (Number(m[3]) + 1) * 12;
};
const tokens = str => str.trim().split(/\s+/);

const CHORD_SHAPES = { "": [0, 4, 7, 11], m: [0, 3, 7, 10], "7": [0, 4, 7, 10], dim: [0, 3, 6, 9], sus: [0, 5, 7, 10] };
function chordNotes(name) {
  const m = /^([A-G])(#?)(m|7|dim|sus)?$/.exec(name);
  const root = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  const shape = CHORD_SHAPES[m[3] || ""];
  return { root, third: shape[1], fifth: shape[2], seventh: shape[3] };
}

/* Which track each island plays: "music" in its world.txt */
const MODE_MUSIC = Object.assign({ tutorial: "calm", custom: "calm" },
  Object.fromEntries(MODE_KEYS.map(key => [key, String(CONTENT.worlds[key].info.music || "calm")])));

/* ----- Music files: content/music/music.dat lists a file for each track. A track
   whose file is missing (or can't be read) plays its synth version from songs.js. ----- */
const MUSIC_FILES = {};
CONTENT.music.forEach(row => {
  const [track, file, from, to, volume] = row;
  if (!track || !file) return;
  MUSIC_FILES[String(track)] = {
    url: (row._base || "content/music/") + file,
    from: Number(from) || 0,
    to: to === "end" || to === undefined || to === "" ? null : Number(to),
    volume: volume === undefined || volume === "" ? 100 : Number(volume),
    state: ContentLoader.state.mode === "live" ? "unknown" : "missing",   // a page opened from disk can't read audio files
    promise: null,
    buffer: null
  };
});

function loadMusicFile(f, ac) {
  if (!f.promise) {
    f.state = "loading";
    f.promise = fetch(f.url)
      .then(res => { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); })
      .then(data => ac.decodeAudioData(data))
      .then(buffer => { f.buffer = buffer; f.state = "ready"; })
      .catch(() => { f.state = "missing"; });
  }
  return f.promise;
}

/* Plays a decoded file into the music bus: once from the start, then looping its loop section */
function playMusicFile(f, ac) {
  const src = ac.createBufferSource();
  src.buffer = f.buffer;
  src.loop = true;
  src.loopStart = Math.min(f.from, f.buffer.duration);
  src.loopEnd = f.to === null ? f.buffer.duration : Math.min(f.to, f.buffer.duration);
  const vol = ac.createGain();
  vol.gain.value = Math.max(0, f.volume) / 100;
  src.connect(vol).connect(music.gain);
  src.start();
  music.source = src;
}

let music = { track: null, step: 0, nextTime: 0, timer: null, gain: null };

let debugTrack = null;          // the terminal's `music` command forces a theme here

function musicWanted() {
  if (!save.settings.music || save.settings.musicVolume <= 0) return null;
  if (debugTrack) return debugTrack === "off" ? null : debugTrack;
  if (sceneOpen || currentScreen === "story") return "story";
  if (gameState === "PLAYING") return currentNightmare ? "dream" : (MODE_MUSIC[currentModeKey] || "calm");
  if (gameState === "GAMEOVER") return null;
  if (currentScreen === "modes") return "map";
  return "menu";
}

const musicLevel = () => 0.3 * (save.settings.musicVolume / 100);

/* Called whenever the screen or game state changes */
function updateMusic() {
  const want = musicWanted();
  if (want === music.track) {
    if (music.gain) music.gain.gain.setTargetAtTime(musicLevel(), music.gain.context.currentTime, 0.05);
    return;
  }
  stopMusic();
  if (!want) return;
  const ac = ensureAudio(true);
  if (!ac) return;
  const t = TRACKS[want];
  music.track = want;
  music.step = 0;
  music.nextTime = ac.currentTime + 0.1;
  music.gain = ac.createGain();
  music.gain.gain.setValueAtTime(0.0001, ac.currentTime);
  music.gain.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.15);      // fade in
  music.gain.connect(AUD.musicBus);
  const begin = () => {
    if (music.track !== want || !music.gain) return;
    const f = MUSIC_FILES[want];
    if (f && f.state === "ready") { playMusicFile(f, ac); return; }   // your recording
    if (!t) return;
    music.echo = ac.createGain();                                     // the built-in synth version
    music.echo.gain.value = 0.32 * (t.echo || 0);
    music.gain.connect(music.echo).connect(AUD.delayIn);
    AUD.delay.delayTime.setValueAtTime((60 / t.bpm) * 0.75, ac.currentTime);  // a dotted eighth
    music.nextTime = ac.currentTime + 0.1;
    music.timer = setInterval(scheduleMusic, 25);
  };
  const f = MUSIC_FILES[want];
  if (f && f.state !== "missing" && f.state !== "ready") loadMusicFile(f, ac).then(begin);
  else begin();
}

function stopMusic() {
  if (music.timer) clearInterval(music.timer);
  if (music.gain) {
    const g = music.gain, e = music.echo, src = music.source;
    try { g.gain.setTargetAtTime(0, g.context.currentTime, 0.12); } catch (err) { /* already closed */ }
    setTimeout(() => { try { if (src) src.stop(); g.disconnect(); if (e) e.disconnect(); } catch (err) { /* gone */ } }, 800);
  }
  music = { track: null, step: 0, nextTime: 0, timer: null, gain: null };
}

/* How long a note lasts: itself plus every "-" that follows it */
function heldSteps(list, i) {
  let n = 1;
  while (list[(i + n) % list.length] === "-" && n < list.length) n++;
  return n;
}

function scheduleMusic() {
  const ac = audioCtx;
  const t = TRACKS[music.track];
  if (!ac || !t || !music.gain) return;
  const stepDur = 60 / t.bpm / 4;
  const out = music.gain;
  const loopLen = t.melody.length;
  while (music.nextTime < ac.currentTime + 0.15) {
    const step = music.step;
    const bar = Math.floor(step / t.steps) % t.chords.length;
    const pos = step % t.steps;
    const loop = Math.floor(step / loopLen);
    const swing = pos % 2 ? (t.swing || 0) * stepDur : 0;
    const at = music.nextTime + swing;
    const ch = chordNotes(t.chords[bar]);
    const human = () => 0.88 + Math.random() * 0.24;

    // Melody: on every other pass it is joined by a quiet bell an octave up
    const mi = step % loopLen;
    const note = NOTE(t.melody[mi]);
    if (note) {
      let f = NOTEF(note);
      if (t.wobble) f *= 1 + Math.sin(step * 0.7) * 0.004;
      const dur = heldSteps(t.melody, mi) * stepDur * 0.92;
      INSTRUMENTS[t.lead](ac, out, f, at, dur, (t.leadVol || 0.5) * human());
      if (loop % 2 === 1 && t.lead !== "bell") INSTRUMENTS.bell(ac, pan(ac, out, 0.3), f * 2, at + 0.01, dur, 0.12);
    }

    // Bass, from the bar's chord
    const bsym = t.bass[pos % t.bass.length];
    if (bsym && bsym !== "." && bsym !== "-") {
      const off = { R: 0, F: ch.fifth, T: ch.third, O: 12 }[bsym] || 0;
      const n = 36 + ((ch.root + 3) % 12) - 3 + off;
      INSTRUMENTS.bass(ac, out, NOTEF(n), at, heldSteps(t.bass.split(""), pos % t.bass.length) * stepDur * 0.9, 0.85);
    }

    // Arpeggio, gently panned
    const asym = t.arp && t.arp[pos % t.arp.length];
    if (asym && asym !== ".") {
      const off = { 1: 0, 3: ch.third, 5: ch.fifth, 7: ch.seventh, 8: 12 }[asym] || 0;
      INSTRUMENTS[t.arpInst](ac, pan(ac, out, pos % 4 < 2 ? -0.35 : 0.35), NOTEF(60 + ch.root + off), at, stepDur, (t.arpVol || 0.2) * human());
    }

    // A chord pad held across the whole bar
    if (pos === 0 && t.pad) {
      const barLen = t.steps * stepDur;
      [0, ch.third, ch.fifth].forEach(off => INSTRUMENTS.pad(ac, out, NOTEF(48 + ch.root + off + (off < 5 ? 12 : 0)), at, barLen * 0.95, t.pad));
    }

    // Drums, with a fill every fourth bar
    if (t.drums) {
      const pattern = t.drums[bar % t.drums.length];
      const d = pattern[pos % pattern.length];
      if (d && d !== ".") drum(ac, out, d, at, (pos % 4 ? 0.7 : 1) * human());
    }

    music.step++;
    music.nextTime += stepDur;
  }
}

