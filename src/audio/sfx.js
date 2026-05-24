let ctx = null;
let muted = false;

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
}

export function isMuted() {
  return muted;
}

export function unlockAudio() {
  ensureCtx();
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

export function playMatch(tileCount, cascadeLevel) {
  const base = 440 + cascadeLevel * 50;
  const notes = Math.min(tileCount, 6);
  for (let i = 0; i < notes; i++) {
    tone(base * Math.pow(1.122, i), 150, 'triangle', 0.14, i * 55);
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
