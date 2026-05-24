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

// --- Background music ---
// A warm I-V-vi-IV progression in C major — the classic "happy" pop loop
// — sitting in the upper-mid octave so it never feels droney. Each chord
// crossfades into the next with a subtle bell on top for sparkle.
// Capped at 4% gain so it sits comfortably under SFX.
const MUSIC_CHORDS = [
  // C major   (I)   — C5, E5, G5
  [523.25, 659.25, 783.99],
  // G major   (V)   — G4, B4, D5
  [392.00, 493.88, 587.33],
  // A minor   (vi)  — A4, C5, E5
  [440.00, 523.25, 659.25],
  // F major   (IV)  — F4, A4, C5
  [349.23, 440.00, 523.25],
];
const MUSIC_BELLS = [
  // Top-octave sparkle that sits above each chord; just one note each.
  1046.50, // C6
  987.77,  // B5
  1318.51, // E6
  1046.50, // C6
];
let musicChordIndex = 0;

function playChord(chord, bellFreq, startAt, holdMs, fadeMs) {
  if (muted || !ctx) return [];
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, startAt);
  masterGain.gain.linearRampToValueAtTime(0.04, startAt + fadeMs / 1000);
  masterGain.gain.setValueAtTime(0.04, startAt + (holdMs - fadeMs) / 1000);
  masterGain.gain.linearRampToValueAtTime(0, startAt + holdMs / 1000);
  masterGain.connect(ctx.destination);

  const oscs = [];
  for (const freq of chord) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startAt);
    // Tiny detune for warmth.
    osc.detune.setValueAtTime((Math.random() - 0.5) * 6, startAt);
    osc.connect(masterGain);
    osc.start(startAt);
    osc.stop(startAt + holdMs / 1000 + 0.1);
    oscs.push(osc);
  }
  if (bellFreq) {
    const bellGain = ctx.createGain();
    bellGain.gain.setValueAtTime(0, startAt);
    bellGain.gain.linearRampToValueAtTime(0.025, startAt + 0.6);
    bellGain.gain.linearRampToValueAtTime(0, startAt + holdMs / 1000);
    bellGain.connect(ctx.destination);
    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(bellFreq, startAt);
    bell.connect(bellGain);
    bell.start(startAt);
    bell.stop(startAt + holdMs / 1000 + 0.1);
    oscs.push(bell);
  }
  return oscs;
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
}

function scheduleNextChord() {
  if (!musicNodes || musicNodes.stopped || muted) return;
  const c = ensureCtx();
  if (!c) return;
  const holdMs = 6500;
  const fadeMs = 1800;
  const chord = MUSIC_CHORDS[musicChordIndex];
  const bell = MUSIC_BELLS[musicChordIndex];
  musicChordIndex = (musicChordIndex + 1) % MUSIC_CHORDS.length;
  const oscs = playChord(chord, bell, c.currentTime, holdMs, fadeMs);
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
  if (musicNodes) {
    musicNodes.stopped = true;
    for (const o of musicNodes.oscs) {
      try { o.stop(); } catch {}
    }
    musicNodes = null;
  }
}
