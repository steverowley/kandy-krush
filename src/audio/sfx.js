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

// --- Background music: lo-fi pad ---
// Slow jazzy chord changes routed through a low-pass filter for that
// muffled-vinyl warmth, plus a quiet white-noise crackle bed underneath.
// Pure Web Audio, no samples. Capped at ~3.5% gain so it stays under SFX.
const MUSIC_CHORDS = [
  // Fmaj7 — F4, A4, C5, E5
  [349.23, 440.00, 523.25, 659.25],
  // Em7  — E4, G4, B4, D5
  [329.63, 392.00, 493.88, 587.33],
  // Dm7  — D4, F4, A4, C5
  [293.66, 349.23, 440.00, 523.25],
  // Cmaj7 — C4, E4, G4, B4
  [261.63, 329.63, 392.00, 493.88],
];
let musicChordIndex = 0;
let crackleTimer = null;

function playLoFiChord(chord, startAt, holdMs, fadeMs) {
  if (muted || !ctx) return [];
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, startAt);
  filter.Q.setValueAtTime(0.6, startAt);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, startAt);
  masterGain.gain.linearRampToValueAtTime(0.035, startAt + fadeMs / 1000);
  masterGain.gain.setValueAtTime(0.035, startAt + (holdMs - fadeMs) / 1000);
  masterGain.gain.linearRampToValueAtTime(0, startAt + holdMs / 1000);

  filter.connect(masterGain).connect(ctx.destination);

  const oscs = [];
  for (const freq of chord) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startAt);
    // Wider detune (±8 cents) for that hazy lo-fi chorus.
    osc.detune.setValueAtTime((Math.random() - 0.5) * 16, startAt);
    osc.connect(filter);
    osc.start(startAt);
    osc.stop(startAt + holdMs / 1000 + 0.1);
    oscs.push(osc);
  }
  // A second pad an octave down for body, very low volume.
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0, startAt);
  subGain.gain.linearRampToValueAtTime(0.018, startAt + fadeMs / 1000);
  subGain.gain.linearRampToValueAtTime(0, startAt + holdMs / 1000);
  subGain.connect(filter);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(chord[0] / 2, startAt);
  sub.connect(subGain);
  sub.start(startAt);
  sub.stop(startAt + holdMs / 1000 + 0.1);
  oscs.push(sub);

  return oscs;
}

// Quiet white-noise burst — vinyl crackle. Scheduled at random intervals
// (180-720ms apart) while music is enabled.
function playCrackle() {
  if (muted || !ctx || !musicNodes || musicNodes.stopped) return;
  try {
    const len = 0.04;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(len * sr), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.008, ctx.currentTime);
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
  const next = 180 + Math.random() * 540;
  crackleTimer = setTimeout(scheduleNextCrackle, next);
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
  scheduleNextChord();
  scheduleNextCrackle();
}

function scheduleNextChord() {
  if (!musicNodes || musicNodes.stopped || muted) return;
  const c = ensureCtx();
  if (!c) return;
  const holdMs = 10000;
  const fadeMs = 3600;
  const chord = MUSIC_CHORDS[musicChordIndex];
  musicChordIndex = (musicChordIndex + 1) % MUSIC_CHORDS.length;
  const oscs = playLoFiChord(chord, c.currentTime, holdMs, fadeMs);
  musicNodes.oscs.push(...oscs);
  musicTimer = setTimeout(() => {
    musicNodes.oscs = musicNodes.oscs.filter((o) => {
      try { o.stop(); } catch {}
      return false;
    });
    scheduleNextChord();
  }, holdMs - fadeMs);
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
  if (musicNodes) {
    musicNodes.stopped = true;
    for (const o of musicNodes.oscs) {
      try { o.stop(); } catch {}
    }
    musicNodes = null;
  }
}
