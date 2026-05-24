let ctx = null;
let muted = false;
let musicEnabled = false;
let musicNodes = null;
let musicTimer = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setMuted(v) {
  muted = !!v;
  if (muted) stopMusic();
  else if (musicEnabled) startMusic();
}

export function isMuted() {
  return muted;
}

export function unlockAudio() {
  ensureCtx();
  if (musicEnabled && !muted && !musicNodes) startMusic();
}

function tone(freq, durationMs, type = 'sine', peakGain = 0.16, delayMs = 0) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.04);
}

export function playSelect() {
  tone(660, 80, 'square', 0.05);
}

export function playSwap() {
  tone(520, 100, 'sine', 0.08);
  tone(720, 110, 'sine', 0.08, 70);
}

// Match sounds now vary by chain length:
//   3-match  -> simple ascending triad
//   4-match  -> brighter triangle arpeggio (striped-candy worthy)
//   5+ match -> full chord burst (rainbow-candy worthy)
export function playMatch(tileCount, cascadeLevel = 1) {
  const base = 440 + cascadeLevel * 40;
  if (tileCount >= 5) {
    // Big chord: maj7 stacked with sparkle on top
    const chord = [1, 1.25, 1.5, 1.875, 2.5];
    chord.forEach((mult, i) => tone(base * mult, 320, 'triangle', 0.12, i * 35));
    tone(base * 3, 240, 'sine', 0.08, 200);
  } else if (tileCount === 4) {
    // Striped arpeggio: octave run with bright triangle
    const arp = [1, 1.122, 1.26, 1.5];
    arp.forEach((mult, i) => tone(base * mult, 200, 'triangle', 0.13, i * 45));
    tone(base * 2, 260, 'sine', 0.07, 160);
  } else {
    // Simple 3-match
    const notes = Math.min(tileCount, 3);
    for (let i = 0; i < notes; i++) {
      tone(base * Math.pow(1.122, i), 150, 'triangle', 0.14, i * 55);
    }
  }
}

export function playCascade() {
  tone(660, 80, 'sine', 0.06, 0);
  tone(880, 80, 'sine', 0.06, 70);
  tone(1175, 130, 'sine', 0.08, 140);
}

export function playInvalid() {
  tone(180, 160, 'sawtooth', 0.06);
}

export function playRestart() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, 200, 'sine', 0.11, i * 70));
}

// Per-objective completion jingles. Different shape per objective kind
// so she can tell at a distance which kind of win it was.
export function playObjectiveComplete(kind) {
  switch (kind) {
    case 'score': {
      // Triumphant ascending major chord
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => tone(f, 360, 'triangle', 0.13, i * 80));
      tone(1568, 500, 'sine', 0.08, 380);
      break;
    }
    case 'clearType': {
      // Warm 4-note maj7
      [659, 784, 988, 1175].forEach((f, i) => tone(f, 420, 'sine', 0.12, i * 60));
      break;
    }
    case 'clearJelly': {
      // Bubbly water-drop sequence (descending sines with quick decay)
      [1568, 1175, 988, 784, 1175, 1568].forEach((f, i) =>
        tone(f, 140, 'sine', 0.11, i * 75)
      );
      tone(2349, 320, 'sine', 0.07, 450);
      break;
    }
    case 'matches': {
      // Light triadic flourish
      [659, 784, 988, 784, 1175].forEach((f, i) =>
        tone(f, 200, 'triangle', 0.12, i * 70)
      );
      break;
    }
    case 'specials': {
      // Sparkly high-octave chord
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 380, 'triangle', 0.11, i * 50));
      tone(2637, 500, 'sine', 0.07, 220);
      break;
    }
    default:
      playRestart();
  }
}

// Warm, gentle "try again" cue — no buzz, no fail vibe.
// Two-note descending soft pad, with a slight chord tail so it
// reads as "ok, let's go again" rather than "you lost".
export function playLevelFail() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  tone(440, 600, 'sine', 0.09, 0);
  tone(370, 700, 'sine', 0.08, 120);
  tone(294, 900, 'sine', 0.07, 240);
}

// --- Background music: lo-fi pad + half-time beat + sub bass ---
// Slow jazzy chord changes through a low-pass filter, white-noise crackle
// underneath, plus a 75 BPM kick/snare/hat pattern and a triangle-wave
// sub bass that walks the chord roots. Pure Web Audio, no samples.
//
// A small library of songs cycles automatically — same lo-fi vibe but
// different chord motion so the loop doesn't get monotonous. Each song
// plays one full cycle (4 chords × 4 bars each ≈ 51s) before
// crossfading into the next via the existing chord-crossfade.
const SONGS = [
  // Song A: descending mellow (the original).
  // Fmaj7 -> Em7 -> Dm7 -> Cmaj7
  [
    { notes: [349.23, 440.00, 523.25, 659.25], bass: 87.31 },
    { notes: [329.63, 392.00, 493.88, 587.33], bass: 82.41 },
    { notes: [293.66, 349.23, 440.00, 523.25], bass: 73.42 },
    { notes: [261.63, 329.63, 392.00, 493.88], bass: 65.41 },
  ],
  // Song B: minor ii-V-I-vi turnaround.
  // Am9 -> Dm9 -> G7 -> Cmaj7
  [
    { notes: [440.00, 523.25, 659.25, 783.99], bass: 55.00 },  // A m9
    { notes: [293.66, 349.23, 440.00, 523.25], bass: 73.42 },  // Dm9 (uses Dm7 voicing for warmth)
    { notes: [392.00, 493.88, 587.33, 698.46], bass: 98.00 },  // G7
    { notes: [261.63, 329.63, 392.00, 493.88], bass: 65.41 },  // Cmaj7
  ],
  // Song C: ascending arc — opens up after the descents above.
  // Cmaj7 -> Em7 -> Fmaj7 -> Gmaj7
  [
    { notes: [261.63, 329.63, 392.00, 493.88], bass: 65.41 },
    { notes: [329.63, 392.00, 493.88, 587.33], bass: 82.41 },
    { notes: [349.23, 440.00, 523.25, 659.25], bass: 87.31 },
    { notes: [392.00, 493.88, 587.33, 698.46], bass: 98.00 },
  ],
  // Song D: classic ii-V-I-vi pop turnaround at lo-fi tempo.
  // Dm7 -> G7 -> Cmaj7 -> Am7
  [
    { notes: [293.66, 349.23, 440.00, 523.25], bass: 73.42 },
    { notes: [392.00, 493.88, 587.33, 698.46], bass: 98.00 },
    { notes: [261.63, 329.63, 392.00, 493.88], bass: 65.41 },
    { notes: [440.00, 523.25, 659.25, 783.99], bass: 55.00 },
  ],
];
let songIndex = 0;
const BPM = 75;
const BEAT_S = 60 / BPM;           // 0.8s per quarter
const BAR_S = BEAT_S * 4;          // 3.2s per 4/4 bar
const BARS_PER_CHORD = 4;          // each chord holds for 4 bars = 12.8s
const CHORD_HOLD_MS = BAR_S * BARS_PER_CHORD * 1000;
const CHORD_FADE_MS = BAR_S * 1000;

let musicChordIndex = 0;
let crackleTimer = null;
let beatTimer = null;
let beatBarCount = 0;

function playLoFiChord(chord, startAt, holdMs, fadeMs) {
  if (muted || !ctx) return [];
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, startAt);
  filter.Q.setValueAtTime(0.6, startAt);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, startAt);
  masterGain.gain.linearRampToValueAtTime(0.032, startAt + fadeMs / 1000);
  masterGain.gain.setValueAtTime(0.032, startAt + (holdMs - fadeMs) / 1000);
  masterGain.gain.linearRampToValueAtTime(0, startAt + holdMs / 1000);

  filter.connect(masterGain).connect(ctx.destination);

  const oscs = [];
  for (const freq of chord.notes) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startAt);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 16, startAt);
    osc.connect(filter);
    osc.start(startAt);
    osc.stop(startAt + holdMs / 1000 + 0.1);
    oscs.push(osc);
  }
  return oscs;
}

// ---------- drum hits ----------
function hitKick(at) {
  if (muted || !ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.13);
  g.gain.setValueAtTime(0.001, at);
  g.gain.exponentialRampToValueAtTime(0.07, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.25);
}

function hitSnare(at) {
  if (muted || !ctx) return;
  const len = 0.13;
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(len * sr), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1700, at);
  filter.Q.setValueAtTime(0.7, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.028, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(at);
  src.stop(at + len + 0.02);
}

function hitHat(at, accent = false) {
  if (muted || !ctx) return;
  const len = accent ? 0.05 : 0.035;
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(len * sr), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(6500, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.013 : 0.009, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(at);
  src.stop(at + len + 0.02);
}

function hitBass(at, freq) {
  if (muted || !ctx) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, at);
  filter.Q.setValueAtTime(0.5, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.045, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, at);
  osc.detune.setValueAtTime(-4, at);
  osc.connect(filter).connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 1.5);
}

// Schedule one bar's worth of beat events starting at audio time `startAt`.
function scheduleBar(startAt, chord) {
  // Hat: 8 hits (eighth notes), accent on downbeats.
  for (let i = 0; i < 8; i++) {
    hitHat(startAt + (i * BEAT_S) / 2, i % 2 === 0);
  }
  // Kick on beat 1.
  hitKick(startAt);
  // Snare on beat 3.
  hitSnare(startAt + BEAT_S * 2);
  // Bass: root on beat 1, fifth on beat 3 — gives motion.
  hitBass(startAt, chord.bass);
  hitBass(startAt + BEAT_S * 2, chord.bass * 1.5);
}

// Very quiet white-noise burst — barely-there vinyl crackle.
function playCrackle() {
  if (muted || !ctx || !musicNodes || musicNodes.stopped) return;
  try {
    const len = 0.03;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(len * sr), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, ctx.currentTime);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0022, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + len + 0.02);
  } catch {}
}

function scheduleNextCrackle() {
  if (!musicNodes || musicNodes.stopped || muted) {
    crackleTimer = null;
    return;
  }
  playCrackle();
  // Sparse: 0.9-2.6s between pops, so the texture sits in the
  // background instead of clattering on top of the chord.
  const next = 900 + Math.random() * 1700;
  crackleTimer = setTimeout(scheduleNextCrackle, next);
}

// Dungeon set — darker minor 7th chords, lower octaves. Used when
// the active mode is 'roguelike'.
const DUNGEON_SONGS = [
  // Am7 -> Dm7 -> Bbmaj7 -> Em7 — modal jazz-noir feel
  [
    { notes: [220.00, 261.63, 329.63, 392.00], bass: 55.00 },   // A m7  (A3/C4/E4/G4, bass A1)
    { notes: [293.66, 349.23, 440.00, 523.25], bass: 73.42 },   // D m7
    { notes: [233.08, 293.66, 349.23, 440.00], bass: 58.27 },   // Bb maj7
    { notes: [246.94, 293.66, 369.99, 440.00], bass: 61.74 },   // B dim-ish
  ],
  // Em7 -> Cmaj7 -> G m7 -> D 7 — slow descending dread
  [
    { notes: [164.81, 196.00, 246.94, 293.66], bass: 41.20 },   // E m7
    { notes: [196.00, 246.94, 293.66, 369.99], bass: 49.00 },   // G m7
    { notes: [146.83, 174.61, 220.00, 261.63], bass: 36.71 },   // D m7
    { notes: [130.81, 164.81, 196.00, 246.94], bass: 32.70 },   // C m7
  ],
];

let musicMode = 'normal'; // 'normal' | 'dungeon'
export function setMusicMode(mode) {
  const next = mode === 'roguelike' ? 'dungeon' : 'normal';
  if (next === musicMode) return;
  musicMode = next;
  songIndex = 0;
  // If music's playing, fade old out by clearing the queue — the next
  // scheduled chord will pick up from the new song bank.
}

function currentSong() {
  const bank = musicMode === 'dungeon' ? DUNGEON_SONGS : SONGS;
  return bank[songIndex % bank.length];
}

function scheduleNextBeatBar() {
  if (!musicNodes || musicNodes.stopped || muted) {
    beatTimer = null;
    return;
  }
  const c = ensureCtx();
  if (!c) return;
  const song = currentSong();
  const chord = song[Math.floor(beatBarCount / BARS_PER_CHORD) % song.length];
  scheduleBar(c.currentTime + 0.04, chord);
  beatBarCount++;
  beatTimer = setTimeout(scheduleNextBeatBar, BAR_S * 1000);
}

export function setMusicEnabled(on) {
  musicEnabled = !!on;
  if (!musicEnabled) stopMusic();
  else if (!muted) startMusic();
}

function startMusic() {
  if (musicNodes || muted) return;
  const c = ensureCtx();
  if (!c) return;
  musicNodes = { oscs: [], stopped: false };
  musicChordIndex = 0;
  beatBarCount = 0;
  // Randomly pick a starting song so two sessions in a row don't
  // always open with the same chord progression.
  songIndex = Math.floor(Math.random() * SONGS.length);
  scheduleNextChord();
  scheduleNextCrackle();
  // Small delay so the first chord has begun fading in before the beat starts.
  setTimeout(() => {
    if (musicNodes && !musicNodes.stopped) scheduleNextBeatBar();
  }, 400);
}

function scheduleNextChord() {
  if (!musicNodes || musicNodes.stopped || muted) return;
  const c = ensureCtx();
  if (!c) return;
  const song = currentSong();
  const chord = song[musicChordIndex];
  musicChordIndex = (musicChordIndex + 1) % song.length;
  // After completing one full pass through the current song's chords,
  // advance to the next song in the active bank.
  if (musicChordIndex === 0) {
    const bank = musicMode === 'dungeon' ? DUNGEON_SONGS : SONGS;
    songIndex = (songIndex + 1) % bank.length;
  }
  const oscs = playLoFiChord(chord, c.currentTime, CHORD_HOLD_MS, CHORD_FADE_MS);
  musicNodes.oscs.push(...oscs);
  musicTimer = setTimeout(() => {
    musicNodes.oscs = musicNodes.oscs.filter((o) => {
      try { o.stop(); } catch {}
      return false;
    });
    scheduleNextChord();
  }, CHORD_HOLD_MS - CHORD_FADE_MS);
}

function stopMusic() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (crackleTimer) {
    clearTimeout(crackleTimer);
    crackleTimer = null;
  }
  if (beatTimer) {
    clearTimeout(beatTimer);
    beatTimer = null;
  }
  if (musicNodes) {
    musicNodes.stopped = true;
    for (const o of musicNodes.oscs) {
      try { o.stop(); } catch {}
    }
    musicNodes = null;
  }
}
