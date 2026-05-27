/**
 * Web Audio synth — generates the app's entire sound vocabulary in
 * realtime, no audio files. Suits map to notes from a pentatonic scale
 * so even rapid cascades stay consonant.
 *
 * AudioContext can only start after a user gesture, so we lazy-init on
 * the first sound. If audio is denied or unsupported, every call is a
 * silent no-op — the rest of the app keeps working.
 */

type Ctx = AudioContext | null;
let _ctx: Ctx = null;
let _master: GainNode | null = null;
let _enabled = true;

function ensureCtx(): Ctx {
  if (_ctx) return _ctx;
  const Ctor = (window.AudioContext ?? (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
    _master = _ctx.createGain();
    _master.gain.value = 0.18;
    _master.connect(_ctx.destination);
    return _ctx;
  } catch {
    return null;
  }
}

export function setEnabled(on: boolean) {
  _enabled = on;
}

export function setMasterGain(g: number) {
  if (!_master) return;
  _master.gain.value = g;
}

/**
 * Schedule a single tone. Defaults give a soft "bell" envelope.
 */
export function tone(
  freq: number,
  opts: {
    type?: OscillatorType;
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
    duration?: number;
    gain?: number;
    detune?: number;
    delay?: number;
  } = {},
) {
  if (!_enabled) return;
  const ctx = ensureCtx();
  if (!ctx || !_master) return;

  const {
    type = "sine",
    attack = 0.005,
    decay = 0.05,
    sustain = 0.7,
    release = 0.18,
    duration = 0.16,
    gain = 0.9,
    detune = 0,
    delay = 0,
  } = opts;

  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  // ADSR envelope.
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.linearRampToValueAtTime(gain * sustain, t0 + attack + decay);
  g.gain.setValueAtTime(gain * sustain, t0 + attack + decay + duration);
  g.gain.linearRampToValueAtTime(0, t0 + attack + decay + duration + release);

  osc.connect(g).connect(_master);
  osc.start(t0);
  osc.stop(t0 + attack + decay + duration + release + 0.05);
}

/** Play a sequence of (freq, delaySec) pairs. */
export function arpeggio(
  steps: Array<{ freq: number; delay?: number; duration?: number; gain?: number; type?: OscillatorType }>,
) {
  let acc = 0;
  for (const s of steps) {
    acc += s.delay ?? 0.08;
    tone(s.freq, {
      delay: acc,
      duration: s.duration ?? 0.16,
      gain: s.gain ?? 0.9,
      type: s.type ?? "sine",
    });
  }
}

/**
 * Sub-bass thud — used for illegal-swap nudge. Short, low, percussive.
 */
export function thud(freq = 110, gain = 0.6) {
  if (!_enabled) return;
  const ctx = ensureCtx();
  if (!ctx || !_master) return;

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.linearRampToValueAtTime(0, t0 + 0.2);
  osc.connect(g).connect(_master);
  osc.start(t0);
  osc.stop(t0 + 0.22);
}
