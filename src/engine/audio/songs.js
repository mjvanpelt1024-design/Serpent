/* =========================================================
   src/engine/audio/songs.js
   The built-in synth versions of every music track (used until a music file exists)
   ========================================================= */
"use strict";

/* Each track: a melody over chords, played live by the synth in synth.js.
     melody:  one token per 16th note, "-" holds the note, "." rests
     bass:    R root, F fifth, T third, O octave, "-" hold, "." rest
     arp:     1 3 5 7 8 are notes of the bar's chord, "." rests
     drums:   k kick, s snare, c clap, h hat, o open hat, t tom
   When content/music/ has a file for a track (see music.dat), that file plays instead. */
const TRACKS = {
  // The title screen: a little jaunty, mostly sorry for itself
  menu: {
    bpm: 96, swing: 0.12, steps: 16, lead: "pulse", leadVol: 0.55, arpInst: "bell", arpVol: 0.22, pad: 0.8, echo: 0.75,
    chords: ["Am", "Am", "F", "G", "Am", "Dm", "E7", "Am"],
    melody: tokens(`E5 - - . A5 - G5 - E5 - - - C5 - D5 -   E5 - - - - - . . A4 - B4 - C5 - D5 -
                    C5 - - . F5 - E5 - C5 - - - A4 - C5 -   B4 - - - G4 - - - B4 - D5 - G5 - F5 -
                    E5 - - . A5 - B5 - C6 - B5 - A5 - G5 -  F5 - - - D5 - - - A5 - - - F5 - D5 -
                    E5 - - - G#5 - - - B5 - - - D6 - B5 -   A5 - - - - - - - E5 - C5 - A4 - - -`),
    bass: "R--.R-..F--.R-O-",
    arp: "1.3.5.8.5.3.5.8.",
    drums: ["k...h.h.s...h.h.", "k...h.h.s...h.h.", "k...h.h.s...h.h.", "k...h.h.s..kt.tt"]
  },
  // The map: setting out, not entirely sure where to
  map: {
    bpm: 104, swing: 0.1, steps: 16, lead: "flute", leadVol: 0.6, arpInst: "pluck", arpVol: 0.2, pad: 0.6, echo: 0.75,
    chords: ["Dm", "Am", "C", "G", "Dm", "F", "C", "A7"],
    melody: tokens(`D5 - F5 - A5 - - - G5 - F5 - E5 - D5 -  C5 - - - E5 - - - A4 - - - - - . .
                    E5 - G5 - C6 - - - B5 - A5 - G5 - E5 -  D5 - - - G4 - - - B4 - D5 - - - . .
                    F5 - - - A5 - - - D6 - - - C6 - A5 -    C6 - - - A5 - F5 - A5 - - - G5 - F5 -
                    E5 - - - G5 - E5 - C5 - - - D5 - E5 -   C#5 - - - E5 - - - A4 - - - - - - -`),
    bass: "R...T...F...T...",
    arp: "1.5.8.5.1.5.8.5.",
    drums: ["k..h..h.s..h..h.", "k..h..h.s..h..h.", "k..h..h.s..h..h.", "k..h..h.s..h.hhh"]
  },
  // The story book: a music box waltz in a minor key
  story: {
    bpm: 84, swing: 0, steps: 12, lead: "bell", leadVol: 0.75, arpInst: "pluck", arpVol: 0.16, pad: 0.9, echo: 0.9,
    chords: ["Am", "Dm", "E", "Am", "F", "Dm", "E7", "Am"],
    melody: tokens(`E5 - - - A5 - - - C6 - B5 -   A5 - - - F5 - - - D5 - - -
                    G#5 - - - B5 - - - E6 - D6 -  C6 - - - - - - - A5 - - -
                    A5 - - - C6 - - - F6 - E6 -   D6 - - - A5 - - - F5 - - -
                    E5 - - - G#5 - B5 - D6 - B5 -  A5 - - - - - - - - - . .`),
    bass: "R-----------",
    arp: "....3...5...",
    drums: null
  },
  // Easy and Classic: sunny, bouncy, slightly suspicious of the sun
  calm: {
    bpm: 116, swing: 0.08, steps: 16, lead: "pulse", leadVol: 0.5, arpInst: "bell", arpVol: 0.14, pad: 0.35, echo: 0.5,
    chords: ["C", "Am", "F", "G", "C", "Am", "Dm", "G"],
    melody: tokens(`E5 - G5 - C6 - G5 - E5 - G5 - A5 - G5 -  E5 - - - C5 - - - E5 - D5 - C5 - . .
                    F5 - A5 - C6 - A5 - F5 - A5 - C6 - D6 -  B5 - - - G5 - - - D5 - E5 - F5 - G5 -
                    E5 - G5 - C6 - - - D6 - C6 - B5 - C6 -   A5 - - - E5 - - - C5 - E5 - A5 - G5 -
                    F5 - - - A5 - F5 - D5 - F5 - E5 - D5 -   G5 - - - - - . . G4 - B4 - D5 - F5 -`),
    bass: "R.R.F.R.R.R.F.O.",
    arp: "1358135813581358",
    drums: ["k.h.s.h.k.k.s.hh", "k.h.s.h.k.k.s.hh", "k.h.s.h.k.k.s.hh", "k.h.s.h.k.kss.ss"]
  },
  // Challenge and Insane: something is following you
  tense: {
    bpm: 136, swing: 0, steps: 16, lead: "pulse", leadVol: 0.48, arpInst: "pluck", arpVol: 0.18, pad: 0.55, echo: 0.6,
    chords: ["Am", "Am", "F", "E", "Am", "Am", "Dm", "E"],
    melody: tokens(`A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .   A5 - - - G5 - E5 - D5 - C5 - B4 - C5 -
                    A4 . C5 . F5 . A5 . G5 . F5 . C5 . F5 .   G#5 - - - E5 - - - B4 - - - G#4 - B4 -
                    C6 . B5 . A5 . E5 . C6 . B5 . A5 . E5 .   D6 - C6 - B5 - A5 - G#5 - A5 - B5 - C6 -
                    D6 - - - A5 - - - F5 - - - D5 - F5 -      E5 - - - G#5 - B5 - E6 - - - - - . .`),
    bass: "R.R.R.R.R.R.F.O.",
    arp: "1.3.5.3.1.3.5.8.",
    drums: ["k.hhs.h.k.khs.hh", "k.hhs.h.k.khs.hh", "k.hhs.h.k.khs.hh", "k.hhs.h.k.kss.cc"]
  },
  // Chaos, Mirror and Treasure: everything at once, and quickly
  fast: {
    bpm: 156, swing: 0, steps: 16, lead: "pulse", leadVol: 0.42, arpInst: "pluck", arpVol: 0.12, pad: 0.3, echo: 0.45,
    chords: ["Em", "C", "G", "D", "Em", "C", "Am", "B7"],
    melody: tokens(`E5 G5 B5 G5 E6 - B5 - G5 B5 E6 B5 D6 - B5 -   C6 - - - G5 - E5 - G5 - C6 - E6 - D6 -
                    B5 - D6 - G6 - D6 - B5 - G5 - A5 - B5 -       A5 - - - F#5 - - - D5 - F#5 - A5 - D6 -
                    E6 - D6 - B5 - G5 - E5 - G5 - B5 - E6 -       G6 - - - E6 - C6 - G5 - E5 - G5 - C6 -
                    A5 - C6 - E6 - C6 - A5 - E5 - A5 - C6 -       B5 - - - D#6 - - - F#6 - - - A6 - F#6 -`),
    bass: "RORORORORORORORO",
    arp: "1.5.8.5.1.5.8.5.",
    drums: ["k.h.s.hkk.h.s.hh", "k.h.s.hkk.h.s.hh", "k.h.s.hkk.h.s.hh", "k.h.s.hkk.ssc.cc"]
  },
  // Endless: the long tunnel, and the thing just ahead in it
  tunnel: {
    bpm: 148, swing: 0, steps: 16, lead: "flute", leadVol: 0.55, arpInst: "pluck", arpVol: 0.22, pad: 0.5, echo: 0.8,
    chords: ["Dm", "A#", "C", "Am", "Dm", "A#", "Gm", "A"],
    melody: tokens(`A5 - - - - - - - D6 - - - C6 - A5 -   A#5 - - - - - - - F5 - - - - - . .
                    G5 - - - - - - - C6 - - - A#5 - G5 -  A5 - - - - - - - E5 - - - - - . .
                    F5 - - - A5 - - - D6 - - - F6 - E6 -  D6 - - - - - - - A#5 - - - D6 - - -
                    G6 - - - D6 - - - A#5 - - - G5 - - -  A5 - - - C#6 - - - E6 - - - - - . .`),
    bass: "R.RR.RR.R.RR.RF.",
    arp: "1358531358531358",
    drums: ["k.h.s.hkk.h.s.hh", "k.h.s.hkk.h.s.hh", "k.h.s.hkk.h.s.hh", "k.h.s.hkk.tt.ttt"]
  },
  // Inferno and the Labyrinth: low, hot and not at all friendly
  hot: {
    bpm: 140, swing: 0, steps: 16, lead: "pulse", leadVol: 0.45, arpInst: "pluck", arpVol: 0.14, pad: 0.7, echo: 0.55,
    chords: ["Dm", "D#", "Dm", "C", "Dm", "D#", "A#", "A"],
    melody: tokens(`D5 . D5 . F5 . D5 . D#5 - - - D5 - . .    D#5 . G5 . A#5 . G5 . D#5 - - - D5 - C5 -
                    D5 . F5 . A5 . D6 . C6 - A5 - F5 - A5 -   G5 - - - E5 - - - C5 - - - E5 - G5 -
                    A5 - - - D6 - - - A5 - F5 - D5 - F5 -     G5 - - - D#6 - - - D6 - A#5 - G5 - D#5 -
                    F5 - - - A#5 - - - D6 - - - F6 - D6 -     C#6 - - - A5 - - - E5 - - - C#5 - - -`),
    bass: "R.RR.R.RR.RR.R.O",
    arp: "1...5...8...5...",
    drums: ["k..ks.k.k.k.s.ss", "k..ks.k.k.k.s.ss", "k..ks.k.k.k.s.ss", "k..ks.k.kttts.ss"]
  },
  // Nightmares: a music box left out in the rain
  dream: {
    bpm: 92, swing: 0, steps: 16, lead: "bell", leadVol: 0.7, arpInst: "bell", arpVol: 0.12, pad: 1, echo: 1, wobble: true,
    chords: ["Bm", "G", "Em", "F#", "Bm", "D", "Em", "F#"],
    melody: tokens(`F#5 - - - - - D5 - - - B4 - - - - -    G5 - - - - - D5 - - - B4 - - - - -
                    E5 - - - G5 - - - B5 - - - A5 - G5 -   F#5 - - - - - - - A#4 - - - - - . .
                    B5 - - - A5 - - - F#5 - - - D5 - - -   A5 - - - F#5 - - - D5 - - - A4 - - -
                    G5 - - - F#5 - - - E5 - - - D5 - C#5 - C#5 - - - - - - - A#4 - - - . . . .`),
    bass: "R---------------",
    arp: "1...5...8...5...",
    drums: ["k..k............", "k..k............", "k..k............", "k..k........t.t."]
  }
};

/* Check every theme's patterns once, so a typo can't hide in a loop */
Object.entries(TRACKS).forEach(([name, t]) => {
  const bars = t.chords.length;
  if (t.melody.length !== bars * t.steps) console.warn(`music: ${name} melody is ${t.melody.length} steps, expected ${bars * t.steps}`);
  if (t.melody.some(tok => tok !== "-" && tok !== "." && NOTE(tok) === null)) console.warn(`music: ${name} has a bad note`);
});
