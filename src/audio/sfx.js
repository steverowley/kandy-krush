let ctx = null;
let muted = false;
let musicEnabled = false;
let musicNodes = null;
let musicTimer = null;
// Track every in-flight SFX gain node so we can ramp them to silence
// when the player flips mute mid-envelope. The natural envelope tail
// (180-720ms on the larger SFX) would otherwise keep ringing for
// almost a second after mute.
const activeGains = new Set();

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
  if (muted) {
    stopMusic();
    // Kill in-flight SFX envelopes so a kick / boom doesn't keep
    // ringing for ~half a second after the player hits mute.
    if (ctx) {
      const now = ctx.currentTime;
      for (const gain of activeGains) {
        try {
          gain.gain.cancelScheduledValues(now);
          // Read current value safely; if unsupported, fall back to 0.
          const curr = gain.gain.value || 0.0001;
          gain.gain.setValueAtTime(curr, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.04);
        } catch {}
      }
    }
  } else if (musicEnabled) startMusic();
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
  // Track for mute-mid-envelope handling; auto-remove when it ends.
  activeGains.add(gain);
  osc.onended = () => {
    activeGains.delete(gain);
    try { gain.disconnect(); } catch {}
  };
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
  // Each cascade level boosts the base frequency more aggressively
  // (was +40Hz/level, now +80Hz/level) so a chain ×5 sounds way
  // brighter and more excited than a chain ×1.
  const base = 440 + cascadeLevel * 80;
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

// Epic cascade — fires when chain >= 5. Soaring rising sweep.
export function playEpicCascade() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const start = c.currentTime;
  const seq = [660, 988, 1318, 1760, 2349, 2960];
  seq.forEach((f, i) => tone(f, 220, 'sine', 0.1, i * 50));
  // Add a low triangle sub-rumble underneath
  tone(110, 600, 'triangle', 0.05, 0);
}

// 🦷 The Eater chomp — low sawtooth growl + filtered noise crunch.
export function playEaterChomp() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  // Descending growl
  tone(180, 220, 'sawtooth', 0.14, 0);
  tone(80, 420, 'sawtooth', 0.11, 80);
  // Crunch
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, Math.floor(0.22 * sr), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, c.currentTime + 0.12);
  filter.Q.setValueAtTime(0.7, c.currentTime + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.09, c.currentTime + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.34);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(c.currentTime + 0.12);
  src.stop(c.currentTime + 0.36);
}

// Boss-intro stinger — short orchestral hit (descending minor 6th).
export function playBossStinger() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  tone(220, 220, 'sawtooth', 0.16, 0);
  tone(165, 360, 'sawtooth', 0.14, 60);
  tone(110, 720, 'triangle', 0.12, 80);
  // Snare/cymbal-like noise hit
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, Math.floor(0.42 * sr), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.8);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(4500, c.currentTime);
  filter.Q.setValueAtTime(0.6, c.currentTime);
  const g = c.createGain();
  g.gain.setValueAtTime(0.05, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.42);
  src.connect(filter).connect(g).connect(c.destination);
  src.start();
  src.stop(c.currentTime + 0.44);
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
  if (!musicNodes || musicNodes.stopped || muted || musicMode === 'chip' || musicMode === 'boss') {
    crackleTimer = null;
    return;
  }
  playCrackle();
  // Sparse: 0.9-2.6s between pops, so the texture sits in the
  // background instead of clattering on top of the chord.
  const next = 900 + Math.random() * 1700;
  crackleTimer = setTimeout(scheduleNextCrackle, next);
}

// ---------- 16-bit chiptune — "Sweet Soldier" theme ----------
// Guile's-Theme-style driving D-minor march. Plays in roguelike mode.
// Square-wave melody over a syncopated bass groove and snare backbeat.
// Independent BPM (130) and bar scheduling from the lo-fi engine.
const CHIP_BPM = 132;
const CHIP_BEAT_S = 60 / CHIP_BPM;
const CHIP_BAR_S = CHIP_BEAT_S * 4;

const N = {
  D2: 73.42,  F2: 87.31,  A2: 110.00, Bb2: 116.54, C3: 130.81, D3: 146.83,
  F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, C4: 261.63, D4: 293.66,
  E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, C5: 523.25,
  D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, Bb5: 932.33,
  C6: 1046.50, D6: 1174.66,
};

// Each bar holds: chord voicing (stabbed on offbeats), 4 bass notes
// (one per beat, syncopated walking pattern), and 8 sixteenth-note
// melody slots (null = rest). Each "song" is 4 bars.
const CHIP_SONGS = [
  // Song A — main D-minor march. Two-bar A phrase, two-bar response.
  [
    {
      chord: [N.D4, N.F4, N.A4],
      bass:  [N.D2, N.D3, N.A2, N.D3],
      melody:[N.D5, N.F5, N.A5, N.G5,  N.F5, N.D5, N.E5, N.F5],
    },
    {
      chord: [N.Bb3, N.D4, N.F4],
      bass:  [N.Bb2, N.F3, N.Bb2, N.D3],
      melody:[N.G5, N.F5, N.D5, N.Bb4, N.D5, N.F5, N.A5, N.G5],
    },
    {
      chord: [N.A3, N.C4, N.E4],   // Am
      bass:  [N.A2, N.E4/2, N.A2, N.C4/2],
      melody:[N.A5, N.G5, N.E5, N.A5, N.G5, N.E5, N.D5, N.C5],
    },
    {
      chord: [N.D4, N.F4, N.A4],
      bass:  [N.D2, N.A2, N.D3, N.F3],
      melody:[N.D5, N.A4, N.D5, N.F5, N.A5, N.F5, N.D5, N.A4],
    },
  ],
  // Song B — climbing variant, hooks into the bridge feel.
  // Dm - Gm - Bb - A7 - Dm cadence
  [
    {
      chord: [N.D4, N.F4, N.A4],
      bass:  [N.D2, N.D3, N.A2, N.F3],
      melody:[N.A4, N.D5, N.F5, N.A5,  N.G5, N.F5, N.A5, N.D6],
    },
    {
      chord: [N.G3, N.Bb3, N.D4],
      bass:  [N.G3/2, N.D3, N.G3/2, N.Bb3/2],
      melody:[N.D5, N.G5, N.Bb5, N.G5, N.F5, N.D5, N.Bb4, N.G4],
    },
    {
      chord: [N.Bb3, N.D4, N.F4],
      bass:  [N.Bb2, N.F3, N.Bb2, N.D3],
      melody:[N.F5, N.A5, N.Bb5, N.A5, N.G5, N.F5, N.E5, N.D5],
    },
    {
      chord: [N.A3, N.C4, N.E4],  // A7-ish (C# implied by melody)
      bass:  [N.A2, N.E4/2, N.A2, N.E4/2],
      melody:[N.E5, N.G5, N.A5, N.C6, N.A5, N.G5, N.E5, N.D5],
    },
  ],
  // Song C — heroic stage-clear march. Strong walking bass, rising
  // brassy melody. Inspired by 16-bit fighting game themes.
  // Dm - F - Bb - C - back to Dm cadence.
  [
    {
      chord: [N.D4, N.F4, N.A4],
      bass:  [N.D2, N.F2, N.A2, N.D3],
      melody:[N.D5, N.F5, N.A5, N.D6, N.A5, N.F5, N.D5, N.A4],
    },
    {
      chord: [N.F4, N.A4, N.C5],     // F major (the IIIᴹᴬᴶ lift)
      bass:  [N.F2, N.A2, N.C3, N.F3],
      melody:[N.F5, N.A5, N.C6, N.A5, N.F5, N.A5, N.C6, N.D6],
    },
    {
      chord: [N.Bb3, N.D4, N.F4],
      bass:  [N.Bb2, N.D3, N.F3, N.Bb3],
      melody:[N.Bb5, N.A5, N.G5, N.F5, N.D5, N.F5, N.A5, N.Bb5],
    },
    {
      chord: [N.A3, N.C4, N.E4],     // V-of-Dm payoff
      bass:  [N.A2, N.C3, N.E4/2, N.A2],
      melody:[N.A5, N.G5, N.F5, N.E5, N.D5, N.E5, N.F5, N.A5],
    },
  ],
  // Song D — slinky shuffle. Bb-Eb feel, syncopated bass, sneaky
  // melody. Good for mutator slots / "tricky" rounds.
  [
    {
      chord: [N.D4, N.F4, N.A4],
      bass:  [N.D2, N.A2, N.F2, N.A2],
      melody:[null, N.D5, null, N.F5, N.A5, N.F5, N.A5, N.G5],
    },
    {
      chord: [N.G3, N.Bb3, N.D4],
      bass:  [N.G3/2, N.G3, N.D3, N.G3],
      melody:[N.G5, null, N.Bb5, N.G5, null, N.D5, N.G5, N.A5],
    },
    {
      chord: [N.F4, N.A4, N.C5],
      bass:  [N.F2, N.A2, N.F2, N.C3],
      melody:[null, N.F5, N.A5, N.C6, N.A5, null, N.F5, N.A5],
    },
    {
      chord: [N.A3, N.C4, N.E4],
      bass:  [N.A2, N.E4/2, N.A2, N.E4/2],
      melody:[N.A5, N.G5, N.E5, N.G5, N.A5, null, N.E5, N.D5],
    },
  ],
  // Song E — slow waltz-ish ballad. Pad chord stabs spread, melody
  // breathes. Good for the quieter early slots.
  [
    {
      chord: [N.D4, N.F4, N.A4],
      bass:  [N.D2, null, N.A2, null],
      melody:[N.D5, null, null, N.F5, null, null, N.A5, null],
    },
    {
      chord: [N.Bb3, N.D4, N.F4],
      bass:  [N.Bb2, null, N.F3, null],
      melody:[N.Bb5, null, N.A5, null, N.G5, null, N.F5, null],
    },
    {
      chord: [N.G3, N.Bb3, N.D4],
      bass:  [N.G3/2, null, N.D3, null],
      melody:[N.G5, null, null, N.A5, null, null, N.Bb5, null],
    },
    {
      chord: [N.A3, N.C4, N.E4],
      bass:  [N.A2, null, N.E4/2, null],
      melody:[N.A5, null, N.G5, null, N.F5, null, N.E5, null],
    },
  ],
];

let musicMode = 'normal'; // 'normal' | 'chip' | 'boss'
// In boss mode the chiptune speeds up and the snare doubles. Same
// song bank — just a tempo and groove change.
const BOSS_BPM_MULT = 1.35;
function chipBpmActive() {
  return musicMode === 'boss' ? CHIP_BPM * BOSS_BPM_MULT : CHIP_BPM;
}
function chipBeatActive() { return 60 / chipBpmActive(); }
function chipBarActive() { return chipBeatActive() * 4; }

export function setMusicMode(mode) {
  let next;
  if (mode === 'boss') next = 'boss';
  else if (mode === 'roguelike') next = 'chip';
  else next = 'normal';
  if (next === musicMode) return;
  musicMode = next;
  songIndex = 0;
  beatBarCount = 0;
  musicChordIndex = 0;
  // If music's playing, kill the lo-fi chord queue and let the next
  // scheduled bar pick up the new style. Restart fresh so the styles
  // don't bleed.
  if (musicNodes && !musicNodes.stopped && musicEnabled && !muted) {
    stopMusic();
    startMusic();
  }
}

function currentSong() {
  const bank = (musicMode === 'chip' || musicMode === 'boss') ? CHIP_SONGS : SONGS;
  return bank[songIndex % bank.length];
}

// ---------- Chiptune drum/bass/melody ----------
function chipBlip(at, freq, durSec, type = 'square', peak = 0.06) {
  if (muted || !ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.006);
  g.gain.setValueAtTime(peak, at + Math.max(0.01, durSec - 0.03));
  g.gain.exponentialRampToValueAtTime(0.0001, at + durSec);
  osc.connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + durSec + 0.02);
}

function chipBass(at, freq) {
  if (muted || !ctx) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(540, at);
  filter.Q.setValueAtTime(0.4, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.065, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + CHIP_BEAT_S * 0.85);
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, at);
  osc.connect(filter).connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + CHIP_BEAT_S + 0.05);
}

function chipChordStab(at, freqs) {
  if (muted || !ctx) return;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, at);
  filter.Q.setValueAtTime(0.5, at);
  const g = ctx.createGain();
  const dur = CHIP_BEAT_S * 0.35;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.025, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  filter.connect(g).connect(ctx.destination);
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(f, at);
    o.detune.setValueAtTime((Math.random() - 0.5) * 4, at);
    o.connect(filter);
    o.start(at);
    o.stop(at + dur + 0.04);
  }
}

function chipSnare(at, accent = false) {
  if (muted || !ctx) return;
  const len = accent ? 0.11 : 0.08;
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
  filter.frequency.setValueAtTime(2400, at);
  filter.Q.setValueAtTime(0.9, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.05 : 0.038, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(at);
  src.stop(at + len + 0.02);
}

function chipKick(at) {
  if (muted || !ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, at);
  osc.frequency.exponentialRampToValueAtTime(44, at + 0.12);
  g.gain.setValueAtTime(0.001, at);
  g.gain.exponentialRampToValueAtTime(0.09, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  osc.connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.25);
}

function scheduleChipBar(startAt, bar) {
  const beat = chipBeatActive();
  const isBoss = musicMode === 'boss';
  // Bass: one note per beat. Boss mode kicks every half-beat instead
  // for a relentless driving feel.
  for (let i = 0; i < 4; i++) chipBass(startAt + i * beat, bar.bass[i]);
  if (isBoss) {
    // Extra off-beat bass stabs at the and-of-each beat.
    for (let i = 0; i < 4; i++) chipBass(startAt + (i + 0.5) * beat, bar.bass[i] * 1.5);
  }
  // Kick on 1 and 3 (military downbeat); snare on 2 and 4 (backbeat).
  chipKick(startAt);
  chipKick(startAt + beat * 2);
  chipSnare(startAt + beat * 1, false);
  chipSnare(startAt + beat * 3, true);
  // Snare flam right before downbeat — that Guile groove. Always in
  // boss mode; occasional in regular chip mode.
  if (isBoss || Math.random() < 0.35) {
    chipSnare(startAt + beat * 3 + beat * 0.5, false);
    chipSnare(startAt + beat * 3 + beat * 0.75, false);
  }
  if (isBoss) {
    // Snare rolls on 1.5 too for chaos.
    chipSnare(startAt + beat * 1 + beat * 0.5, false);
  }
  // Chord stabs on the AND of beats 2 and 4 — Reggae-skank-ish push.
  chipChordStab(startAt + beat * 1.5, bar.chord);
  chipChordStab(startAt + beat * 3.5, bar.chord);
  // Melody: 8 eighth notes per bar.
  for (let i = 0; i < 8; i++) {
    const f = bar.melody[i];
    if (!f) continue;
    const at = startAt + i * beat / 2;
    chipBlip(at, f, beat * 0.42, 'square', 0.05);
  }
}

function scheduleNextBeatBar() {
  if (!musicNodes || musicNodes.stopped || muted) {
    beatTimer = null;
    return;
  }
  const c = ensureCtx();
  if (!c) return;
  if (musicMode === 'chip' || musicMode === 'boss') {
    const song = currentSong();
    const bar = song[beatBarCount % song.length];
    scheduleChipBar(c.currentTime + 0.04, bar);
    beatBarCount++;
    // Loop the song twice then advance to next song.
    if (beatBarCount > 0 && beatBarCount % (song.length * 2) === 0) {
      songIndex = (songIndex + 1) % CHIP_SONGS.length;
    }
    beatTimer = setTimeout(scheduleNextBeatBar, chipBarActive() * 1000);
    return;
  }
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
  // Chip mode is a separate engine — bar scheduler handles everything.
  // Don't layer lo-fi pads underneath the chiptune.
  if (musicMode === 'chip' || musicMode === 'boss') return;
  const c = ensureCtx();
  if (!c) return;
  const song = currentSong();
  const chord = song[musicChordIndex];
  musicChordIndex = (musicChordIndex + 1) % song.length;
  // After completing one full pass through the current song's chords,
  // advance to the next song in the active bank.
  if (musicChordIndex === 0) {
    songIndex = (songIndex + 1) % SONGS.length;
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
